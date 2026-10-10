// Servicio de evaluación con IA — decide si una oferta hace match con mi perfil.
//
// Flujo para cada oferta:
// 1. Construyo un prompt con los datos de la oferta + mi perfil.
// 2. Se lo mando a DeepSeek (IA).
// 3. DeepSeek responde con JSON: { match: true/false, razon: "..." }.
// 4. Parseo la respuesta y actualizo el estado en la base de datos.
//
// ¿Por qué le pido que responda en JSON y no en texto libre?
// Porque el JSON lo puedo parsear programáticamente con JSON.parse().
// Si respondiera en texto libre, tendría que adivinar si dijo "sí" o "no"
// analizando el texto — mucho más frágil y propenso a errores.
//
// ¿Qué es "prompt engineering"? Es el arte de escribir instrucciones claras
// para la IA. Cuanto más específico y estructurado sea el prompt, mejor
// la respuesta. Es como darle un brief a un diseñador: si le decís
// "haceme algo lindo" te da cualquier cosa. Si le decís exactamente qué
// querés, colores, medidas, tipografía — te clava el diseño.

const { consultarDeepSeek, DEEPSEEK_MODELO } = require('../config/deepseek');
const modeloOferta = require('../modelos/oferta');
const modeloPreferencia = require('../modelos/preferencia');
const evaluacionCache = require('../modelos/evaluacion-cache');
const evaluacionLote = require('../modelos/evaluacion-lote');
const { parsearRespuestaEvaluacionIa } = require('./evaluacion/parser-respuesta-ia');
const { evaluarReglasExclusion } = require('./evaluacion/reglas-exclusion');
const { detectarPrioridadIa } = require('./evaluacion/detector-prioridad-ia');
const { construirPerfilDesdePreferencias, construirInstruccionesDesdePreferencias, construirPromptEvaluacion } = require('./evaluacion/entradas-evaluacion');
const { construirIdentidadEvaluacion } = require('./evaluacion/identidad-evaluacion');

// Progreso de la evaluación en curso.
// ¿Por qué un objeto en memoria y no en la BD? Porque el progreso es efímero:
// nace cuando arranca la evaluación y muere cuando termina. No tiene sentido
// guardarlo en la base de datos; alcanza con que sea accesible dentro del
// mismo proceso de Node.js. El frontend hace polling cada 2 segundos.
let progresoEvaluacion = {
    activo: false,
    total: 0,
    evaluadas: 0,
    aprobadas: 0,
    rechazadas: 0,
    errores: 0,
    porcentaje: 0,
    estado: 'inactivo',
    mensaje_error: null,
    procesadas: 0,
    pendientes: 0,
};

// Bandera para interrumpir el loop de evaluación.
let _cancelarEvaluacion = false;

/**
 * Devuelvo una copia del estado actual del progreso.
 * @returns {Object} Estado del progreso de evaluación.
 */
function obtenerProgresoEvaluacion() {
    return { ...progresoEvaluacion };
}

/**
 * Activo la bandera de cancelación para que el loop de evaluarOfertasPendientes
 * se detenga después de procesar la oferta actual (no la corta a mitad de oferta).
 */
function cancelarEvaluacionPendiente() {
    _cancelarEvaluacion = true;
}

/**
 * Verifico si una ubicación coincide con alguna de las zonas preferidas.
 * Comparo en minúsculas para que sea insensible a mayúsculas.
 *
 * @param {string} ubicacion - Ubicación de la oferta.
 * @param {string[]} zonas - Lista de zonas preferidas.
 * @returns {boolean}
 */
function ubicacionEnZonas(ubicacion, zonas) {
    const textoUbicacion = (ubicacion || '').toLowerCase();
    return zonas.some(zona => textoUbicacion.includes((zona || '').toLowerCase()));
}

/**
 * Evalúo una oferta individual con DeepSeek.
 *
 * Ahora recibe las instrucciones y el modelo como parámetros para no
 * leer de la BD en cada oferta (se lee UNA vez por lote en
 * evaluarOfertasPendientes y se pasa a cada evaluación individual).
 *
 * @param {Object} oferta - La oferta de la base de datos.
 * @param {string} instrucciones - Instrucciones de sistema armadas desde preferencias.
 * @param {string} [modelo] - Modelo de IA a usar (ej: 'deepseek-v4-flash').
 * @param {Object} [preferencias] - Preferencias guardadas del lote (para defensas programáticas).
 * @param {{forzar?: boolean, diferirCache?: boolean, guardarCache?: Function}} [opciones] - Difiero la caché del worker hasta persistir la oferta.
 * @returns {Object} Resultado con firma_criterios_evaluacion solo si fue exitoso.
 */
async function evaluarOferta(oferta, instrucciones, modelo, preferencias, opciones = {}) {
    try {
        // Si recibo instrucciones como parámetro las uso; si no,
        // leo las preferencias de la BD (para llamadas sueltas desde la API).
        let instruccionesFinal = instrucciones;
        let modeloFinal = modelo;
        let preferenciasFinal = preferencias;

        if (!preferenciasFinal) {
            preferenciasFinal = await modeloPreferencia.obtenerPreferencias();
        }
        preferenciasFinal = preferenciasFinal || {};
        instruccionesFinal = instruccionesFinal || construirInstruccionesDesdePreferencias(preferenciasFinal);

        const identidad = construirIdentidadEvaluacion(oferta, preferenciasFinal, {
            instrucciones: instruccionesFinal,
            modelo: modeloFinal,
        });
        modeloFinal = identidad.criterios.modelo;
        const firma = identidad.firma_criterios_evaluacion;
        async function guardarResultado(resultado) {
            const firmado = { ...resultado, firma_criterios_evaluacion: firma };
            // La caché es opcional; en el worker la confirmo después del UPDATE.
            const confirmar = async () => {
                try {
                    await evaluacionCache.guardarCache(identidad.hash_oferta, firma, modeloFinal, firmado);
                } catch (errorCache) {
                    console.warn('[Evaluación] No se pudo guardar caché:', errorCache.message);
                }
            };
            if (opciones.diferirCache) opciones.guardarCache = confirmar;
            else await confirmar();
            return firmado;
        }

        // ── Paso 1: Pre-evaluación con reglas de exclusión ──
        // Si la oferta cumple algún criterio de exclusión determinístico
        // (Java, Senior, 3+ años, inglés avanzado, presencial fuera de zona),
        // la rechazo SIN llamar a DeepSeek.
        if (preferenciasFinal) {
            const resultadoExclusion = evaluarReglasExclusion(oferta, preferenciasFinal);
            if (resultadoExclusion.excluida) {
                const rechazo = {
                    match: false,
                    porcentaje: resultadoExclusion.porcentaje,
                    razon: resultadoExclusion.razon,
                    error: false,
                    firma_criterios_evaluacion: firma,
                };
                return opciones.forzar ? await guardarResultado(rechazo) : rechazo;
            }
        }

        // Defensa programática: presencial fuera de zona → rechazo sin consultar IA.
        // (Esta defensa se mantiene por compatibilidad y como respaldo extra.)
        const modalidadOferta = (oferta.modalidad || '').toLowerCase().trim();
        const zonasPreferidas = (preferenciasFinal || {}).zonas_preferidas || [];
        const ubicacionOferta = oferta.ubicacion || '';
        const esPresencial = modalidadOferta === 'presencial';
        const estaEnZonas = zonasPreferidas.length === 0 || ubicacionEnZonas(ubicacionOferta, zonasPreferidas);

        if (esPresencial && !estaEnZonas) {
            const rechazo = {
                match: false,
                porcentaje: 0,
                razon: `La oferta es presencial en ${ubicacionOferta} (fuera de las zonas preferidas) => rechazada.`,
                firma_criterios_evaluacion: firma,
            };
            return opciones.forzar ? await guardarResultado(rechazo) : rechazo;
        }

        // ── Paso 2: Llamada a DeepSeek ──
        // Solo llego acá si las reglas de exclusión no se activaron.
        // Las defensas vigentes siempre se ejecutan antes de aceptar un hit.
        if (!opciones.forzar) {
            try {
                const cacheado = await evaluacionCache.buscarCache(identidad.hash_oferta, firma, modeloFinal);
                if (cacheado && !cacheado.error) return { ...cacheado, firma_criterios_evaluacion: firma };
            } catch (errorCache) {
                console.warn('[Evaluación] No se pudo leer caché:', errorCache.message);
            }
        }
        const promptEvaluacion = identidad.oferta.mensaje_usuario;
        const respuestaTexto = await consultarDeepSeek(
            instruccionesFinal,
            promptEvaluacion,
            modeloFinal
        );

        // ── Paso 3: Parsear la respuesta de DeepSeek con el parser estricto ──
        const respuesta = parsearRespuestaEvaluacionIa(respuestaTexto);

        // Si el parser no pudo interpretar la respuesta, devuelvo rechazo seguro.
        if (respuesta.error) {
            return {
                match: false,
                porcentaje: 15,
                razon: `No se pudo interpretar la respuesta de DeepSeek: ${respuesta.razon}`,
                error: true,
            };
        }

        // ── Paso 4: Post-evaluación con reglas de exclusión ──
        // Si DeepSeek aprobó la oferta pero las reglas determinísticas dicen
        // que debe ser rechazada (Java, Senior, 3+ años, inglés avanzado),
        // sobreescribo el resultado. La IA puede equivocarse; las reglas no.
        if (respuesta.match && preferenciasFinal) {
            const resultadoPostExclusion = evaluarReglasExclusion(oferta, preferenciasFinal);
            if (resultadoPostExclusion.excluida) {
                return await guardarResultado({
                    match: false,
                    porcentaje: resultadoPostExclusion.porcentaje,
                    razon: resultadoPostExclusion.razon,
                    error: false,
                });
            }
        }

        // Si la IA dijo match:false con porcentaje bajo, las reglas también
        // pueden enriquecer la razón si detectan algo que la IA no mencionó.
        // Pero no sobreescribimos si ya fue rechazada — dejamos la razón de la IA.
        const prioridadIa = respuesta.match ? detectarPrioridadIa(oferta) : null;
        return await guardarResultado({
            match: respuesta.match,
            razon: respuesta.razon,
            porcentaje: respuesta.porcentaje,
            prioridad_ia: prioridadIa,
        });

    } catch (error) {
        const razonError = `Error al evaluar con DeepSeek: ${error.message}`;
        console.error(`[Evaluación] Error al evaluar oferta ID ${oferta.id}: ${razonError}`);

        return {
            match: false,
            razon: razonError,
            error: true,
        };
    }
}

/**
 * Evalúo pendientes recientes o el snapshot completo seleccionado por el controlador.
 *
 * Proceso:
 * 1. Busco todas las ofertas con estado_evaluacion = 'pendiente'.
 * 2. Evalúo cada una con DeepSeek (una por una, para no saturar la API).
 * 3. Actualizo el estado en la BD según el resultado.
 * 4. Retorno un resumen con los contadores.
 *
 * ¿Por qué una por una y no en paralelo? Porque DeepSeek tiene rate limits
 * (límites de velocidad). Si mando 100 requests al mismo tiempo, me bloquean.
 * Procesando de a una, respetamos los límites y además podemos debuggear
 * fácilmente si algo falla.
 *
 * @param {Object[]} [seleccionadas] - Ofertas recientes validadas; siempre fuerzo esta selección.
 * @returns {Object} Resumen: { total, aprobadas, rechazadas, errores, detalle }.
 */
async function evaluarOfertasPendientes(seleccionadas) {
    // Inicializo el progreso y reseteo la bandera de cancelación.
    _cancelarEvaluacion = false;
    let loteId = null;
    let errorLote = null;
    let resumen;
    progresoEvaluacion = {
        activo: true,
        total: 0,
        evaluadas: 0,
        aprobadas: 0,
        rechazadas: 0,
        errores: 0,
        porcentaje: 0,
        estado: 'activo',
        mensaje_error: null,
        procesadas: 0,
        pendientes: 0,
    };

    try {
        // Leo las preferencias UNA sola vez para todo el lote.
        const prefs = structuredClone((await modeloPreferencia.obtenerPreferencias()) || {});
        const instrucciones = construirInstruccionesDesdePreferencias(prefs);
        const modeloIA = prefs.modelo_ia_evaluacion || prefs.modelo_ia || DEEPSEEK_MODELO;

        const pendientes = seleccionadas || await modeloOferta.obtenerOfertasPendientes();

        progresoEvaluacion.total = pendientes.length;
        progresoEvaluacion.pendientes = pendientes.length;

        // Creo un lote persistente en BD para que el progreso sobreviva reinicios.
        try {
            const lote = await evaluacionLote.crearLote(pendientes.length, modeloIA);
            loteId = lote.id;
        } catch (err) {
            console.warn('[Evaluación] No se pudo crear lote en BD, el progreso solo estará en memoria:', err.message);
        }

        resumen = {
            total: pendientes.length,
            aprobadas: 0,
            rechazadas: 0,
            errores: 0,
            detalle: [],
        };

        if (pendientes.length === 0) {
            console.log('[Evaluación] No hay ofertas pendientes para evaluar.');
            return resumen;
        }

        console.log(`[Evaluación] Evaluando ${pendientes.length} ofertas pendientes...`);

        for (const oferta of pendientes) {
            // Si el usuario canceló, detengo el loop antes de la siguiente oferta.
            if (_cancelarEvaluacion) {
                console.log('[Evaluación] Cancelada por el usuario.');
                break;
            }

            console.log(`[Evaluación] Procesando oferta ID ${oferta.id}: "${oferta.titulo}"...`);

            // El reset deja un marcador persistido: omito caché solo en esa próxima evaluación.
            const forzar = Boolean(seleccionadas) || oferta.evaluacion_error_mensaje === 'REEVALUACION_SOLICITADA';
            const opciones = { forzar, diferirCache: true };
            const resultado = await evaluarOferta(oferta, instrucciones, modeloIA, prefs, opciones);
            const conservarAnterior = forzar && resultado.error
                && ['aprobada', 'rechazada'].includes(oferta.estado_evaluacion)
                && Boolean(oferta.fecha_evaluacion)
                && (!oferta.evaluacion_error_mensaje || oferta.razon_evaluacion !== oferta.evaluacion_error_mensaje);
            const estado = conservarAnterior ? oferta.estado_evaluacion : resultado.match ? 'aprobada' : 'rechazada';
            const errorMensaje = resultado.error ? resultado.razon : null;

            if (conservarAnterior) {
                await modeloOferta.registrarErrorEvaluacion(oferta.id, errorMensaje);
            } else {
                await modeloOferta.actualizarEvaluacion(
                    oferta.id, estado, resultado.razon, resultado.porcentaje, errorMensaje,
                    resultado.prioridad_ia || null, resultado.error ? null : resultado.firma_criterios_evaluacion
                );
            }
            // Nunca consolido un resultado cuyo UPDATE falló.
            if (opciones.guardarCache) await opciones.guardarCache();

            progresoEvaluacion.procesadas++;
            if (resultado.error) {
                resumen.errores++;
                progresoEvaluacion.errores++;
                progresoEvaluacion.mensaje_error = resultado.razon;
            } else {
                progresoEvaluacion.evaluadas++;
                if (resultado.match) {
                    resumen.aprobadas++;
                    progresoEvaluacion.aprobadas++;
                } else {
                    resumen.rechazadas++;
                    progresoEvaluacion.rechazadas++;
                }
            }
            progresoEvaluacion.pendientes = progresoEvaluacion.total - progresoEvaluacion.evaluadas;
            progresoEvaluacion.porcentaje = progresoEvaluacion.total > 0
                ? Math.round((progresoEvaluacion.procesadas / progresoEvaluacion.total) * 100)
                : 0;

            resumen.detalle.push({
                id: oferta.id,
                titulo: oferta.titulo,
                estado,
                razon: resultado.razon,
                error: resultado.error || false,
            });

            // Actualizo el lote en BD cada 5 ofertas (o en la última) para no
            // saturar PostgreSQL con writes. Si el servidor se reinicia, el
            // frontend ve el último snapshot persistido.
            if (loteId && (progresoEvaluacion.procesadas % 5 === 0 || progresoEvaluacion.procesadas === progresoEvaluacion.total)) {
                await evaluacionLote.actualizarProgreso(loteId, progresoEvaluacion);
            }
        }

        console.log(`[Evaluación] Procesamiento finalizado. Aprobadas: ${resumen.aprobadas}, Rechazadas: ${resumen.rechazadas}, Errores: ${resumen.errores}`);

        return resumen;
    } catch (error) {
        errorLote = error;
        progresoEvaluacion.mensaje_error = error.message;
        throw error;
    } finally {
        // Retengo el mutex del llamador hasta terminar todas las escrituras finales.
        progresoEvaluacion.estado = errorLote || progresoEvaluacion.errores > 0
            ? 'error' : _cancelarEvaluacion ? 'cancelado' : 'completado';
        try {
            if (loteId) {
                await evaluacionLote.actualizarProgreso(loteId, progresoEvaluacion);
                await evaluacionLote.finalizarLote(loteId, progresoEvaluacion.estado);
            }
        } catch (errorFinal) {
            progresoEvaluacion.estado = 'error';
            progresoEvaluacion.mensaje_error = errorLote?.message || errorFinal.message;
            // Intento dejar al menos el estado terminal; una BD caída no garantiza durabilidad.
            if (loteId) await evaluacionLote.finalizarLote(loteId, 'error').catch(
                err => console.warn('[Evaluación] No se pudo persistir el error del lote:', err.message)
            );
            if (!errorLote) errorLote = errorFinal;
        }
        progresoEvaluacion.activo = false;
        if (resumen) Object.assign(resumen, progresoEvaluacion);
        if (errorLote) throw errorLote;
    }
}

/**
 * Rehidrata el progreso de evaluación desde el último lote persistido en BD.
 * Se ejecuta al arrancar el servidor para recuperar el estado si se reinició.
 */
async function rehidratarProgreso() {
    try {
        const lote = await evaluacionLote.obtenerUltimoLote();

        if (lote) {
            progresoEvaluacion = {
                activo: lote.estado === 'activo',
                estado: lote.estado,
                mensaje_error: lote.estado === 'error' ? 'El lote terminó con errores. Revisá los resultados y las ofertas pendientes.' : null,
                procesadas: lote.evaluadas + lote.errores,
                pendientes: Math.max(0, lote.total - lote.evaluadas),
                total: lote.total,
                evaluadas: lote.evaluadas,
                aprobadas: lote.aprobadas,
                rechazadas: lote.rechazadas,
                errores: lote.errores,
                porcentaje: lote.porcentaje,
            };

            console.log(`[Evaluación] Progreso rehidratado: lote #${lote.id}, ${lote.porcentaje}%`);
        }
    } catch (err) {
        console.warn('[Evaluación] No se pudo rehidratar el progreso:', err.message);
    }
}

module.exports = {
    construirPromptEvaluacion,
    construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias,
    evaluarOferta,
    evaluarOfertasPendientes,
    obtenerProgresoEvaluacion,
    cancelarEvaluacionPendiente,
    rehidratarProgreso,
};
