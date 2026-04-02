// Tests del controlador de automatización — verifico endpoints HTTP con supertest.
//
// Mockeo el servicio de automatización completo para que los tests
// no toquen Apify, DeepSeek ni la BD. Solo testeo que:
// - Los endpoints responden con el status code correcto.
// - El body tiene la estructura esperada.
// - Se llama a las funciones del servicio con los parámetros correctos.

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
});
