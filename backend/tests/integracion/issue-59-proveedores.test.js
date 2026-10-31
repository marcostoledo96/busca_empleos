const { prepararBase, validarEntorno, TOKEN } = require('../helpers/issue-57-entorno');
const { crearProveedores, cerrarRed } = require('../helpers/issue-57-proveedores');
const { prepararControles, esperarTerminal } = require('../helpers/issue-57-runtime');
const request = require('supertest');

// Reutilizo el aislamiento #57; reemplazo únicamente el SDK externo, no servicios ni modelos.
const proveedores = crearProveedores();
const llamadas = [];
let fallar = false;
let rechazarBumeran = false;
const apifyGeneral = new proveedores.modulos['apify-client'].ApifyClient();
let descripcion = 'Buscamos desarrollador junior para trabajar en nuestro equipo de aplicaciones. Ofrecemos capacitación y acompañamiento.';
class ApifySintetico {
    actor(id) {
        if (id === 'apify/puppeteer-scraper' && rechazarBumeran) return { call: async input => {
            llamadas.push(input);
            throw Object.assign(new Error('HTTP sintético privado'), { statusCode: 403 });
        } };
        if (id !== 'bYSAbQqxwImLaf2nb') return apifyGeneral.actor(id);
        return { call: async input => {
            llamadas.push(input);
            if (fallar) throw Object.assign(new Error('HTTP sintético'), { statusCode: 503 });
            return { id: 'run-59', status: 'SUCCEEDED', defaultDatasetId: 'dataset-59' };
        } };
    }
    dataset(id) {
        if (id !== 'dataset-59') return apifyGeneral.dataset(id);
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
        console.info(`[SQL59] Identidad y esquema verificados: PostgreSQL15; base=busca_empleos_issue57_test; usuario=busca_empleos_test; host=127.0.0.1; puerto=55457; esquema=${esquema}; guardas de entorno/.env/red activas; SDK externo simulado.`);
        controles = await prepararControles(pool, esquema);
        await controles.reset();
        app = require('../../src/app');
    });
    afterAll(async () => {
        if (pool) {
            await pool.end();
            console.info('[SQL59] Pool PostgreSQL cerrado.');
        }
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
    test('issue71: HTTP403 de Bumeran conserva oferta, seguimiento e historial fiel en individual y ciclo parcial', async () => {
        fallar = false;
        rechazarBumeran = true;
        const antes = (await obtener('/api/ofertas')).body.datos;
        expect(antes).toHaveLength(1);
        const historialAntes = (await obtener('/api/automatizacion/historial')).body.datos;
        const errorEsperado = { tipo: 'http', codigoHttp: 403,
            mensaje: 'El proveedor rechazó el inicio del Actor. No recibí un run ID; no intenté cancelación remota.' };
        // El historial excluye mensajes textuales por privacidad; la respuesta individual conserva el detalle.
        const errorHistorialEsperado = { tipo: 'http', codigoHttp: 403 };
        const inicioLlamadas = llamadas.length;
        const individual = await request(app).post('/api/scraping/bumeran').set('Authorization', `Bearer ${TOKEN}`)
            .send({ terminos: ['programador', 'qa', 'tester', 'desarrollador', 'full stack', 'frontend', 'soporte tecnico', 'help desk', 'it', 'support'] });
        expect(individual.status).toBe(502);
        expect(individual.body.datos).toMatchObject({ estado: 'error', ofertas_nuevas: 0, ofertas_actualizadas: 0,
            ofertas_reapariciones: 0, errores: [errorEsperado], historial: { guardado: true } });
        expect(individual.body.datos.errores).toEqual([errorEsperado]);
        expect(llamadas).toHaveLength(inicioLlamadas + 1);
        expect((await obtener('/api/ofertas')).body.datos).toEqual(antes);
        const historialTrasIndividual = (await obtener('/api/automatizacion/historial')).body.datos;
        expect(historialTrasIndividual.slice(1)).toEqual(historialAntes);
        const historialIndividual = historialTrasIndividual[0];
        expect(historialIndividual).toMatchObject({ estado: 'error', resumen: {
            fuentes: [expect.objectContaining({ plataforma: 'bumeran', estado: 'error' })] } });
        const fuenteIndividual = historialIndividual.resumen.fuentes[0];
        expect(fuenteIndividual.errores).toEqual([errorHistorialEsperado]);
        expect(fuenteIndividual.resultadosConsultas).toHaveLength(10);
        for (const consulta of fuenteIndividual.resultadosConsultas) {
            expect(consulta.estado).toBe('error');
            expect(consulta.errores).toEqual([errorHistorialEsperado]);
        }
        const ciclo = await request(app).post('/api/automatizacion/ejecutar').set('Authorization', `Bearer ${TOKEN}`).send({});
        expect(ciclo.status).toBe(202);
        const progreso = await esperarTerminal(() => obtener('/api/automatizacion/progreso'));
        expect(progreso.activo).toBe(false);
        const historialTrasCiclo = (await obtener('/api/automatizacion/historial')).body.datos;
        expect(historialTrasCiclo.slice(1)).toEqual(historialTrasIndividual);
        const historialCiclo = historialTrasCiclo[0];
        expect(historialCiclo).toMatchObject({ estado: 'parcial', resumen: { estadoScraping: 'parcial',
            fuentes: expect.arrayContaining([expect.objectContaining({ plataforma: 'bumeran', estado: 'error' })]) } });
        const fuenteCiclo = historialCiclo.resumen.fuentes.find(fuente => fuente.plataforma === 'bumeran');
        expect(fuenteCiclo.errores).toEqual([errorHistorialEsperado]);
        expect(fuenteCiclo.resultadosConsultas.length).toBeGreaterThan(0);
        for (const consulta of fuenteCiclo.resultadosConsultas) {
            expect(consulta.estado).toBe('error');
            expect(consulta.errores).toEqual([errorHistorialEsperado]);
        }
        const posterior = (await obtener('/api/ofertas')).body.datos;
        expect(posterior.find(oferta => oferta.id === antes[0].id)).toMatchObject({
            id: antes[0].id, nota_postulacion: antes[0].nota_postulacion,
            estado_postulacion: antes[0].estado_postulacion, fecha_postulacion: antes[0].fecha_postulacion,
        });
        expect(proveedores.inesperadas).toEqual([]);
    });
});
