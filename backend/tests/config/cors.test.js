jest.mock('../../src/config/firebase-admin', () => ({
    verifyIdToken: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');

describe('CORS del backend', () => {
    test('permite el preflight OPTIONS desde Vercel sin requerir autenticación', async () => {
        const respuesta = await request(app)
            .options('/api/ofertas/estadisticas')
            .set('Origin', 'https://busca-empleos.vercel.app')
            .set('Access-Control-Request-Method', 'GET');

        expect(respuesta.status).toBe(204);
        expect(respuesta.headers['access-control-allow-origin'])
            .toBe('https://busca-empleos.vercel.app');
    });
});