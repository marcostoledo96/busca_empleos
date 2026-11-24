const { spawn } = require('node:child_process');
const { homedir } = require('node:os');
const { join } = require('node:path');
const { abrirSesion } = require('./oauth');
const { crearClienteResponses } = require('./responses');

const AUTH = 'https://auth.openai.com';
const DISCOVERY = `${AUTH}/.well-known/openid-configuration`;
const TOKEN = `${AUTH}/api/accounts/oauth/token`;
const MODELOS = 'https://api.openai.com/v1/models';
const USO = 'Uso: node backend/piloto-chatgpt/manual.js vincular|catalogo|desvincular';

function urlOficial(valor, origen) {
    if (typeof valor !== 'string') throw new Error('Destino no autorizado.');
    const url = new URL(valor);
    if (url.origin !== origen || url.username || url.password || url.hash) throw new Error('Destino no autorizado.');
    return url;
}

function endpointOAuth(valor) {
    const url = urlOficial(valor, AUTH);
    if (url.search || [DISCOVERY, TOKEN, `${AUTH}/api/accounts/authorize`].includes(url.href)) {
        throw new Error('Destino no autorizado.');
    }
    return url.href;
}

function transporteManual(operacion, fetch, signal) {
    let rutas;
    return async (destino, opciones = {}) => {
        const destinoOficial = urlOficial(destino, destino === MODELOS ? 'https://api.openai.com' : AUTH);
        const url = destinoOficial.href;
        const metodo = opciones.method ?? 'GET';
        const permitido = !destinoOficial.search && (
            (metodo === 'GET' && url === DISCOVERY) ||
            (operacion === 'catalogo' && metodo === 'GET' && url === MODELOS) ||
            (rutas && (operacion === 'desvincular'
                ? metodo === 'POST' && url === rutas.revocar
                : (metodo === 'POST' && url === TOKEN) || (metodo === 'GET' && url === rutas.jwks)))
        );
        if (!permitido) throw new Error('Destino no autorizado.');
        const senales = [signal, opciones.signal].filter(Boolean);
        const respuesta = await fetch(url, { ...opciones, method: metodo, redirect: 'error', credentials: 'omit',
            signal: senales.length ? AbortSignal.any(senales) : undefined });
        if (url === DISCOVERY) {
            rutas = undefined;
            if (respuesta.status === 200) {
                const datos = await respuesta.clone().json();
                if (datos.issuer !== AUTH || datos.token_endpoint !== TOKEN) throw new Error('Discovery no autorizado.');
                rutas = { jwks: endpointOAuth(datos.jwks_uri), revocar: endpointOAuth(datos.revocation_endpoint) };
                if (rutas.jwks === rutas.revocar) throw new Error('Discovery no autorizado.');
            }
        }
        return respuesta;
    };
}

function abrirNavegador(url) {
    return new Promise((resolve, reject) => {
        const proceso = spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
        proceso.once('error', reject);
        proceso.once('exit', (codigo) => codigo === 0 ? resolve() : reject(new Error('No se pudo abrir el navegador.')));
        proceso.unref();
    });
}

const jsonSeguro = (valor) => JSON.stringify(valor).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (control) =>
    Array.from({ length: control.length }, (_, i) => `\\u${control.charCodeAt(i).toString(16).padStart(4, '0')}`).join(''));

async function ejecutar(args, { interactivo, fetch = globalThis.fetch, abrir = abrirSesion, navegador = abrirNavegador,
    escribir = console.log, signal } = {}) {
    if (!args.length || (args.length === 1 && args[0] === '--help')) { escribir(USO); return 0; }
    const [operacion] = args;
    if (args.length !== 1 || !['vincular', 'catalogo', 'desvincular'].includes(operacion)) { escribir(USO); return 2; }
    if (!interactivo) { escribir('El piloto requiere una terminal interactiva en Ubuntu.'); return 2; }

    const interrupcion = Promise.withResolvers();
    const interrumpir = () => interrupcion.resolve();
    signal?.addEventListener('abort', interrumpir, { once: true });
    let sesion;
    let mensaje;
    let codigo = 0;
    try {
        signal?.throwIfAborted();
        const transporte = transporteManual(operacion, fetch, signal);
        sesion = abrir({ modo: 'local-manual', directorio: join(homedir(), '.config', 'busco-trabajo-catalogo'), fetch: transporte });
        const tarea = async () => {
            if (operacion === 'vincular') {
                const { activo, registros } = sesion.registros();
                if (!activo && registros.length > 1) throw new Error('Más de un registro local.');
                const { url, resultado } = await sesion.iniciarVinculo({ clientId: activo ?? registros[0]?.clientId });
                signal?.throwIfAborted();
                const destino = urlOficial(url, AUTH);
                if (destino.pathname !== '/api/accounts/authorize') throw new Error('Inicio de sesión no autorizado.');
                await Promise.race([resultado, navegador(destino.href).then(() => resultado)]);
                return 'Vínculo local completado. El catálogo aún no se consultó.';
            }
            if (operacion === 'catalogo') {
                const cliente = crearClienteResponses({ fetch: transporte });
                return jsonSeguro(await sesion.conToken((contexto) => cliente.listarModelos(contexto)));
            }
            if (!sesion.registros().activo) return 'No hay una sesión activa para desvincular.';
            const resultado = await sesion.desvincular();
            if (resultado.revocacionRemotaConfirmada) return 'Sesión local retirada y revocación remota confirmada.';
            codigo = 1;
            return 'Sesión local retirada. Revocación remota no confirmada: desconecta la app en https://chatgpt.com/settings/usage.';
        };
        mensaje = await Promise.race([tarea(), interrupcion.promise]);
    } catch {
        codigo = 1;
        mensaje = 'Operación no completada. No se muestran detalles de la sesión.';
    } finally {
        try { await sesion?.cerrar(); } catch {
            codigo = 1;
            mensaje = 'No se pudo cerrar el almacén local de forma segura. No retires el bloqueo automáticamente.';
        }
        signal?.removeEventListener('abort', interrumpir);
    }
    if (signal?.aborted) { escribir('Operación interrumpida.'); return 130; }
    escribir(mensaje);
    return codigo;
}

if (require.main === module) {
    const control = new AbortController();
    const abortar = () => control.abort();
    process.once('SIGINT', abortar);
    process.once('SIGTERM', abortar);
    ejecutar(process.argv.slice(2), {
        interactivo: process.platform === 'linux' && process.stdin.isTTY && process.stdout.isTTY,
        signal: control.signal,
    }).then((codigo) => { process.exitCode = codigo; }).finally(() => {
        process.removeListener('SIGINT', abortar);
        process.removeListener('SIGTERM', abortar);
    });
}

module.exports = { ejecutar, transporteManual };
