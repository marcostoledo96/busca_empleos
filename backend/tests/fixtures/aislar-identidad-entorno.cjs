// Evito leer .env en verificaciones sintéticas, incluso desde módulos ajenos a la BD.
// No cambio conexiones ni mocks de Jest: sólo desactivo la carga de archivos de entorno.
if (process.env.DB_TEST_SINTETICA !== 'true' || process.env.NODE_ENV !== 'test') {
    throw new Error('Este preload requiere el opt-in sintético de test.');
}
const fs = require('node:fs');
const leerOriginal = fs.readFileSync;
fs.readFileSync = function (ruta, opciones) {
    if (typeof ruta === 'string' && /(^|\/)\.env(?:\.[^/]+)?$/.test(ruta)) {
        return typeof opciones === 'string' || opciones?.encoding ? '' : Buffer.alloc(0);
    }
    return leerOriginal.apply(this, arguments);
};
