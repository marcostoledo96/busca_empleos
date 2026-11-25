const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { dirname, join } = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const { setTimeout: esperar } = require('node:timers/promises');
const { tmpdir } = require('node:os');
const { EventEmitter, once } = require('node:events');
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
        const ejecutar = sim.ejecutarUnaVez(plan.huella, async (intento, contenido) => {
            const ruta = join(sim.dir, `intento-${intento}-resultado.json`);
            const texto = fs.readFileSync(ruta, 'utf8');
            assert.equal(sim.intentos.length, intento);
            assert.equal(fs.statSync(ruta).mode & 0o777, 0o600);
            assert.equal(JSON.parse(texto).contrato_valido, true);
            assert.deepEqual(JSON.parse(contenido), resultadoFinal);
            assert.equal(JSON.parse(texto).respuesta_final, undefined);
            assert.doesNotMatch(texto, /Respuesta sintética para revisar/);
            assert.doesNotMatch(texto, /RAZONAMIENTO_NO_PERSISTIR/);
            revisados.push(intento);
            return { continuar: intento !== corte, evidencia: 'Umbral y requisitos revisados.' };
        });
        if (corte) await assert.rejects(ejecutar, { message: 'REVISION_RECHAZADA' });
        else assert.equal(await ejecutar, 6);
        assert.equal(sim.intentos.length, corte ?? 6);
        assert.deepEqual(revisados, Array.from({ length: corte ?? 6 }, (_, i) => i + 1));
        const revision = JSON.parse(fs.readFileSync(join(sim.dir, `intento-${corte ?? 6}-revision.json`), 'utf8'));
        assert.deepEqual(revision, { continuar: !corte, evidencia: 'Umbral y requisitos revisados.',
            ...(!corte && { match: true, porcentaje: 60 }) });
    });
}

const RELATIVA = 'backend/scripts/comparacion-presupuesto-117.js';
const FUENTES = [RELATIVA, 'backend/tests/fixtures/casos-muestra-matching.js',
    ...['entradas-evaluacion', 'perfil-efectivo', 'parser-respuesta-ia']
        .map(nombre => `backend/src/servicios/evaluacion/${nombre}.js`)];
const RAIZ = join(__dirname, '../../..');
const MARCADOR = /MARCADOR_PRIVADO_DE_PRUEBA|RAZONAMIENTO_NO_PERSISTIR/;

function pruebaCli(t) {
    const temporal = fs.mkdtempSync('/var/tmp/comparacion-117-');
    t.after(() => fs.rmSync(temporal, { recursive: true, force: true }));
    const marca = join(temporal, 'permiso');
    const env = { PATH: process.env.PATH, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
    function checkout(nombre) {
        const raiz = fs.mkdirSync(join(temporal, nombre), { recursive: true });
        const git = (args, input) => execFileSync('git', args, { cwd: raiz, env, input, stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8' }).trim();
        git(['init', '--quiet', '--template=']);
        const arbol = {};
        for (const ruta of FUENTES) {
            const destino = join(raiz, ruta);
            fs.mkdirSync(dirname(destino), { recursive: true });
            fs.copyFileSync(join(RAIZ, ruta), destino);
            const partes = ruta.split('/');
            const hoja = partes.pop();
            const padre = partes.reduce((nodo, parte) => nodo[parte] ??= {}, arbol);
            padre[hoja] = git(['hash-object', '-w', '--', ruta]);
        }
        const escribirArbol = nodo => git(['mktree'], Object.entries(nodo).map(([nombre, hijo]) =>
            typeof hijo === 'string' ? `100644 blob ${hijo}\t${nombre}\n` : `040000 tree ${escribirArbol(hijo)}\t${nombre}\n`).join(''));
        const sha = git(['hash-object', '-t', 'commit', '-w', '--stdin'], `tree ${escribirArbol(arbol)}\n`
            + `author Prueba <prueba@example.invalid> 1 +0000\ncommitter Prueba <prueba@example.invalid> 1 +0000\n\nPrueba aislada ${nombre}\n`);
        git(['update-ref', 'HEAD', sha]);
        git(['read-tree', 'HEAD']);
        const directorio = join(temporal, `${nombre}-resultados`);
        fs.mkdirSync(directorio, { mode: 0o700 });
        const contador = join(temporal, `${nombre}-https`);
        const ambiente = { ...env, HOME: raiz, TMPDIR: directorio, DEEPSEEK_API_KEY: 'credencial-ficticia',
            CONTADOR_MOCK: contador, MARCA_MOCK: marca };
        const cli = ['--require', join(__dirname, 'fixtures/comparacion-presupuesto-117-mock.cjs'), join(raiz, RELATIVA)];
        const opciones = { cwd: directorio, env: ambiente };
        const salida = join(directorio, 'salida-revision.fifo');
        const entrada = join(directorio, 'entrada-revision.fifo');
        execFileSync('mkfifo', ['-m', '600', entrada, salida]);
        const abrir = ruta => fs.openSync(ruta, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
        const fdEntrada = abrir(entrada), fdSalida = abrir(salida);
        t.after(() => { fs.closeSync(fdEntrada); fs.closeSync(fdSalida); });
        const prepararCli = () => spawnSync(process.execPath, [...cli, '--preparar'], { ...opciones, encoding: 'utf8', timeout: 5000 });
        const iniciar = (huella, fd = fdSalida, timeoutRevision = false) => {
            const stdio = [fdEntrada, 'pipe', 'pipe'];
            if (fd !== null) stdio.push(fd);
            const hijo = spawn(process.execPath, [...cli, '--ejecutar', directorio, sha, huella], {
                ...opciones, env: { ...ambiente, ...(timeoutRevision && { REVISION_TIMEOUT_MOCK: '1' }) }, stdio, timeout: 5000,
            });
            let stdout = '', stderr = '';
            hijo.stdout.setEncoding('utf8').on('data', texto => { stdout += texto; });
            hijo.stderr.setEncoding('utf8').on('data', texto => { stderr += texto; });
            const fin = once(hijo, 'close').then(([status, signal]) => ({ status, signal, stdout, stderr }));
            return { fin, stdout: () => stdout };
        };
        return { raiz, git, sha, directorio, prepararCli, iniciar, fdEntrada, fdSalida,
            intentos: () => fs.existsSync(contador) ? fs.readFileSync(contador, 'utf8').split('\n').length - 1 : 0,
            archivos: () => fs.readdirSync(directorio).filter(nombre => nombre.endsWith('.json')) };
    }
    return { checkout, marca };
}

async function hasta(leer) {
    for (let i = 0; i < 100; i++) {
        const valor = leer();
        if (valor) return valor;
        await esperar(10);
    }
    assert.fail('No llegó la notificación o la salida privada');
}

const prepararEn = checkout => {
    const resultado = checkout.prepararCli();
    assert.equal(resultado.status, 0, resultado.stderr);
    assert.equal(resultado.stderr, '');
    const plan = JSON.parse(resultado.stdout);
    assert.equal(plan.sha, checkout.sha);
    assert.equal(plan.pares.flatMap(par => par.huellas_payload).filter(huella => /^[a-f0-9]{64}$/.test(huella)).length, 6);
    return plan.huella;
};
const rechazo = (stderr, stdout = '') => ({ status: 1, signal: null, stdout, stderr: `${stderr}\n` });
const rechazarRevision = checkout => fs.writeSync(checkout.fdEntrada, '{"continuar":false,"evidencia":"Salida rechazada."}\n');

test('dos repositorios Git ordinarios independientes comparten el permiso para el mismo usuario', async (t) => {
    const sim = pruebaCli(t);
    const a = sim.checkout('a'), b = sim.checkout('b');
    assert.notEqual(a.git(['rev-parse', '--absolute-git-dir']), b.git(['rev-parse', '--absolute-git-dir']));
    assert.notEqual(a.sha, b.sha);
    const huellaA = prepararEn(a), huellaB = prepararEn(b);
    const primero = a.iniciar(huellaA);
    await hasta(() => primero.stdout() === 'REVISAR intento=1\n');
    const segundo = b.iniciar(huellaB);
    const finSegundo = await Promise.race([segundo.fin, hasta(() => segundo.stdout())]);
    rechazarRevision(a);
    if (typeof finSegundo === 'string') rechazarRevision(b);
    assert.deepEqual(await primero.fin, rechazo('REVISION_RECHAZADA', 'REVISAR intento=1\n'));
    assert.deepEqual(await segundo.fin, rechazo('PERMISO_YA_CONSUMIDO'));
    assert.equal(a.intentos(), 1);
    assert.equal(b.intentos(), 0);
    assert.deepEqual(b.archivos(), []);
    assert.equal(fs.statSync(sim.marca).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(fs.readFileSync(sim.marca, 'utf8')), { sha: a.sha, huella: huellaA });
});

for (const fuente of [FUENTES[1], FUENTES[4]]) {
    test(`ambos modos rechazan bytes locales de ${fuente} pese a assume-unchanged`, async (t) => {
        const sim = pruebaCli(t);
        const checkout = sim.checkout('fuentes');
        const huella = prepararEn(checkout);
        checkout.git(['update-index', '--assume-unchanged', '--', fuente]);
        fs.appendFileSync(join(checkout.raiz, fuente), '\nthrow new Error("No cargar fuente alterada");\n');
        assert.equal(checkout.git(['status', '--porcelain']), '');
        const { status, signal, stdout, stderr } = checkout.prepararCli();
        const ejecucion = await checkout.iniciar(huella).fin;
        assert.deepEqual({ status, signal, stdout, stderr }, rechazo('FUENTES_NO_COINCIDEN'));
        assert.deepEqual(ejecucion, rechazo('FUENTES_NO_COINCIDEN'));
        assert.equal(checkout.intentos(), 0);
        assert.deepEqual(checkout.archivos(), []);
        assert.equal(fs.existsSync(sim.marca), false);
    });
}

test('la CLI entrega un stop válido por FIFO y no persiste texto privado antes ni después del rechazo', async (t) => {
    const checkout = pruebaCli(t).checkout('revision');
    const hijo = checkout.iniciar(prepararEn(checkout));
    await hasta(() => hijo.stdout() === 'REVISAR intento=1\n');
    const buffer = Buffer.alloc(4096);
    const bytes = await hasta(() => {
        try { return fs.readSync(checkout.fdSalida, buffer); }
        catch (error) { if (error.code !== 'EAGAIN') throw error; }
    });
    const privado = JSON.parse(buffer.toString('utf8', 0, bytes));
    assert.equal(privado.intento, 1);
    assert.equal(JSON.parse(privado.contenido).razon, 'MARCADOR_PRIVADO_DE_PRUEBA');
    assert.doesNotMatch(privado.contenido, /RAZONAMIENTO_NO_PERSISTIR/);
    const sinContenido = () => checkout.archivos().forEach(nombre =>
        assert.doesNotMatch(fs.readFileSync(join(checkout.directorio, nombre), 'utf8'), MARCADOR));
    sinContenido();
    const resultado = JSON.parse(fs.readFileSync(join(checkout.directorio, 'intento-1-resultado.json'), 'utf8'));
    assert.equal(resultado.estado, 'PENDIENTE_REVISION');
    assert.equal(resultado.salida_tokens, 1000);
    assert.equal(resultado.finish_reason, 'stop');
    rechazarRevision(checkout);
    assert.deepEqual(await hijo.fin, rechazo('REVISION_RECHAZADA', 'REVISAR intento=1\n'));
    assert.equal(checkout.intentos(), 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(join(checkout.directorio, 'intento-1-revision.json'), 'utf8')),
        { continuar: false, evidencia: 'Salida rechazada.' });
    sinContenido();
});

test('la CLI rechaza un fd de salida ausente o que no coincide con el FIFO privado antes del permiso', async (t) => {
    const sim = pruebaCli(t);
    const checkout = sim.checkout('canal');
    const huella = prepararEn(checkout);
    const soloLectura = fs.openSync(join(checkout.directorio, 'salida-revision.fifo'), 'r');
    t.after(() => fs.closeSync(soloLectura));
    for (const fd of [null, checkout.fdEntrada, soloLectura]) {
        const hijo = checkout.iniciar(huella, fd);
        const fin = await Promise.race([hijo.fin, hasta(() => hijo.stdout())]);
        if (typeof fin === 'string') rechazarRevision(checkout);
        assert.deepEqual(await hijo.fin, rechazo('CANAL_REVISION_NO_PRIVADO'));
        assert.equal(checkout.intentos(), 0);
        assert.deepEqual(checkout.archivos(), []);
        assert.equal(fs.existsSync(sim.marca), false);
    }
});

test('un FIFO de revisión lleno consume el plazo sin aceptar una aprobación no entregada', async (t) => {
    const checkout = pruebaCli(t).checkout('fifo-lleno');
    const bloque = Buffer.alloc(4096);
    assert.throws(() => { for (;;) fs.writeSync(checkout.fdSalida, bloque); }, { code: 'EAGAIN' });
    const hijo = checkout.iniciar(prepararEn(checkout), checkout.fdSalida, true);
    await hasta(() => hijo.stdout() === 'REVISAR intento=1\n');
    fs.writeSync(checkout.fdEntrada, '{"continuar":true,"evidencia":"Sin lectura."}\n');
    assert.deepEqual(await hijo.fin, rechazo('REVISION_NO_DISPONIBLE', 'REVISAR intento=1\n'));
    assert.equal(checkout.intentos(), 1);
    assert.deepEqual(checkout.archivos(), ['intento-1-resultado.json', 'intento-1.json']);
    assert.doesNotMatch(fs.readFileSync(join(checkout.directorio, 'intento-1-resultado.json'), 'utf8'), MARCADOR);
});
