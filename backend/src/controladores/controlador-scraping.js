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
    const opciones = {
        maxResultados: req.body.maxResultados || 100,
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
    const opciones = {
        maxResultados: req.body.maxResultados || 50,
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
    const opciones = {
        maxResultados: req.body.maxResultados || 100,
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

module.exports = { scrapearLinkedin, scrapearComputrabajo, scrapearIndeed, scrapearBumeran };
