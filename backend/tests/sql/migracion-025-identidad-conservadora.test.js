const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');
const leerLegacy = () => fs.readFileSync(path.resolve(__dirname, '../fixtures/identidad-legacy-023-024.sql'));

test('verifico la integridad de las funciones históricas 023/024 sin depender de Git', () => {
    expect(createHash('sha256').update(leerLegacy()).digest('hex'))
        .toBe('f7a2e52e030941951aff72dcc3660e7f43381aff5c9ac59a327ee428f246aa84');
});
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/oferta');
const { normalizarOfertaIndeed, normalizarOfertaLinkedin } = require('../../src/servicios/servicio-normalizacion');
const { guardarLoteOfertasAislado } = require('../../src/servicios/servicio-ingreso-ofertas');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');
const casos = require('../fixtures/casos-identidad');
const contexto = process.env.ALLOW_DB_TESTS === 'true' ? describe : describe.skip;
const leerMigracion = numero => fs.readFileSync(path.resolve(__dirname, '../../sql', {
    23: 'migracion-023-identidad-y-reapariciones.sql',
    24: 'migracion-024-reparar-identidades-canonicas.sql',
    25: 'migracion-025-identidad-conservadora.sql',
}[numero]), 'utf8');

contexto('PR39 — Reconciliación incremental y circuito completo', () => {
    beforeEach(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE ofertas RESTART IDENTITY');
    });
    afterAll(async () => { await pool.end(); });

    test.each(casos)('normalización → persistencia → 023/024/025 → reaparición: %s %s', async (plataforma, url, datos, id) => {
        const cruda = { ...datos, url, jobUrl: url, title: 'Aviso sintético', jobTitle: 'Aviso sintético' };
        const normalizada = plataforma === 'indeed' ? normalizarOfertaIndeed(cruda) : normalizarOfertaLinkedin(cruda);
        const inicial = await modelo.crearOferta(normalizada);
        if (id) expect(inicial.identidad_canonica).toBe(`${plataforma}:${id}`);
        await modelo.actualizarPostulacion(inicial.id, 'cv_enviado');
        await modelo.actualizarDescripcionManual(inicial.id, 'Descripción manual sintética.');
        await pool.query("UPDATE ofertas SET fecha_extraccion = '2026-01-01', fecha_ultima_extraccion = '2026-01-02', fecha_publicacion = '2025-12-31' WHERE id = $1", [inicial.id]);
        const previa = await modelo.obtenerOfertaPorId(inicial.id);
        for (const numero of [23, 24, 25, 25]) {
            await pool.query(leerMigracion(numero));
            expect(await modelo.obtenerOfertaPorId(inicial.id)).toEqual(previa);
        }
        const reaparicion = await guardarLoteOfertasAislado([normalizada], modelo);
        expect(reaparicion).toEqual(expect.objectContaining({ guardadas: 0, reapariciones: 1, actualizadas: 0, duplicadas: 1, errores: 0 }));
        const final = await modelo.obtenerOfertaPorId(inicial.id);
        expect(final).toEqual(expect.objectContaining({ identidad_canonica: previa.identidad_canonica, url: previa.url,
            fecha_extraccion: previa.fecha_extraccion, fecha_publicacion: previa.fecha_publicacion,
            estado_postulacion: 'cv_enviado', origen_descripcion: 'manual', descripcion: previa.descripcion }));
        expect(final.fecha_ultima_extraccion.getTime()).toBeGreaterThan(previa.fecha_ultima_extraccion.getTime());
        const listado = await modelo.obtenerOfertas();
        expect(listado.ofertas.map(oferta => oferta.id)).toContain(inicial.id);
    });

    describe.each([false, true])('upgrade histórico aislado 023/024 → sólo 025, notas preexistentes: %s', (notasPreexistentes) => {
        let cliente;
        let anteriores;
        const nombres = [23, 24, 25].map(numero => ({
            23: 'migracion-023-identidad-y-reapariciones.sql',
            24: 'migracion-024-reparar-identidades-canonicas.sql',
            25: 'migracion-025-identidad-conservadora.sql',
        }[numero]));

        beforeEach(async () => {
            cliente = await pool.connect();
            try {
                await cliente.query('BEGIN');
                await cliente.query('CREATE SCHEMA upgrade_025_sintetico');
                await cliente.query('SET LOCAL search_path TO upgrade_025_sintetico');
                // No heredo funciones nuevas ni registros de 025 desde public.
                await cliente.query('CREATE TABLE ofertas (LIKE public.ofertas INCLUDING ALL)');
                if (notasPreexistentes) {
                    await cliente.query('ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS notas text');
                }
                await cliente.query('ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS notas text');
                await cliente.query(fs.readFileSync(path.resolve(__dirname, '../../sql/migracion-014-schema-migrations.sql'), 'utf8'));
                await cliente.query('INSERT INTO schema_migrations (id, exitoso) VALUES ($1, true), ($2, true)', nombres.slice(0, 2));
                await cliente.query(leerLegacy().toString('utf8'));
                await cliente.query(`INSERT INTO ofertas
                    (id, titulo, plataforma, url, identidad_canonica, datos_crudos, fecha_extraccion,
                     fecha_ultima_extraccion, fecha_publicacion, estado_postulacion, descripcion, origen_descripcion, notas)
                    VALUES
                    (101, 'Histórica A', 'indeed', 'https://ar.indeed.com/viewjob?jk=2222222222222222',
                     'indeed:1111111111111111', '{"jk":"2222222222222222"}', '2026-01-01', '2026-01-02',
                     '2025-12-31', 'en_proceso', 'Descripción manual A', 'manual', 'Nota sintética A'),
                    (102, 'Histórica B', 'indeed', 'https://ar.indeed.com/viewjob?jk=1111111111111111',
                     'indeed:2222222222222222', '{"jk":"1111111111111111"}', '2026-02-01', '2026-02-02',
                     '2026-01-31', 'cv_enviado', 'Descripción manual B', 'manual', 'Nota sintética B')`);
                anteriores = (await cliente.query('SELECT * FROM ofertas ORDER BY id')).rows;
            } catch (error) {
                throw new Error(`Falló la preparación del esquema histórico 023/024: ${error.message}`, { cause: error });
            }
        });

        afterEach(async () => {
            if (cliente) {
                // También retiro esquema, funciones, notas y ledger sin tocar public.
                await cliente.query('ROLLBACK');
                cliente.release();
                cliente = null;
            }
        });

        test('025 actualizo funciones originales ya aplicadas sin volver a ejecutar su backfill', async () => {
            const consulta = "SELECT fn_obtener_identidad_canonica_023('https://ar.indeed.com/viewjob?jk=%41BC123', 'indeed', '{}'::jsonb, 1) AS identidad";
            expect((await cliente.query(consulta)).rows[0].identidad)
                .toBe('indeed:url:https://ar.indeed.com/viewjob?jk=ABC123');
            const indices = (await cliente.query(`SELECT indexdef FROM pg_indexes
                WHERE schemaname = current_schema() AND tablename = 'ofertas'`)).rows;
            expect(indices.some(({ indexdef }) => /UNIQUE INDEX.*\(url\)/.test(indexdef))).toBe(true);
            expect(indices.some(({ indexdef }) => /UNIQUE INDEX.*\(identidad_canonica\)/.test(indexdef))).toBe(true);
            const previas = (await cliente.query('SELECT * FROM schema_migrations ORDER BY id')).rows;
            expect(previas.map(({ id, exitoso }) => ({ id, exitoso })))
                .toEqual(nombres.slice(0, 2).map(id => ({ id, exitoso: true })));
            const pendientes = nombres.filter(nombre => !previas.some(fila => fila.id === nombre && fila.exitoso));
            expect(pendientes).toEqual([nombres[2]]);
            for (const nombre of pendientes) {
                await cliente.query(leerMigracion(25));
                await cliente.query('INSERT INTO schema_migrations (id, exitoso) VALUES ($1, true)', [nombre]);
            }
            expect((await cliente.query(consulta)).rows[0].identidad).toBe('indeed:abc123');
            const esperadas = anteriores.map(fila => ({
                ...fila, url: `https://ar.indeed.com/viewjob?jk=${fila.identidad_canonica.split(':')[1]}`,
            }));
            // Comparo todas las columnas, incluidas notas de instalaciones extendidas.
            expect((await cliente.query('SELECT * FROM ofertas ORDER BY id')).rows).toEqual(esperadas);
            expect((await cliente.query('SELECT * FROM schema_migrations WHERE id = ANY($1) ORDER BY id', [nombres.slice(0, 2)])).rows).toEqual(previas);
            expect((await cliente.query('SELECT id, exitoso FROM schema_migrations ORDER BY id')).rows)
                .toEqual(nombres.map(id => ({ id, exitoso: true })));
            const primera = (await cliente.query('SELECT *, xmin::text, ctid::text FROM ofertas ORDER BY id')).rows;
            await cliente.query(leerMigracion(25));
            expect((await cliente.query('SELECT *, xmin::text, ctid::text FROM ofertas ORDER BY id')).rows).toEqual(primera);
        });
    });

    test('025 preservo ocupantes ajenos bajo UNIQUE(url) y mantengo el fragmento estable', async () => {
        await pool.query(`INSERT INTO ofertas (titulo, plataforma, url, identidad_canonica) VALUES
            ('Ajena sintética', 'general', 'https://ar.indeed.com/viewjob?jk=abc123', 'general:url:https://ar.indeed.com/viewjob?jk=abc123'),
            ('Nativa sintética', 'indeed', 'https://ar.indeed.com/viewjob?jk=otro', 'indeed:abc123')`);
        const ajena = await modelo.obtenerOfertaPorId(1);
        await pool.query(leerMigracion(25));
        expect(await modelo.obtenerOfertaPorId(1)).toEqual(ajena);
        expect((await modelo.obtenerOfertaPorId(2)).url).toBe('https://ar.indeed.com/viewjob?jk=abc123#identidad-historica-2-1');
        const primera = (await pool.query('SELECT *, xmin::text FROM ofertas ORDER BY id')).rows;
        await pool.query(leerMigracion(25));
        expect((await pool.query('SELECT *, xmin::text FROM ofertas ORDER BY id')).rows).toEqual(primera);
    });

    test('025 no modifico identidad, URL ni otros campos de portales ajenos', async () => {
        await pool.query(`INSERT INTO ofertas (titulo, plataforma, url, identidad_canonica, datos_crudos) VALUES
            ('Bumeran sintética', 'bumeran', 'https://www.bumeran.com.ar/empleos/dev-2222222222.html', 'bumeran:1111111111', '{}'),
            ('General sintética', 'general', 'https://example.invalid/aviso', 'indeed:abc123', '{}')`);
        const anterior = (await pool.query('SELECT *, xmin::text FROM ofertas ORDER BY id')).rows;
        await pool.query(leerMigracion(25));
        expect((await pool.query('SELECT *, xmin::text FROM ofertas ORDER BY id')).rows).toEqual(anterior);
    });

    test('025 aborto atómicamente ante URL broken sin persistir una URL relativa', async () => {
        await pool.query(`INSERT INTO ofertas (titulo, plataforma, url, identidad_canonica) VALUES
            ('Válida sintética', 'indeed', 'https://ar.indeed.com/viewjob?jk=valida123', 'indeed:url:anterior'),
            ('Inválida sintética', 'indeed', 'broken', 'indeed:abc123')`);
        const anterior = (await pool.query('SELECT *, xmin::text FROM ofertas ORDER BY id')).rows;
        await expect(pool.query(leerMigracion(25))).rejects.toThrow('No puedo reconciliar una URL nativa inválida o extensa');
        expect((await pool.query('SELECT *, xmin::text FROM ofertas ORDER BY id')).rows).toEqual(anterior);
    });

    test('025 sigo aceptando una URL nativa absoluta válida', async () => {
        const inicial = await modelo.crearOferta(normalizarOfertaIndeed({ url: 'https://ar.indeed.com/viewjob?jk=abc123', title: 'Sintética' }));
        const anterior = (await pool.query('SELECT *, xmin::text FROM ofertas WHERE id = $1', [inicial.id])).rows;
        await pool.query(leerMigracion(25));
        expect((await pool.query('SELECT *, xmin::text FROM ofertas WHERE id = $1', [inicial.id])).rows).toEqual(anterior);
    });

    test('025 aborto atómicamente ante URL extensa, sin cambiar datos ni claves', async () => {
        const id = 'a'.repeat(2000);
        await pool.query(`INSERT INTO ofertas (titulo, plataforma, url, identidad_canonica) VALUES
            ('Sintética', 'indeed', 'https://ar.indeed.com/viewjob?jk=otro', $1)`, [`indeed:${id}`]);
        const anterior = (await pool.query('SELECT *, xmin::text FROM ofertas')).rows;
        await expect(pool.query(leerMigracion(25))).rejects.toThrow('No puedo reconciliar una URL nativa inválida o extensa');
        expect((await pool.query('SELECT *, xmin::text FROM ofertas')).rows).toEqual(anterior);
    });

    test.each([false, true])('ambos órdenes de información cruda: primeroCompleto=%s, no fusiono IDs', async primeroCompleto => {
        const a = { url: 'https://ar.indeed.com/job/dev-1111111111111111', title: 'Mismo título' };
        const b = { url: 'https://ar.indeed.com/job/dev-2222222222222222', title: 'Mismo título' };
        const lote = [a, { ...a, jk: '2222222222222222' }];
        if (primeroCompleto) lote.reverse();
        const primera = await guardarLoteOfertasAislado([normalizarOfertaIndeed(lote[0])], modelo);
        expect(primera).toEqual(expect.objectContaining({ guardadas: 1, reapariciones: 0, errores: 0 }));
        const previa = await modelo.obtenerOfertaPorId(1);
        for (const numero of [23, 24, 25]) await pool.query(leerMigracion(numero));
        const segunda = await guardarLoteOfertasAislado([normalizarOfertaIndeed(lote[1])], modelo);
        expect(segunda).toEqual(expect.objectContaining({ guardadas: 0, reapariciones: 1, actualizadas: 0, errores: 0 }));
        expect((await modelo.obtenerOfertaPorId(1)).fecha_extraccion).toEqual(previa.fecha_extraccion);
        await modelo.crearOferta(normalizarOfertaIndeed({ ...b, jk: '1111111111111111' }));
        const filas = (await pool.query('SELECT identidad_canonica FROM ofertas ORDER BY id')).rows;
        expect(filas).toEqual([{ identidad_canonica: 'indeed:1111111111111111' }, { identidad_canonica: 'indeed:2222222222222222' }]);
    });

    test('025 resuelvo URLs cruzadas bajo UNIQUE y no vuelvo a escribir filas al repetir', async () => {
        await pool.query(`INSERT INTO ofertas (titulo, plataforma, url, identidad_canonica) VALUES
            ('Sintética A', 'indeed', 'https://ar.indeed.com/viewjob?jk=2222222222222222', 'indeed:1111111111111111'),
            ('Sintética B', 'indeed', 'https://ar.indeed.com/viewjob?jk=1111111111111111', 'indeed:2222222222222222')`);
        await pool.query(leerMigracion(25));
        const primera = await pool.query('SELECT id, url, identidad_canonica, xmin::text FROM ofertas ORDER BY id');
        expect(primera.rows.map(fila => fila.url)).toEqual([
            'https://ar.indeed.com/viewjob?jk=1111111111111111',
            'https://ar.indeed.com/viewjob?jk=2222222222222222',
        ]);
        await pool.query(leerMigracion(25));
        expect((await pool.query('SELECT id, url, identidad_canonica, xmin::text FROM ofertas ORDER BY id')).rows).toEqual(primera.rows);
    });

    test.each([['1111111111111111', '2222222222222222'], ['2222222222222222', '1111111111111111']])('conservo identidad nativa %s contradictoria con URL %s, sin fusionar', async (a, b) => {
        // Reproduzco el estado persistido defectuoso de B01, no una nueva normalización.
        const { rows: [historica] } = await pool.query(`INSERT INTO ofertas
            (titulo, plataforma, url, identidad_canonica, datos_crudos, fecha_extraccion, fecha_ultima_extraccion,
             fecha_publicacion, estado_postulacion, descripcion, origen_descripcion)
            VALUES ('Sintética', 'indeed', $1, $2, $3, '2026-01-01', '2026-01-02', '2025-12-31', 'en_proceso', 'Manual sintética', 'manual') RETURNING *`,
        [`https://ar.indeed.com/viewjob?jk=${b}`, `indeed:${a}`, { jk: a }]);
        const antes = await modelo.obtenerOfertaPorId(historica.id);
        for (const numero of [23, 24, 25, 25]) {
            await pool.query(leerMigracion(numero));
            const despues = await modelo.obtenerOfertaPorId(historica.id);
            expect(despues).toEqual({ ...antes, url: numero >= 25 ? `https://ar.indeed.com/viewjob?jk=${a}` : antes.url });
        }
        for (const id of [b, a]) {
            await modelo.crearOferta(normalizarOfertaIndeed({ url: `https://ar.indeed.com/viewjob?jk=${id}`, title: 'Sintética' }));
        }
        const todas = await pool.query('SELECT id, identidad_canonica FROM ofertas ORDER BY id');
        expect(todas.rows).toHaveLength(2);
        expect(todas.rows[0]).toEqual({ id: historica.id, identidad_canonica: `indeed:${a}` });
        expect(todas.rows[1].identidad_canonica).toBe(`indeed:${b}`);
    });
});
