const { TextDecoder } = require('node:util');
const MAX_BYTES_CV_BASE = 1048576;

function decodificarCvBase(bytes) {
    if (!Buffer.isBuffer(bytes)) {
        throw new Error('Necesito recibir el CV como bytes UTF-8.');
    }
    if (bytes.length > MAX_BYTES_CV_BASE) {
        throw Object.assign(new Error('El CV supera 1048576 bytes.'), { statusCode: 413 });
    }
    let texto;
    try {
        // Conservo incluso el BOM; no normalizo espacios ni saltos de línea.
        texto = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
        throw Object.assign(new Error('Necesito texto UTF-8 válido.'), { statusCode: 400 });
    }
    if (texto.includes('\0')) {
        throw Object.assign(new Error('El CV no puede contener caracteres NUL.'), { statusCode: 400 });
    }
    return texto;
}

module.exports = { MAX_BYTES_CV_BASE, decodificarCvBase };
