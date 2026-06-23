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
// ¿Solo se invocan plataformas activas? ¿Adzuna deshabilitado no rompe?

// Mockeo los módulos ANTES de importar el servicio.
// Jest reemplaza el módulo real con el mock para que nunca se llame a la API real.
jest.mock('node-cron');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/modelos/oferta');
jest.mock('../../src/modelos/preferencia');
jest.mock('../../src/servicios/servicio-notificacion-email');
jest.mock('../../src/config/plataformas', () => {
    // Mockeo el registry con plataformas activas e inactivas para testear
    // que el ciclo itera solo sobre las activas y registra las inactivas con 0.
    const PLATAFORMAS = {
        linkedin: { id: 'linkedin', slugHttp: 'linkedin', label: 'LinkedIn', activa: true },
        computrabajo: { id: 'computrabajo', slugHttp: 'computrabajo', label: 'Computrabajo', activa: true },
        indeed: { id: 'indeed', slugHttp: 'indeed', label: 'Indeed', activa: true },
        bumeran: { id: 'bumeran', slugHttp: 'bumeran', label: 'Bumeran', activa: true },
        glassdoor: { id: 'glassdoor', slugHttp: 'glassdoor', label: 'Glassdoor', activa: true },
        getonbrd: { id: 'getonbrd', slugHttp: 'getonbrd', label: 'GetOnBrd', activa: true },
        jooble: { id: 'jooble', slugHttp: 'jooble', label: 'Jooble', activa: true },
        google_jobs: { id: 'google_jobs', slugHttp: 'google-jobs', label: 'Google Jobs', activa: false, motivo: 'Desactivado por costo y baja utilidad' },
        remotive: { id: 'remotive', slugHttp: 'remotive', label: 'Remotive', activa: true },
        remoteok: { id: 'remoteok', slugHttp: 'remoteok', label: 'RemoteOK', activa: true },
        infojobs: { id: 'infojobs', slugHttp: 'infojobs', label: 'InfoJobs', activa: false, motivo: 'Portal developers suspendido' },
        adzuna: { id: 'adzuna', slugHttp: 'adzuna', label: 'Adzuna', activa: true },
    };
    const PLATAFORMAS_ACTIVAS = Object.values(PLATAFORMAS).filter(p => p.activa);
    const IDS_PLATAFORMAS = new Set(Object.keys(PLATAFORMAS));
    const SLUG_HTTP_A_ID = Object.values(PLATAFORMAS).reduce((mapa, p) => {
        mapa[p.slugHttp] = p.id;
        return mapa;
    }, {});
    function obtenerPlataformasActivas() {
        return PLATAFORMAS_ACTIVAS.map(p => ({ id: p.id, slugHttp: p.slugHttp, label: p.label }));
    }
    function esPlataformaActiva(idOSlug) {
        const id = SLUG_HTTP_A_ID[idOSlug] || idOSlug;
        const plataforma = PLATAFORMAS[id];
        return plataforma ? plataforma.activa : false;
    }
    function normalizarIdPlataforma(idOSlug) {
        return SLUG_HTTP_A_ID[idOSlug] || (PLATAFORMAS[idOSlug] ? idOSlug : null);
    }
    return {
        PLATAFORMAS,
        PLATAFORMAS_ACTIVAS,
        IDS_PLATAFORMAS,
        SLUG_HTTP_A_ID,
        obtenerPlataformasActivas,
        esPlataformaActiva,
        normalizarIdPlataforma,
    };
});

const cron = require('node-cron');
const servicioScraping = require('../../src/servicios/servicio-scraping');
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');
const modeloOferta = require('../../src/modelos/oferta');
const modeloPreferencia = require('../../src/modelos/preferencia');
const servicioNotificacionEmail = require('../../src/servicios/servicio-notificacion-email');
const { PLATAFORMAS, PLATAFORMAS_ACTIVAS } = require('../../src/config/plataformas');

// Importo el servicio que vamos a testear.
const servicioAutomatizacion = require('../../src/servicios/servicio-automatizacion');

describe('Servicio de automatización', () => {
    // Antes de cada test, limpio todos los mocks.
    // Así cada test arranca en un estado limpio, sin "recuerdos" de tests anteriores.
    beforeEach(() => {
        jest.clearAllMocks();

        // Reseteo el estado interno del servicio para que cada test arranque limpio.
        servicioAutomatizacion._resetearEstado();

        // Mocks por defecto: todos los scrapers retornan vacío.
        // Cada test sobreescribe solo los que necesita con datos específicos.
        servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingIndeed.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingBumeran.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingGlassdoor.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingGetonbrd.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingJooble.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingGoogleJobs.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingRemotive.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingRemoteOK.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingInfojobs.mockResolvedValue([]);
        servicioScraping.ejecutarScrapingAdzuna.mockResolvedValue([]);
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
        modeloPreferencia.obtenerPreferencias.mockResolvedValue(null);

        // Mock del servicio de notificación por email.
        servicioNotificacionEmail.enviarResumenCiclo.mockResolvedValue({
            enviado: true,
            messageId: '<test-message-id>',
        });
    });

    describe('ejecutarCicloCompleto()', () => {
        test('ejecuta scraping de las plataformas activas → guarda ofertas → evalúa', async () => {
            // Preparo datos simulados para las plataformas activas.
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

            // Verifico que se llamó al scraping de las plataformas activas.
            // Las 9 plataformas activas deben ser invocadas.
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingIndeed).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingBumeran).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingJooble).toHaveBeenCalledTimes(1);
            expect(servicioScraping.ejecutarScrapingGoogleJobs).not.toHaveBeenCalled();
            expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();

            // Verifico que se guardaron las 8 ofertas activas (2+1+1+1+1+1+1 + 0 Remotive/RemoteOK vacíos).
            expect(modeloOferta.crearOferta).toHaveBeenCalledTimes(8);

            // Verifico la estructura del resultado.
            expect(resultado.exito).toBe(true);
            expect(resultado.fechaEjecucion).toBeDefined();
            expect(resultado.duracionSegundos).toBeDefined();
            expect(resultado.scraping.descartadasPorIdioma).toBeDefined();

            // Verifico que resultado.scraping tiene claves para TODAS las plataformas del registry.
            for (const id of Object.keys(PLATAFORMAS)) {
                expect(resultado.scraping).toHaveProperty(id);
                expect(typeof resultado.scraping[id]).toBe('number');
            }
            // Verifico los totales.
            expect(resultado.scraping.totalExtraidas).toBe(8);
            expect(resultado.scraping.guardadas).toBe(8);
            expect(resultado.scraping.descartadasPorIdioma).toBe(0);

            expect(resultado.evaluacion).toEqual({
                total: 7,
                aprobadas: 4,
                rechazadas: 3,
                errores: 0,
            });
            expect(resultado.errores).toEqual([]);
        });

        test('plataformas inactivas (Google Jobs, InfoJobs) NO son invocadas', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Las inactivas no deben ser llamadas nunca.
            expect(servicioScraping.ejecutarScrapingGoogleJobs).not.toHaveBeenCalled();
            expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();

            // Pero aparecen en resultado.scraping con valor 0.
            expect(resultado.scraping.google_jobs).toBe(0);
            expect(resultado.scraping.infojobs).toBe(0);
            expect(resultado.errores).toHaveLength(0);
        });

        test('resultado.scraping contiene una clave por cada entrada del registry', async () => {
            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Cada plataforma del registry debe tener su clave en resultado.scraping.
            for (const id of Object.keys(PLATAFORMAS)) {
                expect(resultado.scraping).toHaveProperty(id);
                expect(typeof resultado.scraping[id]).toBe('number');
            }

            // Además debe tener los campos de totales.
            expect(resultado.scraping).toHaveProperty('totalExtraidas');
            expect(resultado.scraping).toHaveProperty('guardadas');
            expect(resultado.scraping).toHaveProperty('descartadasPorIdioma');
        });

        test('el progreso finaliza en 100%', async () => {
            await servicioAutomatizacion.ejecutarCicloCompleto();

            const progreso = servicioAutomatizacion.obtenerProgreso();
            expect(progreso.porcentaje).toBe(100);
            expect(progreso.activo).toBe(false);
        });

        test('el progreso conserva shape { nombre, label, estado, extraidas }', async () => {
            await servicioAutomatizacion.ejecutarCicloCompleto();

            const progreso = servicioAutomatizacion.obtenerProgreso();

            // Todos los pasos deben tener las propiedades esperadas.
            for (const paso of progreso.pasos) {
                expect(paso).toHaveProperty('nombre');
                expect(paso).toHaveProperty('label');
                expect(paso).toHaveProperty('estado');
                expect(paso).toHaveProperty('extraidas');
            }

            // Debe haber un paso por cada plataforma (activa e inactiva) + guardado + evaluación.
            const idsPlataformas = Object.keys(PLATAFORMAS);
            const nombresPasos = progreso.pasos.map(p => p.nombre);
            for (const id of idsPlataformas) {
                expect(nombresPasos).toContain(id);
            }
            expect(nombresPasos).toContain('guardado');
            expect(nombresPasos).toContain('evaluacion');
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
            expect(resultado.errores).toHaveLength(1);
            expect(resultado.errores[0]).toContain('LinkedIn');
        });

        test('error de un scraper no aborta el ciclo; las demás plataformas ejecutan', async () => {
            // Hago fallar 3 scrapers activos.
            servicioScraping.ejecutarScrapingLinkedin.mockRejectedValue(new Error('LinkedIn error'));
            servicioScraping.ejecutarScrapingGlassdoor.mockRejectedValue(new Error('Glassdoor error'));
            servicioScraping.ejecutarScrapingRemotive.mockRejectedValue(new Error('Remotive error'));

            // Las demás retornan datos.
            servicioScraping.ejecutarScrapingComputrabajo.mockResolvedValue([
                { titulo: 'Dev Jr', url: 'https://computrabajo.com/1' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // El ciclo no se abortó.
            expect(resultado.exito).toBe(true);
            // Los que fallaron tienen 0.
            expect(resultado.scraping.linkedin).toBe(0);
            expect(resultado.scraping.glassdoor).toBe(0);
            expect(resultado.scraping.remotive).toBe(0);
            // Los que no fallaron siguen funcionando.
            expect(resultado.scraping.computrabajo).toBe(1);
            // Se reportan los errores.
            expect(resultado.errores.length).toBeGreaterThanOrEqual(3);
        });

        test('Adzuna deshabilitado retorna { deshabilitado: true } → adzuna: 0, sin error', async () => {
            // Adzuna retorna el objeto especial de deshabilitado.
            servicioScraping.ejecutarScrapingAdzuna.mockResolvedValue({
                deshabilitado: true,
                codigo_resultado: 'adzuna_deshabilitado_sin_credenciales',
                advertencia: 'Adzuna está deshabilitado: faltan ADZUNA_APP_ID y ADZUNA_APP_KEY en el .env.',
                ofertas: [],
            });

            // Otras plataformas retornan datos normales.
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Adzuna debe tener 0 sin error.
            expect(resultado.scraping.adzuna).toBe(0);
            // No se debe agregar un error por Adzuna deshabilitado.
            const erroresAdzuna = resultado.errores.filter(e => e.includes('Adzuna'));
            expect(erroresAdzuna).toHaveLength(0);
            // LinkedIn funciona normal.
            expect(resultado.scraping.linkedin).toBe(1);
        });

        test('Adzuna deshabilitado no guarda objeto como oferta', async () => {
            servicioScraping.ejecutarScrapingAdzuna.mockResolvedValue({
                deshabilitado: true,
                codigo_resultado: 'adzuna_deshabilitado_sin_credenciales',
                advertencia: 'Adzuna está deshabilitado.',
                ofertas: [],
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // totalExtraidas debe reflejar solo ofertas reales (no el objeto deshabilitado).
            expect(resultado.scraping.totalExtraidas).toBe(0);
            expect(resultado.scraping.adzuna).toBe(0);
        });

        test('si todos los scrapings activos fallan, no guarda ofertas y reporta errores', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockRejectedValue(new Error('LinkedIn error'));
            servicioScraping.ejecutarScrapingComputrabajo.mockRejectedValue(new Error('Computrabajo error'));
            servicioScraping.ejecutarScrapingIndeed.mockRejectedValue(new Error('Indeed error'));
            servicioScraping.ejecutarScrapingBumeran.mockRejectedValue(new Error('Bumeran error'));
            servicioScraping.ejecutarScrapingGlassdoor.mockRejectedValue(new Error('Glassdoor error'));
            servicioScraping.ejecutarScrapingGetonbrd.mockRejectedValue(new Error('GetOnBrd error'));
            servicioScraping.ejecutarScrapingJooble.mockRejectedValue(new Error('Jooble error'));
            servicioScraping.ejecutarScrapingRemotive.mockRejectedValue(new Error('Remotive error'));
            servicioScraping.ejecutarScrapingRemoteOK.mockRejectedValue(new Error('RemoteOK error'));

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(modeloOferta.crearOferta).not.toHaveBeenCalled();
            expect(resultado.scraping.totalExtraidas).toBe(0);
            // 9 plataformas activas fallan → 9 errores (Google Jobs e InfoJobs son inactivas, no suman).
            expect(resultado.errores).toHaveLength(9);
        });

        test('InfoJobs desactivado temporalmente → ejecutarScrapingInfojobs NO se llama', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            expect(resultado.exito).toBe(true);
            expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();
            expect(resultado.scraping.infojobs).toBe(0);
            expect(resultado.errores).toHaveLength(0);
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
            // Solo las activas reciben opciones; las inactivas no se invocan.
            expect(servicioScraping.ejecutarScrapingLinkedin).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingComputrabajo).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingIndeed).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingBumeran).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingGlassdoor).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingGetonbrd).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingJooble).toHaveBeenCalledWith(opcionesEsperadas);
            expect(servicioScraping.ejecutarScrapingAdzuna).toHaveBeenCalledWith(opcionesEsperadas);
            // Las inactivas no deben recibir opciones ni llamarse.
            expect(servicioScraping.ejecutarScrapingGoogleJobs).not.toHaveBeenCalled();
            expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();
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
            expect(servicioScraping.ejecutarScrapingAdzuna).toHaveBeenCalledWith({});
            // Las inactivas no deben llamarse ni con {} ni con nada.
            expect(servicioScraping.ejecutarScrapingGoogleJobs).not.toHaveBeenCalled();
            expect(servicioScraping.ejecutarScrapingInfojobs).not.toHaveBeenCalled();
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
        test('programa un cron job con la expresión por defecto (todos los martes a las 20:00 ART)', () => {
            servicioAutomatizacion.programarCron();

            expect(cron.schedule).toHaveBeenCalledTimes(1);
            const expresionCron = cron.schedule.mock.calls[0][0];
            expect(expresionCron).toBe('0 20 * * 2');
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

    describe('cicloEnProgreso()', () => {
        test('retorna false cuando no hay ciclo en progreso', () => {
            expect(servicioAutomatizacion.cicloEnProgreso()).toBe(false);
        });

        test('retorna true durante la ejecución de un ciclo', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockImplementation(async () => {
                // Mientras el ciclo está corriendo, cicloEnProgreso() debe ser true.
                expect(servicioAutomatizacion.cicloEnProgreso()).toBe(true);
                return [];
            });

            await servicioAutomatizacion.ejecutarCicloCompleto();

            // Después de terminar, debe volver a false.
            expect(servicioAutomatizacion.cicloEnProgreso()).toBe(false);
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
            expect(estado.expresionCron).toBe('0 20 * * 2');
        });
    });

    // === Helpers internos ===

    describe('_armarPasosProgreso()', () => {
        test('incluye paso por cada plataforma del registry + guardado + evaluacion', () => {
            const pasos = servicioAutomatizacion._armarPasosProgreso();
            const nombres = pasos.map(p => p.nombre);

            // Una entrada por cada plataforma (activa + inactiva).
            for (const id of Object.keys(PLATAFORMAS)) {
                expect(nombres).toContain(id);
            }
            // Más los pasos fijos.
            expect(nombres).toContain('guardado');
            expect(nombres).toContain('evaluacion');
            // Todos empiezan como pendientes.
            for (const paso of pasos) {
                expect(paso.estado).toBe('pendiente');
                expect(paso.extraidas).toBe(0);
            }
        });

        test('incluye labels correctas del registry', () => {
            const pasos = servicioAutomatizacion._armarPasosProgreso();

            for (const [id, plataforma] of Object.entries(PLATAFORMAS)) {
                const paso = pasos.find(p => p.nombre === id);
                expect(paso).toBeDefined();
                expect(paso.label).toBe(plataforma.label);
            }
        });
    });

    describe('_armarPesosDinamicos()', () => {
        test('las activas reparten el peso de scraping; las inactivas tienen peso 0', () => {
            const pesos = servicioAutomatizacion._armarPesosDinamicos();

            // Las activas tienen peso > 0.
            for (const plataforma of PLATAFORMAS_ACTIVAS) {
                expect(pesos[plataforma.id]).toBeGreaterThan(0);
            }

            // Las inactivas tienen peso 0.
            for (const [id, plataforma] of Object.entries(PLATAFORMAS)) {
                if (!plataforma.activa) {
                    expect(pesos[id]).toBe(0);
                }
            }

            // Los pesos fijos.
            expect(pesos.guardado).toBe(3);
            expect(pesos.evaluacion).toBe(15);
        });

        test('la suma de todos los pesos es 100', () => {
            const pesos = servicioAutomatizacion._armarPesosDinamicos();
            const suma = Object.values(pesos).reduce((acc, v) => acc + v, 0);
            // La suma debe ser ~100 (puede haber redondeo).
            expect(Math.abs(suma - 100)).toBeLessThanOrEqual(1);
        });
    });

    describe('_inicializarResultadoScraping()', () => {
        test('contiene una clave por cada plataforma del registry con valor 0', () => {
            const resultado = servicioAutomatizacion._inicializarResultadoScraping();

            for (const id of Object.keys(PLATAFORMAS)) {
                expect(resultado).toHaveProperty(id);
                expect(resultado[id]).toBe(0);
            }
        });

        test('contiene los campos de totales', () => {
            const resultado = servicioAutomatizacion._inicializarResultadoScraping();

            expect(resultado.totalExtraidas).toBe(0);
            expect(resultado.guardadas).toBe(0);
            expect(resultado.descartadasPorIdioma).toBe(0);
        });
    });

    // === Notificación por email ===

    describe('Notificación por email post-ciclo', () => {
        test('invoca enviarResumenCiclo con el resultado al final del ciclo', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Espero a que se procese el fire-and-forget del email.
            await new Promise(resolve => setImmediate(resolve));

            expect(servicioNotificacionEmail.enviarResumenCiclo).toHaveBeenCalledTimes(1);

            // Verifico que se pasó el resultado completo del ciclo.
            const llamadoCon = servicioNotificacionEmail.enviarResumenCiclo.mock.calls[0][0];
            expect(llamadoCon.exito).toBe(true);
            expect(llamadoCon.scraping).toBeDefined();
            expect(llamadoCon.fechaEjecucion).toBeDefined();
            expect(llamadoCon.duracionSegundos).toBeDefined();
            expect(llamadoCon.scraping.descartadasPorIdioma).toBeDefined();
        });

        test('el resultado incluye descartadasPorIdioma y métricas de duración', async () => {
            // Simulo ofertas en inglés que son descartadas por el filtro de idioma.
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1', descripcion: 'Puesto en español' },
                { titulo: 'Java Developer', url: 'https://linkedin.com/2', descripcion: 'English job posting requiring Java' },
            ]);

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // El resultado debe incluir los campos nuevos para el email.
            expect(resultado.fechaEjecucion).toBeDefined();
            expect(typeof resultado.fechaEjecucion).toBe('string');
            expect(resultado.duracionSegundos).toBeDefined();
            expect(typeof resultado.duracionSegundos).toBe('number');
            expect(resultado.scraping.descartadasPorIdioma).toBeDefined();
            expect(typeof resultado.scraping.descartadasPorIdioma).toBe('number');
        });

        test('si enviarResumenCiclo falla, el ciclo no se rompe', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            // Simulo que el email falla con un error.
            servicioNotificacionEmail.enviarResumenCiclo.mockRejectedValue(
                new Error('SMTP connection refused')
            );

            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            // Espero a que se procese el error del fire-and-forget.
            await new Promise(resolve => setImmediate(resolve));

            // El ciclo debe completarse exitosamente a pesar del error de email.
            expect(resultado.exito).toBe(true);
            expect(resultado.scraping.linkedin).toBe(1);

            // Se debe haber logueado el error de email.
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error en notificación por email')
            );
            errorSpy.mockRestore();
        });

        test('si enviarResumenCiclo retorna deshabilitado, el ciclo no se rompe', async () => {
            servicioScraping.ejecutarScrapingLinkedin.mockResolvedValue([
                { titulo: 'Dev Angular', url: 'https://linkedin.com/1' },
            ]);
            // Simulo que el email está deshabilitado por falta de SMTP config.
            servicioNotificacionEmail.enviarResumenCiclo.mockResolvedValue({
                enviado: false,
                deshabilitado: true,
            });

            const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

            await new Promise(resolve => setImmediate(resolve));

            // El ciclo debe completarse exitosamente.
            expect(resultado.exito).toBe(true);
        });
    });

    // === Cron default martes 20:00 ART ===

    describe('Cron default — martes 20:00 ART', () => {
        test('la expresión cron por defecto es martes 20:00 (0 20 * * 2)', () => {
            servicioAutomatizacion.programarCron();

            const expresionUsada = cron.schedule.mock.calls[0][0];
            expect(expresionUsada).toBe('0 20 * * 2');
        });
    });
});