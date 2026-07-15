// Tests del parser estricto de respuesta IA.
//
// ¿Qué testeamos acá?
// 1. Que el parser limpia fences Markdown correctamente.
// 2. Que el parser acepta JSON válido con campos correctos.
// 3. Que el parser rechaza `match` como string (el bug original).
// 4. Que el porcentaje se normaliza y acota al rango 0-100.
// 5. Que la razón vacía usa fallback.
// 6. Que JSON inválido devuelve rechazo seguro con error: true.

'use strict';

const {
    parsearRespuestaEvaluacionIa,
    _internas: {
        limpiarFencesMarkdown,
        clampPorcentaje,
        RAZON_FALLBACK_MATCH,
        RAZON_FALLBACK_NO_MATCH,
    },
} = require('../../src/servicios/evaluacion/parser-respuesta-ia');

describe('Parser respuesta IA', () => {

    // ──────────────────────────────────────────────────────────
    // limpiarFencesMarkdown
    // ──────────────────────────────────────────────────────────

    describe('limpiarFencesMarkdown()', () => {

        test('elimina fence ```json al inicio y ``` al final', () => {
            const entrada = '```json\n{"match": true, "porcentaje": 80, "razon": "Compatible"}\n```';
            const resultado = limpiarFencesMarkdown(entrada);
            expect(resultado).toBe('{"match": true, "porcentaje": 80, "razon": "Compatible"}');
        });

        test('elimina solo ``` sin json', () => {
            const entrada = '```\n{"match": false, "porcentaje": 10, "razon": "Java excluyente"}\n```';
            const resultado = limpiarFencesMarkdown(entrada);
            expect(resultado).toBe('{"match": false, "porcentaje": 10, "razon": "Java excluyente"}');
        });

        test('devuelve texto limpio si no hay fences', () => {
            const entrada = '{"match": true, "porcentaje": 75, "razon": "Buen match"}';
            const resultado = limpiarFencesMarkdown(entrada);
            expect(resultado).toBe('{"match": true, "porcentaje": 75, "razon": "Buen match"}');
        });

        test('maneja string vacío', () => {
            expect(limpiarFencesMarkdown('')).toBe('');
        });

        test('maneja input que no es string (retorna vacío)', () => {
            expect(limpiarFencesMarkdown(null)).toBe('');
            expect(limpiarFencesMarkdown(undefined)).toBe('');
            expect(limpiarFencesMarkdown(123)).toBe('');
        });

        test('elimina múltiples fences ```json anidados', () => {
            const entrada = '```json\n```json\n{"match": true}\n```\n```';
            const resultado = limpiarFencesMarkdown(entrada);
            expect(resultado).toBe('{"match": true}');
        });
    });

    // ──────────────────────────────────────────────────────────
    // clampPorcentaje
    // ──────────────────────────────────────────────────────────

    describe('clampPorcentaje()', () => {

        test('acota número dentro del rango 0-100', () => {
            expect(clampPorcentaje(80)).toBe(80);
            expect(clampPorcentaje(0)).toBe(0);
            expect(clampPorcentaje(100)).toBe(100);
        });

        test('acota números fuera de rango', () => {
            expect(clampPorcentaje(150)).toBe(100);
            expect(clampPorcentaje(-5)).toBe(0);
        });

        test('convierte string numérico a entero', () => {
            expect(clampPorcentaje('75')).toBe(75);
            expect(clampPorcentaje('150')).toBe(100);
        });

        test('retorna null para valores no numéricos', () => {
            expect(clampPorcentaje('abc')).toBeNull();
            expect(clampPorcentaje(null)).toBeNull();
            expect(clampPorcentaje(undefined)).toBeNull();
            expect(clampPorcentaje(NaN)).toBeNull();
        });

        test('redondea decimales correctamente', () => {
            expect(clampPorcentaje(75.6)).toBe(76);
            expect(clampPorcentaje(75.4)).toBe(75);
        });
    });

    // ──────────────────────────────────────────────────────────
    // parsearRespuestaEvaluacionIa — Spec: JSON válido sin fence
    // ──────────────────────────────────────────────────────────

    describe('JSON válido sin fence', () => {

        test('parsea respuesta JSON válida sin fences', () => {
            const respuesta = '{"match": true, "porcentaje": 80, "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(80);
            expect(resultado.razon).toBe('Compatible');
            expect(resultado.error).toBeUndefined();
        });

        test('parsea respuesta de rechazo válida', () => {
            const respuesta = '{"match": false, "porcentaje": 20, "razon": "Requiere Java"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(20);
            expect(resultado.razon).toBe('Requiere Java');
            expect(resultado.error).toBeUndefined();
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: JSON válido con fence Markdown
    // ──────────────────────────────────────────────────────────

    describe('JSON válido con fence Markdown', () => {

        test('elimina fence ```json y parsea correctamente', () => {
            const respuesta = '```json\n{"match": true, "porcentaje": 85, "razon": "Buen match"}\n```';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(85);
            expect(resultado.razon).toBe('Buen match');
        });

        test('elimina solo ``` sin json', () => {
            const respuesta = '```\n{"match": false, "porcentaje": 10, "razon": "Senior"}\n```';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(10);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: boolean como string es inválido (el bug original)
    // ──────────────────────────────────────────────────────────

    describe('boolean como string es inválido', () => {

        test('rechaza match: "false" (string en vez de boolean)', () => {
            // Este es el bug original: !!respuesta.match convertía "false" en true.
            const respuesta = '{"match": "false", "porcentaje": 20, "razon": "Java excluyente"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
            expect(resultado.razon).toMatch(/boolean/);
        });

        test('rechaza match: "true" (string en vez de boolean)', () => {
            const respuesta = '{"match": "true", "porcentaje": 80, "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });

        test('rechaza match: null', () => {
            const respuesta = '{"match": null, "porcentaje": 50, "razon": "Sin datos"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });

        test('rechaza match: número (1)', () => {
            const respuesta = '{"match": 1, "porcentaje": 80, "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: porcentaje fuera de rango se ajusta
    // ──────────────────────────────────────────────────────────

    describe('porcentaje fuera de rango se ajusta', () => {

        test('porcentaje 150 se ajusta a 100', () => {
            const respuesta = '{"match": true, "porcentaje": 150, "razon": "Perfect match"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(100);
        });

        test('porcentaje negativo se ajusta a 0', () => {
            const respuesta = '{"match": false, "porcentaje": -10, "razon": "No match"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(0);
        });

        test('porcentaje como string numérico se convierte', () => {
            const respuesta = '{"match": true, "porcentaje": "85", "razon": "Buen match"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBe(85);
        });

        test('porcentaje null se mantiene como null', () => {
            const respuesta = '{"match": true, "porcentaje": null, "razon": "Match sin porcentaje"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
        });

        test('porcentaje ausente se mantiene como null', () => {
            const respuesta = '{"match": false, "razon": "Rechazado"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
        });

        test('porcentaje no numérico se mantiene como null', () => {
            const respuesta = '{"match": true, "porcentaje": "alto", "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: razón vacía usa fallback
    // ──────────────────────────────────────────────────────────

    describe('razón vacía usa fallback', () => {

        test('razón vacía en match true usa fallback de aprobación', () => {
            const respuesta = '{"match": true, "porcentaje": 80, "razon": ""}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.razon).toBe(RAZON_FALLBACK_MATCH);
        });

        test('razón con solo espacios usa fallback', () => {
            const respuesta = '{"match": true, "porcentaje": 80, "razon": "   "}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.razon).toBe(RAZON_FALLBACK_MATCH);
        });

        test('razón vacía en match false usa fallback de rechazo', () => {
            const respuesta = '{"match": false, "porcentaje": 20, "razon": ""}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.razon).toBe(RAZON_FALLBACK_NO_MATCH);
        });

        test('razón ausente usa fallback', () => {
            const respuesta = '{"match": false, "porcentaje": 10}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.razon).toBe(RAZON_FALLBACK_NO_MATCH);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: JSON inválido devuelve rechazo seguro
    // ──────────────────────────────────────────────────────────

    describe('JSON inválido', () => {

        test('texto no JSON devuelve rechazo seguro con error', () => {
            const respuesta = 'Esto no es JSON';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBeNull();
            expect(resultado.error).toBe(true);
            expect(resultado.razon).toMatch(/No se pudo parsear/);
        });

        test('JSON mal formado devuelve rechazo seguro', () => {
            const respuesta = '{"match": true, "porcentaje": 80, "razon": "Sin cerrar}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });

        test('null como input devuelve rechazo seguro', () => {
            const resultado = parsearRespuestaEvaluacionIa(null);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });

        test('undefined como input devuelve rechazo seguro', () => {
            const resultado = parsearRespuestaEvaluacionIa(undefined);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });

        test('string vacío devuelve rechazo seguro', () => {
            const resultado = parsearRespuestaEvaluacionIa('');

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Casos edge adicionales
    // ──────────────────────────────────────────────────────────

    describe('casos edge', () => {

        test('acepta extensión válida de prioridad IA sin alterar el contrato legacy', () => {
            const resultado = parsearRespuestaEvaluacionIa(
                '```json\n{"match":true,"porcentaje":80,"razon":"Compatible","prioridad_ia":true,"evidencias_prioridad_ia":["Usa Copilot"]}\n```'
            );

            expect(resultado.match).toBe(true);
            expect(resultado.prioridad_ia).toBe(true);
            expect(resultado.evidencias_prioridad_ia).toEqual(['Usa Copilot']);
        });

        test('normaliza extensiones inválidas a una ausencia segura', () => {
            const resultado = parsearRespuestaEvaluacionIa(
                '{"match":true,"porcentaje":80,"razon":"Compatible","prioridad_ia":"si","evidencias_prioridad_ia":[1]}'
            );

            expect(resultado.match).toBe(true);
            expect(resultado.prioridad_ia).toBe(false);
            expect(resultado.evidencias_prioridad_ia).toEqual([]);
        });

        test('respuesta con campos extra los ignora', () => {
            const respuesta = '{"match": true, "porcentaje": 70, "razon": "OK", "campo_extra": "ignorado"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(70);
            expect(resultado.razon).toBe('OK');
        });

        test('respuesta con porcentaje decimal se redondea', () => {
            const respuesta = '{"match": true, "porcentaje": 75.7, "razon": "Match parcial"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBe(76);
        });

        test('respuesta con porcentaje 0 es válida', () => {
            const respuesta = '{"match": false, "porcentaje": 0, "razon": "Sin compatibilidad"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(0);
        });

        test('respuesta con porcentaje 100 es válida', () => {
            const respuesta = '{"match": true, "porcentaje": 100, "razon": "Match perfecto"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(100);
        });

        test('respuesta con fence ```json y texto antes', () => {
            const respuesta = 'Aquí va mi evaluación:\n```json\n{"match": true, "porcentaje": 80, "razon": "Compatible"}\n```';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            // El parser limpia los fences pero no remueve texto antes del JSON.
            // Esto falla porque "Aquí va mi evaluación:\n" no es JSON válido.
            // El comportamiento esperado es rechazo seguro con error.
            expect(resultado.error).toBe(true);
        });
    });
});
