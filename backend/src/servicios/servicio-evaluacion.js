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

const { consultarDeepSeek, DEEPSEEK_MODELO, normalizarModeloDeepSeek } = require('../config/deepseek');
const modeloOferta = require('../modelos/oferta');
const modeloPreferencia = require('../modelos/preferencia');
const evaluacionCache = require('../modelos/evaluacion-cache');
const evaluacionLote = require('../modelos/evaluacion-lote');
const { parsearRespuestaEvaluacionIa, validarCoherenciaRespuesta, normalizarTextoComparacion, PATRON_OPCIONAL_EVIDENCIA, PATRON_NEGACION_EVIDENCIA,
    _internas: { contieneTokenNormalizado, extraerClausulasConContexto } } = require('./evaluacion/parser-respuesta-ia');
const reglasExclusion = require('./evaluacion/reglas-exclusion');
const { resolverModalidadOferta } = require('./servicio-normalizacion');
const { estaEnZonasPreferidas, detectarRestriccionRemotaIncompatible } = require('./evaluacion/criterio-ubicacion');
const { detectarPrioridadIa } = require('./evaluacion/detector-prioridad-ia');
const { construirPerfilDesdePreferencias, construirPerfilEfectivoCanonico, construirInstruccionesDesdePreferencias, construirPromptEvaluacion } = require('./evaluacion/entradas-evaluacion');
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
    supersedidas: 0,
    porcentaje: 0,
    estado: 'inactivo',
    mensaje_error: null,
    procesadas: 0,
    pendientes: 0,
};

// Bandera para interrumpir el loop de evaluación.
let _cancelarEvaluacion = false;

// Estado del worker en memoria y lote en curso.
let _workerActivo = false;
let _loteActivoId = null;
let _ultimoLoteInterrumpidoId = null;

/**
 * Devuelvo una copia del estado actual del progreso.
 * @returns {Object} Estado del progreso de evaluación.
 */
function obtenerProgresoEvaluacion() {
    return { ...progresoEvaluacion };
}

/**
 * Cancela la evaluación pendiente o limpia un lote interrumpido/huérfano.
 *
 * Contemplo dos casos:
 * a) Si hay un worker corriendo en memoria: activo la bandera _cancelarEvaluacion = true
 *    para que el loop de evaluarOfertasPendientes se detenga ordenadamente.
 * b) Si no hay worker activo pero el progreso en memoria o la BD quedaron en estado 'activo':
 *    fuerzo la limpieza inmediata del estado en memoria y finalizo el lote en BD como 'cancelado'.
 *
 * @returns {Promise<Object>} Resultado de la cancelación informando si fue activa o limpieza.
 */
async function cancelarEvaluacionPendiente() {
    if (_workerActivo) {
        _cancelarEvaluacion = true;
        return {
            activa: true,
            cancelada: true,
            mensaje: 'Se solicitó la cancelación de la evaluación activa en curso.',
        };
    }

    _cancelarEvaluacion = false;
    const habiaEstadoActivo = progresoEvaluacion.activo;
    progresoEvaluacion.activo = false;
    progresoEvaluacion.estado = 'cancelado';
    progresoEvaluacion.mensaje_error = 'Evaluación cancelada.';

    let loteIdParaCerrar = _loteActivoId;
    try {
        if (!loteIdParaCerrar) {
            const ultimoLote = await evaluacionLote.obtenerUltimoLote();
            if (ultimoLote && ultimoLote.estado === 'activo') {
                loteIdParaCerrar = ultimoLote.id;
            }
        }
        if (loteIdParaCerrar) {
            await evaluacionLote.finalizarLote(loteIdParaCerrar, 'cancelado');
        }
    } catch (err) {
        console.warn('[Evaluación] Error al finalizar lote huérfano en cancelación:', err.message);
    }
    _loteActivoId = null;

    return {
        activa: false,
        cancelada: true,
        mensaje: habiaEstadoActivo || loteIdParaCerrar
            ? 'Se canceló y limpió el estado de evaluación interrumpido.'
            : 'No había evaluación activa; se restableció el estado a cancelado.',
    };
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
    return estaEnZonasPreferidas(ubicacion, zonas) === true;
}

/** Exijo una afirmación completa del hecho actual; una mención literal no acredita título ni residencia. */
function acreditarHechoActual(requisito, evidencia, hechos) {
    const titulacion = /\b(?:licenciatura|licenciad[oa]|titulo|titulacion|grado|doctorado|maestria|tecnicatura)\b/.test(requisito);
    const residencia = /\b(?:residir|residencia)\b/.test(requisito);
    if (!titulacion && !residencia) return contieneTokenNormalizado(evidencia, requisito);
    // shortcut: sólo acredito hechos fuente completos y sin citas; un párrafo ambiguo requiere confirmación manual.
    if (!hechos.some(texto => typeof texto === 'string' && !/[«»“”"'‘’\r\n]/.test(texto.trim())
        && normalizarTextoComparacion(texto) === evidencia)) return false;
    const confirmado = [' confirmado', ' confirmada'].some(sufijo => evidencia === `${requisito}${sufijo}`);
    if (titulacion) return confirmado
        || ['obtuve la ', 'complete la ', 'finalice la ', 'me gradue de la '].some(prefijo => evidencia === `${prefijo}${requisito}`)
        || [' obtenida', ' obtenido', ' completada', ' completado'].some(sufijo => evidencia === `${requisito}${sufijo}`);
    const lugar = requisito.match(/^(?:residir|residencia(?: actual)?) (en .+)$/)?.[1];
    return confirmado || Boolean(lugar && ['resido ', 'resido actualmente ', 'vivo actualmente ']
        .some(prefijo => evidencia === `${prefijo}${lugar}`));
}

/** Conservo afinidad y evidencia sin confundir elegibilidad desconocida con rechazo. */
function resolverElegibilidad(resultado, oferta, preferencias) {
    if (resultado.error || resultado.invalido || resultado.inconsistente || !resultado.match) return resultado;
    const original = resultado.explicacion || { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] };
    const candidato = construirPerfilEfectivoCanonico(preferencias).candidato;
    const hechos = [candidato.perfil_profesional, candidato.nivel_real_seniority, candidato.idioma_candidato,
        ...candidato.stack_tecnologico, ...candidato.tecnologias_detalle.filter(t => t.nivel !== 'ninguno').flatMap(t => [t.nombre, t.evidencia])];
    if (Number.isFinite(candidato.anios_experiencia_reales) && candidato.anios_experiencia_reales >= 0) {
        const anios = candidato.anios_experiencia_reales;
        hechos.push(`${anios} ${anios === 1 ? 'año' : 'años'} de experiencia`);
    }
    const hechosLiterales = hechos.filter(texto => typeof texto === 'string').map(normalizarTextoComparacion);
    const clausulasPerfil = hechos.filter(texto => typeof texto === 'string').flatMap(extraerClausulasConContexto);
    const ausencias = candidato.conocimientos_ausentes.map(normalizarTextoComparacion);
    const limitaciones = [candidato.perfil_profesional, candidato.limitaciones_explicitas].flatMap(extraerClausulasConContexto);
    // El título no convierte una mención deseable del cuerpo en obligación acreditada.
    const textoOferta = oferta.descripcion;
    const clausulasOferta = extraerClausulasConContexto(textoOferta);
    const revisados = new Map();
    for (const categoria of ['cumplidos', 'no_cumplidos', 'exclusiones', 'por_confirmar']) {
        for (const item of original[categoria] || []) {
            if (item.tipo !== 'obligatorio') continue;
            const requisito = normalizarTextoComparacion(item.requisito);
            const perfil = normalizarTextoComparacion(item.evidencia_perfil);
            const ofertaCitada = normalizarTextoComparacion(item.evidencia_oferta);
            const citasRelacionadas = clausulasOferta.filter(clausula => contieneTokenNormalizado(clausula, ofertaCitada) && contieneTokenNormalizado(ofertaCitada, requisito));
            // Una cláusula mixta no permite atribuir el deseable de otro requisito a una obligación explícita.
            const soloDeseable = citasRelacionadas.length > 0 && citasRelacionadas.every(clausula =>
                !/\b(?:obligatori[oa]s?|excluyentes?|mandatory|required)\b/.test(clausula)
                && (PATRON_OPCIONAL_EVIDENCIA.test(clausula) || PATRON_NEGACION_EVIDENCIA.test(clausula)));
            const ofertaAcreditada = contieneTokenNormalizado(ofertaCitada, requisito)
                && !validarCoherenciaRespuesta(false, resultado.porcentaje, { exclusiones: [item] }, textoOferta).invalido;
            // Solo pruebo ausencias declaradas o negaciones literales completas; no deduzco incompatibilidad por omisión.
            const ausenciaAcreditada = ausencias.includes(requisito) && perfil === requisito
                || limitaciones.includes(perfil)
                && [candidato.perfil_profesional, candidato.limitaciones_explicitas].some(texto => contieneTokenNormalizado(normalizarTextoComparacion(texto), perfil))
                && ['no cuento con ', 'no tengo ', 'no poseo ', 'no dispongo de ', 'carezco de ', 'sin '].some(prefijo => perfil === `${prefijo}${requisito}`);
            const cumplimientoAcreditado = ofertaAcreditada && acreditarHechoActual(requisito, perfil, hechos)
                // El contexto puede agregar prefijos; sólo una cita también presente en los hechos literales acredita cumplimiento.
                && hechosLiterales.some(texto => contieneTokenNormalizado(texto, perfil)) && clausulasPerfil.includes(perfil)
                && !/\b(?:no|sin|nunca|not|never|ningun[oa]?|carezco|aspiro|pendiente)\b/.test(perfil)
                && !PATRON_OPCIONAL_EVIDENCIA.test(perfil)
                && !ausencias.includes(requisito);
            const destino = soloDeseable ? 'por_confirmar' : ofertaAcreditada && ausenciaAcreditada ? 'exclusiones'
                : categoria === 'cumplidos' && cumplimientoAcreditado ? 'cumplidos' : 'por_confirmar';
            const prioridad = { cumplidos: 1, por_confirmar: 2, exclusiones: 3 };
            if (prioridad[revisados.get(requisito)?.destino] > prioridad[destino]) continue;
            revisados.set(requisito, { destino, item: destino === 'cumplidos' ? item : {
                ...item, tipo: soloDeseable ? 'deseable' : item.tipo,
                evidencia_oferta: ofertaAcreditada || soloDeseable ? item.evidencia_oferta : '',
                evidencia_perfil: destino === 'exclusiones' ? item.evidencia_perfil : '',
                explicacion: destino === 'exclusiones' ? 'Incompatibilidad respaldada por una ausencia declarada del candidato.'
                    : 'Necesito confirmar el requisito y su cumplimiento con evidencia relacionada del aviso y del perfil; no acredito equivalencias ni incompatibilidad por omisión.',
            } });
        }
    }
    const explicacion = Object.fromEntries(['cumplidos', 'no_cumplidos', 'por_confirmar', 'exclusiones']
        .map(categoria => [categoria, (original[categoria] || []).filter(item => item.tipo !== 'obligatorio')]));
    // Un deseable no constituye una exclusión, tampoco en la presentación.
    explicacion.no_cumplidos.push(...explicacion.exclusiones.filter(item => item.tipo === 'deseable'));
    explicacion.exclusiones = explicacion.exclusiones.filter(item => item.tipo !== 'deseable');
    for (const { destino, item } of revisados.values()) {
        explicacion[destino].push(item);
        if (destino === 'exclusiones') explicacion.no_cumplidos.push(item);
    }
    if (explicacion.exclusiones.some(item => item.tipo === 'obligatorio')) return {
        ...resultado, match: false, pendiente: false, prioridad_ia: null, explicacion, desglose_disponible: true,
        razon: `Incompatibilidad confirmada: ${explicacion.exclusiones.filter(item => item.tipo === 'obligatorio').map(item => item.requisito).join('; ')}. Afinidad técnica estimada: ${resultado.porcentaje}%.`,
    };
    const parcial = oferta.descripcion_completitud === 'parcial' || oferta.origen_descripcion === 'tarjeta';
    const evidenciaSuficiente = explicacion.cumplidos?.some(item => item.evidencia_oferta?.trim() && item.evidencia_perfil?.trim());
    const faltaInformacion = (parcial && !evidenciaSuficiente) || explicacion.por_confirmar?.some(
        item => item.requisito === 'Información suficiente de la oferta' && item.tipo !== 'deseable'
    );
    const obligatoriosPendientes = (explicacion.por_confirmar || []).filter(item => item.tipo === 'obligatorio');
    if (!faltaInformacion && !obligatoriosPendientes.length) return { ...resultado, explicacion };
    const porConfirmar = [...(explicacion.por_confirmar || [])];
    if (faltaInformacion && !porConfirmar.some(item => item.requisito === 'Información suficiente de la oferta')) porConfirmar.push({
        requisito: 'Información suficiente de la oferta', tipo: 'desconocido',
        evidencia_oferta: '', evidencia_perfil: '',
        explicacion: 'El extracto no aporta evidencia de cumplimiento suficiente; el título no acredita elegibilidad.',
    });
    return {
        ...resultado, pendiente: true, prioridad_ia: null,
        razon: `Pendiente de confirmación: ${porConfirmar.filter(item => item.tipo === 'obligatorio' || item.requisito === 'Información suficiente de la oferta').map(item => item.requisito).join('; ')}. Afinidad técnica estimada: ${resultado.porcentaje}%.`,
        explicacion: { ...explicacion, por_confirmar: porConfirmar }, desglose_disponible: true,
    };
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
 * @param {string} [modelo] - Modelo de IA a usar (ej: 'deepseek-flash').
 * @param {Object} [preferencias] - Preferencias guardadas del lote (para defensas programáticas).
 * @param {{forzar?: boolean, diferirCache?: boolean, guardarCache?: Function}} [opciones] - Difiero la caché del worker hasta persistir la oferta.
 * @returns {Object} Resultado firmado sin fallo técnico; pendiente impide aprobar aunque match indique afinidad.
 */
async function evaluarOferta(oferta, instrucciones, modelo, preferencias, opciones = {}) {
    let metadatos = {};
    const registrarFallo = codigo => {
        console.error('[Evaluación] Fallo técnico de IA', {
            ...(Number.isSafeInteger(oferta.id) && oferta.id > 0 ? { oferta_id: oferta.id } : {}),
            ...metadatos,
            codigo,
        });
    };
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
        let conflictos = [];
        function incorporarConflictos(resultado) {
            if (!conflictos.length) return resultado;
            const explicacion = resultado.explicacion || { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] };
            return {
                ...resultado,
                explicacion: { ...explicacion, por_confirmar: [
                    ...(explicacion.por_confirmar || []).filter(item => !conflictos.some(conflicto => conflicto.requisito === item.requisito)),
                    ...conflictos,
                ] },
                desglose_disponible: true,
            };
        }
        async function guardarResultado(resultado) {
            const firmado = {
                ...resolverElegibilidad(incorporarConflictos(resultado), oferta, preferenciasFinal),
                firma_criterios_evaluacion: (resultado.error || resultado.invalido || resultado.inconsistente) ? null : firma,
            };
            // La caché es opcional; en el worker la confirmo después del UPDATE.
            const confirmar = async () => {
                if (resultado.error || resultado.invalido || resultado.inconsistente) {
                    return;
                }
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
            const resultadoExclusion = reglasExclusion.evaluarReglasExclusion(oferta, preferenciasFinal);
            conflictos = resultadoExclusion.explicacion?.por_confirmar || [];
            if (resultadoExclusion.excluida) {
                const rechazo = {
                    match: false,
                    porcentaje: resultadoExclusion.porcentaje,
                    razon: resultadoExclusion.razon,
                    error: false,
                    firma_criterios_evaluacion: firma,
                    explicacion: resultadoExclusion.explicacion,
                    desglose_disponible: true,
                };
                return opciones.forzar ? await guardarResultado(rechazo) : rechazo;
            }
        }

        // Defensa programática: presencial fuera de zona o remoto restringido a otro país → rechazo sin consultar IA.
        // (Esta defensa se mantiene unificada con las reglas de exclusión como respaldo extra.)
        const interpretacionModalidad = resolverModalidadOferta(oferta);
        const modalidadOferta = interpretacionModalidad.modalidad;
        const zonasPreferidas = (preferenciasFinal || {}).zonas_preferidas || [];
        const ubicacionOferta = oferta.ubicacion || '';

        if (modalidadOferta === 'presencial') {
            const compatibilidadPresencial = estaEnZonasPreferidas(ubicacionOferta, zonasPreferidas);
            // Solo rechaza si está confirmadamente fuera de zona (false).
            // Si la ubicación está ausente o desconocida (null), conservo la incertidumbre y no fuerzo rechazo.
            if (zonasPreferidas.length > 0 && compatibilidadPresencial === false) {
                const itemExclusion = {
                    requisito: 'Ubicación presencial en zonas preferidas',
                    tipo: 'obligatorio',
                    evidencia_oferta: ubicacionOferta,
                    evidencia_perfil: `Zonas preferidas: ${zonasPreferidas.join(', ')}`,
                    explicacion: `La oferta es presencial en ${ubicacionOferta} (fuera de las zonas preferidas).`,
                };
                const rechazo = {
                    match: false,
                    porcentaje: 0,
                    razon: `La oferta es presencial en ${ubicacionOferta} (fuera de las zonas preferidas) => rechazada.`,
                    firma_criterios_evaluacion: firma,
                    explicacion: {
                        cumplidos: [],
                        no_cumplidos: [itemExclusion],
                        por_confirmar: [],
                        exclusiones: [itemExclusion],
                    },
                    desglose_disponible: true,
                };
                return opciones.forzar ? await guardarResultado(rechazo) : rechazo;
            }
        } else if ([modalidadOferta, interpretacionModalidad.metadatos, interpretacionModalidad.titulo, interpretacionModalidad.descripcion].includes('remoto')) {
            const restriccionRemota = detectarRestriccionRemotaIncompatible({ ...oferta, modalidad: 'remoto' });
            if (restriccionRemota.detectado) {
                const itemExclusion = {
                    requisito: 'Residencia territorial remota compatible',
                    tipo: 'obligatorio',
                    evidencia_oferta: restriccionRemota.evidencia || 'Restricción geográfica en oferta remota',
                    evidencia_perfil: 'Candidato radicado en Argentina',
                    explicacion: `La oferta es remota pero está restringida a residentes de otro país («${restriccionRemota.evidencia}»).`,
                };
                const rechazo = {
                    match: false,
                    porcentaje: 0,
                    razon: `La oferta es remota pero está restringida a residentes de otro país («${restriccionRemota.evidencia}») => rechazada.`,
                    firma_criterios_evaluacion: firma,
                    explicacion: {
                        cumplidos: [],
                        no_cumplidos: [itemExclusion],
                        por_confirmar: [],
                        exclusiones: [itemExclusion],
                    },
                    desglose_disponible: true,
                };
                return opciones.forzar ? await guardarResultado(rechazo) : rechazo;
            }
        }

        // Sin descripción conservo pendiente sin consumir IA, incluso en ejecuciones repetidas.
        if (!oferta.descripcion?.trim()) {
            return {
                match: false, pendiente: true, porcentaje: null, error: false,
                razon: 'Pendiente de confirmación: falta la descripción de la oferta.',
                firma_criterios_evaluacion: firma,
                explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [
                    ...conflictos,
                    { requisito: 'Descripción de la oferta', tipo: 'desconocido', evidencia_oferta: '', evidencia_perfil: '',
                        explicacion: 'Necesito la descripción para evaluar requisitos; el título no basta.' },
                ] },
                desglose_disponible: true,
            };
        }

        // ── Paso 2: Llamada a DeepSeek ──
        // Solo llego acá si las reglas de exclusión no se activaron.
        // Las defensas vigentes siempre se ejecutan antes de aceptar un hit.
        if (!opciones.forzar) {
            try {
                const cacheado = await evaluacionCache.buscarCache(identidad.hash_oferta, firma, modeloFinal);
                if (cacheado && !cacheado.error) return resolverElegibilidad(incorporarConflictos({ ...cacheado, firma_criterios_evaluacion: firma }), oferta, preferenciasFinal);
            } catch (errorCache) {
                console.warn('[Evaluación] No se pudo leer caché:', errorCache.message);
            }
        }
        const promptEvaluacion = identidad.oferta.mensaje_usuario;
        const respuestaTexto = await consultarDeepSeek(
            instruccionesFinal,
            promptEvaluacion,
            modeloFinal,
            { alRecibirMetadatos: datos => { metadatos = datos; } }
        );

        // ── Paso 3: Parsear la respuesta de DeepSeek con el parser estricto ──
        const textoOferta = [oferta.titulo, oferta.descripcion].filter(Boolean).join('\n');
        const respuesta = parsearRespuestaEvaluacionIa(respuestaTexto, textoOferta);

        // Registro solo clasificación y métricas, nunca evidencias ni texto del parser.
        if (respuesta.error || respuesta.invalido || respuesta.inconsistente) {
            registrarFallo('RESPUESTA_INVALIDA');
        }
        if (respuesta.error && !respuesta.inconsistente) {
            return {
                match: false,
                porcentaje: 15,
                razon: 'No se pudo interpretar la respuesta de DeepSeek: respuesta inválida.',
                error: true,
                explicacion: respuesta.explicacion,
                desglose_disponible: false,
            };
        }

        // ── Paso 4: Post-evaluación con reglas de exclusión ──
        // Si DeepSeek aprobó la oferta pero las reglas determinísticas dicen
        // que debe ser rechazada (Java, Senior, 3+ años, inglés avanzado),
        // sobreescribo el resultado y enriquezco la explicación con la exclusión detectada.
        if (respuesta.match && preferenciasFinal) {
            const resultadoPostExclusion = reglasExclusion.evaluarReglasExclusion(oferta, preferenciasFinal);
            if (resultadoPostExclusion.excluida) {
                const explicacionBase = respuesta.explicacion || { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] };
                const exclusionesNuevas = resultadoPostExclusion.explicacion?.exclusiones || [];
                const explicacionFinal = {
                    cumplidos: explicacionBase.cumplidos || [],
                    no_cumplidos: [...(explicacionBase.no_cumplidos || []), ...exclusionesNuevas],
                    por_confirmar: explicacionBase.por_confirmar || [],
                    exclusiones: [...(explicacionBase.exclusiones || []), ...exclusionesNuevas],
                };
                return await guardarResultado({
                    match: false,
                    porcentaje: resultadoPostExclusion.porcentaje,
                    razon: resultadoPostExclusion.razon,
                    error: false,
                    explicacion: explicacionFinal,
                    desglose_disponible: true,
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
            explicacion: respuesta.explicacion,
            desglose_disponible: respuesta.desglose_disponible,
            ...(respuesta.inconsistente ? { inconsistente: true } : {}),
            ...(respuesta.invalido ? { invalido: true } : {}),
            ...(respuesta.error ? { error: true } : {}),
        });

    } catch (error) {
        const codigoRecibido = metadatos.codigo || error?.codigo;
        const codigo = /^(?:SALIDA_TRUNCADA|SALIDA_INCOMPLETA|CHOICES_AUSENTES|SALIDA_VACIA|JSON_INVALIDO|TIMEOUT|CANCELADA|ERROR_TRANSPORTE|HTTP_[45]\d{2})$/.test(codigoRecibido)
            ? codigoRecibido : 'ERROR_EVALUACION';
        const mensajes = {
            SALIDA_TRUNCADA: 'DeepSeek devolvió una respuesta incompleta. Volvé a intentar.',
            SALIDA_INCOMPLETA: 'DeepSeek devolvió una respuesta incompleta. Volvé a intentar.',
            CHOICES_AUSENTES: 'DeepSeek devolvió una respuesta sin opciones. Volvé a intentar.',
            SALIDA_VACIA: 'DeepSeek devolvió una respuesta vacía. Volvé a intentar.',
            JSON_INVALIDO: 'DeepSeek no devolvió un objeto JSON válido. Volvé a intentar.',
        };
        const razonError = `Error al evaluar con DeepSeek: ${mensajes[codigo] || `Error técnico (${codigo}). Volvé a intentar.`}`;
        registrarFallo(codigo);

        return {
            match: false,
            razon: razonError,
            error: true,
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
            desglose_disponible: false,
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
    _workerActivo = true;
    let loteId = null;
    _loteActivoId = null;
    let errorLote = null;
    let resumen;
    progresoEvaluacion = {
        activo: true,
        total: 0,
        evaluadas: 0,
        aprobadas: 0,
        rechazadas: 0,
        errores: 0,
        supersedidas: 0,
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
        const modeloIA = normalizarModeloDeepSeek(prefs.modelo_ia_evaluacion || prefs.modelo_ia || DEEPSEEK_MODELO);

        const pendientes = seleccionadas || await modeloOferta.obtenerOfertasPendientes();

        progresoEvaluacion.total = pendientes.length;
        progresoEvaluacion.pendientes = pendientes.length;

        // Creo un lote persistente en BD para que el progreso sobreviva reinicios.
        try {
            const lote = await evaluacionLote.crearLote(pendientes.length, modeloIA);
            loteId = lote.id;
            _loteActivoId = loteId;
        } catch (err) {
            console.warn('[Evaluación] No se pudo crear lote en BD, el progreso solo estará en memoria:', err.message);
        }

        resumen = {
            total: pendientes.length,
            aprobadas: 0,
            rechazadas: 0,
            errores: 0,
            supersedidas: 0,
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
            const esInconsistente = Boolean(resultado.invalido || resultado.inconsistente);
            const tieneFallo = Boolean(resultado.error || esInconsistente);
            const conservarAnterior = forzar && tieneFallo
                && ['aprobada', 'rechazada'].includes(oferta.estado_evaluacion)
                && Boolean(oferta.fecha_evaluacion)
                && (!oferta.evaluacion_error_mensaje || oferta.razon_evaluacion !== oferta.evaluacion_error_mensaje);
            const estado = conservarAnterior ? oferta.estado_evaluacion : (tieneFallo || resultado.pendiente ? 'pendiente' : (resultado.match ? 'aprobada' : 'rechazada'));
            const errorMensaje = tieneFallo ? resultado.razon : null;

            const explicacionParaGuardar = (
                resultado.explicacion && (
                    resultado.desglose_disponible ||
                    resultado.explicacion.cumplidos?.length ||
                    resultado.explicacion.no_cumplidos?.length ||
                    resultado.explicacion.exclusiones?.length ||
                    resultado.explicacion.por_confirmar?.length
                )
            ) ? resultado.explicacion : null;

            let resActualizacion = null;

            if (conservarAnterior) {
                resActualizacion = await modeloOferta.registrarErrorEvaluacion(
                    oferta.id,
                    errorMensaje,
                    oferta.descripcion,
                    ...(oferta.descripcion_modificada_en !== undefined ? [oferta.descripcion_modificada_en] : [])
                );
            } else if (tieneFallo) {
                resActualizacion = await modeloOferta.actualizarEvaluacion(
                    oferta.id,
                    'pendiente',
                    resultado.razon,
                    null,
                    errorMensaje,
                    null,
                    null,
                    explicacionParaGuardar,
                    oferta.descripcion,
                    ...(oferta.descripcion_modificada_en !== undefined ? [oferta.descripcion_modificada_en] : [])
                );
            } else if (explicacionParaGuardar) {
                resActualizacion = await modeloOferta.actualizarEvaluacion(
                    oferta.id,
                    estado,
                    resultado.razon,
                    resultado.porcentaje,
                    errorMensaje,
                    resultado.prioridad_ia || null,
                    resultado.error ? null : resultado.firma_criterios_evaluacion,
                    explicacionParaGuardar,
                    oferta.descripcion,
                    ...(oferta.descripcion_modificada_en !== undefined ? [oferta.descripcion_modificada_en] : [])
                );
            } else {
                resActualizacion = await modeloOferta.actualizarEvaluacion(
                    oferta.id,
                    estado,
                    resultado.razon,
                    resultado.porcentaje,
                    errorMensaje,
                    resultado.prioridad_ia || null,
                    resultado.error ? null : resultado.firma_criterios_evaluacion,
                    null,
                    oferta.descripcion,
                    ...(oferta.descripcion_modificada_en !== undefined ? [oferta.descripcion_modificada_en] : [])
                );
            }

            if (resActualizacion === null) {
                // La oferta fue modificada concurrentemente (p. ej. el usuario editó la descripción).
                // La evaluación se descarta como supersedida y la oferta permanece 'pendiente' con el nuevo texto.
                progresoEvaluacion.procesadas++;
                progresoEvaluacion.supersedidas++;
                resumen.supersedidas = (resumen.supersedidas || 0) + 1;
                resumen.detalle.push({
                    id: oferta.id,
                    titulo: oferta.titulo,
                    estado: 'supersedida_concurrencia',
                    razon: 'Evaluación descartada porque la oferta fue modificada concurrentemente; se conserva pendiente para el nuevo texto.',
                    error: false,
                    supersedida: true,
                });
            } else {
                if (opciones.guardarCache) {
                    await opciones.guardarCache();
                }

                progresoEvaluacion.procesadas++;
                if (tieneFallo) {
                    resumen.errores++;
                    progresoEvaluacion.errores++;
                    progresoEvaluacion.mensaje_error = resultado.razon;
                } else {
                    // Cuento todo resultado válido persistido, aunque su elegibilidad siga pendiente.
                    progresoEvaluacion.evaluadas++;
                    if (estado === 'aprobada') {
                        resumen.aprobadas++;
                        progresoEvaluacion.aprobadas++;
                    } else if (estado === 'rechazada') {
                        resumen.rechazadas++;
                        progresoEvaluacion.rechazadas++;
                    }
                }

                resumen.detalle.push({
                    id: oferta.id,
                    titulo: oferta.titulo,
                    estado,
                    razon: resultado.razon,
                    error: tieneFallo,
                });
            }

            progresoEvaluacion.pendientes = progresoEvaluacion.total - progresoEvaluacion.evaluadas;
            progresoEvaluacion.porcentaje = progresoEvaluacion.total > 0
                ? Math.round((progresoEvaluacion.procesadas / progresoEvaluacion.total) * 100)
                : 0;

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
        progresoEvaluacion.supersedidas = resumen?.supersedidas || 0;
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
        _workerActivo = false;
        _loteActivoId = null;
        if (resumen) Object.assign(resumen, progresoEvaluacion);
        if (errorLote) throw errorLote;
    }
}

/**
 * Rehidrata el progreso de evaluación desde el último lote persistido en BD.
 * Se ejecuta al arrancar el servidor para recuperar el estado si se reinició.
 * Si el último lote está 'activo' en BD pero no hay worker corriendo en memoria,
 * lo finaliza como 'error' y deja el progreso inactivo para no bloquear nuevas evaluaciones.
 * Esta función es completamente idempotente: llamadas sucesivas no duplican operaciones.
 */
async function rehidratarProgreso() {
    // Si ya hay un worker en curso en este proceso, evito clasificar erróneamente su lote.
    if (_workerActivo) {
        return;
    }

    try {
        const lote = await evaluacionLote.obtenerUltimoLote();

        if (lote) {
            let estadoFinal = lote.estado;
            let mensajeError = null;

            if (lote.estado === 'activo') {
                if (_workerActivo) {
                    return;
                }

                if (_ultimoLoteInterrumpidoId !== lote.id) {
                    let loteFinalizado = null;
                    try {
                        loteFinalizado = await evaluacionLote.finalizarLote(lote.id, 'error');
                    } catch (errLote) {
                        console.warn('[Evaluación] No se pudo finalizar lote interrumpido en BD:', errLote.message);
                        return;
                    }

                    if (!loteFinalizado || loteFinalizado.estado !== 'error') {
                        console.warn(`[Evaluación] No se pudo finalizar lote #${lote.id} interrumpido en BD: actualización retornó vacío.`);
                        return;
                    }

                    _ultimoLoteInterrumpidoId = lote.id;
                    lote.estado = 'error';
                    estadoFinal = 'error';
                    mensajeError = 'La evaluación previa fue interrumpida por reinicio del servidor.';
                } else {
                    lote.estado = 'error';
                    estadoFinal = 'error';
                    mensajeError = 'La evaluación previa fue interrumpida por reinicio del servidor.';
                }
            } else if (lote.estado === 'error') {
                mensajeError = progresoEvaluacion.mensaje_error || 'El lote terminó con errores. Revisá los resultados y las ofertas pendientes.';
            }

            progresoEvaluacion = {
                activo: false,
                estado: estadoFinal,
                mensaje_error: mensajeError,
                procesadas: (lote.evaluadas || 0) + (lote.errores || 0),
                pendientes: Math.max(0, (lote.total || 0) - (lote.evaluadas || 0)),
                total: lote.total || 0,
                evaluadas: lote.evaluadas || 0,
                aprobadas: lote.aprobadas || 0,
                rechazadas: lote.rechazadas || 0,
                errores: lote.errores || 0,
                supersedidas: 0,
                porcentaje: lote.porcentaje || 0,
            };

            console.log(`[Evaluación] Progreso rehidratado: lote #${lote.id}, estado: ${estadoFinal}, ${lote.porcentaje}%`);
        }
    } catch (err) {
        console.warn('[Evaluación] No se pudo rehidratar el progreso:', err.message);
    }
}

/**
 * Reintenta evaluar las ofertas que tuvieron un error técnico en los últimos 30 días.
 * Consulta las ofertas usando modeloOferta.obtenerOfertasConErrores().
 * Si no hay ofertas con errores, retorna de inmediato informándolo.
 * Si las hay, dispara el worker de evaluación en segundo plano únicamente para esas ofertas.
 *
 * @returns {Promise<Object>} Resumen con total de ofertas a reintentar y estado.
 */
async function reintentarErroresEvaluacion() {
    const ofertasConError = await modeloOferta.obtenerOfertasConErrores();

    if (!ofertasConError || ofertasConError.length === 0) {
        return {
            exito: true,
            total: 0,
            mensaje: 'No hay ofertas con errores de evaluación para reintentar.',
        };
    }

    evaluarOfertasPendientes(ofertasConError).catch((error) => {
        console.error('[Evaluación] Error en segundo plano al reintentar errores:', error.message);
    });

    return {
        exito: true,
        en_curso: true,
        total: ofertasConError.length,
        mensaje: `Reintento de evaluación iniciado para ${ofertasConError.length} oferta(s) con error.`,
    };
}

/**
 * Helper interno para pruebas: expone el estado interno del worker y lotes.
 */
function _obtenerEstadoInterno() {
    return {
        cancelarEvaluacion: _cancelarEvaluacion,
        workerActivo: _workerActivo,
        loteActivoId: _loteActivoId,
        ultimoLoteInterrumpidoId: _ultimoLoteInterrumpidoId,
    };
}

/**
 * Helper interno para pruebas: permite fijar workerActivo en tests unitarios.
 */
function _establecerWorkerActivo(activo) {
    _workerActivo = Boolean(activo);
}

/**
 * Helper interno para pruebas: resetea el estado interno entre ejecuciones de tests.
 */
function _resetearEstadoInterno() {
    _cancelarEvaluacion = false;
    _workerActivo = false;
    _loteActivoId = null;
    _ultimoLoteInterrumpidoId = null;
    progresoEvaluacion = {
        activo: false,
        total: 0,
        evaluadas: 0,
        aprobadas: 0,
        rechazadas: 0,
        errores: 0,
        supersedidas: 0,
        porcentaje: 0,
        estado: 'inactivo',
        mensaje_error: null,
        procesadas: 0,
        pendientes: 0,
    };
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
    reintentarErroresEvaluacion,
    _obtenerEstadoInterno,
    _establecerWorkerActivo,
    _resetearEstadoInterno,
};
