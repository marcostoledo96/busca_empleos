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
const { parsearRespuestaEvaluacionIa, validarCoherenciaRespuesta, UMBRAL_MATCH_MINIMO, normalizarTextoComparacion, PATRON_OPCIONAL_EVIDENCIA, PATRON_NEGACION_EVIDENCIA,
    _internas: { contieneTokenNormalizado, extraerClausulasConContexto, aplicaAlRequisito, mencionesDelRequisito,
        noObligatoriaEnOferta, literalClausula, esDecorativa, citaContradictoria } } = require('./evaluacion/parser-respuesta-ia');
const reglasExclusion = require('./evaluacion/reglas-exclusion');
const { resolverModalidadOferta } = require('./servicio-normalizacion');
const { estaEnZonasPreferidas, detectarRestriccionRemotaIncompatible } = require('./evaluacion/criterio-ubicacion');
const { detectarPrioridadIa } = require('./evaluacion/detector-prioridad-ia');
const { construirPerfilDesdePreferencias, construirPerfilEfectivoCanonico, construirInstruccionesDesdePreferencias, construirPromptEvaluacion,
    plegarAfirmacionLiteral, leerAfirmacionEstudiantil } = require('./evaluacion/entradas-evaluacion');
const { construirIdentidadEvaluacion, crearFirmaCriterios, crearHash, construirEntradaOferta,
    VERSION_CONTRATO_EVALUACION, VERSION_CONTRATO_EVALUACION_ANTERIOR } = require('./evaluacion/identidad-evaluacion');
const { REEVALUACION_SOLICITADA, obtenerSituacionEvaluacion } = require('./evaluacion/situacion-evaluacion');

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

/** Reconozco sólo el marco declarado completo; no interpreto secciones arbitrarias del relato. */
function extraerFormacionConfirmada(perfil) {
    if (typeof perfil !== 'string') return null;
    const texto = perfil.replace(/\r\n/g, '\n');
    if (texto.split('Formación confirmada:').length !== 2 || texto.split('Experiencia y proyectos:').length !== 2) return null;
    const bloque = texto.match(/^Formación confirmada:\n([^\r\n]+)\n\nExperiencia y proyectos:\n([\s\S]+)$/);
    // Exijo inicio textual y rechazo marcas antes de que la normalización borre su significado.
    if (!bloque || !/^\s*\p{L}/u.test(bloque[1]) || /`|~~|<!--|-->/.test(bloque[1])) return null;
    return bloque[1].trim() && bloque[2].trim() ? bloque[1] : null;
}

function esRequisitoAcademico(requisito) {
    return /\b(?:tecnic[oa] superior|licenciatura|licenciad[oa]|titulo|titulacion|grado|doctorado|maestria|tecnicatura)\b/.test(requisito);
}

function formasAfirmacionAcademica(requisito, tituloSuperior) {
    return [
        ...(tituloSuperior ? [`soy ${requisito}`] : []),
        ...['obtuve la ', 'obtuve el ', 'complete la ', 'finalice la ', 'me gradue de la '].map(prefijo => `${prefijo}${requisito}`),
        ...[' confirmado', ' confirmada', ' obtenida', ' obtenido', ' completada', ' completado'].map(sufijo => `${requisito}${sufijo}`),
    ];
}

function acreditarFormacionLiteral(requisito, evidencia, fuente) {
    const titulo = plegarAfirmacionLiteral(requisito)?.replace(/\.$/, '');
    const cita = plegarAfirmacionLiteral(evidencia);
    const afirmacion = plegarAfirmacionLiteral(fuente);
    if (!titulo || !cita || !afirmacion) return false;
    return formasAfirmacionAcademica(titulo, /\btecnic[oa] superior\b/.test(titulo)).some(forma =>
        [forma, `${forma}.`].includes(afirmacion) && [forma, `${forma}.`].includes(cita));
}

/** Exijo una afirmación completa del hecho actual; una mención literal no acredita título ni residencia. */
function acreditarHechoActual(requisito, evidencia, hechos) {
    const tituloSuperior = /\btecnic[oa] superior\b/.test(requisito);
    const titulacion = esRequisitoAcademico(requisito);
    const residencia = /\b(?:residir|residencia)\b/.test(requisito);
    if (!titulacion && !residencia) return contieneTokenNormalizado(evidencia, requisito);
    // shortcut: sólo acredito hechos fuente completos y sin citas; un párrafo ambiguo requiere confirmación manual.
    if (!hechos.some(texto => typeof texto === 'string' && !/[«»“”"'‘’\r\n]/.test(texto.trim())
        && normalizarTextoComparacion(texto) === evidencia)) return false;
    const confirmado = [' confirmado', ' confirmada'].some(sufijo => evidencia === `${requisito}${sufijo}`);
    if (titulacion) return formasAfirmacionAcademica(requisito, tituloSuperior).includes(evidencia);
    const lugar = requisito.match(/^(?:residir|residencia(?: actual)?) (en .+)$/)?.[1];
    return confirmado || Boolean(lugar && ['resido ', 'resido actualmente ', 'vivo actualmente ']
        .some(prefijo => evidencia === `${prefijo}${lugar}`));
}

const ROTULO_ESTUDIANTE = /^(?:ser )?estudiantes? de /;

const ENCABEZADO_OBLIGATORIO = /^(?:requisitos? (?:obligatori[oa]s?|excluyentes?)|obligatori[oa]s?|excluyentes?|se (?:requiere|exige|necesita)) *:/;
const ENCABEZADO_REQUISITOS = /^requisitos? *:/;
const ENCABEZADO_DESEABLE = /^(?:requisitos? )?(?:deseables?|opcionales?) *:/;
const DEMANDA_ACADEMICA = /^(?:se (?:requiere|exige|necesita)|es (?:obligatorio|excluyente)) /;
const SUFIJO_OBLIGATORIO = / (?:es )?(?:obligatorio|excluyente|requerido)$/;
const VINETA_ACADEMICA = /^[-*•–—][\t\p{Zs}]+/u;
const ROTULO_TITULO = /^(?:(?:(?:contar con|tener) )?(?:el )?)?(?:egreso|egresad[oa]|graduad[oa]|titulo) de /;
const CONTINUACION_ACADEMICA = /^(?:con (?:el )?titulo|o de|esta condicion|aplica exclusivamente|solo para)\b|^(?:debe|se (?:debe|exige|requiere))\b.*\b(?:titulo|egreso)\b/;
const OBJETO_CONDICION = /^para (?:acreditar|cumplir|satisfacer) (?:este requisito|esta condicion|esta exigencia|(?<cursada>(?:el requisito|la condicion|la exigencia) de estudiantes?)),? /;
const CARRERA_EN_OBJETO = /^de (?:la carrera(?=, | )|(?:la carrera de |(?:la|el) (?=(?:licenciatura|tecnicatura|ingenieria|grado|maestria|doctorado)\b))?(?<carrera>[a-z0-9]+(?: [a-z0-9]+)*?))(?:, | (?=(?:(?:tambien )?(?:se (?:debe|exige|requiere|necesita)|es (?:obligatorio|necesario|indispensable)|debe|hace falta)|(?:ya )?no (?:basta|alcanza)|basta)\b))/;
const RESTRICCION_ACADEMICA = /^(?:(se (?:debe|exige|requiere|necesita)|es (?:obligatorio|necesario|indispensable)|debe|hace falta)|tambien (?:se (?:debe|exige|requiere|necesita)|es (?:obligatorio|necesario|indispensable)|debe|hace falta)|(?:ya )?no (?:basta|alcanza))\b/;
const RETIRO_GENERICO = /^(?:(?:ya )?no se (?:exige|requiere|necesita) (?:este requisito|esta condicion|esta exigencia)|(?:este requisito|esta condicion|esta exigencia) (?:ya )?no se (?:exige|requiere|necesita))\b/;
const RETIRO_ESTUDIANTE = /^(?:(?<cursada>(?:el requisito|la condicion|la exigencia) de estudiantes?)(?: de (?:la carrera(?=,? )|(?:la carrera de |(?:la|el) (?=(?:licenciatura|tecnicatura|ingenieria|grado|maestria|doctorado)\b))?(?<carrera>[a-z0-9]+(?: [a-z0-9]+)*?)))?,? (?:ya )?no (?:es (?:obligatori[oa]|excluyente|requerid[oa])|se (?:exige|requiere|necesita))\b|(?:ya )?no se (?:exige|requiere|necesita) (?<cursadaFinal>(?:el requisito|la condicion|la exigencia) de estudiantes?)(?: de (?:la carrera$|(?:la carrera de |(?:la|el) (?=(?:licenciatura|tecnicatura|ingenieria|grado|maestria|doctorado)\b))?(?<carreraFinal>[a-z0-9]+(?: [a-z0-9]+)*)))?$)/;
const CONTENIDO_ACADEMICO = /\b(?:estudiantes?|titulo|titulacion|egreso|graduacion)\b/;
const DESTINO_VACANTE_ACTUAL = /,? (?:(?:solo|solamente|unicamente|exclusivamente) )?(?:para|en) (?:(?<vacanteActual>(?:esta|la) (?:vacante|busqueda)(?: actual)?|(?:este|el) puesto(?: actual)?)|(?<otraVacante>otra (?:vacante|busqueda)|otro puesto))$/;
const DESTINO_ACLARACION = /,? (?:(?:solo|solamente|unicamente|exclusivamente) )?(?:(?:para|en) (?:el puesto|la vacante|la busqueda) de (?<puesto>[a-z0-9]+(?: [a-z0-9]+)*)|para (?:(?:la carrera de|la|el) )?(?<carrera>(?:licenciatura|tecnicatura|ingenieria|grado|maestria|doctorado) [a-z0-9]+(?: [a-z0-9]+)*))$/;

function separarAlcanceAcademico(texto) {
    const alcance = texto.match(DESTINO_VACANTE_ACTUAL);
    const sinAlcance = alcance ? texto.slice(0, alcance.index) : texto;
    const destino = sinAlcance.match(DESTINO_ACLARACION);
    const base = destino ? sinAlcance.slice(0, destino.index) : sinAlcance;
    return { base, destino, alcance };
}
const ARTICULO_CARRERA = /^(?:la carrera de |(?:la|el) (?=(?:licenciatura|tecnicatura|ingenieria|grado|maestria|doctorado|tecnic[oa] superior)\b))/;

function normalizarCarreraAcademica(texto) {
    return typeof texto === 'string' ? texto.replace(ARTICULO_CARRERA, '') : texto;
}

function normalizarTituloAcademico(texto) {
    const plegado = plegarAfirmacionLiteral(texto)?.replace(/\.$/, '');
    if (!plegado || ROTULO_ESTUDIANTE.test(plegado)) return null;
    const carrera = normalizarCarreraAcademica(plegado.replace(ROTULO_TITULO, ''));
    return ROTULO_TITULO.test(plegado) || /^(?:licenciatura|tecnicatura|ingenieria|grado|maestria|doctorado|tecnic[oa] superior)\b/.test(carrera)
        ? carrera : null;
}

const PREFIJO_CLAUSULA_TITULO = /^(?:(?:requisitos? (?:obligatori[oa]s?|excluyentes?|deseables?|opcionales?)|obligatori[oa]s?|excluyentes?|requisitos?|deseables?|opcionales?|se (?:requiere|exige|necesita))(?:: *| )|(?:se (?:requiere|exige|necesita)|es (?:obligatorio|excluyente)) )+/;
const COMILLAS_CITA = /[«»“”‘’"'`]/;
const PALABRA_CARACTER = /[\p{L}\p{N}]/u;
const ATRIBUCION_TRAS_CITA = /^(?:(?:(?:[a-z]+mente|[a-z]+ly|literal|textual|solo|solamente|unicamente|tambien|tampoco|ya|aun|todavia) +(?:(?:y|e|and) +)?){0,2})(?:como|segun|durante|para|por|en|de|del|al|a|con|sin|sobre|entre|hasta|desde|tras|ante|hacia|bajo|mediante|versus|vs|y|e|o|u|ni|pero|sino|aunque|porque|pues|que|quien|cual|donde|cuando|mientras|si|ya|no|solo|solamente|unicamente|tambien|tampoco|era|eran|es|son|fue|fueron|dijo|dice|decia|indica|indicaba|senala|senalaba|aclara|aclaraba|explica|explicaba|as|for|during|by|in|on|at|to|from|of|with|without|about|into|onto|over|under|through|between|after|before|until|since|and|or|nor|but|yet|so|because|while|when|where|if|that|which|who|is|are|was|were|be|been|has|have|had|said|says|stated|noted|explained|indicates|according)\b/;

function esAtribucionPosterior(linea, pos) {
    // Acoto la normalización al prefijo breve siguiente en O(1) por marca residual.
    const prefijo = linea.slice(pos + 1, pos + 65).match(/^[\t\p{Zs}]*([^\t\p{Zs}.]+(?:[\t\p{Zs}]+[^\t\p{Zs}.]+){0,3})/u)?.[1];
    return Boolean(prefijo && ATRIBUCION_TRAS_CITA.test(plegarAfirmacionLiteral(prefijo)));
}

function reducirSimplesO1(linea, tipo, tokens, intervalos) {
    const esCurva = tipo === 'curva';
    const pila = [];
    for (let pos = 0; pos < linea.length; pos++) {
        const ch = linea[pos];
        const prev = pos > 0 ? linea[pos - 1] : '';
        const next = pos + 1 < linea.length ? linea[pos + 1] : '';
        if (PALABRA_CARACTER.test(prev) && PALABRA_CARACTER.test(next)) continue;
        if (esCurva ? (ch !== '‘' && ch !== '’') : ch !== "'") continue;
        const esApertura = esCurva
            ? ch === '‘'
            : (!prev || /[\t\p{Zs}([:¿¡]/u.test(prev)) && (!next || !/[\t\p{Zs}.,;:!?)\]}]/u.test(next));
        if (esApertura) {
            pila.push(tokens.length);
            tokens.push({ pos, clase: 'O' });
            continue;
        }
        const clase = /[sS]/.test(prev) ? 'A' : 'C';
        const antesDePalabra = /^[\t\p{Zs}]+[\p{L}\p{N}]/u.test(linea.slice(pos + 1, pos + 8));
        const tope = pila.at(-1);
        const apertura = tope !== undefined ? tokens[tope] : null;
        const sinEspacios = apertura && !/[\t\p{Zs}]/u.test(linea.slice(apertura.pos + 1, pos));
        // Cierres sin ambigüedad de posesión prenominal se reducen en O(n).
        const cierreDirecto = apertura && tope === tokens.length - 1
            && (clase === 'C' || (sinEspacios && !antesDePalabra));
        if (cierreDirecto) {
            tokens.pop();
            pila.pop();
            intervalos.push([apertura.pos, pos]);
            continue;
        }
        tokens.push({ pos, clase, antesDePalabra });
        if (clase !== 'A') pila.length = 0;
    }
}

function unificarIntervalos(intervalos) {
    if (intervalos.length <= 1) return intervalos;
    const ordenados = [...intervalos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const resultado = [[ordenados[0][0], ordenados[0][1]]];
    for (let i = 1; i < ordenados.length; i++) {
        const [inicio, fin] = ordenados[i];
        const ultimo = resultado.at(-1);
        if (inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fin);
        else resultado.push([inicio, fin]);
    }
    return resultado;
}

function resolverIntervalosSimples(linea, tipo) {
    const tokens = [];
    const intervalos = [];
    reducirSimplesO1(linea, tipo, tokens, intervalos);
    const m = tokens.length;
    if (m === 0) return { desbalanceada: false, intervalos };
    if (m > 48) {
        let minOpen = 0;
        let maxOpen = 0;
        for (const tk of tokens) {
            if (tk.clase === 'O') { minOpen++; maxOpen++; }
            else if (tk.clase === 'C') {
                if (maxOpen === 0) return { desbalanceada: true, intervalos: [] };
                minOpen = Math.max(0, minOpen - 1);
                maxOpen--;
            } else {
                minOpen = Math.max(0, minOpen - 1);
            }
        }
        return { desbalanceada: minOpen !== 0, intervalos: minOpen === 0 ? [[0, linea.length - 1]] : [] };
    }
    const puntosHasta = new Int32Array(linea.length);
    let puntos = 0;
    for (let i = 0; i < linea.length; i++) {
        if (linea[i] === '.' && (i + 1 === linea.length || /[\t\p{Zs}]/u.test(linea[i + 1]))) puntos++;
        puntosHasta[i] = puntos;
    }
    const puedeCerrar = (l, k) => {
        const tk = tokens[k];
        if (tk.clase === 'C') return true;
        if (tk.clase !== 'A') return false;
        if (!tk.antesDePalabra || puntosHasta[tk.pos - 1] === puntosHasta[tokens[l].pos]) return true;
        return tk.atribucion ??= esAtribucionPosterior(linea, tk.pos);
    };
    const ok = Array.from({ length: m + 1 }, () => new Uint8Array(m + 1));
    for (let i = 0; i <= m; i++) ok[i][i] = 1;
    for (let len = 1; len <= m; len++) {
        for (let l = 0; l + len <= m; l++) {
            const r = l + len;
            const tk = tokens[l];
            if (tk.clase === 'A' && ok[l + 1][r]) {
                ok[l][r] = 1;
                continue;
            }
            if (tk.clase !== 'O') continue;
            for (let k = l + 1; k < r; k++) {
                if (puedeCerrar(l, k) && ok[l + 1][k] && ok[k + 1][r]) {
                    ok[l][r] = 1;
                    break;
                }
            }
        }
    }
    if (!ok[0][m]) return { desbalanceada: true, intervalos: [] };
    const outOk = Array.from({ length: m + 1 }, () => new Uint8Array(m + 1));
    const pares = Array.from({ length: m }, () => new Uint8Array(m));
    outOk[0][m] = 1;
    for (let len = m; len >= 1; len--) {
        for (let l = 0; l + len <= m; l++) {
            const r = l + len;
            if (!outOk[l][r]) continue;
            const tk = tokens[l];
            if (tk.clase === 'A' && ok[l + 1][r]) outOk[l + 1][r] = 1;
            if (tk.clase !== 'O') continue;
            for (let k = l + 1; k < r; k++) {
                if (puedeCerrar(l, k) && ok[l + 1][k] && ok[k + 1][r]) {
                    pares[l][k] = 1;
                    outOk[l + 1][k] = 1;
                    outOk[k + 1][r] = 1;
                }
            }
        }
    }
    for (let l = 0; l < m; l++) {
        for (let k = l + 1; k < m; k++) {
            if (pares[l][k]) intervalos.push([tokens[l].pos, tokens[k].pos]);
        }
    }
    return { desbalanceada: false, intervalos };
}

function analizarComillasLinea(linea, dividir = false) {
    const curvasSimples = resolverIntervalosSimples(linea, 'curva');
    const rectasSimples = resolverIntervalosSimples(linea, 'recta');
    let guillemets = 0;
    let curvas = 0;
    let dobles = false;
    let backticks = false;
    let negativa = false;
    const tramos = [];
    let inicio = 0;
    const intervalos = dividir ? unificarIntervalos([...curvasSimples.intervalos, ...rectasSimples.intervalos]) : [];
    let idxIntervalo = 0;
    for (let i = 0; i < linea.length; i++) {
        const ch = linea[i];
        const next = i + 1 < linea.length ? linea[i + 1] : '';
        if (ch === '«') guillemets++;
        else if (ch === '»') { if (--guillemets < 0) negativa = true; }
        else if (ch === '“') curvas++;
        else if (ch === '”') { if (--curvas < 0) negativa = true; }
        else if (ch === '"') dobles = !dobles;
        else if (ch === '`') backticks = !backticks;
        else if (dividir && ch === '.' && !guillemets && !curvas && !dobles && !backticks
            && (!next || /[\t\p{Zs}]/u.test(next))) {
            while (idxIntervalo < intervalos.length && intervalos[idxIntervalo][1] < i) idxIntervalo++;
            if (idxIntervalo >= intervalos.length || i < intervalos[idxIntervalo][0]) {
                const fragmento = linea.slice(inicio, i).trim();
                if (fragmento) tramos.push(fragmento);
                inicio = i + 1;
            }
        }
    }
    if (dividir) {
        const resto = linea.slice(inicio).trim();
        if (resto) tramos.push(resto);
    }
    const desbalanceada = negativa || guillemets !== 0 || curvas !== 0 || dobles || backticks
        || curvasSimples.desbalanceada || rectasSimples.desbalanceada;
    return { desbalanceada, tramos };
}

function descomponerClausulaTitulo(contenido) {
    const sinDemanda = contenido.replace(DEMANDA_ACADEMICA, '');
    const sinSufijoInicial = sinDemanda.replace(SUFIJO_OBLIGATORIO, '');
    const primero = separarAlcanceAcademico(sinSufijoInicial);
    const trasAlcance = primero.alcance || primero.destino?.groups.puesto ? primero.base : sinSufijoInicial;
    const sinSufijoFinal = trasAlcance.replace(SUFIJO_OBLIGATORIO, '');
    const demandaExplicita = sinDemanda !== contenido
        || sinSufijoInicial !== sinDemanda
        || sinSufijoFinal !== trasAlcance;
    return {
        base: sinSufijoFinal,
        alcance: primero.alcance || null,
        destino: primero.destino?.groups.puesto ? primero.destino : null,
        demandaExplicita,
    };
}

function normalizarClausulaTitulo(texto) {
    const clausula = plegarAfirmacionLiteral(texto)?.replace(/\.$/, '');
    if (!clausula) return null;
    const sinPrefijo = clausula.replace(PREFIJO_CLAUSULA_TITULO, '');
    return normalizarTituloAcademico(descomponerClausulaTitulo(sinPrefijo).base);
}
const REFERENCIAS_HISTORICAS = [
    ['retirada', /^(?:texto|fragmento|bloque|seccion) (?:eliminad[oa]|retirad[oa])$/],
    ['anterior', /^(?:vacante|aviso|version|texto|seccion) (?:anterior|previ[oa])$/],
    ['referencia', /^(?:texto|fragmento|bloque|seccion) de referencia$/],
];
const COMENTARIO_HISTORICO = /^(?:est[ea]|es[ea]) (?:texto|bloque|seccion|fragmento)(?: (?:anterior|previ[oa]|eliminad[oa]|retirad[oa]))? (?:era|fue|se incluyo) (?:solo|unicamente) (?:una|como) referencia$/;

function clasificarTramoAcademico(literal, lista, carreras) {
    const clausula = plegarAfirmacionLiteral(literal);
    const encabezado = clausula.match(ENCABEZADO_OBLIGATORIO) || clausula.match(ENCABEZADO_REQUISITOS)
        || clausula.match(ENCABEZADO_DESEABLE);
    const contenido = encabezado ? clausula.slice(encabezado[0].length).trim() : clausula;
    const exigencia = contenido.replace(DEMANDA_ACADEMICA, '').replace(SUFIJO_OBLIGATORIO, '');
    const obligatoria = lista === 'obligatoria' || ENCABEZADO_OBLIGATORIO.test(clausula) || exigencia !== contenido;
    const tramo = { literal, clausula, exigencia, obligatoria };
    if (COMILLAS_CITA.test(literal)) return { ...tramo, rol: 'ambiguo' };
    const opcional = exigencia.match(/^(?:para ([a-z0-9 ]+), )?(?:el )?(?:egreso|titulo)(?: de ([a-z0-9 ]+?))? (?:es )?(?:deseable|opcional)$/);
    if (opcional && !(opcional[1] && opcional[2])) return { ...tramo, rol: 'tituloOpcional', carrera: normalizarCarreraAcademica(opcional[1] ?? opcional[2]) };
    const sufijoDeseable = / (?:es )?(?:deseable|opcional)$/;
    const deseable = lista === 'deseable' || ENCABEZADO_DESEABLE.test(clausula)
        || /^se valora /.test(exigencia) || sufijoDeseable.test(exigencia);
    const estudiante = leerAfirmacionEstudiantil(exigencia.replace(/^se valora (?:ser )?|^ser /, '').replace(sufijoDeseable, ''));
    if (estudiante && (encabezado || lista || obligatoria || deseable)) {
        return { ...tramo, rol: 'estudiante', estudiante, deseable };
    }
    const { base: nucleoTitulo, alcance: alcanceTitulo, destino: destinoTitulo, demandaExplicita } = descomponerClausulaTitulo(contenido);
    const obligatoriaTitulo = !deseable && (lista === 'obligatoria' || ENCABEZADO_OBLIGATORIO.test(clausula) || demandaExplicita);
    const carreraTitulo = normalizarCarreraAcademica(nucleoTitulo.replace(ROTULO_TITULO, ''));
    if ((encabezado || lista || obligatoriaTitulo)
        && /^[a-z0-9]+(?: [a-z0-9]+)*$/.test(nucleoTitulo)
        && (carreras.has(carreraTitulo) || ROTULO_TITULO.test(nucleoTitulo)
            || /^(?:licenciatura|tecnicatura|maestria|doctorado|grado|tecnic[oa] superior)\b/.test(carreraTitulo))) {
        return {
            ...tramo,
            exigencia: nucleoTitulo,
            obligatoria: obligatoriaTitulo,
            ...(deseable ? { deseable: true } : {}),
            rol: 'titulo',
            carrera: carreraTitulo,
            ...(destinoTitulo?.groups.puesto ? { puesto: destinoTitulo.groups.puesto } : {}),
            ...(alcanceTitulo?.groups.otraVacante ? { otraVacante: true } : {}),
        };
    }
    const actual = clausula.match(/^la busqueda actual es para (?:(?:el puesto|la vacante|el equipo) de )?([a-z0-9]+(?: [a-z0-9]+)*)$/);
    if (actual) return { ...tramo, rol: 'vacanteActual', puesto: actual[1] };
    const destino = clausula.match(/^(?:lo indicado a continuacion aplica|la condicion siguiente corresponde) (?:al puesto|a la vacante|al equipo) de ([a-z0-9 ]+)$/)
        || clausula.match(/^(?:(?:solo|solamente|unicamente|exclusivamente|exclusiv[oa]) )?para (?:el puesto|la vacante|el equipo|el area) de ([a-z0-9]+(?: [a-z0-9]+)*):$/);
    if (destino) return { ...tramo, rol: 'destino', puesto: destino[1] };
    const cierre = clausula.match(/^(?:fin|cierre) (?:del|de la) (.+?):?$/);
    const apertura = clausula.match(/^(?:(?:reproducimos|se reproduce|citamos) (?:a continuacion|debajo) (?:el|la)|(?:lo que sigue|lo siguiente|lo indicado a continuacion) (?:corresponde|pertenece|aplica) a (?:una?|la|el)) (.+?):?$/);
    const claseReferencia = REFERENCIAS_HISTORICAS.find(([, etiqueta]) => etiqueta.test((cierre ?? apertura)?.[1]))?.[0];
    if (claseReferencia) return { ...tramo, rol: cierre ? 'cierreReferencia' : 'aperturaReferencia', claseReferencia };
    if (/^(?:lo|la) reproducimos (?:a continuacion|debajo) (?:solo|unicamente) como referencia:?$/.test(clausula)) {
        return { ...tramo, rol: 'aperturaReferencia', claseReferencia: 'referencia' };
    }
    if (/^modalidad(?: de trabajo)? *: *(?:remot[ao]|hibrid[ao]|presencial)$/.test(clausula)) {
        return { ...tramo, rol: 'modalidad' };
    }
    if (/^desarrollo con [a-z0-9.+#]+$/.test(clausula)
        || /^(?:postulacion: *|para postular(?:te|se)?, )?envia (?:tu|el) (?:cv|postulacion)(?: hasta el (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo))?$/.test(clausula)
        || /^postulacion: *completa (?:el|tu) formulario(?: (?:en el portal|de postulacion))?$/.test(clausula)
        || ((lista || encabezado || obligatoria) && /^(?:(?:experiencia|conocimientos?) (?:en|con|de) )?[a-z][a-z0-9.+#]*$/.test(exigencia))) {
        return { ...tramo, rol: 'independiente' };
    }
    return { ...tramo, rol: 'ambiguo' };
}

function exigenciasAcademicasLiterales(descripcion, cumplidos) {
    if (!descripcion) return [];
    // No interpreto declaraciones de vacante dentro de citas multilínea o bloques que puedan atravesar párrafos.
    if (/(?:^|\n)[\t ]*(?:>|`{3,}|~{3,})|<!--|<\/?(?:q|blockquote)\b|(?:^|[\s([:])'[^']*\n[^']*'|‘[^’]*\n/i.test(descripcion)) return [];
    const renglones = descripcion.split(/\r?\n/);
    if (renglones.some(linea => analizarComillasLinea(linea).desbalanceada)) return [];
    // El nombre permite distinguir una carrera sin prefijo; la obligación se toma del aviso.
    const carreras = new Set(cumplidos.map(({ requisito }) => plegarAfirmacionLiteral(requisito)?.replace(/\.$/, ''))
        .filter(rotulo => ROTULO_ESTUDIANTE.test(rotulo)).map(rotulo => rotulo.replace(ROTULO_ESTUDIANTE, '')));
    let puestoActual;
    let alcance = { vigente: true };
    const tramos = [];
    const cursadasVigentes = new Set();
    const cursadasRestringidas = new Set();
    const obligacionesRetiradas = new Set();
    const aclaracionesPendientes = [];
    let ultimaCursada;
    let lista = null;
    let listaConVinetas = false;
    let bloque = 0;
    const referencias = [];
    let trasCierre = false;
    let previo;
    for (const renglon of renglones) {
        const linea = renglon.trim();
        if (!linea) { bloque++; lista = null; listaConVinetas = false; continue; }
        const plegada = plegarAfirmacionLiteral(linea);
        const encabezado = plegada.match(ENCABEZADO_OBLIGATORIO) || plegada.match(ENCABEZADO_REQUISITOS)
            || plegada.match(ENCABEZADO_DESEABLE);
        if (encabezado?.[0] === plegada && !COMILLAS_CITA.test(linea)) {
            if (!referencias.length) {
                lista = ENCABEZADO_OBLIGATORIO.test(plegada) ? 'obligatoria' : ENCABEZADO_DESEABLE.test(plegada) ? 'deseable' : 'generica';
                listaConVinetas = false;
                ultimaCursada = undefined;
            }
            continue;
        }
        const esVineta = VINETA_ACADEMICA.test(linea);
        if (esVineta && lista) listaConVinetas = true;
        else if (!esVineta && listaConVinetas) {
            lista = null;
            listaConVinetas = false;
        }
        let listaRenglonValida = Boolean(lista && !esVineta);
        const tramosLinea = analizarComillasLinea(linea.replace(VINETA_ACADEMICA, ''), true).tramos;
        if (!tramosLinea.length) listaRenglonValida = false;
        for (const literal of tramosLinea) {
            const tramo = clasificarTramoAcademico(literal, lista, carreras);
            if (tramo.rol === 'aperturaReferencia') {
                referencias.push(tramo.claseReferencia);
                previo = undefined;
                ultimaCursada = undefined;
                lista = null;
                listaConVinetas = false;
                listaRenglonValida = false;
                bloque++;
                continue;
            }
            if (referencias.length) {
                // Una cabecera interna no redefine la vacante y un cierre sólo termina su propio alcance.
                if (tramo.rol === 'cierreReferencia' && tramo.claseReferencia === referencias.at(-1)) {
                    referencias.pop();
                    trasCierre = !referencias.length;
                    bloque++;
                }
                continue;
            }
            if (trasCierre && COMENTARIO_HISTORICO.test(tramo.clausula)) continue;
            trasCierre = false;
            const otroBloque = previo?.bloque !== bloque;
            if (tramo.rol === 'vacanteActual') {
                if (!alcance.vigente && otroBloque) alcance = { vigente: true };
                if (puestoActual && puestoActual !== tramo.puesto) alcance.ambiguo = true;
                puestoActual = tramo.puesto;
            } else if (tramo.rol === 'destino') {
                if (tramo.puesto !== puestoActual) alcance = { vigente: false };
                else if (!alcance.vigente && otroBloque) alcance = { vigente: true };
            }
            const encabezadoPrevio = previo?.alcance === alcance && previo.rol === 'ambiguo' && previo.literal.endsWith(':');
            const contexto = previo?.alcance === alcance && !otroBloque ? previo.contexto : {
                ambiguo: encabezadoPrevio,
                encabezadoAbierto: encabezadoPrevio,
            };
            let esContinuacion = false;
            if (tramo.rol === 'ambiguo' || tramo.rol === 'cierreReferencia') {
                const final = separarAlcanceAcademico(tramo.clausula);
                const objeto = tramo.clausula.match(OBJETO_CONDICION);
                const retiroEstudiante = final.base.match(RETIRO_ESTUDIANTE);
                const retiro = retiroEstudiante || tramo.clausula.match(RETIRO_GENERICO);
                const referenciaExplicita = objeto?.groups.cursada
                    || retiroEstudiante?.groups.cursada || retiroEstudiante?.groups.cursadaFinal;
                const alcanceExplicito = referenciaExplicita ? final.alcance : null;
                const destino = referenciaExplicita ? final.destino : null;
                const carreraEnObjeto = objeto?.groups.cursada
                    ? final.base.slice(objeto[0].length).match(CARRERA_EN_OBJETO) : null;
                const carreraBruta = carreraEnObjeto?.groups.carrera
                    || retiroEstudiante?.groups.carrera || retiroEstudiante?.groups.carreraFinal;
                const interna = carreraBruta ? separarAlcanceAcademico(carreraBruta) : null;
                const carreraReferencia = interna?.base || undefined;
                const finBase = alcanceExplicito ? alcanceExplicito.index : tramo.clausula.length;
                const recortaDestino = Boolean(destino && (destino.groups.puesto
                    || !carreraReferencia || destino.groups.carrera === carreraReferencia));
                const finPredicado = recortaDestino ? destino.index : finBase;
                const predicado = objeto
                    ? tramo.clausula.slice(objeto[0].length + (carreraEnObjeto?.[0].length || 0), finPredicado) : '';
                const restriccion = predicado.match(RESTRICCION_ACADEMICA);
                const carrera = carreraReferencia || destino?.groups.carrera;
                const cursadaNombrada = carrera && `estudiante de ${carrera}`;
                // Sin un antecedente local, sólo recupero una cursada vigente inequívoca si la aclaración la nombra.
                const cursada = cursadaNombrada ? (cursadasVigentes.has(cursadaNombrada) ? cursadaNombrada : undefined)
                    : ultimaCursada ?? (referenciaExplicita && alcance.vigente && cursadasVigentes.size === 1
                        ? cursadasVigentes.values().next().value : undefined);
                const puesto = destino?.groups.puesto || interna?.destino?.groups.puesto;
                const otraVacante = Boolean(alcanceExplicito?.groups.otraVacante || interna?.alcance?.groups.otraVacante
                    || (destino?.groups.puesto && interna?.destino?.groups.puesto
                        && destino.groups.puesto !== interna.destino.groups.puesto));
                const otroDestino = otraVacante || (puesto && puesto !== puestoActual)
                    || (cursadaNombrada && cursadaNombrada !== cursada);
                // Tras modalidad, una referencia genérica puede apuntar a la modalidad, no a la cursada.
                const aludeACursada = previo?.rol !== 'modalidad' || CONTENIDO_ACADEMICO.test(tramo.clausula);
                esContinuacion = Boolean((cursada || cursadaNombrada || destino || alcanceExplicito) && aludeACursada
                    && (retiro || restriccion || CONTINUACION_ACADEMICA.test(tramo.clausula)));
                if (otroDestino || (cursadaNombrada && cursadaNombrada !== ultimaCursada)) ultimaCursada = undefined;
                if (esContinuacion && cursada && !otroDestino && alcance.vigente && !alcance.ambiguo && !contexto.encabezadoAbierto) {
                    const reafirmaCursada = restriccion?.[1]
                        && predicado.slice(restriccion[1].length).trim().replace(/^ser /, '') === cursada;
                    if (retiro) obligacionesRetiradas.add(cursada);
                    else if (!reafirmaCursada) cursadasRestringidas.add(cursada);
                }
                if (referenciaExplicita && !cursada && !otraVacante && alcance.vigente && !alcance.ambiguo && !contexto.encabezadoAbierto
                    && (retiro || restriccion) && (cursadaNombrada || cursadasVigentes.size === 0)) {
                    aclaracionesPendientes.push({ retiro, restriccion, predicado, cursadaNombrada, puesto, alcance });
                }
                if (!esContinuacion || tramo.literal.endsWith(':')) contexto.ambiguo = true;
                if (tramo.literal.endsWith(':')) contexto.encabezadoAbierto = true;
            }
            if (tramo.rol === 'estudiante') {
                ultimaCursada = tramo.estudiante;
                if (alcance.vigente && !alcance.ambiguo) cursadasVigentes.add(ultimaCursada);
            } else if (tramo.rol !== 'modalidad' && !esContinuacion) ultimaCursada = undefined;
            if (listaRenglonValida && !['titulo', 'estudiante', 'independiente'].includes(tramo.rol)) {
                listaRenglonValida = false;
            }
            previo = { ...tramo, bloque, alcance, contexto, posicion: tramos.length };
            tramos.push(previo);
        }
        if (!esVineta && !listaRenglonValida) {
            lista = null;
            listaConVinetas = false;
        }
    }
    for (const pendiente of aclaracionesPendientes) {
        if (pendiente.alcance.ambiguo || (pendiente.puesto && pendiente.puesto !== puestoActual)) continue;
        const objetivos = pendiente.cursadaNombrada
            ? (cursadasVigentes.has(pendiente.cursadaNombrada) ? [pendiente.cursadaNombrada] : [])
            : [...cursadasVigentes];
        for (const objetivo of objetivos) {
            const reafirmaCursada = pendiente.restriccion?.[1]
                && pendiente.predicado.slice(pendiente.restriccion[1].length).trim().replace(/^ser /, '') === objetivo;
            if (pendiente.retiro) obligacionesRetiradas.add(objetivo);
            else if (!reafirmaCursada) cursadasRestringidas.add(objetivo);
        }
    }
    // shortcut: si no puedo separar el contexto de una condición dentro de la misma vacante, la dejo por confirmar.
    const vigentes = tramos.filter(({ alcance }) => alcance.vigente);
    const titulos = vigentes.filter(({ rol, otraVacante, puesto }) =>
        rol === 'titulo' && !otraVacante && (!puesto || puesto === puestoActual));
    const sinAmbiguedad = vigentes.filter(({ alcance, contexto }) => !alcance.ambiguo && !contexto.ambiguo);
    const opcionales = sinAmbiguedad.filter(({ rol }) => rol === 'tituloOpcional');
    const mencionesTitulo = [...titulos, ...opcionales.filter(({ carrera }) => carrera)];
    // La incertidumbre no acredita una cursada, pero tampoco permite omitir un título explícito.
    // Una segunda cita de la misma cursada vigente no elude su retiro o condición adicional.
    const estudiantes = sinAmbiguedad.filter(({ rol, estudiante, deseable }) => rol === 'estudiante'
        && !cursadasRestringidas.has(estudiante) && (deseable || !obligacionesRetiradas.has(estudiante)));
    return [...estudiantes, ...titulos.filter(titulo => !opcionales.some(opcional => {
        if (opcional.alcance !== titulo.alcance) return false;
        if (opcional.carrera) return opcional.carrera === titulo.carrera;
        return opcional.bloque === titulo.bloque && opcional.posicion > titulo.posicion
            && mencionesTitulo.every(otra => otra.alcance !== titulo.alcance || otra.bloque !== titulo.bloque
                || otra.carrera === titulo.carrera);
    }))];
}

function acreditarEstudianteLiteral(item, fuente, exigencias, esDeseable = false) {
    const afirmacion = leerAfirmacionEstudiantil(fuente);
    const requisito = plegarAfirmacionLiteral(item.requisito)?.replace(/^ser |\.$/g, '');
    if (!afirmacion || afirmacion !== requisito || plegarAfirmacionLiteral(fuente).replace(/\.$/, '')
        !== plegarAfirmacionLiteral(item.evidencia_perfil)?.replace(/\.$/, '')) return false;
    const cita = plegarAfirmacionLiteral(item.evidencia_oferta)?.replace(/\.$/, '');
    return exigencias.some(({ rol, clausula, exigencia, estudiante, deseable }) =>
        rol === 'estudiante' && deseable === esDeseable
        && (deseable ? estudiante : exigencia.replace(/^ser /, '')) === requisito
        && (cita === exigencia || cita === requisito || cita === clausula));
}

function requisitoVigilado(texto) {
    return texto.match(/\b(?:active directory|directorio activo|autorizacion laboral)\b/)?.[0];
}

const PATRON_OBLIGACION_EXPLICITA = /\b(?:obligatori[oa]s?|excluyentes?|mandatory|required|requerid[oa]s?|(?:se )?(?:requiere|exige|necesita)n?)\b/;
const ALCANCE_EQUIPO = / (?:solo|solamente|unicamente) para el equipo (.+)$/;
const SEPARADOR_EXIGENCIAS = / (?:y|e) (?=se (?:requiere|exige|necesita)n?\b)/;

function acreditaObligacionCitada(cita, requisito, evidencia) {
    const literal = literalClausula(cita);
    const citaConEncabezado = cita.texto === `obligatorio ${literal}` && contieneTokenNormalizado(evidencia, literal);
    if (!contieneTokenNormalizado(literal, evidencia) && cita.oracionMixta !== evidencia && !citaConEncabezado) return false;
    if (esDecorativa(cita.texto) || noObligatoriaEnOferta(cita)) return false;
    // Una segunda exigencia no cambia el alcance de la primera, aunque incluya alternativas.
    return cita.texto.split(SEPARADOR_EXIGENCIAS).some(fragmento => {
        // En la ruta acotada, la aplicabilidad del equipo se contrasta aparte.
        const condicion = fragmento.replace(ALCANCE_EQUIPO, '');
        if (!contieneTokenNormalizado(condicion, requisito) || /\b(?:o|u|or|(?:solo|solamente|unicamente) para)\b/.test(condicion)) return false;
        const lista = condicion.match(/^(?:obligatorio|(?:se )?(?:requiere|exige|necesita)n?|es obligatori[oa])(?: (?:conocer|dominar|manejar|contar con|experiencia (?:en|con)|conocimientos? (?:en|de)))? (.+)$/)?.[1]
            ?? condicion.match(/^(.+?) son (?:obligatori[oa]s|excluyentes|requerid[oa]s)\b/)?.[1];
        const [antes, despues = ''] = ` ${condicion} `.split(` ${requisito} `);
        return lista?.split(/ (?:y|e) /).includes(requisito)
            || (!antes.trim() && /^\s*(?:(?:es|son|resulta) )?(?:obligatori[oa]s?|excluyentes?|mandatory|required|requerid[oa]s?)\b/.test(despues));
    });
}

function dudaContextualBloqueante(item, clausulas, descripcion) {
    const requisito = normalizarTextoComparacion(item.requisito);
    const cita = normalizarTextoComparacion(item.evidencia_oferta);
    if (!contieneTokenNormalizado(cita, requisito)) return false;
    const relacionadas = mencionesDelRequisito(clausulas, requisito);
    if (relacionadas.some(noObligatoriaEnOferta)) return citaContradictoria(relacionadas, requisito, cita, descripcion);
    return relacionadas.some(clausula => {
        if (!contieneTokenNormalizado(literalClausula(clausula), cita) || esDecorativa(clausula.texto)) return false;
        const { texto } = clausula;
        const [antes, despues] = ` ${texto} `.split(` ${requisito} `);
        // El contexto se aplica también a los elementos coordinados de la misma cláusula.
        return /\b(?:obligatori[oa]|excluyente|se requiere|se solicita|se busca|experiencia (?:en|con)|conocimientos? (?:de|en)|trabaj(?:a|an|amos|ar) con|us(?:a|an|amos|ar)|utiliz(?:a|an|amos|ar)|menciona|stack(?: del equipo| tecnologico)?)(?: (?:[a-z0-9]+ )+(?:y|e|o))?\s*$/.test(antes)
            || /^\s*(?:(?:es|resulta) )?(?:obligatori[oa]|excluyente|requerid[oa])\b/.test(despues || '');
    });
}

/** Conservo afinidad y evidencia sin confundir elegibilidad desconocida con rechazo. */
function resolverElegibilidad(resultado, oferta, preferencias) {
    if (resultado.error || resultado.invalido || resultado.inconsistente) return resultado;
    const original = resultado.explicacion || { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] };
    const insuficienciaExplicita = original.por_confirmar?.some(item => item.requisito === 'Información suficiente de la oferta' && item.tipo !== 'deseable');
    const contrasteAcotado = !resultado.match && !insuficienciaExplicita;
    // Normalizo rótulos sintácticos sin convertirlos en evidencia ni reemplazar la cita del aviso.
    const normalizarCapacidad = texto => normalizarTextoComparacion(texto)
        .replace(/^(?:experiencia|conocimientos?|manejo|dominio) (?:con|en|de) /, '');
    const claveRequisito = item => normalizarCapacidad(item.requisito);
    const exclusionesObligatorias = new Set((original.exclusiones || []).filter(item => item.tipo === 'obligatorio').map(claveRequisito));
    const duplicaExclusion = item => exclusionesObligatorias.has(claveRequisito(item));
    const requiereContraste = item => (item.tipo !== 'deseable' && requisitoVigilado(normalizarTextoComparacion(item.requisito)))
        || (item.tipo === 'obligatorio' && resultado.porcentaje >= UMBRAL_MATCH_MINIMO && !item.evidencia_perfil?.trim());
    const bajoUmbral = contrasteAcotado && resultado.porcentaje < UMBRAL_MATCH_MINIMO;
    const contrastePrevio = !contrasteAcotado || [...(original.exclusiones || []), ...(original.por_confirmar || [])].some(requiereContraste);
    if (!bajoUmbral && !contrastePrevio && !exclusionesObligatorias.size) return resultado;
    const candidato = construirPerfilEfectivoCanonico(preferencias).candidato;
    const hechos = [candidato.perfil_profesional, candidato.nivel_real_seniority, candidato.idioma_candidato,
        ...candidato.stack_tecnologico, ...candidato.tecnologias_detalle.filter(t => t.nivel !== 'ninguno').flatMap(t => [t.nombre, t.evidencia])];
    if (Number.isFinite(candidato.anios_experiencia_reales) && candidato.anios_experiencia_reales >= 0) {
        const anios = candidato.anios_experiencia_reales;
        hechos.push(`${anios} ${anios === 1 ? 'año' : 'años'} de experiencia`);
    }
    const formacionConfirmada = extraerFormacionConfirmada(candidato.perfil_profesional);
    const ausencias = new Map(candidato.conocimientos_ausentes.map(nombre => [normalizarCapacidad(nombre), nombre]));
    const stack = candidato.stack_tecnologico.map(normalizarCapacidad);
    // Una pregunta o una frase citada no acredita una ausencia actual.
    const limitaciones = [candidato.perfil_profesional, candidato.limitaciones_explicitas]
        .flatMap(texto => typeof texto === 'string' ? texto.split(/\r?\n/) : [])
        .filter(linea => !/[¿?«»“”"'‘’`~<>]/.test(linea));
    // El título no convierte una mención deseable del cuerpo en obligación acreditada.
    const textoOferta = oferta.descripcion;
    const descripcionNormalizada = normalizarTextoComparacion(textoOferta);
    const citasConOrigen = extraerClausulasConContexto(textoOferta, true).filter(cita => !cita.encabezado);
    let exigencias;
    const exigenciasLiterales = () => exigencias ??= exigenciasAcademicasLiterales(textoOferta, original.cumplidos || []);
    const titulosOmitidos = new Map();
    const cursadasSinRespaldo = new Set();
    if (!contrasteAcotado && !bajoUmbral) for (const item of original.cumplidos || []) {
        const rotulo = plegarAfirmacionLiteral(item.requisito)?.replace(/\.$/, '');
        if (!ROTULO_ESTUDIANTE.test(rotulo)) continue;
        const obligatorio = item.tipo === 'obligatorio';
        // Un rótulo obligatorio sin respaldo ya queda pendiente en la guarda principal.
        if (obligatorio && !acreditarEstudianteLiteral(item, candidato.perfil_profesional, exigenciasLiterales())) continue;
        const carrera = normalizarCarreraAcademica(rotulo.replace(ROTULO_ESTUDIANTE, ''));
        const titulo = exigenciasLiterales().find(tramo => tramo.rol === 'titulo' && tramo.obligatoria && tramo.carrera === carrera);
        if (!titulo) continue;
        const deseableAcreditado = item.tipo === 'deseable'
            && acreditarEstudianteLiteral(item, candidato.perfil_profesional, exigenciasLiterales(), true);
        if (!obligatorio && !deseableAcreditado) cursadasSinRespaldo.add(item);
        const explicito = Object.values(original).flat().some(hecho => hecho?.tipo === 'obligatorio'
            && (normalizarTituloAcademico(hecho.requisito) === carrera
                || normalizarCarreraAcademica(plegarAfirmacionLiteral(hecho.requisito)?.replace(/\.$/, '')) === carrera
                || plegarAfirmacionLiteral(hecho.requisito)?.replace(/\.$/, '') === titulo.exigencia));
        if (!explicito) titulosOmitidos.set(titulo.exigencia, { requisito: titulo.exigencia, tipo: 'obligatorio',
            evidencia_oferta: titulo.literal, evidencia_perfil: '' });
    }
    const itemsDe = categoria => categoria === 'por_confirmar' ? [...(original[categoria] || []), ...titulosOmitidos.values()]
        : (original[categoria] || []).filter(item => !cursadasSinRespaldo.has(item));
    const revisarObligacion = (item, categoria) => (contrastePrevio && (requiereContraste(item) || (!contrasteAcotado && item.tipo === 'obligatorio')))
        || (categoria === 'exclusiones' && item.tipo === 'obligatorio');
    const acreditarAusencia = (item, requisito, vigilado) => {
        const nombres = [...new Set([requisito, claveRequisito(item), ...(vigilado ? [vigilado] : [])])];
        const ausenciaDeclarada = nombres.map(nombre => ausencias.get(nombre)).find(Boolean);
        const niegaRequisito = clausula => nombres.some(nombre =>
            ['no cuento con ', 'no tengo ', 'no poseo ', 'no dispongo de ', 'carezco de ', 'sin '].some(prefijo => clausula === `${prefijo}${nombre}`));
        const ausenciaLiteral = limitaciones.find(linea => niegaRequisito(normalizarTextoComparacion(linea)))?.trim()
            || limitaciones.flatMap(linea => extraerClausulasConContexto(linea)).find(niegaRequisito);
        return !nombres.some(nombre => stack.includes(nombre)) && (ausenciaDeclarada || ausenciaLiteral);
    };
    if (bajoUmbral) {
        const categorias = ['no_cumplidos', 'exclusiones', 'por_confirmar'];
        const nombre = item => normalizarTextoComparacion(item.requisito);
        const grupos = new Map();
        for (const categoria of categorias) {
            for (const item of original[categoria] || []) {
                const requisito = nombre(item);
                const grupo = grupos.get(requisito) || [];
                grupo.push({ item, afirmaIncumplimiento: categoria !== 'por_confirmar' && item.tipo === 'obligatorio' });
                grupos.set(requisito, grupo);
            }
        }
        const equiposVacante = new Set(citasConOrigen
            .map(cita => literalClausula(cita).match(/^la vacante corresponde al equipo (.+)$/)?.[1]).filter(Boolean));
        const decisiones = new Map();
        let corregirRazon = false;
        for (const [requisito, grupo] of grupos) {
            const negativas = grupo.filter(({ afirmaIncumplimiento }) => afirmaIncumplimiento).map(({ item }) => item);
            const relacionadas = mencionesDelRequisito(citasConOrigen, requisito);
            const evidencias = grupo.map(({ item }) => {
                const cita = normalizarTextoComparacion(item.evidencia_oferta);
                const relacionada = contieneTokenNormalizado(cita, requisito);
                return { item, cita, relacionada, contradictoria: relacionada
                    && citaContradictoria(relacionadas, requisito, cita, descripcionNormalizada) };
            });
            const acreditado = evidencias.find(({ item, cita: evidencia, relacionada, contradictoria }) => {
                if (!relacionada || contradictoria || (!negativas.length && item.tipo === 'deseable')) return false;
                return relacionadas.some(cita => {
                    const literal = literalClausula(cita);
                    const citaCompleta = cita.oracionMixta === evidencia
                        || (contieneTokenNormalizado(evidencia, literal) && contieneTokenNormalizado(descripcionNormalizada, evidencia));
                    // Si la cita abarca varios predicados, valido sólo el fragmento literal que exige este requisito.
                    return literal.split(SEPARADOR_EXIGENCIAS).some(fragmento => {
                        const citaLiteral = contieneTokenNormalizado(fragmento, evidencia) ? evidencia : citaCompleta ? fragmento : '';
                        if (!contieneTokenNormalizado(citaLiteral, requisito)) return false;
                        const equipo = fragmento.match(/ (?:(?:solo|solamente|unicamente) )?para el equipo (.+)$/)?.[1];
                        if (equipo && (equiposVacante.size !== 1 || !equiposVacante.has(equipo))) return false;
                        const clausula = { ...cita, texto: cita.texto.slice(0, -literal.length) + fragmento, fin: cita.inicio + fragmento.length };
                        return acreditaObligacionCitada(clausula, requisito, citaLiteral)
                            && !validarCoherenciaRespuesta(false, UMBRAL_MATCH_MINIMO,
                                { exclusiones: [{ ...item, tipo: 'obligatorio', evidencia_oferta: citaLiteral }] }, textoOferta).invalido;
                    });
                });
            })?.item;
            const vigilado = requisitoVigilado(requisito);
            const ausencia = acreditado && acreditarAusencia(acreditado, requisito, vigilado);
            // Una duda aislada sólo cambia si las dos fuentes respaldan el veto.
            if (!negativas.length && !ausencia) continue;
            const contradiccion = !acreditado && evidencias.find(({ contradictoria }) => contradictoria)?.item;
            const deseable = !acreditado && !contradiccion && evidencias.find(({ cita: evidencia, relacionada }) => {
                if (!relacionada) return false;
                const citadas = relacionadas.filter(cita => contieneTokenNormalizado(literalClausula(cita), evidencia));
                return citadas.length && citadas.every(noObligatoriaEnOferta);
            })?.item;
            const item = acreditado || contradiccion || deseable || negativas[0];
            if (ausencia) {
                const veto = { ...item, tipo: 'obligatorio', evidencia_perfil: ausencia,
                    explicacion: 'Incompatibilidad respaldada por una ausencia declarada del candidato.' };
                decisiones.set(requisito, { destino: 'exclusiones', item: veto });
                corregirRazon ||= grupo.some(({ item: previo }) =>
                    normalizarTextoComparacion(previo.evidencia_oferta) !== normalizarTextoComparacion(veto.evidencia_oferta)
                    || normalizarTextoComparacion(previo.evidencia_perfil) !== normalizarTextoComparacion(ausencia));
                continue;
            }
            corregirRazon = true;
            decisiones.set(requisito, { destino: 'por_confirmar', item: {
                ...item, tipo: contradiccion || (!acreditado && !deseable && vigilado) ? 'desconocido' : deseable ? 'deseable' : 'obligatorio',
                evidencia_oferta: acreditado || contradiccion || deseable ? item.evidencia_oferta : '', evidencia_perfil: '',
                explicacion: !acreditado && !deseable && vigilado && vigilado !== 'autorizacion laboral'
                    ? 'Confirmar si Active Directory es obligatorio y si contás con esa experiencia'
                    : 'Necesito confirmar el requisito y su cumplimiento con evidencia relacionada del aviso y del perfil; no acredito equivalencias ni incompatibilidad por omisión.',
            } });
        }
        if (!decisiones.size) return resultado;
        const explicacion = Object.fromEntries(['cumplidos', ...categorias].map(categoria =>
            [categoria, (original[categoria] || []).filter(item => !decisiones.has(nombre(item)))]));
        explicacion.no_cumplidos.push(...explicacion.exclusiones.filter(item => item.tipo === 'deseable'));
        explicacion.exclusiones = explicacion.exclusiones.filter(item => item.tipo !== 'deseable');
        for (const { destino, item } of decisiones.values()) {
            explicacion[destino].push(item);
            if (destino === 'exclusiones') explicacion.no_cumplidos.push(item);
        }
        const vetos = explicacion.exclusiones.filter(item => item.tipo === 'obligatorio');
        const { pendiente, ...base } = resultado;
        const afinidad = `Afinidad técnica estimada: ${resultado.porcentaje}%`;
        const razon = !corregirRazon ? resultado.razon : vetos.length
            ? `Incompatibilidad confirmada: ${vetos.map(item => item.requisito).join('; ')}. ${afinidad}.`
            : `${afinidad} (por debajo del umbral del ${UMBRAL_MATCH_MINIMO}%).`;
        return { ...base, ...(vetos.length ? { pendiente: false, prioridad_ia: null, desglose_disponible: true }
            : pendiente === true ? { pendiente } : {}), explicacion, razon };
    }
    const exclusionesCorroboradas = new Set();
    const revisados = new Map();
    for (const categoria of ['cumplidos', 'no_cumplidos', 'exclusiones', 'por_confirmar']) {
        for (const item of itemsDe(categoria)) {
            if (!revisarObligacion(item, categoria)) continue;
            const requisito = normalizarTextoComparacion(item.requisito);
            const perfil = normalizarTextoComparacion(item.evidencia_perfil);
            const ofertaCitada = normalizarTextoComparacion(item.evidencia_oferta);
            const clausulasOferta = citasConOrigen.filter(cita => aplicaAlRequisito(cita, requisito));
            const citasRelacionadas = clausulasOferta.map(cita => cita.texto).filter(clausula => contieneTokenNormalizado(clausula, ofertaCitada) && contieneTokenNormalizado(ofertaCitada, requisito));
            // Una cláusula mixta no permite atribuir el deseable de otro requisito a una obligación explícita.
            const soloDeseable = citasRelacionadas.length > 0 && citasRelacionadas.every(clausula =>
                PATRON_NEGACION_EVIDENCIA.test(clausula) || /\bno (?:es )?(?:obligatori[oa]|excluyente)\b/.test(clausula)
                || (!/\b(?:obligatori[oa]s?|excluyentes?|mandatory|required)\b/.test(clausula)
                    && (PATRON_OPCIONAL_EVIDENCIA.test(clausula) || /\bse valora(?:n)?\b/.test(clausula))));
            const vigilado = requisitoVigilado(requisito);
            const menciones = vigilado ? clausulasOferta.filter(({ texto }) => requisitoVigilado(texto) === vigilado) : [];
            const noObligatorio = ({ texto }) => PATRON_OPCIONAL_EVIDENCIA.test(texto) || PATRON_NEGACION_EVIDENCIA.test(texto) || /\bse valora(?:n)?\b/.test(texto);
            const contradiccion = citaContradictoria(mencionesDelRequisito(clausulasOferta, requisito), requisito, ofertaCitada, descripcionNormalizada);
            const noBloquea = !contradiccion && (vigilado ? menciones.length > 0 && menciones.every(noObligatorio) : soloDeseable);
            const coincideCita = ({ texto, oracionMixta }) => contieneTokenNormalizado(texto, ofertaCitada) || oracionMixta === ofertaCitada;
            const citaVigilada = vigilado && requisitoVigilado(ofertaCitada) === vigilado && menciones.some(coincideCita);
            // Una tarea neutral puede repetir un requisito; una contradicción explícita sí impide acreditarlo.
            const exclusionObligatoria = categoria === 'exclusiones' && item.tipo === 'obligatorio';
            const carreraTituloItem = normalizarTituloAcademico(item.requisito);
            const carreraOferta = normalizarClausulaTitulo(item.evidencia_oferta) ?? normalizarClausulaTitulo(ofertaCitada);
            const coincideOfertaTitulo = Boolean(carreraTituloItem && carreraOferta === carreraTituloItem
                && citasConOrigen.some(cita => !noObligatoriaEnOferta(cita)
                    && (contieneTokenNormalizado(literalClausula(cita), ofertaCitada)
                        || contieneTokenNormalizado(ofertaCitada, literalClausula(cita))
                        || cita.oracionMixta === ofertaCitada)
                    && normalizarClausulaTitulo(literalClausula(cita)) === carreraTituloItem)
                && exigenciasLiterales().some(tramo => tramo.rol === 'titulo'
                    && !tramo.deseable
                    && tramo.carrera === carreraTituloItem
                    && !tramo.alcance?.ambiguo && !tramo.contexto?.encabezadoAbierto
                    && (contieneTokenNormalizado(normalizarTextoComparacion(tramo.literal), ofertaCitada)
                        || contieneTokenNormalizado(ofertaCitada, normalizarTextoComparacion(tramo.literal))))
                && (!ROTULO_TITULO.test(requisito) || /\b(?:egreso|egresad[oa]|graduad[oa]|titulo)\b/.test(ofertaCitada)));
            const ofertaAcreditada = !contradiccion && (vigilado ? citaVigilada && !menciones.some(noObligatorio)
                && menciones.some(cita => coincideCita(cita)
                    && PATRON_OBLIGACION_EXPLICITA.test(cita.texto))
                : (contieneTokenNormalizado(ofertaCitada, requisito) || coincideOfertaTitulo)
                    && (exclusionObligatoria || resultado.match || citasRelacionadas.length > 0)
                    && !validarCoherenciaRespuesta(false, UMBRAL_MATCH_MINIMO, { exclusiones: [item] }, textoOferta).invalido);
            // La prueba del veto sale del perfil, no de la afirmación del modelo o de una decisión cacheada.
            const ausenciaAcreditada = acreditarAusencia(item, requisito, vigilado);
            // La nueva fuente sólo participa en obligaciones académicas, nunca en residencia o capacidades.
            const fuentesCumplimiento = esRequisitoAcademico(requisito) && formacionConfirmada
                && acreditarFormacionLiteral(item.requisito, item.evidencia_perfil, formacionConfirmada)
                ? [...hechos, formacionConfirmada] : hechos;
            const cumplimientoAcreditado = ofertaAcreditada && !ausencias.has(claveRequisito(item))
                && (ROTULO_ESTUDIANTE.test(requisito)
                    ? acreditarEstudianteLiteral(item, candidato.perfil_profesional, exigenciasLiterales())
                    // Mantengo procedencia literal y cláusula autónoma también para la línea académica.
                    : acreditarHechoActual(requisito, perfil, fuentesCumplimiento)
                        && fuentesCumplimiento.some(texto => typeof texto === 'string' && contieneTokenNormalizado(normalizarTextoComparacion(texto), perfil))
                        && fuentesCumplimiento.filter(texto => typeof texto === 'string').flatMap(extraerClausulasConContexto).includes(perfil)
                        && !/\b(?:no|sin|nunca|not|never|ningun[oa]?|carezco|aspiro|pendiente)\b/.test(perfil)
                        && !PATRON_OPCIONAL_EVIDENCIA.test(perfil));
            if (!contrastePrevio && exclusionObligatoria && ofertaAcreditada && !noBloquea && ausenciaAcreditada && ausenciaAcreditada === item.evidencia_perfil) {
                exclusionesCorroboradas.add(item);
            }
            const destino = noBloquea ? 'por_confirmar' : ofertaAcreditada && ausenciaAcreditada ? 'exclusiones'
                : categoria === 'cumplidos' && cumplimientoAcreditado ? 'cumplidos' : 'por_confirmar';
            const motivoAmbiguo = vigilado && vigilado !== 'autorizacion laboral' && !noBloquea && !ofertaAcreditada
                ? 'Confirmar si Active Directory es obligatorio y si contás con esa experiencia' : null;
            const prioridad = { cumplidos: 1, por_confirmar: 2, exclusiones: 3 };
            if (prioridad[revisados.get(requisito)?.destino] > prioridad[destino]) continue;
            revisados.set(requisito, { destino, item: destino === 'cumplidos' ? item : {
                ...item, tipo: contradiccion ? 'desconocido'
                    : noBloquea ? 'deseable' : vigilado ? (ofertaAcreditada ? 'obligatorio' : 'desconocido') : item.tipo,
                evidencia_oferta: contradiccion || ofertaAcreditada || noBloquea || citaVigilada ? item.evidencia_oferta : '',
                evidencia_perfil: destino === 'exclusiones' ? ausenciaAcreditada : '',
                explicacion: destino === 'exclusiones' ? 'Incompatibilidad respaldada por una ausencia declarada del candidato.'
                    : motivoAmbiguo || 'Necesito confirmar el requisito y su cumplimiento con evidencia relacionada del aviso y del perfil; no acredito equivalencias ni incompatibilidad por omisión.',
            } });
        }
    }
    if (!contrastePrevio && (original.exclusiones || []).every(item => exclusionesCorroboradas.has(item))
        && !(original.no_cumplidos || []).some(duplicaExclusion)) return resultado;
    const explicacion = Object.fromEntries(['cumplidos', 'no_cumplidos', 'por_confirmar', 'exclusiones']
        .map(categoria => [categoria, itemsDe(categoria).filter(item => !revisarObligacion(item, categoria)
            && !(categoria === 'no_cumplidos' && duplicaExclusion(item)))]));
    // Un deseable no constituye una exclusión, tampoco en la presentación.
    explicacion.no_cumplidos.push(...explicacion.exclusiones.filter(item => item.tipo === 'deseable'));
    explicacion.exclusiones = explicacion.exclusiones.filter(item => item.tipo !== 'deseable');
    for (const { destino, item } of revisados.values()) {
        explicacion[destino].push(item);
        if (destino === 'exclusiones') explicacion.no_cumplidos.push(item);
    }
    const vetos = explicacion.exclusiones.filter(item => item.tipo === 'obligatorio');
    if (vetos.length) return {
        ...resultado, match: false, pendiente: false, prioridad_ia: null, explicacion, desglose_disponible: true,
        razon: `Incompatibilidad confirmada: ${vetos.map(item => item.requisito).join('; ')}. Afinidad técnica estimada: ${resultado.porcentaje}%.`,
    };
    const parcial = oferta.descripcion_completitud === 'parcial' || oferta.origen_descripcion === 'tarjeta';
    const evidenciaSuficiente = explicacion.cumplidos?.some(item => item.evidencia_oferta?.trim() && item.evidencia_perfil?.trim());
    const faltaInformacion = (parcial && !evidenciaSuficiente) || explicacion.por_confirmar?.some(
        item => item.requisito === 'Información suficiente de la oferta' && item.tipo !== 'deseable'
    );
    const requiereConfirmacion = item => item.tipo === 'obligatorio' || (item.tipo === 'desconocido'
        && dudaContextualBloqueante(item, citasConOrigen, descripcionNormalizada));
    const obligatoriosPendientes = explicacion.por_confirmar.filter(requiereConfirmacion);
    if (!faltaInformacion && !obligatoriosPendientes.length) {
        if (contrasteAcotado) {
            const coherencia = validarCoherenciaRespuesta(false, resultado.porcentaje, explicacion, textoOferta);
            if (coherencia.invalido) return { ...resultado, pendiente: false, error: true, invalido: true, inconsistente: true,
                razon: `No se pudo validar la respuesta de DeepSeek: ${coherencia.motivo}`, explicacion };
        }
        return { ...resultado, explicacion };
    }
    const porConfirmar = [...(explicacion.por_confirmar || [])];
    if (faltaInformacion && !porConfirmar.some(item => item.requisito === 'Información suficiente de la oferta')) porConfirmar.push({
        requisito: 'Información suficiente de la oferta', tipo: 'desconocido',
        evidencia_oferta: '', evidencia_perfil: '',
        explicacion: 'El extracto no aporta evidencia de cumplimiento suficiente; el título no acredita elegibilidad.',
    });
    return {
        ...resultado, pendiente: true, prioridad_ia: null,
        razon: `Pendiente de confirmación: ${porConfirmar.filter(item => requiereConfirmacion(item) || item.requisito === 'Información suficiente de la oferta').map(item => item.requisito).join('; ')}. Afinidad técnica estimada: ${resultado.porcentaje}%.`,
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
        function resolverYFirmar(resultado) {
            const resuelto = resolverElegibilidad(incorporarConflictos(resultado), oferta, preferenciasFinal);
            const fallo = resuelto.error || resuelto.invalido || resuelto.inconsistente;
            if (fallo && !resultado.error) registrarFallo('RESPUESTA_INVALIDA');
            return { ...resuelto, firma_criterios_evaluacion: fallo ? null : firma };
        }
        async function guardarResultado(resultado, deterministico = false) {
            const firmado = deterministico ? { ...resultado, firma_criterios_evaluacion: firma } : resolverYFirmar(resultado);
            // La caché es opcional; en el worker la confirmo después del UPDATE.
            const confirmar = async () => {
                if (!firmado.firma_criterios_evaluacion) return;
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
                return opciones.forzar ? await guardarResultado(rechazo, true) : rechazo;
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
                return opciones.forzar ? await guardarResultado(rechazo, true) : rechazo;
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
                return opciones.forzar ? await guardarResultado(rechazo, true) : rechazo;
            }
        }

        // Sin cuerpo no hay evaluación válida, salvo que una defensa anterior ya haya acreditado un veto.
        if (!oferta.descripcion?.trim()) {
            return {
                match: false, pendiente: true, porcentaje: null, error: false,
                razon: 'Sin evaluar: falta la descripción de la oferta.',
                firma_criterios_evaluacion: null,
                explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [] },
                desglose_disponible: false,
            };
        }

        // ── Paso 2: Llamada a DeepSeek ──
        // Solo llego acá si las reglas de exclusión no se activaron.
        // Las defensas vigentes siempre se ejecutan antes de aceptar un hit.
        if (!opciones.forzar) {
            try {
                const cacheado = await evaluacionCache.buscarCache(identidad.hash_oferta, firma, modeloFinal);
                if (cacheado && !cacheado.error) return resolverYFirmar(cacheado);
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
        const respuesta = parsearRespuestaEvaluacionIa(respuestaTexto, textoOferta, oferta.descripcion);

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
        if (respuesta.match && !respuesta.error && preferenciasFinal) {
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
                }, true);
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
            SALIDA_TRUNCADA: 'DeepSeek terminó la respuesta antes de completarla. No se obtuvo una evaluación nueva válida.',
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
        por_confirmar: 0,
        bajo_umbral: 0,
    };

    try {
        // Leo las preferencias UNA sola vez para todo el lote.
        const prefs = structuredClone((await modeloPreferencia.obtenerPreferencias()) || {});
        const instrucciones = construirInstruccionesDesdePreferencias(prefs);
        const modeloIA = normalizarModeloDeepSeek(prefs.modelo_ia_evaluacion || prefs.modelo_ia || DEEPSEEK_MODELO);

        let pendientes = seleccionadas;
        if (!pendientes) {
            // Reconozco el prompt anterior sólo para no reactivar pendientes históricos por un cambio de instrucciones.
            const instruccionesPrevias = construirInstruccionesDesdePreferencias(prefs, { omitirExcepcionEstudiantil: true });
            const versionesEstables = new Map([VERSION_CONTRATO_EVALUACION, VERSION_CONTRATO_EVALUACION_ANTERIOR]
                .flatMap(version => [...new Set([instrucciones, instruccionesPrevias])].map(mensaje =>
                    [crearFirmaCriterios(prefs, { instrucciones: mensaje, modelo: modeloIA, version }), version])));
            pendientes = (await modeloOferta.obtenerOfertasPendientes()).filter(oferta => {
                const version = versionesEstables.get(oferta.firma_criterios_evaluacion);
                if (!version || obtenerSituacionEvaluacion(oferta) !== 'por_confirmar') return true;
                const hashAnterior = oferta.explicacion_evaluacion.hash_oferta;
                // La versión sola no crea trabajo ordinario. Sin huella, conservo las invalidaciones SQL existentes.
                return hashAnterior != null && hashAnterior !== crearHash(construirEntradaOferta(oferta, version));
            });
        }

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
            const forzar = Boolean(seleccionadas) || oferta.evaluacion_error_mensaje === REEVALUACION_SOLICITADA;
            const opciones = { forzar, diferirCache: true };
            const resultado = await evaluarOferta(oferta, instrucciones, modeloIA, prefs, opciones);
            const esInconsistente = Boolean(resultado.invalido || resultado.inconsistente);
            const tieneFallo = Boolean(resultado.error || esInconsistente);
            const sinEvaluar = !tieneFallo && !resultado.firma_criterios_evaluacion;
            const eraPorConfirmar = obtenerSituacionEvaluacion(oferta) === 'por_confirmar';
            const conservarAnterior = tieneFallo && (eraPorConfirmar
                || (forzar && ['aprobada', 'rechazada'].includes(oferta.estado_evaluacion)
                    && Boolean(oferta.fecha_evaluacion)
                    && (!oferta.evaluacion_error_mensaje || oferta.razon_evaluacion !== oferta.evaluacion_error_mensaje)));
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

            if (sinEvaluar && (eraPorConfirmar || oferta.evaluacion_error_mensaje)) {
                // No sobrescribo una decisión o un intento previo si no pude evaluar contenido nuevo.
                resActualizacion = oferta;
            } else if (conservarAnterior) {
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
                    estado === 'pendiente' ? { ...explicacionParaGuardar, hash_oferta: crearHash(construirEntradaOferta(oferta)) } : explicacionParaGuardar,
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
                } else if (!sinEvaluar) {
                    // Cuento todo resultado válido persistido, aunque su elegibilidad siga pendiente.
                    progresoEvaluacion.evaluadas++;
                    const situacion = resActualizacion && obtenerSituacionEvaluacion(resActualizacion);
                    // En este lote sí conozco la respuesta validada, aun si no trajo desglose persistible.
                    const bajoUmbralSinDesglose = situacion === 'legado' && estado === 'rechazada' && resultado.desglose_disponible === false
                        && Number.isInteger(resultado.porcentaje) && resultado.porcentaje < UMBRAL_MATCH_MINIMO;
                    if (situacion === 'por_confirmar') progresoEvaluacion.por_confirmar++;
                    if (situacion === 'bajo_umbral' || bajoUmbralSinDesglose) progresoEvaluacion.bajo_umbral++;
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
                procesadas: estadoFinal === 'completado' ? (lote.total || 0) : (lote.evaluadas || 0) + (lote.errores || 0),
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
