const path = require('node:path');
const { MAX_BYTES_CV_BASE, decodificarCvBase } = require('./validacion-cv-base');
const MAX_BYTES_DOCUMENTO_CV = 5 * 1024 * 1024;
const ERRORES_DOCUMENTO = {
    FORMATO_NO_ADMITIDO: [400, 'Admito únicamente PDF con texto seleccionable o Markdown (.md). Podés pegar el texto manualmente.'],
    CARGA_INVALIDA: [400, 'Enviá un único documento en el campo cv. Podés pegar el texto manualmente.'],
    DOCUMENTO_DEMASIADO_GRANDE: [413, 'El documento no puede superar 5 MiB. Podés pegar el texto manualmente.'],
    DOCUMENTO_INVALIDO: [422, 'El documento está dañado o no coincide con el formato declarado. Podés pegar el texto manualmente.'],
    SIN_TEXTO_EXTRAIBLE: [422, 'No pude recuperar texto del documento. Podés pegarlo manualmente; no realizo OCR.'],
    TEXTO_INVALIDO: [422, 'Necesito texto UTF-8 válido sin caracteres de control inválidos. Podés pegar el texto manualmente.'],
    TEXTO_DEMASIADO_GRANDE: [413, 'El texto completo supera 1048576 bytes. No lo recorté. Reducí el documento o pegá texto manualmente.'],
    EXTRACCION_INCOMPLETA: [422, 'No pude extraer todas las páginas de forma completa. Podés pegar el texto manualmente.'],
};
function errorDocumento(codigo) {
    const [statusCode, mensaje] = ERRORES_DOCUMENTO[codigo];
    return Object.assign(new Error(mensaje), { codigo, statusCode });
}
function responderErrorDocumento(res, codigo) {
    const error = errorDocumento(codigo);
    return res.status(error.statusCode).json({ exito: false, codigo, error: error.message });
}
function validarFormatoDocumento(archivo) {
    const extension = path.extname(archivo.originalname.normalize('NFC')).toLowerCase();
    const mime = archivo.mimetype.toLowerCase().trim();
    const tipos = extension === '.pdf' ? ['application/pdf', 'application/octet-stream']
        : extension === '.md' ? ['text/markdown', 'text/plain', 'application/octet-stream'] : [];
    if (!tipos.includes(mime)) throw errorDocumento('FORMATO_NO_ADMITIDO');
    return extension.slice(1);
}
function validarTextoDocumento(texto) {
    if (typeof texto !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd\ud800-\udfff]/u.test(texto)) {
        throw errorDocumento('TEXTO_INVALIDO');
    }
    if (Buffer.byteLength(texto, 'utf8') > MAX_BYTES_CV_BASE) throw errorDocumento('TEXTO_DEMASIADO_GRANDE');
    if (!texto.trim()) throw errorDocumento('SIN_TEXTO_EXTRAIBLE');
    return texto;
}
function decodificarMarkdown(bytes) {
    if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') throw errorDocumento('DOCUMENTO_INVALIDO');
    let texto;
    try {
        texto = decodificarCvBase(bytes);
    } catch (error) {
        throw errorDocumento(error.statusCode === 413 ? 'TEXTO_DEMASIADO_GRANDE' : 'TEXTO_INVALIDO');
    }
    return validarTextoDocumento(texto);
}
module.exports = {
    MAX_BYTES_DOCUMENTO_CV, errorDocumento, responderErrorDocumento,
    validarFormatoDocumento, validarTextoDocumento, decodificarMarkdown,
};
