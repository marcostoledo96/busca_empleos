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
 * Normalizo una oferta cruda de Indeed al esquema de nuestra tabla `ofertas`.
 *
 * Indeed trae los datos en una estructura distinta a LinkedIn y Computrabajo:
 * - La ubicación viene separada en `location.city` y `location.countryName`.
 * - La modalidad y el nivel vienen como valores dentro de `attributes` (un objeto key-value).
 * - El salario viene en `baseSalary` con `min`, `max` y `currencyCode`.
 * - En Argentina, si `location.city` es "Desde casa", significa remoto.
 *
 * @param {Object} item - Objeto crudo del actor de Indeed.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaIndeed(item) {
    const url = item.url;
    if (!url) {
        throw new Error('El item de Indeed no tiene URL.');
    }

    // Construyo la ubicación combinando ciudad y país.
    const ciudad = item.location?.city || null;
    const pais = item.location?.countryName || null;
    const ubicacion = [ciudad, pais].filter(Boolean).join(', ') || null;

    // Detecto la modalidad de trabajo desde los datos de Indeed.
    const modalidad = detectarModalidadIndeed(item);

    // Detecto el nivel de experiencia desde los atributos.
    const nivelRequerido = detectarNivelIndeed(item);

    // Extraigo el salario si viene en baseSalary.
    const salarioMin = item.baseSalary?.min || null;
    const salarioMax = item.baseSalary?.max || null;
    const moneda = item.baseSalary?.currencyCode || null;

    return {
        titulo: item.title || null,
        empresa: item.employer?.name || null,
        ubicacion,
        modalidad,
        descripcion: item.description?.text || null,
        url,
        plataforma: 'indeed',
        nivel_requerido: nivelRequerido,
        salario_min: salarioMin,
        salario_max: salarioMax,
        moneda,
        fecha_publicacion: item.datePublished ? new Date(item.datePublished) : null,
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

    // Uso un mapa de normalizadores para elegir la función correcta
    // según la plataforma. Así es fácil agregar nuevas plataformas.
    const normalizadores = {
        linkedin: normalizarOfertaLinkedin,
        computrabajo: normalizarOfertaComputrabajo,
        indeed: normalizarOfertaIndeed,
        bumeran: normalizarOfertaBumeran,
    };

    const normalizador = normalizadores[plataforma];
    if (!normalizador) {
        throw new Error(`Plataforma desconocida: ${plataforma}`);
    }

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
 * Detecto la modalidad de trabajo desde los datos de Indeed.
 *
 * En Argentina, Indeed pone "Desde casa" como ciudad cuando es remoto.
 * También puede venir en los atributos como "Remote", "In-person" o "Hybrid work".
 *
 * @param {Object} item - Objeto crudo de Indeed.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidadIndeed(item) {
    // En Argentina, "Desde casa" en location.city indica trabajo remoto.
    if (item.location?.city === 'Desde casa') {
        return 'remoto';
    }

    // Busco en los atributos del item (es un objeto key-value con códigos como claves).
    const atributos = item.attributes || {};
    const valores = Object.values(atributos);

    if (valores.some(v => /^remote$/i.test(v))) return 'remoto';
    if (valores.some(v => /hybrid/i.test(v))) return 'hibrido';
    if (valores.some(v => /in.?person/i.test(v))) return 'presencial';

    return null;
}

/**
 * Detecto el nivel de experiencia desde los atributos de Indeed.
 *
 * Indeed usa valores como "Entry level", "Senior level", "Mid level"
 * dentro del objeto `attributes`.
 *
 * @param {Object} item - Objeto crudo de Indeed.
 * @returns {string|null} 'junior', 'senior', 'semi-senior' o null.
 */
function detectarNivelIndeed(item) {
    const atributos = item.attributes || {};
    const valores = Object.values(atributos);

    if (valores.some(v => /entry.?level/i.test(v))) return 'junior';
    if (valores.some(v => /senior.?level/i.test(v))) return 'senior';
    if (valores.some(v => /mid.?level/i.test(v))) return 'semi-senior';

    return null;
}

/**
 * Normalizo una oferta extraída por la pageFunction del cheerio-scraper de Bumeran.
 *
 * A diferencia de los otros normalizadores, los datos de Bumeran ya vienen
 * semi-estructurados porque la pageFunction los extrae con selectores CSS.
 * Lo que queda por hacer acá es:
 * - Mapear la modalidad de texto español ("Remoto") a nuestro formato ("remoto").
 * - Completar los campos que la tarjeta de búsqueda no tiene (salario, nivel, fecha).
 * - Agregar la plataforma y guardar los datos crudos.
 *
 * @param {Object} item - Objeto extraído por la pageFunction.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaBumeran(item) {
    const url = item.url;
    if (!url) {
        throw new Error('El item de Bumeran no tiene URL.');
    }

    return {
        titulo: item.titulo || null,
        empresa: item.empresa || null,
        ubicacion: item.ubicacion || null,
        modalidad: mapearModalidadBumeran(item.modalidad),
        descripcion: item.descripcion || null,
        url,
        plataforma: 'bumeran',
        // La tarjeta de búsqueda de Bumeran no muestra nivel, salario ni fecha exacta.
        // DeepSeek puede inferir el nivel desde la descripción.
        nivel_requerido: null,
        salario_min: null,
        salario_max: null,
        moneda: null,
        fecha_publicacion: null,
        datos_crudos: item,
    };
}

/**
 * Mapeo la modalidad de Bumeran (texto en español) a nuestros valores normalizados.
 *
 * Bumeran muestra la modalidad como etiqueta explícita en la tarjeta:
 * "Remoto", "Híbrido", "Presencial". Los mapeo a nuestro formato en minúscula
 * sin tildes.
 *
 * @param {string|null} modalidad - Modalidad de Bumeran.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function mapearModalidadBumeran(modalidad) {
    if (!modalidad) return null;

    const modalidadLower = modalidad.toLowerCase();

    if (modalidadLower.includes('remoto')) return 'remoto';
    if (modalidadLower.includes('híbrido') || modalidadLower.includes('hibrido')) return 'hibrido';
    if (modalidadLower.includes('presencial')) return 'presencial';

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
    normalizarOfertaIndeed,
    normalizarOfertaBumeran,
    normalizarLote,
    // Exporto las auxiliares para poder testearlas si hace falta.
    _parsearSalario: parsearSalario,
    _detectarModalidad: detectarModalidad,
    _mapearNivelLinkedin: mapearNivelLinkedin,
    _detectarModalidadIndeed: detectarModalidadIndeed,
    _detectarNivelIndeed: detectarNivelIndeed,
    _mapearModalidadBumeran: mapearModalidadBumeran,
};
