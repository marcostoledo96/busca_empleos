// Tests de validación de la Migración 024 — Reparación de identidades canónicas en DBs donde 023 ya fue aplicada.
// Verifica que la migración incremental actualice las identidades históricas desfasadas, resuelva colisiones
// potenciales mediante ROW_NUMBER() en dos fases sin violar el índice UNIQUE existente, y garantice idempotencia.

const fs = require('fs');
const path = require('path');
const pool = require('../../src/config/base-datos');
const { obtenerIdentidadCanonica } = require('../../src/servicios/servicio-identidad-ofertas');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');

const dbTestsPermitidos = process.env.ALLOW_DB_TESTS === 'true';
const entornoSeguro = process.env.NODE_ENV === 'test'
    || (process.env.PGDATABASE || '').includes('test');
const contexto = (dbTestsPermitidos && entornoSeguro) ? describe : describe.skip;

contexto('Migración 024 — Reparación de identidades canónicas post-023', () => {
    const rutaSql023 = path.resolve(__dirname, '../../sql/migracion-023-identidad-y-reapariciones.sql');
    const contenidoSql023 = fs.readFileSync(rutaSql023, 'utf8');
    const rutaSql024 = path.resolve(__dirname, '../../sql/migracion-024-reparar-identidades-canonicas.sql');
    const contenidoSql024 = fs.readFileSync(rutaSql024, 'utf8');

    beforeEach(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
    });

    afterAll(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
        await pool.end();
    });

    test.each(require('../fixtures/casos-identidad'))('PR39 paridad 024: %s %s', async (plataforma, url, datos, id) => {
        await pool.query(contenidoSql024);
        const resultado = await pool.query('SELECT fn_obtener_identidad_canonica_023($1, $2, $3, 1) AS identidad', [url, plataforma, datos]);
        expect(resultado.rows[0].identidad).toBe(obtenerIdentidadCanonica({ url, plataforma, datos_crudos: datos }));
        if (id) expect(resultado.rows[0].identidad).toBe(`${plataforma}:${id}`);
    });

    test('Repara identidades históricas en base donde 023 ya estaba registrada', async () => {
        // 1. Simulo que 023 corrió previamente y ya creó el índice UNIQUE
        await pool.query(contenidoSql023);

        // 2. Inserto filas simulando identidades generadas con discrepancias de la versión anterior
        const filas = [
            {
                titulo: 'Upper Host Discrepancy',
                empresa: 'Corp',
                url: 'https://EXAMPLE.COM/puestos/dev?id=123',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://EXAMPLE.COM/puestos/dev?id=123',
            },
            {
                titulo: 'Space Encoding Discrepancy',
                empresa: 'Corp',
                url: 'https://example.com/search?q=desarrollador%20junior',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://example.com/search?q=desarrollador%20junior',
            },
            {
                titulo: 'Indeed Clean',
                empresa: 'IndeedCorp',
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876',
                plataforma: 'indeed',
                identidadDesfasada: 'indeed:5a8b3c2d1e0f9876',
            },
            {
                titulo: 'Indeed vjk en datos_crudos',
                empresa: 'IndeedCorp',
                url: 'https://ar.indeed.com/viewjob',
                plataforma: 'indeed',
                datos_crudos: { vjk: 'abc123' },
                identidadDesfasada: 'indeed:url:https://ar.indeed.com/viewjob',
            },
            {
                titulo: 'Jooble /desc/ path',
                empresa: 'JoobleCorp',
                url: 'https://jooble.org/desc/xyz123',
                plataforma: 'jooble',
                identidadDesfasada: 'jooble:url:https://jooble.org/desc/xyz123',
            },
            {
                titulo: 'General con id en datos_crudos',
                empresa: 'GeneralCorp',
                url: 'https://portal-remoto.com/puestos/dev-777',
                plataforma: 'general',
                datos_crudos: { id: '999' },
                identidadDesfasada: 'general:999',
            },
            {
                titulo: 'Query tilde ~ encoding',
                empresa: 'Tech Corp',
                url: 'https://example.com/puestos?q=a~b',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://example.com/puestos?q=a~b',
            },
            {
                titulo: 'Query multibyte caf%C3%A9',
                empresa: 'CafeCorp',
                url: 'https://empleos.example/oferta?q=caf%C3%A9',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://empleos.example/oferta?q=caf%C3%83%C2%A9',
            },
            {
                titulo: 'Query con %00 NUL byte',
                empresa: 'NullCorp',
                url: 'https://empleos.example/oferta?q=a%00b',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://empleos.example/oferta?q=a%00b#old',
            },
            {
                titulo: 'Query con claves repetidas tag=z y tag=a',
                empresa: 'TagCorp',
                url: 'https://empleos.example/oferta?tag=z&tag=a',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://empleos.example/oferta?tag=a&tag=z',
            },
            {
                titulo: 'Indeed con precedencia jk sobre vjk desfasada',
                empresa: 'IndeedCorp',
                url: 'https://ar.indeed.com/viewjob?vjk=OLD456&jk=NEW123',
                plataforma: 'indeed',
                identidadDesfasada: 'indeed:old456',
            },
            {
                titulo: 'LinkedIn con precedencia currentJobId sobre jobId desfasada',
                empresa: 'LinkedInCorp',
                url: 'https://www.linkedin.com/jobs/search/?jobId=11111111&currentJobId=22222222',
                plataforma: 'linkedin',
                identidadDesfasada: 'linkedin:11111111',
            },
            {
                titulo: 'LinkedIn 17 dígitos desfasada como 16 dígitos',
                empresa: 'LinkedInCorp',
                url: 'https://www.linkedin.com/jobs/view/12345678901234567',
                plataforma: 'linkedin',
                identidadDesfasada: 'linkedin:1234567890123456',
            },
            {
                titulo: 'UTF-8 truncado %E2%82 desfasado con doble U+FFFD',
                empresa: 'TruncCorp',
                url: 'https://empleos.example/oferta?q=%E2%82',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://empleos.example/oferta?q=%EF%BF%BD%EF%BF%BD',
            },
            {
                titulo: 'UTF-8 truncado %F0%9F%9A desfasado con triple U+FFFD',
                empresa: 'TruncCorp',
                url: 'https://empleos.example/oferta?term=%F0%9F%9A',
                plataforma: 'general',
                identidadDesfasada: 'general:url:https://empleos.example/oferta?term=%EF%BF%BD%EF%BF%BD%EF%BF%BD',
            },
        ];

        for (const fila of filas) {
            await pool.query(
                `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion, fecha_ultima_extraccion, datos_crudos)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)`,
                [fila.titulo, fila.empresa, fila.url, fila.plataforma, fila.identidadDesfasada, fila.datos_crudos ? JSON.stringify(fila.datos_crudos) : null]
            );
        }

        // 3. Ejecuto la migración incremental 024
        await pool.query(contenidoSql024);

        // 4. Verifico que las identidades ahora coincidan 100% con JS
        const filasActualizadas = await pool.query('SELECT * FROM ofertas ORDER BY id ASC');
        expect(filasActualizadas.rows.length).toBe(filas.length);

        for (const filaBd of filasActualizadas.rows) {
            const identidadEsperadaJs = obtenerIdentidadCanonica({
                url: filaBd.url,
                plataforma: filaBd.plataforma,
                datos_crudos: filaBd.datos_crudos,
            });
            const identidadPrevia = filas.find(fila => fila.titulo === filaBd.titulo).identidadDesfasada;
            // No demuestro equivalencia entre IDs nativos diferentes: conservo el asignado.
            const nativaPrevia = /^(indeed:[a-z0-9]+|linkedin:[0-9]{8,16})$/.test(identidadPrevia);
            expect(filaBd.identidad_canonica).toBe(nativaPrevia ? identidadPrevia : identidadEsperadaJs);
        }

        // 5. Idempotencia: correr 024 de nuevo no rompe nada
        await pool.query(contenidoSql024);

        const filasRecheck = await pool.query('SELECT * FROM ofertas ORDER BY id ASC');
        expect(filasRecheck.rows.length).toBe(filas.length);
        for (const filaBd of filasRecheck.rows) {
            const identidadEsperadaJs = obtenerIdentidadCanonica({
                url: filaBd.url,
                plataforma: filaBd.plataforma,
                datos_crudos: filaBd.datos_crudos,
            });
            const identidadPrevia = filas.find(fila => fila.titulo === filaBd.titulo).identidadDesfasada;
            const nativaPrevia = /^(indeed:[a-z0-9]+|linkedin:[0-9]{8,16})$/.test(identidadPrevia);
            expect(filaBd.identidad_canonica).toBe(nativaPrevia ? identidadPrevia : identidadEsperadaJs);
        }
    });

    test('B-02 reauditoría: Ejecución en dos fases previene violación del índice UNIQUE existente cuando id=1 toma la clave que actualmente tiene id=2', async () => {
        // Aseguro que 023 ya creó el índice UNIQUE idx_ofertas_identidad_canonica
        await pool.query(contenidoSql023);

        // Fila id=1: tiene URL en mayúsculas y clave vieja en mayúsculas
        // Al normalizarse debe pasar a 'general:url:https://example.com/aviso' (la clave limpia)
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila 1', 'Corp', 'https://EXAMPLE.com/aviso', 'general', 'general:url:https://EXAMPLE.com/aviso', NOW() - INTERVAL '3 days')`
        );

        // Fila id=2: tiene URL con fragmento y actualmente TIENE la clave limpia 'general:url:https://example.com/aviso'
        // Al repararse, como id=1 es más antigua (menor id), id=2 debe recibir el sufijo :colision-historica-2
        // Si la migración intentara actualizar id=1 antes de liberar id=2 en un único UPDATE,
        // PostgreSQL lanzaría error de clave duplicada por el índice UNIQUE no diferible.
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila 2', 'Corp', 'https://example.com/aviso#old', 'general', 'general:url:https://example.com/aviso', NOW() - INTERVAL '2 days')`
        );

        // Corro migración 024 (debe ejecutar en dos fases y no fallar)
        await pool.query(contenidoSql024);

        const filas = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id ASC');
        expect(filas.rows.length).toBe(2);

        // La Fila id=1 (más antigua) conserva la clave canónica limpia
        expect(filas.rows[0].identidad_canonica).toBe('general:url:https://example.com/aviso');
        // La Fila id=2 recibe el sufijo de colisión
        expect(filas.rows[1].identidad_canonica).toBe(`general:url:https://example.com/aviso:colision-historica-${filas.rows[1].id}`);

        // Idempotencia: segunda ejecución sin errores
        await pool.query(contenidoSql024);
        const filasPost = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id ASC');
        expect(filasPost.rows[0].identidad_canonica).toBe('general:url:https://example.com/aviso');
        expect(filasPost.rows[1].identidad_canonica).toBe(`general:url:https://example.com/aviso:colision-historica-${filas.rows[1].id}`);
    });

    test('B-02 reauditoría: Ciclo de 3 identidades bajo índice UNIQUE existente se resuelve en dos fases sin colisión', async () => {
        await pool.query(contenidoSql023);

        // id=1 actualmente tiene clave-A pero su URL calcula clave-B
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila Ciclo 1', 'Corp', 'https://example.com/puestos/b', 'general', 'general:url:https://example.com/puestos/a', NOW() - INTERVAL '3 days')`
        );
        // id=2 actualmente tiene clave-B pero su URL calcula clave-C
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila Ciclo 2', 'Corp', 'https://example.com/puestos/c', 'general', 'general:url:https://example.com/puestos/b', NOW() - INTERVAL '2 days')`
        );
        // id=3 actualmente tiene clave-C pero su URL calcula clave-A
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila Ciclo 3', 'Corp', 'https://example.com/puestos/a', 'general', 'general:url:https://example.com/puestos/c', NOW() - INTERVAL '1 days')`
        );

        // Ejecuto migración 024
        await pool.query(contenidoSql024);

        const filas = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id ASC');
        expect(filas.rows.length).toBe(3);
        expect(filas.rows[0].identidad_canonica).toBe('general:url:https://example.com/puestos/b');
        expect(filas.rows[1].identidad_canonica).toBe('general:url:https://example.com/puestos/c');
        expect(filas.rows[2].identidad_canonica).toBe('general:url:https://example.com/puestos/a');
    });
});
