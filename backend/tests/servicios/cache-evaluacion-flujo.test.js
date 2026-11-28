jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'),
    consultarDeepSeek: jest.fn(),
}));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ obtenerOfertasPendientes: jest.fn(), actualizarEvaluacion: jest.fn(), registrarErrorEvaluacion: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-lote', () => ({
    crearLote: jest.fn().mockResolvedValue({ id: 1 }),
    actualizarProgreso: jest.fn().mockResolvedValue(),
    finalizarLote: jest.fn().mockResolvedValue(),
}));

const pool = require('../../src/config/base-datos');
const proveedor = require('../../src/config/deepseek');
const preferencias = require('../../src/modelos/preferencia');
const ofertas = require('../../src/modelos/oferta');
const cache = require('../../src/modelos/evaluacion-cache');
const servicio = require('../../src/servicios/servicio-evaluacion');
let fila;
let registros;
const oferta = { id: 9, titulo: 'Desarrollo junior', descripcion: 'Aplicaciones con TypeScript', modalidad: 'remoto', nivel_requerido: 'junior', plataforma: 'linkedin' };

beforeEach(() => {
    jest.clearAllMocks();
    registros = new Map();
    fila = { nombre: 'Perfil sintético', nivel_experiencia: 'junior', stack_tecnologico: ['TypeScript'], zonas_preferidas: ['CABA'], modelo_ia: 'deepseek-v4-flash', usar_prompt_personalizado: false };
    preferencias.obtenerPreferencias.mockImplementation(async () => ({ ...fila }));
    ofertas.obtenerOfertasPendientes.mockResolvedValue([oferta]);
    proveedor.consultarDeepSeek.mockResolvedValue('{"match":true,"porcentaje":80,"razon":"Compatible"}');
    // Ejecuto el modelo real de caché sobre un almacenamiento pg simulado con estado.
    pool.query.mockImplementation(async (sql, valores) => {
        const clave = JSON.stringify(valores.slice(0, 3));
        if (sql.includes('SELECT resultado')) return { rows: registros.has(clave) ? [{ resultado: registros.get(clave) }] : [] };
        if (sql.includes('INSERT INTO evaluaciones_cache')) {
            if (!registros.has(clave) || sql.includes('DO UPDATE')) registros.set(clave, JSON.parse(valores[3]));
            return { rows: [] };
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    });
});

const carrera126 = 'Licenciatura en Sistemas';
const estudiante126 = `Estudiante de ${carrera126}`;
const perfilEstudiante126 = `Soy estudiante de ${carrera126}.`;

async function evaluarCasoAcademico126(aviso, requisito, perfil, citaPerfil = perfil, opciones = {}) {
    const avisoSintetico = Object.freeze({ id: 126, titulo: 'Desarrollo TypeScript Junior',
        descripcion: opciones.descripcion || `Desarrollo con TypeScript. Requisito obligatorio: ${aviso}.`,
        modalidad: 'remoto', descripcion_completitud: 'completa' });
    fila = Object.freeze({ stack_tecnologico: Object.freeze(['TypeScript']), perfil_profesional: perfil,
        zonas_preferidas: Object.freeze([]) });
    const cumplido = { requisito, tipo: opciones.tipo || 'obligatorio', evidencia_oferta: requisito,
        evidencia_perfil: citaPerfil, explicacion: 'Coincidencia declarada.' };
    const explicacion = { cumplidos: [cumplido], no_cumplidos: [], por_confirmar: [], exclusiones: [] };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 80,
        razon: 'Afinidad técnica y requisito académico respaldados.', explicacion }));
    return { avisoSintetico, explicacion, resultado: await servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila) };
}

test('#126: la condición literal de estudiante conserva el cumplimiento al evaluar y al releer caché', async () => {
    const { avisoSintetico, explicacion, resultado } = await evaluarCasoAcademico126(estudiante126, estudiante126, perfilEstudiante126);
    const almacenado = [...registros.values()][0];
    expect(almacenado).toBeDefined();
    const copia = structuredClone(almacenado);
    const releido = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila);
    expect(releido).toEqual(resultado);
    expect([...registros.values()]).toEqual([copia]);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion });
    expect(resultado.pendiente).not.toBe(true);
    expect(resultado.error).toBeUndefined();
});

test('un Por confirmar sin cambios firmado antes de #126 no se reabre en un lote ordinario; la selección explícita sí lo evalúa', async () => {
    const { avisoSintetico, resultado } = await evaluarCasoAcademico126(estudiante126, estudiante126, perfilEstudiante126);
    const historica = { ...avisoSintetico, estado_evaluacion: 'pendiente', fecha_evaluacion: '2026-01-01',
        razon_evaluacion: 'Pendiente de confirmación: requisito académico.', porcentaje_match: 80,
        // Identidad real del caso sintético sobre master@d343193, con el mensaje anterior.
        firma_criterios_evaluacion: '09fcf9cf8f829453f0857052bd805b7fe2e794e37279ed3031494ffae40e9593',
        explicacion_evaluacion: { por_confirmar: [{ requisito: estudiante126 }],
            hash_oferta: '8950207f92181e71646414e0b5fb207d8eeee1da9edff0a43964efd926fdb6ab' } };
    expect(resultado.firma_criterios_evaluacion).not.toBe(historica.firma_criterios_evaluacion);
    ofertas.obtenerOfertasPendientes.mockResolvedValue([historica]);
    jest.clearAllMocks();
    expect(await servicio.evaluarOfertasPendientes()).toMatchObject({ total: 0, errores: 0 });
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
    expect(await servicio.evaluarOfertasPendientes([historica])).toMatchObject({ total: 1, aprobadas: 1, errores: 0 });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(ofertas.actualizarEvaluacion.mock.calls[0].slice(0, 2)).toEqual([126, 'aprobada']);
});

test('el título obligatorio sigue cumplido ante una afirmación autónoma de título obtenido', async () => {
    const { resultado, explicacion } = await evaluarCasoAcademico126(carrera126, carrera126, `Obtuve la ${carrera126}.`);
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion });
    expect(resultado.pendiente).not.toBe(true);
});

test.each([
    [carrera126, carrera126, perfilEstudiante126],
    [`Egreso de ${carrera126}`, estudiante126, perfilEstudiante126],
    [`Egreso de ${carrera126} (ser ${estudiante126.toLowerCase()} no alcanza)`, estudiante126, perfilEstudiante126],
    [`«${estudiante126}»`, estudiante126, perfilEstudiante126],
    [estudiante126, estudiante126, 'Soy estudiante de Licenciatura en Informática.'],
    [estudiante126, estudiante126, `«${perfilEstudiante126}»`],
    [estudiante126, estudiante126, `¿${perfilEstudiante126.slice(0, -1)}?`],
    [estudiante126, estudiante126, `No ${perfilEstudiante126.toLowerCase()}`],
    [estudiante126, estudiante126, `Si ${perfilEstudiante126.toLowerCase()}`],
    [estudiante126, estudiante126, `Planeo ser estudiante de ${carrera126}.`],
    [estudiante126, estudiante126, `Experiencia en TypeScript. ${perfilEstudiante126}`],
])('no acredita una condición académica distinta o no autónoma: %s / %s / %s', async (aviso, requisito, perfil) => {
    const { resultado } = await evaluarCasoAcademico126(aviso, requisito, perfil, perfilEstudiante126);
    expect(resultado).toMatchObject({ pendiente: true, porcentaje: 80,
        explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ requisito })] } });
    expect(resultado.error).toBeUndefined();
});

test.each([
    `Ejemplo:\nRequisito obligatorio: ${estudiante126}.`,
    `~~~\nRequisito obligatorio: ${estudiante126}.\n~~~`,
    `<q>\nRequisito obligatorio: ${estudiante126}.\n</q>`,
    `Requisitos obligatorios:\n- ${estudiante126}\n  con título obtenido al momento de ingresar.`,
    `Requisitos obligatorios:\n- ${estudiante126}\n  o de Ingeniería en Informática.`,
    `Se requiere ser ${estudiante126.toLowerCase()}\nsolo para el equipo de capacitación. La vacante corresponde al equipo de soporte.`,
    `Requisito obligatorio: ${estudiante126}. Esta condición ya no se exige.`,
    `Sólo para el equipo de Datos:\nRequisito obligatorio: ${estudiante126}.`,
])('no aísla una exigencia aparente de su contexto en el aviso: %s', async descripcion => {
    const { resultado } = await evaluarCasoAcademico126(null, estudiante126, perfilEstudiante126, perfilEstudiante126,
        { descripcion: `Desarrollo con TypeScript.\n${descripcion}` });
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ requisito: estudiante126 })] } });
    expect(resultado.error).toBeUndefined();
});

test.each(['deseable', 'desconocido'])('la reclasificación a %s no acredita un egreso exigido', async tipo => {
    const { resultado } = await evaluarCasoAcademico126(`Egreso de ${carrera126}`, estudiante126, perfilEstudiante126,
        perfilEstudiante126, { tipo });
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ tipo: 'obligatorio' })] } });
    expect(resultado.error).toBeUndefined();
});

test.each([
    [`Se requiere ser ${estudiante126.toLowerCase()}.`, `Actualmente soy estudiante de ${carrera126}.`],
    [`Se requiere:\n- ${estudiante126}.`, perfilEstudiante126],
    [`Se requiere:\n-\t${estudiante126}.`, perfilEstudiante126],
])('acredita la variante literal y actual de estudiante: %s', async (aviso, perfil) => {
    const { resultado, explicacion } = await evaluarCasoAcademico126(null, estudiante126, perfil, perfil,
        { descripcion: `Desarrollo con TypeScript.\n${aviso}` });
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion });
    expect(resultado.pendiente).not.toBe(true);
});

test.each(['Estudiante de Ingeniería en Computación y Sistemas', 'Gestión de estudiantes'])(
    'conserva la acreditación literal en avisos sin ambigüedad: %s', async requisito => {
        const perfil = requisito.startsWith('Estudiante') ? `Soy ${requisito.toLowerCase()}.` : `${requisito}.`;
        const { resultado, explicacion } = await evaluarCasoAcademico126(requisito, requisito, perfil);
        expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion });
        expect(resultado.pendiente).not.toBe(true);
    }
);

test.each([
    `Requisito obligatorio: ${estudiante126}. Para cumplir esta condición también es obligatorio contar con el título de ${carrera126}.`,
    `Requisitos obligatorios:\n- ${estudiante126}\n\ncon título obtenido al momento de ingresar.`,
    `Requisito obligatorio: ${estudiante126}. Esta condición quedó eliminada de la vacante.`,
    `Requisito obligatorio: ${estudiante126}. Aplica exclusivamente a la vacante de pasantía. Esta búsqueda es para soporte.`,
    `Exclusivo para el equipo de Datos:\nRequisito obligatorio: ${estudiante126}.\nLa vacante corresponde al equipo de Soporte.`,
])('auditoría #127: no acredita un fragmento académico %s', async cuerpo => {
    const caso = await evaluarCasoAcademico126(null, estudiante126, perfilEstudiante126, perfilEstudiante126,
        { descripcion: `Desarrollo con TypeScript.\n${cuerpo}` });
    expect(caso.resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ tipo: 'obligatorio' })] } });
    expect(caso.resultado.error).toBeUndefined();
    const antes = structuredClone([...registros]);
    await expect(servicio.evaluarOferta(caso.avisoSintetico, undefined, undefined, fila)).resolves.toEqual(caso.resultado);
    expect([...registros]).toEqual(antes);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each([
    [`Requisito obligatorio: Egreso de ${carrera126}. Se valora ser ${estudiante126.toLowerCase()}.`, true],
    [`Es obligatorio contar con el título de ${carrera126}.`, false],
])('auditoría #127: contrasta el título aunque el modelo sólo informe un deseable %s', async (cuerpo, deseable) => {
    const caso = await evaluarCasoAcademico126(null, estudiante126, perfilEstudiante126, perfilEstudiante126,
        { descripcion: `Desarrollo con TypeScript. ${cuerpo}`, tipo: 'deseable' });
    expect(caso.resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { no_cumplidos: [], exclusiones: [], por_confirmar: [expect.objectContaining({ tipo: 'obligatorio',
            requisito: expect.not.stringMatching(/^estudiante/i) })] } });
    expect(caso.resultado.explicacion.cumplidos).toEqual(deseable ? caso.explicacion.cumplidos : []);
    expect(caso.resultado.error).toBeUndefined();
    const antes = structuredClone([...registros]);
    await expect(servicio.evaluarOferta(caso.avisoSintetico, undefined, undefined, fila)).resolves.toEqual(caso.resultado);
    expect([...registros]).toEqual(antes);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test('auditoría #127: si cursada y egreso son obligatorios, acreditar una no acredita el otro', async () => {
    const caso = await evaluarCasoAcademico126(null, estudiante126, perfilEstudiante126, perfilEstudiante126, {
        descripcion: `Desarrollo con TypeScript. Requisito obligatorio: Egreso de ${carrera126}. Requisito obligatorio: ${estudiante126}.`,
    });
    expect(caso.resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { cumplidos: caso.explicacion.cumplidos, no_cumplidos: [], exclusiones: [],
            por_confirmar: [expect.objectContaining({ tipo: 'obligatorio', requisito: expect.stringMatching(/^egreso/i) })] } });
    const antes = structuredClone([...registros]);
    await expect(servicio.evaluarOferta(caso.avisoSintetico, undefined, undefined, fila)).resolves.toEqual(caso.resultado);
    expect([...registros]).toEqual(antes);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each([
    [`Requisito obligatorio: ${estudiante126}.\n\nModalidad de trabajo: remota.`, true, false],
    [`Requisito obligatorio: ${estudiante126}. Para postularte, enviá tu CV.`, true, false],
    [`Se requiere:\n- ${estudiante126}.\n- TypeScript.`, true, false],
    [`Requisito obligatorio: ${estudiante126}. Requisito obligatorio: Egreso de ${carrera126}.`, true, true],
    [`La búsqueda actual es para soporte. La condición siguiente corresponde al puesto de pasantía. Requisito obligatorio: ${estudiante126}.`, false, true],
    [`La condición de estudiante se eliminó. Reproducimos a continuación el texto eliminado. Requisito obligatorio: ${estudiante126}.`, false, true],
])('reauditoría #127: contrasta el contexto del requisito sin depender de su posición: %s', async (descripcion, cumplido, pendiente) => {
    const caso = await evaluarCasoAcademico126(null, estudiante126, perfilEstudiante126, perfilEstudiante126,
        { descripcion: `Desarrollo con TypeScript.\n${descripcion}` });
    expect(caso.resultado).toMatchObject({ match: true, porcentaje: 80, explicacion: { no_cumplidos: [], exclusiones: [] } });
    expect(caso.resultado.pendiente === true).toBe(pendiente);
    expect(caso.resultado.explicacion.cumplidos).toEqual(cumplido ? caso.explicacion.cumplidos : []);
    expect(caso.resultado.explicacion.por_confirmar).toEqual(pendiente
        ? [expect.objectContaining({ tipo: 'obligatorio', requisito: cumplido ? expect.stringMatching(/^egreso/i) : estudiante126 })] : []);
    expect(caso.resultado.error).toBeUndefined();
    const antes = structuredClone([...registros]);
    await expect(servicio.evaluarOferta(caso.avisoSintetico, undefined, undefined, fila)).resolves.toEqual(caso.resultado);
    expect([...registros]).toEqual(antes);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each(['Requisitos', 'Requisitos obligatorios'])('reauditoría #127: un egreso explícitamente deseable no se vuelve obligatorio por el encabezado %s', async encabezado => {
    const caso = await evaluarCasoAcademico126(null, estudiante126, perfilEstudiante126, perfilEstudiante126,
        { descripcion: `Desarrollo con TypeScript.\n${encabezado}:\n- Egreso de ${carrera126}.\n- ${estudiante126}.\nEl egreso es deseable.`, tipo: 'deseable' });
    expect(caso.resultado).toMatchObject({ match: true, porcentaje: 80, explicacion: caso.explicacion });
    expect(caso.resultado.pendiente).not.toBe(true);
    expect(caso.resultado.error).toBeUndefined();
    const antes = structuredClone([...registros]);
    await expect(servicio.evaluarOferta(caso.avisoSintetico, undefined, undefined, fila)).resolves.toEqual(caso.resultado);
    expect([...registros]).toEqual(antes);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

const titulo126 = `Requisito obligatorio: Egreso de ${carrera126}.`;
const cursada126 = `Requisito obligatorio: ${estudiante126}.`;

test.each([
    ...['\n', '\n\n'].flatMap(separador => [
        [`${cursada126}${separador}Ya no se exige esta condición.`, false],
        [`${cursada126}${separador}La condición de estudiante ya no es obligatoria.`, false],
        [`Lo que sigue corresponde a una vacante anterior.${separador}${cursada126}`, false],
        [`${cursada126}${separador}Para acreditar este requisito se exige un título obtenido.`, false],
    ]),
    [`Reproducimos a continuación el texto eliminado.\n${titulo126}\n\nLa búsqueda actual es para soporte.\n${cursada126}`, false],
    [`Reproducimos a continuación el texto eliminado.\n${titulo126}\n\nFin del texto eliminado. Esta sección anterior era sólo una referencia.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, true],
    [`${cursada126}\n\nPara acreditar este requisito basta con estar cursando la carrera.`, true],
    ...[' ', '\n\n', '\n\nModalidad de trabajo: remota.\n\n'].flatMap(separador => [
        'La condición de estudiante ya no es obligatoria.',
        'Para acreditar este requisito se exige un título obtenido.',
    ].map(aclaracion => [`${cursada126}${separador}Se requiere ser estudiante de ${carrera126}.${separador}${aclaracion}`, false])),
    [`${cursada126}\n\nModalidad: híbrida.\n\nPara acreditar el requisito de estudiante se exige un título obtenido.`, false],
    ...['', ` Se requiere ser estudiante de ${carrera126}.`].map(repeticion =>
        [`${cursada126}${repeticion}\n\nPostulación: completá el formulario de postulación. Para cumplir este requisito se exige completar todos los campos.`, true]),
    [`${cursada126}\n\nModalidad: remota. Para cumplir este requisito se exige disponer de conexión estable.`, true],
    ...[' ', '\n\n'].map(separador =>
        [`${cursada126}\n\nModalidad de trabajo: remota.${separador}Esta condición ya no se exige.`, true]),
    [`${cursada126}\n\nPara acreditar este requisito se exige ser estudiante de ${carrera126}.`, true],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara cumplir este requisito se exige completar todos los campos del formulario.`, true],
    ...[
        'Enviá tu postulación hasta el viernes.',
        'Requisito obligatorio: TypeScript.',
        'Reproducimos a continuación el texto eliminado. Se requiere ser estudiante de Licenciatura en Informática. Fin del texto eliminado.',
    ].map(intermedio => [`${cursada126}\n\n${intermedio}\n\nPara acreditar el requisito de estudiante se exige un título obtenido.`, false]),
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante ya no es obligatoria.`, false],
    ...['pasantía', 'soporte'].flatMap(puesto => [
        `Para acreditar el requisito de estudiante se exige un título obtenido únicamente para el puesto de ${puesto}.`,
        `La condición de estudiante ya no es obligatoria para el puesto de ${puesto}.`,
    ].map(aclaracion => [`La búsqueda actual es para soporte.\n\n${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\n${aclaracion}`, puesto !== 'soporte'])),
    ...['Licenciatura en Informática', carrera126].map(carrera =>
        [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante ya no es obligatoria para ${carrera}.`, carrera !== carrera126]),
    ...['La condición de estudiante ya no es obligatoria', 'Para acreditar el requisito de estudiante se exige un título obtenido'].map(aclaracion =>
        [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\n${aclaracion} para la Licenciatura en Informática.`, true]),
    [`La búsqueda actual es para soporte. ${cursada126}\nLo indicado a continuación aplica al puesto de pasantía. Se requiere ser estudiante de Licenciatura en Informática.\n\nLo indicado a continuación aplica al puesto de soporte.\nPara acreditar el requisito de estudiante se exige un título obtenido.`, false],
    [`La búsqueda actual es para soporte. ${cursada126}\nLo indicado a continuación aplica al puesto de pasantía.\n\nPara acreditar el requisito de estudiante se exige un título obtenido.`, true],
    [`${cursada126}\n\nReproducimos a continuación el texto eliminado. Para acreditar el requisito de estudiante se exige un título obtenido. Fin del texto eliminado.`, true],
    [`${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante ya no es obligatoria.`, true],
    [`${cursada126} Se requiere ser estudiante de Licenciatura en Informática. La condición de estudiante ya no es obligatoria.`, true],
    [`La búsqueda actual es para soporte. ${cursada126} Lo indicado a continuación aplica al puesto de pasantía. ${cursada126} La condición de estudiante ya no es obligatoria.`, true],
    [`La búsqueda actual es para soporte. ${cursada126}\nLo indicado a continuación aplica al puesto de pasantía.\n\nLo indicado a continuación aplica al puesto de soporte.\n${cursada126} La condición de estudiante ya no es obligatoria.`, false],
    [`Lo que sigue corresponde a una vacante anterior.\nReproducimos a continuación el texto anterior.\nFin del texto anterior.\n\nLa búsqueda actual es para soporte.\n${cursada126}\n\nFin de la vacante anterior.`, false],
    [`Reproducimos a continuación el texto eliminado.\n${titulo126}\nFin del texto eliminado.\n\nEsta sección anterior era sólo una referencia.\nLa búsqueda actual es para soporte.\n${cursada126}`, true],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.`, false],
    [`${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.`, false],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante de ${carrera126} ya no es obligatoria.`, false],
    [`${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante de ${carrera126} ya no es obligatoria.`, false],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de la ${carrera126}, se exige un título obtenido.`, false],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante de ${carrera126}.`, false],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nEl requisito de estudiante de ${carrera126} ya no se exige.`, false],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de Licenciatura en Informática se exige un título obtenido.`, true],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante de Licenciatura en Informática ya no es obligatoria.`, true],
    [`${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de Licenciatura en Informática se exige un título obtenido.`, true],
    [`${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante de Licenciatura en Informática ya no es obligatoria.`, true],
    [`${cursada126} La condición de estudiante de Licenciatura en Informática ya no es obligatoria.`, true],
    ...['pasantía', 'soporte'].flatMap(puesto => [
        `Para acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido únicamente para el puesto de ${puesto}.`,
        `La condición de estudiante de ${carrera126} ya no es obligatoria para el puesto de ${puesto}.`,
    ].map(aclaracion => [`La búsqueda actual es para soporte.\n\n${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\n${aclaracion}`, puesto !== 'soporte'])),
    [`La búsqueda actual es para soporte. ${cursada126}\nLo indicado a continuación aplica al puesto de pasantía.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.`, true],
    [`${cursada126}\n\nReproducimos a continuación el texto eliminado. Para acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido. Fin del texto eliminado.`, true],
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige ser estudiante de ${carrera126}.`, true],
    [`${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige ser estudiante de ${carrera126}.`, true],
    ...['para esta vacante', 'en esta vacante', 'para este puesto', 'en este puesto'].map(alcance =>
        [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante de ${carrera126} ${alcance}.`, false]),
    [`${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante de ${carrera126} para esta vacante.`, false],
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido en esta vacante.`, false],
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante de ${carrera126} ya no es obligatoria en esta vacante.`, false],
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante para la ${carrera126} en esta vacante.`, false],
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nLa condición de estudiante de ${carrera126} en esta vacante ya no es obligatoria.`, false],
    ...['pasantía', 'soporte'].map(puesto =>
        [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante de ${carrera126} para el puesto de ${puesto}.`, puesto !== 'soporte']),
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante de ${carrera126} en el puesto de pasantía.`, true],
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nYa no se exige el requisito de estudiante de ${carrera126} para otra vacante.`, true],
    [`La búsqueda actual es para soporte. ${cursada126}\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante de ${carrera126} se exige ser estudiante de ${carrera126} en esta vacante.`, true],
    [`La búsqueda actual es para soporte. ${cursada126}\nLo indicado a continuación aplica al puesto de pasantía.\n\nYa no se exige el requisito de estudiante de ${carrera126} para esta vacante.`, true],
    [`Para acreditar el requisito de estudiante se exige un título obtenido.\n\n${cursada126}`, false],
    [`Para acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.\n\n${cursada126}`, false],
    [`Para acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.\n\n${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.`, false],
    [`Para acreditar el requisito de estudiante se exige un título obtenido.\n\n${cursada126}\nSe requiere ser estudiante de Licenciatura en Informática.`, false],
    [`La condición de estudiante ya no es obligatoria.\n\n${cursada126}`, false],
    [`Ya no se exige el requisito de estudiante de ${carrera126} para esta vacante.\n\n${cursada126}`, false],
    [`Para acreditar el requisito de estudiante de Licenciatura en Informática se exige un título obtenido.\n\n${cursada126}`, true],
    [`La búsqueda actual es para soporte.\nPara acreditar el requisito de estudiante se exige un título obtenido únicamente para el puesto de pasantía.\n\n${cursada126}`, true],
    [`Para acreditar el requisito de estudiante se exige un título obtenido únicamente para el puesto de pasantía.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, true],
    [`La búsqueda actual es para soporte.\nLo indicado a continuación aplica al puesto de pasantía.\nPara acreditar el requisito de estudiante se exige un título obtenido.\n\nLo indicado a continuación aplica al puesto de soporte.\n${cursada126}`, true],
    [`Para acreditar el requisito de estudiante de ${carrera126} se exige ser estudiante de ${carrera126}.\n\n${cursada126}`, true],
    [`Sólo para el equipo de Datos:\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, true],
    [`Sólo para el equipo de Datos:\nYa no se exige el requisito de estudiante de ${carrera126}.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, true],
    [`Exclusivo para el equipo de Datos:\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, true],
    [`La búsqueda actual es para soporte.\n${cursada126}\n\nSólo para el equipo de Datos:\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.`, true],
    [`La búsqueda actual es para soporte.\n${cursada126}\n\nSólo para el equipo de Soporte:\nPara acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.`, false],
    [`Para acreditar el requisito de estudiante de ${carrera126} se exige un título obtenido.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, false],
])('reauditoría #127: conserva el contexto académico al evaluar y releer %s', async (descripcion, vigente) => {
    const { resultado, avisoSintetico, explicacion } = await evaluarCasoAcademico126(
        null, estudiante126, perfilEstudiante126, perfilEstudiante126, { descripcion });
    expect(registros.size).toBe(1);
    const antes = structuredClone([...registros]);
    pool.query.mockClear();
    await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila)).resolves.toEqual(resultado);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls.map(([sql]) => sql.trim())).toEqual([expect.stringMatching(/^SELECT resultado\b/)]);
    expect([...registros]).toEqual(antes);
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, explicacion: {
        cumplidos: vigente ? explicacion.cumplidos : [], no_cumplidos: [], exclusiones: [],
        por_confirmar: vigente ? [] : [expect.objectContaining({ tipo: 'obligatorio', requisito: estudiante126 })],
    } });
    expect(resultado.pendiente === true).toBe(!vigente);
    expect(resultado.error).toBeUndefined();
});

test.each([
    ['egreso deseable de otra carrera en el mismo renglón',
        `${titulo126} Para Diseño Gráfico, el egreso es deseable. ${cursada126}`, estudiante126, ['egreso de licenciatura en sistemas']],
    ['egreso deseable de otra carrera en renglón separado',
        `${titulo126}\nPara Diseño Gráfico, el egreso es deseable.\n${cursada126}`, estudiante126, ['egreso de licenciatura en sistemas']],
    ['egreso deseable con referencia local inequívoca',
        `${titulo126} ${cursada126} El egreso es deseable.`, estudiante126, []],
    ['egreso deseable con carrera explícita',
        `${titulo126} El egreso de ${carrera126} es deseable. ${cursada126}`, estudiante126, []],
    ['egreso deseable sin carrera inequívoca',
        `${titulo126} Requisito obligatorio: Egreso de Licenciatura en Diseño. El egreso es deseable. ${cursada126}`,
        estudiante126, ['egreso de licenciatura en sistemas']],
    ['referencia genérica también puede aludir al egreso deseable de otra carrera',
        `${titulo126} Para Diseño Gráfico, el egreso es deseable. El egreso es deseable. ${cursada126}`,
        estudiante126, ['egreso de licenciatura en sistemas']],
    ['viñeta que califica la cursada',
        `Requisitos obligatorios:\n- ${estudiante126}.\n- Debe tener el título obtenido al momento de ingresar.`, null, [estudiante126]],
    ['viñeta con un requisito independiente',
        `Requisitos obligatorios:\n- ${estudiante126}.\n- TypeScript.`, estudiante126, []],
    ['plazo propio de postulación', `${cursada126} Enviá tu postulación hasta el viernes.`, estudiante126, []],
    ['encabezado independiente de postulación', `${cursada126} Postulación: enviá tu CV.`, estudiante126, []],
    ['formulario de postulación separado del requisito',
        `${cursada126}\nPostulación: completá el formulario en el portal.`, estudiante126, []],
    ['texto para otra vacante',
        `La búsqueda actual es para soporte. Lo indicado a continuación aplica al puesto de pasantía. ${cursada126}`, null, [estudiante126]],
    ['alcance explícito de la misma vacante',
        `La búsqueda actual es para soporte. Lo indicado a continuación aplica al puesto de soporte. ${cursada126}`, estudiante126, []],
    ['selector de vuelta a la vacante vigente al empezar otro bloque',
        `La búsqueda actual es para soporte.\nLo indicado a continuación aplica al puesto de pasantía.\n${titulo126}\n\nLo indicado a continuación aplica al puesto de soporte.\n${cursada126}\nEnviá tu postulación hasta el lunes.`, estudiante126, []],
    ['un selector de vacante dentro de texto histórico no vuelve vigente el texto',
        `La búsqueda actual es para soporte.\nReproducimos a continuación el texto eliminado.\nLo indicado a continuación aplica al puesto de pasantía.\n${titulo126}\n\nLo indicado a continuación aplica al puesto de soporte.\n${cursada126}\nEnviá tu postulación hasta el lunes.`, null, [estudiante126]],
    ['egreso deseable explícito pero de otra vacante',
        `La búsqueda actual es para soporte. ${titulo126} ${cursada126} Lo indicado a continuación aplica al puesto de pasantía. El egreso de ${carrera126} es deseable.`,
        estudiante126, ['egreso de licenciatura en sistemas']],
    ['bloque citado aunque nombre una vacante actual',
        `~~~\n\nLa búsqueda actual es para soporte. ${cursada126}\n\n~~~`, null, [estudiante126]],
    ['F1: la misma cabecera no cierra el texto eliminado',
        `La búsqueda actual es para soporte.\nReproducimos a continuación el texto eliminado.\n\nLa búsqueda actual es para soporte.\n${cursada126}`,
        null, [estudiante126]],
    ['F1: una primera cabecera dentro del texto eliminado tampoco lo vuelve vigente',
        `Reproducimos a continuación el texto eliminado.\n\nLa búsqueda actual es para soporte.\n${cursada126}`,
        null, [estudiante126]],
    ['F2: el párrafo de presentación no condiciona la cursada literal',
        `Buscamos una persona para el equipo de desarrollo.\n\n${cursada126}`, estudiante126, []],
    ['F2: la presentación independiente no condiciona la cursada con cabecera de vacante',
        `Buscamos una persona para el equipo de desarrollo.\n\nLa búsqueda actual es para soporte.\n${cursada126}`, estudiante126, []],
    ['F3: el deseable de pasantía no respalda la cursada para soporte',
        `La búsqueda actual es para soporte.\n${titulo126}\nLo indicado a continuación aplica al puesto de pasantía.\nSe valora ser ${estudiante126.toLowerCase()}.`,
        null, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['F3 control: el deseable de soporte se conserva y su título sigue pendiente',
        `La búsqueda actual es para soporte.\n${titulo126}\nLo indicado a continuación aplica al puesto de soporte.\nSe valora ser ${estudiante126.toLowerCase()}.`,
        estudiante126, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['F3 preservación: la cursada en una lista de deseables pertenece a la vacante vigente',
        `${titulo126}\n\nDeseables:\n- ${estudiante126}.`, estudiante126, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['F3 preservación: una frase declara la cursada como deseable en la vacante vigente',
        `${titulo126} ${estudiante126} es deseable.`, estudiante126, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['un título condicionante de otra vacante no elimina la cursada deseable vigente',
        `La búsqueda actual es para soporte. ${titulo126} ${estudiante126} es deseable.\n\nEnviá tu postulación hasta el viernes.\n\nPara acreditar el requisito de estudiante se exige un título obtenido únicamente para el puesto de pasantía.`,
        estudiante126, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['retirar la obligación no borra un deseable explícito de la misma carrera',
        `${cursada126} La condición de estudiante ya no es obligatoria. Se valora ser estudiante de ${carrera126}. ${titulo126}`,
        estudiante126, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['un texto que confirma que basta la cursada no elimina el deseable vigente',
        `${titulo126} ${estudiante126} es deseable.\n\nPara cumplir esta condición basta con estar cursando la carrera.`,
        estudiante126, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['F3 control: una lista de deseables de otra vacante no respalda la cursada',
        `La búsqueda actual es para soporte.\n${titulo126}\nLo indicado a continuación aplica al puesto de pasantía.\n\nDeseables:\n- ${estudiante126}.`,
        null, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['un punto y un párrafo nuevo no separan la continuación «con título obtenido»',
        `${cursada126}\n\ncon título obtenido al momento de ingresar.`, null, [estudiante126]],
    ['una obligación de presentar el título también califica la cursada',
        `${cursada126}\n\nDebe presentar el título obtenido al momento de ingresar.`, null, [estudiante126]],
    ['la continuación no condiciona el requisito separado de otra carrera',
        `Requisito obligatorio: Estudiante de Licenciatura en Informática.\n\ncon título obtenido al momento de ingresar.\n${cursada126}`,
        estudiante126, []],
    ['un párrafo nuevo no separa un encabezado de alcance abierto',
        `Sólo para el equipo de Datos:\n\n${cursada126}`, null, [estudiante126]],
    ['un párrafo nuevo no cierra el alcance de otra vacante',
        `La búsqueda actual es para soporte.\nLo indicado a continuación aplica al puesto de pasantía.\n\n${cursada126}`,
        null, [estudiante126]],
    ['texto anterior reproducido sólo como referencia',
        `Dejamos sin efecto la condición de estudiante de la versión previa. La reproducimos debajo únicamente como referencia. ${cursada126}`,
        null, [estudiante126]],
    ['vacante vigente y postulación independientes',
        `La búsqueda actual es para soporte.\n${cursada126}\nEnviá tu postulación hasta el viernes.`, estudiante126, []],
    ['instrucción de postulación con condición académica',
        `${cursada126} Enviá tu postulación hasta el viernes si ya tenés el título.`, null, [estudiante126]],
    ['contexto impreciso no permite ignorar el título y aprobar como supuesto deseable',
        `${titulo126} Se ofrecen horarios a convenir.`, null, ['egreso de licenciatura en sistemas'], 'deseable'],
    ['la carrera con nombre propio no deja de ser obligatoria si es una exigencia separada',
        'Requisito obligatorio: Diseño Gráfico. Requisito obligatorio: Estudiante de Diseño Gráfico.',
        'Estudiante de Diseño Gráfico', ['diseno grafico']],
    ['título obligatorio con artículo se vincula con la cursada sin artículo',
        `${cursada126} Requisito obligatorio: Título de la ${carrera126}.`,
        estudiante126, ['titulo de la licenciatura en sistemas']],
    ['título obligatorio con artículo antes de la cursada también queda pendiente',
        `Requisito obligatorio: Título de la ${carrera126}. ${cursada126}`,
        estudiante126, ['titulo de la licenciatura en sistemas']],
    ['egreso obligatorio con artículo queda pendiente junto a la cursada',
        `${cursada126} Requisito obligatorio: Egreso de la ${carrera126}.`,
        estudiante126, ['egreso de la licenciatura en sistemas']],
    ['título obligatorio sin prefijo con artículo queda pendiente junto a la cursada',
        `${cursada126} Requisito obligatorio: La ${carrera126}.`,
        estudiante126, ['la licenciatura en sistemas']],
    ['título deseable con artículo anula el título obligatorio con artículo de la misma carrera',
        `Requisito obligatorio: Título de la ${carrera126}. El título de la ${carrera126} es deseable. ${cursada126}`,
        estudiante126, []],
    ['título obligatorio con artículo de otra carrera no bloquea la cursada vigente',
        `${cursada126} Requisito obligatorio: Título de la Licenciatura en Informática.`,
        estudiante126, []],
])('alcance académico #126: %s', async (_caso, descripcion, cumplido, pendientes, tipo = 'obligatorio') => {
    const requisito = cumplido || estudiante126;
    const perfil = `Soy ${requisito.replace(/^Estudiante/, 'estudiante')}.`;
    const caso = await evaluarCasoAcademico126(null, requisito, perfil, perfil, { descripcion, tipo });
    const { resultado, avisoSintetico, explicacion } = caso;
    expect(resultado).toMatchObject({ match: true, porcentaje: 80,
        explicacion: { cumplidos: cumplido ? explicacion.cumplidos : [], no_cumplidos: [], exclusiones: [],
            por_confirmar: pendientes.map(requisito => expect.objectContaining({ requisito, tipo: 'obligatorio' })) } });
    expect(resultado.pendiente === true).toBe(pendientes.length > 0);
    expect(resultado.error).toBeUndefined();
    const consultas = pool.query.mock.calls.length;
    await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila)).resolves.toEqual(resultado);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    const relectura = pool.query.mock.calls.slice(consultas);
    expect(relectura.length).toBeGreaterThan(0);
    expect(relectura.every(([sql]) => sql.includes('SELECT resultado'))).toBe(true);
});

test('reauditoría #127: no duplica el título obligatorio ya informado con otra forma de artículo y conserva su cita', async () => {
    const avisoSintetico = Object.freeze({ id: 126, titulo: 'Desarrollo TypeScript Junior',
        descripcion: `Desarrollo con TypeScript. ${cursada126} Requisito obligatorio: Título de la ${carrera126}.`,
        modalidad: 'remoto', descripcion_completitud: 'completa' });
    fila = Object.freeze({ stack_tecnologico: Object.freeze(['TypeScript']), perfil_profesional: perfilEstudiante126,
        zonas_preferidas: Object.freeze([]) });
    const cumplido = { requisito: estudiante126, tipo: 'obligatorio', evidencia_oferta: estudiante126,
        evidencia_perfil: perfilEstudiante126, explicacion: 'Coincidencia declarada.' };
    const pendienteTitulo = { requisito: `Título de ${carrera126}`, tipo: 'obligatorio',
        evidencia_oferta: `Título de la ${carrera126}`, evidencia_perfil: '', explicacion: 'Falta acreditar el título.' };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 80,
        razon: 'Falta confirmar el título.',
        explicacion: { cumplidos: [cumplido], no_cumplidos: [], por_confirmar: [pendienteTitulo], exclusiones: [] } }));
    const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila);
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { cumplidos: [cumplido], no_cumplidos: [], exclusiones: [] } });
    expect(resultado.error).toBeUndefined();
    expect(resultado.explicacion.por_confirmar).toHaveLength(1);
    expect(resultado.explicacion.por_confirmar[0]).toMatchObject({
        requisito: `Título de ${carrera126}`, tipo: 'obligatorio', evidencia_oferta: `Título de la ${carrera126}`,
    });
    const antes = structuredClone([...registros]);
    const consultas = pool.query.mock.calls.length;
    await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila)).resolves.toEqual(resultado);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect([...registros]).toEqual(antes);
    expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
        .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);
});

test.each(['Título', 'Egreso'])('reauditoría #127: no acredita un %s de otra carrera más larga por equivalencia de artículo', async rotulo => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const citaLarga = `${rotulo} de la ${carrera126} de Información`;
    const avisoSintetico = Object.freeze({ id: 126, titulo: 'Desarrollo TypeScript Junior',
        descripcion: `Desarrollo con TypeScript. Requisito obligatorio: ${citaLarga}.`,
        modalidad: 'remoto', descripcion_completitud: 'completa' });
    fila = Object.freeze({ stack_tecnologico: Object.freeze(['TypeScript']), perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([]) });
    const cumplido = { requisito: `Título de ${carrera126}`, tipo: 'obligatorio', evidencia_oferta: citaLarga,
        evidencia_perfil: perfilTitulo, explicacion: 'Coincidencia declarada.' };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 80,
        razon: 'Titulación declarada.',
        explicacion: { cumplidos: [cumplido], no_cumplidos: [], por_confirmar: [], exclusiones: [] } }));
    const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila);
    expect(resultado).toMatchObject({ match: true, porcentaje: 80, pendiente: true,
        explicacion: { cumplidos: [], no_cumplidos: [], exclusiones: [],
            por_confirmar: [expect.objectContaining({ requisito: `Título de ${carrera126}`, tipo: 'obligatorio' })] } });
    expect(resultado.error).toBeUndefined();
    const antes = structuredClone([...registros]);
    const consultas = pool.query.mock.calls.length;
    await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila)).resolves.toEqual(resultado);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect([...registros]).toEqual(antes);
    expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
        .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);
});

test('reauditoría #127: acredita el título de la misma carrera cuando sólo difiere el artículo', async () => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const citaArticulo = `Título de la ${carrera126}`;
    const avisoSintetico = Object.freeze({ id: 126, titulo: 'Desarrollo TypeScript Junior',
        descripcion: `Desarrollo con TypeScript. Requisito obligatorio: ${citaArticulo}.`,
        modalidad: 'remoto', descripcion_completitud: 'completa' });
    fila = Object.freeze({ stack_tecnologico: Object.freeze(['TypeScript']), perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([]) });
    const cumplido = { requisito: `Título de ${carrera126}`, tipo: 'obligatorio', evidencia_oferta: citaArticulo,
        evidencia_perfil: perfilTitulo, explicacion: 'Título confirmado.' };
    proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 80,
        razon: 'Titulación confirmada.',
        explicacion: { cumplidos: [cumplido], no_cumplidos: [], por_confirmar: [], exclusiones: [] } }));
    const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila);
    expect(resultado).toMatchObject({ match: true, porcentaje: 80,
        explicacion: { cumplidos: [cumplido], no_cumplidos: [], por_confirmar: [], exclusiones: [] } });
    expect(resultado.pendiente).not.toBe(true);
    expect(resultado.error).toBeUndefined();
    const antes = structuredClone([...registros]);
    const consultas = pool.query.mock.calls.length;
    await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, fila)).resolves.toEqual(resultado);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect([...registros]).toEqual(antes);
    expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
        .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);
});

test('reauditoría #127: no acredita un título mencionado sólo en un bloque eliminado o de otro equipo', async () => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const carreraMayor = `${carrera126} de Información`;
    const filaLocal = Object.freeze({
        stack_tecnologico: Object.freeze(['TypeScript']),
        perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([])
    });
    const cumplidoFalso = {
        requisito: `Título de ${carrera126}`,
        tipo: 'obligatorio',
        evidencia_oferta: `Título de la ${carrera126}`,
        evidencia_perfil: perfilTitulo,
        explicacion: 'Título confirmado.'
    };
    const variantes = [
        `Desarrollo con TypeScript. Requisito obligatorio: Título de la ${carreraMayor}.\nReproducimos a continuación el texto eliminado de una publicación previa:\nRequisito obligatorio: Título de la ${carrera126}.`,
        `Desarrollo con TypeScript. Requisito obligatorio: Título de la ${carreraMayor}.\nSólo para el equipo de Datos:\nRequisito obligatorio: Título de la ${carrera126}.`
    ];

    for (const descripcion of variantes) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        const payloadFalso = {
            match: true,
            porcentaje: 80,
            razon: 'Titulación confirmada.',
            explicacion: {
                cumplidos: [cumplidoFalso],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        };
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payloadFalso));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [expect.objectContaining({
                    requisito: `Título de ${carrera126}`,
                    tipo: 'obligatorio',
                    evidencia_oferta: '',
                    evidencia_perfil: ''
                })],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);

        for (const entry of registros.values()) {
            entry.razon = payloadFalso.razon;
            entry.explicacion = structuredClone(payloadFalso.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }
});

test('reauditoría #127: acredita el título con artículo inicial obligatorio o alcance explícito a esta vacante', async () => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const filaLocal = Object.freeze({
        stack_tecnologico: Object.freeze(['TypeScript']),
        perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([])
    });
    const variantes = [
        {
            descripcion: `Desarrollo con TypeScript. El título de la ${carrera126} es obligatorio.`,
            evidenciaOferta: `El título de la ${carrera126} es obligatorio.`
        },
        {
            descripcion: `Desarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126} para esta vacante.`,
            evidenciaOferta: `Título de la ${carrera126}`
        }
    ];

    for (const { descripcion, evidenciaOferta } of variantes) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        const cumplido = {
            requisito: `Título de ${carrera126}`,
            tipo: 'obligatorio',
            evidencia_oferta: evidenciaOferta,
            evidencia_perfil: perfilTitulo,
            explicacion: 'Título confirmado.'
        };
        const payload = {
            match: true,
            porcentaje: 80,
            razon: 'Titulación confirmada.',
            explicacion: {
                cumplidos: [cumplido],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        };
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).not.toBe(true);
        expect(resultado.error).toBeUndefined();
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [cumplido],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);

        for (const entry of registros.values()) {
            entry.razon = payload.razon;
            entry.explicacion = structuredClone(payload.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }
});

test('reauditoría #127 (6186f3c): F1 exige título pendiente ante ambos órdenes de para esta vacante y respeta otro puesto o deseable', async () => {
    const filaLocal = Object.freeze({
        stack_tecnologico: Object.freeze(['TypeScript']),
        perfil_profesional: perfilEstudiante126,
        zonas_preferidas: Object.freeze([])
    });
    const cumplidoCursada = {
        requisito: estudiante126,
        tipo: 'obligatorio',
        evidencia_oferta: estudiante126,
        evidencia_perfil: perfilEstudiante126,
        explicacion: 'Cursada confirmada.'
    };
    const payload = {
        match: true,
        porcentaje: 80,
        razon: 'Cursada confirmada.',
        explicacion: {
            cumplidos: [cumplidoCursada],
            no_cumplidos: [],
            por_confirmar: [],
            exclusiones: []
        }
    };
    const descripcionesBloqueo = [
        `Desarrollo con TypeScript. Requisito obligatorio: ${estudiante126}. El título de la ${carrera126} es obligatorio para esta vacante.`,
        `Desarrollo con TypeScript. Requisito obligatorio: ${estudiante126}. El título de la ${carrera126} para esta vacante es obligatorio.`
    ];

    for (const descripcion of descripcionesBloqueo) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [cumplidoCursada],
                no_cumplidos: [],
                por_confirmar: [expect.objectContaining({
                    tipo: 'obligatorio',
                    requisito: expect.stringMatching(/licenciatura en sistemas/i),
                    evidencia_oferta: expect.stringMatching(/\S/)
                })],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);

        for (const entry of registros.values()) {
            entry.razon = payload.razon;
            entry.explicacion = structuredClone(payload.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }

    const controlesNoBloqueo = [
        `Desarrollo con TypeScript. Requisito obligatorio: ${estudiante126}. El título de la ${carrera126} para la vacante de Datos es obligatorio.`,
        `Desarrollo con TypeScript. Requisito obligatorio: ${estudiante126}. El título de la ${carrera126} es obligatorio para otra vacante.`,
        `Desarrollo con TypeScript. Requisito obligatorio: ${estudiante126}.\nRequisitos deseables:\nTítulo de la ${carrera126}.`,
        `Desarrollo con TypeScript. Requisito obligatorio: ${estudiante126}. El título de la ${carrera126} es deseable.`
    ];
    for (const descripcion of controlesNoBloqueo) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).not.toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [cumplidoCursada],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        });
    }
});

test('reauditoría #127 (6186f3c): F2 preserva títulos bajo encabezado simple y con citas en párrafo aparte sin aceptar citas o bloques no vigentes', async () => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const filaLocal = Object.freeze({
        stack_tecnologico: Object.freeze(['TypeScript']),
        perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([])
    });
    const cumplido = {
        requisito: `Título de ${carrera126}`,
        tipo: 'obligatorio',
        evidencia_oferta: `Título de la ${carrera126}`,
        evidencia_perfil: perfilTitulo,
        explicacion: 'Título confirmado.'
    };
    const payload = {
        match: true,
        porcentaje: 80,
        razon: 'Titulación confirmada.',
        explicacion: {
            cumplidos: [cumplido],
            no_cumplidos: [],
            por_confirmar: [],
            exclusiones: []
        }
    };
    const variantesPositivas = [
        `Desarrollo con TypeScript.\nRequisitos obligatorios:\nTítulo de la ${carrera126}.`,
        `Beneficios: acceso al curso «Comunicación efectiva».\n\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.`,
        `Desarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.\n\nBeneficios: acceso al curso «Comunicación efectiva».`
    ];

    for (const descripcion of variantesPositivas) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).not.toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [cumplido],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);

        for (const entry of registros.values()) {
            entry.razon = payload.razon;
            entry.explicacion = structuredClone(payload.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }

    const controlesNegativos = [
        `Desarrollo con TypeScript. Requisito obligatorio: «Título de la ${carrera126}».`,
        `Desarrollo con TypeScript. Cita histórica: «Contexto viejo. Requisito obligatorio: Título de la ${carrera126}. Fin.»`,
        `«\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.\n»`,
        `Beneficios: acceso al curso «Comunicación efectiva».\n\nRequisito obligatorio: Título de la ${carrera126} de Información.\nReproducimos a continuación el texto eliminado:\nRequisitos obligatorios:\nTítulo de la ${carrera126}.\nFin del texto eliminado.`,
        `Beneficios: acceso al curso «Comunicación efectiva».\n\nRequisito obligatorio: Título de la ${carrera126} de Información.\nSólo para el equipo de Datos:\nRequisitos obligatorios:\nTítulo de la ${carrera126}.`
    ];

    for (const descripcion of controlesNegativos) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [expect.objectContaining({
                    requisito: `Título de ${carrera126}`,
                    tipo: 'obligatorio',
                    evidencia_oferta: '',
                    evidencia_perfil: ''
                })],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);

        for (const entry of registros.values()) {
            entry.razon = payload.razon;
            entry.explicacion = structuredClone(payload.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }
});

test('reauditoría #127 (9efb6f2): F1 no acredita títulos dentro de citas con comillas simples y distingue apóstrofos internos', async () => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const filaLocal = Object.freeze({
        stack_tecnologico: Object.freeze(['TypeScript']),
        perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([])
    });
    const cumplido = {
        requisito: `Título de ${carrera126}`,
        tipo: 'obligatorio',
        evidencia_oferta: `Título de la ${carrera126}`,
        evidencia_perfil: perfilTitulo,
        explicacion: 'Título confirmado.'
    };
    const payload = {
        match: true,
        porcentaje: 80,
        razon: 'Titulación confirmada.',
        explicacion: {
            cumplidos: [cumplido],
            no_cumplidos: [],
            por_confirmar: [],
            exclusiones: []
        }
    };
    const requisitoActivo = `Requisito obligatorio: Título de la ${carrera126} de Información.`;
    const citaCurva = `Ejemplo no vigente: ‘La vacante anterior se cerró. Requisito obligatorio: Título de la ${carrera126}. El texto era sólo ilustrativo’.`;
    const citaRecta = `Ejemplo no vigente: 'La vacante anterior se cerró. Requisito obligatorio: Título de la ${carrera126}. El texto era sólo ilustrativo'.`;
    const citaRectaPuntoDentro = `Ejemplo no vigente: 'La vacante anterior se cerró. Requisito obligatorio: Título de la ${carrera126}. El texto era sólo ilustrativo.'`;
    const negativos = [
        `${citaCurva}\n\n${requisitoActivo}`,
        `${requisitoActivo}\n\n${citaCurva}`,
        `${citaRecta}\n\n${requisitoActivo}`,
        `${requisitoActivo}\n\n${citaRectaPuntoDentro}`,
        `‘\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.\n’`,
        `'\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.\n'`
    ];

    for (const descripcion of negativos) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [expect.objectContaining({
                    requisito: `Título de ${carrera126}`,
                    tipo: 'obligatorio',
                    evidencia_oferta: '',
                    evidencia_perfil: ''
                })],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);

        for (const entry of registros.values()) {
            entry.razon = payload.razon;
            entry.explicacion = structuredClone(payload.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }

    const positivosConApostrofo = [
        `Beneficios: it's remote and supports developers' growth.\n\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.`,
        `Beneficios: it’s remote and supports developers’ growth.\n\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.`
    ];
    for (const descripcion of positivosConApostrofo) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).not.toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [cumplido],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);
    }
});

test('reauditoría #127 (01c8061): F1 preserva citas simples ante posesivos plurales interiores y permite posesivos o citas ajenas', async () => {
    const perfilTitulo = `Obtuve el título de ${carrera126}.`;
    const filaLocal = Object.freeze({
        stack_tecnologico: Object.freeze(['TypeScript']),
        perfil_profesional: perfilTitulo,
        zonas_preferidas: Object.freeze([])
    });
    const cumplido = {
        requisito: `Título de ${carrera126}`,
        tipo: 'obligatorio',
        evidencia_oferta: `Título de la ${carrera126}`,
        evidencia_perfil: perfilTitulo,
        explicacion: 'Título confirmado.'
    };
    const payload = {
        match: true,
        porcentaje: 80,
        razon: 'Titulación confirmada.',
        explicacion: {
            cumplidos: [cumplido],
            no_cumplidos: [],
            por_confirmar: [],
            exclusiones: []
        }
    };
    const requisitoActivo = `Requisito obligatorio: Título de la ${carrera126} de Información.`;
    const citaCurva = `Ejemplo no vigente: ‘The developers’ handbook was archived. Requisito obligatorio: Título de la ${carrera126}. El texto era sólo ilustrativo’.`;
    const citaRecta = `Ejemplo no vigente: 'The developers' handbook was archived. Requisito obligatorio: Título de la ${carrera126}. El texto era sólo ilustrativo'.`;
    const citaRectaPuntoDentro = `Ejemplo no vigente: 'The developers' handbook was archived. Requisito obligatorio: Título de la ${carrera126}. El texto era sólo ilustrativo.'`;
    const negativos = [
        `${citaCurva}\n\n${requisitoActivo}`,
        `${requisitoActivo}\n\n${citaCurva}`,
        `${citaRecta}\n\n${requisitoActivo}`,
        `${requisitoActivo}\n\n${citaRecta}`,
        `${citaRectaPuntoDentro}\n\n${requisitoActivo}`
    ];

    for (const descripcion of negativos) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [expect.objectContaining({
                    requisito: `Título de ${carrera126}`,
                    tipo: 'obligatorio',
                    evidencia_oferta: '',
                    evidencia_perfil: ''
                })],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);

        for (const entry of registros.values()) {
            entry.razon = payload.razon;
            entry.explicacion = structuredClone(payload.explicacion);
            delete entry.pendiente;
        }
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    }

    const positivos = [
        `The developers’ handbook was archived.\n\nDesarrollo con TypeScript. Requisito obligatorio: Título de la ${carrera126}.`,
        `The developers' handbook was archived. Requisito obligatorio: Título de la ${carrera126}.`,
        `Beneficios: acceso al curso ‘The developers’ handbook’.\n\nRequisito obligatorio: Título de la ${carrera126}.`,
        `Acceso 'gratis'. Requisito obligatorio: Título de la ${carrera126}. Consult developers' docs.`
    ];
    for (const descripcion of positivos) {
        jest.clearAllMocks();
        registros.clear();
        fila = filaLocal;
        const avisoSintetico = Object.freeze({
            id: 126,
            titulo: 'Desarrollo TypeScript Junior',
            descripcion,
            modalidad: 'remoto',
            descripcion_completitud: 'completa'
        });
        proveedor.consultarDeepSeek.mockResolvedValue(JSON.stringify(payload));

        const resultado = await servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal);
        expect(resultado.pendiente).not.toBe(true);
        expect(resultado).toMatchObject({
            match: true,
            porcentaje: 80,
            explicacion: {
                cumplidos: [cumplido],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        });

        const antes = structuredClone([...registros]);
        const consultas = pool.query.mock.calls.length;
        await expect(servicio.evaluarOferta(avisoSintetico, undefined, undefined, filaLocal)).resolves.toEqual(resultado);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect([...registros]).toEqual(antes);
        expect(pool.query.mock.calls.slice(consultas).map(([sql]) => sql.trim()))
            .toEqual([expect.stringMatching(/^SELECT resultado\b/)]);
    }
});

test('alias y Flash canónico reutilizan la misma entrada del proveedor y caché', async () => {
    const primera = await servicio.evaluarOferta(oferta);
    fila.modelo_ia = 'deepseek-flash';
    expect(await servicio.evaluarOferta(oferta)).toEqual(primera);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(proveedor.consultarDeepSeek.mock.calls[0][2]).toBe('deepseek-flash');
    expect(registros.size).toBe(1);
});

test.each(['SALIDA_TRUNCADA', 'SALIDA_INCOMPLETA', 'JSON_INVALIDO'])('error técnico %s no rechaza, no cachea y permite reintentar', async codigo => {
    proveedor.consultarDeepSeek.mockRejectedValueOnce(Object.assign(new Error('Error técnico recuperable'), { codigo }));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen.errores).toBe(1);
    expect(resumen.rechazadas).toBe(0);
    expect(resumen.aprobadas).toBe(0);
    expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(9, 'pendiente', expect.stringContaining('Error al evaluar con DeepSeek:'), null,
        expect.stringContaining('Error al evaluar con DeepSeek:'), null, null, null, oferta.descripcion);
    expect(registros.size).toBe(0);
    expect((await servicio.evaluarOferta(oferta)).match).toBe(true);
    expect(registros.size).toBe(1);
});

test('una reevaluación truncada conserva el resultado válido y no sustituye su caché', async () => {
    const anterior = { ...oferta, estado_evaluacion: 'aprobada', fecha_evaluacion: '2026-01-01', razon_evaluacion: 'Confirmada',
        porcentaje_match: 80, firma_criterios_evaluacion: 'anterior' };
    await servicio.evaluarOferta(oferta);
    const almacenada = [...registros.values()][0];
    proveedor.consultarDeepSeek.mockRejectedValueOnce(Object.assign(new Error('Salida truncada'), { codigo: 'SALIDA_TRUNCADA' }));
    const resumen = await servicio.evaluarOfertasPendientes([anterior]);
    expect(resumen.errores).toBe(1);
    expect(resumen.rechazadas).toBe(0);
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
    expect(ofertas.registrarErrorEvaluacion).toHaveBeenCalledWith(
        9, 'Error al evaluar con DeepSeek: DeepSeek terminó la respuesta antes de completarla. No se obtuvo una evaluación nueva válida.',
        anterior.descripcion
    );
    expect([...registros.values()]).toEqual([almacenada]);
    expect(anterior.porcentaje_match).toBe(80);
    expect(anterior.firma_criterios_evaluacion).toBe('anterior');
});

test.each([new SyntaxError('CV_PRIVADO'), Object.assign(new Error('CV_PRIVADO'), { codigo: 'CV_PRIVADO' })])('no publico errores inesperados ni códigos arbitrarios y recupero después', async error => {
    const registro = jest.spyOn(console, 'error').mockImplementation(() => {});
    proveedor.consultarDeepSeek.mockRejectedValueOnce(error);
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen.errores).toBe(1);
    expect(registro).toHaveBeenCalledWith('[Evaluación] Fallo técnico de IA', { oferta_id: 9, codigo: 'ERROR_EVALUACION' });
    expect(JSON.stringify([resumen, registro.mock.calls, ofertas.actualizarEvaluacion.mock.calls])).not.toContain('CV_PRIVADO');
    expect(registros.size).toBe(0);
    expect((await servicio.evaluarOferta(oferta)).match).toBe(true);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(registros.size).toBe(1);
    expect(JSON.stringify([...registros.values()])).not.toMatch(/duracion_ms|finish_reason|max_tokens|tokens_entrada/);
    registro.mockRestore();
});

test('mismas entradas reales reutilizan caché: una sola llamada al proveedor', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const info = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
        const primera = await servicio.evaluarOferta(oferta);
        const segunda = await servicio.evaluarOferta({ ...oferta, id: 10 });
        expect(segunda).toEqual(primera);
        expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect(registros.size).toBe(1);
        expect(error).not.toHaveBeenCalled();
        expect(info).not.toHaveBeenCalled();
        expect(JSON.stringify([primera, segunda, ...registros.values()])).not.toContain('bytes_mensaje_');
    } finally {
        error.mockRestore();
        info.mockRestore();
    }
});

test.each([
    { perfil_profesional: 'Nueva evidencia confirmada' },
    { nombre: 'Otro perfil confirmado' },
    { anios_experiencia_reales: 0 },
    { tecnologias_detalle: [] },
    { usar_prompt_personalizado: true, prompt_personalizado: 'Priorizar aplicaciones web' },
    { modelo_ia_evaluacion: 'deepseek-v4-pro' },
])('un cambio relevante provoca miss y envía la entrada nueva: %j', async cambios => {
    await servicio.evaluarOferta(oferta);
    fila = { ...fila, ...cambios };
    await servicio.evaluarOferta(oferta);
    await servicio.evaluarOferta(oferta);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(proveedor.consultarDeepSeek.mock.calls[1][0]).toBe(servicio.construirInstruccionesDesdePreferencias(fila));
    expect(proveedor.consultarDeepSeek.mock.calls[1][2]).toBe(proveedor.normalizarModeloDeepSeek(fila.modelo_ia_evaluacion || fila.modelo_ia));
});

test('contenido activo y toggle cambian entradas; contenido inactivo no las cambia', async () => {
    await servicio.evaluarOferta(oferta);
    fila.prompt_personalizado = 'Primer criterio';
    await servicio.evaluarOferta(oferta);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    fila.usar_prompt_personalizado = true;
    await servicio.evaluarOferta(oferta);
    fila.prompt_personalizado = 'Segundo criterio';
    await servicio.evaluarOferta(oferta);
    fila.usar_prompt_personalizado = false;
    await servicio.evaluarOferta(oferta);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(3);
});

test.each([{ nivel_requerido: 'semi-senior' }, { plataforma: 'indeed' }, { datos_crudos: { requirements: 'TypeScript obligatorio' } }])('cada entrada efectiva de oferta provoca miss: %j', async cambios => {
    await servicio.evaluarOferta(oferta);
    await servicio.evaluarOferta({ ...oferta, ...cambios });
    await servicio.evaluarOferta({ ...oferta, ...cambios });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
});

test('preferencias visuales, contenido inactivo y metadatos crudos irrelevantes reutilizan caché', async () => {
    await servicio.evaluarOferta(oferta);
    fila = { ...fila, tema: 'oscuro', terminos_busqueda: ['nuevo'], prompt_personalizado: 'No activo', modelo_ia_importacion: 'deepseek-v4-pro', temperatura_evaluacion: 0.8 };
    await servicio.evaluarOferta({ ...oferta, datos_crudos: { logo: 'imagen', tracking: { enorme: 'irrelevante' } } });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test('forzar omite lectura, reemplaza caché y la próxima evaluación reutiliza el resultado NUEVO', async () => {
    await servicio.evaluarOferta(oferta);
    pool.query.mockClear();
    proveedor.consultarDeepSeek.mockResolvedValueOnce('{"match":false,"porcentaje":30,"razon":"Resultado nuevo"}');
    const nueva = await servicio.evaluarOferta(oferta, undefined, undefined, undefined, { forzar: true });
    expect(pool.query.mock.calls.some(([sql]) => sql.includes('SELECT resultado'))).toBe(false);
    expect(await servicio.evaluarOferta(oferta)).toEqual(nueva);
    expect(nueva.razon).toBe('Resultado nuevo');
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
});

test('una aprobación compatible nunca vence la exclusión obligatoria actual', async () => {
    const prohibida = { ...oferta, datos_crudos: { requirements: 'Java obligatorio' } };
    await cache.guardarCache(cache.crearHashOferta(prohibida), cache.crearHashPreferencias(fila), fila.modelo_ia, { match: true, porcentaje: 99, razon: 'Aprobación incompatible' });
    const resultado = await servicio.evaluarOferta(prohibida);
    expect(resultado.match).toBe(false);
    expect(resultado.razon).toContain('Java');
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test('forzar también reemplaza una aprobación incompatible por rechazo determinístico', async () => {
    const prohibida = { ...oferta, descripcion: 'Java obligatorio' };
    const hash = cache.crearHashOferta(prohibida);
    const firma = cache.crearHashPreferencias(fila);
    await cache.guardarCache(hash, firma, fila.modelo_ia, { match: true, porcentaje: 99, razon: 'Cache insegura' });
    pool.query.mockClear();
    const resultado = await servicio.evaluarOferta(prohibida, undefined, undefined, undefined, { forzar: true });
    expect(resultado.match).toBe(false);
    expect(registros.get(JSON.stringify([hash, firma, 'deepseek-flash'])).match).toBe(false);
    expect(pool.query.mock.calls.some(([sql]) => sql.includes('SELECT resultado'))).toBe(false);
    expect(proveedor.consultarDeepSeek).not.toHaveBeenCalled();
});

test('un contrato de reglas anterior no se reutiliza en el servicio real', async () => {
    const { construirIdentidadEvaluacion } = require('../../src/servicios/evaluacion/identidad-evaluacion');
    const anterior = construirIdentidadEvaluacion(oferta, fila, { version: 'evaluacion-anterior' });
    await cache.guardarCache(anterior.hash_oferta, anterior.firma_criterios_evaluacion, anterior.criterios.modelo,
        { match: false, porcentaje: 10, razon: 'Contrato anterior' });
    const actual = await servicio.evaluarOferta(oferta);
    expect(actual.razon).toBe('Compatible');
    expect(await servicio.evaluarOferta(oferta)).toEqual(actual);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each(['description', 'descriptionHtml', 'jobDescription', 'job_description', 'requirements', 'requisitos'])('incluyo fuente cruda efectiva %s sin incluir metadatos visuales', async campo => {
    await servicio.evaluarOferta(oferta);
    const modificada = { ...oferta, datos_crudos: { [campo]: 'TypeScript para aplicaciones', logo: 'Primero' } };
    await servicio.evaluarOferta(modificada);
    await servicio.evaluarOferta({ ...modificada, datos_crudos: { ...modificada.datos_crudos, logo: 'Segundo' } });
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
});

test('cambiar zonas de la defensa no reutiliza rechazo forzado con instrucciones explícitas', async () => {
    const presencial = { ...oferta, modalidad: 'presencial', ubicacion: 'Córdoba' };
    const rechazada = await servicio.evaluarOferta(presencial, 'Sistema explícito', undefined, fila, { forzar: true });
    expect(rechazada.match).toBe(false);
    fila.zonas_preferidas = ['Córdoba'];
    const aprobada = await servicio.evaluarOferta(presencial, 'Sistema explícito', undefined, fila);
    expect(aprobada.match).toBe(true);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test('mensajes de sistema explícitos distintos no comparten caché', async () => {
    await servicio.evaluarOferta(oferta, 'Instrucción efectiva A', undefined, fila);
    await servicio.evaluarOferta(oferta, 'Instrucción efectiva B', undefined, fila);
    await servicio.evaluarOferta(oferta, 'Instrucción efectiva B', undefined, fila);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(proveedor.consultarDeepSeek.mock.calls[1][0]).toBe('Instrucción efectiva B');
});

test('errores no se cachean ni reciben firma vigente', async () => {
    proveedor.consultarDeepSeek.mockResolvedValueOnce('{"match":"true"}');
    const fallida = await servicio.evaluarOferta(oferta);
    expect(fallida.error).toBe(true);
    expect(fallida.firma_criterios_evaluacion ?? null).toBeNull();
    expect(registros.size).toBe(0);
    await servicio.evaluarOferta(oferta);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(2);
});

test('lote con falla del proveedor persiste firma null, no criterios actuales', async () => {
    proveedor.consultarDeepSeek.mockRejectedValueOnce(new Error('Timeout sintético'));
    const resumen = await servicio.evaluarOfertasPendientes();
    expect(resumen.errores).toBe(1);
    expect(ofertas.actualizarEvaluacion.mock.calls[0][6]).toBeNull();
    expect(registros.size).toBe(0);
});

test('lote persiste la firma exitosa y conserva prioridad y fecha mediante el modelo', async () => {
    await servicio.evaluarOfertasPendientes();
    expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(9, 'aprobada', 'Compatible', 80, null, expect.anything(), expect.stringMatching(/^[a-f0-9]{64}$/), null, expect.anything());
    await servicio.evaluarOfertasPendientes();
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});
