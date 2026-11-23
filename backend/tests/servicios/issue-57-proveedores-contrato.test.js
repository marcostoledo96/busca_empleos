const { crearProveedores } = require('../helpers/issue-57-proveedores');
const { ofertaLinkedin } = require('../helpers/issue-57-entorno');
const { parsearRespuestaEvaluacionIa } = require('../../src/servicios/evaluacion/parser-respuesta-ia');
const { obtenerSituacionEvaluacion } = require('../../src/servicios/evaluacion/situacion-evaluacion');

async function evaluarRespuesta(proveedores) {
    const respuesta = await proveedores.fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST' });
    expect(respuesta.ok).toBe(true);
    const { choices: [{ message: { content } }] } = await respuesta.json();
    const { jobTitle, jobDescription } = ofertaLinkedin();
    return parsearRespuestaEvaluacionIa(content, `${jobTitle}\n${jobDescription}`);
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
