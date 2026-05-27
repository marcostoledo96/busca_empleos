// Logger simple con niveles para el backend de Busca Empleos.
//
// Uso esto en vez de console.log directo porque me permite:
// 1. Controlar el nivel de verbosidad desde una variable de entorno.
// 2. En producción solo loguear warn y error, sin ruido de debug.
// 3. Reducir costos de logging en plataformas como Railway (cuentan líneas).
//
// Niveles:
//   debug (0) → todo, incluso trazas de desarrollo.
//   info  (1) → eventos normales (default).
//   warn  (2) → situaciones que deberían revisarse.
//   error (3) → fallos que impiden algo o crashean el proceso.

const NIVELES = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const nivelActual = NIVELES[process.env.LOG_LEVEL?.toLowerCase()] ?? 1;

/**
 * Formatea un mensaje con timestamp ISO y nivel.
 * @param {string} nivel - Nivel del log.
 * @param {string} mensaje - Texto del mensaje.
 * @returns {string} Línea formateada para consola.
 */
function formatearMensaje(nivel, mensaje) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${nivel.toUpperCase()}] ${mensaje}`;
}

/**
 * Loguea un mensaje si el nivel actual lo permite.
 * @param {number} nivelRequerido - Nivel numérico requerido para loguear.
 * @param {string} mensaje - Texto del mensaje.
 * @param {Array} args - Argumentos extra (objetos, errores, etc.).
 */
function loguear(nivelRequerido, mensaje, ...args) {
    if (nivelActual > nivelRequerido) {
        return;
    }

    const nivelesConsola = {
        0: console.log,
        1: console.log,
        2: console.warn,
        3: console.error,
    };

    const funcionConsola = nivelesConsola[nivelRequerido] || console.log;
    const nivelTexto = Object.keys(NIVELES).find((key) => NIVELES[key] === nivelRequerido) || 'info';

    funcionConsola(formatearMensaje(nivelTexto, mensaje), ...args);
}

/**
 * Log de debug. Solo se muestra si LOG_LEVEL=debug.
 * @param {string} mensaje - Texto del mensaje.
 * @param {...any} args - Argumentos adicionales.
 */
function debug(mensaje, ...args) {
    loguear(NIVELES.debug, mensaje, ...args);
}

/**
 * Log informativo. Eventos normales del sistema.
 * @param {string} mensaje - Texto del mensaje.
 * @param {...any} args - Argumentos adicionales.
 */
function info(mensaje, ...args) {
    loguear(NIVELES.info, mensaje, ...args);
}

/**
 * Log de advertencia. Algo que no rompe pero que debería revisarse.
 * @param {string} mensaje - Texto del mensaje.
 * @param {...any} args - Argumentos adicionales.
 */
function warn(mensaje, ...args) {
    loguear(NIVELES.warn, mensaje, ...args);
}

/**
 * Log de error. Fallos que impactan la operación.
 * @param {string} mensaje - Texto del mensaje.
 * @param {...any} args - Argumentos adicionales.
 */
function error(mensaje, ...args) {
    loguear(NIVELES.error, mensaje, ...args);
}

module.exports = {
    debug,
    info,
    warn,
    error,
};
