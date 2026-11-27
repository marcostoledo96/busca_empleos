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
