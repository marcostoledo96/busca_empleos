const fs = require('node:fs');
const https = require('node:https');
const { dirname, join, resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');
const { CASOS_MUESTRA_MATCHING } = require('../tests/fixtures/casos-muestra-matching');
const { ordenarObjeto, construirInstruccionesDesdePreferencias, construirPromptEvaluacion } = require('../src/servicios/evaluacion/entradas-evaluacion');
const { parsearRespuestaEvaluacionIa } = require('../src/servicios/evaluacion/parser-respuesta-ia');

const TOPE = 100_000_000; // NanoUSD
const ENTRADA = 300, CACHE = 6, SALIDA = 1200;
const MAX_ENTRADA = 12000;
const URL = 'https://api.deepseek.com/chat/completions';
class Corte extends Error {}
const huellaBytes = texto => createHash('sha256').update(texto).digest('hex');
const huellaDe = valor => huellaBytes(JSON.stringify(ordenarObjeto(valor)));
const natural = valor => Number.isSafeInteger(valor) && valor >= 0;
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const clavesExactas = (valor, claves) => objeto(valor) && Object.keys(valor).length === claves.length
    && claves.every(clave => Object.hasOwn(valor, clave));
const CAMPOS_DESGLOSE = ['cumplidos', 'no_cumplidos', 'por_confirmar', 'exclusiones'];
const CAMPOS_REQUISITO = ['requisito', 'evidencia_oferta', 'evidencia_perfil', 'explicacion'];
function json(texto) {
    if (typeof texto === 'string') {
        try { return JSON.parse(texto); } catch { return undefined; }
    }
}

function preparar(sha) {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Corte('SHA_INVALIDO');
    const pares = [];
    const solicitudes = [16, 17, 15].flatMap(numero => {
        const caso = CASOS_MUESTRA_MATCHING.find(c => c.id.startsWith(`caso-${numero}-`));
        const system = construirInstruccionesDesdePreferencias(caso.perfil);
        const user = construirPromptEvaluacion(caso);
        const base = { model: 'deepseek-flash', thinking: { type: 'enabled' }, reasoning_effort: 'low',
            response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
        const maxTokens = [4096, 8192];
        const variantes = maxTokens.map(max_tokens => {
            const payload = { ...base, max_tokens };
            return { payload, texto: JSON.stringify(payload) };
        });
        // V4.1 Flash: ByteLevel/BPE; 100 cubre el prefijo más largo, no representa «low».
        const marco = `<｜begin▁of▁sentence｜><｜System｜>Reasoning Effort: 100 (range 1-100, the higher the value, the more thorough the reasoning)\n\n${system}<｜User｜>${user}<｜Assistant｜><think>`;
        const cotaEntrada = 1024 + Math.max(Buffer.byteLength(marco), ...variantes.map(v => Buffer.byteLength(v.texto)));
        if (cotaEntrada > MAX_ENTRADA) throw new Corte('ENTRADA_FUERA_DE_COTA');
        pares.push({ caso: caso.id, huella_sin_max_tokens: huellaDe(base), max_tokens: maxTokens,
            huellas_payload: variantes.map(v => huellaBytes(v.texto)),
            diferencia_max_tokens: maxTokens[1] - maxTokens[0], cota_entrada: cotaEntrada });
        return variantes.map(v => ({ ...v, caso, cotaEntrada, reserva: cotaEntrada * ENTRADA + v.payload.max_tokens * SALIDA }));
    });
    const costoMaximo = solicitudes.reduce((suma, entrada) => suma + entrada.reserva, 0);
    if (solicitudes.length !== 6 || costoMaximo > TOPE) throw new Corte('PRESUPUESTO_FUERA_DE_COTA');
    return { sha, pares, solicitudes, costoMaximo, huella: huellaDe({ sha, pares, costoMaximo }) };
}

function enviar(texto, clave) {
    const signal = AbortSignal.timeout(60_000);
    const falloTransporte = () => signal.aborted ? 'TIMEOUT_INCIERTO' : 'TRANSPORTE_INCIERTO';
    return new Promise((ok, error) => {
        const solicitud = https.request(URL, {
            method: 'POST', agent: false, signal, rejectUnauthorized: true,
            headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(texto) },
        }, respuesta => {
            const cortar = codigo => { error(new Corte(codigo)); solicitud.destroy(); };
            respuesta.on('error', () => cortar(falloTransporte()));
            respuesta.on('aborted', () => cortar(falloTransporte()));
            if (respuesta.statusCode !== 200) return cortar(`HTTP_${respuesta.statusCode}`);
            const partes = [];
            let bytes = 0;
            respuesta.on('data', parte => {
                bytes += parte.length;
                if (bytes > 512 * 1024) return cortar('RESPUESTA_EXCESIVA');
                partes.push(parte);
            });
            respuesta.on('end', () => {
                if (bytes <= 512 * 1024) ok(json(Buffer.concat(partes, bytes).toString('utf8')));
            });
        });
        solicitud.on('error', () => error(new Corte(falloTransporte())));
        solicitud.end(texto);
    });
}

function medir(cuerpo, cotaEntrada, maxTokens) {
    const { prompt_tokens, completion_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens,
        completion_tokens_details } = cuerpo?.usage ?? {};
    const razonamiento = completion_tokens_details?.reasoning_tokens;
    if (!natural(prompt_tokens) || !natural(completion_tokens) || prompt_tokens === 0
        || prompt_tokens > cotaEntrada || completion_tokens > maxTokens
        || (razonamiento !== undefined && (!natural(razonamiento) || razonamiento > completion_tokens))) {
        throw new Corte('USO_FUERA_DE_COTA');
    }
    const salida = completion_tokens * SALIDA;
    const maximo = prompt_tokens * ENTRADA + salida;
    const pico = natural(prompt_cache_hit_tokens) && natural(prompt_cache_miss_tokens)
        && prompt_cache_hit_tokens + prompt_cache_miss_tokens === prompt_tokens
        ? prompt_cache_hit_tokens * CACHE + prompt_cache_miss_tokens * ENTRADA + salida : null;
    return { entrada_tokens: prompt_tokens, salida_tokens: completion_tokens, razonamiento_tokens: razonamiento ?? null,
        cache_hit_tokens: pico === null ? null : prompt_cache_hit_tokens, cache_miss_tokens: pico === null ? null : prompt_cache_miss_tokens,
        costo_maximo_estimado_nanousd: maximo, costo_pico_nanousd: pico, costo_valle_nanousd: pico === null ? null : pico / 2 };
}

function motivoFinal(cuerpo) {
    const motivo = cuerpo?.choices?.[0]?.finish_reason;
    return ['stop', 'length', 'content_filter', 'tool_calls', 'function_call', 'aborted', 'insufficient_system_resource'].includes(motivo)
        ? motivo : null;
}

function validar(cuerpo, caso) {
    const opcion = cuerpo?.choices?.[0];
    const motivo = motivoFinal(cuerpo);
    const resultado = { finish_reason: motivo,
        json_valido: null, contrato_valido: false, estado: 'FINAL_NO_COMPARABLE' };
    if (motivo === 'length') return { ...resultado, estado: 'SALIDA_TRUNCADA' };
    if (motivo !== 'stop') return resultado;
    const texto = opcion.message?.content;
    const respuesta = json(texto);
    const contrato = clavesExactas(respuesta, ['match', 'porcentaje', 'razon', 'explicacion'])
        && typeof respuesta.match === 'boolean' && natural(respuesta.porcentaje) && respuesta.porcentaje <= 100
        && typeof respuesta.razon === 'string' && respuesta.razon.trim() && clavesExactas(respuesta.explicacion, CAMPOS_DESGLOSE)
        && CAMPOS_DESGLOSE.every(campo => Array.isArray(respuesta.explicacion[campo])
            && respuesta.explicacion[campo].every(item => clavesExactas(item, ['tipo', ...CAMPOS_REQUISITO])
                && ['obligatorio', 'deseable', 'desconocido'].includes(item.tipo)
                && CAMPOS_REQUISITO.every(clave => typeof item[clave] === 'string')));
    const parseada = contrato ? parsearRespuestaEvaluacionIa(texto, [caso.titulo, caso.descripcion].filter(Boolean).join('\n'), caso.descripcion) : null;
    const valida = !!parseada && !parseada.error && !parseada.invalido && !parseada.inconsistente;
    return { finish_reason: motivo, json_valido: respuesta !== undefined, contrato_valido: valida,
        estado: valida ? 'PENDIENTE_REVISION' : 'CONTRATO_INVALIDO', ...(valida ? { respuesta_final: respuesta } : {}) };
}

function guardar(ruta, datos) {
    fs.writeFileSync(ruta, JSON.stringify(datos) + '\n', { flag: 'wx', mode: 0o600, flush: true });
    const padre = fs.openSync(dirname(ruta), 'r');
    try { fs.fsyncSync(padre); } finally { fs.closeSync(padre); }
}

function validarDirectorio(directorio) {
    const ruta = resolve(directorio);
    const stat = fs.lstatSync(ruta);
    if (!stat.isDirectory() || fs.realpathSync(ruta) !== ruta || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700) {
        throw new Corte('DIRECTORIO_NO_PRIVADO');
    }
    return ruta;
}

async function ejecutar({ sha }, huella, { directorio, marca, clave, revisar }) {
    const plan = preparar(sha);
    if (plan.huella !== huella) throw new Corte('PLAN_NO_COINCIDE');
    if (typeof clave !== 'string' || !/^[\x21-\x7e]+$/.test(clave)) throw new Corte('CREDENCIAL_NO_DISPONIBLE');
    const dir = validarDirectorio(directorio);
    try { guardar(marca, { sha, huella }); }
    catch (error) { if (error.code === 'EEXIST') throw new Corte('PERMISO_YA_CONSUMIDO'); throw error; }

    let acumulado = 0, restante = plan.costoMaximo;
    for (const [i, { caso, payload, texto, cotaEntrada, reserva }] of plan.solicitudes.entries()) {
        if (acumulado + restante > TOPE) throw new Corte('PRESUPUESTO_AGOTADO');
        const intento = i + 1;
        const ruta = join(dir, `intento-${intento}`);
        const { messages, ...config } = payload;
        const registro = { sha, huella, intento, caso: caso.id, config, cota_entrada: cotaEntrada,
            reserva_nanousd: reserva, reserva_restante_nanousd: restante, acumulado_previo_nanousd: acumulado };
        guardar(`${ruta}.json`, { ...registro, estado: 'iniciado' });
        const inicio = performance.now();
        let cuerpo, duracion, uso, resultado;
        try {
            cuerpo = await enviar(texto, clave);
            duracion = performance.now() - inicio;
            uso = medir(cuerpo, cotaEntrada, payload.max_tokens);
            resultado = validar(cuerpo, caso);
        } catch (error) {
            const estado = error instanceof Corte ? error.message : 'TRANSPORTE_INCIERTO';
            const observado = estado === 'USO_FUERA_DE_COTA' ? {
                finish_reason: motivoFinal(cuerpo),
                uso_reportado: Object.fromEntries(Object.entries({ entrada_tokens: cuerpo?.usage?.prompt_tokens,
                    salida_tokens: cuerpo?.usage?.completion_tokens,
                    razonamiento_tokens: cuerpo?.usage?.completion_tokens_details?.reasoning_tokens })
                    .filter(([, valor]) => natural(valor))),
            } : {};
            guardar(`${ruta}-resultado.json`, { ...registro, ...observado, estado, latencia_ms: duracion ?? performance.now() - inicio });
            throw new Corte(estado);
        }
        guardar(`${ruta}-resultado.json`, { ...registro, ...uso, ...resultado, latencia_ms: duracion });
        acumulado += uso.costo_maximo_estimado_nanousd;
        restante -= reserva;
        if (resultado.contrato_valido) {
            const revision = await revisar(intento);
            if (typeof revision?.continuar !== 'boolean' || typeof revision.evidencia !== 'string'
                || !revision.evidencia.trim() || Buffer.byteLength(revision.evidencia) > 4000) throw new Corte('REVISION_NO_DISPONIBLE');
            guardar(`${ruta}-revision.json`, { continuar: revision.continuar, evidencia: revision.evidencia });
            if (!revision.continuar) throw new Corte('REVISION_RECHAZADA');
        }
    }
    return plan.solicitudes.length;
}

function git(...args) {
    return execFileSync('git', ['rev-parse', ...args], { cwd: fs.realpathSync(join(__dirname, '../..')), encoding: 'utf8',
        env: { PATH: process.env.PATH, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
        stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

async function revisar(intento) {
    const lector = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    const cierre = new AbortController();
    lector.once('close', () => cierre.abort());
    try {
        const texto = await lector.question(`REVISAR intento=${intento}\n`, {
            signal: AbortSignal.any([cierre.signal, AbortSignal.timeout(90_000)]),
        });
        return Buffer.byteLength(texto) <= 4096 ? json(texto) : undefined;
    } catch { return undefined; }
    finally { lector.close(); process.stdin.pause(); }
}

async function main([modo, directorio, shaAprobado, huella, ...otros]) {
    if (modo === '--help' && directorio === undefined) {
        console.log('--preparar: muestra el plan sin consumo.\n--ejecutar <directorio-privado> <SHA> <huella>: solo con autorización expresa.');
        return;
    }
    const sha = git('--verify', 'HEAD');
    if (modo === '--preparar' && directorio === undefined) {
        const { pares, costoMaximo, huella } = preparar(sha);
        console.log(JSON.stringify({ sha, huella, pares, costo_maximo_nanousd: costoMaximo }));
        return;
    }
    if (modo !== '--ejecutar' || !directorio || !shaAprobado || !huella || otros.length) throw new Corte('ARGUMENTOS_INVALIDOS');
    if (shaAprobado !== sha) throw new Corte('SHA_NO_COINCIDE');
    const marca = join(git('--path-format=absolute', '--git-common-dir'), 'intento-consumido-117.json');
    const intentos = await ejecutar({ sha }, huella, { directorio, marca, clave: process.env.DEEPSEEK_API_KEY, revisar });
    console.log(`COMPARACION_FINALIZADA intentos=${intentos}`);
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Corte ? error.message : 'ERROR_LOCAL');
    process.exitCode = 1;
});
module.exports = { preparar, ejecutar };
