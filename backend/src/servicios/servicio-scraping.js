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
    GETONBRD_API_BASE,
    JOOBLE_API_URL,
    JOOBLE_API_KEY,
    construirUrlsLinkedin,
    construirUrlsComputrabajo,
    construirUrlsBumeran,
    construirUrlsGetonbrd,
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

/**
 * Ejecuto el scraping de Glassdoor Argentina.
 *
 * A diferencia de LinkedIn y Computrabajo (que reciben URLs de búsqueda),
 * este actor recibe keywords, location y country como parámetros directos,
 * al igual que Indeed. Por eso no necesito construir URLs de búsqueda.
 *
 * El actor soporta deduplicación nativa con saveOnlyUniqueItems, lo que
 * reduce el ruido antes de llegar a la normalización.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingGlassdoor(opciones = {}) {
    const maxResultados = opciones.maxResultados || 50;
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    try {
        console.log(`Scraping Glassdoor: buscando ${terminos.length} término(s) en Argentina...`);

        // El actor recibe keywords como array de strings, location y country directamente.
        // No necesita URLs — similar al actor de Indeed.
        const ejecucion = await clienteApify.actor(ACTORES.GLASSDOOR).call({
            keywords: terminos,
            location: 'Buenos Aires',
            country: 'Argentina',
            maxItems: maxResultados,
            saveOnlyUniqueItems: true,
            includeNoSalaryJob: true,
            datePosted: '14',
        });

        console.log('Scraping Glassdoor: obteniendo resultados del dataset...');
        const { items } = await clienteApify
            .dataset(ejecucion.defaultDatasetId)
            .listItems();

        console.log(`Scraping Glassdoor: ${items.length} ofertas crudas obtenidas.`);

        const ofertasNormalizadas = normalizarLote(items, 'glassdoor');
        console.log(`Scraping Glassdoor: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Glassdoor: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de GetOnBrd usando su API REST pública (gratuita, sin auth).
 *
 * A diferencia del resto de las plataformas, GetOnBrd NO usa Apify.
 * Su API pública devuelve JSON directamente:
 * GET https://www.getonbrd.com/api/v0/search/jobs?query={termino}&page={n}
 *
 * La paginación trae hasta 120 ítems por página. El campo `meta.total_pages`
 * indica cuántas páginas existen para ese término.
 *
 * El flujo por cada término:
 * 1. Pido la página 1 para obtener el total de páginas.
 * 2. Si hay más páginas, las pido secuencialmente hasta llegar a maxResultados.
 * 3. Acumulo todos los ítems de todos los términos.
 * 4. Normalizo al formato de nuestra tabla.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo total de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingGetonbrd(opciones = {}) {
    const maxResultados = opciones.maxResultados || 50;
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    try {
        console.log(`Scraping GetOnBrd: buscando ${terminos.length} término(s) con la API pública...`);
        let itemsCrudos = [];

        for (const termino of terminos) {
            if (itemsCrudos.length >= maxResultados) break;

            console.log(`Scraping GetOnBrd: buscando "${termino}"...`);

            // Pido la primera página para saber cuántas páginas hay en total.
            const urlPrimeraPagina = `${GETONBRD_API_BASE}/search/jobs?query=${encodeURIComponent(termino)}&page=1`;
            const respuestaPrimeraPagina = await fetch(urlPrimeraPagina);

            if (!respuestaPrimeraPagina.ok) {
                console.warn(`Scraping GetOnBrd: error HTTP ${respuestaPrimeraPagina.status} para "${termino}". Saltando.`);
                continue;
            }

            const jsonPrimeraPagina = await respuestaPrimeraPagina.json();
            const totalPaginas = jsonPrimeraPagina.meta?.total_pages || 1;

            // Acumulo los ítems de la primera página.
            const itemsPrimeraPagina = jsonPrimeraPagina.data || [];
            itemsCrudos = itemsCrudos.concat(itemsPrimeraPagina);
            console.log(`Scraping GetOnBrd: página 1/${totalPaginas} → ${itemsPrimeraPagina.length} ítem(s) para "${termino}".`);

            // Si hay más páginas y no llegué al máximo, las pido.
            for (let pagina = 2; pagina <= totalPaginas; pagina++) {
                if (itemsCrudos.length >= maxResultados) break;

                const urlPagina = `${GETONBRD_API_BASE}/search/jobs?query=${encodeURIComponent(termino)}&page=${pagina}`;
                const respuestaPagina = await fetch(urlPagina);

                if (!respuestaPagina.ok) {
                    console.warn(`Scraping GetOnBrd: error HTTP ${respuestaPagina.status} en página ${pagina} para "${termino}". Deteniendo paginación.`);
                    break;
                }

                const jsonPagina = await respuestaPagina.json();
                const itemsPagina = jsonPagina.data || [];
                itemsCrudos = itemsCrudos.concat(itemsPagina);
                console.log(`Scraping GetOnBrd: página ${pagina}/${totalPaginas} → ${itemsPagina.length} ítem(s) para "${termino}".`);
            }
        }

        console.log(`Scraping GetOnBrd: ${itemsCrudos.length} ofertas crudas en total.`);

        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'getonbrd');
        console.log(`Scraping GetOnBrd: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de GetOnBrd: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de Jooble usando su API REST oficial (gratuita, requiere API key).
 *
 * Jooble es un agregador mundial de ofertas de empleo. La API acepta un único
 * país por llamada, por lo que itero sobre Argentina y España para cubrir tanto
 * el mercado local como empresas españolas que contratan remoto desde Latam.
 *
 * La API es POST en vez de GET (a diferencia de GetOnBrd):
 * POST https://jooble.org/api/{API_KEY}
 * Body: { "keywords": "término", "location": "Argentina", "page": N }
 *
 * Respuesta: { totalCount: N, jobs: [{ title, location, snippet, salary,
 *              source, type, link, company, updated }] }
 *
 * La paginación no tiene un campo "total_pages" — se calcula dividiendo
 * `totalCount` / 20 (20 resultados por página, límite de la API gratuita).
 * Limitamos a 2 páginas por combinación término+país para no inflar las llamadas.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo total de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingJooble(opciones = {}) {
    const maxResultados = opciones.maxResultados || 50;
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;
    // La API solo acepta un país por llamada — itero sobre Argentina y España.
    // Chile, México y Colombia ya están cubiertos por GetOnBrd (portal Latam nativo).
    const PAISES_JOOBLE = ['Argentina', 'España'];
    // Dos páginas por combinación término+país: suficiente cobertura sin inflar llamadas.
    // (7 términos × 2 países × 2 páginas = 28 llamadas máximo)
    const MAX_PAGINAS_POR_TERMINO = 2;

    try {
        console.log(`Scraping Jooble: buscando ${terminos.length} término(s) en ${PAISES_JOOBLE.join(', ')}...`);
        let itemsCrudos = [];

        for (const termino of terminos) {
            if (itemsCrudos.length >= maxResultados) break;

            for (const pais of PAISES_JOOBLE) {
                if (itemsCrudos.length >= maxResultados) break;

                console.log(`Scraping Jooble: buscando "${termino}" en ${pais}...`);

                // Pido la primera página para obtener totalCount y los primeros resultados.
                const urlApi = `${JOOBLE_API_URL}${JOOBLE_API_KEY}`;
                const respuestaPrimeraPagina = await fetch(urlApi, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        keywords: termino,
                        location: pais,
                        page: 1,
                    }),
                });

                if (!respuestaPrimeraPagina.ok) {
                    console.warn(`Scraping Jooble: error HTTP ${respuestaPrimeraPagina.status} para "${termino}" en ${pais}. Saltando.`);
                    continue;
                }

                const jsonPrimeraPagina = await respuestaPrimeraPagina.json();
                const totalCount = jsonPrimeraPagina.totalCount || 0;
                // La API gratuita devuelve 20 resultados por página.
                const totalPaginas = Math.min(
                    Math.ceil(totalCount / 20),
                    MAX_PAGINAS_POR_TERMINO
                );

                // Acumulo los ítems de la primera página.
                const jobsPrimeraPagina = jsonPrimeraPagina.jobs || [];
                itemsCrudos = itemsCrudos.concat(jobsPrimeraPagina);
                console.log(`Scraping Jooble: página 1/${totalPaginas} → ${jobsPrimeraPagina.length} ítem(s) para "${termino}" (${pais}).`);

                // Si hay más páginas y no llegué al máximo, las pido.
                for (let pagina = 2; pagina <= totalPaginas; pagina++) {
                    if (itemsCrudos.length >= maxResultados) break;

                    const respuestaPagina = await fetch(urlApi, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            keywords: termino,
                            location: pais,
                            page: pagina,
                        }),
                    });

                    if (!respuestaPagina.ok) {
                        console.warn(`Scraping Jooble: error HTTP ${respuestaPagina.status} en página ${pagina} para "${termino}" en ${pais}. Deteniendo paginación.`);
                        break;
                    }

                    const jsonPagina = await respuestaPagina.json();
                    const jobsPagina = jsonPagina.jobs || [];
                    itemsCrudos = itemsCrudos.concat(jobsPagina);
                    console.log(`Scraping Jooble: página ${pagina}/${totalPaginas} → ${jobsPagina.length} ítem(s) para "${termino}" (${pais}).`);
                }
            }
        }

        console.log(`Scraping Jooble: ${itemsCrudos.length} ofertas crudas en total.`);

        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'jooble');
        console.log(`Scraping Jooble: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Jooble: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de Google Jobs usando el actor de Apify.
 *
 * Google Jobs es el agregador de empleo de Google: cuando buscás "empleos" en
 * Google, te muestra ofertas de LinkedIn, Indeed, Glassdoor, Computrabajo,
 * ZonaJobs, Bumeran y muchos otros portales. Esto nos permite capturar ofertas
 * de portales que no tenemos integrados individualmente.
 *
 * El actor recibe query + country + filtros directamente (como Indeed y Glassdoor).
 * Iteramos por cada término de búsqueda y acumulamos resultados.
 *
 * IMPORTANTE: Google Jobs agrega ofertas de portales que YA scrapeamos
 * (LinkedIn, Indeed, etc.). La deduplicación por URL en la BD se encarga
 * de evitar duplicados exactos, pero además el normalizador registra el
 * `jobPublisher` (portal original) en los datos para trazabilidad.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingGoogleJobs(opciones = {}) {
    const maxResultados = opciones.maxResultados || 50;
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    try {
        console.log(`Scraping Google Jobs: buscando ${terminos.length} término(s) en Argentina...`);
        let itemsCrudos = [];

        for (const termino of terminos) {
            if (itemsCrudos.length >= maxResultados) break;

            console.log(`Scraping Google Jobs: buscando "${termino}" en Argentina...`);

            const ejecucion = await clienteApify.actor(ACTORES.GOOGLE_JOBS).call({
                query: termino,
                location: 'Argentina',
                country: 'None',
                language: 'es',
                num_results: maxResultados,
            });

            const { items } = await clienteApify
                .dataset(ejecucion.defaultDatasetId)
                .listItems();

            // johnvc/google-jobs-scraper devuelve un objeto por run con `jobs: [...]`.
            // Extraigo los trabajos del array interno; si viniera en otro formato
            // (items individuales), lo manejo también.
            for (const item of items) {
                if (item.jobs && Array.isArray(item.jobs)) {
                    itemsCrudos = itemsCrudos.concat(item.jobs);
                } else if (item.title) {
                    itemsCrudos.push(item);
                }
            }

            console.log(`Scraping Google Jobs: ${itemsCrudos.length} resultados acumulados para "${termino}".`);
        }

        // Recorto si pasamos del máximo acumulando entre términos.
        if (itemsCrudos.length > maxResultados) {
            itemsCrudos = itemsCrudos.slice(0, maxResultados);
        }

        console.log(`Scraping Google Jobs: ${itemsCrudos.length} ofertas crudas en total.`);

        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'google_jobs');
        console.log(`Scraping Google Jobs: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        return ofertasNormalizadas;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Google Jobs: ${error.message}`,
            { cause: error }
        );
    }
}

module.exports = {
    ejecutarScrapingLinkedin,
    ejecutarScrapingComputrabajo,
    ejecutarScrapingIndeed,
    ejecutarScrapingBumeran,
    ejecutarScrapingGlassdoor,
    ejecutarScrapingGetonbrd,
    ejecutarScrapingJooble,
    ejecutarScrapingGoogleJobs,
};
