// Configuración del cliente de Apify y constantes de los actores de scraping.
//
// ¿Qué es Apify? Es una plataforma en la nube que ejecuta "Actores" (scripts
// de scraping) por nosotros. En vez de hacer scraping directo desde nuestra PC
// (y arriesgarnos a que nos bloqueen la IP), le mandamos la orden a Apify,
// sus servidores hacen el scraping, y nosotros recibimos los resultados limpios.
//
// ¿Qué es un Actor? Es como un robot especializado: le das instrucciones
// (ej: "buscá ofertas de frontend en Argentina") y te devuelve los datos
// estructurados en JSON.

const { ApifyClient } = require('apify-client');
const path = require('path');

// Cargo las variables de entorno (el token de Apify está en .env).
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Creo el cliente de Apify con el token de autenticación.
// Este cliente se reutiliza para todas las llamadas a la API.
const clienteApify = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// IDs de los Actores que vamos a usar.
// Cada Actor tiene un ID único en la plataforma de Apify.
const ACTORES = {
    // curious_coder/linkedin-jobs-scraper — Rating 4.9, 38K usuarios.
    // Recibe URLs de búsqueda de LinkedIn y devuelve ofertas con detalles.
    // Costo: $0.001 por resultado (~$1 por 1000 ofertas).
    LINKEDIN: 'hKByXkMQaC5Qt9UMN',

    // shahidirfan/Computrabajo-Jobs-Scraper — GRATIS.
    // Scrapea ofertas de Computrabajo Argentina.
    COMPUTRABAJO: '270QqNecZlrnDMveb',

    // valig/indeed-jobs-scraper — Rating 5.0, 3.1K usuarios.
    // Recibe keywords + país y devuelve ofertas de Indeed.
    // Costo: $0.08 por 1000 resultados.
    INDEED: 'TrtlecxAsNRbKl1na',

    // apify/web-scraper — Actor genérico GRATIS (solo compute units).
    // Lo uso para Bumeran porque no existe un actor dedicado.
    // Usa Puppeteer (Chrome headless) para renderizar SPAs como Bumeran
    // (que es React) y ejecuta una pageFunction con jQuery sobre el DOM renderizado.
    BUMERAN_WEB: 'apify/web-scraper',
};

// Términos de búsqueda por defecto.
// Se usan como fallback si no hay preferencias guardadas en la BD.
// Cuando el usuario configura sus propios términos en la página de
// preferencias, esos reemplazan a estos.
const TERMINOS_BUSQUEDA_DEFECTO = [
    'qa tester',
    'soporte it',
    'desarrollador junior c#',
    'frontend developer angular',
    'full stack node',
];

// LinkedIn usa filtros de nivel de experiencia en la URL.
// f_E=1 → Internship, f_E=2 → Entry level.
// Los combinamos con coma: f_E=1%2C2 (Internship + Entry level).
const NIVELES_EXPERIENCIA_LINKEDIN = '1%2C2';

/**
 * Construyo las URLs de búsqueda de LinkedIn a partir de los términos.
 *
 * ¿Por qué URLs y no keywords directos? Porque el Actor de LinkedIn
 * recibe URLs de la página pública de búsqueda (la que ves en incógnito).
 * Eso nos permite usar TODOS los filtros de LinkedIn (nivel, ubicación, etc.)
 * directamente en la URL.
 *
 * @param {Object} opciones - Opciones de búsqueda.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda.
 * @param {string} [opciones.ubicacion] - Ubicación (ej: "Argentina").
 * @returns {string[]} Array de URLs de búsqueda de LinkedIn.
 */
function construirUrlsLinkedin(opciones = {}) {
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;
    const ubicacion = opciones.ubicacion || 'Argentina';

    return terminos.map(termino => {
        // Reemplazo espacios por + para la URL.
        const terminoEncoded = encodeURIComponent(termino).replace(/%20/g, '+');
        const ubicacionEncoded = encodeURIComponent(ubicacion).replace(/%20/g, '+');

        return `https://www.linkedin.com/jobs/search/?keywords=${terminoEncoded}&location=${ubicacionEncoded}&f_E=${NIVELES_EXPERIENCIA_LINKEDIN}`;
    });
}

/**
 * Construyo las URLs de búsqueda de Computrabajo Argentina.
 *
 * Computrabajo usa un formato de URL más simple:
 * https://www.computrabajo.com.ar/trabajo-de-{termino}
 *
 * @param {Object} opciones - Opciones de búsqueda.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda.
 * @returns {string[]} Array de URLs de búsqueda de Computrabajo.
 */
function construirUrlsComputrabajo(opciones = {}) {
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    return terminos.map(termino => {
        // Computrabajo usa guiones en vez de espacios en la URL.
        const terminoFormateado = termino.toLowerCase().replace(/\s+/g, '-');
        return `https://www.computrabajo.com.ar/trabajo-de-${terminoFormateado}`;
    });
}

/**
 * Construyo las URLs de búsqueda de Bumeran Argentina.
 *
 * Bumeran (que también cubre ZonaJobs, porque son del mismo grupo Jobint)
 * usa un formato de URL simple para las búsquedas:
 * https://www.bumeran.com.ar/empleos-busqueda-{termino}.html
 *
 * Los espacios se reemplazan por guiones en la URL.
 *
 * @param {Object} opciones - Opciones de búsqueda.
 * @param {string[]} [opciones.terminos] - Términos de búsqueda.
 * @returns {string[]} Array de URLs de búsqueda de Bumeran.
 */
function construirUrlsBumeran(opciones = {}) {
    const terminos = opciones.terminos || TERMINOS_BUSQUEDA_DEFECTO;

    return terminos.map(termino => {
        // Elimino caracteres especiales (ej: "#" de "c#") que rompen la URL
        // porque el navegador los interpreta como fragmento hash.
        // Solo dejo letras, espacios y caracteres del español.
        const terminoLimpio = termino.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, '').trim();
        const terminoFormateado = terminoLimpio.replace(/\s+/g, '-');
        return `https://www.bumeran.com.ar/empleos-busqueda-${terminoFormateado}.html`;
    });
}

module.exports = {
    clienteApify,
    ACTORES,
    TERMINOS_BUSQUEDA_DEFECTO,
    construirUrlsLinkedin,
    construirUrlsComputrabajo,
    construirUrlsBumeran,
};
