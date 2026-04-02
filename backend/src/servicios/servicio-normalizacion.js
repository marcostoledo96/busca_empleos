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
        glassdoor: normalizarOfertaGlassdoor,
        getonbrd: normalizarOfertaGetonbrd,
        jooble: normalizarOfertaJooble,
        google_jobs: normalizarOfertaGoogleJobs,
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
        fecha_publicacion: item.datePublished ? new Date(item.datePublished) : null,
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
        fecha_publicacion: atributos.published_at
            ? new Date(atributos.published_at * 1000)
            : null,
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
 * - Contiene "Part" / "Full" sin Remote → "presencial"
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
    const { salario_min, salario_max, moneda } = parsearSalario(item.salary || '');

    // La fecha viene como ISO 8601 con microsegundos: "2026-03-28T12:00:00.0000000".
    // new Date() lo maneja correctamente.
    const fechaPublicacion = item.updated ? new Date(item.updated) : null;

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
 * Jooble usa el campo `type` como texto libre (ej: "Full-time", "Remote",
 * "Part-time", "Hybrid"). Busco palabras clave para mapearlo.
 *
 * @param {string|null} type - El valor de item.type.
 * @returns {string|null} 'remoto', 'hibrido', 'presencial' o null.
 */
function detectarModalidadJooble(type) {
    if (!type) return null;
    const texto = type.toLowerCase();

    if (texto.includes('remote')) return 'remoto';
    if (texto.includes('hybrid')) return 'hibrido';
    if (texto.includes('full-time') || texto.includes('part-time')) return 'presencial';

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

    // Frases y palabras muy características de publicaciones de trabajo en inglés.
    // Son específicas del vocabulario de HR anglosajón, no aparecen en español.
    const indicadoresIngles = [
        'we are looking', 'looking for a', 'we are seeking', 'seeking a',
        'join our team', 'join our', 'you will be', 'you will have',
        'you will work', 'reporting to', 'must have', 'nice to have',
        'years of experience', 'year of experience',
        'we offer', 'we are a', 'we value',
        'responsibilities', 'requirements', 'qualifications',
        'about the role', 'about us', 'about the position',
        'competitive salary', 'competitive compensation',
        'team player', 'strong knowledge of', 'strong experience',
        'proficiency in', 'proficiency with',
        'we\'re looking', 'we\'re seeking',
    ];

    // Frases y palabras características de publicaciones de trabajo en español.
    const indicadoresEspanol = [
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
    ];

    let puntosIngles = 0;
    let puntosEspanol = 0;

    for (const indicador of indicadoresIngles) {
        if (texto.includes(indicador)) puntosIngles++;
    }

    for (const indicador of indicadoresEspanol) {
        if (texto.includes(indicador)) puntosEspanol++;
    }

    // Solo descartamos si hay evidencia fuerte y contundente de inglés.
    // El umbral de 2 evita falsos positivos por términos técnicos en inglés.
    if (puntosIngles >= 2 && puntosIngles > puntosEspanol) {
        return 'en';
    }
    return 'es';
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
    detectarIdioma,
};
