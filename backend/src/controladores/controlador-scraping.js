// Controlador de scraping — maneja las requests para ejecutar el scraping.
//
// Cada endpoint dispara un scraping contra una plataforma (LinkedIn, Computrabajo,
// Indeed o Bumeran), normaliza los resultados, los guarda en la base de datos,
// y devuelve un resumen con contadores: cuántas se extrajeron, cuántas se
// guardaron, cuántas eran duplicadas.
//
// ¿Por qué el guardado está en el controlador y no en el servicio de scraping?
// Porque el servicio de scraping tiene UNA responsabilidad: extraer y normalizar datos.
// El controlador es el que orquesta el flujo completo: scrapear → guardar → responder.
// Si mañana queremos scrapear sin guardar (ej: vista previa), el servicio sigue igual.

const servicioScraping = require('../servicios/servicio-scraping');
const modeloOferta = require('../modelos/oferta');
const { PLATAFORMAS } = require('../config/plataformas');
const { resolverConfiguracion, resolverConfiguraciones, leerPreferenciasBusqueda, validarOpciones } = require('../servicios/servicio-configuracion-busqueda');
const { filtrarOfertasPorIdioma, guardarLoteOfertasAislado } = require('../servicios/servicio-ingreso-ofertas');

async function resolverIndividual(plataforma, body = {}) {
    validarOpciones(body);
    return resolverConfiguracion(plataforma, body, await leerPreferenciasBusqueda());
}

async function previsualizarBusquedas(req, res) {
    const configuraciones = await resolverConfiguraciones({}, { previsualizacion: true });
    res.json({ exito: true, datos: { plataformas: Object.values(configuraciones).map(configuracion => configuracion.resumen) } });
}

function construirRespuestaScraping({
    plataforma,
    nombre,
    ofertasNormalizadas,
    ofertasParaGuardar,
    guardadas,
    duplicadas,
    errores = 0,
    resumen,
}) {
    return {
        mensaje: `Scraping de ${nombre} completado: ${guardadas} ofertas nuevas.`,
        plataforma,
        ofertas_nuevas: guardadas,
        ofertas_duplicadas: duplicadas,
        ofertas_errores: errores,
        total_extraidas: ofertasNormalizadas.length,
        descartadas_por_idioma: ofertasNormalizadas.length - ofertasParaGuardar.length,
        maxResultados: ofertasNormalizadas.maxResultados ?? resumen?.maxResultados ?? 50,
        ventanaDias: ofertasNormalizadas.ventanaDias ?? 30,
        consultasEjecutadas: ofertasNormalizadas.consultasEjecutadas ?? 1,
        consultasOmitidas: ofertasNormalizadas.consultasOmitidas ?? 0,
        totalCrudos: ofertasNormalizadas.totalCrudos ?? ofertasNormalizadas.length,
        totalElegibles: ofertasNormalizadas.totalElegibles ?? ofertasNormalizadas.length,
        duplicadasDescartadas: ofertasNormalizadas.duplicadasDescartadas ?? 0,
        antiguasDescartadas: ofertasNormalizadas.antiguasDescartadas ?? 0,
        sinFechaConocida: ofertasNormalizadas.sinFechaConocida ?? 0,
        motivoFinalizacion: ofertasNormalizadas.motivoFinalizacion ?? 'agotado',
        configuracion: resumen,
    };
}

/**
 * POST /api/scraping/linkedin
 * Ejecuto el scraping de LinkedIn y guardo las ofertas en la BD.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 100)
 * - terminos: array de términos de búsqueda personalizados
 * - ubicacion: ubicación personalizada (default: "Argentina")
 */
async function scrapearLinkedin(req, res) {
    const { opciones, resumen } = await resolverIndividual('linkedin', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingLinkedin(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'linkedin',
            nombre: 'LinkedIn',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/computrabajo
 * Ejecuto el scraping de Computrabajo y guardo las ofertas en la BD.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 50)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearComputrabajo(req, res) {
    const { opciones, resumen } = await resolverIndividual('computrabajo', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingComputrabajo(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'computrabajo',
            nombre: 'Computrabajo',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/indeed
 * Ejecuto el scraping de Indeed Argentina y guardo las ofertas en la BD.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer por término (default: 100)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearIndeed(req, res) {
    const { opciones, resumen } = await resolverIndividual('indeed', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingIndeed(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'indeed',
            nombre: 'Indeed',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/bumeran
 * Ejecuto el scraping de Bumeran Argentina y guardo las ofertas en la BD.
 *
 * Body opcional:
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearBumeran(req, res) {
    const { opciones, resumen } = await resolverIndividual('bumeran', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingBumeran(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'bumeran',
            nombre: 'Bumeran',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/glassdoor
 * Ejecuto el scraping de Glassdoor y guardo las ofertas en la BD.
 *
 * Body opcional:
 * - maxResultados: número máximo de resultados (defecto: 50)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearGlassdoor(req, res) {
    const { opciones, resumen } = await resolverIndividual('glassdoor', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingGlassdoor(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'glassdoor',
            nombre: 'Glassdoor',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/getonbrd
 * Devuelvo el contrato bloqueado mientras el piloto permanece sin autorización.
 * No invoco cliente externo ni persisto ofertas.
 */
async function scrapearGetonbrd(req, res) {
    res.json({
        exito: true,
        datos: {
            run_id: null,
            estado: 'bloqueado',
            motivo_terminacion: 'politica_destino',
            destino: 'bloqueado',
            ofertas: [],
            checkpoint: { termino_indice: 0, termino: null, pagina_confirmada: 0, pagina_siguiente: 1 },
            metricas: {
                requests: 0, paginas: 0, recibidas: 0, normalizadas: 0, dentro_ventana: 0,
                fuera_ventana: 0, duplicadas_intra_run: 0, invalidas: 0, latencia_ms: 0,
            },
        },
    });
}

/**
 * POST /api/scraping/jooble
 * Ejecuto el scraping de Jooble usando su API REST oficial (gratuita) y guardo las ofertas en la BD.
 *
 * Jooble es un agregador mundial de empleo. Su API gratuita requiere una API key
 * que se registra en https://jooble.org/api/about y se guarda en .env como JOOBLE_API_KEY.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 50)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearJooble(req, res) {
    const { opciones, resumen } = await resolverIndividual('jooble', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingJooble(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'jooble',
            nombre: 'Jooble',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/google-jobs
 * Ejecuto el scraping de Google Jobs usando un actor de Apify y guardo las ofertas en la BD.
 *
 * Google Jobs es un agregador que indexa ofertas de múltiples portales (Computrabajo,
 * Bumeran, Indeed, etc.). Las ofertas duplicadas se descartan automáticamente por URL
 * (ON CONFLICT en la BD). El campo jobPublisher del resultado crudo indica de qué
 * portal original proviene cada oferta.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 100)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearGoogleJobs(req, res) {
    const plataforma = PLATAFORMAS.google_jobs;
    return res.json({
        exito: true,
        datos: {
            mensaje: `${plataforma.label} está desactivado. ${plataforma.motivo || 'No se realizó ninguna extracción.'}`,
            plataforma: plataforma.id,
            ofertas_nuevas: 0,
            ofertas_duplicadas: 0,
            total_extraidas: 0,
            codigo_resultado: 'PLATAFORMA_INACTIVA',
            advertencia: plataforma.motivo || 'Plataforma desactivada.',
        },
    });
}

/**
 * POST /api/scraping/remotive
 * Ejecuto el scraping de Remotive usando su API pública (gratuita, sin auth)
 * y guardo las ofertas en la BD.
 *
 * Remotive es un portal de empleo exclusivamente remoto. Las ofertas devueltas
 * siempre tendrán modalidad 'remoto'.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 50)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearRemotive(req, res) {
    const { opciones, resumen } = await resolverIndividual('remotive', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingRemotive(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'remotive',
            nombre: 'Remotive',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/remoteok
 * Ejecuto el scraping de RemoteOK usando su API pública (gratuita, sin auth)
 * y guardo las ofertas en la BD.
 *
 * RemoteOK es un portal de empleo exclusivamente remoto. Las ofertas devueltas
 * siempre tendrán modalidad 'remoto'.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 50)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearRemoteOK(req, res) {
    const { opciones, resumen } = await resolverIndividual('remoteok', req.body);
    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingRemoteOK(opciones);

    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'remoteok',
            nombre: 'RemoteOK',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

/**
 * POST /api/scraping/infojobs
 * Ejecuto el scraping de InfoJobs España usando su API REST oficial
 * y guardo las ofertas en la BD.
 *
 * InfoJobs está desactivado en el registry — no se debe invocar como plataforma activa.
 */
async function scrapearInfojobs(req, res) {
    const plataforma = PLATAFORMAS.infojobs;
    return res.json({
        exito: true,
        datos: {
            mensaje: `${plataforma.label} está desactivado. ${plataforma.motivo || 'No se realizó ninguna extracción.'}`,
            plataforma: plataforma.id,
            ofertas_nuevas: 0,
            ofertas_duplicadas: 0,
            total_extraidas: 0,
            codigo_resultado: 'PLATAFORMA_INACTIVA',
            advertencia: plataforma.motivo || 'Plataforma desactivada.',
        },
    });
}

/**
 * Ejecuta el scraping de Adzuna.
 *
 * Usa la API REST oficial de Adzuna (app_id + app_key).
 * Si las credenciales no están configuradas, el servicio retorna
 * con { deshabilitado: true, codigo_resultado, advertencia, ofertas: [] }
 * para que el frontend pueda mostrar una advertencia informativa.
 * Si solo una está presente, el servicio lanza un error de configuración.
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 50, máx: 50)
 * - terminos: array de términos de búsqueda personalizados
 *
 * Atribución: la API de Adzuna requiere mostrar "Jobs by Adzuna" en el frontend.
 */
async function scrapearAdzuna(req, res) {
    const { opciones, resumen } = await resolverIndividual('adzuna', req.body);

    const resultadoServicio = await servicioScraping.ejecutarScrapingAdzuna(opciones);

    // El servicio retorna un objeto con deshabilitado: true cuando faltan credenciales.
    if (resultadoServicio && resultadoServicio.deshabilitado === true) {
        return res.json({
            exito: true,
            datos: {
                mensaje: 'Adzuna está deshabilitado por falta de credenciales.',
                plataforma: 'adzuna',
                ofertas_nuevas: 0,
                ofertas_duplicadas: 0,
                total_extraidas: 0,
                codigo_resultado: resultadoServicio.codigo_resultado,
                configuracion: resumen,
                advertencia: resultadoServicio.advertencia,
            },
        });
    }

    const ofertasNormalizadas = resultadoServicio;
    const ofertasParaGuardar = filtrarOfertasPorIdioma(ofertasNormalizadas);
    const { guardadas, duplicadas, errores } = await guardarLoteOfertasAislado(ofertasParaGuardar, modeloOferta);

    res.json({
        exito: true,
        datos: construirRespuestaScraping({
            plataforma: 'adzuna',
            nombre: 'Adzuna',
            ofertasNormalizadas,
            ofertasParaGuardar,
            guardadas,
            duplicadas,
            errores,
            resumen,
        }),
    });
}

module.exports = {
    previsualizarBusquedas,
    scrapearLinkedin,
    scrapearComputrabajo,
    scrapearIndeed,
    scrapearBumeran,
    scrapearGlassdoor,
    scrapearGetonbrd,
    scrapearJooble,
    scrapearGoogleJobs,
    scrapearRemotive,
    scrapearRemoteOK,
    scrapearInfojobs,
    scrapearAdzuna,
};
