'use strict';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ obtenerOfertasPendientes: jest.fn(), actualizarEvaluacion: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-lote', () => ({ crearLote: jest.fn(), actualizarProgreso: jest.fn(), finalizarLote: jest.fn() }));

const { casos, crearOferta, conflicto, casosF1, casosF2 } = require('../fixtures/issue-79-contexto');
const reglas = require('../../src/servicios/evaluacion/reglas-exclusion');
const servicio = require('../../src/servicios/servicio-evaluacion');
const proveedor = require('../../src/config/deepseek');
const cache = require('../../src/modelos/evaluacion-cache');
const ofertas = require('../../src/modelos/oferta');
const preferencias = require('../../src/modelos/preferencia');
const lote = require('../../src/modelos/evaluacion-lote');
const { construirIdentidadEvaluacion } = require('../../src/servicios/evaluacion/identidad-evaluacion');
const prefs = { nivel_experiencia: 'junior', stack_tecnologico: ['TypeScript'], zonas_preferidas: [] };
const porcentajes = { java: 10, seniority: 15, experiencia: 20, idioma: 15 };
const respuesta = match => ({ match, porcentaje: match ? 80 : 25, razon: 'Decisión contextual simulada' });

beforeEach(() => {
    jest.clearAllMocks();
    cache.buscarCache.mockResolvedValue(null);
    cache.guardarCache.mockResolvedValue();
    ofertas.actualizarEvaluacion.mockResolvedValue({ id: 1 });
    preferencias.obtenerPreferencias.mockResolvedValue(prefs);
    lote.crearLote.mockResolvedValue({ id: 1 });
});

test.each(casos)('regla pública: %s', (nombre, cambios, regla) => {
    const resultado = reglas.evaluarReglasExclusion(crearOferta(cambios), prefs);
    expect(resultado.excluida).toBe(Boolean(regla));
    expect(resultado.reglas).toEqual(regla ? [regla] : []);
    expect(resultado.porcentaje).toBe(regla ? porcentajes[regla] : null);
    if (regla) {
        expect(resultado.match).toBe(false);
        expect(resultado.explicacion.exclusiones).toHaveLength(1);
        expect(resultado.explicacion.exclusiones[0].evidencia_oferta).not.toBe('');
    }
});

test.each(casos.flatMap(caso => [true, false].map(match => [...caso, match])))('evaluador pre/post: %s (%s / %s / %s)', async (nombre, cambios, regla, match) => {
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(match)));
    const oferta = crearOferta(cambios);
    const original = structuredClone(oferta);
    const resultado = await servicio.evaluarOferta(oferta, undefined, undefined, prefs);
    expect(resultado.match).toBe(regla ? false : match);
    expect(resultado.porcentaje).toBe(regla ? porcentajes[regla] : respuesta(match).porcentaje);
    expect(resultado.error || false).toBe(false);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(regla ? 0 : 1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(regla ? 0 : 1);
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
    expect(oferta).toEqual(original);
    if (!regla) expect(resultado.razon).toBe(respuesta(match).razon);
});

test.each(casos)('caché y persistencia pública: %s', async (nombre, cambios, regla) => {
    const oferta = crearOferta(cambios);
    ofertas.obtenerOfertasPendientes.mockResolvedValue([oferta]);
    const almacenada = respuesta(true);
    const original = structuredClone(oferta);
    cache.buscarCache.mockResolvedValue(almacenada);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen.aprobadas).toBe(regla ? 0 : 1);
    expect(resumen.rechazadas).toBe(regla ? 1 : 0);
    expect(resumen.errores).toBe(0);
    expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(1, regla ? 'rechazada' : 'aprobada', expect.any(String),
        regla ? porcentajes[regla] : 80, null, null, expect.any(String), regla ? expect.anything() : null, oferta.descripcion);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(cache.guardarCache).not.toHaveBeenCalled();
    expect(oferta).toEqual(original);
    expect(almacenada).toEqual(respuesta(true));
});

function verificarConflicto(resultado) {
    expect(resultado.explicacion.por_confirmar).toEqual(expect.arrayContaining([expect.objectContaining({
        requisito: 'Conflicto de seniority', tipo: 'desconocido',
        evidencia_oferta: expect.stringContaining('nivel_requerido: Senior'),
        explicacion: expect.stringContaining('Junior'),
    })]));
    expect(resultado.explicacion.exclusiones).toEqual([]);
}

test('conflicto trazable en reglas sin convertirlo en exclusión', () => {
    const resultado = reglas.evaluarReglasExclusion(conflicto, prefs);
    expect(resultado.excluida).toBe(false);
    verificarConflicto(resultado);
});

test.each([true, false])('conservo conflicto y decisión del proveedor: %s', async match => {
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(match)));
    const resultado = await servicio.evaluarOferta(conflicto, undefined, undefined, prefs);
    expect(resultado.match).toBe(match);
    expect(resultado.porcentaje).toBe(respuesta(match).porcentaje);
    expect(resultado.razon).toBe(respuesta(match).razon);
    verificarConflicto(resultado);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(proveedor.consultarDeepSeek.mock.calls[0][1]).toContain('Nivel requerido: Senior');
    expect(cache.guardarCache.mock.calls[0][3]).toEqual(resultado);
});

test.each([true, false])('conservo conflicto en un hit sin mutar caché y lo persisto: %s', async match => {
    const almacenada = { ...respuesta(match), explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] } };
    cache.buscarCache.mockResolvedValue(almacenada);
    ofertas.obtenerOfertasPendientes.mockResolvedValue([conflicto]);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen.rechazadas).toBe(match ? 0 : 1);
    expect(resumen.aprobadas).toBe(match ? 1 : 0);
    verificarConflicto({ explicacion: ofertas.actualizarEvaluacion.mock.calls[0][7] });
    expect(almacenada.explicacion.por_confirmar).toEqual([]);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(cache.guardarCache).not.toHaveBeenCalled();
});

test('otro requisito mantiene exclusión y conflicto sin tocar porcentajes', async () => {
    const resultado = await servicio.evaluarOferta({ ...conflicto, descripcion: `${conflicto.descripcion} Java obligatorio.` }, undefined, undefined, prefs);
    expect(resultado.match).toBe(false);
    expect(resultado.porcentaje).toBe(10);
    expect(resultado.explicacion.exclusiones).toHaveLength(1);
    expect(resultado.explicacion.por_confirmar).toHaveLength(1);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test.each(['java', 'seniority', 'experiencia', 'idioma'].map(regla => casos.find(([, , tipo]) => tipo === regla)))('defensa posterior real: %s', async (nombre, cambios, regla) => {
    const oferta = crearOferta({});
    proveedor.consultarDeepSeek.mockImplementationOnce(async () => {
        Object.assign(oferta, cambios);
        return JSON.stringify(respuesta(true));
    });
    const resultado = await servicio.evaluarOferta(oferta, undefined, undefined, prefs);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(resultado.match).toBe(false);
    expect(resultado.porcentaje).toBe(porcentajes[regla]);
    expect(resultado.explicacion.exclusiones).toHaveLength(1);
});

test.each([
    { titulo: 'Desarrollo', descripcion: 'Trabajarás junto a un mentor Junior.' },
    { titulo: 'Desarrollo', descripcion: 'Buscamos desarrollador para nuestro equipo Junior.' },
    { titulo: 'Desarrollo', descripcion: 'Nuestra empresa acompaña perfiles Junior.' },
])('no invento conflicto por nivel de otros sujetos: %j', cambios => {
    const resultado = reglas.evaluarReglasExclusion(crearOferta({ ...cambios, nivel_requerido: 'Senior' }), prefs);
    expect(resultado.explicacion.por_confirmar).toEqual([]);
});

test('el cuerpo Junior también conserva conflicto sin depender del título', async () => {
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(false)));
    const resultado = await servicio.evaluarOferta({ ...conflicto, titulo: 'Desarrollo' }, undefined, undefined, prefs);
    verificarConflicto(resultado);
    expect(resultado.match).toBe(false);
    expect(proveedor.consultarDeepSeek.mock.calls[0][0]).toContain('conflicto en por_confirmar');
});

const casosB2 = [
    ['B2 Junior afirmado', 'Buscamos Junior para desarrollo web con TypeScript.', true, null],
    ['B2 Junior negado', 'No buscamos perfil Junior; buscamos perfil Senior.', false, 'seniority'],
];
test.each(casosB2)('%s: conflicto en reglas públicas', (nombre, descripcion, hayConflicto, regla) => {
    const resultado = reglas.evaluarReglasExclusion(crearOferta({ titulo: 'Desarrollo web', nivel_requerido: 'Senior', descripcion }), prefs);
    expect(resultado.reglas).toEqual(regla ? [regla] : []);
    expect(resultado.explicacion.por_confirmar).toHaveLength(hayConflicto ? 1 : 0);
    if (hayConflicto) verificarConflicto(resultado);
});

test.each(casosB2.flatMap(caso => [true, false].flatMap(match => [false, true].map(hit => [...caso, match, hit]))))(
    '%s: proveedor/caché (%s / %s / %s / %s / %s)',
    async (nombre, descripcion, hayConflicto, regla, match, hit) => {
        const oferta = crearOferta({ titulo: 'Desarrollo web', nivel_requerido: 'Senior', descripcion });
        const almacenada = respuesta(match);
        const original = structuredClone(oferta);
        cache.buscarCache.mockResolvedValue(hit ? almacenada : null);
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(match)));
        const resultado = await servicio.evaluarOferta(oferta, undefined, undefined, prefs);
        expect(resultado.match).toBe(regla ? false : match);
        expect(resultado.porcentaje).toBe(regla ? 15 : respuesta(match).porcentaje);
        expect(resultado.error || false).toBe(false);
        expect(resultado.explicacion?.por_confirmar || []).toHaveLength(hayConflicto ? 1 : 0);
        if (hayConflicto) verificarConflicto(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(regla || hit ? 0 : 1);
        expect(cache.guardarCache).toHaveBeenCalledTimes(regla || hit ? 0 : 1);
        expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
        expect(oferta).toEqual(original);
        expect(almacenada).toEqual(respuesta(match));
    }
);

test.each(casosF1)('%s: reglas posteriores sin modificar scores del proveedor', async (nombre, cambios, regla) => {
    const oferta = crearOferta({ titulo: 'Desarrollo web' });
    proveedor.consultarDeepSeek.mockImplementationOnce(async () => {
        // Simulo el cambio entre defensas únicamente para alcanzar la postvalidación.
        Object.assign(oferta, cambios);
        return JSON.stringify(respuesta(true));
    });
    const resultado = await servicio.evaluarOferta(oferta, undefined, undefined, prefs);
    expect(resultado.match).toBe(!regla);
    expect(resultado.porcentaje).toBe(regla ? 10 : 80);
    expect(resultado.explicacion.exclusiones).toHaveLength(regla ? 1 : 0);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(1);
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
});

test.each(casosF2.filter(([, , , hayConflicto]) => !hayConflicto))('%s: defensa posterior sin conflicto inventado', async (nombre, descripcion, regla) => {
    const oferta = crearOferta({ titulo: 'Desarrollo web', nivel_requerido: 'Senior' });
    proveedor.consultarDeepSeek.mockImplementationOnce(async () => {
        oferta.descripcion = descripcion;
        return JSON.stringify(respuesta(true));
    });
    const resultado = await servicio.evaluarOferta(oferta, undefined, undefined, prefs);
    expect(resultado.match).toBe(!regla);
    expect(resultado.porcentaje).toBe(regla ? 15 : 80);
    expect(resultado.explicacion.por_confirmar).toEqual([]);
    expect(resultado.explicacion.exclusiones).toHaveLength(regla ? 1 : 0);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(1);
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
});

test.each(casosF2.flatMap(caso => ['Senior', 'SR'].map(nivel => [...caso, nivel])))(
    '%s: regla pública con metadato %s/%s/%s/%s',
    (nombre, descripcion, regla, hayConflicto, nivel) => {
        const oferta = crearOferta({ titulo: 'Desarrollo web', nivel_requerido: nivel, descripcion });
        const original = structuredClone(oferta);
        const resultado = reglas.evaluarReglasExclusion(oferta, prefs);
        expect(resultado.reglas).toEqual(regla ? [regla] : []);
        expect(resultado.porcentaje).toBe(regla ? 15 : null);
        expect(resultado.explicacion.por_confirmar).toHaveLength(hayConflicto ? 1 : 0);
        if (hayConflicto) expect(resultado.explicacion.por_confirmar[0].evidencia_oferta).toContain(`nivel_requerido: ${nivel}`);
        expect(oferta).toEqual(original);
    }
);

test.each(casosF2.flatMap(caso => ['Senior', 'SR'].flatMap(nivel => [true, false].flatMap(match =>
    [true, false].map(hit => [...caso, nivel, match, hit])))))(
    '%s: lote público (%s/%s/%s/%s/%s/%s)',
    async (nombre, descripcion, regla, hayConflicto, nivel, match, hit) => {
        const oferta = crearOferta({ titulo: 'Desarrollo web', nivel_requerido: nivel, descripcion });
        const original = structuredClone(oferta);
        const almacenada = { ...respuesta(match), explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] } };
        const cacheOriginal = structuredClone(almacenada);
        cache.buscarCache.mockResolvedValue(hit ? almacenada : null);
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(almacenada));
        ofertas.obtenerOfertasPendientes.mockResolvedValue([oferta]);
        const resumen = await servicio.evaluarOfertasPendientes();
        const aprobada = !regla && match;
        expect(resumen.aprobadas).toBe(aprobada ? 1 : 0);
        expect(resumen.rechazadas).toBe(aprobada ? 0 : 1);
        expect(resumen.errores).toBe(0);
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledTimes(1);
        const guardada = ofertas.actualizarEvaluacion.mock.calls[0];
        expect(guardada[1]).toBe(aprobada ? 'aprobada' : 'rechazada');
        expect(guardada[3]).toBe(regla ? 15 : respuesta(match).porcentaje);
        expect(guardada[7]?.por_confirmar || []).toHaveLength(hayConflicto ? 1 : 0);
        expect(guardada[7]?.exclusiones || []).toHaveLength(regla ? 1 : 0);
        if (hayConflicto) expect(guardada[7].por_confirmar[0].evidencia_oferta).toContain(`nivel_requerido: ${nivel}`);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(regla || hit ? 0 : 1);
        expect(cache.guardarCache).toHaveBeenCalledTimes(regla || hit ? 0 : 1);
        expect(oferta).toEqual(original);
        expect(almacenada).toEqual(cacheOriginal);
    }
);

test('el contrato nuevo cambia la firma incluso con instrucciones explícitas', () => {
    const opciones = { instrucciones: 'Sistema explícito' };
    const actual = construirIdentidadEvaluacion(conflicto, prefs, opciones);
    const anterior = construirIdentidadEvaluacion(conflicto, prefs, { ...opciones, version: 'evaluacion-v4' });
    expect(actual.firma_criterios_evaluacion).not.toBe(anterior.firma_criterios_evaluacion);
});
