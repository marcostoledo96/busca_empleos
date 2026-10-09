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
    'Buscamos desarrollador junior para nuestro equipo senior',
    'Junior developer for our senior team',
    'Requirements:\n- Java optional\n- Angular',
    'Buscamos desarrollador junior en una empresa con 5+ años de experiencia',
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

    test.each([['Java', false], ['Java deseable', true], ['Nuestro producto utiliza Java', true]])('evalúo campo requirements real: %s', async (requirements, aprobada) => {
        consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 90, razon: 'Aprobación simulada' }));
        const oferta = { ...crearOferta('Angular'), datos_crudos: { requirements } };
        const resultado = await evaluarOferta(oferta, 'Instrucciones de prueba', 'simulado', preferencias);
        expect(resultado.match).toBe(aprobada);
        expect(consultarDeepSeek).toHaveBeenCalledTimes(aprobada ? 1 : 0);
    });

    test.each(['Requirements:\n- Java\n- Angular', '<h2>Requirements:</h2><ul><li>Java</li></ul>', 'Requisitos obligatorios:\n• Java', '<h2>Requisitos obligatorios</h2><ul><li>Java</li></ul>', 'Senior developer for our junior team', 'Empresa con 5+ años de experiencia y candidato con al menos 6 años de experiencia obligatorios', 'Java deseable y se requiere inglés avanzado', 'Java deseable, se requiere inglés avanzado', 'No se requiere Java y se exige inglés avanzado', 'Java obligatorio con inglés avanzado deseable', 'Requisitos obligatorios:<ul><li>Java</li></ul>', 'Requisitos obligatorios:\n- Java\n- Angular', 'Java obligatorio.', 'Puesto Senior excluyente.', 'Inglés avanzado obligatorio.', 'Al menos 6 años de experiencia obligatorios.', 'Java deseable pero inglés avanzado obligatorio.', 'Aprender junto a senior; Java obligatorio.', 'Buscamos desarrollador Senior que acompañará a juniors', 'Java: deseable, inglés avanzado obligatorio'])('rechazo antes del proveedor: %s', async descripcion => {
        consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 90, razon: 'Intento aprobar' }));
        const resultado = await evaluarOferta(crearOferta(descripcion), 'Instrucciones de prueba', 'simulado', preferencias);
        expect(resultado.match).toBe(false);
        expect(resultado.error).toBe(false);
        expect(consultarDeepSeek).not.toHaveBeenCalled();
    });

    test.each([
        ['Junior developer for our senior team', true],
        ['Senior developer for our junior team', false],
        ['Requirements:\n- Java\n- Angular', false],
        ['<h2>Requirements:</h2><ul><li>Java</li></ul>', false],
        ['Requisitos obligatorios:\n• Java', false],
        ['<h2>Requisitos obligatorios</h2><ul><li>Java</li></ul>', false],
        ['Requirements:\n- Java optional\n- Angular', true],
        ['Buscamos desarrollador junior para nuestro equipo senior', true],
        ['Buscamos desarrollador junior en una empresa con 5+ años de experiencia', true],
        ['Java deseable y se requiere inglés avanzado', false],
        ['Requisitos obligatorios:<ul><li>Java</li></ul>', false],
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
