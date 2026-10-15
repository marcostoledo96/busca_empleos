// Tests de validación de la Migración 024 — Reparación de identidades canónicas en DBs donde 023 ya fue aplicada.
// Verifica que la migración incremental actualice las identidades históricas desfasadas, resuelva colisiones
// potenciales mediante ROW_NUMBER() de forma conservadora y garantice idempotencia.

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

    test('Repara identidades históricas en base donde 023 ya estaba registrada', async () => {
        // 1. Simulo que 023 corrió previamente
        await pool.query(contenidoSql023);

        // 2. Inserto filas simulando identidades generadas con discrepancias de la versión anterior
        // (por ejemplo: host en mayúsculas, espacios como %20 en vez de +)
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
        ];

        for (const fila of filas) {
            await pool.query(
                `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion, fecha_ultima_extraccion)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                [fila.titulo, fila.empresa, fila.url, fila.plataforma, fila.identidadDesfasada]
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
            expect(filaBd.identidad_canonica).toBe(identidadEsperadaJs);
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
            expect(filaBd.identidad_canonica).toBe(identidadEsperadaJs);
        }
    });

    test('Maneja colisiones conservadoramente al reparar identidades desfasadas', async () => {
        await pool.query(contenidoSql023);

        // Fila 1: ya tiene la identidad correcta
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila A', 'Corp', 'https://example.com/puestos/dev?id=123', 'general', 'general:url:https://example.com/puestos/dev?id=123', NOW() - INTERVAL '2 days')`
        );

        // Fila 2: tenía URL con host en mayúsculas y su identidad vieja era distinta por el case
        // Al normalizarla, colisionaría con la Fila 1 si no hubiera resolución con ROW_NUMBER()
        await pool.query(
            `INSERT INTO ofertas (titulo, empresa, url, plataforma, identidad_canonica, fecha_extraccion)
             VALUES ('Fila B', 'Corp', 'https://EXAMPLE.COM/puestos/dev?id=123#old', 'general', 'general:url:https://EXAMPLE.COM/puestos/dev?id=123', NOW() - INTERVAL '1 day')`
        );

        // Corro migración 024
        await pool.query(contenidoSql024);

        const filas = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id ASC');
        expect(filas.rows.length).toBe(2);

        // La Fila 1 retiene la identidad limpia
        expect(filas.rows[0].identidad_canonica).toBe('general:url:https://example.com/puestos/dev?id=123');
        // La Fila 2 recibe el sufijo conservador de colisión
        expect(filas.rows[1].identidad_canonica).toContain(':colision-historica-');
    });
});
