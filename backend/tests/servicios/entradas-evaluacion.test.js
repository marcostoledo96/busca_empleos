// Tests de construcción de entradas para evaluación con IA (entradas-evaluacion.js).
//
// Cobertura:
// 1. Construcción de prompt con detección semántica de completitud (parcial, completa, ausente, desconocida).
// 2. Independencia de la completitud respecto de la longitud del texto (no heurística ingenua).
// 3. Instrucciones de sistema con contrato estructurado de explicacion (cumplidos, no_cumplidos, por_confirmar, exclusiones).
// 4. Reglas contra falsos rechazos en avisos parciales (por_confirmar en vez de no_cumplidos).
// 5. Ordenamiento canónico de objetos preservando arrays.

'use strict';

const {
    ordenarObjeto,
    construirPerfilEfectivoCanonico,
    construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias,
    construirPromptEvaluacion,
} = require('../../src/servicios/evaluacion/entradas-evaluacion');

describe('Entradas para evaluación con IA', () => {

    const perfilBase = {
        nombre: 'Marcos Ezequiel Toledo',
        nivel_experiencia: 'Junior',
        stack_tecnologico: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Angular', 'Node.js', 'PostgreSQL'],
        reglas_exclusion: ['Java', 'Senior', '3+ años', 'Inglés avanzado'],
        zonas_preferidas: ['CABA', 'Buenos Aires'],
    };

    // ──────────────────────────────────────────────────────────
    // construirPromptEvaluacion: completitud de descripción
    // ──────────────────────────────────────────────────────────

    describe('construirPromptEvaluacion() - Clasificación de completitud', () => {

        test('identifica extracto parcial cuando descripcion_completitud es "parcial"', () => {
            const oferta = {
                titulo: 'Desarrollador Angular Jr',
                empresa: 'TechCorp',
                descripcion: 'Buscamos programador Angular para integrarse al equipo.',
                descripcion_completitud: 'parcial',
            };
            const prompt = construirPromptEvaluacion(oferta);

            expect(prompt).toContain('Extracto parcial de la oferta (aviso incompleto — no asumir que requisitos no mencionados están ausentes):');
            expect(prompt).toContain('Buscamos programador Angular');
        });

        test('identifica extracto parcial cuando origen_descripcion es "tarjeta"', () => {
            const oferta = {
                titulo: 'Desarrollador Frontend',
                descripcion: 'Extracto breve obtenido de tarjeta de listado.',
                origen_descripcion: 'tarjeta',
            };
            const prompt = construirPromptEvaluacion(oferta);

            expect(prompt).toContain('Extracto parcial de la oferta (aviso incompleto — no asumir que requisitos no mencionados están ausentes):');
        });

        test('identifica descripción completa cuando descripcion_completitud es "completa"', () => {
            const oferta = {
                titulo: 'Desarrollador Node.js',
                descripcion: 'Descripción completa detallada con responsabilidades y requisitos.',
                descripcion_completitud: 'completa',
            };
            const prompt = construirPromptEvaluacion(oferta);

            expect(prompt).toContain('Descripción completa confirmada de la oferta:');
            expect(prompt).toContain('Descripción completa detallada con responsabilidades');
        });

        test('identifica descripción completa cuando origen_descripcion es "manual"', () => {
            const oferta = {
                titulo: 'QA Tester',
                descripcion: 'Oferta ingresada manualmente por el usuario.',
                origen_descripcion: 'manual',
            };
            const prompt = construirPromptEvaluacion(oferta);

            expect(prompt).toContain('Descripción completa confirmada de la oferta:');
        });

        test('identifica descripción ausente cuando el texto está vacío o compuesto solo por espacios', () => {
            const ofertaVacia = { titulo: 'Analista IT', descripcion: '' };
            const ofertaEspacios = { titulo: 'Analista IT', descripcion: '   ' };

            expect(construirPromptEvaluacion(ofertaVacia)).toContain('Descripción ausente de la oferta (sin contenido disponible):');
            expect(construirPromptEvaluacion(ofertaVacia)).toContain('Sin descripción disponible.');

            expect(construirPromptEvaluacion(ofertaEspacios)).toContain('Descripción ausente de la oferta (sin contenido disponible):');
            expect(construirPromptEvaluacion(ofertaEspacios)).toContain('Sin descripción disponible.');
        });

        test('identifica descripción ausente cuando descripcion_completitud es "ausente"', () => {
            const oferta = {
                titulo: 'Soporte Técnico',
                descripcion: '',
                descripcion_completitud: 'ausente',
            };
            const prompt = construirPromptEvaluacion(oferta);

            expect(prompt).toContain('Descripción ausente de la oferta (sin contenido disponible):');
        });

        test('clasifica como completitud no verificada por defecto ante ausencia de metadata (sin asumir completitud por longitud)', () => {
            const ofertaCorta = {
                titulo: 'Dev Jr',
                descripcion: 'Requisitos: TypeScript y React.',
            };
            const ofertaLarga = {
                titulo: 'Dev Jr',
                descripcion: 'A'.repeat(5000),
            };

            const promptCorta = construirPromptEvaluacion(ofertaCorta);
            const promptLarga = construirPromptEvaluacion(ofertaLarga);

            // Ninguna debe deducirse por longitud: ambas usan el encabezado por defecto no verificado.
            expect(promptCorta).toContain('Descripción provista de la oferta (completitud no verificada):');
            expect(promptLarga).toContain('Descripción provista de la oferta (completitud no verificada):');
        });

        test('incluye campos opcionales si están presentes en la oferta', () => {
            const oferta = {
                titulo: 'Frontend Developer',
                empresa: 'Globant',
                ubicacion: 'CABA',
                modalidad: 'Híbrido',
                nivel_requerido: 'Junior',
                plataforma: 'LinkedIn',
                descripcion: 'Desarrollo web moderno.',
                descripcion_completitud: 'completa',
            };
            const prompt = construirPromptEvaluacion(oferta);

            expect(prompt).toContain('Título: Frontend Developer');
            expect(prompt).toContain('Empresa: Globant');
            expect(prompt).toContain('Ubicación: CABA');
            expect(prompt).toContain('Modalidad: Híbrido');
            expect(prompt).toContain('Nivel requerido: Junior');
            expect(prompt).toContain('Plataforma: LinkedIn');
        });
    });

    // ──────────────────────────────────────────────────────────
    // construirInstruccionesDesdePreferencias: contrato explicable
    // ──────────────────────────────────────────────────────────

    describe('construirInstruccionesDesdePreferencias() - Contrato explicable', () => {

        test('instruye el formato JSON estricto con explicacion y sus cuatro arrays', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(perfilBase);

            expect(instrucciones).toContain('{"match": true, "porcentaje": 85, "razon": "Explicación breve en español", "explicacion": {"cumplidos": [], "no_cumplidos": [], "por_confirmar": [], "exclusiones": []}}');
            expect(instrucciones).toContain('cumplidos, no_cumplidos, por_confirmar, exclusiones');
        });

        test('define la estructura de cada elemento en los arrays de explicacion', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(perfilBase);

            expect(instrucciones).toContain('{"requisito": "nombre del requisito", "tipo": "obligatorio" | "deseable" | "desconocido", "evidencia_oferta": "cita textual o resumen de la oferta", "evidencia_perfil": "hecho confirmado del perfil o vacío si no aplica", "explicacion": "justificación concisa"}');
        });

        test('instruye que requisitos deseables no cumplidos NO deben justificar un rechazo por sí solos', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(perfilBase);

            expect(instrucciones).toContain('Requisitos deseables no cumplidos NO deben justificar un rechazo por sí solos ni considerarse exclusiones.');
        });

        test('instruye que en avisos incompletos los requisitos ausentes van a por_confirmar y nunca a no_cumplidos', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(perfilBase);

            expect(instrucciones).toContain('Si la oferta contiene un extracto parcial o aviso incompleto, los requisitos no mencionados deben clasificarse en "por_confirmar", NUNCA en "no_cumplidos" (salvo exclusión explícita presente en el texto).');
        });

        test('advierte no inventar datos del perfil ni del candidato', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(perfilBase);

            expect(instrucciones).toContain('No inventes conocimientos, herramientas, idiomas, empleos ni proyectos. null significa no declarado, [] significa sin entradas confirmadas.');
        });

        test('incorpora criterios personalizados del usuario sin violar las políticas', () => {
            const prefs = {
                ...perfilBase,
                usar_prompt_personalizado: true,
                prompt_personalizado: 'Priorizar proyectos con TypeScript estricto.',
            };
            const instrucciones = construirInstruccionesDesdePreferencias(prefs);

            expect(instrucciones).toContain('CRITERIOS ADICIONALES DEL USUARIO:');
            expect(instrucciones).toContain('Priorizar proyectos con TypeScript estricto.');
        });
    });

    // ──────────────────────────────────────────────────────────
    // ordenarObjeto
    // ──────────────────────────────────────────────────────────

    describe('ordenarObjeto()', () => {

        test('ordena claves alfabéticamente pero conserva el orden exacto de los arrays', () => {
            const entrada = {
                z: 1,
                a: [3, 1, 2],
                m: { b: 2, a: 1 },
            };
            const salida = ordenarObjeto(entrada);

            expect(Object.keys(salida)).toEqual(['a', 'm', 'z']);
            expect(salida.a).toEqual([3, 1, 2]); // Array intacto
            expect(Object.keys(salida.m)).toEqual(['a', 'b']);
        });

        test('maneja valores primitivos y nulos sin mutaciones', () => {
            expect(ordenarObjeto('texto')).toBe('texto');
            expect(ordenarObjeto(123)).toBe(123);
            expect(ordenarObjeto(null)).toBeNull();
            expect(ordenarObjeto(undefined)).toBeUndefined();
        });
    });
});
