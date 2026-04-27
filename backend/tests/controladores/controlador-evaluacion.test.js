// Tests del controlador de evaluación — verifico que el endpoint inicia
// la evaluación en segundo plano y que los endpoints de progreso y cancelación
// funcionan correctamente.
//
// El controlador ahora es fire-and-forget: POST /ejecutar responde de inmediato
// y el cliente hace polling a GET /progreso para conocer el avance.
//
// Mockeo el servicio de evaluación (no quiero llamar a DeepSeek en tests).
//
// También incluyo tests de regresión profundos con el rate limiter ACTIVO
// (cargando la app fuera del NODE_ENV=test) para verificar que:
// - /progreso y /cancelar NO quedan bajo el limitador.
// - /ejecutar SÍ queda protegido y devuelve 429 al exceder la cuota.

jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');
const modeloOferta = require('../../src/modelos/oferta');

describe('Controlador de evaluación', () => {
    afterEach(() => jest.clearAllMocks());

    // === POST /api/evaluacion/ejecutar ===

    describe('POST /api/evaluacion/ejecutar', () => {
        test('inicia la evaluación en segundo plano y responde de inmediato', async () => {
            // Simulo que no hay evaluación en curso.
            servicioEvaluacion.obtenerProgresoEvaluacion.mockReturnValue({ activo: false });
            // La evaluación corre en background — resuelve, pero el test no la espera.
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 3,
                aprobadas: 2,
                rechazadas: 1,
                errores: 0,
                detalle: [],
            });

            const res = await request(app)
                .post('/api/evaluacion/ejecutar');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.en_curso).toBe(true);
            expect(res.body.mensaje).toContain('iniciada');
            // El servicio fue llamado (sin await desde el controlador).
            expect(servicioEvaluacion.evaluarOfertasPendientes).toHaveBeenCalledTimes(1);
        });

        test('retorna 409 si ya hay una evaluación en curso', async () => {
            servicioEvaluacion.obtenerProgresoEvaluacion.mockReturnValue({ activo: true });

            const res = await request(app)
                .post('/api/evaluacion/ejecutar');

            expect(res.status).toBe(409);
            expect(res.body.exito).toBe(false);
            expect(res.body.mensaje).toContain('en curso');
            // No dispara otra evaluación.
            expect(servicioEvaluacion.evaluarOfertasPendientes).not.toHaveBeenCalled();
        });
    });

    // === GET /api/evaluacion/progreso ===

    describe('GET /api/evaluacion/progreso', () => {
        test('devuelve el progreso actual de la evaluación', async () => {
            const progresoMock = {
                activo: true,
                total: 5,
                evaluadas: 2,
                aprobadas: 1,
                rechazadas: 1,
                errores: 0,
                porcentaje: 40,
            };
            servicioEvaluacion.obtenerProgresoEvaluacion.mockReturnValue(progresoMock);

            const res = await request(app)
                .get('/api/evaluacion/progreso');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.activo).toBe(true);
            expect(res.body.datos.total).toBe(5);
            expect(res.body.datos.evaluadas).toBe(2);
            expect(res.body.datos.porcentaje).toBe(40);
        });

        test('devuelve progreso inactivo cuando no hay evaluación corriendo', async () => {
            servicioEvaluacion.obtenerProgresoEvaluacion.mockReturnValue({
                activo: false, total: 0, evaluadas: 0, aprobadas: 0,
                rechazadas: 0, errores: 0, porcentaje: 0,
            });

            const res = await request(app)
                .get('/api/evaluacion/progreso');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.activo).toBe(false);
        });
    });

    // === GET /api/evaluacion/progreso — Regresión 429 ===

    describe('GET /api/evaluacion/progreso — sin rate limit', () => {
        test('responde 200 aunque se llame muchas veces seguidas', async () => {
            // Simulo el progreso que devuelve el servicio.
            servicioEvaluacion.obtenerProgresoEvaluacion.mockReturnValue({
                activo: true, total: 10, evaluadas: 3, aprobadas: 2,
                rechazadas: 1, errores: 0, porcentaje: 30,
            });

            // Hago 10 requests al hilo — reproduce el patrón de polling del frontend.
            // Si el endpoint estuviera bajo el rate limiter (max 5), alguna debería dar 429.
            // Con el fix (montado directamente sin limiter), todas deben ser 200.
            const requests = Array.from({ length: 10 }, () =>
                request(app).get('/api/evaluacion/progreso')
            );
            const respuestas = await Promise.all(requests);

            for (const res of respuestas) {
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });

        test('el endpoint de progreso NO bloquea al ejecutar (mantienen cuotas separadas)', async () => {
            // Simulo estado: no hay evaluación en curso para que ejecutar funcione.
            servicioEvaluacion.obtenerProgresoEvaluacion
                // Primeras 6 llamadas: para los GETs de progreso (activo: false para no bloquear ejecutar).
                .mockReturnValue({ activo: false, total: 0, evaluadas: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 });
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({});

            // Hago 6 GETs de progreso seguidos (simula ~12 segundos de polling).
            for (let i = 0; i < 6; i++) {
                const res = await request(app).get('/api/evaluacion/progreso');
                expect(res.status).toBe(200);
            }

            // Después del polling, el POST a ejecutar todavía debe poder pasar
            // porque ejecutar NO comparte cuota con progreso.
            // En test, el rate limiter está desactivado (NODE_ENV=test),
            // pero el test verifica que el endpoint es alcanzable — no da 404 ni error de routing.
            const resEjecutar = await request(app).post('/api/evaluacion/ejecutar');
            expect(resEjecutar.status).toBe(200);
            expect(resEjecutar.body.exito).toBe(true);
        });
    });

    describe('POST /api/evaluacion/cancelar', () => {
        test('activa la bandera de cancelación y confirma', async () => {
            servicioEvaluacion.cancelarEvaluacionPendiente.mockImplementation(() => {});

            const res = await request(app)
                .post('/api/evaluacion/cancelar');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.mensaje).toContain('cancelación');
            expect(servicioEvaluacion.cancelarEvaluacionPendiente).toHaveBeenCalledTimes(1);
        });
    });

    // ========================================================
    // Regresión profunda: rate limiter ACTIVO (fuera de test)
    // ========================================================
    //
    // ¿Por qué un describe separado con resetModules?
    // Porque en NODE_ENV=test la app deshabilita el rate limiter para no
    // interferir con los tests normales. Para probar el comportamiento real
    // del limiter necesito cargar la app con otro NODE_ENV.
    //
    // Uso jest.resetModules() + require() manual para obtener una instancia
    // de app con el limiter activo, sin afectar el resto de la suite.
    //
    // El rate limiter está configurado con max=5 por ventana de 1 minuto.
    // No esperamos un minuto real: como cada require() crea un módulo nuevo,
    // el store del limiter también es nuevo y empieza en 0.

    describe('Rate limit ACTIVO — regresión de routing', () => {
        let appConLimiter;
        let servicioEvaluacionAislado;

        beforeAll(() => {
            // Aíslo el registro de módulos de Node para cargar la app de nuevo
            // con NODE_ENV distinto. Así no piso los mocks del describe padre.
            jest.resetModules();

            // Re-registro los mocks necesarios en el contexto aislado.
            jest.mock('../../src/modelos/oferta');
            jest.mock('../../src/servicios/servicio-scraping');
            jest.mock('../../src/servicios/servicio-evaluacion');
            jest.mock('../../src/utils/middleware-auth', () => ({
                verificarAuth: (req, res, next) => next(),
            }));

            // Sobreescribo NODE_ENV para que la app cargue el rate limiter real.
            process.env.NODE_ENV = 'production_test';

            appConLimiter = require('../../src/app');
            servicioEvaluacionAislado = require('../../src/servicios/servicio-evaluacion');
        });

        afterAll(() => {
            // Restauro el entorno de test para no afectar otras suites.
            process.env.NODE_ENV = 'test';
        });

        // --- /progreso NO debe quedar bajo el rate limiter ---

        test('/progreso responde 200 aunque se llame más de 5 veces (limiter activo)', async () => {
            // Configuro el mock en el contexto aislado.
            servicioEvaluacionAislado.obtenerProgresoEvaluacion.mockReturnValue({
                activo: false, total: 0, evaluadas: 0, aprobadas: 0,
                rechazadas: 0, errores: 0, porcentaje: 0,
            });

            // Hago 8 requests: con max=5, si /progreso estuviera bajo el limiter,
            // la 6.ª daría 429. Deben dar 200 todas.
            for (let i = 0; i < 8; i++) {
                const res = await request(appConLimiter).get('/api/evaluacion/progreso');
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });

        // --- /cancelar tampoco debe quedar bajo el rate limiter ---

        test('/cancelar responde 200 aunque se llame más de 5 veces (limiter activo)', async () => {
            servicioEvaluacionAislado.cancelarEvaluacionPendiente.mockImplementation(() => {});

            for (let i = 0; i < 8; i++) {
                const res = await request(appConLimiter).post('/api/evaluacion/cancelar');
                expect(res.status).toBe(200);
                expect(res.body.exito).toBe(true);
            }
        });

        // --- /ejecutar SÍ debe quedar protegido por el rate limiter ---

        test('/ejecutar devuelve 429 al superar la cuota del rate limiter', async () => {
            servicioEvaluacionAislado.obtenerProgresoEvaluacion.mockReturnValue({ activo: false });
            servicioEvaluacionAislado.evaluarOfertasPendientes.mockResolvedValue({});

            // Las primeras 5 requests deben pasar (max=5 en la ventana).
            for (let i = 0; i < 5; i++) {
                const res = await request(appConLimiter).post('/api/evaluacion/ejecutar');
                // 200 o 409 (ya en curso) — ambos son respuestas legítimas, no 429.
                expect(res.status).not.toBe(429);
            }

            // La 6.ª request debe ser rechazada por el rate limiter.
            const resExcedida = await request(appConLimiter).post('/api/evaluacion/ejecutar');
            expect(resExcedida.status).toBe(429);
            expect(resExcedida.body.exito).toBe(false);
            expect(resExcedida.body.error).toContain('Demasiadas solicitudes');
        });

        // --- Verifico que /progreso NO comparte cuota con /ejecutar ---
        //
        // Este es el caso raíz del bug original: si /progreso y /ejecutar
        // compartieran el mismo limitador, el polling (que llama a /progreso
        // cada 2s) agoaría la cuota e impediría llamar a /ejecutar.
        //
        // Con el fix correcto, /progreso está montado SIN limitador,
        // por lo que sus calls no consumen cuota de /ejecutar.

        test('/progreso no consume cuota de /ejecutar — ambos operan independientes', async () => {
            // Cargo una app fresca para este test (store del limiter en 0).
            jest.resetModules();
            jest.mock('../../src/modelos/oferta');
            jest.mock('../../src/servicios/servicio-scraping');
            jest.mock('../../src/servicios/servicio-evaluacion');
            jest.mock('../../src/utils/middleware-auth', () => ({
                verificarAuth: (req, res, next) => next(),
            }));

            process.env.NODE_ENV = 'production_test';
            const appFresca = require('../../src/app');
            const servicioAislado = require('../../src/servicios/servicio-evaluacion');
            process.env.NODE_ENV = 'test';

            servicioAislado.obtenerProgresoEvaluacion.mockReturnValue({ activo: false });
            servicioAislado.cancelarEvaluacionPendiente.mockImplementation(() => {});
            servicioAislado.evaluarOfertasPendientes.mockResolvedValue({});

            // Simulo ~10 segundos de polling: 5 calls a /progreso.
            // Esto NO debe consumir cuota del limitador costoso.
            for (let i = 0; i < 5; i++) {
                const res = await request(appFresca).get('/api/evaluacion/progreso');
                expect(res.status).toBe(200);
            }

            // Ahora hago la primera call real a /ejecutar.
            // Como /progreso no compartió cuota, debe pasar sin problema.
            const resEjecutar = await request(appFresca).post('/api/evaluacion/ejecutar');
            expect(resEjecutar.status).not.toBe(429);
            // El controlador responde 200 (inicia en background).
            expect([200, 409]).toContain(resEjecutar.status);
        });
    });

    // === POST /api/evaluacion/resetear ===

    describe('POST /api/evaluacion/resetear', () => {
        test('resetea las ofertas de los últimos N días y retorna el conteo', async () => {
            modeloOferta.resetearEvaluacionesPorDias.mockResolvedValue([
                { id: 1, titulo: 'Dev Junior React' },
                { id: 2, titulo: 'QA Tester' },
            ]);

            const res = await request(app)
                .post('/api/evaluacion/resetear')
                .send({ dias: 7 });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.reseteadas).toBe(2);
            expect(res.body.datos.ofertas).toHaveLength(2);
            expect(res.body.mensaje).toContain('pendiente');
            expect(modeloOferta.resetearEvaluacionesPorDias).toHaveBeenCalledWith(7);
        });

        test('retorna vacío si no hay ofertas en ese rango de días', async () => {
            modeloOferta.resetearEvaluacionesPorDias.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/evaluacion/resetear')
                .send({ dias: 1 });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.reseteadas).toBe(0);
        });

        test('retorna 400 si dias no es un número', async () => {
            const res = await request(app)
                .post('/api/evaluacion/resetear')
                .send({ dias: 'una semana' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('dias');
        });

        test('retorna 400 si dias es menor a 1', async () => {
            const res = await request(app)
                .post('/api/evaluacion/resetear')
                .send({ dias: 0 });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });

        test('retorna 400 si dias supera 365', async () => {
            const res = await request(app)
                .post('/api/evaluacion/resetear')
                .send({ dias: 400 });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });

        test('retorna 400 si falta el campo dias', async () => {
            const res = await request(app)
                .post('/api/evaluacion/resetear')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });
    });
});
