const { prepararBase, validarEntorno, TOKEN } = require('../helpers/issue-57-entorno');
const { crearProveedores, cerrarRed } = require('../helpers/issue-57-proveedores');
const { prepararControles } = require('../helpers/issue-57-runtime');
const request = require('supertest');

// Reutilizo el aislamiento #57; reemplazo únicamente el SDK externo, no servicios ni modelos.
const proveedores = crearProveedores();
const llamadas = [];
let fallar = false;
let descripcion = 'Buscamos desarrollador junior para trabajar en nuestro equipo de aplicaciones. Ofrecemos capacitación y acompañamiento.';
class ApifySintetico {
    actor(id) {
        if (id !== 'bYSAbQqxwImLaf2nb') throw new Error('Actor inesperado en contrato issue59.');
        return { call: async input => {
            llamadas.push(input);
            if (fallar) throw Object.assign(new Error('HTTP sintético'), { statusCode: 503 });
            return { id: 'run-59', status: 'SUCCEEDED', defaultDatasetId: 'dataset-59' };
        } };
    }
    dataset(id) {
        if (id !== 'dataset-59') throw new Error('Dataset inesperado en contrato issue59.');
        const oferta = { jobUrl: 'https://www.glassdoor.com.ar/job-listing/desarrollo-sintetico.htm?jl=590001',
            title: 'Desarrollador Junior', company: { companyName: 'Empresa sintética' },
            location_city: 'Buenos Aires', remoteWorkTypes: ['Remote'], description_text: descripcion,
            datePublished: new Date().toISOString() };
        return { listItems: async () => ({ items: [oferta, oferta] }) };
    }
}
for (const nombre of ['dotenv', 'node-cron', 'nodemailer']) jest.doMock(nombre, () => proveedores.modulos[nombre]);
jest.doMock('apify-client', () => ({ ApifyClient: ApifySintetico }));
jest.doMock('../../src/config/firebase-admin', () => proveedores.modulos.firebase);
jest.setTimeout(20000);

describe('Issue59 — Express → Glassdoor real → PostgreSQL15 aislado', () => {
    let pool;
    let esquema;
    let app;
    let controles;
    let restaurar;
    const obtener = ruta => request(app).get(ruta).set('Authorization', `Bearer ${TOKEN}`);
    const buscar = () => request(app).post('/api/scraping/glassdoor').set('Authorization', `Bearer ${TOKEN}`)
        .send({ terminos: ['QA'], maxResultados: 1 });
    beforeAll(async () => {
        validarEntorno();
        restaurar = cerrarRed(proveedores);
        ({ pool, esquema } = await prepararBase());
        controles = await prepararControles(pool, esquema);
        await controles.reset();
        app = require('../../src/app');
    });
    afterAll(async () => {
        if (pool) await pool.end();
        restaurar?.();
    });
    test('resuelvo override, deduplico y contabilizo nueva/actualizada/reaparecida sin perder seguimiento', async () => {
        const nueva = await buscar();
        expect(nueva.status).toBe(200);
        expect(nueva.body.datos).toMatchObject({ estado: 'completada', ofertas_nuevas: 1,
            duplicadasDescartadas: 1, total_crudos: 2, historial: { guardado: true } });
        expect(llamadas[0]).toMatchObject({ keywords: ['QA'], maxItems: 1, country: 'Argentina', datePosted: '14' });
        const lista = await obtener('/api/ofertas');
        expect(lista.status).toBe(200);
        expect(lista.body.datos).toHaveLength(1);
        const inicial = lista.body.datos[0];
        expect(inicial).toMatchObject({ titulo: 'Desarrollador Junior', plataforma: 'glassdoor', modalidad: 'remoto' });
        const manual = await request(app).patch(`/api/ofertas/${inicial.id}/seguimiento`)
            .set('Authorization', `Bearer ${TOKEN}`).send({ nota_postulacion: 'Nota sintética que conservo.' });
        expect(manual.status).toBe(200);
        descripcion += ' También ofrecemos formación adicional en pruebas automatizadas y revisión de código.';
        const actualizada = await buscar();
        expect(actualizada.status).toBe(200);
        expect(actualizada.body.datos).toMatchObject({ ofertas_nuevas: 0, ofertas_actualizadas: 1, ofertas_reapariciones: 0 });
        await pool.query("UPDATE ofertas SET fecha_ultima_extraccion=NOW()-INTERVAL '40 days' WHERE id=$1", [inicial.id]);
        const reaparecida = await buscar();
        expect(reaparecida.status).toBe(200);
        expect(reaparecida.body.datos).toMatchObject({ ofertas_nuevas: 0, ofertas_reapariciones: 1 });
        const posterior = (await obtener('/api/ofertas')).body.datos;
        expect(posterior).toHaveLength(1);
        expect(posterior[0]).toMatchObject({ id: inicial.id, nota_postulacion: 'Nota sintética que conservo.' });
        const historial = await obtener('/api/automatizacion/historial');
        expect(historial.status).toBe(200);
        expect(historial.body.datos).toHaveLength(3);
        expect(historial.body.datos.every(item => item.estado === 'completada')).toBe(true);
        expect((await pool.query('SELECT current_schema() AS esquema')).rows[0].esquema).toBe(esquema);
        expect((await pool.query('SELECT terminos_busqueda FROM preferencias WHERE id=1')).rows[0].terminos_busqueda).toEqual(['desarrollo junior']);
        expect((await pool.query('SELECT * FROM configuracion_cron WHERE activo')).rows).toEqual([]);
        expect(proveedores.inesperadas).toEqual([]);
    });
    test('un error del proveedor conserva ofertas y seguimiento y queda visible en historial', async () => {
        const antes = (await obtener('/api/ofertas')).body.datos;
        fallar = true;
        const fallo = await buscar();
        expect(fallo.status).toBe(502);
        expect(fallo.body.datos).toMatchObject({ estado: 'error', ofertas_nuevas: 0,
            errores: expect.arrayContaining([expect.objectContaining({ tipo: 'http', codigoHttp: 503 })]) });
        expect((await obtener('/api/ofertas')).body.datos).toEqual(antes);
        expect((await obtener('/api/automatizacion/historial')).body.datos[0].estado).toBe('error');
        expect(proveedores.inesperadas).toEqual([]);
    });
});
