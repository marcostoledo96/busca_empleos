jest.mock('../../src/config/firebase-admin', () => ({
    verifyIdToken: jest.fn(),
}));
jest.mock('../../src/config/base-datos', () => ({
    query: jest.fn(),
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const request = require('supertest');
const firebaseAuth = require('../../src/config/firebase-admin');
const pool = require('../../src/config/base-datos');
const origenAnterior = process.env.CORS_ORIGEN;
// Uso una configuración sintética; no confirma ni asigna el dominio candidato.
process.env.CORS_ORIGEN = 'https://busca-empleos.vercel.app, https://busco-trabajo.vercel.app';
const app = require('../../src/app');

function preflight(origen) {
    return request(app)
        .options('/api/ofertas/estadisticas')
        .set('Origin', origen)
        .set('Access-Control-Request-Method', 'GET');
}

describe('CORS del backend con dos orígenes configurados', () => {
    afterAll(() => {
        if (origenAnterior === undefined) {
            delete process.env.CORS_ORIGEN;
        } else {
            process.env.CORS_ORIGEN = origenAnterior;
        }
    });

    afterEach(() => {
        expect(firebaseAuth.verifyIdToken).not.toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('permite el preflight OPTIONS desde Vercel sin requerir autenticación', async () => {
        const respuesta = await preflight('https://busca-empleos.vercel.app');

        expect(respuesta.status).toBe(204);
        expect(respuesta.text).toBe('');
        expect(respuesta.headers['access-control-allow-origin'])
            .toBe('https://busca-empleos.vercel.app');
    });

    test('permite el candidato solo en la configuración local separada por comas', async () => {
        const respuesta = await preflight('https://busco-trabajo.vercel.app');

        expect(respuesta.status).toBe(204);
        expect(respuesta.text).toBe('');
        expect(respuesta.headers['access-control-allow-origin'])
            .toBe('https://busco-trabajo.vercel.app');
    });

    test('omite ACAO para un origen ajeno y conserva el acceso del origen anterior', async () => {
        const respuesta = await preflight('https://origen-no-autorizado.example');

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();

        const respuestaAnterior = await preflight('https://busca-empleos.vercel.app');
        expect(respuestaAnterior.status).toBe(204);
        expect(respuestaAnterior.text).toBe('');
        expect(respuestaAnterior.headers['access-control-allow-origin'])
            .toBe('https://busca-empleos.vercel.app');
    });
});
