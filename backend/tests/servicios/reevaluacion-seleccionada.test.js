jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn(),
}));
jest.mock('../../src/modelos/preferencia', () => ({
    ...jest.requireActual('../../src/modelos/preferencia'), obtenerPreferencias: jest.fn(),
}));
jest.mock('../../src/modelos/evaluacion-lote', () => ({
    crearLote: jest.fn().mockResolvedValue({ id: 1 }),
    actualizarProgreso: jest.fn().mockResolvedValue(), finalizarLote: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/utils/bloqueo-concurrente', () => ({
    CLAVES: { EVALUACION_OFERTAS: 10001 }, intentarAdquirirLock: jest.fn(),
    liberarBloqueoSeguro: jest.fn().mockResolvedValue(),
}));
const pool = require('../../src/config/base-datos');
const proveedor = require('../../src/config/deepseek');
const preferencias = require('../../src/modelos/preferencia');
const ofertas = require('../../src/modelos/oferta');
const servicio = require('../../src/servicios/servicio-evaluacion');
const controlador = require('../../src/controladores/controlador-evaluacion');
const bloqueo = require('../../src/utils/bloqueo-concurrente');
let filas;
let registros;
let perfil;
let trabajo;
const reciente = fila => Date.now() - new Date(fila.fecha_extraccion).getTime() <= 30 * 86400000;
function respuesta() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}
async function ejecutar(body) {
    const res = respuesta();
    await controlador.ejecutarEvaluacion({ body }, res);
    if (trabajo) await trabajo;
    return res;
}
beforeEach(() => {
    jest.clearAllMocks();
    trabajo = null;
    perfil = { nombre: 'Perfil confirmado', nivel_experiencia: 'junior', stack_tecnologico: ['TypeScript'], zonas_preferidas: [], modelo_ia: 'deepseek-v4-flash' };
    preferencias.obtenerPreferencias.mockImplementation(async () => perfil);
    registros = new Map();
    filas = [1, 2, 3].map(id => ({ id, titulo: `Desarrollo junior ${id}`, descripcion: 'TypeScript', modalidad: 'remoto', estado_evaluacion: 'pendiente', estado_postulacion: ['descartada', 'cv_enviado', 'en_proceso'][id - 1], notas: 'Conservo mi nota', fecha_extraccion: new Date(Date.now() - (id === 3 ? 31 : 1) * 86400000).toISOString() }));
    proveedor.consultarDeepSeek.mockResolvedValue('{"match":true,"porcentaje":80,"razon":"Resultado actualizado"}');
    bloqueo.intentarAdquirirLock.mockResolvedValue({ ok: true, client: {} });
    const real = servicio.evaluarOfertasPendientes;
    jest.spyOn(servicio, 'evaluarOfertasPendientes').mockImplementation((...args) => {
        trabajo = real(...args);
        return trabajo;
    });
    pool.query.mockImplementation(async (sql, valores = []) => {
        if (sql.includes('SELECT * FROM preferencias')) return { rows: [structuredClone(perfil)] };
        if (sql.includes('UPDATE preferencias')) {
            for (const coincidencia of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                const campo = coincidencia[1];
                if (campo !== 'id') perfil[campo] = valores[Number(coincidencia[2]) - 1];
            }
            return { rows: [structuredClone(perfil)] };
        }
        if (sql.includes('SELECT COUNT(*)')) return { rows: [{ total: filas.filter(reciente).length }] };
        if (sql.includes('SELECT resultado')) return { rows: registros.has(JSON.stringify(valores)) ? [{ resultado: registros.get(JSON.stringify(valores)) }] : [] };
        if (sql.includes('INSERT INTO evaluaciones_cache')) {
            registros.set(JSON.stringify(valores.slice(0, 3)), JSON.parse(valores[3]));
            return { rows: [] };
        }
        if (sql.includes('SELECT * FROM ofertas')) {
            let datos = filas;
            if (sql.includes('30 days')) datos = datos.filter(reciente);
            if (sql.includes('ANY')) datos = datos.filter(fila => valores[0].includes(fila.id));
            if (sql.includes("estado_evaluacion = 'pendiente'")) datos = datos.filter(fila => fila.estado_evaluacion === 'pendiente');
            return { rows: structuredClone(datos) };
        }
        if (sql.includes("SET estado_evaluacion = 'pendiente'")) {
            const campoFecha = sql.includes('AND fecha_extraccion') ? 'fecha_extraccion' : 'fecha_evaluacion';
            const datos = filas.filter(fila => ['aprobada', 'rechazada'].includes(fila.estado_evaluacion) && Date.now() - new Date(fila[campoFecha]).getTime() <= valores[0] * 86400000);
            for (const fila of datos) {
                for (const [, campo] of sql.matchAll(/(\w+)\s*=\s*NULL/g)) fila[campo] = null;
                Object.assign(fila, { estado_evaluacion: 'pendiente', evaluacion_error_mensaje: sql.includes('REEVALUACION_SOLICITADA') ? 'REEVALUACION_SOLICITADA' : null });
            }
            return { rows: datos };
        }
        if (sql.includes('UPDATE ofertas')) {
            const fila = filas.find(fila => fila.id === valores[3]);
            Object.assign(fila, { estado_evaluacion: valores[0], razon_evaluacion: valores[1], porcentaje_match: valores[2], evaluacion_error_mensaje: valores[4], firma_criterios_evaluacion: valores[9] });
            return { rows: [fila] };
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    });
});
afterEach(() => jest.restoreAllMocks());

test('pendientes normales no incluyen extracción histórica', async () => {
    const resultado = await servicio.evaluarOfertasPendientes();
    expect(resultado.total).toBe(2);
    expect(filas[2].estado_evaluacion).toBe('pendiente');
});

test.each([[1], [1, 2]])('selección %j fuerza caché, reemplaza resultado y conserva estados manuales', async (...ids) => {
    for (const fila of filas.slice(0, 2)) {
        await servicio.evaluarOferta(fila);
        fila.estado_evaluacion = 'rechazada';
    }
    proveedor.consultarDeepSeek.mockClear();
    proveedor.consultarDeepSeek.mockResolvedValue('{"match":false,"porcentaje":30,"razon":"Nuevo rechazo técnico"}');
    const res = await ejecutar({ ids, preferencias: { nombre: 'No guardado' } });
    expect(res.json.mock.calls[0][0]).toMatchObject({ exito: true, cantidad: ids.length, periodo_dias: 30 });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(ids.length);
    for (const id of ids) {
        const fila = filas.find(fila => fila.id === id);
        expect(fila.razon_evaluacion).toBe('Nuevo rechazo técnico');
        expect(fila.estado_postulacion).toBe(id === 1 ? 'descartada' : 'cv_enviado');
        expect(fila.notas).toBe('Conservo mi nota');
        expect((await servicio.evaluarOferta(fila)).razon).toBe('Nuevo rechazo técnico');
    }
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(ids.length);
    expect(bloqueo.liberarBloqueoSeguro).toHaveBeenCalledTimes(1);
});

test.each([[], [1, 1], ['1'], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1], null, '1', Array.from({ length: 201 }, (_, i) => i + 1), [1, 3], [1, 999]].map(ids => ({ ids })))('rechazo atómico de selección inválida $ids', async ({ ids }) => {
    const res = await ejecutar({ ids });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(filas.every(fila => fila.estado_evaluacion === 'pendiente')).toBe(true);
});

test('acepto exactamente 200 IDs y paso el array completo al modelo pg', async () => {
    filas = Array.from({ length: 200 }, (_, indice) => ({ ...filas[0], id: indice + 1 }));
    const ids = filas.map(fila => fila.id);
    expect(await ofertas.obtenerOfertasSeleccionadas(ids)).toHaveLength(200);
    expect(pool.query.mock.calls[0][1]).toEqual([ids]);
});

test('rechazo un conteo inesperado sin iniciar una selección parcial', async () => {
    pool.query.mockResolvedValueOnce({ rows: [filas[0], filas[0]] });
    const res = await ejecutar({ ids: [1, 2] });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(bloqueo.liberarBloqueoSeguro).toHaveBeenCalledTimes(1);
});

test('snapshot guardado único, cancelación entre ofertas y progreso del worker existente', async () => {
    proveedor.consultarDeepSeek.mockImplementation(async instrucciones => {
        expect(instrucciones).toContain('Perfil confirmado');
        expect(instrucciones).not.toContain('No guardado');
        perfil.nombre = 'Cambio posterior';
        expect(servicio.obtenerProgresoEvaluacion()).toMatchObject({ activo: true, total: 2 });
        servicio.cancelarEvaluacionPendiente();
        return '{"match":true,"porcentaje":80,"razon":"Compatible"}';
    });
    await ejecutar({ ids: [1, 2], preferencias: { nombre: 'No guardado' } });
    expect(preferencias.obtenerPreferencias).toHaveBeenCalledTimes(1);
    expect(servicio.obtenerProgresoEvaluacion()).toMatchObject({ activo: false, total: 2, evaluadas: 1, porcentaje: 50 });
    expect(filas[1].estado_evaluacion).toBe('pendiente');
});

test('el mismo snapshot guardado se mantiene aunque cambie el perfil durante el lote', async () => {
    proveedor.consultarDeepSeek.mockImplementation(async () => {
        perfil.nombre = 'Edición posterior al inicio';
        perfil.stack_tecnologico.push('Cambio posterior');
        return '{"match":true,"porcentaje":80,"razon":"Compatible"}';
    });
    await ejecutar({ ids: [1, 2], nombre: 'No guardado' });
    expect(preferencias.obtenerPreferencias).toHaveBeenCalledTimes(1);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(proveedor.consultarDeepSeek.mock.calls[0][0]).toBe(proveedor.consultarDeepSeek.mock.calls[1][0]);
    expect(proveedor.consultarDeepSeek.mock.calls[1][0]).not.toContain('Edición posterior al inicio');
    expect(filas[0].firma_criterios_evaluacion).toBe(filas[1].firma_criterios_evaluacion);
});

test('guardar perfil → listar vigencia → seleccionar IDs → reevaluar conserva datos manuales', async () => {
    const controladorPerfil = require('../../src/controladores/controlador-preferencias');
    const controladorOfertas = require('../../src/controladores/controlador-ofertas');
    await servicio.evaluarOfertasPendientes();
    proveedor.consultarDeepSeek.mockClear();
    const guardado = respuesta();
    await controladorPerfil.actualizarPreferencias({ body: { perfil_profesional: 'Proyecto confirmado de aplicaciones web', anios_experiencia_reales: 0 } }, guardado);
    expect(guardado.json.mock.calls[0][0]).toMatchObject({ exito: true, cambio_criterios: true });
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    const listado = respuesta();
    await controladorOfertas.listarOfertas({ query: {} }, listado);
    const datos = listado.json.mock.calls[0][0].datos;
    expect(datos).toHaveLength(2);
    expect(datos.every(fila => fila.vigencia_evaluacion === 'anterior')).toBe(true);
    const ids = datos.map(fila => fila.id);
    await ejecutar({ ids, perfil_profesional: 'NO GUARDADO', forzar: false });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(proveedor.consultarDeepSeek.mock.calls.every(([texto]) => texto.includes('Proyecto confirmado de aplicaciones web') && !texto.includes('NO GUARDADO'))).toBe(true);
    const nuevoListado = respuesta();
    await controladorOfertas.listarOfertas({ query: {} }, nuevoListado);
    expect(nuevoListado.json.mock.calls[0][0].datos.every(fila => fila.vigencia_evaluacion === 'actual')).toBe(true);
    expect(filas.slice(0, 2).map(fila => fila.estado_postulacion)).toEqual(['descartada', 'cv_enviado']);
    expect(filas.every(fila => fila.notas === 'Conservo mi nota')).toBe(true);
    expect(filas[2].estado_evaluacion).toBe('pendiente');
});

test.each(['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'])('selecciono cualquier estado manual: %s', async estado => {
    filas[0].estado_evaluacion = 'aprobada';
    filas[0].estado_postulacion = estado;
    await ejecutar({ ids: [1] });
    expect(filas[0].estado_postulacion).toBe(estado);
    expect(filas[0].notas).toBe('Conservo mi nota');
});

test('error técnico no descarta manualmente y libera el mutex', async () => {
    proveedor.consultarDeepSeek.mockRejectedValueOnce(new Error('Fallo sintético'));
    filas[0].estado_postulacion = 'no_postulado';
    await ejecutar({ ids: [1] });
    expect(filas[0]).toMatchObject({ estado_evaluacion: 'rechazada', estado_postulacion: 'no_postulado', firma_criterios_evaluacion: null });
    expect(servicio.obtenerProgresoEvaluacion()).toMatchObject({ activo: false, errores: 1 });
    expect(bloqueo.liberarBloqueoSeguro).toHaveBeenCalledTimes(1);
});

test('fallo al validar selección libera el mutex sin ejecutar proveedor', async () => {
    pool.query.mockRejectedValueOnce(new Error('PG sintético no disponible'));
    await expect(ejecutar({ ids: [1] })).rejects.toThrow('PG sintético no disponible');
    expect(bloqueo.liberarBloqueoSeguro).toHaveBeenCalledTimes(1);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test('mutex ocupado no inicia selección ni proveedor', async () => {
    bloqueo.intentarAdquirirLock.mockResolvedValue({ ok: false });
    const res = await ejecutar({ ids: [1] });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test('reset no compite con un worker activo', async () => {
    filas[0].estado_evaluacion = 'aprobada';
    bloqueo.intentarAdquirirLock.mockResolvedValue({ ok: false });
    const res = respuesta();
    await controlador.resetearEvaluaciones({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(filas[0].estado_evaluacion).toBe('aprobada');
});

test('reset con días explícitos filtra extracción y limpia firma sin alterar campos manuales', async () => {
    filas[0].estado_evaluacion = 'aprobada';
    filas[0].fecha_evaluacion = new Date(Date.now() - 90 * 86400000).toISOString();
    filas[0].firma_criterios_evaluacion = 'anterior';
    filas[1].estado_evaluacion = 'aprobada';
    filas[1].fecha_extraccion = new Date(Date.now() - 10 * 86400000).toISOString();
    const res = respuesta();
    await controlador.resetearEvaluaciones({ body: { dias: 7 } }, res);
    expect(res.json.mock.calls[0][0].datos.reseteadas).toBe(1);
    expect(filas[0]).toMatchObject({ estado_evaluacion: 'pendiente', firma_criterios_evaluacion: null, fecha_evaluacion: null, razon_evaluacion: null, porcentaje_match: null, estado_postulacion: 'descartada' });
    expect(filas[1].estado_evaluacion).toBe('aprobada');
    expect(bloqueo.liberarBloqueoSeguro).toHaveBeenCalledTimes(1);
});

test('reset explícito marca fuerza, no toca historia y vuelve a reemplazar caché', async () => {
    await servicio.evaluarOfertasPendientes();
    filas[2].estado_evaluacion = 'aprobada';
    const res = respuesta();
    await controlador.resetearEvaluaciones({ body: {} }, res);
    expect(res.json.mock.calls[0][0].datos.reseteadas).toBe(2);
    expect(filas[2].estado_evaluacion).toBe('aprobada');
    expect(filas[0].firma_criterios_evaluacion).toBeNull();
    proveedor.consultarDeepSeek.mockClear();
    await servicio.evaluarOfertasPendientes();
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(filas[0].evaluacion_error_mensaje).toBeNull();
    expect(filas[0].estado_postulacion).toBe('descartada');
});
