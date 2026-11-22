'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { CASOS_MUESTRA_MATCHING } = require('./casos-muestra-matching');
const huellaFuentes = (...rutas) => huella(rutas.map(ruta => readFileSync(ruta, 'utf8')));
const { construirInstruccionesDesdePreferencias, construirPromptEvaluacion } = require('../../src/servicios/evaluacion/entradas-evaluacion');

const huella = datos => createHash('sha256').update(JSON.stringify(datos)).digest('hex');
const corpus = '105-v1';
// Referencias semánticas propuestas, separadas de los resultados de los mocks.
const propuestas = {
    4: 'veto', 6: 'veto', 12: 'veto', 13: 'por_confirmar', 14: 'sin_evaluar',
    17: 'contrato_invalido', 18: 'veto', 19: 'contrato_invalido', 20: 'contrato_invalido', 21: 'contrato_invalido',
    22: 'por_confirmar', 23: 'veto', 24: 'veto', 25: 'legado', 26: 'por_confirmar', 28: 'por_confirmar', 29: 'bajo_umbral',
};
const casos = CASOS_MUESTRA_MATCHING.map((caso, i) => ({
    ...caso, propuesta: propuestas[i + 1] || 'aprobable',
    obligacionSinResolver: [13, 28].includes(i + 1),
}));
const factores = ['esfuerzo', 'prompt'];

function crearExperimento(factor) {
    if (!factores.includes(factor)) throw new Error('Factor de comparación no admitido.');
    const versiones = {
        oferta: huella(casos.map(({ id, titulo, empresa, ubicacion, modalidad, descripcion, origen_descripcion, descripcion_completitud }) =>
            [id, titulo, empresa, ubicacion, modalidad, descripcion, origen_descripcion, descripcion_completitud])),
        perfil: huella(casos.map(caso => caso.perfil)),
        reglas: `vigentes:${huellaFuentes(
            require.resolve('../../src/servicios/evaluacion/reglas-exclusion'),
            require.resolve('../../src/servicios/evaluacion/criterio-ubicacion'),
            require.resolve('../../src/servicios/servicio-normalizacion'),
        )}`,
        prompt: huella(casos.map(caso => [construirInstruccionesDesdePreferencias(caso.perfil), construirPromptEvaluacion(caso)])),
        esquema: 'matching-explicable-v1',
        contrato: `parser-vigente:${huellaFuentes(require.resolve('../../src/servicios/evaluacion/parser-respuesta-ia'))}`,
        modelo: 'luna-simulado', esfuerzo: 'medium-simulado',
    };
    const salidas = Object.fromEntries(casos.map(caso => [caso.id, { texto: caso.respuesta_ia_simulada }]));
    const b = { versiones: { ...versiones }, salidas: structuredClone(salidas) };
    if (factor === 'esfuerzo') b.versiones.esfuerzo = 'high-simulado';
    else {
        const linea = 'Si el alcance del requisito es ambiguo, indicá qué información falta en lugar de completar el perfil.';
        b.versiones.prompt = huella(casos.map(caso => [
            `${construirInstruccionesDesdePreferencias(caso.perfil)}\n\n${linea}`, construirPromptEvaluacion(caso),
        ]));
    }
    const casoAlterado = casos[factor === 'esfuerzo' ? 25 : 27];
    const alterada = JSON.parse(casoAlterado.respuesta_ia_simulada);
    alterada.explicacion.por_confirmar = [];
    alterada.explicacion.cumplidos = [{ requisito: 'Soporte de aplicaciones', tipo: 'obligatorio',
        evidencia_oferta: 'Soporte de aplicaciones', evidencia_perfil: 'Soporte de aplicaciones',
        explicacion: 'La variante simulada omite la duda sobre Active Directory.' }];
    b.salidas[casoAlterado.id] = { texto: JSON.stringify(alterada) };
    b.salidas[casos[29].id] = { fallo: 'TIMEOUT' };
    return { a: { versiones, salidas }, b };
}

module.exports = { corpus, casos, factores, crearExperimento, huella };
