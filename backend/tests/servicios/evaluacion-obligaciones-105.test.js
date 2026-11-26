jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({}));
jest.mock('../../src/modelos/preferencia', () => ({}));
jest.mock('../../src/modelos/evaluacion-lote', () => ({}));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));

const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');
const { buscarCache, guardarCache } = require('../../src/modelos/evaluacion-cache');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const { obtenerSituacionEvaluacion } = require('../../src/servicios/evaluacion/situacion-evaluacion');

beforeEach(() => jest.resetAllMocks());

// Fixture sintético creado para #120; no contiene respuestas del experimento.
const oferta120 = { titulo: 'Desarrollo web junior', descripcion: 'PHP es obligatorio. Laravel es obligatorio.' };
// Clave observada con esta entrada en la base 4be23f0; no depende del código bajo prueba.
const clave120 = [
    '4589b928906d7d5a8d453ab66ebf00ea406da6d4fc4cb4a02a6f3c4644b70a5a',
    'bf92dd38f667a94e6a858d0eebe9aba2ba6a1954893784566918a63096ea112d',
    'deepseek-flash',
];
const items120 = ['PHP', 'Laravel'].map(requisito => ({ requisito, tipo: 'obligatorio',
    evidencia_oferta: `${requisito} es obligatorio`, evidencia_perfil: '', explicacion: 'Requisito del aviso.' }));
const razonUmbral120 = 'Afinidad técnica estimada: 15% (por debajo del umbral del 60%).';
const duda120 = item => ({ ...item, evidencia_perfil: '',
    explicacion: 'Necesito confirmar el requisito y su cumplimiento con evidencia relacionada del aviso y del perfil; no acredito equivalencias ni incompatibilidad por omisión.' });
const veto120 = (item, ausencia) => ({ ...item, evidencia_perfil: ausencia,
    explicacion: 'Incompatibilidad respaldada por una ausencia declarada del candidato.' });
const desglose120 = (no_cumplidos, por_confirmar = [], exclusiones = []) => ({ cumplidos: [], no_cumplidos, por_confirmar, exclusiones });
const resultado120 = (razon, explicacion) => ({ match: false, porcentaje: 15, razon, explicacion, prioridad_ia: null, desglose_disponible: true });
const defectuoso120 = resultado120('Incompatibilidad con PHP y Laravel.', desglose120(items120));

function situacion120(resultado) {
    return obtenerSituacionEvaluacion({
        estado_evaluacion: resultado.pendiente ? 'pendiente' : resultado.match ? 'aprobada' : 'rechazada',
        porcentaje_match: resultado.porcentaje,
        razon_evaluacion: resultado.razon,
        explicacion_evaluacion: resultado.explicacion,
        firma_criterios_evaluacion: resultado.firma_criterios_evaluacion,
        fecha_evaluacion: '2026-01-01',
    });
}

test('issue 120: corrige la caché vigente y mantiene identidad, inmutabilidad y equivalencia con una evaluación nueva', async () => {
    const firmado = r => ({ ...r, firma_criterios_evaluacion: clave120[1] });
    const oferta = { ...oferta120, estado_postulacion: 'postulada', notas: 'Nota manual sintética.' };
    const antesOferta = structuredClone(oferta);
    const respuesta = JSON.stringify(defectuoso120);
    consultarDeepSeek.mockResolvedValueOnce(respuesta);
    const nuevo = await evaluarOferta(oferta, null, null, {});
    expect(guardarCache).toHaveBeenCalledTimes(1);
    const [hash, firma, modelo, guardado] = guardarCache.mock.calls[0];
    expect([hash, firma, modelo]).toEqual(clave120);
    const antiguo = firmado(structuredClone(defectuoso120));
    const antesAntiguo = structuredClone(antiguo);
    const antesGuardado = structuredClone(guardado);
    buscarCache.mockResolvedValueOnce(antiguo).mockResolvedValue(guardado);
    const hitAnterior = await evaluarOferta(oferta, null, null, {});
    const hitNuevo = await evaluarOferta(oferta, null, null, {});
    const repetido = await evaluarOferta(oferta, null, null, {});
    expect(oferta).toEqual(antesOferta);
    expect(antiguo).toEqual(antesAntiguo);
    expect(guardado).toEqual(antesGuardado);
    await expect(consultarDeepSeek.mock.results[0].value).resolves.toBe(respuesta);
    expect(buscarCache.mock.calls).toEqual(Array(4).fill(clave120));
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
    const esperado = firmado(resultado120(razonUmbral120, desglose120([], items120.map(duda120))));
    expect([nuevo, guardado, hitAnterior, hitNuevo, repetido]).toEqual(Array(5).fill(esperado));
    expect(situacion120(nuevo)).toBe('bajo_umbral');
});

test('issue 120: conserva la razón y el desglose del control sintético de 4096', async () => {
    const control = resultado120('Afinidad insuficiente; falta confirmar PHP y Laravel.', desglose120([], items120));
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(control));
    const resultado = await evaluarOferta(oferta120, null, null, {});
    expect(resultado).toEqual({ ...control, explicacion: { ...control.explicacion, desglose_disponible: true },
        firma_criterios_evaluacion: clave120[1] });
    expect(situacion120(resultado)).toBe('bajo_umbral');
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
});

test.each([
    [{ conocimientos_ausentes: ['PHP', 'Laravel'] }, ['PHP', 'Laravel']],
    [{ limitaciones_explicitas: 'No tengo PHP.' }, ['No tengo PHP.']],
])('issue 120: sólo conserva incompatibilidades con obligación y ausencia acreditadas (%j)', async (perfil, ausencias) => {
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(defectuoso120));
    const resultado = await evaluarOferta(oferta120, null, null, perfil);
    const vetos = ausencias.map((ausencia, i) => veto120(items120[i], ausencia));
    const razon = `Incompatibilidad confirmada: ${vetos.map(item => item.requisito).join('; ')}. Afinidad técnica estimada: 15%.`;
    expect(resultado).toEqual({ ...resultado120(razon, desglose120(vetos, items120.slice(vetos.length).map(duda120), vetos)),
        pendiente: false, firma_criterios_evaluacion: expect.any(String) });
    expect(situacion120(resultado)).toBe('rechazada');
    buscarCache.mockResolvedValueOnce(resultado);
    await expect(evaluarOferta(oferta120, null, null, perfil)).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
});

test('issue 120: un veto corroborado no evita revisar otro incumplimiento obligatorio', async () => {
    const veto = veto120(items120[0], 'PHP');
    const anterior = { ...resultado120(defectuoso120.razon, desglose120([items120[1]], [], [veto])),
        pendiente: false, firma_criterios_evaluacion: 'firma anterior' };
    buscarCache.mockResolvedValueOnce(anterior);
    const resultado = await evaluarOferta(oferta120, null, null, { conocimientos_ausentes: ['PHP'] });
    expect(resultado).toEqual({ ...resultado120('Incompatibilidad confirmada: PHP. Afinidad técnica estimada: 15%.',
        desglose120([veto], [duda120(items120[1])], [veto])), pendiente: false, firma_criterios_evaluacion: expect.any(String) });
    expect(situacion120(resultado)).toBe('rechazada');
    expect(consultarDeepSeek).toHaveBeenCalledTimes(0);
    expect(guardarCache).toHaveBeenCalledTimes(0);
});

test('issue 120: una mención incidental no gana un veto y no se amplía el contraste de otras categorías', async () => {
    const oferta = { ...oferta120, descripcion: 'El equipo trabaja con PHP y se requiere Laravel. SQL es deseable.' };
    const php = { ...items120[0], evidencia_oferta: 'El equipo trabaja con PHP y se requiere Laravel' };
    const laravel = { ...items120[1], evidencia_oferta: 'se requiere Laravel' };
    const sql = { ...items120[0], requisito: 'SQL', tipo: 'deseable', evidencia_oferta: 'SQL es deseable' };
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(resultado120(defectuoso120.razon, desglose120([php, sql], [laravel]))));
    const resultado = await evaluarOferta(oferta, null, null, { conocimientos_ausentes: ['PHP', 'Laravel'] });
    expect(resultado).toEqual({ ...resultado120(razonUmbral120, desglose120([sql], [laravel, duda120({ ...php, evidencia_oferta: '' })])),
        firma_criterios_evaluacion: expect.any(String) });
    expect(situacion120(resultado)).toBe('bajo_umbral');
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
});

test('issue 120: la duda de Active Directory no se convierte en veto al reutilizar la caché', async () => {
    const evidencia = 'El equipo trabaja con Active Directory y se requiere Laravel';
    const oferta = { ...oferta120, descripcion: `${evidencia}.` };
    const perfil = { conocimientos_ausentes: ['Active Directory'] };
    const item = { ...items120[0], requisito: 'Active Directory', evidencia_oferta: evidencia };
    const anterior = resultado120('Incompatibilidad con Active Directory.', desglose120([item]));
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify(anterior));
    const nuevo = await evaluarOferta(oferta, null, null, perfil);
    const [hash, firma, modelo, guardado] = guardarCache.mock.calls[0];
    const duda = { ...item, tipo: 'desconocido', evidencia_oferta: expect.any(String),
        explicacion: 'Confirmar si Active Directory es obligatorio y si contás con esa experiencia' };
    expect(nuevo).toEqual({ ...resultado120(razonUmbral120, desglose120([], [duda])), firma_criterios_evaluacion: firma });
    expect(situacion120(nuevo)).toBe('bajo_umbral');
    expect(guardado).toEqual(nuevo);

    const cacheAnterior = { ...structuredClone(anterior), firma_criterios_evaluacion: firma };
    const antesAnterior = structuredClone(cacheAnterior);
    const antesGuardado = structuredClone(guardado);
    buscarCache.mockResolvedValueOnce(cacheAnterior).mockResolvedValueOnce(guardado);
    const hitAnterior = await evaluarOferta(oferta, null, null, perfil);
    const hitNuevo = await evaluarOferta(oferta, null, null, perfil);
    buscarCache.mockResolvedValueOnce(hitNuevo);
    const antesHit = structuredClone(hitNuevo);
    const repetido = await evaluarOferta(oferta, null, null, perfil);
    expect(cacheAnterior).toEqual(antesAnterior);
    expect(guardado).toEqual(antesGuardado);
    expect(hitNuevo).toEqual(antesHit);
    expect(buscarCache.mock.calls).toEqual(Array(4).fill([hash, firma, modelo]));
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(guardarCache).toHaveBeenCalledTimes(1);
    expect([hitAnterior, hitNuevo, repetido]).toEqual(Array(3).fill(nuevo));
    expect(nuevo.explicacion.por_confirmar[0].evidencia_oferta).toBe('');
});

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
    ['Kubernetes es obligatorio y no se requiere experiencia previa.', 'Kubernetes es obligatorio', true],
    ['Kubernetes es obligatorio y no se requiere Kubernetes para este puesto.', 'Kubernetes es obligatorio', false],
    ['Requisitos obligatorios:\n- Kubernetes es obligatorio y no se requiere experiencia previa.', 'Kubernetes es obligatorio', true],
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
    'Kubernetes es obligatorio y la experiencia previa no es obligatoria.',
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

test('S24: negar experiencia no permite un veto si lo exigido es experiencia', async () => {
    const requisito = 'Experiencia en Kubernetes';
    const evidencia = `${requisito} es obligatoria`;
    const oferta = { titulo: 'Operaciones junior', descripcion: `${evidencia} y no se requiere experiencia en Kubernetes.` };
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética', explicacion: {
        exclusiones: [{ requisito, tipo: 'obligatorio', evidencia_oferta: evidencia, evidencia_perfil: 'Kubernetes' }],
    } }));
    const resultado = await evaluarOferta(oferta, null, null, { conocimientos_ausentes: ['Kubernetes'] });
    expect(resultado).toMatchObject({ invalido: true, firma_criterios_evaluacion: null });
    expect(guardarCache).not.toHaveBeenCalled();
});

test('S23: negar la sigla explícita invalida el veto incluso con ausencia declarada', async () => {
    const requisito = 'Active Directory';
    const evidencia = 'Active Directory (AD) es obligatorio';
    const oferta = { titulo: 'Soporte junior', descripcion: `${evidencia} y no se requiere AD en este puesto.` };
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética', explicacion: {
        exclusiones: [{ requisito, tipo: 'obligatorio', evidencia_oferta: evidencia, evidencia_perfil: requisito }],
    } }));
    const resultado = await evaluarOferta(oferta, null, null, { conocimientos_ausentes: [requisito] });
    expect(resultado).toMatchObject({ invalido: true, firma_criterios_evaluacion: null });
    expect(guardarCache).not.toHaveBeenCalled();
});

const AD = 'Active Directory';

test.each([
    ['Active Directory es obligatorio y Azure es deseable.', AD, 'Active Directory es obligatorio', true],
    ['Active Directory es obligatorio y Azure es deseable.', AD, 'Active Directory es obligatorio y Azure es deseable.', true],
    ['Active Directory es obligatorio, Azure es deseable.', AD, 'Active Directory es obligatorio', true],
    ['Active Directory es obligatorio, Azure es opcional.', AD, 'Active Directory es obligatorio, Azure es opcional.', true],
    ['Active Directory es deseable y Azure es obligatorio.', 'Azure', 'Azure es obligatorio', true],
    ['Active Directory es deseable y Azure es obligatorio.', AD, 'Active Directory es deseable', false],
])('cada grado de obligación corresponde a su propio requisito (%s; %s)', async (descripcion, requisito, evidencia, pendiente) => {
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje: 80, razon: 'Afinidad estimada.', explicacion: {
        por_confirmar: [{ requisito, tipo: 'obligatorio', evidencia_oferta: evidencia, evidencia_perfil: '' }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Soporte junior', descripcion }, null, null, {});
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion: { exclusiones: [], no_cumplidos: [] } });
    expect(resultado.error).not.toBe(true);
    expect(resultado.pendiente === true).toBe(pendiente);
    expect(resultado.explicacion.por_confirmar).toEqual([expect.objectContaining({
        requisito, tipo: pendiente ? 'obligatorio' : 'deseable', evidencia_perfil: '',
        ...(requisito === AD ? { evidencia_oferta: evidencia } : {}),
    })]);
    expect(guardarCache.mock.calls[0][3]).toEqual(resultado);
});

test('un requisito opcional distinto no invalida el veto respaldado del obligatorio', async () => {
    const evidencia = 'Active Directory es obligatorio';
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética.', explicacion: {
        exclusiones: [{ requisito: AD, tipo: 'obligatorio', evidencia_oferta: evidencia, evidencia_perfil: AD }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Soporte junior', descripcion: `${evidencia} y Azure es opcional.` },
        null, null, { conocimientos_ausentes: [AD] });
    expect(resultado).toMatchObject({ match: false, pendiente: false, porcentaje: 80, firma_criterios_evaluacion: expect.any(String),
        explicacion: { exclusiones: [expect.objectContaining({ requisito: AD, tipo: 'obligatorio', evidencia_perfil: AD })] } });
    expect(resultado.error).not.toBe(true);
});

test('una experiencia deseable intermedia no oculta la negación de la sigla del obligatorio', async () => {
    const evidencia = 'Active Directory (AD) es obligatorio';
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: false, porcentaje: 80, razon: 'Evaluación sintética.', explicacion: {
        exclusiones: [{ requisito: AD, tipo: 'obligatorio', evidencia_oferta: evidencia, evidencia_perfil: AD }],
    } }));
    const resultado = await evaluarOferta({ titulo: 'Soporte junior',
        descripcion: `${evidencia} y la experiencia en Azure es deseable y no se requiere AD en este puesto.` },
    null, null, { conocimientos_ausentes: [AD] });
    expect(resultado).toMatchObject({ invalido: true, firma_criterios_evaluacion: null });
    expect(guardarCache).not.toHaveBeenCalled();
});

test.each([
    ['Active Directory es obligatorio. Active Directory es deseable.', 'Active Directory es obligatorio', true],
    ['Active Directory es deseable. Active Directory es obligatorio.', 'Active Directory es obligatorio', true],
    ['Se valora Active Directory. Es obligatorio conocer Active Directory.', 'Es obligatorio conocer Active Directory', true],
    ['Requisitos obligatorios:\n- Active Directory\nOpcionales:\n- Active Directory', 'Active Directory', true],
    ['Active Directory es deseable.', 'Active Directory es deseable', false],
    ['Active Directory es obligatorio. Active Directory no es obligatorio.', 'Active Directory es obligatorio', false],
    ['Active Directory se usa en el equipo y se requiere Azure. Active Directory es deseable.', 'Active Directory se usa en el equipo', false],
])('una mención deseable no borra una obligación explícita y citada (%s)', async (descripcion, evidencia_oferta, pendiente) => {
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje: 80, razon: 'Evaluación sintética.', explicacion: {
        por_confirmar: [{ requisito: AD, tipo: 'obligatorio', evidencia_oferta, evidencia_perfil: '' }],
    } }));
    const oferta = { titulo: 'Soporte junior', descripcion };
    const resultado = await evaluarOferta(oferta, null, null, {});
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion: { exclusiones: [], no_cumplidos: [],
        por_confirmar: [expect.objectContaining({ requisito: AD, tipo: descripcion === 'Active Directory es deseable.' ? 'deseable' : 'desconocido', evidencia_oferta, evidencia_perfil: '' })],
    } });
    expect(resultado.error).not.toBe(true);
    expect(resultado.pendiente === true).toBe(pendiente);
    buscarCache.mockResolvedValueOnce(structuredClone(guardarCache.mock.calls[0][3]));
    await expect(evaluarOferta(oferta, null, null, {})).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each([
    [AD, 80, true, []],
    [AD, 80, false, [AD]],
    ['Autorización laboral', 60, true, []],
    ['Autorización laboral', 80, false, []],
    ['Kubernetes', 80, false, ['Kubernetes']],
])('una cita verificable de la contradicción no aprueba ni veta (%s, %i, cita completa: %s)', async (requisito, porcentaje, completa, conocimientos_ausentes) => {
    const femenina = requisito === 'Autorización laboral';
    const obligacion = `${requisito} es ${femenina ? 'obligatoria' : 'obligatorio'}`;
    const descripcion = `${obligacion}. ${requisito} es deseable.`;
    const evidencia_oferta = completa ? descripcion : obligacion;
    const oferta = { titulo: 'Soporte junior', descripcion };
    const perfil = { conocimientos_ausentes };
    consultarDeepSeek.mockResolvedValueOnce(JSON.stringify({ match: true, porcentaje, razon: 'Afinidad estimada.', explicacion: {
        por_confirmar: [{ requisito, tipo: 'obligatorio', evidencia_oferta, evidencia_perfil: '' }],
    } }));
    const resultado = await evaluarOferta(oferta, null, null, perfil);
    expect(resultado).toMatchObject({ match: true, porcentaje, pendiente: true, explicacion: { exclusiones: [], no_cumplidos: [],
        por_confirmar: [expect.objectContaining({ requisito, tipo: 'desconocido', evidencia_oferta, evidencia_perfil: '' })],
    } });
    expect(resultado.error).not.toBe(true);
    buscarCache.mockResolvedValueOnce(structuredClone(guardarCache.mock.calls[0][3]));
    await expect(evaluarOferta(oferta, null, null, perfil)).resolves.toEqual(resultado);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

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
