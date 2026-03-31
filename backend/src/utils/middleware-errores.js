// Middleware de manejo de errores para Express.
//
// ¿Qué es un middleware de errores? Es una función especial de Express que
// tiene 4 parámetros: (error, req, res, next). Express reconoce que es para
// errores por la cantidad de parámetros (sí, literalmente cuenta los argumentos).
//
// Este middleware atrapa CUALQUIER error que no fue manejado por los
// controladores y devuelve una respuesta JSON consistente en vez de
// dejar que Express muestre un HTML feo con el stack trace.
//
// Express 5 (que estamos usando) tiene una ventaja enorme: si un controlador
// async tira un error o retorna una Promise rechazada, Express la atrapa
// automáticamente y la manda acá. En Express 4 había que usar try/catch
// o wrappers por todos lados. Express 5 nos ahorra ese quilombo.

/**
 * Middleware que atrapa rutas inexistentes y devuelve un 404 limpio.
 * Se monta DESPUÉS de todas las rutas pero ANTES del manejador de errores.
 */
function rutaNoEncontrada(req, res) {
    res.status(404).json({
        exito: false,
        error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    });
}

/**
 * Middleware central de errores. Atrapa cualquier error no manejado.
 * Debe tener exactamente 4 parámetros para que Express lo reconozca.
 *
 * @param {Error} error - El error que se produjo.
 * @param {Object} req - La request de Express.
 * @param {Object} res - La response de Express.
 * @param {Function} next - Función para pasar al siguiente middleware.
 */
function manejarErrores(error, req, res, next) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, error.message);

    // Si ya se empezó a enviar la respuesta (headers ya enviados),
    // no puedo cambiar el status code ni mandar otro JSON.
    // Delego al handler por defecto de Express que cierra la conexión.
    if (res.headersSent) {
        return next(error);
    }

    // Si el error tiene un statusCode personalizado (ej: 400, 404), lo uso.
    // Si no, es un error interno del servidor (500).
    const statusCode = error.statusCode || 500;

    // Para errores 500, no expongo el mensaje real al cliente
    // (podría tener info sensible como paths del server o queries SQL).
    // Para errores 4xx, el mensaje es seguro de mostrar.
    const mensaje = statusCode === 500
        ? 'Error interno del servidor.'
        : error.message;

    res.status(statusCode).json({
        exito: false,
        error: mensaje,
    });
}

module.exports = { rutaNoEncontrada, manejarErrores };
