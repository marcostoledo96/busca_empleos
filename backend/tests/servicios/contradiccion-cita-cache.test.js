jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({}));
jest.mock('../../src/modelos/preferencia', () => ({}));
jest.mock('../../src/modelos/evaluacion-lote', () => ({}));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));

const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');
const { buscarCache, guardarCache } = require('../../src/modelos/evaluacion-cache');
const { consultarDeepSeek } = require('../../src/config/deepseek');

beforeEach(() => jest.resetAllMocks());

async function probar({ requisito, descripcion, cita = descripcion, porcentaje = 80, match = false }) {
    const oferta = { titulo: 'Soporte junior', descripcion };
    const perfil = { conocimientos_ausentes: [requisito] };
    const item = { requisito, tipo: 'obligatorio', evidencia_oferta: cita, evidencia_perfil: match ? '' : requisito };
    const respuesta = { match, porcentaje, razon: 'Estimación sintética.',
        explicacion: { [match ? 'por_confirmar' : 'exclusiones']: [item] } };
    const evaluar = opciones => evaluarOferta(oferta, null, null, perfil, opciones);
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(respuesta));
    const resultado = await evaluar();
    const pendiente = porcentaje >= 60;
    expect({ error: resultado.error === true, pendiente: resultado.pendiente === true,
        razon: resultado.razon, exclusiones: resultado.explicacion.exclusiones }).toEqual({
        error: false, pendiente, exclusiones: [], razon: pendiente
            ? `Pendiente de confirmación: ${requisito}. Afinidad técnica estimada: ${porcentaje}%.`
            : 'Afinidad técnica estimada: 59% (por debajo del umbral del 60%).',
    });
    expect(resultado).toMatchObject({ match, porcentaje, firma_criterios_evaluacion: expect.any(String),
        explicacion: { no_cumplidos: [], por_confirmar: [expect.objectContaining({ requisito,
            tipo: 'desconocido', evidencia_oferta: cita, evidencia_perfil: '' })] } });
    const [hash, firma, modelo, valor] = guardarCache.mock.calls[0];
    expect(valor).toEqual(resultado);
    buscarCache.mockResolvedValueOnce(structuredClone(valor));
    await expect(evaluar()).resolves.toEqual(resultado);
    expect(buscarCache).toHaveBeenLastCalledWith(hash, firma, modelo);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(respuesta));
    await expect(evaluar({ forzar: true })).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(buscarCache).toHaveBeenCalledTimes(2);
    expect(guardarCache).toHaveBeenCalledTimes(2);
}

test.each([
    ['Active Directory', 80, 'Active Directory es obligatorio. Active Directory es deseable.'],
    ['Autorización laboral', 60, 'Autorización laboral es opcional. Autorización laboral es obligatoria.'],
    ['Kubernetes', 59, 'Kubernetes es obligatorio. Kubernetes es opcional.'],
    ['Kubernetes', 60, 'Kubernetes es obligatorio. Kubernetes es opcional.'],
])('S9: %s con ausencia, cita completa y afinidad %i', (requisito, porcentaje, descripcion) =>
    probar({ requisito, descripcion, porcentaje }));

test.each([
    ['Active Directory', 'Active Directory (AD) es obligatorio', 'Active Directory es deseable'],
    ['Autorización laboral', 'Es obligatorio contar con autorización laboral vigente', 'La autorización laboral es deseable'],
    ['Kubernetes', 'Se requiere dominar Kubernetes', 'Kubernetes es deseable'],
])('S9: %s con predicado explícito y cita de la cláusula obligatoria', (requisito, cita, opcional) =>
    probar({ requisito, descripcion: `${cita}. ${opcional}.`, cita, match: true }));

test('S9: no valida ni cachea una exclusión con una cita inventada', async () => {
    const requisito = 'Active Directory';
    const descripcion = 'Active Directory es obligatorio. Active Directory es deseable.';
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, explicacion: { exclusiones: [{
        requisito, tipo: 'obligatorio', evidencia_oferta: `${descripcion} El contrato lo exige.`, evidencia_perfil: requisito,
    }] } }));
    const resultado = await evaluarOferta({ titulo: 'Soporte junior', descripcion }, null, null, { conocimientos_ausentes: [requisito] });
    expect(resultado).toMatchObject({ error: true, invalido: true, firma_criterios_evaluacion: null });
    expect(resultado.pendiente).not.toBe(true);
    expect(guardarCache).not.toHaveBeenCalled();
});

test('S9: la cita obligatoria de AD queda pendiente a 60, también al reevaluar', () => probar({
    requisito: 'Active Directory', porcentaje: 60, cita: 'Active Directory es obligatorio',
    descripcion: 'Active Directory es obligatorio. Active Directory es deseable.',
}));
