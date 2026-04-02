// Controlador de evaluación — maneja la request para evaluar ofertas con IA.
//
// Este controlador tiene cuatro endpoints:
// - POST /ejecutar: Inicia la evaluación en segundo plano (fire-and-forget)
//   y responde di inmediatamente. El cliente hace polling a /progreso.
// - GET /progreso: Devuelve el estado actual del progreso.
// - POST /cancelar: Interrumpe la evaluación en curso.
// - POST /resetear: Resetea a 'pendiente' las evaluaciones de los últimos N días.

const servicioEvaluacion = require('../servicios/servicio-evaluacion');
const modeloOferta = require('../modelos/oferta');

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

/**
 * POST /api/evaluacion/resetear
 * Reseteo a 'pendiente' las evaluaciones de la IA para ofertas evaluadas
 * en los últimos N días.
 *
 * Body: { dias: 7 }
 *
 * ¿Por qué resetear y no borrar? Porque al volver a 'pendiente',
 * la próxima vez que se ejecute la evaluación, la IA las revisa de nuevo
 * con el perfil actualizado. Es como darle una segunda oportunidad a las
 * ofertas que tal vez cambiaron o que el perfil ahora cubre mejor.
 */
async function resetearEvaluaciones(req, res) {
    const dias = parseInt(req.body.dias, 10);

    // Valido que dias sea un entero entre 1 y 365.
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
        return res.status(400).json({
            exito: false,
            error: 'El campo dias debe ser un número entero entre 1 y 365.',
        });
    }

    const ofertasReseteadas = await modeloOferta.resetearEvaluacionesPorDias(dias);

    res.json({
        exito: true,
        datos: {
            reseteadas: ofertasReseteadas.length,
            ofertas: ofertasReseteadas,
        },
        mensaje: `${ofertasReseteadas.length} oferta(s) reseteadas a 'pendiente'.`,
    });
}

module.exports = { ejecutarEvaluacion, obtenerProgresoEvaluacion, cancelarEvaluacion, resetearEvaluaciones };
