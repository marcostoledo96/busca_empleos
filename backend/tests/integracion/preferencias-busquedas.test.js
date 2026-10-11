jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
jest.mock('apify-client', () => ({ ApifyClient: jest.fn(() => ({ actor: jest.fn(), dataset: jest.fn() })) }));
jest.mock('node-cron', () => ({ validate: jest.fn(() => true), schedule: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => req.headers.authorization === 'Bearer prueba' ? next() : res.status(401).json({ exito: false }),
}));
jest.mock('../../src/servicios/servicio-evaluacion', () => ({
    obtenerProgresoEvaluacion: jest.fn(() => ({ activo: false })),
    evaluarOfertasPendientes: jest.fn(async () => ({ total: 0, aprobadas: 0, rechazadas: 0, errores: 0 })),
}));
jest.mock('../../src/servicios/servicio-notificacion-email', () => ({ enviarResumenCiclo: jest.fn(async () => ({ enviado: false })) }));
jest.mock('../../src/utils/bloqueo-concurrente', () => ({ CLAVES: {}, intentarAdquirirLock: jest.fn(async () => ({ ok: true, client: {} })), liberarBloqueoSeguro: jest.fn(async () => {}) }));

const request = require('supertest');
const pool = require('../../src/config/base-datos');
const { clienteApify } = require('../../src/config/apify');
const scraping = require('../../src/servicios/servicio-scraping');
const automatizacion = require('../../src/servicios/servicio-automatizacion');
const cron = require('node-cron');
const app = require('../../src/app');
const terminos = ['soporte IT', 'mesa de ayuda'];
const pedir = (metodo, ruta) => request(app)[metodo](ruta).set('Authorization', 'Bearer prueba');
const descripcionEs = 'Buscamos una persona para nuestro equipo de soporte. Las tareas son resolver los problemas de los usuarios y dar asistencia. Se requiere conocimiento de sistemas y ganas de aprender.';
const descripcionEn = 'We are looking for a software engineer to join our team. You will work with our customers and you should have experience with the tools. The ideal candidate has strong skills and will be responsible for the development of our products.';
let numeroRun = 0;

beforeEach(() => {
    jest.clearAllMocks();
    pool.ofertas.length = 0;
    automatizacion._resetearEstado();
    global.fetch = jest.fn(async () => { throw new Error('Request externa no simulada'); });
    clienteApify.actor.mockReturnValue({ call: jest.fn(async () => ({ defaultDatasetId: 'sintetico' })) });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn(async () => ({ items: [
        { jobTitle: 'Soporte técnico', companyName: 'Empresa sintética', location: 'CABA', jobDescription: descripcionEs, jobUrl: `https://linkedin.com/jobs/view/es-${++numeroRun}` },
        { jobTitle: 'Software engineer', companyName: 'Synthetic', location: 'Remote', jobDescription: descripcionEn, jobUrl: `https://linkedin.com/jobs/view/en-${numeroRun}` },
    ] })) });
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

async function guardarPreferencias() {
    const respuesta = await pedir('put', '/api/preferencias').send({ terminos_busqueda: terminos });
    expect(respuesta.status).toBe(200);
}

function simularOtrasFuentes() {
    for (const funcion of ['ejecutarScrapingComputrabajo', 'ejecutarScrapingIndeed', 'ejecutarScrapingBumeran', 'ejecutarScrapingGlassdoor', 'ejecutarScrapingJooble', 'ejecutarScrapingRemotive', 'ejecutarScrapingRemoteOK', 'ejecutarScrapingAdzuna']) {
        jest.spyOn(scraping, funcion).mockResolvedValue([]);
    }
}

async function esperarCiclo() {
    for (let intento = 0; intento < 100; intento++) {
        if (!automatizacion.cicloEnProgreso()) return;
        await new Promise(resolve => setImmediate(resolve));
    }
    throw new Error('El ciclo simulado no terminó');
}

test('PUT preferencias → LinkedIn real normalización/ingreso/persistencia → GET ofertas', async () => {
    await guardarPreferencias();
    const respuesta = await pedir('post', '/api/scraping/linkedin').send({});
    expect(respuesta.status).toBe(200);
    expect(clienteApify.actor().call.mock.calls[0][0].urls[0]).toContain('keywords=soporte+IT');
    expect(respuesta.body.datos.descartadas_por_idioma).toBe(1);
    const listado = await pedir('get', '/api/ofertas');
    expect(listado.status).toBe(200);
    expect(pool.ofertas).toHaveLength(1);
    expect(JSON.stringify(listado.body)).toContain('Soporte técnico');
    expect(JSON.stringify(listado.body)).not.toContain('Software engineer');
    expect(pool.ofertas[0].plataforma).toBe('linkedin');
    expect(pool.ofertas[0].datos_crudos).toContain('jobTitle');
});

test('override individual no modifica preferencias y preview es autenticada, veraz y sin proveedores', async () => {
    await guardarPreferencias();
    await pedir('post', '/api/scraping/linkedin').send({ terminos: ['QA'] });
    expect(pool.obtenerPreferencias().terminos_busqueda).toEqual(terminos);
    clienteApify.actor.mockClear();
    pool.query.mockClear();
    expect((await request(app).get('/api/scraping/previsualizacion')).status).toBe(401);
    const preview = await pedir('get', '/api/scraping/previsualizacion');
    expect(preview.status).toBe(200);
    expect(preview.body.datos.plataformas.find(p => p.plataforma === 'linkedin')).toMatchObject({ terminos, origen: { terminos: 'preferencias' } });
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
});

test('PUT → ciclo HTTP → persistencia → GET y status con configuración ejecutada', async () => {
    await guardarPreferencias();
    simularOtrasFuentes();
    const respuesta = await pedir('post', '/api/automatizacion/ejecutar').send({});
    expect(respuesta.status).toBe(202);
    await esperarCiclo();
    expect(pool.ofertas).toHaveLength(1);
    expect(clienteApify.actor().call.mock.calls[0][0].urls[0]).toContain('keywords=soporte+IT');
    const estado = await pedir('get', '/api/automatizacion/estado');
    expect(estado.body.datos.ultimoResultado.configuracion.find(p => p.plataforma === 'linkedin').terminos).toEqual(terminos);
    const listado = await pedir('get', '/api/ofertas');
    expect(JSON.stringify(listado.body)).toContain('Soporte técnico');
});

test('inválidos y vacío controlados antes de llamadas y antes del 202', async () => {
    await guardarPreferencias();
    for (const opciones of [{ terminos: [] }, { terminos: 10 }, { maxResultados: -1 }, { maxResultados: 'abc' }]) {
        expect((await pedir('post', '/api/scraping/linkedin').send(opciones)).status).toBe(400);
        expect((await pedir('post', '/api/automatizacion/ejecutar').send(opciones)).status).toBe(400);
    }
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('fuentes bloqueadas/inactivas no consumen APIs', async () => {
    for (const fuente of ['getonbrd', 'google-jobs', 'infojobs']) {
        expect((await pedir('post', `/api/scraping/${fuente}`).send({})).status).toBe(200);
    }
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('cron simulado lee preferencias nuevas en cada callback y conserva default/estado', async () => {
    simularOtrasFuentes();
    expect(automatizacion.obtenerEstado().activo).toBe(false);
    automatizacion.programarCron();
    expect(cron.schedule).toHaveBeenCalledWith('0 20 * * 2', expect.any(Function), { timezone: 'America/Argentina/Buenos_Aires' });
    const callback = cron.schedule.mock.calls[0][1];
    await guardarPreferencias();
    await callback();
    await pedir('put', '/api/preferencias').send({ terminos_busqueda: ['asistencia técnica'] });
    await callback();
    expect(clienteApify.actor().call.mock.calls[1][0].urls[0]).toContain('asistencia+t%C3%A9cnica');
    automatizacion.detenerCron();
    expect(automatizacion.obtenerEstado().activo).toBe(false);
});


test('PUT → Computrabajo HTML simulado → normalización/persistencia real → GET ofertas', async () => {
    await guardarPreferencias();
    const preview = (await pedir('get', '/api/scraping/previsualizacion')).body.datos.plataformas.find(p => p.plataforma === 'computrabajo');
    global.fetch.mockImplementation(async url => ({
        ok: true,
        text: async () => url.includes('trabajo-de-')
            ? '<article class="box_offer"><h2><a class="js-o-link" href="/ofertas/soporte-123">Soporte técnico</a></h2><p class="fs16 fc_base mt5">Empresa sintética</p></article>'
            : `<p class="mbB">${descripcionEs}</p>`,
    }));
    const respuesta = await pedir('post', '/api/scraping/computrabajo').send({});
    expect(respuesta.status).toBe(200);
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
        'https://www.computrabajo.com.ar/trabajo-de-soporte-it',
        'https://www.computrabajo.com.ar/trabajo-de-mesa-de-ayuda',
    ]));
    expect(pool.ofertas).toHaveLength(1);
    expect(respuesta.body.datos.configuracion).toEqual(preview);
    expect(preview.filtros.transformacionTerminos).toBe('minusculas_sin_signos');
    expect(pool.ofertas[0]).toMatchObject({ plataforma: 'computrabajo', descripcion: descripcionEs });
    expect(JSON.stringify((await pedir('get', '/api/ofertas')).body)).toContain('Soporte técnico');
});

const compatibles = [
    ['linkedin', 'ejecutarScrapingLinkedin'], ['computrabajo', 'ejecutarScrapingComputrabajo'],
    ['indeed', 'ejecutarScrapingIndeed'], ['bumeran', 'ejecutarScrapingBumeran'],
    ['glassdoor', 'ejecutarScrapingGlassdoor'], ['jooble', 'ejecutarScrapingJooble'], ['adzuna', 'ejecutarScrapingAdzuna'],
];
test.each(compatibles)('%s individual recibe preferencias guardadas y el resumen común', async (id, funcion) => {
    await guardarPreferencias();
    const scraper = jest.spyOn(scraping, funcion).mockResolvedValue([]);
    const preview = await pedir('get', '/api/scraping/previsualizacion');
    const respuesta = await pedir('post', `/api/scraping/${id}`).send({});
    expect(respuesta.status).toBe(200);
    expect(scraper).toHaveBeenCalledWith(expect.objectContaining({ terminos }));
    expect(respuesta.body.datos.configuracion).toEqual(preview.body.datos.plataformas.find(p => p.plataforma === id));
});

test('ciclo usa todos los términos guardados, override por ejecución no escribe preferencias', async () => {
    await guardarPreferencias();
    simularOtrasFuentes();
    jest.spyOn(scraping, 'ejecutarScrapingLinkedin').mockResolvedValue([]);
    const guardado = await pedir('post', '/api/automatizacion/ejecutar').send({});
    expect(guardado.status).toBe(202);
    await esperarCiclo();
    for (const [, funcion] of compatibles) {
        expect(scraping[funcion]).toHaveBeenCalledWith(expect.objectContaining({ terminos }));
        scraping[funcion].mockClear();
    }
    const override = await pedir('post', '/api/automatizacion/ejecutar').send({ terminos_busqueda: ['asistencia técnica'], maxResultados: 500 });
    expect(override.status).toBe(202);
    expect(override.body.datos.configuracion.find(p => p.plataforma === 'adzuna').maxResultados).toBe(50);
    await esperarCiclo();
    for (const [, funcion] of compatibles) {
        expect(scraping[funcion]).toHaveBeenCalledWith(expect.objectContaining({ terminos: ['asistencia técnica'] }));
    }
    expect(pool.obtenerPreferencias().terminos_busqueda).toEqual(terminos);
    expect(automatizacion.obtenerProgreso().configuracion).toEqual(override.body.datos.configuracion);
});

test('falla de lectura devuelve 503 sin aceptar ciclo ni llamar proveedores', async () => {
    pool.query.mockRejectedValueOnce(new Error('Falla simulada'));
    expect((await pedir('post', '/api/scraping/linkedin').send({})).status).toBe(503);
    pool.query.mockRejectedValueOnce(new Error('Falla simulada'));
    expect((await pedir('post', '/api/automatizacion/ejecutar').send({})).status).toBe(503);
    expect(automatizacion.cicloEnProgreso()).toBe(false);
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

test('reservo el ciclo durante la lectura y rechazo otra aceptación con 409', async () => {
    let liberar;
    pool.query.mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
    const primero = automatizacion.prepararCiclo({});
    expect((await pedir('post', '/api/automatizacion/ejecutar').send({})).status).toBe(409);
    liberar({ rows: [{ terminos_busqueda: terminos }] });
    await primero;
    automatizacion._resetearEstado();
    expect(clienteApify.actor).not.toHaveBeenCalled();
});


test.each(compatibles)('%s rechaza vacío y tipos inválidos antes del proveedor', async (id) => {
    await guardarPreferencias();
    for (const opciones of [{ terminos: [] }, { terminos: [' '] }, { maxResultados: 0 }, { terminosBusqueda: ['QA'] }]) {
        expect((await pedir('post', `/api/scraping/${id}`).send(opciones)).status).toBe(400);
    }
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(pool.ofertas).toHaveLength(0);
});


test.each([{ terminosInvalidos: ['###'] }, { terminosInvalidos: ['soporte IT', '###'] }])('Computrabajo devuelve 400 sin requests si una URL quedaría genérica: %j', async ({ terminosInvalidos }) => {
    const respuesta = await pedir('post', '/api/scraping/computrabajo').send({ terminos: terminosInvalidos });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.exito).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(pool.ofertas).toHaveLength(0);
});

test.each(['jooble', 'remoteok'])('%s preview describe el umbral y coincide con payload real incluso con overflow', async (id) => {
    await guardarPreferencias();
    const preview = (await pedir('get', '/api/scraping/previsualizacion')).body.datos.plataformas.find(p => p.plataforma === id);
    const items = Array.from({ length: preview.maxResultados + 1 }, (_, indice) => id === 'jooble'
        ? { title: 'Soporte técnico', snippet: descripcionEs, link: `https://jooble.test/oferta/${indice}`, updated: new Date().toISOString() }
        : { position: 'Soporte técnico', description: descripcionEs, url: `https://remoteok.test/oferta/${indice}`, date: new Date().toISOString() });
    global.fetch.mockResolvedValue({ ok: true, json: async () => id === 'jooble' ? { totalCount: items.length, jobs: items } : [{ legal: true }, ...items] });
    const respuesta = await pedir('post', `/api/scraping/${id}`).send({});
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.configuracion).toEqual(preview);
    expect(respuesta.body.datos.total_extraidas).toBe(preview.maxResultados + 1);
    expect(pool.ofertas).toHaveLength(preview.maxResultados + 1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opciones] = global.fetch.mock.calls[0];
    if (id === 'jooble') {
        expect(JSON.parse(opciones.body)).toEqual({ keywords: preview.filtros.palabras[0], location: preview.ubicacion[0], page: 1 });
        expect(preview.filtros.maxPaginasPorTermino).toBe(2);
    } else {
        expect(new URL(url).searchParams.get('tags')).toBe(preview.filtros.tags[0]);
        expect(new URL(url).searchParams.has('limit')).toBe(false);
    }
    expect(preview.advertencias.join(' ')).toMatch(new RegExp(`umbral de acumulación.*no.*límite estricto.*superar ${preview.maxResultados}`, 'i'));
});
