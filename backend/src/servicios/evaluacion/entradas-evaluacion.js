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
        'Respondé ÚNICAMENTE con JSON válido con el siguiente formato estricto: {"match": true, "porcentaje": 85, "razon": "Explicación breve en español", "explicacion": {"cumplidos": [], "no_cumplidos": [], "por_confirmar": [], "exclusiones": []}}.',
        'match debe ser boolean y porcentaje entero de 0 a 100.',
        'Estructura de cada elemento en los arrays de explicacion (cumplidos, no_cumplidos, por_confirmar, exclusiones): {"requisito": "nombre del requisito", "tipo": "obligatorio" | "deseable" | "desconocido", "evidencia_oferta": "cita textual o resumen de la oferta", "evidencia_perfil": "hecho confirmado del perfil o vacío si no aplica", "explicacion": "justificación concisa"}.',
        'match: true requiere cumplir al menos el 60% de los requisitos técnicos y no activar ninguna exclusión.',
        'Requisitos deseables no cumplidos NO deben justificar un rechazo por sí solos ni considerarse exclusiones.',
        'Una cita de la oferta prueba el requisito, no el cumplimiento del candidato. Residencia, autorización laboral, matrícula y titulación específica obligatorias sin evidencia confirmada del perfil van a por_confirmar con tipo obligatorio; desconocido no equivale a cumplido ni a incumplido. No inventes equivalencia académica entre formación técnica y una titulación específica. Si son deseables, conservá tipo deseable sin bloquear la elegibilidad.',
        'Para una obligación en cumplidos, citá literalmente el hecho del candidato y el requisito relacionado del aviso; no uses otra capacidad, una preferencia ni criterios adicionales como prueba. El nombre del requisito debe aparecer en ambas citas. Una obligación en no_cumplidos o exclusiones necesita incompatibilidad acreditada: evidencia vacía, inventada, ajena o equivalencia no confirmada va a por_confirmar. No mantengas el mismo requisito simultáneamente cumplido y pendiente/excluido.',
        'El porcentaje mide afinidad técnica, no acredita elegibilidad. Si hay afinidad suficiente pero una obligación por confirmar, conservá match true y el porcentaje técnico con el requisito en por_confirmar: el servicio lo persistirá pendiente, no aprobado ni como error técnico. Una incompatibilidad real conserva su rechazo y exclusión, sin compensarla con afinidad.',
        'Evaluá la suficiencia por el contenido, no por longitud ni solo por el título. Si un texto fragmentario no permite evaluar requisitos, registrá Información suficiente de la oferta en por_confirmar con tipo obligatorio. Un extracto breve con evidencia suficiente sí puede evaluarse; no inventes requisitos omitidos.',
        'Si la oferta contiene un extracto parcial o aviso incompleto, los requisitos no mencionados deben clasificarse en "por_confirmar", NUNCA en "no_cumplidos" (salvo exclusión explícita presente en el texto).',
        'No inventes conocimientos, herramientas, idiomas, empleos ni proyectos. null significa no declarado, [] significa sin entradas confirmadas. Evaluá niveles y evidencia, no solo nombres del stack.',
        'Los proyectos declarados en perfil_profesional y evidencia aportan experiencia práctica, pero NO equivalen automáticamente a años de empleo formal.',
        'Las preferencias laborales restringen la búsqueda, no son capacidades personales. Las reglas_exclusion adicionales rechazan tecnologías principales u obligatorias, no menciones deseables.',
        'Distinguí trayectoria de la empresa, mentoría Senior y coordinación puntual del nivel del puesto. SSR/SR admite alternativas: no es SR único ni aprobación automática. Java como alternativa entre tecnologías no es Java obligatorio; Java y TypeScript obligatorios sí. Si el título o cuerpo Junior/Trainee contradice nivel_requerido Senior/SR, conservá ambas fuentes como conflicto en por_confirmar, sin elegir silenciosamente el dato más restrictivo. Otro requisito puede justificar el rechazo.',
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

    let encabezadoDescripcion = 'Descripción provista de la oferta (completitud no verificada):';
    let textoDescripcion = oferta.descripcion || 'Sin descripción disponible.';

    const descripcionVacia = !oferta.descripcion || oferta.descripcion.trim() === '';
    if (descripcionVacia || oferta.descripcion_completitud === 'ausente') {
        encabezadoDescripcion = 'Descripción ausente de la oferta (sin contenido disponible):';
        textoDescripcion = descripcionVacia ? 'Sin descripción disponible.' : oferta.descripcion;
    } else if (oferta.descripcion_completitud === 'parcial' || oferta.origen_descripcion === 'tarjeta') {
        encabezadoDescripcion = 'Extracto parcial de la oferta (aviso incompleto — no asumir que requisitos no mencionados están ausentes):';
    } else if (oferta.descripcion_completitud === 'completa' || oferta.origen_descripcion === 'manual') {
        encabezadoDescripcion = 'Descripción completa confirmada de la oferta:';
    }

    partes.push('', encabezadoDescripcion, textoDescripcion,
        '', 'La evidencia del aviso no acredita cumplimiento del candidato: obligaciones de residencia, autorización laboral o titulación sin prueba en el perfil van a por_confirmar con tipo obligatorio, sin inventar equivalencia académica. Los deseables no bloquean. Si el texto es insuficiente, registrá Información suficiente de la oferta en por_confirmar con tipo obligatorio; el título y la longitud no prueban suficiencia.');
    return partes.join('\n');
}

module.exports = { ordenarObjeto, construirPerfilEfectivoCanonico, construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias, construirPromptEvaluacion };
