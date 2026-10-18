jest.mock('dotenv', () => ({ config: jest.fn() }));
process.env.DEEPSEEK_API_KEY = 'clave-sintetica-de-prueba';
const { consultarDeepSeek } = require('../../src/config/deepseek');

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch');
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

function responder(content = '{}', finish_reason = 'stop', extras = {}) {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({
        choices: [{ finish_reason, message: { content, reasoning_content: 'RAZONAMIENTO_PRIVADO' } }], ...extras,
    }) });
}

test.each([
    ['deepseek-v4-flash', false, 'deepseek-flash', 4096],
    ['deepseek-flash', false, 'deepseek-flash', 4096],
    ['deepseek-v4-pro', false, 'deepseek-v4-pro', 4096],
    ['deepseek-v4-pro', true, 'deepseek-v4-pro', 16384],
    ['deepseek-flash', true, 'deepseek-flash', 16384],
])('envío configuración explícita de %s, importación %s', async (modelo, importacionCv, efectivo, tokens) => {
    responder('{"nombre":null}');
    await expect(consultarDeepSeek('Devolvé JSON', 'Texto sintético', modelo, { importacionCv })).resolves.toBe('{"nombre":null}');
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo).toEqual({ model: efectivo, messages: [
        { role: 'system', content: 'Devolvé JSON' }, { role: 'user', content: 'Texto sintético' },
    ], thinking: { type: 'enabled' }, reasoning_effort: 'low', response_format: { type: 'json_object' }, max_tokens: tokens });
});

test.each([false, true])('rechazo truncamiento en ambas tareas: %s', async importacionCv => {
    responder('{}', 'length');
    await expect(consultarDeepSeek('JSON', 'Texto', undefined, { importacionCv })).rejects.toMatchObject({ codigo: 'SALIDA_TRUNCADA' });
});

test.each(['content_filter', 'tool_calls', 'desconocido', null, undefined])('rechazo finalización no segura: %s', async motivo => {
    responder('{}', 'stop', { choices: [{ finish_reason: motivo, message: { content: '{}' } }] });
    await expect(consultarDeepSeek('JSON', 'Texto')).rejects.toMatchObject({ codigo: 'SALIDA_INCOMPLETA' });
});

test.each([undefined, [], null])('rechazo choices ausente o vacío: %s', async choices => {
    responder('{}', 'stop', { choices });
    await expect(consultarDeepSeek('JSON', 'Texto')).rejects.toMatchObject({ codigo: 'SALIDA_INCOMPLETA' });
});

test.each(['', '  ', null, 12, undefined])('rechazo contenido no textual o vacío: %s', async content => {
    responder('{}', 'stop', { choices: [{ finish_reason: 'stop', message: { content } }] });
    await expect(consultarDeepSeek('JSON', 'Texto')).rejects.toMatchObject({ codigo: 'SALIDA_INCOMPLETA' });
});

test.each(['{', '[]', 'null', 'true', '```json\n{}\n```'])('exijo un objeto JSON completo: %s', async content => {
    responder(content);
    await expect(consultarDeepSeek('JSON', 'Texto')).rejects.toMatchObject({ codigo: 'JSON_INVALIDO' });
});

test('devuelvo metadatos seguros opcionales sin cambiar el retorno de texto', async () => {
    responder('{"nombre":null}', 'stop', { model: 'modelo-reportado', usage: {
        prompt_tokens: 100, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 20 }, privado: 'CV_PRIVADO',
    } });
    const alRecibirMetadatos = jest.fn();
    await expect(consultarDeepSeek('JSON PRIVADO', 'CV_PRIVADO', 'deepseek-v4-flash', { alRecibirMetadatos })).resolves.toBe('{"nombre":null}');
    expect(alRecibirMetadatos).toHaveBeenCalledWith({ modelo_solicitado: 'deepseek-flash', modelo_reportado: 'modelo-reportado',
        finish_reason: 'stop', duracion_ms: expect.any(Number), tokens_entrada: 100, tokens_salida: 30, tokens_razonamiento: 20 });
    expect(JSON.stringify(alRecibirMetadatos.mock.calls)).not.toMatch(/PRIVADO|Bearer/);
});

test('no invento metadatos ausentes', async () => {
    responder();
    const alRecibirMetadatos = jest.fn();
    await consultarDeepSeek('JSON', 'Texto', undefined, { alRecibirMetadatos });
    expect(alRecibirMetadatos).toHaveBeenCalledWith({ modelo_solicitado: 'deepseek-flash', finish_reason: 'stop', duracion_ms: expect.any(Number) });
});

test.each([false, true])('no divulgo respuesta privada HTTP ni reintento errores permanentes, importación %s', async importacionCv => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'CV_PRIVADO', headers: { get: () => null } });
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const verificacion = expect(consultarDeepSeek('JSON', 'Texto', undefined, { importacionCv })).rejects.not.toThrow('CV_PRIVADO');
    await jest.runAllTimersAsync();
    await verificacion;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(aviso.mock.calls)).not.toContain('CV_PRIVADO');
});

test.each([429, 503])('reintento HTTP transitorio %s respetando Retry-After', async status => {
    responder();
    const respuestaValida = global.fetch.getMockImplementation();
    global.fetch.mockReset().mockResolvedValueOnce({ ok: false, status, headers: { get: () => '1' } }).mockImplementation(respuestaValida);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const promesa = consultarDeepSeek('JSON', 'Texto');
    await jest.advanceTimersByTimeAsync(999);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(promesa).resolves.toBe('{}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
});

test.each([[false, 60000], [true, 120000]])('timeout incluye lectura del cuerpo aunque ya llegaron headers: %s', async (importacionCv, timeout) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch.mockImplementation(async (url, { signal }) => ({ ok: true, json: () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('CUERPO_PRIVADO'), { name: 'AbortError' })));
    }) }));
    const resultado = consultarDeepSeek('JSON', 'Texto', undefined, { importacionCv });
    const verificacion = expect(resultado).rejects.toThrow(/timeout/i);
    await jest.advanceTimersByTimeAsync(timeout - 1);
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    await jest.runAllTimersAsync();
    await verificacion;
    expect(global.fetch).toHaveBeenCalledTimes(4);
});

test('JSON inválido en el sobre es técnico, sin reintentar ni divulgar el cuerpo', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('CUERPO_PRIVADO'); } });
    await expect(consultarDeepSeek('JSON', 'Texto')).rejects.toMatchObject({ codigo: 'JSON_INVALIDO', message: 'DeepSeek no devolvió JSON válido.' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([[false, 60000], [true, 120000]])('timeout acotado por tarea: %s', async (importacionCv, timeout) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Timeout sintético')));
    }));
    const verificacion = expect(consultarDeepSeek('JSON', 'Texto', undefined, { importacionCv })).rejects.toThrow(/timeout/i);
    await jest.advanceTimersByTimeAsync(timeout - 1);
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await jest.runAllTimersAsync();
    await verificacion;
    expect(global.fetch).toHaveBeenCalledTimes(4);
});
