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
            'https://www.linkedin.com/jobs/search/?keywords=frontend+developer+junior&location=Argentina&f_E=1%2C2',
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

        test('pasa count y scrapeCompany al actor', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-linkedin-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsLinkedinFalsos });

            await ejecutarScrapingLinkedin({ maxResultados: 50 });

            // Verifico que se pasó el count correcto al actor.
            expect(mockCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    count: 50,
                    scrapeCompany: false,
                })
            );
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

        test('llama al actor correcto', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-ct-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsComputrabajoFalsos });

            await ejecutarScrapingComputrabajo();

            expect(clienteApify.actor).toHaveBeenCalledWith('actor-computrabajo-test');
        });

        test('retorna ofertas normalizadas de Computrabajo', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-ct-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsComputrabajoFalsos });

            const resultado = await ejecutarScrapingComputrabajo();

            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBeGreaterThan(0);
            expect(resultado[0].plataforma).toBe('computrabajo');
            expect(resultado[0].titulo).toBe('Desarrollador Web Junior');
        });

        test('tira error descriptivo si falla la API de Apify', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockRejectedValue(new Error('Token inválido'));

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

        test('ejecuta el actor una vez por cada término de búsqueda', async () => {
            const mockCall = clienteApify.actor().call;
            mockCall.mockResolvedValue({ defaultDatasetId: 'dataset-indeed-123' });

            const mockListItems = clienteApify.dataset().listItems;
            mockListItems.mockResolvedValue({ items: itemsIndeedFalsos });

            await ejecutarScrapingIndeed({
                terminos: ['react developer', 'angular developer'],
            });

            // Debería llamar al actor 2 veces (una por cada término).
            expect(mockCall).toHaveBeenCalledTimes(2);
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
                        published_at: 1711929600,
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
                    updated: '2026-03-28T12:00:00.0000000',
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

            // 1 término × 2 países (Argentina + España) = 2 resultados
            expect(resultado).toBeInstanceOf(Array);
            expect(resultado.length).toBe(2);
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

            // termino-que-falla/Argentina falla (0), termino-que-falla/España OK (1),
            // frontend/Argentina OK (1), frontend/España OK (1) = 3 ofertas
            expect(resultado.length).toBe(3);
        });

        test('tira error descriptivo si fetch lanza excepción', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(ejecutarScrapingJooble()).rejects.toThrow(
                'Error al ejecutar scraping de Jooble'
            );
        });
    });
});
