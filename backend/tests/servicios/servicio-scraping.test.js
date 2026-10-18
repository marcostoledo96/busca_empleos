// Tests del servicio de scraping.
// Estos tests MOCKEAN el cliente de Apify para no gastar plata ni depender
// de la red en cada test. Lo que verifico es la LÓGICA del servicio:
// - ¿Construye bien los inputs para cada actor?
// - ¿Procesa correctamente los resultados?
// - ¿Maneja errores de la API?
//
// ¿Qué es un mock? Es un "doble" (como un doble de riesgo en cine).
// En vez de llamar a la API real de Apify, le digo a Jest:
// "cuando alguien llame a esta función, devolvé ESTO".
// Así puedo testear mi lógica sin efectos secundarios.

// Mockeo todo el módulo de configuración de Apify.
// Jest reemplaza las funciones reales con versiones controladas.
jest.mock('../../src/config/apify', () => {
    // Creo funciones mock que puedo controlar desde los tests.
    const mockCall = jest.fn();
    // Completo las fixtures legacy con el estado terminal que entrega Apify 2.x.
    const resolverCall = mockCall.mockResolvedValue.bind(mockCall);
    mockCall.mockResolvedValue = valor => resolverCall({ status: 'SUCCEEDED', ...valor });
    const mockListItems = jest.fn();

    return {
        clienteApify: {
            actor: jest.fn(() => ({
                call: mockCall,
            })),
            dataset: jest.fn(() => ({
                listItems: mockListItems,
            })),
        },
        ACTORES: {
            LINKEDIN: 'actor-linkedin-test',
            COMPUTRABAJO: 'actor-computrabajo-test',
            INDEED: 'actor-indeed-test',
            BUMERAN_WEB: 'actor-puppeteer-scraper-test',
            GLASSDOOR: 'actor-glassdoor-test',
        },
        TERMINOS_BUSQUEDA: [
            'tester',
            'qa',
            'it',
            'soporte it',
            'helpdesk',
            'desarrollador',
            'developer',
            'frontend',
            'soporte tecnico',
        ],
        // El servicio importa TERMINOS_BUSQUEDA_DEFECTO — alias necesario para el mock.
        TERMINOS_BUSQUEDA_DEFECTO: [
            'tester',
            'qa',
            'it',
            'soporte it',
            'helpdesk',
            'desarrollador',
            'developer',
            'frontend',
            'soporte tecnico',
        ],
        construirUrlsLinkedin: jest.fn(() => [
            'https://www.linkedin.com/jobs/search/?keywords=frontend+developer+junior&location=Argentina&f_E=1%2C2&f_TPR=r1209600',
        ]),
        formatearTerminoComputrabajo: jest.requireActual('../../src/config/apify').formatearTerminoComputrabajo,
        construirUrlsComputrabajo: jest.fn(() => [
            'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
        ]),
        construirUrlsBumeran: jest.fn(() => [
            'https://www.bumeran.com.ar/empleos-busqueda-frontend-developer-junior.html',
        ]),
        GETONBRD_API_BASE: 'https://www.getonbrd.com/api/v0',
        construirUrlsGetonbrd: jest.fn(() => [
            'https://www.getonbrd.com/api/v0/search/jobs?query=frontend+developer&page=1',
        ]),
        JOOBLE_API_URL: 'https://jooble.org/api/',
        JOOBLE_API_KEY: 'api-key-de-prueba',
        REMOTEOK_API_BASE: 'https://remoteok.com/api',
        REMOTIVE_API_BASE: 'https://remotive.com/api',
    };
});

const { clienteApify } = require('../../src/config/apify');
const {
    ejecutarScrapingLinkedin,
    ejecutarScrapingComputrabajo,
    ejecutarScrapingIndeed,
    ejecutarScrapingBumeran,
    ejecutarScrapingGlassdoor,
    ejecutarScrapingGetonbrd,
    ejecutarScrapingJooble,
    ejecutarScrapingInfojobs,
    ejecutarScrapingGoogleJobs,
    ejecutarScrapingRemotive,
    ejecutarScrapingRemoteOK,
    ejecutarScrapingAdzuna,
    _filtrarPorVentanaPublicacion,
    consolidarOfertaDuplicada,
    deduplicarYConsolidarLote,
} = require('../../src/servicios/servicio-scraping');

// Datos de prueba que simulan la respuesta de los actores.
const itemsLinkedinFalsos = [
    {
        id: '12345',
        link: 'https://linkedin.com/jobs/view/test-job-12345',
        title: 'Frontend Developer Junior',
        companyName: 'TestCorp',
        location: 'Buenos Aires, Argentina',
        postedAt: '2026-03-20T10:00:00.000Z',
        descriptionText: 'Buscamos frontend developer junior con React...',
        salary: '',
        seniorityLevel: 'Entry level',
        employmentType: 'Full-time',
        workRemoteAllowed: true,
        country: 'AR',
    },
];

const itemsComputrabajoFalsos = [
    {
        id: 'ABC123',
        title: 'Desarrollador Web Junior',
        company: 'EmpresaTest',
        location: 'CABA',
        postedDate: '2026-03-15T09:00:00',
        descriptionText: 'Se busca desarrollador web con conocimientos en HTML, CSS, JS...',
        url: 'https://ar.computrabajo.com/oferta-test-ABC123',
        offerAttributes: {},
        scrapedAt: '2026-03-31T10:00:00.000Z',
    },
];

// Datos de prueba que simulan la respuesta del actor de Indeed Argentina.
const itemsIndeedFalsos = [
    {
        key: 'test-indeed-123',
        url: 'https://ar.indeed.com/viewjob?jk=test-indeed-123',
        title: 'Frontend Developer Junior',
        jobUrl: 'http://ar.indeed.com/job/frontend-developer-junior-test-indeed-123',
        datePublished: '2026-03-28T12:00:00.000Z',
        language: 'es',
        location: {
            countryName: 'Argentina',
            countryCode: 'AR',
            city: 'Buenos Aires',
        },
        employer: {
            name: 'TestCorp Argentina',
        },
        attributes: {},
        baseSalary: null,
        description: {
            text: 'Buscamos frontend developer junior con React y Angular...',
        },
    },
];

// Datos de prueba que simulan lo que extrae la pageFunction del cheerio-scraper
// desde la página de búsqueda de Bumeran.
const itemsBumeranFalsos = [
    {
        url: 'https://www.bumeran.com.ar/empleos/frontend-developer-junior-testcorp-1118200001.html',
        titulo: 'Frontend Developer Junior',
        empresa: 'TestCorp Argentina',
        ubicacion: 'Capital Federal, Buenos Aires',
        modalidad: 'Remoto',
        descripcion: 'Buscamos frontend developer junior con experiencia en React...',
    },
];

describe('Servicio de scraping', () => {
    const tokenOriginal = process.env.APIFY_TOKEN;
    afterAll(() => {
        if (tokenOriginal === undefined) delete process.env.APIFY_TOKEN;
        else process.env.APIFY_TOKEN = tokenOriginal;
    });

    beforeEach(() => {
        // Limpio los mocks antes de cada test para evitar contaminación.
        jest.clearAllMocks();
        process.env.APIFY_TOKEN = 'token-sintetico';
    });

    test.each([
        ['computrabajo', ejecutarScrapingComputrabajo], ['indeed', ejecutarScrapingIndeed],
        ['bumeran', ejecutarScrapingBumeran], ['jooble', ejecutarScrapingJooble], ['adzuna', ejecutarScrapingAdzuna],
    ])('%s rechaza consultas sin contenido tras transformar antes de llamar al proveedor', async (id, ejecutar) => {
        const fetchOriginal = global.fetch;
        const fetchSimulado = jest.fn();
        global.fetch = fetchSimulado;
        try {
            await expect(ejecutar({ terminos: ['###'] })).rejects.toMatchObject({ statusCode: 400 });
            expect(fetchSimulado).not.toHaveBeenCalled();
            expect(clienteApify.actor).not.toHaveBeenCalled();
        } finally {
            global.fetch = fetchOriginal;
        }
    });

    describe('ejecutarScrapingLinkedin()', () => {

        test('llama al actor correcto con las URLs de búsqueda', async () => {
            // Configuro los mocks para simular una ejecución exitosa.
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsLinkedinFalsos });

            await ejecutarScrapingLinkedin();

            // Verifico que se llamó al actor de LinkedIn.
            expect(clienteApify.actor).toHaveBeenCalledWith('actor-linkedin-test');
        });

        test('retorna ofertas normalizadas', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsLinkedinFalsos });

            const resultado = await ejecutarScrapingLinkedin();

            // Verifico que retorna ofertas normalizadas (no datos crudos).
            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBeGreaterThan(0);
            expect(resultado[0].plataforma).toBe('linkedin');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
        });

        test('pasa urls, count y scrapeCompany al actor restaurado', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsLinkedinFalsos });

            await ejecutarScrapingLinkedin({ maxResultados: 50 });

            // Verifico que se pasó el input correcto al actor restaurado
            // (curious_coder/linkedin-jobs-scraper — hKByXkMQaC5Qt9UMN).
            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    urls: expect.any(Array),
                    count: 50,
                    scrapeCompany: false,
                }),
                expect.objectContaining({ timeout: 120, waitSecs: 1 })
            );

            const inputLlamada = mockCall.mock.calls[0][0];
            expect(inputLlamada.urls[0]).toContain('f_TPR=r1209600');
        });

        test('pasa filtrarNivelLinkedin a construirUrlsLinkedin al ejecutar scraping', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-123' });
            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsLinkedinFalsos });

            const { construirUrlsLinkedin } = require('../../src/config/apify');
            construirUrlsLinkedin.mockClear();

            await ejecutarScrapingLinkedin({ filtrarNivelLinkedin: false });

            expect(construirUrlsLinkedin).toHaveBeenCalledWith(
                expect.objectContaining({ filtrarNivelLinkedin: false })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('API rate limit exceeded'));

            const resultado = await ejecutarScrapingLinkedin();
            expect(resultado).toEqual([]);
            expect(resultado.metricas.estado).toBe('error');
        });

        test('deduplica intra-ejecución dos items con el mismo job ID en formatos distintos', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-dups' });

            const itemLinkedin1 = {
                id: '123456789',
                link: 'https://www.linkedin.com/jobs/view/123456789',
                title: 'Frontend Developer Junior',
                companyName: 'LinkedIn Corp',
                descriptionText: 'Puesto de desarrollador frontend React...',
            };
            const itemLinkedin2 = {
                jobId: '123456789',
                jobUrl: 'https://www.linkedin.com/jobs/view/frontend-developer-123456789?refId=tracker123&trackingId=abc',
                jobTitle: 'Frontend Developer Junior',
                companyName: 'LinkedIn Corp',
                jobDescription: 'Puesto de desarrollador frontend React...',
            };

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: [itemLinkedin1, itemLinkedin2] });

            const resultado = await ejecutarScrapingLinkedin();

            expect(resultado).toHaveLength(1);
            expect(resultado[0].identidad_canonica).toBe('linkedin:123456789');
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.duplicadasDescartadas).toBe(1);
            expect(resultado.metricas.totalElegibles).toBe(1);
        });

        test('dos ofertas con IDs distintos permanecen separadas y no se descartan', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-distintos' });

            const itemLinkedin1 = {
                id: '123456789',
                link: 'https://www.linkedin.com/jobs/view/123456789',
                title: 'Frontend Developer Junior',
                companyName: 'LinkedIn Corp',
                descriptionText: 'Puesto de desarrollador frontend React...',
            };
            const itemLinkedin2 = {
                id: '987654321',
                link: 'https://www.linkedin.com/jobs/view/987654321',
                title: 'Backend Developer Junior',
                companyName: 'LinkedIn Corp',
                descriptionText: 'Puesto de desarrollador backend Node.js...',
            };

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: [itemLinkedin1, itemLinkedin2] });

            const resultado = await ejecutarScrapingLinkedin();

            expect(resultado).toHaveLength(2);
            expect(resultado[0].identidad_canonica).toBe('linkedin:123456789');
            expect(resultado[1].identidad_canonica).toBe('linkedin:987654321');
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.duplicadasDescartadas).toBe(0);
            expect(resultado.metricas.totalElegibles).toBe(2);
        });
    });

    describe('ejecutarScrapingComputrabajo()', () => {

        // HTML mínimo que simula una página de listado de Computrabajo.
        const htmlListadoFalso = `
            <html><body>
                <article class="box_offer">
                    <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-de-trabajo-de-desarrollador-web-junior-ABCDEF12345678">Desarrollador Web Junior</a></h2>
                    <p class="fs16 fc_base mt5">EmpresaTest <span class="mr10">CABA</span></p>
                    <p class="fs13 fc_aux mt15">Hace 3 días</p>
                </article>
            </body></html>
        `;

        // HTML mínimo que simula una página de detalle de una oferta en Computrabajo.
        const htmlDetalleFalso = `
            <html><body>
                <h1 class="fwB">Desarrollador Web Junior</h1>
                <p class="mbB">Se busca desarrollador web con conocimientos en HTML, CSS y JavaScript.</p>
                <div class="mbB">
                    <span class="tag base mb10">Jornada completa</span>
                    <span class="tag base mb10">Presencial y remoto</span>
                </div>
                <p class="fc_aux fs13">Hace 3 días</p>
            </body></html>
        `;

        beforeEach(() => {
            global.fetch = jest.fn();
        });

        afterEach(() => {
            delete global.fetch;
        });

        test('fetchea la URL de búsqueda correcta', async () => {
            // Todas las llamadas (listado + detalles) devuelven HTML válido.
            global.fetch.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue(htmlListadoFalso),
            });

            await ejecutarScrapingComputrabajo({ terminos: ['frontend developer junior'] });

            // La primera llamada debe ser a la URL construida por construirUrlsComputrabajo().
            expect(global.fetch).toHaveBeenNthCalledWith(
                1,
                'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                expect.any(Object)
            );
        });

        test('retorna ofertas normalizadas de Computrabajo', async () => {
            // Primera llamada: listado. Siguientes: detalle de cada oferta.
            global.fetch
                .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(htmlListadoFalso) })
                .mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue(htmlDetalleFalso) });

            const resultado = await ejecutarScrapingComputrabajo({ terminos: ['frontend developer junior'] });

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBeGreaterThan(0);
            expect(resultado[0].plataforma).toBe('computrabajo');
            expect(resultado[0].titulo).toBe('Desarrollador Web Junior');
        });

        test('tira error descriptivo si fetch lanza excepción', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const resultado = await ejecutarScrapingComputrabajo();
            expect(resultado).toEqual([]);
            expect(resultado.metricas.estado).toBe('error');
        });

        test('deduplica tempranamente con Set evitando llamadas redundantes de detalle', async () => {
            const htmlConDuplicadas = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-repetida">Dev Duplicado</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaTest <span class="mr10">CABA</span></p>
                    </article>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-repetida">Dev Duplicado</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaTest <span class="mr10">CABA</span></p>
                    </article>
                </body></html>
            `;
            const htmlVacio = '<html><body></body></html>';

            global.fetch
                .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(htmlConDuplicadas) })
                .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(htmlVacio) })
                .mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue(htmlDetalleFalso) });

            const resultado = await ejecutarScrapingComputrabajo({ terminos: ['frontend'], maxResultados: 10 });

            expect(resultado.length).toBe(1);
            expect(resultado.metricas.duplicadasDescartadas).toBe(1);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        test('paginación acotada con p=2 cuando maxResultados supera la capacidad de una página', async () => {
            const htmlPagina1 = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-p1">Dev P1</a></h2>
                    </article>
                </body></html>
            `;
            const htmlPagina2 = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-p2">Dev P2</a></h2>
                    </article>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => htmlPagina2 };
                }
                if (url.includes('trabajo-de-frontend')) {
                    return { ok: true, text: async () => htmlPagina1 };
                }
                return { ok: true, text: async () => htmlDetalleFalso };
            });

            const resultado = await ejecutarScrapingComputrabajo({
                terminos: ['frontend'],
                maxResultados: 2,
            });

            expect(resultado.length).toBe(2);
            const urlsLlamadas = global.fetch.mock.calls.map(c => c[0]);
            expect(urlsLlamadas.some(u => u.includes('p=2'))).toBe(true);
        });

        test('50 tarjetas antiguas en listado no bloquean segundo término y segundo término aporta ofertas útiles', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            const html50TarjetasAntiguas = `
                <html><body>
                    ${Array.from({ length: 50 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-vieja-${i}">Tester Viejo ${i}</a></h2>
                            <p class="fs16 fc_base mt5">EmpresaVieja <span class="mr10">CABA</span></p>
                            <p class="fs13 fc_aux mt15">Hace 2 meses</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;

            const htmlTarjetaReciente = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-angular-nueva">Desarrollador Angular Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaNueva <span class="mr10">CABA</span></p>
                        <p class="fs13 fc_aux mt15">Hace 2 días</p>
                    </article>
                </body></html>
            `;

            const htmlDetalleAngular = `
                <html><body>
                    <h1 class="fwB">Desarrollador Angular Junior</h1>
                    <p class="mbB">Buscamos desarrollador junior con conocimientos de Angular y TypeScript para nuestro equipo.</p>
                    <p class="fc_aux fs13">Hace 2 días</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-tester')) {
                    return { ok: true, text: async () => html50TarjetasAntiguas };
                }
                if (url.includes('trabajo-de-angular')) {
                    return { ok: true, text: async () => htmlTarjetaReciente };
                }
                return { ok: true, text: async () => htmlDetalleAngular };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester', 'angular'],
                    maxResultados: 10,
                });

                expect(resultado.length).toBe(1);
                expect(resultado[0].titulo).toBe('Desarrollador Angular Junior');
                expect(resultado.metricas.consultasEjecutadas).toBe(2);
                expect(resultado.metricas.antiguasDescartadas).toBe(50);
                expect(resultado.metricas.totalCrudos).toBe(51);
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('50 tarjetas con descripción en inglés en primer término no agotan cupo ni bloquean segundo término en español', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            const html50TarjetasTester = `
                <html><body>
                    ${Array.from({ length: 50 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-tester-${i}">QA Tester ${i}</a></h2>
                            <p class="fs16 fc_base mt5">EmpresaGlobal <span class="mr10">Remoto</span></p>
                            <p class="fs13 fc_aux mt15">Hace 2 días</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;

            const htmlDetalleTesterIngles = `
                <html><body>
                    <h1 class="fwB">QA Tester</h1>
                    <p class="mbB">We are seeking a talented and detail-oriented QA Automation Tester fluent in English to join our distributed software team.</p>
                    <p class="fc_aux fs13">Hace 2 días</p>
                </body></html>
            `;

            const htmlTarjetaAngular = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-angular-nueva">Desarrollador Angular Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaLocal <span class="mr10">CABA</span></p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;

            const htmlDetalleAngularEspanol = `
                <html><body>
                    <h1 class="fwB">Desarrollador Angular Junior</h1>
                    <p class="mbB">Buscamos desarrollador junior con conocimientos de Angular y TypeScript para nuestro equipo de producto.</p>
                    <p class="fc_aux fs13">Hace 1 día</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-tester')) {
                    return { ok: true, text: async () => html50TarjetasTester };
                }
                if (url.includes('trabajo-de-angular')) {
                    return { ok: true, text: async () => htmlTarjetaAngular };
                }
                if (url.includes('oferta-tester-')) {
                    return { ok: true, text: async () => htmlDetalleTesterIngles };
                }
                return { ok: true, text: async () => htmlDetalleAngularEspanol };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester', 'angular'],
                    maxResultados: 10,
                });

                expect(resultado.length).toBe(1);
                expect(resultado[0].titulo).toBe('Desarrollador Angular Junior');
                expect(resultado.metricas.consultasEjecutadas).toBe(2);
                expect(resultado.metricas.totalCrudos).toBe(51);
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('termina con motivoFinalizacion limite_paginas cuando alcanza tope de páginas con tarjetas pero no llena maxResultados', async () => {
            const htmlP1 = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-p1">Dev Frontend P1</a></h2>
                        <p class="fs16 fc_base mt5">Empresa 1</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlP2 = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-p2">Dev Frontend P2</a></h2>
                        <p class="fs16 fc_base mt5">Empresa 2</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlDetalle = `
                <html><body>
                    <h1 class="fwB">Dev Frontend</h1>
                    <p class="mbB">Puesto de desarrollador frontend en español para desarrollo web.</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => htmlP2 };
                }
                if (url.includes('trabajo-de-frontend')) {
                    return { ok: true, text: async () => htmlP1 };
                }
                return { ok: true, text: async () => htmlDetalle };
            });

            const resultado = await ejecutarScrapingComputrabajo({
                terminos: ['frontend'],
                maxResultados: 10,
            });

            expect(resultado.length).toBe(2);
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.motivoFinalizacion).toBe('limite_paginas');
        });

        test('con 3 términos, 12 peticiones y 100 tarjetas en inglés en el primero, reserva primera oportunidad a soporte y angular respetando el techo (B-07)', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            // Listado grande con 100 tarjetas en tester con detalle en inglés
            const html100TarjetasTester = `
                <html><body>
                    ${Array.from({ length: 100 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-tester-${i}">Tester ${i}</a></h2>
                            <p class="fs16 fc_base mt5">EmpresaTester</p>
                            <p class="fs13 fc_aux mt15">Hace 2 días</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;
            const htmlDetalleTesterIngles = `
                <html><body>
                    <h1 class="fwB">QA Tester</h1>
                    <p class="mbB">We are looking for a QA Automation Tester. You will work with our distributed engineering team.</p>
                </body></html>
            `;

            const htmlTarjetasSoporte = `
                <html><body>
                    ${Array.from({ length: 10 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-soporte-${i}">Soporte Técnico ${i}</a></h2>
                            <p class="fs16 fc_base mt5">EmpresaSoporte</p>
                            <p class="fs13 fc_aux mt15">Hace 2 días</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;
            const htmlDetalleSoporteIngles = `
                <html><body>
                    <h1 class="fwB">IT Support</h1>
                    <p class="mbB">We are looking for an IT Support Specialist. You will work with our global helpdesk team.</p>
                </body></html>
            `;

            const htmlTarjetasAngular = `
                <html><body>
                    ${Array.from({ length: 10 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-angular-${i}">${i === 0 ? 'Desarrollador Angular Junior' : `Angular ${i}`}</a></h2>
                            <p class="fs16 fc_base mt5">EmpresaAngular</p>
                            <p class="fs13 fc_aux mt15">Hace 2 días</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;
            const htmlDetalleAngularEspanol = `
                <html><body>
                    <h1 class="fwB">Desarrollador Angular Junior</h1>
                    <p class="mbB">Buscamos desarrollador junior de Angular y TypeScript para desarrollo web en español.</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-tester')) {
                    return { ok: true, text: async () => html100TarjetasTester };
                }
                if (url.includes('trabajo-de-soporte')) {
                    return { ok: true, text: async () => htmlTarjetasSoporte };
                }
                if (url.includes('trabajo-de-angular')) {
                    return { ok: true, text: async () => htmlTarjetasAngular };
                }
                if (url.includes('oferta-tester-')) {
                    return { ok: true, text: async () => htmlDetalleTesterIngles };
                }
                if (url.includes('oferta-soporte-')) {
                    return { ok: true, text: async () => htmlDetalleSoporteIngles };
                }
                if (url.includes('oferta-angular-0')) {
                    return { ok: true, text: async () => htmlDetalleAngularEspanol };
                }
                return { ok: true, text: async () => htmlDetalleTesterIngles };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester', 'soporte', 'angular'],
                    maxResultados: 50,
                    maxPeticiones: 12,
                });

                // Techo estricto de fetch <= 12
                expect(global.fetch.mock.calls.length).toBeLessThanOrEqual(12);
                expect(resultado.metricas.peticionesRealizadas).toBeLessThanOrEqual(12);
                // Primera oportunidad garantizada: se visitaron los 3 términos iniciales
                expect(resultado.metricas.consultasEjecutadas).toBe(3);
                expect(resultado.metricas.consultasOmitidas).toBe(0);
                // Se obtuvo la oferta útil de angular
                expect(resultado.length).toBe(1);
                expect(resultado[0].titulo).toBe('Desarrollador Angular Junior');
                // Al no llenar maxResultados=50 y agotar peticiones, finaliza con limite_peticiones
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_peticiones');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('con dos páginas de un mismo término y maxDetallesPorTermino=10, no supera 10 detalles acumulados entre ambas páginas (B-06)', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            // Página 1 con 15 tarjetas
            const htmlP1 = `
                <html><body>
                    ${Array.from({ length: 15 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-p1-${i}">Puesto P1 ${i}</a></h2>
                            <p class="fs16 fc_base mt5">Empresa P1</p>
                            <p class="fs13 fc_aux mt15">Hace 1 día</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;

            // Página 2 con 15 tarjetas distintas
            const htmlP2 = `
                <html><body>
                    ${Array.from({ length: 15 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-p2-${i}">Puesto P2 ${i}</a></h2>
                            <p class="fs16 fc_base mt5">Empresa P2</p>
                            <p class="fs13 fc_aux mt15">Hace 1 día</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;

            const htmlDetalleIngles = `
                <html><body>
                    <h1 class="fwB">Software Engineer</h1>
                    <p class="mbB">We are looking for a backend engineer. You will work with our distributed team.</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => htmlP2 };
                }
                if (url.includes('trabajo-de-tester')) {
                    return { ok: true, text: async () => htmlP1 };
                }
                return { ok: true, text: async () => htmlDetalleIngles };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester'],
                    maxResultados: 50,
                    maxPeticiones: 30,
                    maxDetallesPorTermino: 10,
                });

                // Debe haber realizado exactamente 1 listado p1 + 10 detalles p1 + 1 listado p2 + 0 detalles p2 = 12 peticiones
                expect(resultado.metricas.peticionesRealizadas).toBe(12);
                expect(global.fetch).toHaveBeenCalledTimes(12);
                // 0 ofertas elegibles porque todas eran en inglés
                expect(resultado.length).toBe(0);
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_paginas');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('con presupuesto de detalles por término (maxDetallesPorTermino), un término con 100 avisos en inglés no agota todas las peticiones y permite que el siguiente término aporte ofertas', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            const html100TarjetasTester = `
                <html><body>
                    ${Array.from({ length: 100 }, (_, i) => `
                        <article class="box_offer">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-tester-${i}">Tester ${i}</a></h2>
                            <p class="fs16 fc_base mt5">EmpresaGlobal</p>
                            <p class="fs13 fc_aux mt15">Hace 1 día</p>
                        </article>
                    `).join('\n')}
                </body></html>
            `;

            const htmlDetalleTesterIngles = `
                <html><body>
                    <h1 class="fwB">Tester</h1>
                    <p class="mbB">We are looking for a software QA engineer fluent in English to join our company.</p>
                </body></html>
            `;

            const htmlTarjetaAngular = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-angular-1">Desarrollador Angular Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaLocal</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;

            const htmlDetalleAngularEspanol = `
                <html><body>
                    <h1 class="fwB">Desarrollador Angular Junior</h1>
                    <p class="mbB">Buscamos desarrollador junior de Angular y TypeScript para desarrollo web en español.</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-tester')) {
                    return { ok: true, text: async () => html100TarjetasTester };
                }
                if (url.includes('trabajo-de-angular')) {
                    return { ok: true, text: async () => htmlTarjetaAngular };
                }
                if (url.includes('oferta-tester-')) {
                    return { ok: true, text: async () => htmlDetalleTesterIngles };
                }
                return { ok: true, text: async () => htmlDetalleAngularEspanol };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester', 'angular'],
                    maxResultados: 1,
                    maxDetallesPorTermino: 10,
                });

                expect(resultado.length).toBe(1);
                expect(resultado[0].titulo).toBe('Desarrollador Angular Junior');
                // 1 listado tester + 10 detalles tester + 1 listado angular + 1 detalle angular = 13 peticiones
                expect(global.fetch).toHaveBeenCalledTimes(13);
                expect(resultado.metricas.consultasEjecutadas).toBe(2);
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_resultados');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('con 3 términos y maxPeticiones=3, no gasta todo el presupuesto en listados huérfanos y recupera la oferta útil (B-08)', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            const htmlTarjetaTester = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-tester-1">Tester QA Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaTester</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlDetalleTester = `
                <html><body>
                    <h1 class="fwB">Tester QA Junior</h1>
                    <p class="mbB">Buscamos tester de software junior para pruebas funcionales y QA en español.</p>
                </body></html>
            `;
            const htmlTarjetaSoporte = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-soporte-1">Soporte Técnico Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaSoporte</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlTarjetaAngular = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-angular-1">Desarrollador Angular Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaAngular</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-tester')) {
                    return { ok: true, text: async () => htmlTarjetaTester };
                }
                if (url.includes('trabajo-de-soporte')) {
                    return { ok: true, text: async () => htmlTarjetaSoporte };
                }
                if (url.includes('trabajo-de-angular')) {
                    return { ok: true, text: async () => htmlTarjetaAngular };
                }
                if (url.includes('oferta-tester-')) {
                    return { ok: true, text: async () => htmlDetalleTester };
                }
                return { ok: true, text: async () => htmlDetalleTester };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester', 'soporte', 'angular'],
                    maxResultados: 50,
                    maxPeticiones: 3,
                });

                // Debe realizar <= 3 peticiones (1 listado de tester + 1 detalle de tester = 2 peticiones)
                expect(resultado.metricas.peticionesRealizadas).toBeLessThanOrEqual(3);
                expect(global.fetch).toHaveBeenCalledTimes(2);
                // No consumió todas las peticiones en listados vacíos/huérfanos: obtuvo la oferta útil
                expect(resultado.length).toBe(1);
                expect(resultado[0].titulo).toBe('Tester QA Junior');
                // Reporta 1 consulta ejecutada y 2 omitidas por presupuesto
                expect(resultado.metricas.consultasEjecutadas).toBe(1);
                expect(resultado.metricas.consultasOmitidas).toBe(2);
                expect(resultado.metricas.consultasOmitidasPorPresupuesto).toEqual(['soporte', 'angular']);
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_peticiones');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('con 100 términos y maxPeticiones=70, planifica consultas útiles y reparte peticiones entre listados y detalles sin gastar todo en listados (B-08)', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            const terminos100 = Array.from({ length: 100 }, (_, i) => `termino-${i}`);
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-termino-')) {
                    const match = url.match(/trabajo-de-termino-(\d+)/);
                    const idx = match ? match[1] : '0';
                    return {
                        ok: true,
                        text: async () => `
                            <html><body>
                                <article class="box_offer">
                                    <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-puesto-${idx}">Puesto Junior ${idx}</a></h2>
                                    <p class="fs16 fc_base mt5">Empresa ${idx}</p>
                                    <p class="fs13 fc_aux mt15">Hace 1 día</p>
                                </article>
                            </body></html>
                        `,
                    };
                }
                if (url.includes('oferta-puesto-')) {
                    const match = url.match(/oferta-puesto-(\d+)/);
                    const idx = match ? match[1] : '0';
                    return {
                        ok: true,
                        text: async () => `
                            <html><body>
                                <h1 class="fwB">Puesto Junior ${idx}</h1>
                                <p class="mbB">Buscamos desarrollador junior para tareas de programación en español.</p>
                            </body></html>
                        `,
                    };
                }
                return {
                    ok: true,
                    text: async () => '<html><body><h1 class="fwB">Puesto</h1><p class="mbB">En español.</p></body></html>',
                };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: terminos100,
                    maxResultados: 50,
                    maxPeticiones: 70,
                });

                // Debe respetar estrictamente el techo de peticiones <= 70
                expect(resultado.metricas.peticionesRealizadas).toBeLessThanOrEqual(70);
                expect(global.fetch.mock.calls.length).toBeLessThanOrEqual(70);
                // Planificó 35 consultas útiles (35 listados + 35 detalles = 70 peticiones), recuperando 35 ofertas
                expect(resultado.metricas.peticionesRealizadas).toBe(70);
                expect(resultado.length).toBe(35);
                expect(resultado.metricas.consultasEjecutadas).toBe(35);
                expect(resultado.metricas.consultasOmitidas).toBe(65);
                expect(resultado.metricas.consultasOmitidasPorPresupuesto.length).toBe(65);
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_peticiones');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('con primer término dando HTTP 500 y maxPeticiones=3, repone dinámicamente el siguiente término y recupera la oferta útil (B-09)', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            const htmlTarjetaSoporte = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-soporte-1">Soporte Técnico Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaSoporte</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlDetalleSoporte = `
                <html><body>
                    <h1 class="fwB">Soporte Técnico Junior</h1>
                    <p class="mbB">Buscamos técnico de soporte junior para atención a usuarios en español.</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('trabajo-de-tester')) {
                    return { ok: false, status: 500 };
                }
                if (url.includes('trabajo-de-soporte')) {
                    return { ok: true, text: async () => htmlTarjetaSoporte };
                }
                if (url.includes('oferta-soporte-1')) {
                    return { ok: true, text: async () => htmlDetalleSoporte };
                }
                return { ok: true, text: async () => '<html><body></body></html>' };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['tester', 'soporte', 'angular'],
                    maxResultados: 50,
                    maxPeticiones: 3,
                });

                // Debe realizar <= 3 peticiones (1 listado tester HTTP 500 + 1 listado soporte + 1 detalle soporte = 3 peticiones)
                expect(resultado.metricas.peticionesRealizadas).toBeLessThanOrEqual(3);
                expect(global.fetch).toHaveBeenCalledTimes(3);
                // 1 oferta recuperada gracias a la reposición dinámica
                expect(resultado.length).toBe(1);
                expect(resultado[0].titulo).toBe('Soporte Técnico Junior');
                // Consultas visitadas: 2 (tester y soporte)
                expect(resultado.metricas.consultasEjecutadas).toBe(2);
                // Omisiones correctas: 1 ('angular')
                expect(resultado.metricas.consultasOmitidas).toBe(1);
                expect(resultado.metricas.consultasOmitidasPorPresupuesto).toEqual(['angular']);
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_peticiones');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('con 2 términos y maxPeticiones=5, corte antes de página 2 por falta de presupuesto asigna motivo limite_peticiones (B-10)', async () => {
            const { construirUrlsComputrabajo } = require('../../src/config/apify');
            construirUrlsComputrabajo.mockImplementation(({ terminos }) =>
                (terminos || []).map(t => `https://www.computrabajo.com.ar/trabajo-de-${t}`)
            );

            const htmlTarjetaAngular = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-angular-1">Desarrollador Angular Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaAngular</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlDetalleAngular = `
                <html><body>
                    <h1 class="fwB">Desarrollador Angular Junior</h1>
                    <p class="mbB">Buscamos desarrollador junior de Angular en español.</p>
                </body></html>
            `;
            const htmlTarjetaReact = `
                <html><body>
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-react-1">Desarrollador React Junior</a></h2>
                        <p class="fs16 fc_base mt5">EmpresaReact</p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;
            const htmlDetalleReact = `
                <html><body>
                    <h1 class="fwB">Desarrollador React Junior</h1>
                    <p class="mbB">Buscamos desarrollador junior de React en español.</p>
                </body></html>
            `;

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=2')) {
                    throw new Error('No debe realizarse ninguna solicitud a la página 2');
                }
                if (url.includes('trabajo-de-angular')) {
                    return { ok: true, text: async () => htmlTarjetaAngular };
                }
                if (url.includes('trabajo-de-react')) {
                    return { ok: true, text: async () => htmlTarjetaReact };
                }
                if (url.includes('oferta-angular-1')) {
                    return { ok: true, text: async () => htmlDetalleAngular };
                }
                if (url.includes('oferta-react-1')) {
                    return { ok: true, text: async () => htmlDetalleReact };
                }
                return { ok: true, text: async () => '<html><body></body></html>' };
            });

            try {
                const resultado = await ejecutarScrapingComputrabajo({
                    terminos: ['angular', 'react'],
                    maxResultados: 50,
                    maxPeticiones: 5,
                });

                // 4 peticiones ejecutadas: 2 listados + 2 detalles
                expect(resultado.metricas.peticionesRealizadas).toBe(4);
                expect(global.fetch).toHaveBeenCalledTimes(4);
                // 0 solicitudes a p2
                const llamadasP2 = global.fetch.mock.calls.filter(([url]) => url.includes('p=2'));
                expect(llamadasP2.length).toBe(0);
                // 2 ofertas recuperadas
                expect(resultado.length).toBe(2);
                // Ambas consultas ejecutadas
                expect(resultado.metricas.consultasEjecutadas).toBe(2);
                expect(resultado.metricas.consultasOmitidas).toBe(0);
                // Corte etiquetado como limite_peticiones (no limite_paginas)
                expect(resultado.metricas.motivoFinalizacion).toBe('limite_peticiones');
            } finally {
                construirUrlsComputrabajo.mockImplementation(() => [
                    'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
                ]);
            }
        });

        test('consolida en memoria tarjetas duplicadas incompletas con tarjetas posteriores ricas antes de pedir detalles (B-04)', async () => {
            const htmlListadoConDuplicadas = `
                <html><body>
                    <!-- Tarjeta 1: incompleta (sin empresa ni ubicación ni fecha, título corto) -->
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-consolidar-1">Dev Junior</a></h2>
                    </article>
                    <!-- Tarjeta 2: misma URL / identidad pero con datos completos y título más descriptivo -->
                    <article class="box_offer">
                        <h2><a class="js-o-link" href="/ofertas-de-trabajo/oferta-consolidar-1">Dev Junior Fullstack Node</a></h2>
                        <p class="fs16 fc_base mt5">Empresa Enriquecida S.A. <span class="mr10">Córdoba</span></p>
                        <p class="fs13 fc_aux mt15">Hace 1 día</p>
                    </article>
                </body></html>
            `;

            const htmlDetalle = `
                <html><body>
                    <h1 class="fwB">Dev Junior Fullstack Node</h1>
                    <p class="mbB">Buscamos un desarrollador junior para incorporarse al equipo de backend y frontend.</p>
                </body></html>
            `;

            let llamadasDetalle = 0;
            global.fetch.mockImplementation(async (url) => {
                if (url.includes('p=')) {
                    return { ok: true, text: async () => '<html><body></body></html>' };
                }
                if (url.includes('trabajo-de-')) {
                    return { ok: true, text: async () => htmlListadoConDuplicadas };
                }
                if (url.includes('oferta-consolidar-1')) {
                    llamadasDetalle++;
                    return { ok: true, text: async () => htmlDetalle };
                }
                return { ok: true, text: async () => '<html><body></body></html>' };
            });

            const resultado = await ejecutarScrapingComputrabajo({
                terminos: ['frontend'],
                maxResultados: 10,
            });

            // Se debe haber procesado exactamente 1 oferta (no 2)
            expect(resultado.length).toBe(1);
            // Solo se debió fetchear el detalle 1 vez, evitando peticiones duplicadas innecesarias
            expect(llamadasDetalle).toBe(1);
            // La métrica de duplicadas descartadas debe reflejar la tarjeta repetida
            expect(resultado.metricas.duplicadasDescartadas).toBe(1);

            // Los datos consolidados de la tarjeta 2 enriquecieron a la tarjeta 1
            const oferta = resultado[0];
            expect(oferta.empresa).toContain('Empresa Enriquecida S.A.');
            expect(oferta.ubicacion).toBe('Córdoba');
            expect(oferta.titulo).toBe('Dev Junior Fullstack Node');
        });
    });

    describe('ejecutarScrapingIndeed()', () => {

        test('llama al actor correcto de Indeed', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsIndeedFalsos });

            await ejecutarScrapingIndeed({ terminos: ['frontend developer junior'] });

            expect(clienteApify.actor).toHaveBeenCalledWith('actor-indeed-test');
        });

        test('retorna ofertas normalizadas de Indeed', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsIndeedFalsos });

            const resultado = await ejecutarScrapingIndeed({ terminos: ['frontend developer junior'] });

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBeGreaterThan(0);
            expect(resultado[0].plataforma).toBe('indeed');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
        });

        test('pasa title, country y limit al actor', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsIndeedFalsos });

            await ejecutarScrapingIndeed({
                terminos: ['react developer'],
                maxResultados: 20,
            });

            // La frase 'react developer' se preserva como unidad entre comillas.
            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '"react developer"',
                    country: 'ar',
                    limit: 20,
                }),
                expect.objectContaining({ timeout: 120, waitSecs: 1 })
            );
        });

        test('combina todos los términos en una sola query OR y ejecuta 1 único run', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsIndeedFalsos });

            await ejecutarScrapingIndeed({
                terminos: ['react developer', 'angular developer'],
            });

            // Las frases se preservan como unidades entre comillas unidas con OR.
            expect(mockCall).toHaveBeenCalledTimes(1);
            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '"react developer" OR "angular developer"',
                }),
                expect.objectContaining({ timeout: 120, waitSecs: 1 })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('API rate limit exceeded'));

            const resultado = await ejecutarScrapingIndeed({ terminos: ['frontend developer junior'] });
            expect(resultado).toEqual([]);
            expect(resultado.metricas.estado).toBe('error');
        });

        test('deduplica intra-ejecución dos items con el mismo jk y diferente utm_source, devolviendo 1 sola oferta e incrementando duplicadasDescartadas', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-dups' });

            const itemIndeed1 = {
                key: 'test-indeed-dup-1',
                url: 'https://ar.indeed.com/viewjob?jk=abc1234567890def&utm_source=google',
                title: 'Frontend Developer Junior',
                employer: { name: 'Empresa Test' },
                description: { text: 'Buscamos desarrollador frontend...' },
            };
            const itemIndeed2 = {
                key: 'test-indeed-dup-2',
                url: 'https://ar.indeed.com/viewjob?jk=abc1234567890def&utm_source=facebook',
                title: 'Frontend Developer Junior',
                employer: { name: 'Empresa Test' },
                description: { text: 'Buscamos desarrollador frontend...' },
            };

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: [itemIndeed1, itemIndeed2] });

            const resultado = await ejecutarScrapingIndeed();

            expect(resultado).toHaveLength(1);
            expect(resultado[0].identidad_canonica).toBe('indeed:abc1234567890def');
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.duplicadasDescartadas).toBe(1);
            expect(resultado.metricas.totalElegibles).toBe(1);
        });

        test('dos ofertas con IDs distintos permanecen separadas y no se descartan', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-distintos' });

            const itemIndeed1 = {
                key: 'test-indeed-1',
                url: 'https://ar.indeed.com/viewjob?jk=1111111111111111',
                title: 'Frontend Developer Junior',
                employer: { name: 'Empresa Test' },
                description: { text: 'Buscamos desarrollador frontend...' },
            };
            const itemIndeed2 = {
                key: 'test-indeed-2',
                url: 'https://ar.indeed.com/viewjob?jk=2222222222222222',
                title: 'Backend Developer Junior',
                employer: { name: 'Empresa Test' },
                description: { text: 'Buscamos desarrollador backend...' },
            };

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: [itemIndeed1, itemIndeed2] });

            const resultado = await ejecutarScrapingIndeed();

            expect(resultado).toHaveLength(2);
            expect(resultado[0].identidad_canonica).toBe('indeed:1111111111111111');
            expect(resultado[1].identidad_canonica).toBe('indeed:2222222222222222');
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.duplicadasDescartadas).toBe(0);
            expect(resultado.metricas.totalElegibles).toBe(2);
        });
    });

    describe('ejecutarScrapingBumeran()', () => {

        test('llama al actor puppeteer-scraper correcto', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsBumeranFalsos });

            await ejecutarScrapingBumeran();

            expect(clienteApify.actor).toHaveBeenCalledWith('actor-puppeteer-scraper-test');
        });

        test('retorna ofertas normalizadas de Bumeran', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsBumeranFalsos });

            const resultado = await ejecutarScrapingBumeran();

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBeGreaterThan(0);
            expect(resultado[0].plataforma).toBe('bumeran');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
        });

        test('pasa startUrls, pageFunction y linkSelector vacío al actor puppeteer-scraper', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsBumeranFalsos });

            await ejecutarScrapingBumeran();

            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    startUrls: expect.any(Array),
                    pageFunction: expect.any(String),
                    linkSelector: '',
                    proxyConfiguration: expect.objectContaining({ useApifyProxy: true }),
                }),
                expect.objectContaining({ timeout: 120, waitSecs: 1 })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('Timeout'));

            const resultado = await ejecutarScrapingBumeran();
            expect(resultado).toEqual([]);
            expect(resultado.metricas.estado).toBe('error');
        });

        test('retorna array vacío si el dataset viene vacío', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-empty' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: [] });

            const resultado = await ejecutarScrapingBumeran();

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(0);
        });

        test('aplana correctamente arrays anidados del dataset de puppeteer-scraper', async () => {
            // puppeteer-scraper guarda el return value de pageFunction como UN item del dataset.
            // Si pageFunction retorna [oferta1, oferta2], el dataset tiene 1 item: [oferta1, oferta2].
            // Por eso items llega como [[oferta1], [oferta2]] (un sub-array por página scrapeada).
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-nested' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({
                items: [
                    [itemsBumeranFalsos[0]],
                ],
            });

            const resultado = await ejecutarScrapingBumeran();

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(1);
            expect(resultado[0].plataforma).toBe('bumeran');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
        });

        test('descarta silenciosamente items sin URL sin interrumpir el resto', async () => {
            // Si la pageFunction no pudo extraer la URL de una tarjeta, el item llega sin url.
            // normalizarOfertaBumeran() lanza un error que normalizarLote() captura con console.warn.
            // El resto de los items válidos deben seguir procesándose.
            // Nota: con puppeteer-scraper el dataset ya no incluye #error/#debug metadata.
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-invalid' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({
                items: [
                    { titulo: 'Oferta sin URL', empresa: 'TestCorp', url: null },
                    itemsBumeranFalsos[0],
                ],
            });

            const resultado = await ejecutarScrapingBumeran();

            // Solo el item con URL válida debe quedar normalizado.
            expect(resultado.length).toBe(1);
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
        });

        test('deduplica intra-ejecución items con el mismo ID', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-dups' });

            const itemBumeran1 = {
                url: 'https://www.bumeran.com.ar/empleos/desarrollador-web-1118200001.html',
                titulo: 'Frontend Developer Junior',
                empresa: 'TestCorp Argentina',
                ubicacion: 'Capital Federal, Buenos Aires',
                descripcion: 'Buscamos desarrollador web React...',
            };
            const itemBumeran2 = {
                url: 'https://www.bumeran.com.ar/empleos/frontend-developer-junior-1118200001.html?utm_source=newsletter',
                titulo: 'Frontend Developer Junior',
                empresa: 'TestCorp Argentina',
                ubicacion: 'Capital Federal, Buenos Aires',
                descripcion: 'Buscamos desarrollador web React...',
            };

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({
                items: [itemBumeran1, itemBumeran2],
            });

            const resultado = await ejecutarScrapingBumeran();

            expect(resultado).toHaveLength(1);
            expect(resultado[0].identidad_canonica).toBe('bumeran:1118200001');
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.duplicadasDescartadas).toBe(1);
            expect(resultado.metricas.totalElegibles).toBe(1);
        });

        test('dos ofertas con IDs distintos permanecen separadas y no se descartan', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-distintos' });

            const itemBumeran1 = {
                url: 'https://www.bumeran.com.ar/empleos/frontend-developer-1118200001.html',
                titulo: 'Frontend Developer Junior',
                empresa: 'TestCorp Argentina',
                ubicacion: 'Capital Federal, Buenos Aires',
                descripcion: 'Buscamos desarrollador frontend...',
            };
            const itemBumeran2 = {
                url: 'https://www.bumeran.com.ar/empleos/backend-developer-2228200002.html',
                titulo: 'Backend Developer Junior',
                empresa: 'TestCorp Argentina',
                ubicacion: 'Capital Federal, Buenos Aires',
                descripcion: 'Buscamos desarrollador backend...',
            };

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({
                items: [itemBumeran1, itemBumeran2],
            });

            const resultado = await ejecutarScrapingBumeran();

            expect(resultado).toHaveLength(2);
            expect(resultado[0].identidad_canonica).toBe('bumeran:1118200001');
            expect(resultado[1].identidad_canonica).toBe('bumeran:2228200002');
            expect(resultado.metricas.totalCrudos).toBe(2);
            expect(resultado.metricas.duplicadasDescartadas).toBe(0);
            expect(resultado.metricas.totalElegibles).toBe(2);
        });
    });

    describe('ejecutarScrapingGlassdoor()', () => {

        // Datos de prueba que simulan la respuesta del actor de Glassdoor.
        const itemsGlassdoorFalsos = [
            {
                jobUrl: 'https://www.glassdoor.com.ar/job-listing/frontend-developer-testcorp-JV_IC123_KO0,19_KE20,28.htm?jl=9999999',
                title: 'Frontend Developer Junior',
                company: { companyName: 'TestCorp Argentina' },
                location_city: 'Buenos Aires',
                location_state: 'Buenos Aires',
                remoteWorkTypes: ['Remote'],
                description_text: 'Buscamos frontend developer junior con React...',
                baseSalary_min: 150000,
                baseSalary_max: 250000,
                salary_currency: 'ARS',
                datePublished: '2026-03-28',
            },
        ];

        test('llama al actor correcto con keywords y ubicación', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-glassdoor-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsGlassdoorFalsos });

            await ejecutarScrapingGlassdoor();

            expect(clienteApify.actor).toHaveBeenCalledWith('actor-glassdoor-test');
        });

        test('retorna ofertas normalizadas de Glassdoor', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-glassdoor-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsGlassdoorFalsos });

            const resultado = await ejecutarScrapingGlassdoor();

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(1);
            expect(resultado[0].plataforma).toBe('glassdoor');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
            expect(resultado[0].modalidad).toBe('remoto');
        });

        test('pasa keywords, location y maxItems al actor', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-glassdoor-123' });

            clienteApify.dataset().listItems.mockResolvedValue({ items: [] });

            await ejecutarScrapingGlassdoor({ maxResultados: 30, terminos: ['qa tester'] });

            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    keywords: ['qa tester'],
                    location: 'Buenos Aires',
                    maxItems: 30,
                }),
                expect.objectContaining({ timeout: 120, waitSecs: 1 })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('Glassdoor blocked'));

            const resultado = await ejecutarScrapingGlassdoor();
            expect(resultado).toEqual([]);
            expect(resultado.metricas.estado).toBe('error');
        });
    });

    // ===========================================================================
    // GetOnBrd — usa fetch() nativo, NO Apify
    // ===========================================================================

    describe('ejecutarScrapingGetonbrd()', () => {
        const opcionesPiloto = opciones => ({ destino: require('../../src/config/getonbrd').DESTINO_SANDBOX,
            cliente: global.fetch, ...opciones });
        // Respuesta simulada de la API pública de GetOnBrd.
        const respuestaGetonbrdFalsa = {
            data: [
                {
                    id: '40873',
                    type: 'job_posting',
                    attributes: {
                        title: 'Frontend Developer Junior',
                        description: '<p>Buscamos un developer frontend...</p>',
                        remote_modality: 'fully_remote',
                        countries: ['AR'],
                        min_salary: 1500,
                        max_salary: 2500,
                        published_at: Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000),
                    },
                    relationships: {
                        seniority: { data: { id: 2 } },
                    },
                    links: {
                        public_url: 'https://www.getonbrd.com/jobs/programming/frontend-junior-testcorp-40873',
                    },
                },
            ],
            meta: { page: 1, per_page: 120, total_pages: 1 },
        };

        // Antes de cada test, instalo un mock de fetch en el objeto global.
        // Así intercepto las llamadas HTTP sin red real.
        beforeEach(() => {
            global.fetch = jest.fn();
        });

        afterEach(() => {
            delete global.fetch;
        });

        test('llama a la API de GetOnBrd con el término correcto', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaGetonbrdFalsa),
            });

            await ejecutarScrapingGetonbrd(opcionesPiloto({ terminos: ['qa tester'] }));

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('qa%20tester'),
                expect.objectContaining({ signal: expect.any(Object) })
            );
        });

        test('retorna ofertas normalizadas de GetOnBrd', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaGetonbrdFalsa),
            });

            const resultado = await ejecutarScrapingGetonbrd(opcionesPiloto({ terminos: ['frontend'] }));

            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.ofertas[0].plataforma).toBe('getonbrd');
            expect(resultado.ofertas[0].titulo).toBe('Frontend Developer Junior');
            expect(resultado.ofertas[0].modalidad).toBe('remoto');
        });

        test('pagina hasta llegar a maxResultados', async () => {
            // Simulo 3 páginas disponibles.
            const respuestaPagina1 = {
                data: [{ ...respuestaGetonbrdFalsa.data[0] }],
                meta: { total_pages: 3 },
            };
            const respuestaOtrasPaginas = {
                data: [{ ...respuestaGetonbrdFalsa.data[0], id: '99999', links: { public_url: 'https://www.getonbrd.com/jobs/test-99999' } }],
                meta: { total_pages: 3 },
            };

            global.fetch
                .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(respuestaPagina1) })
                .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(respuestaOtrasPaginas) });

            // Amplío explícitamente el presupuesto conservador para verificar tres páginas.
            const resultado = await ejecutarScrapingGetonbrd(opcionesPiloto({ terminos: ['qa'], maxResultados: 50, limitePaginas: 3 }));

            // El contrato del piloto retiene ofertas únicas y devuelve métricas.
            expect(resultado.ofertas.length).toBeGreaterThanOrEqual(1);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        test('detengo todos los términos ante 429 sin reintentar', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: false, status: 429 }) // primer término falla
                .mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue(respuestaGetonbrdFalsa),
                }); // segundo término OK

            const resultado = await ejecutarScrapingGetonbrd(opcionesPiloto({
                terminos: ['termino-que-falla', 'frontend'],
            }));

            expect(resultado.metricas).toMatchObject({ estado: 'error', motivoFinalizacion: 'limite_solicitudes' });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        test('distingo un error de red sin resultados de un timeout', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const resultado = await ejecutarScrapingGetonbrd(opcionesPiloto({ terminos: ['qa'] }));
            expect(resultado.metricas).toMatchObject({ estado: 'error', motivoFinalizacion: 'red' });
        });
    });

    // ===========================================================================
    // Jooble — usa fetch() nativo (POST), NO Apify
    // ===========================================================================

    describe('ejecutarScrapingJooble()', () => {
        // Respuesta simulada de la API de Jooble.
        const respuestaJoobleFalsa = {
            totalCount: 1,
            jobs: [
                {
                    title: 'Frontend Developer Junior',
                    location: 'Buenos Aires',
                    snippet: 'Buscamos frontend developer con React y Angular...',
                    salary: '',
                    source: 'LinkedIn',
                    type: 'Full-time',
                    link: 'https://jooble.org/desc/1234567890',
                    company: 'TestCorp Argentina',
                    updated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '0000000'),
                },
            ],
        };

        // Antes de cada test instalo un mock de fetch en el objeto global.
        beforeEach(() => {
            global.fetch = jest.fn();
        });

        afterEach(() => {
            delete global.fetch;
        });

        test('llama a la API de Jooble con POST y el término correcto', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaJoobleFalsa),
            });

            // 'qa tester' se fragmenta en palabras individuales, filtrando
            // las de menos de 3 letras ('qa' se descarta, queda 'tester').
            await ejecutarScrapingJooble({ terminos: ['qa tester'] });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('jooble.org/api/'),
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.stringContaining('tester'),
                })
            );
        });

        test('retorna ofertas normalizadas de Jooble', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaJoobleFalsa),
            });

            const resultado = await ejecutarScrapingJooble({ terminos: ['frontend'] });

            // 1 término × 1 ubicación (Remote) = 1 resultado
            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(1);
            expect(resultado[0].plataforma).toBe('jooble');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
            expect(resultado[0].empresa).toBe('TestCorp Argentina');
        });

        test('retorna array vacío si la API devuelve jobs vacío', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ totalCount: 0, jobs: [] }),
            });

            const resultado = await ejecutarScrapingJooble({ terminos: ['termino-raro'] });

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(0);
        });

        test('continua con el siguiente país/término si la API devuelve error HTTP', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: false, status: 403 }) // termino-que-falla/Argentina falla
                .mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue(respuestaJoobleFalsa),
                }); // resto OK

            const resultado = await ejecutarScrapingJooble({
                terminos: ['termino-que-falla', 'frontend'],
            });

            // termino-que-falla/Remote falla (0), frontend/Remote OK (1) = 1 oferta
            expect(resultado.length).toBe(1);
        });

        test('tira error descriptivo si fetch lanza excepción', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const resultado = await ejecutarScrapingJooble();
            expect(resultado).toEqual([]);
            expect(resultado.metricas.estado).toBe('error');
        });

        test('caso sintético 60/50: respeta el hard cap de maxResultados=50 aunque la API devuelva 60', async () => {
            const sesentaOfertas = Array.from({ length: 60 }, (_, i) => ({
                title: `Puesto ${i + 1}`,
                location: 'Remote',
                snippet: 'Descripción...',
                source: 'Jooble',
                link: `https://ar.jooble.org/desc/${i + 1}`,
                company: `Empresa ${i + 1}`,
                updated: new Date().toISOString(),
            }));

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    totalCount: 60,
                    jobs: sesentaOfertas,
                }),
            });

            const resultado = await ejecutarScrapingJooble({
                terminos: ['frontend'],
                maxResultados: 50,
            });

            expect(resultado.length).toBe(50);
            expect(resultado.metricas.maxResultados).toBe(50);
            expect(resultado.metricas.motivoFinalizacion).toBe('limite_resultados');
        });

        test('round-robin multi-término: consulta tester, soporte y angular equitativamente', async () => {
            global.fetch.mockImplementation(async (url, opts) => {
                const body = JSON.parse(opts.body);
                return {
                    ok: true,
                    json: async () => ({
                        totalCount: 1,
                        jobs: [{
                            title: `Job ${body.keywords}`,
                            location: 'Remote',
                            snippet: 'Desc',
                            link: `https://ar.jooble.org/desc/${body.keywords}`,
                            company: 'Test Corp',
                            updated: new Date().toISOString(),
                        }],
                    }),
                };
            });

            const resultado = await ejecutarScrapingJooble({
                terminos: ['tester', 'soporte', 'angular'],
                maxResultados: 10,
            });

            const keywordsConsultados = global.fetch.mock.calls.map(call => JSON.parse(call[1].body).keywords);
            expect(keywordsConsultados).toContain('tester');
            expect(keywordsConsultados).toContain('soporte');
            expect(keywordsConsultados).toContain('angular');
            expect(resultado.length).toBe(3);
        });

        test('primer término con ofertas en inglés no bloquea los siguientes términos en español', async () => {
            global.fetch.mockImplementation(async (url, opts) => {
                const body = JSON.parse(opts.body);
                if (body.keywords === 'tester') {
                    return {
                        ok: true,
                        json: async () => ({
                            totalCount: 5,
                            jobs: [{
                                title: 'QA Automation Engineer in London',
                                location: 'Remote',
                                snippet: 'We are looking for a skilled QA automation engineer to join our team in London.',
                                link: 'https://ar.jooble.org/desc/tester-1',
                                company: 'UK Corp',
                                updated: new Date().toISOString(),
                            }],
                        }),
                    };
                }
                return {
                    ok: true,
                    json: async () => ({
                        totalCount: 5,
                        jobs: [{
                            title: 'Desarrollador Angular Junior',
                            location: 'Remote',
                            snippet: 'Buscamos un desarrollador junior para integrarse a nuestro equipo de desarrollo web.',
                            link: 'https://ar.jooble.org/desc/angular-1',
                            company: 'Fresca Corp',
                            updated: new Date().toISOString(),
                        }],
                    }),
                };
            });

            const resultado = await ejecutarScrapingJooble({
                terminos: ['tester', 'angular'],
                maxResultados: 10,
            });

            expect(resultado.length).toBe(1);
            expect(resultado[0].titulo).toBe('Desarrollador Angular Junior');
        });

        test('con maxResultados=1 y 3 términos registra omisiones y motivo límite de resultados', async () => {
            global.fetch.mockImplementation(async (url, opts) => {
                const body = JSON.parse(opts.body);
                return {
                    ok: true,
                    json: async () => ({
                        totalCount: 5,
                        jobs: [{
                            title: `Desarrollador ${body.keywords} Junior`,
                            location: 'Remote',
                            snippet: `Puesto junior de ${body.keywords} para trabajar en equipo.`,
                            link: `https://ar.jooble.org/desc/${body.keywords}-1`,
                            company: 'Empresa Test',
                            updated: new Date().toISOString(),
                        }],
                    }),
                };
            });

            const resultado = await ejecutarScrapingJooble({
                terminos: ['tester', 'soporte', 'angular'],
                maxResultados: 1,
            });

            expect(resultado.length).toBe(1);
            expect(resultado.metricas.consultasEjecutadas).toBe(1);
            expect(resultado.metricas.consultasOmitidas).toBe(2);
            expect(resultado.metricas.consultasOmitidasPorPresupuesto).toEqual([]);
            expect(resultado.metricas.motivoFinalizacion).toBe('limite_resultados');
        });

        test('con presupuesto de peticiones agotado registra consultasOmitidasPorPresupuesto y limite_peticiones', async () => {
            global.fetch.mockImplementation(async () => ({
                ok: true,
                json: async () => ({
                    totalCount: 0,
                    jobs: [],
                }),
            }));

            const dieciseisTerminos = Array.from({ length: 16 }, (_, i) => `termino${i + 1}`);
            const resultado = await ejecutarScrapingJooble({
                terminos: dieciseisTerminos,
                maxResultados: 10,
            });

            expect(resultado.metricas.motivoFinalizacion).toBe('limite_peticiones');
            expect(resultado.metricas.consultasOmitidasPorPresupuesto).toContain('termino16');
        });
    });

    // =========================================================================
    // InfoJobs (API oficial, remoto puro)
    // =========================================================================
    describe('ejecutarScrapingInfojobs', () => {
        // Oferta de ejemplo con remoto puro. Todos los campos mapeados al contrato.
        // Shape según la doc oficial actual:
        //   - teleworking: PD { id: number, value: string }
        //   - city: string
        //   - province: PD { value: string }
        //   - author.name: empresa pública
        //   - salaryMin / salaryMax: PDs
        const ofertaInfojobsFalsa = {
            link: 'https://www.infojobs.net/oferta-trabajo/frontend-developer_123.xhtml',
            title: 'Frontend Developer Junior',
            author: { name: 'Empresa Tech SRL' },
            city: 'Madrid',
            province: { value: 'Madrid' },
            teleworking: { id: 2, value: 'Solo teletrabajo' },
            requirementMin: 'Buscamos desarrollador frontend con experiencia en React.',
            experienceMin: { value: 'Al menos 2 años' },
            salaryMin: { value: '20000' },
            salaryMax: { value: '30000' },
            salaryDescription: '€ Bruto/año',
            published: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        };

        // Respuesta simulada de la API de InfoJobs.
        const respuestaInfojobsFalsa = {
            offers: [ofertaInfojobsFalsa],
        };

        beforeEach(() => {
            // Instalo un mock de fetch e inicializo credenciales por defecto.
            global.fetch = jest.fn();
            // Configuro las credenciales por defecto en cada test.
            process.env.INFOJOBS_CLIENT_ID = 'client-id-test';
            process.env.INFOJOBS_CLIENT_SECRET = 'client-secret-test';
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaInfojobsFalsa),
            });
        });

        afterEach(() => {
            // Limpio las variables de entorno después de cada test para no
            // contaminar otros tests.
            delete process.env.INFOJOBS_CLIENT_ID;
            delete process.env.INFOJOBS_CLIENT_SECRET;
            delete global.fetch;
        });

        // --- INFOJOBS-001: Autenticación ---

        test('construye el header Authorization con HTTP Basic correcto', async () => {
            await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            const llamadas = global.fetch.mock.calls;
            expect(llamadas.length).toBeGreaterThan(0);

            const [, opciones] = llamadas[0];
            const tokenEsperado = Buffer.from('client-id-test:client-secret-test').toString('base64');
            expect(opciones.headers['Authorization']).toBe(`Basic ${tokenEsperado}`);
        });

        test('retorna objeto deshabilitado (no array vacío) si faltan ambas credenciales', async () => {
            // Cuando faltan ambas credenciales, el servicio retorna un objeto con
            // deshabilitado: true, ofertas: [] y codigo_resultado para que el controlador
            // pueda distinguirlo de un scraping real con 0 resultados.
            // Esto previene que el frontend muestre un falso éxito vacío.
            delete process.env.INFOJOBS_CLIENT_ID;
            delete process.env.INFOJOBS_CLIENT_SECRET;

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toEqual(expect.objectContaining({
                deshabilitado: true,
                ofertas: [],
                codigo_resultado: 'infojobs_deshabilitado_sin_credenciales',
            }));
            expect(typeof resultado.advertencia).toBe('string');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        test('tira error de configuración si solo falta CLIENT_SECRET', async () => {
            delete process.env.INFOJOBS_CLIENT_SECRET;

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Configuración incompleta de InfoJobs');
        });

        test('tira error de configuración si solo falta CLIENT_ID', async () => {
            delete process.env.INFOJOBS_CLIENT_ID;

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Configuración incompleta de InfoJobs');
        });

        // --- INFOJOBS-002: Filtro remoto puro ---

        test('envía el parámetro teleworking=solo-teletrabajo en la URL', async () => {
            await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            const [url] = global.fetch.mock.calls[0];
            expect(url).toContain('teleworking=solo-teletrabajo');
        });

        test('descarta ofertas que no sean remoto puro aunque la API las devuelva', async () => {
            // Simulo que la API devuelve una oferta híbrida por error.
            // teleworking es objeto según el contrato real de la API de InfoJobs.
            const ofertaHibridaFalsa = {
                ...ofertaInfojobsFalsa,
                teleworking: { id: 'teletrabajo-parcial', value: 'Teletrabajo parcial' },
            };
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaHibridaFalsa] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            // La oferta híbrida fue descartada por la Capa 2 del normalizador.
            expect(resultado).toEqual([]);
        });

        // --- INFOJOBS-003: Normalización ---

        test('normaliza correctamente una oferta de InfoJobs', async () => {
            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado.length).toBe(1);
            const oferta = resultado[0];

            expect(oferta.titulo).toBe('Frontend Developer Junior');
            expect(oferta.empresa).toBe('Empresa Tech SRL');
            // Ciudad + provincia se combinan: "Madrid, Madrid" (patrón consistente del proyecto).
            expect(oferta.ubicacion).toBe('Madrid, Madrid');
            expect(oferta.modalidad).toBe('remoto');
            expect(oferta.url).toBe(ofertaInfojobsFalsa.link);
            expect(oferta.plataforma).toBe('infojobs');
            expect(oferta.nivel_requerido).toBe('junior');
            expect(oferta.salario_min).toBe(20000);
            expect(oferta.salario_max).toBe(30000);
            expect(oferta.moneda).toBe('EUR');
            expect(oferta.fecha_publicacion).toBeInstanceOf(Date);
            expect(oferta.descripcion).toContain('desarrollador frontend');
        });

        // --- INFOJOBS-004: Descarte de oferta sin URL ---

        test('descarta ofertas sin campo link', async () => {
            const ofertaSinUrl = { ...ofertaInfojobsFalsa };
            delete ofertaSinUrl.link;
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaSinUrl] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toEqual([]);
        });

        // --- INFOJOBS-005: Límite de resultados ---

        test('respeta el límite máximo de 50 resultados', async () => {
            // Si pido más de 50, debe capear en 50.
            await ejecutarScrapingInfojobs({ terminos: ['frontend'], maxResultados: 100 });

            const [url] = global.fetch.mock.calls[0];
            expect(url).toContain('maxResults=50');
        });

        // --- Manejo de errores HTTP ---

        test('tira error descriptivo si la API devuelve 401', async () => {
            global.fetch.mockResolvedValue({ ok: false, status: 401 });

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Error al ejecutar scraping de InfoJobs');
        });

        test('tira error descriptivo si la API devuelve 429', async () => {
            global.fetch.mockResolvedValue({ ok: false, status: 429 });

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Error al ejecutar scraping de InfoJobs');
        });

        test('continúa con el siguiente término si la API devuelve error HTTP no crítico', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: false, status: 500 }) // primer término falla
                .mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue(respuestaInfojobsFalsa),
                }); // segundo término OK

            const resultado = await ejecutarScrapingInfojobs({
                terminos: ['termino-que-falla', 'frontend'],
            });

            // El primer término falló, el segundo devolvió 1 oferta.
            expect(resultado.length).toBe(1);
        });

        test('tira error descriptivo si fetch lanza excepción de red', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Error al ejecutar scraping de InfoJobs');
        });

        // --- INFOJOBS-009: Escenarios de validación defensiva (Capa 2) ---

        test('retorna array vacío sin error si la API no devuelve resultados', async () => {
            // La API puede devolver `offers: []` cuando no hay avisos para ese término.
            // El servicio debe retornar [] sin tirar error.
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['termino-sin-resultados'] });

            expect(resultado).toEqual([]);
            expect(global.fetch).toHaveBeenCalled();
        });

        test('descarta oferta con teleworking trabajo-solo-presencial (Capa 2)', async () => {
            // El normalizador rechaza cualquier valor que no sea remoto puro.
            // Soportamos el shape real: teleworking como objeto PD.
            const ofertaPresencial = {
                ...ofertaInfojobsFalsa,
                teleworking: { id: 1, value: 'Presencial' },
            };
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaPresencial] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            // La Capa 2 del normalizador descartó la oferta presencial.
            expect(resultado).toEqual([]);
        });

        test('descarta oferta con teleworking ausente o null (Capa 2)', async () => {
            // Si la API devuelve una oferta sin campo teleworking, no es remoto puro.
            // El normalizador debe descartarla silenciosamente.
            const ofertaSinModalidad = {
                ...ofertaInfojobsFalsa,
                teleworking: null,
            };
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaSinModalidad] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toEqual([]);
        });

        test('el error 401 incluye mensaje específico de credenciales inválidas', async () => {
            // La implementación lanza 'Credenciales de InfoJobs inválidas (401)' que queda
            // envuelto en el mensaje genérico del catch externo.
            global.fetch.mockResolvedValue({ ok: false, status: 401 });

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Credenciales de InfoJobs');
        });

        test('el error 429 incluye mensaje específico de rate limit', async () => {
            // La implementación lanza 'Rate limit de InfoJobs excedido (429)' que queda
            // envuelto en el mensaje genérico del catch externo.
            global.fetch.mockResolvedValue({ ok: false, status: 429 });

            await expect(ejecutarScrapingInfojobs({ terminos: ['frontend'] }))
                .rejects.toThrow('Rate limit de InfoJobs excedido');
        });

        test('tolera respuestas legacy con propiedad items', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ items: [ofertaInfojobsFalsa] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toHaveLength(1);
            expect(resultado[0].plataforma).toBe('infojobs');
        });

        test('usa author.name como fallback cuando company.name no existe', async () => {
            const ofertaConAuthor = {
                ...ofertaInfojobsFalsa,
                company: undefined,
                author: { name: 'Empresa desde author' },
            };

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaConAuthor] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toHaveLength(1);
            expect(resultado[0].empresa).toBe('Empresa desde author');
        });

        test('tolera city y province al tope del item además de locations', async () => {
            const ofertaConUbicacionTope = {
                ...ofertaInfojobsFalsa,
                locations: undefined,
                city: { value: 'Barcelona' },
                province: { value: 'Cataluña' },
            };

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaConUbicacionTope] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toHaveLength(1);
            expect(resultado[0].ubicacion).toBe('Barcelona, Cataluña');
        });

        test('tolera shape alternativo con locations[0] cuando city/province no vienen al tope', async () => {
            const ofertaConLocations = {
                ...ofertaInfojobsFalsa,
                city: undefined,
                province: undefined,
                locations: [{ city: 'Sevilla', province: { value: 'Andalucía' } }],
            };

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ offers: [ofertaConLocations] }),
            });

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toHaveLength(1);
            expect(resultado[0].ubicacion).toBe('Sevilla, Andalucía');
        });
    }); // fin describe('ejecutarScrapingInfojobs')

    // ===========================================================================
    // LinkedIn — actor restaurado + normalización dual-schema
    // ===========================================================================

    describe('ejecutarScrapingLinkedin() — actor restaurado con compatibilidad dual-schema', () => {

        // Item con el schema del actor NUEVO (cheap_scraper/linkedin-job-scraper).
        const itemLinkedinNuevoSchema = {
            jobUrl: 'https://linkedin.com/jobs/view/nuevo-schema-99999',
            jobTitle: 'QA Tester Junior',
            companyName: 'NuevaCorp',
            location: 'Córdoba, Argentina',
            publishedAt: '2026-04-28T10:00:00.000Z',
            jobDescription: 'Buscamos QA Tester con Selenium y Jira...',
            experienceLevel: 'Entry level',
            workType: 'Remote',
            salaryInfo: '',
        };

        test('normaliza item con schema nuevo (jobUrl, jobTitle, publishedAt)', async () => {
            clienteApify.actor().call.mockResolvedValue({ defaultDatasetId: 'ds-nuevo-schema' });
            clienteApify.dataset().listItems.mockResolvedValue({ items: [itemLinkedinNuevoSchema] });

            const resultado = await ejecutarScrapingLinkedin();

            expect(resultado.length).toBe(1);
            expect(resultado[0].url).toBe('https://linkedin.com/jobs/view/nuevo-schema-99999');
            expect(resultado[0].titulo).toBe('QA Tester Junior');
            expect(resultado[0].plataforma).toBe('linkedin');
            expect(resultado[0].modalidad).toBe('remoto');
            expect(resultado[0].fecha_publicacion).toBeInstanceOf(Date);
        });

        test('normaliza item con schema viejo (link, title, postedAt) sin romper compatibilidad', async () => {
            clienteApify.actor().call.mockResolvedValue({ defaultDatasetId: 'ds-viejo-schema' });
            clienteApify.dataset().listItems.mockResolvedValue({ items: itemsLinkedinFalsos });

            const resultado = await ejecutarScrapingLinkedin();

            expect(resultado.length).toBe(1);
            expect(resultado[0].url).toBe('https://linkedin.com/jobs/view/test-job-12345');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
            expect(resultado[0].modalidad).toBe('remoto');
        });

        test('pasa urls, count y scrapeCompany al actor restaurado', async () => {
            clienteApify.actor().call.mockResolvedValue({ defaultDatasetId: 'ds-input-nuevo' });
            clienteApify.dataset().listItems.mockResolvedValue({ items: [] });

            await ejecutarScrapingLinkedin({ maxResultados: 50 });

            expect(clienteApify.actor().call).toHaveBeenCalledWith(
                expect.objectContaining({
                    urls: expect.any(Array),
                    count: 50,
                    scrapeCompany: false,
                }),
                expect.objectContaining({ timeout: 120, waitSecs: 1 })
            );

            const inputLlamada = clienteApify.actor().call.mock.calls[0][0];
            expect(inputLlamada.urls[0]).toContain('f_TPR=r1209600');
        });

        test('NO pasa los campos del actor barato inaccesible en producción', async () => {
            clienteApify.actor().call.mockResolvedValue({ defaultDatasetId: 'ds-no-viejo' });
            clienteApify.dataset().listItems.mockResolvedValue({ items: [] });

            await ejecutarScrapingLinkedin({ maxResultados: 30 });

            const inputLlamada = clienteApify.actor().call.mock.calls[0][0];
            expect(inputLlamada).not.toHaveProperty('startUrls');
            expect(inputLlamada).not.toHaveProperty('maxItems');
            expect(inputLlamada).not.toHaveProperty('publishedAt');
        });
    });

    // ===========================================================================
    // Google Jobs — DESACTIVADO (retorna [] sin llamar a Apify)
    // ===========================================================================

    describe('ejecutarScrapingGoogleJobs() — desactivado', () => {

        test('retorna array vacío sin llamar al actor de Apify', async () => {
            const resultado = await ejecutarScrapingGoogleJobs();

            // No debe llamar al actor bajo ninguna circunstancia.
            expect(clienteApify.actor).not.toHaveBeenCalled();
            expect(resultado).toEqual([]);
        });

        test('retorna array vacío aunque se pasen opciones', async () => {
            const resultado = await ejecutarScrapingGoogleJobs({
                terminos: ['qa tester'],
                maxResultados: 50,
            });

            expect(clienteApify.actor).not.toHaveBeenCalled();
             expect(resultado).toEqual([]);
        });
    });

    // ===========================================================================
    // ADZUNA: ejecutarScrapingAdzuna — API REST oficial
    // ===========================================================================

    describe('ejecutarScrapingAdzuna()', () => {

        // Oferta falsa con el formato real de la API de Adzuna.
        // Solo incluimos ofertas remotas — Adzuna ahora filtra por teletrabajo.
        const ofertaAdzunaFalsa = {
            id: 'adzuna-test-001',
            title: 'Frontend Developer Junior Remote',
            company: { display_name: 'Tech Corp SA' },
            location: { display_name: 'Madrid, España' },
            description: 'Buscamos desarrollador frontend junior para teletrabajo con React y TypeScript. Trabajo 100% remoto.',
            redirect_url: 'https://www.adzuna.com/es/jobs/details/adzuna-test-001',
            created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const respuestaAdzunaFalsa = {
            results: [ofertaAdzunaFalsa],
        };

        beforeEach(() => {
            process.env.ADZUNA_APP_ID = 'app-id-test';
            process.env.ADZUNA_APP_KEY = 'app-key-test';

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaAdzunaFalsa),
            });

            // Acelero sólo la pausa del proveedor; conservo los temporizadores de aborto.
            const temporizar = global.setTimeout;
            jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
                if (ms === 2500) { queueMicrotask(fn); return 0; }
                return temporizar(fn, ms);
            });
        });

        afterEach(() => {
            delete process.env.ADZUNA_APP_ID;
            delete process.env.ADZUNA_APP_KEY;
            delete global.fetch;
            jest.restoreAllMocks();
        });

        // --- ADZUNA-001: Soft-disable ---

        test('retorna objeto deshabilitado si faltan ambas credenciales', async () => {
            delete process.env.ADZUNA_APP_ID;
            delete process.env.ADZUNA_APP_KEY;

            const resultado = await ejecutarScrapingAdzuna({ terminos: ['frontend'] });

            expect(resultado).toEqual(expect.objectContaining({
                deshabilitado: true,
                ofertas: [],
                codigo_resultado: 'adzuna_deshabilitado_sin_credenciales',
            }));
            expect(typeof resultado.advertencia).toBe('string');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        test('tira error de configuración si solo falta ADZUNA_APP_KEY', async () => {
            delete process.env.ADZUNA_APP_KEY;

            await expect(ejecutarScrapingAdzuna({ terminos: ['frontend'] }))
                .resolves.toMatchObject({ metricas: expect.objectContaining({ estado: 'sin_credenciales' }) });
        });

        test('tira error de configuración si solo falta ADZUNA_APP_ID', async () => {
            delete process.env.ADZUNA_APP_ID;

            await expect(ejecutarScrapingAdzuna({ terminos: ['frontend'] }))
                .resolves.toMatchObject({ metricas: expect.objectContaining({ estado: 'sin_credenciales' }) });
        });

        // --- ADZUNA-002: Normalización ---

        test('normaliza correctamente una oferta de Adzuna', async () => {
            const resultado = await ejecutarScrapingAdzuna({ terminos: ['frontend'] });

            // El servicio itera 1 país (es) × 1 término = 1 llamada; puede haber 1 oferta.
            expect(resultado.length).toBeGreaterThan(0);
            const oferta = resultado[0];

            expect(oferta.titulo).toBe('Frontend Developer Junior Remote');
            expect(oferta.empresa).toBe('Tech Corp SA');
            expect(oferta.url).toBe(ofertaAdzunaFalsa.redirect_url);
            expect(oferta.plataforma).toBe('adzuna');
            expect(oferta.modalidad).toBe('remoto');
        });

        // --- ADZUNA-003: Manejo de errores de red ---

        test('continúa con el siguiente par país-término si hay un error de red', async () => {
            global.fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue(respuestaAdzunaFalsa),
                });

            await expect(ejecutarScrapingAdzuna({ terminos: ['frontend'] })).resolves.toBeDefined();
        });

        test('lanza error si la API devuelve HTTP 401 (credenciales inválidas)', async () => {
            // 401 es un error grave: significa que las credenciales son inválidas.
            // El servicio debe lanzar un error explícito para que el caller lo maneje.
            global.fetch.mockResolvedValue({ ok: false, status: 401 });

            await expect(ejecutarScrapingAdzuna({ terminos: ['frontend'] }))
                .resolves.toMatchObject({ metricas: expect.objectContaining({ estado: 'error', errores: [expect.objectContaining({ codigoHttp: 401 })] }) });
        });

        test('lanza error si la API devuelve HTTP 429 (rate limit)', async () => {
            // 429 es un error grave: significa que superamos el límite de requests.
            // El servicio debe lanzar un error explícito para que el caller lo maneje,
            // no continuar silenciosamente (podría enmascarar un abuso de la API).
            global.fetch.mockResolvedValue({ ok: false, status: 429 });

            await expect(ejecutarScrapingAdzuna({ terminos: ['frontend'] }))
                .resolves.toMatchObject({ metricas: expect.objectContaining({ estado: 'error', errores: [expect.objectContaining({ codigoHttp: 429, tipo: 'limite_solicitudes' })] }) });
        });

        // --- ADZUNA-004: Filtrado por fecha ---

        test('respeta maxResultados y no devuelve más ofertas de las solicitadas', async () => {
            // Si el caller pide maxResultados: 1, el servicio no debe devolver más
            // de 1 oferta aunque la API devuelva más resultados.
            const dosOfertas = [
                { ...ofertaAdzunaFalsa, id: 'az-001' },
                { ...ofertaAdzunaFalsa, id: 'az-002', redirect_url: 'https://www.adzuna.com/es/jobs/details/az-002' },
            ];
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ results: dosOfertas }),
            });

            const resultado = await ejecutarScrapingAdzuna({ terminos: ['frontend'], maxResultados: 1 });

            expect(resultado.length).toBeLessThanOrEqual(1);
        });

        test('capea en 50 aunque el caller pida más (garantía interna del servicio)', async () => {
            // La spec exige que el cap de 50 lo garantice el SERVICIO internamente,
            // no solo el controlador. Si pido 100, el servicio nunca debe pedir más
            // de 50 resultados por página a la API.
            await ejecutarScrapingAdzuna({ terminos: ['frontend'], maxResultados: 100 });

            // Verifico que results_per_page en la URL nunca supera 50.
            const llamadas = global.fetch.mock.calls;
            expect(llamadas.length).toBeGreaterThan(0);
            llamadas.forEach(([url]) => {
                const match = url.match(/results_per_page=(\d+)/);
                if (match) {
                    expect(Number(match[1])).toBeLessThanOrEqual(50);
                }
            });
        });

        test('descarta ofertas más antiguas que 30 días', async () => {
            const ofertaVieja = {
                ...ofertaAdzunaFalsa,
                created: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
            };
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ results: [ofertaVieja] }),
            });

            const resultado = await ejecutarScrapingAdzuna({ terminos: ['frontend'] });

            expect(resultado).toEqual([]);
        });

        // --- ADZUNA-005: Solo España (sin ar) ---

        test('solo busca en España (es), no en Argentina (ar)', async () => {
            await ejecutarScrapingAdzuna({ terminos: ['frontend'] });

            const llamadas = global.fetch.mock.calls;
            expect(llamadas.length).toBeGreaterThan(0);

            // Todas las URLs deben ir a /jobs/es/search/1
            llamadas.forEach(([url]) => {
                expect(url).toContain('/jobs/es/search/1');
                expect(url).not.toContain('/jobs/ar/');
            });
        });

        // --- ADZUNA-006: Parámetro content-type con guion medio ---

        test('usa content-type con guion medio (no content_type con guion bajo)', async () => {
            await ejecutarScrapingAdzuna({ terminos: ['frontend'] });

            const llamadas = global.fetch.mock.calls;
            expect(llamadas.length).toBeGreaterThan(0);

            llamadas.forEach(([url]) => {
                // Debe contener content-type (guion medio), no content_type (guion bajo).
                expect(url).toContain('content-type=application%2Fjson');
                expect(url).not.toContain('content_type=');
            });
        });

        // --- ADZUNA-007: Filtro remoto (Capa 1: prefijo "remote" en búsqueda) ---

        test('agrega prefijo "remote" al término de búsqueda para filtrar remotas', async () => {
            await ejecutarScrapingAdzuna({ terminos: ['frontend'] });

            const llamadas = global.fetch.mock.calls;
            expect(llamadas.length).toBeGreaterThan(0);

            // El parámetro "what" debe llevar el prefijo "remote ".
            llamadas.forEach(([url]) => {
                const urlObj = new URL(url);
                expect(urlObj.searchParams.get('what')).toBe('remote frontend');
            });
        });

        test('usa terminos cuando consultasAdzuna no está definido sin lanzar ReferenceError', async () => {
            await expect(ejecutarScrapingAdzuna({ terminos: ['QA'] })).resolves.toBeDefined();
        });

    }); // fin describe('ejecutarScrapingAdzuna')

    // ===========================================================================
    // CAMBIO D: filtrarPorUltimasDosemanas — helper de filtrado de 14 días
    // ===========================================================================

    describe('_filtrarPorUltimasDosemanas()', () => {
        const { _filtrarPorUltimasDosemanas } = require('../../src/servicios/servicio-scraping');

        const ahora = new Date();
        const haceDiezDias = new Date(ahora - 10 * 24 * 60 * 60 * 1000);
        const hace20Dias = new Date(ahora - 20 * 24 * 60 * 60 * 1000);

        test('conserva ofertas con fecha dentro de 14 días', () => {
            const ofertas = [
                { titulo: 'Dentro del rango', fecha_publicacion: haceDiezDias },
            ];
            const resultado = _filtrarPorUltimasDosemanas(ofertas);
            expect(resultado.length).toBe(1);
        });

        test('descarta ofertas con fecha más antigua que 14 días', () => {
            const ofertas = [
                { titulo: 'Fuera del rango', fecha_publicacion: hace20Dias },
            ];
            const resultado = _filtrarPorUltimasDosemanas(ofertas);
            expect(resultado.length).toBe(0);
        });

        test('conserva ofertas sin fecha (fecha_publicacion null)', () => {
            // Bumeran, Computrabajo y Google Jobs no tienen fecha confiable.
            // No se deben descartar por falta de fecha.
            const ofertas = [
                { titulo: 'Sin fecha', fecha_publicacion: null },
            ];
            const resultado = _filtrarPorUltimasDosemanas(ofertas);
            expect(resultado.length).toBe(1);
        });

        test('conserva ofertas con fecha inválida (NaN)', () => {
            const ofertas = [
                { titulo: 'Fecha inválida', fecha_publicacion: new Date('no-es-fecha') },
            ];
            const resultado = _filtrarPorUltimasDosemanas(ofertas);
            expect(resultado.length).toBe(1);
        });

        test('filtra correctamente un mix de ofertas dentro y fuera del rango', () => {
            const ofertas = [
                { titulo: 'Reciente', fecha_publicacion: haceDiezDias },
                { titulo: 'Vieja', fecha_publicacion: hace20Dias },
                { titulo: 'Sin fecha', fecha_publicacion: null },
            ];
            const resultado = _filtrarPorUltimasDosemanas(ofertas);
            // Solo 'Reciente' y 'Sin fecha' pasan el filtro.
            expect(resultado.length).toBe(2);
            expect(resultado.map(o => o.titulo)).toEqual(
                expect.arrayContaining(['Reciente', 'Sin fecha'])
            );
        });

        test('retorna array vacío si todas las ofertas están fuera del rango', () => {
            const ofertas = [
                { titulo: 'Vieja 1', fecha_publicacion: hace20Dias },
                { titulo: 'Vieja 2', fecha_publicacion: hace20Dias },
            ];
            const resultado = _filtrarPorUltimasDosemanas(ofertas);
            expect(resultado.length).toBe(0);
        });

        test('retorna array vacío si el input está vacío', () => {
            expect(_filtrarPorUltimasDosemanas([])).toEqual([]);
        });
    });

    describe('ejecutarScrapingRemoteOK()', () => {
        const respuestaLegal = { legal: 'Aviso legal obligatorio' };

        beforeEach(() => {
            global.fetch = jest.fn();
        });

        test('caso sintético 70/50: respeta el hard cap de maxResultados=50 aunque la API devuelva 70', async () => {
            const setentaTrabajos = Array.from({ length: 70 }, (_, i) => ({
                id: String(i + 1),
                position: `Dev ${i + 1}`,
                company: `Empresa ${i + 1}`,
                url: `https://remoteok.com/remote-jobs/${i + 1}`,
                date: new Date().toISOString(),
                tags: ['frontend', 'react'],
            }));

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue([respuestaLegal, ...setentaTrabajos]),
            });

            const resultado = await ejecutarScrapingRemoteOK({
                maxResultados: 50,
                terminos: ['frontend'],
            });

            expect(resultado.length).toBe(50);
            expect(resultado.metricas.maxResultados).toBe(50);
            expect(resultado.metricas.motivoFinalizacion).toBe('limite_resultados');
        });

        test('distribuye cupo equitativamente entre múltiples tags', async () => {
            global.fetch.mockImplementation(async (url) => {
                const isReact = url.includes('react');
                const tag = isReact ? 'react' : 'angular';
                const jobs = Array.from({ length: 30 }, (_, i) => ({
                    id: `${tag}-${i + 1}`,
                    position: `${tag.toUpperCase()} Dev ${i + 1}`,
                    company: `Company ${tag}`,
                    url: `https://remoteok.com/remote-jobs/${tag}-${i + 1}`,
                    date: new Date().toISOString(),
                    tags: [tag],
                }));
                return {
                    ok: true,
                    json: async () => [respuestaLegal, ...jobs],
                };
            });

            const resultado = await ejecutarScrapingRemoteOK({
                terminos: ['react', 'angular'],
                maxResultados: 20,
            });

            expect(resultado.length).toBe(20);
            const reactCount = resultado.filter(o => o.titulo.includes('REACT')).length;
            const angularCount = resultado.filter(o => o.titulo.includes('ANGULAR')).length;
            expect(reactCount).toBe(10);
            expect(angularCount).toBe(10);
        });

        test('ofertas en inglés no consumen cupo útil y permiten consultar siguiente tag en español', async () => {
            global.fetch.mockImplementation(async (url) => {
                const urlObj = new URL(url);
                if (urlObj.searchParams.get('tags') === 'react') {
                    return {
                        ok: true,
                        json: async () => [
                            respuestaLegal,
                            {
                                id: 'react-1',
                                position: 'Senior React Developer in USA',
                                company: 'US Corp',
                                description: 'We are seeking an experienced React engineer located in the US.',
                                url: 'https://remoteok.com/remote-jobs/react-1',
                                date: new Date().toISOString(),
                                tags: ['react'],
                            },
                        ],
                    };
                }
                return {
                    ok: true,
                    json: async () => [
                        respuestaLegal,
                        {
                            id: 'angular-1',
                            position: 'Desarrollador Angular Junior',
                            company: 'Latam Corp',
                            description: 'Buscamos desarrollador frontend junior para trabajar en remoto en español.',
                            url: 'https://remoteok.com/remote-jobs/angular-1',
                            date: new Date().toISOString(),
                            tags: ['angular'],
                        },
                    ],
                };
            });

            const resultado = await ejecutarScrapingRemoteOK({
                terminos: ['react', 'angular'],
                maxResultados: 10,
            });

            expect(resultado.length).toBe(1);
            expect(resultado[0].titulo).toBe('Desarrollador Angular Junior');
            expect(resultado.metricas.consultasEjecutadas).toBe(2);
        });

        test('con maxResultados=1 y 3 tags registra omisiones y motivo límite de resultados', async () => {
            global.fetch.mockImplementation(async (url) => {
                const urlObj = new URL(url);
                const tag = urlObj.searchParams.get('tags') || 'tag';
                return {
                    ok: true,
                    json: async () => [
                        respuestaLegal,
                        {
                            id: `${tag}-1`,
                            position: `Desarrollador ${tag} Junior`,
                            company: 'Empresa Test',
                            description: `Puesto junior de ${tag} para desarrollo en español.`,
                            url: `https://remoteok.com/remote-jobs/${tag}-1`,
                            date: new Date().toISOString(),
                            tags: [tag],
                        },
                    ],
                };
            });

            const resultado = await ejecutarScrapingRemoteOK({
                terminos: ['react', 'angular', 'node'],
                maxResultados: 1,
            });

            expect(resultado.length).toBe(1);
            expect(resultado.metricas.consultasEjecutadas).toBe(1);
            expect(resultado.metricas.consultasOmitidas).toBe(2);
            expect(resultado.metricas.consultasOmitidasPorPresupuesto).toEqual([]);
            expect(resultado.metricas.motivoFinalizacion).toBe('limite_resultados');
        });
    });

    describe('ejecutarScrapingRemotive()', () => {
        beforeEach(() => {
            global.fetch = jest.fn();
        });

        afterEach(() => {
            delete global.fetch;
        });

        test('respeta hard cap de maxResultados y no supera el cupo solicitado', async () => {
            const setentaOfertas = Array.from({ length: 70 }, (_, i) => ({
                id: i + 1,
                url: `https://remotive.com/remote-jobs/software-dev/puesto-${i + 1}`,
                title: `Desarrollador Junior ${i + 1}`,
                company_name: `Empresa ${i + 1}`,
                publication_date: new Date().toISOString(),
                candidate_required_location: 'Worldwide',
                salary: '',
                description: `Puesto de desarrollador junior con Node.js y React para equipo hispanohablante número ${i + 1}`,
            }));

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ jobs: setentaOfertas }),
            });

            const resultado = await ejecutarScrapingRemotive({
                maxResultados: 50,
            });

            expect(resultado.length).toBe(50);
            expect(resultado.metricas.maxResultados).toBe(50);
            expect(resultado.metricas.motivoFinalizacion).toBe('limite_resultados');
        });

        test('primera categoría con ofertas viejas o repetidas no bloquea segunda categoría', async () => {
            const fechaVieja = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
            const fechaReciente = new Date().toISOString();

            global.fetch.mockImplementation(async (url) => {
                if (url.includes('category=software-dev')) {
                    return {
                        ok: true,
                        json: async () => ({
                            jobs: [{
                                id: 100,
                                url: 'https://remotive.com/remote-jobs/vieja-1',
                                title: 'Desarrollador Antiguo',
                                company_name: 'Vieja SA',
                                publication_date: fechaVieja,
                                candidate_required_location: 'Worldwide',
                                description: 'Oferta en español pero muy antigua para el cupo útil.',
                            }],
                        }),
                    };
                }
                return {
                    ok: true,
                    json: async () => ({
                        jobs: [{
                            id: 200,
                            url: 'https://remotive.com/remote-jobs/nueva-1',
                            title: 'Desarrollador Frontend Fresco',
                            company_name: 'Nueva SA',
                            publication_date: fechaReciente,
                            candidate_required_location: 'Worldwide',
                            description: 'Oferta reciente en español para desarrollador frontend.',
                        }],
                    }),
                };
            });

            const resultado = await ejecutarScrapingRemotive({
                terminos: ['frontend', 'qa'],
                maxResultados: 10,
            });

            expect(resultado.length).toBe(1);
            expect(resultado[0].titulo).toBe('Desarrollador Frontend Fresco');
            expect(resultado.metricas.antiguasDescartadas).toBe(1);
            expect(resultado.metricas.consultasEjecutadas).toBe(2);
        });
    });

    describe('_filtrarPorVentanaPublicacion()', () => {
        const ahora = Date.now();
        const hace10Dias = new Date(ahora - 10 * 24 * 60 * 60 * 1000);
        const hace20Dias = new Date(ahora - 20 * 24 * 60 * 60 * 1000);
        const hace40Dias = new Date(ahora - 40 * 24 * 60 * 60 * 1000);
        const enElFuturo = new Date(ahora + 48 * 60 * 60 * 1000);

        test('conserva ofertas dentro de la ventana de 30 días (10d y 20d)', () => {
            const ofertas = [
                { titulo: '10 días', fecha_publicacion: hace10Dias },
                { titulo: '20 días', fecha_publicacion: hace20Dias },
            ];
            const resultado = _filtrarPorVentanaPublicacion(ofertas, 30, ahora);
            expect(resultado.length).toBe(2);
        });

        test('descarta ofertas más antiguas que la ventana de 30 días (40d)', () => {
            const ofertas = [
                { titulo: '40 días', fecha_publicacion: hace40Dias },
            ];
            const resultado = _filtrarPorVentanaPublicacion(ofertas, 30, ahora);
            expect(resultado.length).toBe(0);
            expect(resultado.antiguasDescartadas).toBe(1);
        });

        test('conserva ofertas sin fecha conocida (null)', () => {
            const ofertas = [
                { titulo: 'Sin fecha', fecha_publicacion: null },
            ];
            const resultado = _filtrarPorVentanaPublicacion(ofertas, 30, ahora);
            expect(resultado.length).toBe(1);
            expect(resultado.sinFechaConocida).toBe(1);
        });

        test('sanitiza fechas inválidas a null y las conserva defensivamente', () => {
            const ofertas = [
                { titulo: 'Fecha corrupta', fecha_publicacion: new Date('fecha-invalida') },
            ];
            const resultado = _filtrarPorVentanaPublicacion(ofertas, 30, ahora);
            expect(resultado.length).toBe(1);
            expect(resultado[0].fecha_publicacion).toBeNull();
            expect(resultado.sinFechaConocida).toBe(1);
        });

        test('sanitiza fechas futuras improbables (>24h) a null y las conserva', () => {
            const ofertas = [
                { titulo: 'Del futuro', fecha_publicacion: enElFuturo },
            ];
            const resultado = _filtrarPorVentanaPublicacion(ofertas, 30, ahora);
            expect(resultado.length).toBe(1);
            expect(resultado[0].fecha_publicacion).toBeNull();
            expect(resultado.sinFechaConocida).toBe(1);
        });

        test('admite ventana personalizada (ej. 14 días descarta 20 días)', () => {
            const ofertas = [
                { titulo: '10 días', fecha_publicacion: hace10Dias },
                { titulo: '20 días', fecha_publicacion: hace20Dias },
            ];
            const resultado = _filtrarPorVentanaPublicacion(ofertas, 14, ahora);
            expect(resultado.length).toBe(1);
            expect(resultado[0].titulo).toBe('10 días');
            expect(resultado.antiguasDescartadas).toBe(1);
        });

        test('retorna array vacío si el input está vacío', () => {
            const resultado = _filtrarPorVentanaPublicacion([], 30, ahora);
            expect(resultado).toEqual([]);
        });
    });

    describe('B-03: Consolidación y selección del mejor contenido entre duplicados del mismo lote', () => {
        test('consolidarOfertaDuplicada conserva la descripción más completa sin importar el orden', () => {
            const ofertaCorta = {
                titulo: 'Dev',
                descripcion: 'Texto corto',
                ubicacion: null,
                modalidad: null,
                empresa: 'Acme',
            };
            const ofertaLarga = {
                titulo: 'Dev',
                descripcion: 'Texto largo y completo con todos los requisitos...',
                ubicacion: 'CABA',
                modalidad: 'Remoto',
                empresa: 'Acme',
            };

            // Orden 1: corta primero, larga después
            const consolidada1 = consolidarOfertaDuplicada(ofertaCorta, ofertaLarga);
            expect(consolidada1.descripcion).toBe(ofertaLarga.descripcion);
            expect(consolidada1.ubicacion).toBe('CABA');
            expect(consolidada1.modalidad).toBe('Remoto');

            // Orden 2: larga primero, corta después
            const consolidada2 = consolidarOfertaDuplicada(ofertaLarga, ofertaCorta);
            expect(consolidada2.descripcion).toBe(ofertaLarga.descripcion);
            expect(consolidada2.ubicacion).toBe('CABA');
            expect(consolidada2.modalidad).toBe('Remoto');
        });

        test('consolidarOfertaDuplicada completa empresa, nivel, salarios y moneda ausentes', () => {
            const existente = {
                titulo: 'Dev',
                empresa: null,
                nivel_requerido: null,
                salario_min: null,
                salario_max: null,
                moneda: null,
            };
            const nueva = {
                titulo: 'Dev',
                empresa: 'Empresa SA',
                nivel_requerido: 'Junior',
                salario_min: 1000,
                salario_max: 2000,
                moneda: 'USD',
            };

            const consolidada = consolidarOfertaDuplicada(existente, nueva);
            expect(consolidada.empresa).toBe('Empresa SA');
            expect(consolidada.nivel_requerido).toBe('Junior');
            expect(consolidada.salario_min).toBe(1000);
            expect(consolidada.salario_max).toBe(2000);
            expect(consolidada.moneda).toBe('USD');
        });

        test('deduplicarYConsolidarLote consolida duplicados con la misma identidad en ambos órdenes', () => {
            const itemIncompleto = {
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&from=serp',
                plataforma: 'indeed',
                titulo: 'Backend Dev',
                descripcion: 'Extracto parcial',
                ubicacion: null,
            };
            const itemCompleto = {
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&utm_source=share',
                plataforma: 'indeed',
                titulo: 'Backend Dev',
                descripcion: 'Descripción completa y detallada con tecnologías...',
                ubicacion: 'Buenos Aires',
            };

            // Caso A: incompleto primero, completo segundo
            const resA = deduplicarYConsolidarLote([itemIncompleto, itemCompleto]);
            expect(resA.ofertasDeduplicadas.length).toBe(1);
            expect(resA.duplicadasDescartadas).toBe(1);
            expect(resA.ofertasDeduplicadas[0].descripcion).toBe(itemCompleto.descripcion);
            expect(resA.ofertasDeduplicadas[0].ubicacion).toBe('Buenos Aires');

            // Caso B: completo primero, incompleto segundo
            const resB = deduplicarYConsolidarLote([itemCompleto, itemIncompleto]);
            expect(resB.ofertasDeduplicadas.length).toBe(1);
            expect(resB.duplicadasDescartadas).toBe(1);
            expect(resB.ofertasDeduplicadas[0].descripcion).toBe(itemCompleto.descripcion);
            expect(resB.ofertasDeduplicadas[0].ubicacion).toBe('Buenos Aires');
        });

        test('ejecutarScrapingIndeed preserva el contenido completo entre duplicados del mismo lote en ambos órdenes', async () => {
            const itemSinDesc = {
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&from=serp',
                title: 'Backend Dev',
                employer: { name: 'Empresa Test' },
                location: { city: 'CABA', countryName: 'Argentina' },
                description: { text: '' },
            };
            const itemConDesc = {
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&utm_source=campaign',
                title: 'Backend Dev',
                employer: { name: 'Empresa Test' },
                location: { city: 'CABA', countryName: 'Argentina' },
                description: { text: 'Descripción completa y rica obtenida en la misma corrida...' },
            };

            // Orden 1: sin descripción primero
            clienteApify.dataset().listItems.mockResolvedValueOnce({
                items: [itemSinDesc, itemConDesc],
            });
            const res1 = await ejecutarScrapingIndeed();
            expect(res1.length).toBe(1);
            expect(res1.duplicadasDescartadas).toBe(1);
            expect(res1[0].descripcion).toBe(itemConDesc.description.text);

            // Orden 2: con descripción primero
            clienteApify.dataset().listItems.mockResolvedValueOnce({
                items: [itemConDesc, itemSinDesc],
            });
            const res2 = await ejecutarScrapingIndeed();
            expect(res2.length).toBe(1);
            expect(res2.duplicadasDescartadas).toBe(1);
            expect(res2[0].descripcion).toBe(itemConDesc.description.text);
        });
    });

}); // fin describe('Servicio de scraping')
