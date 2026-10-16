jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ crearOferta: jest.fn() }));
jest.mock('../../src/modelos/ejecucion-busqueda', () => ({ iniciar: jest.fn(), finalizar: jest.fn() }));
jest.mock('../../src/config/apify', () => ({
    clienteApify: { actor: jest.fn(), dataset: jest.fn() },
    ACTORES: { LINKEDIN: 'linkedin-sintetico' }, TERMINOS_BUSQUEDA_DEFECTO: ['qa'],
    REMOTIVE_API_BASE: 'https://remotive.test/api',
    construirUrlsLinkedin: () => ['https://linkedin.test/busqueda'],
}));
const scraping = require('../../src/servicios/servicio-scraping');
const fuentes = require('../../src/servicios/servicio-resultados-fuente');
const modelo = require('../../src/modelos/oferta');
const { clienteApify } = require('../../src/config/apify');
const ingles = 'We are looking for a software engineer to join our team. You will work with the development team and you must have experience with the following technologies. We offer a great opportunity for your career.';
const espanol = 'Buscamos una persona para desarrollar aplicaciones y realizar pruebas de software. La persona debe tener conocimientos en desarrollo y trabajar con nuestro equipo. Ofrecemos una oportunidad para aprender y crecer en la empresa.';
const fetchOriginal = global.fetch;
const tokenOriginal = process.env.APIFY_TOKEN;
beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.APIFY_TOKEN = 'token-sintetico';
    modelo.crearOferta.mockResolvedValue({ resultado_persistencia: 'insertada' });
});
afterEach(() => {
    global.fetch = fetchOriginal;
    if (tokenOriginal === undefined) delete process.env.APIFY_TOKEN;
    else process.env.APIFY_TOKEN = tokenOriginal;
});
test.each([[ingles, 0, 'sin_resultados'], [espanol, 1, 'completada']])('Remotive real decide estado por elegibles: %s', async (descripcion, cantidad, estado) => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ jobs: [{
        id: 1, url: 'https://remotive.com/remote-jobs/software-dev/test-1', title: 'Software engineer',
        description: descripcion, company_name: 'Synthetic', publication_date: new Date().toISOString(),
        candidate_required_location: 'Worldwide',
    }] }) });
    const resultado = await scraping.ejecutarScrapingRemotive({ terminos: ['qa'] });
    expect(resultado).toHaveLength(cantidad);
    expect(resultado.metricas).toMatchObject({ estado, totalCrudos: 1, totalElegibles: cantidad, errores: [] });
    expect(resultado.resultadosConsultas).toEqual([expect.objectContaining({ totalCrudos: 1, totalElegibles: cantidad, estado })]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(modelo.crearOferta).not.toHaveBeenCalled();
});
test('Remotive atribuye sólo elegibles finales, sin duplicar idioma, antigüedad ni URLs', async () => {
    const cruda = (id, descripcion = espanol, fecha = new Date().toISOString()) => ({
        id, url: `https://remotive.com/remote-jobs/software-dev/test-${id}`, title: 'Software engineer',
        description: descripcion, company_name: 'Synthetic', publication_date: fecha,
        candidate_required_location: 'Worldwide',
    });
    const vigente = cruda(1);
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [
        cruda(2, espanol, new Date(Date.now() - 40 * 86400000).toISOString()), cruda(3, ingles), vigente, vigente,
    ] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [vigente] }) });
    const resultado = await scraping.ejecutarScrapingRemotive({ terminos: ['qa', 'soporte it'] });
    expect(resultado).toHaveLength(1);
    expect(resultado.metricas).toMatchObject({ estado: 'completada', totalCrudos: 5, totalElegibles: 1,
        antiguasDescartadas: 1, idiomaDescartadas: 1, duplicadasDescartadas: 2, errores: [] });
    expect(resultado.resultadosConsultas).toEqual([
        expect.objectContaining({ consulta: 'qa', totalCrudos: 4, totalElegibles: 1, estado: 'completada' }),
        expect.objectContaining({ consulta: 'customer-service', totalCrudos: 1, totalElegibles: 0, estado: 'sin_resultados' }),
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(modelo.crearOferta).not.toHaveBeenCalled();
});
test.each([
    ['SUCCEEDED', ingles, 'sin_resultados', 0], ['SUCCEEDED', espanol, 'completada', 1],
    ['FAILED', ingles, 'parcial', 0], ['TIMED-OUT', ingles, 'parcial', 0],
])('LinkedIn real filtra idioma sin borrar prioridad %s: %s', async (status, descripcion, estado, elegibles) => {
    clienteApify.actor.mockReturnValue({ call: jest.fn().mockResolvedValue({ status, id: 'run', defaultDatasetId: 'dataset' }) });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn().mockResolvedValue({ items: [{
        jobTitle: 'Software engineer', jobDescription: descripcion,
        jobUrl: 'https://linkedin.com/jobs/view/1234567890', companyName: 'Synthetic',
    }] }) });
    const resultado = await fuentes.ejecutarFuente('linkedin', scraping.ejecutarScrapingLinkedin, { terminos: ['qa'] });
    expect(resultado).toMatchObject({ idiomaDescartadas: 1 - elegibles, estado, totalElegibles: elegibles, nuevas: elegibles, actualizadas: 0, reapariciones: 0, duplicadas: 0 });
    expect(modelo.crearOferta).toHaveBeenCalledTimes(elegibles);
    expect(clienteApify.actor).toHaveBeenCalledTimes(1);
    expect(resultado.resultadosConsultas[0]).toMatchObject({ totalCrudos: null, totalElegibles: null });
    expect(resultado.errores).toHaveLength(status === 'SUCCEEDED' ? 0 : 1);
});
test('conservo consulta desconocida al sanitizar el historial real de LinkedIn sin elegibles', async () => {
    clienteApify.actor.mockReturnValue({ call: jest.fn().mockResolvedValue({ status: 'SUCCEEDED', id: 'run', defaultDatasetId: 'dataset' }) });
    clienteApify.dataset.mockReturnValue({ listItems: jest.fn().mockResolvedValue({ items: [{
        jobTitle: 'Software engineer', jobDescription: ingles,
        jobUrl: 'https://linkedin.com/jobs/view/1234567890', companyName: 'Synthetic',
    }] }) });
    const fuente = await fuentes.ejecutarFuente('linkedin', scraping.ejecutarScrapingLinkedin, { terminos: ['qa'] });
    expect(fuente).toMatchObject({ estado: 'sin_resultados', totalElegibles: 0, nuevas: 0 });
    expect(fuente.resultadosConsultas[0]).toMatchObject({ estado: null, totalElegibles: null, errores: [] });
    expect(modelo.crearOferta).not.toHaveBeenCalled();
    const real = jest.requireActual('../../src/modelos/ejecucion-busqueda');
    const resumen = real.sanitizarResumen({ estado: fuente.estado, fuentes: [fuente] });
    expect(resumen.fuentes[0].resultadosConsultas[0]).toMatchObject({ estado: null, totalElegibles: null, errores: [] });
});
