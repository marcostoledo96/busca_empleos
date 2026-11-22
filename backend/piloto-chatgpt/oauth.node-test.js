const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, generateKeyPairSync, sign } = require('node:crypto');
const { mkdtempSync, rmSync, statSync, readdirSync, readFileSync, symlinkSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { abrirSesion } = require('./oauth');
const { crearClienteResponses } = require('./responses');

const emisor = 'https://auth.openai.com';
const recurso = 'https://api.openai.com/v1';
const alcance = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const cliente = 'oaiapp_sintetico';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicar = (valor) => Response.json(valor);
const promesaControlada = () => Promise.withResolvers();

function preparar(t) {
    // El tmpfs de bwrap oculta el TMPDIR heredado del host.
    const raiz = mkdtempSync('/tmp/oauth-piloto-');
    const directorio = join(raiz, 'sesion');
    const solicitudes = [];
    const autorizaciones = [];
    let tiempo = 1800000000000;
    let renovaciones = 0;
    const fixture = {
        reclamos: {}, alcance, algoritmo: 'RS256', firmaInvalida: false,
        revocar: () => new Response(null),
        discovery: {
            issuer: emisor,
            token_endpoint: `${emisor}/api/accounts/oauth/token`,
            jwks_uri: `${emisor}/jwks`,
            revocation_endpoint: `${emisor}/revoke`
        }
    };
    const opciones = {
        modo: 'local-manual', directorio, ahora: () => tiempo,
        fetch: async (url, init) => {
            solicitudes.push([url, init]);
            assert.equal(new URL(url).origin, emisor);
            assert.equal(init.redirect, 'error');
            if (url.endsWith('/.well-known/openid-configuration')) return publicar(fixture.discovery);
            if (url.endsWith('/jwks') && fixture.jwks) return fixture.jwks();
            if (url.endsWith('/jwks')) return publicar({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' }] });
            if (url.endsWith('/revoke')) return fixture.revocar(init.body);
            assert.equal(url, fixture.discovery.token_endpoint);
            const params = init.body;
            assert.equal(params.get('resource'), recurso);
            if (params.get('grant_type') === 'refresh_token') {
                renovaciones++;
                assert.equal(params.has('scope'), false);
                assert.equal(params.get('client_id'), cliente);
                if (fixture.renovar) return fixture.renovar(params);
                return publicar(tokens(`rotado-${renovaciones}`));
            }
            assert.equal(params.get('grant_type'), 'authorization_code');
            const clienteEmitido = fixture.clienteEmitido ?? cliente;
            assert.equal(params.get('client_id'), clienteEmitido);
            const intento = autorizaciones.at(-1).searchParams;
            assert.equal(params.get('redirect_uri'), intento.get('redirect_uri'));
            assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'), intento.get('code_challenge'));
            const codificar = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');
            const datos = `${codificar({ alg: fixture.algoritmo, kid: 'fixture' })}.${codificar({
                iss: emisor, aud: clienteEmitido, sub: 'cuenta-sintetica', exp: tiempo / 1000 + 3600,
                nonce: intento.get('nonce'), ...fixture.reclamos
            })}`;
            let firma = sign('RSA-SHA256', Buffer.from(datos), privateKey);
            if (fixture.firmaInvalida) firma = Buffer.alloc(firma.length);
            const emitido = { ...tokens('inicial', fixture.alcance), id_token: `${datos}.${firma.toString('base64url')}` };
            return fixture.canjear ? fixture.canjear(emitido) : publicar(emitido);
        }
    };
    let sesion;
    t.after(async () => {
        try { await sesion?.cerrar(); } finally { rmSync(raiz, { recursive: true, force: true }); }
    });
    sesion = abrirSesion(opciones);
    async function iniciar(opcionesVinculo) {
        const intento = await sesion.iniciarVinculo(opcionesVinculo);
        intento.resultado.catch(() => {});
        const url = new URL(intento.url);
        autorizaciones.push(url);
        const callback = new URL(url.searchParams.get('redirect_uri'));
        return { url, callback, resultado: intento.resultado, volver: (cambios = {}) => {
            const destino = new URL(callback);
            destino.search = new URLSearchParams({ code: 'CANARIO_CODIGO', state: url.searchParams.get('state'),
                client_id: fixture.clienteEmitido ?? cliente, ...cambios });
            if (cambios.client_id === null) destino.searchParams.delete('client_id');
            return fetch(destino);
        } };
    }
    return { sesion, fixture, solicitudes, opciones, directorio, raiz, iniciar, avanzar: () => { tiempo += 3601000; }, renovaciones: () => renovaciones };
}

function tokens(sufijo, scope = alcance) {
    return { access_token: `CANARIO_acceso_${sufijo}`, refresh_token: `CANARIO_refresh_${sufijo}`, token_type: 'Bearer', expires_in: 3600, scope };
}

async function vincular(ctx, opciones) {
    const intento = await ctx.iniciar(opciones);
    const respuesta = await intento.volver();
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.equal(await respuesta.text(), 'Volvé a la aplicación para comprobar la conexión.');
    return intento.resultado;
}

test('activación explícita, inyección de fetch y propiedad exclusiva', async (t) => {
    const ctx = preparar(t);
    assert.throws(() => abrirSesion({ ...ctx.opciones, modo: undefined }), { codigo: 'modo-no-autorizado' });
    assert.throws(() => abrirSesion({ ...ctx.opciones, modo: 'alojado' }), { codigo: 'modo-no-autorizado' });
    assert.throws(() => abrirSesion({ ...ctx.opciones, modo: 'local-programado' }), { codigo: 'modo-no-autorizado' });
    assert.throws(() => abrirSesion({ ...ctx.opciones, fetch: undefined }), { codigo: 'fetch-requerido' });
    assert.throws(() => abrirSesion(ctx.opciones), { codigo: 'almacen-ocupado' });
    const otroProceso = spawnSync(process.execPath, ['-e', `
        const { abrirSesion } = require(process.argv[1]);
        try { abrirSesion({ modo: 'local-manual', directorio: process.argv[2], fetch: () => {} }); }
        catch (error) {
            if (error.codigo === 'almacen-ocupado') process.exitCode = 7;
            else throw error;
        }
    `, require.resolve('./oauth'), ctx.directorio], { encoding: 'utf8' });
    assert.equal(otroProceso.status, 7);
    assert.equal(otroProceso.stdout, '');
    assert.equal(otroProceso.stderr, '');
    const enlace = join(ctx.raiz, 'enlace');
    symlinkSync(ctx.directorio, enlace);
    assert.throws(() => abrirSesion({ ...ctx.opciones, directorio: enlace }), { codigo: 'almacen-inseguro' });
    assert.equal(statSync(ctx.directorio).mode & 0o777, 0o700);
    await ctx.sesion.cerrar();
    assert.deepEqual(readdirSync(ctx.directorio), []);
});

test('loopback real: PKCE, state inválido, callback único, persistencia y host estable', async (t) => {
    const ctx = preparar(t);
    const intento = await ctx.iniciar();
    assert.equal(intento.url.origin + intento.url.pathname, `${emisor}/api/accounts/authorize`);
    const p = intento.url.searchParams;
    assert.equal(p.get('client_id'), 'dynamic_agent_client');
    assert.equal(p.get('agent_name_hint'), 'Busca Empleos');
    assert.equal(p.get('scope'), alcance);
    assert.equal(p.get('response_type'), 'code');
    assert.equal(p.get('resource'), recurso);
    assert.equal(p.get('code_challenge_method'), 'S256');
    assert.equal(p.has('prompt'), false);
    assert.match(p.get('ext_agent_host_id'), /^urn:uuid:/);
    assert.match(intento.callback.href, /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
    const invalida = await intento.volver({ state: 'CANARIO_INCORRECTO' });
    assert.equal(invalida.status, 400);
    assert.equal(await invalida.text(), 'Solicitud local inválida.');
    assert.equal(ctx.solicitudes.length, 0);
    const [uno, dos] = await Promise.allSettled([intento.volver(), intento.volver()]);
    assert.equal(uno.status === 'fulfilled' && uno.value.status === 200 || dos.status === 'fulfilled' && dos.value.status === 200, true);
    for (const respuesta of [uno, dos]) {
        if (respuesta.status === 'fulfilled') assert.doesNotMatch(await respuesta.value.text(), /CANARIO/);
    }
    const registro = await intento.resultado;
    assert.deepEqual(registro, { clientId: cliente, sujeto: 'cuenta-sintetica', habilitado: true });
    assert.equal(ctx.solicitudes.filter(([, init]) => init.body?.get('grant_type') === 'authorization_code').length, 1);
    await ctx.sesion.cerrar();
    const [archivo] = readdirSync(ctx.directorio);
    assert.equal(statSync(join(ctx.directorio, archivo)).mode & 0o777, 0o600);
    const nueva = abrirSesion(ctx.opciones);
    try {
        assert.equal(await nueva.conToken(({ token }) => token), 'CANARIO_acceso_inicial');
        const reconsentir = await nueva.iniciarVinculo({ clientId: cliente, reconsentir: true });
        reconsentir.resultado.catch(() => {});
        const params = new URL(reconsentir.url).searchParams;
        assert.equal(params.get('ext_agent_host_id'), p.get('ext_agent_host_id'));
        assert.equal(params.get('client_id'), cliente);
        assert.equal(params.get('prompt'), 'consent');
        assert.equal(params.has('force_reconsent'), false);
        assert.equal(params.has('agent_name_hint'), false);
        assert.equal(params.get('scope'), alcance);
        for (const campo of ['state', 'nonce', 'code_challenge']) assert.notEqual(params.get(campo), p.get(campo));
    } finally { await nueva.cerrar(); }
});

test('denegación, scope faltante e identidad diferente no autorizan el reemplazo', async (t) => {
    const ctx = preparar(t);
    const intento = await ctx.iniciar();
    const respuesta = await intento.volver({ error: 'access_denied', error_description: 'CANARIO_PROVEEDOR' });
    assert.equal(respuesta.status, 200);
    assert.doesNotMatch(await respuesta.text(), /CANARIO/);
    await assert.rejects(intento.resultado, { codigo: 'consentimiento-denegado' });
    assert.equal(ctx.solicitudes.length, 0);
    ctx.fixture.alcance = 'openid profile email';
    assert.deepEqual(await vincular(ctx), { clientId: cliente, sujeto: 'cuenta-sintetica', habilitado: false });
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'alcance-insuficiente' });
    ctx.fixture.alcance = alcance;
    await vincular(ctx, { clientId: cliente, reconsentir: true });
    ctx.fixture.reclamos.sub = 'otra-cuenta';
    const distinto = await ctx.iniciar({ clientId: cliente });
    await distinto.volver();
    await assert.rejects(distinto.resultado, { codigo: 'identidad-distinta' });
    assert.equal(await ctx.sesion.conToken(({ token }) => token), 'CANARIO_acceso_inicial');
    const otroCliente = await ctx.iniciar({ clientId: cliente });
    await otroCliente.volver({ client_id: 'oaiapp_distinto' });
    await assert.rejects(otroCliente.resultado, { codigo: 'cliente-invalido' });
});

test('verifica firma, algoritmo, issuer, audiencia, nonce, expiración y discovery', async (t) => {
    const ctx = preparar(t);
    for (const cambio of [{ firmaInvalida: true }, { algoritmo: 'none' }, ...[
        { iss: 'https://otro.invalid' }, { aud: 'otro' }, { nonce: 'otro' }, { exp: 1 }, { sub: '' }
    ].map((reclamos) => ({ reclamos }))]) {
        Object.assign(ctx.fixture, { firmaInvalida: false, algoritmo: 'RS256', reclamos: {} }, cambio);
        const intento = await ctx.iniciar();
        await intento.volver();
        await assert.rejects(intento.resultado, { codigo: 'id-token-invalido' });
    }
    ctx.fixture.discovery.revocation_endpoint = 'https://otro.invalid/revoke';
    const intento = await ctx.iniciar();
    await intento.volver();
    await assert.rejects(intento.resultado, { codigo: 'discovery-invalido' });
    assert.equal(ctx.solicitudes.at(-1)[0], `${emisor}/.well-known/openid-configuration`);
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'sin-sesion' });
});

test('renovación concurrente rota una sola vez; red temporal no borra; 401 OAuth es de dominio', async (t) => {
    const ctx = preparar(t);
    await vincular(ctx);
    ctx.avanzar();
    ctx.fixture.renovar = () => { throw new Error('CANARIO_RED'); };
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'red-oauth', message: 'No se pudo contactar al proveedor OAuth.' });
    delete ctx.fixture.renovar;
    assert.deepEqual(await Promise.all([1, 2, 3].map(() => ctx.sesion.conToken(({ token }) => token))), Array(3).fill('CANARIO_acceso_rotado-2'));
    assert.equal(ctx.renovaciones(), 2);
    ctx.avanzar();
    ctx.fixture.renovar = (params) => {
        assert.equal(params.get('refresh_token'), 'CANARIO_refresh_rotado-2');
        return Response.json({ error: 'invalid_grant', error_description: 'CANARIO_PROVEEDOR' }, { status: 401, headers: { 'x-request-id': 'req_fixture' } });
    };
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), {
        codigo: 'oauth-proveedor', statusUpstream: 401, codigoUpstream: 'invalid_grant', requestId: 'req_fixture'
    });
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'sin-sesion' });
    assert.equal(ctx.renovaciones(), 3);
});

test('desvincular aborta e invalida operaciones y elimina secretos aun sin revocación confirmada', async (t) => {
    const ctx = preparar(t);
    await vincular(ctx);
    const empezado = promesaControlada();
    const trabajo = promesaControlada();
    const resultado = ctx.sesion.conToken(({ signal }) => { empezado.resolve(signal); return trabajo.promise; });
    resultado.catch(() => {});
    const signal = await empezado.promise;
    const revocaciones = [];
    ctx.fixture.revocar = (params) => {
        revocaciones.push(Object.fromEntries(params));
        return new Response('CANARIO_PROVEEDOR', { status: 503 });
    };
    const desvincular = ctx.sesion.desvincular();
    assert.equal(signal.aborted, true);
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'sesion-interrumpida' });
    const salida = await desvincular;
    assert.deepEqual(salida, { revocacionRemotaConfirmada: false, ajustes: 'https://chatgpt.com/settings/usage' });
    assert.equal(revocaciones.length, 2);
    assert.deepEqual(revocaciones[0], { token: 'CANARIO_refresh_inicial', token_type_hint: 'refresh_token', client_id: cliente });
    trabajo.resolve('CANARIO_TARDIO');
    await assert.rejects(resultado, { codigo: 'sesion-interrumpida' });
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'sin-sesion' });
    assert.doesNotMatch(readFileSync(join(ctx.directorio, 'sesion.json'), 'utf8'), /CANARIO|idToken|refreshToken|accessToken/);
    await vincular(ctx, { clientId: cliente });
    ctx.fixture.revocar = () => new Response(null);
    assert.deepEqual(await ctx.sesion.desvincular(), { revocacionRemotaConfirmada: true });
});

test('desvincular durante el canje descarta la vinculación y revoca el refresh tardío', async (t) => {
    const ctx = preparar(t);
    const empezado = promesaControlada();
    const canje = promesaControlada();
    ctx.fixture.canjear = (emitido) => { empezado.resolve(emitido); return canje.promise; };
    const intento = await ctx.iniciar();
    await intento.volver();
    const emitido = await empezado.promise;
    const revocaciones = [];
    ctx.fixture.revocar = (params) => {
        revocaciones.push(params.get('token'));
        return new Response(null);
    };
    const salida = ctx.sesion.desvincular();
    canje.resolve(publicar(emitido));
    await assert.rejects(intento.resultado, { codigo: 'sesion-interrumpida' });
    assert.deepEqual(await salida, { revocacionRemotaConfirmada: true });
    assert.deepEqual(revocaciones, ['CANARIO_refresh_inicial']);
    assert.deepEqual(ctx.sesion.registros(), { activo: null, registros: [] });
    assert.doesNotMatch(readFileSync(join(ctx.directorio, 'sesion.json'), 'utf8'), /CANARIO/);
});

test('invalid_grant inicial permite un intento nuevo con el cliente emitido sin registrarlo antes', async (t) => {
    const ctx = preparar(t);
    ctx.fixture.canjear = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
    const inicial = await ctx.iniciar();
    await inicial.volver();
    await assert.rejects(inicial.resultado, { codigo: 'oauth-proveedor', codigoUpstream: 'invalid_grant' });
    assert.deepEqual(ctx.sesion.registros(), { activo: null, registros: [] });
    const archivo = join(ctx.directorio, 'sesion.json');
    assert.doesNotMatch(readFileSync(archivo, 'utf8'), /oaiapp_sintetico|CANARIO/);
    await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'sin-sesion' });
    await assert.rejects(ctx.sesion.iniciarVinculo({ clientId: cliente, reconsentir: true }), { codigo: 'cliente-invalido' });
    delete ctx.fixture.canjear;
    const nuevo = await ctx.iniciar({ reintentar: true });
    const params = nuevo.url.searchParams;
    assert.equal(params.get('client_id'), cliente);
    assert.equal(params.get('scope'), alcance);
    assert.equal(params.has('prompt'), false);
    assert.equal(params.has('agent_name_hint'), false);
    for (const campo of ['state', 'nonce', 'code_challenge']) assert.notEqual(params.get(campo), inicial.url.searchParams.get(campo));
    const invalida = await nuevo.volver({ state: inicial.url.searchParams.get('state') });
    assert.equal(invalida.status, 400);
    await nuevo.volver({ code: 'CANARIO_CODIGO_NUEVO', client_id: null });
    assert.deepEqual(await nuevo.resultado, { clientId: cliente, sujeto: 'cuenta-sintetica', habilitado: true });
    const canjes = ctx.solicitudes.filter(([, init]) => init.body?.get('grant_type') === 'authorization_code');
    assert.deepEqual(canjes.map(([, { body }]) => body.get('code')), ['CANARIO_CODIGO', 'CANARIO_CODIGO_NUEVO']);
});

test('deduplica desvinculaciones del mismo cliente, rechaza otra cuenta y permite desvincularla después', async (t) => {
    const ctx = preparar(t);
    await vincular(ctx);
    const otroCliente = 'oaiapp_otro';
    ctx.fixture.clienteEmitido = otroCliente;
    await vincular(ctx);
    const revocaciones = [];
    const espera = promesaControlada();
    ctx.fixture.revocar = (body) => {
        revocaciones.push(body.get('client_id'));
        return espera.promise.then(() => new Response(null));
    };
    const primera = ctx.sesion.desvincular(otroCliente);
    try {
        assert.equal(ctx.sesion.desvincular(otroCliente), primera);
        assert.equal(ctx.sesion.desvincular(), primera);
        assert.throws(() => ctx.sesion.desvincular(cliente), { codigo: 'desvinculacion-en-curso' });
    } finally { espera.resolve(); }
    assert.deepEqual(await primera, { revocacionRemotaConfirmada: true });
    assert.deepEqual(revocaciones, [otroCliente]);
    assert.deepEqual(await ctx.sesion.desvincular(cliente), { revocacionRemotaConfirmada: true });
    assert.deepEqual(revocaciones, [otroCliente, cliente]);
});

for (const [caso, codigo, confirma] of [
    ['ID inválido', 'id-token-invalido', true], ['JWKS no disponible', 'oauth-proveedor', false]
]) {
    test(`desvincular tras rotar con ${caso} revoca solo en memoria e informa el resultado`, async (t) => {
        const ctx = preparar(t);
        await vincular(ctx);
        ctx.avanzar();
        const empezado = promesaControlada();
        const rotacion = promesaControlada();
        ctx.fixture.renovar = () => { empezado.resolve(); return rotacion.promise; };
        const operacion = ctx.sesion.conToken(() => assert.fail('No debe ejecutar la operación.'));
        operacion.catch(() => {});
        await empezado.promise;
        if (!confirma) ctx.fixture.jwks = () => Response.json({ error: 'server_error' }, { status: 503 });
        const revocaciones = [];
        const archivo = join(ctx.directorio, 'sesion.json');
        ctx.fixture.revocar = (body) => {
            revocaciones.push(body.get('token'));
            assert.doesNotMatch(readFileSync(archivo, 'utf8'), /CANARIO|idToken|refreshToken|accessToken/);
            return new Response(null, { status: confirma ? 200 : 503 });
        };
        const salida = ctx.sesion.desvincular();
        rotacion.resolve(publicar({ ...tokens('ultimo'), id_token: 'CANARIO_ID_INVALIDO' }));
        await assert.rejects(operacion, { codigo });
        assert.deepEqual(await salida, confirma ? { revocacionRemotaConfirmada: true } : {
            revocacionRemotaConfirmada: false, ajustes: 'https://chatgpt.com/settings/usage'
        });
        assert.deepEqual(revocaciones, Array(confirma ? 1 : 2).fill('CANARIO_refresh_ultimo'));
        assert.doesNotMatch(readFileSync(archivo, 'utf8'), /CANARIO|idToken|refreshToken|accessToken/);
        await assert.rejects(ctx.sesion.conToken(() => assert.fail()), { codigo: 'sin-sesion' });
    });
}

test('solo la desconexión confirmada por Responses borra la concesión y bloquea el siguiente envío', async (t) => {
    const ctx = preparar(t);
    await vincular(ctx);
    const respuestas = [{ detail: 'rechazo genérico' }, { error: { code: 'subscription_sharing_invalid_user' } }];
    let envios = 0;
    const api = crearClienteResponses({ fetch: async () => Response.json(respuestas[envios++], { status: 401 }) });
    const consultar = () => ctx.sesion.conToken(api.listarModelos);
    await assert.rejects(consultar(), { codigo: 'acceso_rechazado', status: 502 });
    assert.equal(ctx.sesion.registros().activo, cliente);

    await assert.rejects(consultar(), {
        codigo: 'acceso_rechazado', status: 502, upstream: { status: 401, codigo: 'subscription_sharing_invalid_user', forma: 'error' }
    });
    await assert.rejects(consultar(), { codigo: 'sin-sesion' });
    assert.equal(envios, 2);
    assert.deepEqual(ctx.sesion.registros(), { activo: null, registros: [{ clientId: cliente, sujeto: 'cuenta-sintetica', habilitado: false }] });
    assert.doesNotMatch(readFileSync(join(ctx.directorio, 'sesion.json'), 'utf8'), /CANARIO|idToken|refreshToken|accessToken/);
});

test('una desconexión tardía no borra la concesión nueva del mismo cliente', async (t) => {
    const ctx = preparar(t);
    await vincular(ctx);
    const inicio = promesaControlada();
    const respuesta = promesaControlada();
    const api = crearClienteResponses({ fetch: () => { inicio.resolve(); return respuesta.promise; } });
    const operacion = assert.rejects(ctx.sesion.conToken(api.listarModelos), { codigo: 'acceso_rechazado' });
    await inicio.promise;
    await vincular(ctx, { clientId: cliente });
    respuesta.resolve(Response.json({ error: { code: 'subscription_sharing_invalid_user' } }, { status: 401 }));
    await operacion;
    assert.equal(ctx.sesion.registros().activo, cliente);
    assert.equal(await ctx.sesion.conToken(({ token }) => token), 'CANARIO_acceso_inicial');
});

test('desvincular durante la rotación revoca el token nuevo sin ejecutar la operación', async (t) => {
    const ctx = preparar(t);
    await vincular(ctx);
    ctx.avanzar();
    const empezado = promesaControlada();
    const rotacion = promesaControlada();
    ctx.fixture.renovar = () => { empezado.resolve(); return rotacion.promise; };
    const operacion = ctx.sesion.conToken(() => assert.fail());
    operacion.catch(() => {});
    await empezado.promise;
    ctx.fixture.revocar = (params) => {
        assert.equal(params.get('token'), 'CANARIO_refresh_ultimo');
        return new Response(null);
    };
    const salida = ctx.sesion.desvincular();
    rotacion.resolve(publicar(tokens('ultimo')));
    await assert.rejects(operacion, { codigo: 'sesion-interrumpida' });
    assert.deepEqual(await salida, { revocacionRemotaConfirmada: true });
});
