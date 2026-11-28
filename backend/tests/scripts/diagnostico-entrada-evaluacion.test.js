const { spawnSync } = require('node:child_process');
const { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const {
    construirInstruccionesDesdePreferencias,
    construirPerfilEfectivoCanonico,
} = require('../../src/servicios/evaluacion/entradas-evaluacion');

const script = resolve(__dirname, '../../scripts/diagnostico-entrada-evaluacion.js');
const bytes = texto => Buffer.byteLength(texto, 'utf8');
const sintetico = {
    nombre: 'CENTINELA_NOMBRE Á🏔️',
    perfil_profesional: 'CENTINELA_PERFIL: síntesis\r\nsegunda línea',
    zonas_preferidas: ['Región Á', ''],
    tecnologias_detalle: [{ nombre: 'Tecnología Ñ', nivel: 'básico' }],
    usar_prompt_personalizado: true,
    prompt_personalizado: ' \nCENTINELA_PROMPT 🧪\n\t ',
};

function ejecutar(input, args = ['--stdin'], fd) {
    const resultado = spawnSync(process.execPath, [script, ...args], {
        input, stdio: [fd ?? 'pipe', 'pipe', 'pipe'], encoding: 'utf8', env: {},
    });
    expect(resultado.error).toBeUndefined();
    expect(resultado.signal).toBeNull();
    expect(`${resultado.stdout}${resultado.stderr}`).not.toMatch(/CENTINELA_/);
    return resultado;
}

function validarMedicion(prefs, resultado, promptBytes) {
    const perfil = construirPerfilEfectivoCanonico(prefs);
    const [candidato, preferencias, politicas] = perfil.secciones.map(({ texto }) => bytes(texto));
    const total = bytes(construirInstruccionesDesdePreferencias(prefs));
    const json = texto => texto.slice(texto.indexOf('\n') + 1);
    const { stdout, stderr, status } = resultado;
    expect(status).toBe(0);
    expect(stderr).toBe('');
    const medicion = JSON.parse(stdout);
    expect(medicion).toEqual({
        bytes_mensaje_sistema: {
            candidato, preferencias, politicas,
            separadores_perfil: bytes('\n\n\n\n'),
            prompt_personalizado: promptBytes,
            instrucciones_y_separadores: total - bytes(perfil.texto) - promptBytes,
            total,
        },
        ahorro_bytes_formato_json: {
            candidato: bytes(json(perfil.secciones[0].texto)) - bytes(JSON.stringify(perfil.candidato)),
            preferencias: bytes(json(perfil.secciones[1].texto)) - bytes(JSON.stringify(perfil.restricciones.preferencias)),
        },
    });
    const { total: totalEmitido, ...bloques } = medicion.bytes_mensaje_sistema;
    expect(Object.values(bloques).reduce((suma, valor) => suma + valor, 0)).toBe(totalEmitido);
    return medicion.bytes_mensaje_sistema;
}

it('recompone el mensaje con Unicode, saltos, separadores y el prompt sin recortar; no altera el archivo', () => {
    const carpeta = mkdtempSync(resolve(tmpdir(), 'diagnostico-128-'));
    const archivo = resolve(carpeta, 'entrada.json');
    const contenido = `${JSON.stringify(sintetico, null, 2)}\n`;
    try {
        writeFileSync(archivo, contenido, { mode: 0o600 });
        const fd = openSync(archivo, 'r');
        try {
            validarMedicion(sintetico, ejecutar(undefined, ['--stdin'], fd), bytes(sintetico.prompt_personalizado));
        } finally {
            closeSync(fd);
        }
        expect(readFileSync(archivo, 'utf8')).toBe(contenido);
    } finally {
        rmSync(carpeta, { recursive: true });
    }
});

it.each([
    ['apagado', { ...sintetico, usar_prompt_personalizado: false }],
    ['vacío', { ...sintetico, prompt_personalizado: '' }],
    ['sólo espacios y saltos', { ...sintetico, prompt_personalizado: ' \n\t ' }],
    ['sin preferencias declaradas', {}],
])('no cuenta contenido de prompt personalizado: %s', (_caso, prefs) => {
    validarMedicion(prefs, ejecutar(JSON.stringify(prefs)), 0);
});

it('atribuye la excepción estudiantil al resto sólo cuando la reconoce el constructor', () => {
    const resultados = ['Soy estudiante de Informática.', 'Quiero estudiar Informática.'].map(perfil_profesional => {
        const prefs = { perfil_profesional };
        const bloques = validarMedicion(prefs, ejecutar(JSON.stringify(prefs)), 0);
        const diferencia = bloques.total - bytes(construirInstruccionesDesdePreferencias(prefs, {
            omitirExcepcionEstudiantil: true,
        }));
        return { resto: bloques.instrucciones_y_separadores, diferencia };
    });
    expect(resultados[0].diferencia).toBeGreaterThan(0);
    expect(resultados[1].diferencia).toBe(0);
    expect(resultados[0].resto - resultados[1].resto).toBe(resultados[0].diferencia);
});

it('rechaza bytes UTF-8 inválidos sin medir un perfil alterado', () => {
    const prefs = { nombre: 'CENTINELA_NOMBRE', perfil_profesional: 'Soy estudiante de Informática.' };
    const entrada = JSON.stringify(prefs);
    validarMedicion(prefs, ejecutar(Buffer.from(entrada, 'utf8')), 0);

    const entradaInvalida = Buffer.from(entrada, 'latin1');
    const { stdout, stderr, status } = ejecutar(entradaInvalida);
    expect({ stdout, stderr, status }).toEqual({ stdout: '', stderr: 'ENTRADA_INVALIDA\n', status: 1 });
});

it.each([
    ['JSON mal formado', '{"nombre":"CENTINELA_JSON" invalido}'],
    ['sin JSON', ''],
    ['null', 'null'],
    ['array', '["CENTINELA_ARRAY"]'],
    ['cadena', '"CENTINELA_RAIZ"'],
    ['detalle incompatible con el constructor', '{"nombre":"CENTINELA_NOMBRE","tecnologias_detalle":[null]}'],
])('rechaza sin filtrar entrada: %s', (_caso, entrada) => {
    const { stdout, stderr, status } = ejecutar(entrada);
    expect({ stdout, stderr, status }).toEqual({ stdout: '', stderr: 'ENTRADA_INVALIDA\n', status: 1 });
});

it('sólo admite el argumento --stdin y no repite argumentos ni contenido', () => {
    const { stdout, stderr, status } = ejecutar('{"nombre":"CENTINELA_NOMBRE"}', ['--stdin', 'CENTINELA_ARG']);
    expect({ stdout, stderr, status }).toEqual({ stdout: '', stderr: 'Uso: node backend/scripts/diagnostico-entrada-evaluacion.js --stdin\n', status: 1 });
});
