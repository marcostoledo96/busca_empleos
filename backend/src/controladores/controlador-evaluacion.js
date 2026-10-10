// Controlador de evaluación — maneja la request para evaluar ofertas con IA.
//
// Este controlador tiene cuatro endpoints:
// - POST /ejecutar: Evalúo pendientes recientes o fuerzo los IDs seleccionados
//   en segundo plano. Respondo inmediatamente; el cliente consulta /progreso.
// - GET /progreso: Devuelve el estado actual del progreso.
// - POST /cancelar: Interrumpe la evaluación en curso.
// - POST /resetear: Resetea a 'pendiente' las evaluaciones de los últimos N días.

const servicioEvaluacion = require('../servicios/servicio-evaluacion');
const modeloOferta = require('../modelos/oferta');
const bloqueo = require('../utils/bloqueo-concurrente');

/**
 * POST /api/evaluacion/ejecutar
 * Inicio la evaluación en segundo plano y respondo de inmediato.
 * El cliente consulta /progreso hasta que activo === false.
 */
async function ejecutarEvaluacion(req, res) {
    // Intento adquirir un Advisory Lock para evitar evaluaciones simultáneas.
    const lock = await bloqueo.intentarAdquirirLock(bloqueo.CLAVES.EVALUACION_OFERTAS);
    if (!lock.ok) {
        return res.status(409).json({
            exito: false,
            mensaje: 'Ya hay una evaluación en curso.',
        });
    }

    // Verifico si ya hay una evaluación activa (doble chequeo).
    const progreso = servicioEvaluacion.obtenerProgresoEvaluacion();
    if (progreso.activo) {
        await bloqueo.liberarBloqueoSeguro(lock.client, bloqueo.CLAVES.EVALUACION_OFERTAS);
        return res.status(409).json({
            exito: false,
            mensaje: 'Ya hay una evaluación en curso.',
        });
    }

    let seleccionadas;
    try {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'ids')) {
            seleccionadas = await modeloOferta.obtenerOfertasSeleccionadas(req.body.ids);
        }
    } catch (error) {
        await bloqueo.liberarBloqueoSeguro(lock.client, bloqueo.CLAVES.EVALUACION_OFERTAS);
        if (error.status === 400) {
            return res.status(400).json({ exito: false, error: error.message });
        }
        throw error;
    }

    // Lanzamos sin await: el controlador responde inmediatamente
    // y la evaluación corre en segundo plano en el mismo proceso de Node.js.
    servicioEvaluacion.evaluarOfertasPendientes(seleccionadas)
        .catch((error) => {
            console.error('[Evaluación] Error en segundo plano:', error.message);
        })
        .finally(async () => {
            await bloqueo.liberarBloqueoSeguro(lock.client, bloqueo.CLAVES.EVALUACION_OFERTAS);
        });

    res.json({
        exito: true,
        mensaje: 'Evaluación iniciada.',
        en_curso: true,
        ...(seleccionadas ? { cantidad: seleccionadas.length, periodo_dias: 30 } : {}),
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
 * extraídas en los últimos N días (30 por defecto).
 *
 * Body opcional: { dias: 7 }
 *
 * ¿Por qué resetear y no borrar? Porque al volver a 'pendiente',
 * la próxima vez que se ejecute la evaluación, la IA las revisa de nuevo
 * con el perfil actualizado. Es como darle una segunda oportunidad a las
 * ofertas que tal vez cambiaron o que el perfil ahora cubre mejor.
 */
async function resetearEvaluaciones(req, res) {
    const dias = req.body?.dias === undefined ? 30 : Number(req.body.dias);

    // Conservo números y cadenas numéricas legacy, no booleanos ni conversiones parciales.
    if ((req.body?.dias !== undefined && !['number', 'string'].includes(typeof req.body.dias))
        || !Number.isInteger(dias) || dias < 1 || dias > 365) {
        return res.status(400).json({
            exito: false,
            error: 'El campo dias debe ser un número entero entre 1 y 365.',
        });
    }

    // Protejo el marcador de reset contra escrituras de un worker en curso.
    const lock = await bloqueo.intentarAdquirirLock(bloqueo.CLAVES.EVALUACION_OFERTAS);
    if (!lock.ok) {
        return res.status(409).json({ exito: false, mensaje: 'Ya hay una evaluación en curso.' });
    }
    try {
        if (servicioEvaluacion.obtenerProgresoEvaluacion().activo) {
            return res.status(409).json({ exito: false, mensaje: 'Ya hay una evaluación en curso.' });
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
    } finally {
        await bloqueo.liberarBloqueoSeguro(lock.client, bloqueo.CLAVES.EVALUACION_OFERTAS);
    }
}

module.exports = { ejecutarEvaluacion, obtenerProgresoEvaluacion, cancelarEvaluacion, resetearEvaluaciones };
