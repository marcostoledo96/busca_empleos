'use strict';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn() }));
jest.mock('../../src/modelos/oferta', () => ({ actualizarEvaluacion: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-lote', () => ({}));

const { normalizarLote } = require('../../src/servicios/servicio-normalizacion');
const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');
const { evaluarReglasExclusion } = require('../../src/servicios/evaluacion/reglas-exclusion');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const cache = require('../../src/modelos/evaluacion-cache');
const ofertas = require('../../src/modelos/oferta');
const { construirIdentidadEvaluacion } = require('../../src/servicios/evaluacion/identidad-evaluacion');
const prefs = { zonas_preferidas: ['Capital Federal', 'Zona Oeste'], stack_tecnologico: ['TypeScript'] };
const respuesta = match => ({ match, porcentaje: match ? 80 : 25, razon: 'Decisión sintética' });
const itemBase = { jobUrl: 'https://www.linkedin.com/jobs/view/83000001', jobTitle: 'Desarrollo Junior', companyName: 'Estudio Ñandú 360', location: 'Córdoba, Argentina' };

beforeEach(() => {
    jest.clearAllMocks();
    cache.buscarCache.mockResolvedValue(null);
    consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(true)));
});

const regresiones = [
    ['texto remoto contra metadato presencial', { workType: 'On-site', jobDescription: 'Trabajo 100% remoto.' }, null, true],
    ['título remoto contra metadato presencial', { workType: 'On-site', jobTitle: 'Desarrollo Junior remoto' }, null, true],
    ['remoto con asistencia semanal', { workType: 'Remote', jobDescription: 'Trabajo remoto con asistencia obligatoria a oficina una vez por semana.' }, 'hibrido', true],
    ['remoto con dos días en oficina', { workType: 'Remote', jobDescription: '100% remoto. Debe asistir a oficina 2 días por semana.' }, 'hibrido', true],
    ['remoto solo en descripción', { jobDescription: 'Modalidad remota: trabajo remoto desde Argentina.' }, 'remoto', false],
    ['título y descripción contradictorios', { jobTitle: 'Desarrollo remoto', jobDescription: 'Modalidad presencial.' }, null, true],
    ['negación contra etiqueta remota', { workType: 'Remote', jobDescription: 'Sin posibilidad de trabajo remoto.' }, null, true],
];

test.each(regresiones)('%s: normalizo y conservo fuentes sin mutar el crudo', (nombre, cambios, modalidad, conflicto) => {
    const item = { ...itemBase, ...cambios };
    const original = structuredClone(item);
    const [oferta] = normalizarLote([item], 'linkedin');
    expect(oferta.modalidad).toBe(modalidad);
    expect(oferta.datos_crudos.normalizacion_modalidad).toEqual(expect.objectContaining({ conflicto }));
    expect(oferta.datos_crudos.normalizacion_modalidad).toHaveProperty('metadatos');
    expect(oferta.datos_crudos.normalizacion_modalidad).toHaveProperty('titulo');
    expect(oferta.datos_crudos.normalizacion_modalidad).toHaveProperty('descripcion');
    expect(oferta.empresa).toBe('Estudio Ñandú 360');
    expect(oferta.ubicacion).toBe(item.location);
    expect(item).toEqual(original);
});

test.each(regresiones.flatMap(caso => [true, false].map(match => [...caso, match])))(
    '%s: normalización hasta matching (%s/%s/%s/%s)', async (nombre, cambios, modalidad, conflicto, match) => {
        const [oferta] = normalizarLote([{ ...itemBase, ...cambios }], 'linkedin');
        const original = structuredClone(oferta);
        consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(match)));
        const reglas = evaluarReglasExclusion(oferta, prefs);
        const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
        expect(reglas.excluida).toBe(false);
        expect(resultado.match).toBe(match);
        expect(resultado.porcentaje).toBe(respuesta(match).porcentaje);
        expect(resultado.razon).toBe(respuesta(match).razon);
        expect(resultado.error || false).toBe(false);
        expect(resultado.explicacion.por_confirmar).toHaveLength(conflicto ? 1 : 0);
        if (conflicto) expect(resultado.explicacion.por_confirmar[0].requisito).toBe('Conflicto de modalidad');
        expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect(cache.guardarCache).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
        expect(oferta).toEqual(original);
    }
);

const controles = [
    ['presencial fuera de zona', { workType: 'On-site' }, true],
    ['presencial con tareas de soporte remoto', { workType: 'On-site', jobDescription: 'Trabajo presencial. Brindará soporte remoto a clientes.' }, true],
    ['desconocido con ciudad conocida', {}, false],
    ['alias de CABA', { workType: 'On-site', location: 'Palermo, Buenos Aires' }, false],
    ['alias GBA', { workType: 'On-site', location: 'El Palomar, Buenos Aires' }, false],
    ['homónimo extranjero', { workType: 'On-site', location: 'Palermo, Italia' }, true],
    ['homónimo provincial', { workType: 'On-site', location: 'San Justo, Santa Fe' }, true],
    ['restricción remota legítima', { workType: 'Remote', jobDescription: 'US residents only.' }, true],
    ['Java obligatorio independiente', { workType: 'Remote', jobDescription: 'Java obligatorio.' }, true],
    ['oficina sin asistencia requerida', { workType: 'Remote', jobDescription: 'Trabajo 100% remoto. No debe asistir a oficina 2 días por semana.' }, false],
];

test.each(controles)('control vigente: %s', async (nombre, cambios, excluida) => {
    const [oferta] = normalizarLote([{ ...itemBase, ...cambios }], 'linkedin');
    const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
    expect(evaluarReglasExclusion(oferta, prefs).excluida).toBe(excluida);
    expect(resultado.match).toBe(!excluida);
    expect(resultado.porcentaje).toBe(excluida ? 10 : 80);
    if (nombre === 'oficina sin asistencia requerida') {
        expect(oferta.modalidad).toBe('remoto');
        expect(resultado.explicacion.por_confirmar).toEqual([]);
    }
    expect(consultarDeepSeek).toHaveBeenCalledTimes(excluida ? 0 : 1);
    expect(cache.guardarCache).toHaveBeenCalledTimes(excluida ? 0 : 1);
    expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
});

test.each(['computrabajo', 'jooble'])('reutilizo descripción y jornada de %s en el lote', plataforma => {
    const item = { url: 'https://ar.computrabajo.com/oferta-sintetica', link: 'https://jooble.org/desc/83000001', title: 'Desarrollo', type: 'Full-time', descriptionText: 'Trabajo remoto.', snippet: 'Trabajo remoto.' };
    const [oferta] = normalizarLote([item], plataforma);
    expect(oferta.modalidad).toBe('remoto');
});

test('conflicto conserva rechazo cacheado sin modificar almacenamiento', async () => {
    const [oferta] = normalizarLote([{ ...itemBase, ...regresiones[0][1] }], 'linkedin');
    const almacenada = respuesta(false);
    cache.buscarCache.mockResolvedValue(almacenada);
    const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
    expect(resultado.match).toBe(false);
    expect(resultado.porcentaje).toBe(25);
    expect(resultado.explicacion.por_confirmar[0].requisito).toBe('Conflicto de modalidad');
    expect(almacenada).toEqual(respuesta(false));
    expect(consultarDeepSeek).not.toHaveBeenCalled();
    expect(cache.guardarCache).not.toHaveBeenCalled();
});

test('pre y post preservan la misma restricción geográfica', async () => {
    const [oferta] = normalizarLote([{ ...itemBase, workType: 'Remote' }], 'linkedin');
    consultarDeepSeek.mockImplementationOnce(async () => {
        oferta.descripcion = 'US residents only.';
        return JSON.stringify(respuesta(true));
    });
    const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
    expect(resultado.match).toBe(false);
    expect(resultado.porcentaje).toBe(10);
    expect(resultado.explicacion.exclusiones).toHaveLength(1);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test('una contradicción de modalidad no elimina una restricción territorial explícita', async () => {
    const [oferta] = normalizarLote([{ ...itemBase, workType: 'On-site', jobDescription: 'Trabajo remoto. US residents only.' }], 'linkedin');
    const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
    expect(resultado.match).toBe(false);
    expect(resultado.porcentaje).toBe(10);
    expect(resultado.explicacion.por_confirmar).toHaveLength(1);
    expect(resultado.explicacion.exclusiones[0].requisito).toBe('Residencia territorial remota compatible');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
    expect(cache.guardarCache).not.toHaveBeenCalled();
});

test('la identidad distingue metadatos contradictorios aunque el prompt sea igual', () => {
    const [una] = normalizarLote([{ ...itemBase, ...regresiones[0][1] }], 'linkedin');
    const otra = structuredClone(una);
    otra.datos_crudos.normalizacion_modalidad.metadatos = 'hibrido';
    const identidadUna = construirIdentidadEvaluacion(una, prefs);
    const identidadOtra = construirIdentidadEvaluacion(otra, prefs);
    expect(identidadUna.oferta.mensaje_usuario).toBe(identidadOtra.oferta.mensaje_usuario);
    expect(identidadUna.firma_criterios_evaluacion).toBe(identidadOtra.firma_criterios_evaluacion);
    expect(identidadUna.hash_oferta).not.toBe(identidadOtra.hash_oferta);
});

const casosB1B2 = [
    ['B1 acceso remoto como tarea', { workType: 'On-site', jobDescription: 'Trabajo presencial. Configurará acceso remoto para clientes.' }, 'presencial', true],
    ['B1 monitoreo remoto como tarea', { workType: 'On-site', jobDescription: 'Trabajo presencial. Realizará monitoreo remoto de servidores.' }, 'presencial', true],
    ['B1 tarea sin modalidad', { jobDescription: 'Configurará acceso remoto para clientes.' }, null, false],
    ['B1 oficina como beneficio opcional', { workType: 'Remote', jobDescription: 'Acceso opcional a un puesto en oficina.' }, 'remoto', false],
    ['B2 no se debe asistir', { workType: 'Remote', jobDescription: 'Trabajo 100% remoto. No se debe asistir a oficina 2 días por semana.' }, 'remoto', false],
    ['B2 no hay asistencia obligatoria', { workType: 'Remote', jobDescription: 'Trabajo 100% remoto. No hay asistencia obligatoria a oficina una vez por semana.' }, 'remoto', false],
];

test.each(casosB1B2.flatMap(caso => [true, false].map(match => [...caso, match])))(
    '%s: recorrido público con decisión %s/%s/%s/%s', async (nombre, cambios, modalidad, excluida, match) => {
        const item = { ...itemBase, ...cambios };
        const itemOriginal = structuredClone(item);
        const [oferta] = normalizarLote([item], 'linkedin');
        const ofertaOriginal = structuredClone(oferta);
        consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(match)));
        const reglas = evaluarReglasExclusion(oferta, prefs);
        const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
        expect(oferta.modalidad).toBe(modalidad);
        expect(oferta.datos_crudos.normalizacion_modalidad.conflicto).toBe(false);
        expect(reglas.excluida).toBe(excluida);
        expect(reglas.reglas).toEqual(excluida ? ['ubicacion_modalidad'] : []);
        expect(reglas.explicacion.por_confirmar).toEqual([]);
        expect(resultado.match).toBe(excluida ? false : match);
        expect(resultado.porcentaje).toBe(excluida ? 10 : respuesta(match).porcentaje);
        expect(resultado.razon).toBe(excluida ? reglas.razon : respuesta(match).razon);
        expect(resultado.error || false).toBe(false);
        expect(resultado.explicacion.por_confirmar).toEqual([]);
        expect(resultado.explicacion.exclusiones).toHaveLength(excluida ? 1 : 0);
        expect(consultarDeepSeek).toHaveBeenCalledTimes(excluida ? 0 : 1);
        expect(cache.buscarCache).toHaveBeenCalledTimes(excluida ? 0 : 1);
        expect(cache.guardarCache).toHaveBeenCalledTimes(excluida ? 0 : 1);
        expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
        expect(item).toEqual(itemOriginal);
        expect(oferta).toEqual(ofertaOriginal);
    }
);

test.each([
    ['puesto remoto', 'Puesto remoto.'],
    ['trabajo remoto', 'Trabajo remoto.'],
    ['modalidad remota', 'Modalidad remota.'],
])('B1 conservo señal real: %s', (nombre, jobDescription) => {
    const [oferta] = normalizarLote([{ ...itemBase, jobDescription }], 'linkedin');
    expect(oferta.modalidad).toBe('remoto');
    expect(oferta.datos_crudos.normalizacion_modalidad.conflicto).toBe(false);
});

test('B1 conservo remoto en el título', () => {
    const [oferta] = normalizarLote([{ ...itemBase, jobTitle: 'Remoto' }], 'linkedin');
    expect(oferta.modalidad).toBe('remoto');
    expect(oferta.datos_crudos.normalizacion_modalidad.conflicto).toBe(false);
});

test.each([
    'Asistencia obligatoria a oficina una vez por mes.',
    'Debe asistir a oficina 2 días por mes.',
])('B2 conservo obligación mensual: %s', jobDescription => {
    const [oferta] = normalizarLote([{ ...itemBase, workType: 'Remote', jobDescription }], 'linkedin');
    expect(oferta.modalidad).toBe('hibrido');
    expect(oferta.datos_crudos.normalizacion_modalidad.conflicto).toBe(true);
});

test.each([
    ['computrabajo', { url: 'https://ar.computrabajo.com/oferta-sintetica', modalidadDetalle: 'Remoto', descriptionText: 'Acceso opcional a un puesto en oficina.' }],
    ['jooble', { link: 'https://jooble.org/desc/83000001', type: 'Remote', snippet: 'Acceso opcional a un puesto en oficina.' }],
])('B1 oficina opcional no contradice al adaptador %s', (plataforma, item) => {
    const [oferta] = normalizarLote([item], plataforma);
    expect(oferta.modalidad).toBe('remoto');
    expect(oferta.datos_crudos.normalizacion_modalidad.conflicto).toBe(false);
});

test.each([true, false])('S5 admito Adzuna remoto con oficina opcional: proveedor %s', async match => {
    const item = {
        redirect_url: 'https://www.adzuna.es/details/83008888',
        title: 'Desarrollo Junior remoto',
        company: { display_name: 'Ñandú 360' },
        location: { display_name: 'Madrid, España' },
        contract_time: 'full_time',
        description: 'Acceso opcional a un puesto en oficina.',
    };
    const original = structuredClone(item);
    const advertencia = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        const normalizadas = normalizarLote([item], 'adzuna');
        expect(normalizadas).toHaveLength(1);
        const [oferta] = normalizadas;
        const ofertaOriginal = structuredClone(oferta);
        expect(oferta.modalidad).toBe('remoto');
        expect(oferta.empresa).toBe('Ñandú 360');
        expect(oferta.ubicacion).toBe('Madrid, España');
        expect(oferta.datos_crudos.normalizacion_modalidad.conflicto).toBe(false);
        expect(evaluarReglasExclusion(oferta, prefs).excluida).toBe(false);
        consultarDeepSeek.mockResolvedValue(JSON.stringify(respuesta(match)));
        const resultado = await evaluarOferta(oferta, undefined, undefined, prefs);
        expect(resultado.match).toBe(match);
        expect(resultado.porcentaje).toBe(respuesta(match).porcentaje);
        expect(resultado.razon).toBe(respuesta(match).razon);
        expect(resultado.error || false).toBe(false);
        expect(resultado.explicacion.por_confirmar).toEqual([]);
        expect(resultado.explicacion.exclusiones).toEqual([]);
        expect(advertencia).not.toHaveBeenCalled();
        expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
        expect(cache.buscarCache).toHaveBeenCalledTimes(1);
        expect(cache.guardarCache).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
        expect(item).toEqual(original);
        expect(oferta).toEqual(ofertaOriginal);
    } finally {
        advertencia.mockRestore();
    }
});

test('las nuevas reglas no reutilizan criterios v5', () => {
    const actual = construirIdentidadEvaluacion(itemBase, prefs, { instrucciones: 'Sistema sintético' });
    const anterior = construirIdentidadEvaluacion(itemBase, prefs, { instrucciones: 'Sistema sintético', version: 'evaluacion-v5' });
    expect(actual.firma_criterios_evaluacion).not.toBe(anterior.firma_criterios_evaluacion);
});
