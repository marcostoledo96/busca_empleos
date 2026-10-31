// Pruebas exhaustivas para el parser de respuesta IA (WU 1 - Issue 18).
// Verifico el manejo controlado de null, 42, [], "texto", {}, JSON malformado y match no booleano.

'use strict';

const {
    parsearRespuestaEvaluacionIa,
} = require('../../../src/servicios/evaluacion/parser-respuesta-ia');

describe('Parser respuesta IA — Manejo robusto de payloads no válidos (WU 1)', () => {

    test('maneja JSON.parse("null") retornando error técnico controlado', () => {
        const respuesta = 'null';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.prioridad_ia).toBe(false);
        expect(resultado.evidencias_prioridad_ia).toEqual([]);
        expect(resultado.desglose_disponible).toBe(false);
        expect(resultado.explicacion).toEqual({
            cumplidos: [],
            no_cumplidos: [],
            por_confirmar: [],
            exclusiones: [],
        });
        expect(resultado.razon).toBe('La respuesta de DeepSeek no es un objeto JSON válido.');
    });

    test('maneja número JSON ("42") retornando error técnico controlado', () => {
        const respuesta = '42';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.desglose_disponible).toBe(false);
        expect(resultado.razon).toBe('La respuesta de DeepSeek no es un objeto JSON válido.');
    });

    test('maneja array JSON ("[]") retornando error técnico controlado', () => {
        const respuesta = '[]';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.desglose_disponible).toBe(false);
        expect(resultado.razon).toBe('La respuesta de DeepSeek no es un objeto JSON válido.');
    });

    test('maneja string JSON ("\"texto\"") retornando error técnico controlado', () => {
        const respuesta = '"texto plano JSON"';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.desglose_disponible).toBe(false);
        expect(resultado.razon).toBe('La respuesta de DeepSeek no es un objeto JSON válido.');
    });

    test('maneja objeto vacío ("{}") retornando match no booleano controlado', () => {
        const respuesta = '{}';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.desglose_disponible).toBe(false);
        expect(resultado.razon).toBe('El campo "match" debe ser boolean.');
    });

    test('maneja JSON malformado retornando error de parseo descriptivo', () => {
        const respuesta = '{"match": true, "porcentaje": 80,';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.desglose_disponible).toBe(false);
        expect(resultado.razon).toMatch(/No se pudo parsear la respuesta de DeepSeek/);
    });

    test('maneja match no booleano (string "true") retornando error técnico', () => {
        const respuesta = '{"match": "true", "porcentaje": 80, "razon": "Compatible"}';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.porcentaje).toBeNull();
        expect(resultado.error).toBe(true);
        expect(resultado.invalido).toBe(true);
        expect(resultado.inconsistente).toBe(true);
        expect(resultado.razon).toBe('El campo "match" debe ser boolean.');
    });

    test('maneja fences Markdown con payload inválido (```json null ```)', () => {
        const respuesta = '```json\nnull\n```';
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(false);
        expect(resultado.error).toBe(true);
        expect(resultado.razon).toBe('La respuesta de DeepSeek no es un objeto JSON válido.');
    });

    test('maneja respuesta válida estructurada respetando todas las validaciones', () => {
        const respuesta = JSON.stringify({
            match: true,
            porcentaje: 85,
            razon: 'Cumple stack principal',
            prioridad_ia: true,
            evidencias_prioridad_ia: ['TypeScript', 'Express'],
            explicacion: {
                cumplidos: [{ requisito: 'TypeScript', tipo: 'obligatorio', explicacion: 'Cumple' }],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        });
        const resultado = parsearRespuestaEvaluacionIa(respuesta);

        expect(resultado.match).toBe(true);
        expect(resultado.porcentaje).toBe(85);
        expect(resultado.razon).toBe('Cumple stack principal');
        expect(resultado.prioridad_ia).toBe(true);
        expect(resultado.evidencias_prioridad_ia).toEqual(['TypeScript', 'Express']);
        expect(resultado.desglose_disponible).toBe(true);
        expect(resultado.error).toBeUndefined();
    });
});
