// Comparto los mensajes finales entre evaluación e identidad, sin acceso a la BD.
const { construirPerfilEfectivo } = require('./perfil-efectivo');

/** Ordeno claves recursivamente; conservo el orden significativo de los arrays. */
function ordenarObjeto(valor) {
    if (Array.isArray(valor)) return valor.map(ordenarObjeto);
    if (valor && typeof valor === 'object') {
        return Object.fromEntries(Object.keys(valor).sort().map(clave => [clave, ordenarObjeto(valor[clave])]));
    }
    return valor;
}

function construirPerfilEfectivoCanonico(prefs = {}) {
    const confirmadas = { ...prefs };
    // Ordeno solo detalles estructurados que el perfil incorpora, no backups ni CVs.
    for (const campo of ['tecnologias_detalle', 'roles_objetivo_detalle', 'nivel_ingles_detalle']) {
        confirmadas[campo] = ordenarObjeto(prefs[campo]);
    }
    return construirPerfilEfectivo(confirmadas);
}

function construirPerfilDesdePreferencias(prefs = {}) {
    return construirPerfilEfectivoCanonico(prefs).texto;
}

/** Construyo instrucciones sin sustituir hechos confirmados por criterios adicionales. */
function construirInstruccionesDesdePreferencias(prefs = {}) {
    const partes = [
        'Sos un evaluador de ofertas de empleo. Compará la oferta con los hechos confirmados del candidato.',
        construirPerfilDesdePreferencias(prefs),
        'Respondé ÚNICAMENTE con JSON válido: {"match": true, "porcentaje": 85, "razon": "Explicación breve en español"}. match debe ser boolean y porcentaje entero de 0 a 100.',
        'match: true requiere cumplir al menos el 60% de los requisitos técnicos y no activar ninguna exclusión.',
        'No inventes conocimientos, herramientas, idiomas, empleos ni proyectos. null significa no declarado, [] significa sin entradas confirmadas. Evaluá niveles y evidencia, no solo nombres del stack.',
        'Los proyectos declarados en perfil_profesional y evidencia aportan experiencia práctica, pero NO equivalen automáticamente a años de empleo formal.',
        'Las preferencias laborales restringen la búsqueda, no son capacidades personales. Las reglas_exclusion adicionales rechazan tecnologías principales u obligatorias, no menciones deseables.',
        'El idioma de publicación no prueba por sí solo una incapacidad del candidato. Compará requisitos lingüísticos con nivel_ingles_detalle o idioma_candidato sin inventar niveles; conservá la exclusión obligatoria de inglés avanzado requerido.',
        'No rechaces un rol tecnológico por el sector de la empresa (hotel, salud, industria). Rechazá roles no tecnológicos o QA industrial; para soporte IT exigí componente de software, aplicaciones o atención digital, no solo reparación física.',
        'Los bonus NO compensan exclusiones. No otorgues experiencia fija en Next.js, IA, HealthTech, mobile o stack Microsoft: verificá hechos y evidencia confirmados. La prioridad IA es un ranking separado, no un bonus sobre el porcentaje de match.',
        'La razon debe ser concisa (1-2 oraciones), en español, con las tecnologías relevantes.',
    ];
    if (prefs.usar_prompt_personalizado && typeof prefs.prompt_personalizado === 'string' && prefs.prompt_personalizado.trim()) {
        partes.push('CRITERIOS ADICIONALES DEL USUARIO: NO sustituyen los hechos confirmados ni anulan las políticas obligatorias ni las restricciones laborales. No usar afirmaciones personales de este bloque como datos del candidato.');
        partes.push(prefs.prompt_personalizado);
    }
    return partes.join('\n\n');
}

/** Construyo el mensaje de usuario con los datos efectivos de la oferta. */
function construirPromptEvaluacion(oferta) {
    const partes = [`Título: ${oferta.titulo}`];
    for (const [campo, etiqueta] of [['empresa', 'Empresa'], ['ubicacion', 'Ubicación'], ['modalidad', 'Modalidad'], ['nivel_requerido', 'Nivel requerido'], ['plataforma', 'Plataforma']]) {
        if (oferta[campo]) partes.push(`${etiqueta}: ${oferta[campo]}`);
    }
    partes.push('', 'Descripción completa de la oferta:', oferta.descripcion || 'Sin descripción disponible.');
    return partes.join('\n');
}

module.exports = { ordenarObjeto, construirPerfilEfectivoCanonico, construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias, construirPromptEvaluacion };
