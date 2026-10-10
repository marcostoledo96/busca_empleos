jest.mock('../../src/modelos/preferencia');
jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/utils/middleware-auth', () => ({ verificarAuth: (req, res, next) => next() }));
jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn() }));
const express = require('express');
const request = require('supertest');
const preferencias = require('../../src/modelos/preferencia');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const rutas = require('../../src/rutas/preferencias');
const app = express();
app.use('/api/preferencias', rutas);
const ruta = '/api/preferencias/importar-cv/analizar';
const subir = (texto = '# CV sintético', nombre = 'cv.md') => request(app).post(ruta)
    .attach('cv', Buffer.from(texto), { filename: nombre, contentType: 'text/markdown' });

beforeEach(() => {
    jest.clearAllMocks();
    preferencias.obtenerPreferencias.mockResolvedValue({});
    consultarDeepSeek.mockResolvedValue(JSON.stringify({ nombre: 'Perfil sintético' }));
});
afterEach(() => expect(preferencias.actualizarPreferencias).not.toHaveBeenCalled());

test('acepto un Markdown pequeño y conservo ausencia, null y listas vacías', async () => {
    consultarDeepSeek.mockResolvedValue(JSON.stringify({ nombre: null, perfil_profesional: 'Perfil sintético', tecnologias_detalle: [], advertencias: [] }));
    const respuesta = await subir();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toEqual({ nombre: null, perfil_profesional: 'Perfil sintético', tecnologias_detalle: [], advertencias: [] });
});
test('envío el documento completo de 60411 caracteres con evidencia final', async () => {
    const final = '\nEVIDENCIA_FINAL_ANGULAR';
    const texto = '# CV sintético\n' + 'a'.repeat(60411 - 15 - final.length) + final;
    expect(texto.length).toBe(60411);
    const respuesta = await subir(texto);
    expect(respuesta.status).toBe(200);
    expect(consultarDeepSeek.mock.calls[0][1].includes(texto)).toBe(true);
    expect(consultarDeepSeek.mock.calls[0][1]).toContain(final);
});
test.each(['null', '[]', '"texto"', '{', '{"tecnologias_detalle":[null]}',
    '{"tecnologias_detalle":[{"nombre":"Angular","nivel":"experto","categoria":"frontend"}]}',
    '{"zonas_preferidas":"CABA"}', '{"advertencias":[null]}',
    '{"constructor":"invalido"}', '{"__proto__":{}}',
    '{"tecnologias_detalle":[{"nombre":"Angular","nivel":"medio","categoria":"frontend","aliases":[null]}]}',
    '{"roles_objetivo_detalle":[{"rol":"QA","prioridad":"urgente"}]}',
    '{"nivel_ingles_detalle":{"reading":3}}', '{"expectativa_salarial_min":"100"}',
    '{"plataformas_preferidas":["inventada"]}', '{"preguntas":[null]}',
    '{"tecnologias_detalle":null}', '{"keywords_positivas":null}',
    '{"tecnologias_detalle":[{"nombre":"","nivel":"medio","categoria":"frontend"}]}',
    '{"tecnologias_detalle":[{"nombre":"Angular","nivel":"medio","categoria":"desconocida"}]}',
    '{"roles_objetivo_detalle":[null]}', '{"roles_objetivo_detalle":[{"rol":"QA","prioridad":"alta","aliases":false}]}',
    '{"nivel_ingles_detalle":[]}', '{"expectativa_salarial_min":-1}',
    '{"expectativa_salarial_max":1e309}', '{"expectativa_salarial_max":1000000000}',
    '{"expectativa_salarial_min":2,"expectativa_salarial_max":1}',
    '{"nivel_experiencia":"senior"}', '{"modalidad_aceptada":"mixta"}',
    '{"disponibilidad":"siempre"}', '{"moneda_salarial":"EUR"}',
    '{"terminos_busqueda":[3]}', '{"reglas_exclusion":[{}]}', '{"keywords_negativas":false}',
    '{"plataformas_excluidas":["google-jobs"]}', '{"preguntas_perfil_pendientes":[{"campo":"idioma","pregunta":false,"motivo":"Falta"}]}',
    '{"tecnologias_detalle":[{"nombre":"Angular","nivel":"medio","categoria":"frontend","importancia":null}]}'])('rechazo contrato o JSON inválido sin devolver datos: %s', async texto => {
    consultarDeepSeek.mockResolvedValue(texto);
    const respuesta = await subir();
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.exito).toBe(false);
    expect(respuesta.body.datos).toBeUndefined();
    expect(respuesta.body.datosCrudos).toBeUndefined();
    expect(respuesta.body.codigo).toBe(texto === '{' ? 'JSON_INVALIDO' : 'CONTRATO_INVALIDO');
});
test('distingo respuesta inválida del proveedor de JSON inválido de extracción', async () => {
    consultarDeepSeek.mockRejectedValue(new SyntaxError('Sobre del proveedor inválido'));
    const respuesta = await subir();
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.codigo).toBe('PROVEEDOR_NO_DISPONIBLE');
});
test('distingo fallo del proveedor sin divulgar su mensaje', async () => {
    consultarDeepSeek.mockRejectedValue(new Error('CONTENIDO_PRIVADO'));
    const respuesta = await subir();
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.codigo).toBe('PROVEEDOR_NO_DISPONIBLE');
    expect(JSON.stringify(respuesta.body)).not.toContain('CONTENIDO_PRIVADO');
});
test('rechazo UTF-8 malformado sin sustituir bytes ni consultar IA', async () => {
    const respuesta = await request(app).post(ruta).attach('cv', Buffer.from([0xC3, 0x28]), 'cv.md');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.codigo).toBe('CARGA_INVALIDA');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
});
test('reservo la salida máxima del proveedor sin cambiar max_tokens', async () => {
    const respuesta = await subir('a'.repeat(650000));
    expect(respuesta.status).toBe(413);
    expect(respuesta.body.codigo).toBe('PRESUPUESTO_DOCUMENTO');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
});
test('acepto el techo exacto de mensajes y rechazo un byte adicional', async () => {
    await subir();
    const [sistema, usuario] = consultarDeepSeek.mock.calls[0];
    const encuadre = Buffer.byteLength(sistema + usuario, 'utf8') - Buffer.byteLength('# CV sintético', 'utf8');
    const limiteCv = 602688 - encuadre;
    consultarDeepSeek.mockClear();
    expect((await subir('a'.repeat(limiteCv))).status).toBe(200);
    consultarDeepSeek.mockClear();
    const respuesta = await subir('a'.repeat(limiteCv + 1));
    expect(respuesta.status).toBe(413);
    expect(respuesta.body.codigo).toBe('PRESUPUESTO_DOCUMENTO');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
});
test('el prompt utiliza categorías, importancia y aliases canónicos', async () => {
    await subir();
    const sistema = consultarDeepSeek.mock.calls[0][0];
    expect(sistema).toContain('"mobile"');
    expect(sistema).toContain('"no_prioritaria"');
    expect(sistema).toContain('máximo 20');
    expect(sistema).not.toContain('mínimo 1');
});
test('rechazo finalización incompleta antes del éxito', async () => {
    consultarDeepSeek.mockRejectedValue(Object.assign(new Error('Salida incompleta'), { codigo: 'SALIDA_INCOMPLETA' }));
    const respuesta = await subir();
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.codigo).toBe('SALIDA_INCOMPLETA');
});
test('rechazo documento completo fuera del presupuesto sin consultar IA', async () => {
    const respuesta = await subir('a'.repeat(980000));
    expect(respuesta.status).toBe(413);
    expect(respuesta.body.codigo).toBe('PRESUPUESTO_DOCUMENTO');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
});
test.each([['', 'cv.md', 400], ['# CV', 'cv.txt', 400], ['a'.repeat(1024 * 1024 + 1), 'cv.md', 413]])('distingo carga inválida', async (texto, nombre, estado) => {
    const respuesta = await subir(texto, nombre);
    expect(respuesta.status).toBe(estado);
    expect(respuesta.body.codigo).toBe('CARGA_INVALIDA');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
});
test('acepto extracción parcial con enums canónicos, evidencia, aliases y preguntas', async () => {
    const datos = { tecnologias_detalle: [{ nombre: 'Angular', nivel: 'medio', categoria: 'frontend',
        importancia: 'principal', aliases: ['ng'], evidencia: 'Proyecto sintético' }],
        roles_objetivo_detalle: [{ rol: 'QA', prioridad: 'alta', aliases: [] }],
        nivel_ingles_detalle: { reading: null }, expectativa_salarial_min: 0,
        zonas_preferidas: ['Ubicación declarada'], plataformas_preferidas: ['google_jobs'],
        preguntas: [{ campo: 'idioma', pregunta: '¿Qué nivel?', motivo: 'No declarado', sugerencia: null }] };
    consultarDeepSeek.mockResolvedValue('```json\n' + JSON.stringify(datos) + '\n```');
    const respuesta = await subir();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toEqual(datos);
});
test('conservo backticks dentro de valores JSON sin alterar evidencia', async () => {
    const datos = { perfil_profesional: 'Documento con ```json y ``` como evidencia literal.' };
    consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    const respuesta = await subir();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toEqual(datos);
});
test('distingo truncamiento de salida', async () => {
    consultarDeepSeek.mockRejectedValue(Object.assign(new Error('Salida incompleta'), { codigo: 'SALIDA_TRUNCADA' }));
    const respuesta = await subir();
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.codigo).toBe('SALIDA_TRUNCADA');
});
test('el montaje real de app comparte errores de carga y validación', async () => {
    const aplicacion = require('../../src/app');
    const invalida = await request(aplicacion).post(ruta).attach('cv', Buffer.from('# CV'), 'cv.txt');
    expect(invalida.status).toBe(400);
    expect(invalida.body.codigo).toBe('CARGA_INVALIDA');
    consultarDeepSeek.mockResolvedValue('{"tecnologias_detalle":[null]}');
    const contrato = await request(aplicacion).post(ruta).attach('cv', Buffer.from('# CV'), 'cv.md');
    expect(contrato.status).toBe(422);
    expect(contrato.body.codigo).toBe('CONTRATO_INVALIDO');
});
test.each([{}, { advertencias: [] }, { nombre: null }, { nombre: ' \n ' },
    { tecnologias_detalle: [] }, { nivel_experiencia: null }, { nivel_ingles_detalle: null },
    { nivel_ingles_detalle: { reading: ' ', speaking: null, regla: 'No excluir' } },
    { nivel_ingles_detalle: { espanol: 'Nativo' } },
    { preguntas: [{ campo: 'idioma', pregunta: '¿Nivel?', motivo: 'Ausente' }] },
    { advertencias: ['Falta información'], zonas_preferidas: ['CABA'], modalidad_aceptada: 'remoto',
        disponibilidad: 'full_time', expectativa_salarial_min: 100, moneda_salarial: 'ARS',
        roles_objetivo_detalle: [{ rol: 'QA', prioridad: 'alta' }], terminos_busqueda: ['QA'],
        reglas_exclusion: ['Java'], keywords_positivas: ['IA'], plataformas_preferidas: ['linkedin'] },
])('rechazo extracción sin hechos útiles: %j', async datos => {
    consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    const respuesta = await subir();
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.codigo).toBe('CONTRATO_INVALIDO');
    expect(respuesta.body.datos).toBeUndefined();
});
test.each([{ nombre: 'Perfil sintético' }, { perfil_profesional: 'QA' }, { idioma_candidato: 'Español' },
    { nivel_experiencia: 'trainee' }, { nivel_ingles_detalle: { reading: 'B1' } },
    { tecnologias_detalle: [{ nombre: 'Angular', nivel: 'basico', categoria: 'frontend' }] },
])('acepto un único hecho útil sin completar datos: %j', async datos => {
    consultarDeepSeek.mockResolvedValue(JSON.stringify(datos));
    const respuesta = await subir();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toEqual(datos);
});
test('rechazo falta de archivo', async () => {
    const respuesta = await request(app).post(ruta);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.codigo).toBe('CARGA_INVALIDA');
});
