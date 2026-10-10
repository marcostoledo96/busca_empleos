// Conservo la resolución explícita de cada pregunta en el JSONB existente.
export interface PreguntaPerfil {
    id?: string;
    campo: string;
    pregunta: string;
    motivo?: string;
    sugerencia?: string | null;
    estado?: 'pendiente' | 'respondida' | 'aplicada' | 'ignorada' | 'nota';
    respuesta?: string;
    nota?: string;
}

// Interfaz que representa las preferencias del usuario tal como vienen de la API.
// Incluyo columnas persistidas y la vista de solo lectura calculada por el backend.
export interface Preferencias {
    perfil_efectivo?: PerfilEfectivo;
    id: number;
    nombre: string | null;
    nivel_experiencia: 'trainee' | 'junior' | 'semi-senior';
    perfil_profesional: string | null;
    idioma_candidato: string | null;
    stack_tecnologico: string[];
    modalidad_aceptada: 'cualquiera' | 'remoto' | 'hibrido' | 'presencial';
    zonas_preferidas: string[];
    terminos_busqueda: string[];
    reglas_exclusion: string[];
    prompt_personalizado: string | null;
    usar_prompt_personalizado: boolean;
    modelo_ia: 'deepseek-v4-flash' | 'deepseek-v4-pro';
    fecha_creacion: string;
    fecha_actualizacion: string;
    // Perfil detallado (P3) — tecnologías con niveles.
    tecnologias_detalle: Array<{
        nombre: string;
        nivel: 'ninguno' | 'basico' | 'medio' | 'avanzado';
        categoria: string;
        importancia?: 'principal' | 'secundaria' | 'penalizable' | 'no_prioritaria';
        aliases: string[];
        evidencia?: string;
    }>;
    roles_objetivo_detalle: Array<{
        rol: string;
        prioridad: 'alta' | 'media' | 'baja';
        aliases: string[];
        evidencia?: string;
    }>;
    // scoring_config fue deprecado en B1. La columna sigue existiendo en BD
    // para B2, pero el frontend ya no lo consume ni envía.
    preguntas_perfil_pendientes: PreguntaPerfil[];
    modelo_ia_evaluacion?: 'deepseek-v4-flash' | 'deepseek-v4-pro';
    modelo_ia_importacion?: 'deepseek-v4-flash' | 'deepseek-v4-pro';
    disponibilidad?: 'full_time' | 'part_time' | 'freelance' | 'a_coordinar';
    expectativa_salarial_min?: number | null;
    expectativa_salarial_max?: number | null;
    moneda_salarial?: 'ARS' | 'USD' | 'NO_FILTRAR';
    nivel_ingles_detalle?: {
        espanol?: string | null;
        reading?: string | null;
        writing?: string | null;
        speaking?: string | null;
        listening?: string | null;
        regla?: string | null;
    };
    keywords_positivas?: string[];
    keywords_negativas?: string[];
    plataformas_preferidas?: string[];
    plataformas_excluidas?: string[];
    max_caracteres_descripcion_ia?: number;
    temperatura_evaluacion?: number;
    temperatura_importacion?: number;
    backup_preferencias?: Record<string, unknown> | null;
    fecha_importacion_cv?: string | null;
    anios_experiencia_reales?: number | null;
    nivel_real_seniority?: string | null;
    conocimientos_ausentes?: string[];
    limitaciones_explicitas?: string | null;
    priorizar_ofertas_ia?: boolean;
    bonus_maximo_prioridad_ia?: number;
}

// Campos actualizables. Excluyo id, fecha_creacion y fecha_actualizacion
// porque esos los maneja el backend.
export type PreferenciasActualizar = Partial<Omit<Preferencias, 'id' | 'fecha_creacion' | 'fecha_actualizacion' | 'perfil_efectivo'>>;

// Consumo la representación autoritativa del backend sin construir otro perfil.
export interface PerfilEfectivo {
    version: 1;
    candidato: {
        nombre: string | null;
        nivel_real_seniority: string | null;
        anios_experiencia_reales: number | null;
        perfil_profesional: string | null;
        tecnologias_detalle: Array<{
            nombre: string;
            nivel: 'ninguno' | 'basico' | 'medio' | 'avanzado';
            categoria: string;
            importancia?: string;
            aliases?: string[];
            evidencia?: string;
        }>;
        stack_tecnologico: string[];
        nivel_ingles_detalle: NonNullable<Preferencias['nivel_ingles_detalle']> | null;
        idioma_candidato: string | null;
        conocimientos_ausentes: string[];
        limitaciones_explicitas: string | null;
    };
    restricciones: {
        preferencias: {
            roles_objetivo_detalle: Array<{ rol: string; prioridad: 'alta' | 'media' | 'baja'; aliases?: string[]; evidencia?: string }>;
            modalidad_aceptada: string | null;
            zonas_preferidas: string[] | null;
            reglas_exclusion: string[] | null;
            disponibilidad: string | null;
            expectativa_salarial_min: number | string | null;
            expectativa_salarial_max: number | string | null;
            moneda_salarial: string | null;
            keywords_positivas: string[] | null;
            keywords_negativas: string[] | null;
            plataformas_preferidas: string[] | null;
            plataformas_excluidas: string[] | null;
        };
        politicas_sistema: string[];
    };
    secciones: { id: string; titulo: string; texto: string }[];
    texto: string;
}
