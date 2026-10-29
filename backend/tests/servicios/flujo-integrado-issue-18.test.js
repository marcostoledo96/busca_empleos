// Tests integrados de flujo para Issue 18:
// Implementé la verificación integral de los dos recorridos requeridos en el punto 14:
// 1. Recorrido 1: Ciclo completo de fallo técnico (HTTP 503 o red) y reintento exitoso.
// 2. Recorrido 2: Lote activo interrumpido por reinicio, rehidratación y continuación.
//
// Verifiqué que los fallos del proveedor de IA no marquen rechazos laborales,
// que los errores técnicos persistan en evaluacion_error_mensaje sin contaminar la caché,
// que la rehidratación restaure de forma idempotente el estado del servidor tras un reinicio,
// y que la cancelación sobre lotes huérfanos desbloquee nuevas evaluaciones de manera segura.

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));

const pool = require('../../src/config/base-datos');
const proveedor = require('../../src/config/deepseek');
const preferencias = require('../../src/modelos/preferencia');
const servicio = require('../../src/servicios/servicio-evaluacion');
const controlador = require('../../src/controladores/controlador-evaluacion');

let filasOfertas;
let loteDb;
let cache;
let llamadasFinalizarLote;
let propietarioLock;
let contadorTiempoMock;

const crearRespuestaMock = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const esperarMicrotareas = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
    jest.clearAllMocks();
    propietarioLock = null;
    loteDb = null;
    cache = new Map();
    llamadasFinalizarLote = [];
    contadorTiempoMock = 1700000000000;

    preferencias.obtenerPreferencias.mockResolvedValue({
        nombre: 'Marcos Toledo',
        stack_tecnologico: ['Node.js', 'PostgreSQL', 'Express'],
        zonas_preferidas: ['CABA', 'Remoto'],
        modalidades_preferidas: ['remoto', 'hibrido'],
    });

    pool.connect.mockImplementation(async () => {
        const cliente = {
            release: jest.fn(),
            query: jest.fn(async (sql) => {
                if (sql.includes('pg_try_advisory_lock')) {
                    const ok = propietarioLock === null;
                    if (ok) propietarioLock = cliente;
                    return { rows: [{ ok }] };
                }
                if (sql.includes('pg_advisory_unlock')) {
                    if (propietarioLock === cliente) {
                        propietarioLock = null;
                    }
                    return { rows: [] };
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
                id: (loteDb ? loteDb.id + 1 : 1),
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
                if (loteDb) {
                    loteDb.estado = valores[0];
                }
            }
            for (const [, campo, parametro] of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                if (campo !== 'id' && loteDb) {
                    loteDb[campo] = valores[Number(parametro) - 1];
                }
            }
            return { rows: loteDb ? [structuredClone(loteDb)] : [] };
        }
        if (sql.includes("SELECT * FROM ofertas WHERE estado_evaluacion = 'pendiente'")
            || (sql.includes('SELECT * FROM ofertas') && sql.includes("estado_evaluacion = 'pendiente'"))) {
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
        if (sql.includes('SELECT * FROM ofertas WHERE id = $1')) {
            const encontrada = filasOfertas.find((o) => o.id === valores[0]);
            return { rows: encontrada ? [structuredClone(encontrada)] : [] };
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
                contadorTiempoMock += 10000;
                fila.estado_evaluacion = valores[0];
                fila.razon_evaluacion = valores[1];
                fila.porcentaje_match = valores[2];
                fila.evaluacion_error_mensaje = valores[4];
                fila.fecha_evaluacion = new Date(contadorTiempoMock).toISOString();
                fila.firma_criterios_evaluacion = valores[9];
                fila.explicacion_evaluacion = valores[10] ? JSON.parse(valores[10]) : null;
            }
            return { rows: fila ? [structuredClone(fila)] : [] };
        }
        if (sql.includes('SELECT resultado FROM evaluaciones_cache')) {
            const clave = JSON.stringify(valores.slice(0, 3));
            return { rows: cache.has(clave) ? [{ resultado: structuredClone(cache.get(clave)) }] : [] };
        }
        if (sql.includes('INSERT INTO evaluaciones_cache')) {
            const clave = JSON.stringify(valores.slice(0, 3));
            cache.set(clave, JSON.parse(valores[3]));
            return { rows: [] };
        }

        return { rows: [] };
    });
});

describe('Flujos integrados de evaluación con IA — Issue 18', () => {
    describe('Recorrido 1: Ciclo completo de fallo técnico y reintento exitoso', () => {
        test('oferta pendiente con fallo técnico (HTTP 503) no se rechaza laboralmente, no va a caché y se aprueba con reintento exitoso', async () => {
            filasOfertas = [
                {
                    id: 1,
                    titulo: 'Desarrollador Backend Node.js Junior',
                    descripcion: 'Buscamos programador backend con experiencia en Node.js, Express y bases de datos PostgreSQL.',
                    modalidad: 'remoto',
                    ubicacion: 'Buenos Aires, Argentina',
                    fecha_extraccion: new Date().toISOString(),
                    estado_evaluacion: 'pendiente',
                    razon_evaluacion: null,
                    porcentaje_match: null,
                    evaluacion_error_mensaje: null,
                    fecha_evaluacion: null,
                    firma_criterios_evaluacion: null,
                    explicacion_evaluacion: null,
                    estado_postulacion: 'no_postulado',
                },
            ];

            // 1. Verifiqué el estado inicial de la oferta antes de la evaluación
            expect(filasOfertas[0].estado_evaluacion).toBe('pendiente');
            expect(filasOfertas[0].fecha_evaluacion).toBeNull();
            expect(filasOfertas[0].evaluacion_error_mensaje).toBeNull();

            // 2. Simulé fallo técnico de DeepSeek devolviendo HTTP 503
            proveedor.consultarDeepSeek.mockRejectedValueOnce(
                Object.assign(new Error('HTTP 503 Service Unavailable: el modelo se encuentra temporalmente sobrecargado'), { codigo: 'HTTP_503' })
            );

            // Ejecuté la evaluación de ofertas pendientes
            const resumenFallo = await servicio.evaluarOfertasPendientes();

            // 3. Verifiqué que la oferta NO quedó rechazada laboralmente (sigue en estado 'pendiente')
            expect(filasOfertas[0].estado_evaluacion).toBe('pendiente');

            // Verifiqué que se persistió el fallo técnico en evaluacion_error_mensaje
            expect(filasOfertas[0].evaluacion_error_mensaje).toBe('Error al evaluar con DeepSeek: Error técnico (HTTP_503). Volvé a intentar.');

            // Verifiqué que el contador de errores fue 1 y el de rechazadas fue 0
            expect(resumenFallo.errores).toBe(1);
            expect(resumenFallo.rechazadas).toBe(0);
            expect(resumenFallo.aprobadas).toBe(0);
            expect(resumenFallo.evaluadas).toBe(0);

            const progresoFallo = servicio.obtenerProgresoEvaluacion();
            expect(progresoFallo.errores).toBe(1);
            expect(progresoFallo.rechazadas).toBe(0);
            expect(progresoFallo.estado).toBe('error');

            // Verifiqué que la oferta fallida no se guardó en la caché
            expect(cache.size).toBe(0);

            // 4. Invoqué reintentarErroresEvaluacion() con DeepSeek respondiendo con éxito
            proveedor.consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({
                    match: true,
                    porcentaje: 85,
                    razon: 'El perfil cumple satisfactoriamente los requerimientos técnicos de Node.js y PostgreSQL.',
                    explicacion: {
                        cumplidos: [
                            {
                                requisito: 'Node.js',
                                tipo: 'obligatorio',
                                evidencia_oferta: 'Desarrollador Backend Node.js Junior',
                                evidencia_perfil: 'Node.js en stack tecnológico',
                                explicacion: 'Experiencia coincidente en backend con Node.js.',
                            },
                            {
                                requisito: 'PostgreSQL',
                                tipo: 'obligatorio',
                                evidencia_oferta: 'Bases de datos PostgreSQL',
                                evidencia_perfil: 'PostgreSQL en stack tecnológico',
                                explicacion: 'Manejo de base de datos PostgreSQL verificado.',
                            },
                        ],
                        no_cumplidos: [],
                        por_confirmar: [],
                        exclusiones: [],
                    },
                })
            );

            const resultadoReintento = await servicio.reintentarErroresEvaluacion();
            expect(resultadoReintento.exito).toBe(true);
            expect(resultadoReintento.en_curso).toBe(true);
            expect(resultadoReintento.total).toBe(1);

            // Esperé que el worker en segundo plano finalice el reintento
            for (let i = 0; i < 50; i++) {
                await esperarMicrotareas();
                if (!servicio.obtenerProgresoEvaluacion().activo) break;
            }

            // 5. Verifiqué que la oferta ahora tiene estado_evaluacion: 'aprobada'
            expect(filasOfertas[0].estado_evaluacion).toBe('aprobada');

            // Verifiqué que evaluacion_error_mensaje quedó en null (limpiado)
            expect(filasOfertas[0].evaluacion_error_mensaje).toBeNull();
            expect(filasOfertas[0].porcentaje_match).toBe(85);

            // Verifiqué que se actualizó fecha_evaluacion, firma_criterios_evaluacion y el desglose de explicación
            expect(filasOfertas[0].fecha_evaluacion).toBeTruthy();
            expect(filasOfertas[0].firma_criterios_evaluacion).toBeTruthy();
            expect(typeof filasOfertas[0].firma_criterios_evaluacion).toBe('string');
            expect(filasOfertas[0].explicacion_evaluacion).toEqual(
                expect.objectContaining({
                    cumplidos: expect.arrayContaining([
                        expect.objectContaining({ requisito: 'Node.js' }),
                        expect.objectContaining({ requisito: 'PostgreSQL' }),
                    ]),
                })
            );

            // Verifiqué que tras el reintento exitoso la evaluación sí se guardó en caché
            expect(cache.size).toBe(1);

            // Verifiqué que el resumen del lote refleja 1 evaluada, 1 aprobada, 0 errores
            const progresoExitoso = servicio.obtenerProgresoEvaluacion();
            expect(progresoExitoso.evaluadas).toBe(1);
            expect(progresoExitoso.aprobadas).toBe(1);
            expect(progresoExitoso.rechazadas).toBe(0);
            expect(progresoExitoso.errores).toBe(0);
            expect(progresoExitoso.estado).toBe('completado');

            expect(loteDb).toMatchObject({
                evaluadas: 1,
                aprobadas: 1,
                rechazadas: 0,
                errores: 0,
                estado: 'completado',
            });
        });

        test('variante con error de red transitorio (ECONNREFUSED) procesada y reintentada mediante el controlador', async () => {
            filasOfertas = [
                {
                    id: 2,
                    titulo: 'Backend Developer Express',
                    descripcion: 'Construcción de microservicios con Express y PostgreSQL.',
                    modalidad: 'remoto',
                    ubicacion: 'CABA',
                    fecha_extraccion: new Date().toISOString(),
                    estado_evaluacion: 'pendiente',
                    razon_evaluacion: null,
                    porcentaje_match: null,
                    evaluacion_error_mensaje: null,
                    fecha_evaluacion: null,
                    firma_criterios_evaluacion: null,
                    explicacion_evaluacion: null,
                    estado_postulacion: 'no_postulado',
                },
            ];

            // Simulé fallo de conexión de red
            proveedor.consultarDeepSeek.mockRejectedValueOnce(
                Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { codigo: 'ERROR_TRANSPORTE' })
            );

            const resEjecucion = crearRespuestaMock();
            await controlador.ejecutarEvaluacion({ body: { ids: [2] } }, resEjecucion);

            expect(resEjecucion.json).toHaveBeenCalledWith(
                expect.objectContaining({ exito: true, en_curso: true })
            );

            for (let i = 0; i < 50; i++) {
                await esperarMicrotareas();
                if (!servicio.obtenerProgresoEvaluacion().activo) break;
            }

            // Verifiqué que se preservó en pendiente con error técnico
            expect(filasOfertas[0].estado_evaluacion).toBe('pendiente');
            expect(filasOfertas[0].evaluacion_error_mensaje).toBe('Error al evaluar con DeepSeek: Error técnico (ERROR_TRANSPORTE). Volvé a intentar.');
            expect(cache.size).toBe(0);

            // Reintento exitoso a través de endpoint del controlador
            proveedor.consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({
                    match: true,
                    porcentaje: 88,
                    razon: 'Alineado al perfil backend Express.',
                    explicacion: {
                        cumplidos: [{ requisito: 'Express', evidencia_oferta: 'Express' }],
                        no_cumplidos: [],
                        por_confirmar: [],
                        exclusiones: [],
                    },
                })
            );

            const resReintentoControlador = crearRespuestaMock();
            await controlador.reintentarErrores({}, resReintentoControlador);

            expect(resReintentoControlador.status).toHaveBeenCalledWith(200);
            expect(resReintentoControlador.json).toHaveBeenCalledWith(
                expect.objectContaining({ exito: true, total: 1 })
            );

            for (let i = 0; i < 50; i++) {
                await esperarMicrotareas();
                if (!servicio.obtenerProgresoEvaluacion().activo) break;
            }

            expect(filasOfertas[0].estado_evaluacion).toBe('aprobada');
            expect(filasOfertas[0].evaluacion_error_mensaje).toBeNull();
            expect(filasOfertas[0].firma_criterios_evaluacion).toBeTruthy();
            expect(cache.size).toBe(1);
        });
    });

    describe('Recorrido 2: Lote activo interrumpido por reinicio, rehidratación y continuación', () => {
        test('lote activo interrumpido se finaliza en BD como error, preserva contadores, tolera rehidratación idempotente, cancelación segura y permite nuevo lote sin bloqueo', async () => {
            // 1. Simulé un lote en BD con estado = 'activo' y 10 de 100 ofertas procesadas
            loteDb = {
                id: 100,
                estado: 'activo',
                total: 100,
                evaluadas: 10,
                aprobadas: 7,
                rechazadas: 3,
                errores: 0,
                porcentaje: 10,
            };

            // 2. Ejecuté la rehidratación simulada (al iniciar servidor tras reinicio)
            await servicio.rehidratarProgreso();

            // 3. Verifiqué que el lote en BD se finalizó como 'error'
            expect(loteDb.estado).toBe('error');
            expect(llamadasFinalizarLote).toContainEqual({ id: 100, estado: 'error' });

            // Verifiqué en memoria: progresoEvaluacion.activo === false, estado === 'error' y mensaje menciona reinicio
            const progresoRehidratado = servicio.obtenerProgresoEvaluacion();
            expect(progresoRehidratado.activo).toBe(false);
            expect(progresoRehidratado.estado).toBe('error');
            expect(progresoRehidratado.mensaje_error).toContain('reinicio del servidor');

            // Verifiqué que se preservaron los contadores históricos del lote (10 evaluadas, 7 aprobadas, 3 rechazadas)
            expect(progresoRehidratado.total).toBe(100);
            expect(progresoRehidratado.evaluadas).toBe(10);
            expect(progresoRehidratado.aprobadas).toBe(7);
            expect(progresoRehidratado.rechazadas).toBe(3);
            expect(progresoRehidratado.errores).toBe(0);
            expect(progresoRehidratado.porcentaje).toBe(10);

            // 4. Verifiqué que si se invoca rehidratarProgreso() una segunda vez es completamente idempotente
            const cantidadFinalizaciones = llamadasFinalizarLote.length;
            await expect(servicio.rehidratarProgreso()).resolves.not.toThrow();
            expect(llamadasFinalizarLote.length).toBe(cantidadFinalizaciones);

            const progresoSegundo = servicio.obtenerProgresoEvaluacion();
            expect(progresoSegundo.activo).toBe(false);
            expect(progresoSegundo.estado).toBe('error');
            expect(progresoSegundo.evaluadas).toBe(10);
            expect(progresoSegundo.aprobadas).toBe(7);
            expect(progresoSegundo.rechazadas).toBe(3);

            // 5. Verifiqué que la cancelación cancelarEvaluacionPendiente() sobre ese estado huérfano actúa de forma segura y no bloquea el sistema
            const resultadoCancelacion = await servicio.cancelarEvaluacionPendiente();
            expect(resultadoCancelacion.activa).toBe(false);
            expect(resultadoCancelacion.cancelada).toBe(true);

            const progresoCancelado = servicio.obtenerProgresoEvaluacion();
            expect(progresoCancelado.activo).toBe(false);
            expect(progresoCancelado.estado).toBe('cancelado');
            expect(progresoCancelado.mensaje_error).toBe('Evaluación cancelada.');

            // 6. Verifiqué que se puede iniciar un nuevo lote de evaluación inmediatamente sin recibir bloqueo por proceso activo previo
            filasOfertas = [
                {
                    id: 301,
                    titulo: 'Programador Node.js Mid',
                    descripcion: 'Desarrollo de servicios backend con Node.js, Express y bases de datos relacionales PostgreSQL.',
                    modalidad: 'remoto',
                    ubicacion: 'CABA',
                    fecha_extraccion: new Date().toISOString(),
                    estado_evaluacion: 'pendiente',
                    razon_evaluacion: null,
                    porcentaje_match: null,
                    evaluacion_error_mensaje: null,
                    fecha_evaluacion: null,
                    firma_criterios_evaluacion: null,
                    explicacion_evaluacion: null,
                },
            ];

            proveedor.consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({
                    match: true,
                    porcentaje: 90,
                    razon: 'Alineación completa con el perfil buscado.',
                })
            );

            const resControlador = crearRespuestaMock();
            await controlador.ejecutarEvaluacion({ body: {} }, resControlador);

            // Verifiqué que no retornó conflicto 409 y que el nuevo lote arrancó correctamente
            expect(resControlador.status).not.toHaveBeenCalledWith(409);
            expect(resControlador.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    exito: true,
                    en_curso: true,
                    mensaje: expect.stringContaining('iniciada'),
                })
            );

            // Esperé que termine el nuevo lote en segundo plano
            for (let i = 0; i < 50 && (propietarioLock || servicio.obtenerProgresoEvaluacion().activo); i++) {
                await esperarMicrotareas();
            }

            // Verifiqué liberación de lock y finalización exitosa del nuevo lote
            expect(propietarioLock).toBeNull();
            const progresoNuevo = servicio.obtenerProgresoEvaluacion();
            expect(progresoNuevo.activo).toBe(false);
            expect(progresoNuevo.evaluadas).toBe(1);
            expect(progresoNuevo.aprobadas).toBe(1);
            expect(progresoNuevo.errores).toBe(0);
            expect(progresoNuevo.estado).toBe('completado');

            expect(loteDb.estado).toBe('completado');
            expect(loteDb.evaluadas).toBe(1);
            expect(loteDb.aprobadas).toBe(1);
            expect(loteDb.errores).toBe(0);
        });
    });
});
