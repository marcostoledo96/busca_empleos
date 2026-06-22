// Registry de plataformas — fuente de verdad del frontend para ids, slugs, labels y estado.
//
// Este archivo es la copia controlada del registry del backend (`backend/src/config/plataformas.js`).
// Ambos deben mantenerse sincronizados. El test de contrato
// (`frontend/src/app/config/plataformas.spec.ts`) verifica la coherencia.
//
// Convención de ids:
// - El `id` es el identificador interno que se usa en filtros, DTOs y BD.
//   Usa snake_case (guiones bajos). Ejemplo: `google_jobs`, no `google-jobs`.
// - El `slugHttp` es lo que va en las URLs de la API (/api/scraping/:slug).
//   Usa kebab-case (guiones medios). Ejemplo: `google-jobs`.
// - Para la mayoría de las plataformas, `id` y `slugHttp` coinciden.
//   Google Jobs es la excepción porque su URL pública usa guión medio
//   pero internamente usamos guión bajo para no romper los datos históricos de la BD.
//
// Regla de UI:
// - Las plataformas con `activa: false` NO se ofrecen como fuente activa de scraping
//   ni aparecen en preferencias como opción seleccionable.
// - Los filtros de ofertas incluyen todas las plataformas (activas e inactivas)
//   para permitir filtrar datos históricos.

// Interfaz que define la estructura de una plataforma en el registry.
export interface PlataformaConfig {
    id: string;
    slugHttp: string;
    label: string;
    activa: boolean;
    motivo?: string;
}

// Tipo union con todos los ids internos válidos.
// Se usa para tipar filtros, preferencias y cualquier valor de plataforma.
export type PlataformaId =
    | 'linkedin'
    | 'computrabajo'
    | 'indeed'
    | 'bumeran'
    | 'glassdoor'
    | 'getonbrd'
    | 'jooble'
    | 'google_jobs'
    | 'remotive'
    | 'remoteok'
    | 'infojobs'
    | 'adzuna';

// Registry completo de plataformas. Fuente de verdad del frontend.
// Debe mantenerse sincronizado con `backend/src/config/plataformas.js`.
export const PLATAFORMAS: Record<string, PlataformaConfig> = {
    linkedin: {
        id: 'linkedin',
        slugHttp: 'linkedin',
        label: 'LinkedIn',
        activa: true,
    },
    computrabajo: {
        id: 'computrabajo',
        slugHttp: 'computrabajo',
        label: 'Computrabajo',
        activa: true,
    },
    indeed: {
        id: 'indeed',
        slugHttp: 'indeed',
        label: 'Indeed',
        activa: true,
    },
    bumeran: {
        id: 'bumeran',
        slugHttp: 'bumeran',
        label: 'Bumeran',
        activa: true,
    },
    glassdoor: {
        id: 'glassdoor',
        slugHttp: 'glassdoor',
        label: 'Glassdoor',
        activa: true,
    },
    getonbrd: {
        id: 'getonbrd',
        slugHttp: 'getonbrd',
        label: 'GetOnBrd',
        activa: true,
    },
    jooble: {
        id: 'jooble',
        slugHttp: 'jooble',
        label: 'Jooble',
        activa: true,
    },
    google_jobs: {
        id: 'google_jobs',
        slugHttp: 'google-jobs',
        label: 'Google Jobs',
        activa: false,
        motivo: 'Desactivado por costo y baja utilidad',
    },
    remotive: {
        id: 'remotive',
        slugHttp: 'remotive',
        label: 'Remotive',
        activa: true,
    },
    remoteok: {
        id: 'remoteok',
        slugHttp: 'remoteok',
        label: 'RemoteOK',
        activa: true,
    },
    infojobs: {
        id: 'infojobs',
        slugHttp: 'infojobs',
        label: 'InfoJobs',
        activa: false,
        motivo: 'Portal developers suspendido',
    },
    adzuna: {
        id: 'adzuna',
        slugHttp: 'adzuna',
        label: 'Adzuna',
        activa: true,
    },
};

// Plataformas activas: las que se pueden usar para scraping y aparecen en filtros
// como opciones seleccionables. Las inactivas NO se ofrecen como fuente activa.
export const PLATAFORMAS_ACTIVAS = Object.values(PLATAFORMAS).filter(p => p.activa);

// Conjunto de ids internos válidos (incluye inactivas para compatibilidad histórica).
export const IDS_PLATAFORMAS = new Set<string>(Object.keys(PLATAFORMAS));

// Mapa de slugHttp → id para normalización de parámetros HTTP.
// Por ejemplo, si el backend devuelve `google-jobs` en una URL, lo convertimos
// a `google_jobs` para buscar en el registry y en la BD.
export const SLUG_HTTP_A_ID: Record<string, string> = Object.values(PLATAFORMAS).reduce(
    (mapa, p) => {
        mapa[p.slugHttp] = p.id;
        return mapa;
    },
    {} as Record<string, string>
);

// Retorna las plataformas activas (las que se pueden scrapear y ofrecer en UI).
// Cada entrada tiene id, slugHttp y label.
export function obtenerPlataformasActivas(): Array<{ id: string; slugHttp: string; label: string }> {
    return PLATAFORMAS_ACTIVAS.map(p => ({
        id: p.id,
        slugHttp: p.slugHttp,
        label: p.label,
    }));
}

// Verifica si una plataforma está activa dado su id interno o su slug HTTP.
// Acepta tanto ids internos (`google_jobs`) como slugs HTTP (`google-jobs`).
// Normaliza el slug automáticamente usando el mapa de conversión.
// Si el id no existe en el registry, retorna false.
export function esPlataformaActiva(idOSlug: string): boolean {
    const id = SLUG_HTTP_A_ID[idOSlug] || idOSlug;
    const plataforma = PLATAFORMAS[id];
    return plataforma ? plataforma.activa : false;
}

// Normaliza un id o slug HTTP al id interno canónico.
// Ejemplos:
//   normalizarIdPlataforma('google-jobs') → 'google_jobs'
//   normalizarIdPlataforma('linkedin') → 'linkedin'
//   normalizarIdPlataforma('desconocida') → null
export function normalizarIdPlataforma(idOSlug: string): string | null {
    return SLUG_HTTP_A_ID[idOSlug] || (PLATAFORMAS[idOSlug] ? idOSlug : null);
}

// Opciones para dropdowns de filtro de ofertas (incluye "Todas" + todas las plataformas).
// Usa el id interno como valor, nunca el slug HTTP.
export function obtenerOpcionesFiltroPlataforma(): Array<{ label: string; value: string | null }> {
    return [
        { label: 'Todas', value: null },
        ...Object.values(PLATAFORMAS).map(p => ({
            label: p.label,
            value: p.id,
        })),
    ];
}

// Opciones para dropdowns de scraping (solo plataformas activas, sin "Todas").
// Usa el id interno como valor.
export function obtenerOpcionesScrapingPlataforma(): Array<{ value: string; label: string }> {
    return PLATAFORMAS_ACTIVAS.map(p => ({
        value: p.id,
        label: p.label,
    }));
}

// Opciones para preferencias de plataformas (solo plataformas activas para seleccionar/excluir).
// Usa el id interno como valor.
export function obtenerOpcionesPreferenciaPlataforma(): Array<{ label: string; value: string }> {
    return PLATAFORMAS_ACTIVAS.map(p => ({
        label: p.label,
        value: p.id,
    }));
}