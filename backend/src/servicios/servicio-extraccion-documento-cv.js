const { PDFParse } = require('pdf-parse');
const {
    MAX_BYTES_DOCUMENTO_CV, errorDocumento, validarFormatoDocumento,
    validarTextoDocumento, decodificarMarkdown,
} = require('../utils/validacion-documento-cv');

async function extraerTextoDocumento(archivo) {
    if (!archivo) throw errorDocumento('CARGA_INVALIDA');
    const formato = validarFormatoDocumento(archivo);
    const bytes = archivo.buffer;
    if (bytes.length > MAX_BYTES_DOCUMENTO_CV) throw errorDocumento('DOCUMENTO_DEMASIADO_GRANDE');
    if (bytes.length === 0) throw errorDocumento('SIN_TEXTO_EXTRAIBLE');
    if (formato === 'md') return { texto: decodificarMarkdown(bytes), formato };

    // Exijo encabezado y cierre: no acepto la recuperación tolerante de un PDF truncado.
    const contenido = bytes.toString('latin1');
    if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(contenido)
        || !/%%EOF(?:\s|%[^\r\n]*(?:\r?\n|$))*$/.test(contenido)) {
        throw errorDocumento('DOCUMENTO_INVALIDO');
    }
    let lector;
    try {
        // Desactivo avisos del parser para no registrar datos del documento privado.
        lector = new PDFParse({ data: bytes, verbosity: 0, stopAtErrors: true, isEvalSupported: false });
        const resultado = await lector.getText();
        if (!Number.isInteger(resultado.total) || resultado.total < 1
            || !Array.isArray(resultado.pages) || resultado.pages.length !== resultado.total
            || resultado.pages.some((pagina, indice) => pagina.num !== indice + 1 || typeof pagina.text !== 'string')) {
            throw errorDocumento('EXTRACCION_INCOMPLETA');
        }
        // Uno las páginas reales, no los separadores decorativos que también aparecen en PDFs vacíos.
        const texto = validarTextoDocumento(resultado.pages.map(pagina => pagina.text).join('\n\n'));
        return { texto, formato };
    } catch (error) {
        if (error.codigo) throw error;
        throw errorDocumento('DOCUMENTO_INVALIDO');
    } finally {
        if (lector) {
            try {
                await lector.destroy();
            } catch {
                throw errorDocumento('EXTRACCION_INCOMPLETA');
            }
        }
    }
}

module.exports = { extraerTextoDocumento };
