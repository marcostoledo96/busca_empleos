jest.mock('../../src/app', () => ({ listen: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ obtenerDiagnosticoPersistencia: jest.fn() }));
jest.mock('../../src/servicios/servicio-evaluacion', () => ({ rehidratarProgreso: jest.fn() }));
jest.mock('../../src/servicios/servicio-automatizacion', () => ({ rehidratar: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
test('rehidrato una vez en el startup existente antes de escuchar HTTP', async () => {
    const app = require('../../src/app');
    const base = require('../../src/config/base-datos');
    const evaluacion = require('../../src/servicios/servicio-evaluacion');
    const automatizacion = require('../../src/servicios/servicio-automatizacion');
    base.obtenerDiagnosticoPersistencia.mockResolvedValue({ conexion: { base_datos_actual: 'sintetica_test', host_postgresql: '127.0.0.1', puerto_postgresql: 55420 } });
    evaluacion.rehidratarProgreso.mockResolvedValue();
    automatizacion.rehidratar.mockImplementation(async () => expect(app.listen).not.toHaveBeenCalled());
    require('../../src/index');
    await new Promise(resolve => setImmediate(resolve));
    expect(automatizacion.rehidratar).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledTimes(1);
});
