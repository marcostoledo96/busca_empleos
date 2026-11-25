const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { EventEmitter } = require('node:events');
const { createHash } = require('node:crypto');
const https = require('node:https');
const Module = require('node:module');

const cargar = Module._load;
Module._load = function (id, ...resto) {
    assert.doesNotMatch(id, /dotenv|deepseek|servicio-evaluacion|base-de-datos|conexion|cache|modelos|^(pg|axios)$/i,
        'El ejecutor no puede cargar el cliente ni persistencia de la aplicación');
    return cargar.call(this, id, ...resto);
};
const { preparar, ejecutar } = require('../../scripts/comparacion-presupuesto-117');
const sha = 'f'.repeat(40);
const plan = preparar(sha);

function escenario(t, recibir) {
    const dir = fs.mkdtempSync(join(tmpdir(), 'comparacion-117-'));
    const intentos = [];
    const huellas = [];
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    t.mock.method(https, 'request', (url, opciones, callback) => {
        assert.equal(url, 'https://api.deepseek.com/chat/completions');
        assert.equal(opciones.method, 'POST');
        assert.equal(opciones.agent, false);
        const solicitud = new EventEmitter();
        solicitud.end = (texto) => {
            const inicio = JSON.parse(fs.readFileSync(join(dir, `intento-${intentos.length + 1}.json`)));
            intentos.push(JSON.parse(texto));
            huellas.push(createHash('sha256').update(texto).digest('hex'));
            assert.equal(inicio.intento, intentos.length, 'Contar antes de iniciar HTTP');
            assert.equal(inicio.estado, 'iniciado');
            queueMicrotask(() => {
                const simulado = recibir(intentos.length, opciones.signal);
                if (simulado instanceof Error) return solicitud.emit('error', simulado);
                const respuesta = new EventEmitter();
                respuesta.statusCode = simulado.status ?? 200;
                respuesta.resume = () => {};
                callback(respuesta);
                respuesta.emit('data', Buffer.from(JSON.stringify(simulado.cuerpo)));
                respuesta.emit('end');
            });
        };
        solicitud.destroy = () => {};
        return solicitud;
    });
    const ejecutarUnaVez = (huella = plan.huella, revisar = async () => {
        throw new Error('No debe revisar una respuesta inválida');
    }) => ejecutar(plan, huella, { directorio: dir, marca: join(dir, 'consumido'), clave: 'credencial-ficticia', revisar });
    return { dir, intentos, huellas, ejecutarUnaVez };
}

function respuesta(finish_reason = 'length', contenido = '{}', entrada = 7000) {
    return { cuerpo: {
        model: 'deepseek-flash', choices: [{ finish_reason, message: {
            content: contenido, reasoning_content: 'RAZONAMIENTO_NO_PERSISTIR',
        } }], usage: { prompt_tokens: entrada, prompt_cache_hit_tokens: 0,
            prompt_cache_miss_tokens: entrada, completion_tokens: 1000,
            completion_tokens_details: { reasoning_tokens: 800 } },
    } };
}

test('preparar no usa HTTP y produce tres pares que solo varían en max_tokens', (t) => {
    const sim = escenario(t, () => { throw new Error('No debe salir a la red'); });
    assert.equal(preparar(sha).huella, plan.huella);
    assert.deepEqual(plan.solicitudes.map(({ payload }) => payload.max_tokens), [4096, 8192, 4096, 8192, 4096, 8192]);
    assert.deepEqual(plan.solicitudes.map(({ caso }) => caso.id.match(/^caso-(\d+)/)[1]), ['16', '16', '17', '17', '15', '15']);
    for (let i = 0; i < 6; i += 2) {
        const [{ payload: a, caso }, { payload: b }] = plan.solicitudes.slice(i, i + 2);
        assert.deepEqual({ ...a, max_tokens: 8192 }, b);
        assert.equal(a.reasoning_effort, 'low');
        assert.equal(a.thinking.type, 'enabled');
        assert.ok(!JSON.stringify(a).includes(caso.respuesta_ia_simulada));
    }
    assert.ok(plan.costoMaximo <= 100_000_000);
    assert.deepEqual(sim.intentos, []);
    assert.deepEqual(fs.readdirSync(sim.dir), []);
});

test('seis intentos, truncados aunque parezcan JSON, y una sola ejecución', async (t) => {
    const sim = escenario(t, () => respuesta());
    assert.equal(await sim.ejecutarUnaVez(), 6);
    assert.equal(sim.intentos.length, 6);
    assert.deepEqual(sim.intentos, plan.solicitudes.map(({ payload }) => payload));
    assert.deepEqual(sim.huellas, plan.pares.flatMap(({ huellas_payload }) => huellas_payload));
    for (let i = 1; i <= 6; i++) {
        const texto = fs.readFileSync(join(sim.dir, `intento-${i}-resultado.json`), 'utf8');
        assert.equal(JSON.parse(texto).estado, 'SALIDA_TRUNCADA');
        assert.equal(JSON.parse(texto).contrato_valido, false);
        assert.doesNotMatch(texto, /RAZONAMIENTO_NO_PERSISTIR/);
    }
    await assert.rejects(sim.ejecutarUnaVez(), /PERMISO_YA_CONSUMIDO/);
    assert.equal(sim.intentos.length, 6);
    assert.equal(fs.readdirSync(sim.dir).length, 13);
});

test('el peor uso válido cabe antes de cada intento', async (t) => {
    const sim = escenario(t, numero => {
        const { cotaEntrada, payload } = plan.solicitudes[numero - 1];
        const salida = respuesta('length', '{}', cotaEntrada);
        salida.cuerpo.usage.completion_tokens = payload.max_tokens;
        return salida;
    });
    assert.equal(await sim.ejecutarUnaVez(), 6);
    let acumulado = 0;
    for (let i = 1; i <= 6; i++) {
        const inicio = JSON.parse(fs.readFileSync(join(sim.dir, `intento-${i}.json`)));
        const fin = JSON.parse(fs.readFileSync(join(sim.dir, `intento-${i}-resultado.json`)));
        assert.equal(inicio.acumulado_previo_nanousd, acumulado);
        assert.equal(acumulado + inicio.reserva_restante_nanousd, plan.costoMaximo);
        assert.equal(fin.costo_maximo_estimado_nanousd, inicio.reserva_nanousd);
        acumulado += fin.costo_maximo_estimado_nanousd;
    }
    assert.equal(acumulado, plan.costoMaximo);
    assert.ok(acumulado <= 100_000_000);
});

for (const [nombre, error, obtener] of [
    ['autenticación', 'HTTP_401', () => ({ ...respuesta(), status: 401 })],
    ['redirección', 'HTTP_307', () => ({ ...respuesta(), status: 307 })],
    ['transporte', 'TRANSPORTE_INCIERTO', () => new Error('No divulgar este detalle')],
    ['timeout', 'TIMEOUT_INCIERTO', (_, signal) => {
        assert.equal(signal.aborted, true);
        return signal.reason;
    }],
    ['presupuesto', 'USO_FUERA_DE_COTA', () => respuesta('length', '{}', 50000)],
]) {
    test(`corta sin reintentar ante ${nombre}`, async (t) => {
        if (nombre === 'timeout') t.mock.method(AbortSignal, 'timeout', (ms) => {
            assert.equal(ms, 60_000);
            return AbortSignal.abort(new DOMException('Tiempo agotado', 'TimeoutError'));
        });
        const sim = escenario(t, obtener);
        await assert.rejects(sim.ejecutarUnaVez(), { message: error });
        assert.equal(sim.intentos.length, 1);
        const registro = JSON.parse(fs.readFileSync(join(sim.dir, 'intento-1-resultado.json'), 'utf8'));
        assert.equal(registro.estado, error);
        assert.ok(registro.reserva_nanousd > 0);
        assert.equal(registro.costo_maximo_estimado_nanousd, undefined);
        if (nombre === 'presupuesto') {
            assert.equal(registro.finish_reason, 'length');
            assert.deepEqual(registro.uso_reportado, { entrada_tokens: 50000, salida_tokens: 1000, razonamiento_tokens: 800 });
        }
        assert.equal(fs.readdirSync(sim.dir).length, 3);
    });
}

test('un stop no acredita un contrato inválido y continúa como fallo técnico', async (t) => {
    const sim = escenario(t, (numero) => numero === 1 ? respuesta('stop', '{}') : respuesta());
    assert.equal(await sim.ejecutarUnaVez(), 6);
    const registro = JSON.parse(fs.readFileSync(join(sim.dir, 'intento-1-resultado.json'), 'utf8'));
    assert.equal(registro.finish_reason, 'stop');
    assert.equal(registro.json_valido, true);
    assert.equal(registro.contrato_valido, false);
    assert.equal(registro.estado, 'CONTRATO_INVALIDO');
});

test('una huella distinta no consume el permiso ni inicia HTTPS', async (t) => {
    const sim = escenario(t, () => { throw new Error('No debe salir a la red'); });
    await assert.rejects(sim.ejecutarUnaVez('0'.repeat(64)), { message: 'PLAN_NO_COINCIDE' });
    assert.deepEqual(sim.intentos, []);
    assert.deepEqual(fs.readdirSync(sim.dir), []);
});

const resultadoFinal = {
    match: true, porcentaje: 60, razon: 'Respuesta sintética para revisar.',
    explicacion: {
        cumplidos: [{ requisito: 'JavaScript', tipo: 'obligatorio', evidencia_oferta: 'JavaScript',
            evidencia_perfil: 'JavaScript', explicacion: 'El perfil confirma el requisito.' }],
        no_cumplidos: [], por_confirmar: [], exclusiones: [],
    },
};
test('un porcentaje coercible no satisface el contrato crudo', async (t) => {
    const sim = escenario(t, numero => numero === 1
        ? respuesta('stop', JSON.stringify({ ...resultadoFinal, porcentaje: '60' })) : respuesta());
    assert.equal(await sim.ejecutarUnaVez(), 6);
    const registro = JSON.parse(fs.readFileSync(join(sim.dir, 'intento-1-resultado.json'), 'utf8'));
    assert.equal(registro.json_valido, true);
    assert.equal(registro.contrato_valido, false);
    assert.equal(registro.estado, 'CONTRATO_INVALIDO');
    assert.equal(registro.respuesta_final, undefined);
});

test('un campo fuera del contrato no se guarda ni pasa a revisión', async (t) => {
    const sim = escenario(t, numero => numero === 1
        ? respuesta('stop', JSON.stringify({ ...resultadoFinal, reasoning_content: 'RAZONAMIENTO_NO_PERSISTIR' })) : respuesta());
    assert.equal(await sim.ejecutarUnaVez(), 6);
    const texto = fs.readFileSync(join(sim.dir, 'intento-1-resultado.json'), 'utf8');
    assert.equal(JSON.parse(texto).contrato_valido, false);
    assert.equal(JSON.parse(texto).respuesta_final, undefined);
    assert.doesNotMatch(texto, /RAZONAMIENTO_NO_PERSISTIR/);
});

test('una revisión ausente detiene la ejecución y conserva el resultado pendiente', async (t) => {
    const sim = escenario(t, () => respuesta('stop', JSON.stringify(resultadoFinal)));
    await assert.rejects(sim.ejecutarUnaVez(plan.huella, async () => undefined), { message: 'REVISION_NO_DISPONIBLE' });
    assert.equal(sim.intentos.length, 1);
    const registro = JSON.parse(fs.readFileSync(join(sim.dir, 'intento-1-resultado.json'), 'utf8'));
    assert.equal(registro.estado, 'PENDIENTE_REVISION');
    assert.equal(fs.existsSync(join(sim.dir, 'intento-1-revision.json')), false);
});

for (const corte of [1, 6, null]) {
    test(`una salida válida espera revisión incluso en el último intento (corte: ${corte})`, async (t) => {
        const sim = escenario(t, () => respuesta('stop', JSON.stringify(resultadoFinal)));
        const revisados = [];
        const ejecutar = sim.ejecutarUnaVez(plan.huella, async (intento) => {
            const ruta = join(sim.dir, `intento-${intento}-resultado.json`);
            const texto = fs.readFileSync(ruta, 'utf8');
            assert.equal(sim.intentos.length, intento);
            assert.equal(fs.statSync(ruta).mode & 0o777, 0o600);
            assert.equal(JSON.parse(texto).contrato_valido, true);
            assert.deepEqual(JSON.parse(texto).respuesta_final, resultadoFinal);
            assert.doesNotMatch(texto, /RAZONAMIENTO_NO_PERSISTIR/);
            revisados.push(intento);
            return { continuar: intento !== corte, evidencia: 'Umbral y requisitos revisados.' };
        });
        if (corte) await assert.rejects(ejecutar, { message: 'REVISION_RECHAZADA' });
        else assert.equal(await ejecutar, 6);
        assert.equal(sim.intentos.length, corte ?? 6);
        assert.deepEqual(revisados, Array.from({ length: corte ?? 6 }, (_, i) => i + 1));
        const revision = JSON.parse(fs.readFileSync(join(sim.dir, `intento-${corte ?? 6}-revision.json`), 'utf8'));
        assert.deepEqual(revision, { continuar: !corte, evidencia: 'Umbral y requisitos revisados.' });
    });
}
