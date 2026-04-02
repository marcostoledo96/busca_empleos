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
    plataforma: 'linkedin' | 'computrabajo' | 'indeed' | 'bumeran' | 'glassdoor' | 'getonbrd' | 'jooble';
    nivel_requerido: string | null;
    salario_min: string | null;
    salario_max: string | null;
    moneda: string | null;
    estado_evaluacion: 'pendiente' | 'aprobada' | 'rechazada';
    razon_evaluacion: string | null;
    porcentaje_match: number | null;
    estado_postulacion: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada';
    fecha_publicacion: string | null;
    fecha_extraccion: string;
    datos_crudos: Record<string, unknown> | null;
}

// Estadísticas agregadas del total de ofertas.
export interface Estadisticas {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
}
