import { Oferta, SituacionEvaluacion, UltimoIntentoEvaluacion } from '../modelos/oferta.model';

export function ultimoIntento(oferta: Oferta): UltimoIntentoEvaluacion | null {
    if (oferta.ultimo_intento_evaluacion !== undefined) return oferta.ultimo_intento_evaluacion;
    if (oferta.evaluacion_error_mensaje === 'REEVALUACION_SOLICITADA') return 'reevaluacion_solicitada';
    return oferta.evaluacion_error_mensaje ? 'fallo_tecnico' : null;
}

export function situacionEvaluacion(oferta: Oferta): SituacionEvaluacion {
    if (oferta.situacion_evaluacion) return oferta.situacion_evaluacion;
    // No deduzco un resultado nuevo del porcentaje ni del texto de una evaluación histórica.
    if (oferta.estado_evaluacion === 'pendiente') {
        return oferta.porcentaje_match != null || oferta.razon_evaluacion || oferta.explicacion_evaluacion
            ? 'legado' : 'sin_evaluar';
    }
    const intento = ultimoIntento(oferta);
    const resultadoPrevio = oferta.firma_criterios_evaluacion
        || (oferta.fecha_evaluacion && oferta.razon_evaluacion !== oferta.evaluacion_error_mensaje);
    return !intento || (intento === 'fallo_tecnico' && resultadoPrevio) ? oferta.estado_evaluacion : 'legado';
}

export function tieneResultadoLaboral(oferta: Oferta): boolean {
    const situacion = situacionEvaluacion(oferta);
    return situacion !== 'legado' && situacion !== 'sin_evaluar';
}

export function compatibilidadVisible(oferta: Oferta): boolean {
    const porcentaje = oferta.porcentaje_match;
    return typeof porcentaje === 'number' && Number.isFinite(porcentaje) && porcentaje >= 0 && porcentaje <= 100
        && tieneResultadoLaboral(oferta);
}

export function etiquetaEvaluacion(oferta: Oferta): string {
    switch (situacionEvaluacion(oferta)) {
        case 'por_confirmar': return compatibilidadVisible(oferta) && (oferta.porcentaje_match ?? 0) >= 60
            ? 'Buena afinidad · Por confirmar' : 'Por confirmar';
        case 'bajo_umbral': return 'Bajo el umbral';
        case 'aprobada': return 'Aprobada';
        case 'rechazada': return 'Rechazada';
        case 'legado': return 'Evaluación histórica';
        case 'sin_evaluar': return 'Sin evaluar';
    }
}

export function estadoEtiqueta(oferta: Oferta): string {
    if (!oferta.situacion_evaluacion && !tieneResultadoLaboral(oferta) && ultimoIntento(oferta) === 'fallo_tecnico') return 'error';
    const situacion = situacionEvaluacion(oferta);
    return situacion === 'sin_evaluar' ? 'pendiente' : situacion;
}
