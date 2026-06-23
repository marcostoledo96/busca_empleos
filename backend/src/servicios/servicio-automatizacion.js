// Servicio de automatización — ejecuta scraping + evaluación periódicamente.
//
// ¿Qué es un cron job? Pensalo como una alarma programada:
// "Cada martes a las 20:00, soná y hacé esto". En nuestro caso, la alarma dispara:
// 1. Scrapear las plataformas activas definidas en el registry.
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
//
// Arquitectura registry-driven:
// Las plataformas se iteran desde PLATAFORMAS_ACTIVAS (fuente de verdad en config/plataformas.js).
// Los scrapers se vinculan por id en el mapa local SCRAPERS.
// Las inactivas aparecen en el resultado con 0 ofertas pero nunca se invocan.
// Los pesos de progreso se calculan dinámicamente según la cantidad de plataformas activas.

const cron = require('node-cron');
const servicioScraping = require('./servicio-scraping');
const servicioEvaluacion = require('./servicio-evaluacion');
const { detectarIdioma } = require('./servicio-normalizacion');
const modeloOferta = require('../modelos/oferta');
const modeloPreferencia = require('../modelos/preferencia');
const servicioNotificacionEmail = require('./servicio-notificacion-email');
const { PLATAFORMAS_ACTIVAS, PLATAFORMAS, esPlataformaActiva } = require('../config/plataformas');

// ── Mapa local de scrapers: vincula cada id de plataforma con su función ──
// No está en config/plataformas.js porque eso crearía una dependencia circular
// entre config y servicios. Este mapa es la "pista de ejecución" del servicio.
const SCRAPERS = {
    linkedin: servicioScraping.ejecutarScrapingLinkedin,
    computrabajo: servicioScraping.ejecutarScrapingComputrabajo,
    indeed: servicioScraping.ejecutarScrapingIndeed,
    bumeran: servicioScraping.ejecutarScrapingBumeran,
    glassdoor: servicioScraping.ejecutarScrapingGlassdoor,
    getonbrd: servicioScraping.ejecutarScrapingGetonbrd,
    jooble: servicioScraping.ejecutarScrapingJooble,
    remotive: servicioScraping.ejecutarScrapingRemotive,
    remoteok: servicioScraping.ejecutarScrapingRemoteOK,
    adzuna: servicioScraping.ejecutarScrapingAdzuna,
};

// Expresión cron por defecto: todos los martes a las 20:00 (8 PM) hora Argentina (ART).
const EXPRESION_CRON_DEFECTO = '0 20 * * 2';
const TIMEZONE_CRON = 'America/Argentina/Buenos_Aires';

// ── Pesos fijos para pasos que no son scraping ──
// Evaluación consume más tiempo (llamadas a DeepSeek), por eso tiene peso mayor.
// Guardado es rápido (inserts en BD), peso mínimo.
const PESO_EVALUACION = 15;
const PESO_GUARDADO = 3;
// El porcentaje restante (100 - 15 - 3 = 82) se reparte entre las plataformas activas.
const PESO_SCRAPING_TOTAL = 100 - PESO_EVALUACION - PESO_GUARDADO;

// Estado interno del servicio — guardo el cron activo y los resultados.
// Esto es un "singleton": un único objeto compartido por todo el proceso.
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
 * Armo los pasos de progreso derivándolos del registry.
 * Incluye plataformas activas (pendientes), inactivas (completadas en 0),
 * guardado y evaluación.
 *
 * @returns {Array<{nombre: string, label: string, estado: string, extraidas: number}>}
 */
function armarPasosProgreso() {
    const pasos = [];

    // Plataformas activas: empiezan como pendientes.
    for (const plataforma of PLATAFORMAS_ACTIVAS) {
        pasos.push({
            nombre: plataforma.id,
            label: plataforma.label,
            estado: 'pendiente',
            extraidas: 0,
        });
    }

    // Plataformas inactivas: aparecen como completadas en 0.
    // No se invoca el scraper — solo se muestran en la UI para transparencia.
    for (const [id, plataforma] of Object.entries(PLATAFORMAS)) {
        if (!plataforma.activa) {
            pasos.push({
                nombre: id,
                label: plataforma.label,
                estado: 'pendiente',
                extraidas: 0,
            });
        }
    }

    // Pasos fijos (no son scraping).
    pasos.push(
        { nombre: 'guardado', label: 'Guardando en BD', estado: 'pendiente', extraidas: 0 },
        { nombre: 'evaluacion', label: 'Evaluación IA', estado: 'pendiente', extraidas: 0 },
    );

    return pasos;
}

/**
 * Calculo los pesos dinámicos de progreso según la cantidad de plataformas activas.
 * El scraping reparte el porcentaje restante entre las activas.
 * Las inactivas tienen peso 0 porque se completan al instante.
 *
 * @returns {Object} Mapa nombre → peso numérico.
 */
function armarPesosDinamicos() {
    const pesos = {};

    // Plataformas activas: reparten el porcentaje de scraping equitativamente.
    const pesoPorActiva = PLATAFORMAS_ACTIVAS.length > 0
        ? PESO_SCRAPING_TOTAL / PLATAFORMAS_ACTIVAS.length
        : 0;

    for (const plataforma of PLATAFORMAS_ACTIVAS) {
        pesos[plataforma.id] = pesoPorActiva;
    }

    // Plataformas inactivas: peso 0 (no consumen tiempo de scraping).
    for (const [id, plataforma] of Object.entries(PLATAFORMAS)) {
        if (!plataforma.activa) {
            pesos[id] = 0;
        }
    }

    // Pasos fijos.
    pesos.guardado = PESO_GUARDADO;
    pesos.evaluacion = PESO_EVALUACION;

    return pesos;
}

/**
 * Inicializo el objeto resultado.scraping derivándolo del registry.
 * Cada plataforma (activa o inactiva) arranca en 0.
 * Se agregan los campos de totales.
 *
 * @returns {Object} Objeto resultado.scraping con claves por plataforma y totales.
 */
function inicializarResultadoScraping() {
    const resultado = {};

    // Una clave por cada plataforma del registry, valor inicial 0.
    for (const id of Object.keys(PLATAFORMAS)) {
        resultado[id] = 0;
    }

    // Totales.
    resultado.totalExtraidas = 0;
    resultado.guardadas = 0;
    resultado.descartadasPorIdioma = 0;

    return resultado;
}

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
 * También recalcula el porcentaje total usando pesos dinámicos.
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

    // Calculo pesos dinámicos según la cantidad de plataformas activas.
    const pesos = armarPesosDinamicos();
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
 * Arquitectura registry-driven: las plataformas se iteran desde PLATAFORMAS_ACTIVAS,
 * no desde bloques hardcodeados. Las inactivas se registran con 0 sin invocar scraper.
 *
 * @returns {Object} Resumen completo del ciclo ejecutado.
 */
async function ejecutarCicloCompleto() {
    console.log('[Automatización] Iniciando ciclo completo...');
    const inicio = new Date();

    // Inicializo el progreso derivándolo del registry.
    progreso = {
        activo: true,
        pasos: armarPasosProgreso(),
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
        scraping: inicializarResultadoScraping(),
        evaluacion: null,
        errores: [],
        erroresGuardado: 0,  // Contador de ofertas que fallaron al guardar en BD.
    };

    // ── Paso 1: Scraping de plataformas activas ──
    // Itero solo las activas. Las inactivas ya están en progreso como pendientes.
    let todasLasOfertas = [];

    for (const plataforma of PLATAFORMAS_ACTIVAS) {
        const { id, label } = plataforma;
        actualizarPasoPorgreso(id, 'procesando');

        // Busco la función de scraping correspondiente.
        const scraperFn = SCRAPERS[id];

        if (!scraperFn) {
            // Si no hay scraper para una plataforma activa, reporto el error
            // y sigo con la siguiente. No debe crashear el ciclo.
            actualizarPasoPorgreso(id, 'error', 0);
            resultado.errores.push(`No se encontró scraper para ${label} (id: ${id})`);
            console.error(`[Automatización] No se encontró scraper para ${label} (id: ${id})`);
            continue;
        }

        try {
            const scraperResultado = await scraperFn(opcionesScraping);

            // Caso especial: scraper deshabilitado (ej: Adzuna sin credenciales).
            // Retorna { deshabilitado: true, ... } en vez de un array de ofertas.
            if (scraperResultado && typeof scraperResultado === 'object' && scraperResultado.deshabilitado === true) {
                resultado.scraping[id] = 0;
                actualizarPasoPorgreso(id, 'completada', 0);
                console.log(`[Automatización] ${label}: ${scraperResultado.advertencia || 'deshabilitado'}, 0 ofertas.`);
                continue;
            }

            // Resultado normal: array de ofertas.
            const ofertas = Array.isArray(scraperResultado) ? scraperResultado : [];
            resultado.scraping[id] = ofertas.length;
            todasLasOfertas.push(...ofertas);
            actualizarPasoPorgreso(id, 'completada', ofertas.length);
            console.log(`[Automatización] ${label}: ${ofertas.length} ofertas extraídas.`);
        } catch (error) {
            actualizarPasoPorgreso(id, 'error', 0);
            resultado.errores.push(`Error en scraping de ${label}: ${error.message}`);
            console.error(`[Automatización] Error en ${label}: ${error.message}`);
        }
    }

    // ── Paso 2: Plataformas inactivas ──
    // Google Jobs, InfoJobs y cualquier otra desactivada: se registran con 0
    // y se marcan completadas sin invocar el scraper.
    for (const [id, plataforma] of Object.entries(PLATAFORMAS)) {
        if (!plataforma.activa) {
            resultado.scraping[id] = 0;
            actualizarPasoPorgreso(id, 'completada', 0);
            console.log(`[Automatización] ${plataforma.label}: desactivado (${plataforma.motivo}), 0 ofertas.`);
        }
    }

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

    // ── Paso 3: Guardar ofertas en la BD ──
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
            resultado.erroresGuardado++;
            resultado.errores.push(`Error al guardar oferta "${oferta.titulo || 'sin título'}": ${error.message}`);
        }
    }

    actualizarPasoPorgreso('guardado', 'completada', resultado.scraping.guardadas);
    console.log(`[Automatización] ${resultado.scraping.guardadas} ofertas nuevas guardadas de ${resultado.scraping.totalExtraidas} extraídas.`);

    // ── Paso 4: Evaluar ofertas pendientes ──
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

    // ── Registro del resultado ──
    const fin = new Date();
    const duracion = (fin - inicio) / 1000; // en segundos
    console.log(`[Automatización] Ciclo completo en ${duracion}s. Errores: ${resultado.errores.length}`);

    // Agrego métricas de duración y fecha al resultado para el email de resumen.
    resultado.fechaEjecucion = inicio.toISOString();
    resultado.duracionSegundos = Math.round(duracion);
    resultado.scraping.descartadasPorIdioma = descartadasPorIdioma;

    progreso.activo = false;
    progreso.porcentaje = 100;
    estado.ultimaEjecucion = inicio.toISOString();
    estado.ultimoResultado = resultado;

    // Envío notificación por email en background (fire-and-forget).
    // Si el email falla o SMTP no está configurado, no rompe el ciclo.
    servicioNotificacionEmail.enviarResumenCiclo(resultado).catch((errorEmail) => {
        console.error(`[Automatización] Error en notificación por email: ${errorEmail.message}`);
    });

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
    // en vez de UTC. Sin esto, las 20:00 serían las 17:00 Argentina.
    const tarea = cron.schedule(expresion, async () => {
        console.log(`[Automatización] Cron disparado a las ${new Date().toISOString()}`);
        // Si ya hay un ciclo activo (manual o de un cron anterior), salteo esta ejecución.
        if (cicloEnProgreso()) {
            console.log('[Automatización] Ciclo ya en progreso, salteando ejecución del cron.');
            return;
        }
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
 * Detengo el cron activo desde fuera del controlador de programarCron().
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

/**
 * Retorno true si hay un ciclo de automatización en progreso.
 * Útil para el controlador y para el cron: evita ejecutar ciclos superpuestos.
 *
 * En Node.js (single-threaded), el check + set de progreso.activo es atómico
 * dentro del mismo event loop, así que no hay race condition.
 */
function cicloEnProgreso() {
    return progreso.activo === true;
}

module.exports = {
    ejecutarCicloCompleto,
    programarCron,
    detenerCron,
    obtenerEstado,
    obtenerProgreso,
    cicloEnProgreso,
    _resetearEstado,
    // Exporto helpers para testeo directo.
    _armarPasosProgreso: armarPasosProgreso,
    _armarPesosDinamicos: armarPesosDinamicos,
    _inicializarResultadoScraping: inicializarResultadoScraping,
};