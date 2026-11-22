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

test.each([
    ['El puesto menciona Kubernetes; no especifica si es requisito obligatorio.', 'menciona Kubernetes', 80, true],
    ['El equipo trabaja con Terraform.', 'trabaja con Terraform', 60, true, 'Terraform'],
    ['El aviso menciona Kubernetes.', 'menciona Kubernetes', 59, false],
    ['El aviso menciona Kubernetes como deseable.', 'menciona Kubernetes', 80, false],
    ['No se requiere Kubernetes.', 'Kubernetes', 80, false],
    ['Beneficios: logo de Kubernetes en las remeras.', 'Kubernetes', 80, false],
    ['El eslogan menciona Kubernetes.', 'menciona Kubernetes', 80, false],
    ['Beneficios: logo de Active Directory en las remeras.', 'Active Directory', 80, false, 'Active Directory'],
    ['El equipo trabaja con Kubernetes.', 'menciona Kubernetes', 80, false],
    ['El aviso menciona Docker y Kubernetes es un beneficio.', 'menciona Docker', 80, false],
])('contrasta la duda con una cita literal relacionada (%s; %s; %i)', async (descripcion, evidencia, porcentaje, pendiente, requisito = 'Kubernetes') => {
    const match = porcentaje >= 60;
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match, porcentaje, razon: 'Evaluación sintética.', explicacion: {
        por_confirmar: [{ requisito, tipo: 'desconocido', evidencia_oferta: evidencia }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Soporte junior', descripcion }, null, null, {});
    expect(resultado).toMatchObject({ match, porcentaje, firma_criterios_evaluacion: expect.any(String) });
    expect(resultado.error).not.toBe(true);
    expect(resultado.pendiente === true).toBe(pendiente);
    expect(resultado.explicacion.exclusiones).toEqual([]);
    const [, , , cacheado] = guardarCache.mock.calls[0];
    buscarCache.mockResolvedValueOnce(structuredClone(cacheado));
    await expect(evaluarOferta({ titulo: 'Soporte junior', descripcion }, null, null, {})).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each([false, true])('Kubernetes obligatorio al 80 %%: solo veto con ausencia acreditada (%s)', async confirmada => {
    const oferta = { titulo: 'Soporte junior', descripcion: 'Kubernetes es obligatorio.' };
    const perfil = confirmada ? { conocimientos_ausentes: ['Kubernetes'] } : {};
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética.', explicacion: {
        exclusiones: [{ requisito: 'Kubernetes', tipo: 'obligatorio', evidencia_oferta: 'Kubernetes es obligatorio.',
            evidencia_perfil: confirmada ? 'Kubernetes' : '' }],
    } }));
    const resultado = await evaluarOferta(oferta, null, null, perfil);
    expect(resultado).toMatchObject({ match: false, porcentaje: 80, firma_criterios_evaluacion: expect.any(String) });
    expect(resultado.pendiente === true).toBe(!confirmada);
    expect(resultado.explicacion.exclusiones).toHaveLength(confirmada ? 1 : 0);
    expect(resultado.explicacion.por_confirmar).toHaveLength(confirmada ? 0 : 1);
    const [, , , cacheado] = guardarCache.mock.calls[0];
    buscarCache.mockResolvedValueOnce(structuredClone(cacheado));
    await expect(evaluarOferta(oferta, null, null, perfil)).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

const AD = 'Active Directory';
const casos = [
    ['mención contextual reconocida como desconocida', 'El equipo trabaja con Active Directory.', AD, true, 'por_confirmar', 'desconocido', '', [], 'pendiente', 'desconocido'],
    ['veto no acreditado con nombre compuesto', 'Se requiere experiencia con Active Directory.', `Experiencia con ${AD}`, false, 'exclusiones', 'obligatorio', '', [], 'pendiente', 'obligatorio'],
    ['ausencia real ante obligación no acreditada', 'El equipo trabaja con Active Directory.', AD, true, 'exclusiones', 'obligatorio', AD, [AD], 'pendiente', 'desconocido'],
    ['dos contextos deseables mal rotulados', 'Se valora Active Directory. Active Directory deseable.', AD, true, 'exclusiones', 'obligatorio', AD, [AD], 'aprobada', null],
    ['negación en cuerpo no queda anulada por el título', 'No se requiere Active Directory.', AD, false, 'exclusiones', 'obligatorio', AD, [AD], 'tecnico', null],
    ['autorización obligatoria sin evidencia del candidato', 'Es obligatorio contar con autorización laboral vigente.', 'Autorización laboral vigente', false, 'exclusiones', 'obligatorio', '', [], 'pendiente', 'obligatorio'],
    ['veto de AD acreditado con nombre compuesto', 'Se requiere experiencia con Active Directory.', `Experiencia con ${AD}`, false, 'exclusiones', 'obligatorio', AD, [AD], 'rechazada', null],
    ['una tarea neutral no invalida un requisito obligatorio', 'Requisitos obligatorios:\n- Active Directory\nTareas:\n- Administrar Active Directory.', AD, false, 'exclusiones', 'obligatorio', AD, [AD], 'rechazada', null, 95],
];

test.each(casos)('%s', async (_caso, descripcion, requisito, match, categoria, tipo, evidenciaPerfil, ausencias, estado, tipoFinal, porcentaje = 80) => {
    const oferta = { titulo: 'Soporte Active Directory', modalidad: 'remoto', descripcion };
    const perfil = { conocimientos_ausentes: ausencias };
    const evidencia = descripcion.startsWith('Es obligatorio') ? requisito : AD;
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match, porcentaje, razon: 'Evaluación sintética.',
        explicacion: { [categoria]: [{ requisito, tipo, evidencia_oferta: evidencia, evidencia_perfil: evidenciaPerfil }] } }));
    const resultado = await evaluarOferta(oferta, null, null, perfil);
    if (estado === 'tecnico') {
        expect(resultado).toMatchObject({ match: false, error: true, invalido: true, firma_criterios_evaluacion: null });
        expect(resultado.pendiente).not.toBe(true);
        expect(resultado.explicacion.exclusiones).toEqual([]);
        expect(guardarCache).not.toHaveBeenCalled();
        return;
    }
    expect(resultado).toMatchObject({ match, porcentaje, firma_criterios_evaluacion: expect.any(String) });
    expect(resultado.error).not.toBe(true);
    expect(resultado.pendiente === true).toBe(estado === 'pendiente');
    if (estado === 'rechazada') {
        expect(resultado.explicacion.exclusiones).toEqual([expect.objectContaining({ requisito, tipo: 'obligatorio', evidencia_perfil: AD })]);
    } else {
        expect(resultado.explicacion.exclusiones).toEqual([]);
    }
    if (estado === 'pendiente') {
        expect(resultado.explicacion.por_confirmar).toEqual([expect.objectContaining({ requisito, tipo: tipoFinal, evidencia_perfil: '' })]);
        expect(resultado.explicacion.no_cumplidos).toEqual([]);
    }
    if (estado === 'aprobada') {
        expect(resultado.explicacion.por_confirmar.every(item => item.tipo === 'deseable')).toBe(true);
    }
    expect(guardarCache).toHaveBeenCalledTimes(1);
    const [, , , cacheado] = guardarCache.mock.calls[0];
    buscarCache.mockResolvedValueOnce(structuredClone(cacheado));
    await expect(evaluarOferta(oferta, null, null, perfil)).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
});
