// Comparto la política de idioma existente antes de persistir, sin cambiar matching ni deduplicación.
const { detectarIdioma } = require('./servicio-normalizacion');

function filtrarOfertasPorIdioma(ofertas) {
    return ofertas.filter(oferta => detectarIdioma(oferta.titulo, oferta.descripcion) !== 'en');
}

/**
 * Persisto un lote de ofertas aislando fallos por oferta individual con try/catch.
 * Si una oferta falla (ej: error de restricción, tipo de dato inválido o fallo puntual de BD),
 * no se interrumpe el procesamiento ni se descarta el resto del lote.
 *
 * @param {Array<Object>} ofertas - Lista de ofertas normalizadas a persistir.
 * @param {Object} modelo - Modelo de persistencia (por defecto el modelo de ofertas).
 * @returns {Promise<{guardadas: number, actualizadas: number, reapariciones: number, duplicadas: number, errores: number, detallesErrores: Array<Object>}>}
 */
async function guardarLoteOfertasAislado(ofertas, modelo) {
    let guardadas = 0;
    let actualizadas = 0;
    let reapariciones = 0;
    let duplicadas = 0;
    let errores = 0;
    const detallesErrores = [];

    for (const oferta of ofertas) {
        try {
            const resultado = await modelo.crearOferta(oferta);
            if (!resultado) {
                // Fallback de compatibilidad: si resultado === null (mock legacy)
                duplicadas++;
            } else if (resultado.es_nueva || resultado.esNueva || resultado.resultado_persistencia === 'insertada') {
                guardadas++;
            } else if (resultado.fue_actualizada || resultado.esActualizada || resultado.resultado_persistencia === 'actualizada') {
                actualizadas++;
                duplicadas++;
            } else if (resultado.es_reaparicion || resultado.esReaparicion || resultado.resultado_persistencia === 'reaparicion') {
                reapariciones++;
                duplicadas++;
            } else if (resultado.es_nueva === undefined && resultado.esNueva === undefined && resultado.resultado_persistencia === undefined) {
                // Fallback de compatibilidad: si resultado && resultado.es_nueva === undefined (ej: mock legacy { id: 1 })
                guardadas++;
            } else {
                duplicadas++;
            }
        } catch (error) {
            errores++;
            detallesErrores.push({
                titulo: oferta?.titulo || null,
                url: oferta?.url || null,
                error: error.message,
            });
            console.warn(`[Ingreso Ofertas] Error aislado al guardar oferta "${oferta?.titulo || oferta?.url}": ${error.message}`);
        }
    }

    return { guardadas, actualizadas, reapariciones, duplicadas, errores, detallesErrores };
}

module.exports = {
    filtrarOfertasPorIdioma,
    guardarLoteOfertasAislado,
};
