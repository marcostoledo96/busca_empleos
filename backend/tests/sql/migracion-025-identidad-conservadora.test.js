const fs = require('fs');
const path = require('path');
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

    test('025 actualizo funciones originales ya aplicadas sin volver a ejecutar su backfill', async () => {
        const { execFileSync } = require('node:child_process');
        // Cargo sólo funciones antiguas, sin correr la reconciliación insegura antigua.
        for (const archivo of ['migracion-023-identidad-y-reapariciones.sql', 'migracion-024-reparar-identidades-canonicas.sql']) {
            const original = execFileSync('git', ['show', `7d504ec17de9051f735bd58ebf3bd28ef713055c:backend/sql/${archivo}`], { encoding: 'utf8' });
            const desde = original.indexOf('CREATE OR REPLACE FUNCTION');
            const hasta = original.indexOf('\nDO $$', desde);
            await pool.query(original.slice(desde, hasta));
        }
        await pool.query(leerMigracion(25));
        const fila = (await pool.query("SELECT fn_obtener_identidad_canonica_023('https://ar.indeed.com/viewjob?jk=%41BC123', 'indeed', '{}'::jsonb, 1) AS identidad")).rows[0];
        expect(fila.identidad).toBe('indeed:abc123');
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
