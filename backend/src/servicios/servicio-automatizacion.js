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
const bloqueo = require('../utils/bloqueo-concurrente');
const resultadosFuente = require('./servicio-resultados-fuente');
const modeloCron = require('../modelos/configuracion-cron');
const historial = require('../modelos/ejecucion-busqueda');
const { resolverConfiguraciones } = require('./servicio-configuracion-busqueda');

const servicioNotificacionEmail = require('./servicio-notificacion-email');
const { PLATAFORMAS_ACTIVAS, PLATAFORMAS, esPlataformaActiva } = require('../config/plataformas');

// ── Mapa local de scrapers: vincula cada id de plataforma con su función ──
// No está en config/plataformas.js porque eso crearía una dependencia circular
// entre config y servicios. Este mapa es la "pista de ejecución" del servicio.
const SCRAPERS = {
    linkedin: 'ejecutarScrapingLinkedin',
    computrabajo: 'ejecutarScrapingComputrabajo',
    indeed: 'ejecutarScrapingIndeed',
    bumeran: 'ejecutarScrapingBumeran',
    glassdoor: 'ejecutarScrapingGlassdoor',
    jooble: 'ejecutarScrapingJooble',
    remotive: 'ejecutarScrapingRemotive',
    remoteok: 'ejecutarScrapingRemoteOK',
    adzuna: 'ejecutarScrapingAdzuna',
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
    resultado.actualizadas = 0;
    resultado.reapariciones = 0;
    resultado.duplicadas = 0;
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
 * @param {'pendiente'|'procesando'|'completada'|'error'|'omitida'} nuevoEstado - Nuevo estado.
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
        .filter(p => p.estado === 'completada' || p.estado === 'error' || p.estado === 'omitida')
        .reduce((acc, p) => acc + (pesos[p.nombre] || 0), 0);
    progreso.porcentaje = Math.min(Math.round(completadas), 100);
}

/** Reservo el ciclo antes de leer preferencias para evitar dos aceptaciones simultáneas. */
async function prepararCiclo(opciones = {}) {
    if (cicloEnProgreso()) {
        throw Object.assign(new Error('Ya hay un ciclo de automatización en curso.'), { statusCode: 409 });
    }
    progreso = { activo: true, pasos: armarPasosProgreso(), porcentaje: 0, configuracion: [] };
    try {
        const configuraciones = await resolverConfiguraciones(opciones, { omitirIncompatibles: true });
        progreso.configuracion = Object.values(configuraciones).map(configuracion => configuracion.resumen);
        return configuraciones;
    } catch (error) {
        progreso.activo = false;
        throw error;
    }
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
async function ejecutarCicloCompleto(opciones = {}, configuracionesPreparadas, tipo = 'ciclo_manual') {
    const configuraciones = configuracionesPreparadas || await prepararCiclo(opciones);
    try {
        return await resultadosFuente.conHistorial(tipo, () => ejecutarCicloRegistrado(opciones, configuraciones));
    } catch (error) {
        progreso.error = error.statusCode === 503 ? 'No pude registrar el historial; no inicié scraping.' : 'No pude completar el ciclo.';
        estado.ultimoResultado = { exito: false, estado: 'error', fuentes: [],
            ...(error.statusCode === 503 ? { errorHistorial: progreso.error } : { error: progreso.error }) };
        throw error;
    } finally {
        progreso.activo = false;
    }
}

async function ejecutarCicloRegistrado(opciones = {}, configuracionesPreparadas) {
    console.log('[Automatización] Iniciando ciclo completo...');
    const inicio = new Date();

    const configuraciones = configuracionesPreparadas || await prepararCiclo(opciones);

    const resultado = {
        exito: true,
        fuentes: [],
        scraping: inicializarResultadoScraping(),
        configuracion: Object.values(configuraciones).map(configuracion => configuracion.resumen),
        evaluacion: null,
        errores: [],
        omisiones: [],
        erroresGuardado: 0,  // Contador de ofertas que fallaron al guardar en BD.
    };

    // Persisto cada fuente antes de continuar; un fallo no descarta datos útiles de otra.
    for (const plataforma of Object.values(PLATAFORMAS)) {
        const { id, label } = plataforma;
        const motivo = configuraciones[id]?.resumen.motivoOmision;
        if (plataforma.activa && motivo) {
            resultado.omisiones.push({ plataforma: id, motivo });
            resultado.fuentes.push({ plataforma: id, estado: 'omitida', motivoFinalizacion: motivo });
            actualizarPasoPorgreso(id, 'omitida', 0);
            progreso.pasos.find(paso => paso.nombre === id).motivo = motivo;
            continue;
        }
        actualizarPasoPorgreso(id, 'procesando');
        const fuente = await resultadosFuente.ejecutarFuente(id, servicioScraping[SCRAPERS[id]], configuraciones[id]?.opciones);
        resultado.fuentes.push(fuente);
        resultado.scraping[id] = fuente.totalExtraidas;
        resultado.scraping.totalExtraidas += fuente.totalExtraidas;
        resultado.scraping.guardadas += fuente.nuevas;
        resultado.scraping.actualizadas += fuente.actualizadas;
        resultado.scraping.reapariciones += fuente.reapariciones;
        resultado.scraping.duplicadas += fuente.duplicadas;
        resultado.scraping.descartadasPorIdioma += fuente.idiomaDescartadas;
        resultado.erroresGuardado += fuente.erroresGuardado;
        const fallo = !['completada', 'sin_resultados', 'deshabilitada'].includes(fuente.estado);
        actualizarPasoPorgreso(id, fallo ? 'error' : fuente.estado === 'deshabilitada' ? 'omitida' : 'completada', fuente.totalExtraidas);
        for (const error of fuente.errores) {
            resultado.errores.push(error.tipo === 'persistencia'
                ? `Error al guardar ofertas de ${label}: ${fuente.erroresGuardado} errores.`
                : `Error en scraping de ${label}: ${error.mensaje}`);
        }
    }
    resultado.estadoScraping = resultadosFuente.estadoGeneral(resultado.fuentes);
    actualizarPasoPorgreso('guardado', resultado.erroresGuardado ? 'error' : 'completada', resultado.scraping.guardadas);

    // ── Paso 4: Evaluar ofertas pendientes ──
    actualizarPasoPorgreso('evaluacion', 'procesando');
    try {
        // Comparto el mutex de selección y reset, tanto para cron como para ejecución manual.
        const lock = await bloqueo.intentarAdquirirLock(bloqueo.CLAVES.EVALUACION_OFERTAS);
        if (!lock.ok) throw new Error('Ya hay una evaluación en curso.');
        try {
            if (servicioEvaluacion.obtenerProgresoEvaluacion().activo) {
                throw new Error('Ya hay una evaluación en curso.');
            }
            resultado.evaluacion = await servicioEvaluacion.evaluarOfertasPendientes();
        } finally {
            await bloqueo.liberarBloqueoSeguro(lock.client, bloqueo.CLAVES.EVALUACION_OFERTAS);
        }
        const evaluacion = resultado.evaluacion;
        const fallo = evaluacion.estado === 'error' || evaluacion.errores > 0;
        const cancelada = evaluacion.estado === 'cancelado';
        if (fallo || cancelada) {
            resultado.exito = false;
            resultado.errores.push(cancelada
                ? 'La evaluación fue cancelada. Conservo los resultados parciales.'
                : `Error en evaluación: ${evaluacion.errores || 0} error(es). Conservo los resultados parciales.`);
        }
        actualizarPasoPorgreso('evaluacion', fallo || cancelada ? 'error' : 'completada', evaluacion.aprobadas);
        console.log(`[Automatización] Evaluación: ${resultado.evaluacion.aprobadas} aprobadas, ${resultado.evaluacion.rechazadas} rechazadas.`);
    } catch (error) {
        resultado.exito = false;
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
    resultado.estadoEvaluacion = resultado.exito ? 'completada' : 'error';
    resultado.estado = resultado.estadoScraping;
    if (!resultado.exito && ['completada', 'sin_resultados'].includes(resultado.estado)) resultado.estado = 'parcial';
    resultado.exito = resultado.exito && ['completada', 'sin_resultados'].includes(resultado.estado);
    resultado.evaluacionAlcance = 'global_pendientes_sin_atribucion_por_fuente';

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
let colaCron = Promise.resolve();
let rehidratacion;
function serializarCron(operacion) {
    const actual = colaCron.then(operacion);
    colaCron = actual.catch(() => {});
    return actual;
}
function validarCron(expresion, zona = TIMEZONE_CRON) {
    if (typeof expresion !== 'string' || !cron.validate(expresion) || zona !== TIMEZONE_CRON) {
        throw Object.assign(new Error('Expresión cron inválida o zona horaria no permitida.'), { statusCode: 400 });
    }
}
async function detenerTarea() {
    const tarea = estado.cronActivo;
    if (tarea) {
        await tarea.stop();
        await tarea.destroy();
    }
    estado.cronActivo = null;
    estado.expresionCron = null;
}
async function aplicarCron(expresion) {
    const tarea = cron.createTask(expresion, async () => {
        if (cicloEnProgreso()) return;
        try { await ejecutarCicloCompleto({}, undefined, 'cron'); }
        catch { console.error('[Automatización] No pude completar el ciclo programado.'); }
    }, { timezone: TIMEZONE_CRON, noOverlap: true });
    try {
        await tarea.start();
        if (!['idle', 'running'].includes(tarea.getStatus())) throw new Error('El scheduler no quedó activo.');
        estado.cronActivo = tarea;
        estado.expresionCron = expresion;
    } catch (error) {
        await tarea.destroy();
        throw error;
    }
}
function programarCron(opciones = {}) {
    const expresion = opciones.expresionCron === undefined ? EXPRESION_CRON_DEFECTO : opciones.expresionCron;
    return serializarCron(async () => {
        validarCron(expresion);
        try {
            await detenerTarea();
            await modeloCron.guardar({ activo: true, expresionCron: expresion, zonaHoraria: TIMEZONE_CRON });
            await aplicarCron(expresion);
            estado.errorCron = null;
            return { detener: detenerCron };
        } catch {
            estado.errorCron = 'No pude activar el cron; verificá la persistencia antes de reiniciar.';
            try { await modeloCron.guardar({ activo: false, expresionCron: expresion, zonaHoraria: TIMEZONE_CRON }); }
            catch { estado.errorCron += ' Tampoco pude confirmar la desactivación persistida.'; }
            throw Object.assign(new Error(estado.errorCron), { statusCode: 503 });
        }
    });
}
function rehidratar() {
    if (!rehidratacion) rehidratacion = serializarCron(async () => {
        try {
            await historial.interrumpirPendientes();
            const configuracion = await modeloCron.obtener();
            if (!configuracion || configuracion.activo === false) return obtenerEstado();
            if (configuracion.activo !== true) throw new Error('Configuración no verificable.');
            validarCron(configuracion.expresion_cron, configuracion.zona_horaria);
            await aplicarCron(configuracion.expresion_cron);
            estado.errorCron = null;
        } catch {
            estado.errorCron = 'No pude verificar la configuración o el historial al iniciar; el cron permanece inactivo.';
            console.error(`[Automatización] ${estado.errorCron}`);
        }
        return obtenerEstado();
    });
    return rehidratacion;
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
        activo: estado.cronActivo !== null && ['idle', 'running'].includes(estado.cronActivo.getStatus()),
        expresionCron: estado.expresionCron,
        zonaHoraria: TIMEZONE_CRON,
        errorCron: estado.errorCron || null,
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
    return serializarCron(async () => {
        const expresion = estado.expresionCron || EXPRESION_CRON_DEFECTO;
        try {
            await detenerTarea();
            await modeloCron.guardar({ activo: false, expresionCron: expresion, zonaHoraria: TIMEZONE_CRON });
            estado.errorCron = null;
            return obtenerEstado();
        } catch {
            estado.errorCron = 'No pude confirmar la desactivación persistida del cron.';
            throw Object.assign(new Error(estado.errorCron), { statusCode: 503 });
        }
    });
}

/**
 * Reseteo el estado interno — SOLO para tests.
 * En producción no se usa, pero los tests necesitan arrancar de cero.
 * El guión bajo al inicio (_) es una convención que indica "uso interno".
 */
function _resetearEstado() {
    if (estado.cronActivo) {
        estado.cronActivo.stop();
        estado.cronActivo.destroy();
    }
    colaCron = Promise.resolve();
    rehidratacion = undefined;
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
    prepararCiclo,
    rehidratar,
    obtenerHistorial: historial.listar,
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
