jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => req.headers.authorization === 'Bearer prueba'
        ? next() : res.status(401).json({ exito: false }),
}));
jest.mock('../../src/controladores/controlador-scraping', () => ({
    previsualizarBusquedas: (req, res) => res.json({ exito: true, datos: { plataformas: [] } }),
}));
jest.mock('../../src/controladores/controlador-evaluacion', () => ({}));
jest.mock('../../src/controladores/controlador-automatizacion', () => ({}));
jest.mock('../../src/controladores/controlador-preferencias', () => ({}));
jest.mock('../../src/rutas/scraping', () => {
    const router = require('express').Router();
    router.get('/previsualizacion', require('../../src/controladores/controlador-scraping').previsualizarBusquedas);
    router.post('/linkedin', (req, res) => res.json({ exito: true }));
    return router;
});
for (const ruta of ['ofertas', 'evaluacion', 'automatizacion', 'preferencias', 'cv-base']) {
    jest.mock(`../../src/rutas/${ruta}`, () => require('express').Router());
}

const request = require('supertest');
let app;

beforeEach(() => {
    const ambiente = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
        jest.isolateModules(() => {
            // Completo los handlers de lectura sin cargar Firebase ni servicios externos.
            const lectura = (req, res) => res.json({ exito: true });
            Object.assign(require('../../src/controladores/controlador-evaluacion'), {
                obtenerProgresoEvaluacion: lectura, cancelarEvaluacion: lectura,
            });
            Object.assign(require('../../src/controladores/controlador-automatizacion'), {
                obtenerProgreso: lectura, obtenerEstado: lectura,
            });
            Object.assign(require('../../src/controladores/controlador-preferencias'), { analizarCvMarkdown: lectura });
            require('../../src/rutas/preferencias').recibirCv = (req, res, next) => next();
            app = require('../../src/app');
        });
    } finally {
        process.env.NODE_ENV = ambiente;
    }
});
const pedir = (metodo, ruta) => request(app)[metodo](ruta).set('Authorization', 'Bearer prueba');

test('preview inicial y por ejecución no agotan cinco operaciones costosas; la sexta sigue bloqueada', async () => {
    expect((await pedir('get', '/api/scraping/previsualizacion')).status).toBe(200);
    for (let ejecucion = 0; ejecucion < 2; ejecucion++) {
        expect((await pedir('get', '/api/scraping/previsualizacion')).status).toBe(200);
        expect((await pedir('post', '/api/scraping/linkedin')).status).toBe(200);
    }
    for (let ejecucion = 2; ejecucion < 5; ejecucion++) {
        expect((await pedir('post', '/api/scraping/linkedin')).status).toBe(200);
    }
    expect((await pedir('post', '/api/scraping/linkedin')).status).toBe(429);
    expect((await pedir('get', '/api/scraping/previsualizacion')).status).toBe(200);
    expect((await request(app).get('/api/scraping/previsualizacion')).status).toBe(401);
});

test('la excepción exige GET y el path exacto, sin liberar variantes ni otras rutas', async () => {
    for (let ejecucion = 0; ejecucion < 5; ejecucion++) {
        expect((await pedir('post', '/api/scraping/linkedin')).status).toBe(200);
    }
    for (const [metodo, ruta] of [
        ['post', '/api/scraping/previsualizacion'],
        ['head', '/api/scraping/previsualizacion'],
        ['get', '/api/scraping/previsualizacion/'],
        ['get', '/api/scraping/PREVISUALIZACION'],
        ['get', '/api/scraping/otra'],
    ]) {
        expect((await pedir(metodo, ruta)).status).toBe(429);
    }
});
