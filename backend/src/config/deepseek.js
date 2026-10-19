// Configuración del cliente de IA para evaluación de ofertas.
//
// Uso la API de DeepSeek directamente (formato compatible con OpenAI).
// Es el mismo endpoint que usa ChatGPT: chat/completions con roles system/user.
//
// ¿Por qué no uso el SDK de OpenAI? Porque Node.js 22 ya tiene fetch() nativo.
// Con una sola función que hace un POST puedo hablar con la API sin agregar
// dependencias extra. Menos dependencias = menos cosas que pueden fallar.
//
// Si algún día quisiera cambiar a OpenAI o a otro proveedor compatible,
// solo cambiaría la URL y la API key. El formato de request/response es el mismo.

const path = require('path');

// Cargo las variables de entorno.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// URL de la API de DeepSeek (compatible con formato OpenAI).
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

// Mantengo un catálogo estático; estos identificadores no fijan versiones inmutables.
const MODELOS_DEEPSEEK = Object.freeze(['deepseek-flash', 'deepseek-v4-pro']);
const DEEPSEEK_MODELO = 'deepseek-flash';

function normalizarModeloDeepSeek(modelo) {
    return modelo === 'deepseek-v4-flash' ? DEEPSEEK_MODELO : modelo;
}

// Comparto solo parámetros que afectan la decisión. El timeout queda fuera de la firma.
// Mantengo razonamiento bajo hasta comparar calidad con la alternativa deshabilitada.
const CONFIGURACION_DECISION = Object.freeze({
    thinking: Object.freeze({ type: 'enabled' }),
    reasoning_effort: 'low',
    response_format: Object.freeze({ type: 'json_object' }),
    max_tokens: 4096,
});
const CONFIGURACION_IMPORTACION = Object.freeze({ ...CONFIGURACION_DECISION, max_tokens: 16384 });
const TIMEOUT_EVALUACION_MS = 60000;
const TIMEOUT_IMPORTACION_MS = 120000;

// La API key de DeepSeek viene del .env. NUNCA se hardcodea.
// Se obtiene de: https://platform.deepseek.com → API Keys.
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

/**
 * Retorna una promesa que se resuelve después de `ms` milisegundos.
 * @param {number} ms - Milisegundos a esperar.
 */
function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcula el tiempo de backoff entre reintentos.
 * Usa backoff exponencial con jitter para evitar tormentas de reintentos.
 *
 * Si DeepSeek devuelve el header `retry-after`, se respeta ese valor.
 * Si no, se usa: 2^intento * 1000ms + jitter aleatorio (0-500ms).
 *
 * @param {number} intento - Número de reintento (0-based).
 * @param {string|null} retryAfterHeader - Valor del header Retry-After.
 * @returns {number} Milisegundos a esperar antes del próximo intento.
 */
function calcularBackoff(intento, retryAfterHeader) {
    if (retryAfterHeader) {
        const segundos = Number(retryAfterHeader);
        if (Number.isFinite(segundos)) {
            return segundos * 1000;
        }
    }

    const base = Math.pow(2, intento) * 1000;
    const jitter = Math.floor(Math.random() * 500);

    return base + jitter;
}

/**
 * Hace un fetch con timeout y reintentos automáticos.
 *
 * ¿Por qué es necesario?
 * - Sin timeout: si DeepSeek no responde, la promesa se cuelga para siempre
 *   y el loop de evaluación se congela en esa oferta.
 * - Sin retries: si hay un error transitorio (red, rate limit, 5xx),
 *   la oferta se marca como error y se pierde la oportunidad de evaluarla.
 *
 * Estrategia de reintentos:
 * - Hasta `maxReintentos` intentos.
 * - Solo reintenta errores transitorios: 429 (rate limit), 5xx (servidor).
 * - No reintenta errores 4xx (cliente) — son errores de configuración.
 * - Usa backoff exponencial con jitter entre intentos.
 * - Respeta el header `Retry-After` si viene (estándar HTTP).
 *
 * @param {string} url - URL a consultar.
 * @param {Object} opciones - Opciones de fetch (method, headers, body, etc.).
 * @param {Object} [config] - Configuración opcional.
 * @param {number} [config.timeoutMs] - Timeout en ms (default: 30000).
 * @param {number} [config.maxReintentos] - Máximo de reintentos (default: 3).
 * @returns {Promise<Object>} El sobre JSON completo del proveedor.
 */
async function fetchConTimeoutYRetry(url, opciones, config = {}) {
    const {
        timeoutMs = 30000,
        maxReintentos = 3,
    } = config;

    let ultimoError;

    for (let intento = 0; intento <= maxReintentos; intento++) {
        const controlador = new AbortController();
        const timeout = setTimeout(() => controlador.abort(), timeoutMs);

        try {
            const respuesta = await fetch(url, {
                ...opciones,
                signal: controlador.signal,
            });

            if (respuesta.ok) {
                try {
                    // Mantengo el aborto activo hasta terminar de leer el cuerpo, no solo los headers.
                    return await respuesta.json();
                } catch (error) {
                    if (error instanceof SyntaxError && !controlador.signal.aborted) {
                        const invalido = crearErrorRespuesta('JSON_INVALIDO', 'DeepSeek no devolvió JSON válido.');
                        invalido.noReintentar = true;
                        throw invalido;
                    }
                    throw error;
                } finally {
                    clearTimeout(timeout);
                }
            }
            clearTimeout(timeout);

            // Solo reintentamos errores transitorios.
            const reintentable = [
                429, // Rate limit
                500, // Internal server error
                502, // Bad gateway
                503, // Service unavailable
                504, // Gateway timeout
            ].includes(respuesta.status);

            if (!reintentable || intento === maxReintentos) {
                const error = new Error(`DeepSeek respondió con error ${respuesta.status}.`);
                error.noReintentar = true;
                throw error;
            }

            // Respetar el header Retry-After si existe.
            const espera = calcularBackoff(
                intento,
                respuesta.headers.get('retry-after')
            );

            console.warn(
                `[DeepSeek] Reintento ${intento + 1}/${maxReintentos} en ${espera}ms (HTTP ${respuesta.status})`
            );

            await esperar(espera);
        } catch (error) {
            clearTimeout(timeout);
            ultimoError = error;

            if (error.noReintentar || intento === maxReintentos) {
                break;
            }

            // Si fue abortado por timeout, damos un poco más de tiempo.
            const espera = calcularBackoff(intento);

            // No registro mensajes originales de red ni respuestas potencialmente privadas.
            console.warn(`[DeepSeek] Error técnico en intento ${intento + 1}, reintentando en ${espera}ms.`);

            await esperar(espera);
        }
    }

    if (ultimoError?.noReintentar) throw ultimoError;
    throw new Error('Se agotaron los reintentos de DeepSeek por un error de red o timeout.');
}

/**
 * Envío un mensaje a DeepSeek y obtengo la respuesta.
 *
 * Uso el formato de chat completions de OpenAI:
 * - messages: array de objetos con { role, content }
 *   - role "system": le digo a la IA QUIÉN ES y CÓMO debe responder
 *   - role "user": el mensaje concreto que quiero que procese
 * - JSON explícito, razonamiento y presupuesto de salida según la tarea.
 * - No envío temperatura porque el proveedor la ignora con razonamiento.
 * - Timeout por tarea y hasta 3 reintentos transitorios con backoff.
 * - Metadatos seguros opcionales mediante opciones.alRecibirMetadatos.
 *
 * @param {string} mensajeSistema - Instrucciones para la IA (quién es, cómo responder).
 * @param {string} mensajeUsuario - El contenido a evaluar.
 * @param {string} [modelo] - Modelo a usar (default: DEEPSEEK_MODELO).
 * @returns {string} La respuesta de la IA en texto plano.
 */
async function consultarDeepSeek(mensajeSistema, mensajeUsuario, modelo, opciones = {}) {
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'tu_api_key_de_deepseek') {
        throw new Error(
            'DEEPSEEK_API_KEY no está configurada. Revisá el archivo .env.'
        );
    }

    const modeloEfectivo = normalizarModeloDeepSeek(modelo || DEEPSEEK_MODELO);
    if (!MODELOS_DEEPSEEK.includes(modeloEfectivo)) {
        throw new Error('El modelo DeepSeek configurado no es compatible.');
    }
    const configuracion = opciones.importacionCv ? CONFIGURACION_IMPORTACION : CONFIGURACION_DECISION;
    const inicio = Date.now();
    const datos = await fetchConTimeoutYRetry(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: modeloEfectivo,
            messages: [
                { role: 'system', content: mensajeSistema },
                { role: 'user', content: mensajeUsuario },
            ],
            ...configuracion,
        }),
    }, {
        timeoutMs: opciones.importacionCv ? TIMEOUT_IMPORTACION_MS : TIMEOUT_EVALUACION_MS,
        maxReintentos: 3,
    });

    const eleccion = Array.isArray(datos?.choices) ? datos.choices[0] : null;
    if (opciones.alRecibirMetadatos) {
        const metadatos = { modelo_solicitado: modeloEfectivo, duracion_ms: Date.now() - inicio };
        if (typeof datos?.model === 'string') metadatos.modelo_reportado = datos.model;
        if (typeof eleccion?.finish_reason === 'string') metadatos.finish_reason = eleccion.finish_reason;
        for (const [campo, valor] of Object.entries({
            tokens_entrada: datos?.usage?.prompt_tokens,
            tokens_salida: datos?.usage?.completion_tokens,
            tokens_razonamiento: datos?.usage?.completion_tokens_details?.reasoning_tokens,
        })) {
            if (Number.isFinite(valor) && valor >= 0) metadatos[campo] = valor;
        }
        opciones.alRecibirMetadatos(metadatos);
    }
    if (eleccion?.finish_reason !== 'stop') {
        throw crearErrorRespuesta(eleccion?.finish_reason === 'length' ? 'SALIDA_TRUNCADA' : 'SALIDA_INCOMPLETA',
            'DeepSeek devolvió una respuesta incompleta. Volvé a intentar.');
    }
    const contenido = eleccion.message?.content;
    if (typeof contenido !== 'string' || !contenido.trim()) {
        throw crearErrorRespuesta('SALIDA_INCOMPLETA', 'DeepSeek devolvió una respuesta vacía. Volvé a intentar.');
    }
    try {
        const objeto = JSON.parse(contenido);
        if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) throw new Error();
    } catch {
        throw crearErrorRespuesta('JSON_INVALIDO', 'DeepSeek no devolvió un objeto JSON válido. Volvé a intentar.');
    }
    // Los validadores estrictos de cada tarea conservan la validación semántica.
    return contenido;
}

function crearErrorRespuesta(codigo, mensaje) {
    const error = new Error(mensaje);
    error.codigo = codigo;
    return error;
}

module.exports = {
    consultarDeepSeek,
    MODELOS_DEEPSEEK,
    normalizarModeloDeepSeek,
    CONFIGURACION_IMPORTACION,
    DEEPSEEK_URL,
    DEEPSEEK_MODELO,
    CONFIGURACION_DECISION,
};
