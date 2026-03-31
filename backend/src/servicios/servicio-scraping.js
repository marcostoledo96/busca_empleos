// Servicio de scraping — orquesta la extracción de ofertas desde las plataformas.
//
// Este servicio es el "director de orquesta" del scraping:
// 1. Construye las URLs de búsqueda según la plataforma.
// 2. Llama al Actor de Apify correspondiente.
// 3. Espera a que termine y obtiene los resultados crudos.
// 4. Normaliza los resultados al formato de nuestra tabla.
// 5. Retorna las ofertas listas para guardar en la base de datos.
//
// ¿Por qué separar scraping de normalización?
// Porque si mañana cambiamos de Actor de Apify (ej: por uno más barato),
// solo modificamos este archivo. La normalización sigue igual.
// Y si LinkedIn cambia el formato de output, solo toco la normalización.
// Cada pieza tiene UNA responsabilidad. Es el principio "S" de SOLID:
// Single Responsibility.

const {
    clienteApify,
    ACTORES,
    construirUrlsLinkedin,
    construirUrlsComputrabajo,
} = require('../config/apify');

const { normalizarLote } = require('./servicio-normalizacion');

/**
 * Ejecuto el scraping de LinkedIn Jobs.
 *
 * El flujo es:
 * 1. Construyo URLs de búsqueda de LinkedIn con los filtros.
 * 2. Llamo al actor de Apify con esas URLs.
 * 3. Espero a que termine (puede tardar 1-2 minutos).
 * 4. Obtengo los datos crudos del dataset.
 * 5. Los normalizo al formato de nuestra tabla.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=100] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @param {string} [opciones.ubicacion] - Ubicación personalizada.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingLinkedin(opciones = {}) {
    const maxResultados = opciones.maxResultados || 100;

    try {
        console.log('Scraping LinkedIn: construyendo URLs de búsqueda...');
        const urls = construirUrlsLinkedin({
            terminos: opciones.terminos,
            ubicacion: opciones.ubicacion,
        });
        console.log(`Scraping LinkedIn: ${urls.length} URL(s) de búsqueda generadas.`);

        // Llamo al actor de LinkedIn.
        // .call() inicia el actor y ESPERA a que termine (puede tardar).
        // Le paso scrapeCompany: false porque no necesitamos los detalles
        // de la empresa, y así va mucho más rápido y más barato.
        console.log('Scraping LinkedIn: ejecutando actor de Apify...');
        const ejecucion = await clienteApify.actor(ACTORES.LINKEDIN).call({
            urls,
            count: maxResultados,
            scrapeCompany: false,
        });

        // El actor guarda sus resultados en un "dataset" (como una tabla temporal).
        // Obtengo los items de ese dataset.
        console.log('Scraping LinkedIn: obteniendo resultados del dataset...');
        const { items } = await clienteApify
            .dataset(ejecucion.defaultDatasetId)
            .listItems();

        console.log(`Scraping LinkedIn: ${items.length} ofertas crudas obtenidas.`);

        // Normalizo los datos crudos al formato de nuestra tabla.
        const ofertasNormalizadas = normalizarLote(items, 'linkedin');
        console.log(`Scraping LinkedIn: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        // Envuelvo el error con un mensaje descriptivo para facilitar el debugging.
        // El error original queda en .cause (para no perder información).
        throw new Error(
            `Error al ejecutar scraping de LinkedIn: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de Computrabajo Argentina.
 *
 * Similar a LinkedIn pero con el actor de Computrabajo.
 * Este actor es GRATIS, así que no hay costo por ejecución.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingComputrabajo(opciones = {}) {
    const maxResultados = opciones.maxResultados || 50;

    try {
        console.log('Scraping Computrabajo: construyendo URLs de búsqueda...');
        const urls = construirUrlsComputrabajo({
            terminos: opciones.terminos,
        });
        console.log(`Scraping Computrabajo: ${urls.length} URL(s) de búsqueda generadas.`);

        // El actor de Computrabajo espera el input en formato startUrls.
        // Cada URL es un objeto con la propiedad `url`.
        const startUrls = urls.map(url => ({ url }));

        console.log('Scraping Computrabajo: ejecutando actor de Apify...');
        const ejecucion = await clienteApify.actor(ACTORES.COMPUTRABAJO).call({
            startUrls,
            maxItems: maxResultados,
        });

        console.log('Scraping Computrabajo: obteniendo resultados del dataset...');
        const { items } = await clienteApify
            .dataset(ejecucion.defaultDatasetId)
            .listItems();

        console.log(`Scraping Computrabajo: ${items.length} ofertas crudas obtenidas.`);

        const ofertasNormalizadas = normalizarLote(items, 'computrabajo');
        console.log(`Scraping Computrabajo: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Computrabajo: ${error.message}`,
            { cause: error }
        );
    }
}

module.exports = {
    ejecutarScrapingLinkedin,
    ejecutarScrapingComputrabajo,
};
