// Controlador de evaluación — maneja la request para evaluar ofertas con IA.
//
// Este controlador es el más simple: tiene un solo endpoint que dispara
// la evaluación de TODAS las ofertas pendientes. El servicio de evaluación
// hace todo el trabajo pesado (llamar a DeepSeek, parsear respuestas,
// actualizar la BD). El controlador solo lanza el proceso y devuelve el resumen.

const servicioEvaluacion = require('../servicios/servicio-evaluacion');

/**
 * POST /api/evaluacion/ejecutar
 * Evalúo todas las ofertas pendientes con DeepSeek.
 * Retorno un resumen con contadores (aprobadas, rechazadas, errores).
 */
async function ejecutarEvaluacion(req, res) {
    const resumen = await servicioEvaluacion.evaluarOfertasPendientes();

    res.json({
        exito: true,
        datos: {
            ...resumen,
            mensaje: `Evaluación completada: ${resumen.aprobadas} aprobadas, ${resumen.rechazadas} rechazadas.`,
        },
    });
}

module.exports = { ejecutarEvaluacion };
