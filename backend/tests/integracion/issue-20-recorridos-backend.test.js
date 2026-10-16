// Integro Express, scrapers, normalización, ingreso y modelos reales sobre SQL simulado.
// No es E2E de navegador ni prueba de durabilidad PostgreSQL: esas pruebas son independientes.
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
jest.mock('apify-client', () => ({ ApifyClient: jest.fn(() => ({ actor: jest.fn(), dataset: jest.fn() })) }));
jest.mock('node-cron', () => ({ validate: jest.fn(() => true), createTask: jest.fn(() => ({
    start: jest.fn(), stop: jest.fn(), destroy: jest.fn(), getStatus: jest.fn(() => 'idle'),
})) }));
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => req.headers.authorization === 'Bearer sintetico' ? next() : res.status(401).json({ exito: false }),
}));
jest.mock('../../src/servicios/servicio-evaluacion', () => ({
    obtenerProgresoEvaluacion: jest.fn(() => ({ activo: false })),
    evaluarOfertasPendientes: jest.fn(async () => ({ total: 0, aprobadas: 0, rechazadas: 0, errores: 0 })),
}));
jest.mock('../../src/servicios/servicio-notificacion-email', () => ({ enviarResumenCiclo: jest.fn(async () => ({ enviado: false })) }));
jest.mock('../../src/utils/bloqueo-concurrente', () => ({ CLAVES: {}, intentarAdquirirLock: jest.fn(async () => ({ ok: true, client: {} })), liberarBloqueoSeguro: jest.fn(async () => {}) }));
const request = require('supertest');
const pool = require('../../src/config/base-datos');
const scraping = require('../../src/servicios/servicio-scraping');
const automatizacion = require('../../src/servicios/servicio-automatizacion');
const { clienteApify } = require('../../src/config/apify');
const cron = require('node-cron');
const app = require('../../src/app');
const pedir = (metodo, ruta) => request(app)[metodo](ruta).set('Authorization', 'Bearer sintetico');
const descripcion = 'Buscamos una persona para nuestro equipo de soporte. Las tareas son resolver los problemas de los usuarios y dar asistencia. Se requiere conocimiento de sistemas y ganas de aprender.';
const tarjeta = id => `<article class="box_offer"><h2><a class="js-o-link" href="/ofertas/soporte-${id}">Soporte técnico junior ${id}</a></h2><p class="fs16 fc_base mt5">Empresa sintética</p></article>`;
const html = texto => ({ ok: true, text: async () => texto });
let numero;
beforeEach(() => {
    automatizacion._resetearEstado();
    jest.clearAllMocks();
    pool.reiniciar();
    numero = 0;
    global.fetch = jest.fn(async () => { throw new Error('Petición no simulada.'); });
    // Sólo Computrabajo consulta HTTP por defecto; el resto no tiene efectos externos.
    for (const funcion of ['ejecutarScrapingLinkedin', 'ejecutarScrapingIndeed', 'ejecutarScrapingBumeran',
        'ejecutarScrapingGlassdoor', 'ejecutarScrapingJooble', 'ejecutarScrapingRemotive', 'ejecutarScrapingRemoteOK', 'ejecutarScrapingAdzuna']) {
        jest.spyOn(scraping, funcion).mockResolvedValue([]);
    }
});
afterEach(() => {
    automatizacion._resetearEstado();
    jest.restoreAllMocks();
    jest.useRealTimers();
    delete global.fetch;
});
async function esperarCiclo() {
    for (let intento = 0; intento < 200; intento++) {
        if (!automatizacion.cicloEnProgreso()) return;
        await new Promise(resolve => setImmediate(resolve));
    }
    throw new Error('No finalizó el ciclo sintético.');
}
async function historial() {
    const respuesta = await pedir('get', '/api/automatizacion/historial');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.exito).toBe(true);
    return respuesta.body.datos;
}
function simularParcial() {
    global.fetch.mockImplementation(async url => {
        if (url.includes('trabajo-de-mesa-de-ayuda')) return { ok: false, status: 503, body: { cancel: jest.fn(async () => {}) } };
        if (url.includes('?p=')) return html('');
        if (url.includes('trabajo-de-soporte-it')) return html(tarjeta(++numero));
        if (url.includes('/ofertas/')) return html(`<p class="mbB">${descripcion}</p>`);
        throw new Error('URL no simulada.');
    });
}
test('A: HTTP éxito + 503 → parcial con ofertas útiles → individual, ciclo y lectura pública de historial', async () => {
    simularParcial();
    const opciones = { terminos: ['soporte IT', 'mesa de ayuda'] };
    const individual = await pedir('post', '/api/scraping/computrabajo').send(opciones);
    expect(individual.status).toBe(200);
    expect(individual.body.exito).toBe(true);
    const fuente = individual.body.datos.fuente;
    expect(fuente).toMatchObject({ plataforma: 'computrabajo', estado: 'parcial', estadoScraping: 'parcial', nuevas: 1,
        totalExtraidas: 1, totalElegibles: 1, consultasEjecutadas: 2, motivoFinalizacion: 'http' });
    expect(fuente.errores).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'http', codigoHttp: 503 })]));
    expect(fuente.resultadosConsultas.map(consulta => consulta.consulta)).toEqual([
        'https://www.computrabajo.com.ar/trabajo-de-soporte-it', 'https://www.computrabajo.com.ar/trabajo-de-mesa-de-ayuda',
    ]);
    expect(fuente.peticionesRealizadas).toBe(global.fetch.mock.calls.length);
    expect(fuente.resultadosConsultas[1]).toMatchObject({ estado: 'error', errores: expect.arrayContaining([expect.objectContaining({ codigoHttp: 503 })]) });
    expect((await historial())[0]).toMatchObject({ tipo: 'individual', estado: 'parcial', resumen: { fuentes: [
        expect.objectContaining({ plataforma: 'computrabajo', estado: 'parcial', nuevas: 1 }),
    ] } });
    const ciclo = await pedir('post', '/api/automatizacion/ejecutar').send(opciones);
    expect(ciclo.status).toBe(202);
    await esperarCiclo();
    const estado = await pedir('get', '/api/automatizacion/estado');
    expect(estado.status).toBe(200);
    expect(estado.body.datos.ultimoResultado).toMatchObject({ estado: 'parcial', exito: false, scraping: { guardadas: 1 } });
    expect(estado.body.datos.ultimoResultado.fuentes.find(f => f.plataforma === 'computrabajo')).toMatchObject({ estado: 'parcial', nuevas: 1 });
    const listado = await pedir('get', '/api/ofertas');
    expect(listado.status).toBe(200);
    expect(listado.body.datos).toHaveLength(2);
    expect(listado.body.datos.every(oferta => oferta.descripcion === descripcion && oferta.plataforma === 'computrabajo')).toBe(true);
    const registros = await historial();
    expect(registros).toHaveLength(2);
    expect(registros[0]).toMatchObject({ tipo: 'ciclo_manual', estado: 'parcial', resumen: { fuentes: expect.arrayContaining([
        expect.objectContaining({ plataforma: 'computrabajo', estado: 'parcial', nuevas: 1 }),
        expect.objectContaining({ plataforma: 'getonbrd', estado: 'deshabilitada', peticionesRealizadas: 0 }),
    ]) } });
    expect(pool.consultasNoContempladas).toEqual([]);
    expect(clienteApify.actor).not.toHaveBeenCalled();
});
test('B: timeout HTTP real controlado → siguiente proveedor útil → historial de ambos y ninguna escritura tardía', async () => {
    jest.useFakeTimers({ advanceTimers: 20, doNotFake: ['nextTick', 'setImmediate'] });
    const computrabajoReal = scraping.ejecutarScrapingComputrabajo;
    jest.spyOn(scraping, 'ejecutarScrapingComputrabajo').mockImplementation(opciones => computrabajoReal({ ...opciones, timeoutMs: 50, timeoutPeticionMs: 50 }));
    scraping.ejecutarScrapingRemotive.mockRestore();
    let liberarRespuestaTardia;
    let signal;
    global.fetch.mockImplementation((url, opciones) => {
        if (url.includes('computrabajo')) {
            signal = opciones.signal;
            return new Promise(resolve => { liberarRespuestaTardia = resolve; });
        }
        if (url.includes('remotive')) {
            expect(signal.aborted).toBe(true);
            return Promise.resolve({ ok: true, json: async () => ({ jobs: [{ id: 200, url: 'https://remotive.com/remote-jobs/support/sintetica-200',
                title: 'Soporte técnico junior', company_name: 'Empresa sintética', description: descripcion,
                candidate_required_location: 'Worldwide', publication_date: new Date().toISOString() }] }) });
        }
        throw new Error('URL no simulada.');
    });
    // Acoto el ciclo directo con el snapshot real; HTTP conserva la misma ruta pública de resultados.
    const configuraciones = await automatizacion.prepararCiclo({ terminos: ['soporte IT'] });
    const resultado = await automatizacion.ejecutarCicloCompleto({}, configuraciones);
    expect(resultado).toMatchObject({ estado: 'parcial', exito: false, scraping: { guardadas: 1 }, historial: { guardado: true } });
    expect(resultado.fuentes.find(f => f.plataforma === 'computrabajo')).toMatchObject({ estado: 'timeout', nuevas: 0, consultasEjecutadas: 1, peticionesRealizadas: 1 });
    expect(resultado.fuentes.find(f => f.plataforma === 'computrabajo').duracionScrapingMs).toBeGreaterThanOrEqual(50);
    expect(resultado.fuentes.find(f => f.plataforma === 'remotive')).toMatchObject({ estado: 'completada', nuevas: 1 });
    expect(signal.aborted).toBe(true);
    const antes = await pedir('get', '/api/ofertas');
    expect(antes.status).toBe(200);
    expect(antes.body.datos).toHaveLength(1);
    expect(antes.body.datos[0]).toMatchObject({ plataforma: 'remotive', descripcion });
    const registros = await historial();
    expect(registros[0].resumen.fuentes).toEqual(expect.arrayContaining([
        expect.objectContaining({ plataforma: 'computrabajo', estado: 'timeout', nuevas: 0 }),
        expect.objectContaining({ plataforma: 'remotive', estado: 'completada', nuevas: 1 }),
    ]));
    liberarRespuestaTardia(html(tarjeta('tardia')));
    await jest.advanceTimersByTimeAsync(1000);
    const despues = await pedir('get', '/api/ofertas');
    expect(despues.status).toBe(200);
    expect(despues.body).toEqual(antes.body);
    expect(await historial()).toEqual(registros);
    expect(pool.consultasNoContempladas).toEqual([]);
});
test('C: decisión explícita inactiva → reinicio del singleton → historial accesible sin scraping ni scheduler', async () => {
    simularParcial();
    expect((await pedir('post', '/api/scraping/computrabajo').send({ terminos: ['soporte IT', 'mesa de ayuda'] })).status).toBe(200);
    expect((await pedir('post', '/api/automatizacion/detener').send({})).status).toBe(200);
    const registros = await historial();
    const llamadas = global.fetch.mock.calls.length;
    automatizacion._resetearEstado();
    await automatizacion.rehidratar();
    await automatizacion.rehidratar();
    const estado = await pedir('get', '/api/automatizacion/estado');
    expect(estado.status).toBe(200);
    expect(estado.body.datos).toMatchObject({ activo: false, expresionCron: null, errorCron: null });
    expect(await historial()).toEqual(registros);
    expect(global.fetch).toHaveBeenCalledTimes(llamadas);
    expect(cron.createTask).not.toHaveBeenCalled();
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(pool.consultasNoContempladas).toEqual([]);
});
