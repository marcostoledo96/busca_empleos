// Tests del registry de plataformas — verifico que la fuente de verdad funciona
// correctamente: ids únicos, slugs únicos, plataformas inactivas, normalización.
//
// ¿Qué es el registry? Es un catálogo centralizado que define todas las plataformas
// que el sistema conoce. En vez de tener listas sueltas en cada archivo, todo sale
// de config/plataformas.js. Los tests aseguran que no se rompa nada al agregar o
// desactivar plataformas.

const {
    PLATAFORMAS,
    PLATAFORMAS_ACTIVAS,
    IDS_PLATAFORMAS,
    SLUG_HTTP_A_ID,
    obtenerPlataformasActivas,
    esPlataformaActiva,
    normalizarIdPlataforma,
} = require('../../src/config/plataformas');

describe('Registry de plataformas', () => {
    // === Estructura del registry ===

    describe('estructura base', () => {
        test('PLATAFORMAS tiene todas las plataformas esperadas', () => {
            const idsEsperados = [
                'linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor',
                'getonbrd', 'jooble', 'google_jobs', 'remotive', 'remoteok',
                'infojobs', 'adzuna',
            ];
            expect(Object.keys(PLATAFORMAS).sort()).toEqual(idsEsperados.sort());
        });

        test('cada plataforma tiene los campos obligatorios', () => {
            for (const [id, plataforma] of Object.entries(PLATAFORMAS)) {
                expect(plataforma.id).toBe(id);
                expect(typeof plataforma.slugHttp).toBe('string');
                expect(plataforma.slugHttp.length).toBeGreaterThan(0);
                expect(typeof plataforma.label).toBe('string');
                expect(plataforma.label.length).toBeGreaterThan(0);
                expect(typeof plataforma.activa).toBe('boolean');
            }
        });

        test('los ids son únicos (no hay duplicados)', () => {
            const ids = Object.keys(PLATAFORMAS);
            const idsUnicos = new Set(ids);
            expect(idsUnicos.size).toBe(ids.length);
        });

        test('los slugs HTTP son únicos (no hay duplicados)', () => {
            const slugs = Object.values(PLATAFORMAS).map(p => p.slugHttp);
            const slugsUnicos = new Set(slugs);
            expect(slugsUnicos.size).toBe(slugs.length);
        });

        test('Google Jobs tiene activa: false', () => {
            expect(PLATAFORMAS.google_jobs.activa).toBe(false);
            expect(PLATAFORMAS.google_jobs.motivo).toBeDefined();
            expect(PLATAFORMAS.google_jobs.motivo.length).toBeGreaterThan(0);
        });

        test('InfoJobs tiene activa: false', () => {
            expect(PLATAFORMAS.infojobs.activa).toBe(false);
            expect(PLATAFORMAS.infojobs.motivo).toBeDefined();
            expect(PLATAFORMAS.infojobs.motivo.length).toBeGreaterThan(0);
        });

        test('las plataformas activas no tienen campo motivo', () => {
            for (const plataforma of PLATAFORMAS_ACTIVAS) {
                expect(plataforma.motivo).toBeUndefined();
            }
        });
    });

    // === Derivaciones del registry ===

    describe('PLATAFORMAS_ACTIVAS', () => {
        test('solo contiene plataformas con activa: true', () => {
            for (const plataforma of PLATAFORMAS_ACTIVAS) {
                expect(plataforma.activa).toBe(true);
            }
        });

        test('no incluye Google Jobs, InfoJobs ni GetOnBrd', () => {
            const ids = PLATAFORMAS_ACTIVAS.map(p => p.id);
            expect(ids).not.toContain('google_jobs');
            expect(ids).not.toContain('infojobs');
            expect(ids).not.toContain('getonbrd');
        });

        test('incluye todas las plataformas activas esperadas', () => {
            const idsEsperados = [
                'linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor',
                'jooble', 'remotive', 'remoteok', 'adzuna',
            ];
            const idsActivos = PLATAFORMAS_ACTIVAS.map(p => p.id).sort();
            expect(idsActivos).toEqual(idsEsperados.sort());
        });
    });

    describe('IDS_PLATAFORMAS', () => {
        test('contiene todos los ids del registry (incluyendo inactivas)', () => {
            const idsDelRegistry = Object.keys(PLATAFORMAS);
            for (const id of idsDelRegistry) {
                expect(IDS_PLATAFORMAS.has(id)).toBe(true);
            }
        });

        test('contiene google_jobs y infojobs (inactivas incluidas)', () => {
            expect(IDS_PLATAFORMAS.has('google_jobs')).toBe(true);
            expect(IDS_PLATAFORMAS.has('infojobs')).toBe(true);
        });
    });

    // === Normalización de slugs HTTP ===

    describe('normalización de ids y slugs', () => {
        test('Google Jobs: slug HTTP "google-jobs" normaliza a id "google_jobs"', () => {
            expect(normalizarIdPlataforma('google-jobs')).toBe('google_jobs');
        });

        test('LinkedIn: slug e id coinciden', () => {
            expect(normalizarIdPlataforma('linkedin')).toBe('linkedin');
        });

        test('plataforma desconocida retorna null', () => {
            expect(normalizarIdPlataforma('desconocida')).toBeNull();
            expect(normalizarIdPlataforma('')).toBeNull();
        });

        test('SLUG_HTTP_A_ID mapea correctamente todos los slugs', () => {
            for (const plataforma of Object.values(PLATAFORMAS)) {
                expect(SLUG_HTTP_A_ID[plataforma.slugHttp]).toBe(plataforma.id);
            }
        });
    });

    // === esPlataformaActiva ===

    describe('esPlataformaActiva()', () => {
        test('retorna true para plataformas activas', () => {
            expect(esPlataformaActiva('linkedin')).toBe(true);
            expect(esPlataformaActiva('computrabajo')).toBe(true);
            expect(esPlataformaActiva('indeed')).toBe(true);
            expect(esPlataformaActiva('adzuna')).toBe(true);
        });

        test('retorna false para plataformas inactivas', () => {
            expect(esPlataformaActiva('google_jobs')).toBe(false);
            expect(esPlataformaActiva('infojobs')).toBe(false);
        });

        test('retorna false para plataforma desconocida', () => {
            expect(esPlataformaActiva('desconocida')).toBe(false);
        });

        test('acepta slug HTTP y lo normaliza correctamente', () => {
            // google-jobs (slug HTTP) debe reconocerse como google_jobs (id)
            expect(esPlataformaActiva('google-jobs')).toBe(false);
            // Los slugs que coinciden con el id también deben funcionar
            expect(esPlataformaActiva('linkedin')).toBe(true);
        });
    });

    // === obtenerPlataformasActivas ===

    describe('obtenerPlataformasActivas()', () => {
        test('retorna array de objetos con id, slugHttp y label', () => {
            const activas = obtenerPlataformasActivas();
            expect(Array.isArray(activas)).toBe(true);
            expect(activas.length).toBeGreaterThan(0);

            for (const p of activas) {
                expect(p).toHaveProperty('id');
                expect(p).toHaveProperty('slugHttp');
                expect(p).toHaveProperty('label');
                // No debe incluir el campo motivo ni activa en la salida simplificada.
                expect(p).not.toHaveProperty('motivo');
            }
        });

        test('no incluye google_jobs ni infojobs', () => {
            const activas = obtenerPlataformasActivas();
            const ids = activas.map(p => p.id);
            expect(ids).not.toContain('google_jobs');
            expect(ids).not.toContain('infojobs');
        });
    });
});
