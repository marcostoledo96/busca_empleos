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

    describe('GET /api/ofertas/diagnostico/persistencia', () => {
        test('retorna el diagnostico de persistencia visible por la API', async () => {
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
            expect(res.body.datos.configuracion.baseDatos).toBe('busca_empleos');
            expect(res.body.datos.conexion.total_ofertas).toBe(12);
            expect(res.body.datos.fecha_consulta).toBeDefined();
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
