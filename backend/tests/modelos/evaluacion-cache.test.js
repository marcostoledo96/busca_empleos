// Tests para el modelo de cache de evaluaciones (evaluacion-cache.js).
//
// Mockeo completamente la BD con jest.mock para que los tests
// sean puros unitarios (sin conexión a PostgreSQL).

jest.mock('../../src/config/base-datos');

const modeloCache = require('../../src/modelos/evaluacion-cache');
const pool = require('../../src/config/base-datos');

describe('Modelo de cache de evaluaciones', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // === crearHashOferta ===

    describe('crearHashOferta()', () => {
        test('genera el mismo hash para ofertas identicas', () => {
            const oferta = {
                titulo: 'Desarrollador React',
                empresa: 'Empresa S.A.',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                descripcion: 'Buscamos desarrollador frontend.',
            };

            const hash1 = modeloCache.crearHashOferta(oferta);
            const hash2 = modeloCache.crearHashOferta(oferta);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex.
        });

        test('genera hashes distintos si cambia un campo', () => {
            const base = {
                titulo: 'Desarrollador React',
                empresa: 'Empresa S.A.',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                descripcion: 'Buscamos desarrollador frontend.',
            };

            const hashBase = modeloCache.crearHashOferta(base);

            const cambioEmpresa = { ...base, empresa: 'Otra S.A.' };
            expect(modeloCache.crearHashOferta(cambioEmpresa)).not.toBe(hashBase);

            const cambioModalidad = { ...base, modalidad: 'hibrido' };
            expect(modeloCache.crearHashOferta(cambioModalidad)).not.toBe(hashBase);
        });

        test('ignora diferencias de mayusculas y tildes', () => {
            const ofertaA = {
                titulo: 'Desarrollador Angular',
                empresa: 'Empresa S.A.',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                descripcion: 'Buscamos desarrollador frontend.',
            };

            const ofertaB = {
                titulo: 'desarrollador angular',
                empresa: 'empresa s.a.',
                ubicacion: 'caba',
                modalidad: 'remoto',
                descripcion: 'buscamos desarrollador frontend.',
            };

            expect(modeloCache.crearHashOferta(ofertaA)).toBe(modeloCache.crearHashOferta(ofertaB));
        });

        test('tolera campos undefined', () => {
            const oferta = {
                titulo: undefined,
                empresa: null,
                ubicacion: '',
                modalidad: '',
                descripcion: '',
            };

            const hash = modeloCache.crearHashOferta(oferta);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    // === crearHashPreferencias ===

    describe('crearHashPreferencias()', () => {
        test('genera el mismo hash para preferencias identicas', () => {
            const prefs = {
                nivel_experiencia: 'junior',
                stack_tecnologico: ['React', 'Node.js'],
                modalidad_aceptada: 'cualquiera',
                zonas_preferidas: ['CABA'],
                reglas_exclusion: ['Java'],
                idioma_candidato: 'Espanol',
            };

            const hash1 = modeloCache.crearHashPreferencias(prefs);
            const hash2 = modeloCache.crearHashPreferencias(prefs);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        });

        test('genera hashes distintos si cambia un campo del perfil ampliado', () => {
            const base = {
                nivel_experiencia: 'junior',
                stack_tecnologico: ['React'],
                modalidad_aceptada: 'cualquiera',
                zonas_preferidas: ['CABA'],
                reglas_exclusion: [],
                idioma_candidato: 'Espanol',
                tecnologias_detalle: [{ nombre: 'React', nivel: 'medio' }],
                roles_objetivo_detalle: [{ rol: 'Frontend', prioridad: 'alta' }],
                nivel_ingles_detalle: null,
                nivel_real_seniority: null,
                conocimientos_ausentes: [],
                limitaciones_explicitas: null,
                keywords_positivas: [],
                keywords_negativas: [],
                plataformas_preferidas: [],
                plataformas_excluidas: [],
            };

            const hashBase = modeloCache.crearHashPreferencias(base);

            const cambioTecnologias = { ...base, tecnologias_detalle: [{ nombre: 'React', nivel: 'avanzado' }] };
            expect(modeloCache.crearHashPreferencias(cambioTecnologias)).not.toBe(hashBase);
        });

        test('ignora scoring_config al generar el hash (campo deprecado)', () => {
            const base = {
                nivel_experiencia: 'junior',
                stack_tecnologico: ['React'],
                modalidad_aceptada: 'cualquiera',
                zonas_preferidas: ['CABA'],
                reglas_exclusion: [],
                idioma_candidato: 'Espanol',
                tecnologias_detalle: [{ nombre: 'React', nivel: 'medio' }],
                roles_objetivo_detalle: [{ rol: 'Frontend', prioridad: 'alta' }],
                nivel_ingles_detalle: null,
                nivel_real_seniority: null,
                conocimientos_ausentes: [],
                limitaciones_explicitas: null,
                keywords_positivas: [],
                keywords_negativas: [],
                plataformas_preferidas: [],
                plataformas_excluidas: [],
            };

            // scoring_config NO participa en el hash — es un campo deprecado.
            const sinScoring = modeloCache.crearHashPreferencias(base);
            const conScoring = modeloCache.crearHashPreferencias({
                ...base,
                scoring_config: { umbral_aprobacion: 60 },
            });

            // Ambos hashes deben ser idénticos porque scoring_config se ignora.
            expect(sinScoring).toBe(conScoring);
        });
    });

    // === buscarCache ===

    describe('buscarCache()', () => {
        test('devuelve el resultado cuando existe cache hit', async () => {
            const resultadoEsperado = { match: true, razon: 'Coincide con el perfil.' };
            pool.query.mockResolvedValueOnce({
                rows: [{ resultado: resultadoEsperado }],
            });

            const resultado = await modeloCache.buscarCache('hashOferta123', 'hashPrefs456', 'deepseek-v4-flash');

            expect(resultado).toEqual(resultadoEsperado);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT resultado FROM evaluaciones_cache'),
                ['hashOferta123', 'hashPrefs456', 'deepseek-v4-flash']
            );
        });

        test('devuelve null cuando hay cache miss', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const resultado = await modeloCache.buscarCache('hashX', 'hashY', 'modeloA');

            expect(resultado).toBeNull();
        });
    });

    // === guardarCache ===

    describe('guardarCache()', () => {
        test('guarda correctamente el resultado serializado', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const resultado = { match: false, razon: 'No coincide con el perfil.' };
            await modeloCache.guardarCache('hashOferta789', 'hashPrefs012', 'deepseek-v4-flash', resultado);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO evaluaciones_cache'),
                [
                    'hashOferta789',
                    'hashPrefs012',
                    'deepseek-v4-flash',
                    JSON.stringify(resultado),
                ]
            );
        });

        test('no falla si la query falla (ON CONFLICT DO NOTHING)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await expect(
                modeloCache.guardarCache('h1', 'h2', 'm1', { score: 70 })
            ).resolves.toBeUndefined();
        });
    });
});
