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
 * Ejecuto un ciclo completo manual (scraping + evaluación).
 * No necesita cron activo — se ejecuta una vez a pedido.
 */
async function ejecutarCiclo(req, res) {
    console.log('[API] Ejecución manual de ciclo completo solicitada.');
    const resultado = await servicioAutomatizacion.ejecutarCicloCompleto();

    res.json({
        exito: true,
        mensaje: 'Ciclo completo ejecutado.',
        datos: resultado,
    });
}

module.exports = {
    obtenerEstado,
    iniciarCron,
    detenerCron,
    ejecutarCiclo,
    obtenerProgreso,
};
