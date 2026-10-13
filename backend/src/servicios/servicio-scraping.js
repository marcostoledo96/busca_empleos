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
    REMOTIVE_API_BASE,
    REMOTEOK_API_BASE,
    JOOBLE_API_URL,
    JOOBLE_API_KEY,
    construirUrlsLinkedin,
    construirUrlsComputrabajo,
    construirUrlsBumeran,
} = require('../config/apify');

const { resolverConfiguracion, palabrasBusqueda } = require('./servicio-configuracion-busqueda');
const { normalizarLote, detectarIdioma, parsearFechaRelativaComputrabajo } = require('./servicio-normalizacion');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const { DESTINO_SANDBOX, LIMITES_GETONBRD, validarDestinoGetonbrd } = require('../config/getonbrd');

/**
 * Evalúo si una oferta normalizada es elegible para computar dentro de la cuota útil.
 * Una oferta ocupa cupo si:
 * 1. Tiene URL canónica válida.
 * 2. Su idioma es admitido por el perfil (no inglés).
 * 3. Si tiene fecha de publicación conocida, se encuentra dentro de la ventana de días admitida.
 *
 * @param {Object} oferta - Oferta normalizada.
 * @param {number} limiteVentanaMs - Timestamp mínimo admisible.
 * @returns {{ elegible: boolean, motivoDescarte?: 'idioma' | 'antigua' | 'invalida' }}
 */
function evaluarElegibilidadOferta(oferta, limiteVentanaMs) {
    if (!oferta || !oferta.url) {
        return { elegible: false, motivoDescarte: 'invalida' };
    }
    // Idioma: perfil excluye ofertas en inglés
    if (detectarIdioma(oferta.titulo, oferta.descripcion) === 'en') {
        return { elegible: false, motivoDescarte: 'idioma' };
    }
    // Fecha de publicación: si es conocida, debe estar dentro de la ventana
    if (oferta.fecha_publicacion) {
        const d = new Date(oferta.fecha_publicacion);
        if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 24 * 3600000) {
            if (d.getTime() < limiteVentanaMs) {
                return { elegible: false, motivoDescarte: 'antigua' };
            }
        }
    }
    return { elegible: true };
}

// Headers comunes para las requests de scraping directo (sin Apify).
// Simulan un navegador real para evitar bloqueos por User-Agent genérico.
const HEADERS_SCRAPING = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

/**
 * Canonizo una URL genérica para deduplicación intra-ejecución con Set.
 * Remuevo fragmentos (#) y trailing slashes.
 *
 * @param {string} url - URL cruda.
 * @returns {string|null} URL normalizada o null.
 */
function canonizarUrlGeneral(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const u = new URL(url);
        u.hash = '';
        return u.toString().replace(/\/$/, '');
    } catch {
        return url.split('#')[0].trim().replace(/\/$/, '');
    }
}

/**
 * Adjunto métricas extendidas al array resultado de forma no enumerable para no alterar
 * comparaciones de igualdad profunda (toEqual) en suites de pruebas preexistentes.
 *
 * @param {Array<Object>} resultado - Array de ofertas resultantes.
 * @param {Object} metricas - Diccionario con métricas extendidas.
 * @returns {Array<Object>} El mismo array con propiedades no enumerables adjuntas.
 */
function adjuntarMetricas(resultado, metricas) {
    for (const [clave, valor] of Object.entries(metricas)) {
        Object.defineProperty(resultado, clave, {
            value: valor,
            enumerable: false,
            configurable: true,
            writable: true,
        });
    }
    Object.defineProperty(resultado, 'metricas', {
        value: metricas,
        enumerable: false,
        configurable: true,
        writable: true,
    });
    return resultado;
}

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
    opciones = resolverConfiguracion('linkedin', opciones).opciones;
    const maxResultados = opciones.maxResultados || 100;

    try {
        console.log('Scraping LinkedIn: construyendo URLs de búsqueda...');
        const urls = construirUrlsLinkedin({
            terminos: opciones.terminos,
            ubicacion: opciones.ubicacion,
            ubicaciones: opciones.ubicaciones,
            filtrarNivelLinkedin: opciones.filtrarNivelLinkedin,
        });
        console.log(`Scraping LinkedIn: ${urls.length} URL(s) de búsqueda generadas.`);
        if (!urls.length) {
            const error = new Error('Necesito términos de búsqueda utilizables para LinkedIn; no envío consultas vacías ni las sustituyo por defaults.');
            error.codigo = 'consulta_incompatible_fuente';
            error.status = 400;
            throw error;
        }

        // Actor restaurado: curious_coder/linkedin-jobs-scraper (hKByXkMQaC5Qt9UMN).
        // Input del actor:
        //   urls          → array de strings con las URLs de búsqueda de LinkedIn.
        //   count         → límite de resultados totales.
        //   scrapeCompany → si scraped info adicional de la empresa; lo desactivamos
        //                   para reducir costo y tiempo de ejecución.
        console.log('Scraping LinkedIn: ejecutando actor de Apify...');
        const ejecucion = await clienteApify.actor(ACTORES.LINKEDIN).call({
            urls,
            count: maxResultados,
            scrapeCompany: false,
        });

        console.log('Scraping LinkedIn: obteniendo resultados del dataset...');
        const { items } = await clienteApify
            .dataset(ejecucion.defaultDatasetId)
            .listItems();

        console.log(`Scraping LinkedIn: ${items.length} ofertas crudas obtenidas.`);

        const ofertasNormalizadas = normalizarLote(items, 'linkedin');
        console.log(`Scraping LinkedIn: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        const resultado = ofertasNormalizadas.slice(0, maxResultados);
        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: 14,
            consultasEjecutadas: urls.length,
            consultasOmitidas: 0,
            totalCrudos: items.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas: 0,
            antiguasDescartadas: 0,
            sinFechaConocida: 0,
            motivoFinalizacion: resultado.length >= maxResultados ? 'limite_resultados' : 'agotado',
        });

        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de LinkedIn: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de Computrabajo Argentina usando fetch() + cheerio.
 *
 * A diferencia del resto de los scrapers basados en Apify, este usa scraping
 * directo porque Computrabajo sirve sus listados como HTML server-side (SSR).
 * No necesita JavaScript para renderizar — los datos están en el HTML crudo.
 *
 * Flujo:
 * 1. Para cada término, busco en ar.computrabajo.com/empleos-de-{termino} y
 *    extraigo los cards de oferta del listado (título, empresa, ubicación, URL).
 * 2. Para cada oferta del listado, hago un fetch de la página de detalle para
 *    obtener la descripción completa y la modalidad de trabajo.
 *    Las requests de detalle van en lotes de 5 con 300ms de pausa entre lotes.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingComputrabajo(opciones = {}) {
    opciones = resolverConfiguracion('computrabajo', opciones).opciones;
    const maxResultados = opciones.maxResultados || 50;
    // Lotes de 5 requests simultáneas al obtener detalles, con pausa entre lotes.
    const CONCURRENCIA_DETALLE = 5;
    const PAUSA_ENTRE_LOTES_MS = 300;
    const MAX_PAGINAS_COMPUTRABAJO = 2;
    const diasVentana = 30;
    const limite30Dias = Date.now() - diasVentana * 24 * 60 * 60 * 1000;

    try {
        const urls = construirUrlsComputrabajo({ terminos: opciones.terminos });
        console.log(`Scraping Computrabajo: ${urls.length} URL(s) de búsqueda generadas.`);

        // === Paso 1: Extraer cards básicos del listado ===
        // Deduplicación temprana en memoria con Set antes de fetchear detalles.
        const urlsVistas = new Set();
        const ofertasParciales = [];
        let duplicadasDescartadas = 0;
        let antiguasDescartadasListado = 0;
        let peticionesListado = 0;
        const urlsConsultadas = new Set();

        buclePaginas: for (let pagina = 1; pagina <= MAX_PAGINAS_COMPUTRABAJO; pagina++) {
            let tarjetasEncontradasRonda = 0;

            for (const urlBase of urls) {
                if (ofertasParciales.length >= maxResultados) break buclePaginas;

                urlsConsultadas.add(urlBase);
                const urlBusqueda = pagina === 1
                    ? urlBase
                    : (urlBase.includes('?') ? `${urlBase}&p=${pagina}` : `${urlBase}?p=${pagina}`);

                peticionesListado++;
                console.log(`Scraping Computrabajo: extrayendo listado de ${urlBusqueda} (página ${pagina})...`);

                const respListado = await fetch(urlBusqueda, { headers: HEADERS_SCRAPING });

                if (!respListado.ok) {
                    console.warn(`Scraping Computrabajo: HTTP ${respListado.status} en ${urlBusqueda}. Saltando.`);
                    continue;
                }

                const htmlListado = await respListado.text();
                const $listado = cheerio.load(htmlListado);

                $listado('article.box_offer').each((_, el) => {
                    if (ofertasParciales.length >= maxResultados) return false;

                    const link = $listado(el).find('h2 a.js-o-link');
                    const href = link.attr('href');
                    const titulo = link.text().trim();

                    if (!href || !titulo) return;

                    tarjetasEncontradasRonda++;

                    // Elimino el fragment #lc=... que Computrabajo usa para tracking.
                    const urlRelativa = href.split('#')[0];
                    const urlAbsoluta = `https://ar.computrabajo.com${urlRelativa}`;

                    if (urlsVistas.has(urlAbsoluta)) {
                        duplicadasDescartadas++;
                        return;
                    }

                    // Fecha en texto plano: "Hace 2 horas", "Hace 6 días", "Hace 2 meses", etc.
                    const fechaTexto = $listado(el).find('p.fs13.fc_aux.mt15').text().trim() || null;

                    // Descarte temprano de tarjetas con fecha relativa claramente fuera de la ventana de 30 días
                    if (fechaTexto) {
                        const fechaAprox = parsearFechaRelativaComputrabajo(fechaTexto);
                        if (fechaAprox && fechaAprox.getTime() < limite30Dias) {
                            antiguasDescartadasListado++;
                            return; // No consume cupo de tarjetas útiles
                        }
                    }

                    urlsVistas.add(urlAbsoluta);

                    // Empresa: primer párrafo con las clases fs16 fc_base mt5.
                    const empresa = $listado(el).find('p.fs16.fc_base.mt5').first().text().trim() || null;

                    // Ubicación: span.mr10 dentro del segundo párrafo de ese estilo.
                    const ubicacion = $listado(el).find('p.fs16.fc_base.mt5 span.mr10').text().trim() || null;

                    ofertasParciales.push({ url: urlAbsoluta, titulo, empresa, ubicacion, fechaTexto });
                });

                console.log(`Scraping Computrabajo: ${ofertasParciales.length} ofertas útiles en listado hasta ahora.`);
            }

            if (tarjetasEncontradasRonda === 0) {
                break;
            }
        }

        // Acotamos estrictamente las tarjetas antes del fetch de detalle para no hacer requests innecesarias.
        const tarjetasAProcesar = ofertasParciales.slice(0, maxResultados);
        console.log(`Scraping Computrabajo: ${tarjetasAProcesar.length} ofertas en listado. Obteniendo descripciones...`);

        // === Paso 2: Fetch de cada página de detalle para obtener descripción y modalidad ===
        // Proceso en lotes para no sobrecargar el servidor con requests simultáneas.
        const itemsCrudos = [];

        for (let i = 0; i < tarjetasAProcesar.length; i += CONCURRENCIA_DETALLE) {
            const lote = tarjetasAProcesar.slice(i, i + CONCURRENCIA_DETALLE);

            const resultadosLote = await Promise.all(lote.map(async (oferta) => {
                try {
                    const respDetalle = await fetch(oferta.url, { headers: HEADERS_SCRAPING });

                    if (!respDetalle.ok) {
                        console.warn(`Scraping Computrabajo: HTTP ${respDetalle.status} en detalle. Usando datos del listado.`);
                        return _construirItemComputrabajo(oferta, null, null);
                    }

                    const htmlDetalle = await respDetalle.text();
                    const $det = cheerio.load(htmlDetalle);

                    // Descripción completa: primer párrafo con clase mbB.
                    const descripcion = $det('p.mbB').first().text().trim() || null;

                    // Modalidad: busco entre los tags de condición el que dice
                    // "Presencial", "Remoto", "Híbrido" o combinaciones.
                    let modalidad = null;
                    $det('div.mbB span.tag.base.mb10').each((_, tag) => {
                        const texto = $det(tag).text().trim();
                        if (/presencial|remoto|r.moto|h.brido/i.test(texto)) {
                            modalidad = texto;
                            return false; // Tomo solo el primero que matchea.
                        }
                    });

                    return _construirItemComputrabajo(oferta, descripcion, modalidad);

                } catch (errDetalle) {
                    console.warn(`Scraping Computrabajo: error al obtener detalle: ${errDetalle.message}. Usando datos del listado.`);
                    return _construirItemComputrabajo(oferta, null, null);
                }
            }));

            itemsCrudos.push(...resultadosLote);

            // Pausa entre lotes para no martillar el servidor.
            if (i + CONCURRENCIA_DETALLE < tarjetasAProcesar.length) {
                await new Promise(resolve => setTimeout(resolve, PAUSA_ENTRE_LOTES_MS));
            }
        }

        console.log(`Scraping Computrabajo: ${itemsCrudos.length} ofertas crudas obtenidas.`);

        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'computrabajo');
        const ofertasFiltradas = filtrarPorVentanaPublicacion(ofertasNormalizadas, diasVentana);
        // Filtrar también ofertas cuyo idioma sea excluido por el perfil
        const ofertasElegibles = ofertasFiltradas.filter(o => detectarIdioma(o.titulo, o.descripcion) !== 'en');
        console.log(`Scraping Computrabajo: ${ofertasNormalizadas.length} normalizadas → ${ofertasElegibles.length} elegibles dentro de ${diasVentana} días.`);

        const resultado = ofertasElegibles.slice(0, maxResultados);
        const consultasEjecutadas = urlsConsultadas.size;
        const consultasOmitidas = Math.max(0, urls.length - consultasEjecutadas);
        const totalAntiguas = (ofertasFiltradas.antiguasDescartadas || 0) + antiguasDescartadasListado;

        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: diasVentana,
            consultasEjecutadas,
            consultasOmitidas,
            peticionesRealizadas: peticionesListado + itemsCrudos.length,
            totalCrudos: itemsCrudos.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas,
            antiguasDescartadas: totalAntiguas,
            sinFechaConocida: ofertasFiltradas.sinFechaConocida || 0,
            motivoFinalizacion: resultado.length >= maxResultados ? 'limite_resultados' : 'agotado',
        });

        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Computrabajo: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Armo el objeto "item crudo" de Computrabajo con los campos que espera
 * el normalizador. Los nombres de campos respetan el contrato de
 * normalizarOfertaComputrabajo: url, title, company, location, descriptionText, postedDate.
 *
 * @param {Object} ofertaListado - Datos básicos extraídos del listado.
 * @param {string|null} descripcion - Texto completo del detalle.
 * @param {string|null} modalidad - "Presencial", "Remoto", "Híbrido", etc.
 * @returns {Object} Item crudo listo para normalizar.
 */
function _construirItemComputrabajo(ofertaListado, descripcion, modalidad) {
    return {
        url: ofertaListado.url,
        title: ofertaListado.titulo,
        company: ofertaListado.empresa || null,
        location: ofertaListado.ubicacion || null,
        descriptionText: descripcion,
        postedDate: null,           // No hay fecha ISO en el HTML, solo texto relativo.
        fechaTexto: ofertaListado.fechaTexto || null,
        modalidadDetalle: modalidad, // Campo nuevo: disponible gracias al scraping directo.
    };
}

/**
 * Ejecuto el scraping de Indeed Argentina.
 *
 * El actor de Indeed recibe keywords directamente como string.
 * En vez de hacer un actor.call() por cada término (que genera N runs
 * separados con costo de compute por cada uno), combinamos todos los
 * términos en UNA sola query OR y ejecutamos 1 único run.
 * Ejemplo: "qa tester OR programador OR frontend developer angular"
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo total de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingIndeed(opciones = {}) {
    opciones = resolverConfiguracion('indeed', opciones).opciones;
    const maxResultados = opciones.maxResultados || 50;
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    try {
        const queryUnificada = opciones.queryIndeed || terminos.join(' OR ');
        console.log(`Scraping Indeed: ejecutando 1 run con query: "${queryUnificada}"...`);

        // El actor de Indeed recibe keywords y país directamente.
        const ejecucion = await clienteApify.actor(ACTORES.INDEED).call({
            title: queryUnificada,
            country: 'ar',
            limit: maxResultados,
        });

        const { items: itemsCrudos } = await clienteApify
            .dataset(ejecucion.defaultDatasetId)
            .listItems();

        console.log(`Scraping Indeed: ${itemsCrudos.length} ofertas crudas obtenidas.`);

        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'indeed');
        console.log(`Scraping Indeed: ${ofertasNormalizadas.length} ofertas normalizadas.`);

        const resultado = ofertasNormalizadas.slice(0, maxResultados);
        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: 30,
            consultasEjecutadas: 1,
            consultasOmitidas: 0,
            totalCrudos: itemsCrudos.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas: 0,
            antiguasDescartadas: 0,
            sinFechaConocida: 0,
            motivoFinalizacion: resultado.length >= maxResultados ? 'limite_resultados' : 'agotado',
        });

        return resultado;

    } catch (error) {
        // Envuelvo el error con un mensaje descriptivo para facilitar el debugging.
        // El error original queda en .cause (para no perder información).
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
 * Bumeran usa el puppeteer-scraper (actor genérico de Apify con Puppeteer).
 * Le paso las URLs de búsqueda y una función JavaScript (pageFunction)
 * que se ejecuta en el contexto de Node.js del actor y accede al DOM
 * mediante context.page.evaluate(). Esto es necesario porque Bumeran
 * es una SPA React que requiere JavaScript para renderizar.
 *
 * Los selectores CSS se basan en atributos semánticos (aria-label,
 * IDs con patrón fijo, tags HTML) para ser resistentes a cambios
 * en las clases CSS de Bumeran (que son hashes de styled-components).
 *
 * NOTA: Se migró desde apify/web-scraper a apify/puppeteer-scraper porque
 * web-scraper tenía bloqueos intermitentes con useApifyProxy: true.
 * La diferencia clave es que puppeteer-scraper ejecuta la pageFunction
 * en Node.js (no en el browser), así que jQuery NO está disponible
 * directamente. Se usa page.evaluate() para correr código en el browser
 * Y se inyecta jQuery con context.injectJQuery() si es necesario.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingBumeran(opciones = {}) {
    opciones = resolverConfiguracion('bumeran', opciones).opciones;
    try {
        console.log('Scraping Bumeran: construyendo URLs de búsqueda...');
        const urls = construirUrlsBumeran({
            terminos: opciones.terminos,
        });
        console.log(`Scraping Bumeran: ${urls.length} URL(s) de búsqueda generadas.`);

        const startUrls = urls.map(url => ({ url }));

        // La pageFunction se ejecuta en el contexto de Node.js del actor
        // puppeteer-scraper (NO dentro del browser como en web-scraper).
        // Usa context.page.evaluate() para correr código dentro del browser
        // después de que React renderice la página.
        const pageFunction = `
            async function pageFunction(context) {
                const { request, log, page } = context;

                // Inyecto jQuery en la página para usar los mismos selectores
                // que funcionaban con web-scraper.
                await context.injectJQuery();

                // Extraigo los datos DENTRO del browser usando page.evaluate().
                // Todo lo que está adentro de page.evaluate() corre en el contexto
                // del DOM renderizado, igual que la pageFunction de web-scraper.
                const resultados = await page.evaluate(() => {
                    const $ = window.$;
                    const datos = [];

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

                        datos.push({ url: url, titulo: titulo, empresa: empresa, ubicacion: ubicacion, modalidad: modalidad, descripcion: descripcion });
                    });

                    return datos;
                });

                log.info('Bumeran: ' + resultados.length + ' ofertas extra\\u00eddas de ' + request.url);
                return resultados;
            }
        `;

        console.log('Scraping Bumeran: ejecutando puppeteer-scraper de Apify...');
        const ejecucion = await clienteApify.actor(ACTORES.BUMERAN_WEB).call({
            startUrls,
            pageFunction,
            // puppeteer-scraper no necesita maxRequestsPerCrawl ni proxyConfiguration
            // como campos obligatorios — el actor los maneja con valores por defecto.
            // Pero pasamos proxyConfiguration para usar Apify Proxy y proteger la IP.
            proxyConfiguration: { useApifyProxy: true },
            // Evito que el scraper siga enlaces de la página (no queremos crawling).
            linkSelector: '',
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

        const maxResultados = opciones.maxResultados || 100;
        const resultado = ofertasNormalizadas.slice(0, maxResultados);
        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: 30,
            consultasEjecutadas: urls.length,
            consultasOmitidas: 0,
            totalCrudos: itemsAplanados.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas: 0,
            antiguasDescartadas: 0,
            sinFechaConocida: resultado.length,
            motivoFinalizacion: resultado.length >= maxResultados ? 'limite_resultados' : 'agotado',
        });

        return resultado;

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
    opciones = resolverConfiguracion('glassdoor', opciones).opciones;
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

        const resultado = ofertasNormalizadas.slice(0, maxResultados);
        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: 14,
            consultasEjecutadas: 1,
            consultasOmitidas: 0,
            totalCrudos: items.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas: 0,
            antiguasDescartadas: 0,
            sinFechaConocida: 0,
            motivoFinalizacion: resultado.length >= maxResultados ? 'limite_resultados' : 'agotado',
        });

        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Glassdoor: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el piloto GetOnBrd solo sobre un cliente inyectable y destino validado.
 */
async function ejecutarScrapingGetonbrd(opciones = {}) {
    const ahora = opciones.ahora instanceof Date ? opciones.ahora : new Date();
    const guardia = validarDestinoGetonbrd({
        destino: opciones.destino || DESTINO_SANDBOX,
        evidencia: opciones.evidencia,
        habilitado: opciones.habilitado,
        ahora,
    });
    const checkpoint = {
        termino_indice: opciones.checkpointInicial?.termino_indice || 0,
        termino: opciones.checkpointInicial?.termino || null,
        pagina_confirmada: opciones.checkpointInicial?.pagina_confirmada || 0,
        pagina_siguiente: opciones.checkpointInicial?.pagina_siguiente || 1,
        item_offset: opciones.checkpointInicial?.item_offset || 0,
    };
    const resultado = {
        run_id: randomUUID(), estado: guardia.permitido ? 'completado' : 'bloqueado',
        motivo_terminacion: guardia.permitido ? 'paginas_agotadas' : guardia.motivo,
        destino: guardia.destino, ofertas: [], checkpoint,
        metricas: { requests: 0, paginas: 0, recibidas: 0, normalizadas: 0, dentro_ventana: 0, fuera_ventana: 0, duplicadas_intra_run: 0, invalidas: 0, latencia_ms: 0 },
    };
    if (!guardia.permitido) return resultado;

    const destino = opciones.destino || DESTINO_SANDBOX;
    const limitePaginas = Math.max(1, Math.min(opciones.limitePaginas || LIMITES_GETONBRD.paginas, LIMITES_GETONBRD.paginas));
    const limiteItems = Math.max(1, Math.min(opciones.maxResultados || opciones.limiteItems || LIMITES_GETONBRD.items, LIMITES_GETONBRD.items));
    const timeoutMs = Math.max(1, Math.min(opciones.timeoutMs || LIMITES_GETONBRD.timeoutMs, LIMITES_GETONBRD.timeoutMs));
    const terminos = Array.isArray(opciones.terminos) && opciones.terminos.length ? opciones.terminos : TERMINOS_BUSQUEDA_DEFECTO;
    const cliente = opciones.cliente || fetch;
    const urlsVistas = new Set();
    const limiteFecha = ahora.getTime() - 30 * 24 * 60 * 60 * 1000;
    const inicio = Date.now();
    let paginasProcesadas = 0;
    const terminar = (estado, motivo) => {
        resultado.estado = estado;
        resultado.motivo_terminacion = motivo;
        resultado.metricas.latencia_ms = Date.now() - inicio;
        return resultado;
    };

    terminosPendientes: for (let indice = checkpoint.termino_indice; indice < terminos.length; indice++) {
        const termino = terminos[indice];
        let pagina = indice === checkpoint.termino_indice ? checkpoint.pagina_siguiente : 1;
        let techoTotalPaginas = Infinity;

        while (pagina <= techoTotalPaginas && paginasProcesadas < limitePaginas) {
            if (opciones.signal?.aborted) return terminar('cancelado', 'cancelacion');
            if (resultado.ofertas.length >= limiteItems) return terminar('parcial', 'limite_items');
            const abortador = new AbortController();
            const cancelarExterno = () => abortador.abort();
            opciones.signal?.addEventListener('abort', cancelarExterno, { once: true });
            const temporizador = setTimeout(() => abortador.abort(), timeoutMs);
            let respuesta;
            try {
                resultado.metricas.requests++;
                respuesta = await cliente(`${destino}/search/jobs?query=${encodeURIComponent(termino)}&page=${pagina}&per_page=${LIMITES_GETONBRD.porPagina}`, { signal: abortador.signal });
            } catch (error) {
                clearTimeout(temporizador);
                opciones.signal?.removeEventListener('abort', cancelarExterno);
                return terminar(opciones.signal?.aborted ? 'cancelado' : 'parcial', opciones.signal?.aborted ? 'cancelacion' : 'timeout');
            }
            if (opciones.signal?.aborted) {
                clearTimeout(temporizador);
                opciones.signal.removeEventListener('abort', cancelarExterno);
                return terminar('cancelado', 'cancelacion');
            }
            if (!respuesta?.ok) {
                clearTimeout(temporizador);
                opciones.signal?.removeEventListener('abort', cancelarExterno);
                return terminar('parcial', 'error_http');
            }
            let cuerpo;
            try {
                cuerpo = await Promise.race([
                    respuesta.json(),
                    new Promise((_, rechazar) => abortador.signal.addEventListener(
                        'abort',
                        () => rechazar(new Error('Solicitud GetOnBrd abortada.')),
                        { once: true }
                    )),
                ]);
            } catch (error) {
                clearTimeout(temporizador);
                opciones.signal?.removeEventListener('abort', cancelarExterno);
                if (abortador.signal.aborted) {
                    return terminar(opciones.signal?.aborted ? 'cancelado' : 'parcial', opciones.signal?.aborted ? 'cancelacion' : 'timeout');
                }
                return terminar('parcial', 'respuesta_invalida');
            }
            clearTimeout(temporizador);
            opciones.signal?.removeEventListener('abort', cancelarExterno);
            if (!Array.isArray(cuerpo?.data)) return terminar('parcial', 'respuesta_invalida');

            const items = cuerpo.data;
            paginasProcesadas++;
            resultado.metricas.paginas++;
            resultado.metricas.recibidas += items.length;
            techoTotalPaginas = Math.max(1, Number(cuerpo.meta?.total_pages) || 1);
            const itemOffset = indice === checkpoint.termino_indice && pagina === checkpoint.pagina_siguiente
                ? checkpoint.item_offset
                : 0;
            for (let itemIndice = itemOffset; itemIndice < items.length; itemIndice++) {
                const item = items[itemIndice];
                checkpoint.item_offset = itemIndice + 1;
                const [oferta] = normalizarLote([item], 'getonbrd');
                if (!oferta || !oferta.fecha_publicacion || Number.isNaN(new Date(oferta.fecha_publicacion).getTime())) {
                    resultado.metricas.invalidas++;
                    continue;
                }
                resultado.metricas.normalizadas++;
                const urlCanonica = normalizarUrlGetonbrd(oferta.url);
                if (!urlCanonica) {
                    resultado.metricas.invalidas++;
                    continue;
                }
                if (new Date(oferta.fecha_publicacion).getTime() < limiteFecha) {
                    resultado.metricas.fuera_ventana++;
                    continue;
                }
                if (urlsVistas.has(urlCanonica)) {
                    resultado.metricas.duplicadas_intra_run++;
                    continue;
                }
                urlsVistas.add(urlCanonica);
                oferta.url = urlCanonica;
                resultado.ofertas.push(oferta);
                resultado.metricas.dentro_ventana++;
                if (resultado.ofertas.length >= limiteItems) break;
            }
            checkpoint.termino_indice = indice;
            checkpoint.termino = termino;
            if (checkpoint.item_offset >= items.length) {
                checkpoint.pagina_confirmada = pagina;
                checkpoint.pagina_siguiente = pagina + 1;
                checkpoint.item_offset = 0;
            }
            if (opciones.alConfirmarCheckpoint) await opciones.alConfirmarCheckpoint({ ...checkpoint });
            if (resultado.ofertas.length >= limiteItems) return terminar('parcial', 'limite_items');
            if (paginasProcesadas >= limitePaginas && (pagina < techoTotalPaginas || indice < terminos.length - 1)) {
                return terminar('parcial', 'limite_paginas');
            }
            if (items.length === 0) {
                if (indice < terminos.length - 1) continue terminosPendientes;
                return terminar('completado', 'pagina_vacia');
            }
            pagina++;
        }
        if (pagina <= techoTotalPaginas) return terminar('parcial', 'limite_paginas');
    }
    return terminar('completado', 'paginas_agotadas');
}

function normalizarUrlGetonbrd(url) {
    try {
        const canonica = new URL(url);
        canonica.hash = '';
        canonica.pathname = canonica.pathname.replace(/\/$/, '');
        return canonica.toString();
    } catch (error) {
        return null;
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
    opciones = resolverConfiguracion('jooble', opciones).opciones;
    const maxResultados = opciones.maxResultados || 50;
    const terminosBase = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;
    const terminos = opciones.consultasJooble || terminosBase;
    const UBICACIONES_JOOBLE = ['Remote'];
    const MAX_PAGINAS_POR_TERMINO = opciones.maxPaginasPorTermino || 2;
    // Tope global independiente para proteger el cupo gratuito de Jooble
    const TOPE_GLOBAL_PETICIONES = 15;
    const MAX_PETICIONES = opciones.maxPeticiones || TOPE_GLOBAL_PETICIONES;
    const diasVentana = 30;
    const limite30Dias = Date.now() - diasVentana * 24 * 60 * 60 * 1000;

    try {
        console.log(`Scraping Jooble: buscando ${terminos.length} término(s) con round-robin (tope: ${MAX_PETICIONES} peticiones)...`);
        const urlsVistas = new Set();
        const ofertasElegibles = [];
        let totalCrudos = 0;
        let duplicadasDescartadas = 0;
        let antiguasDescartadas = 0;
        let sinFechaConocida = 0;
        let peticionesEjecutadas = 0;
        const terminosConsultados = new Set();
        let huboLimitePaginas = false;

        const estadosTerminos = terminos.map(termino => ({
            termino,
            totalPaginas: Infinity,
            agotado: false,
        }));

        const urlApi = `${JOOBLE_API_URL}${JOOBLE_API_KEY}`;

        bucleRondas: for (let numeroPagina = 1; numeroPagina <= MAX_PAGINAS_POR_TERMINO; numeroPagina++) {
            let huboPeticionEnRonda = false;

            for (const estado of estadosTerminos) {
                if (ofertasElegibles.length >= maxResultados) break bucleRondas;
                if (peticionesEjecutadas >= MAX_PETICIONES) break bucleRondas;
                if (estado.agotado || numeroPagina > estado.totalPaginas) continue;

                for (const pais of UBICACIONES_JOOBLE) {
                    if (ofertasElegibles.length >= maxResultados) break bucleRondas;
                    if (peticionesEjecutadas >= MAX_PETICIONES) break bucleRondas;

                    huboPeticionEnRonda = true;
                    peticionesEjecutadas++;
                    terminosConsultados.add(estado.termino);
                    console.log(`Scraping Jooble: [Ronda ${numeroPagina}] buscando "${estado.termino}" en ${pais}...`);

                    const respuestaPagina = await fetch(urlApi, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            keywords: estado.termino,
                            location: pais,
                            page: numeroPagina,
                        }),
                    });

                    if (!respuestaPagina.ok) {
                        console.warn(`Scraping Jooble: error HTTP ${respuestaPagina.status} en página ${numeroPagina} para "${estado.termino}" en ${pais}. Saltando.`);
                        estado.agotado = true;
                        continue;
                    }

                    const jsonPagina = await respuestaPagina.json();
                    const totalCount = jsonPagina.totalCount || 0;
                    const totalPaginasPosibles = Math.ceil(totalCount / 20) || 1;
                    estado.totalPaginas = Math.min(totalPaginasPosibles, MAX_PAGINAS_POR_TERMINO);

                    if (totalPaginasPosibles > MAX_PAGINAS_POR_TERMINO) {
                        huboLimitePaginas = true;
                    }

                    const jobs = Array.isArray(jsonPagina.jobs) ? jsonPagina.jobs : [];
                    totalCrudos += jobs.length;
                    console.log(`Scraping Jooble: página ${numeroPagina}/${estado.totalPaginas} → ${jobs.length} ítem(s) para "${estado.termino}" (${pais}).`);

                    if (jobs.length === 0 || numeroPagina >= estado.totalPaginas) {
                        estado.agotado = true;
                    }

                    // Normalizo y evalúo elegibilidad de inmediato por página
                    const normalizadas = normalizarLote(jobs, 'jooble');

                    for (const oferta of normalizadas) {
                        const urlCanonica = canonizarUrlGeneral(oferta.url);
                        if (!urlCanonica) continue;

                        if (urlsVistas.has(urlCanonica)) {
                            duplicadasDescartadas++;
                            continue;
                        }

                        // Verificación de elegibilidad estricta (idioma y ventana temporal)
                        const evaluacion = evaluarElegibilidadOferta(oferta, limite30Dias);
                        if (!evaluacion.elegible) {
                            if (evaluacion.motivoDescarte === 'antigua') {
                                antiguasDescartadas++;
                            }
                            continue;
                        }

                        if (!oferta.fecha_publicacion) {
                            sinFechaConocida++;
                        }

                        urlsVistas.add(urlCanonica);
                        ofertasElegibles.push(oferta);
                        if (ofertasElegibles.length >= maxResultados) break;
                    }
                }
            }

            if (!huboPeticionEnRonda) break;
        }

        const consultasEjecutadas = terminosConsultados.size;
        const consultasOmitidas = Math.max(0, terminos.length - consultasEjecutadas);
        const consultasOmitidasPorPresupuesto = terminos.filter(t => !terminosConsultados.has(t));

        let motivoFinalizacion = 'agotado';
        if (ofertasElegibles.length >= maxResultados) {
            motivoFinalizacion = 'limite_resultados';
        } else if (peticionesEjecutadas >= MAX_PETICIONES) {
            motivoFinalizacion = 'limite_peticiones';
        } else if (huboLimitePaginas) {
            motivoFinalizacion = 'limite_paginas';
        }

        // HARD CAP: nunca retorno más de maxResultados
        const resultado = ofertasElegibles.slice(0, maxResultados);
        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: diasVentana,
            consultasEjecutadas,
            consultasOmitidas,
            consultasOmitidasPorPresupuesto,
            peticionesRealizadas: peticionesEjecutadas,
            totalCrudos,
            totalElegibles: resultado.length,
            duplicadasDescartadas,
            antiguasDescartadas,
            sinFechaConocida,
            motivoFinalizacion,
        });

        console.log(`Scraping Jooble: finalizado (${motivoFinalizacion}) con ${resultado.length} ofertas elegibles de ${totalCrudos} crudas.`);
        return resultado;

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
 * El actor recibe query + country + filtros directamente.
 *
 * IMPORTANTE: En vez de hacer UNA llamada por cada término (que generaba un
 * run separado de Apify por término y multiplicaba el costo de compute),
 * combinamos todos los términos en UNA sola query con OR.
 * Ejemplo: "qa tester OR programador OR frontend developer angular"
 * Google Jobs interpreta el OR y devuelve resultados de todos los términos
 * en una sola ejecución del actor. Esto redujo el costo de ~$1.80/ciclo a ~$0.30.
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
async function ejecutarScrapingGoogleJobs() {
    // DESACTIVADO — Google Jobs consumió USD 1.50 sin devolver
    // resultados útiles. El actor igview-owner/google-jobs-scraper (CkLDY9GAQf6QlP6GP)
    // tiene costo de $5/1000 resultados y desempeño inconsistente para Argentina.
    // Mientras no tenga una estrategia 100% segura, esta función NO debe llamar a Apify.
    console.log('[Google Jobs] Plataforma desactivada. Retornando 0 ofertas sin llamar a Apify.');
    return [];
}

/**
 * Ejecuto el scraping de Remotive usando su API pública (gratuita, sin auth).
 *
 * Remotive es un portal de empleo exclusivamente remoto. Su API REST devuelve
 * los resultados directamente en JSON:
 * GET https://remotive.com/api/remote-jobs?search={termino}&limit={max}
 *
 * La respuesta tiene la forma: { job-count: N, jobs: [...] }
 *
 * Como Remotive es 100% remoto, la modalidad siempre será 'remoto'.
 * El campo candidate_required_location indica la ubicación requerida del candidato
 * (ej: 'Worldwide', 'Latin America', 'LATAM').
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingRemotive(opciones = {}) {
    opciones = resolverConfiguracion('remotive', opciones).opciones;
    const maxResultados = opciones.maxResultados || 50;
    const categorias = opciones.categoriasRemotive?.length ? opciones.categoriasRemotive : ['software-dev'];
    const diasVentana = 30;
    const limite30Dias = Date.now() - diasVentana * 24 * 60 * 60 * 1000;

    try {
        const urlsVistas = new Set();
        const ofertasElegibles = [];
        let totalCrudos = 0;
        let duplicadasDescartadas = 0;
        let antiguasDescartadas = 0;
        let sinFechaConocida = 0;
        let consultasEjecutadas = 0;

        for (const categoria of categorias) {
            if (ofertasElegibles.length >= maxResultados) break;
            consultasEjecutadas++;
            console.log(`Scraping Remotive: buscando ofertas en categoría "${categoria}"...`);

            const url = `${REMOTIVE_API_BASE}/remote-jobs?category=${categoria}&limit=${maxResultados}`;
            const respuesta = await fetch(url);

            if (!respuesta.ok) {
                console.warn(`Scraping Remotive: error HTTP ${respuesta.status} para categoría ${categoria}. Saltando.`);
                continue;
            }

            const json = await respuesta.json();
            const jobs = json.jobs || [];
            totalCrudos += jobs.length;

            const normalizadas = normalizarLote(jobs, 'remotive');
            for (const oferta of normalizadas) {
                const urlCanonica = canonizarUrlGeneral(oferta.url);
                if (!urlCanonica) continue;

                if (urlsVistas.has(urlCanonica)) {
                    duplicadasDescartadas++;
                    continue;
                }

                const evaluacion = evaluarElegibilidadOferta(oferta, limite30Dias);
                if (!evaluacion.elegible) {
                    if (evaluacion.motivoDescarte === 'antigua') {
                        antiguasDescartadas++;
                    }
                    continue;
                }

                if (!oferta.fecha_publicacion) {
                    sinFechaConocida++;
                }

                urlsVistas.add(urlCanonica);
                ofertasElegibles.push(oferta);
                if (ofertasElegibles.length >= maxResultados) break;
            }
        }
        console.log(`Scraping Remotive: ${totalCrudos} ítem(s) en total, ${ofertasElegibles.length} elegibles.`);

        const resultado = ofertasElegibles.slice(0, maxResultados);
        const consultasOmitidas = Math.max(0, categorias.length - consultasEjecutadas);
        const motivoFinalizacion = resultado.length >= maxResultados ? 'limite_resultados' : 'agotado';

        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: diasVentana,
            consultasEjecutadas,
            consultasOmitidas,
            totalCrudos,
            totalElegibles: resultado.length,
            duplicadasDescartadas,
            antiguasDescartadas,
            sinFechaConocida,
            motivoFinalizacion,
        });

        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Remotive: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de RemoteOK usando su API pública (gratuita, sin auth).
 *
 * RemoteOK es un portal de empleo exclusivamente remoto. Su API REST devuelve
 * un array donde el primer elemento ES SIEMPRE un aviso legal (no una oferta)
 * y el resto son los trabajos:
 * GET https://remoteok.com/api?tags={tag}
 *
 * Los términos de búsqueda se pasan como "tags": los espacios se convierten
 * en guiones (ej: 'full stack node' → 'full-stack-node').
 * Los caracteres especiales no alfanuméricos se eliminan.
 *
 * El campo posición es 'position' (no 'title' como en el resto de las APIs).
 * El salario viene estructurado en salary_min y salary_max (en USD).
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingRemoteOK(opciones = {}) {
    opciones = resolverConfiguracion('remoteok', opciones).opciones;
    const maxResultados = opciones.maxResultados || 50;
    const terminos = opciones.tagsRemoteOK?.length ? opciones.tagsRemoteOK : [
        'frontend',
        'react',
        'angular',
        'node',
        'fullstack',
        'javascript',
        'qa',
    ];
    const diasVentana = 30;
    const limite30Dias = Date.now() - diasVentana * 24 * 60 * 60 * 1000;
    const cupoObjetivoPorTag = Math.max(1, Math.ceil(maxResultados / terminos.length));

    try {
        console.log(`Scraping RemoteOK: buscando ${terminos.length} término(s) con reparto equitativo de cupo...`);
        const urlsVistas = new Set();
        const ofertasElegibles = [];
        const ofertasSobrantes = [];
        let totalCrudos = 0;
        let duplicadasDescartadas = 0;
        let antiguasDescartadas = 0;
        let sinFechaConocida = 0;
        const tagsConsultados = new Set();

        for (const termino of terminos) {
            if (ofertasElegibles.length >= maxResultados) break;

            tagsConsultados.add(termino);
            console.log(`Scraping RemoteOK: buscando tag "${termino}"...`);

            // RemoteOK filtra por etiquetas (tags). Convierto el término al formato
            // que espera la API: minúsculas, espacios a guiones, sin caracteres especiales.
            const tag = termino
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .trim()
                .replace(/\s+/g, '-');

            const url = `${REMOTEOK_API_BASE}?tags=${encodeURIComponent(tag)}`;
            const respuesta = await fetch(url, {
                headers: {
                    // RemoteOK requiere un User-Agent válido para no bloquear la request.
                    'User-Agent': 'Mozilla/5.0 BuscaEmpleos/1.0',
                },
            });

            if (!respuesta.ok) {
                console.warn(`Scraping RemoteOK: error HTTP ${respuesta.status} para "${termino}". Saltando.`);
                continue;
            }

            const json = await respuesta.json();

            // El primer elemento del array es SIEMPRE el aviso legal de RemoteOK.
            // Lo saltamos con slice(1) para no intentar normalizarlo como oferta.
            const trabajos = Array.isArray(json) ? json.slice(1) : [];
            totalCrudos += trabajos.length;
            console.log(`Scraping RemoteOK: ${trabajos.length} ítem(s) para "${termino}".`);

            const normalizadas = normalizarLote(trabajos, 'remoteok');
            let elegiblesTag = 0;

            for (const oferta of normalizadas) {
                const urlCanonica = canonizarUrlGeneral(oferta.url);
                if (!urlCanonica) continue;

                if (urlsVistas.has(urlCanonica)) {
                    duplicadasDescartadas++;
                    continue;
                }

                // Elegibilidad estricta: idioma admisible (no inglés) y ventana de publicación
                const evaluacion = evaluarElegibilidadOferta(oferta, limite30Dias);
                if (!evaluacion.elegible) {
                    if (evaluacion.motivoDescarte === 'antigua') {
                        antiguasDescartadas++;
                    }
                    continue;
                }

                if (!oferta.fecha_publicacion) {
                    sinFechaConocida++;
                }

                urlsVistas.add(urlCanonica);

                if (elegiblesTag < cupoObjetivoPorTag && ofertasElegibles.length < maxResultados) {
                    ofertasElegibles.push(oferta);
                    elegiblesTag++;
                } else {
                    ofertasSobrantes.push(oferta);
                }
            }
        }

        while (ofertasElegibles.length < maxResultados && ofertasSobrantes.length > 0) {
            ofertasElegibles.push(ofertasSobrantes.shift());
        }

        const consultasEjecutadas = tagsConsultados.size;
        const consultasOmitidas = Math.max(0, terminos.length - consultasEjecutadas);
        const consultasOmitidasPorPresupuesto = terminos.filter(t => !tagsConsultados.has(t));
        const motivoFinalizacion = ofertasElegibles.length >= maxResultados ? 'limite_resultados' : 'agotado';

        const resultado = ofertasElegibles.slice(0, maxResultados);
        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: diasVentana,
            consultasEjecutadas,
            consultasOmitidas,
            consultasOmitidasPorPresupuesto,
            totalCrudos,
            totalElegibles: resultado.length,
            duplicadasDescartadas,
            antiguasDescartadas,
            sinFechaConocida,
            motivoFinalizacion,
        });

        console.log(`Scraping RemoteOK: finalizado (${motivoFinalizacion}) con ${resultado.length} ofertas elegibles de ${totalCrudos} crudas.`);
        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de RemoteOK: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Ejecuto el scraping de InfoJobs España usando su API REST oficial.
 *
 * InfoJobs es el portal de empleo más grande de España. A diferencia de los
 * otros scrapers que usan Apify, este consume la API oficial directamente
 * con autenticación HTTP Basic (no hay actor involucrado).
 *
 * Regla crítica: solo se aceptan ofertas de remoto puro. El filtro se aplica
 * en DOS capas:
 *   - Capa 1 (en origen): parámetro `teleworking=solo-teletrabajo` en la query.
 *   - Capa 2 (en normalización): el normalizador descarta cualquier oferta cuyo
 *     campo `teleworking` no sea exactamente `'solo-teletrabajo'`.
 *
 * Autenticación:
 *   El header Authorization se construye como:
 *   `Basic ${base64(INFOJOBS_CLIENT_ID:INFOJOBS_CLIENT_SECRET)}`
 *
 * Comportamiento ante credenciales faltantes:
 *   - Ambas ausentes → retorna [] con advertencia en log.
 *   - Solo una presente → lanza error de configuración incompleta.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {number} [opciones.maxResultados=50] - Máximo de ofertas a extraer (cap: 50).
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Promise<Object[]>} Array de ofertas normalizadas listas para la BD.
 */
async function ejecutarScrapingInfojobs(opciones = {}) {
    // Limito a 50 como máximo porque la API gratuita tiene rate limits estrictos.
    const maxResultados = Math.min(opciones.maxResultados || 50, 50);
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    const clientId = process.env.INFOJOBS_CLIENT_ID;
    const clientSecret = process.env.INFOJOBS_CLIENT_SECRET;

    // Valido credenciales antes de hacer cualquier request.
    const tieneCid = Boolean(clientId);
    const tieneSecret = Boolean(clientSecret);

    if (!tieneCid && !tieneSecret) {
        // Ambas ausentes: InfoJobs deshabilitado silenciosamente (feature opcional).
        // Retorno un objeto especial para que el controlador pueda distinguir este caso
        // del caso de "scraping ejecutado pero sin resultados", y así el frontend
        // pueda mostrar una advertencia útil en lugar de un éxito engañoso de 0 extraídas.
        console.warn('Scraping InfoJobs: deshabilitado por falta de credenciales (INFOJOBS_CLIENT_ID e INFOJOBS_CLIENT_SECRET no definidas).');
        return {
            deshabilitado: true,
            codigo_resultado: 'infojobs_deshabilitado_sin_credenciales',
            advertencia: 'InfoJobs está deshabilitado. Configurá INFOJOBS_CLIENT_ID y INFOJOBS_CLIENT_SECRET en el backend para activarlo.',
            ofertas: [],
        };
    }

    if (tieneCid !== tieneSecret) {
        // Solo una presente: error de configuración explícito.
        throw new Error('Configuración incompleta de InfoJobs: se requieren CLIENT_ID y CLIENT_SECRET');
    }

    // Construyo el header de autenticación HTTP Basic.
    // Buffer.from().toString('base64') codifica en Base64 el par id:secret.
    const tokenBasico = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const headersAuth = {
        'Authorization': `Basic ${tokenBasico}`,
        'Content-Type': 'application/json',
    };

    const INFOJOBS_API_BASE = 'https://api.infojobs.net/api/9/offer';

    try {
        console.log(`Scraping InfoJobs: buscando ${terminos.length} término(s) con remoto puro...`);
        let itemsCrudos = [];

        for (const termino of terminos) {
            if (itemsCrudos.length >= maxResultados) break;

            console.log(`Scraping InfoJobs: buscando "${termino}"...`);

            // Construyo la URL con los parámetros de búsqueda.
            // teleworking=solo-teletrabajo es el filtro de remoto puro (Capa 1).
            const params = new URLSearchParams({
                q: termino,
                teleworking: 'solo-teletrabajo',
                maxResults: String(Math.min(maxResultados - itemsCrudos.length, 50)),
            });

            const url = `${INFOJOBS_API_BASE}?${params.toString()}`;
            const respuesta = await fetch(url, { headers: headersAuth });

            if (!respuesta.ok) {
                if (respuesta.status === 401) {
                    throw new Error('Credenciales de InfoJobs inválidas (401)');
                }
                if (respuesta.status === 429) {
                    throw new Error('Rate limit de InfoJobs excedido (429) — reintentar más tarde');
                }
                console.warn(`Scraping InfoJobs: error HTTP ${respuesta.status} para "${termino}". Saltando.`);
                continue;
            }

            const json = await respuesta.json();
            // La API de InfoJobs mostró variantes entre documentación y ejemplos públicos.
            // Priorizo `offers` (contrato oficial) pero tolero `items` por compatibilidad.
            const ofertas = Array.isArray(json.offers)
                ? json.offers
                : Array.isArray(json.items)
                    ? json.items
                    : [];
            itemsCrudos = itemsCrudos.concat(ofertas);
            console.log(`Scraping InfoJobs: ${ofertas.length} ítem(s) para "${termino}".`);
        }

        console.log(`Scraping InfoJobs: ${itemsCrudos.length} ofertas crudas en total.`);

        const diasVentana = 30;
        const urlsVistas = new Set();
        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'infojobs');
        let duplicadasDescartadas = 0;
        const ofertasSinDuplicados = [];
        for (const oferta of ofertasNormalizadas) {
            const urlCanonica = canonizarUrlGeneral(oferta.url);
            if (!urlCanonica || urlsVistas.has(urlCanonica)) {
                duplicadasDescartadas++;
                continue;
            }
            urlsVistas.add(urlCanonica);
            ofertasSinDuplicados.push(oferta);
        }

        const ofertasFiltradas = filtrarPorVentanaPublicacion(ofertasSinDuplicados, diasVentana);
        console.log(`Scraping InfoJobs: ${ofertasNormalizadas.length} normalizadas → ${ofertasFiltradas.length} dentro de ${diasVentana} días.`);

        const resultado = ofertasFiltradas.slice(0, maxResultados);
        const motivoFinalizacion = resultado.length >= maxResultados ? 'limite_resultados' : 'agotado';

        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: diasVentana,
            consultasEjecutadas: terminos.length,
            consultasOmitidas: 0,
            totalCrudos: itemsCrudos.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas,
            antiguasDescartadas: ofertasFiltradas.antiguasDescartadas || 0,
            sinFechaConocida: ofertasFiltradas.sinFechaConocida || 0,
            motivoFinalizacion,
        });

        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de InfoJobs: ${error.message}`,
            { cause: error }
        );
    }
}

// URL base de la API REST de Adzuna.
const ADZUNA_API_BASE = 'https://api.adzuna.com/v1/api/jobs';

/**
 * Ejecuto el scraping de Adzuna usando su API REST oficial.
 *
 * Adzuna requiere dos credenciales: app_id y app_key.
 * Si AMBAS están ausentes, retorno un objeto con { deshabilitado: true }
 * para que el controlador y la automatización puedan manejarlo con gracia
 * sin lanzar un error que interrumpa el ciclo.
 * Si solo UNA está presente, lanzo un error de configuración.
 *
 * La búsqueda cubre solo España (es). Adzuna NO soporta Argentina (ar) —
 * ese country code devuelve 404.
 *
 * Se filtra por teletrabajo/a distancia en dos capas:
 *   - Capa 1 (en origen): término de búsqueda + prefijos "remote" y "teletrabajo"
 *     para que la API priorice ofertas remotas.
 *   - Capa 2 (en normalización): el normalizador descarta ofertas cuya
 *     descripción o título no contengan indicadores de trabajo a distancia.
 *
 * Se hace una pausa de 2.5 segundos entre requests para no superar
 * el límite de 25 req/min de Adzuna.
 *
 * Atribución requerida por los términos de uso de Adzuna:
 * el frontend debe mostrar "Jobs by Adzuna" junto a los resultados.
 *
 * @param {Object} opciones - Opciones de ejecución.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda personalizados.
 * @returns {Object[]|Object} Array de ofertas normalizadas, o { deshabilitado: true, ... }
 */
async function ejecutarScrapingAdzuna(opciones = {}) {
    opciones = resolverConfiguracion('adzuna', opciones).opciones;
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    // Soft-disable: si ambas credenciales faltan, avisamos sin romper el ciclo.
    if (!appId && !appKey) {
        return {
            deshabilitado: true,
            codigo_resultado: 'adzuna_deshabilitado_sin_credenciales',
            advertencia: 'Adzuna está deshabilitado: faltan ADZUNA_APP_ID y ADZUNA_APP_KEY en el .env.',
            ofertas: [],
        };
    }

    // Error de configuración parcial: solo una de las dos está presente.
    if (!appId || !appKey) {
        throw new Error(
            'Configuración incompleta de Adzuna: se requieren ADZUNA_APP_ID y ADZUNA_APP_KEY. ' +
            'Verificar el archivo .env.'
        );
    }

    // Limito a 50 como máximo porque la API gratuita tiene rate limits estrictos.
    // El cap lo garantizo acá en el servicio — no dependo del controlador.
    const maxResultados = Math.min(opciones.maxResultados || 50, 50);
    const terminos = opciones.consultasAdzuna || opciones.terminos || [];
    // Solo España — Adzuna NO soporta Argentina (ar) → devuelve 404.
    // España tiene buen volumen de ofertas en español para trabajo remoto.
    const paises = ['es'];
    let itemsCrudos = [];

    try {
        for (const pais of paises) {
            if (itemsCrudos.length >= maxResultados) break;

            for (const termino of terminos) {
                if (itemsCrudos.length >= maxResultados) break;

                // La API de Adzuna permite pedir hasta 50 resultados por página.
                // Calculo cuántos necesito aún para no pedir de más.
                const resultadosPorPagina = Math.min(maxResultados - itemsCrudos.length, 50);

                // Capa 1: agrego indicadores de trabajo remoto al término de búsqueda
                // para que la API priorice ofertas a distancia / teletrabajo.
                // Adzuna no tiene un parámetro de filtro por modalidad, así que
                // refuerzo la query con palabras clave de remoto.
                const terminoRemoto = `remote ${termino}`;
                const params = new URLSearchParams({
                    app_id: appId,
                    app_key: appKey,
                    results_per_page: String(resultadosPorPagina),
                    what: terminoRemoto,
                    'content-type': 'application/json',
                });

                const url = `${ADZUNA_API_BASE}/${pais}/search/1?${params.toString()}`;

                let respuesta;
                try {
                    respuesta = await fetch(url, {
                        headers: { 'Accept': 'application/json' },
                    });
                } catch (errorRed) {
                    console.warn(`Scraping Adzuna: error de red para "${termino}" en ${pais}. ${errorRed.message}`);
                    continue;
                }

                if (!respuesta.ok) {
                    // 401 y 429 son errores graves: credenciales inválidas o rate-limit.
                    // Lanzamos error explícito para que el caller los maneje, no los ignoramos.
                    if (respuesta.status === 401) {
                        throw new Error('Credenciales de Adzuna inválidas (401) — verificar ADZUNA_APP_ID y ADZUNA_APP_KEY.');
                    }
                    if (respuesta.status === 429) {
                        throw new Error('Rate limit de Adzuna excedido (429) — reintentar más tarde.');
                    }
                    // Errores 5xx u otros: logueo y continúo con el siguiente par.
                    console.warn(`Scraping Adzuna: error HTTP ${respuesta.status} para "${termino}" en ${pais}. Saltando.`);
                    continue;
                }

                const json = await respuesta.json();
                // La API de Adzuna devuelve los resultados en el campo `results`.
                // Agrego `_pais` a cada resultado para que el normalizador pueda
                // inferir la moneda (ar → ARS, es → EUR) sin cambiar la firma de normalizarLote.
                const resultados = (Array.isArray(json.results) ? json.results : [])
                    .map(r => ({ ...r, _pais: pais }));
                itemsCrudos = itemsCrudos.concat(resultados).slice(0, maxResultados);
                console.log(`Scraping Adzuna: ${resultados.length} ítem(s) para "${termino}" en ${pais}.`);

                // Pausa para respetar el límite de 25 req/min de la API.
                await new Promise(resolve => setTimeout(resolve, 2500));
            }
        }

        console.log(`Scraping Adzuna: ${itemsCrudos.length} ofertas crudas en total.`);

        const diasVentana = 30;
        const urlsVistas = new Set();
        const ofertasNormalizadas = normalizarLote(itemsCrudos, 'adzuna');
        let duplicadasDescartadas = 0;
        const ofertasSinDuplicados = [];
        for (const oferta of ofertasNormalizadas) {
            const urlCanonica = canonizarUrlGeneral(oferta.url);
            if (!urlCanonica || urlsVistas.has(urlCanonica)) {
                duplicadasDescartadas++;
                continue;
            }
            urlsVistas.add(urlCanonica);
            ofertasSinDuplicados.push(oferta);
        }

        const ofertasFiltradas = filtrarPorVentanaPublicacion(ofertasSinDuplicados, diasVentana);
        console.log(`Scraping Adzuna: ${ofertasNormalizadas.length} normalizadas → ${ofertasFiltradas.length} dentro de ${diasVentana} días.`);

        const resultado = ofertasFiltradas.slice(0, maxResultados);
        const motivoFinalizacion = resultado.length >= maxResultados ? 'limite_resultados' : 'agotado';

        adjuntarMetricas(resultado, {
            maxResultados,
            ventanaDias: diasVentana,
            consultasEjecutadas: paises.length * terminos.length,
            consultasOmitidas: 0,
            totalCrudos: itemsCrudos.length,
            totalElegibles: resultado.length,
            duplicadasDescartadas,
            antiguasDescartadas: ofertasFiltradas.antiguasDescartadas || 0,
            sinFechaConocida: ofertasFiltradas.sinFechaConocida || 0,
            motivoFinalizacion,
        });

        return resultado;

    } catch (error) {
        throw new Error(
            `Error al ejecutar scraping de Adzuna: ${error.message}`,
            { cause: error }
        );
    }
}

/**
 * Filtro un lote de ofertas reteniendo las que caen dentro de la ventana de publicación configurada
 * o que no tienen fecha conocida verificable.
 *
 * Reglas:
 * 1. Fechas inválidas o futuras (>24h respecto a 'ahora') se sanitizan defensivamente a null.
 * 2. Ofertas sin fecha (null) se conservan por precaución (sinFechaConocida++).
 * 3. Ofertas con fecha previa a (ahora - diasVentana) se descartan (antiguasDescartadas++).
 *
 * @param {Object[]} ofertas - Array de ofertas normalizadas.
 * @param {number} [diasVentana=30] - Días de ventana (default: 30).
 * @param {number} [ahora=Date.now()] - Timestamp de referencia para reloj controlado.
 * @returns {Object[]} Array de ofertas elegibles dentro de la ventana.
 */
function filtrarPorVentanaPublicacion(ofertas, diasVentana = 30, ahora = Date.now()) {
    const ventanaMs = diasVentana * 24 * 60 * 60 * 1000;
    const limite = ahora - ventanaMs;
    let antiguasDescartadas = 0;
    let sinFechaConocida = 0;

    const filtradas = ofertas.filter(oferta => {
        if (!oferta.fecha_publicacion) {
            sinFechaConocida++;
            return true;
        }

        const d = new Date(oferta.fecha_publicacion);
        const fechaMs = d.getTime();

        if (isNaN(fechaMs) || fechaMs > ahora + 24 * 60 * 60 * 1000) {
            oferta.fecha_publicacion = null;
            sinFechaConocida++;
            return true;
        }

        if (fechaMs < limite) {
            antiguasDescartadas++;
            return false;
        }

        return true;
    });

    Object.defineProperty(filtradas, 'antiguasDescartadas', {
        value: antiguasDescartadas,
        enumerable: false,
        configurable: true,
        writable: true,
    });
    Object.defineProperty(filtradas, 'sinFechaConocida', {
        value: sinFechaConocida,
        enumerable: false,
        configurable: true,
        writable: true,
    });
    return filtradas;
}

/**
 * Helper de compatibilidad: filtra reteniendo ofertas de los últimos 14 días.
 *
 * @param {Object[]} ofertas - Array de ofertas normalizadas.
 * @returns {Object[]} Ofertas dentro de 14 días + sin fecha.
 */
function filtrarPorUltimasDosemanas(ofertas) {
    return filtrarPorVentanaPublicacion(ofertas, 14);
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
    ejecutarScrapingRemotive,
    ejecutarScrapingRemoteOK,
    ejecutarScrapingInfojobs,
    ejecutarScrapingAdzuna,
    // Exporto los helpers para poder testearlos directamente.
    _filtrarPorUltimasDosemanas: filtrarPorUltimasDosemanas,
    _filtrarPorVentanaPublicacion: filtrarPorVentanaPublicacion,
    _normalizarUrlGetonbrd: normalizarUrlGetonbrd,
};
