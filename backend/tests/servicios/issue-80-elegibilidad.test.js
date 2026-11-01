'use strict';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ obtenerOfertasPendientes: jest.fn(), actualizarEvaluacion: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-lote', () => ({ crearLote: jest.fn(), actualizarProgreso: jest.fn(), finalizarLote: jest.fn(), obtenerUltimoLote: jest.fn() }));

const servicio = require('../../src/servicios/servicio-evaluacion');
const proveedor = require('../../src/config/deepseek');
const ofertas = require('../../src/modelos/oferta');
const preferencias = require('../../src/modelos/preferencia');
const cache = require('../../src/modelos/evaluacion-cache');
const lotes = require('../../src/modelos/evaluacion-lote');
const pool = require('../../src/config/base-datos');
const { construirIdentidadEvaluacion } = require('../../src/servicios/evaluacion/identidad-evaluacion');
const { construirInstruccionesDesdePreferencias } = require('../../src/servicios/evaluacion/entradas-evaluacion');
const prefs = { stack_tecnologico: ['TypeScript'], perfil_profesional: 'Desarrollo web con TypeScript. Formación técnica en programación.', zonas_preferidas: [] };
const ofertaBase = { id: 8001, titulo: 'Desarrollo TypeScript Junior', descripcion: 'Desarrollo web con TypeScript. Residencia en la provincia del puesto obligatoria.', modalidad: 'remoto' };
const item = (requisito, tipo = 'obligatorio') => ({ requisito, tipo, evidencia_oferta: requisito, evidencia_perfil: '', explicacion: 'No hay confirmación en el perfil sintético.' });
const respuesta = (categoria = 'por_confirmar', requisito = item('Residencia en la provincia del puesto')) => ({
    match: true, porcentaje: 91, razon: 'Afinidad técnica con TypeScript.',
    explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [], [categoria]: [requisito] },
});

beforeEach(() => {
    jest.resetAllMocks();
    servicio._resetearEstadoInterno();
    preferencias.obtenerPreferencias.mockResolvedValue(prefs);
    ofertas.obtenerOfertasPendientes.mockResolvedValue([ofertaBase]);
    ofertas.actualizarEvaluacion.mockResolvedValue({ id: ofertaBase.id });
    cache.buscarCache.mockResolvedValue(null);
    cache.guardarCache.mockResolvedValue();
    lotes.crearLote.mockResolvedValue({ id: 80 });
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta()));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function comprobarPendiente(oferta, porcentaje, requisito) {
    ofertas.obtenerOfertasPendientes.mockResolvedValue([oferta]);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 0, errores: 0, evaluadas: 1, procesadas: 1, pendientes: 0, porcentaje: 100, estado: 'completado', mensaje_error: null }));
    expect(resumen.detalle).toEqual([{ id: oferta.id, titulo: oferta.titulo, estado: 'pendiente', razon: expect.stringContaining('Pendiente de confirmación'), error: false }]);
    const guardada = ofertas.actualizarEvaluacion.mock.calls.at(-1);
    expect(guardada).toEqual([oferta.id, 'pendiente', resumen.detalle[0].razon, porcentaje, null, null, expect.any(String), expect.any(Object), oferta.descripcion]);
    expect(guardada[7].por_confirmar).toEqual(expect.arrayContaining([expect.objectContaining({ requisito })]));
    expect(guardada[7].exclusiones).toEqual([]);
    expect(lotes.actualizarProgreso).toHaveBeenLastCalledWith(80, expect.objectContaining({ procesadas: 1, evaluadas: 1, pendientes: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 100 }));
    expect(lotes.finalizarLote).toHaveBeenLastCalledWith(80, 'completado');
    expect(console.error).not.toHaveBeenCalled();
    return resumen;
}

test.each([
    ['residencia', 'Residencia en la provincia del puesto'],
    ['título específico sin equivalencia', 'Licenciatura específica obligatoria'],
    ['otro dato personal desconocido', 'Matrícula profesional obligatoria'],
])('%s no acreditado: pendiente con afinidad intacta', async (nombre, requisito) => {
    const oferta = { ...ofertaBase, descripcion: `TypeScript para desarrollo web. ${requisito}.` };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('por_confirmar', item(requisito))));
    await comprobarPendiente(oferta, 91, requisito);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(expect.objectContaining({ pendiente: true, porcentaje: 91 }));
});

test('un hit conserva la decisión pendiente sin mutar ni repetir proveedor', async () => {
    const almacenada = respuesta();
    const original = structuredClone(almacenada);
    cache.buscarCache.mockResolvedValue(almacenada);
    await comprobarPendiente(ofertaBase, 91, 'Residencia en la provincia del puesto');
    expect(almacenada).toEqual(original);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(cache.guardarCache).not.toHaveBeenCalled();
});

test.each([undefined, null, '', '   \n'])('sin descripción (%j): no invento score ni consumo proveedor en ejecuciones repetidas', async descripcion => {
    const oferta = { ...ofertaBase, descripcion };
    await comprobarPendiente(oferta, null, 'Descripción de la oferta');
    await comprobarPendiente(oferta, null, 'Descripción de la oferta');
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(cache.buscarCache).not.toHaveBeenCalled();
    expect(cache.guardarCache).not.toHaveBeenCalled();
});

test('extracto fragmentario sin evidencia de cumplimiento no aprueba por título', async () => {
    const oferta = { ...ofertaBase, descripcion: 'Más información en el aviso completo.', descripcion_completitud: 'parcial', origen_descripcion: 'tarjeta' };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 95, razon: 'El título menciona TypeScript.' }));
    await comprobarPendiente(oferta, 95, 'Información suficiente de la oferta');
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each(['por_confirmar', 'no_cumplidos'])('un deseable en %s no bloquea ni rechaza', async categoria => {
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: 'Desarrollo con TypeScript. Docker deseable.' }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(categoria, item('Docker deseable', 'deseable'))));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 1, rechazadas: 0, errores: 0, pendientes: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['aprobada', 'Afinidad técnica con TypeScript.', 91, null]);
});

test('cumplimiento acreditado y extracto suficiente pueden aprobar', async () => {
    const requisito = { ...item('TypeScript'), evidencia_oferta: 'TypeScript', evidencia_perfil: 'Desarrollo web con TypeScript.', explicacion: 'Evidencia confirmada.' };
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: 'Desarrollo web con TypeScript.', descripcion_completitud: 'parcial' }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('cumplidos', requisito)));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 1, rechazadas: 0, errores: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0][3]).toBe(91);
});

test.each(['Java obligatorio.', 'English required.', 'US residents only.'])('conservo exclusión vigente: %s', async descripcion => {
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion }]);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 1, errores: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0][1]).toBe('rechazada');
    expect(ofertas.actualizarEvaluacion.mock.calls[0][7].exclusiones).not.toEqual([]);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test('incompatibilidad real con baja afinidad no se vuelve incertidumbre', async () => {
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, limitaciones_explicitas: 'No cuento con matrícula profesional.' });
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: 'Desarrollo con TypeScript. Matrícula profesional obligatoria.' }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ ...respuesta('no_cumplidos', {
        ...item('Matrícula profesional'), evidencia_perfil: 'No cuento con matrícula profesional.', explicacion: 'Incompatibilidad confirmada.',
    }), match: false, porcentaje: 25, razon: 'No cumple el requisito confirmado.' }));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 1, errores: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['rechazada', 'No cumple el requisito confirmado.', 25, null]);
});

test('fallo técnico sigue pendiente con error y sin score ni caché', async () => {
    proveedor.consultarDeepSeek.mockRejectedValue(Object.assign(new Error('simulado'), { codigo: 'TIMEOUT' }));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 0, errores: 1, estado: 'error' }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 7)).toEqual(['pendiente', expect.stringContaining('TIMEOUT'), null, expect.stringContaining('TIMEOUT'), null, null]);
    expect(cache.guardarCache).not.toHaveBeenCalled();
});

test.each([false, true])('recupero pendiente de explicación aunque falte el flag interno (parcial: %s)', async parcial => {
    const oferta = parcial ? { ...ofertaBase, descripcion: 'Consultar aviso completo.', descripcion_completitud: 'parcial' } : ofertaBase;
    if (parcial) proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 91, razon: 'Título afín.' }));
    await comprobarPendiente(oferta, 91, parcial ? 'Información suficiente de la oferta' : 'Residencia en la provincia del puesto');
    const almacenada = JSON.parse(JSON.stringify(cache.guardarCache.mock.calls[0][3]));
    delete almacenada.pendiente;
    const original = structuredClone(almacenada);
    cache.buscarCache.mockResolvedValue(almacenada);
    await comprobarPendiente(oferta, 91, parcial ? 'Información suficiente de la oferta' : 'Residencia en la provincia del puesto');
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(almacenada).toEqual(original);
});

test('información insuficiente explícita no desaparece ante cumplimiento parcial o caché sin flag', async () => {
    const oferta = { ...ofertaBase, descripcion_completitud: 'parcial' };
    const datos = respuesta('por_confirmar', item('Información suficiente de la oferta', 'desconocido'));
    datos.explicacion.cumplidos = [{ ...item('TypeScript'), evidencia_perfil: 'TypeScript confirmado' }];
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    await comprobarPendiente(oferta, 91, 'Información suficiente de la oferta');
    cache.buscarCache.mockResolvedValue(datos);
    await comprobarPendiente(oferta, 91, 'Información suficiente de la oferta');
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test('el modelo real de caché conserva pendiente y explicación en JSON', async () => {
    await comprobarPendiente(ofertaBase, 91, 'Residencia en la provincia del puesto');
    const firmado = cache.guardarCache.mock.calls[0][3];
    const cacheReal = jest.requireActual('../../src/modelos/evaluacion-cache');
    pool.query.mockImplementation(async (sql, valores) => ({ rows: sql.includes('SELECT resultado') ? [{ resultado: JSON.parse(pool.query.mock.calls[0][1][3]) }] : [] }));
    await cacheReal.guardarCache('oferta', 'criterios', 'deepseek-flash', firmado);
    expect(await cacheReal.buscarCache('oferta', 'criterios', 'deepseek-flash')).toEqual(firmado);
    expect(JSON.parse(pool.query.mock.calls[0][1][3]).pendiente).toBe(true);
});

test('sin descripción no omito exclusiones confirmadas en fuentes crudas', async () => {
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: null, datos_crudos: { requirements: 'Java obligatorio.' } }]);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 1, errores: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0][3]).toBe(10);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test('selección forzada conserva pendiente sin ocultarlo como error ni aprobación', async () => {
    const resumen = await servicio.evaluarOfertasPendientes([{ ...ofertaBase, estado_evaluacion: 'aprobada', fecha_evaluacion: '2026-01-01', razon_evaluacion: 'Anterior' }]);
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 0, errores: 0, pendientes: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['pendiente', expect.stringContaining('Pendiente de confirmación'), 91, null]);
    expect(cache.buscarCache).not.toHaveBeenCalled();
});

test('con instrucciones explícitas envío restricciones de incertidumbre y no reutilizo v6', async () => {
    await servicio.evaluarOferta(ofertaBase, 'Sistema sintético explícito', undefined, prefs);
    expect(proveedor.consultarDeepSeek.mock.calls[0][1]).toContain('no acredita cumplimiento del candidato');
    const actual = construirIdentidadEvaluacion(ofertaBase, prefs, { instrucciones: 'Sistema sintético explícito' });
    const anterior = construirIdentidadEvaluacion(ofertaBase, prefs, { instrucciones: 'Sistema sintético explícito', version: 'evaluacion-v6' });
    expect(actual.firma_criterios_evaluacion).not.toBe(anterior.firma_criterios_evaluacion);
});

test.each(['Residencia en provincia Delta', 'Licenciatura en Sistemas'])('cumplimiento confirmado permite aprobar: %s', async requisito => {
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, perfil_profesional: `${prefs.perfil_profesional} ${requisito}: confirmado.` });
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: `Desarrollo con TypeScript. Requisito obligatorio: ${requisito}.` }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('cumplidos', { ...item(requisito), evidencia_perfil: `${requisito}: confirmado.`, explicacion: 'Cumplimiento respaldado por el perfil.' })));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 1, rechazadas: 0, errores: 0, pendientes: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['aprobada', 'Afinidad técnica con TypeScript.', 91, null]);
});

test('lote mixto cuenta decisiones y mantiene incertidumbre pendiente sin error', async () => {
    ofertas.obtenerOfertasPendientes.mockResolvedValue([ofertaBase,
        { ...ofertaBase, id: 8002, descripcion: 'Desarrollo con TypeScript.' },
        { ...ofertaBase, id: 8003, descripcion: 'Java obligatorio.' },
        { ...ofertaBase, id: 8004, descripcion: null },
    ]);
    proveedor.consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(respuesta()))
        .mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje: 80, razon: 'TypeScript compatible.' }));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ total: 4, aprobadas: 1, rechazadas: 1, errores: 0, procesadas: 4, evaluadas: 4, pendientes: 0, porcentaje: 100, estado: 'completado', mensaje_error: null }));
    expect(ofertas.actualizarEvaluacion.mock.calls.map(llamada => [llamada[0], llamada[1], llamada[3], llamada[4]])).toEqual([
        [8001, 'pendiente', 91, null], [8002, 'aprobada', 80, null], [8003, 'rechazada', 10, null], [8004, 'pendiente', null, null],
    ]);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(cache.guardarCache).toHaveBeenCalledTimes(2);
    expect(lotes.actualizarProgreso).toHaveBeenLastCalledWith(80, expect.objectContaining({ procesadas: 4, evaluadas: 4, pendientes: 0, errores: 0, porcentaje: 100 }));
});

describe('rehidratación con modelo real de lotes y pool simulado', () => {
    beforeEach(() => {
        const modeloReal = jest.requireActual('../../src/modelos/evaluacion-lote');
        for (const metodo of Object.keys(modeloReal)) lotes[metodo].mockImplementation(modeloReal[metodo]);
        let fila = null;
        pool.query.mockImplementation(async (sql, valores = []) => {
            if (sql.includes('INSERT INTO evaluacion_lotes')) {
                fila = { id: 80, estado: 'activo', total: valores[0], evaluadas: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 };
            } else if (sql.includes('SET evaluadas')) {
                const [evaluadas, aprobadas, rechazadas, errores, porcentaje] = valores;
                Object.assign(fila, { evaluadas, aprobadas, rechazadas, errores, porcentaje });
            } else if (sql.includes('SET estado')) {
                fila.estado = valores[0];
            } else if (!sql.includes('SELECT * FROM evaluacion_lotes')) {
                throw new Error('Consulta no prevista en el pool sintético de lotes.');
            }
            return { rows: fila ? [structuredClone(fila)] : [] };
        });
    });

    test.each([['obligación por confirmar', ofertaBase, 91], ['descripción ausente', { ...ofertaBase, descripcion: null }, null]])(
        '%s conserva progreso persistido después de reiniciar', async (nombre, oferta, porcentaje) => {
            ofertas.obtenerOfertasPendientes.mockResolvedValue([oferta]);
            await servicio.evaluarOfertasPendientes();
            servicio._resetearEstadoInterno();
            await servicio.rehidratarProgreso();
            expect(servicio.obtenerProgresoEvaluacion()).toEqual(expect.objectContaining({
                activo: false, total: 1, procesadas: 1, evaluadas: 1, pendientes: 0,
                aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 100, estado: 'completado', mensaje_error: null,
            }));
            expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['pendiente', expect.stringContaining('Pendiente de confirmación'), porcentaje, null]);
            expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(porcentaje === null ? 0 : 1);
        }
    );

    test.each(['completado', 'cancelado', 'error', 'activo'])('lote mixto %s conserva contadores al rehidratar', async estado => {
        const seleccion = [ofertaBase, { ...ofertaBase, id: 8002, descripcion: null },
            { ...ofertaBase, id: 8003, descripcion: 'Desarrollo TypeScript.' }, { ...ofertaBase, id: 8004, descripcion: 'Java obligatorio.' }];
        if (estado === 'error') seleccion.push({ ...ofertaBase, id: 8005 });
        ofertas.obtenerOfertasPendientes.mockResolvedValue(seleccion);
        proveedor.consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(respuesta()))
            .mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje: 80, razon: 'TypeScript compatible.' }))
            .mockRejectedValueOnce(Object.assign(new Error('Fallo sintético'), { codigo: 'TIMEOUT' }));
        ofertas.actualizarEvaluacion.mockImplementation(async id => {
            if (estado === 'cancelado' && id === 8002) await servicio.cancelarEvaluacionPendiente();
            return { id };
        });
        const resumen = await servicio.evaluarOfertasPendientes();
        const contadores = { total: seleccion.length, procesadas: estado === 'cancelado' ? 2 : seleccion.length,
            evaluadas: estado === 'cancelado' ? 2 : 4, pendientes: estado === 'cancelado' ? 2 : estado === 'error' ? 1 : 0,
            aprobadas: estado === 'cancelado' ? 0 : 1, rechazadas: estado === 'cancelado' ? 0 : 1,
            errores: estado === 'error' ? 1 : 0, porcentaje: estado === 'cancelado' ? 50 : 100 };
        expect(resumen).toEqual(expect.objectContaining(contadores));
        expect(resumen.detalle.slice(0, 2).map(item => [item.estado, item.error])).toEqual([['pendiente', false], ['pendiente', false]]);
        if (estado === 'activo') {
            // Simulo un reinicio tras el checkpoint y antes de finalizar, usando el contrato real del modelo.
            await lotes.crearLote(seleccion.length, 'deepseek-flash');
            await lotes.actualizarProgreso(80, resumen);
        }
        servicio._resetearEstadoInterno();
        await servicio.rehidratarProgreso();
        expect(servicio.obtenerProgresoEvaluacion()).toEqual(expect.objectContaining({ ...contadores, activo: false, estado: estado === 'activo' ? 'error' : estado }));
        const escrituras = ofertas.actualizarEvaluacion.mock.calls.length;
        await servicio.rehidratarProgreso();
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledTimes(escrituras);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(estado === 'cancelado' ? 1 : estado === 'error' ? 3 : 2);
    });
});

test('instruyo separar evidencia del aviso de cumplimiento y suficiencia, sin equivalencias inventadas', () => {
    const instrucciones = construirInstruccionesDesdePreferencias(prefs);
    expect(instrucciones).toContain('Una cita de la oferta prueba el requisito, no el cumplimiento del candidato');
    expect(instrucciones).toContain('equivalencia académica');
    expect(instrucciones).toContain('Información suficiente de la oferta');
});
