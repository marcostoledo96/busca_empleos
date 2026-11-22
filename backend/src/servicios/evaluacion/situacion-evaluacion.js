const { UMBRAL_MATCH_MINIMO } = require('./parser-respuesta-ia');

const REEVALUACION_SOLICITADA = 'REEVALUACION_SOLICITADA';

const tieneTexto = valor => typeof valor === 'string' && Boolean(valor.trim());

function obtenerUltimoIntentoEvaluacion(oferta) {
    const mensaje = tieneTexto(oferta.evaluacion_error_mensaje) ? oferta.evaluacion_error_mensaje.trim() : null;
    if (!mensaje) return null;
    return mensaje === REEVALUACION_SOLICITADA ? 'reevaluacion_solicitada' : 'fallo_tecnico';
}

/** Proyecto lo que quedó persistido sin volver a evaluar la oferta ni llenar evidencia ausente. */
function obtenerSituacionEvaluacion(oferta) {
    const { estado_evaluacion: estado, porcentaje_match: porcentaje, explicacion_evaluacion: explicacion,
        fecha_evaluacion: fecha, razon_evaluacion: razon, firma_criterios_evaluacion: firma } = oferta;
    const intento = obtenerUltimoIntentoEvaluacion(oferta);
    const pendiente = estado === 'pendiente' || !estado;
    if (pendiente && (intento === 'reevaluacion_solicitada' || (intento === 'fallo_tecnico' && razon === oferta.evaluacion_error_mensaje))) {
        return 'sin_evaluar';
    }
    const porcentajeValido = Number.isInteger(porcentaje) && porcentaje >= 0 && porcentaje <= 100;
    if (tieneTexto(firma) && fecha && tieneTexto(razon) && intento !== 'reevaluacion_solicitada' && razon !== oferta.evaluacion_error_mensaje) {
        if (estado === 'pendiente' && (porcentajeValido || porcentaje == null)
            && Array.isArray(explicacion?.por_confirmar) && explicacion.por_confirmar.some(item => tieneTexto(item?.requisito))) {
            return 'por_confirmar';
        }
        if (!Array.isArray(explicacion?.exclusiones) || explicacion.desglose_disponible === false) return 'legado';
        if (estado === 'aprobada' && porcentajeValido && porcentaje >= UMBRAL_MATCH_MINIMO) return 'aprobada';
        if (estado === 'rechazada' && porcentajeValido) {
            const exclusiones = explicacion.exclusiones.filter(item => item?.tipo === 'obligatorio');
            if (exclusiones.some(item => tieneTexto(item.evidencia_oferta) && tieneTexto(item.evidencia_perfil))) return 'rechazada';
            if (exclusiones.length) return 'legado';
            if (porcentaje < UMBRAL_MATCH_MINIMO) return 'bajo_umbral';
        }
    }
    return !pendiente || firma || porcentaje != null ? 'legado' : 'sin_evaluar';
}

module.exports = { REEVALUACION_SOLICITADA, obtenerSituacionEvaluacion, obtenerUltimoIntentoEvaluacion };
