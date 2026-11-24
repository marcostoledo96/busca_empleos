const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ejecutar } = require('./prueba-luna');

const args = ['--creditos-desactivados'];
const uso = 'Uso: node backend/piloto-chatgpt/prueba-luna.js --creditos-desactivados';
const url = 'https://api.openai.com/v1/responses';

function preparar(responder) {
    const llamadas = [];
    const salida = [];
    let aperturas = 0;
    let cierres = 0;
    return {
        llamadas, salida,
        conteos: () => ({ aperturas, cierres }),
        opciones: {
            interactivo: true,
            abrir: () => {
                aperturas++;
                return {
                    conToken: (operar) => operar({ token: 'canario-privado', signal: new AbortController().signal }),
                    cerrar: async () => { cierres++; },
                };
            },
            fetch: async (destino, opciones) => { llamadas.push([destino, opciones]); return responder(); },
            escribir: (linea) => salida.push(linea),
        },
    };
}

function completar(datos) {
    const evento = { type: 'response.completed', response: { status: 'completed', output: [{ type: 'message',
        role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(datos) }] }] } };
    return new Response(`event: response.completed\ndata: ${JSON.stringify(evento)}\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
    });
}

test('sin confirmación explícita o sin terminal no abre sesión ni red', async () => {
    const f = preparar(() => { throw new Error('Solicitud inesperada'); });
    for (const argumentos of [[], ['--help'], ['--creditos-desactivados', 'otro']]) {
        assert.equal(await ejecutar(argumentos, f.opciones), argumentos[0] === '--help' ? 0 : 2);
    }
    assert.equal(await ejecutar(args, { ...f.opciones, interactivo: false }), 2);
    assert.deepEqual(f.salida, [uso, uso, uso, 'La prueba requiere una terminal interactiva en Ubuntu.']);
    assert.deepEqual(f.conteos(), { aperturas: 0, cierres: 0 });
    assert.deepEqual(f.llamadas, []);
});

test('envía un único caso ficticio fijo a Luna y solo publica el estado validado', async () => {
    const f = preparar(() => completar({ estado: 'por_confirmar', motivo: 'canario-privado' }));
    assert.equal(await ejecutar(args, f.opciones), 0);
    assert.equal(f.llamadas.length, 1);
    const [destino, opciones] = f.llamadas[0];
    assert.equal(destino, url);
    assert.equal(opciones.method, 'POST');
    assert.equal(opciones.redirect, 'error');
    assert.equal(opciones.credentials, 'omit');
    assert.equal(opciones.headers.Authorization, 'Bearer canario-privado');
    assert.deepEqual(JSON.parse(opciones.body), { model: 'gpt-6-luna', store: false, stream: true, input: [{ role: 'user',
        content: 'Oferta ficticia: Soporte IT Junior, presencial en CABA; Active Directory se menciona sin indicar si es obligatorio. Perfil ficticio: soporte básico, experiencia con Active Directory desconocida. Devolvé únicamente un objeto JSON con estado "por_confirmar" y motivo breve; no inventes experiencia.' }] });
    assert.deepEqual(f.conteos(), { aperturas: 1, cierres: 1 });
    assert.deepEqual(f.salida, ['{"modelo":"gpt-6-luna","estado":"por_confirmar","salida_validada":true}']);
});

test('el diagnóstico distingue fallo previo al POST, intento sin HTTP y respuesta HTTP', async () => {
    const previo = preparar(() => { assert.fail('No se debe llamar al proveedor.'); });
    assert.equal(await ejecutar(args, { ...previo.opciones, abrir() {
        throw Object.assign(new Error('canario-privado'), { codigo: 'canario-privado' });
    } }), 1);
    assert.deepEqual(previo.llamadas, []);
    assert.deepEqual(previo.conteos(), { aperturas: 0, cierres: 0 });
    assert.deepEqual(previo.salida, ['Prueba no completada (sin_diagnostico; etapa=antes_del_post). No la repitas.']);

    const transporte = preparar(() => { throw new Error('canario-privado'); });
    assert.equal(await ejecutar(args, transporte.opciones), 1);
    assert.equal(transporte.llamadas.length, 1);
    assert.deepEqual(transporte.conteos(), { aperturas: 1, cierres: 1 });
    assert.deepEqual(transporte.salida, ['Prueba no completada (fallo_de_transporte; etapa=post_intentado_sin_http). No la repitas.']);

    const rechazo = preparar(() => Response.json({ error: { code: 'codigo_privado', message: 'canario-privado' } }, { status: 400 }));
    assert.equal(await ejecutar(args, rechazo.opciones), 1);
    assert.equal(rechazo.llamadas.length, 1);
    assert.deepEqual(rechazo.conteos(), { aperturas: 1, cierres: 1 });
    assert.deepEqual(rechazo.salida, ['Prueba no completada (solicitud_rechazada; etapa=respuesta_http; HTTP=400). No la repitas.']);
});

test('fallo de proveedor o de contrato termina sin reintentos ni salida privada', async () => {
    for (const [responder, codigo, http] of [
        [() => new Response('canario-privado', { status: 429 }), 'limite_de_uso', 429],
        [() => completar({ estado: 'aprobada', motivo: 'canario-privado' }), 'salida_invalida', 200],
    ]) {
        const f = preparar(responder);
        assert.equal(await ejecutar(args, f.opciones), 1);
        assert.equal(f.llamadas.length, 1);
        assert.deepEqual(f.conteos(), { aperturas: 1, cierres: 1 });
        assert.deepEqual(f.salida, [`Prueba no completada (${codigo}; etapa=respuesta_http; HTTP=${http}). No la repitas.`]);
    }
});
