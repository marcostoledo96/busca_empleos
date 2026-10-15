// Tests de persistencia, ciclo de reevaluación y edición manual de descripción (Issue #17 / Work Unit 2).
//
// Valida:
// 1. Método modeloOferta.actualizarDescripcionManual: validaciones, SQL ejecutado, preservación
//    de campos inmutables (estado_postulacion, titulo, empresa, url, etc.).
// 2. Preservación de estado_postulacion ante ediciones manuales sucesivas.
// 3. Reseteo a estado_evaluacion = 'pendiente' con evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA'.
// 4. Invalidación del hash de oferta (identidad) ante cambio de descripción para la caché de evaluación.
// 5. Persistencia de explicacion_evaluacion vía actualizarEvaluacion y evaluarOfertasPendientes.
// 6. Asignación de origen_descripcion y descripcion_completitud en normalizarOfertaBumeran y crearOferta.

'use strict';

jest.mock('../../src/config/base-datos', () => ({
    query: jest.fn(),
    connect: jest.fn(),
}));

jest.mock('../../src/config/deepseek', () => ({
    consultarDeepSeek: jest.fn(),
    DEEPSEEK_MODELO: 'deepseek-chat',
}));

jest.mock('../../src/modelos/preferencia', () => ({
    obtenerPreferencias: jest.fn(),
}));

jest.mock('../../src/modelos/evaluacion-cache', () => ({
    buscarCache: jest.fn().mockResolvedValue(null),
    guardarCache: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../src/modelos/evaluacion-lote', () => ({
    crearLote: jest.fn().mockResolvedValue({ id: 101 }),
    actualizarProgreso: jest.fn().mockResolvedValue(null),
    finalizarLote: jest.fn().mockResolvedValue(null),
}));

const pool = require('../../src/config/base-datos');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const modeloOferta = require('../../src/modelos/oferta');
const modeloPreferencia = require('../../src/modelos/preferencia');
const evaluacionCache = require('../../src/modelos/evaluacion-cache');
const { evaluarOfertasPendientes, obtenerProgresoEvaluacion } = require('../../src/servicios/servicio-evaluacion');
const { construirIdentidadEvaluacion } = require('../../src/servicios/evaluacion/identidad-evaluacion');
const { normalizarOfertaBumeran } = require('../../src/servicios/servicio-normalizacion');

describe('Issue #17 (Work Unit 2) — Persistencia de Explicación y Edición Manual de Descripción', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('modeloOferta.actualizarDescripcionManual', () => {
        test('valida que el ID sea entero positivo', async () => {
            await expect(modeloOferta.actualizarDescripcionManual(0, 'Descripción válida con longitud suficiente.'))
                .rejects.toThrow('El ID debe ser un número entero positivo.');

            await expect(modeloOferta.actualizarDescripcionManual(-5, 'Descripción válida con longitud suficiente.'))
                .rejects.toThrow('El ID debe ser un número entero positivo.');

            await expect(modeloOferta.actualizarDescripcionManual('no-valido', 'Descripción válida con longitud suficiente.'))
                .rejects.toThrow('El ID debe ser un número entero positivo.');
        });

        test('valida longitud de la nueva descripción (entre 20 y 50.000 caracteres)', async () => {
            await expect(modeloOferta.actualizarDescripcionManual(1, 'Muy corta'))
                .rejects.toThrow('La descripción debe tener entre 20 y 50.000 caracteres.');

            await expect(modeloOferta.actualizarDescripcionManual(1, null))
                .rejects.toThrow('La descripción debe ser un texto.');

            const textoGigante = 'x'.repeat(50001);
            await expect(modeloOferta.actualizarDescripcionManual(1, textoGigante))
                .rejects.toThrow('La descripción debe tener entre 20 y 50.000 caracteres.');
        });

        test('ejecuta UPDATE con COALESCE, origen manual, completitud completa y reevaluación solicitada', async () => {
            const nuevaDesc = 'Esta es una descripción completa pegada manualmente por el usuario para reevaluar.';
            const filaRetornada = {
                id: 42,
                titulo: 'Frontend Developer',
                empresa: 'Empresa SA',
                descripcion: nuevaDesc,
                descripcion_original: 'Descripción breve de tarjeta',
                origen_descripcion: 'manual',
                descripcion_completitud: 'completa',
                estado_evaluacion: 'pendiente',
                evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA',
                estado_postulacion: 'cv_enviado',
            };

            pool.query.mockResolvedValueOnce({ rows: [filaRetornada] });

            const resultado = await modeloOferta.actualizarDescripcionManual(42, nuevaDesc);

            expect(pool.query).toHaveBeenCalledTimes(1);
            const [sqlEjecutado, parametros] = pool.query.mock.calls[0];

            expect(sqlEjecutado).toContain('UPDATE ofertas');
            expect(sqlEjecutado).toContain('descripcion_original = COALESCE(descripcion_original, descripcion)');
            expect(sqlEjecutado).toContain("origen_descripcion = 'manual'");
            expect(sqlEjecutado).toContain("descripcion_completitud = 'completa'");
            expect(sqlEjecutado).toContain("descripcion_modificada_en = date_trunc('milliseconds', NOW())");
            expect(sqlEjecutado).toContain("estado_evaluacion = 'pendiente'");
            expect(sqlEjecutado).toContain("evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA'");
            expect(sqlEjecutado).toContain('WHERE id = $2');

            // Garantía de no mutar campos inmutables en el UPDATE
            expect(sqlEjecutado).not.toContain('estado_postulacion =');
            expect(sqlEjecutado).not.toContain('notas =');
            expect(sqlEjecutado).not.toContain('titulo =');
            expect(sqlEjecutado).not.toContain('empresa =');
            expect(sqlEjecutado).not.toContain('url =');
            expect(sqlEjecutado).not.toContain('fecha_publicacion =');
            expect(sqlEjecutado).not.toContain('fecha_extraccion =');

            expect(parametros).toEqual([nuevaDesc.trim(), 42]);
            expect(resultado).toEqual(filaRetornada);
        });

        test('retorna null si la oferta no existe en la base de datos', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const res = await modeloOferta.actualizarDescripcionManual(999, 'Descripción con suficiente longitud pero oferta inexistente.');
            expect(res).toBeNull();
        });
    });

    describe('Preservación del estado de postulación tras edición manual', () => {
        test('mantiene estado_postulacion intacto en la entidad', async () => {
            const ofertaConPostulacion = {
                id: 10,
                titulo: 'React Trainee',
                descripcion: 'Nueva descripción detallada con más de veinte caracteres requeridos.',
                descripcion_original: 'Descripción previa',
                origen_descripcion: 'manual',
                descripcion_completitud: 'completa',
                estado_evaluacion: 'pendiente',
                evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA',
                estado_postulacion: 'cv_enviado',
            };

            pool.query.mockResolvedValueOnce({ rows: [ofertaConPostulacion] });

            const actualizada = await modeloOferta.actualizarDescripcionManual(
                10,
                'Nueva descripción detallada con más de veinte caracteres requeridos.'
            );

            expect(actualizada.estado_postulacion).toBe('cv_enviado');
        });
    });

    describe('Invalidación del hash de oferta ante mutación de descripción', () => {
        test('genera hash_oferta distinto cuando la descripción cambia', () => {
            const preferencias = {
                nombre: 'Marcos Ezequiel Toledo',
                stack_tecnologico: ['JavaScript', 'React', 'TypeScript'],
            };

            const ofertaTarjeta = {
                id: 15,
                titulo: 'Desarrollador Frontend',
                empresa: 'Globant',
                descripcion: 'Descripción corta de tarjeta',
                modalidad: 'remoto',
                plataforma: 'bumeran',
                descripcion_completitud: 'parcial',
            };

            const ofertaManual = {
                ...ofertaTarjeta,
                descripcion: 'Descripción completa pegada manualmente con todos los requisitos y tecnologías.',
                descripcion_completitud: 'completa',
                origen_descripcion: 'manual',
            };

            const identidad1 = construirIdentidadEvaluacion(ofertaTarjeta, preferencias);
            const identidad2 = construirIdentidadEvaluacion(ofertaManual, preferencias);

            expect(identidad1.hash_oferta).toBeDefined();
            expect(identidad2.hash_oferta).toBeDefined();
            expect(identidad1.hash_oferta).not.toBe(identidad2.hash_oferta);
        });
    });

    describe('modeloOferta.actualizarEvaluacion con explicacion_evaluacion', () => {
        test('persiste explicacion_evaluacion como $11::jsonb en el UPDATE', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 7, estado_evaluacion: 'aprobada' }] });

            const explicacion = {
                cumplidos: [{ requisito: 'React', evidencia_oferta: 'React 18', explicacion: 'Coincide' }],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            };

            await modeloOferta.actualizarEvaluacion(
                7,
                'aprobada',
                'Coincide con perfil',
                85,
                null,
                { detectada: true, puntaje: 4, evidencias: ['Copilot'], version: 'v1' },
                'firma-abc',
                explicacion
            );

            expect(pool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = pool.query.mock.calls[0];

            expect(sql).toContain('explicacion_evaluacion = $11::jsonb');
            expect(params[10]).toBe(JSON.stringify(explicacion));
        });

        test('pasa null como $11 si explicacionEvaluacion es null', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 8 }] });

            await modeloOferta.actualizarEvaluacion(
                8,
                'rechazada',
                'No coincide',
                20,
                null,
                null,
                'firma-xyz',
                null
            );

            const [, params] = pool.query.mock.calls[0];
            expect(params[10]).toBeNull();
        });
    });

    describe('CAS con descripcion_modificada_en en modeloOferta (B-08)', () => {
        test('actualizarEvaluacion incluye condiciones CAS para descripcion y descripcion_modificada_en', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 99, estado_evaluacion: 'aprobada' }] });

            const fechaEsperada = '2026-04-10T14:30:00.000Z';
            const descEsperada = 'Texto idéntico de la descripción';

            await modeloOferta.actualizarEvaluacion(
                99,
                'aprobada',
                'Coincide',
                90,
                null,
                null,
                'firma-123',
                null,
                descEsperada,
                fechaEsperada
            );

            expect(pool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = pool.query.mock.calls[0];

            expect(sql).toContain("WHERE id = $4 AND ($13::boolean = false OR descripcion IS NOT DISTINCT FROM $12) AND ($15::boolean = false OR date_trunc('milliseconds', descripcion_modificada_en) IS NOT DISTINCT FROM date_trunc('milliseconds', $14::timestamp))");
            expect(params[11]).toBe(descEsperada);
            expect(params[12]).toBe(true);
            expect(params[13]).toBe(fechaEsperada);
            expect(params[14]).toBe(true);
        });

        test('actualizarEvaluacion desactiva CAS si descripcionEsperada y fechaModificacionEsperada son undefined', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 100, estado_evaluacion: 'rechazada' }] });

            await modeloOferta.actualizarEvaluacion(
                100,
                'rechazada',
                'No coincide',
                20
            );

            expect(pool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = pool.query.mock.calls[0];

            expect(sql).toContain("WHERE id = $4 AND ($13::boolean = false OR descripcion IS NOT DISTINCT FROM $12) AND ($15::boolean = false OR date_trunc('milliseconds', descripcion_modificada_en) IS NOT DISTINCT FROM date_trunc('milliseconds', $14::timestamp))");
            expect(params[11]).toBeNull();
            expect(params[12]).toBe(false);
            expect(params[13]).toBeNull();
            expect(params[14]).toBe(false);
        });

        test('registrarErrorEvaluacion incluye condiciones CAS para descripcion y descripcion_modificada_en', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 101 }] });

            const fechaEsperada = '2026-04-10T14:30:00.000Z';
            const descEsperada = 'Texto de la descripción para error';

            await modeloOferta.registrarErrorEvaluacion(
                101,
                'Error de red con IA',
                descEsperada,
                fechaEsperada
            );

            expect(pool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = pool.query.mock.calls[0];

            expect(sql).toContain("WHERE id = $2 AND ($4::boolean = false OR descripcion IS NOT DISTINCT FROM $3) AND ($6::boolean = false OR date_trunc('milliseconds', descripcion_modificada_en) IS NOT DISTINCT FROM date_trunc('milliseconds', $5::timestamp))");
            expect(params[0]).toBe('Error de red con IA');
            expect(params[1]).toBe(101);
            expect(params[2]).toBe(descEsperada);
            expect(params[3]).toBe(true);
            expect(params[4]).toBe(fechaEsperada);
            expect(params[5]).toBe(true);
        });
    });

    describe('Integración con evaluarOfertasPendientes', () => {
        test('pasa resultado.explicacion a actualizarEvaluacion y activa forzar ante REEVALUACION_SOLICITADA', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                nombre: 'Marcos',
                stack_tecnologico: ['React', 'TypeScript'],
                zonas_preferidas: ['Buenos Aires'],
            });

            const ofertaParaEvaluar = {
                id: 25,
                titulo: 'Desarrollador React Junior',
                descripcion: 'Buscamos desarrollador React y TypeScript para sumar al equipo.',
                modalidad: 'remoto',
                plataforma: 'bumeran',
                estado_evaluacion: 'pendiente',
                evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA',
                fecha_extraccion: new Date().toISOString(),
            };

            const respuestaIa = JSON.stringify({
                match: true,
                porcentaje: 88,
                razon: 'Excelente match con React y TypeScript.',
                explicacion: {
                    cumplidos: [{ requisito: 'React', explicacion: 'Mencionado en oferta' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [],
                },
            });

            consultarDeepSeek.mockResolvedValueOnce(respuestaIa);

            // Mock de las queries del loop de evaluarOfertasPendientes
            pool.query.mockImplementation(async (sql, params) => {
                if (sql.includes('UPDATE ofertas') && sql.includes('explicacion_evaluacion')) {
                    return { rows: [{ id: 25, estado_evaluacion: 'aprobada' }] };
                }
                return { rows: [] };
            });

            const resumen = await evaluarOfertasPendientes([ofertaParaEvaluar]);

            expect(resumen.total).toBe(1);
            expect(resumen.aprobadas).toBe(1);

            // Verifico que se llamó al UPDATE de ofertas con la explicación estructurada
            const llamadaUpdateOferta = pool.query.mock.calls.find(
                ([sql]) => sql.includes('UPDATE ofertas') && sql.includes('explicacion_evaluacion = $11::jsonb')
            );

            expect(llamadaUpdateOferta).toBeDefined();
            const paramsUpdate = llamadaUpdateOferta[1];
            expect(paramsUpdate[0]).toBe('aprobada'); // estado
            expect(paramsUpdate[10]).not.toBeNull();  // explicacion_evaluacion JSONB

            const explicacionPersistida = JSON.parse(paramsUpdate[10]);
            expect(explicacionPersistida.cumplidos).toBeDefined();
            expect(explicacionPersistida.cumplidos.length).toBeGreaterThan(0);
        });

        test('persiste estado pendiente con evaluacion_error_mensaje y no guarda en caché si la respuesta es inconsistente (B-02)', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                nombre: 'Marcos',
                stack_tecnologico: ['React'],
                zonas_preferidas: [],
            });

            const ofertaInconsistente = {
                id: 26,
                titulo: 'Desarrollador React Junior',
                descripcion: 'Puesto junior React con buen ambiente laboral.',
                modalidad: 'remoto',
                plataforma: 'linkedin',
                estado_evaluacion: 'pendiente',
                fecha_extraccion: new Date().toISOString(),
            };

            // Respuesta inconsistente: match true con score bajo sin justificación
            const respuestaInconsistente = JSON.stringify({
                match: true,
                porcentaje: 20,
                razon: 'Aprobada por la IA a pesar del score bajo',
                explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
            });

            consultarDeepSeek.mockResolvedValueOnce(respuestaInconsistente);

            pool.query.mockImplementation(async (sql, params) => {
                if (sql.includes('UPDATE ofertas') && sql.includes('explicacion_evaluacion')) {
                    return { rows: [{ id: 26, estado_evaluacion: 'pendiente' }] };
                }
                return { rows: [] };
            });

            const resumen = await evaluarOfertasPendientes([ofertaInconsistente]);

            expect(resumen.errores).toBe(1);
            expect(resumen.aprobadas).toBe(0);

            // Verifico que se llamó al UPDATE con estado pendiente y porcentaje null
            const llamadaUpdateOferta = pool.query.mock.calls.find(
                ([sql]) => sql.includes('UPDATE ofertas') && sql.includes('explicacion_evaluacion = $11::jsonb')
            );

            expect(llamadaUpdateOferta).toBeDefined();
            const paramsUpdate = llamadaUpdateOferta[1];
            expect(paramsUpdate[0]).toBe('pendiente'); // estado_evaluacion
            expect(paramsUpdate[2]).toBeNull();        // porcentaje_match null
            expect(paramsUpdate[4]).toContain('Inconsistencia detectada'); // evaluacion_error_mensaje
            expect(paramsUpdate[9]).toBeNull();        // firma null

            // Verifico que NUNCA se guardó en caché
            expect(evaluacionCache.guardarCache).not.toHaveBeenCalled();
        });

        test('no confirma en caché ni suma aprobadas si la oferta fue modificada concurrentemente (B-06, B-07)', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                nombre: 'Marcos',
                stack_tecnologico: ['React'],
                zonas_preferidas: [],
            });

            const oferta = {
                id: 27,
                titulo: 'Desarrollador React',
                descripcion: 'Descripción original al momento de arrancar la llamada a DeepSeek.',
                modalidad: 'remoto',
                plataforma: 'linkedin',
                estado_evaluacion: 'pendiente',
                fecha_extraccion: new Date().toISOString(),
            };

            const respuestaOk = JSON.stringify({
                match: true,
                porcentaje: 90,
                razon: 'Compatible',
                explicacion: { cumplidos: [{ requisito: 'React', tipo: 'obligatorio', evidencia_oferta: 'React' }], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
            });

            consultarDeepSeek.mockResolvedValueOnce(respuestaOk);

            // Simulamos que la descripción cambió concurrentemente y el CAS no encontró filas (rows: [])
            pool.query.mockImplementation(async (sql, params) => {
                if (sql.includes('UPDATE ofertas')) {
                    return { rows: [] }; // 0 filas actualizadas por desajuste de descripción
                }
                return { rows: [] };
            });

            const resumen = await evaluarOfertasPendientes([oferta]);

            // Verificaciones B-06 y B-07:
            // 1. Nunca se confirma en caché
            expect(evaluacionCache.guardarCache).not.toHaveBeenCalled();
            // 2. No se contabiliza como aprobada ni rechazada
            expect(resumen.aprobadas).toBe(0);
            expect(resumen.rechazadas).toBe(0);
            // 3. Se registra como supersedida por concurrencia
            expect(resumen.supersedidas).toBe(1);
            expect(resumen.detalle[0].estado).toBe('supersedida_concurrencia');
            expect(resumen.detalle[0].supersedida).toBe(true);
        });

        test('carrera CAS cuando la descripción original era null y el usuario la completó concurrentemente (B-06)', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                nombre: 'Marcos',
                stack_tecnologico: ['Node'],
                zonas_preferidas: [],
            });

            const oferta = {
                id: 28,
                titulo: 'Desarrollador Backend',
                descripcion: null, // Originalmente sin descripción
                modalidad: 'remoto',
                plataforma: 'computrabajo',
                estado_evaluacion: 'pendiente',
                fecha_extraccion: new Date().toISOString(),
            };

            consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({
                match: true,
                porcentaje: 85,
                razon: 'Compatible',
                explicacion: { cumplidos: [{ requisito: 'Node', tipo: 'obligatorio', evidencia_oferta: 'Node' }], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
            }));

            // El usuario pegó texto nuevo mientras DeepSeek evaluaba: el CAS con descripcion IS NOT DISTINCT FROM NULL retorna 0 filas
            pool.query.mockImplementation(async (sql, params) => {
                if (sql.includes('UPDATE ofertas')) {
                    return { rows: [] };
                }
                return { rows: [] };
            });

            const resumen = await evaluarOfertasPendientes([oferta]);

            expect(evaluacionCache.guardarCache).not.toHaveBeenCalled();
            expect(resumen.aprobadas).toBe(0);
            expect(resumen.supersedidas).toBe(1);
            expect(resumen.detalle[0].estado).toBe('supersedida_concurrencia');
        });

        test('carrera CAS en rama sin desglose estructurado (B-06, B-07)', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                nombre: 'Marcos',
                stack_tecnologico: ['Angular'],
                zonas_preferidas: [],
            });

            const oferta = {
                id: 29,
                titulo: 'Frontend Angular',
                descripcion: 'Texto previo',
                modalidad: 'remoto',
                plataforma: 'linkedin',
                estado_evaluacion: 'pendiente',
                fecha_extraccion: new Date().toISOString(),
            };

            // Respuesta legacy o mínima sin objeto explicacion
            consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({
                match: true,
                porcentaje: 80,
                razon: 'Compatible sin desglose',
            }));

            pool.query.mockImplementation(async (sql, params) => {
                if (sql.includes('UPDATE ofertas')) {
                    return { rows: [] };
                }
                return { rows: [] };
            });

            const resumen = await evaluarOfertasPendientes([oferta]);

            expect(evaluacionCache.guardarCache).not.toHaveBeenCalled();
            expect(resumen.aprobadas).toBe(0);
            expect(resumen.supersedidas).toBe(1);
            expect(resumen.detalle[0].estado).toBe('supersedida_concurrencia');
        });

        test('flujo concurrente con PATCH de texto idéntico mientras IA evalúa descarta actualización de IA como supersedida (B-08, O-02)', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue({
                nombre: 'Marcos',
                stack_tecnologico: ['Node', 'React'],
                zonas_preferidas: [],
            });

            const fechaOriginal = '2026-04-10T10:00:00.000Z';
            const textoOferta = 'Buscamos desarrollador Fullstack con Node y React para sumarse al equipo.';

            const oferta = {
                id: 30,
                titulo: 'Fullstack Dev',
                descripcion: textoOferta,
                descripcion_modificada_en: fechaOriginal,
                modalidad: 'remoto',
                plataforma: 'computrabajo',
                estado_evaluacion: 'pendiente',
                fecha_extraccion: new Date().toISOString(),
            };

            consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({
                match: true,
                porcentaje: 85,
                razon: 'Compatible',
                explicacion: {
                    cumplidos: [{ requisito: 'Node', tipo: 'obligatorio', evidencia_oferta: 'Node' }],
                    no_cumplidos: [],
                    por_confirmar: [],
                    exclusiones: [],
                },
            }));

            // Mientras la IA evalúa, el usuario hace PATCH con texto idéntico.
            // En PostgreSQL, el CAS ejecutado por evaluarOfertasPendientes envía el snapshot inicial (fechaOriginal).
            // Dado que en BD descripcion_modificada_en fue actualizado a un timestamp más nuevo,
            // el WHERE con descripcion_modificada_en IS NOT DISTINCT FROM $14 no matchea y retorna 0 filas.
            pool.query.mockImplementation(async (sql, params) => {
                if (sql.includes('UPDATE ofertas') && sql.includes('explicacion_evaluacion')) {
                    // Validamos que evaluarOfertasPendientes haya pasado descripcion_modificada_en
                    expect(params[13]).toBe(fechaOriginal);
                    expect(params[14]).toBe(true);
                    return { rows: [] };
                }
                return { rows: [] };
            });

            const resumen = await evaluarOfertasPendientes([oferta]);
            const progreso = obtenerProgresoEvaluacion();

            expect(evaluacionCache.guardarCache).not.toHaveBeenCalled();
            expect(resumen.aprobadas).toBe(0);
            expect(resumen.rechazadas).toBe(0);
            expect(resumen.supersedidas).toBe(1);
            expect(progreso.supersedidas).toBe(1);
            expect(resumen.detalle[0].estado).toBe('supersedida_concurrencia');
            expect(resumen.detalle[0].supersedida).toBe(true);
            expect(resumen.detalle[0].razon).toContain('Evaluación descartada porque la oferta fue modificada concurrentemente');
        });
    });

    describe('Normalización y defaults en Bumeran y modeloOferta.crearOferta', () => {
        test('normalizarOfertaBumeran asigna origen tarjeta y completitud parcial o ausente', () => {
            const itemConDesc = {
                url: 'https://bumeran.com.ar/empleos/123',
                titulo: 'Desarrollador Node',
                descripcion: 'Requisitos de la oferta',
                modalidad: 'Remoto',
            };

            const normalizadaConDesc = normalizarOfertaBumeran(itemConDesc);
            expect(normalizadaConDesc.origen_descripcion).toBe('tarjeta');
            expect(normalizadaConDesc.descripcion_completitud).toBe('parcial');

            const itemSinDesc = {
                url: 'https://bumeran.com.ar/empleos/124',
                titulo: 'Desarrollador Node',
                descripcion: null,
                modalidad: 'Remoto',
            };

            const normalizadaSinDesc = normalizarOfertaBumeran(itemSinDesc);
            expect(normalizadaSinDesc.origen_descripcion).toBe('tarjeta');
            expect(normalizadaSinDesc.descripcion_completitud).toBe('ausente');
        });

        test('crearOferta incluye origen_descripcion y descripcion_completitud con defaults', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 50 }] });

            await modeloOferta.crearOferta({
                titulo: 'Java Trainee',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'presencial',
                descripcion: 'Trabajo en Java',
                url: 'https://linkedin.com/jobs/1',
                plataforma: 'linkedin',
                nivel_requerido: 'trainee',
            });

            expect(pool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = pool.query.mock.calls[0];

            expect(sql).toContain('origen_descripcion, descripcion_completitud');
            expect(params[13]).toBe('scraper'); // default para plataformas no bumeran
            expect(params[14]).toBe('desconocida'); // default para descripcion presente no bumeran
        });
    });
});
