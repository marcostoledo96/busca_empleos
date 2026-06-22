// Controlador de automatización — maneja las requests de la API para el cron.
//
// Endpoints:
// - GET /api/automatizacion/estado → estado actual del cron
// - POST /api/automatizacion/iniciar → programar el cron
// - POST /api/automatizacion/detener → detener el cron
// - POST /api/automatizacion/ejecutar → ejecutar un ciclo manualmente

const servicioAutomatizacion = require('../servicios/servicio-automatizacion');

/**
 * Obtengo el estado actual del cron (activo/inactivo, última ejecución, etc.)
 */
async function obtenerEstado(req, res) {
    const estado = servicioAutomatizacion.obtenerEstado();
    res.json({ exito: true, datos: estado });
}

/**
 * Retorno el progreso en tiempo real del ciclo completo que está corriendo.
 * Si no hay ciclo activo, retorna el último estado conocido.
 */
async function obtenerProgreso(req, res) {
    const progresoActual = servicioAutomatizacion.obtenerProgreso();
    res.json({ exito: true, datos: progresoActual });
}

/**
 * Programo el cron para que se ejecute periódicamente.
 * El body puede incluir una expresión cron personalizada.
 *
 * Body opcional: { "expresionCron": "0 8 * * *" }
 */
async function iniciarCron(req, res) {
    const { expresionCron } = req.body || {};

    try {
        servicioAutomatizacion.programarCron({ expresionCron });
        const estado = servicioAutomatizacion.obtenerEstado();
        res.json({
            exito: true,
            mensaje: `Cron programado: "${estado.expresionCron}"`,
            datos: estado,
        });
    } catch (error) {
        res.status(400).json({
            exito: false,
            error: error.message,
        });
    }
}

/**
 * Detengo el cron activo.
 */
async function detenerCron(req, res) {
    const estado = servicioAutomatizacion.obtenerEstado();

    if (!estado.activo) {
        return res.status(400).json({
            exito: false,
            error: 'No hay ningún cron activo para detener.',
        });
    }

    // Necesito reprogramar para obtener el controlador y poder detener.
    // Alternativa: expongo detener directamente en el servicio.
    // Voy a agregar una función detenerCron() al servicio.
    servicioAutomatizacion.detenerCron();

    res.json({
        exito: true,
        mensaje: 'Cron detenido exitosamente.',
        datos: servicioAutomatizacion.obtenerEstado(),
    });
}

/**
 * Inicio un ciclo completo manual (scraping + evaluación) sin esperar el resultado.
 *
 * Patrones de respuesta:
 * - 202 Accepted: el ciclo fue aceptado y se ejecuta en background.
 *   El frontend debe usar GET /api/automatizacion/progreso para seguir el progreso.
 * - 409 Conflict: ya hay un ciclo en curso. El frontend debe rehidratar
 *   el estado consultando /progreso.
 *
 * ¿Por qué fire-and-forget? Railway corta requests largas (~30s) con 502/504,
 * y el navegador lo reporta como error CORS. Responder de inmediato y dejar
 * el ciclo corriendo en background evita ese timeout.
 */
async function ejecutarCiclo(req, res) {
    console.log('[API] Ejecución manual de ciclo completo solicitada.');

    // Guard: si ya hay un ciclo corriendo, rechazo con 409.
    if (servicioAutomatizacion.cicloEnProgreso()) {
        return res.status(409).json({
            exito: false,
            error: 'Ya hay un ciclo de automatización en curso.',
        });
    }

    // Fire-and-forget: lanzo el ciclo sin await.
    // El frontend sigue el progreso vía polling a /progreso.
    servicioAutomatizacion.ejecutarCicloCompleto()
        .catch((error) => {
            // Logueo el error para que no quede como unhandled rejection.
            console.error(`[API] Error en ciclo en background: ${error.message}`);
        });

    // Respuesta inmediata: el ciclo empezó (o está por empezar).
    const progresoActual = servicioAutomatizacion.obtenerProgreso();
    res.status(202).json({
        exito: true,
        mensaje: 'Ciclo completo iniciado.',
        datos: {
            activo: progresoActual.activo,
            pasos: progresoActual.pasos,
            porcentaje: progresoActual.porcentaje,
        },
    });
}

module.exports = {
    obtenerEstado,
    iniciarCron,
    detenerCron,
    ejecutarCiclo,
    obtenerProgreso,
};
