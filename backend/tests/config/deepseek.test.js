jest.mock('dotenv', () => ({ config: jest.fn() }));
process.env.DEEPSEEK_API_KEY = 'clave-sintetica-de-prueba';
const { consultarDeepSeek } = require('../../src/config/deepseek');

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch');
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('detecto truncamiento únicamente en importación y no cambio modelo ni salida', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({
        choices: [{ finish_reason: 'length', message: { content: '{}' } }],
    }) });
    await expect(consultarDeepSeek('Sistema', 'CV sintético', 'deepseek-v4-pro', { importacionCv: true }))
        .rejects.toMatchObject({ codigo: 'SALIDA_TRUNCADA' });
    await expect(consultarDeepSeek('Sistema', 'Oferta', 'deepseek-v4-flash')).resolves.toBe('{}');
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo.model).toBe('deepseek-v4-pro');
    expect(cuerpo.max_tokens).toBeUndefined();
});
test('no divulgo respuesta privada del proveedor en logs de reintento de importación', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'CV_PRIVADO', headers: { get: () => null } });
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const resultado = consultarDeepSeek('Sistema', 'CV sintético', undefined, { importacionCv: true });
    const verificacion = expect(resultado).rejects.not.toThrow('CV_PRIVADO');
    await jest.runAllTimersAsync();
    await verificacion;
    expect(JSON.stringify(aviso.mock.calls)).not.toContain('CV_PRIVADO');
});
test.each(['content_filter', 'tool_calls', 'desconocido', null, undefined])('rechazo finalización no segura de importación: %s', async motivo => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({
        choices: [{ finish_reason: motivo, message: { content: '{"nombre":null}' } }],
    }) });
    await expect(consultarDeepSeek('Sistema', 'CV sintético', undefined, { importacionCv: true }))
        .rejects.toMatchObject({ codigo: 'SALIDA_INCOMPLETA' });
    await expect(consultarDeepSeek('Sistema', 'Oferta')).resolves.toBe('{"nombre":null}');
});

test('devuelvo contenido completo en importación sin alterar opciones globales', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({
        choices: [{ finish_reason: 'stop', message: { content: '{"nombre":null}' } }],
    }) });
    await expect(consultarDeepSeek('Sistema', 'CV sintético', undefined, { importacionCv: true })).resolves.toBe('{"nombre":null}');
});
