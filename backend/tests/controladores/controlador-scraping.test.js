// Tests del controlador de scraping — verifico que los endpoints ejecutan
// el scraping, guardan las ofertas en BD, y retornan el resumen correcto.
//
// Mockeo el servicio de scraping (no quiero llamar a Apify, es pago)
// y el modelo de ofertas (no quiero tocar la BD en tests de controlador).

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

describe('Controlador de scraping', () => {
    afterEach(() => jest.clearAllMocks());

    // === POST /api/scraping/linkedin ===

    describe('POST /api/scraping/linkedin', () => {
        test('ejecuta el scraping, guarda ofertas, y retorna resumen', async () => {
            // El servicio "extrae" 2 ofertas.
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev React', url: 'https://linkedin.com/job/1' },
                { titulo: 'QA Tester', url: 'https://linkedin.com/job/2' },
            ]);

            // La primera se guarda, la segunda es duplicada (retorna null).
            modeloOferta.crearOferta
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/scraping/linkedin')
                .send({ maxResultados: 10 });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.plataforma).toBe('linkedin');
            expect(res.body.datos.total_extraidas).toBe(2);
            expect(res.body.datos.ofertas_nuevas).toBe(1);
            expect(res.body.datos.ofertas_duplicadas).toBe(1);
            expect(res.body.datos.mensaje).toContain('LinkedIn');
        });

        test('pasa las opciones correctas al servicio de scraping', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/linkedin')
                .send({
                    maxResultados: 50,
                    terminos: ['react junior'],
                    ubicacion: 'Buenos Aires',
                });

            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledWith({
                maxResultados: 50,
                terminos: ['react junior'],
                ubicacion: 'Buenos Aires',
            });
        });

        test('retorna éxito aunque no haya resultados', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/scraping/linkedin')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.datos.total_extraidas).toBe(0);
            expect(res.body.datos.ofertas_nuevas).toBe(0);
            expect(res.body.datos.ofertas_duplicadas).toBe(0);
        });

        test('usa maxResultados=100 por defecto si no se envía', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/linkedin')
                .send({});

            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledWith(
                expect.objectContaining({ maxResultados: 100 })
            );
        });
    });

    // === POST /api/scraping/computrabajo ===

    describe('POST /api/scraping/computrabajo', () => {
        test('ejecuta el scraping, guarda ofertas, y retorna resumen', async () => {
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([
                { titulo: 'Dev Frontend', url: 'https://computrabajo.com/1' },
            ]);
            modeloOferta.crearOferta.mockResolvedValueOnce({ id: 1 });

            const res = await request(app)
                .post('/api/scraping/computrabajo')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.plataforma).toBe('computrabajo');
            expect(res.body.datos.total_extraidas).toBe(1);
            expect(res.body.datos.ofertas_nuevas).toBe(1);
            expect(res.body.datos.mensaje).toContain('Computrabajo');
        });

        test('usa maxResultados=50 por defecto para Computrabajo', async () => {
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/computrabajo')
                .send({});

            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledWith(
                expect.objectContaining({ maxResultados: 50 })
            );
        });
    });

    // === POST /api/scraping/indeed ===

    describe('POST /api/scraping/indeed', () => {
        test('ejecuta el scraping, guarda ofertas, y retorna resumen', async () => {
            servicioScraping.ejecutarScrapingIndeed.mockResolvedValue([
                { titulo: 'Dev React', url: 'https://ar.indeed.com/viewjob?jk=abc' },
            ]);
            modeloOferta.crearOferta.mockResolvedValueOnce({ id: 1 });

            const res = await request(app)
                .post('/api/scraping/indeed')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.plataforma).toBe('indeed');
            expect(res.body.datos.total_extraidas).toBe(1);
            expect(res.body.datos.ofertas_nuevas).toBe(1);
            expect(res.body.datos.mensaje).toContain('Indeed');
        });

        test('usa maxResultados=100 por defecto para Indeed', async () => {
            servicioScraping.ejecutarScrapingIndeed.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/indeed')
                .send({});

            expect(servicioScraping.ejecutarScrapingIndeed).toHaveBeenCalledWith(
                expect.objectContaining({ maxResultados: 100 })
            );
        });
    });

    // === POST /api/scraping/bumeran ===

    describe('POST /api/scraping/bumeran', () => {
        test('ejecuta el scraping, guarda ofertas, y retorna resumen', async () => {
            servicioScraping.ejecutarScrapingBumeran.mockResolvedValue([
                { titulo: 'Dev Full-stack', url: 'https://www.bumeran.com.ar/empleos/dev-123.html' },
            ]);
            modeloOferta.crearOferta.mockResolvedValueOnce({ id: 1 });

            const res = await request(app)
                .post('/api/scraping/bumeran')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.plataforma).toBe('bumeran');
            expect(res.body.datos.total_extraidas).toBe(1);
            expect(res.body.datos.ofertas_nuevas).toBe(1);
            expect(res.body.datos.mensaje).toContain('Bumeran');
        });

        test('pasa las opciones correctas al servicio', async () => {
            servicioScraping.ejecutarScrapingBumeran.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/bumeran')
                .send({ terminos: ['react junior'] });

            expect(servicioScraping.ejecutarScrapingBumeran).toHaveBeenCalledWith({
                terminos: ['react junior'],
            });
        });

        test('informa correctamente cuando todas las ofertas son duplicadas', async () => {
            // Escenario real: Bumeran encontró 2 ofertas pero las dos ya estaban en BD.
            // crearOferta retorna null para las dos (ON CONFLICT DO NOTHING).
            servicioScraping.ejecutarScrapingBumeran.mockResolvedValue([
                { titulo: 'Dev 1', url: 'https://www.bumeran.com.ar/empleos/dev-1-123.html' },
                { titulo: 'Dev 2', url: 'https://www.bumeran.com.ar/empleos/dev-2-456.html' },
            ]);
            modeloOferta.crearOferta
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/scraping/bumeran')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.ofertas_nuevas).toBe(0);
            expect(res.body.datos.ofertas_duplicadas).toBe(2);
            expect(res.body.datos.total_extraidas).toBe(2);
        });
    });

    // === POST /api/scraping/glassdoor ===

    describe('POST /api/scraping/glassdoor', () => {
        test('ejecuta el scraping, guarda ofertas, y retorna resumen', async () => {
            servicioScraping.ejecutarScrapingGlassdoor.mockResolvedValue([
                { titulo: 'Frontend Developer', url: 'https://www.glassdoor.com.ar/job-listing/test.htm?jl=1' },
                { titulo: 'QA Engineer', url: 'https://www.glassdoor.com.ar/job-listing/test.htm?jl=2' },
            ]);
            modeloOferta.crearOferta
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/scraping/glassdoor')
                .send({ maxResultados: 30 });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.plataforma).toBe('glassdoor');
            expect(res.body.datos.total_extraidas).toBe(2);
            expect(res.body.datos.ofertas_nuevas).toBe(1);
            expect(res.body.datos.ofertas_duplicadas).toBe(1);
            expect(res.body.datos.mensaje).toContain('Glassdoor');
        });

        test('pasa maxResultados y terminos al servicio', async () => {
            servicioScraping.ejecutarScrapingGlassdoor.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/glassdoor')
                .send({ maxResultados: 25, terminos: ['qa tester junior'] });

            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledWith({
                maxResultados: 25,
                terminos: ['qa tester junior'],
            });
        });

        test('usa maxResultados=50 por defecto si no se envía', async () => {
            servicioScraping.ejecutarScrapingGlassdoor.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/glassdoor')
                .send({});

            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledWith({
                maxResultados: 50,
                terminos: undefined,
            });
        });
    });

    // === POST /api/scraping/getonbrd ===

    describe('POST /api/scraping/getonbrd', () => {
        test('ejecuta el scraping, guarda ofertas, y retorna resumen', async () => {
            servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([
                { titulo: 'Frontend Developer Junior', url: 'https://www.getonbrd.com/jobs/programming/frontend-1' },
                { titulo: 'QA Tester', url: 'https://www.getonbrd.com/jobs/programming/qa-2' },
            ]);
            modeloOferta.crearOferta
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/scraping/getonbrd')
                .send({ maxResultados: 30 });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.plataforma).toBe('getonbrd');
            expect(res.body.datos.total_extraidas).toBe(2);
            expect(res.body.datos.ofertas_nuevas).toBe(1);
            expect(res.body.datos.ofertas_duplicadas).toBe(1);
            expect(res.body.datos.mensaje).toContain('GetOnBrd');
        });

        test('pasa maxResultados y terminos al servicio', async () => {
            servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/getonbrd')
                .send({ maxResultados: 20, terminos: ['react junior'] });

            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledWith({
                maxResultados: 20,
                terminos: ['react junior'],
            });
        });

        test('usa maxResultados=50 por defecto si no se envía', async () => {
            servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([]);

            await request(app)
                .post('/api/scraping/getonbrd')
                .send({});

            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledWith({
                maxResultados: 50,
                terminos: undefined,
            });
        });

        test('retorna éxito aunque no haya resultados', async () => {
            servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/scraping/getonbrd')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.datos.total_extraidas).toBe(0);
            expect(res.body.datos.ofertas_nuevas).toBe(0);
        });
    });
});
