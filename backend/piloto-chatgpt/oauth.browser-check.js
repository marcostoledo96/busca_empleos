const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');
const { abrirSesion } = require('./oauth');

const emisor = 'https://auth.openai.com';

test('Chromium vuelve al callback local ante consentimiento denegado', { timeout: 15000 }, async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'browser-piloto-'));
    let navegador, sesion;
    const intercambios = [];
    const salidas = [];
    try {
        sesion = abrirSesion({
            modo: 'local-manual', directorio: join(raiz, 'sesion'),
            fetch: async (url) => {
                intercambios.push(String(url));
                assert.equal(String(url), `${emisor}/.well-known/openid-configuration`);
                return Response.json({
                    issuer: emisor,
                    token_endpoint: `${emisor}/api/accounts/oauth/token`,
                    jwks_uri: `${emisor}/.well-known/jwks.json`,
                    revocation_endpoint: `${emisor}/revocar-fixture`
                });
            }
        });
        navegador = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' });
        const contexto = await navegador.newContext({ serviceWorkers: 'block' });
        const intento = await sesion.iniciarVinculo();
        const autorizacion = new URL(intento.url);
        assert.equal(autorizacion.origin, emisor);
        const destino = new URL(autorizacion.searchParams.get('redirect_uri'));
        assert.equal(destino.hostname, '127.0.0.1');
        destino.search = new URLSearchParams({ state: autorizacion.searchParams.get('state'), error: 'access_denied' });
        await contexto.route('**/*', async (ruta) => {
            const url = new URL(ruta.request().url());
            if (url.href === autorizacion.href) return ruta.fulfill({ status: 302, headers: { location: destino.href } });
            if (url.origin === destino.origin) return ruta.continue();
            salidas.push(url.origin);
            return ruta.abort();
        });
        const denegacion = assert.rejects(intento.resultado);
        const pagina = await contexto.newPage();
        const respuesta = await pagina.goto(autorizacion.href);
        await denegacion;
        assert.equal(new URL(pagina.url()).origin, destino.origin);
        assert.equal(respuesta.headers()['cache-control'], 'no-store');
        assert.equal(intercambios.filter((url) => url.endsWith('/api/accounts/oauth/token')).length, 0);
        assert.deepEqual(salidas, []);
    } finally {
        try { await navegador?.close(); } finally {
            try { await sesion?.cerrar(); } finally { await rm(raiz, { recursive: true, force: true }); }
        }
    }
});
