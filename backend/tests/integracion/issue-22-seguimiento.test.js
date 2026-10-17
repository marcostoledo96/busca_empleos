// Solo habilito este recorrido con un DSN explícito a una base local descartable ya migrada hasta 025.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const request = require('supertest');
const dsn = process.env.ISSUE22_TEST_DSN;
const contexto = dsn ? describe : describe.skip;

contexto('Issue #22 — seguimiento PostgreSQL sintético', () => {
    let pool;
    let modelo;
    let api;
    let ids;

    beforeAll(async () => {
        const url = new URL(dsn);
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
            || url.pathname !== '/busca_empleos_issue22_test' || url.search || url.hash
            || process.env.NODE_ENV !== 'test') {
            throw new Error('Exijo PostgreSQL local descartable busca_empleos_issue22_test y NODE_ENV=test.');
        }
        const esquema = `issue22_${Date.now()}`;
        const verificacion = new Pool({ connectionString: dsn, ssl: false });
        try {
            expect((await verificacion.query('SHOW server_encoding')).rows[0].server_encoding).toBe('UTF8');
            const { rows } = await verificacion.query('SELECT current_database() AS db, host(inet_server_addr()) AS host');
            expect(rows[0].db).toBe('busca_empleos_issue22_test');
            expect(['127.0.0.1', '::1']).toContain(rows[0].host);
            await verificacion.query(`CREATE SCHEMA ${esquema}`);
            await verificacion.query(`CREATE TABLE ${esquema}.ofertas (LIKE public.ofertas INCLUDING ALL)`);
        } finally {
            await verificacion.end();
        }
        pool = new Pool({ connectionString: dsn, ssl: false, options: `-c search_path=${esquema},public` });
        const migracion = fs.readFileSync(path.resolve(__dirname, '../../sql/migracion-026-seguimiento-postulacion.sql'), 'utf8');
        await pool.query(migracion);
        await pool.query(migracion);
        jest.resetModules();
        jest.doMock('../../src/config/base-datos', () => pool);
        jest.doMock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: async () => null }));
        jest.doMock('../../src/config/firebase-admin', () => ({ verifyIdToken: async () => ({ email: 'sintetico@example.invalid' }) }));
        modelo = require('../../src/modelos/oferta');
        const express = require('express');
        api = express();
        api.use(express.json());
        process.env.EMAIL_AUTORIZADO = 'sintetico@example.invalid';
        api.use('/api/ofertas', require('../../src/utils/middleware-auth').verificarAuth, require('../../src/rutas/ofertas'));
        api.use(require('../../src/utils/middleware-errores').manejarErrores);
        ids = [];
        for (const [indice, dias] of [45, 90, 120, 150, 1].entries()) {
            const oferta = await modelo.crearOferta({ titulo: `Sintética ${indice}`, plataforma: 'linkedin',
                url: `https://www.linkedin.com/jobs/view/${99022000 + indice}`, descripcion: 'Descripción sintética sin proveedores.' });
            ids.push(oferta.id);
            await pool.query("UPDATE ofertas SET fecha_extraccion = NOW() - make_interval(days => $1), fecha_ultima_extraccion = NULL WHERE id = $2", [dias, oferta.id]);
        }
    });

    afterAll(async () => {
        if (pool) await pool.end();
        // Conservo el esquema sintético para diagnóstico; la base completa es descartable.
    });

    function guardar(id, cambios) {
        return request(api).patch(`/api/ofertas/${id}/seguimiento`).set('Authorization', 'Bearer sintetico').send(cambios);
    }

    test('P3 HTTP y PostgreSQL aceptan 4000 emoji y rechazan 4001 sin modificar datos ni conteo', async () => {
        const id = ids[4];
        const aceptada = await guardar(id, { nota_postulacion: '😀'.repeat(4000) });
        expect(aceptada.status).toBe(200);
        expect(aceptada.body).toMatchObject({ exito: true, datos: { nota_postulacion: '😀'.repeat(4000) }, mensaje: 'Seguimiento actualizado correctamente.' });
        const leer = () => request(api).get(`/api/ofertas/${id}`).set('Authorization', 'Bearer sintetico');
        const listar = () => request(api).get('/api/ofertas').set('Authorization', 'Bearer sintetico');
        const antes = await leer();
        const listadoAntes = await listar();
        expect(antes.status).toBe(200);
        expect(antes.body.datos.nota_postulacion).toBe('😀'.repeat(4000));
        expect((await pool.query('SELECT char_length(nota_postulacion) AS caracteres FROM ofertas WHERE id = $1', [id])).rows[0].caracteres).toBe(4000);
        const rechazada = await guardar(id, { nota_postulacion: '😀'.repeat(4001) });
        expect(rechazada.status).toBe(400);
        expect(rechazada.body).toEqual({ exito: false, error: 'nota_postulacion debe ser un texto de hasta 4000 caracteres o null.' });
        expect((await leer()).body).toEqual(antes.body);
        expect((await listar()).body).toEqual(listadoAntes.body);
    });

    test('H02 dos clientes cambian campos distintos, omitir conserva y null limpia sólo el campo explícito', async () => {
        const id = ids[4];
        await guardar(id, { fecha_postulacion: '2026-01-01', nota_postulacion: 'Nota inicial' });
        const nota = await guardar(id, { nota_postulacion: 'Nota cliente B' });
        const fecha = await guardar(id, { fecha_postulacion: '2026-03-04' });
        expect(nota.status).toBe(200);
        expect(fecha.status).toBe(200);
        expect(fecha.body.datos).toMatchObject({ fecha_postulacion: '2026-03-04', nota_postulacion: 'Nota cliente B' });
        const limpiarFecha = await guardar(id, { fecha_postulacion: null });
        expect(limpiarFecha.status).toBe(200);
        expect(limpiarFecha.body.datos).toMatchObject({ fecha_postulacion: null, nota_postulacion: 'Nota cliente B' });
        const limpiarNota = await guardar(id, { nota_postulacion: null });
        expect(limpiarNota.status).toBe(200);
        expect(limpiarNota.body.datos).toMatchObject({ fecha_postulacion: null, nota_postulacion: null });
    });

    test('recorro persistencia, visibilidad, snapshot concurrente, estados y reaparición sin perder seguimiento', async () => {
        await modelo.actualizarPostulacion(ids[0], 'cv_enviado');
        await modelo.actualizarPostulacion(ids[1], 'en_proceso');
        expect((await modelo.obtenerOfertaPorId(ids[0])).fecha_postulacion).toBeNull();
        await modelo.actualizarEvaluacion(ids[0], 'rechazada', 'Evaluación independiente', 10, null, null, 'firma-sintetica');
        const guardada = await guardar(ids[0], { fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV' });
        expect(guardada.status).toBe(200);
        expect(guardada.body.datos).toMatchObject({ fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV', estado_evaluacion: 'rechazada', firma_criterios_evaluacion: 'firma-sintetica' });
        await guardar(ids[3], { fecha_postulacion: '2024-01-01' });
        await modelo.actualizarPostulacion(ids[3], 'descartada');
        await guardar(ids[2], { nota_postulacion: 'Solo nota, no retiene visibilidad' });
        const visibles = [ids[0], ids[1], ids[3], ids[4]].sort((a, b) => b - a);
        expect((await modelo.obtenerOfertas()).ofertas.map(fila => fila.id).sort((a, b) => b - a)).toEqual(visibles);
        expect((await modelo.obtenerOfertas()).total).toBe(4);
        expect((await modelo.obtenerEstadisticas()).total).toBe(4);
        expect((await modelo.obtenerOfertasPendientes()).map(fila => fila.id)).toEqual([ids[4]]);
        let cursor;
        const sincronizadas = [];
        do {
            const bloque = await modelo.obtenerBloqueSincronizacion({ limite: 2, cursor });
            expect(bloque.total).toBe(4);
            sincronizadas.push(...bloque.datos);
            cursor = bloque.cursor_siguiente;
        } while (cursor);
        expect(sincronizadas.map(fila => fila.id)).toEqual(visibles);
        expect(sincronizadas.find(fila => fila.id === ids[0]).fecha_postulacion).toBe('2024-02-29');
        const anterior = await modelo.obtenerBloqueSincronizacion({ limite: 2 });
        await modelo.actualizarPostulacion(ids[0], 'en_proceso');
        await expect(modelo.obtenerBloqueSincronizacion({ limite: 2, cursor: anterior.cursor_siguiente }))
            .rejects.toMatchObject({ codigo: 'SINCRONIZACION_INVALIDADA' });
        const antes = await modelo.obtenerOfertaPorId(ids[0]);
        const huella = async () => (await pool.query(`SELECT xmin::text AS version,
            md5(row_to_json(ofertas)::text) AS hash FROM ofertas WHERE id = $1`, [ids[0]])).rows[0];
        const huellaAntes = await huella();
        const conteoAntes = (await modelo.obtenerOfertas()).total;
        for (const cambios of [{ fecha_postulacion: '2025-02-29' }, { nota_postulacion: 'x'.repeat(4001) }, { nota_postulacion: 'ñ'.repeat(4001) }, { estado_postulacion: 'descartada' }]) {
            expect((await guardar(ids[0], cambios)).status).toBe(400);
            expect(await modelo.obtenerOfertaPorId(ids[0])).toEqual(antes);
            expect(await huella()).toEqual(huellaAntes);
            expect((await modelo.obtenerOfertas()).total).toBe(conteoAntes);
        }
        const notaUnicode = 'ñ'.repeat(4000);
        const limite = await guardar(ids[0], { nota_postulacion: notaUnicode });
        expect(limite.status).toBe(200);
        expect(limite.body.datos.nota_postulacion).toBe(notaUnicode);
        expect((await modelo.obtenerOfertaPorId(ids[0])).nota_postulacion).toBe(notaUnicode);
        expect((await pool.query('SELECT char_length(nota_postulacion) AS caracteres, octet_length(nota_postulacion) AS bytes FROM ofertas WHERE id = $1', [ids[0]])).rows[0])
            .toEqual({ caracteres: 4000, bytes: 8000 });
        await guardar(ids[0], { nota_postulacion: 'Entrevista' });
        expect((await modelo.obtenerOfertaPorId(ids[0])).fecha_postulacion).toBe('2024-02-29');
        await modelo.actualizarPostulacionMasiva([ids[0]], 'en_proceso');
        await modelo.crearOferta({ titulo: 'Sintética 0', plataforma: 'linkedin', url: 'https://www.linkedin.com/jobs/view/99022000', descripcion: 'Descripción sintética sin proveedores.', fecha_postulacion: null, nota_postulacion: 'No autorizado' });
        const recargada = await modelo.obtenerOfertaPorId(ids[0]);
        expect(recargada).toMatchObject({ estado_postulacion: 'en_proceso', fecha_postulacion: '2024-02-29', nota_postulacion: 'Entrevista', estado_evaluacion: 'rechazada', firma_criterios_evaluacion: 'firma-sintetica' });
        expect(recargada.fecha_extraccion).toEqual(antes.fecha_extraccion);
        expect((await guardar(ids[0], { fecha_postulacion: null, nota_postulacion: null })).status).toBe(200);
        expect(await modelo.obtenerOfertaPorId(ids[0])).toMatchObject({ fecha_postulacion: null, nota_postulacion: null });
    });
});
