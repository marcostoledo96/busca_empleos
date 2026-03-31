// Servicio de normalización — transforma datos crudos de cada plataforma
// al formato de nuestra tabla `ofertas`.
//
// ¿Por qué un servicio separado para esto? Porque cada plataforma devuelve
// los datos en un formato distinto (LinkedIn dice "companyName", Computrabajo
// dice "company"). Este servicio es el "traductor" que convierte todo a
// nuestro formato unificado. Así el resto de la app no necesita saber de
// dónde vienen los datos — siempre tienen la misma estructura.
//
// Es lo que en ingeniería se llama "normalización": llevar datos de diferentes
// fuentes a un formato común.

/**
 * Normalizo una oferta cruda de LinkedIn al esquema de nuestra tabla `ofertas`.
 *
 * @param {Object} item - Objeto crudo del actor de LinkedIn.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL (campo mínimo obligatorio).
 */
function normalizarOfertaLinkedin(item) {
    const url = item.link;
    if (!url) {
        throw new Error('El item de LinkedIn no tiene URL (campo "link").');
    }

    // Extraigo el salario si viene con formato "$X/yr - $Y/yr".
    const salario = parsearSalario(item.salary);

    return {
        titulo: item.title || null,
        empresa: item.companyName || null,
        ubicacion: item.location || null,
        modalidad: detectarModalidad(item),
        descripcion: item.descriptionText || null,
        url,
        plataforma: 'linkedin',
        nivel_requerido: mapearNivelLinkedin(item.seniorityLevel),
        salario_min: salario.min,
        salario_max: salario.max,
        moneda: salario.moneda,
        fecha_publicacion: item.postedAt ? new Date(item.postedAt) : null,
        datos_crudos: item,
    };
}

/**
 * Normalizo una oferta cruda de Computrabajo al esquema de nuestra tabla `ofertas`.
 *
 * @param {Object} item - Objeto crudo del actor de Computrabajo.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaComputrabajo(item) {
    const url = item.url;
    if (!url) {
        throw new Error('El item de Computrabajo no tiene URL.');
    }

    return {
        titulo: item.title || null,
        empresa: item.company || null,
        ubicacion: item.location || null,
        modalidad: null, // Computrabajo no trae este dato de forma confiable.
        descripcion: item.descriptionText || null,
        url,
        plataforma: 'computrabajo',
        nivel_requerido: null, // Computrabajo no categoriza por nivel.
        salario_min: null,
        salario_max: null,
        moneda: null,
        fecha_publicacion: item.postedDate ? new Date(item.postedDate) : null,
        datos_crudos: item,
    };
}

/**
 * Normalizo un lote de items de una plataforma.
 * Los items que fallan se ignoran (con log de advertencia) para no perder
 * los demás. Es mejor tener 99 ofertas que 0 por un item roto.
 *
 * @param {Object[]} items - Array de objetos crudos.
 * @param {string} plataforma - 'linkedin' o 'computrabajo'.
 * @returns {Object[]} Array de ofertas normalizadas.
 */
function normalizarLote(items, plataforma) {
    if (!items || items.length === 0) {
        return [];
    }

    const normalizador = plataforma === 'linkedin'
        ? normalizarOfertaLinkedin
        : normalizarOfertaComputrabajo;

    const resultados = [];

    for (const item of items) {
        try {
            resultados.push(normalizador(item));
        } catch (error) {
            // Logueo la advertencia pero no freno el proceso.
            console.warn(
                `Normalización: no pude normalizar item de ${plataforma}: ${error.message}`
            );
        }
    }

    return resultados;
}

// === Funciones auxiliares (privadas) ===

/**
 * Detecto la modalidad de trabajo desde los datos de LinkedIn.
 *
 * @param {Object} item - Objeto crudo de LinkedIn.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidad(item) {
    // El campo workRemoteAllowed es el más confiable.
    if (item.workRemoteAllowed === true) {
        return 'remoto';
    }

    // También puedo buscar en workplaceTypes si viene.
    const tipos = item.workplaceTypes || [];
    if (tipos.some(t => /remote/i.test(t))) return 'remoto';
    if (tipos.some(t => /hybrid/i.test(t))) return 'hibrido';
    if (tipos.some(t => /on.?site/i.test(t))) return 'presencial';

    return null;
}

/**
 * Mapeo el nivel de experiencia de LinkedIn a nuestros valores.
 *
 * LinkedIn usa: "Internship", "Entry level", "Associate", "Mid-Senior level",
 *               "Director", "Executive", "Not Applicable".
 *
 * @param {string} nivel - El seniorityLevel de LinkedIn.
 * @returns {string|null} Nuestro nivel normalizado.
 */
function mapearNivelLinkedin(nivel) {
    if (!nivel) return null;

    const nivelLower = nivel.toLowerCase();

    if (nivelLower.includes('internship') || nivelLower.includes('intern')) {
        return 'trainee';
    }
    if (nivelLower.includes('entry')) {
        return 'junior';
    }
    if (nivelLower.includes('associate')) {
        return 'semi-senior';
    }
    if (nivelLower.includes('mid-senior') || nivelLower.includes('mid senior')) {
        return 'senior';
    }

    return null;
}

/**
 * Parseo un string de salario y extraigo min, max y moneda.
 *
 * Formatos comunes de LinkedIn:
 * - "$50,000.00/yr - $70,000.00/yr"
 * - "AR$500,000.00/mo"
 * - "" (vacío = sin dato)
 *
 * @param {string} salarioStr - El string de salario crudo.
 * @returns {{ min: number|null, max: number|null, moneda: string|null }}
 */
function parsearSalario(salarioStr) {
    const vacio = { min: null, max: null, moneda: null };

    if (!salarioStr || salarioStr.trim() === '') {
        return vacio;
    }

    // Detecto la moneda buscando prefijos comunes.
    let moneda = null;
    if (/AR\$/i.test(salarioStr)) {
        moneda = 'ARS';
    } else if (/\$/.test(salarioStr)) {
        moneda = 'USD';
    } else if (/€/.test(salarioStr)) {
        moneda = 'EUR';
    }

    // Extraigo todos los números del string.
    // Ejemplo: "$50,000.00/yr - $70,000.00/yr" → [50000, 70000]
    const numeros = salarioStr.match(/[\d,]+\.?\d*/g);
    if (!numeros || numeros.length === 0) {
        return vacio;
    }

    // Quito las comas de miles y parseo a número.
    const valores = numeros.map(n => parseFloat(n.replace(/,/g, '')));

    return {
        min: valores[0] || null,
        max: valores.length > 1 ? valores[1] : null,
        moneda,
    };
}

module.exports = {
    normalizarOfertaLinkedin,
    normalizarOfertaComputrabajo,
    normalizarLote,
    // Exporto las auxiliares para poder testearlas si hace falta.
    _parsearSalario: parsearSalario,
    _detectarModalidad: detectarModalidad,
    _mapearNivelLinkedin: mapearNivelLinkedin,
};
