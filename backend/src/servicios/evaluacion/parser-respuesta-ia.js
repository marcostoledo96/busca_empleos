// Parser estricto de respuesta IA — valida y normaliza lo que devuelve DeepSeek.
//
// ¿Por qué existe este módulo?
// Antes, el parseo estaba inline en servicio-evaluacion.js y tenía un bug grave:
// `!!respuesta.match` convertía el string `"false"` en `true` (cualquier string
// no vacío es truthy en JavaScript). Esto hacía que ofertas rechazadas por la IA
// se aprobaran por error.
//
// Ahora el parseo es una función pura, testeable por separado, con validación
// estricta de tipos. Si DeepSeek devuelve `match: "false"` (string en vez de
// boolean), el parser lo rechaza como inválido en vez de interpretarlo mal.
//
// Reglas del parser:
// 1. Limpia fences Markdown (```json ... ```) que DeepSeek suele agregar.
// 2. Parsea el JSON de la respuesta.
// 3. Valida que `match` sea boolean real (no string como "true" o "false").
// 4. Normaliza `porcentaje` a entero 0-100 o null si falta/no es numérico.
// 5. Usa una razón fallback si la razón viene vacía o solo con espacios.
// 6. En caso de error de parseo, devuelve un rechazo seguro con `error: true`.

'use strict';

/**
 * Limpia fences Markdown que DeepSeek suele agregar alrededor del JSON.
 * Ejemplo de entrada:
 *   ```json
 *   {"match": true, "porcentaje": 80, "razon": "Compatible"}
 *   ```
 * Ejemplo de salida:
 *   {"match": true, "porcentaje": 80, "razon": "Compatible"}
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
 * Acota un número al rango [min, max].
 * Si el valor no es finito, retorna el valor por defecto.
 *
 * @param {number} valor - Número a acotar.
 * @param {number} min - Límite inferior (default 0).
 * @param {number} max - Límite superior (default 100).
 * @param {number|null} defecto - Valor por defecto si no es finito (default null).
 * @returns {number|null} Número acotado o null si no es finito.
 */
function clampPorcentaje(valor, min = 0, max = 100, defecto = null) {
    if (typeof valor === 'number' && Number.isFinite(valor)) {
        return Math.max(min, Math.min(max, Math.round(valor)));
    }
    // Si viene como string numérico (ej. "80"), lo intento convertir.
    if (typeof valor === 'string') {
        const numero = Number(valor);
        if (Number.isFinite(numero)) {
            return Math.max(min, Math.min(max, Math.round(numero)));
        }
    }
    return defecto;
}

/**
 * Razón fallback cuando la IA no provee una explicación usable.
 */
const RAZON_FALLBACK_MATCH = 'La oferta matchea con el perfil.';
const RAZON_FALLBACK_NO_MATCH = 'La oferta no matchea con el perfil.';

/**
 * Parsea y valida la respuesta textual de DeepSeek.
 *
 * Este es el parser estricto: limpia fences Markdown, parsea el JSON,
 * valida que los tipos sean correctos y normaliza el resultado.
 *
 * Reglas de validación:
 * - `match` DEBE ser boolean real. Strings como "true"/"false" son rechazados.
 * - `porcentaje` se normaliza a entero 0-100 si es numérico, null si falta.
 * - `razon` usa fallback si viene vacía o solo con espacios.
 * - Si el JSON no se puede parsear, devuelve rechazo seguro con error: true.
 *
 * @param {string} respuestaTexto - Respuesta cruda de DeepSeek.
 * @returns {{ match: boolean, porcentaje: number|null, razon: string, error?: boolean }}
 */
function parsearRespuestaEvaluacionIa(respuestaTexto) {
    // Paso 1: Limpiar fences Markdown.
    const textoLimpio = limpiarFencesMarkdown(respuestaTexto);

    // Paso 2: Intentar parsear JSON.
    let respuesta;
    try {
        respuesta = JSON.parse(textoLimpio);
    } catch (errorParseo) {
        // No se pudo parsear el JSON — rechazo seguro.
        return {
            match: false,
            porcentaje: null,
            razon: `No se pudo parsear la respuesta de DeepSeek: ${errorParseo.message}`,
            error: true,
        };
    }

    // Paso 3: Validar que `match` sea boolean real.
    // Si DeepSeek devuelve `match: "false"` (string), eso es un error:
    // en JavaScript `!!"false"` da true (string no vacío = truthy).
    if (typeof respuesta.match !== 'boolean') {
        return {
            match: false,
            porcentaje: null,
            razon: `El campo "match" debe ser boolean, se recibió: ${JSON.stringify(respuesta.match)}`,
            error: true,
        };
    }

    // Paso 4: Normalizar porcentaje.
    // Puede ser number, string numérico, null, o no estar presente.
    let porcentaje = null;
    if (respuesta.porcentaje !== undefined && respuesta.porcentaje !== null) {
        porcentaje = clampPorcentaje(respuesta.porcentaje);
    }

    // Paso 5: Normalizar razón con fallback.
    let razon = typeof respuesta.razon === 'string'
        ? respuesta.razon.trim()
        : '';
    if (razon.length === 0) {
        razon = respuesta.match
            ? RAZON_FALLBACK_MATCH
            : RAZON_FALLBACK_NO_MATCH;
    }

    // Paso 6: Retornar resultado validado y normalizado.
    return {
        match: respuesta.match,
        porcentaje,
        razon,
    };
}

module.exports = {
    parsearRespuestaEvaluacionIa,
    // Exporto funciones internas para testing unitario.
    _internas: {
        limpiarFencesMarkdown,
        clampPorcentaje,
        RAZON_FALLBACK_MATCH,
        RAZON_FALLBACK_NO_MATCH,
    },
};