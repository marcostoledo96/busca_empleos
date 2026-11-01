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

const CASOS_V2_INCIERTOS = [
    ['V2 cursada', 'Licenciatura en Sistemas', 'Licenciatura en Sistemas obligatoria', 'Actualmente curso la Licenciatura en Sistemas.'],
    ['V2 estudiante', 'Licenciatura en Sistemas', 'Licenciatura en Sistemas obligatoria', 'Soy estudiante de Licenciatura en Sistemas.'],
    ['V2 formación', 'Licenciatura en Sistemas', 'Licenciatura en Sistemas obligatoria', 'Me estoy formando en Licenciatura en Sistemas.'],
    ['V2 residencia futura', 'Residir en provincia Delta', 'Residir en provincia Delta es obligatorio', 'Planeo residir en provincia Delta.'],
    ['V2 contexto futuro multilínea', 'Licenciatura en Sistemas', 'Licenciatura en Sistemas es obligatorio.', 'Cuando me gradúe podré decir:\n«Obtuve la Licenciatura en Sistemas».', 'Obtuve la Licenciatura en Sistemas'],
    ['V2 contexto negativo multilínea', 'Licenciatura en Sistemas', 'Licenciatura en Sistemas es obligatorio.', 'Todavía no puedo afirmar lo siguiente:\n«Obtuve la Licenciatura en Sistemas».', 'Obtuve la Licenciatura en Sistemas'],
];

const CASOS_V3_INSUFICIENTES = [
    ['V3 extracto parcial', { ...ofertaBase, descripcion: 'Consultar detalles de la búsqueda en el aviso completo', descripcion_completitud: 'parcial' }, 25],
    ['V3 información externa', { ...ofertaBase, descripcion: 'La información de los requisitos se encuentra en el sitio externo de la empresa.' }, 24],
];
const respuestaInsuficiente = porcentaje => ({ ...respuesta('por_confirmar', { requisito: 'Información suficiente de la oferta', tipo: 'obligatorio' }), match: false, porcentaje });

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

test.each(CASOS_V3_INSUFICIENTES)('%s: API individual conserva afinidad falsa y score, pero difiere elegibilidad', async (caso, oferta, porcentaje) => {
    const datos = respuestaInsuficiente(porcentaje);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    const comprobar = async opciones => {
        const resultado = await servicio.evaluarOferta(oferta, undefined, undefined, prefs, opciones);
        expect(resultado).toEqual(expect.objectContaining({ match: false, pendiente: true, porcentaje, prioridad_ia: null, desglose_disponible: true,
            razon: `Pendiente de confirmación: Información suficiente de la oferta. Afinidad técnica estimada: ${porcentaje}%.` }));
        expect(resultado.error || resultado.inconsistente || resultado.invalido).toBeFalsy();
        expect(resultado.explicacion).toEqual({ cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ requisito: 'Información suficiente de la oferta', tipo: 'obligatorio' })] });
        return resultado;
    };
    const resultado = await comprobar();
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(resultado);
    for (const flag of [undefined, true]) {
        const almacenada = { ...datos, ...(flag ? { pendiente: true } : {}) };
        const original = structuredClone(almacenada);
        cache.buscarCache.mockResolvedValue(almacenada);
        await comprobar();
        expect(almacenada).toEqual(original);
    }
    await comprobar({ forzar: true });
    expect(cache.buscarCache).toHaveBeenCalledTimes(3);
    expect(cache.guardarCache).toHaveBeenCalledTimes(2);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
});

test.each(CASOS_V3_INSUFICIENTES)('%s: worker, caché, forzado, selección y reintento no cuentan rechazo', async (caso, oferta, porcentaje) => {
    const datos = respuestaInsuficiente(porcentaje);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    await comprobarPendiente(oferta, porcentaje, 'Información suficiente de la oferta');
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(expect.objectContaining({ match: false, pendiente: true, porcentaje, prioridad_ia: null }));
    for (const flag of [undefined, true]) {
        const almacenada = { ...datos, ...(flag ? { pendiente: true } : {}) };
        const original = structuredClone(almacenada);
        cache.buscarCache.mockResolvedValue(almacenada);
        await comprobarPendiente(oferta, porcentaje, 'Información suficiente de la oferta');
        expect(almacenada).toEqual(original);
    }
    for (const errorPrevio of [null, 'TIMEOUT previo']) {
        await servicio.evaluarOfertasPendientes([{ ...oferta, estado_evaluacion: errorPrevio ? 'pendiente' : 'aprobada', evaluacion_error_mensaje: errorPrevio }]);
        expect(ofertas.actualizarEvaluacion.mock.calls.at(-1).slice(1, 7)).toEqual(['pendiente', `Pendiente de confirmación: Información suficiente de la oferta. Afinidad técnica estimada: ${porcentaje}%.`, porcentaje, null, null, expect.any(String)]);
        expect(servicio.obtenerProgresoEvaluacion()).toEqual(expect.objectContaining({ evaluadas: 1, procesadas: 1, aprobadas: 0, rechazadas: 0, errores: 0, pendientes: 0, estado: 'completado', mensaje_error: null }));
    }
    await comprobarPendiente({ ...oferta, evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA' }, porcentaje, 'Información suficiente de la oferta');
    for (const llamada of ofertas.actualizarEvaluacion.mock.calls) {
        expect(llamada.slice(1, 7)).toEqual(['pendiente', `Pendiente de confirmación: Información suficiente de la oferta. Afinidad técnica estimada: ${porcentaje}%.`, porcentaje, null, null, expect.any(String)]);
        expect(llamada[7]).toEqual({ cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ requisito: 'Información suficiente de la oferta', tipo: 'obligatorio' })] });
    }
    expect(cache.buscarCache).toHaveBeenCalledTimes(3);
    expect(cache.guardarCache).toHaveBeenCalledTimes(4);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(4);
});

test.each([
    ['técnico ausente confirmado', 'Rust obligatorio.', { conocimientos_ausentes: ['Rust'] }, 'no_cumplidos', { ...item('Rust'), evidencia_perfil: 'Rust' }, 'rechazada'],
    ['matrícula incompatible', 'Matrícula profesional obligatoria.', { limitaciones_explicitas: 'No cuento con matrícula profesional.' }, 'exclusiones', { ...item('Matrícula profesional'), evidencia_perfil: 'No cuento con matrícula profesional.' }, 'rechazada'],
    ['no cumplido sin prueba', 'Rust obligatorio.', {}, 'no_cumplidos', item('Rust'), 'pendiente'],
    ['exclusión sin prueba', 'Rust obligatorio.', {}, 'exclusiones', item('Rust'), 'pendiente'],
    ['cita ajena al aviso', 'Consultar aviso completo.', { conocimientos_ausentes: ['Rust'] }, 'exclusiones', { ...item('Rust'), evidencia_perfil: 'Rust' }, 'pendiente'],
    ['ausencia sólo deseable', 'Rust deseable.', { conocimientos_ausentes: ['Rust'] }, 'exclusiones', { ...item('Rust', 'deseable'), evidencia_perfil: 'Rust' }, 'pendiente'],
    ['inglés deseable mal rotulado', 'Inglés deseable.', { conocimientos_ausentes: ['Inglés'] }, 'exclusiones', { ...item('Inglés'), evidencia_perfil: 'Inglés' }, 'pendiente'],
])('V3 información pendiente con %s mantiene evidencia honesta', async (caso, descripcion, perfil, categoria, requisito, estado) => {
    const datos = respuestaInsuficiente(25);
    datos.explicacion[categoria] = [requisito];
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, ...perfil });
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion }]);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ evaluadas: 1, procesadas: 1, aprobadas: 0, rechazadas: estado === 'rechazada' ? 1 : 0, errores: 0, pendientes: 0, estado: 'completado', mensaje_error: null }));
    const guardada = ofertas.actualizarEvaluacion.mock.calls[0];
    expect(guardada.slice(1, 7)).toEqual([estado, expect.stringContaining(estado === 'rechazada' ? 'Incompatibilidad confirmada' : 'Pendiente de confirmación'), 25, null, null, expect.any(String)]);
    expect(guardada[7].exclusiones).toEqual(estado === 'rechazada' ? [expect.objectContaining({ requisito: requisito.requisito })] : []);
    expect(guardada[7].por_confirmar).toEqual(expect.arrayContaining([expect.objectContaining({ requisito: 'Información suficiente de la oferta' })]));
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(expect.objectContaining({ match: false, pendiente: estado === 'pendiente', porcentaje: 25, explicacion: guardada[7] }));
    for (const flag of [undefined, true]) {
        const almacenada = { ...datos, ...(flag ? { pendiente: true } : {}) };
        const original = structuredClone(almacenada);
        cache.buscarCache.mockResolvedValue(almacenada);
        const repetido = await servicio.evaluarOfertasPendientes();
        expect(repetido.rechazadas).toBe(estado === 'rechazada' ? 1 : 0);
        expect(repetido.errores).toBe(0);
        expect(ofertas.actualizarEvaluacion.mock.calls.at(-1)).toEqual(guardada);
        expect(almacenada).toEqual(original);
    }
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
});

test('V3 no generalizo pendientes a match falso sin marcador explícito', async () => {
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: 'TypeScript.', descripcion_completitud: 'parcial' }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: false, porcentaje: 25, razon: 'Afinidad técnica insuficiente.' }));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ rechazadas: 1, aprobadas: 0, errores: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['rechazada', 'Afinidad técnica insuficiente.', 25, null]);
});

test.each(['cumplidos', 'no_cumplidos', 'exclusiones'])('auditoría B1: obligación no acreditada en %s nunca aprueba', async categoria => {
    const requisito = item('Licenciatura obligatoria');
    const oferta = { ...ofertaBase, descripcion: 'TypeScript. Licenciatura obligatoria.' };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(categoria, requisito)));
    await comprobarPendiente(oferta, 91, requisito.requisito);
    const explicacion = ofertas.actualizarEvaluacion.mock.calls[0][7];
    expect(explicacion.cumplidos).toEqual([]);
    expect(explicacion.no_cumplidos).toEqual([]);
    expect(ofertas.actualizarEvaluacion.mock.calls[0][2]).toBe('Pendiente de confirmación: Licenciatura obligatoria. Afinidad técnica estimada: 91%.');
    expect(explicacion.por_confirmar).toEqual([expect.objectContaining({ requisito: requisito.requisito, evidencia_perfil: '', explicacion: expect.stringContaining('Necesito confirmar') })]);
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(expect.objectContaining({ pendiente: true, porcentaje: 91, explicacion }));
    const anteriorSinFlag = respuesta(categoria, requisito);
    const original = structuredClone(anteriorSinFlag);
    cache.buscarCache.mockResolvedValue(anteriorSinFlag);
    await comprobarPendiente(oferta, 91, requisito.requisito);
    expect(anteriorSinFlag).toEqual(original);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.buscarCache).toHaveBeenCalledTimes(2);
    expect(cache.guardarCache).toHaveBeenCalledTimes(1);
});

test.each(['cumplidos', 'no_cumplidos', 'exclusiones'].flatMap(categoria => [
    ['perfil inventado', 'Licenciatura en Sistemas confirmada.', 'Licenciatura en Sistemas'],
    ['perfil ajeno', 'Desarrollo web con TypeScript.', 'Licenciatura en Sistemas'],
    ['equivalencia no confirmada', 'Formación técnica en programación.', 'Licenciatura en Sistemas'],
    ['oferta ajena', 'Desarrollo web con TypeScript.', 'Docker obligatorio'],
].map(([caso, evidencia_perfil, requisito]) => [categoria, caso, evidencia_perfil, requisito])))('%s con %s queda por confirmar, no acredita ni inventa rechazo', async (categoria, caso, evidencia_perfil, requisito) => {
    const oferta = { ...ofertaBase, descripcion: 'Licenciatura en Sistemas obligatoria. TypeScript deseable.' };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(categoria, { ...item(requisito), evidencia_perfil })));
    await comprobarPendiente(oferta, 91, requisito);
    const explicacion = ofertas.actualizarEvaluacion.mock.calls[0][7];
    expect(explicacion.cumplidos).toEqual([]);
    expect(explicacion.no_cumplidos).toEqual([]);
    expect(cache.guardarCache.mock.calls[0][3].explicacion).toEqual(explicacion);
});

test.each(['cumplidos', 'no_cumplidos', 'exclusiones'])('corrijo obligación mal rotulada en %s si el aviso sólo la declara deseable', async categoria => {
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(categoria, { ...item('Docker'), evidencia_perfil: 'Docker inventado.' })));
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: 'TypeScript.\nDeseables:\n- Docker' }]);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 1, rechazadas: 0, errores: 0, evaluadas: 1, procesadas: 1, pendientes: 0 }));
    const guardada = ofertas.actualizarEvaluacion.mock.calls[0];
    expect(guardada.slice(1, 5)).toEqual(['aprobada', 'Afinidad técnica con TypeScript.', 91, null]);
    expect(guardada[7].cumplidos).toEqual([]);
    expect(guardada[7].no_cumplidos).toEqual([]);
    expect(guardada[7].exclusiones).toEqual([]);
    expect(guardada[7].por_confirmar).toEqual([expect.objectContaining({ requisito: 'Docker', tipo: 'deseable', evidencia_perfil: '' })]);
    expect(cache.guardarCache.mock.calls[0][3].explicacion).toEqual(guardada[7]);
});

test.each(['cumplidos', 'no_cumplidos', 'exclusiones'])('%s con incompatibilidad acreditada rechaza sin alterar afinidad', async categoria => {
    const requisito = { ...item('Matrícula profesional'), evidencia_perfil: 'No cuento con matrícula profesional.', explicacion: 'El proveedor informa una categoría contradictoria.' };
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, limitaciones_explicitas: requisito.evidencia_perfil });
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: 'TypeScript. Matrícula profesional obligatoria.' }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(categoria, requisito)));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 1, errores: 0, evaluadas: 1, procesadas: 1, pendientes: 0, porcentaje: 100, estado: 'completado', mensaje_error: null }));
    const guardada = ofertas.actualizarEvaluacion.mock.calls[0];
    expect(guardada.slice(1, 7)).toEqual(['rechazada', 'Incompatibilidad confirmada: Matrícula profesional. Afinidad técnica estimada: 91%.', 91, null, null, expect.any(String)]);
    expect(guardada[7].cumplidos).toEqual([]);
    expect(guardada[7].por_confirmar).toEqual([]);
    expect(guardada[7].exclusiones).toEqual([expect.objectContaining({ requisito: requisito.requisito, evidencia_perfil: requisito.evidencia_perfil })]);
    expect(guardada[7].no_cumplidos).toEqual(guardada[7].exclusiones);
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(expect.objectContaining({ match: false, pendiente: false, porcentaje: 91, explicacion: guardada[7] }));
    expect(lotes.actualizarProgreso).toHaveBeenLastCalledWith(80, expect.objectContaining({ evaluadas: 1, rechazadas: 1, aprobadas: 0, errores: 0 }));
    expect(console.error).not.toHaveBeenCalled();
    const anteriorSinFlag = respuesta(categoria, requisito);
    const original = structuredClone(anteriorSinFlag);
    cache.buscarCache.mockResolvedValue(anteriorSinFlag);
    await servicio.evaluarOfertasPendientes();
    expect(anteriorSinFlag).toEqual(original);
    expect(ofertas.actualizarEvaluacion.mock.calls[1].slice(1, 5)).toEqual(guardada.slice(1, 5));
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(1);
});

test.each([
    ['no_cumplidos', { limitaciones_explicitas: 'No cuento con matrícula profesional.' }, 'No cuento con matrícula profesional.'],
    ['exclusiones', { usar_prompt_personalizado: true, prompt_personalizado: 'Licenciatura en Sistemas: confirmado.' }, 'Licenciatura en Sistemas: confirmado.'],
])('%s no convierte negación ambigua, ausencia ajena ni prompt en prueba', async (categoria, datos, evidencia_perfil) => {
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, ...datos });
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(categoria, { ...item('Licenciatura en Sistemas'), evidencia_perfil })));
    await comprobarPendiente({ ...ofertaBase, descripcion: 'TypeScript. Licenciatura en Sistemas obligatoria.' }, 91, 'Licenciatura en Sistemas');
    const explicacion = ofertas.actualizarEvaluacion.mock.calls[0][7];
    expect(explicacion.cumplidos).toEqual([]);
    expect(explicacion.no_cumplidos).toEqual([]);
});

test('no conservo un falso cumplido duplicado junto a la obligación pendiente', async () => {
    const datos = respuesta('cumplidos', { ...item('TypeScript'), evidencia_perfil: 'Desarrollo web con TypeScript.' });
    datos.explicacion.por_confirmar = [item('TypeScript')];
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    await comprobarPendiente({ ...ofertaBase, descripcion: 'TypeScript obligatorio.' }, 91, 'TypeScript');
    expect(ofertas.actualizarEvaluacion.mock.calls[0][7].cumplidos).toEqual([]);
    expect(ofertas.actualizarEvaluacion.mock.calls[0][7].por_confirmar).toHaveLength(1);
});

test.each([
    ['B2 aspiración', 'Aspiro a obtener Licenciatura en Sistemas.', null, null, 'pendiente'],
    ['B2 formación incompleta', 'Licenciatura en Sistemas pendiente de finalizar.', null, null, 'pendiente'],
    ['B2 ausencia literal', 'Carezco de Licenciatura en Sistemas.', null, null, 'rechazada'],
    ['B2 prefijo contextual inventado', 'Deseables:\n- Licenciatura en Sistemas', 'deseable Licenciatura en Sistemas', null, 'pendiente'],
    ['B3 deseable ajeno', '', '', 'Licenciatura en Sistemas obligatoria y Docker deseable.', 'pendiente'],
    ['B4 años canónicos', '', '1 año de experiencia', 'TypeScript. Requisito obligatorio: 1 año de experiencia.', 'aprobada'],
    ['B4 ausencia en perfil', 'No cuento con Licenciatura en Sistemas.', null, null, 'rechazada'],
    ...CASOS_V2_INCIERTOS.map(([caso, requisito, descripcion, perfil, evidencia]) => [caso, perfil, evidencia ?? null, descripcion, 'pendiente']),
    ['V2 contexto futuro misma línea', 'Cuando me gradúe podré decir: «Obtuve la Licenciatura en Sistemas».', 'Obtuve la Licenciatura en Sistemas', 'Licenciatura en Sistemas es obligatorio.', 'pendiente'],
    ['V2 contexto negativo misma línea', 'Todavía no puedo afirmar lo siguiente: «Obtuve la Licenciatura en Sistemas».', 'Obtuve la Licenciatura en Sistemas', 'Licenciatura en Sistemas es obligatorio.', 'pendiente'],
    ['V2 título obtenido', 'Obtuve la Licenciatura en Sistemas.', null, 'Licenciatura en Sistemas obligatoria', 'aprobada'],
    ['V2 título completado', 'Completé la Licenciatura en Sistemas.', null, 'Licenciatura en Sistemas obligatoria', 'aprobada'],
    ['V2 residencia actual', 'Resido actualmente en provincia Delta.', null, 'Residir en provincia Delta es obligatorio', 'aprobada'],
    ['V2 título sólo mencionado', 'Licenciatura en Sistemas.', null, 'Licenciatura en Sistemas obligatoria', 'pendiente'],
    ['V2 título no obtenido todavía', 'Todavía no me gradué de la Licenciatura en Sistemas.', null, 'Licenciatura en Sistemas obligatoria', 'pendiente'],
])('%s: proveedor, caché sin flag y selección mantienen evidencia honesta', async (caso, perfil, evidencia, descripcion, estado) => {
    const requisito = caso === 'B4 años canónicos' ? '1 año de experiencia' : caso.startsWith('V2 residencia') ? 'Residir en provincia Delta' : 'Licenciatura en Sistemas';
    const oferta = { ...ofertaBase, descripcion: descripcion || 'TypeScript. Licenciatura en Sistemas obligatoria.' };
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, perfil_profesional: perfil, ...(caso === 'B4 años canónicos' ? { anios_experiencia_reales: 1 } : {}) });
    const datos = respuesta('cumplidos', { ...item(requisito), evidencia_perfil: evidencia ?? perfil });
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    const comprobar = async seleccion => {
        ofertas.obtenerOfertasPendientes.mockResolvedValue([oferta]);
        const resumen = await servicio.evaluarOfertasPendientes(seleccion);
        expect(resumen).toEqual(expect.objectContaining({ total: 1, evaluadas: 1, procesadas: 1, pendientes: 0, errores: 0, aprobadas: estado === 'aprobada' ? 1 : 0, rechazadas: estado === 'rechazada' ? 1 : 0, porcentaje: 100, estado: 'completado', mensaje_error: null }));
        const guardada = ofertas.actualizarEvaluacion.mock.calls.at(-1);
        const razon = estado === 'aprobada' ? datos.razon : `${estado === 'pendiente' ? 'Pendiente de confirmación' : 'Incompatibilidad confirmada'}: ${requisito}. Afinidad técnica estimada: 91%.`;
        const prioridad = estado === 'aprobada' ? { detectada: false, puntaje: 0, categorias: [], evidencias: [], version: 'prioridad-ia-v1' } : null;
        expect(guardada).toEqual([oferta.id, estado, razon, 91, null, prioridad, expect.any(String), expect.any(Object), oferta.descripcion]);
        expect(guardada[7][estado === 'aprobada' ? 'cumplidos' : estado === 'pendiente' ? 'por_confirmar' : 'exclusiones']).toEqual([expect.objectContaining({ requisito })]);
        if (estado !== 'aprobada') expect(guardada[7].cumplidos).toEqual([]);
        if (estado !== 'rechazada') expect(guardada[7].exclusiones).toEqual([]);
        expect(lotes.actualizarProgreso).toHaveBeenLastCalledWith(80, expect.objectContaining({ evaluadas: 1, procesadas: 1, errores: 0, aprobadas: resumen.aprobadas, rechazadas: resumen.rechazadas }));
        expect(lotes.finalizarLote).toHaveBeenLastCalledWith(80, 'completado');
        return guardada[7];
    };
    const explicacion = await comprobar();
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(expect.objectContaining({ porcentaje: 91, explicacion }));
    datos.prioridad_ia = cache.guardarCache.mock.calls[0][3].prioridad_ia;
    const original = structuredClone(datos);
    cache.buscarCache.mockResolvedValue(datos);
    await comprobar();
    expect(datos).toEqual(original);
    const contexto = caso.startsWith('V2 contexto');
    if (contexto) await comprobar([{ ...oferta, estado_evaluacion: 'aprobada' }]);
    await comprobar([{ ...oferta, estado_evaluacion: 'pendiente', evaluacion_error_mensaje: 'TIMEOUT anterior' }]);
    expect(cache.buscarCache).toHaveBeenCalledTimes(2);
    expect(cache.guardarCache).toHaveBeenCalledTimes(contexto ? 3 : 2);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(contexto ? 3 : 2);
    expect(console.error).not.toHaveBeenCalled();
});

test.each([undefined, null, 0])('años ausentes o insuficientes (%s) no se inventan desde proyectos', async anios => {
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, anios_experiencia_reales: anios, perfil_profesional: 'Proyecto práctico de TypeScript.' });
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('cumplidos', { ...item('1 año de experiencia'), evidencia_perfil: '1 año de experiencia' })));
    await comprobarPendiente({ ...ofertaBase, descripcion: 'TypeScript. Requisito obligatorio: 1 año de experiencia.' }, 91, '1 año de experiencia');
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

test.each(['por_confirmar', 'no_cumplidos', 'exclusiones'])('un deseable en %s no bloquea ni rechaza', async categoria => {
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
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuestaInsuficiente(25)));
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

test.each([null, 'TIMEOUT previo'])('selección/reintento (%s) revalida cumplimiento inventado sin falso error ni aprobación', async errorPrevio => {
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('cumplidos', item('Licenciatura obligatoria'))));
    const resumen = await servicio.evaluarOfertasPendientes([{ ...ofertaBase, estado_evaluacion: 'aprobada', evaluacion_error_mensaje: errorPrevio, fecha_evaluacion: '2026-01-01', razon_evaluacion: 'Anterior' }]);
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

test.each(['Residencia en provincia Delta', 'Licenciatura en Sistemas'])('confirmación autónoma permite aprobar, el párrafo compuesto requiere confirmar: %s', async requisito => {
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, perfil_profesional: `${prefs.perfil_profesional} ${requisito}: confirmado.` });
    ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...ofertaBase, descripcion: `Desarrollo con TypeScript. Requisito obligatorio: ${requisito}.` }]);
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('cumplidos', { ...item(requisito), evidencia_perfil: `${requisito}: confirmado.`, explicacion: 'Cumplimiento respaldado por el perfil.' })));
    const compuesto = await servicio.evaluarOfertasPendientes();
    expect(compuesto).toEqual(expect.objectContaining({ aprobadas: 0, rechazadas: 0, errores: 0, evaluadas: 1 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(1, 5)).toEqual(['pendiente', expect.stringContaining('Pendiente de confirmación'), 91, null]);
    preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, perfil_profesional: `${requisito}: confirmado.` });
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen).toEqual(expect.objectContaining({ aprobadas: 1, rechazadas: 0, errores: 0, pendientes: 0 }));
    expect(ofertas.actualizarEvaluacion.mock.calls[1].slice(1, 5)).toEqual(['aprobada', 'Afinidad técnica con TypeScript.', 91, null]);
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

    test.each([['obligación por confirmar', ofertaBase, 91, null, null], ['descripción ausente', { ...ofertaBase, descripcion: null }, null, null, null],
        ...['cumplidos', 'no_cumplidos', 'exclusiones'].map(categoria => [categoria, ofertaBase, 91, null, null]),
        ...CASOS_V2_INCIERTOS.map(([caso, requisito, descripcion, perfil, evidencia]) => [caso, { ...ofertaBase, descripcion }, 91, perfil, { requisito, evidencia: evidencia ?? perfil }]),
        ...CASOS_V3_INSUFICIENTES.map(([caso, oferta, porcentaje]) => [caso, oferta, porcentaje, null, { respuesta: respuestaInsuficiente(porcentaje) }])])(
        '%s conserva progreso persistido después de reiniciar', async (nombre, oferta, porcentaje, perfil, prueba) => {
            if (perfil) {
                preferencias.obtenerPreferencias.mockResolvedValue({ ...prefs, perfil_profesional: perfil });
                proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta('cumplidos', { ...item(prueba.requisito), evidencia_perfil: prueba.evidencia })));
            }
            if (prueba?.respuesta) proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(prueba.respuesta));
            if (['cumplidos', 'no_cumplidos', 'exclusiones'].includes(nombre)) proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(nombre, item('Licenciatura obligatoria'))));
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
