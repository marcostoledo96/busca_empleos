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

// Modelo a usar por defecto. DeepSeek V4 Flash es rápido y eficiente para
// tareas de clasificación simple como evaluar ofertas laborales.
// Usa el endpoint estándar de DeepSeek, no un proxy externo.
const DEEPSEEK_MODELO = 'deepseek-v4-flash';

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
 * @returns {Promise<Response>} La respuesta HTTP.
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

            clearTimeout(timeout);

            if (respuesta.ok) {
                return respuesta;
            }

            // Solo reintentamos errores transitorios.
            const reintentable = [
                429, // Rate limit
                500, // Internal server error
                502, // Bad gateway
                503, // Service unavailable
                504, // Gateway timeout
            ].includes(respuesta.status);

            if (!reintentable || intento === maxReintentos) {
                const cuerpo = await respuesta.text();
                throw new Error(
                    `DeepSeek respondió con error ${respuesta.status}: ${cuerpo}`
                );
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

            if (intento === maxReintentos) {
                break;
            }

            // Si fue abortado por timeout, damos un poco más de tiempo.
            const espera = calcularBackoff(intento);

            console.warn(
                `[DeepSeek] Error en intento ${intento + 1}, reintentando en ${espera}ms: ${error.message}`
            );

            await esperar(espera);
        }
    }

    throw ultimoError || new Error('Se agotaron los reintentos sin respuesta de DeepSeek.');
}

/**
 * Envío un mensaje a DeepSeek y obtengo la respuesta.
 *
 * Uso el formato de chat completions de OpenAI:
 * - messages: array de objetos con { role, content }
 *   - role "system": le digo a la IA QUIÉN ES y CÓMO debe responder
 *   - role "user": el mensaje concreto que quiero que procese
 * - temperature: 0 (queremos respuestas determinísticas, no creativas)
 *
 * Ahora incluye:
 * - Timeout de 30 segundos (AbortController).
 * - Hasta 3 reintentos con backoff exponencial + jitter.
 * - Manejo de rate limits (429) respetando el header Retry-After.
 *
 * @param {string} mensajeSistema - Instrucciones para la IA (quién es, cómo responder).
 * @param {string} mensajeUsuario - El contenido a evaluar.
 * @param {string} [modelo] - Modelo a usar (default: DEEPSEEK_MODELO).
 * @returns {string} La respuesta de la IA en texto plano.
 */
async function consultarDeepSeek(mensajeSistema, mensajeUsuario, modelo) {
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'tu_api_key_de_deepseek') {
        throw new Error(
            'DEEPSEEK_API_KEY no está configurada. Revisá el archivo .env.'
        );
    }

    const respuesta = await fetchConTimeoutYRetry(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelo || DEEPSEEK_MODELO,
            messages: [
                { role: 'system', content: mensajeSistema },
                { role: 'user', content: mensajeUsuario },
            ],
            temperature: 0,
        }),
    }, {
        timeoutMs: 30000,
        maxReintentos: 3,
    });

    const datos = await respuesta.json();

    // La respuesta viene en data.choices[0].message.content
    // (mismo formato que OpenAI).
    if (!datos.choices || datos.choices.length === 0) {
        throw new Error('DeepSeek no devolvió ninguna respuesta (choices vacío).');
    }

    return datos.choices[0].message.content;
}

module.exports = {
    consultarDeepSeek,
    DEEPSEEK_URL,
    DEEPSEEK_MODELO,
};
