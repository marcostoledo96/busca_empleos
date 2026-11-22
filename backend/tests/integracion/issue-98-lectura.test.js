const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const express = require('express');
const request = require('supertest');

const socket = process.env.ISSUE98_SOCKET;
const ejecutar = socket ? describe : describe.skip;

ejecutar('Issue #98 — lectura con PostgreSQL sintético', () => {
    let preparacion;
    let lectura;
    let poolWeb;
    let api;
    const operaciones = [];
    const ahora = '2026-11-21T12:00:00.000Z';
    const esquema = `issue98_${process.pid}_${Date.now()}`;

    beforeAll(async () => {
        if (process.env.DB_TEST_SINTETICA !== 'true' || process.env.NODE_ENV !== 'test'
            || !/^\/tmp\/busca-issue98\.[a-zA-Z0-9]+\/socket$/.test(socket)
            || process.env.DATABASE_URL || process.env.PGSERVICE || process.env.PGSERVICEFILE) {
            throw new Error('Entorno sintético #98 inválido.');
        }
        const conexion = {
            host: socket, port: 5432, database: 'busca_empleos_issue98_test',
            user: 'busca_empleos_test', password: 'sintetica_issue98', ssl: false,
            connectionTimeoutMillis: 3000,
        };
        preparacion = new Pool({ ...conexion, options: `-c search_path=${esquema}` });
        const { rows: [destino] } = await preparacion.query(`SELECT current_database() AS bd,
            inet_server_addr() IS NULL AS socket`);
        expect(destino).toEqual({ bd: conexion.database, socket: true });
        await preparacion.query(`CREATE SCHEMA ${esquema}`);
        const sql = path.resolve(__dirname, '../../sql');
        for (const archivo of fs.readdirSync(sql).filter(nombre => nombre.endsWith('.sql')).sort()) {
            await preparacion.query(fs.readFileSync(path.join(sql, archivo), 'utf8')
                .replace(/WHERE table_name =/g, 'WHERE table_schema = current_schema() AND table_name ='));
        }
        await preparacion.query('DELETE FROM preferencias');
        await preparacion.query(`INSERT INTO ofertas (id, titulo, url, plataforma, fecha_publicacion)
            VALUES (1, 'QA ficticio', 'https://www.linkedin.com/jobs/view/1001', 'linkedin', $1)`, [ahora]);
        lectura = new Pool({ ...conexion, options: `-c search_path=${esquema} -c default_transaction_read_only=on` });
        expect((await lectura.query('SHOW transaction_read_only')).rows).toEqual([{ transaction_read_only: 'on' }]);
        poolWeb = require('../../src/config/base-datos');
        jest.spyOn(poolWeb, 'query').mockImplementation((sql, parametros) => {
            operaciones.push(sql.trim().split(/\s+/)[0]);
            return lectura.query(sql, parametros);
        });
        const { obtenerOferta } = require('../../src/controladores/controlador-ofertas');
        const { manejarErrores } = require('../../src/utils/middleware-errores');
        api = express();
        api.get('/ofertas/:id', obtenerOferta);
        api.use(manejarErrores);
    });

    function consulta(pool = poolWeb) {
        return require('../../src/servicios/servicio-consulta-publica').crearConsultaPublica({ pool, reloj: () => new Date(ahora) });
    }

    const filtros = { texto: 'QA', nivel: 'junior', pais: 'Argentina', dias: 30 };

    afterEach(() => { operaciones.length = 0; });

    test('lista cinco QA junior recientes de Argentina después de deduplicar y conserva modalidad desconocida', async () => {
        await preparacion.query(`INSERT INTO ofertas (id, titulo, url, plataforma, fecha_publicacion,
            fecha_extraccion, fecha_ultima_extraccion, ubicacion, modalidad, nivel_requerido, datos_crudos, nota_postulacion)
            SELECT id, CASE WHEN id = 30 THEN 'IQA' ELSE 'QA sintético' END,
                'https://www.linkedin.com/jobs/view/' || CASE WHEN id = 20 THEN '98000019?trk=copia' ELSE (98000000 + id)::text END,
                'linkedin', CASE id WHEN 28 THEN NULL WHEN 27 THEN $1::timestamp + interval '1 second'
                    WHEN 26 THEN $1::timestamp - interval '30 days' WHEN 25 THEN $1::timestamp - interval '31 days'
                    ELSE $1::timestamp END,
                $1::timestamp, $1::timestamp + interval '1 hour', CASE WHEN id = 24 THEN NULL ELSE 'Buenos Aires, Argentina' END,
                CASE WHEN id = 20 THEN NULL ELSE 'remoto' END, CASE WHEN id = 29 THEN NULL ELSE 'junior' END,
                jsonb_build_object('secreto', 'privado', 'url_original', CASE WHEN id = 20 THEN
                    'https://ar.linkedin.com/jobs/view/98000019?trk=original' END), 'nota privada'
            FROM generate_series(11, 30) AS id WHERE id NOT IN (21, 22, 23)`, [ahora]);
        const lista = await consulta().listar(filtros);
        expect(lista.ofertas.map(o => o.id)).toEqual([20, 18, 17, 16, 15]);
        expect(lista.ofertas[0]).toEqual({ id: 20, titulo: 'QA sintético', empresa: null,
            ubicacion: 'Buenos Aires, Argentina', pais: 'Argentina', modalidad: 'desconocida', nivel: 'junior',
            fuente: 'linkedin', url: 'https://ar.linkedin.com/jobs/view/98000019?trk=original',
            fecha_publicacion: ahora, fecha_primera_deteccion: ahora, fecha_ultima_deteccion: '2026-11-21T13:00:00.000Z',
            vigencia_aviso: 'desconocida' });
        expect(lista.alcance).toMatchObject({ candidatos_examinados: 10, maximo_candidatos: 200, posible_truncamiento: true });
        const remotas = await consulta().listar({ ...filtros, modalidad: 'remoto', limite: 1 });
        expect(remotas.ofertas.map(o => o.id)).toEqual([19]);
        expect(operaciones).toEqual(['SELECT', 'SELECT']);
    });

    test('acota en SQL a 200 sin prometer cobertura total y excluye enlaces inseguros', async () => {
        await preparacion.query(`INSERT INTO ofertas (id, titulo, url, plataforma, fecha_publicacion)
            SELECT id, 'Lote sintético', CASE WHEN id = 1000 THEN 'https://example.invalid/publico'
                ELSE 'https://clave:secreta@example.invalid/' || id END, 'general', $1
            FROM generate_series(1000, 1200) AS id`, [ahora]);
        const lista = await consulta().listar({ texto: 'Lote' });
        expect(lista.ofertas).toEqual([]);
        expect(lista.alcance).toMatchObject({ candidatos_examinados: 200, maximo_candidatos: 200, posible_truncamiento: true });
        expect(operaciones).toEqual(['SELECT']);
    });

    test('deduplica identidades nativas aun cuando difieran las URLs del proveedor', async () => {
        await preparacion.query(`INSERT INTO ofertas (id, titulo, url, plataforma, fecha_publicacion, datos_crudos)
            VALUES (31, 'Auxiliar identidad', 'https://example.invalid/a', 'adzuna', $1, '{"id":"nativa-98"}'),
                (32, 'Analista identidad', 'https://example.invalid/b', 'adzuna', $1, '{"id":"nativa-98"}')`, [ahora]);
        const nativas = await consulta().listar({ texto: 'identidad' });
        expect(nativas.ofertas.map(o => o.id)).toEqual([32]);
        expect(nativas.ofertas[0]).not.toHaveProperty('datos_crudos');
        expect(operaciones).toEqual(['SELECT']);
    });

    test('excluye avisos con credenciales en la URL y conserva el enlace original con tracking', async () => {
        const urlTracking = 'https://example.invalid/aviso-tracking?utm_source=sintetico#/empleos?utm_medium=sintetico';
        await preparacion.query(`INSERT INTO ofertas (id, titulo, url, plataforma, fecha_publicacion, datos_crudos)
            VALUES (33, 'Credenciales', 'https://example.invalid/aviso', 'general', $1,
                    '{"url_original":"https://example.invalid/aviso?%61ccess_token=secreto_sintetico"}'),
                (34, 'Credenciales', 'https://example.invalid/aviso-key?key=secreto_sintetico', 'general', $1, NULL),
                (35, 'Credenciales', 'https://example.invalid/aviso-access', 'general', $1,
                    '{"url_original":"https://example.invalid/aviso-access?%41ccess_Key=secreto_sintetico"}'),
                (36, 'Credenciales', 'https://example.invalid/aviso-jwt?jwt=secreto_sintetico', 'general', $1, NULL),
                (38, 'Credenciales', 'https://example.invalid/avisos#/empleos?jwt=secreto_sintetico', 'general', $1, NULL),
                (37, 'Credenciales', 'https://example.invalid/aviso-tracking', 'general', $1,
                    jsonb_build_object('url_original', $2::text))`, [ahora, urlTracking]);
        const servicio = consulta();
        for (const id of [33, 34, 35, 36, 38]) {
            expect(await servicio.obtenerDetalle(id)).toBeNull();
        }
        expect(await servicio.obtenerDetalle(37)).toMatchObject({ id: 37, url: urlTracking });
        const { ofertas, alcance } = await servicio.listar({ texto: 'Credenciales' });
        expect(ofertas.map(({ id, url }) => ({ id, url }))).toEqual([{ id: 37, url: urlTracking }]);
        expect(alcance).toMatchObject({ candidatos_examinados: 6, posible_truncamiento: false });
        expect(operaciones).toEqual(Array(7).fill('SELECT'));
    });

    test('detalle sin preferencias: descripción pública acotada o indisponible si hubo edición manual', async () => {
        await preparacion.query(`UPDATE ofertas SET descripcion = repeat('a', 5000),
            datos_crudos = '{"perfil":"privado"}', nota_postulacion = 'privado' WHERE id = 1`);
        const detalle = await consulta().obtenerDetalle(1);
        expect(detalle.descripcion).toBe('a'.repeat(4000));
        expect(detalle).not.toHaveProperty('datos_crudos');
        expect(detalle).not.toHaveProperty('nota_postulacion');
        await preparacion.query(`UPDATE ofertas SET descripcion = 'edición privada', origen_descripcion = 'manual',
            descripcion_original = 'sin procedencia verificable' WHERE id = 1`);
        expect(await consulta().obtenerDetalle(1)).toEqual({ ...detalle, descripcion: null });
        expect(await consulta().obtenerDetalle(9999)).toBeNull();
        expect(operaciones).toEqual(['SELECT', 'SELECT', 'SELECT']);
    });

    test('rechaza entradas inválidas sin SQL y sanitiza los errores de PostgreSQL', async () => {
        const servicio = consulta();
        for (const entrada of [{ dias: 31 }, { dias: 0 }, { limite: 6 }, { limite: '5' }, { texto: 'x'.repeat(121) },
            { modalidad: 'desconocida' }, { pais: 'otro' }, { nivel: 'no consta' }, { url: 'https://example.invalid' }]) {
            await expect(servicio.listar(entrada)).rejects.toMatchObject({ codigo: 'FILTROS_INVALIDOS' });
        }
        await expect(servicio.obtenerDetalle('1')).rejects.toMatchObject({ codigo: 'ID_INVALIDO' });
        expect(operaciones).toEqual([]);
        // La misma conexión de lectura ejecuta el SQL contra una tabla inexistente.
        const sinEsquema = { query: async (sql, parametros) => {
            operaciones.push(sql.trim().split(/\s+/)[0]);
            return lectura.query(sql.replace(/\bFROM ofertas\b/, 'FROM tabla_sintetica_ausente'), parametros);
        } };
        for (const ejecutar of [() => consulta(sinEsquema).listar({}), () => consulta(sinEsquema).obtenerDetalle(1)]) {
            await expect(ejecutar()).rejects.toMatchObject({ codigo: 'LECTURA_NO_DISPONIBLE', message: 'No pude consultar las ofertas.' });
        }
        expect(operaciones).toEqual(['SELECT', 'SELECT']);
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await poolWeb?.end();
        await lectura?.end();
        await preparacion?.end();
    });

    test('GET existente sin preferencias: no intenta escribir y devuelve 503 seguro', async () => {
        const respuesta = await request(api).get('/ofertas/1');
        expect(operaciones).toEqual(['SELECT', 'SELECT']);
        expect(respuesta.status).toBe(503);
        expect(respuesta.body.error).toBe('No pude leer las preferencias requeridas. No modifiqué datos.');
        expect((await preparacion.query('SELECT id FROM preferencias')).rows).toEqual([]);
    });

    test('GET existente con preferencias: conserva el detalle y la vigencia de evaluación', async () => {
        await preparacion.query('INSERT INTO preferencias (id) VALUES (1)');
        try {
            const respuesta = await request(api).get('/ofertas/1');
            expect(operaciones).toEqual(['SELECT', 'SELECT']);
            expect(respuesta.status).toBe(200);
            expect(respuesta.body).toMatchObject({ exito: true, datos: { id: 1, titulo: 'QA ficticio', vigencia_evaluacion: 'desconocida' } });
        } finally {
            await preparacion.query('DELETE FROM preferencias WHERE id = 1');
        }
    });
});
