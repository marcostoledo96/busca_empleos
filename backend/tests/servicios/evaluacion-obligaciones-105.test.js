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
    ['Stack del equipo: Active Directory.', 'Active Directory', 80, true, 'Active Directory'],
    ['El equipo trabaja con Docker y Kubernetes para sus despliegues.', 'Kubernetes', 80, true],
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

test.each([
    ['F6 exacto: perfil desconocido', 'Kubernetes', {}, 80, 'por_confirmar'],
    ['stack positivo', 'Kubernetes', { stack_tecnologico: ['Kubernetes'] }, 80, 'por_confirmar'],
    ['ausencia declarada', 'Kubernetes', { conocimientos_ausentes: ['Kubernetes'] }, 80, 'rechazada'],
    ['ausencia contradictoria', 'Kubernetes', { stack_tecnologico: ['Kubernetes'], conocimientos_ausentes: ['Kubernetes'] }, 80, 'por_confirmar'],
    ['AD sin respaldo', 'Active Directory', {}, 80, 'por_confirmar'],
    ['AD con respaldo literal', 'Active Directory', { limitaciones_explicitas: 'No tengo Active Directory.' }, 80, 'rechazada'],
    ['ausencia citada como ejemplo', 'Kubernetes', { perfil_profesional: 'Ejemplo: «No tengo Kubernetes».' }, 80, 'por_confirmar'],
    ['debajo del umbral', 'Kubernetes', {}, 59, 'bajo_umbral'],
    ['en el umbral', 'Kubernetes', {}, 60, 'por_confirmar'],
])('S16: %s en vivo y al leer una decisión antigua o nueva de caché', async (_caso, requisito, perfil, porcentaje, estado) => {
    const descripcion = `${requisito} es obligatorio.`;
    const oferta = { titulo: 'Soporte junior', descripcion };
    const evidencia = { requisito, tipo: 'obligatorio', evidencia_oferta: descripcion, evidencia_perfil: `No tengo ${requisito}` };
    const antiguo = { match: false, porcentaje, razon: 'Rechazo sintético.', explicacion: {
        cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [evidencia],
    }, desglose_disponible: true, prioridad_ia: null, firma_criterios_evaluacion: 'firma anterior' };
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(antiguo));
    const resultado = await evaluarOferta(oferta, null, null, perfil);
    expect(resultado).toMatchObject({ match: false, porcentaje, firma_criterios_evaluacion: expect.any(String), desglose_disponible: true });
    expect(resultado.error).not.toBe(true);
    expect(resultado.pendiente === true).toBe(estado === 'por_confirmar');
    if (estado === 'rechazada') {
        expect(resultado.explicacion.exclusiones).toEqual([expect.objectContaining({ requisito, tipo: 'obligatorio', evidencia_perfil: expect.any(String) })]);
        expect(resultado.explicacion.por_confirmar).toEqual([]);
    } else {
        expect(resultado.explicacion.exclusiones).toEqual([]);
        expect(resultado.explicacion.no_cumplidos).toEqual([]);
        expect(resultado.explicacion.por_confirmar).toEqual([expect.objectContaining({ requisito, tipo: 'obligatorio', evidencia_oferta: descripcion, evidencia_perfil: '' })]);
        expect(resultado.razon).not.toContain(evidencia.evidencia_perfil);
    }
    expect(guardarCache).toHaveBeenCalledTimes(1);
    const [hash, firma, modelo, nuevo] = guardarCache.mock.calls[0];
    expect(nuevo).toEqual(resultado);
    for (const cacheado of [{ ...antiguo, firma_criterios_evaluacion: firma }, nuevo]) {
        buscarCache.mockResolvedValueOnce(structuredClone(cacheado));
        await expect(evaluarOferta(oferta, null, null, perfil)).resolves.toEqual(resultado);
        expect(buscarCache).toHaveBeenLastCalledWith(hash, firma, modelo);
    }
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
});

test('S16: una pregunta en el perfil no acredita una ausencia', async () => {
    const descripcion = 'Kubernetes es obligatorio.';
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje: 80, razon: 'Afinidad estimada', explicacion: {
        por_confirmar: [{ requisito: 'Kubernetes', tipo: 'obligatorio', evidencia_oferta: descripcion, evidencia_perfil: '' }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Operaciones junior', descripcion }, null, null,
        { perfil_profesional: '¿No tengo Kubernetes?' });
    expect(resultado).toMatchObject({ pendiente: true, porcentaje: 80, explicacion: { exclusiones: [] } });
    expect(resultado.explicacion.por_confirmar[0].evidencia_perfil).toBe('');
});

test.each([false, true])('S20: contrasta el alias de Kubernetes con ausencia y stack (%s)', async contradiccion => {
    const requisito = 'Experiencia con Kubernetes';
    const descripcion = `${requisito} es obligatoria.`;
    const oferta = { titulo: 'Operaciones junior', descripcion };
    const perfil = { conocimientos_ausentes: ['Kubernetes'], stack_tecnologico: contradiccion ? ['Kubernetes'] : [] };
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética', explicacion: {
        exclusiones: [{ requisito, tipo: 'obligatorio', evidencia_oferta: descripcion, evidencia_perfil: 'Kubernetes' }],
    } }));
    const resultado = await evaluarOferta(oferta, null, null, perfil);
    expect(resultado.porcentaje).toBe(80);
    expect(resultado.error).not.toBe(true);
    expect(resultado.pendiente === true).toBe(contradiccion);
    expect(resultado.explicacion.exclusiones).toEqual(contradiccion ? [] : [expect.objectContaining({ requisito, evidencia_perfil: 'Kubernetes' })]);
    const [, , , anterior] = guardarCache.mock.calls[0];
    buscarCache.mockResolvedValueOnce(structuredClone(anterior));
    await expect(evaluarOferta(oferta, null, null, perfil)).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each([
    ['Kubernetes es obligatorio, no se requiere experiencia previa.', 'Kubernetes es obligatorio', true],
    ['Kubernetes no es obligatorio.', 'Kubernetes no es obligatorio', false],
])('S22: la negación solo modifica al requisito citado (%s)', async (descripcion, evidencia, pendiente) => {
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje: 80, razon: 'Evaluación sintética', explicacion: {
        por_confirmar: [{ requisito: 'Kubernetes', tipo: 'obligatorio', evidencia_oferta: evidencia, evidencia_perfil: '' }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Operaciones junior', descripcion }, null, null, {});
    expect(resultado.porcentaje).toBe(80);
    expect(resultado.pendiente === true).toBe(pendiente);
    expect(resultado.explicacion.exclusiones).toEqual([]);
});

test.each([
    'Kubernetes es obligatorio, no se requiere experiencia previa.',
    'Kubernetes es obligatorio, la experiencia previa no es obligatoria.',
])('S22: la negación ajena no invalida el veto acreditado (%s)', async descripcion => {
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética', explicacion: {
        exclusiones: [{ requisito: 'Kubernetes', tipo: 'obligatorio', evidencia_oferta: 'Kubernetes es obligatorio', evidencia_perfil: 'Kubernetes' }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Operaciones junior', descripcion }, null, null, { conocimientos_ausentes: ['Kubernetes'] });
    expect(resultado).toMatchObject({ match: false, porcentaje: 80, firma_criterios_evaluacion: expect.any(String) });
    expect(resultado.pendiente === true).toBe(false);
    expect(resultado.explicacion.exclusiones).toEqual([expect.objectContaining({ requisito: 'Kubernetes', evidencia_perfil: 'Kubernetes' })]);
});

test('S22: la coma no separa a Kubernetes de su propia negación', async () => {
    const descripcion = 'Kubernetes, no se requiere para este puesto.';
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética', explicacion: {
        exclusiones: [{ requisito: 'Kubernetes', tipo: 'obligatorio', evidencia_oferta: 'Kubernetes', evidencia_perfil: 'Kubernetes' }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Operaciones junior', descripcion }, null, null, { conocimientos_ausentes: ['Kubernetes'] });
    expect(resultado).toMatchObject({ invalido: true, firma_criterios_evaluacion: null });
    expect(guardarCache).not.toHaveBeenCalled();
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

test('S16: solo el veto respaldado prevalece si convive con una exclusión inventada', async () => {
    const oferta = { titulo: 'Soporte junior', descripcion: 'Kubernetes es obligatorio. Terraform es obligatorio.' };
    const perfil = { conocimientos_ausentes: ['Terraform'] };
    const exclusiones = ['Kubernetes', 'Terraform'].map(requisito => ({ requisito, tipo: 'obligatorio',
        evidencia_oferta: `${requisito} es obligatorio.`, evidencia_perfil: `No tengo ${requisito}` }));
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética.',
        explicacion: { exclusiones, no_cumplidos: exclusiones } }));
    const resultado = await evaluarOferta(oferta, null, null, perfil);
    const terraform = expect.objectContaining({ requisito: 'Terraform', evidencia_perfil: 'Terraform' });
    expect(resultado).toMatchObject({ match: false, pendiente: false, porcentaje: 80, firma_criterios_evaluacion: expect.any(String),
        razon: 'Incompatibilidad confirmada: Terraform. Afinidad técnica estimada: 80%.', explicacion: {
            exclusiones: [terraform], no_cumplidos: [terraform], por_confirmar: [expect.objectContaining({ requisito: 'Kubernetes', evidencia_perfil: '' })],
        } });
    buscarCache.mockResolvedValueOnce(structuredClone(guardarCache.mock.calls[0][3]));
    await expect(evaluarOferta(oferta, null, null, perfil)).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
});

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
