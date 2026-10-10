jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn(), DEEPSEEK_MODELO: 'deepseek-v4-flash' }));
jest.mock('../../src/modelos/oferta');
jest.mock('../../src/modelos/preferencia');
jest.mock('../../src/modelos/evaluacion-cache');
jest.mock('../../src/modelos/evaluacion-lote');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-notificacion-email');
const pool = require('../../src/config/base-datos');
const proveedor = require('../../src/config/deepseek');
const ofertas = require('../../src/modelos/oferta');
const preferencias = require('../../src/modelos/preferencia');
const lotes = require('../../src/modelos/evaluacion-lote');
const scraping = require('../../src/servicios/servicio-scraping');
const email = require('../../src/servicios/servicio-notificacion-email');
const bloqueo = require('../../src/utils/bloqueo-concurrente');
const servicio = require('../../src/servicios/servicio-evaluacion');
const automatizacion = require('../../src/servicios/servicio-automatizacion');
const controlador = require('../../src/controladores/controlador-evaluacion');
let propietario;
let clientes;
function diferida() {
    let resolver;
    const promesa = new Promise(resolve => { resolver = resolve; });
    return { promesa, resolver };
}
function respuesta() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}
beforeEach(() => {
    jest.clearAllMocks();
    propietario = null;
    clientes = [];
    pool.connect.mockImplementation(async () => {
        const cliente = { release: jest.fn(), query: jest.fn(async sql => {
            if (sql.includes('pg_try_advisory_lock')) {
                const ok = !propietario || propietario === cliente;
                if (ok) propietario = cliente;
                return { rows: [{ ok }] };
            }
            if (propietario === cliente) propietario = null;
            return { rows: [] };
        }) };
        clientes.push(cliente);
        return cliente;
    });
    preferencias.obtenerPreferencias.mockResolvedValue({ stack_tecnologico: ['TypeScript'] });
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ id: 1, titulo: 'Desarrollo junior', descripcion: 'TypeScript', modalidad: 'remoto' }]);
    lotes.crearLote.mockResolvedValue({ id: 1 });
    lotes.actualizarProgreso.mockResolvedValue();
    lotes.finalizarLote.mockResolvedValue();
    for (const fn of Object.values(scraping)) if (jest.isMockFunction(fn)) fn.mockResolvedValue([]);
    email.enviarResumenCiclo.mockResolvedValue();
});
test('automatización conserva el mutex hasta terminar el proveedor y rechaza selección y reset', async () => {
    const entrada = diferida();
    const salida = diferida();
    proveedor.consultarDeepSeek.mockImplementation(() => { entrada.resolver(); return salida.promesa; });
    const trabajo = automatizacion.ejecutarCicloCompleto();
    await entrada.promesa;
    const progreso = servicio.obtenerProgresoEvaluacion();
    const seleccion = respuesta();
    const reset = respuesta();
    await controlador.ejecutarEvaluacion({ body: { ids: [1] } }, seleccion);
    await controlador.resetearEvaluaciones({ body: {} }, reset);
    const retenido = propietario;
    salida.resolver('{"match":true,"porcentaje":80,"razon":"Compatible"}');
    await trabajo;
    expect(retenido).not.toBeNull();
    expect(seleccion.status).toHaveBeenCalledWith(409);
    expect(reset.status).toHaveBeenCalledWith(409);
    expect(ofertas.obtenerOfertasSeleccionadas).not.toHaveBeenCalled();
    expect(ofertas.resetearEvaluacionesPorDias).not.toHaveBeenCalled();
    expect(progreso.activo).toBe(true);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(propietario).toBeNull();
    for (const cliente of clientes) expect(cliente.release).toHaveBeenCalledTimes(1);
});
test.each([false, true])('retengo el mutex durante finalización con cancelación o error: %s', async errorEscritura => {
    const entrada = diferida();
    const salida = diferida();
    const finalizando = diferida();
    const finalizado = diferida();
    proveedor.consultarDeepSeek.mockImplementation(() => { entrada.resolver(); return salida.promesa; });
    ofertas.actualizarEvaluacion.mockImplementation(async () => {
        if (errorEscritura) throw new Error('Falla de escritura');
    });
    lotes.finalizarLote.mockImplementation(() => { finalizando.resolver(); return finalizado.promesa; });
    const trabajo = automatizacion.ejecutarCicloCompleto();
    await entrada.promesa;
    servicio.cancelarEvaluacionPendiente();
    salida.resolver('{"match":true,"porcentaje":80,"razon":"Compatible"}');
    await finalizando.promesa;
    expect(propietario).not.toBeNull();
    const competidor = await bloqueo.intentarAdquirirLock(bloqueo.CLAVES.EVALUACION_OFERTAS);
    expect(competidor.ok).toBe(false);
    finalizado.resolver();
    const resultado = await trabajo;
    expect(lotes.finalizarLote).toHaveBeenCalledWith(1, 'cancelado');
    expect(resultado.errores.length).toBe(errorEscritura ? 1 : 0);
    expect(propietario).toBeNull();
    for (const cliente of clientes) expect(cliente.release).toHaveBeenCalledTimes(1);
});
test('automatización no entra al worker cuando otro cliente tiene el mutex', async () => {
    const lock = await bloqueo.intentarAdquirirLock(bloqueo.CLAVES.EVALUACION_OFERTAS);
    const previo = servicio.obtenerProgresoEvaluacion();
    const resultado = await automatizacion.ejecutarCicloCompleto();
    await bloqueo.liberarBloqueoSeguro(lock.client, bloqueo.CLAVES.EVALUACION_OFERTAS);
    expect(resultado.errores).toEqual(expect.arrayContaining([expect.stringContaining('evaluación en curso')]));
    expect(ofertas.obtenerOfertasPendientes).not.toHaveBeenCalled();
    expect(servicio.obtenerProgresoEvaluacion()).toEqual(previo);
});
