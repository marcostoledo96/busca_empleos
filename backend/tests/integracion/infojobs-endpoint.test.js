// Tests de integración del endpoint POST /api/scraping/infojobs.
//
// ¿Qué cubre esta suite?
// ------------------------------------------------------------------
// A diferencia de los tests de controlador (que mockean el servicio
// entero) y los de servicio (que mockean fetch), estos tests recorren
// el pipeline REAL completo:
//
//   Request HTTP (supertest)
//     → ruta Express (/api/scraping/infojobs)
//     → controlador (scrapearInfojobs)
//     → servicio (ejecutarScrapingInfojobs) — CON código real
//     → normalizador (normalizarOfertaInfojobs) — CON código real
//
// Solo mockeo lo que tiene efecto secundario externo:
//   - middleware de autenticación (Firebase, no disponible en tests)
//   - modeloOferta.crearOferta (PostgreSQL, no disponible en tests)
//   - global.fetch (la API real de InfoJobs, requiere credenciales)
//
// Casos cubiertos:
//   a) Respuesta realista con teleworking remoto puro → se extraen ofertas.
//   b) Oferta presencial/híbrida → el normalizador la descarta → 0 extraídas.
//   c) Sin credenciales → servicio retorna [] sin romper → 0 extraídas.
//   d) Shape legacy con propiedad `items` en lugar de `offers` → sigue funcionando.

// --- Mocks de módulos con efecto secundario externo ---

// Mockeo el middleware de autenticación para que no intente verificar
// un token de Firebase que no existe en el entorno de tests.
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));

// Mockeo solo crearOferta: no quiero tocar la BD real.
// El resto del módulo de oferta no se usa en este flujo.
jest.mock('../../src/modelos/oferta');

const request = require('supertest');
const app = require('../../src/app');
const modeloOferta = require('../../src/modelos/oferta');

// ---------------------------------------------------------------------------
// Datos de prueba — simulan el shape real de la API de InfoJobs.
// ---------------------------------------------------------------------------

// Oferta de remoto puro con el shape documentado:
//   teleworking: objeto PD { id: number, value: string }
const ofertaRemotaPura = {
    link: 'https://www.infojobs.net/oferta-trabajo/frontend-developer_test-001.xhtml',
    title: 'Frontend Developer Junior',
    author: { name: 'Empresa Tech SRL' },
    city: 'Madrid',
    province: { value: 'Madrid' },
    teleworking: { id: 2, value: 'Solo teletrabajo' },
    requirementMin: 'Buscamos desarrollador frontend con React y TypeScript.',
    experienceMin: { value: 'Al menos 1 año' },
    salaryMin: { value: '18000' },
    salaryMax: { value: '25000' },
    salaryDescription: '€ Bruto/año',
    published: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
};

// Oferta presencial (no debe pasar el filtro del normalizador).
const ofertaPresencial = {
    ...ofertaRemotaPura,
    link: 'https://www.infojobs.net/oferta-trabajo/qa-tester_test-002.xhtml',
    title: 'QA Tester Junior',
    teleworking: { id: 1, value: 'Presencial' },
};

// Oferta híbrida (tampoco debe pasar).
const ofertaHibrida = {
    ...ofertaRemotaPura,
    link: 'https://www.infojobs.net/oferta-trabajo/dev-ops_test-003.xhtml',
    title: 'DevOps Junior',
    teleworking: { id: 3, value: 'Teletrabajo parcial' },
};

// ---------------------------------------------------------------------------
// Suite de integración
// ---------------------------------------------------------------------------

describe('Integración: POST /api/scraping/infojobs', () => {

    // Guardo la referencia al fetch real para restaurarlo después.
    let fetchOriginal;

    beforeEach(() => {
        // Guardo y reemplazo global.fetch en cada test.
        fetchOriginal = global.fetch;
        jest.clearAllMocks();

        // Configuro credenciales por defecto en el entorno de tests.
        // Cada test puede sobreescribirlas o borrarlas según necesite.
        process.env.INFOJOBS_CLIENT_ID = 'client-id-de-prueba';
        process.env.INFOJOBS_CLIENT_SECRET = 'client-secret-de-prueba';
    });

    afterEach(() => {
        // Restauro global.fetch y limpio las credenciales para no
        // contaminar tests que verifican el comportamiento sin credenciales.
        global.fetch = fetchOriginal;
        delete process.env.INFOJOBS_CLIENT_ID;
        delete process.env.INFOJOBS_CLIENT_SECRET;
    });

    // -----------------------------------------------------------------------
    // Caso a): Respuesta realista con oferta de remoto puro.
    // El endpoint debe reportar ofertas_nuevas > 0 y total_extraidas > 0.
    // -----------------------------------------------------------------------
    test('a) oferta remoto puro → endpoint reporta ofertas_nuevas > 0 y total_extraidas > 0', async () => {
        // Simulo la respuesta de la API de InfoJobs con una oferta de remoto puro.
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                offers: [ofertaRemotaPura],
            }),
        });

        // Simulo que la oferta no existía en la BD → crearOferta la guarda.
        modeloOferta.crearOferta.mockResolvedValue({ id: 42 });

        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({ maxResultados: 10, terminos: ['frontend junior'] });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.datos.plataforma).toBe('infojobs');
        expect(res.body.datos.total_extraidas).toBeGreaterThan(0);
        expect(res.body.datos.ofertas_nuevas).toBeGreaterThan(0);
        expect(res.body.datos.ofertas_duplicadas).toBe(0);
        expect(res.body.datos.mensaje).toContain('InfoJobs');

        // Verifico que crearOferta recibió los campos clave normalizados correctamente.
        expect(modeloOferta.crearOferta).toHaveBeenCalledWith(
            expect.objectContaining({
                titulo: 'Frontend Developer Junior',
                plataforma: 'infojobs',
                modalidad: 'remoto',
            })
        );
    });

    // -----------------------------------------------------------------------
    // Caso b): Oferta presencial/híbrida → el normalizador la descarta.
    // El endpoint debe reportar 0 extraídas (el pipeline real filtra).
    // -----------------------------------------------------------------------
    test('b) oferta presencial/híbrida → normalizador la descarta → 0 extraídas', async () => {
        // La API devuelve una oferta presencial y una híbrida.
        // El normalizarOfertaInfojobs() real debe rechazarlas.
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                offers: [ofertaPresencial, ofertaHibrida],
            }),
        });

        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({ maxResultados: 10, terminos: ['qa junior'] });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.datos.total_extraidas).toBe(0);
        expect(res.body.datos.ofertas_nuevas).toBe(0);

        // El normalizador descartó todo → crearOferta nunca fue llamado.
        expect(modeloOferta.crearOferta).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Caso c): Sin credenciales → el servicio retorna [] sin lanzar error.
    // El endpoint debe devolver 200 con 0 extraídas.
    // -----------------------------------------------------------------------
    test('c) sin credenciales → servicio retorna [] silenciosamente → 0 extraídas sin error', async () => {
        // Borro ambas credenciales para simular un entorno sin configuración.
        delete process.env.INFOJOBS_CLIENT_ID;
        delete process.env.INFOJOBS_CLIENT_SECRET;

        // Instalo un fetch falso para detectar si se llama indebidamente.
        global.fetch = jest.fn();

        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.datos.total_extraidas).toBe(0);
        expect(res.body.datos.ofertas_nuevas).toBe(0);

        // El servicio debe haber cortado antes de hacer fetch (sin credenciales).
        expect(global.fetch).not.toHaveBeenCalled();
        expect(modeloOferta.crearOferta).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Caso d): Shape legacy con propiedad `items` en lugar de `offers`.
    // La API tuvo inconsistencias entre docs y ejemplos reales.
    // El servicio debe tolerar ambas formas.
    // -----------------------------------------------------------------------
    test('d) shape legacy con propiedad `items` → sigue funcionando correctamente', async () => {
        // Simulo que la API devuelve `items` (shape alternativo observado en el pasado).
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                items: [ofertaRemotaPura],
            }),
        });

        modeloOferta.crearOferta.mockResolvedValue({ id: 99 });

        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({ maxResultados: 5, terminos: ['desarrollador'] });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.datos.total_extraidas).toBeGreaterThan(0);
        expect(res.body.datos.ofertas_nuevas).toBeGreaterThan(0);

        // Verifico que la normalización del shape legacy produce el mismo resultado.
        expect(modeloOferta.crearOferta).toHaveBeenCalledWith(
            expect.objectContaining({
                plataforma: 'infojobs',
                modalidad: 'remoto',
            })
        );
    });

    // -----------------------------------------------------------------------
    // Caso extra: Dos ofertas, una nueva y una duplicada.
    // Verifica que los contadores se calculan correctamente end-to-end.
    // -----------------------------------------------------------------------
    test('extra) dos ofertas remotas → una nueva, una duplicada → contadores correctos', async () => {
        const ofertaRemota2 = {
            ...ofertaRemotaPura,
            link: 'https://www.infojobs.net/oferta-trabajo/node-developer_test-004.xhtml',
            title: 'Node Developer Junior',
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                offers: [ofertaRemotaPura, ofertaRemota2],
            }),
        });

        // Primera oferta: guardada (retorna objeto). Segunda: duplicada (retorna null).
        modeloOferta.crearOferta
            .mockResolvedValueOnce({ id: 10 })
            .mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/scraping/infojobs')
            .send({ maxResultados: 10, terminos: ['developer'] });

        expect(res.status).toBe(200);
        expect(res.body.datos.total_extraidas).toBe(2);
        expect(res.body.datos.ofertas_nuevas).toBe(1);
        expect(res.body.datos.ofertas_duplicadas).toBe(1);
    });
});
