// Tests del parser estricto de respuesta IA.
//
// Cobertura:
// 1. Limpieza de fences Markdown.
// 2. Aceptación de JSON válido y tipado estricto (match boolean).
// 3. Normalización y validación estricta de porcentaje (clampPorcentaje sin clamp silencioso).
// 4. Corrección de bug de string vacío ("" -> null en vez de 0).
// 5. Normalización y sanitización de explicacion (cumplidos, no_cumplidos, por_confirmar, exclusiones).
// 6. Compatibilidad retroactiva con respuestas legacy (sin explicacion).
// 7. Validación de coherencia lógica (match vs porcentaje vs exclusiones).
// 8. Detección de inconsistencias sin forzar silenciosamente el booleano.

'use strict';

const {
    parsearRespuestaEvaluacionIa,
    sanitizarItemExplicacion,
    normalizarExplicacion,
    validarCoherenciaRespuesta,
    UMBRAL_MATCH_MINIMO,
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
    // clampPorcentaje (estricto sin clamp silencioso)
    // ──────────────────────────────────────────────────────────

    describe('clampPorcentaje()', () => {

        test('acota número dentro del rango 0-100', () => {
            expect(clampPorcentaje(80)).toBe(80);
            expect(clampPorcentaje(0)).toBe(0);
            expect(clampPorcentaje(100)).toBe(100);
        });

        test('retorna null para números fuera de rango en vez de clamp silencioso', () => {
            expect(clampPorcentaje(150)).toBeNull();
            expect(clampPorcentaje(-5)).toBeNull();
            expect(clampPorcentaje(101)).toBeNull();
            expect(clampPorcentaje(-1)).toBeNull();
        });

        test('convierte string numérico a entero dentro del rango', () => {
            expect(clampPorcentaje('75')).toBe(75);
            expect(clampPorcentaje('0')).toBe(0);
            expect(clampPorcentaje('100')).toBe(100);
            expect(clampPorcentaje('150')).toBeNull();
        });

        test('retorna null para string vacío o espacios (corrección bug Number("") === 0)', () => {
            expect(clampPorcentaje('')).toBeNull();
            expect(clampPorcentaje('   ')).toBeNull();
            expect(clampPorcentaje('\t\n')).toBeNull();
        });

        test('retorna null para valores no numéricos', () => {
            expect(clampPorcentaje('abc')).toBeNull();
            expect(clampPorcentaje(null)).toBeNull();
            expect(clampPorcentaje(undefined)).toBeNull();
            expect(clampPorcentaje(NaN)).toBeNull();
            expect(clampPorcentaje(Infinity)).toBeNull();
            expect(clampPorcentaje(-Infinity)).toBeNull();
        });

        test('redondea decimales correctamente', () => {
            expect(clampPorcentaje(75.6)).toBe(76);
            expect(clampPorcentaje(75.4)).toBe(75);
        });
    });

    // ──────────────────────────────────────────────────────────
    // JSON válido sin fence
    // ──────────────────────────────────────────────────────────

    describe('JSON válido sin fence', () => {

        test('parsea respuesta JSON válida sin fences', () => {
            const respuesta = '{"match": true, "porcentaje": 80, "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(80);
            expect(resultado.razon).toBe('Compatible');
            expect(resultado.error).toBeUndefined();
            expect(resultado.inconsistente).toBeUndefined();
            expect(resultado.desglose_disponible).toBe(false);
            expect(resultado.explicacion).toEqual({
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
                desglose_disponible: false,
            });
        });

        test('parsea respuesta de rechazo válida con porcentaje bajo', () => {
            const respuesta = '{"match": false, "porcentaje": 20, "razon": "Requiere Java"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(20);
            expect(resultado.razon).toBe('Requiere Java');
            expect(resultado.error).toBeUndefined();
            expect(resultado.inconsistente).toBeUndefined();
        });
    });

    // ──────────────────────────────────────────────────────────
    // JSON válido con fence Markdown
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
    // Tipado estricto del campo match
    // ──────────────────────────────────────────────────────────

    describe('boolean como string es inválido', () => {

        test('rechaza match: "false" (string en vez de boolean)', () => {
            const respuesta = '{"match": "false", "porcentaje": 20, "razon": "Java excluyente"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
            expect(resultado.invalido).toBe(true);
            expect(resultado.razon).toMatch(/boolean/);
        });

        test('rechaza match: "true" (string en vez de boolean)', () => {
            const respuesta = '{"match": "true", "porcentaje": 80, "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('rechaza match: null', () => {
            const respuesta = '{"match": null, "porcentaje": 50, "razon": "Sin datos"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('rechaza match: número (1)', () => {
            const respuesta = '{"match": 1, "porcentaje": 80, "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.error).toBe(true);
            expect(resultado.invalido).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Porcentaje fuera de rango, ausente o vacío
    // ──────────────────────────────────────────────────────────

    describe('porcentaje fuera de rango, ausente o vacío', () => {

        test('porcentaje 150 retorna null y marca inconsistente', () => {
            const respuesta = '{"match": true, "porcentaje": 150, "razon": "Perfect match"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBeNull();
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('porcentaje negativo retorna null y marca inconsistente', () => {
            const respuesta = '{"match": false, "porcentaje": -10, "razon": "No match"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBeNull();
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('porcentaje como string vacío "" retorna null y marca inconsistente', () => {
            const respuesta = '{"match": true, "porcentaje": "", "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('porcentaje como string numérico se convierte', () => {
            const respuesta = '{"match": true, "porcentaje": "85", "razon": "Buen match"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBe(85);
            expect(resultado.inconsistente).toBeUndefined();
        });

        test('porcentaje null se mantiene como null y marca inconsistente', () => {
            const respuesta = '{"match": true, "porcentaje": null, "razon": "Match sin porcentaje"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('porcentaje ausente se mantiene como null y marca inconsistente', () => {
            const respuesta = '{"match": false, "razon": "Rechazado"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
        });

        test('porcentaje no numérico se mantiene como null y marca inconsistente', () => {
            const respuesta = '{"match": true, "porcentaje": "alto", "razon": "Compatible"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.porcentaje).toBeNull();
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Fallback de razón
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

        test('razón ausente usa fallback y conserva reporte de inconsistencia si porcentaje falta', () => {
            const respuesta = '{"match": false, "porcentaje": 10}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.razon).toBe(RAZON_FALLBACK_NO_MATCH);
        });
    });

    // ──────────────────────────────────────────────────────────
    // JSON mal formado o tipos nulos
    // ──────────────────────────────────────────────────────────

    describe('JSON inválido', () => {

        test('texto no JSON devuelve rechazo seguro con error', () => {
            const respuesta = 'Esto no es JSON';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBeNull();
            expect(resultado.error).toBe(true);
            expect(resultado.invalido).toBe(true);
            expect(resultado.razon).toMatch(/No se pudo parsear/);
            expect(resultado.explicacion).toEqual({
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            });
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
    // Parseo y sanitización de explicación estructurada
    // ──────────────────────────────────────────────────────────

    describe('desglose estructurado de explicacion', () => {

        test('parsea y sanitiza correctamente los 4 arrays de explicacion', () => {
            const respuesta = JSON.stringify({
                match: true,
                porcentaje: 85,
                razon: 'Cumple stack principal',
                explicacion: {
                    cumplidos: [
                        {
                            requisito: 'Angular',
                            tipo: 'obligatorio',
                            evidencia_oferta: 'Angular 17+',
                            evidencia_perfil: 'Angular en proyectos personales',
                            explicacion: 'Manejo demostrado',
                        },
                    ],
                    no_cumplidos: [
                        {
                            requisito: 'Docker',
                            tipo: 'deseable',
                            evidencia_oferta: 'Docker deseable',
                            evidencia_perfil: '',
                            explicacion: 'No mencionado en perfil',
                        },
                    ],
                    por_confirmar: [
                        {
                            requisito: 'PostgreSQL',
                            tipo: 'desconocido',
                            evidencia_oferta: 'Base de datos SQL',
                            evidencia_perfil: 'PostgreSQL',
                            explicacion: 'A confirmar versión',
                        },
                    ],
                    exclusiones: [],
                },
            });

            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.desglose_disponible).toBe(true);
            expect(resultado.explicacion.cumplidos).toHaveLength(1);
            expect(resultado.explicacion.cumplidos[0].requisito).toBe('Angular');
            expect(resultado.explicacion.cumplidos[0].tipo).toBe('obligatorio');
            expect(resultado.explicacion.no_cumplidos).toHaveLength(1);
            expect(resultado.explicacion.no_cumplidos[0].tipo).toBe('deseable');
            expect(resultado.explicacion.por_confirmar).toHaveLength(1);
            expect(resultado.explicacion.exclusiones).toEqual([]);
        });

        test('normaliza tipos no estándar a valores válidos o desconocido', () => {
            const item = sanitizarItemExplicacion({
                requisito: 'Git',
                tipo: 'excluyente',
                evidencia_oferta: 'Git obligatorio',
            });
            expect(item.tipo).toBe('obligatorio');

            const itemDeseable = sanitizarItemExplicacion({
                requisito: 'Vue',
                tipo: 'opcional',
                evidencia_oferta: 'Plus',
            });
            expect(itemDeseable.tipo).toBe('deseable');

            const itemInvalido = sanitizarItemExplicacion({
                requisito: 'Linux',
                tipo: 'valor_raro',
            });
            expect(itemInvalido.tipo).toBe('desconocido');
        });

        test('fallback seguro cuando no se provee explicacion (legacy)', () => {
            const respuesta = '{"match": true, "porcentaje": 70, "razon": "Sin desglose"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.desglose_disponible).toBe(false);
            expect(resultado.explicacion).toEqual({
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
                desglose_disponible: false,
            });
        });
    });

    // ──────────────────────────────────────────────────────────
    // Validación de coherencia lógica
    // ──────────────────────────────────────────────────────────

    describe('validación de coherencia', () => {

        test('match: true con porcentaje menor a 60% es inconsistente', () => {
            const respuesta = '{"match": true, "porcentaje": 40, "razon": "Aprobada por la IA"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true); // No se altera silenciosamente
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
            expect(resultado.error).toBe(true);
            expect(resultado.razon).toContain('Inconsistencia detectada');
        });

        test('match: false con porcentaje >= 60% sin exclusión es inconsistente', () => {
            const respuesta = JSON.stringify({
                match: false,
                porcentaje: 80,
                razon: 'Rechazada sin motivo claro',
                explicacion: {
                    cumplidos: [{ requisito: 'React', tipo: 'obligatorio', explicacion: 'OK' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [],
                },
            });
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.inconsistente).toBe(true);
            expect(resultado.invalido).toBe(true);
            expect(resultado.error).toBe(true);
            expect(resultado.razon).toContain('Inconsistencia detectada');
        });

        test('match: false con porcentaje >= 60% y exclusión deseable o sin evidencia es inconsistente (B-03)', () => {
            // Caso 1: Exclusión con tipo deseable
            const respuestaDeseable = JSON.stringify({
                match: false,
                porcentaje: 80,
                razon: 'Rechazada por deseable',
                explicacion: {
                    cumplidos: [{ requisito: 'React', tipo: 'obligatorio', explicacion: 'OK' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [{ requisito: 'Docker', tipo: 'deseable', evidencia_oferta: 'Deseable Docker' }],
                },
            });
            const resDeseable = parsearRespuestaEvaluacionIa(respuestaDeseable);
            expect(resDeseable.inconsistente).toBe(true);
            expect(resDeseable.invalido).toBe(true);
            expect(resDeseable.error).toBe(true);

            // Caso 2: Exclusión obligatoria pero sin evidencia_oferta ni explicacion
            const respuestaSinEvidencia = JSON.stringify({
                match: false,
                porcentaje: 80,
                razon: 'Rechazada sin evidencia',
                explicacion: {
                    cumplidos: [{ requisito: 'React', tipo: 'obligatorio', explicacion: 'OK' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [{ requisito: 'Java', tipo: 'obligatorio', evidencia_oferta: '', explicacion: '' }],
                },
            });
            const resSinEvidencia = parsearRespuestaEvaluacionIa(respuestaSinEvidencia);
            expect(resSinEvidencia.inconsistente).toBe(true);
            expect(resSinEvidencia.invalido).toBe(true);
            expect(resSinEvidencia.error).toBe(true);
        });

        test('match: false con porcentaje >= 60% con exclusión explicada es VÁLIDO y coherente', () => {
            const respuesta = JSON.stringify({
                match: false,
                porcentaje: 85,
                razon: 'Rechazada por Java obligatorio',
                explicacion: {
                    cumplidos: [{ requisito: 'TypeScript', tipo: 'obligatorio', explicacion: 'Cumple' }],
                    no_cumplidos: [{ requisito: 'Java', tipo: 'obligatorio', explicacion: 'Excluyente' }],
                    por_confirmar: [],
                    exclusiones: [{ requisito: 'Java', tipo: 'obligatorio', evidencia_oferta: 'Java 17', explicacion: 'Exclusión estricta' }],
                },
            });
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(85);
            expect(resultado.inconsistente).toBeUndefined();
            expect(resultado.invalido).toBeUndefined();
            expect(resultado.error).toBeUndefined();
        });
    });

    // ──────────────────────────────────────────────────────────
    // Casos edge y extensiones
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

        test('respuesta con porcentaje 0 es válida y consistente', () => {
            const respuesta = '{"match": false, "porcentaje": 0, "razon": "Sin compatibilidad"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(0);
            expect(resultado.inconsistente).toBeUndefined();
        });

        test('respuesta con porcentaje 100 es válida y consistente', () => {
            const respuesta = '{"match": true, "porcentaje": 100, "razon": "Match perfecto"}';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(100);
            expect(resultado.inconsistente).toBeUndefined();
        });

        test('respuesta con fence ```json y texto antes devuelve error', () => {
            const respuesta = 'Aquí va mi evaluación:\n```json\n{"match": true, "porcentaje": 80, "razon": "Compatible"}\n```';
            const resultado = parsearRespuestaEvaluacionIa(respuesta);

            expect(resultado.error).toBe(true);
            expect(resultado.invalido).toBe(true);
        });
    });
});
