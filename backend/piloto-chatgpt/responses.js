const BASE = 'https://api.openai.com/v1';
const LIMITE_BYTES = 1024 * 1024;
const CODIGOS = new Map([
    ['subscription_sharing_user_not_eligible', 'acceso_rechazado'],
    ['subscription_sharing_usage_limit_exceeded', 'limite_de_uso'],
    ['subscription_sharing_usage_unavailable', 'proveedor_no_disponible'],
    ['subscription_sharing_unsupported_capability', 'capacidad_no_admitida'],
    ['subscription_sharing_route_not_supported', 'capacidad_no_admitida'],
    ['subscription_sharing_invalid_user', 'acceso_rechazado'],
    ['chatpass_v2_scope_not_authorized', 'acceso_rechazado'],
    ['chatpass_v2_invalid_authorization_context', 'acceso_rechazado'],
    ['subscription_sharing_user_unavailable', 'proveedor_no_disponible'],
    ['rate_limit_exceeded', 'limite_de_uso'],
    ['insufficient_quota', 'limite_de_uso'],
    ['server_error', 'proveedor_no_disponible']
]);

class ErrorResponses extends Error {
    constructor(codigo, upstream = {}) {
        super(`El piloto ChatGPT no completó la operación (${codigo}).`);
        this.name = 'ErrorResponses';
        this.codigo = codigo;
        // Un fallo del proveedor no invalida la sesión Firebase.
        this.status = 502;
        this.upstream = upstream;
    }
}

function normalizarInput(input) {
    if (!Array.isArray(input) || !input.length) throw new ErrorResponses('entrada_invalida');
    return Array.from(input, ({ role, content } = {}) => {
        if (!['user', 'developer', 'system', 'assistant'].includes(role)) throw new ErrorResponses('entrada_invalida');
        if (typeof content === 'string' && content.trim()) return { role, content };
        if (!Array.isArray(content) || !content.length) throw new ErrorResponses('entrada_invalida');
        return { role, content: Array.from(content, (parte) => {
            if (parte?.type !== 'input_text' || typeof parte.text !== 'string' || !parte.text.trim()) {
                throw new ErrorResponses('entrada_invalida');
            }
            return { type: 'input_text', text: parte.text };
        }) };
    });
}

function cancelar(lector) {
    void lector?.cancel().catch(() => {});
}

async function* leerCuerpo(respuesta, contexto) {
    if (!respuesta.body) return;
    const lector = respuesta.body.getReader();
    const cancelarLectura = () => cancelar(lector);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    contexto.signal.addEventListener('abort', cancelarLectura, { once: true });
    try {
        while (true) {
            contexto.comprobar();
            const { done, value } = await lector.read();
            contexto.comprobar();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > LIMITE_BYTES) throw contexto.error('cuerpo_demasiado_grande');
            yield decoder.decode(value, { stream: true });
        }
        yield decoder.decode();
    } finally {
        contexto.signal.removeEventListener('abort', cancelarLectura);
        if (!contexto.signal.aborted) cancelarLectura();
        lector.releaseLock();
    }
}

async function leerJson(respuesta, contexto) {
    let texto = '';
    for await (const bloque of leerCuerpo(respuesta, contexto)) texto += bloque;
    return JSON.parse(texto);
}

async function* eventosSse(respuesta, contexto) {
    let linea = '';
    let omitirLf = false;
    let nombre = '';
    let datos = [];
    for await (const bloque of leerCuerpo(respuesta, contexto)) {
        for (const caracter of bloque) {
            if (omitirLf && caracter === '\n') { omitirLf = false; continue; }
            omitirLf = caracter === '\r';
            if (caracter !== '\r' && caracter !== '\n') { linea += caracter; continue; }
            if (linea === '') {
                if (datos.length) {
                    let evento;
                    try { evento = JSON.parse(datos.join('\n')); } catch { throw contexto.error('stream_invalido'); }
                    if (typeof evento?.type !== 'string' || (nombre && nombre !== evento.type)) {
                        throw contexto.error('stream_invalido');
                    }
                    yield evento;
                }
                nombre = '';
                datos = [];
            } else {
                const separador = linea.indexOf(':');
                const campo = separador < 0 ? linea : linea.slice(0, separador);
                const valor = separador < 0 ? '' : linea.slice(separador + 1).replace(/^ /, '');
                if (campo === 'event') nombre = valor;
                if (campo === 'data') datos.push(valor);
            }
            linea = '';
        }
    }
}

function extraerTexto(respuesta, contexto) {
    if (respuesta?.status !== 'completed' || !Array.isArray(respuesta.output)) throw contexto.error('stream_invalido');
    const partes = [];
    for (const item of respuesta.output) {
        if (item?.type === 'reasoning') continue;
        if (item?.type !== 'message' || item.role !== 'assistant' || item.status !== 'completed' || !Array.isArray(item.content)) {
            throw contexto.error('salida_invalida');
        }
        for (const parte of item.content) {
            if (parte?.type !== 'output_text' || typeof parte.text !== 'string') throw contexto.error('salida_invalida');
            partes.push(parte.text);
        }
    }
    return partes.join('');
}

function crearClienteResponses({ fetch, plazoMs = 30000 } = {}) {
    if (typeof fetch !== 'function') throw new TypeError('Se requiere fetch inyectado.');
    if (!Number.isInteger(plazoMs) || plazoMs <= 0 || plazoMs > 2147483647) throw new TypeError('Plazo inválido.');

    async function solicitar({ token, signal }, ruta, config, procesar) {
        if (typeof token !== 'string' || token.trim() !== token || !/^[A-Za-z0-9._~+/-]+=*$/.test(token) || !(signal instanceof AbortSignal)) {
            throw new ErrorResponses('entrada_invalida');
        }
        const controlador = new AbortController();
        const vence = performance.now() + plazoMs;
        let upstream = {};
        const error = (codigo) => new ErrorResponses(codigo, upstream);
        const comprobar = () => {
            if (signal.aborted) throw error('cancelado');
            if (performance.now() >= vence) throw error('plazo_agotado');
        };
        comprobar();
        const contexto = { signal: controlador.signal, error, comprobar };
        const falloProveedor = (codigo, defecto) => {
            if (typeof codigo === 'string' && /^[a-z][a-z0-9_]{1,79}$/.test(codigo) &&
                !codigo.includes(token.toLowerCase())) upstream = { ...upstream, codigo };
            return error(CODIGOS.get(upstream.codigo) || defecto);
        };
        let cancelarSolicitud;
        let reloj;
        const cancelacion = new Promise((_, reject) => {
            const detener = (codigo) => {
                reject(error(codigo));
                controlador.abort();
            };
            cancelarSolicitud = () => detener('cancelado');
            signal.addEventListener('abort', cancelarSolicitud, { once: true });
            reloj = setTimeout(() => detener('plazo_agotado'), plazoMs);
        });
        const operar = async () => {
            const respuesta = await fetch(`${BASE}/${ruta}`, {
                ...config,
                headers: { Authorization: `Bearer ${token}`, ...config.headers },
                redirect: 'error', credentials: 'omit', signal: controlador.signal
            });
            try { comprobar(); } catch (e) { cancelar(respuesta.body); throw e; }
            const requestId = respuesta.headers.get('x-request-id');
            upstream = {
                ...(Number.isInteger(respuesta.status) && respuesta.status >= 100 && respuesta.status <= 599 && { status: respuesta.status }),
                ...(/^req_[A-Za-z0-9_-]{1,96}$/.test(requestId) && !requestId.includes(token) && { requestId })
            };
            if (!respuesta.ok) {
                let datos;
                try { datos = await leerJson(respuesta, contexto); } catch { comprobar(); }
                if (datos?.error && typeof datos.error === 'object' && !Array.isArray(datos.error)) upstream.forma = 'error';
                else if (typeof datos?.detail === 'string') upstream.forma = 'detail';
                const defecto = ({ 401: 'acceso_rechazado', 403: 'acceso_rechazado', 429: 'limite_de_uso', 503: 'proveedor_no_disponible' })[upstream.status];
                throw falloProveedor(datos?.error?.code, defecto || 'solicitud_rechazada');
            }
            const resultado = await procesar(respuesta, contexto, falloProveedor);
            comprobar();
            return resultado;
        };
        try {
            return await Promise.race([cancelacion, operar()]);
        } catch (e) {
            comprobar();
            throw e instanceof ErrorResponses ? e : error('fallo_de_transporte');
        } finally {
            clearTimeout(reloj);
            signal.removeEventListener('abort', cancelarSolicitud);
            controlador.abort();
        }
    }

    async function listarModelos({ token, signal } = {}) {
        return solicitar({ token, signal }, 'models', { method: 'GET' }, async (respuesta, contexto) => {
            let catalogo;
            try { catalogo = await leerJson(respuesta, contexto); } catch (e) {
                if (!(e instanceof SyntaxError)) throw e;
                throw contexto.error('catalogo_invalido');
            }
            if (!Array.isArray(catalogo?.models) || !catalogo.models.every((modelo) => typeof modelo?.visibility === 'string')) {
                throw contexto.error('catalogo_invalido');
            }
            const visibles = catalogo.models.filter((modelo) => modelo.visibility === 'list');
            if (!visibles.every(({ slug, display_name }) => typeof slug === 'string' && slug.length && slug.trim() === slug &&
                typeof display_name === 'string' && display_name.trim())) {
                throw contexto.error('catalogo_invalido');
            }
            return visibles.map(({ slug, display_name }) => ({ slug, display_name }));
        });
    }

    async function generarRespuesta({ token, signal, modelo, input, validar, reasoning, text } = {}) {
        if (reasoning !== undefined || text !== undefined) throw new ErrorResponses('capacidad_no_admitida');
        if (typeof modelo !== 'string' || !modelo.trim() || typeof validar !== 'function') throw new ErrorResponses('entrada_invalida');
        let entrada;
        try { entrada = normalizarInput(input); } catch { throw new ErrorResponses('entrada_invalida'); }
        return solicitar({ token, signal }, 'responses', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ model: modelo, input: entrada, store: false, stream: true })
        }, async (respuesta, contexto, falloProveedor) => {
            if (respuesta.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
                cancelar(respuesta.body);
                throw contexto.error('stream_invalido');
            }
            for await (const evento of eventosSse(respuesta, contexto)) {
                if (evento.type === 'response.failed' || evento.type === 'error') {
                    throw falloProveedor(evento.response?.error?.code ?? evento.code, 'respuesta_fallida');
                }
                if (evento.type === 'response.incomplete') throw contexto.error('respuesta_incompleta');
                if (evento.type === 'response.completed') {
                    const texto = extraerTexto(evento.response, contexto);
                    let datos;
                    let valido;
                    contexto.comprobar();
                    try {
                        datos = JSON.parse(texto);
                        valido = await validar(datos, contexto.signal);
                    } catch { throw contexto.error('salida_invalida'); }
                    contexto.comprobar();
                    if (valido !== true) throw contexto.error('salida_invalida');
                    return datos;
                }
            }
            throw contexto.error('stream_interrumpido');
        });
    }

    return { listarModelos, generarRespuesta };
}

module.exports = { crearClienteResponses };
