// Wrapper genérico para todas las respuestas de nuestra API REST.
// El backend siempre responde con { exito, datos/error, ... }.
export interface RespuestaApi<T> {
    exito: boolean;
    datos: T;
    total?: number;
    error?: string;
}

// Respuesta específica de los endpoints de scraping.
export interface RespuestaScraping {
    mensaje: string;
    plataforma: string;
    ofertas_nuevas: number;
    ofertas_duplicadas: number;
    total_extraidas: number;
}

// Respuesta específica del endpoint de evaluación.
export interface RespuestaEvaluacion {
    mensaje: string;
    total_evaluadas: number;
    aprobadas: number;
    rechazadas: number;
    errores: number;
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
