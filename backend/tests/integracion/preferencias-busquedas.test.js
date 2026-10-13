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

test('consulta incompatible guardada omite únicamente fuentes incompatibles en HTTP y cron', async () => {
    simularOtrasFuentes();
    expect((await pedir('put', '/api/preferencias').send({ terminos_busqueda: ['###'] })).status).toBe(200);
    expect((await pedir('post', '/api/scraping/indeed').send({})).status).toBe(400);
    expect(scraping.ejecutarScrapingIndeed).not.toHaveBeenCalled();
    expect((await pedir('post', '/api/scraping/linkedin').send({})).status).toBe(200);
    pool.ofertas.length = 0;
    pool.query.mockClear();
    const respuesta = await pedir('post', '/api/automatizacion/ejecutar').send({});
    expect(respuesta.status).toBe(202);
    await esperarCiclo();
    const estado = (await pedir('get', '/api/automatizacion/estado')).body.datos;
    const progreso = automatizacion.obtenerProgreso();
    expect(pool.ofertas).toHaveLength(1);
    expect(progreso).toMatchObject({ activo: false, porcentaje: 100 });
    for (const id of ['indeed', 'jooble', 'adzuna', 'bumeran']) {
        const funcion = compatibles.find(([fuente]) => fuente === id)[1];
        expect(scraping[funcion]).not.toHaveBeenCalled();
        expect(progreso.pasos.find(p => p.nombre === id)).toMatchObject({ estado: 'omitida', motivo: expect.any(String), extraidas: 0 });
        expect(estado.ultimoResultado.omisiones).toContainEqual({ plataforma: id, motivo: expect.any(String) });
        expect(estado.ultimoResultado.configuracion.find(p => p.plataforma === id)).toMatchObject({ motivoOmision: expect.any(String), advertencias: expect.arrayContaining([expect.any(String)]) });
    }
    expect(clienteApify.actor().call.mock.calls.at(-1)[0].urls[0]).toContain('keywords=%23%23%23');
    expect(pool.query.mock.calls.some(([sql]) => /^UPDATE preferencias/i.test(sql))).toBe(false);
    expect(pool.obtenerPreferencias().terminos_busqueda).toEqual(['###']);
    automatizacion.programarCron();
    await cron.schedule.mock.calls.at(-1)[1]();
    expect(scraping.ejecutarScrapingIndeed).not.toHaveBeenCalled();
    expect(automatizacion.obtenerEstado().ultimoResultado.omisiones.length).toBeGreaterThanOrEqual(4);
    automatizacion.detenerCron();
});

test('QA y C# guardados ejecutan en todas las fuentes compatibles sin omitirse', async () => {
    simularOtrasFuentes();
    expect((await pedir('put', '/api/preferencias').send({ terminos_busqueda: ['QA', 'C#'] })).status).toBe(200);
    expect((await pedir('post', '/api/scraping/indeed').send({})).status).toBe(200);
    expect((await pedir('post', '/api/scraping/bumeran').send({})).status).toBe(200);
    expect((await pedir('post', '/api/scraping/linkedin').send({})).status).toBe(200);
    const preview = (await pedir('get', '/api/scraping/previsualizacion')).body.datos;
    for (const id of ['linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor', 'jooble', 'adzuna']) {
        const plat = preview.plataformas.find(p => p.plataforma === id);
        expect(plat.motivoOmision).toBeUndefined();
        expect(plat.terminos).toEqual(['QA', 'C#']);
    }
});

test('vacío global no se convierte en omisiones ni ejecuta filtros fijos', async () => {
    await guardarPreferencias();
    const preferenciasGuardadas = structuredClone(pool.obtenerPreferencias());
    simularOtrasFuentes();
    jest.spyOn(scraping, 'ejecutarScrapingLinkedin').mockResolvedValue([]);
    for (const opciones of [{ terminos: [] }, { terminos: ['QA'], terminos_busqueda: ['QA'] }, { terminos: [3] }]) {
        expect((await pedir('post', '/api/automatizacion/ejecutar').send(opciones)).status).toBe(400);
    }
    expect((await pedir('put', '/api/preferencias').send({ terminos_busqueda: [] })).status).toBe(400);
    expect(pool.obtenerPreferencias()).toEqual(preferenciasGuardadas);
    // Simulo una fila legada inválida sin relajar la validación del PUT.
    pool.obtenerPreferencias().terminos_busqueda = [];
    try {
        expect((await pedir('post', '/api/automatizacion/ejecutar').send({})).status).toBe(400);
    } finally {
        pool.obtenerPreferencias().terminos_busqueda = preferenciasGuardadas.terminos_busqueda;
    }
    expect(automatizacion.cicloEnProgreso()).toBe(false);
    for (const [, funcion] of compatibles) expect(scraping[funcion]).not.toHaveBeenCalled();
    expect(scraping.ejecutarScrapingRemotive).not.toHaveBeenCalled();
    expect(scraping.ejecutarScrapingRemoteOK).not.toHaveBeenCalled();
    expect(clienteApify.actor).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
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
    expect(respuesta.body.datos.total_extraidas).toBe(preview.maxResultados);
    expect(pool.ofertas).toHaveLength(preview.maxResultados);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opciones] = global.fetch.mock.calls[0];
    if (id === 'jooble') {
        expect(JSON.parse(opciones.body)).toEqual({ keywords: preview.filtros.palabras[0], location: preview.ubicacion[0], page: 1 });
        expect(preview.filtros.maxPaginasPorTermino).toBe(2);
    } else {
        expect(new URL(url).searchParams.get('tags')).toBe(preview.filtros.tags[0]);
        expect(new URL(url).searchParams.has('limit')).toBe(false);
    }
    expect(preview.advertencias.join(' ')).toMatch(new RegExp(`límite estricto sobre maxResultados.*no superar ${preview.maxResultados}`, 'i'));
});

test('LinkedIn omite consulta incompatible ??? sin abortar batch ni llamar Apify y rechaza individual con 400 (N-01)', async () => {
    simularOtrasFuentes();
    expect((await pedir('put', '/api/preferencias').send({ terminos_busqueda: ['???'] })).status).toBe(200);

    const previewRes = await pedir('get', '/api/scraping/previsualizacion');
    const prevLinkedin = previewRes.body.datos.plataformas.find(p => p.plataforma === 'linkedin');
    expect(prevLinkedin.ejecutable).toBe(false);
    expect(prevLinkedin.motivoOmision).toMatch(/términos de búsqueda utilizables para LinkedIn/i);

    const respIndividual = await pedir('post', '/api/scraping/linkedin').send({});
    expect(respIndividual.status).toBe(400);
    expect(respIndividual.body.codigo).toBe('consulta_incompatible_fuente');
    expect(clienteApify.actor().call).not.toHaveBeenCalled();

    pool.ofertas.length = 0;
    clienteApify.actor().call.mockClear();
    const resCiclo = await pedir('post', '/api/automatizacion/ejecutar').send({});
    expect(resCiclo.status).toBe(202);
    await esperarCiclo();

    const estado = (await pedir('get', '/api/automatizacion/estado')).body.datos;
    expect(estado.ultimoResultado.omisiones).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ plataforma: 'linkedin', motivo: expect.stringMatching(/utilizables para LinkedIn/i) })
        ])
    );
    expect(clienteApify.actor().call).not.toHaveBeenCalled();

    expect((await pedir('put', '/api/preferencias').send({ terminos_busqueda: ['QA', '???'] })).status).toBe(200);
    clienteApify.actor().call.mockClear();
    const respMixto = await pedir('post', '/api/scraping/linkedin').send({});
    expect(respMixto.status).toBe(200);
    expect(clienteApify.actor().call).toHaveBeenCalledWith(
        expect.objectContaining({
            urls: expect.arrayContaining([expect.stringContaining('keywords=QA')])
        })
    );
});

test('LinkedIn respeta la persistencia de filtrar_nivel_linkedin en URLs del scraper (OBS-a)', async () => {
    expect((await pedir('put', '/api/preferencias').send({
        terminos_busqueda: ['QA'],
        filtrar_nivel_linkedin: false
    })).status).toBe(200);

    clienteApify.actor().call.mockClear();
    const respSinFiltro = await pedir('post', '/api/scraping/linkedin').send({});
    expect(respSinFiltro.status).toBe(200);
    const urlsSinFiltro = clienteApify.actor().call.mock.calls[0][0].urls;
    expect(urlsSinFiltro.some(u => u.includes('f_E='))).toBe(false);

    expect((await pedir('put', '/api/preferencias').send({
        terminos_busqueda: ['QA'],
        filtrar_nivel_linkedin: true
    })).status).toBe(200);

    clienteApify.actor().call.mockClear();
    const respConFiltro = await pedir('post', '/api/scraping/linkedin').send({});
    expect(respConFiltro.status).toBe(200);
    const urlsConFiltro = clienteApify.actor().call.mock.calls[0][0].urls;
    expect(urlsConFiltro.every(u => u.includes('f_E=1%2C2'))).toBe(true);
});

test('Integración Issue #16: Preferencias → reparto Jooble (tester, soporte, angular) → 60 items crudos con repetidas/antiguas → cupo final max 50 y métricas', async () => {
    await pedir('put', '/api/preferencias').send({
        terminos_busqueda: ['tester', 'soporte', 'angular']
    });

    const ahora = new Date();
    const fechaReciente = new Date(ahora.getTime() - 5 * 86400000).toISOString();
    const fechaAntigua = new Date(ahora.getTime() - 40 * 86400000).toISOString();

    global.fetch = jest.fn(async (url, opciones) => {
        const body = JSON.parse(opciones.body);
        const termino = body.keywords;
        const page = body.page;

        const jobs = Array.from({ length: 20 }, (_, i) => {
            const idItem = (i < 5) ? `repetida-${i}` : `${termino}-p${page}-${i}`;
            const fecha = (i % 4 === 0) ? fechaAntigua : fechaReciente;
            return {
                title: `${termino} Developer ${i}`,
                company: 'Empresa Test',
                location: 'Remoto',
                snippet: descripcionEs,
                link: `https://jooble.org/desc/${idItem}`,
                updated: fecha
            };
        });

        return {
            ok: true,
            status: 200,
            json: async () => ({ totalCount: 100, jobs })
        };
    });

    const respuesta = await pedir('post', '/api/scraping/jooble').send({ maxResultados: 50 });
    expect(respuesta.status).toBe(200);

    const datos = respuesta.body.datos;
    expect(datos.total_extraidas).toBeLessThanOrEqual(50);
    expect(pool.ofertas.length).toBeLessThanOrEqual(50);
    expect(datos.total_extraidas).toBe(pool.ofertas.length);

    const terminosConsultados = global.fetch.mock.calls.map(c => JSON.parse(c[1].body).keywords);
    expect(terminosConsultados).toContain('tester');
    expect(terminosConsultados).toContain('soporte');
    expect(terminosConsultados).toContain('angular');

    expect(datos.motivo_finalizacion).toBeDefined();
    expect(datos.ventana_dias).toBe(30);
    expect(datos.max_resultados).toBe(50);
    expect(datos.duplicadas_descartadas).toBeGreaterThan(0);
    expect(datos.sin_fecha_conocida).toBeGreaterThan(0);
});
