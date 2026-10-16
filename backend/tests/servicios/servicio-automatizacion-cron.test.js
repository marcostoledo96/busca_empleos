jest.mock('node-cron', () => ({ validate: jest.fn(), createTask: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/servicios/servicio-notificacion-email');
jest.mock('../../src/modelos/configuracion-cron', () => ({ obtener: jest.fn(), guardar: jest.fn() }));
jest.mock('../../src/modelos/ejecucion-busqueda', () => ({ interrumpirPendientes: jest.fn(), listar: jest.fn() }));
const cron = require('node-cron');
const modelo = require('../../src/modelos/configuracion-cron');
const historial = require('../../src/modelos/ejecucion-busqueda');
const servicio = require('../../src/servicios/servicio-automatizacion');
let tarea;
beforeEach(() => {
    servicio._resetearEstado();
    jest.resetAllMocks();
    tarea = { start: jest.fn(), stop: jest.fn(), destroy: jest.fn(), getStatus: jest.fn(() => 'idle') };
    cron.createTask.mockReturnValue(tarea);
    cron.validate.mockReturnValue(true);
    modelo.guardar.mockResolvedValue();
    modelo.obtener.mockResolvedValue(null);
    historial.interrumpirPendientes.mockResolvedValue();
});
test.each([null, { activo: false, expresion_cron: '0 20 * * 2', zona_horaria: 'America/Argentina/Buenos_Aires' }])('sin activación explícita no programo ni ejecuto', async configuracion => {
    modelo.obtener.mockResolvedValue(configuracion);
    await servicio.rehidratar();
    expect(servicio.obtenerEstado().activo).toBe(false);
    expect(cron.createTask).not.toHaveBeenCalled();
    expect(historial.interrumpirPendientes).toHaveBeenCalledTimes(1);
});
test('restauro una sola programación futura, sin ejecutar el callback', async () => {
    modelo.obtener.mockResolvedValue({ activo: true, expresion_cron: '0 20 * * 2', zona_horaria: 'America/Argentina/Buenos_Aires' });
    await Promise.all([servicio.rehidratar(), servicio.rehidratar()]);
    expect(cron.createTask).toHaveBeenCalledTimes(1);
    expect(cron.createTask).toHaveBeenCalledWith('0 20 * * 2', expect.any(Function), { timezone: 'America/Argentina/Buenos_Aires', noOverlap: true });
    expect(tarea.start).toHaveBeenCalledTimes(1);
    expect(servicio.obtenerEstado().activo).toBe(true);
    expect(modelo.guardar).not.toHaveBeenCalled();
});
test.each(['lectura', 'expresion', 'zona'])('fallo de %s deja cron inactivo y reportado', async fallo => {
    if (fallo === 'lectura') modelo.obtener.mockRejectedValue(new Error('BD sintética'));
    else {
        modelo.obtener.mockResolvedValue({ activo: true, expresion_cron: '* * * * *', zona_horaria: fallo === 'zona' ? 'invalida' : 'America/Argentina/Buenos_Aires' });
        if (fallo === 'expresion') cron.validate.mockReturnValue(false);
    }
    await servicio.rehidratar();
    expect(servicio.obtenerEstado()).toMatchObject({ activo: false, errorCron: expect.any(String) });
    expect(cron.createTask).not.toHaveBeenCalled();
});
test('persisto antes de crear/iniciar tarea y confirmo estado aplicado', async () => {
    modelo.guardar.mockImplementation(async () => expect(cron.createTask).not.toHaveBeenCalled());
    await servicio.programarCron({ expresionCron: '0 8 * * *' });
    expect(modelo.guardar).toHaveBeenCalledWith({ activo: true, expresionCron: '0 8 * * *', zonaHoraria: 'America/Argentina/Buenos_Aires' });
    expect(servicio.obtenerEstado()).toMatchObject({ activo: true, expresionCron: '0 8 * * *' });
});
test('BD fallida al activar deja inactivo y no crea tarea', async () => {
    modelo.guardar.mockRejectedValue(new Error('BD sintética'));
    await expect(servicio.programarCron()).rejects.toThrow();
    expect(cron.createTask).not.toHaveBeenCalled();
    expect(servicio.obtenerEstado().activo).toBe(false);
});
test('fallo al iniciar revierte persistencia e informa error', async () => {
    tarea.start.mockImplementation(() => { throw new Error('scheduler sintético'); });
    await expect(servicio.programarCron()).rejects.toThrow();
    expect(modelo.guardar).toHaveBeenLastCalledWith(expect.objectContaining({ activo: false }));
    expect(servicio.obtenerEstado().activo).toBe(false);
    expect(tarea.destroy).toHaveBeenCalled();
});
test('detener corta tarea antes de persistir; fallo de BD no se anuncia como éxito', async () => {
    await servicio.programarCron();
    modelo.guardar.mockImplementation(async () => {
        expect(tarea.destroy).toHaveBeenCalled();
        throw new Error('BD sintética');
    });
    await expect(servicio.detenerCron()).rejects.toThrow();
    expect(servicio.obtenerEstado()).toMatchObject({ activo: false, errorCron: expect.any(String) });
});
test('serializo activación lenta seguida de detener sin reactivación tardía', async () => {
    let resolver;
    modelo.guardar.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
    const activar = servicio.programarCron();
    await new Promise(resolve => setImmediate(resolve));
    const detener = servicio.detenerCron();
    resolver();
    await Promise.all([activar, detener]);
    expect(servicio.obtenerEstado().activo).toBe(false);
    expect(modelo.guardar).toHaveBeenLastCalledWith(expect.objectContaining({ activo: false }));
});
test('una rehidratación tardía no pisa una desactivación encolada', async () => {
    let resolver;
    modelo.obtener.mockImplementation(() => new Promise(resolve => { resolver = resolve; }));
    const restaurar = servicio.rehidratar();
    await new Promise(resolve => setImmediate(resolve));
    const detener = servicio.detenerCron();
    resolver({ activo: true, expresion_cron: '0 20 * * 2', zona_horaria: 'America/Argentina/Buenos_Aires' });
    await Promise.all([restaurar, detener]);
    await servicio.rehidratar();
    expect(servicio.obtenerEstado().activo).toBe(false);
    expect(cron.createTask).toHaveBeenCalledTimes(1);
});
