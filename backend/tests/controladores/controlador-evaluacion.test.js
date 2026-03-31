// Tests del controlador de evaluación — verifico que el endpoint dispara
// la evaluación y retorna el resumen correctamente.
//
// Mockeo el servicio de evaluación (no quiero llamar a DeepSeek en tests).

jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');

const request = require('supertest');
const app = require('../../src/app');
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');

describe('Controlador de evaluación', () => {
    afterEach(() => jest.clearAllMocks());

    // === POST /api/evaluacion/ejecutar ===

    describe('POST /api/evaluacion/ejecutar', () => {
        test('ejecuta la evaluación y retorna el resumen completo', async () => {
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 3,
                aprobadas: 2,
                rechazadas: 1,
                errores: 0,
                detalle: [
                    { id: 1, titulo: 'Dev React', estado: 'aprobada', razon: 'Cumple perfil' },
                    { id: 2, titulo: 'Dev Angular', estado: 'aprobada', razon: 'Match' },
                    { id: 3, titulo: 'Dev Java', estado: 'rechazada', razon: 'Requiere Java' },
                ],
            });

            const res = await request(app)
                .post('/api/evaluacion/ejecutar');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.total).toBe(3);
            expect(res.body.datos.aprobadas).toBe(2);
            expect(res.body.datos.rechazadas).toBe(1);
            expect(res.body.datos.errores).toBe(0);
            expect(res.body.datos.detalle).toHaveLength(3);
            expect(res.body.datos.mensaje).toContain('Evaluación completada');
        });

        test('retorna resumen vacío cuando no hay ofertas pendientes', async () => {
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 0,
                aprobadas: 0,
                rechazadas: 0,
                errores: 0,
                detalle: [],
            });

            const res = await request(app)
                .post('/api/evaluacion/ejecutar');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.total).toBe(0);
            expect(res.body.datos.detalle).toEqual([]);
            expect(res.body.datos.mensaje).toContain('Evaluación completada');
        });
    });
});
