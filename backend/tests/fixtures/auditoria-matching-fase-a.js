// Propongo ejemplos manuales para probar el método, no resultados del producto ni verdad-terreno.
const ejemplos = [
    [17, 'Java obligatorio', 'aprobada', 90, 'posible_falso_positivo', 'java'],
    [42, 'JavaScript obligatorio; no requiere Java', 'rechazada', 20, 'posible_falso_negativo', 'java'],
    [103, 'Desarrollador Senior obligatorio', 'rechazada', 15, 'decision_correcta', 'seniority'],
    [208, 'Junior: aprender junto a nuestro desarrollador senior', 'rechazada', 15, 'posible_falso_negativo', 'seniority'],
    [319, 'Experiencia: 3 años', 'rechazada', 20, 'informacion_insuficiente', 'experiencia'],
    [421, 'Experiencia obligatoria: 3+ años', 'aprobada', 80, 'posible_falso_positivo', 'experiencia'],
    [557, 'Deseable: 5 años de experiencia; no excluyente', 'rechazada', 20, 'posible_falso_negativo', 'experiencia'],
    [602, 'English required', 'aprobada', 85, 'posible_falso_positivo', 'idioma'],
    [718, 'Inglés avanzado valorado', 'rechazada', 15, 'posible_falso_negativo', 'idioma'],
    [809, 'English not required', 'rechazada', 15, 'posible_falso_negativo', 'idioma'],
    [911, 'Remoto solo para residentes en España', 'aprobada', 90, 'posible_falso_positivo', 'ubicacion_modalidad'],
    [1024, 'Presencial fuera de la zona sintética aceptada', 'rechazada', 10, 'decision_correcta', 'ubicacion_modalidad'],
    [1198, 'Remoto desde Argentina; Java opcional; Rust deseable', 'rechazada', 10, 'posible_falso_negativo', 'tecnologia_opcional'],
    [1307, 'Extracto: desarrollo web', 'rechazada', 25, 'informacion_insuficiente', 'completitud'],
    [1499, 'Java excluyente', 'rechazada', 90, 'inconsistencia', 'explicacion'],
    [1601, 'JavaScript junior', 'aprobada', '140', 'inconsistencia', 'porcentaje'],
    [1793, 'JavaScript junior', 'pendiente', null, 'error_tecnico', 'error'],
    [1822, null, 'pendiente', null, 'informacion_insuficiente', 'completitud'],
    [2003, 'Unicode áéíóú ñ 🚀; JavaScript junior', 'aprobada', 80, 'decision_correcta', 'historia'],
];

function obtenerMuestraAuditoria() {
    return ejemplos.map(([id, descripcion, decision, porcentaje, categoria, regla]) => ({
        oferta: {
            id, titulo: 'Ejemplo inventado', descripcion, estado_evaluacion: decision,
            porcentaje_match: porcentaje, razon_evaluacion: 'Razón sintética para revisión manual',
            modalidad: id === 1024 ? 'presencial' : 'remoto',
            ubicacion: id === 1024 ? 'Otra zona sintética' : 'Argentina',
            origen_descripcion: id === 1307 ? 'tarjeta' : 'manual',
            descripcion_completitud: id === 1307 ? 'parcial' : descripcion ? 'completa' : 'ausente',
            evaluacion_error_mensaje: id === 1793 ? 'HTTP 503' : null,
            firma_criterios_evaluacion: id === 2003 ? 'a'.repeat(64) : null,
            fecha_evaluacion: id === 2003 ? '2020-01-01T00:00:00Z' : null,
            estado_postulacion: 'descartada', // Compruebo inclusión aunque el dashboard oculte la fila.
            explicacion_evaluacion: id === 1499 ? { cumplidos: [{
                requisito: 'Java', tipo: 'obligatorio', evidencia_oferta: 'Java excluyente',
                evidencia_perfil: 'Sin Java', explicacion: 'Cumple Java sin conocer Java',
            }] } : null,
        },
        revision: {
            id, decision, porcentaje, requisitos: regla, evidencia_textual: descripcion,
            reglas_aplicables: regla, explicacion_almacenada: id === 1499 ? 'Cumple Java sin conocer Java' : null,
            hallazgo: categoria, gravedad: categoria === 'posible_falso_positivo' ? 'alta' : 'media',
            confianza: categoria === 'informacion_insuficiente' ? 'baja' : 'media',
            historia: 'historicamente_no_verificable',
            estado_revision: 'ejemplo_manual_pendiente_revision_humana',
        },
    }));
}

module.exports = { obtenerMuestraAuditoria };
