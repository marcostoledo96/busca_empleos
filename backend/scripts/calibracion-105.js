'use strict';

const { isDeepStrictEqual } = require('node:util');
const { evaluarReglasExclusion } = require('../src/servicios/evaluacion/reglas-exclusion');
const { parsearRespuestaEvaluacionIa, UMBRAL_MATCH_MINIMO } = require('../src/servicios/evaluacion/parser-respuesta-ia');
const { corpus, casos, factores, crearExperimento, huella } = require('../tests/fixtures/calibracion-105-experimento');

function observar(caso, salida) {
    if (!caso.descripcion.trim()) return { clase: 'sin_evaluar', porcentaje: null };
    const regla = evaluarReglasExclusion(caso, caso.perfil);
    if (regla.excluida) return { clase: 'veto', porcentaje: regla.porcentaje, razon: regla.razon };
    if (salida.fallo) return { clase: 'fallo_tecnico', porcentaje: null, codigo: salida.fallo };
    const r = parsearRespuestaEvaluacionIa(salida.texto, `${caso.titulo}\n${caso.descripcion}`);
    if (r.invalido || r.error) return { clase: 'contrato_invalido', porcentaje: null, razon: r.razon };
    const { por_confirmar: dudas, exclusiones } = r.explicacion;
    // Proyección del fixture, no una nueva política de elegibilidad productiva.
    const clase = !r.desglose_disponible ? 'legado'
        : exclusiones.some(item => item.tipo === 'obligatorio') && !r.match ? 'veto'
            : dudas.some(item => item.tipo !== 'deseable') ? 'por_confirmar'
                : r.porcentaje < UMBRAL_MATCH_MINIMO ? 'bajo_umbral' : 'aprobable';
    return { clase, porcentaje: r.porcentaje, razon: r.razon, explicacion: r.explicacion };
}

function medir(filas) {
    const ejecutadas = filas.filter(fila => !['sin_evaluar', 'legado'].includes(fila.propuesta));
    const valida = fila => !['contrato_invalido', 'fallo_tecnico', 'sin_evaluar', 'legado'].includes(fila.observado.clase);
    const laborales = ejecutadas.filter(fila => fila.propuesta !== 'contrato_invalido' && valida(fila));
    const razon = (poblacion, cumple) => ({ numerador: poblacion.filter(cumple).length, denominador: poblacion.length });
    const porClase = (propuesta, observado, filtro = () => true) => razon(
        laborales.filter(fila => fila.propuesta === propuesta && filtro(fila)), fila => fila.observado.clase === observado,
    );
    return {
        validez: razon(ejecutadas, valida),
        completitud: razon(ejecutadas, fila => valida(fila) && !!(fila.observado.explicacion || fila.observado.clase === 'veto')),
        fallo_tecnico: razon(ejecutadas, fila => fila.observado.clase === 'fallo_tecnico'),
        contrato_invalido: razon(ejecutadas, fila => fila.observado.clase === 'contrato_invalido'),
        falso_descarte_aprobable: porClase('aprobable', 'veto'),
        falso_descarte_por_confirmar: porClase('por_confirmar', 'veto'),
        falsa_aprobacion_veto: porClase('veto', 'aprobable'),
        falsa_aprobacion_obligacion: porClase('por_confirmar', 'aprobable', fila => fila.obligacionSinResolver),
        falsa_aprobacion_otras_dudas: porClase('por_confirmar', 'aprobable', fila => !fila.obligacionSinResolver),
        confirmacion_innecesaria: porClase('aprobable', 'por_confirmar'),
        incertidumbre_correcta: porClase('por_confirmar', 'por_confirmar'),
    };
}

function comparar(factor, a, b) {
    const claves = new Set([...Object.keys(a.versiones), ...Object.keys(b.versiones)]);
    const diferencias = [...claves].filter(clave => a.versiones[clave] !== b.versiones[clave]);
    const requeridas = ['oferta', 'perfil', 'reglas', 'prompt', 'esquema', 'contrato', 'modelo', 'esfuerzo'];
    if (!factores.includes(factor) || !isDeepStrictEqual(diferencias, [factor]) || claves.size !== requeridas.length
        || requeridas.some(clave => !a.versiones[clave] || !b.versiones[clave])) {
        throw new Error(`La comparación debe variar solo ${factor}.`);
    }
    const ids = casos.map(caso => caso.id).sort();
    const resumir = variante => {
        if (!isDeepStrictEqual(Object.keys(variante.salidas).sort(), ids)) {
            throw new Error('Las variantes deben cubrir exactamente el mismo corpus.');
        }
        const filas = casos.map(caso => ({ id: caso.id, propuesta: caso.propuesta, revision: caso.estado_revision,
            obligacionSinResolver: caso.obligacionSinResolver, evidencia_propuesta: caso.evidencias,
            observado: observar(caso, variante.salidas[caso.id]) }));
        return { versiones: variante.versiones, huella_salidas_simuladas: huella(variante.salidas), metricas: medir(filas), filas };
    };
    const resumenA = resumir(a);
    const resumenB = resumir(b);
    const discrepancias = resumenA.filas.flatMap((fila, i) => {
        const observadoB = resumenB.filas[i].observado;
        return isDeepStrictEqual(fila.observado, observadoB) ? []
            : [{ id: fila.id, propuesta: fila.propuesta, a: fila.observado, b: observadoB }];
    });
    return { modo: 'simulado', corpus, factor, a: resumenA, b: resumenB, discrepancias };
}

if (require.main === module) {
    const [factor, ...resto] = process.argv.slice(2);
    if (!factores.includes(factor) || resto.length) {
        console.error('Uso: node scripts/calibracion-105.js <esfuerzo|prompt>');
        process.exitCode = 2;
    } else {
        const { a, b } = crearExperimento(factor);
        process.stdout.write(`${JSON.stringify(comparar(factor, a, b), null, 4)}\n`);
    }
}

module.exports = { comparar, crearExperimento };
