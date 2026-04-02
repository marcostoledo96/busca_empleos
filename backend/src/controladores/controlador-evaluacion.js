// Controlador de evaluación — maneja la request para evaluar ofertas con IA.
//
// Este controlador tiene tres endpoints:
// - POST /ejecutar: Inicia la evaluación en segundo plano (fire-and-forget)
//   y responde di inmediatamente. El cliente hace polling a /progreso.
// - GET /progreso: Devuelve el estado actual del progreso.
// - POST /cancelar: Interrumpe la evaluación en curso.

const servicioEvaluacion = require('../servicios/servicio-evaluacion');

/**
 * POST /api/evaluacion/ejecutar
 * Inicio la evaluación en segundo plano y respondo de inmediato.
 * El cliente consulta /progreso hasta que activo === false.
 */
function ejecutarEvaluacion(req, res) {
    const progreso = servicioEvaluacion.obtenerProgresoEvaluacion();
    if (progreso.activo) {
        return res.status(409).json({
            exito: false,
            mensaje: 'Ya hay una evaluación en curso.',
        });
    }

    // Lanzamos sin await: el controlador responde inmediatamente
    // y la evaluación corre en segundo plano en el mismo proceso de Node.js.
    servicioEvaluacion.evaluarOfertasPendientes().catch((error) => {
        console.error('[Evaluación] Error en segundo plano:', error.message);
    });

    res.json({
        exito: true,
        mensaje: 'Evaluación iniciada.',
        en_curso: true,
    });
}

/**
 * GET /api/evaluacion/progreso
 * Devuelvo el estado actual del progreso (para polling del frontend).
 */
function obtenerProgresoEvaluacion(req, res) {
    const progreso = servicioEvaluacion.obtenerProgresoEvaluacion();
    res.json({
        exito: true,
        datos: progreso,
    });
}

/**
 * POST /api/evaluacion/cancelar
 * Activo la bandera de cancelación para interrumpir el loop.
 */
function cancelarEvaluacion(req, res) {
    servicioEvaluacion.cancelarEvaluacionPendiente();
    res.json({
        exito: true,
        mensaje: 'Se solicitó la cancelación de la evaluación.',
    });
}

module.exports = { ejecutarEvaluacion, obtenerProgresoEvaluacion, cancelarEvaluacion };
