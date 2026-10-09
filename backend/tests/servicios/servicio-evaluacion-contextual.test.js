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
    'Somos una empresa líder en salud. Buscamos alguien sin experiencia.',
    'Vas a aprender junto a nuestro desarrollador senior.',
    'Aprenderás junto a nuestro desarrollador senior',
    'Angular y TypeScript obligatorios. Java deseable, no excluyente.',
    'Inglés avanzado es un plus, no excluyente. Toda la comunicación se realiza en español.',
    'Empresa con más de 3 años en el mercado. No se requiere experiencia.',
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

const casosAuditoria = [
    ...['opcional', 'no excluyente', 'no es obligatorio', 'not required'].flatMap(sufijo => [
        [crearOferta(`Conocimientos en Java y Spring Boot ${sufijo}`), false],
        [crearOferta(`Conocimientos en Java obligatorios y Spring Boot ${sufijo}`), true],
    ]),
    ...['aunque', 'en cambio', 'mientras que', 'pero', 'but', 'sin embargo'].flatMap(contraste => [
        [crearOferta(`Conocimientos en Java y Spring Boot, ${contraste} Hibernate es deseable`), true],
        [crearOferta(`Conocimientos en Java y Spring Boot deseables, ${contraste} inglés avanzado obligatorio`), true],
        [crearOferta(`Java deseable, ${contraste} conocimientos en Hibernate`), true],
    ]),
    ...['Deseables', 'Opcionales', 'Obligatorios'].flatMap(encabezado => [
        `${encabezado}\nConocimientos en Java`,
        `<h2>${encabezado}</h2><p>Conocimientos en Java</p>`,
        `<h2>${encabezado}</h2><p>Nuestro producto utiliza Java</p>`,
        `${encabezado}\nNuestro producto utiliza Java\nConocimientos en Java`,
    ].map((descripcion, indice) => [crearOferta(descripcion), indice === 2 ? false : indice === 3 || encabezado === 'Obligatorios'])),

    ...['Conocimientos en', 'Conocimientos de', 'Experiencia en'].flatMap(prefijo =>
        [' y ', ', ', ' e '].flatMap(separador => ['deseables', 'opcionales', 'es un plus'].map(sufijo => [
            crearOferta(`${prefijo} Java${separador}Spring Boot ${sufijo}`), false,
        ]))),
    ...[
        'Conocimientos de Java, Hibernate deseables',
        'Conocimientos en Java, Hibernate y Spring Boot deseables',
        'Conocimientos en Java y Spring Boot deseable',
        'No se requiere Java y Spring Boot es un plus',
        'Java deseable y no se requiere Spring Boot',
    ].map(descripcion => [crearOferta(descripcion), false]),
    ...['deseables', 'obligatorios'].flatMap(tipo => [
        `Requisitos ${tipo}:\nConocimientos en Java`,
        `<h2>Requisitos ${tipo}</h2><p>Conocimientos de Java</p>`,
        `<h2>Requisitos ${tipo}</h2><ul><li>Conocimientos en Java</li></ul>`,
    ].map(descripcion => [crearOferta(descripcion), tipo === 'obligatorios'])),
    ...[
        'Conocimientos en Java obligatorios y Spring Boot deseable',
        'Java deseable y es obligatorio inglés avanzado',
        'Conocimientos en Java y Spring Boot deseables y es obligatorio inglés avanzado',
        'Conocimientos en Java y Spring Boot deseables, inglés avanzado obligatorio',
        'Conocimientos en Java y Spring Boot',
        'Es obligatorio inglés avanzado, conocimientos en Java y Spring Boot deseables',
        'Conocimientos en Java obligatorios, Hibernate y Spring Boot deseables',
    ].map(descripcion => [crearOferta(descripcion), true]),
    ...['Nuestro producto utiliza Java', 'Nuestro equipo utiliza Java', 'Nuestra empresa utiliza Java', 'Aprenderás junto a nuestro desarrollador senior'].flatMap(narrativa => [
        [crearOferta(`Requisitos deseables:\n${narrativa}\nConocimientos en Java`), true],
        [crearOferta(`Requisitos deseables:\n${narrativa}\nRequisitos deseables:\nConocimientos en Java`), false],
        [crearOferta(`Requisitos obligatorios:\n${narrativa}`), false],
    ]),
    ...['requirements', 'requisitos'].map(campo => [
        { ...crearOferta(''), datos_crudos: { [campo]: 'Requisitos deseables:\nNuestro producto utiliza Java\nConocimientos en Java' } }, true,
    ]),
];

const casosEstado = [
    ...casosAuditoria,
    [crearOferta('Requisitos obligatorios:\nJava es la tecnología de nuestro producto'), false],
    ...['requirements', 'requisitos'].flatMap(campo => [
        'Requisitos deseables:\nNuestro producto utiliza Java\nJava',
        'Requisitos deseables:\nAngular\nTypeScript es la tecnología de nuestro producto\nJava',
    ].map(texto => [{ ...crearOferta(''), datos_crudos: { [campo]: texto } }, false])),
    ...[2, 3, 6].flatMap(empresa => [2, 3, 6].flatMap(candidato => ['considera obligatorio', 'es obligatorio tener'].map(condicion => [
        crearOferta(`Empresa con ${empresa}+ años de trayectoria ${condicion} ${candidato}+ años de experiencia`), candidato >= 3,
    ]))),
];

describe('Servicio y cache con estado narrativo real', () => {
    test.each(casosEstado.flatMap(([oferta, excluida]) => [true, false].map(match => [oferta, excluida, match])))('respeto reglas y respuesta para %j: %s/%s', async (oferta, excluida, match) => {
        consultarDeepSeek.mockResolvedValue(JSON.stringify({ match, porcentaje: match ? 80 : 25, razon: 'Respuesta simulada' }));
        const resultado = await evaluarOferta(oferta, 'Prueba', 'simulado', preferencias);
        expect(resultado.match).toBe(excluida ? false : match);
        expect(consultarDeepSeek).toHaveBeenCalledTimes(excluida ? 0 : 1);
        if (!excluida) expect(resultado.razon).toBe('Respuesta simulada');
    });
    test.each(casosEstado)('revalido cache para %j: %s', async (oferta, excluida) => {
        modeloOferta.obtenerOfertasPendientes.mockResolvedValue([oferta]);
        cache.buscarCache.mockResolvedValue({ match: true, porcentaje: 80, razon: 'Cache' });
        const resultado = await evaluarOfertasPendientes();
        expect(resultado.aprobadas).toBe(excluida ? 0 : 1);
        expect(resultado.rechazadas).toBe(excluida ? 1 : 0);
        expect(consultarDeepSeek).not.toHaveBeenCalled();
        expect(cache.guardarCache).not.toHaveBeenCalled();
    });
});

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

    test.each(['Java deseable y es obligatorio inglés avanzado', 'Java obligatorio, preferentemente inglés avanzado', '<h2>Requisitos obligatorios</h2><p>Java</p>', 'Requisitos obligatorios:\nJava', 'Empresa con más de 3 años de trayectoria exige 6+ años de experiencia', 'Somos empresa líder y se requieren al menos 6 años de experiencia', 'Requirements:\n- Java\n- Angular', '<h2>Requirements:</h2><ul><li>Java</li></ul>', 'Requisitos obligatorios:\n• Java', '<h2>Requisitos obligatorios</h2><ul><li>Java</li></ul>', 'Senior developer for our junior team', 'Empresa con 5+ años de experiencia y candidato con al menos 6 años de experiencia obligatorios', 'Java deseable y se requiere inglés avanzado', 'Java deseable, se requiere inglés avanzado', 'No se requiere Java y se exige inglés avanzado', 'Java obligatorio con inglés avanzado deseable', 'Requisitos obligatorios:<ul><li>Java</li></ul>', 'Requisitos obligatorios:\n- Java\n- Angular', 'Java obligatorio.', 'Puesto Senior excluyente.', 'Inglés avanzado obligatorio.', 'Al menos 6 años de experiencia obligatorios.', 'Java deseable pero inglés avanzado obligatorio.', 'Aprender junto a senior; Java obligatorio.', 'Buscamos desarrollador Senior que acompañará a juniors', 'Java: deseable, inglés avanzado obligatorio'])('rechazo antes del proveedor: %s', async descripcion => {
        consultarDeepSeek.mockResolvedValue(JSON.stringify({ match: true, porcentaje: 90, razon: 'Intento aprobar' }));
        const resultado = await evaluarOferta(crearOferta(descripcion), 'Instrucciones de prueba', 'simulado', preferencias);
        expect(resultado.match).toBe(false);
        expect(resultado.error).toBe(false);
        expect(consultarDeepSeek).not.toHaveBeenCalled();
    });

    test.each([
        ...incidentales.map(descripcion => [descripcion, true]),
        ['Java deseable y es obligatorio inglés avanzado', false],
        ['<h2>Requisitos obligatorios</h2><p>Java</p>', false],
        ['Requisitos obligatorios:\nJava', false],
        ['Empresa con más de 3 años de trayectoria exige 6+ años de experiencia', false],
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
