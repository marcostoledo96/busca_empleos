jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('node-cron');
jest.mock('../../src/servicios/servicio-automatizacion');
jest.mock('../../src/utils/middleware-auth', () => ({ verificarAuth: (req, res, next) => next() }));
const request = require('supertest');
const app = require('../../src/app');
const servicio = require('../../src/servicios/servicio-automatizacion');
beforeEach(() => jest.resetAllMocks());
test('expongo historial durable por la ruta existente', async () => {
    servicio.obtenerHistorial.mockResolvedValue([{ id: 1, estado: 'parcial', resumen: { fuentes: [] } }]);
    const respuesta = await request(app).get('/api/automatizacion/historial');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ exito: true, datos: [{ id: 1, estado: 'parcial', resumen: { fuentes: [] } }] });
});
test('una falla de lectura de historial no es una lista vacía', async () => {
    servicio.obtenerHistorial.mockRejectedValue(new Error('BD sintética'));
    const respuesta = await request(app).get('/api/automatizacion/historial');
    expect(respuesta.status).toBe(503);
    expect(respuesta.body.exito).toBe(false);
});
test('espero activación persistida y reporto fallo asincrónico', async () => {
    servicio.programarCron.mockRejectedValue(Object.assign(new Error('No pude persistir.'), { statusCode: 503 }));
    const respuesta = await request(app).post('/api/automatizacion/iniciar').send({});
    expect(respuesta.status).toBe(503);
    expect(respuesta.body.exito).toBe(false);
});
test('detengo y persisto aun cuando scheduler ya estaba inactivo', async () => {
    servicio.obtenerEstado.mockReturnValue({ activo: false });
    servicio.detenerCron.mockResolvedValue();
    const respuesta = await request(app).post('/api/automatizacion/detener').send({});
    expect(respuesta.status).toBe(200);
    expect(servicio.detenerCron).toHaveBeenCalledTimes(1);
});
