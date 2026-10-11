jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const express = require('express');
const request = require('supertest');
const pool = require('../../src/config/base-datos');
const rutas = require('../../src/rutas/cv-base');
const app = express();
app.use('/api/preferencias/cv-base', rutas);

beforeEach(() => jest.clearAllMocks());

test('distingo ausencia de documento vacío guardado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await request(app).get('/api/preferencias/cv-base')).body).toEqual({
        exito: true, datos: { cv_base: null, cv_base_actualizado_en: null },
    });
    pool.query.mockResolvedValueOnce({ rows: [{ cv_base: '', cv_base_actualizado_en: '2026-01-01T00:00:00.000Z' }] });
    expect((await request(app).put('/api/preferencias/cv-base').set('Content-Type', 'text/markdown').send('')).body.datos.cv_base).toBe('');
});

test.each(['text/plain', 'text/markdown; charset=UTF-8'])('guardo Markdown exacto con %s y fecha de BD', async tipo => {
    const texto = '\uFEFF# CV sintético\r\n\n  ñ 😀\t\n';
    const fecha = new Date('2026-01-01T00:00:00Z');
    pool.query.mockResolvedValue({ rows: [{ cv_base: texto, cv_base_actualizado_en: fecha }] });
    const respuesta = await request(app).put('/api/preferencias/cv-base').set('Content-Type', tipo).send(texto);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos).toEqual({ cv_base: texto, cv_base_actualizado_en: fecha.toISOString() });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([texto]);
});

test('acepto 1048576 bytes multibyte y rechazo el byte siguiente', async () => {
    const texto = 'ñ'.repeat(524288);
    pool.query.mockResolvedValue({ rows: [{ cv_base: texto, cv_base_actualizado_en: new Date() }] });
    expect((await request(app).put('/api/preferencias/cv-base').set('Content-Type', 'text/plain').send(texto)).status).toBe(200);
    pool.query.mockClear();
    expect((await request(app).put('/api/preferencias/cv-base').set('Content-Type', 'text/plain').send(`${texto}a`)).status).toBe(413);
    expect(pool.query).not.toHaveBeenCalled();
});

test.each(['application/json', 'application/octet-stream', 'text/plain; charset=latin1', 'text/html'])('rechazo tipo %s sin consultar BD', async tipo => {
    expect((await request(app).put('/api/preferencias/cv-base').set('Content-Type', tipo).send('abc')).status).toBe(415);
    expect(pool.query).not.toHaveBeenCalled();
});

test.each([Buffer.from([0xc3, 0x28]), Buffer.from('a\0b')])('rechazo UTF-8 inválido o NUL', async bytes => {
    expect((await request(app).put('/api/preferencias/cv-base').set('Content-Type', 'text/plain').send(bytes)).status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
});

test('no divulgo ni registro errores de persistencia', async () => {
    const registro = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockRejectedValue(new Error('contenido privado sintético'));
    const respuesta = await request(app).put('/api/preferencias/cv-base').set('Content-Type', 'text/plain').send('CV');
    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(respuesta.body)).not.toContain('privado');
    expect(registro).not.toHaveBeenCalled();
    registro.mockRestore();
});
