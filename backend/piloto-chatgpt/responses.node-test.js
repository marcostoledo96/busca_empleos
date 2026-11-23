const assert = require('node:assert/strict');
const test = require('node:test');

const token = 'oauth-canario-local';
const input = [{ role: 'user', content: 'Texto sintético' }];
const modelo = 'slug-fixture';
const completar = (output = [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"valor":1}' }] }]) => ({
    type: 'response.completed', response: { status: 'completed', output }
});
const evento = (datos) => `event: ${datos.type}\r\ndata: ${JSON.stringify(datos)}\r\n\r\n`;
const sse = (body) => new Response(body, { headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_fixture' } });
const cliente = (fetch, plazoMs = 1000) => require('./responses').crearClienteResponses({ fetch, plazoMs });
const opciones = (cambios = {}) => ({ token, signal: new AbortController().signal, modelo, input, validar: (dato) => dato.valor === 1, ...cambios });
const error = (codigo, metadata = {}) => (e) => {
    assert.equal(e.name, 'ErrorResponses');
    assert.equal(e.codigo, codigo);
    assert.equal(e.status, 502);
    assert.deepEqual(e.upstream, metadata);
    assert.equal(e.cause, undefined);
    assert.doesNotMatch(JSON.stringify(e) + e.stack, /oauth-canario-local|texto-privado/);
    return true;
};

test('catálogo SIWC: slugs y nombres visibles en el orden del proveedor', async () => {
    let llamadas = 0;
    const api = cliente(async (url, init) => {
        llamadas++;
        assert.equal(url, 'https://api.openai.com/v1/models');
        assert.equal(init.method, 'GET');
        assert.equal(init.redirect, 'error');
        assert.equal(init.credentials, 'omit');
        assert.deepEqual(init.headers, { Authorization: `Bearer ${token}` });
        assert.equal(init.body, undefined);
        assert.ok(init.signal instanceof AbortSignal);
        return Response.json({ models: [
            { slug: modelo, display_name: 'Luna fixture', visibility: 'list' },
            { slug: 'oculto', visibility: 'hide' },
            { slug: 'sol-fixture', display_name: 'Sol fixture', visibility: 'list' }
        ] });
    });
    assert.deepEqual(await api.listarModelos(opciones()), [
        { slug: modelo, display_name: 'Luna fixture' },
        { slug: 'sol-fixture', display_name: 'Sol fixture' }
    ]);
    assert.equal(llamadas, 1);
});

test('Responses directo: allowlist, SSE fragmentado y validación de salida terminal', async () => {
    let llamadas = 0;
    let validaciones = 0;
    const api = cliente(async (url, init) => {
        llamadas++;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(init.method, 'POST');
        assert.equal(init.redirect, 'error');
        assert.equal(init.credentials, 'omit');
        assert.deepEqual(init.headers, { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' });
        assert.deepEqual(JSON.parse(init.body), { model: modelo, input, store: false, stream: true });
        const bytes = Buffer.from(': señal\r\n\r\n' + evento({ type: 'response.output_text.delta', delta: 'ignorar' }) + evento(completar()));
        return sse(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
    });
    assert.deepEqual(await api.generarRespuesta(opciones({
        max_output_tokens: 10, temperature: 1,
        validar: async (dato) => { validaciones++; assert.deepEqual(dato, { valor: 1 }); return true; }
    })), { valor: 1 });
    assert.deepEqual([llamadas, validaciones], [1, 1]);
});

test('rechaza entradas inválidas antes de fetch y catálogos malformados', async () => {
    assert.throws(() => require('./responses').crearClienteResponses(), TypeError);
    let llamadas = 0;
    const api = cliente(async () => { llamadas++; return Response.json({ models: [{ slug: 1, display_name: 'Fixture', visibility: 'list' }] }); });
    for (const cambios of [{ token: '' }, { token: 'inseguro\n' }, { signal: undefined }, { input: [] },
        { input: Array(1) }, { input: [{ role: 'user', content: [{ type: 'input_file', file_id: 'fixture' }] }] },
        { modelo: '' }, { validar: undefined }]) {
        await assert.rejects(api.generarRespuesta(opciones(cambios)), error('entrada_invalida'));
    }
    assert.equal(llamadas, 0);
    await assert.rejects(api.listarModelos(opciones()), error('catalogo_invalido', { status: 200 }));
    assert.equal(llamadas, 1);
});

test('admisión y códigos upstream: conserva metadatos seguros; nunca propaga HTTP 401 ni reintenta', async () => {
    const codigoCuota = 'subscription_sharing_usage_limit_exceeded';
    for (const [status, body, requestId, codigo, upstream] of [
        [401, null, 'req_fixture', 'acceso_rechazado', { status: 401, requestId: 'req_fixture' }],
        [401, { detail: 'texto-privado' }, 'req_fixture', 'acceso_rechazado', { status: 401, requestId: 'req_fixture', forma: 'detail' }],
        [401, { error: { code: 'invalid_api_key', message: 'texto-privado' } }, 'req_fixture', 'acceso_rechazado', { status: 401, codigo: 'invalid_api_key', requestId: 'req_fixture', forma: 'error' }],
        [403, { detail: 'texto-privado' }, 'req_fixture', 'acceso_rechazado', { status: 403, requestId: 'req_fixture', forma: 'detail' }],
        [429, { error: { code: codigoCuota, message: 'texto-privado' } }, 'req_fixture', 'limite_de_uso', { status: 429, codigo: codigoCuota, requestId: 'req_fixture', forma: 'error' }],
        [503, { error: { code: token, message: 'texto-privado' } }, `req_${token}`, 'proveedor_no_disponible', { status: 503, forma: 'error' }]
    ]) {
        let llamadas = 0;
        const api = cliente(async () => { llamadas++; return Response.json(body, { status, headers: { 'x-request-id': requestId } }); });
        await assert.rejects(api.generarRespuesta(opciones()), error(codigo, upstream));
        assert.equal(llamadas, 1);
    }
});

test('rechaza el rol system antes de enviar la solicitud SIWC', async () => {
    let llamadas = 0;
    const api = cliente(async () => { llamadas++; return sse(evento(completar())); });
    const mensaje = { type: 'message', role: 'system', content: 'Instrucciones sintéticas' };
    await assert.rejects(api.generarRespuesta(opciones({ input: [mensaje, ...input] })), error('entrada_invalida'));
    assert.equal(llamadas, 0);
});

test('rechaza esfuerzo y formato estructurado explícitos antes de fetch', async () => {
    let llamadas = 0;
    const api = cliente(async () => { llamadas++; return sse(evento(completar())); });
    for (const cambios of [{ reasoning: { effort: 'high' } }, { text: { format: { type: 'json_schema' } } }]) {
        await assert.rejects(api.generarRespuesta(opciones(cambios)), error('capacidad_no_admitida'));
    }
    assert.equal(llamadas, 0);
});

test('solo un evento completed válido con JSON y validador afirmativo produce un resultado', async () => {
    const metadata = { status: 200, requestId: 'req_fixture' };
    for (const [body, codigo, validar, upstream = metadata] of [
        ['data: [DONE]\n\n', 'stream_invalido'],
        [evento({ type: 'response.output_text.delta', delta: '{"valor":1}' }), 'stream_interrumpido'],
        [evento(completar()).slice(0, -2), 'stream_interrumpido'],
        [evento({ type: 'response.incomplete', response: { status: 'incomplete' } }), 'respuesta_incompleta'],
        [evento({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }), 'limite_de_uso', undefined, { ...metadata, codigo: 'subscription_sharing_usage_limit_exceeded' }],
        [evento(completar([{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'texto-privado' }] }])), 'salida_invalida'],
        [evento(completar()), 'salida_invalida', () => false],
        [evento(completar()), 'salida_invalida', () => { throw Error('texto-privado'); }]
    ]) {
        let llamadas = 0;
        const api = cliente(async () => { llamadas++; return sse(body); });
        await assert.rejects(api.generarRespuesta(opciones(validar ? { validar } : {})), error(codigo, upstream));
        assert.equal(llamadas, 1);
    }
});

test('el plazo abarca fetch, los cuerpos de catálogo, admisión y SSE, y la validación asíncrona', async () => {
    for (const fase of ['fetch', 'catalogo', 'admision', 'sse', 'validar']) {
        let signal;
        let cancelaciones = 0;
        const cuerpo = () => new ReadableStream({ cancel() { cancelaciones++; } });
        const api = cliente(async (url, init) => {
            signal = init.signal;
            if (fase === 'fetch') return new Promise(() => {});
            if (fase === 'catalogo') return new Response(cuerpo());
            if (fase === 'admision') return new Response(cuerpo(), { status: 401 });
            return sse(fase === 'sse' ? cuerpo() : evento(completar()));
        }, 30);
        const args = opciones({ validar: () => new Promise(() => {}) });
        await assert.rejects(fase === 'catalogo' ? api.listarModelos(args) : api.generarRespuesta(args), { codigo: 'plazo_agotado' });
        assert.equal(signal.aborted, true);
        if (['catalogo', 'admision', 'sse'].includes(fase)) assert.equal(cancelaciones, 1);
    }
});

test('aborto previo impide fetch; abortos durante fetch/validación descartan resultados tardíos', async () => {
    const controller = new AbortController();
    let llamadas = 0;
    let terminar;
    let validaciones = 0;
    const api = cliente(async () => { llamadas++; return new Promise((resolve) => { terminar = resolve; }); });
    const args = opciones({ signal: controller.signal, validar: () => { validaciones++; return true; } });
    const pendiente = api.generarRespuesta(args);
    controller.abort(new Error('texto-privado'));
    await assert.rejects(pendiente, error('cancelado'));
    terminar(sse(evento(completar())));
    await assert.rejects(api.generarRespuesta(args), error('cancelado'));
    assert.deepEqual([llamadas, validaciones], [1, 0]);

    const otra = new AbortController();
    let entrar;
    const validando = new Promise((resolve) => { entrar = resolve; });
    const tardia = cliente(async () => sse(evento(completar()))).generarRespuesta(opciones({
        signal: otra.signal,
        validar: () => new Promise((resolve) => { terminar = resolve; entrar(); })
    }));
    await validando;
    otra.abort();
    terminar(true);
    await assert.rejects(tardia, error('cancelado', { status: 200, requestId: 'req_fixture' }));
});
