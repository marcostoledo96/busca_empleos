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
 * Sanitizo una fecha comprobando validez y límites temporales razonables.
 * Si es inválida (NaN), nula, o en el futuro improbable (> 24 horas), devuelvo null.
 * Nunca devuelvo un objeto Invalid Date ni un string corrupto.
 *
 * @param {Date|string|number|null|undefined} fecha - Fecha a evaluar.
 * @param {Date} [ahora=new Date()] - Fecha actual de referencia.
 * @returns {Date|null} Objeto Date válido o null.
 */
function sanitizarFecha(fecha, ahora = new Date()) {
    if (fecha === null || fecha === undefined || fecha === '') return null;
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    const ms = d.getTime();
    if (Number.isNaN(ms)) return null;
    const limiteFuturo = ahora.getTime() + 24 * 60 * 60 * 1000;
    if (ms > limiteFuturo) return null;
    return d;
}

/**
 * Interpreto expresiones temporales relativas comunes en español emitidas por Computrabajo:
 * - "Hace X horas" / "Hace X hora" → ahora - X * 3600000
 * - "Hace X días" / "Hace X dia" / "Hace X dias" → ahora - X * 86400000
 * - "Hace X semanas" / "Hace X semana" → ahora - X * 7 * 86400000
 * - "Ayer" → ahora - 86400000
 * - "Hoy" → ahora
 *
 * Si la expresión es desconocida, ambigua o vacía, devuelvo null.
 *
 * @param {string|null|undefined} texto - Expresión temporal en español.
 * @param {Date} [ahora=new Date()] - Momento actual de referencia.
 * @returns {Date|null} Fecha aproximada calculada o null.
 */
function parsearFechaRelativaComputrabajo(texto, ahora = new Date()) {
    if (!texto || typeof texto !== 'string') return null;
    const normalizado = texto
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (/\bhoy\b/.test(normalizado)) {
        return new Date(ahora.getTime());
    }

    if (/\bayer\b/.test(normalizado)) {
        return new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    }

    const matchHoras = normalizado.match(/hace\s+(\d+)\s*hora/);
    if (matchHoras) {
        const horas = parseInt(matchHoras[1], 10);
        return new Date(ahora.getTime() - horas * 3600000);
    }

    const matchDias = normalizado.match(/hace\s+(\d+)\s*dia/);
    if (matchDias) {
        const dias = parseInt(matchDias[1], 10);
        return new Date(ahora.getTime() - dias * 86400000);
    }

    const matchSemanas = normalizado.match(/hace\s+(\d+)\s*semana/);
    if (matchSemanas) {
        const semanas = parseInt(matchSemanas[1], 10);
        return new Date(ahora.getTime() - semanas * 7 * 86400000);
    }

    const matchMeses = normalizado.match(/hace\s+(\d+)\s*mes/);
    if (matchMeses) {
        const meses = parseInt(matchMeses[1], 10);
        return new Date(ahora.getTime() - meses * 30 * 86400000);
    }

    return null;
}

/**
 * Normalizo una oferta cruda de LinkedIn al esquema de nuestra tabla `ofertas`.
 *
 * Soporta dos schemas de actor:
 *
 * Actor viejo (curious_coder/linkedin-jobs-scraper):
 *   url → item.link | título → item.title | nivel → item.seniorityLevel
 *   descripción → item.descriptionText | fecha → item.postedAt
 *
 * Actor nuevo (cheap_scraper/linkedin-job-scraper):
 *   url → item.jobUrl | título → item.jobTitle | nivel → item.experienceLevel
 *   descripción → item.jobDescription | fecha → item.publishedAt
 *   modalidad → item.workType (además de item.workRemoteAllowed)
 *
 * El dual-schema permite migrar de actor sin romper datos ya guardados,
 * y también funciona si por algún motivo Apify devuelve un mix de formatos.
 *
 * @param {Object} item - Objeto crudo del actor de LinkedIn.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL (campo mínimo obligatorio).
 */
function normalizarOfertaLinkedin(item) {
    // Actor nuevo usa jobUrl; actor viejo usa link. Priorizo el nuevo.
    const urlCruda = item.jobUrl || item.link;
    if (!urlCruda) {
        throw new Error('El item de LinkedIn no tiene URL (campo "jobUrl" ni "link").');
    }

    // Canonizo la URL: remuevo query params y fragments para deduplicar.
    // LinkedIn agrega parámetros de tracking como ?refId=abc que cambian
    // entre runs, causando duplicados en la tabla ofertas (UNIQUE(url)).
    const url = canonizarUrlLinkedin(urlCruda);

    // Título: actor nuevo → jobTitle; actor viejo → title.
    const titulo = item.jobTitle || item.title || null;

    // Descripción: actor nuevo → jobDescription; actor viejo → descriptionText.
    const descripcion = item.jobDescription || item.descriptionText || null;

    // Nivel: actor nuevo → experienceLevel; actor viejo → seniorityLevel.
    const nivelCrudo = item.experienceLevel || item.seniorityLevel || null;

    // Fecha: actor nuevo → publishedAt; actor viejo → postedAt.
    const fechaCruda = item.publishedAt || item.postedAt || null;

    // Salario: ambos actores usan item.salary (string libre).
    const salario = parsearSalario(item.salary || item.salaryInfo || '');

    return {
        titulo,
        empresa: item.companyName || null,
        ubicacion: item.location || null,
        modalidad: detectarModalidad(item),
        descripcion,
        url,
        plataforma: 'linkedin',
        nivel_requerido: mapearNivelLinkedin(nivelCrudo),
        salario_min: salario.min,
        salario_max: salario.max,
        moneda: salario.moneda,
        fecha_publicacion: sanitizarFecha(fechaCruda),
        datos_crudos: item,
    };
}

/**
 * Normalizo una oferta cruda de Computrabajo al esquema de nuestra tabla `ofertas`.
 *
 * @param {Object} item - Objeto crudo del actor de Computrabajo.
 * @param {Date} [ahora=new Date()] - Momento actual para cálculo relativo.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function mapearModalidadComputrabajo(modalidadDetalle) {
    if (!modalidadDetalle || typeof modalidadDetalle !== 'string') return null;
    const m = modalidadDetalle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (/\b(?:no\s+remoto|sin\s+posibilidad\s+de\s+remoto)\b/i.test(m)) return null;
    if (m.includes('hibrido')) return 'hibrido';
    if (m.includes('remoto')) return 'remoto';
    if (m.includes('presencial')) return 'presencial';
    return null;
}

function normalizarOfertaComputrabajo(item, ahora = new Date()) {
    const url = item.url;
    if (!url) {
        throw new Error('El item de Computrabajo no tiene URL.');
    }

    const fechaTexto = item.fechaTexto || (typeof item.postedDate === 'string' && isNaN(new Date(item.postedDate).getTime()) ? item.postedDate : null);
    let fechaCalculada = null;
    let fechaAproximada = false;

    if (fechaTexto) {
        fechaCalculada = parsearFechaRelativaComputrabajo(fechaTexto, ahora);
        if (fechaCalculada) {
            fechaAproximada = true;
        }
    }

    if (!fechaCalculada && item.postedDate) {
        fechaCalculada = sanitizarFecha(item.postedDate, ahora);
    }

    // Conservo siempre fechaTexto y marca de aproximación dentro de datos_crudos
    const datosCrudos = {
        ...item,
        ...(fechaTexto && item.fechaTexto === undefined ? { fechaTexto } : {}),
        ...(fechaAproximada ? { fechaAproximada: true } : {}),
    };

    return {
        titulo: item.title || null,
        empresa: item.company || null,
        ubicacion: item.location || null,
        // Con el scraping directo (cheerio) extraemos la modalidad del detalle.
        // Con el actor de Apify (legacy) este campo no estaba disponible.
        modalidad: mapearModalidadComputrabajo(item.modalidadDetalle),
        descripcion: item.descriptionText || null,
        url,
        plataforma: 'computrabajo',
        nivel_requerido: null, // Computrabajo no categoriza por nivel.
        salario_min: null,
        salario_max: null,
        moneda: null,
        fecha_publicacion: sanitizarFecha(fechaCalculada, ahora),
        fecha_publicacion_aproximada: fechaAproximada,
        datos_crudos: datosCrudos,
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
        fecha_publicacion: sanitizarFecha(item.datePublished),
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
        glassdoor: normalizarOfertaGlassdoor,
        getonbrd: normalizarOfertaGetonbrd,
        jooble: normalizarOfertaJooble,
        google_jobs: normalizarOfertaGoogleJobs,
        remotive: normalizarOfertaRemotive,
        remoteok: normalizarOfertaRemoteOK,
        infojobs: normalizarOfertaInfojobs,
        adzuna: normalizarOfertaAdzuna,
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
 * Canonizo una URL de LinkedIn removiendo query params y fragments.
 *
 * ¿Por qué? LinkedIn agrega parámetros de tracking (refId, source, etc.)
 * que varían entre runs del scraper. Sin canonizar, dos URLs como:
 *   https://www.linkedin.com/jobs/view/390123?refId=abc
 *   https://www.linkedin.com/jobs/view/390123?refId=xyz
 * se consideran distintas, bypasseando el UNIQUE(url) de la tabla.
 *
 * Después de canonizar, ambas quedan como:
 *   https://www.linkedin.com/jobs/view/390123
 *
 * Si la URL no es parseable como URL válida, la devuelvo intacta
 * (fallback defensivo — no quiero romper datos si el actor cambia formato).
 *
 * @param {string} url - URL cruda de LinkedIn.
 * @returns {string} URL canonizada.
 */
function canonizarUrlLinkedin(url) {
    try {
        const parseada = new URL(url);
        parseada.search = '';
        parseada.hash = '';
        return parseada.toString();
    } catch {
        // Si no es una URL válida, la devuelvo tal cual.
        return url;
    }
}

/**
 * Detecto la modalidad de trabajo desde los datos de LinkedIn.
 *
 * Soporta ambos actores:
 * - Actor viejo: item.workRemoteAllowed (boolean) y item.workplaceTypes (array).
 * - Actor nuevo: item.workType (string: "Remote", "Hybrid", "On-site").
 *
 * @param {Object} item - Objeto crudo de LinkedIn.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidad(item) {
    // Actor nuevo: workType es un string directo (ej: "Remote", "Hybrid", "On-site").
    if (item.workType) {
        const tipo = item.workType.toLowerCase();
        if (tipo.includes('remote') || tipo.includes('remoto')) return 'remoto';
        if (tipo.includes('hybrid') || tipo.includes('híbrido')) return 'hibrido';
        if (tipo.includes('on-site') || tipo.includes('on site') || tipo.includes('presencial')) return 'presencial';
    }

    // Actor viejo: workRemoteAllowed es el más confiable.
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
 * @returns {{ min: number|null, max: number|null, salario_min: number|null, salario_max: number|null, moneda: string|null, periodo: string|null, texto_original: string|null }}
 */
function parsearSalario(salarioStr) {
    const vacio = {
        min: null,
        max: null,
        salario_min: null,
        salario_max: null,
        moneda: null,
        periodo: null,
        texto_original: null,
    };

    if (!salarioStr || typeof salarioStr !== 'string' || salarioStr.trim() === '') {
        return vacio;
    }

    const texto = salarioStr.trim();

    // 1. Detección de moneda: distingo ARS, USD, EUR explícitos.
    // Un símbolo "$" aislado sin país ni divisa demostrable permanece como null (no inventa moneda).
    let moneda = null;
    if (/\b(?:ar\$|ars)\b/i.test(texto) || /ar\$/i.test(texto)) {
        moneda = 'ARS';
    } else if (/\b(?:usd|u\$d|us\$)\b/i.test(texto) || /us\$/i.test(texto)) {
        moneda = 'USD';
    } else if (/\b(?:eur)\b/i.test(texto) || /€/.test(texto)) {
        moneda = 'EUR';
    } else {
        moneda = null;
    }

    // 2. Detección de período
    let periodo = null;
    if (/(?:(?:\b(?:mes|mensual|mensuales|per\s+month|monthly)\b)|(?:\/\s*(?:mes|month|mo)\b))/i.test(texto)) {
        periodo = 'mes';
    } else if (/(?:(?:\b(?:a[ñn]o|anual|anuales|per\s+year|yearly|annually|annual)\b)|(?:\/\s*(?:a[ñn]o|year|yr)\b))/i.test(texto)) {
        periodo = 'año';
    } else if (/(?:(?:\b(?:hora|por\s+hora|hourly|per\s+hour)\b)|(?:\/\s*(?:hora|hr|h)\b))/i.test(texto)) {
        periodo = 'hora';
    } else if (/(?:(?:\b(?:semana|semanal|weekly|per\s+week)\b)|(?:\/\s*(?:semana|week|wk)\b))/i.test(texto)) {
        periodo = 'semana';
    }

    // 3. Extracción de importes respetando separadores argentinos e internacionales
    const parsearNumeroToken = (token) => {
        if (!token) return null;
        let limpio = token.trim();
        const tieneK = /k$/i.test(limpio);
        if (tieneK) {
            limpio = limpio.slice(0, -1);
        }

        if (limpio.includes('.') && limpio.includes(',')) {
            const ultimoPunto = limpio.lastIndexOf('.');
            const ultimaComa = limpio.lastIndexOf(',');
            if (ultimoPunto > ultimaComa) {
                // Formato internacional: comas son miles, punto es decimal (ej. "50,000.50")
                limpio = limpio.replace(/,/g, '');
            } else {
                // Formato argentino/europeo: puntos son miles, coma es decimal (ej. "1.500.000,00")
                limpio = limpio.replace(/\./g, '').replace(/,/g, '.');
            }
        } else if (limpio.includes('.')) {
            const partes = limpio.split('.');
            if (partes.length > 2) {
                // "1.500.000" -> separadores de miles con punto
                limpio = partes.join('');
            } else if (partes.length === 2) {
                if (partes[1].length === 3) {
                    // "2.500", "500.000", "100.000" -> miles
                    limpio = partes.join('');
                }
            }
        } else if (limpio.includes(',')) {
            const partes = limpio.split(',');
            if (partes.length > 2) {
                // "1,500,000" -> separadores de miles con coma
                limpio = partes.join('');
            } else if (partes.length === 2) {
                if (partes[1].length === 3) {
                    // "50,000" -> miles
                    limpio = partes.join('');
                } else {
                    // "1,50" -> decimal
                    limpio = partes[0] + '.' + partes[1];
                }
            }
        }

        const num = parseFloat(limpio);
        if (isNaN(num)) return null;
        return tieneK ? num * 1000 : num;
    };

    const coincidencias = texto.match(/\d+(?:[.,]\d+)*k?/gi);
    if (!coincidencias || coincidencias.length === 0) {
        return {
            ...vacio,
            moneda,
            periodo,
            texto_original: texto,
        };
    }

    const valores = coincidencias
        .map(parsearNumeroToken)
        .filter(n => n !== null && !isNaN(n) && n > 0);

    if (valores.length === 0) {
        return {
            ...vacio,
            moneda,
            periodo,
            texto_original: texto,
        };
    }

    let min = valores[0];
    let max = valores.length > 1 ? valores[1] : null;

    if (max !== null && min !== null && min > max) {
        const aux = min;
        min = max;
        max = aux;
    }

    return {
        min,
        max,
        salario_min: min,
        salario_max: max,
        moneda,
        periodo,
        texto_original: texto,
    };
}

/**
 * Normalizo una oferta cruda de Glassdoor al esquema de nuestra tabla `ofertas`.
 *
 * El actor de Glassdoor devuelve mucha información valiosa (reviews de empresa,
 * ratings del CEO, beneficios, porcentajes de salario P10/P50/P90). Todo eso
 * queda en `datos_crudos` para uso futuro. Acá solo extraigo los campos que
 * caben en nuestro schema.
 *
 * @param {Object} item - Objeto crudo del actor de Glassdoor.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaGlassdoor(item) {
    const url = item.jobUrl;
    if (!url) {
        throw new Error('El item de Glassdoor no tiene URL (campo "jobUrl").');
    }

    // Construyo la ubicación combinando ciudad y estado.
    const ciudad = item.location_city || null;
    const estado = item.location_state || null;
    const ubicacion = [ciudad, estado].filter(Boolean).join(', ') || null;

    // Detecto la modalidad desde remoteWorkTypes.
    const modalidad = detectarModalidadGlassdoor(item);

    return {
        titulo: item.title || null,
        empresa: item.company?.companyName?.trim() || null,
        ubicacion,
        modalidad,
        descripcion: item.description_text || null,
        url,
        plataforma: 'glassdoor',
        // El campo experienceRequired trae strings como ["8"] (años de experiencia),
        // no un nivel nombrado. DeepSeek puede inferir el nivel desde la descripción.
        nivel_requerido: null,
        salario_min: item.baseSalary_min || null,
        salario_max: item.baseSalary_max || null,
        moneda: item.salary_currency || null,
        fecha_publicacion: sanitizarFecha(item.datePublished),
        datos_crudos: item,
    };
}

/**
 * Detecto la modalidad de trabajo desde los datos de Glassdoor.
 *
 * El actor devuelve `remoteWorkTypes` como array (ej: ["Remote"]) o null.
 * También puede haber información en `jobTypes` (ej: ["Full-time"]).
 *
 * @param {Object} item - Objeto crudo de Glassdoor.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidadGlassdoor(item) {
    const remotos = item.remoteWorkTypes || [];

    if (remotos.some(t => /remote/i.test(t))) return 'remoto';
    if (remotos.some(t => /hybrid/i.test(t))) return 'hibrido';
    if (remotos.some(t => /on.?site|in.?person/i.test(t))) return 'presencial';

    return null;
}

/**
 * Normalizo una oferta de la API pública de GetOnBrd al esquema de nuestra tabla `ofertas`.
 *
 * La API devuelve cada oferta dentro de `data[].attributes`, con estructura:
 * {
 *   id, type,
 *   attributes: { title, description (HTML), remote_modality, countries (array),
 *                  min_salary, max_salary, published_at (unix timestamp) },
 *   relationships: { seniority: { data: { id: 1..5 } } },
 *   links: { public_url }
 * }
 *
 * Mapeo de modalidad:
 * - "fully_remote" | "remote_local" → "remoto"
 * - "hybrid"                        → "hibrido"
 * - "no_remote"                     → "presencial"
 *
 * Mapeo de nivel (seniority.data.id):
 * - 1 → "trainee" | 2 → "junior" | 3 → "semi-senior" | 4 o 5 → "senior"
 *
 * @param {Object} item - Objeto crudo de la API de GetOnBrd.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL pública.
 */
function normalizarOfertaGetonbrd(item) {
    const url = item.links?.public_url;
    if (!url) {
        throw new Error('El item de GetOnBrd no tiene URL (campo "links.public_url").');
    }

    const atributos = item.attributes || {};
    const paises = atributos.countries || [];
    const ubicacion = paises.length > 0 ? paises.join(', ') : null;

    return {
        titulo: atributos.title || null,
        // El endpoint de búsqueda no devuelve el nombre de la empresa.
        // DeepSeek puede evaluar la oferta igual con el resto de los campos.
        empresa: null,
        ubicacion,
        modalidad: detectarModalidadGetonbrd(atributos.remote_modality),
        descripcion: atributos.description || null,
        url,
        plataforma: 'getonbrd',
        nivel_requerido: mapearNivelGetonbrd(item.relationships?.seniority?.data?.id),
        salario_min: atributos.min_salary || null,
        salario_max: atributos.max_salary || null,
        // GetOnBrd publica salarios exclusivamente en dólares.
        moneda: (atributos.min_salary || atributos.max_salary) ? 'USD' : null,
        fecha_publicacion: sanitizarFecha(atributos.published_at ? atributos.published_at * 1000 : null),
        datos_crudos: item,
    };
}

/**
 * Normalizo una oferta cruda de la API de Jooble al formato de nuestra tabla.
 *
 * Jooble es un agregador de empleos. Su API REST gratuita devuelve objetos
 * más simples que los actores de Apify — sin niveles ni salarios estructurados.
 *
 * Estructura del objeto crudo de Jooble:
 * {
 *   title: "Frontend Developer Junior",
 *   location: "Buenos Aires",                 ← texto libre
 *   snippet: "Descripción del puesto...",     ← descripción plana
 *   salary: "$100,000 - $150,000",            ← string libre o vacío
 *   source: "LinkedIn",                       ← plataforma de origen
 *   type: "Full-time" | "Part-time" | "Remote" | etc.
 *   link: "https://jooble.org/desc/{ID}",
 *   company: "TestCorp Argentina",
 *   updated: "2026-03-28T12:00:00.0000000",   ← ISO 8601
 * }
 *
 * Mapeo de modalidad (campo `type`):
 * - Contiene "Remote" → "remoto"
 * - Contiene "Hybrid" → "hibrido"
 * - Contiene "On-site" → "presencial"
 * - "Part-time" / "Full-time" sin indicación de lugar → null (jornada no define modalidad)
 * - Cualquier otro → null
 *
 * @param {Object} item - Objeto crudo de la API de Jooble.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL (campo "link").
 */
function normalizarOfertaJooble(item) {
    const url = item.link;
    if (!url) {
        throw new Error('El item de Jooble no tiene URL (campo "link").');
    }

    // Jooble no devuelve salario estructurado — intentamos parsearlo del string.
    const salario = parsearSalario(item.salary || '');
    const { salario_min, salario_max, moneda } = salario;

    // Jooble REST API no expone fecha de publicación original; el campo "updated" representa
    // la última fecha en que la vacante fue indexada o modificada. No la consideramos como
    // publicación original para evitar que avisos antiguos pasen como recién publicados.
    // Preservamos `updated` intacto dentro de `datos_crudos: item`.
    const fechaPublicacion = null;

    return {
        titulo: item.title || null,
        empresa: item.company || null,
        ubicacion: item.location || null,
        modalidad: detectarModalidadJooble(item.type),
        descripcion: item.snippet || null,
        url,
        plataforma: 'jooble',
        // Jooble no expone nivel de experiencia en la API gratuita.
        nivel_requerido: null,
        salario_min,
        salario_max,
        moneda,
        fecha_publicacion: fechaPublicacion,
        datos_crudos: item,
    };
}

/**
 * Detecto la modalidad laboral a partir del campo `type` de Jooble.
 *
 * Jooble usa el campo `type` para la jornada laboral o modalidad (ej: "Full-time",
 * "Remote", "Part-time", "Hybrid", "On-site").
 * Distingo jornada de modalidad: "Full-time" o "Part-time" describen dedicación horaria,
 * no lugar de trabajo; por lo tanto, no se asume presencialidad sin evidencia explícita.
 *
 * @param {string|null} type - El valor de item.type.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidadJooble(type) {
    if (!type || typeof type !== 'string') return null;
    const texto = type.toLowerCase();

    if (texto.includes('remote')) return 'remoto';
    if (texto.includes('hybrid')) return 'hibrido';
    if (texto.includes('on-site') || texto.includes('onsite') || texto.includes('presencial')) return 'presencial';

    // Jornada laboral no define modalidad física; conservo null (desconocido).
    return null;
}

/**
 * Mapeo el id de seniority de GetOnBrd a nuestros valores normalizados.
 *
 * GetOnBrd usa un ID numérico (1–5):
 * 1 = Trainee | 2 = Junior | 3 = Semi-Senior | 4 = Senior | 5 = Senior (variante)
 *
 * @param {number|string|null} id - El id de seniority.data.
 * @returns {string|null} 'trainee', 'junior', 'semi-senior', 'senior' o null.
 */
function mapearNivelGetonbrd(id) {
    const mapa = { 1: 'trainee', 2: 'junior', 3: 'semi-senior', 4: 'senior', 5: 'senior' };
    return mapa[id] || null;
}

/**
 * Mapeo la modalidad de GetOnBrd a nuestros valores normalizados.
 *
 * Valores posibles de remote_modality:
 * - "fully_remote"   → completamente remoto
 * - "remote_local"   → remoto pero dentro del país (igual se mapea a "remoto")
 * - "hybrid"         → híbrido
 * - "no_remote"      → presencial
 *
 * @param {string|null} modalidad - El valor de attributes.remote_modality.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidadGetonbrd(modalidad) {
    if (!modalidad) return null;

    if (modalidad === 'fully_remote' || modalidad === 'remote_local') return 'remoto';
    if (modalidad === 'hybrid') return 'hibrido';
    if (modalidad === 'no_remote') return 'presencial';

    return null;
}

/**
 * Normalizo una oferta cruda de Google Jobs al esquema de nuestra tabla `ofertas`.
 *
 * Google Jobs es un agregador: cada oferta viene originalmente de otro portal
 * (LinkedIn, Indeed, Computrabajo, ZonaJobs, etc.). El campo `jobPublisher`
 * indica de qué portal viene. Usamos `jobApplyLink` como URL principal porque
 * es el link directo para postularse (no el link de Google).
 *
 * Campos clave del actor:
 * - jobTitle, employerName, jobLocation, jobDescription
 * - jobApplyLink (URL directa al portal original)
 * - jobGoogleLink (URL de Google Jobs — como fallback)
 * - isRemote, employmentType
 * - minSalary, maxSalary, salaryPeriod
 * - jobPostedAtDatetime
 * - jobPublisher (portal original: "LinkedIn", "Indeed", etc.)
 *
 * @param {Object} item - Objeto crudo del actor de Google Jobs.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaGoogleJobs(item) {
    // johnvc/google-jobs-scraper devuelve: title, company_name, location,
    // description, application_link, salary (string), job_type, posted_date,
    // company_logo, requirements.
    const url = item.application_link || null;
    if (!url) {
        throw new Error('El item de Google Jobs no tiene application_link.');
    }

    // Detecto la modalidad a partir de job_type y location.
    const modalidad = detectarModalidadGoogleJobs(item);

    // El salario viene como texto libre (ej: "$150,000 - $200,000").
    // No hay campos separados min/max en este actor.
    // En Argentina suelen ser pesos ARS, pero el texto es inconsistente.
    const salarioMin = null;
    const salarioMax = null;
    const moneda = null;

    // La fecha viene como texto relativo ("2 days ago", "hace 3 días").
    // No es parseable de forma confiable; la dejo en null.
    // El campo posted_date queda guardado en datos_crudos por referencia.
    const fechaPublicacion = null;

    return {
        titulo: item.title || null,
        empresa: item.company_name || null,
        ubicacion: item.location || null,
        modalidad,
        descripcion: item.description || null,
        url,
        plataforma: 'google_jobs',
        // Google Jobs no expone nivel de experiencia de forma estructurada.
        // DeepSeek lo infiere de la descripción durante la evaluación.
        nivel_requerido: null,
        salario_min: salarioMin,
        salario_max: salarioMax,
        moneda,
        fecha_publicacion: fechaPublicacion,
        datos_crudos: item,
    };
}

/**
 * Detecto la modalidad de trabajo desde los datos de Google Jobs.
 *
 * El actor devuelve `isRemote` (boolean) y `employmentType` (string libre).
 * employmentType puede ser "Full-time", "Part-time", "Contractor", "Intern".
 *
 * @param {Object} item - Objeto crudo de Google Jobs.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidadGoogleJobs(item) {
    // johnvc devuelve job_type (ej: "Full-time", "Part-time", "Contractor")
    // y location (ej: "Buenos Aires", "Remote", "Híbrido").
    const tipo = (item.job_type || '').toLowerCase();
    const ubicacion = (item.location || '').toLowerCase();

    if (tipo.includes('remote') || tipo.includes('remoto')) return 'remoto';
    if (tipo.includes('hybrid') || tipo.includes('híbrido')) return 'hibrido';

    if (ubicacion.includes('remote') || ubicacion.includes('remoto')) return 'remoto';
    if (ubicacion.includes('hybrid') || ubicacion.includes('híbrido')) return 'hibrido';

    return null;
}

/**
 * Detecta si una oferta está escrita en inglés analizando título y descripción.
 *
 * ¿Por qué hace falta esto? Porque plataformas como Jooble indexan contenido global,
 * y muchos resultados vienen de empresas de USA o UK que publican en inglés.
 * Marcos no habla inglés, así que esas ofertas no le sirven aunque sean remotas.
 *
 * El algoritmo es CONSERVADOR: solo marca como inglés cuando hay evidencia
 * fuerte y clara, para no descartar por error ofertas en español que usan
 * términos técnicos en inglés (React, TypeScript, Angular, etc.).
 *
 * Criterio: si hay 2+ frases características del inglés de HR Y superan
 * a las frases en español → es inglés. En caso de duda, devuelve 'es'.
 *
 * @param {string} titulo      - Título de la oferta.
 * @param {string} descripcion - Descripción de la oferta.
 * @returns {'es'|'en'}        - Idioma detectado.
 */
function detectarIdioma(titulo, descripcion) {
    const texto = ((titulo || '') + ' ' + (descripcion || '')).toLowerCase();
    if (!texto.trim()) return 'es';

    // Frases y estructuras verbales características de avisos redactados en inglés.
    // Encabezados aislados como "requirements" o "nice to have" se excluyen deliberadamente
    // porque en publicaciones tecnológicas en español se emplean rutinariamente como títulos de sección.
    const frasesIngles = [
        'we are looking for', 'looking for a', 'we are seeking', 'seeking a',
        'join our team', 'join our', 'you will be', 'you will have',
        'you will work', 'reporting to', 'years of experience with',
        'we offer', 'we are a', 'we value', 'about the role', 'about us',
        'about the position', 'competitive salary', 'competitive compensation',
        'team player', 'strong knowledge of', 'strong experience',
        'proficiency in', 'proficiency with', 'we\'re looking', 'we\'re seeking',
        'the ideal candidate', 'proven experience as', 'what you will do',
    ];

    // Conectores y partículas funcionales gramaticales en inglés.
    const palabrasIngles = [
        /\bthe\b/g, /\band\b/g, /\bwith\b/g, /\bfor\b/g, /\bfrom\b/g,
        /\bthat\b/g, /\bthis\b/g, /\bare\b/g, /\bour\b/g, /\byour\b/g,
        /\bwe\b/g, /\byou\b/g, /\bwill\b/g, /\bhave\b/g,
    ];

    // Frases y giros idiomáticos característicos de avisos en español.
    const frasesEspanol = [
        'buscamos', 'estamos buscando', 'nos encontramos buscando',
        'te ofrecemos', 'ofrecemos', 'se ofrece',
        'requisitos', 'requerimientos', 'se requiere',
        'empresa busca', 'empresa líder', 'empresa de',
        'puesto de trabajo', 'posición de', 'incorporamos',
        'sueldo', 'salario', 'remuneración', 'renta mensual',
        'jornada laboral', 'horario de trabajo',
        'postulate', 'postulá', 'enviá',
        'buen clima', 'equipo de trabajo', 'trabajo en equipo',
        'experiencia laboral', 'experiencia comprobable',
        'conocimientos en', 'conocimientos de', 'experiencia en', 'experiencia con',
    ];

    // Conectores y partículas funcionales gramaticales en español.
    const palabrasEspanol = [
        /\bde\b/g, /\bla\b/g, /\bel\b/g, /\blos\b/g, /\blas\b/g,
        /\bun\b/g, /\buna\b/g, /\ben\b/g, /\bpara\b/g, /\bcon\b/g,
        /\bpor\b/g, /\bdel\b/g, /\bal\b/g, /\bque\b/g, /\bse\b/g,
        /\bes\b/g, /\bson\b/g, /\by\b/g, /\bnuestro\b/g, /\bnuestra\b/g,
    ];

    let puntosIngles = 0;
    let puntosEspanol = 0;

    for (const frase of frasesIngles) {
        if (texto.includes(frase)) puntosIngles += 2;
    }
    for (const patron of palabrasIngles) {
        const matches = texto.match(patron);
        if (matches) puntosIngles += Math.min(matches.length, 5);
    }

    for (const frase of frasesEspanol) {
        if (texto.includes(frase)) puntosEspanol += 2;
    }
    for (const patron of palabrasEspanol) {
        const matches = texto.match(patron);
        if (matches) puntosEspanol += Math.min(matches.length, 5);
    }

    // Solo clasifico como inglés cuando la redacción en inglés es contundente y dominante.
    // En caso de ambigüedad o presencia relevante de español, conservo 'es' para no descartar.
    if (puntosIngles >= 4 && puntosIngles > puntosEspanol * 1.5) {
        return 'en';
    }

    return 'es';
}

/**
 * Normalizo una oferta de la API pública de Remotive al esquema de nuestra tabla `ofertas`.
 *
 * Remotive es un portal 100% remoto, por lo que la modalidad siempre es 'remoto'.
 * La descripción viene en HTML (igual que GetOnBrd y otros portales).
 *
 * Estructura del objeto crudo de Remotive:
 * {
 *   id: 123,
 *   url: "https://remotive.com/remote-jobs/...",
 *   title: "Frontend Developer",
 *   company_name: "Company Inc",
 *   category: "Software Development",
 *   tags: ["javascript", "react"],
 *   job_type: "full_time",
 *   publication_date: "2026-04-01T00:00:00",
 *   candidate_required_location: "Worldwide" | "Latin America" | "LATAM",
 *   salary: "$80,000 - $100,000",
 *   description: "<p>...</p>"
 * }
 *
 * @param {Object} item - Objeto crudo de la API de Remotive.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaRemotive(item) {
    const url = item.url;
    if (!url) {
        throw new Error('El item de Remotive no tiene URL.');
    }

    const salario = parsearSalario(item.salary || '');

    return {
        titulo: item.title || null,
        empresa: item.company_name || null,
        // candidate_required_location indica desde dónde puede postularse el candidato.
        // Ej: "Worldwide", "Latin America", "LATAM", "Americas".
        ubicacion: item.candidate_required_location || null,
        // Remotive es un portal de empleo exclusivamente remoto.
        modalidad: 'remoto',
        descripcion: item.description || null,
        url,
        plataforma: 'remotive',
        // Remotive no expone nivel de experiencia de forma estructurada.
        nivel_requerido: null,
        salario_min: salario.min,
        salario_max: salario.max,
        moneda: salario.moneda,
        fecha_publicacion: sanitizarFecha(item.publication_date),
        datos_crudos: item,
    };
}

/**
 * Normalizo una oferta de la API pública de RemoteOK al esquema de nuestra tabla `ofertas`.
 *
 * RemoteOK es un portal 100% remoto, por lo que la modalidad siempre es 'remoto'.
 * La descripción viene en HTML.
 *
 * Estructura del objeto crudo de RemoteOK:
 * {
 *   id: "...",
 *   epoch: 1234567890,             ← timestamp Unix
 *   date: "2026-04-01T00:00:00Z",
 *   company: "Company Inc",
 *   position: "Frontend Developer", ← OJO: es 'position', no 'title'
 *   tags: ["javascript", "react"],
 *   description: "<p>...</p>",
 *   location: "Worldwide",
 *   url: "https://remoteok.com/remote-jobs/...",
 *   apply_url: "https://...",
 *   salary_min: 80000,
 *   salary_max: 100000
 * }
 *
 * @param {Object} item - Objeto crudo de la API de RemoteOK.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL.
 */
function normalizarOfertaRemoteOK(item) {
    const url = item.url;
    if (!url) {
        throw new Error('El item de RemoteOK no tiene URL.');
    }

    return {
        titulo: item.position || null,
        empresa: item.company || null,
        ubicacion: item.location || null,
        // RemoteOK es un portal de empleo exclusivamente remoto.
        modalidad: 'remoto',
        descripcion: item.description || null,
        url,
        plataforma: 'remoteok',
        // RemoteOK no expone nivel de experiencia de forma estructurada.
        nivel_requerido: null,
        salario_min: item.salary_min || null,
        salario_max: item.salary_max || null,
        // RemoteOK publica salarios exclusivamente en dólares.
        moneda: (item.salary_min || item.salary_max) ? 'USD' : null,
        fecha_publicacion: sanitizarFecha(item.date),
        datos_crudos: item,
    };
}

/**
 * Normalizo una oferta de la API oficial de InfoJobs España al esquema de nuestra tabla.
 *
 * InfoJobs es el portal de empleo más grande de España. Su API REST devuelve
 * objetos con estructura propia que hay que mapear a nuestro contrato interno.
 *
 * REGLA CRÍTICA: Solo aceptamos ofertas con modalidad de remoto puro.
 * Esta es la Capa 2 de defensa. Si la API devolvió por error una oferta híbrida
 * o presencial (a pesar del parámetro teleworking en el request), la descartamos acá.
 * Las ofertas rechazadas lanzan un Error que normalizarLote() captura con console.warn.
 *
 * Mapeo de campos API InfoJobs → tabla `ofertas`:
 *   link                          → url            (URL pública de la oferta)
 *   title                         → titulo
 *   company.name / author.name    → empresa
 *   city / locations[0].city      → ubicacion
 *   province / locations[0].province.value → ubicacion
 *   teleworking.id / teleworking.value / teleworking(string) → modalidad
 *   description       → descripcion
 *                     → plataforma     (siempre 'infojobs')
 *   experienceMin.key / experienceMin.value → nivel_requerido (mapeado a valores internos)
 *   salaryMin / salaryMax / minPay / maxPay → salario_min/max
 *   salaryDescription → moneda         (inferida del texto)
 *   published         → fecha_publicacion (ISO 8601)
 *   (todo el item)    → datos_crudos
 *
 * @param {Object} item - Objeto crudo de la API de InfoJobs.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene URL o si la modalidad no es remoto puro.
 */
function normalizarOfertaInfojobs(item) {
    const url = item.link;
    if (!url) {
        throw new Error('El item de InfoJobs no tiene URL (campo "link").');
    }

    // Validación defensiva (Capa 2): descarto cualquier oferta que no sea remoto puro.
    // Aunque el scraper ya filtra en origen, la API puede devolver datos inconsistentes.
    //
    // La API de InfoJobs devuelve `teleworking` en dos formas observadas:
    //   a) string plano:      "solo-teletrabajo"
    //   b) objeto con .value: { id: 2, value: "Solo teletrabajo" }
    //
    // El campo `.id` es un número y NO se usa como criterio de aceptación porque
    // String(2) = "2", que no matchea ningún valor de texto esperado.
    // Siempre priorizamos `.value` (texto legible) para la comparación.
    const teleworking = item.teleworking;
    let teleworkingId;
    if (typeof teleworking === 'string') {
        // Forma a): string plano directo.
        teleworkingId = teleworking;
    } else if (teleworking && typeof teleworking === 'object') {
        // Forma b) y c): objeto PD. Priorizamos .value (texto) sobre .id (número).
        teleworkingId = teleworking.value || teleworking.id || null;
    } else {
        teleworkingId = null;
    }
    const teleworkingNormalizado = String(teleworkingId || '')
        .toLowerCase()
        .trim();
    const esRemotoPuro =
        teleworkingNormalizado === 'solo-teletrabajo' ||
        teleworkingNormalizado === 'solo teletrabajo';

    if (!esRemotoPuro) {
        const valorParaLog = teleworkingId || 'sin especificar';
        console.warn(`InfoJobs: oferta descartada por modalidad no remota (${valorParaLog}) — url: ${url}`);
        throw new Error(`InfoJobs: oferta descartada por modalidad no remota (${valorParaLog})`);
    }

    // Construyo la ubicación soportando dos shapes:
    // 1) `locations[0]` con city/province (documentación y algunos ejemplos)
    // 2) `city` y `province` al tope del item (tests históricos e integraciones previas)
    const primeraUbicacion = item.locations?.[0] || null;
    const ciudad =
        item.city?.value ||
        item.city ||
        primeraUbicacion?.city?.value ||
        primeraUbicacion?.city ||
        null;
    const provincia =
        item.province?.value ||
        item.province ||
        primeraUbicacion?.province?.value ||
        primeraUbicacion?.province ||
        null;
    const ubicacion = [ciudad, provincia].filter(Boolean).join(', ') || null;

    const empresa = item.company?.name || item.author?.name || null;

    const experienciaCruda =
        item.experienceMin?.key ||
        item.experienceMin?.value ||
        item.experienceMin ||
        null;

    const salarioMin = extraerNumeroInfojobs(item.salaryMin ?? item.minPay);
    const salarioMax = extraerNumeroInfojobs(item.salaryMax ?? item.maxPay);

    const descripcion =
        item.description ||
        item.requirementMin ||
        null;

    return {
        titulo: item.title || null,
        empresa,
        ubicacion,
        // teleworking === 'solo-teletrabajo' → modalidad interna 'remoto'.
        modalidad: 'remoto',
        descripcion,
        url,
        plataforma: 'infojobs',
        nivel_requerido: mapearNivelInfojobs(experienciaCruda),
        // InfoJobs puede incluir rango salarial como números o PDs con .value.
        salario_min: salarioMin,
        salario_max: salarioMax,
        // La moneda se infiere del campo salaryDescription si existe.
        moneda: inferirMonedaInfojobs(item.salaryDescription),
        fecha_publicacion: sanitizarFecha(item.published),
        datos_crudos: item,
    };
}

/**
 * Mapeo el nivel de experiencia de InfoJobs a nuestros valores normalizados.
 *
 * La API puede devolver el nivel en dos formatos según el campo que llegue:
 *
 * a) Clave interna (experienceMin.key): 'sin_experiencia', 'menos_1_anio',
 *    'entre_1_2_anios', 'entre_2_3_anios', 'entre_3_5_anios', 'mas_5_anios'.
 *
 * b) Texto en español (experienceMin.value): 'Sin experiencia', 'Menos de 1 año',
 *    'Al menos 1 año', 'Al menos 2 años', 'Al menos 3 años', 'Al menos 4 años',
 *    'Más de 5 años', 'Más de 10 años'.
 *
 * Cuando llega el texto libre (forma b), normalizo a minúsculas y busco
 * en un segundo mapa de textos en español. Así no dependo de que la API
 * siempre devuelva la clave interna.
 *
 * @param {string|null} key - La clave o texto de experienceMin de InfoJobs.
 * @returns {string|null} 'trainee', 'junior', 'semi-senior', 'senior' o null.
 */
function mapearNivelInfojobs(key) {
    if (!key) return null;

    // Mapa de claves internas (forma a).
    const mapaClaves = {
        'sin_experiencia': 'trainee',
        'menos_1_anio': 'trainee',
        'entre_1_2_anios': 'junior',
        'entre_2_3_anios': 'junior',
        'entre_3_5_anios': 'semi-senior',
        'mas_5_anios': 'senior',
    };

    if (mapaClaves[key]) return mapaClaves[key];

    // Mapa de textos en español (forma b): normalizo a minúsculas para comparar.
    const keyLower = String(key).toLowerCase().trim();

    const mapaTextos = {
        'sin experiencia': 'trainee',
        'menos de 1 año': 'trainee',
        'al menos 1 año': 'trainee',
        'al menos 2 años': 'junior',
        'al menos 3 años': 'semi-senior',
        'al menos 4 años': 'semi-senior',
        'más de 5 años': 'senior',
        'mas de 5 años': 'senior',
        'más de 10 años': 'senior',
        'mas de 10 años': 'senior',
    };

    return mapaTextos[keyLower] || null;
}

/**
 * Infiero la moneda a partir del campo salaryDescription de InfoJobs.
 *
 * La API devuelve un texto como "€ Bruto/año" o "USD/mes".
 * Busco símbolos o códigos conocidos para identificar la moneda.
 *
 * @param {string|null} descripcion - El campo salaryDescription.
 * @returns {string|null} 'EUR', 'USD', 'ARS' o null.
 */
function inferirMonedaInfojobs(descripcion) {
    if (!descripcion) return null;
    const texto = descripcion.toUpperCase();

    if (texto.includes('EUR') || texto.includes('€')) return 'EUR';
    if (texto.includes('USD') || texto.includes('$')) return 'USD';
    if (texto.includes('ARS') || texto.includes('AR$')) return 'ARS';

    return null;
}

/**
 * Extraigo un número desde un campo de salario de InfoJobs.
 * Puede venir como número directo, string o PD con `{ value: '30000' }`.
 *
 * @param {number|string|Object|null|undefined} valor - Campo salarial crudo.
 * @returns {number|null} Valor numérico parseado o null.
 */
function extraerNumeroInfojobs(valor) {
    if (valor === null || valor === undefined) {
        return null;
    }

    if (typeof valor === 'number' && Number.isFinite(valor)) {
        return valor;
    }

    const valorCrudo = typeof valor === 'object' ? valor.value : valor;
    if (valorCrudo === null || valorCrudo === undefined) {
        return null;
    }

    const textoNormalizado = String(valorCrudo).replace(/[^\d.,-]/g, '').replace(',', '.');
    const numero = Number.parseFloat(textoNormalizado);

    return Number.isFinite(numero) ? numero : null;
}

/**
 * Normalizo una oferta cruda de Adzuna al esquema de nuestra tabla `ofertas`.
 *
 * Adzuna devuelve cada oferta con estos campos principales:
 *   - id: ID único de Adzuna (string)
 *   - title: título del puesto
 *   - company.display_name: nombre de la empresa
 *   - location.display_name: ubicación (ciudad, país)
 *   - description: descripción completa del puesto
 *   - redirect_url: URL de la oferta en Adzuna (con afiliación)
 *   - created: fecha de publicación en ISO-8601
 *   - salary_min / salary_max: salarios numéricos (pueden no estar presentes)
 *   - contract_time: 'full_time' | 'part_time' (puede no estar)
 *
 * REGLA CRÍTICA: Solo aceptamos ofertas de teletrabajo / trabajo a distancia.
 * Esta es la Capa 2 de defensa. Si el scraper (Capa 1) no pudo excluir una
 * oferta presencial o híbrida, la descartamos acá.
 * Las ofertas rechazadas lanzan un Error que normalizarLote() captura con console.warn.
 *
 * Nota de atribución: la API de Adzuna requiere mostrar "Jobs by Adzuna"
 * en el frontend cuando se muestran los resultados.
 *
 * @param {Object} item - Objeto crudo de la API de Adzuna.
 * @returns {Object} Oferta en el formato de nuestra tabla.
 * @throws {Error} Si el item no tiene redirect_url o si no es trabajo a distancia.
 */
/**
 * Detecta la modalidad laboral a partir de texto libre considerando negaciones e híbridos.
 * Las negaciones ("sin posibilidad de teletrabajo", "remote work is not available") tienen prioridad sobre menciones aisladas.
 *
 * @param {string} texto - Texto a analizar.
 * @returns {'remoto'|'hibrido'|'presencial'|null}
 */
function detectarModalidadTexto(texto = '') {
    if (!texto || typeof texto !== 'string') return null;
    const t = texto.toLowerCase();

    // 1. Negaciones explícitas de trabajo remoto:
    const esNegacionRemoto = /\b(?:sin\s+posibilidad\s+de\s+(?:trabajo\s+)?remoto|sin\s+posibilidad\s+de\s+teletrabajo|no\s+(?:se\s+admite|se\s+permite|hay|posibilidad\s+de)\s+(?:trabajo\s+remoto|teletrabajo)|remote\s+work\s+is\s+not\s+(?:available|permitted|allowed)|not\s+a\s+remote\s+position|no\s+teletrabajo|no\s+remoto)\b/i.test(t);

    // 2. Menciones explícitas de esquema híbrido:
    const esHibrido = /\b(?:h[ií]brido|hybrid|\d+\s*d[ií]as?\s+(?:en\s+)?oficina.*?\d+\s*d[ií]as?\s+(?:de\s+)?teletrabajo|\d+\s*d[ií]as?\s+(?:de\s+)?teletrabajo.*?\d+\s*d[ií]as?\s+(?:en\s+)?oficina|teletrabajo\s+(?:parcial|mixto|h[ií]brido)|presencial\s+y\s+(?:remoto|teletrabajo))\b/i.test(t);

    // 3. Menciones explícitas de presencialidad:
    const esPresencial = /\b(?:puesto\s+presencial|trabajo\s+presencial|modalidad\s+presencial|100%\s*presencial|on-site|onsite|en\s+sede|en\s+oficina)\b/i.test(t);

    // 4. Menciones explícitas de trabajo remoto pleno:
    const esRemotoPleno = /\b(?:100%\s*(?:remoto|remote|teletrabajo)|(?:remoto|remote|teletrabajo)\s*100%|fully\s*remote|full\s*remote|totalmente\s*(?:remoto|a\s+distancia))\b/i.test(t);
    const esRemotoGeneral = /\b(?:remoto|remote|teletrabajo|telework|work\s+from\s+home|trabajo\s+a\s+distancia)\b/i.test(t);

    if (esHibrido) {
        return 'hibrido';
    }

    if (esNegacionRemoto) {
        return esPresencial ? 'presencial' : null;
    }

    if (esRemotoPleno) {
        return 'remoto';
    }

    if (esRemotoGeneral && esPresencial) {
        return 'hibrido';
    }

    if (esRemotoGeneral) {
        if (/\b(?:evaluar\s+teletrabajo|opci[oó]n\s+futura|a\s+futuro|despu[eé]s\s+del\s+periodo\s+de\s+prueba)\b/i.test(t)) {
            return null; // Mención ambigua o condicional
        }
        return 'remoto';
    }

    if (esPresencial) {
        return 'presencial';
    }

    return null;
}

function normalizarOfertaAdzuna(item) {
    const url = item.redirect_url;
    if (!url) {
        throw new Error('El item de Adzuna no tiene redirect_url (campo obligatorio).');
    }

    const titulo = item.title || null;
    const empresa = item.company?.display_name || null;
    const ubicacion = item.location?.display_name || null;
    const descripcion = item.description || null;

    // Detecto modalidad considerando negaciones, esquemas híbridos y remoto pleno.
    const textoCompleto = `${titulo || ''} ${descripcion || ''}`;
    const modalidadDetectada = detectarModalidadTexto(textoCompleto);

    // Capa 2: Adzuna conserva su política de admitir únicamente ofertas de trabajo a distancia ('remoto').
    // Si la oferta no es remota pura (es presencial, híbrida o ambigua/desconocida), se descarta con motivo verificable.
    if (modalidadDetectada !== 'remoto') {
        const detalleModalidad = modalidadDetectada ? ` (modalidad detectada: ${modalidadDetectada})` : '';
        const motivo = `Adzuna: oferta descartada por no ser trabajo a distancia${detalleModalidad}`;
        console.warn(`${motivo} — url: ${url}`);
        throw new Error(motivo);
    }

    const modalidad = 'remoto';

    // Salario: Adzuna lo da como números flotantes directos.
    const salarioMin = item.salary_min != null ? String(item.salary_min) : null;
    const salarioMax = item.salary_max != null ? String(item.salary_max) : null;

    // Moneda: la infiero del país de búsqueda inyectado en el scraper como `_pais`.
    // Solo España (es) → EUR. Si en el futuro se agregan más países, actualizar acá.
    const MONEDA_POR_PAIS = { es: 'EUR' };
    const moneda = (item.salary_min != null || item.salary_max != null)
        ? (MONEDA_POR_PAIS[item._pais] || null)
        : null;

    // Fecha de publicación: Adzuna la da en ISO-8601, sanitizo por validez.
    const fechaPublicacion = sanitizarFecha(item.created);

    return {
        titulo,
        empresa,
        ubicacion,
        modalidad,
        descripcion,
        url,
        plataforma: 'adzuna',
        nivel_requerido: null,
        salario_min: salarioMin,
        salario_max: salarioMax,
        moneda,
        fecha_publicacion: fechaPublicacion,
        datos_crudos: item,
    };
}

module.exports = {
    normalizarOfertaLinkedin,
    normalizarOfertaComputrabajo,
    normalizarOfertaIndeed,
    normalizarOfertaBumeran,
    normalizarOfertaGlassdoor,
    normalizarOfertaGetonbrd,
    normalizarOfertaJooble,
    normalizarOfertaGoogleJobs,
    normalizarOfertaRemotive,
    normalizarOfertaRemoteOK,
    normalizarOfertaAdzuna,
    normalizarLote,
    // Exporto las auxiliares para poder testearlas si hace falta.
    _parsearSalario: parsearSalario,
    _mapearNivelGetonbrd: mapearNivelGetonbrd,
    _detectarModalidadGetonbrd: detectarModalidadGetonbrd,
    _detectarModalidad: detectarModalidad,
    _mapearNivelLinkedin: mapearNivelLinkedin,
    _detectarModalidadIndeed: detectarModalidadIndeed,
    _detectarNivelIndeed: detectarNivelIndeed,
    _mapearModalidadBumeran: mapearModalidadBumeran,
    _detectarModalidadGlassdoor: detectarModalidadGlassdoor,
    _detectarModalidadJooble: detectarModalidadJooble,
    _detectarModalidadGoogleJobs: detectarModalidadGoogleJobs,
    _mapearModalidadComputrabajo: mapearModalidadComputrabajo,
    _detectarModalidadTexto: detectarModalidadTexto,
    _canonizarUrlLinkedin: canonizarUrlLinkedin,
    _sanitizarFecha: sanitizarFecha,
    _parsearFechaRelativaComputrabajo: parsearFechaRelativaComputrabajo,
    parsearFechaRelativaComputrabajo,
    detectarIdioma,
};
