// Tests de integración del endpoint POST /api/scraping/infojobs.
//
// InfoJobs está desactivado en el registry de plataformas (activa: false).
// El endpoint sigue existiendo para compatibilidad con el frontend, pero
// retorna una respuesta controlada sin invocar el scraper ni persistir ofertas.
// Simulo el historial de ejecución para que esta suite no requiera PostgreSQL.
//
// ¿Qué cubre esta suite?
// ------------------------------------------------------------------
//   a) Respuesta de plataforma inactiva: 0 resultados, sin llamar al servicio.
//   b) Respuesta incluye codigo_resultado 'PLATAFORMA_INACTIVA' y advertencia.
//   c) No se invoca crearOferta (no toca la BD).

jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/modelos/ejecucion-busqueda', () => ({
    iniciar: jest.fn(async () => ({ id: 1 })),
    finalizar: jest.fn(async () => {}),
    listar: jest.fn(),
}));
jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const servicioScraping = require('../../src/servicios/servicio-scraping');
const modeloOferta = require('../../src/modelos/oferta');
const historial = require('../../src/modelos/ejecucion-busqueda');
const pool = require('../../src/config/base-datos');

describe('Integración: POST /api/scraping/infojobs (inactiva en registry)', () => {

    afterEach(() => jest.clearAllMocks());

    // -----------------------------------------------------------------------
    // Caso a): InfoJobs desactivado → el endpoint retorna respuesta controlada
    // sin llamar al servicio de scraping ni a la base de datos.
    // -----------------------------------------------------------------------
    test('a) infojobs desactivado → retorna 200 con 0 resultados sin invocar servicio', async () => {
        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({ maxResultados: 50, terminos: ['frontend junior'] });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.datos.plataforma).toBe('infojobs');
        expect(res.body.datos.total_extraidas).toBe(0);
        expect(res.body.datos.ofertas_nuevas).toBe(0);
        expect(res.body.datos.ofertas_duplicadas).toBe(0);
        expect(res.body.datos.mensaje).toContain('desactivado');

        // El servicio de scraping NO fue invocado.
        expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();

        // Registro la consulta deshabilitada sin tocar PostgreSQL ni guardar ofertas.
        expect(modeloOferta.crearOferta).not.toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();
        expect(historial.iniciar).toHaveBeenCalledWith('individual');
        expect(historial.finalizar).toHaveBeenCalledTimes(1);
        expect(res.body.datos.fuente.estado).toBe('deshabilitada');
        expect(res.body.datos.historial).toEqual({ id: 1, guardado: true });
    });

    // -----------------------------------------------------------------------
    // Caso b): La respuesta incluye codigo_resultado y advertencia del registry.
    // -----------------------------------------------------------------------
    test('b) infojobs desactivado → incluye codigo_resultado PLATAFORMA_INACTIVA y advertencia', async () => {
        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.datos.codigo_resultado).toBe('PLATAFORMA_INACTIVA');
        expect(res.body.datos.advertencia).toBeDefined();
        expect(typeof res.body.datos.advertencia).toBe('string');
        expect(res.body.datos.advertencia.length).toBeGreaterThan(0);
    });

    // -----------------------------------------------------------------------
    // Caso c): Se ignora cualquier parámetro del body (maxResultados, terminos)
    // porque la plataforma está desactivada.
    // -----------------------------------------------------------------------
    test('c) infojobs desactivado → ignora maxResultados y terminos del body', async () => {
        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({ maxResultados: 999, terminos: ['react', 'angular'] });

        expect(res.status).toBe(200);
        expect(res.body.datos.total_extraidas).toBe(0);
        expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();
    });
});