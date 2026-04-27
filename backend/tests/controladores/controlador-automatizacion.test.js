// Tests del controlador de automatización — verifico endpoints HTTP con supertest.
//
// Mockeo el servicio de automatización completo para que los tests
// no toquen Apify, DeepSeek ni la BD. Solo testeo que:
// - Los endpoints responden con el status code correcto.
// - El body tiene la estructura esperada.
// - Se llama a las funciones del servicio con los parámetros correctos.
//
// También incluyo tests de regresión profundos con el rate limiter ACTIVO
// para verificar que /progreso y /estado NO dan 429 aunque se llamen muchas veces,
// y que /iniciar y /ejecutar SÍ quedan protegidos.

jest.mock('../../src/servicios/servicio-automatizacion');
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const servicioAutomatizacion = require('../../src/servicios/servicio-automatizacion');

describe('Controlador de automatización', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/automatizacion/estado', () => {
        test('retorna el estado actual del cron', async () => {
            servicioAutomatizacion.obtenerEstado.mockReturnValue({
                activo: false,
                expresionCron: null,
                ultimaEjecucion: null,
                ultimoResultado: null,
            });

            const respuesta = await request(app)
                .get('/api/automatizacion/estado')
                .expect(200);

            expect(respuesta.body.exito).toBe(true);
            expect(respuesta.body.datos).toEqual({
                activo: false,
                expresionCron: null,
                ultimaEjecucion: null,
                ultimoResultado: null,
            });
            expect(servicioAutomatizacion.obtenerEstado).toHaveBeenCalledTimes(1);
        });

        test('retorna estado activo cuando el cron está corriendo', async () => {
            servicioAutomatizacion.obtenerEstado.mockReturnValue({
                activo: true,
                expresionCron: '0 */12 * * *',
                ultimaEjecucion: '2026-03-31T12:00:00.000Z',
                ultimoResultado: { exito: true },
            });

            const respuesta = await request(app)
                .get('/api/automatizacion/estado')
                .expect(200);

            expect(respuesta.body.datos.activo).toBe(true);
            expect(respuesta.body.datos.expresionCron).toBe('0 */12 * * *');
        });
    });

    describe('POST /api/automatizacion/iniciar', () => {
        test('inicia el cron con la expresión por defecto', async () => {
            servicioAutomatizacion.programarCron.mockReturnValue({ detener: jest.fn() });
            servicioAutomatizacion.obtenerEstado.mockReturnValue({
                activo: true,
                expresionCron: '0 */12 * * *',
                ultimaEjecucion: null,
                ultimoResultado: null,
            });

            const respuesta = await request(app)
                .post('/api/automatizacion/iniciar')
                .expect(200);

            expect(respuesta.body.exito).toBe(true);
            expect(respuesta.body.mensaje).toContain('Cron programado');
            expect(servicioAutomatizacion.programarCron).toHaveBeenCalledWith({
                expresionCron: undefined,
            });
        });

        test('acepta una expresión cron personalizada', async () => {
            servicioAutomatizacion.programarCron.mockReturnValue({ detener: jest.fn() });
            servicioAutomatizacion.obtenerEstado.mockReturnValue({
                activo: true,
                expresionCron: '0 8 * * *',
                ultimaEjecucion: null,
                ultimoResultado: null,
            });

            const respuesta = await request(app)
                .post('/api/automatizacion/iniciar')
                .send({ expresionCron: '0 8 * * *' })
                .expect(200);

            expect(servicioAutomatizacion.programarCron).toHaveBeenCalledWith({
                expresionCron: '0 8 * * *',
            });
        });

        test('retorna 400 si la expresión cron es inválida', async () => {
            servicioAutomatizacion.programarCron.mockImplementation(() => {
                throw new Error('Expresión cron inválida: "basura"');
            });

            const respuesta = await request(app)
                .post('/api/automatizacion/iniciar')
                .send({ expresionCron: 'basura' })
                .expect(400);

            expect(respuesta.body.exito).toBe(false);
            expect(respuesta.body.error).toContain('inválida');
        });
    });

    describe('POST /api/automatizacion/detener', () => {
        test('detiene el cron activo', async () => {
            // Primera llamada: verificar que está activo.
            // Segunda llamada: retornar estado después de detener.
            servicioAutomatizacion.obtenerEstado
                .mockReturnValueOnce({ activo: true, expresionCron: '0 */12 * * *' })
                .mockReturnValueOnce({ activo: false, expresionCron: null });
            servicioAutomatizacion.detenerCron.mockReturnValue(undefined);

            const respuesta = await request(app)
                .post('/api/automatizacion/detener')
                .expect(200);

            expect(respuesta.body.exito).toBe(true);
            expect(respuesta.body.mensaje).toContain('detenido');
            expect(servicioAutomatizacion.detenerCron).toHaveBeenCalledTimes(1);
        });

        test('retorna 400 si no hay cron activo', async () => {
            servicioAutomatizacion.obtenerEstado.mockReturnValue({
                activo: false,
                expresionCron: null,
            });

            const respuesta = await request(app)
                .post('/api/automatizacion/detener')
                .expect(400);

            expect(respuesta.body.exito).toBe(false);
            expect(respuesta.body.error).toContain('No hay ningún cron activo');
        });
    });

    describe('GET /api/automatizacion/progreso', () => {
        test('retorna el progreso actual del ciclo', async () => {
            servicioAutomatizacion.obtenerProgreso.mockReturnValue({
                activo: true,
                porcentaje: 50,
                pasoActual: 'Evaluando ofertas',
                pasos: [],
            });

            const respuesta = await request(app)
                .get('/api/automatizacion/progreso')
                .expect(200);

            expect(respuesta.body.exito).toBe(true);
            expect(respuesta.body.datos.activo).toBe(true);
            expect(respuesta.body.datos.porcentaje).toBe(50);
            expect(servicioAutomatizacion.obtenerProgreso).toHaveBeenCalledTimes(1);
        });

        test('retorna progreso inactivo cuando no hay ciclo corriendo', async () => {
            servicioAutomatizacion.obtenerProgreso.mockReturnValue({
                activo: false,
                porcentaje: 0,
                pasoActual: null,
                pasos: [],
            });

            const respuesta = await request(app)
                .get('/api/automatizacion/progreso')
                .expect(200);

            expect(respuesta.body.datos.activo).toBe(false);
        });
    });

    // === Regresión 429 — endpoints de polling sin rate limit ===

    describe('GET /api/automatizacion/progreso y /estado — sin rate limit', () => {
        test('responde 200 en /progreso aunque se llame muchas veces seguidas', async () => {
            servicioAutomatizacion.obtenerProgreso.mockReturnValue({
                activo: true, porcentaje: 25, pasoActual: 'Scrapeando', pasos: [],
            });

            // 10 requests consecutivas — reproduce el patrón de polling del frontend.
            // Con el fix (montado sin limiter), todas deben ser 200.
            const requests = Array.from({ length: 10 }, () =>
                request(app).get('/api/automatizacion/progreso')
            );
            const respuestas = await Promise.all(requests);

            for (const res of respuestas) {
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });

        test('responde 200 en /estado aunque se llame muchas veces seguidas', async () => {
            servicioAutomatizacion.obtenerEstado.mockReturnValue({
                activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null,
            });

            const requests = Array.from({ length: 10 }, () =>
                request(app).get('/api/automatizacion/estado')
            );
            const respuestas = await Promise.all(requests);

            for (const res of respuestas) {
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });
    });

    describe('POST /api/automatizacion/ejecutar', () => {
        test('ejecuta un ciclo completo manualmente', async () => {
            servicioAutomatizacion.ejecutarCicloCompleto.mockResolvedValue({
                exito: true,
                scraping: { linkedin: 5, computrabajo: 3, totalExtraidas: 8, guardadas: 6 },
                evaluacion: { total: 6, aprobadas: 4, rechazadas: 2, errores: 0 },
                errores: [],
            });

            const respuesta = await request(app)
                .post('/api/automatizacion/ejecutar')
                .expect(200);

            expect(respuesta.body.exito).toBe(true);
            expect(respuesta.body.datos.scraping.linkedin).toBe(5);
            expect(respuesta.body.datos.evaluacion.aprobadas).toBe(4);
            expect(servicioAutomatizacion.ejecutarCicloCompleto).toHaveBeenCalledTimes(1);
        });

        test('reporta errores parciales sin fallar', async () => {
            servicioAutomatizacion.ejecutarCicloCompleto.mockResolvedValue({
                exito: true,
                scraping: { linkedin: 0, computrabajo: 2, totalExtraidas: 2, guardadas: 2 },
                evaluacion: null,
                errores: ['Error en scraping de LinkedIn: timeout', 'Error en evaluación: API down'],
            });

            const respuesta = await request(app)
                .post('/api/automatizacion/ejecutar')
                .expect(200);

            expect(respuesta.body.datos.errores).toHaveLength(2);
            expect(respuesta.body.datos.evaluacion).toBeNull();
        });
    });

    // ========================================================
    // Regresión profunda: rate limiter ACTIVO (fuera de test)
    // ========================================================
    //
    // Igual que en el test de evaluación: cargamos la app con NODE_ENV distinto
    // para activar el rate limiter real (max=5 por minuto).
    // Verificamos que /progreso y /estado (endpoints de polling liviano) NO
    // quedan bajo el limitador, mientras que /iniciar y /ejecutar SÍ.

    describe('Rate limit ACTIVO — regresión de routing', () => {
        let appConLimiter;
        let servicioAuto;

        beforeAll(() => {
            jest.resetModules();

            jest.mock('../../src/servicios/servicio-automatizacion');
            jest.mock('../../src/utils/middleware-auth', () => ({
                verificarAuth: (req, res, next) => next(),
            }));

            process.env.NODE_ENV = 'production_test';
            appConLimiter = require('../../src/app');
            servicioAuto = require('../../src/servicios/servicio-automatizacion');
        });

        afterAll(() => {
            process.env.NODE_ENV = 'test';
        });

        // --- /progreso NO debe quedar bajo el rate limiter ---

        test('/progreso responde 200 aunque se llame más de 5 veces (limiter activo)', async () => {
            servicioAuto.obtenerProgreso.mockReturnValue({
                activo: false, porcentaje: 0, pasoActual: null, pasos: [],
            });

            for (let i = 0; i < 8; i++) {
                const res = await request(appConLimiter).get('/api/automatizacion/progreso');
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });

        // --- /estado NO debe quedar bajo el rate limiter ---

        test('/estado responde 200 aunque se llame más de 5 veces (limiter activo)', async () => {
            servicioAuto.obtenerEstado.mockReturnValue({
                activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null,
            });

            for (let i = 0; i < 8; i++) {
                const res = await request(appConLimiter).get('/api/automatizacion/estado');
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });

        // --- /iniciar SÍ debe quedar protegido por el rate limiter ---

        test('/iniciar devuelve 429 al superar la cuota del rate limiter', async () => {
            servicioAuto.programarCron.mockReturnValue({ detener: jest.fn() });
            servicioAuto.obtenerEstado.mockReturnValue({
                activo: true, expresionCron: '0 */12 * * *',
                ultimaEjecucion: null, ultimoResultado: null,
            });

            // Las primeras 5 requests deben pasar.
            for (let i = 0; i < 5; i++) {
                const res = await request(appConLimiter).post('/api/automatizacion/iniciar');
                expect(res.status).not.toBe(429);
            }

            // La 6.ª debe ser rechazada.
            const resExcedida = await request(appConLimiter).post('/api/automatizacion/iniciar');
            expect(resExcedida.status).toBe(429);
            expect(resExcedida.body.exito).toBe(false);
            expect(resExcedida.body.error).toContain('Demasiadas solicitudes');
        });

        // --- /progreso y /estado no comparten cuota con los endpoints costosos ---
        //
        // Reproduce el escenario real: el frontend pollea /progreso y /estado
        // mientras el usuario espera que el ciclo termine. Con el fix correcto,
        // esas calls de polling no deben quemar la cuota de /iniciar ni /ejecutar.

        test('/progreso y /estado no consumen cuota de /iniciar — operan independientes', async () => {
            // App fresca para que el store del limiter empiece en 0.
            jest.resetModules();
            jest.mock('../../src/servicios/servicio-automatizacion');
            jest.mock('../../src/utils/middleware-auth', () => ({
                verificarAuth: (req, res, next) => next(),
            }));

            process.env.NODE_ENV = 'production_test';
            const appFresca = require('../../src/app');
            const servicioFresco = require('../../src/servicios/servicio-automatizacion');
            process.env.NODE_ENV = 'test';

            servicioFresco.obtenerProgreso.mockReturnValue({
                activo: false, porcentaje: 0, pasoActual: null, pasos: [],
            });
            servicioFresco.obtenerEstado.mockReturnValue({
                activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null,
            });
            servicioFresco.programarCron.mockReturnValue({ detener: jest.fn() });

            // 5 calls a /progreso + 5 calls a /estado = 10 calls de polling.
            // Ninguna de ellas debe consumir cuota del limitador costoso.
            for (let i = 0; i < 5; i++) {
                const r1 = await request(appFresca).get('/api/automatizacion/progreso');
                expect(r1.status).toBe(200);
                const r2 = await request(appFresca).get('/api/automatizacion/estado');
                expect(r2.status).toBe(200);
            }

            // Después del polling, /iniciar debe poder ejecutarse sin dar 429.
            const resIniciar = await request(appFresca).post('/api/automatizacion/iniciar');
            expect(resIniciar.status).not.toBe(429);
            expect([200, 400]).toContain(resIniciar.status);
        });
    });
});
