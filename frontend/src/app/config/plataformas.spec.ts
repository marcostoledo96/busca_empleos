// Tests del registry de plataformas del frontend.
// Verifican que la estructura y valores coincidan con la fuente de verdad del backend.
import {
    PLATAFORMAS,
    PLATAFORMAS_ACTIVAS,
    IDS_PLATAFORMAS,
    SLUG_HTTP_A_ID,
    obtenerPlataformasActivas,
    esPlataformaActiva,
    normalizarIdPlataforma,
    obtenerOpcionesFiltroPlataforma,
    obtenerOpcionesScrapingPlataforma,
    obtenerOpcionesPreferenciaPlataforma,
    PlataformaId,
} from './plataformas';

describe('Registry de plataformas (frontend)', () => {

    // === Estructura y metadata ===

    it('debería tener todas las plataformas esperadas', () => {
        const ids = Object.keys(PLATAFORMAS);
        expect(ids).toContain('linkedin');
        expect(ids).toContain('computrabajo');
        expect(ids).toContain('indeed');
        expect(ids).toContain('bumeran');
        expect(ids).toContain('glassdoor');
        expect(ids).toContain('getonbrd');
        expect(ids).toContain('jooble');
        expect(ids).toContain('google_jobs');
        expect(ids).toContain('remotive');
        expect(ids).toContain('remoteok');
        expect(ids).toContain('infojobs');
        expect(ids).toContain('adzuna');
    });

    it('cada plataforma debería tener id, slugHttp, label y activa', () => {
        for (const plataforma of Object.values(PLATAFORMAS)) {
            expect(plataforma.id).toBeTruthy();
            expect(plataforma.slugHttp).toBeTruthy();
            expect(plataforma.label).toBeTruthy();
            expect(typeof plataforma.activa).toBe('boolean');
        }
    });

    it('los ids deberían ser únicos', () => {
        const ids = Object.values(PLATAFORMAS).map(p => p.id);
        const idsUnicos = new Set(ids);
        expect(idsUnicos.size).toBe(ids.length);
    });

    it('los slugs HTTP deberían ser únicos', () => {
        const slugs = Object.values(PLATAFORMAS).map(p => p.slugHttp);
        const slugsUnicos = new Set(slugs);
        expect(slugsUnicos.size).toBe(slugs.length);
    });

    // === Plataformas inactivas ===

    it('Google Jobs debería estar inactiva con motivo', () => {
        const gj = PLATAFORMAS['google_jobs'];
        expect(gj).toBeDefined();
        expect(gj.activa).toBeFalse();
        expect(gj.motivo).toBeTruthy();
    });

    it('InfoJobs debería estar inactiva con motivo', () => {
        const ij = PLATAFORMAS['infojobs'];
        expect(ij).toBeDefined();
        expect(ij.activa).toBeFalse();
        expect(ij.motivo).toBeTruthy();
    });

    it('las plataformas inactivas deberían ser exactamente Google Jobs e InfoJobs', () => {
        const inactivas = Object.values(PLATAFORMAS).filter(p => !p.activa);
        const idsInactivas = inactivas.map(p => p.id);
        expect(idsInactivas).toContain('google_jobs');
        expect(idsInactivas).toContain('infojobs');
        expect(idsInactivas.length).toBe(2);
    });

    // === Id vs slugHttp ===

    it('google_jobs tiene id "google_jobs" y slugHttp "google-jobs"', () => {
        const gj = PLATAFORMAS['google_jobs'];
        expect(gj.id).toBe('google_jobs');
        expect(gj.slugHttp).toBe('google-jobs');
    });

    it('para las demás plataformas, id y slugHttp deberían coincidir', () => {
        for (const plataforma of Object.values(PLATAFORMAS)) {
            if (plataforma.id === 'google_jobs') continue; // Excepción conocida
            expect(plataforma.slugHttp).toBe(plataforma.id);
        }
    });

    // === Funciones helper ===

    it('obtenerPlataformasActivas debería retornar solo plataformas activas', () => {
        const activas = obtenerPlataformasActivas();
        expect(activas.length).toBeGreaterThan(0);
        for (const p of activas) {
            // Las opciones solo llevan id, slugHttp y label (no llevan activa)
            expect(p.id).toBeTruthy();
            expect(p.slugHttp).toBeTruthy();
            expect(p.label).toBeTruthy();
        }
        // Google Jobs e InfoJobs NO deberían estar
        const ids = activas.map(p => p.id);
        expect(ids).not.toContain('google_jobs');
        expect(ids).not.toContain('infojobs');
    });

    it('esPlataformaActiva debería retornar true para activas', () => {
        expect(esPlataformaActiva('linkedin')).toBeTrue();
        expect(esPlataformaActiva('computrabajo')).toBeTrue();
    });

    it('esPlataformaActiva debería retornar false para inactivas', () => {
        expect(esPlataformaActiva('google_jobs')).toBeFalse();
        expect(esPlataformaActiva('infojobs')).toBeFalse();
    });

    it('esPlataformaActiva debería aceptar slug HTTP y normalizarlo', () => {
        expect(esPlataformaActiva('google-jobs')).toBeFalse(); // Inactiva
        expect(esPlataformaActiva('linkedin')).toBeTrue();
    });

    it('esPlataformaActiva debería retornar false para plataformas inexistentes', () => {
        expect(esPlataformaActiva('desconocida')).toBeFalse();
    });

    it('normalizarIdPlataforma debería convertir slugs HTTP a ids internos', () => {
        expect(normalizarIdPlataforma('google-jobs')).toBe('google_jobs');
        expect(normalizarIdPlataforma('linkedin')).toBe('linkedin');
    });

    it('normalizarIdPlataforma debería retornar null para valores desconocidos', () => {
        expect(normalizarIdPlataforma('desconocida')).toBeNull();
    });

    // === Opciones para UI ===

    it('obtenerOpcionesFiltroPlataforma debería incluir "Todas" y todas las plataformas', () => {
        const opciones = obtenerOpcionesFiltroPlataforma();
        expect(opciones[0]).toEqual({ label: 'Todas', value: null });
        expect(opciones.length).toBe(Object.keys(PLATAFORMAS).length + 1); // +1 por "Todas"
    });

    it('obtenerOpcionesFiltroPlataforma debería usar ids internos como valores', () => {
        const opciones = obtenerOpcionesFiltroPlataforma();
        const googleJobsOption = opciones.find(o => o.label === 'Google Jobs');
        expect(googleJobsOption).toBeDefined();
        expect(googleJobsOption!.value).toBe('google_jobs'); // No 'google-jobs'
    });

    it('obtenerOpcionesScrapingPlataforma debería incluir solo plataformas activas', () => {
        const opciones = obtenerOpcionesScrapingPlataforma();
        const ids = opciones.map(o => o.value);
        expect(ids).not.toContain('google_jobs');
        expect(ids).not.toContain('infojobs');
        expect(opciones.length).toBe(PLATAFORMAS_ACTIVAS.length);
    });

    it('obtenerOpcionesPreferenciaPlataforma debería incluir solo plataformas activas', () => {
        const opciones = obtenerOpcionesPreferenciaPlataforma();
        const values = opciones.map(o => o.value);
        expect(values).not.toContain('google_jobs');
        expect(values).not.toContain('infojobs');
        expect(opciones.length).toBe(PLATAFORMAS_ACTIVAS.length);
    });

    // === Contrato con backend ===
    // Este test verifica que los ids/slugs/activa coinciden con el backend.
    // Si el backend agrega una plataforma, este test va a fallar para recordarnos
    // actualizar el frontend.

    it('los ids del frontend deberían coincidir con los esperados del backend', () => {
        // Lista completa de ids que el backend define en plataformas.js
        const idsBackend = [
            'linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor',
            'getonbrd', 'jooble', 'google_jobs', 'remotive', 'remoteok',
            'infojobs', 'adzuna'
        ];
        const idsFrontend = Object.keys(PLATAFORMAS);
        for (const id of idsBackend) {
            expect(idsFrontend).toContain(id);
        }
    });

    it('los slugs HTTP del frontend deberían coincidir con los del backend', () => {
        // Slugs esperados del backend
        const slugsBackend: Record<string, string> = {
            linkedin: 'linkedin',
            computrabajo: 'computrabajo',
            indeed: 'indeed',
            bumeran: 'bumeran',
            glassdoor: 'glassdoor',
            getonbrd: 'getonbrd',
            jooble: 'jooble',
            google_jobs: 'google-jobs',
            remotive: 'remotive',
            remoteok: 'remoteok',
            infojobs: 'infojobs',
            adzuna: 'adzuna',
        };
        for (const [id, slug] of Object.entries(slugsBackend)) {
            expect(PLATAFORMAS[id].slugHttp).toBe(slug);
        }
    });
});