'use strict';

jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ obtenerOfertasPendientes: jest.fn(), actualizarEvaluacion: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({
    crearHashPreferencias: jest.fn(() => 'preferencias'),
    crearHashOferta: jest.fn(() => 'oferta'),
    buscarCache: jest.fn(),
    guardarCache: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/modelos/evaluacion-lote', () => ({ crearLote: jest.fn().mockResolvedValue({ id: 1 }), actualizarProgreso: jest.fn().mockResolvedValue(), finalizarLote: jest.fn().mockResolvedValue() }));

const { consultarDeepSeek } = require('../../src/config/deepseek');
const modeloOferta = require('../../src/modelos/oferta');
const modeloPreferencia = require('../../src/modelos/preferencia');
const cache = require('../../src/modelos/evaluacion-cache');
const { evaluarOferta, evaluarOfertasPendientes } = require('../../src/servicios/servicio-evaluacion');
const preferencias = { zonas_preferidas: ['Buenos Aires'], stack_tecnologico: ['Angular'], modelo_ia: 'simulado' };
const crearOferta = descripcion => ({ id: 1, titulo: 'Frontend Junior', descripcion, modalidad: 'remoto', ubicacion: 'Buenos Aires, Argentina' });
const incidentales = [
    'Somos una empresa líder. No se requiere experiencia previa.',
    'Podrás aprender junto a un senior.',
    'Angular y TypeScript obligatorios; Java deseable, no excluyente.',
    'Inglés avanzado es un plus, no excluyente; trabajamos en español.',
    'Empresa con más de 3 años en el mercado; no requiere experiencia.',
    'Nuestro producto utiliza Java.',
    'No se requiere Java y inglés avanzado',
    'Deseables: Java, inglés avanzado',
    'Somos una empresa líder y buscamos desarrollador junior',
];

beforeEach(() => {
    jest.clearAllMocks();
    cache.buscarCache.mockResolvedValue(null);
    modeloPreferencia.obtenerPreferencias.mockResolvedValue(preferencias);
});

describe('Servicio con reglas reales y proveedor simulado', () => {
    test.each(incidentales.flatMap(descripcion => [true, false].map(match => [descripcion, match])))('consulto IA y respeto respuesta para %s: %s', async (descripcion, match) => {
        consultarDeepSeek.mockResolvedValue(JSON.stringify({ match, porcentaje: match ? 80 : 25, razon: 'Respuesta contextual de IA' }));
        const resultado = await evaluarOferta(crearOferta(descripcion), 'Instrucciones de prueba', 'simulado', preferencias);
        expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect(resultado.match).toBe(match);
        expect(resultado.razon).toBe('Respuesta contextual de IA');
    });

    test.each(['Java obligatorio.', 'Puesto Senior excluyente.', 'Inglés avanzado obligatorio.', 'Al menos 6 años de experiencia obligatorios.', 'Java deseable pero inglés avanzado obligatorio.', 'Aprender junto a senior; Java obligatorio.', 'Buscamos desarrollador Senior que acompañará a juniors', 'Java: deseable, inglés avanzado obligatorio'])('rechazo antes del proveedor: %s', async descripcion => {
        const resultado = await evaluarOferta(crearOferta(descripcion), 'Instrucciones de prueba', 'simulado', preferencias);
        expect(resultado.match).toBe(false);
        expect(resultado.error).toBe(false);
        expect(consultarDeepSeek).not.toHaveBeenCalled();
    });

    test.each([
        ['Aprender junto a senior; Java deseable.', true],
        ['No se requiere Java y inglés avanzado', true],
        ['Deseables: Java, inglés avanzado', true],
        ['Somos una empresa líder y buscamos desarrollador junior', true],
        ['Buscamos desarrollador Senior que acompañará a juniors', false],
        ['Java: deseable, inglés avanzado obligatorio', false],
        ['Java deseable pero inglés avanzado obligatorio.', false],
    ])('revalido aprobación cacheada con las mismas reglas: %s', async (descripcion, aprobada) => {
        modeloOferta.obtenerOfertasPendientes.mockResolvedValue([crearOferta(descripcion)]);
        cache.buscarCache.mockResolvedValue({ match: true, porcentaje: 80, razon: 'Aprobación cacheada' });
        const resultado = await evaluarOfertasPendientes();
        expect(resultado.aprobadas).toBe(aprobada ? 1 : 0);
        expect(resultado.rechazadas).toBe(aprobada ? 0 : 1);
        expect(consultarDeepSeek).not.toHaveBeenCalled();
        expect(cache.guardarCache).not.toHaveBeenCalled();
    });
});
