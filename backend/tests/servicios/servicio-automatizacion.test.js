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
jest.mock('../../src/modelos/preferencia');

const cron = require('node-cron');
const servicioScraping = require('../../src/servicios/servicio-scraping');
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');
const modeloOferta = require('../../src/modelos/oferta');
const modeloPreferencia = require('../../src/modelos/preferencia');

// Importo el servicio que vamos a testear.
const servicioAutomatizacion = require('../../src/servicios/servicio-automatizacion');

describe('Servicio de automatización', () => {
    // Antes de cada test, limpio todos los mocks.
    // Así cada test arranca en un estado limpio, sin "recuerdos" de tests anteriores.
    beforeEach(() => {
        jest.clearAllMocks();

        // Reseteo el estado interno del servicio para que cada test arranque limpio.
        servicioAutomatizacion._resetearEstado();

        // Mocks por defecto: los 4 scrapers retornan vacío.
        // Cada test sobreescribe solo los que necesita con datos específicos.
        servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingIndeed.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingBumeran.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingGlassdoor.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingJooble.mockResolvedValue([]);
        servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
            total: 0, aprobadas: 0, rechazadas: 0, errores: 0,
        });
        modeloOferta.crearOferta.mockResolvedValue({ id: 1 });

        // Configuro el mock de cron.schedule para simular la programación.
        cron.schedule.mockReturnValue({
            start: jest.fn(),
            stop: jest.fn(),
        });

        // Valido expresiones cron como válidas por defecto.
        cron.validate.mockReturnValue(true);

        // Mock de preferencias: sin términos de búsqueda por defecto.
        // Así los scrapers usan sus defaults internos (TERMINOS_BUSQUEDA_DEFECTO).
        modeloPreferencia.obtenerPreferencias.mockResolvedValue(null);
    });

    describe('ejecutarCicloCompleto()', () => {
        test('ejecuta scraping de las 7 plataformas → guarda ofertas → evalúa', async () => {
            // Preparo datos simulados para las 7 plataformas.
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/jobs/1' },
                { titulo: 'Dev React', url: 'https://linkedin.com/jobs/2' },
            ]);
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([
                { titulo: 'Frontend Jr', url: 'https://computrabajo.com/1' },
            ]);
            servicioScraping.ejecutarScrapingIndeed.mockResolvedValue([
                { titulo: 'Dev Node', url: 'https://ar.indeed.com/viewjob?jk=1' },
            ]);
            servicioScraping.ejecutarScrapingBumeran.mockResolvedValue([
                { titulo: 'Dev Full-stack', url: 'https://www.bumeran.com.ar/empleos/dev-1.html' },
            ]);
            servicioScraping.ejecutarScrapingGlassdoor.mockResolvedValue([
                { titulo: 'QA Engineer', url: 'https://www.glassdoor.com.ar/job-listing/qa.htm?jl=1' },
            ]);
            servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([
                { titulo: 'Frontend Junior', url: 'https://www.getonbrd.com/jobs/programming/frontend-1' },
            ]);
            servicioScraping.ejecutarScrapingJooble.mockResolvedValue([
                { titulo: 'Dev TypeScript', url: 'https://jooble.org/desc/1234567890' },
            ]);
            servicioEvaluacion.evaluarOfertasPendientes.mockResolvedValue({
                total: 7,
                aprobadas: 4,
                rechazadas: 3,
                errores: 0,
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Verifico que se llamó al scraping de las 7 plataformas.
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingIndeed).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingBumeran).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingJooble).toHaveBeenCalledTimes(1);

            // Verifico que se guardaron las 8 ofertas (2+1+1+1+1+1+1).
            expect(modeloOferta.crearOferta).toHaveBeenCalledTimes(8);

            // Verifico que se evaluaron las pendientes.
            expect(servicioEvaluacion.evaluarOfertasPendientes).toHaveBeenCalledTimes(1);

            // Verifico la estructura del resultado.
            expect(resultado).toEqual({
                exito: true,
                scraping: {
                    linkedin: 2,
                    computrabajo: 1,
                    indeed: 1,
                    bumeran: 1,
                    glassdoor: 1,
                    getonbrd: 1,
                    jooble: 1,
                    totalExtraidas: 8,
                    guardadas: 8,
                },
                evaluacion: {
                    total: 7,
                    aprobadas: 4,
                    rechazadas: 3,
                    errores: 0,
                },
                errores: [],
            });
        });

        test('si LinkedIn falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockRejectedValue(
                new Error('Apify timeout')
            );
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([
                { titulo: 'Dev Jr', url: 'https://computrabajo.com/1' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(0);
            expect(resultado.scraping.computrabajo).toBe(1);
            expect(resultado.scraping.indeed).toBe(0);
            expect(resultado.scraping.bumeran).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('LinkedIn');
        });

        test('si Computrabajo falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            servicioScraping.ejecutarScrapingComputrabajo.mockRejectedValue(
                new Error('Actor not found')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(1);
            expect(resultado.scraping.computrabajo).toBe(0);
            expect(resultado.scraping.indeed).toBe(0);
            expect(resultado.scraping.bumeran).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('Computrabajo');
        });

        test('si Indeed falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingIndeed.mockRejectedValue(
                new Error('Indeed API error')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.indeed).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('Indeed');
        });

        test('si Bumeran falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingBumeran.mockRejectedValue(
                new Error('Bumeran cheerio error')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.bumeran).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('Bumeran');
        });

        test('si Glassdoor falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            servicioScraping.ejecutarScrapingGlassdoor.mockRejectedValue(
                new Error('Glassdoor blocked')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(1);
            expect(resultado.scraping.glassdoor).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('Glassdoor');
        });

        test('si GetOnBrd falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            servicioScraping.ejecutarScrapingGetonbrd.mockRejectedValue(
                new Error('GetOnBrd API error')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(1);
            expect(resultado.scraping.getonbrd).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('GetOnBrd');
        });

        test('si Jooble falla, sigue con las demás plataformas y reporta el error', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            servicioScraping.ejecutarScrapingJooble.mockRejectedValue(
                new Error('Jooble API error')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(1);
            expect(resultado.scraping.jooble).toBe(0);
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('Jooble');
        });

        test('si todos los scrapings fallan, no guarda ofertas y reporta todos los errores', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockRejectedValue(
                new Error('LinkedIn error')
            );
            servicioScraping.ejecutarScrapingComputrabajo.mockRejectedValue(
                new Error('Computrabajo error')
            );
            servicioScraping.ejecutarScrapingIndeed.mockRejectedValue(
                new Error('Indeed error')
            );
            servicioScraping.ejecutarScrapingBumeran.mockRejectedValue(
                new Error('Bumeran error')
            );
            servicioScraping.ejecutarScrapingGlassdoor.mockRejectedValue(
                new Error('Glassdoor error')
            );
            servicioScraping.ejecutarScrapingGetonbrd.mockRejectedValue(
                new Error('GetOnBrd error')
            );
            servicioScraping.ejecutarScrapingJooble.mockRejectedValue(
                new Error('Jooble error')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(modeloOferta.crearOferta).not.toHaveBeenCalled();
            expect(resultado.scraping.totalExtraidas).toBe(0);
            expect(resultado.errores).toHaveLength(7);
        });

        test('si la evaluación falla, reporta el error pero no crashea', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev', url: 'https://linkedin.com/1' },
            ]);
            servicioEvaluacion.evaluarOfertasPendientes.mockRejectedValue(
                new Error('DeepSeek API down')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.scraping.linkedin).toBe(1);
            expect(resultado.evaluacion).toBeNull();
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('evaluación');
        });

        test('ofertas duplicadas se cuentan correctamente (crearOferta retorna null)', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
                { titulo: 'Dev React', url: 'https://linkedin.com/2' },
            ]);
            // Simulo que la primera es nueva y la segunda es duplicada.
            modeloOferta.crearOferta
                .mockResolvedValueOnce({ id: 1 })  // Nueva
                .mockResolvedValueOnce(null);        // Duplicada (retorna null)

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.scraping.totalExtraidas).toBe(2);
            expect(resultado.scraping.guardadas).toBe(1); // Solo 1 nueva.
        });

        test('pasa términos de búsqueda de preferencias a los scrapers', async () => {
            const terminosPersonalizados = ['Angular developer', 'React junior'];
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                terminos_busqueda: terminosPersonalizados,
            });

            await servicioAutomatizacion.ejecutarCicloCompleto();

            const opcionesEsperadas = { terminos: terminosPersonalizados };
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingIndeed).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingBumeran).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingJooble).toHaveBeenCalledWith(opcionesEsperadas);
        });

        test('usa defaults si las preferencias no tienen términos de búsqueda', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                terminos_busqueda: [],
            });

            await servicioAutomatizacion.ejecutarCicloCompleto();

            // Sin términos, pasa un objeto vacío (los scrapers usan sus fallbacks).
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledWith({});
            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledWith({});
            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledWith({});
            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledWith({});
        });

        test('si obtenerPreferencias falla, continúa con defaults sin crashear', async () => {
            modeloPreferencia.obtenerPreferencias.mockRejectedValue(
                new Error('BD no disponible')
            );

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // El ciclo no crashea, usa defaults.
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledWith({});
            expect(resultado.exito).toBe(true);
        });
    });

    describe('programarCron()', () => {
        test('programa un cron job con la expresión por defecto (cada 72 horas)', () => {
            servicioAutomatizacion.programarCron();

            expect(cron.schedule).toHaveBeenCalledTimes(1);
            const expresionCron = cron.schedule.mock.calls[0][0];
            expect(expresionCron).toBe('0 0 */3 * *');
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
            expect(estado.expresionCron).toBe('0 0 */3 * *');
        });
    });
});
