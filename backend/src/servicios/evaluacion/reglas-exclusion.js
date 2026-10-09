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

// Seniority excluyente: Senior, SR, y roles de liderazgo (Tech Lead, Team Lead, etc.).
// Se elimina el patrón `\blead\b` genérico porque causa falsos positivos:
// "lead initiatives", "lead generation" (marketing), etc. En su lugar, se
// detectan solo los títulos de rol que implican seniority de liderazgo.
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
    /\bl[ií]der\b/i,
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
    // Aplico el mismo umbral a cantidades mayores, no solamente 4/5.
    /\bmayor\s+(a|de)\s+[45]\s*(años?|anos?|years?|yr)\b/i,
    /\b(?:[6-9]|\d{2,})\s*\+\s*(años?|anos?|years?|yr)\b/i,
    /(?:>|\b(?:al\s+menos|minimo|at\s+least|minimum|mas\s+de|mayor\s+(?:a|de)))\s*(?:[4-9]|\d{2,})\s*(años?|anos?|years?|yr)\b/i,
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
    return detectarRequisito(oferta, PATRON_JAVA_EXCLUYENTE, ['java', 'spring_boot', 'j2ee', 'jee', 'jakarta_ee', 'hibernate'], 'java');
}

/* Sustituyo las menciones globales por evidencia local del requisito.
 * ponytail: uso cláusulas y vocabulario acotado; lo ambiguo sigue hacia IA,
 * no intento resolver dependencias gramaticales generales.
 */
function extraerClausulas(oferta) {
    const crudos = oferta.datos_crudos && typeof oferta.datos_crudos === 'object' ? oferta.datos_crudos : {};
    const fuentes = [
        [oferta.titulo, true],
        [oferta.descripcion, false],
        ...['description', 'descriptionHtml', 'jobDescription', 'job_description', 'requirements', 'requisitos']
            .map(campo => [crudos[campo], false, /^(?:requirements|requisitos)$/.test(campo)]),
    ];
    return fuentes.flatMap(([texto, titulo, campoRequisitos = false]) => {
        let seccion = null;
        let requisitosActivos = campoRequisitos;
        // Conservo límites de párrafos/listas antes de normalizar espacios.
        const conLimites = String(texto || '').replace(/•|<li\b[^>]*>/gi, '\n- ')
            .replace(/<\/?(?:p|div|li|ul|ol|br|h[1-6])\b[^>]*>/gi, '\n');
        return conLimites.split(/[.!?;\n]+|\b(?:pero|but|sin embargo)\b|\b[ye]\s+(?=(?:buscamos|somos|se\s+busca)\b)/i)
            .flatMap(oracion => {
                const encabezado = normalizarTexto(oracion);
                if (!encabezado) return [];
                const encabezadoRequisitos = /^(?:requisitos|requirements)(?:\s+(?:obligatorios?|excluyentes?|mandatory|required|deseables?|opcionales?|optional|preferred|nice\s+to\s+have))?:?$/.test(encabezado);
                if (encabezadoRequisitos || /^[\w\s-]+:$/.test(encabezado)) {
                    seccion = PATRON_OPCIONAL.test(encabezado) ? 'opcional'
                        : encabezadoRequisitos ? 'obligatoria' : null;
                    requisitosActivos = encabezadoRequisitos;
                    return [];
                }
                // Heredo filas breves de requisitos, no párrafos narrativos.
                const sujetoNarrativo = PATRON_EMPRESA.test(encabezado) || PATRON_MENTORIA.test(encabezado)
                    || /\b(?:producto|product|equipo|team)\b/.test(encabezado);
                const item = !sujetoNarrativo && (/^\s*-/.test(oracion) || (encabezado.split(' ').length <= 12
                    && /^(?:java|spring|j2ee|jee|jakarta|hibernate|angular|typescript|ingles|english|experiencia|puesto|senior|\d)\b/.test(encabezado)));
                if (!item) {
                    seccion = null;
                    requisitosActivos = false;
                }
                let modificadorCompartido = seccion === 'opcional';
                const coordinada = oracion.replace(/\bcon\b/gi, (con, indice) =>
                    PATRON_OBLIGATORIO.test(normalizarTexto(oracion.slice(0, indice))) || PATRON_OPCIONAL.test(normalizarTexto(oracion.slice(0, indice))) ? ',' : con);
                // Separo coordinaciones por señales, no por frases de prefijos.
                // Los sufijos sin señal ("no excluyente") siguen con su requisito.
                const fragmentos = [];
                for (const parte of coordinada.split(/,|\b[ye]\b|\band\b/i)) {
                    if (fragmentos.length && !PATRON_SENAL.test(normalizarTexto(parte))) {
                        fragmentos[fragmentos.length - 1] += `, ${parte}`;
                    } else {
                        fragmentos.push(parte);
                    }
                }
                return fragmentos.map(fragmento => {
                        const texto = normalizarTexto(fragmento).replace(/^[-\s]+/, '');
                        const opcional = PATRON_OPCIONAL.test(texto) || PATRON_NEGACION.test(texto);
                        // Una lista comparte su modificador, salvo requisito propio explícito.
                        const omitida = opcional || (modificadorCompartido && !PATRON_OBLIGATORIO.test(texto));
                        modificadorCompartido = omitida;
                        return { texto, titulo, omitida, obligatorioHeredado: seccion === 'obligatoria', campoRequisitos: requisitosActivos };
                    });
            })
            .filter(clausula => clausula.texto);
    });
}

const PATRON_SENAL = /\b(?:java|spring|j2ee|jee|jakarta|hibernate|ingles|english|bilingual|bilingue|senior|sr|lead|lider|experiencia|experience|candidat\w*|\d+\s*\+?\s*(?:anos?|years?))\b/;
const PATRON_OPCIONAL = /\b(?:deseables?|opcional(?:es)?|plus|preferible|preferentemente|valorable|nice\s+to\s+have|optional|preferred)\b|\bno\s+(?:es\s+)?(?:excluyente|obligatori[oa]|requerid[oa]|necesari[oa])\b/;
const PATRON_NEGACION = /\b(?:no\s+(?:se\s+)?(?:requiere\w*|exige\w*|necesita\w*|pedimos)|sin\s+(?:necesidad|experiencia)|not\s+required|do\s+not\s+require)\b/;
const PATRON_OBLIGATORIO = /\b(?:requiere\w*|requerid\w*|requisito\w*|obligatori\w*|excluyente\w*|exige\w*|imprescindible\w*|required|mandatory|must|need)\b/;
const PATRON_ROL = /\b(?:desarrollador\w*|developer|engineer|ingenier\w*|puesto|posicion|rol|perfil|candidat\w*)\b/;
const PATRON_MENTORIA = /\b(?:mentor\w*|aprend\w*|junto\s+a|acompan\w*|guiad\w*|reportar\w*|report\s+to)\b/;
const PATRON_EMPRESA = /\b(?:empresa|compania|organizacion|mercado|trayectoria|company|founded)\b/;

function esRequisito(clausula, tipo, coincidencia) {
    const { texto, titulo, omitida, obligatorioHeredado, campoRequisitos } = clausula;
    if (omitida) return false;

    const obligatorio = obligatorioHeredado || PATRON_OBLIGATORIO.test(texto);
    const antes = texto.slice(0, coincidencia.index);
    const ultimoRol = [...antes.matchAll(new RegExp(PATRON_ROL.source, 'g'))].at(-1)?.index ?? -1;
    const ultimaEmpresa = [...antes.matchAll(new RegExp(PATRON_EMPRESA.source, 'g'))].at(-1)?.index ?? -1;
    const rol = PATRON_ROL.test(texto);
    if (tipo === 'experiencia') {
        // La antigüedad empresarial no describe experiencia del postulante.
        const despuesCantidad = texto.slice(coincidencia.index + coincidencia[0].length);
        if (/^\s+(?:de\s+trayectoria|en\s+el\s+mercado|de\s+(?:la\s+)?empresa)\b/.test(despuesCantidad)) return false;
        const ultimaExigencia = [...antes.matchAll(new RegExp(PATRON_OBLIGATORIO.source, 'g'))].at(-1)?.index ?? -1;
        if (ultimaEmpresa > Math.max(ultimoRol, ultimaExigencia)) return false;
        return /\b(?:experiencia|experience)\b/.test(texto) || obligatorio;
    }
    if (tipo === 'seniority') {
        // El sujeto anterior a la señal distingue candidato de empresa/mentor;
        // acompañar juniors DESPUÉS del nivel no vuelve opcional el puesto Senior.
        const despues = texto.slice(coincidencia.index + coincidencia[0].length);
        if (/^\s+(?:equipo|team|profesionales)\b/.test(despues)) return false;
        const ultimoEquipo = [...antes.matchAll(/\b(?:equipo|team|profesionales)\b/g)].at(-1)?.index ?? -1;
        if (ultimoEquipo > ultimoRol) return false;
        const ultimaMentoria = [...antes.matchAll(new RegExp(PATRON_MENTORIA.source, 'g'))].at(-1)?.index ?? -1;
        const rolMentor = ultimaMentoria >= 0 && ultimoRol > ultimaMentoria
            && /^(?:junto\s+a|report\s+to|reportar\w*\s+a|guiad\w*\s+por)\b/.test(antes.slice(ultimaMentoria));
        if (rolMentor || ultimaMentoria > ultimoRol || ultimaEmpresa > ultimoRol) return false;
        const rolLocal = ultimoRol >= 0 || /^\s+(?:developer|engineer|desarrollador\w*)\b/.test(despues);
        return titulo || obligatorio || rolLocal || /^(?:buscamos\s+|se\s+busca\s+)?(?:senior|sr|tech\s+lead|team\s+lead|lider\s+de\s+equipo|lead\s+(?:developer|engineer))\b/.test(texto);
    }
    if (tipo === 'java') return titulo || obligatorio || (campoRequisitos && /^(?:java|spring\s*boot|j2ee|jee|jakarta\s*ee|hibernate)\b/.test(texto)) || rol || /\b(?:experiencia|conocimientos)\s+(?:en|con|de)\b/.test(texto);
    // Un nivel lingüístico declarado sin condición opcional es un requisito;
    // las menciones narrativas sin evidencia quedan para IA.
    return obligatorio || rol || /^(?:ingles|english|fluent|conversational|upper.?intermediate|bilingual|bilingue)\b/.test(texto)
        || /\b(?:daily\s+(?:standups?|meetings?)\s+in\s+english|join\s+our\s+english.?speaking\s+team)\b/.test(texto);
}

function detectarRequisito(oferta, patrones, nombres, tipo) {
    for (const clausula of extraerClausulas(oferta)) {
        for (const [indice, patron] of patrones.entries()) {
            // Evalúo cada aparición: un mentor anterior no define otro puesto.
            for (const coincidencia of clausula.texto.matchAll(new RegExp(patron.source, 'gi'))) {
                if (esRequisito(clausula, tipo, coincidencia)) {
                    const inicio = Math.max(0, coincidencia.index - 100);
                    const fin = Math.min(clausula.texto.length, inicio + 240);
                    const evidencia = `${inicio ? '…' : ''}${clausula.texto.slice(inicio, fin)}${fin < clausula.texto.length ? '…' : ''}`;
                    return { detectado: true, patron: nombres[indice] || nombres[0], evidencia };
                }
            }
        }
    }
    return { detectado: false, patron: null };
}

/**
 * Detecta si la oferta pide nivel Senior, SR o un rol de liderazgo (Lead, Líder).
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarSeniorityExcluyente(oferta) {
    const patronesConNombre = [
        { patron: /\bsenior\b/i, nombre: 'senior' },
        { patron: /\bsr\b(?!\.)[\s.,;:)]/i, nombre: 'sr' },
        { patron: /\bsr[\s.,;:)]/i, nombre: 'sr' },
        { patron: /\bsr$/im, nombre: 'sr' },
        { patron: /\btech\s*lead\b/i, nombre: 'tech_lead' },
        { patron: /\bteam\s*lead\b/i, nombre: 'team_lead' },
        { patron: /\bengineering\s*lead\b/i, nombre: 'engineering_lead' },
        { patron: /\blead\s+developer\b/i, nombre: 'lead_developer' },
        { patron: /\blead\s+engineer\b/i, nombre: 'lead_engineer' },
        { patron: /\bl[ií]der\b/i, nombre: 'lider' },
    ];

    return detectarRequisito(oferta, patronesConNombre.map(item => item.patron), patronesConNombre.map(item => item.nombre), 'seniority');
}

/**
 * Detecta si la oferta exige experiencia excluyente de 3+ años.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarExperienciaExcluyente(oferta) {
    return detectarRequisito(oferta, PATRON_EXPERIENCIA_EXCLUYENTE, ['experiencia_3_anios'], 'experiencia');
}

/**
 * Detecta si la oferta requiere inglés avanzado/fluido/bilingüe como condición excluyente.
 * Solo se activa si el requisito es explícitamente excluyente (no "deseable" o "plus").
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {{ detectado: boolean, patron: string|null }}
 */
function detectarInglesExcluyente(oferta) {
    return detectarRequisito(oferta, PATRON_INGLES_EXCLUYENTE, ['ingles_avanzado'], 'idioma');
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
        razon = `La oferta requiere Java${java.patron && java.patron !== 'java' ? ` (ecosistema: ${java.patron})` : ''} como tecnología principal o excluyente. Evidencia: «${java.evidencia}».`;
    }

    // Regla 2: Seniority excluyente (Senior, SR, roles de liderazgo).
    // Solo verifico si no se activó Java (no se acumulan exclusiones,
    // pero registramos todas las reglas que se activaron).
    const seniority = detectarSeniorityExcluyente(oferta);
    if (seniority.detectado) {
        reglasActivadas.push('seniority');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.seniority;
            // Mencionar el tipo de seniority detectado en la razón.
            const detalleSeniority = {
                senior: 'Senior',
                sr: 'SR',
                tech_lead: 'Tech Lead',
                team_lead: 'Team Lead',
                engineering_lead: 'Engineering Lead',
                lead_developer: 'Lead Developer',
                lead_engineer: 'Lead Engineer',
                lider: 'Líder',
            }[seniority.patron] || seniority.patron;
            razon = `La oferta requiere nivel ${detalleSeniority}, incompatible con perfil junior/trainee. Evidencia: «${seniority.evidencia}».`;
        }
    }

    // Regla 3: Experiencia excluyente (3+ años, al menos 3, mínimo 3, etc.).
    const experiencia = detectarExperienciaExcluyente(oferta);
    if (experiencia.detectado) {
        reglasActivadas.push('experiencia');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.experiencia;
            razon = `La oferta requiere 3 o más años de experiencia como requisito excluyente (3+, >3, mínimo 3, más de 3), incompatible con perfil junior/trainee. Evidencia: «${experiencia.evidencia}».`;
        }
    }

    // Regla 4: Inglés excluyente (avanzado, fluido, bilingüe).
    const ingles = detectarInglesExcluyente(oferta);
    if (ingles.detectado) {
        reglasActivadas.push('idioma');
        if (!excluida) {
            excluida = true;
            porcentaje = PORCENTAJE_EXCLUSION.idioma;
            razon = `La oferta requiere inglés avanzado, fluido o bilingüe como condición excluyente. Evidencia: «${ingles.evidencia}».`;
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