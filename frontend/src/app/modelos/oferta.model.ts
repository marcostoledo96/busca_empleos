// Tipo union con todos los ids internos válidos de plataforma.
// Se usa en filtros, preferencias y cualquier lugar donde se necesite un
// valor de plataforma tipado. Incluye inactivas (google_jobs, infojobs)
// para compatibilidad con datos históricos.
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

// Detalle de un requisito evaluado en la explicación de matching.
export interface ItemRequisitoExplicacion {
    requisito: string;
    tipo: 'obligatorio' | 'deseable' | 'desconocido';
    evidencia_oferta?: string | null;
    evidencia_perfil?: string | null;
    explicacion?: string | null;
}

// Estructura detallada y explicable del matching de una oferta.
export interface ExplicacionEvaluacion {
    cumplidos: ItemRequisitoExplicacion[];
    no_cumplidos: ItemRequisitoExplicacion[];
    por_confirmar: ItemRequisitoExplicacion[];
    exclusiones: ItemRequisitoExplicacion[];
    desglose_disponible?: boolean;
    inconsistente?: boolean;
    invalido?: boolean;
}

// Interfaz que representa una oferta de empleo tal como viene de la API.
// Mapea 1:1 con las columnas de la tabla "ofertas" de PostgreSQL.
export interface Oferta {
    id: number;
    titulo: string;
    empresa: string | null;
    ubicacion: string | null;
    modalidad: string | null;
    descripcion: string | null;
    url: string;
    plataforma: PlataformaId;
    nivel_requerido: string | null;
    salario_min: string | null;
    salario_max: string | null;
    moneda: string | null;
    estado_evaluacion: 'pendiente' | 'aprobada' | 'rechazada';
    razon_evaluacion: string | null;
    porcentaje_match: number | null;
    estado_postulacion: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada';
    fecha_publicacion: string | null;
    fecha_publicacion_aproximada?: boolean;
    fecha_extraccion: string;
    fecha_ultima_extraccion?: string | null;
    identidad_canonica?: string | null;
    datos_crudos: Record<string, unknown> | null;
    firma_criterios_evaluacion?: string | null;
    vigencia_evaluacion?: 'actual' | 'anterior' | 'desconocida';
    prioridad_ia?: boolean;
    puntaje_prioridad_ia?: number;
    evidencias_prioridad_ia?: string[];
    explicacion_evaluacion?: ExplicacionEvaluacion | null;
    origen_descripcion?: 'tarjeta' | 'scraper' | 'manual' | string | null;
    descripcion_completitud?: 'completa' | 'parcial' | 'desconocida' | 'ausente' | string | null;
    descripcion_original?: string | null;
    descripcion_modificada_en?: string | null;
    evaluacion_error_mensaje?: string | null;
}

// Estadísticas agregadas del total de ofertas.
export interface Estadisticas {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
}
