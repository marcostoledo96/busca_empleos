jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'),
    consultarDeepSeek: jest.fn(),
}));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ obtenerOfertasPendientes: jest.fn(), actualizarEvaluacion: jest.fn() }));
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

test('mismas entradas reales reutilizan caché: una sola llamada al proveedor', async () => {
    const primera = await servicio.evaluarOferta(oferta);
    const segunda = await servicio.evaluarOferta({ ...oferta, id: 10 });
    expect(segunda).toEqual(primera);
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
    expect(registros.size).toBe(1);
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
    expect(proveedor.consultarDeepSeek.mock.calls[1][2]).toBe(fila.modelo_ia_evaluacion || fila.modelo_ia);
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
    expect(registros.get(JSON.stringify([hash, firma, fila.modelo_ia])).match).toBe(false);
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
    expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(9, 'aprobada', 'Compatible', 80, null, expect.anything(), expect.stringMatching(/^[a-f0-9]{64}$/));
    await servicio.evaluarOfertasPendientes();
    expect(proveedor.consultarDeepSeek).toHaveBeenCalledTimes(1);
});
