// Servicio auxiliar para traducir consultas laborales según las capacidades
// de cada plataforma, preservando frases, siglas técnicas y objetivos laborales.

const EQUIVALENCIAS_LABORALES = Object.freeze({
    'qa manual': ['tester manual'],
    'tester manual': ['qa manual'],
    'soporte it': ['mesa de ayuda', 'help desk'],
    'mesa de ayuda': ['soporte it', 'help desk'],
    'help desk': ['soporte it', 'mesa de ayuda'],
    'frontend angular': ['desarrollador angular'],
    'desarrollador angular': ['frontend angular'],
    'angular': ['frontend angular'],
    'c#': ['c sharp', '.net'],
    'c sharp': ['c#', '.net'],
    '.net': ['c#', 'c sharp'],
});

// Siglas y términos técnicos cortos válidos (<= 2 letras) que no deben eliminarse
const SIGLAS_VALIDAS = new Set(['qa', 'it', 'c#', 'ui', 'ux', 'js', 'ts', 'cs', 'ai', 'go', 'r']);

// Categorías soportadas por la API pública de Remotive
const CATEGORIAS_REMOTIVE = Object.freeze({
    QA: 'qa',
    SOPORTE: 'customer-service',
    DESARROLLO: 'software-dev',
    DATA: 'data',
    DEVOPS: 'devops',
    DISENIO: 'design',
    PRODUCTO: 'product',
});

// Etiquetas representativas soportadas por RemoteOK
const TAGS_SOPORTADOS_REMOTEOK = new Set([
    'qa', 'testing', 'support', 'helpdesk',
    'csharp', 'net', 'dotnet', 'angular', 'react', 'vue',
    'frontend', 'backend', 'fullstack', 'node', 'javascript',
    'typescript', 'sql', 'python', 'devops', 'sysadmin',
    'design', 'mobile', 'ios', 'android',
]);

/**
 * Limpio un término individual preservando caracteres técnicos esenciales (#, +, ., -).
 * Elimino puntuación destructiva (comillas, signos de interrogación, exclamación, etc.).
 *
 * @param {string} termino - Texto del término o frase.
 * @returns {string} Término limpio y sin espacios superfluos.
 */
function sanitizarTermino(termino) {
    if (typeof termino !== 'string') return '';
    return termino
        .trim()
        .replace(/["'`´’“”]/g, '')
        .replace(/[¿?¡!()[\]{}<>]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Determino si un término o frase tiene significado laboral útil y no es solo ruido.
 *
 * @param {string} termino - Término sanitizado.
 * @returns {boolean} True si es utilizable.
 */
function esTerminoUtilizable(termino) {
    if (!termino || typeof termino !== 'string') return false;
    const limpio = termino.trim().toLowerCase();
    if (!limpio) return false;
    // Si contiene caracteres alfanuméricos, al menos una letra o número, o es una sigla válida
    const tieneAlfanumerico = /[a-z0-9áéíóúüñ]/i.test(limpio);
    if (!tieneAlfanumerico) return false;

    // Si tiene 1 o 2 letras, compruebo si es una sigla técnica conocida o si tiene símbolos técnicos
    if (limpio.length <= 2) {
        return SIGLAS_VALIDAS.has(limpio) || limpio === 'c#' || limpio.length >= 2;
    }
    return true;
}

/**
 * Obtengo equivalencias pequeñas y explícitas para un término si existen.
 *
 * @param {string} termino - Término de búsqueda.
 * @returns {string[]} Array de equivalencias sugeridas.
 */
function obtenerEquivalencias(termino) {
    const normalizado = termino.trim().toLowerCase();
    return EQUIVALENCIAS_LABORALES[normalizado] || [];
}

/**
 * Compruebo si un texto contiene un token técnico exacto, respetando signos como # o .
 *
 * @param {string} texto - Texto donde buscar.
 * @param {string} token - Token técnico (ej: 'c#', '.net').
 * @returns {boolean} True si el token aparece como unidad léxica independiente.
 */
function contieneToken(texto, token) {
    if (!texto || !token) return false;
    const escapado = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escapado}(?:[^a-zA-Z0-9_#+]|$)`, 'i');
    return regex.test(texto);
}

/**
 * Obtengo un diccionario de equivalencias sugeridas conocidas para una lista de términos.
 * Estas sugerencias no se aplican automáticamente para no alterar la búsqueda del usuario,
 * pero se informan para revisión y edición desde Preferencias.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {Record<string, string[]>} Diccionario de sugerencias por término.
 */
function obtenerEquivalenciasSugeridas(terminos) {
    const sugerencias = {};
    if (!Array.isArray(terminos)) return sugerencias;
    for (const termino of terminos) {
        if (typeof termino !== 'string') continue;
        const sanitizado = sanitizarTermino(termino);
        const eq = obtenerEquivalencias(sanitizado);
        if (eq.length > 0) {
            sugerencias[termino] = eq;
        }
    }
    return sugerencias;
}

/**
 * Traduzco términos para la plataforma LinkedIn.
 * LinkedIn acepta frases y términos codificados en el parámetro keywords.
 * No muta términos ni aplica equivalencias automáticamente.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ consultas: string[], equivalencias: Record<string, string[]> }}
 */
function traducirParaLinkedin(terminos) {
    const consultas = [];
    const equivalencias = {};

    for (const termino of terminos) {
        const sanitizado = sanitizarTermino(termino);
        if (!sanitizado) continue;
        consultas.push(sanitizado);
    }

    return { consultas, equivalencias };
}

/**
 * Traduzco términos para Bumeran generando URLs seguras.
 * Para C#, como el carácter # trunca la URL en el navegador, uso la equivalencia 'c-sharp'.
 * Para .NET uso 'net'. Para frases uso guiones ('soporte-it', 'qa-manual').
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ urls: string[], consultas: string[], equivalencias: Record<string, string> }}
 */
function traducirParaBumeran(terminos) {
    const urls = [];
    const consultas = [];
    const equivalencias = {};

    for (const termino of terminos) {
        const sanitizado = sanitizarTermino(termino);
        if (!esTerminoUtilizable(sanitizado)) continue;

        let slug = sanitizado.toLowerCase();
        // Traducción de símbolos que rompen URLs de Bumeran
        if (slug === 'c#' || slug.includes('c#')) {
            slug = slug.replace(/c#/g, 'c-sharp');
            equivalencias[termino] = 'c-sharp';
        }
        if (slug.startsWith('.net')) {
            slug = slug.replace(/\.net/g, 'net');
            equivalencias[termino] = 'net';
        }
        if (slug.includes('node.js')) {
            slug = slug.replace(/node\.js/g, 'node-js');
        }

        // Reemplazo espacios y separadores por guiones
        slug = slug
            .replace(/[^a-z0-9áéíóúüñ-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        if (!slug) continue;

        const url = `https://www.bumeran.com.ar/empleos-busqueda-${slug}.html`;
        if (!urls.includes(url)) {
            urls.push(url);
            consultas.push(slug);
        }
    }

    return { urls, consultas, equivalencias };
}

/**
 * Traduzco términos para Indeed.
 * Preservo frases entre comillas para no fragmentar en palabras sueltas con OR.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ query: string, terminosProcesados: string[], equivalencias: Record<string, string> }}
 */
function traducirParaIndeed(terminos) {
    const terminosProcesados = [];
    const equivalencias = {};

    for (const termino of terminos) {
        const sanitizado = sanitizarTermino(termino);
        if (!esTerminoUtilizable(sanitizado)) continue;

        // Si es una frase con espacios, la preservo con comillas para que Indeed busque la frase íntegra
        const consulta = sanitizado.includes(' ') ? `"${sanitizado}"` : sanitizado;
        terminosProcesados.push(consulta);
    }

    const query = terminosProcesados.join(' OR ');
    return { query, terminosProcesados, equivalencias };
}

/**
 * Traduzco términos para Jooble.
 * Jooble recibe frases completas en el parámetro keywords de su API.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ consultas: string[], equivalencias: Record<string, string[]> }}
 */
function traducirParaJooble(terminos) {
    const consultas = [];
    const equivalencias = {};

    for (const termino of terminos) {
        const sanitizado = sanitizarTermino(termino);
        if (!esTerminoUtilizable(sanitizado)) continue;
        consultas.push(sanitizado);
    }

    return { consultas, equivalencias };
}

/**
 * Traduzco términos para Adzuna.
 * Adzuna recibe el parámetro 'what' donde agregamos 'remote' preservando la frase.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ consultas: string[], equivalencias: Record<string, string[]> }}
 */
function traducirParaAdzuna(terminos) {
    const consultas = [];
    const equivalencias = {};

    for (const termino of terminos) {
        const sanitizado = sanitizarTermino(termino);
        if (!esTerminoUtilizable(sanitizado)) continue;

        // Para frases compuestas uso comillas en el parámetro what de Adzuna
        const terminoParaQuery = sanitizado.includes(' ') ? `"${sanitizado}"` : sanitizado;
        consultas.push(terminoParaQuery);
    }

    return { consultas, equivalencias };
}

/**
 * Traduzco términos para Computrabajo.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ urls: string[], consultas: string[], equivalencias: Record<string, string> }}
 */
function traducirParaComputrabajo(terminos) {
    const urls = [];
    const consultas = [];
    const equivalencias = {};

    for (const termino of terminos) {
        const sanitizado = sanitizarTermino(termino);
        if (!esTerminoUtilizable(sanitizado)) continue;

        let formato = sanitizado.toLowerCase();
        if (formato === 'c#' || formato.includes('c#')) {
            formato = formato.replace(/c#/g, 'c-sharp');
            equivalencias[termino] = 'c-sharp';
        }

        const limpio = formato
            .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
            .trim()
            .replace(/[\s-]+/g, '-');

        if (!limpio) continue;

        const url = `https://www.computrabajo.com.ar/trabajo-de-${limpio}`;
        urls.push(url);
        consultas.push(limpio);
    }

    return { urls, consultas, equivalencias };
}

/**
 * Mapeo términos a categorías reales de Remotive.
 * Si un término no tiene categoría compatible (ej: administrativo de salud), lo señalo.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ categorias: string[], advertencias: string[], compatible: boolean }}
 */
function traducirParaRemotive(terminos) {
    const categorias = new Set();
    const advertencias = [];
    const noCompatibles = [];

    for (const termino of terminos) {
        const t = sanitizarTermino(termino).toLowerCase();
        if (!esTerminoUtilizable(t)) continue;

        if (/\b(qa|tester|testing|calidad)\b/i.test(t)) {
            categorias.add(CATEGORIAS_REMOTIVE.QA);
        } else if (/\b(soporte|help\s*desk|mesa\s*de\s*ayuda|customer|support)\b/i.test(t)) {
            categorias.add(CATEGORIAS_REMOTIVE.SOPORTE);
        } else if (
            /\b(dev|developer|desarrollador|programador|frontend|backend|angular|react|node|javascript|typescript|software)\b/i.test(t) ||
            /full\s*stack/i.test(t) ||
            t.includes('fullstack') ||
            contieneToken(t, 'c#') ||
            contieneToken(t, '.net') ||
            contieneToken(t, 'net') ||
            contieneToken(t, 'c sharp') ||
            contieneToken(t, 'dotnet')
        ) {
            categorias.add(CATEGORIAS_REMOTIVE.DESARROLLO);
        } else if (/\b(data|datos|sql|analytics|bi)\b/i.test(t)) {
            categorias.add(CATEGORIAS_REMOTIVE.DATA);
        } else if (/\b(devops|sysadmin|infraestructura|cloud)\b/i.test(t)) {
            categorias.add(CATEGORIAS_REMOTIVE.DEVOPS);
        } else {
            noCompatibles.push(termino);
        }
    }

    if (noCompatibles.length > 0) {
        advertencias.push(`Remotive no dispone de categoría para: ${noCompatibles.join(', ')}.`);
    }

    const resultadoCategorias = [...categorias];
    const compatible = resultadoCategorias.length > 0;

    return {
        categorias: resultadoCategorias,
        advertencias,
        compatible,
    };
}

/**
 * Mapeo términos a etiquetas (tags) soportadas por RemoteOK.
 *
 * @param {string[]} terminos - Lista de términos.
 * @returns {{ tags: string[], advertencias: string[], compatible: boolean }}
 */
function traducirParaRemoteOK(terminos) {
    const tags = new Set();
    const advertencias = [];
    const noCompatibles = [];

    for (const termino of terminos) {
        const t = sanitizarTermino(termino).toLowerCase();
        if (!esTerminoUtilizable(t)) continue;

        let encontroTag = false;

        if (/\b(qa|tester|testing)\b/i.test(t)) {
            tags.add('qa');
            encontroTag = true;
        }
        if (/\b(soporte|help\s*desk|mesa\s*de\s*ayuda|support)\b/i.test(t)) {
            tags.add('support');
            encontroTag = true;
        }
        if (contieneToken(t, 'c#') || t.includes('c sharp') || t.includes('csharp')) {
            tags.add('csharp');
            encontroTag = true;
        }
        if (contieneToken(t, '.net') || contieneToken(t, 'net') || t.includes('dotnet')) {
            tags.add('net');
            tags.add('dotnet');
            encontroTag = true;
        }
        if (t.includes('angular')) {
            tags.add('angular');
            encontroTag = true;
        }
        if (t.includes('react')) {
            tags.add('react');
            encontroTag = true;
        }
        if (t.includes('node')) {
            tags.add('node');
            encontroTag = true;
        }
        if (t.includes('frontend')) {
            tags.add('frontend');
            encontroTag = true;
        }
        if (t.includes('backend')) {
            tags.add('backend');
            encontroTag = true;
        }
        if (/full\s*stack/i.test(t) || t.includes('fullstack')) {
            tags.add('fullstack');
            encontroTag = true;
        }
        if (t.includes('javascript') || /\bjs\b/i.test(t)) {
            tags.add('javascript');
            encontroTag = true;
        }
        if (t.includes('typescript') || /\bts\b/i.test(t)) {
            tags.add('typescript');
            encontroTag = true;
        }
        if (t.includes('sql') || t.includes('database')) {
            tags.add('sql');
            encontroTag = true;
        }
        if (t.includes('python')) {
            tags.add('python');
            encontroTag = true;
        }
        if (t.includes('devops') || t.includes('sysadmin')) {
            tags.add('devops');
            encontroTag = true;
        }

        if (!encontroTag) {
            noCompatibles.push(termino);
        }
    }

    if (noCompatibles.length > 0) {
        advertencias.push(`RemoteOK no dispone de etiquetas compatibles para: ${noCompatibles.join(', ')}.`);
    }

    const resultadoTags = [...tags];
    const compatible = resultadoTags.length > 0;

    return {
        tags: resultadoTags,
        advertencias,
        compatible,
    };
}

module.exports = {
    sanitizarTermino,
    esTerminoUtilizable,
    obtenerEquivalencias,
    obtenerEquivalenciasSugeridas,
    contieneToken,
    traducirParaLinkedin,
    traducirParaBumeran,
    traducirParaIndeed,
    traducirParaJooble,
    traducirParaAdzuna,
    traducirParaComputrabajo,
    traducirParaRemotive,
    traducirParaRemoteOK,
    EQUIVALENCIAS_LABORALES,
    SIGLAS_VALIDAS,
};
