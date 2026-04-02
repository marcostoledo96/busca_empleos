// Tests del controlador de evaluación — verifico que el endpoint inicia
// la evaluación en segundo plano y que los endpoints de progreso y cancelación
// funcionan correctamente.
//
// El controlador ahora es fire-and-forget: POST /ejecutar responde de inmediato
// y el cliente hace polling a GET /progreso para conocer el avance.
//
// Mockeo el servicio de evaluación (no quiero llamar a DeepSeek en tests).

jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');

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

    // === POST /api/evaluacion/cancelar ===

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
});
