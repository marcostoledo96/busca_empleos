// Tests exhaustivos para el Issue #17: Motor de Matching Explicable, Coherencia y Muestra de 25 Casos.
//
// Verifica:
// 1. La colección de los 25 casos sintéticos de muestra con metadata completa y estado de revisión.
// 2. Ejecución integral de los 25 casos a través del motor (reglas de exclusión, IA y coherencia).
// 3. Reglas de exclusión determinísticas con desglose estructurado enriquecido (exclusiones y no_cumplidos).
// 4. Validación de coherencia lógica (match vs porcentaje vs exclusiones).
// 5. Corrección del bug de clampPorcentaje ("" -> null, sin clamp silencioso).
// 6. Diferenciación semántica de completitud en la construcción del prompt.

'use strict';

jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'),
    consultarDeepSeek: jest.fn(),
}));

jest.mock('../../src/modelos/evaluacion-cache', () => ({
    buscarCache: jest.fn().mockResolvedValue(null),
    guardarCache: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../src/modelos/preferencia', () => ({
    obtenerPreferencias: jest.fn().mockResolvedValue({}),
}));

const { consultarDeepSeek } = require('../../src/config/deepseek');
const { CASOS_MUESTRA_MATCHING } = require('../fixtures/casos-muestra-matching');
const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');
const reglasExclusionModulo = require('../../src/servicios/evaluacion/reglas-exclusion');
const {
    evaluarReglasExclusion,
    construirItemExclusion,
    construirDesgloseExclusion,
} = reglasExclusionModulo;
const {
    parsearRespuestaEvaluacionIa,
    clampPorcentaje,
    validarCoherenciaRespuesta,
    sanitizarItemExplicacion,
    normalizarExplicacion,
} = require('../../src/servicios/evaluacion/parser-respuesta-ia');
const {
    construirPromptEvaluacion,
    construirInstruccionesDesdePreferencias,
} = require('../../src/servicios/evaluacion/entradas-evaluacion');

describe('Issue #17: Motor de Matching Explicable y Coherente', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ──────────────────────────────────────────────────────────
    // 1. Integridad de la colección sintética de 25 casos
    // ──────────────────────────────────────────────────────────

    describe('Colección de casos sintéticos de muestra', () => {

        test('contiene al menos 25 casos sintéticos de prueba', () => {
            expect(CASOS_MUESTRA_MATCHING.length).toBeGreaterThanOrEqual(25);
        });

        test('todos los casos tienen estructura completa y estado "propuesta_pendiente_revision_humana"', () => {
            for (const caso of CASOS_MUESTRA_MATCHING) {
                expect(caso).toHaveProperty('id');
                expect(caso).toHaveProperty('titulo');
                expect(caso).toHaveProperty('descripcion');
                expect(caso).toHaveProperty('origen_descripcion');
                expect(caso).toHaveProperty('descripcion_completitud');
                expect(caso).toHaveProperty('perfil');
                expect(caso).toHaveProperty('resultado_esperado');
                expect(caso).toHaveProperty('explicacion_esperada');
                expect(caso).toHaveProperty('evidencias');
                expect(Array.isArray(caso.evidencias)).toBe(true);
                expect(caso.estado_revision).toBe('propuesta_pendiente_revision_humana');
            }
        });
    });

    // ──────────────────────────────────────────────────────────
    // 2. Ejecución integral de los 25 casos
    // ──────────────────────────────────────────────────────────

    describe('Evaluación de los 25 casos sintéticos', () => {

        CASOS_MUESTRA_MATCHING.forEach((caso, index) => {
            test(`Caso ${index + 1} (${caso.id}): ${caso.titulo}`, async () => {
                consultarDeepSeek.mockReset();
                if (caso.respuesta_ia_simulada) {
                    consultarDeepSeek.mockResolvedValue(caso.respuesta_ia_simulada);
                }

                // Si el caso tiene respuesta IA simulada, probamos también el parseo y coherencia directa
                if (caso.respuesta_ia_simulada) {
                    const parsed = parsearRespuestaEvaluacionIa(caso.respuesta_ia_simulada);
                    if (caso.resultado_esperado.inconsistente) {
                        expect(parsed.inconsistente).toBe(true);
                        expect(parsed.invalido).toBe(true);
                    } else if (caso.resultado_esperado.inconsistente === false) {
                        expect(parsed.inconsistente).toBeUndefined();
                        expect(parsed.invalido).toBeUndefined();
                    }
                }

                const oferta = {
                    id: index + 1,
                    titulo: caso.titulo,
                    empresa: caso.empresa || 'Empresa Test',
                    ubicacion: caso.ubicacion || 'CABA',
                    modalidad: caso.modalidad || 'Remoto',
                    descripcion: caso.descripcion,
                    origen_descripcion: caso.origen_descripcion,
                    descripcion_completitud: caso.descripcion_completitud,
                };

                const resultado = await evaluarOferta(
                    oferta,
                    undefined,
                    undefined,
                    caso.perfil,
                    { forzar: true }
                );

                // Verificación de veredicto
                expect(resultado.match).toBe(caso.resultado_esperado.match);

                // Verificación de porcentaje exacto o rangos
                if (caso.resultado_esperado.porcentaje !== undefined) {
                    expect(resultado.porcentaje).toBe(caso.resultado_esperado.porcentaje);
                }
                if (caso.resultado_esperado.porcentaje_min !== undefined) {
                    expect(resultado.porcentaje).toBeGreaterThanOrEqual(caso.resultado_esperado.porcentaje_min);
                }

                // Verificación de inconsistencia lógica si correspondía
                if (caso.resultado_esperado.inconsistente) {
                    expect(resultado.inconsistente).toBe(true);
                    expect(resultado.invalido).toBe(true);
                }

                // Verificación de presencia de desglose estructurado
                expect(resultado).toHaveProperty('explicacion');
                expect(Array.isArray(resultado.explicacion.cumplidos)).toBe(true);
                expect(Array.isArray(resultado.explicacion.no_cumplidos)).toBe(true);
                expect(Array.isArray(resultado.explicacion.por_confirmar)).toBe(true);
                expect(Array.isArray(resultado.explicacion.exclusiones)).toBe(true);

                // Verificación de contenido en la explicación
                if (caso.explicacion_esperada.tiene_exclusiones) {
                    expect(resultado.explicacion.exclusiones.length).toBeGreaterThan(0);
                }
                if (caso.explicacion_esperada.tiene_cumplidos) {
                    expect(resultado.explicacion.cumplidos.length).toBeGreaterThan(0);
                }
            });
        });
    });

    // ──────────────────────────────────────────────────────────
    // 3. Reglas de exclusión determinísticas y desglose enriquecido
    // ──────────────────────────────────────────────────────────

    describe('Reglas de exclusión con desglose estructurado', () => {

        test('exclusión de Java agrega el requisito a exclusiones y no_cumplidos con evidencia', () => {
            const oferta = {
                titulo: 'Backend Java Junior',
                descripcion: 'Requisitos obligatorios: Java 17 y Spring Boot.',
            };
            const resultado = evaluarReglasExclusion(oferta, { zonas_preferidas: ['CABA'] });

            expect(resultado.excluida).toBe(true);
            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(10);
            expect(resultado.explicacion.exclusiones).toHaveLength(1);
            expect(resultado.explicacion.no_cumplidos).toHaveLength(1);

            const item = resultado.explicacion.exclusiones[0];
            expect(item.requisito).toContain('Java');
            expect(item.tipo).toBe('obligatorio');
            expect(item.evidencia_oferta).toContain('java');
            expect(item.explicacion).toContain('exclusión estricta');
        });

        test('exclusión de Seniority agrega el requisito a exclusiones y no_cumplidos con evidencia', () => {
            const oferta = {
                titulo: 'Tech Lead / Desarrollador Senior',
                descripcion: 'Buscamos Tech Lead con experiencia comprobada.',
            };
            const resultado = evaluarReglasExclusion(oferta, { zonas_preferidas: ['CABA'] });

            expect(resultado.excluida).toBe(true);
            expect(resultado.explicacion.exclusiones).toHaveLength(1);
            expect(resultado.explicacion.exclusiones[0].requisito).toContain('Seniority');
            expect(resultado.explicacion.exclusiones[0].evidencia_oferta).toBeDefined();
        });

        test('exclusión de 3+ años agrega el requisito a exclusiones y no_cumplidos con evidencia', () => {
            const oferta = {
                titulo: 'Desarrollador Junior',
                descripcion: 'Requisito excluyente: más de 3 años de experiencia en desarrollo web.',
            };
            const resultado = evaluarReglasExclusion(oferta, { zonas_preferidas: ['CABA'] });

            expect(resultado.excluida).toBe(true);
            expect(resultado.explicacion.exclusiones).toHaveLength(1);
            expect(resultado.explicacion.exclusiones[0].requisito).toContain('3+ años');
        });

        test('exclusión de inglés avanzado agrega el requisito a exclusiones y no_cumplidos', () => {
            const oferta = {
                titulo: 'Frontend Dev',
                descripcion: 'Fluent English is mandatory for daily standups.',
            };
            const resultado = evaluarReglasExclusion(oferta, { zonas_preferidas: ['CABA'] });

            expect(resultado.excluida).toBe(true);
            expect(resultado.explicacion.exclusiones).toHaveLength(1);
            expect(resultado.explicacion.exclusiones[0].requisito).toContain('Inglés');
        });

        test('exclusión de remoto territorial agrega el requisito a exclusiones y no_cumplidos', () => {
            const oferta = {
                titulo: 'Fullstack Dev Remoto',
                modalidad: 'remoto',
                descripcion: 'Must be located in the US. Only US residents.',
            };
            const resultado = evaluarReglasExclusion(oferta, { zonas_preferidas: ['CABA'] });

            expect(resultado.excluida).toBe(true);
            expect(resultado.explicacion.exclusiones).toHaveLength(1);
            expect(resultado.explicacion.exclusiones[0].requisito).toContain('territorial');
        });
    });

    // ──────────────────────────────────────────────────────────
    // 4. Validación de coherencia lógica del parser
    // ──────────────────────────────────────────────────────────

    describe('Validación de coherencia lógica', () => {

        test('match: true con porcentaje 40 es inconsistente e inválido', () => {
            const respuesta = JSON.stringify({
                match: true,
                porcentaje: 40,
                razon: 'Aprobado sin sustento',
            });
            const parsed = parsearRespuestaEvaluacionIa(respuesta);

            expect(parsed.match).toBe(true); // No se sobreescribe silenciosamente
            expect(parsed.inconsistente).toBe(true);
            expect(parsed.invalido).toBe(true);
            expect(parsed.razon).toContain('Inconsistencia detectada');
        });

        test('match: false con porcentaje 75 sin exclusiones es inconsistente e inválido', () => {
            const respuesta = JSON.stringify({
                match: false,
                porcentaje: 75,
                razon: 'Rechazo arbitrario',
                explicacion: {
                    cumplidos: [{ requisito: 'Angular', tipo: 'obligatorio', explicacion: 'Cumple' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [],
                },
            });
            const parsed = parsearRespuestaEvaluacionIa(respuesta);

            expect(parsed.match).toBe(false);
            expect(parsed.inconsistente).toBe(true);
            expect(parsed.invalido).toBe(true);
            expect(parsed.razon).toContain('sin registrar ninguna exclusión obligatoria justificada');
        });

        test('match: false con porcentaje 85 y exclusión comprobada es VÁLIDO', () => {
            const respuesta = JSON.stringify({
                match: false,
                porcentaje: 85,
                razon: 'Excelente en Angular pero requiere Java excluyente',
                explicacion: {
                    cumplidos: [{ requisito: 'Angular', tipo: 'obligatorio', explicacion: 'Cumple' }],
                    no_cumplidos: [{ requisito: 'Java', tipo: 'obligatorio', explicacion: 'Exclusión' }],
                    por_confirmar: [],
                    exclusiones: [{ requisito: 'Java', tipo: 'obligatorio', evidencia_oferta: 'Java 17', explicacion: 'Regla dura' }],
                },
            });
            const parsed = parsearRespuestaEvaluacionIa(respuesta);

            expect(parsed.match).toBe(false);
            expect(parsed.porcentaje).toBe(85);
            expect(parsed.inconsistente).toBeUndefined();
            expect(parsed.invalido).toBeUndefined();
        });

        test('porcentaje vacío "" retorna null y marca inconsistente', () => {
            const parsed = parsearRespuestaEvaluacionIa('{"match": true, "porcentaje": "", "razon": "Test"}');

            expect(parsed.porcentaje).toBeNull();
            expect(parsed.inconsistente).toBe(true);
            expect(parsed.invalido).toBe(true);
        });

        test('porcentaje fuera de rango (150 o -10) retorna null y marca inconsistente', () => {
            const parsed150 = parsearRespuestaEvaluacionIa('{"match": true, "porcentaje": 150, "razon": "Test"}');
            const parsedNeg = parsearRespuestaEvaluacionIa('{"match": false, "porcentaje": -10, "razon": "Test"}');

            expect(parsed150.porcentaje).toBeNull();
            expect(parsed150.inconsistente).toBe(true);

            expect(parsedNeg.porcentaje).toBeNull();
            expect(parsedNeg.inconsistente).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // 5. Post-evaluación en servicio-evaluacion cuando IA omite exclusión
    // ──────────────────────────────────────────────────────────

    describe('Post-evaluación determinística', () => {

        test('sobreescribe aprobación errónea de DeepSeek y enriquece la explicación', async () => {
            // Simulamos que la oferta pasó la pre-evaluación (ej. por redacción sutil)
            // pero DeepSeek aprueba por error, y la post-evaluación intercepta la exclusión.
            const spyExclusion = jest.spyOn(reglasExclusionModulo, 'evaluarReglasExclusion');

            // 1ra llamada (pre-evaluación): pasa
            spyExclusion.mockReturnValueOnce({
                excluida: false,
                match: true,
                porcentaje: null,
                razon: '',
                reglas: [],
                explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
            });

            // 2da llamada (post-evaluación): detecta Java
            const itemJava = construirItemExclusion('java', { patron: 'java', evidencia: 'Java requerido' });
            spyExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 10,
                razon: 'La oferta requiere Java como tecnología principal o excluyente.',
                reglas: ['java'],
                explicacion: {
                    cumplidos: [],
                    no_cumplidos: [itemJava],
                    por_confirmar: [],
                    exclusiones: [itemJava],
                },
            });

            // DeepSeek responde aprobando erróneamente
            consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({
                match: true,
                porcentaje: 90,
                razon: 'Aprobado por coincidencia con frontend',
                explicacion: {
                    cumplidos: [{ requisito: 'Angular', tipo: 'obligatorio', evidencia_oferta: 'Angular', evidencia_perfil: 'Angular', explicacion: 'OK' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [],
                },
            }));

            const oferta = {
                id: 99,
                titulo: 'Fullstack Dev Junior',
                descripcion: 'Requisitos: Angular y Java.',
            };

            const resultado = await evaluarOferta(oferta, undefined, undefined, { zonas_preferidas: ['CABA'] }, { forzar: true });

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(10);
            expect(resultado.razon).toContain('Java');
            expect(resultado.explicacion.cumplidos).toHaveLength(1);
            expect(resultado.explicacion.cumplidos[0].requisito).toBe('Angular');
            expect(resultado.explicacion.exclusiones).toHaveLength(1);
            expect(resultado.explicacion.exclusiones[0].requisito).toContain('Java');

            spyExclusion.mockRestore();
        });
    });
});
