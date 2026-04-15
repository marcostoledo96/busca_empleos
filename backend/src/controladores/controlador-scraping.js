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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 100, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
        ubicacion: req.body.ubicacion,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingLinkedin(opciones);

    // Guardo cada oferta en la BD. crearOferta retorna null si es duplicada.
    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de LinkedIn completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'linkedin',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 50, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingComputrabajo(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Computrabajo completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'computrabajo',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 100, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingIndeed(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Indeed completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'indeed',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
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
    const opciones = {
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingBumeran(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Bumeran completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'bumeran',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 50, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingGlassdoor(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Glassdoor completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'glassdoor',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
    });
}

/**
 * POST /api/scraping/getonbrd
 * Ejecuto el scraping de GetOnBrd usando su API pública y guardo las ofertas en la BD.
 *
 * A diferencia de los otros endpoints, este no usa Apify: llama directo a la API
 * REST de GetOnBrd (gratuita, sin autenticación).
 *
 * Body opcional:
 * - maxResultados: número máximo de ofertas a extraer (default: 50)
 * - terminos: array de términos de búsqueda personalizados
 */
async function scrapearGetonbrd(req, res) {
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 50, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingGetonbrd(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de GetOnBrd completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'getonbrd',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 50, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingJooble(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Jooble completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'jooble',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 100, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingGoogleJobs(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Google Jobs completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'google_jobs',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 50, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingRemotive(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de Remotive completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'remotive',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
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
    const maxResultados = Math.min(parseInt(req.body.maxResultados, 10) || 50, 500);
    const opciones = {
        maxResultados,
        terminos: req.body.terminos,
    };

    const ofertasNormalizadas = await servicioScraping.ejecutarScrapingRemoteOK(opciones);

    let guardadas = 0;
    let duplicadas = 0;

    for (const oferta of ofertasNormalizadas) {
        const resultado = await modeloOferta.crearOferta(oferta);
        if (resultado) guardadas++;
        else duplicadas++;
    }

    res.json({
        exito: true,
        datos: {
            mensaje: `Scraping de RemoteOK completado: ${guardadas} ofertas nuevas.`,
            plataforma: 'remoteok',
            ofertas_nuevas: guardadas,
            ofertas_duplicadas: duplicadas,
            total_extraidas: ofertasNormalizadas.length,
        },
    });
}

module.exports = { scrapearLinkedin, scrapearComputrabajo, scrapearIndeed, scrapearBumeran, scrapearGlassdoor, scrapearGetonbrd, scrapearJooble, scrapearGoogleJobs, scrapearRemotive, scrapearRemoteOK };
