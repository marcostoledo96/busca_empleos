'use strict';
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
const { parsearRespuestaEvaluacionIa: parsear } = require('../../src/servicios/evaluacion/parser-respuesta-ia');
const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');
const proveedor = require('../../src/config/deepseek');
const cache = require('../../src/modelos/evaluacion-cache');
const requisito = 'Matrícula profesional';
const descripcion = 'Matrícula profesional obligatoria. Debe estar vigente.';
const item = evidencia => ({ requisito, tipo: 'obligatorio', evidencia_oferta: evidencia,
    evidencia_perfil: requisito, explicacion: 'Caso sintético independiente.' });
const explicacion = () => ({ cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] });
beforeEach(() => { jest.resetAllMocks(); cache.buscarCache.mockResolvedValue(null); });

// S2, S3, S5: conservo una aparición íntegra y no uno fragmentos ajenos.
test.each([
    ['repetida válida', 'Deseables:\n- Matrícula profesional. Debe estar vigente.\nRequisitos:\n- Matrícula profesional. Debe estar vigente.', 'Matrícula profesional. Debe estar vigente.', true],
    ['HTML local', `<p>${descripcion}</p>`, descripcion, true],
    ['fragmentos separados', 'Matrícula profesional. Otro requisito. Debe estar vigente.', 'Matrícula profesional. Debe estar vigente.', false],
])('%s', (nombre, texto, evidencia, valida) => {
    const resultado = parsear(JSON.stringify({ match: false, porcentaje: 91, razon: 'Razón sintética.',
        explicacion: { ...explicacion(), exclusiones: [item(evidencia)] } }), texto);
    expect(Boolean(resultado.error)).toBe(!valida);
    expect(resultado.match).toBe(false);
    expect(resultado.porcentaje).toBe(91);
});

// S3-S5: verifico el consumidor compartido y la rederivación desde caché sin flag.
test.each(['desconocido', 'ausente', 'confirmado'])('elegibilidad %s y caché', async tipo => {
    const perfil = { stack_tecnologico: ['TypeScript'],
        ...(tipo === 'ausente' ? { conocimientos_ausentes: [requisito] }
            : tipo === 'confirmado' ? { perfil_profesional: requisito } : {}) };
    const desglose = explicacion();
    desglose[tipo === 'confirmado' ? 'cumplidos' : 'por_confirmar'] = [item(descripcion)];
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 91,
        razon: 'Razón sintética.', explicacion: desglose }));
    const oferta = { id: 8181, titulo: 'Desarrollo TypeScript Junior', descripcion, modalidad: 'remoto' };
    const resultado = await evaluarOferta(oferta, undefined, undefined, perfil);
    expect(resultado.error).toBeUndefined();
    expect(resultado.porcentaje).toBe(91);
    expect(resultado.match).toBe(tipo !== 'ausente');
    expect(Boolean(resultado.pendiente)).toBe(tipo === 'desconocido');
    expect(resultado.razon).toBe(tipo === 'desconocido'
        ? 'Pendiente de confirmación: Matrícula profesional. Afinidad técnica estimada: 91%.'
        : tipo === 'ausente'
            ? 'Incompatibilidad confirmada: Matrícula profesional. Afinidad técnica estimada: 91%.'
            : 'Razón sintética.');
    const categoria = tipo === 'desconocido' ? 'por_confirmar' : tipo === 'ausente' ? 'exclusiones' : 'cumplidos';
    expect(resultado.explicacion[categoria][0].evidencia_oferta).toBe(descripcion);
    const cacheado = structuredClone(resultado);
    delete cacheado.pendiente;
    const antes = JSON.stringify(cacheado);
    cache.buscarCache.mockResolvedValue(cacheado);
    const hit = await evaluarOferta(oferta, undefined, undefined, perfil);
    expect(hit.match).toBe(resultado.match);
    expect(Boolean(hit.pendiente)).toBe(Boolean(resultado.pendiente));
    expect(hit.razon).toBe(resultado.razon);
    expect(hit.explicacion).toEqual(resultado.explicacion);
    expect(JSON.stringify(cacheado)).toBe(antes);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(1);
});
