jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ crearOferta: jest.fn() }));
jest.mock('../../src/modelos/ejecucion-busqueda', () => ({ iniciar: jest.fn(), finalizar: jest.fn() }));
const modelo = require('../../src/modelos/oferta');
const historial = require('../../src/modelos/ejecucion-busqueda');
const servicio = require('../../src/servicios/servicio-resultados-fuente');
const oferta = { titulo: 'Desarrollador junior', descripcion: 'Busco desarrollo local', url: 'https://example.test/1' };
function lote(estado, ofertas = [], extra = {}) {
    return Object.defineProperty(ofertas, 'metricas', { value: { estado, plataforma: 'linkedin', duracionMs: 25,
        consultasEjecutadas: 2, peticionesRealizadas: null, totalCrudos: ofertas.length, totalElegibles: ofertas.length,
        motivoFinalizacion: estado, errores: [], resultadosConsultas: [], ...extra } });
}
beforeEach(() => {
    jest.resetAllMocks();
    modelo.crearOferta.mockResolvedValue({ resultado_persistencia: 'insertada' });
    historial.iniciar.mockResolvedValue({ id: 1 });
    historial.finalizar.mockResolvedValue();
});
test.each(['sin_resultados', 'error', 'timeout', 'sin_credenciales'])('conservo %s sin convertirlo en éxito vacío', async estado => {
    const resultado = await servicio.ejecutarFuente('linkedin', async () => lote(estado));
    expect(resultado).toMatchObject({ plataforma: 'linkedin', estado, duracionMs: expect.any(Number), nuevas: 0 });
    expect(modelo.crearOferta).not.toHaveBeenCalled();
});
test('conservo consulta parcial, métricas reales y ofertas útiles sin atribuir IA', async () => {
    const resultado = await servicio.ejecutarFuente('linkedin', async () => lote('parcial', [oferta], {
        errores: [{ tipo: 'http', codigoHttp: 503, mensaje: 'simulado' }],
        resultadosConsultas: [{ consulta: 'junior', estado: 'completada', peticionesRealizadas: 1, totalCrudos: 1, errores: [] }],
    }));
    expect(resultado).toMatchObject({ estado: 'parcial', nuevas: 1, consultasEjecutadas: 2, peticionesRealizadas: null });
    expect(resultado.resultadosConsultas[0].consulta).toBe('junior');
    expect(resultado).not.toHaveProperty('aprobadas');
    expect(modelo.crearOferta).toHaveBeenCalledWith(oferta);
});
test('uso categorías #19 sin contar actualizaciones como nuevas', async () => {
    modelo.crearOferta.mockResolvedValueOnce({ resultado_persistencia: 'actualizada' }).mockResolvedValueOnce({ resultado_persistencia: 'reaparicion' });
    const resultado = await servicio.ejecutarFuente('linkedin', async () => lote('completada', [oferta, { ...oferta, url: 'https://example.test/2' }]));
    expect(resultado).toMatchObject({ nuevas: 0, actualizadas: 1, reapariciones: 1, duplicadas: 2 });
});
test('GetOnBrd usa las categorías comunes de ingreso y conserva una falla aislada', async () => {
    const { PLATAFORMAS } = require('../../src/config/plataformas');
    const activa = jest.spyOn(PLATAFORMAS.getonbrd, 'activa', 'get').mockReturnValue(true);
    try {
        modelo.crearOferta.mockReset();
        modelo.crearOferta.mockResolvedValueOnce({ resultado_persistencia: 'insertada' })
            .mockResolvedValueOnce({ resultado_persistencia: 'actualizada' })
            .mockResolvedValueOnce({ resultado_persistencia: 'reaparicion' })
            .mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Fallo sintético'));
        const ofertas = Array.from({ length: 5 }, (_, i) => ({ ...oferta, plataforma: 'getonbrd', url: `https://www.getonbrd.com/jobs/${i}` }));
        const resultado = await servicio.ejecutarFuente('getonbrd', async () => lote('completada', ofertas));
        expect(resultado).toMatchObject({ estado: 'parcial', estadoScraping: 'completada', nuevas: 1, actualizadas: 1,
            reapariciones: 1, duplicadas: 3, erroresGuardado: 1, totalExtraidas: 5 });
        expect(modelo.crearOferta).toHaveBeenCalledTimes(5);
        expect(ofertas).toEqual(Array.from({ length: 5 }, (_, i) => ({ ...oferta, plataforma: 'getonbrd', url: `https://www.getonbrd.com/jobs/${i}` })));
    } finally { activa.mockRestore(); }
});
test('no invoco fuentes deshabilitadas y mantengo motivo del registry', async () => {
    const scraper = jest.fn();
    const resultado = await servicio.ejecutarFuente('getonbrd', scraper);
    expect(resultado).toMatchObject({ estado: 'deshabilitada', motivoFinalizacion: expect.any(String), peticionesRealizadas: 0 });
    expect(scraper).not.toHaveBeenCalled();
});
test('una excepción o respuesta inválida no es sin resultados', async () => {
    expect((await servicio.ejecutarFuente('linkedin', async () => { throw new Error('secreto sintético'); })).estado).toBe('error');
    expect((await servicio.ejecutarFuente('linkedin', async () => ({}))).estado).toBe('error');
});
test('reporto fallo de BD separado del estado del scraper', async () => {
    modelo.crearOferta.mockRejectedValue(new Error('fallo sintético'));
    const resultado = await servicio.ejecutarFuente('linkedin', async () => lote('completada', [oferta]));
    expect(resultado).toMatchObject({ estadoScraping: 'completada', estado: 'error', erroresGuardado: 1, nuevas: 0 });
});
test('registro inicio antes del proveedor y finalizo incluso ante fallo controlado', async () => {
    const resultado = await servicio.conHistorial('individual', async () => {
        expect(historial.iniciar).toHaveBeenCalledWith('individual');
        return { estado: 'error', fuentes: [] };
    });
    expect(resultado.historial).toEqual({ id: 1, guardado: true });
    expect(historial.finalizar).toHaveBeenCalledWith(1, expect.objectContaining({ estado: 'error' }));
});
test('fallo al iniciar historial impide scraping sin prometer durabilidad', async () => {
    historial.iniciar.mockRejectedValue(new Error('BD sintética'));
    const ejecutar = jest.fn();
    await expect(servicio.conHistorial('individual', ejecutar)).rejects.toThrow('historial');
    expect(ejecutar).not.toHaveBeenCalled();
});
test('fallo al finalizar no pierde resultado ni se oculta', async () => {
    historial.finalizar.mockRejectedValue(new Error('BD sintética'));
    const resultado = await servicio.conHistorial('individual', async () => ({ estado: 'completada', fuentes: [] }));
    expect(resultado).toMatchObject({ estado: 'completada', historial: { id: 1, guardado: false, error: expect.any(String) } });
});
test('todas las fuentes deshabilitadas representan omisión, no éxito vacío', () => {
    expect(servicio.estadoGeneral([{ estado: 'deshabilitada' }])).toBe('omitida');
});
test('distingo fallo total y parcial sin mezclar evaluación anterior', () => {
    expect(servicio.estadoGeneral([{ estado: 'error' }, { estado: 'timeout' }])).toBe('error');
    expect(servicio.estadoGeneral([{ estado: 'error' }, { estado: 'sin_resultados' }])).toBe('parcial');
    expect(servicio.estadoGeneral([{ estado: 'sin_resultados' }])).toBe('sin_resultados');
});
