const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ejecutar, transporteManual } = require('./manual');

const AUTH = 'https://auth.openai.com';
const DISCOVERY = `${AUTH}/.well-known/openid-configuration`;
const TOKEN = `${AUTH}/api/accounts/oauth/token`;
const MODELOS = 'https://api.openai.com/v1/models';

function preparar(cambios = {}) {
    const pasos = [];
    const salida = [];
    const sesion = {
        registros: () => ({ activo: 'cliente-sintetico', registros: [{ clientId: 'cliente-sintetico' }] }),
        iniciarVinculo: async ({ clientId }) => {
            pasos.push(['vincular', clientId]);
            return { url: `${AUTH}/api/accounts/authorize?state=canario`, resultado: Promise.resolve() };
        },
        conToken: async (operacion) => operacion({ token: 'canario', signal: new AbortController().signal }),
        desvincular: async () => ({ revocacionRemotaConfirmada: false }),
        cerrar: async () => { pasos.push('cerrar'); },
    };
    const dependencias = {
        interactivo: true,
        abrir: () => { pasos.push('abrir'); return sesion; },
        navegador: async () => { pasos.push('navegador'); },
        fetch: async () => { throw new Error('Red inesperada'); },
        escribir: (linea) => salida.push(linea),
        ...cambios,
    };
    return { sesion, dependencias, pasos, salida };
}

test('el comando es inerte con ayuda, entrada inválida o fuera de terminal', async () => {
    const { dependencias, pasos, salida } = preparar();
    const uso = 'Uso: node backend/piloto-chatgpt/manual.js vincular|catalogo|desvincular';
    assert.equal(await ejecutar([], dependencias), 0);
    assert.equal(await ejecutar(['--help'], dependencias), 0);
    assert.equal(await ejecutar(['inferir'], dependencias), 2);
    assert.equal(await ejecutar(['catalogo'], { ...dependencias, interactivo: false }), 2);
    assert.deepEqual(pasos, []);
    assert.deepEqual(salida, [uso, uso, uso, 'El piloto requiere una terminal interactiva en Ubuntu.']);
});

test('vincular abre solo la URL oficial, reutiliza el registro, espera el consentimiento y cierra', async () => {
    const { sesion, dependencias, pasos, salida } = preparar();
    const intento = await sesion.iniciarVinculo({ clientId: 'cliente-sintetico' });
    pasos.length = 0;
    const pendiente = Promise.withResolvers();
    sesion.iniciarVinculo = async (opciones) => {
        pasos.push(['vincular', opciones.clientId]);
        return { ...intento, resultado: pendiente.promise };
    };
    const operacion = ejecutar(['vincular'], dependencias);
    await new Promise(setImmediate);
    assert.deepEqual(pasos, ['abrir', ['vincular', 'cliente-sintetico'], 'navegador']);
    assert.deepEqual(salida, []);
    pendiente.resolve();
    assert.equal(await operacion, 0);
    assert.deepEqual(salida, ['Vínculo local completado. El catálogo aún no se consultó.']);
    assert.equal(pasos.at(-1), 'cerrar');
    sesion.iniciarVinculo = async () => ({ ...intento, url: `${AUTH}.invalid/api/accounts/authorize` });
    pasos.length = 0;
    salida.length = 0;
    assert.equal(await ejecutar(['vincular'], dependencias), 1);
    assert.deepEqual(pasos, ['abrir', 'cerrar']);
    assert.deepEqual(salida, ['Operación no completada. No se muestran detalles de la sesión.']);
});

test('catálogo usa solo GET oficial y entrega campos públicos sin controles de terminal', async () => {
    const solicitudes = [];
    const { dependencias, pasos, salida } = preparar({ fetch: async (url, opciones) => {
        solicitudes.push([String(url), opciones.method, opciones.redirect]);
        return Response.json({ models: [{ id: 'privado', slug: 'luna', display_name: 'Luna\u001b\u202e', visibility: 'list' }] });
    } });
    assert.equal(await ejecutar(['catalogo'], dependencias), 0);
    assert.deepEqual(solicitudes, [[MODELOS, 'GET', 'error']]);
    assert.deepEqual(pasos, ['abrir', 'cerrar']);
    assert.deepEqual(salida, ['[{"slug":"luna","display_name":"Luna\\u001b\\u202e"}]']);
});

test('el transporte no envía inferencias, rutas ajenas ni credenciales en URL', async () => {
    const solicitudes = [];
    const fetch = async (url, opciones) => {
        solicitudes.push([url, opciones.method ?? 'GET', opciones.redirect]);
        return Response.json({ issuer: AUTH, token_endpoint: TOKEN, jwks_uri: `${AUTH}/jwks`, revocation_endpoint: `${AUTH}/revoke` });
    };
    const transporte = transporteManual('catalogo', fetch);
    for (const [url, method] of [[TOKEN, 'POST'], [MODELOS, 'POST'], [`${MODELOS}?x=1`, 'GET'],
        [`${AUTH}/revoke`, 'POST'], [`${AUTH}/ajeno`, 'GET'], ['https://api.openai.com/v1/responses', 'POST'],
        [`${AUTH}/jwks`, 'GET'], ['https://canario@api.openai.com/v1/models', 'GET']]) {
        await assert.rejects(transporte(url, { method }), /Destino no autorizado/);
    }
    await transporte(DISCOVERY);
    await transporte(TOKEN, { method: 'POST' });
    await transporte(`${AUTH}/jwks`);
    await assert.rejects(transporte(`${AUTH}/revoke`, { method: 'POST' }), /Destino no autorizado/);
    const desvincular = transporteManual('desvincular', fetch);
    await desvincular(DISCOVERY);
    await desvincular(`${AUTH}/revoke`, { method: 'POST' });
    await assert.rejects(desvincular(TOKEN, { method: 'POST' }), /Destino no autorizado/);
    await assert.rejects(desvincular(MODELOS), /Destino no autorizado/);
    assert.deepEqual(solicitudes, [[DISCOVERY, 'GET', 'error'], [TOKEN, 'POST', 'error'],
        [`${AUTH}/jwks`, 'GET', 'error'], [DISCOVERY, 'GET', 'error'], [`${AUTH}/revoke`, 'POST', 'error']]);
});

test('interrumpir el vínculo limpia la sesión sin salida tardía ni error crudo', async () => {
    const control = new AbortController();
    const { sesion, dependencias, pasos, salida } = preparar({ signal: control.signal });
    const intento = await sesion.iniciarVinculo({});
    pasos.length = 0;
    const pendiente = Promise.withResolvers();
    sesion.iniciarVinculo = async () => ({ ...intento, resultado: pendiente.promise });
    const operacion = ejecutar(['vincular'], dependencias);
    await new Promise(setImmediate);
    control.abort(new Error('canario'));
    assert.equal(await operacion, 130);
    pendiente.resolve();
    assert.deepEqual(pasos, ['abrir', 'navegador', 'cerrar']);
    assert.deepEqual(salida, ['Operación interrumpida.']);
});

test('desvincular informa cuando la revocación remota no está confirmada', async () => {
    const { dependencias, pasos, salida } = preparar();
    assert.equal(await ejecutar(['desvincular'], dependencias), 1);
    assert.deepEqual(pasos, ['abrir', 'cerrar']);
    assert.deepEqual(salida, ['Sesión local retirada. Revocación remota no confirmada: desconecta la app en https://chatgpt.com/settings/usage.']);
});
