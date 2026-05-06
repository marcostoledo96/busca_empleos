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
            BUMERAN_WEB: 'actor-web-scraper-test',
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

    beforeEach(() => {
        // Limpio los mocks antes de cada test para evitar contaminación.
        jest.clearAllMocks();
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
                })
            );

            const inputLlamada = mockCall.mock.calls[0][0];
            expect(inputLlamada.urls[0]).toContain('f_TPR=r1209600');
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('API rate limit exceeded'));

            await expect(ejecutarScrapingLinkedin()).rejects.toThrow(
                'Error al ejecutar scraping de LinkedIn'
            );
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

            await expect(ejecutarScrapingComputrabajo()).rejects.toThrow(
                'Error al ejecutar scraping de Computrabajo'
            );
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

            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'react developer',
                    country: 'ar',
                    limit: 20,
                })
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

            // Ahora se ejecuta 1 solo run con query unificada (evita cobro de
            // compute por cada término).
            expect(mockCall).toHaveBeenCalledTimes(1);
            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'react developer OR angular developer',
                })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('API rate limit exceeded'));

            await expect(
                ejecutarScrapingIndeed({ terminos: ['frontend developer junior'] })
            ).rejects.toThrow(
                'Error al ejecutar scraping de Indeed'
            );
        });
    });

    describe('ejecutarScrapingBumeran()', () => {

        test('llama al actor web-scraper correcto', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsBumeranFalsos });

            await ejecutarScrapingBumeran();

            expect(clienteApify.actor).toHaveBeenCalledWith('actor-web-scraper-test');
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

        test('pasa startUrls y pageFunction al actor', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-bumeran-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsBumeranFalsos });

            await ejecutarScrapingBumeran();

            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    startUrls: expect.any(Array),
                    pageFunction: expect.any(String),
                })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('Timeout'));

            await expect(ejecutarScrapingBumeran()).rejects.toThrow(
                'Error al ejecutar scraping de Bumeran'
            );
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

        test('aplana correctamente arrays anidados del dataset de web-scraper', async () => {
            // web-scraper guarda el return value de pageFunction como UN item del dataset.
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
                })
            );
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('Glassdoor blocked'));

            await expect(ejecutarScrapingGlassdoor()).rejects.toThrow(
                'Error al ejecutar scraping de Glassdoor'
            );
        });
    });

    // ===========================================================================
    // GetOnBrd — usa fetch() nativo, NO Apify
    // ===========================================================================

    describe('ejecutarScrapingGetonbrd()', () => {
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

            await ejecutarScrapingGetonbrd({ terminos: ['qa tester'] });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('qa%20tester')
            );
        });

        test('retorna ofertas normalizadas de GetOnBrd', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(respuestaGetonbrdFalsa),
            });

            const resultado = await ejecutarScrapingGetonbrd({ terminos: ['frontend'] });

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(1);
            expect(resultado[0].plataforma).toBe('getonbrd');
            expect(resultado[0].titulo).toBe('Frontend Developer Junior');
            expect(resultado[0].modalidad).toBe('remoto');
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

            // Con maxResultados=50, debe procesar las 3 páginas (1 item c/u).
            const resultado = await ejecutarScrapingGetonbrd({ terminos: ['qa'], maxResultados: 50 });

            // 3 páginas × 1 item = 3 items (aunque la URL puede estar duplicada).
            // El servicio normaliza todos; la deduplicación real es por BD.
            expect(resultado.length).toBeGreaterThanOrEqual(1);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        test('continua con el siguiente término si la API devuelve error HTTP', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: false, status: 429 }) // primer término falla
                .mockResolvedValue({
                    ok: true,
                    json: jest.fn().mockResolvedValue(respuestaGetonbrdFalsa),
                }); // segundo término OK

            const resultado = await ejecutarScrapingGetonbrd({
                terminos: ['termino-que-falla', 'frontend'],
            });

            // El primer término falló, el segundo dio 1 oferta.
            expect(resultado.length).toBe(1);
        });

        test('tira error descriptivo si fetch lanza excepción', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(ejecutarScrapingGetonbrd()).rejects.toThrow(
                'Error al ejecutar scraping de GetOnBrd'
            );
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

            await ejecutarScrapingJooble({ terminos: ['qa tester'] });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('jooble.org/api/'),
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.stringContaining('qa tester'),
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

            await expect(ejecutarScrapingJooble()).rejects.toThrow(
                'Error al ejecutar scraping de Jooble'
            );
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

        test('retorna array vacío y no tira error si faltan ambas credenciales', async () => {
            delete process.env.INFOJOBS_CLIENT_ID;
            delete process.env.INFOJOBS_CLIENT_SECRET;

            const resultado = await ejecutarScrapingInfojobs({ terminos: ['frontend'] });

            expect(resultado).toEqual([]);
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
                })
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

}); // fin describe('Servicio de scraping')
