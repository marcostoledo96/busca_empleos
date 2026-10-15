// Tests de validación profunda de la Migración 023 y backfill de identidad canónica contra PostgreSQL real.
// Verifica alineación 100% exacta entre SQL y runtime JavaScript, umbrales de longitud (399, 401, 450, 500, 600, 2048 chars),
// preservación de query funcional, descarte de tracking, variantes de plataformas, resolución de colisiones históricas e idempotencia.

const fs = require('fs');
const path = require('path');
const pool = require('../../src/config/base-datos');
const modeloOferta = require('../../src/modelos/oferta');
const { obtenerIdentidadCanonica } = require('../../src/servicios/servicio-identidad-ofertas');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');

const dbTestsPermitidos = process.env.ALLOW_DB_TESTS === 'true';
const entornoSeguro = process.env.NODE_ENV === 'test'
    || (process.env.PGDATABASE || '').includes('test');
const contexto = (dbTestsPermitidos && entornoSeguro) ? describe : describe.skip;

contexto('Migración 023 — Validación de Backfill SQL vs Runtime JS en PostgreSQL Sintético', () => {
    const rutaSql023 = path.resolve(__dirname, '../../sql/migracion-023-identidad-y-reapariciones.sql');
    const contenidoSql023 = fs.readFileSync(rutaSql023, 'utf8');

    beforeEach(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
    });

    afterAll(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
        await pool.end();
    });

    test('El backfill SQL genera exactamente la misma identidad que runtime JS para todos los portales y longitudes', async () => {
        // Genero URLs con longitudes calibradas con sintaxis válida
        const paramsExtenso = (longitudDeseada) => {
            const base = 'https://portal-remoto.com/puestos/dev?id=999';
            const rellenoLongitud = longitudDeseada - base.length - 3; // -3 por '&p='
            return base + '&p=' + 'a'.repeat(rellenoLongitud);
        };

        const url399 = paramsExtenso(399);
        const url401 = paramsExtenso(401);
        const url450 = paramsExtenso(450);
        const url500 = paramsExtenso(500);
        const url600 = paramsExtenso(600);
        const url2048 = paramsExtenso(2048);

        const filasPreexistentes = [
            // Variantes de longitud
            { titulo: 'Dev 399', empresa: 'Corp', url: url399, plataforma: 'general' },
            { titulo: 'Dev 401', empresa: 'Corp', url: url401, plataforma: 'general' },
            { titulo: 'Dev 450', empresa: 'Corp', url: url450, plataforma: 'general' },
            { titulo: 'Dev 500', empresa: 'Corp', url: url500, plataforma: 'general' },
            { titulo: 'Dev 600', empresa: 'Corp', url: url600, plataforma: 'general' },
            { titulo: 'Dev 2048', empresa: 'Corp', url: url2048, plataforma: 'general' },

            // Query funcional + tracking universal
            {
                titulo: 'Dev Query Funcional',
                empresa: 'Tech S.A.',
                url: 'https://empleos-it.com/oferta?job=dev-123&utm_source=newsletter&fbclid=xyz&area=backend',
                plataforma: 'general',
            },

            // Indeed: jk en query
            {
                titulo: 'Frontend Indeed Query',
                empresa: 'IndeedCorp',
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&from=serp&utm_campaign=winter',
                plataforma: 'indeed',
            },
            // Indeed: jk en path
            {
                titulo: 'Frontend Indeed Path',
                empresa: 'IndeedCorp',
                url: 'https://ar.indeed.com/job/frontend-developer-9f8e7d6c5b4a3210',
                plataforma: 'indeed',
            },

            // LinkedIn: jobId en path
            {
                titulo: 'Backend LinkedIn Path',
                empresa: 'InCorp',
                url: 'https://www.linkedin.com/jobs/view/4436157529?refId=abc&trackingId=def',
                plataforma: 'linkedin',
            },
            // LinkedIn: currentJobId en query
            {
                titulo: 'Backend LinkedIn Query',
                empresa: 'InCorp',
                url: 'https://www.linkedin.com/jobs/search/?currentJobId=5547268630&keywords=node',
                plataforma: 'linkedin',
            },

            // Glassdoor: jl en query
            {
                titulo: 'Glassdoor Query',
                empresa: 'GD Corp',
                url: 'https://www.glassdoor.com.ar/job-listing/senior-engineer?jl=100889977&utm_source=gd',
                plataforma: 'glassdoor',
            },
            // Glassdoor: jl en path
            {
                titulo: 'Glassdoor Path',
                empresa: 'GD Corp',
                url: 'https://www.glassdoor.com.ar/job-listing/senior-engineer-jl=200990088',
                plataforma: 'glassdoor',
            },

            // GetOnBrd: slug en path
            {
                titulo: 'GetOnBrd Slug',
                empresa: 'GOB Corp',
                url: 'https://www.getonbrd.com/jobs/programacion/fullstack-developer-junior',
                plataforma: 'getonbrd',
            },

            // Bumeran: id numérico en path
            {
                titulo: 'Bumeran Path',
                empresa: 'Bum Corp',
                url: 'https://www.bumeran.com.ar/empleos/desarrollador-junior-1118200001.html',
                plataforma: 'bumeran',
            },

            // Computrabajo: id hex en path
            {
                titulo: 'Computrabajo Path',
                empresa: 'CT Corp',
                url: 'https://ar.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-dev-24f60e9ab7821cde89012345#lc=123',
                plataforma: 'computrabajo',
            },
        ];

        // 1. Inserto todas las filas como si vinieran del sistema pre-023 (sin identidad_canonica)
        for (const fila of filasPreexistentes) {
            await pool.query(
                `INSERT INTO ofertas (titulo, empresa, url, plataforma, fecha_extraccion, estado_evaluacion, estado_postulacion)
                 VALUES ($1, $2, $3, $4, NOW() - INTERVAL '5 days', 'pendiente', 'no_postulado')`,
                [fila.titulo, fila.empresa, fila.url, fila.plataforma]
            );
        }

        // 2. Ejecuto la migración 023 completa
        await pool.query(contenidoSql023);

        // 3. Verifico que CADA fila histórica tenga exactamente la misma identidad canónica que JS
        const filasEnBd = await pool.query('SELECT * FROM ofertas ORDER BY id ASC');
        expect(filasEnBd.rows.length).toBe(filasPreexistentes.length);

        for (const filaBd of filasEnBd.rows) {
            const identidadEsperadaJs = obtenerIdentidadCanonica({
                url: filaBd.url,
                plataforma: filaBd.plataforma,
                datos_crudos: filaBd.datos_crudos,
            });

            expect(filaBd.identidad_canonica).toBe(identidadEsperadaJs);
            expect(filaBd.fecha_ultima_extraccion).toBeInstanceOf(Date);
        }

        // 4. Verifico que una reaparición de cada fila histórica por crearOferta() sea reconocida como reaparición sin duplicar
        for (const filaOriginal of filasPreexistentes) {
            const reaparicion = await modeloOferta.crearOferta({
                ...filaOriginal,
                descripcion: 'Descripción reaparecida para probar matching contra backfill SQL.',
            });

            expect(reaparicion.es_nueva).toBe(false);
            expect(reaparicion.resultado_persistencia).toBe('actualizada'); // se completó descripción
        }

        const conteoFinal = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas');
        expect(conteoFinal.rows[0].total).toBe(filasPreexistentes.length);
    });

    test('Resolución conservadora de colisiones históricas e idempotencia en re-ejecución', async () => {
        // Inserto dos filas históricas que comparten la misma URL antes de que existiera el índice único de identidad
        const urlDuplicada = 'https://www.linkedin.com/jobs/view/8888777711';

        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, fecha_extraccion)
             VALUES ('Oferta Histórica 1', 'Empresa A', $1, 'linkedin', NOW() - INTERVAL '10 days')`,
            [urlDuplicada]
        );
        // Desambiguo la URL en la inserción previa sólo para que la BD pre-023 permita la segunda fila si había UNIQUE(url)
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, fecha_extraccion)
             VALUES ('Oferta Histórica 2', 'Empresa B', $1, 'linkedin', NOW() - INTERVAL '8 days')`,
            [`${urlDuplicada}#tracking-viejo`]
        );

        // Corro la migración 023
        await pool.query(contenidoSql023);

        const filas = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id ASC');
        expect(filas.rows.length).toBe(2);

        // La primera fila conserva la identidad canónica limpia
        expect(filas.rows[0].identidad_canonica).toBe('linkedin:8888777711');
        // La segunda fila de colisión se renombra conservadoramente agregando su ID
        expect(filas.rows[1].identidad_canonica).toBe(`linkedin:8888777711:colision-historica-${filas.rows[1].id}`);

        // Idempotencia: ejecuto la migración 023 una segunda vez
        await pool.query(contenidoSql023);

        const filasReejecutadas = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id ASC');
        expect(filasReejecutadas.rows[0].identidad_canonica).toBe('linkedin:8888777711');
        expect(filasReejecutadas.rows[1].identidad_canonica).toBe(`linkedin:8888777711:colision-historica-${filas.rows[1].id}`);
    });
});
