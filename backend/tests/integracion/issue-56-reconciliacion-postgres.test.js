// Uso PostgreSQL real aislado por esquema, sin archivos de entorno ni proveedores.
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/utils/middleware-auth', () => ({ verificarAuth: (req, res, next) => next() }));
jest.mock('../../src/servicios/servicio-scraping', () => ({ ejecutarScrapingLinkedin: jest.fn() }));
jest.mock('../../src/servicios/servicio-evaluacion', () => ({ obtenerProgresoEvaluacion: jest.fn(() => ({ activo: false })) }));
jest.mock('../../src/servicios/servicio-notificacion-email', () => ({ enviarResumenCiclo: jest.fn() }));
jest.mock('node-cron', () => ({ validate: jest.fn(() => true), createTask: jest.fn() }));
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');
const request = require('supertest');
const dsn = process.env.ISSUE56_TEST_DSN;
const contexto = dsn ? describe : describe.skip;
contexto('Issue #56 — reconciliación PostgreSQL 18 sintético', () => {
    let pool;
    let entorno;
    let esquema;
    let app;
    let historial;
    const sqlDir = path.resolve(__dirname, '../../sql');
    const archivos = fs.readdirSync(sqlDir).filter(nombre => nombre.endsWith('.sql')).sort();
    const pendientes = [...archivos.slice(21), '024-resultados-fuentes.sql'];
    const ejecutar = (aplicar, usarUrl = true) => spawnSync(process.execPath, [
        '--require', path.resolve(__dirname, '../fixtures/issue-56-entorno.js'),
        path.resolve(__dirname, '../../scripts/migrar.js'), ...(aplicar ? ['--apply'] : []),
    ], { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_ENV: 'production_test',
        DB_TEST_SINTETICA: '', DATABASE_URL: usarUrl ? `${dsn}?sslmode=disable` : '',
        PGPORT: usarUrl ? '1' : '55456', PGUSER: usarUrl ? 'invalido' : 'marcos',
        PGDATABASE: usarUrl ? 'invalida_test' : 'busca_empleos_issue56_test',
        PGOPTIONS: `-c search_path=${esquema}`, PGPASSWORD: 'sintetica' } });
    beforeAll(async () => {
        const url = new URL(dsn);
        if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '55456'
            || url.pathname !== '/busca_empleos_issue56_test' || url.username !== 'marcos'
            || url.password || url.search || url.hash) throw new Error('DSN sintético no permitido.');
        entorno = { ...process.env };
        esquema = `issue56_${process.pid}_${Date.now()}`;
        const conexion = new Pool({ connectionString: dsn, ssl: false });
        try {
            expect((await conexion.query('SHOW server_version')).rows[0].server_version).toMatch(/^18\./);
            await conexion.query(`CREATE SCHEMA ${esquema}`);
        } finally { await conexion.end(); }
        Object.assign(process.env, { NODE_ENV: 'test', DB_TEST_SINTETICA: 'true', PGHOST: url.hostname,
            PGPORT: url.port, PGDATABASE: url.pathname.slice(1), PGUSER: url.username, PGPASSWORD: 'sintetica',
            PGSSLMODE: 'disable', PGOPTIONS: `-c search_path=${esquema}` });
        delete process.env.DATABASE_URL;
        delete process.env.PGSERVICE;
        delete process.env.PGSERVICEFILE;
        pool = require('../../src/config/base-datos');
        await pool.query(fs.readFileSync(path.join(sqlDir, 'migracion-014-schema-migrations.sql'), 'utf8'));
        for (const archivo of archivos.slice(0, 21)) {
            // Acoto sólo los guards legacy del fixture: otras ejecuciones conservan sus esquemas.
            const sql = fs.readFileSync(path.join(sqlDir, archivo), 'utf8')
                .replace(/WHERE table_name =/g, 'WHERE table_schema = current_schema() AND table_name =');
            await pool.query(sql);
            await pool.query('INSERT INTO schema_migrations(id, exitoso) VALUES ($1, true) ON CONFLICT DO NOTHING', [archivo]);
        }
        await pool.query(`UPDATE preferencias SET nombre='Persona sintética', perfil_profesional='PERFIL ISSUE56 ÚNICO',
            prompt_personalizado='PREFERENCIAS A CONSERVAR', terminos_busqueda=ARRAY['soporte sintético'] WHERE id=1`);
        for (let indice = 0; indice < 6; indice++) {
            await pool.query(`INSERT INTO ofertas(titulo, empresa, descripcion, url, plataforma, estado_postulacion,
                estado_evaluacion, razon_evaluacion, porcentaje_match, fecha_extraccion, datos_crudos)
                VALUES ($1, 'Empresa sintética', $2, $3, $4, $5, 'aprobada', $6, 80,
                    NOW() - ($7::integer * INTERVAL '1 day'), $8)`, [
                `Soporte sintético ${indice}`, `Descripción conservada ${indice}`,
                indice < 4 ? `https://www.linkedin.com/jobs/view/${indice < 2 ? '12345678' : '87654321'}?trk=${indice}`
                    : `https://www.bumeran.com.ar/empleos/soporte-${10000000 + indice}.html`,
                indice < 4 ? 'linkedin' : 'bumeran', indice % 2 ? 'en_proceso' : 'cv_enviado',
                `Evaluación sintética ${indice}`, indice % 2 ? 90 : 1, JSON.stringify({ marca: `crudo-${indice}` }),
            ]);
        }
        app = require('../../src/app');
        historial = require('../../src/modelos/ejecucion-busqueda');
    }, 30000);
    afterAll(async () => {
        if (pool) await pool.end();
        if (entorno) process.env = entorno;
    });
    const huellaLegacy = async () => ({
        ofertas: (await pool.query(`SELECT id, titulo, empresa, descripcion, plataforma, estado_postulacion,
            estado_evaluacion, razon_evaluacion, porcentaje_match, fecha_extraccion, datos_crudos FROM ofertas ORDER BY id`)).rows,
        preferencias: (await pool.query('SELECT to_jsonb(p) - \'cv_base\' - \'filtrar_nivel_linkedin\' AS datos FROM preferencias p ORDER BY id')).rows,
    });
    const instantanea = async () => ({
        ofertas: (await pool.query('SELECT *, xmin::text AS version FROM ofertas ORDER BY id')).rows,
        preferencias: (await pool.query('SELECT *, xmin::text AS version FROM preferencias ORDER BY id')).rows,
        ledger: (await pool.query('SELECT * FROM schema_migrations ORDER BY id')).rows,
        cv: (await pool.query('SELECT *, xmin::text AS version FROM cv_base ORDER BY id')).rows,
        secuencias: (await pool.query('SELECT sequencename, last_value FROM pg_sequences WHERE schemaname=$1 ORDER BY sequencename', [esquema])).rows,
    });
    test('reproduzco 500/503/42P01, aplico las nueve pendientes sin pérdida y repito sin cambios', async () => {
        expect((await pool.query('SELECT * FROM schema_migrations')).rows).toHaveLength(21);
        const antes = await huellaLegacy();
        for (const ruta of ['/api/ofertas', '/api/ofertas/sincronizacion']) {
            expect((await request(app).get(ruta)).status).toBe(500);
        }
        expect((await request(app).get('/api/automatizacion/historial')).status).toBe(503);
        await expect(historial.iniciar('individual')).rejects.toMatchObject({ code: '42P01' });
        const scraping = require('../../src/servicios/servicio-scraping');
        expect((await request(app).post('/api/scraping/linkedin').send({})).status).toBe(503);
        expect(scraping.ejecutarScrapingLinkedin).not.toHaveBeenCalled();
        expect(await huellaLegacy()).toEqual(antes);
        const listado = ejecutar(false);
        expect({ estado: listado.status, error: listado.stderr }).toEqual({ estado: 0, error: '' });
        expect(listado.stdout.match(/^  - .+$/gm)).toEqual(pendientes.map(nombre => `  - ${nombre}`));
        const aplicado = ejecutar(true);
        expect({ estado: aplicado.status, error: aplicado.stderr }).toEqual({ estado: 0, error: '' });
        expect(aplicado.stdout.match(/\[Migración\] OK: .+/g)).toEqual(pendientes.map(nombre => `[Migración] OK: ${nombre}`));
        expect((await pool.query('SELECT * FROM schema_migrations WHERE exitoso')).rows).toHaveLength(30);
        expect((await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema=$1
            AND table_name IN ('cv_base','ejecuciones_busqueda','configuracion_cron') ORDER BY table_name`, [esquema])).rows)
            .toEqual(['configuracion_cron', 'cv_base', 'ejecuciones_busqueda'].map(table_name => ({ table_name })));
        expect(await huellaLegacy()).toEqual(antes);
        const filas = (await pool.query('SELECT * FROM ofertas ORDER BY id')).rows;
        expect(filas).toHaveLength(6);
        expect(new Set(filas.map(fila => fila.identidad_canonica)).size).toBe(6);
        expect(filas.some(fila => fila.identidad_canonica.includes('colision-historica'))).toBe(true);
        for (const fila of filas) {
            expect(fila.fecha_ultima_extraccion).toEqual(fila.fecha_extraccion);
            expect(fila.fecha_postulacion).toBeNull();
            expect(fila.nota_postulacion).toBeNull();
            if (fila.plataforma === 'bumeran') expect(fila).toMatchObject({ origen_descripcion: 'tarjeta', descripcion_completitud: 'parcial' });
        }
        expect((await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname IN ('idx_ofertas_identidad_canonica','idx_ofertas_actividad_reciente')", [esquema])).rows).toHaveLength(2);
        for (const ruta of ['/api/ofertas', '/api/ofertas/sincronizacion', '/api/automatizacion/historial']) {
            expect((await request(app).get(ruta)).status).toBe(200);
        }
        const ejecucion = await historial.iniciar('individual');
        await historial.finalizar(ejecucion.id, { estado: 'completada', fuentes: [] });
        expect((await request(app).get('/api/automatizacion/historial')).body.datos[0]).toMatchObject({ estado: 'completada' });
        await pool.query("INSERT INTO cv_base VALUES (1, 'CV SINTÉTICO A CONSERVAR', clock_timestamp())");
        await pool.query("UPDATE ofertas SET origen_descripcion='manual', nota_postulacion='Nota sintética explícita' WHERE id=1");
        const reparada = await instantanea();
        const repeticion = ejecutar(true);
        expect(repeticion.status).toBe(0);
        expect(repeticion.stderr).toBe('');
        expect(repeticion.stdout).toBe('[Migración] Tabla schema_migrations verificada/creada.\n[Migración] No hay migraciones pendientes. La base está al día.\n');
        expect(await instantanea()).toEqual(reparada);
        const fallback = ejecutar(false, false);
        expect(fallback.status).toBe(0);
        expect(fallback.stderr).toBe('');
        expect(fallback.stdout).toBe(repeticion.stdout);
        expect(await instantanea()).toEqual(reparada);
        expect(scraping.ejecutarScrapingLinkedin).not.toHaveBeenCalled();
        const evidencia = { esquema, ofertas: filas.length, ledger: reparada.ledger.length,
            listado, aplicado, repeticion, preservacion: true, idempotencia: true };
        const directorioEvidencia = path.resolve(__dirname, '../../../.codegraph/issue56-runtime');
        fs.mkdirSync(directorioEvidencia, { recursive: true });
        fs.writeFileSync(path.join(directorioEvidencia, 'reconciliacion.json'), JSON.stringify(evidencia, null, 4));
    }, 30000);
});
