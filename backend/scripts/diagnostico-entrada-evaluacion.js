const { isUtf8 } = require('node:buffer');
const { readFileSync } = require('node:fs');
const {
    construirInstruccionesDesdePreferencias,
    construirPerfilEfectivoCanonico,
} = require('../src/servicios/evaluacion/entradas-evaluacion');

const bytes = texto => Buffer.byteLength(texto, 'utf8');

function ahorroFormato(seccion, objeto) {
    const jsonIndentado = seccion.texto.slice(seccion.texto.indexOf('\n') + 1);
    return bytes(jsonIndentado) - bytes(JSON.stringify(objeto));
}

function medir(prefs) {
    const mensaje = construirInstruccionesDesdePreferencias(prefs);
    const perfil = construirPerfilEfectivoCanonico(prefs);
    const [seccionCandidato, seccionPreferencias] = perfil.secciones;
    const [candidato, preferencias, politicas] = perfil.secciones.map(({ texto }) => bytes(texto));
    const bytesPerfil = bytes(perfil.texto);
    const total = bytes(mensaje);
    const prompt = prefs.prompt_personalizado;
    // trim decide la inclusión en el constructor, pero el mensaje conserva el texto original.
    const bytesPrompt = prefs.usar_prompt_personalizado && typeof prompt === 'string' && prompt.trim()
        ? bytes(prompt) : 0;

    return {
        bytes_mensaje_sistema: {
            candidato,
            preferencias,
            politicas,
            separadores_perfil: bytesPerfil - candidato - preferencias - politicas,
            prompt_personalizado: bytesPrompt,
            instrucciones_y_separadores: total - bytesPerfil - bytesPrompt,
            total,
        },
        ahorro_bytes_formato_json: {
            candidato: ahorroFormato(seccionCandidato, perfil.candidato),
            preferencias: ahorroFormato(seccionPreferencias, perfil.restricciones.preferencias),
        },
    };
}

if (process.argv.length !== 3 || process.argv[2] !== '--stdin') {
    process.stderr.write('Uso: node backend/scripts/diagnostico-entrada-evaluacion.js --stdin\n');
    process.exitCode = 1;
} else {
    try {
        const entrada = readFileSync(0);
        if (!isUtf8(entrada)) throw new TypeError();
        const prefs = JSON.parse(entrada.toString('utf8'));
        if (prefs === null || typeof prefs !== 'object' || Array.isArray(prefs)) throw new TypeError();
        process.stdout.write(`${JSON.stringify(medir(prefs), null, 4)}\n`);
    } catch {
        process.stderr.write('ENTRADA_INVALIDA\n');
        process.exitCode = 1;
    }
}
