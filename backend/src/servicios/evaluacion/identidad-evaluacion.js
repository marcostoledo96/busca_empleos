// Identifico entradas efectivas, no toda la configuración ni metadatos visuales.
const { createHash } = require('crypto');
const { CONFIGURACION_DECISION, DEEPSEEK_MODELO } = require('../../config/deepseek');
const { VERSION_PRIORIDAD_IA } = require('./detector-prioridad-ia');
const { ordenarObjeto, construirInstruccionesDesdePreferencias, construirPromptEvaluacion } = require('./entradas-evaluacion');

// Incremento esta versión cuando cambia el contrato de reglas o del parser.
const VERSION_CONTRATO_EVALUACION = 'evaluacion-v2';

function serializarCanonico(valor) {
    return JSON.stringify(ordenarObjeto(valor));
}

function crearHash(valor) {
    return createHash('sha256').update(serializarCanonico(valor)).digest('hex');
}

function construirCriteriosEvaluacion(prefs = {}, opciones = {}) {
    return {
        mensaje_sistema: opciones.instrucciones || construirInstruccionesDesdePreferencias(prefs),
        modelo: opciones.modelo || prefs.modelo_ia_evaluacion || prefs.modelo_ia || DEEPSEEK_MODELO,
        proveedor: CONFIGURACION_DECISION,
        // La defensa geográfica utiliza preferencias aun con instrucciones explícitas.
        zonas_defensa: prefs.zonas_preferidas || [],
        version: opciones.version || VERSION_CONTRATO_EVALUACION,
        version_prioridad_ia: VERSION_PRIORIDAD_IA,
    };
}

function construirEntradaOferta(oferta) {
    const crudos = oferta.datos_crudos && typeof oferta.datos_crudos === 'object' ? oferta.datos_crudos : {};
    // Estas son las fuentes textuales utilizadas por las exclusiones contextuales.
    const datosCrudos = Object.fromEntries(['description', 'descriptionHtml', 'jobDescription', 'job_description', 'requirements', 'requisitos']
        .map(campo => [campo, crudos[campo] || '']));
    return {
        mensaje_usuario: construirPromptEvaluacion(oferta),
        datos_crudos: datosCrudos,
        version: VERSION_CONTRATO_EVALUACION,
    };
}

function crearFirmaCriterios(prefs = {}, opciones = {}) {
    return crearHash(construirCriteriosEvaluacion(prefs, opciones));
}

function construirIdentidadEvaluacion(oferta, prefs = {}, opciones = {}) {
    const criterios = construirCriteriosEvaluacion(prefs, opciones);
    const entradaOferta = construirEntradaOferta(oferta);
    return {
        criterios,
        oferta: entradaOferta,
        hash_oferta: crearHash(entradaOferta),
        firma_criterios_evaluacion: crearHash(criterios),
    };
}

/** No atribuyo vigencia a una evaluación ausente, pendiente o fallida. */
function obtenerVigenciaEvaluacion(oferta, firmaActual) {
    if (!firmaActual || !oferta.firma_criterios_evaluacion || oferta.evaluacion_error_mensaje
        || !['aprobada', 'rechazada'].includes(oferta.estado_evaluacion)) return 'desconocida';
    return oferta.firma_criterios_evaluacion === firmaActual ? 'actual' : 'anterior';
}

module.exports = { VERSION_CONTRATO_EVALUACION, serializarCanonico, crearHash, construirCriteriosEvaluacion,
    construirEntradaOferta, construirIdentidadEvaluacion, crearFirmaCriterios, obtenerVigenciaEvaluacion };
