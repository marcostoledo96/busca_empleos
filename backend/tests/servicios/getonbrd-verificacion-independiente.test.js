jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
const fs = require('fs');
const { createHash } = require('crypto');
const cfg = require('../../src/config/getonbrd');
const { ejecutarScrapingGetonbrd: ejecutar } = require('../../src/servicios/servicio-scraping');
const { ejecutarFuente, conHistorial } = require('../../src/servicios/servicio-resultados-fuente');
const { resolverConfiguracion: resolver } = require('../../src/servicios/servicio-configuracion-busqueda');
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/oferta');
const historial = require('../../src/modelos/ejecucion-busqueda');
const ahora = new Date('2026-10-18T12:00:00Z');
const item = (id, dias = 1) => ({ id, attributes: { title: 'Desarrollador junior', description: 'Buscamos una persona para nuestro equipo de desarrollo.', published_at: (+ahora - dias * 86400000) / 1000 }, links: { public_url: `https://www.getonbrd.com/jobs/${id}` } });
const respuesta = (data, total_pages = 1) => ({ ok: true, status: 200, json: async () => ({ data, meta: { total_pages } }) });
const opciones = cliente => ({ destino: cfg.DESTINO_SANDBOX, cliente, ahora, terminos: ['C# junior'] });
beforeEach(() => { pool.reiniciar(); delete process.env.GETONBRD_ENABLED; });
afterEach(() => jest.restoreAllMocks());
// S3-S4: la guarda usa bytes conservados y rechaza destinos antes del HTTP.
test('los cinco documentos conservados coinciden en bytes y SHA256', () => {
    for (const d of cfg.EVIDENCIA_AUTORIZACION.documentos) {
        const bytes = fs.readFileSync(require('path').join(__dirname, '../../src/config/evidencias/getonbrd', d.archivo));
        expect(bytes.length).toBe(d.bytes);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(d.sha256);
    }
    expect(cfg.validarDestinoGetonbrd({ habilitado: true, ahora })).toEqual({ permitido: true, destino: 'produccion', motivo: null });
});
test.each(['http://www.getonbrd.com/api/v0', 'https://www.getonbrd.com:444/api/v0', 'https://u:p@www.getonbrd.com/api/v0', 'https://www.getonbrd.com.evil.test/api/v0', 'https://www.getonbrd.com/api/v0/../private', 'https://www.getonbrd.com/api/v0#x'])('rechazo %s sin HTTP ni escrituras', async destino => {
    const cliente = jest.fn();
    const antes = createHash('sha256').update(JSON.stringify(pool.ofertas)).digest('hex');
    const r = await ejecutar({ destino, habilitado: true, cliente, ahora });
    expect(r.metricas.estado).toBe('deshabilitada');
    expect(r.metricas.motivoFinalizacion).toBe('politica_destino');
    expect(cliente).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
    expect(createHash('sha256').update(JSON.stringify(pool.ofertas)).digest('hex')).toBe(antes);
});
test.each([false, 'true', 1, null])('no habilito con %s', async habilitado => {
    const cliente = jest.fn();
    const r = await ejecutar({ habilitado, cliente, ahora });
    expect(r.metricas.estado).toBe('deshabilitada');
    expect(cliente).not.toHaveBeenCalled();
});
test.each([{ scope: ['GET /api/v0/private'] }, { received_at: '2099-01-01' }, { valid_until: 'incorrecta' }, { documentos: [] }, { allowed_host: 'https://evil.test' }])('rechazo evidencia %j', cambio => {
    expect(cfg.validarDestinoGetonbrd({ habilitado: true, ahora, evidencia: { ...cfg.EVIDENCIA_AUTORIZACION, ...cambio } }).permitido).toBe(false);
});
// S5-S6: respuestas vacías, fallas, presupuestos, ventana y checkpoint.
test('respeto término literal, página1, per_page y no sigo redirects', async () => {
    const cliente = jest.fn().mockResolvedValue(respuesta([]));
    const r = await ejecutar({ ...opciones(cliente), porPagina: 3, maxPeticiones: 1 });
    expect(cliente.mock.calls[0][0]).toBe(`${cfg.DESTINO_SANDBOX}/search/jobs?query=C%23%20junior&page=1&per_page=3`);
    expect(cliente.mock.calls[0][1].redirect).toBe('error');
    expect(r.metricas.estado).toBe('sin_resultados');
    expect(Array.isArray(r)).toBe(true);
});
test.each([302, 401, 429, 503])('HTTP %s no se convierte en vacío exitoso ni se reintenta', async status => {
    const cliente = jest.fn().mockResolvedValue({ ok: false, status });
    const r = await ejecutar(opciones(cliente));
    expect(r.metricas.estado).toBe('error');
    expect(r.metricas.errores).toEqual([{ tipo: status === 429 ? 'limite_solicitudes' : 'http', codigoHttp: status }]);
    expect(cliente).toHaveBeenCalledTimes(1);
    expect(r.checkpoint.pagina_siguiente).toBe(1);
});
test('conservo página válida ante error y reanudo exactamente desde la fallida', async () => {
    const cliente = jest.fn().mockResolvedValueOnce(respuesta([item('uno')], 2)).mockResolvedValue({ ok: false, status: 429 });
    const r = await ejecutar(opciones(cliente));
    expect(r.metricas.estado).toBe('parcial');
    expect(r).toHaveLength(1);
    const siguiente = jest.fn().mockResolvedValue(respuesta([item('dos')], 2));
    const reanudada = await ejecutar({ ...opciones(siguiente), checkpointInicial: r.checkpoint });
    expect(siguiente.mock.calls[0][0]).toContain('page=2&');
    expect(reanudada[0].url).toContain('/dos');
});
test('ventana exacta de 30 días y duplicada no gastan cupo', async () => {
    const cliente = jest.fn().mockResolvedValue(respuesta([item('antigua', 30.001), item('limite', 30), item('limite', 30), item('nueva')]));
    const r = await ejecutar({ ...opciones(cliente), maxResultados: 2 });
    expect(r.map(o => o.url)).toEqual(['https://www.getonbrd.com/jobs/limite', 'https://www.getonbrd.com/jobs/nueva']);
    expect(r.metricas).toMatchObject({ antiguasDescartadas: 1, duplicadasDescartadas: 1 });
});
test('cupo interrumpido guarda offset y reanuda sin perder el segundo item', async () => {
    const cliente = jest.fn().mockResolvedValue(respuesta([item('uno'), item('dos')]));
    const r = await ejecutar({ ...opciones(cliente), maxResultados: 1 });
    expect(r.metricas.estado).toBe('parcial');
    const siguiente = await ejecutar({ ...opciones(cliente), checkpointInicial: r.checkpoint });
    expect(siguiente.map(o => o.url)).toEqual(['https://www.getonbrd.com/jobs/dos']);
});
test('timeout real aborta transporte simulado y cancelación previa no hace HTTP', async () => {
    let abortada = false;
    const cliente = (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => { abortada = true; reject(Error('abort')); }));
    const r = await ejecutar({ ...opciones(cliente), timeoutMs: 5 });
    expect(abortada).toBe(true);
    expect(r.metricas.estado).toBe('timeout');
    const control = new AbortController(); control.abort();
    const prohibido = jest.fn();
    const cancelada = await ejecutar({ ...opciones(prohibido), signal: control.signal });
    expect(cancelada.metricas.estado).toBe('cancelada');
    expect(prohibido).not.toHaveBeenCalled();
});
test('resolver rechaza cupo cero y lista vacía sin escribir datos', () => {
    expect(() => resolver('getonbrd', { maxResultados: 0 })).toThrow('maxResultados debe ser un entero entre 1 y 500.');
    expect(() => resolver('getonbrd', { terminos: [] })).toThrow('Necesito términos de búsqueda no vacíos; no los sustituyo por defaults.');
    expect(pool.query).not.toHaveBeenCalled();
});
// S2,S5,S8: ingreso/listado/historial reales con PostgreSQL sintético.
test('flujo común conserva parcial y datos válidos en listado e historial sin HTTP externo', async () => {
    process.env.GETONBRD_ENABLED = 'true';
    const cliente = jest.fn().mockResolvedValueOnce(respuesta([item('persistida')], 2)).mockResolvedValue({ ok: false, status: 503 });
    const r = await conHistorial('individual', async () => {
        const fuente = await ejecutarFuente('getonbrd', ejecutar, opciones(cliente));
        return { estado: fuente.estado, fuentes: [fuente] };
    });
    expect(r.fuentes[0]).toMatchObject({ nuevas: 1, estado: 'parcial', peticionesRealizadas: 2 });
    expect((await modelo.obtenerOfertas({ plataforma: 'getonbrd' })).ofertas[0].url).toBe('https://www.getonbrd.com/jobs/persistida');
    expect((await historial.listar())[0].resumen.fuentes[0]).toMatchObject({ estado: 'parcial', checkpoint: { pagina_siguiente: 2 } });
    const sql = pool.query.mock.calls.find(([texto]) => texto.includes('ON CONFLICT (identidad_canonica)'))[0];
    const update = sql.split('DO UPDATE SET')[1].split('RETURNING')[0];
    expect(update).not.toMatch(/(?:estado_postulacion|fecha_postulacion|nota_postulacion)\s*=/);
});

// S2,S4,S5,S10: contrato del controlador con HTTP inyectado global y sin servidor.
test('búsqueda individual usa el término guardado, persiste y retorna el mismo resumen común', async () => {
    process.env.GETONBRD_ENABLED = 'true';
    const http = jest.spyOn(global, 'fetch').mockResolvedValue(respuesta([item('individual')]));
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await require('../../src/controladores/controlador-scraping').scrapearGetonbrd({ body: {} }, res);
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0]).toContain('query=anterior&page=1&per_page=20');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ exito: true, datos: { plataforma: 'getonbrd', ofertas_nuevas: 1, fuente: { estado: 'completada', nuevas: 1 } } });
});
test('opción que intenta alterar destino falla antes de HTTP/historial y preserva estado', async () => {
    process.env.GETONBRD_ENABLED = 'true';
    const http = jest.spyOn(global, 'fetch').mockRejectedValue(Error('HTTP prohibido'));
    const antes = createHash('sha256').update(JSON.stringify(pool.ofertas)).digest('hex');
    await expect(require('../../src/controladores/controlador-scraping').scrapearGetonbrd({ body: { destino: 'https://evil.test' } }, {})).rejects.toMatchObject({ statusCode: 400, message: 'Recibí opciones de búsqueda no reconocidas.' });
    expect(http).not.toHaveBeenCalled(); expect(pool.query).not.toHaveBeenCalled();
    expect(createHash('sha256').update(JSON.stringify(pool.ofertas)).digest('hex')).toBe(antes);
});
test('el ingreso común mantiene nuevas, actualizadas, reapariciones, duplicadas y fallas aisladas', async () => {
    process.env.GETONBRD_ENABLED = 'true';
    jest.spyOn(modelo, 'crearOferta').mockResolvedValueOnce({ es_nueva: true }).mockResolvedValueOnce({ fue_actualizada: true })
        .mockResolvedValueOnce({ es_reaparicion: true }).mockResolvedValueOnce({ es_nueva: false }).mockRejectedValueOnce(Error('fallo sintético'));
    const cliente = jest.fn().mockResolvedValue(respuesta(['nueva', 'actualizada', 'reaparece', 'duplicada', 'fallida'].map(id => item(id))));
    const r = await ejecutarFuente('getonbrd', ejecutar, opciones(cliente));
    expect(r).toMatchObject({ nuevas: 1, actualizadas: 1, reapariciones: 1, duplicadas: 3, erroresGuardado: 1, estado: 'parcial' });
});
