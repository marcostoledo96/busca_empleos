jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const { ejecutarScrapingGetonbrd } = require('../../src/servicios/servicio-scraping');
const { resolverConfiguracion } = require('../../src/servicios/servicio-configuracion-busqueda');
const { DESTINO_SANDBOX } = require('../../src/config/getonbrd');
const { crearRespuestaGetonbrd, crearOfertaGetonbrd } = require('../fixtures/getonbrd/paginas');
const opciones = cliente => ({ destino: DESTINO_SANDBOX, cliente, terminos: ['qa'] });

test('devuelvo array con métricas comunes, presupuesto conservador y redirecciones prohibidas', async () => {
    const cliente = jest.fn().mockResolvedValue(crearRespuestaGetonbrd([crearOfertaGetonbrd({ id: 'a' })], 1));
    const datos = await ejecutarScrapingGetonbrd(opciones(cliente));
    expect(Array.isArray(datos)).toBe(true);
    expect(datos).toHaveLength(1);
    expect(datos.metricas).toMatchObject({ estado: 'completada', peticionesRealizadas: 1, totalCrudos: 1, ventanaDias: 30 });
    expect(cliente.mock.calls[0][0]).toContain('query=qa&page=1&per_page=20');
    expect(cliente.mock.calls[0][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
});
test('sin habilitación efectiva no hago ninguna solicitud y no informo éxito vacío', async () => {
    const cliente = jest.fn();
    const datos = await ejecutarScrapingGetonbrd({ cliente });
    expect(cliente).not.toHaveBeenCalled();
    expect(datos.metricas.estado).toBe('deshabilitada');
});
test.each([[429, 'limite_solicitudes'], [503, 'http']])('conservo ofertas y checkpoint ante HTTP %s sin reintentar', async (status, tipo) => {
    const cliente = jest.fn().mockResolvedValueOnce(crearRespuestaGetonbrd([crearOfertaGetonbrd({ id: 'a' })], 3))
        .mockResolvedValue({ ok: false, status });
    const datos = await ejecutarScrapingGetonbrd(opciones(cliente));
    expect(datos).toHaveLength(1);
    expect(datos.metricas).toMatchObject({ estado: 'parcial', peticionesRealizadas: 2, errores: [{ tipo, codigoHttp: status }],
        checkpoint: { pagina_confirmada: 1, pagina_siguiente: 2, item_offset: 0 } });
    expect(cliente).toHaveBeenCalledTimes(2);
});
test('distingo fallo HTTP sin resultados de búsqueda vacía', async () => {
    const datos = await ejecutarScrapingGetonbrd(opciones(jest.fn().mockResolvedValue({ ok: false, status: 500 })));
    expect(datos.metricas.estado).toBe('error');
});
test('resuelvo preferencias guardadas y límites sin inventar filtros del proveedor', () => {
    const configuracion = resolverConfiguracion('getonbrd', {}, { terminos_busqueda: ['C# junior'], zonas_preferidas: ['Argentina'] });
    expect(configuracion.opciones).toMatchObject({ terminos: ['C# junior'], maxResultados: 40 });
    expect(configuracion.resumen).toMatchObject({ consultasEfectivas: ['C# junior'], ventanaDias: 30 });
    expect(configuracion.resumen.advertencias.join(' ')).toContain('ubicación');
    expect(configuracion.resumen.filtros).toMatchObject({ maxPeticiones: 2, porPagina: 20, timeoutMs: 5000 });
    expect(resolverConfiguracion('getonbrd', { maxPeticiones: 99 }).opciones.maxPeticiones).toBe(10);
});
test('el idioma excluido no ocupa el cupo de una oferta válida posterior', async () => {
    const ingles = crearOfertaGetonbrd({ id: 'ingles', titulo: 'We are looking for a software engineer' });
    ingles.attributes.description = 'You will work with our team. We are looking for someone with experience. You must have strong communication skills.';
    const cliente = jest.fn().mockResolvedValue(crearRespuestaGetonbrd([ingles, crearOfertaGetonbrd({ id: 'espanol' })]));
    const datos = await ejecutarScrapingGetonbrd({ ...opciones(cliente), maxResultados: 1 });
    expect(datos).toHaveLength(1);
    expect(datos[0].url).toContain('espanol');
    expect(datos.metricas.idiomaDescartadas).toBe(1);
});
test('el checkpoint de un segundo término fallido no vuelve al término previo', async () => {
    const cliente = jest.fn().mockResolvedValueOnce(crearRespuestaGetonbrd([], 1)).mockResolvedValue({ ok: false, status: 429 });
    const datos = await ejecutarScrapingGetonbrd({ ...opciones(cliente), terminos: ['primero', 'segundo'] });
    expect(datos.metricas.checkpoint).toMatchObject({ termino_indice: 1, termino: 'segundo', pagina_confirmada: 0, pagina_siguiente: 1, item_offset: 0 });
});
test('timeout aborta la lectura del cuerpo y cancelación conserva estado explícito', async () => {
    let signal;
    const datos = await ejecutarScrapingGetonbrd({ ...opciones(async (_url, control) => {
        signal = control.signal;
        return { ok: true, json: () => new Promise(() => {}) };
    }), timeoutMs: 1 });
    expect(signal.aborted).toBe(true);
    expect(datos.metricas).toMatchObject({ estado: 'timeout', errores: [{ tipo: 'timeout' }] });
    const cancelador = new AbortController();
    cancelador.abort();
    const cliente = jest.fn();
    const cancelado = await ejecutarScrapingGetonbrd({ ...opciones(cliente), signal: cancelador.signal });
    expect(cancelado.metricas.estado).toBe('cancelada');
    expect(cliente).not.toHaveBeenCalled();
});
