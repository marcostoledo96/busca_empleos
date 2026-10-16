jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/ejecucion-busqueda');
beforeEach(() => jest.resetAllMocks());
test('sanitizo con lista permitida sin ofertas, credenciales, snapshots ni errores textuales', () => {
    const resumen = modelo.sanitizarResumen({ estado: 'parcial', token: 'NO_GUARDAR', configuracion: { secreto: 'NO_GUARDAR' },
        fuentes: [{ plataforma: 'linkedin', estado: 'parcial', nuevas: 1, actualizadas: 2, reapariciones: 3,
            peticionesRealizadas: null, ofertas: [{ descripcion: 'NO_GUARDAR' }],
            errores: [{ tipo: 'http', codigoHttp: 503, mensaje: 'NO_GUARDAR' }],
            resultadosConsultas: [{ consulta: 'junior', estado: 'error', peticionesRealizadas: 1, totalCrudos: 0,
                errores: [{ tipo: 'red', mensaje: 'NO_GUARDAR' }] }] }] });
    expect(resumen).toMatchObject({ estado: 'parcial', fuentes: [{ nuevas: 1, actualizadas: 2, reapariciones: 3, peticionesRealizadas: null,
        errores: [{ tipo: 'http', codigoHttp: 503 }], resultadosConsultas: [{ consulta: 'junior' }] }] });
    expect(JSON.stringify(resumen)).not.toContain('NO_GUARDAR');
});
test('conservo motivo de evaluación global fallida separado de las fuentes correctas', () => {
    const resumen = modelo.sanitizarResumen({ estado: 'parcial', estadoScraping: 'completada', estadoEvaluacion: 'error', fuentes: [] });
    expect(resumen).toMatchObject({ estado: 'parcial', estadoScraping: 'completada', estadoEvaluacion: 'error', motivoFinalizacion: 'evaluacion' });
});
test('no sobreescribo una ejecución interrumpida con éxito tardío', async () => {
    pool.query.mockResolvedValue({ rowCount: 0 });
    await expect(modelo.finalizar(1, { estado: 'completada', fuentes: [] })).rejects.toThrow('ya no está activa');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain("AND estado = 'ejecutando'");
});
test('al reiniciar también acoto las ejecuciones interrumpidas', async () => {
    pool.query.mockResolvedValue({ rowCount: 25 });
    await modelo.interrumpirPendientes();
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[1][0]).toContain('LIMIT 20');
});
test('un fallo de lectura se propaga, no devuelvo lista vacía', async () => {
    pool.query.mockRejectedValue(new Error('BD sintética'));
    await expect(modelo.listar()).rejects.toThrow('BD sintética');
});
