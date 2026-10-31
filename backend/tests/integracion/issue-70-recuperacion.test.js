// Uso tablas sintéticas propias dentro de una transacción que revierto al terminar.
// No cargo dotenv, migraciones, tablas públicas ni proveedores externos.
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn(),
}));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/utils/bloqueo-concurrente', () => ({
    intentarAdquirirLock: jest.fn(), liberarBloqueoSeguro: jest.fn(),
}));
jest.mock('../../src/config/firebase-admin', () => ({
    verifyIdToken: jest.fn(async () => ({ email: 'sintetico@example.invalid' })),
}));

const { Client } = require('pg');
const request = require('supertest');
const { randomUUID } = require('crypto');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');
const habilitado = process.env.ALLOW_DB_TESTS === 'true' && process.env.DB_TEST_SINTETICA === 'true';
const contexto = habilitado ? describe : describe.skip;

contexto('Issue #70 — PostgreSQL local sintético, preview y recuperación', () => {
    let cliente;
    let modelo;
    let servicio;
    let cache;
    let proveedor;
    let api;
    let fetchBloqueado;
    let transaccion = false;
    const emailAnterior = process.env.EMAIL_AUTORIZADO;
    const esquema = `issue70_${randomUUID().replaceAll('-', '')}`;

    beforeAll(async () => {
        if (process.env.NODE_ENV !== 'test' || process.env.DATABASE_URL
            || process.env.PGSERVICE || process.env.PGSERVICEFILE
            || process.env.PGHOST !== '127.0.0.1' || process.env.PGSSLMODE !== 'disable'
            || !/^[0-9]+$/.test(process.env.PGPORT || '')
            || Number(process.env.PGPORT) < 1024 || Number(process.env.PGPORT) > 65535
            || !/^[a-zA-Z0-9_]+_test$/.test(process.env.PGDATABASE || '')
            || !process.env.PGUSER || !process.env.PGPASSWORD) {
            throw new Error('Exijo variables PG explícitas, loopback y base _test sin DATABASE_URL.');
        }
        fetchBloqueado = jest.spyOn(global, 'fetch').mockImplementation(() => {
            throw new Error('Prohibí fetch externo en la prueba sintética.');
        });
        cliente = new Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT),
            database: process.env.PGDATABASE, user: process.env.PGUSER,
            password: process.env.PGPASSWORD, ssl: false });
        await cliente.connect();
        await asegurarBaseDeDatosDeTest(cliente);
        const identidad = (await cliente.query('SELECT current_database() AS db, current_user AS usuario, host(inet_server_addr()) AS host, inet_server_port() AS puerto')).rows[0];
        expect(identidad).toEqual({ db: process.env.PGDATABASE, usuario: process.env.PGUSER,
            host: '127.0.0.1', puerto: Number(process.env.PGPORT) });
        await cliente.query('BEGIN');
        transaccion = true;
        await cliente.query(`CREATE SCHEMA ${esquema}`);
        await cliente.query(`SET LOCAL search_path TO ${esquema}, pg_catalog`);
        // No hay fixture de evaluación independiente: las existentes requieren esquema migrado público.
        await cliente.query(`CREATE TABLE ${esquema}.ofertas (
            id integer PRIMARY KEY, titulo text DEFAULT 'Backend Node.js Junior',
            descripcion text DEFAULT 'Desarrollo backend con Node.js y PostgreSQL.',
            descripcion_modificada_en timestamp, modalidad text DEFAULT 'remoto',
            ubicacion text DEFAULT 'Argentina', plataforma text DEFAULT 'linkedin',
            estado_evaluacion text DEFAULT 'pendiente' CHECK (estado_evaluacion IN ('pendiente', 'aprobada', 'rechazada')),
            evaluacion_error_mensaje text DEFAULT 'TIMEOUT PRIVADO',
            fecha_extraccion timestamp DEFAULT NOW(), fecha_ultima_extraccion timestamp,
            razon_evaluacion text, porcentaje_match integer, fecha_evaluacion timestamp,
            firma_criterios_evaluacion text, explicacion_evaluacion jsonb,
            prioridad_ia boolean DEFAULT false, puntaje_prioridad_ia integer DEFAULT 0,
            evidencias_prioridad_ia jsonb DEFAULT '[]', version_prioridad_ia text,
            estado_postulacion text DEFAULT 'no_postulado' CHECK (estado_postulacion IN ('no_postulado', 'cv_enviado', 'en_proceso', 'descartada')),
            fecha_postulacion date, nota_postulacion text
        )`);
        await cliente.query(`CREATE TABLE ${esquema}.evaluaciones_cache (
            hash_oferta text, hash_preferencias text, modelo_ia text, resultado jsonb,
            creado_en timestamp DEFAULT NOW(), PRIMARY KEY (hash_oferta, hash_preferencias, modelo_ia)
        )`);
        await cliente.query(`CREATE TABLE ${esquema}.evaluacion_lotes (
            id serial PRIMARY KEY, estado text, total integer, modelo_ia text,
            evaluadas integer DEFAULT 0, aprobadas integer DEFAULT 0, rechazadas integer DEFAULT 0,
            errores integer DEFAULT 0, porcentaje integer DEFAULT 0,
            creado_en timestamp DEFAULT NOW(), actualizado_en timestamp, finalizado_en timestamp
        )`);
        jest.doMock('../../src/config/base-datos', () => cliente);
        modelo = require('../../src/modelos/oferta');
        servicio = require('../../src/servicios/servicio-evaluacion');
        cache = require('../../src/modelos/evaluacion-cache');
        proveedor = require('../../src/config/deepseek');
        require('../../src/modelos/preferencia').obtenerPreferencias.mockResolvedValue({
            stack_tecnologico: ['Node.js', 'PostgreSQL'], zonas_preferidas: ['Argentina'],
        });
        const express = require('express');
        api = express();
        process.env.EMAIL_AUTORIZADO = 'sintetico@example.invalid';
        api.use('/api/evaluacion', require('../../src/utils/middleware-auth').verificarAuth,
            require('../../src/rutas/evaluacion'));
    });

    beforeEach(async () => { await cliente.query('SAVEPOINT fixture'); });
    afterEach(async () => { if (transaccion) await cliente.query('ROLLBACK TO SAVEPOINT fixture'); });

    afterAll(async () => {
        try {
            if (transaccion) await cliente.query('ROLLBACK');
        } finally {
            if (cliente) await cliente.end();
            fetchBloqueado?.mockRestore();
            if (emailAnterior === undefined) delete process.env.EMAIL_AUTORIZADO;
            else process.env.EMAIL_AUTORIZADO = emailAnterior;
        }
    });

    const preview = () => request(api).get('/api/evaluacion/reintentar-errores').set('Authorization', 'Bearer sintetico');
    async function snapshot() {
        const resultado = {};
        for (const tabla of ['ofertas', 'evaluaciones_cache', 'evaluacion_lotes']) {
            resultado[tabla] = (await cliente.query(`SELECT * FROM ${esquema}.${tabla} ORDER BY 1`)).rows;
        }
        return resultado;
    }

    test('selecciona frontera inclusiva, orden estable y reaparición; excluye éxitos, manuales y errores vacíos sin escribir ni filtrar', async () => {
        await cliente.query(`INSERT INTO ofertas (id) SELECT generate_series(1, 18)`);
        await cliente.query(`UPDATE ofertas SET estado_evaluacion = 'aprobada' WHERE id = 3`);
        await cliente.query(`UPDATE ofertas SET estado_evaluacion = 'rechazada' WHERE id = 4`);
        await cliente.query(`UPDATE ofertas SET firma_criterios_evaluacion = 'firma-previa' WHERE id = 5`);
        await cliente.query(`UPDATE ofertas SET porcentaje_match = 0 WHERE id = 6`);
        await cliente.query(`UPDATE ofertas SET estado_postulacion = CASE id WHEN 7 THEN 'cv_enviado' WHEN 8 THEN 'en_proceso' ELSE 'descartada' END WHERE id IN (7,8,9)`);
        await cliente.query(`UPDATE ofertas SET fecha_postulacion = '2024-02-29' WHERE id = 10`);
        await cliente.query(`UPDATE ofertas SET nota_postulacion = '' WHERE id = 11`);
        await cliente.query(`UPDATE ofertas SET evaluacion_error_mensaje = CASE id WHEN 12 THEN NULL WHEN 13 THEN '' WHEN 14 THEN E' \\t\\n\\r' ELSE 'REEVALUACION_SOLICITADA' END WHERE id IN (12,13,14,15)`);
        await cliente.query(`UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '30 days' WHERE id = 1`);
        await cliente.query(`UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '30 days 1 microsecond' WHERE id = 16`);
        await cliente.query(`UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '90 days', fecha_ultima_extraccion = NOW() WHERE id = 17`);
        await cliente.query(`UPDATE ofertas SET nota_postulacion = 'NOTA PRIVADA' WHERE id = 18`);
        const antes = await snapshot();
        const consulta = jest.spyOn(cliente, 'query');
        let res;
        let sql;
        try {
            res = await preview();
            sql = consulta.mock.calls.map(([texto]) => texto);
        } finally { consulta.mockRestore(); }
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ exito: true, total: 3, ids: [2, 1, 17] });
        expect(sql).toHaveLength(1);
        expect(sql[0]).toMatch(/^SELECT /);
        expect(sql[0]).not.toMatch(/UPDATE|INSERT|DELETE|FOR UPDATE/);
        expect(await snapshot()).toEqual(antes);
        expect(fetchBloqueado).not.toHaveBeenCalled();
        expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
        expect(require('../../src/utils/bloqueo-concurrente').intentarAdquirirLock).not.toHaveBeenCalled();
    });

    test('persisto fallo y recuperación reales sin contaminar caché ni perder éxito anterior, firma o seguimiento', async () => {
        await cliente.query(`INSERT INTO ofertas (id, evaluacion_error_mensaje) VALUES (100, NULL), (101, NULL)`);
        await modelo.actualizarEvaluacion(101, 'aprobada', 'Éxito previo', 85, null, null, 'firma-previa');
        await modelo.actualizarPostulacion(101, 'cv_enviado');
        await modelo.actualizarSeguimiento(101, { fecha_postulacion: '2024-02-29', nota_postulacion: 'NOTA PRIVADA' });
        await cache.guardarCache('oferta-previa', 'firma-previa', 'deepseek-flash', { match: true, porcentaje: 85 });
        const previa = await modelo.obtenerOfertaPorId(101);
        const cachePrevia = (await snapshot()).evaluaciones_cache;
        proveedor.consultarDeepSeek.mockRejectedValue(Object.assign(new Error('PRIVADO'), { codigo: 'HTTP_503' }));
        const fallo = await servicio.evaluarOfertasPendientes([await modelo.obtenerOfertaPorId(100), previa]);
        expect(fallo).toMatchObject({ errores: 2, evaluadas: 0, rechazadas: 0 });
        const pendiente = await modelo.obtenerOfertaPorId(100);
        expect(pendiente).toMatchObject({ estado_evaluacion: 'pendiente', porcentaje_match: null, firma_criterios_evaluacion: null });
        expect(pendiente.evaluacion_error_mensaje).toContain('HTTP_503');
        const conservada = await modelo.obtenerOfertaPorId(101);
        expect(conservada.evaluacion_error_mensaje).toContain('HTTP_503');
        expect({ ...conservada, evaluacion_error_mensaje: null }).toEqual(previa);
        expect((await snapshot()).evaluaciones_cache).toEqual(cachePrevia);
        expect((await preview()).body.ids).toContain(100);
        expect((await preview()).body.ids).not.toContain(101);
        // Revalido el selector antes de ejecutar únicamente la fixture autorizada.
        const seleccion = (await modelo.obtenerOfertasConErrores()).filter(oferta => oferta.id === 100);
        expect(seleccion.map(oferta => oferta.id)).toEqual([100]);
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 88, razon: 'Coincidencia sintética.' }));
        const recuperada = await servicio.evaluarOfertasPendientes(seleccion);
        expect(recuperada).toMatchObject({ errores: 0, aprobadas: 1, evaluadas: 1 });
        const final = await modelo.obtenerOfertaPorId(100);
        expect(final).toMatchObject({ estado_evaluacion: 'aprobada', porcentaje_match: 88, evaluacion_error_mensaje: null });
        expect(final.firma_criterios_evaluacion).toEqual(expect.any(String));
        expect(final.fecha_evaluacion).toBeInstanceOf(Date);
        expect(await modelo.obtenerOfertaPorId(101)).toEqual(conservada);
        const cacheFinal = (await snapshot()).evaluaciones_cache;
        expect(cacheFinal).toHaveLength(cachePrevia.length + 1);
        expect(cacheFinal).toEqual(expect.arrayContaining(cachePrevia));
        expect((await preview()).body.ids).not.toContain(100);
        expect(fetchBloqueado).not.toHaveBeenCalled();
    });
});
