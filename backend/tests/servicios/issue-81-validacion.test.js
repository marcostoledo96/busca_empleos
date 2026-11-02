'use strict';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-lote', () => ({ crearLote: jest.fn(), actualizarProgreso: jest.fn(), finalizarLote: jest.fn() }));

const { parsearRespuestaEvaluacionIa } = require('../../src/servicios/evaluacion/parser-respuesta-ia');
const servicio = require('../../src/servicios/servicio-evaluacion');
const proveedor = require('../../src/config/deepseek');
const pool = require('../../src/config/base-datos');
const ofertas = require('../../src/modelos/oferta');
const preferencias = require('../../src/modelos/preferencia');
const cache = require('../../src/modelos/evaluacion-cache');
const lotes = require('../../src/modelos/evaluacion-lote');
const perfil = { stack_tecnologico: ['TypeScript'], conocimientos_ausentes: ['Matrícula profesional'], zonas_preferidas: ['Capital Federal'] };
const requisito = 'Matrícula profesional';
const item = evidencia => ({ requisito, tipo: 'obligatorio', evidencia_oferta: evidencia,
    evidencia_perfil: requisito, explicacion: 'Ausencia declarada en el perfil sintético.' });
const respuesta = evidencia => ({ match: false, porcentaje: 91, razon: 'Matrícula obligatoria no acreditada.',
    explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [item(evidencia)] } });

const casos = [
    ['obligación en una oración', 'Matrícula profesional obligatoria.', 'Matrícula profesional obligatoria.', true],
    ['cita completa entre oraciones', 'Matrícula profesional obligatoria. Debe estar vigente.', 'Matrícula profesional obligatoria. Debe estar vigente.', true],
    ['cita con encabezado de lista', 'Requisitos obligatorios:\n- Matrícula profesional', 'Requisitos obligatorios:\n- Matrícula profesional', true],
    ['cita con encabezado inline', 'Requisitos: Matrícula profesional', 'Requisitos: Matrícula profesional', true],
    ['cita breve bajo encabezado inline', 'Requisitos: Matrícula profesional', 'Matrícula profesional', true],
    ['deseable en lista', 'Deseables:\n- Matrícula profesional', 'Matrícula profesional', false],
    ['deseable inline', 'Deseables: Matrícula profesional', 'Matrícula profesional', false],
    ['obligación negada', 'No se requiere Matrícula profesional.', 'Matrícula profesional', false],
    ['cita vacía', 'Matrícula profesional obligatoria.', '', false],
    ['requisito ausente', 'Desarrollo web con TypeScript.', 'Matrícula profesional', false],
    ['cita inventada', 'Matrícula profesional obligatoria.', 'Matrícula profesional vigente de categoría Zeta', false],
    ['cita de otro aviso', 'Desarrollo web con TypeScript.', 'Rust obligatorio para sistemas embebidos.', false],
    ['cita atravesando sección opcional', 'Requisitos:\n- Matrícula profesional\nDeseables:\n- Docker', 'Matrícula profesional\nDeseables:\n- Docker', false],
    ['opcional en oración anterior incluida', 'Matrícula profesional opcional. Debe estar vigente.', 'Matrícula profesional opcional. Debe estar vigente.', false],
    ['cita parcial omite negación de primera cláusula', 'No se requiere Matrícula profesional. Debe estar vigente.', 'Matrícula profesional. Debe estar vigente.', false],
    ['cita parcial omite deseable de primera cláusula', 'Es opcional Matrícula profesional. Debe estar vigente.', 'Matrícula profesional. Debe estar vigente.', false],
    ['cita parcial omite negación al final', 'Matrícula profesional. No se requiere vigencia obligatoria.', 'Matrícula profesional. No se requiere', false],
    ['cita parcial bajo encabezado opcional', 'Deseables:\n- Matrícula profesional. Vigencia obligatoria.', 'Matrícula profesional. Vigencia obligatoria.', false],
    ['fragmentos repetidos no ocultan contexto', 'Matrícula profesional obligatoria. Vigencia obligatoria.\nDeseables:\n- Matrícula profesional. Vigencia obligatoria.', 'Matrícula profesional. Vigencia obligatoria.', false],
];

beforeEach(() => {
    jest.resetAllMocks();
    servicio._resetearEstadoInterno();
    preferencias.obtenerPreferencias.mockResolvedValue(perfil);
    cache.buscarCache.mockResolvedValue(null);
    lotes.crearLote.mockResolvedValue({ id: 81 });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test.each(casos)('parser real: %s', (nombre, descripcion, evidencia, valida) => {
    const datos = respuesta(evidencia);
    const resultado = parsearRespuestaEvaluacionIa(JSON.stringify(datos), descripcion);
    expect(resultado).toEqual(expect.objectContaining({ match: false, porcentaje: 91, explicacion: {
        ...datos.explicacion, desglose_disponible: true,
    } }));
    expect(Boolean(resultado.error)).toBe(!valida);
    expect(Boolean(resultado.invalido)).toBe(!valida);
    expect(Boolean(resultado.inconsistente)).toBe(!valida);
    expect(resultado.razon).toBe(valida ? datos.razon : `${datos.razon} [Inconsistencia detectada: Respuesta contradictoria: match es false con porcentaje alto (91%) sin registrar ninguna exclusión obligatoria justificada con evidencia verificable de la oferta.]`);
});

// Reutilizo los modelos reales de ofertas sobre un pool cerrado a consultas inesperadas.
async function ejecutarWorker(descripcion, datos, cambios = {}, preferenciasCaso = perfil) {
    const oferta = { id: 8101, titulo: 'Desarrollo TypeScript Junior', descripcion, modalidad: 'remoto',
        estado_evaluacion: 'pendiente', porcentaje_match: null, razon_evaluacion: null,
        evaluacion_error_mensaje: null, nota_postulacion: 'Nota sintética conservada', ...cambios };
    let almacenada = structuredClone(oferta);
    pool.query.mockImplementation(async (sql, parametros) => {
        if (sql.includes('SELECT') && sql.includes("estado_evaluacion = 'pendiente'")) return { rows: [structuredClone(almacenada)] };
        if (sql.startsWith('SELECT') && sql.includes('WHERE id = $1')) return { rows: [structuredClone(almacenada)] };
        if (sql.startsWith('UPDATE ofertas') && sql.includes('SET estado_evaluacion = $1')) {
            const [estado, razon, porcentaje, id, error, prioridad, puntaje, evidencias, version, firma, explicacion] = parametros;
            expect(id).toBe(oferta.id);
            expect(parametros[11]).toBe(oferta.descripcion);
            almacenada = { ...almacenada, estado_evaluacion: estado, razon_evaluacion: razon,
                porcentaje_match: porcentaje, evaluacion_error_mensaje: error, prioridad_ia: prioridad,
                puntaje_prioridad_ia: puntaje, evidencias_prioridad_ia: JSON.parse(evidencias),
                version_prioridad_ia: version, firma_criterios_evaluacion: firma,
                explicacion_evaluacion: explicacion ? JSON.parse(explicacion) : null };
            return { rows: [structuredClone(almacenada)] };
        }
        throw new Error('Consulta inesperada en el pool sintético.');
    });
    preferencias.obtenerPreferencias.mockResolvedValue(preferenciasCaso);
    if (datos instanceof Error) proveedor.consultarDeepSeek.mockRejectedValue(datos);
    else proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    const resumen = await servicio.evaluarOfertasPendientes();
    const guardada = await ofertas.obtenerOfertaPorId(oferta.id);
    expect(guardada.nota_postulacion).toBe(oferta.nota_postulacion);
    expect(guardada.prioridad_ia).toBe(false);
    expect(lotes.actualizarProgreso).toHaveBeenLastCalledWith(81, expect.objectContaining({
        evaluadas: resumen.evaluadas, procesadas: 1, pendientes: resumen.pendientes,
        aprobadas: resumen.aprobadas, rechazadas: resumen.rechazadas, errores: resumen.errores,
    }));
    expect(lotes.finalizarLote).toHaveBeenLastCalledWith(81, resumen.estado);
    return { resumen, guardada };
}

test.each(casos)('proveedor → parser → worker → modelo/pool: %s', async (nombre, descripcion, evidencia, valida) => {
    const datos = respuesta(evidencia);
    const { resumen, guardada } = await ejecutarWorker(descripcion, datos);
    expect(guardada).toEqual(expect.objectContaining({ estado_evaluacion: valida ? 'rechazada' : 'pendiente',
        porcentaje_match: valida ? 91 : null, explicacion_evaluacion: { ...datos.explicacion, desglose_disponible: true },
        evaluacion_error_mensaje: valida ? null : guardada.razon_evaluacion,
        firma_criterios_evaluacion: valida ? expect.any(String) : null,
    }));
    expect(guardada.razon_evaluacion).toBe(valida ? datos.razon : `${datos.razon} [Inconsistencia detectada: Respuesta contradictoria: match es false con porcentaje alto (91%) sin registrar ninguna exclusión obligatoria justificada con evidencia verificable de la oferta.]`);
    expect(resumen).toEqual(expect.objectContaining({ total: 1, procesadas: 1, evaluadas: valida ? 1 : 0,
        aprobadas: 0, rechazadas: valida ? 1 : 0, errores: valida ? 0 : 1, pendientes: valida ? 0 : 1,
        porcentaje: 100, estado: valida ? 'completado' : 'error' }));
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(valida ? 1 : 0);
    expect(console.error).toHaveBeenCalledTimes(valida ? 0 : 1);
});

test.each([
    ['presencial explícito', 'Desarrollo web con TypeScript.', 'presencial', false],
    ['modalidad desconocida', 'Desarrollo web con TypeScript.', null, true],
    ['presencial textual', 'Trabajo presencial. Desarrollo web con TypeScript.', null, false],
    ['remoto textual', 'Trabajo remoto. Desarrollo web con TypeScript.', null, true],
    ['remoto restringido', 'Trabajo remoto. US residents only.', 'remoto', false],
])('#83 ya resuelve %s antes del parser cuando corresponde', async (nombre, descripcion, modalidad, usaProveedor) => {
    const datos = { match: false, porcentaje: 25, razon: 'Afinidad técnica insuficiente.' };
    const { resumen, guardada } = await ejecutarWorker(descripcion, datos, { modalidad, ubicacion: 'Córdoba, Argentina' });
    expect(guardada.estado_evaluacion).toBe('rechazada');
    expect(guardada.porcentaje_match).toBe(usaProveedor ? 25 : 10);
    expect(guardada.evaluacion_error_mensaje).toBeNull();
    expect(guardada.razon_evaluacion).toEqual(usaProveedor ? datos.razon : expect.any(String));
    if (usaProveedor) expect(guardada.explicacion_evaluacion).toBeNull();
    else expect(guardada.explicacion_evaluacion.exclusiones).toHaveLength(1);
    expect(resumen).toEqual(expect.objectContaining({ evaluadas: 1, rechazadas: 1, aprobadas: 0, errores: 0, pendientes: 0 }));
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(usaProveedor ? 1 : 0);
});

test.each([null, 'remoto'])('geografía con cita entre oraciones llega al parser, modalidad %s', async modalidad => {
    const descripcion = 'Residencia en provincia Delta obligatoria. Debe mantenerse durante el contrato.';
    const datos = respuesta(descripcion);
    datos.explicacion.exclusiones[0].requisito = 'Residencia en provincia Delta';
    const { resumen, guardada } = await ejecutarWorker(descripcion, datos, { modalidad });
    expect(guardada).toEqual(expect.objectContaining({ estado_evaluacion: 'rechazada', porcentaje_match: 91,
        razon_evaluacion: datos.razon, evaluacion_error_mensaje: null,
        explicacion_evaluacion: { ...datos.explicacion, desglose_disponible: true } }));
    expect(resumen).toEqual(expect.objectContaining({ evaluadas: 1, rechazadas: 1, aprobadas: 0, errores: 0, pendientes: 0 }));
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each(['SALIDA_TRUNCADA', 'ERROR_TRANSPORTE'])('fallo %s conserva pendiente técnico sin decisión laboral', async codigo => {
    const fallo = Object.assign(new Error('Fallo sintético'), { codigo });
    const { resumen, guardada } = await ejecutarWorker('Desarrollo web con TypeScript.', fallo);
    expect(guardada).toEqual(expect.objectContaining({ estado_evaluacion: 'pendiente', porcentaje_match: null,
        firma_criterios_evaluacion: null, explicacion_evaluacion: null,
        evaluacion_error_mensaje: guardada.razon_evaluacion }));
    expect(guardada.razon_evaluacion).toBe(codigo === 'SALIDA_TRUNCADA'
        ? 'Error al evaluar con DeepSeek: DeepSeek devolvió una respuesta incompleta. Volvé a intentar.'
        : 'Error al evaluar con DeepSeek: Error técnico (ERROR_TRANSPORTE). Volvé a intentar.');
    expect(resumen).toEqual(expect.objectContaining({ evaluadas: 0, procesadas: 1, rechazadas: 0, aprobadas: 0, errores: 1, pendientes: 1, estado: 'error' }));
    expect(cache.guardarCache).not.toHaveBeenCalled();
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test('#80 mantiene elegibilidad desconocida pendiente sin error y con afinidad intacta', async () => {
    const datos = { match: true, porcentaje: 91, razon: 'Afinidad técnica suficiente.',
        explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [item('Matrícula profesional obligatoria.')] } };
    const { resumen, guardada } = await ejecutarWorker('Matrícula profesional obligatoria.', datos, {}, { stack_tecnologico: ['TypeScript'] });
    expect(guardada).toEqual(expect.objectContaining({ estado_evaluacion: 'pendiente', porcentaje_match: 91,
        razon_evaluacion: 'Pendiente de confirmación: Matrícula profesional. Afinidad técnica estimada: 91%.',
        evaluacion_error_mensaje: null, firma_criterios_evaluacion: expect.any(String) }));
    expect(guardada.explicacion_evaluacion.exclusiones).toEqual([]);
    expect(guardada.explicacion_evaluacion.por_confirmar).toEqual([expect.objectContaining({ requisito, tipo: 'obligatorio' })]);
    expect(resumen).toEqual(expect.objectContaining({ evaluadas: 1, procesadas: 1, aprobadas: 0, rechazadas: 0, errores: 0, pendientes: 0 }));
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});
