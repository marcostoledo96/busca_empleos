// Tests del servicio de automatización — TDD, escritos ANTES de la implementación.
//
// ¿Qué es un cron job? Es una tarea programada que se ejecuta automáticamente
// a intervalos regulares. Como una alarma que suena cada X horas y dispara
// una acción. En nuestro caso: scrapear ofertas y evaluarlas con IA.
//
// En estos tests mockeamos TODO lo externo:
// - node-cron: para no esperar horas a que se dispare el cron.
// - scraping: para no gastar créditos de Apify.
// - evaluación: para no gastar créditos de DeepSeek.
// - modelo de ofertas: para no tocar la BD real.
//
// Lo que testeamos es la LÓGICA de orquestación:
// ¿Se llama a scraping? ¿Se guardan las ofertas? ¿Se evalúan después?
// ¿Qué pasa si uno falla? ¿Se registra el error? ¿El cron se puede parar?

// Mockeo los módulos ANTES de importar el servicio.
// Jest reemplaza el módulo real con el mock para que nunca se llame a la API real.
jest.mock('node-cron');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/modelos/oferta');

const cron = require('node-cron');
const servicioScraping = require('../../src/servicios/servicio-scraping');
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');
const modeloOferta = require('../../src/modelos/oferta');

// Importo el servicio que vamos a testear.
const servicioAutomatizacion = require('../../src/servicios/servicio-automatizacion');

describe('Servicio de automatización', () => {
    // Antes de cada test, limpio todos los mocks.
    // Así cada test arranca en un estado limpio, sin "recuerdos" de tests anteriores.
    beforeEach(() => {
        jest.clearAllMocks();

        // Reseteo el estado interno del servicio para que cada test arranque limpio.
        servicioAutomatizacion._resetearEstado();

        // Configuro el mock de cron.schedule para simular la programación.
        // Retorna un objeto con métodos start/stop como lo haría el cron real.
        cron.schedule.mockReturnValue({
            start: jest.fn(),
            stop: jest.fn(),
        });

        // Valido expresiones cron como válidas por defecto.
        cron.validate.mockReturnValue(true);
    });

    describe('ejecutarCicloCompleto()', () => {
        test('ejecuta scraping de LinkedIn → Computrabajo → guarda ofertas → evalúa', async () => {
            // Preparo los datos simulados.
            const ofertasLinkedin = [
                { titulo: 'Dev Angular', url: 'https://linkedin.com/jobs/1' },
                { titulo: 'Dev React', url: 'https://linkedin.com/jobs/2' },
            ];
            const ofertasComputrabajo = [
                { titulo: 'Frontend Jr', url: 'https://computrabajo.com/1' },
            ];

            // Configuro qué retornan los mocks.
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue(ofertasLinkedin);
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue(ofertasComputrabajo);
            modeloOferta.crearOferta.mockResolvedValue({ id: 1 });
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 3,
                aprobadas: 2,
                rechazadas: 1,
                errores: 0,
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Verifico que se llamó al scraping de ambas plataformas.
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledTimes(1);

            // Verifico que se guardaron las 3 ofertas (2 LinkedIn + 1 Computrabajo).
            expect(modeloOferta.crearOferta).toHaveBeenCalledTimes(3);

            // Verifico que se evaluaron las pendientes.
            expect(servicioEvaluacion.evaluarOfertasPendientes).toHaveBeenCalledTimes(1);

            // Verifico la estructura del resultado.
            expect(resultado).toEqual({
                exito: true,
                scraping: {
                    linkedin: 2,
                    computrabajo: 1,
                    totalExtraidas: 3,
                    guardadas: 3,
                },
                evaluacion: {
                    total: 3,
                    aprobadas: 2,
                    rechazadas: 1,
                    errores: 0,
                },
                errores: [],
            });
        });

        test('si LinkedIn falla, sigue con Computrabajo y reporta el error', async () => {
            // Simulo que LinkedIn tira un error.
            servicioScraping.ejecutarScrapingLinkedin.mockRejectedValue(
                new Error('Apify timeout')
            );
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([
                { titulo: 'Dev Jr', url: 'https://computrabajo.com/1' },
            ]);
            modeloOferta.crearOferta.mockResolvedValue({ id: 1 });
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 1, aprobadas: 1, rechazadas: 0, errores: 0,
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // LinkedIn falló, pero Computrabajo siguió.
            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(0);
            expect(resultado.scraping.computrabajo).toBe(1);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('LinkedIn');
        });

        test('si Computrabajo falla, sigue con LinkedIn y reporta el error', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            servicioScraping.ejecutarScrapingComputrabajo.mockRejectedValue(
                new Error('Actor not found')
            );
            modeloOferta.crearOferta.mockResolvedValue({ id: 1 });
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 1, aprobadas: 0, rechazadas: 1, errores: 0,
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(1);
            expect(resultado.scraping.computrabajo).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('Computrabajo');
        });

        test('si ambos scrapings fallan, no intenta evaluar y reporta ambos errores', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockRejectedValue(
                new Error('LinkedIn error')
            );
            servicioScraping.ejecutarScrapingComputrabajo.mockRejectedValue(
                new Error('Computrabajo error')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // No se guardó ninguna oferta.
            expect(modeloOferta.crearOferta).not.toHaveBeenCalled();

            // No se intentó evaluar (no tiene sentido sin ofertas nuevas).
            // Pero SÍ se llama a evaluarOfertasPendientes porque puede haber
            // pendientes de ciclos anteriores.
            expect(resultado.scraping.totalExtraidas).toBe(0);
            expect(resultado.errores).toHaveLength(2);
        });

        test('si la evaluación falla, reporta el error pero no crashea', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev', url: 'https://linkedin.com/1' },
            ]);
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([]);
            modeloOferta.crearOferta.mockResolvedValue({ id: 1 });
            servicioEvaluacion.evaluarOfertasPendientes.mockRejectedValue(
                new Error('DeepSeek API down')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // El scraping se completó bien.
            expect(resultado.scraping.linkedin).toBe(1);
            // La evaluación falló, se reporta.
            expect(resultado.evaluacion).toBeNull();
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('evaluación');
        });

        test('ofertas duplicadas se cuentan correctamente (crearOferta retorna null)', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
                { titulo: 'Dev React', url: 'https://linkedin.com/2' },
            ]);
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([]);
            // Simulo que la primera es nueva y la segunda es duplicada.
            modeloOferta.crearOferta
                .mockResolvedValueOnce({ id: 1 })  // Nueva
                .mockResolvedValueOnce(null);        // Duplicada (retorna null)
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 1, aprobadas: 1, rechazadas: 0, errores: 0,
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.scraping.totalExtraidas).toBe(2);
            expect(resultado.scraping.guardadas).toBe(1); // Solo 1 nueva.
        });
    });

    describe('programarCron()', () => {
        test('programa un cron job con la expresión por defecto (cada 12 horas)', () => {
            servicioAutomatizacion.programarCron();

            expect(cron.schedule).toHaveBeenCalledTimes(1);
            // El primer argumento es la expresión cron.
            const expresionCron = cron.schedule.mock.calls[0][0];
            expect(expresionCron).toBe('0 */12 * * *');
        });

        test('acepta una expresión cron personalizada', () => {
            servicioAutomatizacion.programarCron({ expresionCron: '0 8 * * *' });

            const expresionUsada = cron.schedule.mock.calls[0][0];
            expect(expresionUsada).toBe('0 8 * * *');
        });

        test('rechaza una expresión cron inválida', () => {
            cron.validate.mockReturnValue(false);

            expect(() => {
                servicioAutomatizacion.programarCron({ expresionCron: 'invalida' });
            }).toThrow('Expresión cron inválida');
        });

        test('retorna métodos para controlar el cron', () => {
            const control = servicioAutomatizacion.programarCron();

            expect(control).toHaveProperty('detener');
            expect(typeof control.detener).toBe('function');
        });
    });

    describe('detener()', () => {
        test('detiene el cron programado', () => {
            const mockStop = jest.fn();
            cron.schedule.mockReturnValue({
                start: jest.fn(),
                stop: mockStop,
            });

            const control = servicioAutomatizacion.programarCron();
            control.detener();

            expect(mockStop).toHaveBeenCalledTimes(1);
        });
    });

    describe('obtenerEstado()', () => {
        test('retorna estado inactivo si no hay cron programado', () => {
            const estado = servicioAutomatizacion.obtenerEstado();

            expect(estado).toEqual({
                activo: false,
                expresionCron: null,
                ultimaEjecucion: null,
                ultimoResultado: null,
            });
        });

        test('retorna estado activo después de programar el cron', () => {
            servicioAutomatizacion.programarCron();
            const estado = servicioAutomatizacion.obtenerEstado();

            expect(estado.activo).toBe(true);
            expect(estado.expresionCron).toBe('0 */12 * * *');
        });
    });
});
