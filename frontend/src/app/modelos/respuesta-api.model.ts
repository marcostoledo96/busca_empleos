// Wrapper genérico para todas las respuestas de nuestra API REST.
// El backend siempre responde con { exito, datos/error, ... }.
export interface RespuestaApi<T> {
    exito: boolean;
    datos: T;
    total?: number;
    error?: string;
}

export interface RespuestaPreferencias<T> extends RespuestaApi<T> {
    firma_criterios_evaluacion?: string;
    cambio_criterios?: boolean;
}

// Consumo el inicio asincrónico tal como lo devuelve el backend, sin wrapper datos.
export interface InicioEvaluacion {
    exito: boolean;
    mensaje: string;
    en_curso: boolean;
    cantidad?: number;
    periodo_dias?: number;
}

export interface RespuestaSincronizacionOfertas<T> extends RespuestaApi<T[]> {
    fecha_corte: string;
    max_id: number;
    total_inicial: number;
    cursor_siguiente: string | null;
    completada: boolean;
}

export interface EstadoOperativoSincronizacion {
    estado: 'en_progreso' | 'cancelada' | 'completada' | 'fallida';
    fecha_corte: string;
    max_id: number;
    total_inicial: number;
    recibidos: number;
    duplicados: number;
}

// Respuesta específica de los endpoints de scraping.
export interface RespuestaScraping {
    mensaje: string;
    plataforma: string;
    ofertas_nuevas: number;
    ofertas_duplicadas: number;
    total_extraidas: number;
    // Campos opcionales presentes solo cuando la plataforma está deshabilitada
    // por falta de credenciales (ej: InfoJobs sin INFOJOBS_CLIENT_ID/SECRET).
    // El frontend los usa para mostrar una advertencia informativa en lugar de
    // un toast de éxito engañoso con 0 extraídas.
    codigo_resultado?: string;
    advertencia?: string;
}

// Respuesta específica del endpoint de evaluación.
export interface RespuestaEvaluacion {
    mensaje: string;
    total_evaluadas: number;
    aprobadas: number;
    rechazadas: number;
    errores: number;
}

// Progreso en tiempo real de la evaluación IA (para polling).
export interface ProgresoEvaluacion {
    activo: boolean;
    total: number;
    evaluadas: number;
    aprobadas: number;
    rechazadas: number;
    errores: number;
    porcentaje: number;
}

// Estado del cron de automatización.
export interface EstadoAutomatizacion {
    activo: boolean;
    expresionCron: string | null;
    ultimaEjecucion: string | null;
    ultimoResultado: Record<string, unknown> | null;
}

// Respuesta al iniciar/detener el cron.
export interface RespuestaAutomatizacion {
    mensaje: string;
    datos?: EstadoAutomatizacion;
}

// Paso individual del progreso del ciclo completo.
export interface PasoProgreso {
    nombre: string;
    label: string;
    estado: 'pendiente' | 'procesando' | 'completada' | 'error';
    extraidas: number;
}

// Progreso del ciclo automático completo.
export interface ProgresoAutomatizacion {
    activo: boolean;
    pasos: PasoProgreso[];
    porcentaje: number;
}
