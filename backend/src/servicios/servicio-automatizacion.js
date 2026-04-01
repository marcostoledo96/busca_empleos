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
// '0 0 */2 * *' = "A las 00:00, cada 2 días"
//
// ¿Por qué no usar setInterval? Porque cron es más expresivo y resistente:
// - setInterval mide "cada X milisegundos desde que arrancó".
// - cron mide "a estas horas exactas del reloj".
// Si el servidor se reinicia, setInterval pierde la cuenta, cron no.

const cron = require('node-cron');
const servicioScraping = require('./servicio-scraping');
const servicioEvaluacion = require('./servicio-evaluacion');
const modeloOferta = require('../modelos/oferta');
const modeloPreferencia = require('../modelos/preferencia');

// Expresión cron por defecto: cada 48 horas (a las 00:00 cada 2 días).
// Con 4 plataformas, ejecutar cada 48h ahorra créditos de Apify.
const EXPRESION_CRON_DEFECTO = '0 0 */2 * *';

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

    // Porcentaje: scraping = 80% (20% cada plataforma), evaluación = 20%.
    const pesos = { linkedin: 16, computrabajo: 16, indeed: 16, bumeran: 16, evaluacion: 16, guardado: 20 };
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

    // --- Paso 5: Guardar ofertas en la BD ---
    const todasLasOfertas = [...ofertasLinkedin, ...ofertasComputrabajo, ...ofertasIndeed, ...ofertasBumeran];
    resultado.scraping.totalExtraidas = todasLasOfertas.length;
    actualizarPasoPorgreso('guardado', 'procesando');

    for (const oferta of todasLasOfertas) {
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

    // --- Paso 6: Evaluar ofertas pendientes ---
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

    console.log(`[Automatización] Programando cron: "${expresion}"`);

    // cron.schedule() acepta la expresión y un callback.
    // Cada vez que "suena la alarma", ejecuta el callback.
    const tarea = cron.schedule(expresion, async () => {
        console.log(`[Automatización] Cron disparado a las ${new Date().toISOString()}`);
        try {
            await ejecutarCicloCompleto();
        } catch (error) {
            // Un error inesperado no debe matar el cron.
            // Lo logeo y el cron sigue programado para la siguiente ejecución.
            console.error(`[Automatización] Error fatal en ciclo: ${error.message}`);
        }
    });

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
