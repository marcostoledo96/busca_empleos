// Tests de recuperación de lotes interrumpidos, cancelación segura y reintento de errores.
// Verifico que el servicio maneje correctamente reinicios del servidor, lotes huérfanos
// y la recuperación de ofertas con fallos técnicos previos.

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn(), DEEPSEEK_MODELO: 'deepseek-v4-flash' }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));

const pool = require('../../src/config/base-datos');
const proveedor = require('../../src/config/deepseek');
const preferencias = require('../../src/modelos/preferencia');
const modeloOferta = require('../../src/modelos/oferta');
const servicio = require('../../src/servicios/servicio-evaluacion');
const controlador = require('../../src/controladores/controlador-evaluacion');
const evaluacionLote = require('../../src/modelos/evaluacion-lote');

let filasOfertas, loteDb, llamadasFinalizarLote, propietarioLock;

const crearRespuestaMock = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const esperarMicrotareas = () => new Promise((resolve) => setImmediate(resolve));

describe('Servicio de evaluación — Recuperación de lotes interrumpidos y reintento', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        propietarioLock = null;
        llamadasFinalizarLote = [];
        loteDb = null;
        servicio._resetearEstadoInterno();

        preferencias.obtenerPreferencias.mockResolvedValue({
            nombre: 'Marcos Toledo',
            stack_tecnologico: ['Node.js', 'PostgreSQL'],
            zonas_preferidas: [],
        });

        proveedor.consultarDeepSeek.mockResolvedValue(
            '{"match":true,"porcentaje":92,"razon":"Excelente match técnico"}'
        );

        pool.connect.mockImplementation(async () => {
            const cliente = {
                release: jest.fn(),
                query: jest.fn(async (sql) => {
                    if (sql.includes('pg_try_advisory_lock')) {
                        const ok = propietarioLock === null;
                        if (ok) propietarioLock = cliente;
                        return { rows: [{ ok }] };
                    }
                    if (propietarioLock === cliente) {
                        propietarioLock = null;
                    }
                    return { rows: [] };
                }),
            };
            return cliente;
        });

        pool.query.mockImplementation(async (sql, valores = []) => {
            if (sql.includes('SELECT * FROM evaluacion_lotes')) {
                return { rows: loteDb ? [structuredClone(loteDb)] : [] };
            }
            if (sql.includes('INSERT INTO evaluacion_lotes')) {
                loteDb = {
                    id: 10,
                    estado: 'activo',
                    total: valores[0],
                    evaluadas: 0,
                    aprobadas: 0,
                    rechazadas: 0,
                    errores: 0,
                    porcentaje: 0,
                };
                return { rows: [structuredClone(loteDb)] };
            }
            if (sql.includes('UPDATE evaluacion_lotes')) {
                if (sql.includes('finalizado_en')) {
                    llamadasFinalizarLote.push({ estado: valores[0], id: valores[1] });
                }
                for (const [, campo, parametro] of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                    if (campo !== 'id' && loteDb) {
                        loteDb[campo] = valores[Number(parametro) - 1];
                    }
                }
                return { rows: loteDb ? [structuredClone(loteDb)] : [] };
            }
            if (sql.includes('SELECT * FROM ofertas WHERE estado_evaluacion = \'pendiente\'')) {
                return { rows: structuredClone(filasOfertas.filter((o) => o.estado_evaluacion === 'pendiente')) };
            }
            if (sql.includes('SELECT * FROM ofertas') && sql.includes('evaluacion_error_mensaje IS NOT NULL')) {
                return {
                    rows: structuredClone(
                        filasOfertas.filter(
                            (o) => o.evaluacion_error_mensaje !== null && o.evaluacion_error_mensaje !== 'REEVALUACION_SOLICITADA'
                        )
                    ),
                };
            }
            if (sql.includes('SELECT * FROM ofertas WHERE id = ANY')) {
                return { rows: structuredClone(filasOfertas.filter((o) => valores[0].includes(o.id))) };
            }
            if (sql.includes('UPDATE ofertas SET evaluacion_error_mensaje = $1')) {
                const idBuscado = valores[1];
                const fila = filasOfertas.find((o) => o.id === idBuscado);
                if (fila) {
                    fila.evaluacion_error_mensaje = valores[0];
                }
                return { rows: fila ? [structuredClone(fila)] : [] };
            }
            if (sql.includes('UPDATE ofertas') && sql.includes('estado_evaluacion = $1')) {
                const idBuscado = valores[3];
                const fila = filasOfertas.find((o) => o.id === idBuscado);
                if (fila) {
                    fila.estado_evaluacion = valores[0];
                    fila.razon_evaluacion = valores[1];
                    fila.porcentaje_match = valores[2];
                    fila.evaluacion_error_mensaje = valores[4];
                    fila.fecha_evaluacion = '2026-10-15T00:00:00.000Z';
                }
                return { rows: fila ? [structuredClone(fila)] : [] };
            }
            if (sql.includes('SELECT resultado FROM evaluaciones_cache')) {
                return { rows: [] };
            }
            if (sql.includes('INSERT INTO evaluaciones_cache')) {
                return { rows: [] };
            }

            return { rows: [] };
        });

        filasOfertas = [
            {
                id: 1,
                titulo: 'Desarrollador Node.js Junior',
                descripcion: 'Buscamos programador backend con PostgreSQL y Node.js.',
                modalidad: 'remoto',
                fecha_extraccion: new Date().toISOString(),
                estado_evaluacion: 'pendiente',
                razon_evaluacion: null,
                porcentaje_match: null,
                evaluacion_error_mensaje: null,
                fecha_evaluacion: null,
                firma_criterios_evaluacion: null,
            },
            {
                id: 2,
                titulo: 'Backend Developer Express',
                descripcion: 'Desarrollo de microservicios con Express.',
                modalidad: 'remoto',
                fecha_extraccion: new Date().toISOString(),
                estado_evaluacion: 'pendiente',
                razon_evaluacion: null,
                porcentaje_match: null,
                evaluacion_error_mensaje: null,
                fecha_evaluacion: null,
                firma_criterios_evaluacion: null,
            },
        ];
    });

    test('rehidratarProgreso finaliza lote interrumpido como error y limpia el estado en memoria', async () => {
        loteDb = {
            id: 42,
            estado: 'activo',
            total: 10,
            evaluadas: 4,
            aprobadas: 3,
            rechazadas: 1,
            errores: 0,
            porcentaje: 40,
        };

        await servicio.rehidratarProgreso();

        const progreso = servicio.obtenerProgresoEvaluacion();
        expect(progreso.activo).toBe(false);
        expect(progreso.estado).toBe('error');
        expect(progreso.mensaje_error).toContain('reinicio del servidor');
        expect(progreso.total).toBe(10);
        expect(progreso.evaluadas).toBe(4);
        expect(progreso.aprobadas).toBe(3);
        expect(progreso.rechazadas).toBe(1);
        expect(progreso.porcentaje).toBe(40);

        // Verifico que en la BD se marcó el lote como 'error'
        expect(llamadasFinalizarLote).toEqual([{ estado: 'error', id: 42 }]);
        expect(loteDb.estado).toBe('error');
    });

    test('tras rehidratar un lote interrumpido, se puede iniciar una nueva evaluación sin recibir 409', async () => {
        loteDb = {
            id: 50,
            estado: 'activo',
            total: 5,
            evaluadas: 2,
            aprobadas: 1,
            rechazadas: 1,
            errores: 0,
            porcentaje: 40,
        };

        await servicio.rehidratarProgreso();
        expect(servicio.obtenerProgresoEvaluacion().activo).toBe(false);

        const res = crearRespuestaMock();
        await controlador.ejecutarEvaluacion({ body: {} }, res);

        expect(res.status).not.toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                exito: true,
                en_curso: true,
                mensaje: expect.stringContaining('iniciada'),
            })
        );

        // Espero que termine la evaluación en background
        for (let i = 0; i < 50 && propietarioLock; i++) {
            await esperarMicrotareas();
        }
    });

    test('rehidratarProgreso es completamente idempotente si se invoca dos veces consecutivas', async () => {
        loteDb = {
            id: 77,
            estado: 'activo',
            total: 8,
            evaluadas: 3,
            aprobadas: 2,
            rechazadas: 1,
            errores: 0,
            porcentaje: 38,
        };

        await servicio.rehidratarProgreso();
        const llamadasIniciales = llamadasFinalizarLote.length;
        expect(llamadasIniciales).toBe(1);

        // Segunda llamada consecutiva
        await servicio.rehidratarProgreso();
        expect(llamadasFinalizarLote.length).toBe(1); // No vuelve a llamar finalizarLote
        const progreso = servicio.obtenerProgresoEvaluacion();
        expect(progreso.activo).toBe(false);
        expect(progreso.estado).toBe('error');
        expect(progreso.mensaje_error).toContain('reinicio del servidor');
    });

    test('si finalizarLote retorna null en UPDATE, no fija _ultimoLoteInterrumpidoId y permite reintentar la persistencia en una segunda llamada', async () => {
        loteDb = {
            id: 99,
            estado: 'activo',
            total: 10,
            evaluadas: 2,
            aprobadas: 1,
            rechazadas: 1,
            errores: 0,
            porcentaje: 20,
        };

        const espiaFinalizar = jest.spyOn(evaluacionLote, 'finalizarLote').mockResolvedValueOnce(null);

        await servicio.rehidratarProgreso();

        // Verifico que _ultimoLoteInterrumpidoId no se fijó y el lote en BD no fue mutado a error
        expect(servicio._obtenerEstadoInterno().ultimoLoteInterrumpidoId).toBeNull();
        expect(loteDb.estado).toBe('activo');

        // En la segunda llamada simulada, el UPDATE a BD es exitoso
        espiaFinalizar.mockRestore();
        await servicio.rehidratarProgreso();

        expect(servicio._obtenerEstadoInterno().ultimoLoteInterrumpidoId).toBe(99);
        expect(loteDb.estado).toBe('error');
        const progreso = servicio.obtenerProgresoEvaluacion();
        expect(progreso.estado).toBe('error');
        expect(progreso.activo).toBe(false);
    });

    test('si finalizarLote arroja excepción por error de red, no fija _ultimoLoteInterrumpidoId y permite reintento posterior exitoso', async () => {
        loteDb = {
            id: 105,
            estado: 'activo',
            total: 15,
            evaluadas: 3,
            aprobadas: 2,
            rechazadas: 1,
            errores: 0,
            porcentaje: 20,
        };

        const espiaFinalizar = jest.spyOn(evaluacionLote, 'finalizarLote').mockRejectedValueOnce(
            new Error('Fallo transitorio de conexión a PostgreSQL')
        );

        await servicio.rehidratarProgreso();

        expect(servicio._obtenerEstadoInterno().ultimoLoteInterrumpidoId).toBeNull();
        expect(loteDb.estado).toBe('activo');

        espiaFinalizar.mockRestore();
        await servicio.rehidratarProgreso();

        expect(servicio._obtenerEstadoInterno().ultimoLoteInterrumpidoId).toBe(105);
        expect(loteDb.estado).toBe('error');
    });

    test('si _workerActivo es true, rehidratarProgreso no altera el lote activo ni lo marca como error', async () => {
        loteDb = {
            id: 110,
            estado: 'activo',
            total: 25,
            evaluadas: 5,
            aprobadas: 4,
            rechazadas: 1,
            errores: 0,
            porcentaje: 20,
        };

        servicio._establecerWorkerActivo(true);

        await servicio.rehidratarProgreso();

        // Verifico que no se haya llamado a finalizarLote ni alterado loteDb ni _ultimoLoteInterrumpidoId
        expect(llamadasFinalizarLote).toHaveLength(0);
        expect(loteDb.estado).toBe('activo');
        expect(servicio._obtenerEstadoInterno().ultimoLoteInterrumpidoId).toBeNull();

        servicio._establecerWorkerActivo(false);
    });

    test('cancelarEvaluacionPendiente sin worker activo limpia el estado y finaliza el lote huérfano en BD', async () => {
        loteDb = {
            id: 88,
            estado: 'activo',
            total: 6,
            evaluadas: 1,
            aprobadas: 1,
            rechazadas: 0,
            errores: 0,
            porcentaje: 17,
        };

        const resultado = await servicio.cancelarEvaluacionPendiente();
        expect(resultado.activa).toBe(false);
        expect(resultado.cancelada).toBe(true);

        const progreso = servicio.obtenerProgresoEvaluacion();
        expect(progreso.activo).toBe(false);
        expect(progreso.estado).toBe('cancelado');
        expect(progreso.mensaje_error).toBe('Evaluación cancelada.');

        expect(llamadasFinalizarLote).toContainEqual({ estado: 'cancelado', id: 88 });
    });

    test('reintentarErroresEvaluacion sin ofertas con error retorna de inmediato con total 0', async () => {
        filasOfertas.forEach((o) => {
            o.evaluacion_error_mensaje = null;
        });

        const resultado = await servicio.reintentarErroresEvaluacion();
        expect(resultado).toEqual({
            exito: true,
            total: 0,
            mensaje: 'No hay ofertas con errores de evaluación para reintentar.',
        });
        expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    });

    test('reintentarErroresEvaluacion procesa únicamente ofertas con error y limpia evaluacion_error_mensaje al tener éxito', async () => {
        filasOfertas = [
            {
                id: 101,
                titulo: 'Oferta con timeout previo',
                descripcion: 'Backend Developer con PostgreSQL.',
                modalidad: 'remoto',
                fecha_extraccion: new Date().toISOString(),
                estado_evaluacion: 'pendiente',
                razon_evaluacion: 'Timeout en DeepSeek',
                evaluacion_error_mensaje: 'Timeout en DeepSeek: ETIMEDOUT',
                fecha_evaluacion: null,
            },
            {
                id: 102,
                titulo: 'Oferta aprobada que falló en reintento previo',
                descripcion: 'Desarrollador backend con Node.js y PostgreSQL.',
                modalidad: 'remoto',
                fecha_extraccion: new Date().toISOString(),
                estado_evaluacion: 'aprobada',
                razon_evaluacion: 'Cumple stack completo',
                porcentaje_match: 90,
                evaluacion_error_mensaje: 'Error de red transitorio',
                fecha_evaluacion: '2026-09-01T00:00:00.000Z',
            },
        ];

        proveedor.consultarDeepSeek.mockResolvedValue(
            '{"match":true,"porcentaje":88,"razon":"Candidato cumple requerimientos técnicos"}'
        );

        const resultado = await servicio.reintentarErroresEvaluacion();
        expect(resultado.exito).toBe(true);
        expect(resultado.en_curso).toBe(true);
        expect(resultado.total).toBe(2);

        // Dejo correr el worker en background
        for (let i = 0; i < 50; i++) {
            await esperarMicrotareas();
            if (!servicio.obtenerProgresoEvaluacion().activo) break;
        }

        expect(servicio.obtenerProgresoEvaluacion().activo).toBe(false);
        // Ambas ofertas deben tener evaluacion_error_mensaje limpiado a null
        expect(filasOfertas[0].evaluacion_error_mensaje).toBeNull();
        expect(filasOfertas[0].estado_evaluacion).toBe('aprobada');
        expect(filasOfertas[1].evaluacion_error_mensaje).toBeNull();
        expect(filasOfertas[1].estado_evaluacion).toBe('aprobada');
    });

    test('reintentarErroresEvaluacion conserva el veredicto previo y actualiza mensaje si vuelve a fallar', async () => {
        filasOfertas = [
            {
                id: 201,
                titulo: 'Oferta previamente aprobada que vuelve a fallar',
                descripcion: 'Desarrollo en TypeScript y PostgreSQL.',
                modalidad: 'remoto',
                fecha_extraccion: new Date().toISOString(),
                estado_evaluacion: 'aprobada',
                razon_evaluacion: 'Perfil adecuado',
                porcentaje_match: 85,
                evaluacion_error_mensaje: 'Fallo anterior',
                fecha_evaluacion: '2026-09-10T00:00:00.000Z',
            },
            {
                id: 202,
                titulo: 'Oferta pendiente que vuelve a fallar',
                descripcion: 'Backend Junior Node.',
                modalidad: 'remoto',
                fecha_extraccion: new Date().toISOString(),
                estado_evaluacion: 'pendiente',
                razon_evaluacion: null,
                porcentaje_match: null,
                evaluacion_error_mensaje: 'Fallo anterior',
                fecha_evaluacion: null,
            },
        ];

        proveedor.consultarDeepSeek.mockRejectedValue(new Error('Nuevo fallo de conexión HTTP 503'));

        const resultado = await servicio.reintentarErroresEvaluacion();
        expect(resultado.exito).toBe(true);
        expect(resultado.total).toBe(2);

        for (let i = 0; i < 50; i++) {
            await esperarMicrotareas();
            if (!servicio.obtenerProgresoEvaluacion().activo) break;
        }

        // La aprobada debe seguir siendo 'aprobada', con su veredicto conservado y nuevo mensaje
        expect(filasOfertas[0].estado_evaluacion).toBe('aprobada');
        expect(filasOfertas[0].evaluacion_error_mensaje).toContain('Nuevo fallo de conexión HTTP 503');

        // La pendiente debe seguir 'pendiente' con el nuevo mensaje
        expect(filasOfertas[1].estado_evaluacion).toBe('pendiente');
        expect(filasOfertas[1].evaluacion_error_mensaje).toContain('Nuevo fallo de conexión HTTP 503');
    });
});
