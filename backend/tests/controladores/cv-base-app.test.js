jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/firebase-admin', () => ({ verifyIdToken: jest.fn() }));
const request = require('supertest');
const pool = require('../../src/config/base-datos');
const auth = require('../../src/config/firebase-admin');
const app = require('../../src/app');

beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_AUTORIZADO = 'sintetico@example.invalid';
    auth.verifyIdToken.mockResolvedValue({ email: process.env.EMAIL_AUTORIZADO });
});

test.each(['get', 'put'])('protejo %s con auth global antes de persistencia', async metodo => {
    expect((await request(app)[metodo]('/api/preferencias/cv-base')).status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
});

test('rechazo usuario distinto y token inválido', async () => {
    auth.verifyIdToken.mockResolvedValueOnce({ email: 'otro@example.invalid' });
    expect((await request(app).get('/api/preferencias/cv-base').auth('sintetico', { type: 'bearer' })).status).toBe(403);
    auth.verifyIdToken.mockRejectedValueOnce(new Error('Token sintético inválido'));
    expect((await request(app).get('/api/preferencias/cv-base').auth('sintetico', { type: 'bearer' })).status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
});

test('el parser raw precede JSON sin aceptar JSON como fuente', async () => {
    const respuesta = await request(app).put('/api/preferencias/cv-base')
        .auth('sintetico', { type: 'bearer' }).send({ cv_base: 'no admitido' });
    expect(respuesta.status).toBe(415);
    expect(pool.query).not.toHaveBeenCalled();
});

test('guardo sólo fuente con una consulta sin acciones de evaluación', async () => {
    pool.query.mockResolvedValue({ rows: [{ cv_base: '# Sintético', cv_base_actualizado_en: new Date() }] });
    const respuesta = await request(app).put('/api/preferencias/cv-base')
        .auth('sintetico', { type: 'bearer' }).set('Content-Type', 'text/markdown').send('# Sintético');
    expect(respuesta.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO cv_base');
});
