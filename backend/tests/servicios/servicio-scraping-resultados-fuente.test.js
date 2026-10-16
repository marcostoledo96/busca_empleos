jest.mock('../../src/config/apify', () => ({
    clienteApify: { actor: jest.fn(), dataset: jest.fn(), run: jest.fn() },
    ACTORES: { LINKEDIN: 'linkedin-sintetico', INDEED: 'indeed-sintetico', BUMERAN_WEB: 'bumeran-sintetico', GLASSDOOR: 'glassdoor-sintetico' },
    TERMINOS_BUSQUEDA_DEFECTO: ['qa'],
    REMOTIVE_API_BASE: 'https://remotive.test/api', REMOTEOK_API_BASE: 'https://remoteok.test/api',
    JOOBLE_API_URL: 'https://jooble.test/api/', JOOBLE_API_KEY: 'clave-sintetica',
    construirUrlsLinkedin: () => ['https://linkedin.test/busqueda'],
    construirUrlsComputrabajo: () => ['https://computrabajo.test/busqueda'],
    formatearTerminoComputrabajo: termino => termino,
    construirUrlsBumeran: () => ['https://bumeran.test/busqueda'],
}));
jest.mock('../../src/servicios/servicio-normalizacion', () => ({
    normalizarLote: (items, plataforma) => items.map(item => ({ ...item, plataforma })),
    detectarIdioma: () => 'es', parsearFechaRelativaComputrabajo: () => null,
}));
const servicio = require('../../src/servicios/servicio-scraping');
const { clienteApify } = require('../../src/config/apify');
const oferta = { url: 'https://remotive.test/oferta/1', titulo: 'Busco QA', descripcion: 'Pruebas manuales' };
const fetchOriginal = global.fetch;
const tokenOriginal = process.env.APIFY_TOKEN;
const appIdOriginal = process.env.ADZUNA_APP_ID;
const appKeyOriginal = process.env.ADZUNA_APP_KEY;

beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.APIFY_TOKEN = 'token-sintetico';
    process.env.ADZUNA_APP_ID = 'id-sintetico';
    process.env.ADZUNA_APP_KEY = 'clave-sintetica';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    jest.useRealTimers(); jest.restoreAllMocks(); global.fetch = fetchOriginal;
    for (const [clave, valor] of Object.entries({ APIFY_TOKEN: tokenOriginal, ADZUNA_APP_ID: appIdOriginal, ADZUNA_APP_KEY: appKeyOriginal })) {
        if (valor === undefined) delete process.env[clave]; else process.env[clave] = valor;
    }
});

test('vacío válido no es un error y conserva el array no enumerable', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ jobs: [] }) });
    const resultado = await servicio.ejecutarScrapingRemotive({ terminos: ['qa'], categoriasRemotive: ['qa'] });
    expect(resultado).toEqual([]);
    expect(Object.keys(resultado)).toEqual([]);
    expect(resultado.metricas).toMatchObject({ plataforma: 'remotive', estado: 'sin_resultados', peticionesRealizadas: 1, consultasEjecutadas: 1, totalCrudos: 0, totalElegibles: 0, errores: [], duracionMs: expect.any(Number) });
    expect(resultado.metricas.resultadosConsultas).toEqual([expect.objectContaining({ consulta: 'qa', estado: 'sin_resultados', peticionesRealizadas: 1, totalCrudos: 0 })]);
});

test.each([401, 403, 429, 500, 502, 503])('HTTP %i queda visible, sin filtrar cuerpo ni credenciales', async codigoHttp => {
    const json = jest.fn();
    global.fetch.mockResolvedValue({ ok: false, status: codigoHttp, json });
    const resultado = await servicio.ejecutarScrapingRemotive({ categoriasRemotive: ['qa'] });
    expect(resultado).toEqual([]);
    expect(resultado.metricas).toMatchObject({ estado: 'error', totalElegibles: 0, peticionesRealizadas: 1, errores: [expect.objectContaining({ codigoHttp, tipo: codigoHttp === 429 ? 'limite_solicitudes' : 'http', consulta: 'qa' })] });
    expect(json).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('conservo parciales, consultas efectivas y contadores sin inventar persistencia', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [oferta, oferta] }) })
        .mockResolvedValueOnce({ ok: false, status: 503 });
    const resultado = await servicio.ejecutarScrapingRemotive({ terminos: ['qa', 'soporte it'], maxResultados: 10 });
    expect(resultado).toHaveLength(1);
    expect(resultado.metricas).toMatchObject({ estado: 'parcial', totalCrudos: 2, duplicadasDescartadas: 1, totalElegibles: 1, consultasEjecutadas: 2, peticionesRealizadas: 2 });
    expect(resultado.metricas.resultadosConsultas.map(c => c.consulta)).toEqual(['qa', 'customer-service']);
    expect(resultado.metricas).not.toHaveProperty('nuevasInsertadas');
});

test.each(['red', 'json', 'estructura'])('distingo respuesta inválida y fallo %s del vacío válido', async tipo => {
    if (tipo === 'red') global.fetch.mockRejectedValue(new Error('https://secreto.test/?token=privado'));
    else global.fetch.mockResolvedValue({ ok: true, json: tipo === 'json' ? async () => { throw new Error('payload privado'); } : async () => ({ otro: [] }) });
    const resultado = await servicio.ejecutarScrapingRemotive({ categoriasRemotive: ['qa'] });
    expect(resultado.metricas.estado).toBe('error');
    expect(resultado.metricas.errores[0].tipo).toBe(tipo === 'red' ? 'red' : 'respuesta_invalida');
    expect(JSON.stringify(resultado.metricas)).not.toMatch(/privado|secreto/);
});

test.each(['fetch', 'cuerpo'])('aborto %s lento, termino por timeout y puedo ejecutar la siguiente fuente', async etapa => {
    jest.useFakeTimers();
    let signal;
    global.fetch.mockImplementation(async (_, opciones) => {
        signal = opciones.signal;
        if (etapa === 'fetch') return new Promise(() => {});
        return { ok: true, json: () => new Promise(() => {}) };
    });
    const pendiente = servicio.ejecutarScrapingRemotive({ terminos: ['qa', 'soporte it'], timeoutMs: 50, timeoutPeticionMs: 50 });
    await jest.advanceTimersByTimeAsync(51);
    const resultado = await pendiente;
    expect(signal.aborted).toBe(true);
    expect(resultado.metricas).toMatchObject({ estado: 'timeout', duracionMs: 50, peticionesRealizadas: 1, totalElegibles: 0 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ jobs: [] }) });
    expect((await servicio.ejecutarScrapingRemotive({ categoriasRemotive: ['qa'] })).metricas.estado).toBe('sin_resultados');
});

test('una respuesta tardía no modifica el array finalizado', async () => {
    jest.useFakeTimers();
    let resolver;
    global.fetch.mockResolvedValue({ ok: true, json: () => new Promise(resolve => { resolver = resolve; }) });
    const pendiente = servicio.ejecutarScrapingRemotive({ categoriasRemotive: ['qa'], timeoutMs: 20 });
    await jest.advanceTimersByTimeAsync(21);
    const resultado = await pendiente;
    resolver({ jobs: [oferta] });
    await Promise.resolve();
    expect(resultado).toEqual([]);
    expect(resultado.metricas.totalElegibles).toBe(0);
});

test('Apify sin token no inicia actores', async () => {
    delete process.env.APIFY_TOKEN;
    const resultado = await servicio.ejecutarScrapingLinkedin({ terminos: ['qa'] });
    expect(resultado.metricas).toMatchObject({ estado: 'sin_credenciales', consultasEjecutadas: 0 });
    expect(clienteApify.actor).not.toHaveBeenCalled();
});

test.each(['Linkedin', 'Indeed', 'Bumeran', 'Glassdoor'])('Apify %s no trata FAILED como éxito; conserva dataset útil', async nombre => {
    const call = jest.fn().mockResolvedValue({ id: 'run-sintetico', status: 'FAILED', defaultDatasetId: 'dataset-sintetico' });
    clienteApify.actor.mockReturnValue({ call });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn().mockResolvedValue({ items: [oferta] }) });
    const resultado = await servicio[`ejecutarScraping${nombre}`]({ terminos: ['qa'] });
    expect(resultado).toHaveLength(1);
    expect(resultado.metricas.estado).toBe('parcial');
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][1]).toMatchObject({ timeout: expect.any(Number), waitSecs: 1 });
    expect(resultado.metricas.peticionesRealizadas).toBeNull();
});

test.each(['Computrabajo', 'Jooble', 'RemoteOK', 'Adzuna'])('%s informa 401/403/429/5xx sin resultados falsamente exitosos', async nombre => {
    for (const codigoHttp of [401, 403, 429, 500, 502, 503]) {
        global.fetch.mockClear().mockResolvedValue({ ok: false, status: codigoHttp });
        const resultado = await servicio[`ejecutarScraping${nombre}`]({ terminos: ['qa'], maxPaginasPorTermino: 1 });
        expect(resultado).toEqual([]);
        expect(resultado.metricas).toMatchObject({ estado: 'error', totalElegibles: 0, peticionesRealizadas: 1 });
        expect(resultado.metricas.errores).toEqual([expect.objectContaining({ codigoHttp })]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    }
});

test('Adzuna conserva ofertas y métricas si vence el plazo durante la pausa obligatoria', async () => {
    jest.useFakeTimers();
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [oferta] }) });
    const pendiente = servicio.ejecutarScrapingAdzuna({ terminos: ['qa', 'soporte it'], timeoutMs: 100 });
    await jest.advanceTimersByTimeAsync(101);
    const resultado = await pendiente;
    expect(resultado).toHaveLength(1);
    expect(resultado.metricas).toMatchObject({ estado: 'parcial', totalCrudos: 1, totalElegibles: 1, consultasEjecutadas: 1, peticionesRealizadas: 1, duracionMs: 100, motivoFinalizacion: 'timeout' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('cancelación externa antes de comenzar no emite peticiones', async () => {
    const abortador = new AbortController(); abortador.abort();
    const resultado = await servicio.ejecutarScrapingRemotive({ terminos: ['qa'], signal: abortador.signal });
    expect(resultado.metricas).toMatchObject({ estado: 'error', motivoFinalizacion: 'cancelacion', peticionesRealizadas: 0, consultasEjecutadas: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
});

test('Apify limita polling, no inicia otro run y no confirma un abort inconcluso', async () => {
    jest.useFakeTimers();
    const call = jest.fn().mockResolvedValue({ id: 'run', status: 'RUNNING', defaultDatasetId: 'dataset' });
    const get = jest.fn().mockResolvedValue({ id: 'run', status: 'RUNNING', defaultDatasetId: 'dataset' });
    const abort = jest.fn().mockResolvedValue({ status: 'ABORTING' });
    clienteApify.actor.mockReturnValue({ call });
    clienteApify.run.mockReturnValue({ get, abort });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn().mockResolvedValue({ items: [] }) });
    const pendiente = servicio.ejecutarScrapingIndeed({ terminos: ['qa'], timeoutMs: 47000 });
    await jest.advanceTimersByTimeAsync(2001);
    const resultado = await pendiente;
    expect(resultado.metricas.estado).toBe('timeout');
    expect(resultado.metricas.errores.map(e => e.tipo)).toEqual(['timeout', 'cancelacion_no_confirmada']);
    expect(call).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
});

test.each(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'])('Apify estado terminal %s vacío es distinguible', async status => {
    clienteApify.actor.mockReturnValue({ call: jest.fn().mockResolvedValue({ status, id: 'run', defaultDatasetId: 'dataset' }) });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn().mockResolvedValue({ items: [] }) });
    const resultado = await servicio.ejecutarScrapingIndeed({ terminos: ['qa'] });
    expect(resultado.metricas.estado).toBe(status === 'SUCCEEDED' ? 'sin_resultados' : status === 'TIMED-OUT' ? 'timeout' : 'error');
    expect(resultado.metricas.resultadosConsultas).toHaveLength(1);
});

test('Adzuna informa crudos recibidos y consultas realmente ejecutadas al alcanzar el cupo', async () => {
    jest.useFakeTimers();
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [oferta, { ...oferta, url: 'https://adzuna.test/2' }] }) });
    const pendiente = servicio.ejecutarScrapingAdzuna({ terminos: ['qa', 'soporte it'], maxResultados: 1 });
    await jest.advanceTimersByTimeAsync(2500);
    const resultado = await pendiente;
    expect(resultado).toHaveLength(1);
    expect(resultado.metricas).toMatchObject({ estado: 'completada', totalCrudos: 2, totalElegibles: 1, consultasEjecutadas: 1, consultasOmitidas: 1, peticionesRealizadas: 1 });
    expect(resultado.metricas.resultadosConsultas).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each(['Computrabajo', 'Jooble', 'RemoteOK', 'Adzuna'])('%s aborta cuerpo lento antes de otra consulta', async nombre => {
    jest.useFakeTimers();
    let signal;
    global.fetch.mockImplementation(async (_, opciones) => {
        signal = opciones.signal;
        return { ok: true, text: () => new Promise(() => {}), json: () => new Promise(() => {}) };
    });
    const pendiente = servicio[`ejecutarScraping${nombre}`]({ terminos: ['qa', 'soporte it'], timeoutMs: 20 });
    await jest.advanceTimersByTimeAsync(21);
    const resultado = await pendiente;
    expect(signal.aborted).toBe(true);
    expect(resultado).toEqual([]);
    expect(resultado.metricas).toMatchObject({ estado: 'timeout', motivoFinalizacion: 'timeout', totalElegibles: 0, peticionesRealizadas: 1, consultasEjecutadas: 1, duracionMs: 20 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each(['http', 'timeout'])('Computrabajo conserva tarjetas útiles ante fallo de detalle %s', async tipo => {
    jest.useFakeTimers();
    const html = '<article class="box_offer"><h2><a class="js-o-link" href="/ofertas/qa-123">QA</a></h2></article>';
    let signal;
    global.fetch.mockResolvedValueOnce({ ok: true, text: async () => html })
        .mockImplementationOnce(async (_, opciones) => {
            signal = opciones.signal;
            return tipo === 'http' ? { ok: false, status: 503 } : { ok: true, text: () => new Promise(() => {}) };
        });
    const pendiente = servicio.ejecutarScrapingComputrabajo({ terminos: ['qa'], maxResultados: 1, timeoutMs: 20 });
    await jest.advanceTimersByTimeAsync(21);
    const resultado = await pendiente;
    expect(resultado).toHaveLength(1);
    expect(resultado[0].url).toBe('https://ar.computrabajo.com/ofertas/qa-123');
    expect(resultado.metricas).toMatchObject({ estado: 'parcial', totalCrudos: 1, totalElegibles: 1, duplicadasDescartadas: 0, peticionesRealizadas: 2, consultasEjecutadas: 1 });
    expect(resultado.metricas.resultadosConsultas[0]).toMatchObject({ estado: 'parcial', totalElegibles: 1 });
    expect(resultado.metricas.errores).toEqual([expect.objectContaining({ tipo: tipo === 'http' ? 'http' : 'timeout' })]);
    expect(signal.aborted).toBe(tipo === 'timeout');
    expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('Jooble sin credencial no emite peticiones', async () => {
    let ejecutar;
    jest.isolateModules(() => {
        require('../../src/config/apify').JOOBLE_API_KEY = '';
        ejecutar = require('../../src/servicios/servicio-scraping').ejecutarScrapingJooble;
    });
    const resultado = await ejecutar({ terminos: ['qa'] });
    expect(resultado.metricas).toMatchObject({ estado: 'sin_credenciales', consultasEjecutadas: 0, peticionesRealizadas: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
});

test('Apify completa polling sin duplicar el arranque', async () => {
    jest.useFakeTimers();
    const call = jest.fn().mockResolvedValue({ id: 'run', status: 'RUNNING', defaultDatasetId: 'dataset' });
    const get = jest.fn().mockResolvedValue({ id: 'run', status: 'SUCCEEDED', defaultDatasetId: 'dataset' });
    const abort = jest.fn();
    clienteApify.actor.mockReturnValue({ call });
    clienteApify.run.mockReturnValue({ get, abort });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn().mockResolvedValue({ items: [oferta] }) });
    const pendiente = servicio.ejecutarScrapingIndeed({ terminos: ['qa'] });
    await jest.advanceTimersByTimeAsync(1000);
    const resultado = await pendiente;
    expect(resultado).toHaveLength(1);
    expect(resultado.metricas).toMatchObject({ estado: 'completada', totalCrudos: 1, totalElegibles: 1, duracionMs: 1000 });
    expect(call).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(1); expect(abort).not.toHaveBeenCalled();
});

test('registry no ofrece GetOnBrd, Google Jobs ni InfoJobs como fuentes activas', () => {
    const { PLATAFORMAS } = require('../../src/config/plataformas');
    for (const id of ['getonbrd', 'google_jobs', 'infojobs']) {
        expect(PLATAFORMAS[id]).toMatchObject({ activa: false, motivo: expect.any(String) });
    }
    expect(clienteApify.actor).not.toHaveBeenCalled(); expect(global.fetch).not.toHaveBeenCalled();
});
