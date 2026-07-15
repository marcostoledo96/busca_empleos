// Tests del controlador de ofertas — verifico que los endpoints HTTP
// responden correctamente según lo que retorna el modelo.
//
// ¿Qué es supertest? Es una herramienta que simula requests HTTP contra
// tu app Express SIN levantar un servidor real. Le paso la app configurada
// y le digo "hacé un GET a /api/ofertas" — y me da el status, body, headers.
// Perfecto para testear la API sin abrir un puerto ni usar el browser.
//
// ¿Por qué mockeo el modelo? Porque estos tests verifican que el CONTROLADOR
// funciona bien (parsea params, llama al modelo, formatea la respuesta).
// El modelo ya tiene sus propios tests contra la BD real. No necesito
// testear la BD otra vez acá — sería redundante y lento.

// Primero mockeo TODOS los módulos que hacen I/O.
// jest.mock() se "hoistea" (se mueve al principio) automáticamente,
// así que aunque esté antes del require, funciona.
jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));
jest.mock('../../src/config/base-datos', () => ({
    on: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    obtenerDiagnosticoPersistencia: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const modeloOferta = require('../../src/modelos/oferta');
const baseDatos = require('../../src/config/base-datos');

describe('Controlador de ofertas', () => {
    // Después de cada test, limpio los mocks para que no se contaminen entre sí.
    afterEach(() => jest.clearAllMocks());

    // === GET /api/ofertas ===

    describe('GET /api/ofertas', () => {
        test('retorna status 200 con la lista de ofertas', async () => {
            // Configuro el mock: cuando alguien llame a obtenerOfertas,
            // retorná este array. Es como decirle "fingí que la BD tiene esto".
            modeloOferta.obtenerOfertas.mockResolvedValue([
                { id: 1, titulo: 'Dev Junior React' },
                { id: 2, titulo: 'QA Tester' },
            ]);

            const res = await request(app).get('/api/ofertas');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos).toHaveLength(2);
            expect(res.body.total).toBe(2);
        });

        test('pasa los filtros de query params al modelo', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue([]);

            await request(app).get('/api/ofertas?estado=aprobada&plataforma=linkedin');

            // Verifico que el controlador pasó los filtros correctamente.
            expect(modeloOferta.obtenerOfertas).toHaveBeenCalledWith({
                estado: 'aprobada',
                plataforma: 'linkedin',
            });
        });

        test('normaliza slug HTTP "google-jobs" a id interno "google_jobs" en el filtro plataforma', async () => {
            // Si el cliente manda ?plataforma=google-jobs (slug HTTP),
            // el controlador debe normalizarlo a google_jobs antes de pasarlo al modelo,
            // porque en la BD el valor es 'google_jobs', no 'google-jobs'.
            modeloOferta.obtenerOfertas.mockResolvedValue([]);

            await request(app).get('/api/ofertas?plataforma=google-jobs');

            expect(modeloOferta.obtenerOfertas).toHaveBeenCalledWith({
                plataforma: 'google_jobs',
            });
        });

        test('deja pasar ids internos canónicos sin modificarlos', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue([]);

            await request(app).get('/api/ofertas?plataforma=linkedin');

            expect(modeloOferta.obtenerOfertas).toHaveBeenCalledWith({
                plataforma: 'linkedin',
            });
        });

        test('pasa filtros de sorting y postulacion al modelo', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue([]);

            await request(app).get(
                '/api/ofertas?ordenar_por=porcentaje_match&direccion=DESC&estado_postulacion=cv_enviado'
            );

            expect(modeloOferta.obtenerOfertas).toHaveBeenCalledWith({
                ordenar_por: 'porcentaje_match',
                direccion: 'DESC',
                estado_postulacion: 'cv_enviado',
            });
        });

        test('retorna array vacío y total 0 cuando no hay ofertas', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue([]);

            const res = await request(app).get('/api/ofertas');

            expect(res.status).toBe(200);
            expect(res.body.datos).toEqual([]);
            expect(res.body.total).toBe(0);
        });

        test('no pasa filtros vacíos al modelo si no hay query params', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue([]);

            await request(app).get('/api/ofertas');

            expect(modeloOferta.obtenerOfertas).toHaveBeenCalledWith({});
        });

        test('pasa limite_pagina y pagina al modelo cuando se envían en query params', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue({
                ofertas: [{ id: 1, titulo: 'Dev Junior' }],
                total: 10,
                pagina: 2,
                limite_pagina: 5,
            });

            const res = await request(app).get('/api/ofertas?limite_pagina=5&pagina=2');

            expect(modeloOferta.obtenerOfertas).toHaveBeenCalledWith({
                limite_pagina: '5',
                pagina: '2',
            });
            expect(res.status).toBe(200);
            expect(res.body.limite_pagina).toBe(5);
            expect(res.body.pagina).toBe(2);
        });

        test('retorna limite_pagina null cuando el modelo no paginó', async () => {
            modeloOferta.obtenerOfertas.mockResolvedValue({
                ofertas: [{ id: 1, titulo: 'Dev Junior' }],
                total: 1,
                pagina: 1,
                limite_pagina: null,
            });

            const res = await request(app).get('/api/ofertas');

            expect(res.status).toBe(200);
            expect(res.body.limite_pagina).toBeNull();
            expect(res.body.total).toBe(1);
        });
    });

    // === GET /api/ofertas/estadisticas ===

    describe('GET /api/ofertas/estadisticas', () => {
        test('retorna conteo por estado de evaluación', async () => {
            modeloOferta.obtenerEstadisticas.mockResolvedValue({
                total: 10,
                pendientes: 3,
                aprobadas: 5,
                rechazadas: 2,
            });

            const res = await request(app).get('/api/ofertas/estadisticas');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.total).toBe(10);
            expect(res.body.datos.aprobadas).toBe(5);
            expect(res.body.datos.pendientes).toBe(3);
            expect(res.body.datos.rechazadas).toBe(2);
        });
    });

    describe('GET /api/ofertas/sincronizacion', () => {
        test('valida el límite y retorna el bloque con cursor', async () => {
            modeloOferta.obtenerBloqueSincronizacion.mockResolvedValue({
                datos: [{ id: 3, titulo: 'Oferta liviana' }],
                total: 1,
                fecha_corte: '2026-06-15T00:00:00.000Z',
                max_id: 3,
                total_inicial: 1,
                cursor_siguiente: null,
                completada: true,
            });

            const res = await request(app).get('/api/ofertas/sincronizacion?limite=500');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                exito: true,
                total: 1,
                fecha_corte: '2026-06-15T00:00:00.000Z',
                max_id: 3,
                total_inicial: 1,
                completada: true,
            }));
            expect(res.body).not.toHaveProperty('firma');
            expect(res.body).not.toHaveProperty('ultimo_id');
            expect(modeloOferta.obtenerBloqueSincronizacion).toHaveBeenCalledWith({ limite: 500, cursor: undefined });
        });

        test('rechaza límites fuera del contrato 100 a 500', async () => {
            const res = await request(app).get('/api/ofertas/sincronizacion?limite=20');
            expect(res.status).toBe(400);
            expect(modeloOferta.obtenerBloqueSincronizacion).not.toHaveBeenCalled();
        });

        test('mapea una mutación concurrente a 409 controlado', async () => {
            const error = new Error('La sincronización fue invalidada por cambios concurrentes.');
            error.codigo = 'SINCRONIZACION_INVALIDADA';
            modeloOferta.obtenerBloqueSincronizacion.mockRejectedValue(error);

            const res = await request(app).get('/api/ofertas/sincronizacion?limite=500&cursor=cursor');

            expect(res.status).toBe(409);
            expect(res.body.exito).toBe(false);
            expect(res.body.codigo).toBe('SINCRONIZACION_INVALIDADA');
        });

        test('retorna error sin éxito para un cursor inválido', async () => {
            const error = new Error('Cursor de sincronización inválido o vencido.');
            error.codigo = 'CURSOR_SINCRONIZACION_INVALIDO';
            modeloOferta.obtenerBloqueSincronizacion.mockRejectedValue(error);

            const res = await request(app).get('/api/ofertas/sincronizacion?limite=500&cursor=invalido');

            expect(res.status).toBe(400);
            expect(res.body).toEqual(expect.objectContaining({
                exito: false,
                codigo: 'CURSOR_SINCRONIZACION_INVALIDO',
            }));
        });

        test('delega un error operativo inesperado al middleware global como 500 genérico', async () => {
            modeloOferta.obtenerBloqueSincronizacion.mockRejectedValue(
                new Error('PostgreSQL: relación ofertas no existe')
            );

            const res = await request(app).get('/api/ofertas/sincronizacion?limite=500');

            expect(res.status).toBe(500);
            expect(res.body).toEqual({
                exito: false,
                error: 'Error interno del servidor.',
            });
        });
    });

    describe('GET /api/ofertas/diagnostico/persistencia', () => {
        test('retorna el diagnostico sanitizado cuando está habilitado', async () => {
            // Simulamos que el diagnóstico está habilitado
            const habilitadoOriginal = process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA;
            process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA = 'true';
            // Garantizamos que no estamos en producción
            const nodeEnvOriginal = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            baseDatos.obtenerDiagnosticoPersistencia.mockResolvedValue({
                configuracion: {
                    host: 'localhost',
                    puerto: 5432,
                    baseDatos: 'busca_empleos',
                    usuario: 'postgres',
                },
                conexion: {
                    base_datos_actual: 'busca_empleos',
                    usuario_actual: 'postgres',
                    puerto_postgresql: 5432,
                    host_postgresql: '127.0.0.1',
                    tabla_ofertas_existe: true,
                    total_ofertas: 12,
                },
            });

            const res = await request(app).get('/api/ofertas/diagnostico/persistencia');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            // Verificamos que NO vengan datos sensibles
            expect(res.body.datos).not.toHaveProperty('configuracion');
            expect(res.body.datos).not.toHaveProperty('conexion');
            expect(res.body.datos).not.toHaveProperty('host');
            expect(res.body.datos).not.toHaveProperty('usuario');
            // Verificamos que vengan los datos sanitizados
            expect(res.body.datos.base_de_datos).toBe('busca_empleos');
            expect(res.body.datos.tabla_ofertas_existe).toBe(true);
            expect(res.body.datos.total_ofertas).toBe(12);
            expect(res.body.datos.fecha_consulta).toBeDefined();

            // Restauramos las variables
            process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA = habilitadoOriginal;
            process.env.NODE_ENV = nodeEnvOriginal;
        });

        test('retorna 404 cuando el diagnóstico está deshabilitado', async () => {
            const habilitadoOriginal = process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA;
            process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA = '';
            const nodeEnvOriginal = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const res = await request(app).get('/api/ofertas/diagnostico/persistencia');

            expect(res.status).toBe(404);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('No encontrado');

            process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA = habilitadoOriginal;
            process.env.NODE_ENV = nodeEnvOriginal;
        });

        test('retorna 404 en producción aunque esté habilitado', async () => {
            const habilitadoOriginal = process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA;
            process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA = 'true';
            const nodeEnvOriginal = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const res = await request(app).get('/api/ofertas/diagnostico/persistencia');

            expect(res.status).toBe(404);
            expect(res.body.exito).toBe(false);

            process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA = habilitadoOriginal;
            process.env.NODE_ENV = nodeEnvOriginal;
        });
    });

    // === GET /api/ofertas/:id ===

    describe('GET /api/ofertas/:id', () => {
        test('retorna la oferta con status 200 si existe', async () => {
            modeloOferta.obtenerOfertaPorId.mockResolvedValue({
                id: 1,
                titulo: 'Desarrollador Angular Junior',
                estado_evaluacion: 'aprobada',
            });

            const res = await request(app).get('/api/ofertas/1');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.titulo).toBe('Desarrollador Angular Junior');
        });

        test('retorna 404 si la oferta no existe', async () => {
            modeloOferta.obtenerOfertaPorId.mockResolvedValue(null);

            const res = await request(app).get('/api/ofertas/999');

            expect(res.status).toBe(404);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('no encontrada');
        });

        test('retorna 400 si el ID no es un número válido', async () => {
            const res = await request(app).get('/api/ofertas/abc');

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('número entero positivo');
        });

        test('retorna 400 si el ID es negativo', async () => {
            const res = await request(app).get('/api/ofertas/-5');

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });
    });

    // === PATCH /api/ofertas/:id/postulacion ===

    describe('PATCH /api/ofertas/:id/postulacion', () => {
        test('actualiza el estado de postulación y retorna 200', async () => {
            modeloOferta.actualizarPostulacion.mockResolvedValue({
                id: 1,
                titulo: 'Dev Junior',
                estado_postulacion: 'cv_enviado',
            });

            const res = await request(app)
                .patch('/api/ofertas/1/postulacion')
                .send({ estado_postulacion: 'cv_enviado' });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.estado_postulacion).toBe('cv_enviado');
            expect(res.body.mensaje).toContain('cv_enviado');
        });

        test('retorna 400 si el estado no es válido', async () => {
            const res = await request(app)
                .patch('/api/ofertas/1/postulacion')
                .send({ estado_postulacion: 'estado_inventado' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('estado_postulacion');
        });

        test('retorna 400 si no se envía estado_postulacion', async () => {
            const res = await request(app)
                .patch('/api/ofertas/1/postulacion')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });

        test('retorna 404 si la oferta no existe', async () => {
            modeloOferta.actualizarPostulacion.mockResolvedValue(null);

            const res = await request(app)
                .patch('/api/ofertas/999/postulacion')
                .send({ estado_postulacion: 'cv_enviado' });

            expect(res.status).toBe(404);
            expect(res.body.exito).toBe(false);
        });

        test('retorna 400 si el ID no es un número válido', async () => {
            const res = await request(app)
                .patch('/api/ofertas/abc/postulacion')
                .send({ estado_postulacion: 'cv_enviado' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });
    });

    // === PATCH /api/ofertas/bulk/postulacion ===

    describe('PATCH /api/ofertas/bulk/postulacion', () => {
        test('actualiza múltiples ofertas y retorna la cantidad actualizadas', async () => {
            modeloOferta.actualizarPostulacionMasiva.mockResolvedValue(3);

            const res = await request(app)
                .patch('/api/ofertas/bulk/postulacion')
                .send({ ids: [1, 2, 3], estado_postulacion: 'descartada' });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.actualizadas).toBe(3);
            expect(res.body.mensaje).toContain('descartada');
        });

        test('retorna 400 si ids no es un array', async () => {
            const res = await request(app)
                .patch('/api/ofertas/bulk/postulacion')
                .send({ ids: 1, estado_postulacion: 'descartada' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('ids');
        });

        test('retorna 400 si ids es un array vacío', async () => {
            const res = await request(app)
                .patch('/api/ofertas/bulk/postulacion')
                .send({ ids: [], estado_postulacion: 'descartada' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });

        test('retorna 400 si ids contiene valores no enteros', async () => {
            const res = await request(app)
                .patch('/api/ofertas/bulk/postulacion')
                .send({ ids: [1, 'dos', 3], estado_postulacion: 'descartada' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });

        test('retorna 400 si estado_postulacion no es válido', async () => {
            const res = await request(app)
                .patch('/api/ofertas/bulk/postulacion')
                .send({ ids: [1, 2], estado_postulacion: 'estado_inventado' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('estado_postulacion');
        });

        test('retorna 400 si falta estado_postulacion', async () => {
            const res = await request(app)
                .patch('/api/ofertas/bulk/postulacion')
                .send({ ids: [1, 2] });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        });
    });
});

// === Tests generales de la app ===

describe('Infraestructura de la API', () => {
    test('GET /api/salud retorna status del servidor', async () => {
        const res = await request(app).get('/api/salud');

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.mensaje).toContain('funcionando');
    });

    test('retorna 404 JSON para rutas inexistentes', async () => {
        const res = await request(app).get('/api/ruta-que-no-existe');

        expect(res.status).toBe(404);
        expect(res.body.exito).toBe(false);
        expect(res.body.error).toContain('no encontrada');
    });
});
