// Valido la salida de IA sin coerción ni modificación de preferencias confirmadas.
function validarExtraccionCv(datos, contrato) {
    const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
    const texto = valor => typeof valor === 'string';
    const lista = (valor, max = 100) => Array.isArray(valor) && valor.length <= max && valor.every(texto);
    if (!objeto(datos) || Object.keys(datos).length === 0) return false;

    const reglas = {};
    for (const campo of ['nombre', 'perfil_profesional', 'idioma_candidato']) {
        reglas[campo] = valor => valor === null || texto(valor);
    }
    for (const [campo, valores] of Object.entries(contrato.enums)) {
        reglas[campo] = valor => valor === null || valores.includes(valor);
    }
    for (const campo of ['zonas_preferidas', 'terminos_busqueda', 'reglas_exclusion',
        'keywords_positivas', 'keywords_negativas', 'advertencias']) {
        reglas[campo] = lista;
    }
    for (const campo of ['plataformas_preferidas', 'plataformas_excluidas']) {
        reglas[campo] = valor => lista(valor, 20) && valor.every(item => contrato.plataformas.has(item));
    }
    for (const campo of ['expectativa_salarial_min', 'expectativa_salarial_max']) {
        reglas[campo] = valor => valor === null || (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 999999999);
    }
    reglas.nivel_ingles_detalle = valor => valor === null || (!contrato.validarIngles(valor) &&
        Object.keys(valor).every(campo => ['espanol', 'reading', 'writing', 'speaking', 'listening', 'regla'].includes(campo)));
    reglas.tecnologias_detalle = valor => !contrato.validarTecnologias(valor) && valor.every(item =>
        Object.keys(item).every(campo => ['nombre', 'nivel', 'categoria', 'importancia', 'aliases', 'evidencia'].includes(campo)) &&
        (!Object.hasOwn(item, 'importancia') || contrato.importancias.has(item.importancia)));
    reglas.roles_objetivo_detalle = valor => !contrato.validarRoles(valor) && valor.every(item =>
        Object.keys(item).every(campo => ['rol', 'prioridad', 'aliases', 'evidencia'].includes(campo)) &&
        (!Object.hasOwn(item, 'aliases') || lista(item.aliases, 20)));
    for (const campo of ['preguntas', 'preguntas_perfil_pendientes']) {
        reglas[campo] = valor => Array.isArray(valor) && valor.length <= 100 && valor.every(item =>
            objeto(item) && ['campo', 'pregunta', 'motivo'].every(clave => texto(item[clave]) && item[clave].trim().length > 0) &&
            Object.keys(item).every(clave => ['campo', 'pregunta', 'motivo', 'sugerencia'].includes(clave)) &&
            (!Object.hasOwn(item, 'sugerencia') || item.sugerencia === null || texto(item.sugerencia)));
    }
    if (!Object.entries(datos).every(([campo, valor]) => Object.hasOwn(reglas, campo) && reglas[campo](valor))) return false;
    // Exijo un hecho útil del candidato, no solo preguntas o preferencias de búsqueda.
    const textoUtil = valor => texto(valor) && valor.trim().length > 0;
    const tieneHechos = ['nombre', 'perfil_profesional', 'idioma_candidato'].some(campo => textoUtil(datos[campo])) ||
        datos.nivel_experiencia != null || datos.tecnologias_detalle?.length > 0 ||
        ['reading', 'writing', 'speaking', 'listening'].some(campo => textoUtil(datos.nivel_ingles_detalle?.[campo]));
    if (!tieneHechos) return false;
    return !(typeof datos.expectativa_salarial_min === 'number' && typeof datos.expectativa_salarial_max === 'number' &&
        datos.expectativa_salarial_min > datos.expectativa_salarial_max);
}

module.exports = { validarExtraccionCv };
