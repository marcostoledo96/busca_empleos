// Tests integrados de flujo para Issue #19 (Tarea T6):
// Verifico los cuatro recorridos integrados obligatorios con simulación sintética completa:
//
// 1. Recorrido A: Scraping sintético de Indeed con dos items con idéntico jk y diferente
//    utm_source -> normalización -> deduplicación intra-ejecución en servicio-scraping ->
//    persistencia aislada -> 1 oferta única en BD y contadores correctos
//    (guardadas: 1, duplicadas: 1, duplicadasDescartadas: 1).
//
// 2. Recorrido B: Oferta persistida con descripción incompleta y postulación cv_enviado ->
//    reaparición sintética con descripción completa -> fecha_extraccion inalterada,
//    fecha_ultima_extraccion actualizada, descripción completada, REEVALUACION_SOLICITADA,
//    estado cv_enviado preservado y elegible para reevaluación.
//
// 3. Recorrido C: Oferta con descripción manual confirmada (origen_descripcion = 'manual')
//    y estado en_proceso -> nueva extracción con texto de scraper -> descripción manual y
//    origen manual preservados, postulación en_proceso inalterada.
//
// 4. Recorrido D: Oferta extraída originalmente hace 40 días que reaparece hoy -> visible
//    en consultas de 30 días basadas en COALESCE(fecha_ultima_extraccion, fecha_extraccion) ->
//    fecha_extraccion inicial preservada hace 40 días.

const mockActorCall = jest.fn();
const mockDatasetListItems = jest.fn();

jest.mock('../../src/config/apify', () => {
    return {
        clienteApify: {
            actor: jest.fn(() => ({
                call: mockActorCall,
            })),
            dataset: jest.fn(() => ({
                listItems: mockDatasetListItems,
            })),
        },
        ACTORES: {
            INDEED: 'actor-indeed-test',
            LINKEDIN: 'actor-linkedin-test',
            COMPUTRABAJO: 'actor-computrabajo-test',
            BUMERAN_WEB: 'actor-bumeran-test',
            GLASSDOOR: 'actor-glassdoor-test',
        },
        TERMINOS_BUSQUEDA_DEFECTO: ['node'],
        construirUrlsLinkedin: jest.fn(() => ['https://www.linkedin.com/jobs/search/?keywords=node']),
        construirUrlsComputrabajo: jest.fn(() => ['https://www.computrabajo.com.ar/trabajo-de-node']),
        construirUrlsBumeran: jest.fn(() => ['https://www.bumeran.com.ar/empleos-busqueda-node.html']),
        formatearTerminoComputrabajo: jest.fn((t) => t),
        REMOTIVE_API_BASE: 'https://remotive.com/api/remote-jobs',
        REMOTEOK_API_BASE: 'https://remoteok.com/api',
        JOOBLE_API_URL: 'https://jooble.org/api/',
        JOOBLE_API_KEY: 'test-key',
    };
});

const pool = require('../../src/config/base-datos');
const modeloOferta = require('../../src/modelos/oferta');
const servicioScraping = require('../../src/servicios/servicio-scraping');
const { guardarLoteOfertasAislado } = require('../../src/servicios/servicio-ingreso-ofertas');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');

const dbTestsPermitidos = process.env.ALLOW_DB_TESTS === 'true';
const entornoSeguro = process.env.NODE_ENV === 'test'
    || (process.env.PGDATABASE || '').includes('test');
const contexto = (dbTestsPermitidos && entornoSeguro) ? describe : describe.skip;

contexto('Issue #19 — Flujo Integrado de Identidad Canónica y Reapariciones', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY CASCADE');
        await pool.end();
    });

    test('Recorrido A: Scraping sintético de Indeed con dos items con mismo jk y distinto tracking genera 1 oferta y contadores correctos', async () => {
        // Simulo dos items de Indeed que comparten el mismo identificador único de empleo (jk=5a8b3c2d1e0f9876)
        // pero difieren en parámetros de tracking como utm_source, utm_campaign y dominio
        const itemIndeedTracking1 = {
            url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&utm_source=jobseeker_emails&utm_medium=email',
            title: 'Desarrollador Backend Node.js',
            employer: { name: 'Empresa Alpha SA' },
            location: { city: 'Buenos Aires', countryName: 'Argentina' },
            description: { text: 'Buscamos desarrollador Backend Node.js con sólida experiencia en PostgreSQL y APIs REST.' },
            datePublished: '2026-10-15T10:00:00.000Z',
            baseSalary: { min: 1500000, max: 2200000, currencyCode: 'ARS' },
        };

        const itemIndeedTracking2 = {
            url: 'https://ar.indeed.com/rc/clk?jk=5a8b3c2d1e0f9876&utm_source=push_notification&utm_campaign=daily_alert',
            title: 'Desarrollador Backend Node.js',
            employer: { name: 'Empresa Alpha SA' },
            location: { city: 'Buenos Aires', countryName: 'Argentina' },
            description: { text: 'Buscamos desarrollador Backend Node.js con sólida experiencia en PostgreSQL y APIs REST.' },
            datePublished: '2026-10-15T10:00:00.000Z',
            baseSalary: { min: 1500000, max: 2200000, currencyCode: 'ARS' },
        };

        mockActorCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-indeed-sintetico-1' });
        mockDatasetListItems.mockResolvedValueOnce({
            items: [itemIndeedTracking1, itemIndeedTracking2],
        });

        // 1. Ejecuto el scraping sintético de Indeed
        const ofertasExtraidas = await servicioScraping.ejecutarScrapingIndeed({
            maxResultados: 10,
            terminos: ['node'],
        });

        // Verifico deduplicación intra-ejecución en memoria
        expect(ofertasExtraidas).toHaveLength(1);
        expect(ofertasExtraidas.duplicadasDescartadas).toBe(1);
        expect(ofertasExtraidas.metricas.duplicadasDescartadas).toBe(1);
        expect(ofertasExtraidas[0].identidad_canonica).toBe('indeed:5a8b3c2d1e0f9876');

        // 2. Persistencia inicial mediante guardarLoteOfertasAislado
        const resultadoPersistenciaInicial = await guardarLoteOfertasAislado(ofertasExtraidas, modeloOferta);

        expect(resultadoPersistenciaInicial.guardadas).toBe(1);
        expect(resultadoPersistenciaInicial.duplicadas).toBe(0);
        expect(resultadoPersistenciaInicial.errores).toBe(0);

        // Verifico que en base de datos haya exactamente 1 oferta insertada
        const conteoDb = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas');
        expect(conteoDb.rows[0].total).toBe(1);

        const ofertaEnDb = (await pool.query('SELECT * FROM ofertas WHERE identidad_canonica = $1', ['indeed:5a8b3c2d1e0f9876'])).rows[0];
        expect(ofertaEnDb).toBeDefined();
        expect(ofertaEnDb.titulo).toBe('Desarrollador Backend Node.js');
        expect(ofertaEnDb.url).toBe('https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876');

        // 3. Simulo una segunda extracción donde reaparece la oferta
        const resultadoSegundaPersistencia = await guardarLoteOfertasAislado(ofertasExtraidas, modeloOferta);

        // Verifico los contadores de persistencia por reaparición
        expect(resultadoSegundaPersistencia.guardadas).toBe(0);
        expect(resultadoSegundaPersistencia.reapariciones).toBe(1);
        expect(resultadoSegundaPersistencia.duplicadas).toBe(1);
        expect(resultadoSegundaPersistencia.errores).toBe(0);

        // Verifico que la base de datos siga teniendo exactamente una oferta única
        const conteoDbFinal = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas');
        expect(conteoDbFinal.rows[0].total).toBe(1);

        // Verifico el cumplimiento conjunto de las métricas requeridas:
        // - guardadas: 1 (primera persistencia)
        // - duplicadas: 1 (segunda persistencia por reaparición)
        // - duplicadasDescartadas: 1 (deduplicación intra-ejecución en memoria)
        expect(resultadoPersistenciaInicial.guardadas).toBe(1);
        expect(resultadoSegundaPersistencia.duplicadas).toBe(1);
        expect(ofertasExtraidas.duplicadasDescartadas).toBe(1);
    });

    test('Recorrido B: Reaparición con descripción completa preserva fecha_extraccion y postulación cv_enviado, actualiza fecha_ultima_extraccion y marca REEVALUACION_SOLICITADA', async () => {
        // 1. Inserción inicial de una oferta con descripción corta o incompleta
        const ofertaInicial = {
            titulo: 'Desarrollador Backend Node.js Junior',
            empresa: 'Startup Beta SAS',
            ubicacion: 'Buenos Aires, Argentina',
            modalidad: 'remoto',
            descripcion: 'Descripción corta.',
            url: 'https://ar.indeed.com/viewjob?jk=9f8e7d6c5b4a3210',
            plataforma: 'indeed',
            origen_descripcion: 'scraper',
            descripcion_completitud: 'parcial',
        };

        const resInicial = await guardarLoteOfertasAislado([ofertaInicial], modeloOferta);
        expect(resInicial.guardadas).toBe(1);

        const ofertaCreada = (await pool.query('SELECT * FROM ofertas WHERE identidad_canonica = $1', ['indeed:9f8e7d6c5b4a3210'])).rows[0];
        expect(ofertaCreada).toBeDefined();

        // El usuario envía CV y marcamos manualmente la postulación como cv_enviado
        await modeloOferta.actualizarPostulacion(ofertaCreada.id, 'cv_enviado');

        // Simulo que la primera detección ocurrió hace 4 días en el pasado
        await pool.query(
            `UPDATE ofertas
             SET fecha_extraccion = NOW() - INTERVAL '4 days',
                 fecha_ultima_extraccion = NOW() - INTERVAL '4 days'
             WHERE id = $1`,
            [ofertaCreada.id]
        );

        const ofertaAntesDeReaparicion = await modeloOferta.obtenerOfertaPorId(ofertaCreada.id);
        const fechaExtraccionOriginal = new Date(ofertaAntesDeReaparicion.fecha_extraccion).toISOString();
        const fechaUltimaExtraccionOriginal = new Date(ofertaAntesDeReaparicion.fecha_ultima_extraccion).getTime();

        // 2. Segunda extracción sintética con descripción completa
        const descripcionLarga = 'Buscamos Desarrollador Backend Node.js Junior con sólida formación en Express, JavaScript moderno, consultas PostgreSQL parametrizadas, Git y patrones de diseño limpios.';
        const itemSinteticoCompleto = {
            url: 'https://ar.indeed.com/viewjob?jk=9f8e7d6c5b4a3210&utm_source=alert_email',
            title: 'Desarrollador Backend Node.js Junior',
            employer: { name: 'Startup Beta SAS' },
            location: { city: 'Buenos Aires', countryName: 'Argentina' },
            description: { text: descripcionLarga },
            datePublished: '2026-10-15T11:00:00.000Z',
        };

        mockActorCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-indeed-sintetico-2' });
        mockDatasetListItems.mockResolvedValueOnce({ items: [itemSinteticoCompleto] });

        const loteScraping = await servicioScraping.ejecutarScrapingIndeed({ maxResultados: 10 });
        expect(loteScraping).toHaveLength(1);

        const resReaparicion = await guardarLoteOfertasAislado(loteScraping, modeloOferta);
        expect(resReaparicion.actualizadas).toBe(1);
        expect(resReaparicion.duplicadas).toBe(1);
        expect(resReaparicion.guardadas).toBe(0);

        // 3. Verificaciones en base de datos tras la reaparición
        const ofertaActualizada = await modeloOferta.obtenerOfertaPorId(ofertaCreada.id);

        // fecha_extraccion original se mantiene inalterada
        expect(new Date(ofertaActualizada.fecha_extraccion).toISOString()).toBe(fechaExtraccionOriginal);

        // fecha_ultima_extraccion se actualizó a un timestamp posterior
        expect(new Date(ofertaActualizada.fecha_ultima_extraccion).getTime()).toBeGreaterThan(fechaUltimaExtraccionOriginal);

        // La descripción fue completada con el texto enriquecido
        expect(ofertaActualizada.descripcion).toBe(descripcionLarga);

        // Se solicita reevaluación por cambio de contenido relevante
        expect(ofertaActualizada.estado_evaluacion).toBe('pendiente');
        expect(ofertaActualizada.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');

        // El estado de postulación manual cv_enviado se preserva intacto sin sobrescribirse
        expect(ofertaActualizada.estado_postulacion).toBe('cv_enviado');

        // Es elegible para reevaluación explícita
        const ofertasPendientes = await modeloOferta.obtenerOfertasPendientes();
        const ofertaEnPendientes = ofertasPendientes.find(o => o.id === ofertaCreada.id);
        expect(ofertaEnPendientes).toBeDefined();
        expect(ofertaEnPendientes.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');
    });

    test('Recorrido C: Oferta con descripción manual confirmada y estado en_proceso no es sobrescrita por extracciones del scraper', async () => {
        // 1. Inserción inicial de oferta
        const ofertaBase = {
            titulo: 'Desarrollador Full Stack',
            empresa: 'Consultora Gama',
            ubicacion: 'CABA, Argentina',
            modalidad: 'presencial',
            descripcion: 'Texto básico del portal.',
            url: 'https://ar.indeed.com/viewjob?jk=1234567890abcdef',
            plataforma: 'indeed',
        };

        const resInicial = await guardarLoteOfertasAislado([ofertaBase], modeloOferta);
        expect(resInicial.guardadas).toBe(1);

        const creada = (await pool.query('SELECT * FROM ofertas WHERE identidad_canonica = $1', ['indeed:1234567890abcdef'])).rows[0];

        // El usuario ingresa una descripción manual y actualiza la postulación a en_proceso
        const descripcionManual = 'Descripción completada minuciosamente por el usuario tras entrevista telefónica.';
        await modeloOferta.actualizarDescripcionManual(creada.id, descripcionManual);
        await modeloOferta.actualizarPostulacion(creada.id, 'en_proceso');

        const antesDeScraper = await modeloOferta.obtenerOfertaPorId(creada.id);
        expect(antesDeScraper.origen_descripcion).toBe('manual');
        expect(antesDeScraper.descripcion).toBe(descripcionManual);
        expect(antesDeScraper.estado_postulacion).toBe('en_proceso');

        // 2. Nueva extracción sintética con un texto de scraper más largo
        const textoScraperNuevo = 'Texto nuevo mucho más extenso proveniente de Apify que bajo ninguna circunstancia debe pisar una descripción manual confirmada por el usuario.';
        const itemNuevoScraper = {
            url: 'https://ar.indeed.com/viewjob?jk=1234567890abcdef&utm_source=feed',
            title: 'Desarrollador Full Stack Modificado',
            employer: { name: 'Consultora Gama' },
            location: { city: 'CABA', countryName: 'Argentina' },
            description: { text: textoScraperNuevo },
            datePublished: '2026-10-15T15:00:00.000Z',
        };

        mockActorCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-indeed-sintetico-3' });
        mockDatasetListItems.mockResolvedValueOnce({ items: [itemNuevoScraper] });

        const scrapingNuevo = await servicioScraping.ejecutarScrapingIndeed({ maxResultados: 10 });
        const resPersistencia = await guardarLoteOfertasAislado(scrapingNuevo, modeloOferta);

        expect(resPersistencia.duplicadas).toBe(1);

        // 3. Verifico que en base de datos no se haya sobrescrito la descripción ni el origen ni el estado
        const despuesDeScraper = await modeloOferta.obtenerOfertaPorId(creada.id);

        expect(despuesDeScraper.descripcion).toBe(descripcionManual);
        expect(despuesDeScraper.origen_descripcion).toBe('manual');
        expect(despuesDeScraper.estado_postulacion).toBe('en_proceso');
    });

    test('Recorrido D (Ventana de visibilidad): Oferta extraída hace 40 días que reaparece hoy es visible en consultas de 30 días basadas en COALESCE', async () => {
        // 1. Inserción inicial de una oferta
        const ofertaAntigua = {
            titulo: 'Desarrollador QA Automation Senior',
            empresa: 'Empresa Delta',
            ubicacion: 'Remoto, Argentina',
            modalidad: 'remoto',
            descripcion: 'Buscamos especialista en Cypress, Playwright y pruebas de integración backend.',
            url: 'https://ar.indeed.com/viewjob?jk=abcdef0123456789',
            plataforma: 'indeed',
        };

        const resInicial = await guardarLoteOfertasAislado([ofertaAntigua], modeloOferta);
        expect(resInicial.guardadas).toBe(1);

        const ofertaEnDb = (await pool.query('SELECT * FROM ofertas WHERE identidad_canonica = $1', ['indeed:abcdef0123456789'])).rows[0];

        // Simulo que la oferta fue extraída originalmente hace 40 días
        await pool.query(
            `UPDATE ofertas
             SET fecha_extraccion = NOW() - INTERVAL '40 days',
                 fecha_ultima_extraccion = NOW() - INTERVAL '40 days'
             WHERE id = $1`,
            [ofertaEnDb.id]
        );

        // Verifico que queda excluida de la ventana activa de 30 días
        const listadoAntes = await modeloOferta.obtenerOfertas({ limite_pagina: 50 });
        const visibleAntes = listadoAntes.ofertas.some(o => o.id === ofertaEnDb.id);
        expect(visibleAntes).toBe(false);

        // 2. La oferta reaparece hoy en una nueva extracción sintética
        const itemReaparicionHoy = {
            url: 'https://ar.indeed.com/viewjob?jk=abcdef0123456789&utm_source=direct',
            title: 'Desarrollador QA Automation Senior',
            employer: { name: 'Empresa Delta' },
            location: { city: 'Remoto', countryName: 'Argentina' },
            description: { text: 'Buscamos especialista en Cypress, Playwright y pruebas de integración backend.' },
            datePublished: '2026-10-15T09:00:00.000Z',
        };

        mockActorCall.mockResolvedValueOnce({ defaultDatasetId: 'dataset-indeed-sintetico-4' });
        mockDatasetListItems.mockResolvedValueOnce({ items: [itemReaparicionHoy] });

        const loteReaparicion = await servicioScraping.ejecutarScrapingIndeed({ maxResultados: 10 });
        const resReaparicion = await guardarLoteOfertasAislado(loteReaparicion, modeloOferta);

        expect(resReaparicion.reapariciones).toBe(1);
        expect(resReaparicion.duplicadas).toBe(1);

        // 3. Verificaciones en la base de datos
        const ofertaRevivida = await modeloOferta.obtenerOfertaPorId(ofertaEnDb.id);

        // fecha_extraccion inicial se mantiene hace 40 días
        const milisegundosEnDia = 1000 * 60 * 60 * 24;
        const antiguedadDias = Math.round((Date.now() - new Date(ofertaRevivida.fecha_extraccion).getTime()) / milisegundosEnDia);
        expect(antiguedadDias).toBeGreaterThanOrEqual(39);

        // fecha_ultima_extraccion es de hoy (hace menos de 10 minutos)
        const minutosDesdeUltimaExtraccion = (Date.now() - new Date(ofertaRevivida.fecha_ultima_extraccion).getTime()) / (1000 * 60);
        expect(minutosDesdeUltimaExtraccion).toBeLessThan(10);

        // La oferta ahora es perfectamente visible en consultas de 30 días basadas en COALESCE(fecha_ultima_extraccion, fecha_extraccion)
        const listadoDespues = await modeloOferta.obtenerOfertas({ limite_pagina: 50 });
        const visibleDespues = listadoDespues.ofertas.some(o => o.id === ofertaEnDb.id);
        expect(visibleDespues).toBe(true);

        // También se computa en las estadísticas de 30 días
        const estadisticas = await modeloOferta.obtenerEstadisticas();
        expect(estadisticas.total).toBeGreaterThanOrEqual(1);
    });
});
