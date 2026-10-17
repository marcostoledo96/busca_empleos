jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/firebase-admin', () => ({ verifyIdToken: jest.fn() }));
jest.mock('../../src/modelos/preferencia');
jest.mock('../../src/modelos/oferta');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn() }));
// Cargo el worker real con Node: Jest no admite su import() sin flags de VM experimentales.
const path = require('node:path');
const requireNativo = process.getBuiltinModule('module').createRequire(__filename);
globalThis.pdfjsWorker = requireNativo(path.join(path.dirname(require.resolve('pdf-parse')), 'pdf.worker.mjs'));
const request = require('supertest');
const firebase = require('../../src/config/firebase-admin');
const preferencias = require('../../src/modelos/preferencia');
const ofertas = require('../../src/modelos/oferta');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const { crearPdf } = require('../helpers/documento-cv-sintetico');
const { MAX_BYTES_CV_BASE } = require('../../src/utils/validacion-cv-base');
const app = require('../../src/app');
const ruta = '/api/preferencias/importar-cv/extraer-texto';
const subir = (bytes, nombre = 'cv.pdf', mime = 'application/pdf') => request(app).post(ruta)
    .set('Authorization', 'Bearer token-sintetico')
    .attach('cv', bytes, { filename: nombre, contentType: mime });
const errores = {
    formato: [400, 'FORMATO_NO_ADMITIDO', 'Admito únicamente PDF con texto seleccionable o Markdown (.md). Podés pegar el texto manualmente.'],
    carga: [400, 'CARGA_INVALIDA', 'Enviá un único documento en el campo cv. Podés pegar el texto manualmente.'],
    grande: [413, 'DOCUMENTO_DEMASIADO_GRANDE', 'El documento no puede superar 5 MiB. Podés pegar el texto manualmente.'],
    danado: [422, 'DOCUMENTO_INVALIDO', 'El documento está dañado o no coincide con el formato declarado. Podés pegar el texto manualmente.'],
    vacio: [422, 'SIN_TEXTO_EXTRAIBLE', 'No pude recuperar texto del documento. Podés pegarlo manualmente; no realizo OCR.'],
    texto: [422, 'TEXTO_INVALIDO', 'Necesito texto UTF-8 válido sin caracteres de control inválidos. Podés pegar el texto manualmente.'],
    limite: [413, 'TEXTO_DEMASIADO_GRANDE', 'El texto completo supera 1048576 bytes. No lo recorté. Reducí el documento o pegá texto manualmente.'],
    parcial: [422, 'EXTRACCION_INCOMPLETA', 'No pude extraer todas las páginas de forma completa. Podés pegar el texto manualmente.'],
};
function comprobarError(respuesta, tipo) {
    const [estado, codigo, error] = errores[tipo];
    expect(respuesta.status).toBe(estado);
    expect(respuesta.body).toEqual({ exito: false, codigo, error });
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_AUTORIZADO = 'perfil-sintetico@example.invalid';
    firebase.verifyIdToken.mockResolvedValue({ email: process.env.EMAIL_AUTORIZADO });
});
afterEach(() => {
    expect(consultarDeepSeek).not.toHaveBeenCalled();
    // Ninguna lectura/escritura de perfil, ofertas, postulaciones o notas pertenece a la extracción.
    Object.values(preferencias).filter(jest.isMockFunction).forEach(funcion => expect(funcion).not.toHaveBeenCalled());
    Object.values(ofertas).filter(jest.isMockFunction).forEach(funcion => expect(funcion).not.toHaveBeenCalled());
    jest.restoreAllMocks();
});

test('extraigo todas las páginas reales sin perder nombre, experiencia, educación ni idiomas', async () => {
    const paginas = ['Nombre: Persona Sintetica', 'Experiencia: QA 2024-2025', 'Educacion: Universidad Sintetica', 'Idiomas: Ingles B1'];
    const { PDFParse } = require('pdf-parse');
    const extraer = jest.spyOn(PDFParse.prototype, 'getText');
    const respuesta = await subir(crearPdf(paginas));
    if (extraer.mock.results[0]) await extraer.mock.results[0].value;
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ exito: true, datos: { texto: paginas.join('\n\n'), formato: 'pdf' } });
});
test('previsualizo Markdown UTF-8 completo sin consumir IA ni normalizar sus espacios', async () => {
    const texto = '\uFEFF# CV sintético\r\n\nEducación e idiomas\n  FIN  ';
    const respuesta = await subir(Buffer.from(texto), 'CV.MD', 'text/markdown');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ exito: true, datos: { texto, formato: 'md' } });
});
test.each(['text/plain', 'application/octet-stream'])('conservo MIME habitual de Markdown: %s', async mime => {
    const respuesta = await subir(Buffer.from('# CV'), 'cv.md', mime);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ exito: true, datos: { texto: '# CV', formato: 'md' } });
});
test('admito MIME genérico de PDF cuando su contenido es PDF real', async () => {
    const respuesta = await subir(crearPdf(), 'CV.PDF', 'application/octet-stream');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toEqual({ texto: 'Nombre: Persona Sintetica', formato: 'pdf' });
});
test.each([
    [Buffer.from(''), 'cv.md', 'text/plain', 'vacio'],
    [Buffer.from(' \r\n\t'), 'cv.md', 'text/plain', 'vacio'],
    [Buffer.from(''), 'cv.pdf', 'application/pdf', 'vacio'],
    [crearPdf(['', '']), 'cv.pdf', 'application/pdf', 'vacio'],
    [Buffer.from('%PDF-1.7\ncontenido corrupto\n%%EOF'), 'cv.pdf', 'application/pdf', 'danado'],
    [Buffer.from('No es un PDF'), 'cv.pdf', 'application/pdf', 'danado'],
    [crearPdf(), 'cv.md', 'text/markdown', 'danado'],
    [Buffer.from([0x50, 0x4b, 3, 4, 0, 0]), 'cv.md', 'text/plain', 'texto'],
    [Buffer.from([0xc3, 0x28]), 'cv.md', 'text/plain', 'texto'],
    [Buffer.from('a\0b'), 'cv.md', 'text/plain', 'texto'],
    [Buffer.from('a\u0001b'), 'cv.md', 'text/plain', 'texto'],
    [Buffer.from('# CV'), 'cv.docx', 'application/octet-stream', 'formato'],
    [crearPdf(), 'cv.pdf', 'text/plain', 'formato'],
    [Buffer.from('# CV'), 'cv.md', 'application/pdf', 'formato'],
    [Buffer.alloc(5 * 1024 * 1024 + 1, 65), 'cv.pdf', 'application/pdf', 'grande'],
    [Buffer.from('á'.repeat(MAX_BYTES_CV_BASE / 2) + 'x'), 'cv.md', 'text/plain', 'limite'],
])('rechazo documento inválido %# sin devolver texto parcial', async (bytes, nombre, mime, tipo) => {
    comprobarError(await subir(bytes, nombre, mime), tipo);
});
test.each([
    ['referencia inexistente', '/Contents 7 0 R', '/Contents 9 0 R'],
    ['operador dañado', '(Idiomas: Ingles B2) Tj', '(Idiomas: Ingles B2) Qq'],
    ['literal incompleto', '(Idiomas: Ingles B2) Tj', '(Idiomas: Ingles B2  Tj'],
])('B1: rechazo pérdida de la segunda página por %s sin éxito parcial', async (caso, original, reemplazo) => {
    const { PDFParse } = require('pdf-parse');
    const extraer = jest.spyOn(PDFParse.prototype, 'getText');
    const destruir = jest.spyOn(PDFParse.prototype, 'destroy');
    const fuente = crearPdf(['Nombre: Eva Verificadora', 'Idiomas: Ingles B2']).toString();
    expect(fuente).toContain(original);
    const respuesta = await subir(Buffer.from(fuente.replace(original, reemplazo)));
    // Ejecuto el parser real: conserva dos páginas, pero pierde íntegramente Idiomas.
    const resultado = await extraer.mock.results[0].value;
    expect(resultado.total).toBe(2);
    expect(resultado.pages.map(pagina => pagina.text.trim())).toEqual(['Nombre: Eva Verificadora', '']);
    expect(destruir).toHaveBeenCalledTimes(1);
    comprobarError(respuesta, 'parcial');
});
test.each([
    ['Nombre: Persona Sintetica', ''],
    ['', 'Nombre: Persona Sintetica'],
].map(paginas => [paginas]))('rechazo conservadoramente PDF mixto con página vacía %#', async paginas => {
    comprobarError(await subir(crearPdf(paginas)), 'parcial');
});
test('rechazo PDF truncado aunque conserve la primera página legible', async () => {
    const pdf = crearPdf(['Nombre', 'Experiencia', 'Educacion', 'Idiomas']);
    comprobarError(await subir(pdf.subarray(0, pdf.length - 80)), 'danado');
});
test('acepto exactamente 5 MiB binarios de un PDF real con relleno posterior válido', async () => {
    const pdf = crearPdf();
    const respuesta = await subir(Buffer.concat([Buffer.alloc(5 * 1024 * 1024 - pdf.length, 32), pdf]));
    // El encabezado tiene que estar al inicio: relleno previo no es un PDF admitido.
    comprobarError(respuesta, 'danado');
    // Uso el PDF original y comentarios finales; los offsets originales se conservan.
    const valido = Buffer.concat([pdf, Buffer.from('%' + ' '.repeat(5 * 1024 * 1024 - pdf.length - 1))]);
    expect(valido.length).toBe(5 * 1024 * 1024);
    const aceptada = await subir(valido);
    expect(aceptada.status).toBe(200);
    expect(aceptada.body.datos.texto).toBe('Nombre: Persona Sintetica');
});
test('conservo exactamente el límite de texto vigente en bytes UTF-8', async () => {
    const texto = 'á'.repeat(MAX_BYTES_CV_BASE / 2);
    const respuesta = await subir(Buffer.from(texto), 'cv.md', 'text/plain');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.texto).toBe(texto);
});
test('rechazo texto excesivo de PDF real sin devolver una extracción truncada', async () => {
    const { PDFParse } = require('pdf-parse');
    const extraer = jest.spyOn(PDFParse.prototype, 'getText');
    const pagina = Array(50).fill('a'.repeat(75)).join('\n');
    const paginas = Array(Math.ceil((MAX_BYTES_CV_BASE + 1) / (75 * 50))).fill(pagina);
    paginas.push('FIN_DOCUMENTO_SINTETICO');
    const pdf = crearPdf(paginas);
    expect(pdf.length).toBeLessThan(5 * 1024 * 1024);
    const respuesta = await subir(pdf);
    expect(extraer).toHaveBeenCalledTimes(1);
    // El espía ejecuta la biblioteca real: pruebo que recuperó todo antes de validar el rechazo HTTP.
    const resultado = await extraer.mock.results[0].value;
    expect(resultado.total).toBe(paginas.length);
    expect(resultado.pages.map(paginaExtraida => paginaExtraida.text.trim())).toEqual(paginas);
    expect(Buffer.byteLength(resultado.pages.map(paginaExtraida => paginaExtraida.text).join('\n\n')))
        .toBeGreaterThan(MAX_BYTES_CV_BASE);
    comprobarError(respuesta, 'limite');
}, 30000);
test('rechazo falta de archivo y campos/archivos adicionales', async () => {
    comprobarError(await request(app).post(ruta).set('Authorization', 'Bearer token-sintetico'), 'carga');
    comprobarError(await request(app).post(ruta).set('Authorization', 'Bearer token-sintetico')
        .attach('otro', crearPdf(), 'cv.pdf'), 'carga');
    comprobarError(await subir(crearPdf()).attach('cv', crearPdf(), 'otro.pdf'), 'carga');
});
test('fallo cerrado si faltan páginas y destruyo el lector sin registrar contenido privado', async () => {
    const { PDFParse } = require('pdf-parse');
    jest.spyOn(PDFParse.prototype, 'getText').mockResolvedValueOnce({ total: 2, pages: [{ num: 1, text: 'PRIVADO' }] });
    const destruir = jest.spyOn(PDFParse.prototype, 'destroy');
    const registrar = jest.spyOn(console, 'error').mockImplementation(() => {});
    comprobarError(await subir(crearPdf()), 'parcial');
    expect(destruir).toHaveBeenCalledTimes(1);
    expect(registrar).not.toHaveBeenCalled();
});
test('descarto páginas parciales ante fallo del parser y libero el lector', async () => {
    const { PDFParse } = require('pdf-parse');
    jest.spyOn(PDFParse.prototype, 'getText').mockRejectedValueOnce(new Error('PRIVADO'));
    const destruir = jest.spyOn(PDFParse.prototype, 'destroy');
    comprobarError(await subir(crearPdf()), 'danado');
    expect(destruir).toHaveBeenCalledTimes(1);
});
test('exijo autenticación Firebase antes de cargar documentos', async () => {
    const respuesta = await request(app).post(ruta).attach('cv', Buffer.alloc(10), 'cv.docx');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ exito: false, error: 'No autorizado. Se requiere un token de autenticación.' });
    expect(firebase.verifyIdToken).not.toHaveBeenCalled();
});
test('rechazo token inválido y usuario no autorizado', async () => {
    firebase.verifyIdToken.mockRejectedValueOnce(new Error('Token sintético inválido'));
    const invalida = await subir(crearPdf());
    expect(invalida.status).toBe(401);
    expect(invalida.body).toEqual({ exito: false, error: 'Token de autenticación inválido.' });
    firebase.verifyIdToken.mockResolvedValueOnce({ email: 'otro@example.invalid' });
    const ajena = await subir(crearPdf());
    expect(ajena.status).toBe(403);
    expect(ajena.body).toEqual({ exito: false, error: 'Acceso denegado. Este sistema es de uso personal.' });
});
