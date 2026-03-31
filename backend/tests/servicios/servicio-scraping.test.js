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
        },
        construirUrlsLinkedin: jest.fn(() => [
            'https://www.linkedin.com/jobs/search/?keywords=frontend+developer+junior&location=Argentina&f_E=1%2C2',
        ]),
        construirUrlsComputrabajo: jest.fn(() => [
            'https://www.computrabajo.com.ar/trabajo-de-frontend-developer-junior',
        ]),
    };
});

const { clienteApify } = require('../../src/config/apify');
const {
    ejecutarScrapingLinkedin,
    ejecutarScrapingComputrabajo,
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
});
