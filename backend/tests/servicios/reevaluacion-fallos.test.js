jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn(), DEEPSEEK_MODELO: 'deepseek-v4-flash' }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
const pool = require('../../src/config/base-datos');
const proveedor = require('../../src/config/deepseek');
const preferencias = require('../../src/modelos/preferencia');
const ofertas = require('../../src/modelos/oferta');
const servicio = require('../../src/servicios/servicio-evaluacion');
const controlador = require('../../src/controladores/controlador-evaluacion');
const lotes = require('../../src/modelos/evaluacion-lote');
let filas, cache, lote, propietario, fallarId, fallarFinal, fallarCache, escrituras, clientes;
const respuesta = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const pausa = () => new Promise(resolve => setImmediate(resolve));
async function iniciar(ids = [1, 2]) {
    const res = respuesta();
    await controlador.ejecutarEvaluacion({ body: { ids, preferencias: { nombre: 'No guardado' } } }, res);
    for (let i = 0; i < 100 && propietario; i++) await pausa();
    expect(propietario).toBeNull();
    return res;
}
function progreso() {
    const res = respuesta();
    controlador.obtenerProgresoEvaluacion({}, res);
    return res.json.mock.calls[0][0].datos;
}
beforeEach(() => {
    jest.clearAllMocks();
    fallarId = null; fallarFinal = false; fallarCache = false; propietario = null;
    cache = new Map(); escrituras = []; clientes = []; lote = null;
    filas = [1, 2].map(id => ({
        id, titulo: `Desarrollo TypeScript junior ${id}`, descripcion: `Aplicaciones web ${id}`, modalidad: 'remoto',
        fecha_extraccion: new Date(Date.now() - 86400000).toISOString(),
        estado_evaluacion: 'aprobada', razon_evaluacion: 'Resultado anterior válido', porcentaje_match: 81,
        fecha_evaluacion: '2026-01-01T00:00:00.000Z', firma_criterios_evaluacion: 'firma anterior',
        prioridad_ia: true, puntaje_prioridad_ia: 3, evidencias_prioridad_ia: ['Copilot'], version_prioridad_ia: 'anterior',
        evaluacion_error_mensaje: null, estado_postulacion: 'cv_enviado', notas: 'Nota intacta',
        datos_originales: { texto: 'Conservo JSON original' },
    }));
    preferencias.obtenerPreferencias.mockResolvedValue({ nombre: 'Perfil guardado', stack_tecnologico: ['TypeScript'], zonas_preferidas: [] });
    proveedor.consultarDeepSeek.mockResolvedValue('{"match":true,"porcentaje":90,"razon":"Resultado nuevo"}');
    pool.connect.mockImplementation(async () => {
        const cliente = { release: jest.fn(), query: jest.fn(async sql => {
            if (sql.includes('pg_try_advisory_lock')) {
                const ok = propietario === null;
                if (ok) propietario = cliente;
                return { rows: [{ ok }] };
            }
            if (propietario === cliente) propietario = null;
            return { rows: [] };
        }) };
        clientes.push(cliente);
        return cliente;
    });
    pool.query.mockImplementation(async (sql, valores = []) => {
        if (sql.includes('SELECT * FROM ofertas')) return { rows: structuredClone(filas.filter(fila => valores[0].includes(fila.id))) };
        if (sql.includes('SELECT resultado')) return { rows: cache.has(JSON.stringify(valores)) ? [{ resultado: structuredClone(cache.get(JSON.stringify(valores))) }] : [] };
        if (sql.includes('INSERT INTO evaluaciones_cache')) {
            if (fallarCache) throw new Error('Caché sintética no disponible');
            escrituras.push('cache');
            cache.set(JSON.stringify(valores.slice(0, 3)), JSON.parse(valores[3]));
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO evaluacion_lotes')) {
            lote = { id: 1, estado: 'activo', total: valores[0], evaluadas: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 };
            return { rows: [structuredClone(lote)] };
        }
        if (sql.includes('SELECT * FROM evaluacion_lotes')) return { rows: lote ? [structuredClone(lote)] : [] };
        if (sql.includes('UPDATE evaluacion_lotes')) {
            if (fallarFinal && sql.includes('finalizado_en')) { fallarFinal = false; throw new Error('Fallo final sintético'); }
            for (const [, campo, parametro] of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                if (campo !== 'id') lote[campo] = valores[Number(parametro) - 1];
            }
            return { rows: [] };
        }
        if (sql.includes("SET estado_evaluacion = 'pendiente'")) {
            const recientes = filas.filter(fila => Date.now() - new Date(fila.fecha_extraccion).getTime() <= valores[0] * 86400000);
            recientes.forEach(fila => {
                for (const [, campo] of sql.matchAll(/(\w+)\s*=\s*NULL/g)) fila[campo] = null;
                fila.estado_evaluacion = 'pendiente'; fila.evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA';
            });
            return { rows: structuredClone(recientes) };
        }
        if (sql.includes('UPDATE ofertas')) {
            const indiceId = Number(sql.match(/WHERE id = \$(\d+)/)[1]) - 1;
            const fila = filas.find(fila => fila.id === valores[indiceId]);
            if (fila.id === fallarId) throw new Error('Fallo UPDATE sintético');
            for (const [, campo, parametro] of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                if (campo !== 'id') fila[campo] = sql.includes(`${campo} = $${parametro}::jsonb`) ? JSON.parse(valores[Number(parametro) - 1]) : valores[Number(parametro) - 1];
            }
            if (sql.includes('fecha_evaluacion = NOW()')) fila.fecha_evaluacion = '2026-05-01T00:00:00.000Z';
            escrituras.push(`oferta${fila.id}`);
            return { rows: [structuredClone(fila)] };
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    });
});

test.each(['timeout', 'JSON inválido'])('B01 %s conserva todos los campos del resultado previo y permite recuperar caché', async fallo => {
    await servicio.evaluarOferta(filas[0]);
    const cacheAnterior = structuredClone([...cache]);
    const anterior = structuredClone(filas[0]);
    if (fallo === 'timeout') proveedor.consultarDeepSeek.mockRejectedValueOnce(new Error('Timeout sintético'));
    else proveedor.consultarDeepSeek.mockResolvedValueOnce('JSON inválido');
    await iniciar([1]);
    expect({ ...filas[0], evaluacion_error_mensaje: null }).toEqual(anterior);
    expect(filas[0].evaluacion_error_mensaje).toBeTruthy();
    const actualizaciones = pool.query.mock.calls.filter(([sql]) => sql.includes('UPDATE ofertas'));
    expect(actualizaciones).toHaveLength(1);
    expect(actualizaciones[0][0]).toBe('UPDATE ofertas SET evaluacion_error_mensaje = $1 WHERE id = $2 RETURNING *');
    expect([...cache]).toEqual(cacheAnterior);
    expect(progreso()).toMatchObject({ activo: false, estado: 'error', evaluadas: 0, procesadas: 1, pendientes: 1, errores: 1 });
    expect(proveedor.consultarDeepSeek.mock.calls.every(([texto]) => texto.includes('Perfil guardado') && !texto.includes('No guardado'))).toBe(true);
    await iniciar([1]);
    expect(filas[0]).toMatchObject({ estado_evaluacion: 'aprobada', razon_evaluacion: 'Resultado nuevo', evaluacion_error_mensaje: null });
    expect(filas[0].firma_criterios_evaluacion).not.toBe(anterior.firma_criterios_evaluacion);
    expect(filas[0].fecha_evaluacion).not.toBe(anterior.fecha_evaluacion);
    const llamadas = proveedor.consultarDeepSeek.mock.calls.length;
    expect((await servicio.evaluarOferta(filas[0])).porcentaje).toBe(90);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(llamadas);
});

test.each(['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'])('B01 conserva decisión manual %s y rechazo válido previo', async estado => {
    Object.assign(filas[0], { estado_postulacion: estado, estado_evaluacion: 'rechazada' });
    const anterior = structuredClone(filas[0]);
    proveedor.consultarDeepSeek.mockRejectedValueOnce(new Error('Timeout sintético'));
    await iniciar([1]);
    expect({ ...filas[0], evaluacion_error_mensaje: null }).toEqual(anterior);
});

test.each([1, 2])('B02 UPDATE %s falla: no consolido caché, persisto error y contadores reales, libero mutex y reintento', async id => {
    const anterior = structuredClone(filas);
    fallarId = id;
    await iniciar();
    expect(filas[id - 1]).toEqual(anterior[id - 1]);
    expect(cache.size).toBe(id - 1);
    expect(escrituras).toEqual(id === 1 ? [] : ['oferta1', 'cache']);
    expect(progreso()).toMatchObject({ activo: false, estado: 'error', evaluadas: id - 1, pendientes: 3 - id, mensaje_error: 'Fallo UPDATE sintético' });
    expect(lote).toMatchObject({ estado: 'error', evaluadas: id - 1 });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(id);
    for (const cliente of clientes) expect(cliente.release).toHaveBeenCalledTimes(1);
    await servicio.rehidratarProgreso();
    expect(progreso()).toMatchObject({ activo: false, estado: 'error', evaluadas: id - 1, pendientes: 3 - id });
    fallarId = null;
    await iniciar();
    expect(progreso()).toMatchObject({ estado: 'completado', evaluadas: 2, pendientes: 0, mensaje_error: null });
});

test('B02 UPDATE fallido tampoco reemplaza una caché válida existente', async () => {
    await servicio.evaluarOferta(filas[0]);
    const cacheAnterior = structuredClone([...cache]);
    const anterior = structuredClone(filas[0]);
    escrituras = [];
    fallarId = 1;
    proveedor.consultarDeepSeek.mockResolvedValueOnce('{"match":false,"porcentaje":10,"razon":"No persistido"}');
    await iniciar();
    expect(filas[0]).toEqual(anterior);
    expect([...cache]).toEqual(cacheAnterior);
    expect(escrituras).toEqual([]);
    const llamadas = proveedor.consultarDeepSeek.mock.calls.length;
    expect((await servicio.evaluarOferta(filas[0])).razon).toBe('Resultado nuevo');
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(llamadas);
});

test('B01 pendiente sin resultado válido mantiene rechazo técnico separado del estado manual', async () => {
    Object.assign(filas[0], { estado_evaluacion: 'pendiente', fecha_evaluacion: null, razon_evaluacion: null,
        firma_criterios_evaluacion: null, evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA' });
    proveedor.consultarDeepSeek.mockRejectedValueOnce(new Error('Timeout pendiente'));
    await iniciar([1]);
    expect(filas[0]).toMatchObject({ estado_evaluacion: 'rechazada', estado_postulacion: 'cv_enviado',
        firma_criterios_evaluacion: null, evaluacion_error_mensaje: expect.stringContaining('Timeout pendiente') });
    expect(cache.size).toBe(0);
    expect(progreso()).toMatchObject({ evaluadas: 0, procesadas: 1, pendientes: 1, errores: 1 });
});

test('B02 una falla del snapshot final informa error aunque no pueda persistir contadores', async () => {
    const consulta = pool.query.getMockImplementation();
    pool.query.mockImplementation(async (sql, valores) => {
        if (sql.includes('UPDATE evaluacion_lotes') && sql.includes('SET evaluadas')) throw new Error('Fallo snapshot sintético');
        return consulta(sql, valores);
    });
    await iniciar();
    expect(progreso()).toMatchObject({ activo: false, estado: 'error', evaluadas: 2, pendientes: 0, mensaje_error: 'Fallo snapshot sintético' });
    expect(lote.estado).toBe('error');
    expect(lote.evaluadas).toBe(0); // No invento durabilidad del snapshot fallido.
});

test('B02 una finalización SQL fallida tampoco comunica éxito', async () => {
    fallarFinal = true;
    await iniciar();
    expect(progreso()).toMatchObject({ activo: false, estado: 'error', evaluadas: 2, pendientes: 0, mensaje_error: 'Fallo final sintético' });
    expect((await lotes.obtenerUltimoLote()).estado).toBe('error');
});

test('B02 caché opcional fallida no revierte resultado persistido ni contadores', async () => {
    fallarCache = true;
    await iniciar();
    expect(filas.every(fila => fila.razon_evaluacion === 'Resultado nuevo')).toBe(true);
    expect(progreso()).toMatchObject({ estado: 'completado', evaluadas: 2, pendientes: 0 });
    expect(cache.size).toBe(0);
});

test('B03 reset 90 rechazado antes de escribir: histórico de 60 días intacto; reset 30 afecta solo reciente', async () => {
    filas[1].fecha_extraccion = new Date(Date.now() - 60 * 86400000).toISOString();
    const historica = JSON.stringify(filas[1]);
    const res = respuesta();
    await controlador.resetearEvaluaciones({ body: { dias: 90 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
    expect(JSON.stringify(filas[1])).toBe(historica);
    await expect(ofertas.resetearEvaluacionesPorDias(90)).rejects.toThrow();
    expect(pool.query).not.toHaveBeenCalled();
    const aceptada = respuesta();
    await controlador.resetearEvaluaciones({ body: { dias: 30 } }, aceptada);
    expect(aceptada.json.mock.calls[0][0].datos.reseteadas).toBe(1);
    expect(filas[0].estado_evaluacion).toBe('pendiente');
    expect(JSON.stringify(filas[1])).toBe(historica);
});

test.each([0, -1, 1.5, null, true, [], {}, '90', 31])('B03 el modelo rechaza días inválidos %j antes de SQL', async dias => {
    await expect(ofertas.resetearEvaluacionesPorDias(dias)).rejects.toThrow();
    expect(pool.query).not.toHaveBeenCalled();
});
