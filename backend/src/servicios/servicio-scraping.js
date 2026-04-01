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
    TERMINOS_BUSQUEDA_DEFECTO,
    construirUrlsLinkedin,
    construirUrlsComputrabajo,
    construirUrlsBumeran,
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

/**
 * Ejecuto el scraping de Indeed Argentina.
 *
 * A diferencia de LinkedIn y Computrabajo (que reciben URLs de búsqueda),
 * el actor de Indeed recibe keywords directamente. Por eso iteramos sobre
 * los términos de búsqueda y hacemos una llamada al actor por cada uno.
 *
 * El flujo por cada término es:
 * 1. Llamo al actor con el término y "Argentina" como país.
 * 2. Espero a que termine.
 * 3. Obtengo los datos crudos del dataset.
 * 4. Acumulo los resultados de todos los términos.
 * 5. Normalizo todo junto al formato de nuestra tabla.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=15] - Máximo de ofertas POR TÉRMINO.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingIndeed(opciones = {}) {
    const maxResultadosPorTermino = opciones.maxResultados || 15;
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    try {
        console.log(`Scraping Indeed: buscando ${terminos.length} término(s)...`);
        let itemsCrudos = [];

        for (const termino of terminos) {
            console.log(`Scraping Indeed: buscando "${termino}"...`);

            // El actor de Indeed recibe keywords y país directamente.
            // No necesita URLs como LinkedIn o Computrabajo.
            const ejecucion = await clienteApify.actor(ACTORES.INDEED).call({
                title: termino,
                country: 'ar',
                limit: maxResultadosPorTermino,
            });

            const { items } = await clienteApify
                .dataset(ejecucion.defaultDatasetId)
                .listItems();

            console.log(`Scraping Indeed: ${items.length} resultados para "${termino}".`);
            itemsCrudos = itemsCrudos.concat(items);
        }

        console.log(`Scraping Indeed: ${itemsCrudos.length} ofertas crudas en total.`);

        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'indeed');
        console.log(`Scraping Indeed: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Indeed: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de Bumeran Argentina (que también cubre ZonaJobs).
 *
 * A diferencia de los otros scrapers que usan actores dedicados,
 * Bumeran usa el web-scraper (actor genérico de Apify con Puppeteer).
 * Le paso las URLs de búsqueda y una función JavaScript (pageFunction)
 * que se ejecuta dentro de un Chrome headless. Esto es necesario porque
 * Bumeran es una SPA React que requiere JavaScript para renderizar.
 *
 * Los selectores CSS se basan en atributos semánticos (aria-label,
 * IDs con patrón fijo, tags HTML) para ser resistentes a cambios
 * en las clases CSS de Bumeran (que son hashes de styled-components).
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingBumeran(opciones = {}) {
    try {
        console.log('Scraping Bumeran: construyendo URLs de búsqueda...');
        const urls = construirUrlsBumeran({
            terminos: opciones.terminos,
        });
        console.log(`Scraping Bumeran: ${urls.length} URL(s) de búsqueda generadas.`);

        const startUrls = urls.map(url => ({ url }));

        // La pageFunction se ejecuta dentro de un Chrome headless (Puppeteer)
        // en los servidores de Apify, DESPUÉS de que React renderice la página.
        // Usa jQuery (inyectado por web-scraper como context.jQuery) porque
        // los selectores CSS de Bumeran son hashes de styled-components
        // que cambian en cada deploy — usamos selectores semánticos.
        const pageFunction = `
            async function pageFunction(context) {
                const { jQuery: $, request, log } = context;
                const resultados = [];

                // Cada tarjeta de oferta es un <a> con href que apunta a /empleos/{slug}-{id}.html
                $('a[href*="/empleos/"]').each(function() {
                    var $tarjeta = $(this);
                    var href = $tarjeta.attr('href');

                    // Solo ofertas individuales (patrón: /empleos/{slug}-{digits}.html)
                    if (!href || !/\\/empleos\\/.+-\\d+\\.html$/.test(href)) return;

                    var url = href.startsWith('http') ? href : 'https://www.bumeran.com.ar' + href;
                    var titulo = $tarjeta.find('h2').first().text().trim() || null;
                    var descripcion = $tarjeta.find('p').first().text().trim() || null;

                    // Ubicación: busco el icono con aria-label="Ubicación" y tomo el h3 hermano.
                    var $iconoUbicacion = $tarjeta.find('i[aria-label="Ubicaci\\u00f3n"]');
                    var ubicacion = $iconoUbicacion.parent().find('h3').text().trim() || null;

                    // Modalidad: busco el icono con aria-label="Modalidad" y tomo el h3 hermano.
                    var $iconoModalidad = $tarjeta.find('i[aria-label="Modalidad"]');
                    var modalidad = $iconoModalidad.parent().find('h3').text().trim() || null;

                    // Empresa: en el div header-col-job-posting-*, busco h3 que NO sea la fecha.
                    var $header = $tarjeta.find('[id^="header-col-job-posting"]');
                    var empresa = null;
                    $header.find('h3').each(function() {
                        var text = $(this).text().trim();
                        if (text && !/(hace|Actualizado|Publicado|d\\u00edas|horas|minutos|Nuevo|ayer|hoy)/i.test(text)) {
                            empresa = text;
                            return false;
                        }
                    });

                    resultados.push({ url: url, titulo: titulo, empresa: empresa, ubicacion: ubicacion, modalidad: modalidad, descripcion: descripcion });
                });

                log.info('Bumeran: ' + resultados.length + ' ofertas extra\\u00eddas de ' + request.url);
                return resultados;
            }
        `;

        console.log('Scraping Bumeran: ejecutando web-scraper de Apify...');
        const ejecucion = await clienteApify.actor(ACTORES.BUMERAN_WEB).call({
            startUrls,
            pageFunction,
            maxRequestsPerCrawl: urls.length,
            proxyConfiguration: { useApifyProxy: true },
            // web-scraper espera a networkidle2 por defecto,
            // lo cual da tiempo a que React renderice las tarjetas.
        });

        console.log('Scraping Bumeran: obteniendo resultados del dataset...');
        const { items } = await clienteApify
            .dataset(ejecucion.defaultDatasetId)
            .listItems();

        // Logueo el tamaño del dataset crudo antes de aplanar para diagnosticar
        // si el problema está en la extracción (0 items) o en la normalización.
        console.log(`Scraping Bumeran: dataset con ${items.length} entradas crudas del actor.`);

        // La pageFunction retorna arrays de ofertas por cada página.
        // Aplano por si algún item es un array anidado.
        const itemsAplanados = items.flat();

        console.log(`Scraping Bumeran: ${itemsAplanados.length} ofertas crudas obtenidas.`);

        const ofertasNormalizadas = normalizarLote(itemsAplanados, 'bumeran');
        console.log(`Scraping Bumeran: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Bumeran: ${error.message}`,
            { cause: error }
        );
    }
}

module.exports = {
    ejecutarScrapingLinkedin,
    ejecutarScrapingComputrabajo,
    ejecutarScrapingIndeed,
    ejecutarScrapingBumeran,
};
