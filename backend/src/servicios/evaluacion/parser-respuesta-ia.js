// Parser estricto de respuesta IA — valida y normaliza lo que devuelve DeepSeek.
//
// Reglas del parser:
// 1. Limpio fences Markdown (```json ... ```) que DeepSeek suele agregar.
// 2. Parseo el JSON de la respuesta.
// 3. Valido que `match` sea boolean real (no string como "true" o "false").
// 4. Normalizo `porcentaje` al rango estricto [0, 100]. String vacío, null o fuera de rango retornan null.
// 5. Normalizo y sanitizo el desglose estructurado `explicacion` (cumplidos, no_cumplidos, por_confirmar, exclusiones).
// 6. Si falta `explicacion`, proveo fallback seguro con arrays vacíos y desglose_disponible: false.
// 7. Valido coherencia: match true con porcentaje < 60% es inconsistente; match false con porcentaje >= 60%
//    es inconsistente salvo que exista una exclusión justificada.
// 8. En caso de inconsistencia o invalidez, no forzo silenciosamente el match sino que marco inconsistente e invalido.

'use strict';

/**
 * Limpia fences Markdown que DeepSeek suele agregar alrededor del JSON.
 *
 * @param {string} texto - Texto crudo de la respuesta de DeepSeek.
 * @returns {string} Texto limpio sin fences Markdown.
 */
function limpiarFencesMarkdown(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
}

/**
 * Valida y convierte un porcentaje asegurando que esté dentro del rango estricto [min, max].
 * A diferencia de un clamp silencioso, si el número está fuera de rango o el string está vacío,
 * retorna defecto (null) para no falsear datos del modelo.
 *
 * @param {number|string} valor - Valor a evaluar.
 * @param {number} min - Límite inferior (default 0).
 * @param {number} max - Límite superior (default 100).
 * @param {number|null} defecto - Valor por defecto (default null).
 * @returns {number|null} Entero válido o null.
 */
function clampPorcentaje(valor, min = 0, max = 100, defecto = null) {
    let numero;
    if (typeof valor === 'number') {
        numero = valor;
    } else if (typeof valor === 'string') {
        const recortado = valor.trim();
        // En JS Number("") === 0. Un string vacío o solo espacios debe retornar null.
        if (recortado === '') return defecto;
        numero = Number(recortado);
    } else {
        return defecto;
    }

    if (!Number.isFinite(numero)) return defecto;
    if (numero < min || numero > max) return defecto;

    return Math.round(numero);
}

const TIPOS_REQUISITO_VALIDOS = new Set(['obligatorio', 'deseable', 'desconocido']);

/**
 * Sanitiza un item individual de la explicación estructurada.
 *
 * @param {Object} item - Item crudo recibido.
 * @returns {{ requisito: string, tipo: string, evidencia_oferta: string, evidencia_perfil: string, explicacion: string } | null}
 */
function sanitizarItemExplicacion(item) {
    if (!item || typeof item !== 'object') return null;

    let tipo = 'desconocido';
    if (typeof item.tipo === 'string') {
        const tipoLimpio = item.tipo.toLowerCase().trim();
        if (TIPOS_REQUISITO_VALIDOS.has(tipoLimpio)) {
            tipo = tipoLimpio;
        } else if (['excluyente', 'mandatory', 'requerido', 'obligatoria'].includes(tipoLimpio)) {
            tipo = 'obligatorio';
        } else if (['opcional', 'preferible', 'plus', 'deseada'].includes(tipoLimpio)) {
            tipo = 'deseable';
        }
    }

    const requisito = typeof item.requisito === 'string' ? item.requisito.trim() : '';
    const evidenciaOferta = typeof item.evidencia_oferta === 'string' ? item.evidencia_oferta.trim() : '';
    const evidenciaPerfil = typeof item.evidencia_perfil === 'string' ? item.evidencia_perfil.trim() : '';
    const explicacion = typeof item.explicacion === 'string' ? item.explicacion.trim() : '';

    return {
        requisito,
        tipo,
        evidencia_oferta: evidenciaOferta,
        evidencia_perfil: evidenciaPerfil,
        explicacion,
    };
}

/**
 * Normaliza y garantiza los cuatro arrays de la explicación estructurada.
 * Si no se proveyó explicación, devuelve una estructura vacía con desglose_disponible en false.
 *
 * @param {Object} explicacionCruda - Objeto explicacion de la respuesta.
 * @returns {{ explicacion: { cumplidos: Array, no_cumplidos: Array, por_confirmar: Array, exclusiones: Array }, desglose_disponible: boolean }}
 */
function normalizarExplicacion(explicacionCruda) {
    const estructuraVacia = {
        cumplidos: [],
        no_cumplidos: [],
        por_confirmar: [],
        exclusiones: [],
    };

    if (!explicacionCruda || typeof explicacionCruda !== 'object' || Array.isArray(explicacionCruda)) {
        return {
            explicacion: {
                ...estructuraVacia,
                desglose_disponible: false,
            },
            desglose_disponible: false,
        };
    }

    const limpiarLista = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
            .map(sanitizarItemExplicacion)
            .filter(item => item !== null && (item.requisito || item.evidencia_oferta || item.explicacion));
    };

    const cumplidos = limpiarLista(explicacionCruda.cumplidos);
    const noCumplidos = limpiarLista(explicacionCruda.no_cumplidos);
    const porConfirmar = limpiarLista(explicacionCruda.por_confirmar);
    const exclusiones = limpiarLista(explicacionCruda.exclusiones);

    const desgloseDisponible = cumplidos.length > 0 || noCumplidos.length > 0 || porConfirmar.length > 0 || exclusiones.length > 0;

    return {
        explicacion: {
            cumplidos,
            no_cumplidos: noCumplidos,
            por_confirmar: porConfirmar,
            exclusiones,
            desglose_disponible: desgloseDisponible,
        },
        desglose_disponible: desgloseDisponible,
    };
}

/** Umbral mínimo de porcentaje requerido para un match positivo en el sistema. */
const UMBRAL_MATCH_MINIMO = 60;

const PATRON_OPCIONAL_EVIDENCIA = /\b(?:deseables?|opcional(?:es)?|plus|preferibles?|preferentes?|preferentemente|valoramos|valorables?|nice[-\s]+to[-\s]+have|optional|preferred)\b|\bno[-\s]+(?:es[-\s]+)?(?:excluyente|obligatori[oa]|requerid[oa]|necesari[oa])\b/i;
const PATRON_NEGACION_EVIDENCIA = /\b(?:no[-\s]+(?:se[-\s]+)?(?:requiere\w*|exige\w*|necesita\w*|pedimos)|sin[-\s]+(?:necesidad|experiencia)|not[-\s]+required|do[-\s]+not[-\s]+require)\b/i;

/**
 * Escapo caracteres especiales para construir expresiones regulares seguras.
 *
 * @param {string} texto - Texto a escapar.
 * @returns {string} Texto seguro para RegExp.
 */
function escaparRegex(texto) {
    return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizo texto para comparar evidencias de la oferta sin sesgos de puntuación, mayúsculas o tildes.
 *
 * @param {string} texto - Texto a normalizar.
 * @returns {string} Texto en minúsculas, sin tildes, con caracteres especiales convertidos a espacios colapsados.
 */
function normalizarTextoComparacion(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Verifico si un texto normalizado contiene una evidencia normalizada respetando límites de token/palabra.
 * Como el texto normalizado contiene solo caracteres [a-z0-9] separados por espacios simples,
 * delimitamos el token con inicio/fin de cadena o espacios para evitar falsos positivos
 * (por ejemplo, que la cita 'Java' coincida indebidamente dentro de 'JavaScript').
 *
 * @param {string} textoNormalizado - Texto normalizado donde buscar.
 * @param {string} evidenciaNormalizada - Evidencia normalizada a buscar.
 * @returns {boolean} True si coincide como token o frase completa delimitada.
 */
function contieneTokenNormalizado(textoNormalizado, evidenciaNormalizada) {
    if (!textoNormalizado || !evidenciaNormalizada) return false;
    const patron = new RegExp(`(?:^|\\s)${escaparRegex(evidenciaNormalizada)}(?:\\s|$)`);
    return patron.test(textoNormalizado);
}

/**
 * Extrae oraciones y cláusulas contextualizadas del texto de la oferta,
 * preservando la categoría de encabezados de sección (p. ej. "Deseables:", "Requisitos obligatorios:")
 * hacia los elementos de lista o viñetas correspondientes, y evitando dividir nombres de tecnologías
 * con punto como "Node.js" o "ASP.NET".
 *
 * @param {string} textoOferta - Texto del aviso.
 * @returns {string[]} Lista de cláusulas normalizadas para verificación contextual.
 */
function extraerClausulasConContexto(textoOferta) {
    if (typeof textoOferta !== 'string' || !textoOferta.trim()) {
        return [];
    }

    // Normalizo saltos de línea y viñetas HTML si existieran
    const textoConSaltos = textoOferta
        .replace(/•|<li\b[^>]*>/gi, '\n- ')
        .replace(/<\/?(?:p|div|ul|ol|br|h[1-6])\b[^>]*>/gi, '\n');

    const lineas = textoConSaltos.split(/\r?\n+/);
    const clausulas = [];
    let seccionActual = null; // 'opcional' | 'obligatoria' | null

    for (const lineaCruda of lineas) {
        const linea = lineaCruda.trim();
        if (!linea) continue;

        const lineaNorm = normalizarTextoComparacion(linea);
        if (!lineaNorm) continue;

        let lineaAProcesar = linea;
        let huboEncabezadoEnLinea = false;

        // Detectamos si la línea comienza con un encabezado de sección (con ':' o como línea autónoma)
        const lineaSinVinetas = linea.replace(/^[-*•–—]\s*/, '').trim();
        const matchDosPuntos = lineaSinVinetas.match(/^([^:]{1,60}):\s*(.*)$/);

        if (matchDosPuntos) {
            const encabezadoTexto = matchDosPuntos[1].trim();
            const contenidoRestante = matchDosPuntos[2].trim();
            const encabezadoNorm = normalizarTextoComparacion(encabezadoTexto);

            // Es un encabezado si el prefijo tiene <= 4 palabras y refiere a una categoría conocida
            const esPrefijoEncabezado = encabezadoNorm && encabezadoNorm.split(' ').length <= 4 && (
                /^(?:requisitos|requirements|deseables?|opcionales?|obligatori[oa]s?|excluyentes?|plus|beneficios|responsabilidades|tareas)\b/.test(encabezadoNorm) ||
                /^(?:conocimientos|habilidades|competencias)\s+(?:deseables?|opcionales?|obligatori[oa]s?|excluyentes?|requerid[oa]s?)\b/.test(encabezadoNorm)
            );

            if (esPrefijoEncabezado) {
                huboEncabezadoEnLinea = true;
                if (PATRON_OPCIONAL_EVIDENCIA.test(encabezadoNorm)) {
                    seccionActual = 'opcional';
                } else if (/\b(?:obligatori[oa]s?|excluyentes?|mandatory|required)\b/i.test(encabezadoNorm) || /^(?:requisitos|requirements)$/.test(encabezadoNorm)) {
                    seccionActual = 'obligatoria';
                } else {
                    seccionActual = null;
                }

                if (!contenidoRestante) {
                    // Si no hay contenido tras los dos puntos, es un encabezado puro de lista
                    continue;
                }

                // Si hay contenido tras los dos puntos (ej. "Requisitos: Docker"),
                // procesamos ese contenido bajo la sección contextual recién actualizada
                lineaAProcesar = contenidoRestante;
            }
        } else {
            // Caso sin dos puntos: verificamos si la línea entera es un encabezado autónomo corto
            const palabrasLinea = lineaNorm.split(' ');
            const esEncabezadoPuro = palabrasLinea.length <= 4 && (
                /^(?:requisitos(?:\s+(?:obligatori[oa]s?|excluyentes?|deseables?))?|requirements|deseables?|opcionales?|obligatori[oa]s?|excluyentes?|plus|beneficios|responsabilidades|tareas)$/.test(lineaNorm) ||
                /^(?:conocimientos|habilidades|competencias)\s+(?:deseables?|opcionales?|obligatori[oa]s?|excluyentes?|requerid[oa]s?)$/.test(lineaNorm)
            );

            if (esEncabezadoPuro) {
                huboEncabezadoEnLinea = true;
                if (PATRON_OPCIONAL_EVIDENCIA.test(lineaNorm)) {
                    seccionActual = 'opcional';
                } else if (/\b(?:obligatori[oa]s?|excluyentes?|mandatory|required)\b/i.test(lineaNorm) || /^(?:requisitos|requirements)$/.test(lineaNorm)) {
                    seccionActual = 'obligatoria';
                } else {
                    seccionActual = null;
                }
                continue;
            }
        }

        // Si es un párrafo largo que no inicia con viñeta y no es un encabezado inline, corta el alcance de la lista
        const esItemLista = /^[-*•–—]\s*/.test(linea);
        const palabras = normalizarTextoComparacion(lineaAProcesar).split(' ');
        if (!huboEncabezadoEnLinea && !esItemLista && palabras.length > 15) {
            seccionActual = null;
        }

        // Divido la línea en oraciones respetando nombres de tecnologías con punto (ej. Node.js, ASP.NET)
        // Solo divido por punto cuando esté seguido de espacio o fin de línea: \.(?:\s+|$)
        // O por otros signos de puntuación: [!?;]
        const partes = lineaAProcesar.split(/(?:\.(?:\s+|$)|[!?;]|\n)+/).filter(p => p.trim());

        for (const parte of partes) {
            const parteNorm = normalizarTextoComparacion(parte);
            if (!parteNorm) continue;

            if (seccionActual === 'opcional') {
                clausulas.push(`deseable ${parteNorm}`);
            } else if (seccionActual === 'obligatoria') {
                clausulas.push(`obligatorio ${parteNorm}`);
            } else {
                clausulas.push(parteNorm);
            }
        }

        // Si el encabezado inline contenía un párrafo extenso sin viñeta, restablecemos para siguientes líneas
        if (huboEncabezadoEnLinea && !esItemLista && palabras.length > 15) {
            seccionActual = null;
        }
    }

    return clausulas;
}

/**
 * Valido la coherencia lógica interna entre el veredicto booleano, el porcentaje y las exclusiones,
 * contrastando las evidencias contra el texto real de la oferta y patrones de no obligatoriedad.
 *
 * @param {boolean} match - Veredicto de match.
 * @param {number|null} porcentaje - Porcentaje normalizado.
 * @param {Object} explicacion - Estructura normalizada de explicación.
 * @param {string|null} [textoOferta] - Texto de la oferta (título + descripción) para contraste contextual.
 * @returns {{ inconsistente: boolean, invalido: boolean, motivo: string|null }}
 */
function validarCoherenciaRespuesta(match, porcentaje, explicacion, textoOferta = null) {
    // Caso 1: porcentaje ausente, vacío, no numérico o fuera de rango.
    if (porcentaje === null || porcentaje === undefined) {
        return {
            inconsistente: true,
            invalido: true,
            motivo: 'El porcentaje es ausente, vacío, no numérico o fuera de rango [0, 100].',
        };
    }

    // Caso 2: match: true con porcentaje inferior al umbral mínimo del sistema.
    if (match === true && porcentaje < UMBRAL_MATCH_MINIMO) {
        return {
            inconsistente: true,
            invalido: true,
            motivo: `Respuesta contradictoria: match es true pero el porcentaje (${porcentaje}%) es menor al umbral mínimo (${UMBRAL_MATCH_MINIMO}%).`,
        };
    }

    // Caso 3: match: false con porcentaje alto (>= 60%).
    // Solo es consistente si existe al menos una exclusión obligatoria justificada con evidencia verificable de la oferta.
    if (match === false && porcentaje >= UMBRAL_MATCH_MINIMO) {
        const textoOfertaLimpio = typeof textoOferta === 'string' ? textoOferta.trim() : '';
        const textoOfertaNormalizado = textoOfertaLimpio ? normalizarTextoComparacion(textoOfertaLimpio) : null;

        const exclusionesValidas = Array.isArray(explicacion?.exclusiones)
            ? explicacion.exclusiones.filter((item) => {
                if (!item || typeof item !== 'object') return false;
                if (item.tipo !== 'obligatorio') return false;
                const tieneEvidenciaOferta = typeof item.evidencia_oferta === 'string' && item.evidencia_oferta.trim().length > 0;
                if (!tieneEvidenciaOferta) return false;

                const textoAEvaluar = `${item.evidencia_oferta} ${item.requisito || ''}`;
                if (PATRON_OPCIONAL_EVIDENCIA.test(textoAEvaluar) || PATRON_NEGACION_EVIDENCIA.test(textoAEvaluar)) {
                    return false;
                }

                if (textoOfertaNormalizado) {
                    const evidenciaNormalizada = normalizarTextoComparacion(item.evidencia_oferta);
                    if (!evidenciaNormalizada || !contieneTokenNormalizado(textoOfertaNormalizado, evidenciaNormalizada)) {
                        return false;
                    }

                    // Verifico que en el texto del aviso, las oraciones o cláusulas que contienen la cita
                    // no sean exclusivamente opcionales o deseables (evita falsos rechazos por palabras aisladas)
                    const oraciones = extraerClausulasConContexto(textoOferta);
                    const oracionesConEvidencia = oraciones.filter((o) => contieneTokenNormalizado(o, evidenciaNormalizada));

                    // Regla fail-closed: la ausencia de una cláusula que contenga completa la cita no equivale a prueba validada
                    if (oracionesConEvidencia.length === 0) {
                        return false;
                    }

                    const algunaEsValida = oracionesConEvidencia.some(
                        (o) => !PATRON_OPCIONAL_EVIDENCIA.test(o) && !PATRON_NEGACION_EVIDENCIA.test(o)
                    );
                    if (!algunaEsValida) {
                        return false;
                    }
                }

                return true;
            })
            : [];

        if (exclusionesValidas.length === 0) {
            return {
                inconsistente: true,
                invalido: true,
                motivo: `Respuesta contradictoria: match es false con porcentaje alto (${porcentaje}%) sin registrar ninguna exclusión obligatoria justificada con evidencia verificable de la oferta.`,
            };
        }
    }

    return {
        inconsistente: false,
        invalido: false,
        motivo: null,
    };
}

/** Razón fallback cuando la IA no provee una explicación usable. */
const RAZON_FALLBACK_MATCH = 'La oferta matchea con el perfil.';
const RAZON_FALLBACK_NO_MATCH = 'La oferta no matchea con el perfil.';

/**
 * Parsea y valida la respuesta textual de DeepSeek.
 *
 * Limpia fences Markdown, parsea JSON, valida tipos y verifica coherencia interna.
 *
 * @param {string} respuestaTexto - Respuesta cruda de DeepSeek.
 * @param {string|null} [textoOferta] - Texto de la oferta (título + descripción) para contraste contextual.
 * @returns {{ match: boolean, porcentaje: number|null, razon: string, prioridad_ia: boolean, evidencias_prioridad_ia: string[], explicacion: Object, desglose_disponible: boolean, error?: boolean, inconsistente?: boolean, invalido?: boolean }}
 */
function parsearRespuestaEvaluacionIa(respuestaTexto, textoOferta = null) {
    const textoLimpio = limpiarFencesMarkdown(respuestaTexto);

    let respuesta;
    try {
        respuesta = JSON.parse(textoLimpio);
    } catch {
        return {
            match: false,
            porcentaje: null,
            razon: 'No se pudo parsear la respuesta de DeepSeek: JSON inválido.',
            error: true,
            invalido: true,
            inconsistente: true,
            prioridad_ia: false,
            evidencias_prioridad_ia: [],
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
            desglose_disponible: false,
        };
    }

    if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
        return {
            match: false,
            porcentaje: null,
            razon: 'La respuesta de DeepSeek no es un objeto JSON válido.',
            error: true,
            invalido: true,
            inconsistente: true,
            prioridad_ia: false,
            evidencias_prioridad_ia: [],
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
            desglose_disponible: false,
        };
    }

    if (typeof respuesta.match !== 'boolean') {
        return {
            match: false,
            porcentaje: null,
            razon: 'El campo "match" debe ser boolean.',
            error: true,
            invalido: true,
            inconsistente: true,
            prioridad_ia: false,
            evidencias_prioridad_ia: [],
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
            desglose_disponible: false,
        };
    }

    const porcentaje = clampPorcentaje(respuesta.porcentaje);
    const { explicacion, desglose_disponible } = normalizarExplicacion(respuesta.explicacion);

    let razon = typeof respuesta.razon === 'string' ? respuesta.razon.trim() : '';
    if (razon.length === 0) {
        razon = respuesta.match ? RAZON_FALLBACK_MATCH : RAZON_FALLBACK_NO_MATCH;
    }

    const prioridadValida = typeof respuesta.prioridad_ia === 'boolean';
    const evidenciasValidas = Array.isArray(respuesta.evidencias_prioridad_ia)
        && respuesta.evidencias_prioridad_ia.length <= 3
        && respuesta.evidencias_prioridad_ia.every((evidencia) => typeof evidencia === 'string');

    const coherencia = validarCoherenciaRespuesta(respuesta.match, porcentaje, explicacion, textoOferta);
    if (coherencia.inconsistente) {
        razon = `${razon} [Inconsistencia detectada: ${coherencia.motivo}]`;
    }

    const resultado = {
        match: respuesta.match,
        porcentaje,
        razon,
        prioridad_ia: prioridadValida ? respuesta.prioridad_ia : false,
        evidencias_prioridad_ia: evidenciasValidas
            ? respuesta.evidencias_prioridad_ia.map((evidencia) => evidencia.slice(0, 120))
            : [],
        explicacion,
        desglose_disponible,
    };

    if (coherencia.inconsistente) {
        resultado.inconsistente = true;
        resultado.invalido = true;
        resultado.error = true;
    }

    return resultado;
}

module.exports = {
    parsearRespuestaEvaluacionIa,
    sanitizarItemExplicacion,
    normalizarExplicacion,
    validarCoherenciaRespuesta,
    UMBRAL_MATCH_MINIMO,
    PATRON_OPCIONAL_EVIDENCIA,
    PATRON_NEGACION_EVIDENCIA,
    normalizarTextoComparacion,
    // Exporto funciones internas para testing unitario.
    _internas: {
        limpiarFencesMarkdown,
        clampPorcentaje,
        sanitizarItemExplicacion,
        normalizarExplicacion,
        validarCoherenciaRespuesta,
        normalizarTextoComparacion,
        PATRON_OPCIONAL_EVIDENCIA,
        PATRON_NEGACION_EVIDENCIA,
        UMBRAL_MATCH_MINIMO,
        RAZON_FALLBACK_MATCH,
        RAZON_FALLBACK_NO_MATCH,
        contieneTokenNormalizado,
        extraerClausulasConContexto,
    },
};
