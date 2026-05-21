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
 * Envío un mensaje a DeepSeek y obtengo la respuesta.
 *
 * Uso el formato de chat completions de OpenAI:
 * - messages: array de objetos con { role, content }
 *   - role "system": le digo a la IA QUIÉN ES y CÓMO debe responder
 *   - role "user": el mensaje concreto que quiero que procese
 * - temperature: 0 (queremos respuestas determinísticas, no creativas)
 *
 * ¿Qué es temperature? Es qué tan "creativa" queremos que sea la IA.
 * 0 = siempre la misma respuesta (determinístico). 1 = más variada.
 * Para evaluar ofertas queremos consistencia, no creatividad.
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

    const respuesta = await fetch(DEEPSEEK_URL, {
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
    });

    // Si la API responde con error HTTP (4xx, 5xx), lo manejo.
    if (!respuesta.ok) {
        const cuerpoError = await respuesta.text();
        throw new Error(
            `DeepSeek respondió con error ${respuesta.status}: ${cuerpoError}`
        );
    }

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
