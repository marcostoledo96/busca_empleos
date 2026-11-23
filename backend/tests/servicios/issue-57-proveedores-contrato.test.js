jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn(() => { throw new Error('Acceso a PostgreSQL no permitido'); }) }));
jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'), consultarDeepSeek: jest.fn(),
}));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ guardarCache: jest.fn() }));

const pool = require('../../src/config/base-datos');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const { obtenerPreferencias } = require('../../src/modelos/preferencia');
const { guardarCache } = require('../../src/modelos/evaluacion-cache');
const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');
const { crearProveedores } = require('../helpers/issue-57-proveedores');
const { ofertaLinkedin } = require('../helpers/issue-57-entorno');
const { parsearRespuestaEvaluacionIa } = require('../../src/servicios/evaluacion/parser-respuesta-ia');
const { obtenerSituacionEvaluacion } = require('../../src/servicios/evaluacion/situacion-evaluacion');

async function obtenerRespuestaSintetica(proveedores) {
    const respuesta = await proveedores.fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST' });
    expect(respuesta.ok).toBe(true);
    const { choices: [{ message: { content } }] } = await respuesta.json();
    return content;
}

async function evaluarRespuesta(proveedores) {
    const { jobTitle, jobDescription } = ofertaLinkedin();
    return parsearRespuestaEvaluacionIa(await obtenerRespuestaSintetica(proveedores), `${jobTitle}\n${jobDescription}`);
}

function proyectarAprobacion(resultado) {
    return obtenerSituacionEvaluacion({
        estado_evaluacion: 'aprobada', porcentaje_match: resultado.porcentaje,
        razon_evaluacion: resultado.razon, explicacion_evaluacion: resultado.explicacion,
        fecha_evaluacion: '2026-01-15T00:00:00Z', firma_criterios_evaluacion: 'firma-sintetica',
        evaluacion_error_mensaje: null,
    });
}

test('el éxito de reevaluación conserva 85 y se proyecta como aprobación con evidencia', async () => {
    const proveedores = crearProveedores();
    proveedores.cambiar('ia_aprobada_con_evidencia');
    const resultado = await evaluarRespuesta(proveedores);
    expect(resultado).toMatchObject({ match: true, porcentaje: 85 });
    expect(resultado.error).toBeUndefined();
    expect(proyectarAprobacion(resultado)).toBe('aprobada');
    expect(resultado.desglose_disponible).toBe(true);
    expect(resultado.explicacion.cumplidos).toEqual([{
        requisito: 'JavaScript', tipo: 'obligatorio',
        evidencia_oferta: 'desarrollar aplicaciones JavaScript',
        evidencia_perfil: 'Desarrollo junior JavaScript',
        explicacion: 'El perfil coincide con la tecnología solicitada.',
    }]);
    expect(ofertaLinkedin().jobDescription).toContain(resultado.explicacion.cumplidos[0].evidencia_oferta);
});

test('la reevaluación contrasta la cita de JavaScript con el perfil efectivo de E', async () => {
    const proveedores = crearProveedores();
    proveedores.cambiar('ia_aprobada_con_evidencia');
    consultarDeepSeek.mockImplementation(() => obtenerRespuestaSintetica(proveedores));
    const { jobTitle, jobDescription, location } = ofertaLinkedin();
    const oferta = { id: 1, titulo: jobTitle, descripcion: jobDescription, ubicacion: location, modalidad: 'remoto' };
    const preferencias = { idioma_candidato: 'Español', modalidad_aceptada: 'cualquiera', tecnologias_detalle: [], stack_tecnologico: [] };
    // Incluso con el stack vacío que deja preferencias-cv, solo la cita del perfil diferencia ambos resultados.
    obtenerPreferencias.mockResolvedValueOnce({ ...preferencias, perfil_profesional: 'Perfil confirmado para pruebas.' });
    obtenerPreferencias.mockResolvedValueOnce({ ...preferencias, perfil_profesional: 'Desarrollo junior JavaScript' });

    const pendiente = await evaluarOferta(oferta, undefined, undefined, undefined, { forzar: true });
    expect(pendiente).toMatchObject({ pendiente: true, porcentaje: 85, explicacion: {
        cumplidos: [], por_confirmar: [expect.objectContaining({ requisito: 'JavaScript', tipo: 'obligatorio', evidencia_perfil: '' })],
    } });
    const aprobada = await evaluarOferta(oferta, undefined, undefined, undefined, { forzar: true });
    expect(aprobada).toMatchObject({ match: true, porcentaje: 85, desglose_disponible: true, explicacion: {
        por_confirmar: [], cumplidos: [{
            requisito: 'JavaScript', tipo: 'obligatorio', evidencia_oferta: 'desarrollar aplicaciones JavaScript',
            evidencia_perfil: 'Desarrollo junior JavaScript', explicacion: 'El perfil coincide con la tecnología solicitada.',
        }],
    } });
    expect(aprobada.pendiente).toBeFalsy();
    expect(aprobada.error).toBeFalsy();
    expect(proyectarAprobacion(aprobada)).toBe('aprobada');
    expect(guardarCache).toHaveBeenCalledTimes(2);
    expect(consultarDeepSeek).toHaveBeenCalledTimes(2);
    expect(proveedores.llamadas).toEqual(Array(2).fill({ tipo: 'http', destino: 'https://api.deepseek.com/v1/chat/completions' }));
    expect(proveedores.inesperadas).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
});

test('el éxito por defecto conserva el resultado sin evidencia y se proyecta como legado', async () => {
    const resultado = await evaluarRespuesta(crearProveedores());
    expect(resultado).toMatchObject({ match: true, porcentaje: 85, razon: 'Cumplo los requisitos sintéticos.', desglose_disponible: false });
    expect(resultado.explicacion.cumplidos).toEqual([]);
    expect(proyectarAprobacion(resultado)).toBe('legado');
});

test('ia_incompleta sigue produciendo una evaluación inválida', async () => {
    const proveedores = crearProveedores();
    proveedores.cambiar('ia_incompleta');
    expect(await evaluarRespuesta(proveedores)).toMatchObject({ match: true, porcentaje: null, error: true, invalido: true });
});
