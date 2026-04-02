// Servicio de automatización — ejecuta scraping + evaluación periódicamente.
//
// ¿Qué es un cron job? Pensalo como una alarma programada:
// "Cada 48 horas, soná y hacé esto". En nuestro caso, la alarma dispara:
// 1. Scrapear LinkedIn, Computrabajo, Indeed y Bumeran.
// 2. Guardar las ofertas nuevas en la BD.
// 3. Evaluar las pendientes con DeepSeek.
//
// Usamos `node-cron` que implementa la sintaxis cron de Linux:
// ┌───────────── minuto (0-59)
// │ ┌───────────── hora (0-23)
// │ │ ┌───────────── día del mes (1-31)
// │ │ │ ┌───────────── mes (1-12)
// │ │ │ │ ┌───────────── día de la semana (0-7, 0 y 7 = domingo)
// │ │ │ │ │
// * * * * *
//
// '0 0 */3 * *' = "A las 00:00, cada 3 días"
//
// ¿Por qué no usar setInterval? Porque cron es más expresivo y resistente:
// - setInterval mide "cada X milisegundos desde que arrancó".
// - cron mide "a estas horas exactas del reloj".
// Si el servidor se reinicia, setInterval pierde la cuenta, cron no.

const cron = require('node-cron');
const servicioScraping = require('./servicio-scraping');
const servicioEvaluacion = require('./servicio-evaluacion');
const { detectarIdioma } = require('./servicio-normalizacion');
const modeloOferta = require('../modelos/oferta');
const modeloPreferencia = require('../modelos/preferencia');

// Expresión cron por defecto: todos los miércoles a las 8:00 AM hora Argentina (ART).
// En sintaxis cron: minuto=0, hora=8, cualquier día del mes, cualquier mes, miércoles=3.
// La timezone 'America/Argentina/Buenos_Aires' hace que el 08:00 sea exactamente
// las 8 AM en Argentina sin tener que calcular el offset UTC manualmente.
const EXPRESION_CRON_DEFECTO = '0 8 * * 3';
const TIMEZONE_CRON = 'America/Argentina/Buenos_Aires';

// Estado interno del servicio — guardo el cron activo y los resultados.
// Esto es un "singleton": un único objeto compartido por todo el proceso.
// Cuando el servidor arranca, se crea UNA vez y se mantiene en memoria.
let estado = {
    cronActivo: null,
    expresionCron: null,
    ultimaEjecucion: null,
    ultimoResultado: null,
};

// Progreso del ciclo completo — lo usa el frontend para mostrar la barra de carga.
// Se reinicia al iniciar cada ciclo y queda disponible hasta el próximo.
let progreso = {
    activo: false,
    pasos: [],
    porcentaje: 0,
};

/**
 * Retorna el progreso actual del ciclo en ejecución.
 * Si no hay ciclo activo, retorna el último estado conocido.
 *
 * @returns {Object} Estado del progreso.
 */
function obtenerProgreso() {
    return { ...progreso, pasos: progreso.pasos.map(p => ({ ...p })) };
}

/**
 * Actualizo el estado de un paso dentro del progreso actual.
 * También recalcula el porcentaje total.
 *
 * @param {string} nombre - Nombre del paso (ej: 'linkedin').
 * @param {'pendiente'|'procesando'|'completada'|'error'} nuevoEstado - Nuevo estado.
 * @param {number} [extraidas] - Ofertas extraídas (solo cuando se completa).
 */
function actualizarPasoPorgreso(nombre, nuevoEstado, extraidas) {
    const paso = progreso.pasos.find(p => p.nombre === nombre);
    if (!paso) return;
    paso.estado = nuevoEstado;
    if (extraidas !== undefined) paso.extraidas = extraidas;

    // Porcentaje: 8 plataformas × 7% = 56%, evaluación 15%, guardado 29%.
    const pesos = { linkedin: 7, computrabajo: 7, indeed: 7, bumeran: 7, glassdoor: 7, getonbrd: 7, jooble: 7, google_jobs: 7, evaluacion: 15, guardado: 29 };
    const completadas = progreso.pasos
        .filter(p => p.estado === 'completada' || p.estado === 'error')
        .reduce((acc, p) => acc + (pesos[p.nombre] || 0), 0);
    progreso.porcentaje = Math.min(Math.round(completadas), 100);
}

/**
 * Ejecuto un ciclo completo de scraping + guardado + evaluación.
 *
 * Este es el "corazón" de la automatización. Se llama cada vez que el cron
 * dispara, o manualmente desde la API.
 *
 * Diseño resiliente: si una plataforma falla, sigo con la otra.
 * Si la evaluación falla, el scraping ya se guardó igual.
 * Nunca un error parcial tira abajo todo el ciclo.
 *
 * @returns {Object} Resumen completo del ciclo ejecutado.
 */
async function ejecutarCicloCompleto() {
    console.log('[Automatización] Iniciando ciclo completo...');
    const inicio = new Date();

    // Inicializo el progreso para este ciclo.
    progreso = {
        activo: true,
        pasos: [
            { nombre: 'linkedin', label: 'LinkedIn', estado: 'pendiente', extraidas: 0 },
            { nombre: 'computrabajo', label: 'Computrabajo', estado: 'pendiente', extraidas: 0 },
            { nombre: 'indeed', label: 'Indeed', estado: 'pendiente', extraidas: 0 },
            { nombre: 'bumeran', label: 'Bumeran', estado: 'pendiente', extraidas: 0 },
            { nombre: 'glassdoor', label: 'Glassdoor', estado: 'pendiente', extraidas: 0 },
            { nombre: 'getonbrd', label: 'GetOnBrd', estado: 'pendiente', extraidas: 0 },
            { nombre: 'jooble', label: 'Jooble', estado: 'pendiente', extraidas: 0 },
            { nombre: 'google_jobs', label: 'Google Jobs', estado: 'pendiente', extraidas: 0 },
            { nombre: 'guardado', label: 'Guardando en BD', estado: 'pendiente', extraidas: 0 },
            { nombre: 'evaluacion', label: 'Evaluación IA', estado: 'pendiente', extraidas: 0 },
        ],
        porcentaje: 0,
    };

    // Leo las preferencias UNA vez al inicio del ciclo.
    // Si hay términos de búsqueda configurados, los uso; si no, los scrapers
    // usan sus defaults internos (TERMINOS_BUSQUEDA_DEFECTO).
    let terminosBusqueda;
    try {
        const prefs = await modeloPreferencia.obtenerPreferencias();
        if (prefs && prefs.terminos_busqueda && prefs.terminos_busqueda.length > 0) {
            terminosBusqueda = prefs.terminos_busqueda;
            console.log(`[Automatización] Usando ${terminosBusqueda.length} términos de búsqueda de preferencias.`);
        }
    } catch (error) {
        console.error(`[Automatización] Error al leer preferencias, usando defaults: ${error.message}`);
    }

    // Opciones de scraping con los términos dinámicos.
    const opcionesScraping = terminosBusqueda ? { terminos: terminosBusqueda } : {};

    const resultado = {
        exito: true,
        scraping: {
            linkedin: 0,
            computrabajo: 0,
            indeed: 0,
            bumeran: 0,
            glassdoor: 0,
            getonbrd: 0,
            jooble: 0,
            google_jobs: 0,
            totalExtraidas: 0,
            guardadas: 0,
        },
        evaluacion: null,
        errores: [],
    };

    // --- Paso 1: Scraping de LinkedIn ---
    let ofertasLinkedin = [];
    actualizarPasoPorgreso('linkedin', 'procesando');
    try {
        ofertasLinkedin = await servicioScraping.ejecutarScrapingLinkedin(opcionesScraping);
        resultado.scraping.linkedin = ofertasLinkedin.length;
        actualizarPasoPorgreso('linkedin', 'completada', ofertasLinkedin.length);
        console.log(`[Automatización] LinkedIn: ${ofertasLinkedin.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('linkedin', 'error', 0);
        resultado.errores.push(`Error en scraping de LinkedIn: ${error.message}`);
        console.error(`[Automatización] Error en LinkedIn: ${error.message}`);
    }

    // --- Paso 2: Scraping de Computrabajo ---
    let ofertasComputrabajo = [];
    actualizarPasoPorgreso('computrabajo', 'procesando');
    try {
        ofertasComputrabajo = await servicioScraping.ejecutarScrapingComputrabajo(opcionesScraping);
        resultado.scraping.computrabajo = ofertasComputrabajo.length;
        actualizarPasoPorgreso('computrabajo', 'completada', ofertasComputrabajo.length);
        console.log(`[Automatización] Computrabajo: ${ofertasComputrabajo.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('computrabajo', 'error', 0);
        resultado.errores.push(`Error en scraping de Computrabajo: ${error.message}`);
        console.error(`[Automatización] Error en Computrabajo: ${error.message}`);
    }

    // --- Paso 3: Scraping de Indeed ---
    let ofertasIndeed = [];
    actualizarPasoPorgreso('indeed', 'procesando');
    try {
        ofertasIndeed = await servicioScraping.ejecutarScrapingIndeed(opcionesScraping);
        resultado.scraping.indeed = ofertasIndeed.length;
        actualizarPasoPorgreso('indeed', 'completada', ofertasIndeed.length);
        console.log(`[Automatización] Indeed: ${ofertasIndeed.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('indeed', 'error', 0);
        resultado.errores.push(`Error en scraping de Indeed: ${error.message}`);
        console.error(`[Automatización] Error en Indeed: ${error.message}`);
    }

    // --- Paso 4: Scraping de Bumeran ---
    let ofertasBumeran = [];
    actualizarPasoPorgreso('bumeran', 'procesando');
    try {
        ofertasBumeran = await servicioScraping.ejecutarScrapingBumeran(opcionesScraping);
        resultado.scraping.bumeran = ofertasBumeran.length;
        actualizarPasoPorgreso('bumeran', 'completada', ofertasBumeran.length);
        console.log(`[Automatización] Bumeran: ${ofertasBumeran.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('bumeran', 'error', 0);
        resultado.errores.push(`Error en scraping de Bumeran: ${error.message}`);
        console.error(`[Automatización] Error en Bumeran: ${error.message}`);
    }

    // --- Paso 5: Scraping de Glassdoor ---
    let ofertasGlassdoor = [];
    actualizarPasoPorgreso('glassdoor', 'procesando');
    try {
        ofertasGlassdoor = await servicioScraping.ejecutarScrapingGlassdoor(opcionesScraping);
        resultado.scraping.glassdoor = ofertasGlassdoor.length;
        actualizarPasoPorgreso('glassdoor', 'completada', ofertasGlassdoor.length);
        console.log(`[Automatización] Glassdoor: ${ofertasGlassdoor.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('glassdoor', 'error', 0);
        resultado.errores.push(`Error en scraping de Glassdoor: ${error.message}`);
        console.error(`[Automatización] Error en Glassdoor: ${error.message}`);
    }

    // --- Paso 6: Scraping de GetOnBrd (API pública gratuita, sin Apify) ---
    let ofertasGetonbrd = [];
    actualizarPasoPorgreso('getonbrd', 'procesando');
    try {
        ofertasGetonbrd = await servicioScraping.ejecutarScrapingGetonbrd(opcionesScraping);
        resultado.scraping.getonbrd = ofertasGetonbrd.length;
        actualizarPasoPorgreso('getonbrd', 'completada', ofertasGetonbrd.length);
        console.log(`[Automatización] GetOnBrd: ${ofertasGetonbrd.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('getonbrd', 'error', 0);
        resultado.errores.push(`Error en scraping de GetOnBrd: ${error.message}`);
        console.error(`[Automatización] Error en GetOnBrd: ${error.message}`);
    }

    // --- Paso 7: Scraping de Jooble (API REST oficial gratuita, requiere API key) ---
    let ofertasJooble = [];
    actualizarPasoPorgreso('jooble', 'procesando');
    try {
        ofertasJooble = await servicioScraping.ejecutarScrapingJooble(opcionesScraping);
        resultado.scraping.jooble = ofertasJooble.length;
        actualizarPasoPorgreso('jooble', 'completada', ofertasJooble.length);
        console.log(`[Automatización] Jooble: ${ofertasJooble.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('jooble', 'error', 0);
        resultado.errores.push(`Error en scraping de Jooble: ${error.message}`);
        console.error(`[Automatización] Error en Jooble: ${error.message}`);
    }

    // --- Paso 8: Scraping de Google Jobs (actor de Apify, agregador multi-portal) ---
    let ofertasGoogleJobs = [];
    actualizarPasoPorgreso('google_jobs', 'procesando');
    try {
        ofertasGoogleJobs = await servicioScraping.ejecutarScrapingGoogleJobs(opcionesScraping);
        resultado.scraping.google_jobs = ofertasGoogleJobs.length;
        actualizarPasoPorgreso('google_jobs', 'completada', ofertasGoogleJobs.length);
        console.log(`[Automatización] Google Jobs: ${ofertasGoogleJobs.length} ofertas extraídas.`);
    } catch (error) {
        actualizarPasoPorgreso('google_jobs', 'error', 0);
        resultado.errores.push(`Error en scraping de Google Jobs: ${error.message}`);
        console.error(`[Automatización] Error en Google Jobs: ${error.message}`);
    }

    // --- Paso 9: Guardar ofertas en la BD ---
    const todasLasOfertas = [...ofertasLinkedin, ...ofertasComputrabajo, ...ofertasIndeed, ...ofertasBumeran, ...ofertasGlassdoor, ...ofertasGetonbrd, ...ofertasJooble, ...ofertasGoogleJobs];
    resultado.scraping.totalExtraidas = todasLasOfertas.length;

    // Filtro de idioma: descarto ofertas claramente en inglés antes de guardar.
    // Aplica a todas las plataformas. Jooble en particular trae resultados globales
    // (USA, UK) que no aplican porque el perfil del usuario no habla inglés.
    const ofertasFiltradas = todasLasOfertas.filter((oferta) => {
        if (detectarIdioma(oferta.titulo, oferta.descripcion) === 'en') {
            console.log(`[Automatización] Descartando por idioma inglés: "${oferta.titulo}" (${oferta.plataforma})`);
            return false;
        }
        return true;
    });
    const descartadasPorIdioma = todasLasOfertas.length - ofertasFiltradas.length;
    if (descartadasPorIdioma > 0) {
        console.log(`[Automatización] ${descartadasPorIdioma} ofertas descartadas por estar en inglés.`);
    }

    actualizarPasoPorgreso('guardado', 'procesando');

    for (const oferta of ofertasFiltradas) {
        try {
            const insertada = await modeloOferta.crearOferta(oferta);
            // crearOferta retorna null si la URL ya existía (deduplicación).
            if (insertada !== null) {
                resultado.scraping.guardadas++;
            }
        } catch (error) {
            console.error(`[Automatización] Error al guardar oferta: ${error.message}`);
        }
    }

    actualizarPasoPorgreso('guardado', 'completada', resultado.scraping.guardadas);
    console.log(`[Automatización] ${resultado.scraping.guardadas} ofertas nuevas guardadas de ${resultado.scraping.totalExtraidas} extraídas.`);

    // --- Paso 10: Evaluar ofertas pendientes ---
    actualizarPasoPorgreso('evaluacion', 'procesando');
    try {
        resultado.evaluacion = await servicioEvaluacion.evaluarOfertasPendientes();
        actualizarPasoPorgreso('evaluacion', 'completada', resultado.evaluacion.aprobadas);
        console.log(`[Automatización] Evaluación: ${resultado.evaluacion.aprobadas} aprobadas, ${resultado.evaluacion.rechazadas} rechazadas.`);
    } catch (error) {
        actualizarPasoPorgreso('evaluacion', 'error', 0);
        resultado.errores.push(`Error en evaluación: ${error.message}`);
        console.error(`[Automatización] Error en evaluación: ${error.message}`);
    }

    // --- Registro del resultado ---
    const fin = new Date();
    const duracion = (fin - inicio) / 1000; // en segundos
    console.log(`[Automatización] Ciclo completo en ${duracion}s. Errores: ${resultado.errores.length}`);

    progreso.activo = false;
    progreso.porcentaje = 100;
    estado.ultimaEjecucion = inicio.toISOString();
    estado.ultimoResultado = resultado;

    return resultado;
}

/**
 * Programo la ejecución periódica del ciclo completo.
 *
 * @param {Object} opciones - Opciones de configuración.
 * @param {string} [opciones.expresionCron='0 * /12 * * *'] - Expresión cron.
 * @returns {Object} Controlador con método detener().
 */
function programarCron(opciones = {}) {
    const expresion = opciones.expresionCron || EXPRESION_CRON_DEFECTO;

    // Valido que la expresión cron sea sintácticamente correcta.
    if (!cron.validate(expresion)) {
        throw new Error(`Expresión cron inválida: "${expresion}"`);
    }

    // Si ya hay un cron corriendo, lo detengo antes de programar uno nuevo.
    if (estado.cronActivo) {
        estado.cronActivo.stop();
    }

    console.log(`[Automatización] Programando cron: "${expresion}" (timezone: ${TIMEZONE_CRON})`);

    // cron.schedule() acepta la expresión, un callback y opciones.
    // La opción `timezone` hace que node-cron interprete la hora en ART
    // en vez de UTC. Sin esto, las 08:00 serían las 5 AM Argentina.
    const tarea = cron.schedule(expresion, async () => {
        console.log(`[Automatización] Cron disparado a las ${new Date().toISOString()}`);
        try {
            await ejecutarCicloCompleto();
        } catch (error) {
            // Un error inesperado no debe matar el cron.
            // Lo logeo y el cron sigue programado para la siguiente ejecución.
            console.error(`[Automatización] Error fatal en ciclo: ${error.message}`);
        }
    }, { timezone: TIMEZONE_CRON });

    estado.cronActivo = tarea;
    estado.expresionCron = expresion;

    return {
        detener: () => {
            tarea.stop();
            estado.cronActivo = null;
            estado.expresionCron = null;
            console.log('[Automatización] Cron detenido.');
        },
    };
}

/**
 * Obtengo el estado actual del servicio de automatización.
 *
 * Útil para el frontend: mostrar si el cron está activo,
 * cuándo fue la última ejecución, y qué resultado dio.
 *
 * @returns {Object} Estado actual.
 */
function obtenerEstado() {
    return {
        activo: estado.cronActivo !== null,
        expresionCron: estado.expresionCron,
        ultimaEjecucion: estado.ultimaEjecucion,
        ultimoResultado: estado.ultimoResultado,
    };
}

/**
 * Detengo el cron activo desde fuera del controlador de programarCron.
 * Necesario para que la API pueda detener el cron sin tener la referencia
 * devuelta por programarCron().
 */
function detenerCron() {
    if (estado.cronActivo) {
        estado.cronActivo.stop();
        estado.cronActivo = null;
        estado.expresionCron = null;
        console.log('[Automatización] Cron detenido.');
    }
}

/**
 * Reseteo el estado interno — SOLO para tests.
 * En producción no se usa, pero los tests necesitan arrancar de cero.
 * El guión bajo al inicio (_) es una convención que indica "uso interno".
 */
function _resetearEstado() {
    if (estado.cronActivo) {
        estado.cronActivo.stop();
    }
    estado = {
        cronActivo: null,
        expresionCron: null,
        ultimaEjecucion: null,
        ultimoResultado: null,
    };
    progreso = {
        activo: false,
        pasos: [],
        porcentaje: 0,
    };
}

module.exports = {
    ejecutarCicloCompleto,
    programarCron,
    detenerCron,
    obtenerEstado,
    obtenerProgreso,
    _resetearEstado,
};
