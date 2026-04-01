// Interfaz que representa las preferencias del usuario tal como vienen de la API.
// Mapea 1:1 con las columnas de la tabla "preferencias" de PostgreSQL.
export interface Preferencias {
    id: number;
    nombre: string | null;
    nivel_experiencia: 'trainee' | 'junior' | 'semi-senior';
    perfil_profesional: string | null;
    stack_tecnologico: string[];
    modalidad_aceptada: 'cualquiera' | 'remoto' | 'hibrido' | 'presencial';
    zonas_preferidas: string[];
    terminos_busqueda: string[];
    reglas_exclusion: string[];
    prompt_personalizado: string | null;
    usar_prompt_personalizado: boolean;
    modelo_ia: 'deepseek-chat' | 'deepseek-reasoner';
    fecha_creacion: string;
    fecha_actualizacion: string;
}

// Campos actualizables. Excluyo id, fecha_creacion y fecha_actualizacion
// porque esos los maneja el backend.
export type PreferenciasActualizar = Partial<Omit<Preferencias, 'id' | 'fecha_creacion' | 'fecha_actualizacion'>>;
