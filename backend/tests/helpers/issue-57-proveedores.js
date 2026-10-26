const { TOKEN, EMAIL, ofertaLinkedin } = require('./issue-57-entorno');

function crearProveedores() {
    let escenario = 'correcto';
    let liberar;
    let espera;
    let esperaEvaluacion;
    let liberarEvaluacion;
    const llamadas = [];
    const inesperadas = [];
    const prohibir = nombre => {
        inesperadas.push(nombre);
        throw new Error(`Operación externa no permitida: ${nombre}`);
    };
    const cambiar = valor => {
        if (!['correcto', 'vacio', '429', '500', '503', 'timeout', 'invalido', 'parcial', 'retenido', 'volumen', 'ia_incompleta', 'ia_error', 'ia_rechazada'].includes(valor)) {
            throw new Error('Escenario sintético desconocido.');
        }
        escenario = valor;
        if (valor === 'retenido') espera = new Promise(resolve => { liberar = resolve; });
    };
    class ApifyClient {
        actor(id) {
            const permitidos = ['hKByXkMQaC5Qt9UMN', 'TrtlecxAsNRbKl1na', 'apify/puppeteer-scraper', 'bYSAbQqxwImLaf2nb'];
            if (!permitidos.includes(id)) return prohibir('Actor desconocido');
            return { call: async input => {
                llamadas.push({ tipo: 'actor', id, input });
                if (escenario === 'retenido') await espera;
                if (['429', '500', '503'].includes(escenario) || (escenario === 'parcial' && id !== permitidos[0])) {
                    throw Object.assign(new Error('Proveedor sintético no disponible.'), { statusCode: Number(escenario) || 503 });
                }
                return { id: 'run-ficticio', status: escenario === 'timeout' ? 'TIMED-OUT' : 'SUCCEEDED',
                    defaultDatasetId: `${id}-dataset` };
            } };
        }
        dataset(id) {
            return { listItems: async () => {
                llamadas.push({ tipo: 'dataset', id });
                if (escenario === 'invalido') return { items: null };
                return { items: id === 'hKByXkMQaC5Qt9UMN-dataset' && !['vacio', 'timeout'].includes(escenario)
                    ? (escenario === 'volumen' ? Array.from({ length: 25 }, (_, indice) => ofertaLinkedin(indice + 1))
                        : [ofertaLinkedin(1), ofertaLinkedin(2), ofertaLinkedin(1)]) : [] };
            } };
        }
        run() { return prohibir('control remoto inesperado de Actor'); }
    }
    const firebase = { verifyIdToken: async token => {
        if (token === TOKEN) return { uid: 'persona-ficticia-57', email: EMAIL };
        if (token === 'issue57-identidad-ajena') return { uid: 'otra-persona', email: 'otra@example.invalid' };
        throw new Error('Token ficticio inválido.');
    } };
    const fetchSintetico = async (url, opciones = {}) => {
        const destino = new URL(url);
        llamadas.push({ tipo: 'http', destino: `${destino.origin}${destino.pathname}` });
        if (destino.hostname === 'api.deepseek.com' && destino.pathname === '/v1/chat/completions') {
            if (esperaEvaluacion) await esperaEvaluacion;
            if (escenario === 'ia_error') return { ok: false, status: 503, headers: { get: () => '0.001' }, text: async () => 'Fallo sintético de IA.' };
            return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: {
                content: JSON.stringify(escenario === 'ia_incompleta' ? { match: true }
                    : { match: escenario !== 'ia_rechazada', porcentaje: escenario === 'ia_rechazada' ? 20 : 85,
                        razon: escenario === 'ia_rechazada' ? 'No cumplo los requisitos sintéticos.' : 'Cumplo los requisitos sintéticos.' }),
            } }] }) };
        }
        if (destino.origin === 'https://www.computrabajo.com.ar'
            && destino.pathname === '/trabajo-de-desarrollo-junior' && destino.search === ''
            && (opciones.method || 'GET') === 'GET') {
            return { ok: true, text: async () => '<html><body><div id="offersGrid"></div></body></html>' };
        }
        if (destino.hostname === 'ar.computrabajo.com') {
            return { ok: true, text: async () => '<html><body><div id="offersGrid"></div></body></html>' };
        }
        if (destino.hostname === 'remotive.com' && destino.pathname === '/api/remote-jobs') {
            return { ok: true, json: async () => ({ jobs: [] }) };
        }
        if (destino.hostname === 'jooble.org' && destino.pathname === '/api/issue57-sintetico') {
            return { ok: true, json: async () => ({ jobs: [], totalCount: 0 }) };
        }
        if (destino.hostname === 'api.adzuna.com' && destino.pathname.startsWith('/v1/api/jobs/')) {
            return { ok: true, json: async () => ({ results: [], count: 0 }) };
        }
        if (destino.hostname === 'remoteok.com' && destino.pathname.startsWith('/api')) {
            return { ok: true, json: async () => [{}] };
        }
        return prohibir(`HTTP ${destino.hostname}${destino.pathname} ${opciones.method || 'GET'}`);
    };
    return {
        cambiar, llamadas, inesperadas, liberar: () => liberar?.(), fetch: fetchSintetico,
        retenerEvaluacion: () => { esperaEvaluacion = new Promise(resolve => { liberarEvaluacion = resolve; }); },
        liberarEvaluacion: () => { liberarEvaluacion?.(); esperaEvaluacion = undefined; },
        modulos: {
            dotenv: { config: () => ({ parsed: {} }) },
            'apify-client': { ApifyClient },
            firebase,
            'node-cron': { validate: () => true, createTask: () => prohibir('cron'), schedule: () => prohibir('cron') },
            nodemailer: { createTransport: () => prohibir('correo') },
        },
    };
}

// Bloqueo también los transportes nativos: ningún proveedor puede escapar de fetch/SDK.
function cerrarRed(proveedores) {
    const net = require('net');
    const conectar = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function (...argumentos) {
        const normalizados = net._normalizeArgs(argumentos)[0];
        if (normalizados.path || !['127.0.0.1', 'localhost', '::1', undefined].includes(normalizados.host)) {
            proveedores.inesperadas.push('socket externo');
            throw new Error('Socket externo no permitido.');
        }
        return conectar.apply(this, argumentos);
    };
    const fetchAnterior = global.fetch;
    global.fetch = proveedores.fetch;
    return () => { net.Socket.prototype.connect = conectar; global.fetch = fetchAnterior; };
}

function instalarModulos(proveedores) {
    const Module = require('module');
    const original = Module._load;
    const firebase = require.resolve('../../src/config/firebase-admin');
    Module._load = function (nombre, padre, ...resto) {
        if (Object.hasOwn(proveedores.modulos, nombre)) return proveedores.modulos[nombre];
        if (Module._resolveFilename(nombre, padre) === firebase) return proveedores.modulos.firebase;
        return original.call(this, nombre, padre, ...resto);
    };
    return () => { Module._load = original; };
}

module.exports = { crearProveedores, cerrarRed, instalarModulos };
