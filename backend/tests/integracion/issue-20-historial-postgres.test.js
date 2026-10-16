// Exijo un DSN local explícito; no cargo archivos de entorno ni otros tests de integración.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dsn = process.env.ISSUE20_TEST_DSN;
const contexto = dsn ? describe : describe.skip;
contexto('Issue #20 — PostgreSQL sintético opt-in', () => {
    let pool;
    let modelo;
    let cron;
    beforeAll(async () => {
        const url = new URL(dsn);
        if (url.hostname !== '127.0.0.1' || url.port !== '55420' || url.pathname !== '/busca_empleos_issue20_test'
            || url.username !== 'marcos' || url.search || url.hash) throw new Error('DSN sintético no permitido.');
        const verificacion = new Pool({ connectionString: dsn, ssl: false });
        try {
            const { rows } = await verificacion.query('SELECT current_database() AS db, host(inet_server_addr()) AS host, inet_server_port() AS puerto');
            expect(rows[0]).toEqual({ db: 'busca_empleos_issue20_test', host: '127.0.0.1', puerto: 55420 });
            const sql = fs.readFileSync(path.resolve(__dirname, '../../migrations/024-resultados-fuentes.sql'), 'utf8');
            await verificacion.query(sql);
            await verificacion.query(sql);
        } finally { await verificacion.end(); }
        Object.assign(process.env, { NODE_ENV: 'test', DB_TEST_SINTETICA: 'true', PGHOST: url.hostname,
            PGPORT: url.port, PGDATABASE: url.pathname.slice(1), PGUSER: url.username, PGPASSWORD: 'sintetica', PGSSLMODE: 'disable' });
        delete process.env.DATABASE_URL;
        delete process.env.PGSERVICE;
        delete process.env.PGSERVICEFILE;
        pool = require('../../src/config/base-datos');
        modelo = require('../../src/modelos/ejecucion-busqueda');
        cron = require('../../src/modelos/configuracion-cron');
    });
    afterAll(async () => { if (pool) await pool.end(); });
    test('migro idempotente, retengo 20, sanitizo y recupero filas al reiniciar sin transformar interrupciones en éxito', async () => {
        const ids = [];
        for (let indice = 0; indice < 24; indice++) {
            const fila = await modelo.iniciar('individual');
            ids.push(fila.id);
            await modelo.finalizar(fila.id, { estado: 'parcial', secreto: 'NO_GUARDAR', configuracion: { token: 'NO_GUARDAR' },
                fuentes: [{ plataforma: 'linkedin', estado: 'parcial', nuevas: 1, actualizadas: 2, reapariciones: 3,
                    duracionMs: 25, totalCrudos: 6, ofertas: [{ descripcion: 'NO_GUARDAR' }],
                    errores: [{ tipo: 'http', codigoHttp: 503, mensaje: 'NO_GUARDAR', token: 'NO_GUARDAR' }],
                    resultadosConsultas: [{ consulta: 'junior sintético', estado: 'completada', peticionesRealizadas: null, totalCrudos: 6, errores: [] }] }] });
        }
        const listado = await modelo.listar();
        expect(listado).toHaveLength(20);
        expect(listado[0]).toMatchObject({ id: ids[23], tipo: 'individual', estado: 'parcial', fin: expect.any(Date) });
        expect(listado[19].id).toBe(ids[4]);
        expect(listado[0].resumen.fuentes[0]).toMatchObject({ nuevas: 1, actualizadas: 2, reapariciones: 3, errores: [{ tipo: 'http', codigoHttp: 503 }] });
        expect(JSON.stringify(listado)).not.toContain('NO_GUARDAR');
        const cantidad = await pool.query('SELECT count(*)::integer AS total FROM ejecuciones_busqueda');
        expect(cantidad.rows[0].total).toBe(20);
        const pendiente = await modelo.iniciar('ciclo_manual');
        await cron.guardar({ activo: false, expresionCron: '0 20 * * 2', zonaHoraria: 'America/Argentina/Buenos_Aires' });
        await pool.end();
        jest.resetModules();
        pool = require('../../src/config/base-datos');
        modelo = require('../../src/modelos/ejecucion-busqueda');
        cron = require('../../src/modelos/configuracion-cron');
        expect(await cron.obtener()).toEqual({ activo: false, expresion_cron: '0 20 * * 2', zona_horaria: 'America/Argentina/Buenos_Aires' });
        expect((await modelo.listar()).some(fila => fila.id === ids[23])).toBe(true);
        await modelo.interrumpirPendientes();
        const reiniciadas = await modelo.listar();
        expect(reiniciadas.find(fila => fila.id === pendiente.id)).toMatchObject({ estado: 'interrumpida', fin: expect.any(Date) });
        await expect(modelo.finalizar(pendiente.id, { estado: 'completada', fuentes: [] })).rejects.toThrow('ya no está activa');
        expect((await modelo.listar()).find(fila => fila.id === pendiente.id).estado).toBe('interrumpida');
    });
});
