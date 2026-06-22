// Reglas de exclusión determinísticas — rechazan ofertas sin consultar a DeepSeek.
//
// Estas reglas son la primera y última línea de defensa del Ciclo A:
// pre-evaluación (antes de DeepSeek), post-evaluación (después de DeepSeek),
// y revalidación de cache.
//
// ¿Por qué separadas del flujo principal?
// 1. Las reglas determinísticas son incondicionales: ningún bonus (IA, Next.js, etc.)
//    puede compensar un rechazo por Java, Senior, 3+ años, inglés avanzado o
//    presencial fuera de zona.
// 2. DeepSeek puede aprobar una oferta Senior o con Java por error — estas reglas
//    la interceptan antes y después de la IA.
// 3. El usuario pidió explícitamente que estos sean rechazos duros.
//
// La función principal evaluarReglasExclusion() recibe una oferta y las
// preferencias del usuario, aplica todas las reglas, y devuelve un resultado
// con excluida: true si alguna regla se activa, o false si la oferta
// pasa a evaluación por IA.

'use strict';

// ──────────────────────────────────────────────────────────────
// Patrones de detección
// ──────────────────────────────────────────────────────────────

// Java excluyente: detecta "Java" como tecnología principal o excluyente,
// sin confundir con JavaScript.
// Estrategia: busca "Java" como palabra completa (\b) y se asegura
// de que NO esté seguido por "Script" o "script" (lo que sería JavaScript).
const PATRON_JAVA_EXCLUYENTE = [
    /\bjava\b(?!\s*script)/i,
    /\bspring\s*boot\b/i,
    /\bj2ee\b/i,
    /\bjee\b/i,
    /\bjakarta\s*ee\b/i,
    /\bhibernate\b/i,
];

// Seniority excluyente: Senior, SR, Lead (como rol de liderazgo).
const PATRON_SENIORITY_EXCLUYENTE = [
    /\bsenior\b/i,
    /\bsr\b(?!\.)[\s.,;:)]/i,  // "SR" seguido de espacio/puntación, no "Sr." como abreviatura
    /\bsr[\s.,;:)]/i,
    /\bsr$/im,
    /\btech\s*lead\b/i,
    /\bteam\s*lead\b/i,
    /\bengineering\s*lead\b/i,
    /\blead\s+developer\b/i,
    /\blead\s+engineer\b/i,
    /\blead\b[\s,.;)]/i,
];

// Experiencia excluyente: 3+ años, >3 años, al menos 3, mínimo 3, at least 3, etc.
const PATRON_EXPERIENCIA_EXCLUYENTE = [
    />\s*3\s*(años?|anos?|years?|yr)\b/i,
    /\b3\s*\+\s*(años?|anos?|years?|yr)\b/i,
    /\bal\s+menos\s+3\s*(años?|anos?|years?|yr)\b/i,
    /\bm[ií]nimo\s+3\s*(años?|anos?|years?|yr)\b/i,
    /\bminimum\s+3\s*(years?|yr)\b/i,
    /\bat\s+least\s+3\s*(years?|yr)\b/i,
    /\b3\s*(or\s+more|o\s+mas)\s*(años?|anos?|years?|yr)\b/i,
    /\b[45]\s*\+\s*(años?|anos?|years?|yr)\b/i,
    />\s*[45]\s*(años?|anos?|years?|yr)\b/i,
    /\b(al\s+menos|m[ií]nimo|at\s+least|minimum)\s+[45]\s*(años?|anos?|years?|yr)\b/i,
    // "más de 3 años", "mas de 3 años"
    /\bm[aá]s\s+de\s+3\s*(años?|anos?|years?|yr)\b/i,
    // "mayor a 3 años", "mayor de 3 años"
    /\bmayor\s+(a|de)\s+3\s*(años?|anos?|years?|yr)\b/i,
    // "mayor a 4/5 años", "mayor de 4/5 años"
    /\bmayor\s+(a|de)\s+[45]\s*(años?|anos?|years?|yr)\b/i,
];

// Inglés excluyente: avanzado, fluido, bilingüe, conversational, upper-intermediate.
// Solo se activa si la oferta LO REQUIERE como condición (no como "deseable" o "plus").
const PATRON_INGLES_EXCLUYENTE = [
    /\bfluent\s+english\b/i,
    /\benglish\s+fluent\b/i,
    /\bingl[eé]s\s+fluido\b/i,
    /\bfluido\s+en\s+ingl[eé]s\b/i,
    /\bingl[eé]s\s+avanzado\b/i,
    /\bavanzado\s+ingl[eé]s\b/i,
    /\bbilingual\b/i,
    /\bbiling[uü]e\b/i,
    /\bingl[eé]s\s+biling[uü]e\b/i,
    /\bconversational\s+english\b/i,
    /\bupper.?intermediate\b/i,
    /\bingl[eé]s\s+excluyente\b/i,
    /\benglish\s+required\b/i,
    /\bingl[eé]s\s+requerido\b/i,
    /\bingl[eé]s\s+obligatorio\b/i,
    /\bdaily\s+(standups?|meetings?)\s+in\s+english\b/i,
    /\benglish.?speaking\s+team\b/i,
    /\bcommunicate\s+in\s+english\b/i,
];

// ──────────────────────────────────────────────────────────────
// Funciones de detección
// ──────────────────────────────────────────────────────────────

/**
 * Normaliza texto: minúsculas, sin acentos, sin HTML, sin espacios extra.
 * Reutiliza la misma lógica de normalización para consistencia con otros servicios.
 *
 * @param {string} texto - Texto a normalizar.
 * @returns {string} Texto normalizado.
 */
function normalizarTexto(texto = '') {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrae el texto analizable de una oferta.
 * Combina título, descripción y datos_crudos en un solo texto normalizado.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {string} Texto normalizado para análisis de patrones.
 */
function extraerTextoOferta(oferta) {
    const datosCrudosTexto = oferta.datos_crudos
        && typeof oferta.datos_crudos === 'object'
        ? [
            oferta.datos_crudos.description || '',
            oferta.datos_crudos.descriptionHtml || '',
            oferta.datos_crudos.jobDescription || '',
            oferta.datos_crudos.job_description || '',
            oferta.datos_crudos.requirements || '',
            oferta.datos_crudos.requisitos || '',
        ].filter(Boolean).join(' ')
        : '';

    return normalizarTexto([
        oferta.titulo,
        oferta.descripcion,
        datosCrudosTexto,
    ].filter(Boolean).join(' '));
}

/**
 * Detecta si la oferta requiere Java como tecnología principal o excluyente.
 * NO confunde con JavaScript — si el texto dice "JavaScript" pero no "Java"
 * (o dice "Java" seguido de "Script"), no se activa.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarJavaExcluyente(oferta) {
    const texto = extraerTextoOferta(oferta);

    // Primero verifico si hay mención a Java (sin JavaScript).
    // La regex \bjava\b(?!\s*script) detecta "Java" como palabra completa
    // que NO está seguida de "Script" o "script".
    const javaSinScript = /\bjava\b(?!\s*script)/i.test(texto);

    // También verifico si hay frameworks del ecosistema Java que indican
    // que Java es tecnología principal (Spring Boot, J2EE, Hibernate).
    const ecosistemaJava = PATRON_JAVA_EXCLUYENTE.slice(1).some(p => p.test(texto));

    // Si menciona JavaScript pero no Java por separado, no es exclusión.
    // Si menciona "Java" (no seguido de Script), es exclusión.
    // Si menciona Spring Boot/J2EE/Hibernate, es exclusión.
    const detectado = javaSinScript || ecosistemaJava;

    // Identificar qué patrón se activó para la razón.
    let patron = null;
    if (javaSinScript) {
        patron = 'java';
    } else if (ecosistemaJava) {
        // Busco cuál ecosistema se mencionó.
        if (/\bspring\s*boot\b/i.test(texto)) patron = 'spring_boot';
        else if (/\bj2ee\b/i.test(texto)) patron = 'j2ee';
        else if (/\bjee\b/i.test(texto)) patron = 'jee';
        else if (/\bjakarta\s*ee\b/i.test(texto)) patron = 'jakarta_ee';
        else if (/\bhibernate\b/i.test(texto)) patron = 'hibernate';
    }

    return { detectado, patron };
}

/**
 * Detecta si la oferta pide nivel Senior, SR o Lead.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarSeniorityExcluyente(oferta) {
    const texto = extraerTextoOferta(oferta);

    // Verifico cada patrón de seniority.
    for (const patron of PATRON_SENIORITY_EXCLUYENTE) {
        if (patron.test(texto)) {
            // Identifico qué tipo de seniority se detectó.
            let tipo = 'senior';
            if (/\bsr\b/i.test(texto.replace(/\bsr\.\s/gi, ''))) tipo = 'sr';
            if (/\blead\b/i.test(texto)) tipo = 'lead';

            return { detectado: true, patron: tipo };
        }
    }

    return { detectado: false, patron: null };
}

/**
 * Detecta si la oferta exige experiencia excluyente de 3+ años.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarExperienciaExcluyente(oferta) {
    const texto = extraerTextoOferta(oferta);

    // Eliminar falsos positivos de seniority del texto antes de evaluar.
    // Ejemplo: "3 meses" no es "3 años".
    let textoLimpio = texto;
    const falsosPositivos = [
        /\b(3|tres)\s+(meses|months)\b/i,
        /\b(3|tres)\s+(d[ií]as|days)\b/i,
        /\b(3|tres)\s+(semanas|weeks)\b/i,
        /\bcapacitaci[oó]n\s+de\s+(3|tres)\s+meses\b/i,
    ];
    for (const fp of falsosPositivos) {
        textoLimpio = textoLimpio.replace(fp, '');
    }

    for (const patron of PATRON_EXPERIENCIA_EXCLUYENTE) {
        if (patron.test(textoLimpio)) {
            return { detectado: true, patron: 'experiencia_3_anios' };
        }
    }

    return { detectado: false, patron: null };
}

/**
 * Detecta si la oferta requiere inglés avanzado/fluido/bilingüe como condición excluyente.
 * Solo se activa si el requisito es explícitamente excluyente (no "deseable" o "plus").
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarInglesExcluyente(oferta) {
    const texto = extraerTextoOferta(oferta);

    for (const patron of PATRON_INGLES_EXCLUYENTE) {
        if (patron.test(texto)) {
            return { detectado: true, patron: 'ingles_avanzado' };
        }
    }

    return { detectado: false, patron: null };
}

/**
 * Detecta si la oferta es presencial y está fuera de las zonas preferidas del candidato.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @param {Object} preferencias - Fila de la tabla preferencias.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarUbicacionIncompatible(oferta, preferencias) {
    const modalidad = (oferta.modalidad || '').toLowerCase().trim();
    const zonas = preferencias.zonas_preferidas || [];

    // Solo aplica para ofertas presenciales (no remotas ni híbridas).
    if (modalidad !== 'presencial') {
        return { detectado: false, patron: null };
    }

    // Si no hay zonas preferidas definidas, no se puede excluir por ubicación.
    if (zonas.length === 0) {
        return { detectado: false, patron: null };
    }

    // Verifico si la ubicación de la oferta coincide con alguna zona preferida.
    const ubicacion = (oferta.ubicacion || '').toLowerCase();
    const estaEnZona = zonas.some(zona =>
        ubicacion.includes(zona.toLowerCase())
    );

    if (!estaEnZona) {
        return { detectado: true, patron: 'presencial_fuera_de_zona' };
    }

    return { detectado: false, patron: null };
}

// ──────────────────────────────────────────────────────────────
// Porcentajes de rechazo por regla
// ──────────────────────────────────────────────────────────────

// Cada regla de exclusión tiene un porcentaje fijo bajo.
// ¿Por qué porcentajes bajos? Porque la oferta fue excluida por un criterio
// determinístico — el porcentaje refleja que la oferta no es compatible,
// no que tenga un 10% de compatibilidad. Son valores simbólicos.
const PORCENTAJE_EXCLUSION = {
    java: 10,
    seniority: 15,
    experiencia: 20,
    idioma: 15,
    ubicacion_modalidad: 10,
};

// ──────────────────────────────────────────────────────────────
// Función principal
// ──────────────────────────────────────────────────────────────

/**
 * Evalúa todas las reglas de exclusión determinísticas sobre una oferta.
 *
 * Ejecuta las reglas en orden y devuelve el primer rechazo encontrado,
 * o false si la oferta pasa todas las reglas (y debe evaluarse con IA).
 *
 * El resultado SIEMPRE tiene `match: false` cuando la oferta es excluida,
 * porque las exclusiones determinísticas son incondicionales — ningún
 * bonus de IA o Next.js puede compensarlas.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @param {Object} preferencias - Fila de la tabla preferencias.
 * @returns {{ excluida: boolean, match: boolean, porcentaje: number|null, razon: string, reglas: string[] }}
 */
function evaluarReglasExclusion(oferta, preferencias) {
    const reglasActivadas = [];
    let excluida = false;
    let porcentaje = null;
    let razon = '';

    // Regla 1: Java excluyente (sin confundir con JavaScript).
    const java = detectarJavaExcluyente(oferta);
    if (java.detectado) {
        reglasActivadas.push('java');
        excluida = true;
        porcentaje = PORCENTAJE_EXCLUSION.java;
        razon = `La oferta requiere Java${java.patron && java.patron !== 'java' ? ` (ecosistema: ${java.patron})` : ''} como tecnología principal o excluyente.`;
    }

    // Regla 2: Seniority excluyente (Senior, SR, Lead).
    // Solo verifico si no se activó Java (no se acumulan exclusiones,
    // pero registramos todas las reglas que se activaron).
    const seniority = detectarSeniorityExcluyente(oferta);
    if (seniority.detectado) {
        reglasActivadas.push('seniority');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.seniority;
            razon = 'La oferta requiere nivel Senior, SR o Lead.';
        }
    }

    // Regla 3: Experiencia excluyente (3+ años, al menos 3, mínimo 3, etc.).
    const experiencia = detectarExperienciaExcluyente(oferta);
    if (experiencia.detectado) {
        reglasActivadas.push('experiencia');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.experiencia;
            razon = 'La oferta requiere más de 3 años de experiencia como requisito excluyente.';
        }
    }

    // Regla 4: Inglés excluyente (avanzado, fluido, bilingüe).
    const ingles = detectarInglesExcluyente(oferta);
    if (ingles.detectado) {
        reglasActivadas.push('idioma');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.idioma;
            razon = 'La oferta requiere inglés avanzado, fluido o bilingüe como condición excluyente.';
        }
    }

    // Regla 5: Ubicación/modalidad incompatible (presencial fuera de zona).
    const ubicacion = detectarUbicacionIncompatible(oferta, preferencias);
    if (ubicacion.detectado) {
        reglasActivadas.push('ubicacion_modalidad');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.ubicacion_modalidad;
            razon = `La oferta es presencial en ${(oferta.ubicacion || 'ubicación no especificada')}, fuera de las zonas preferidas.`;
        }
    }

    // Si no se activó ninguna regla, la oferta no es excluida.
    if (!excluida) {
        return {
            excluida: false,
            match: true,  // No hay exclusiones, pasa a evaluación por IA.
            porcentaje: null,
            razon: '',
            reglas: [],
        };
    }

    // Si se activó alguna regla, devuelvo el rechazo con la primera razón
    // y la lista completa de reglas activadas.
    return {
        excluida: true,
        match: false,
        porcentaje,
        razon,
        reglas: reglasActivadas,
    };
}

module.exports = {
    evaluarReglasExclusion,
    // Exporto funciones de detección y constantes para testing unitario.
    _internas: {
        detectarJavaExcluyente,
        detectarSeniorityExcluyente,
        detectarExperienciaExcluyente,
        detectarInglesExcluyente,
        detectarUbicacionIncompatible,
        normalizarTexto,
        extraerTextoOferta,
        PORCENTAJE_EXCLUSION,
        PATRON_JAVA_EXCLUYENTE,
        PATRON_SENIORITY_EXCLUYENTE,
        PATRON_EXPERIENCIA_EXCLUYENTE,
        PATRON_INGLES_EXCLUYENTE,
    },
};