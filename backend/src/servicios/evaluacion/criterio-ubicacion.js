// Criterio unificado de normalización y compatibilidad geográfica de ofertas.
// Resuelve equivalencias y localidades de zonas preferidas sin recurrir a geocodificación externa.

/**
 * Zonas amplias metropolitanas y sus sinónimos formales.
 * No se incluyen puntos cardinales aislados ('oeste', 'norte', 'sur') para evitar
 * asimilar erróneamente zonas de otras provincias (ej: "Zona Oeste de Córdoba").
 */
const ZONAS_AMPLIAS = {
    caba: {
        sinonimos: [
            'caba',
            'capital federal',
            'ciudad autonoma de buenos aires',
            'ciudad de buenos aires',
            'buenos aires caba',
            'caba buenos aires',
            'capital federal buenos aires',
            'buenos aires capital federal',
        ],
        localidades: [
            'palermo',
            'recoleta',
            'belgrano',
            'microcentro',
            'puerto madero',
            'caballito',
            'almagro',
            'villa urquiza',
            'villa crespo',
            'nunez',
            'nuñez',
            'saavedra',
            'colegiales',
            'barracas',
            'parque patricios',
            'san telmo',
            'retiro',
            'balvanera',
            'monserrat',
            'constitucion',
            'flores',
            'floresta',
            'villa devoto',
            'villa del parque',
            'chacarita',
        ],
    },
    'gba oeste': {
        sinonimos: ['gba oeste', 'zona oeste', 'gran buenos aires oeste'],
        localidades: [
            'moron',
            'morón',
            'hurlingham',
            'castelar',
            'haedo',
            'ituzaingo',
            'ituzaingó',
            'merlo',
            'moreno',
            'san justo',
            'la matanza',
            'ramos mejia',
            'ramos mejía',
            'tres de febrero',
            'caseros',
            'ciudadela',
            'el palomar',
            'palomar',
            'villa sarmiento',
            'san antonio de padua',
            'padua',
            'paso del rey',
            'villa luzuriaga',
            'lomas del mirador',
        ],
    },
    'gba norte': {
        sinonimos: ['gba norte', 'zona norte', 'gran buenos aires norte'],
        localidades: [
            'vicente lopez',
            'vicente lópez',
            'olivos',
            'florida',
            'san isidro',
            'martinez',
            'martínez',
            'acassuso',
            'beccar',
            'tigre',
            'san fernando',
            'victoria',
            'pilar',
            'escobar',
            'nordelta',
        ],
    },
    'gba sur': {
        sinonimos: ['gba sur', 'zona sur', 'gran buenos aires sur'],
        localidades: [
            'avellaneda',
            'lanus',
            'lanús',
            'quilmes',
            'bernal',
            'lomas de zamora',
            'banfield',
            'temperley',
            'adrogue',
            'adrogué',
            'berazategui',
            'florencio varela',
        ],
    },
};

/**
 * Marcadores geográficos de otras provincias y localidades del interior ajenas al AMBA (CABA/GBA).
 * Si la ubicación incluye alguno de estos términos (ej: "Córdoba", "Rosario", "Tierra del Fuego"),
 * no se asimila a las zonas del AMBA.
 */
const MARCADORES_EXTRAPROVINCIALES = [
    'cordoba',
    'santa fe',
    'rosario',
    'mendoza',
    'tucuman',
    'tierra del fuego',
    'neuquen',
    'salta',
    'entre rios',
    'misiones',
    'corrientes',
    'chaco',
    'san juan',
    'san luis',
    'rio negro',
    'chubut',
    'la pampa',
    'formosa',
    'jujuy',
    'catamarca',
    'la rioja',
    'santiago del estero',
    'mar del plata',
    'bahia blanca',
    'tandil',
];

/**
 * Marcadores geográficos de países y jurisdicciones extranjeras explícitas.
 * Evita que homonimias (ej: "Palermo, Italia" con CABA o "Florida, USA" con GBA Norte)
 * pasen indebidamente como compatibles con el AMBA o la Argentina.
 */
const MARCADORES_EXTRANJEROS = [
    'italia',
    'italy',
    'usa',
    'eeuu',
    'u s a',
    'united states',
    'estados unidos',
    'espana',
    'spain',
    'mexico',
    'colombia',
    'chile',
    'peru',
    'uruguay',
    'brasil',
    'brazil',
    'canada',
    'uk',
    'united kingdom',
    'reino unido',
    'england',
    'inglaterra',
    'alemania',
    'germany',
    'deutschland',
    'francia',
    'france',
    'portugal',
    'australia',
    'paraguay',
    'bolivia',
    'ecuador',
    'venezuela',
    'netherlands',
    'paises bajos',
    'holanda',
    'irlanda',
    'ireland',
    'polonia',
    'poland',
    'suiza',
    'switzerland',
    'austria',
    'belgica',
    'belgium',
    'europa',
    'europe',
];

/**
 * Marcadores textuales que representan ubicación no especificada, a convenir o desconocida.
 * Permite preservar la incertidumbre (null) sin forzar compatibilidad ni incompatibilidad.
 */
const MARCADORES_UBICACION_DESCONOCIDA = [
    'a convenir',
    'sin especificar',
    'no especificada',
    'no especificado',
    'indistinto',
    'desconocida',
    'desconocido',
    'unknown',
    'n a',
    'presencial',
];

// Variantes directas para localidades individuales específicas
const SINONIMOS_LOCALIDADES = {
    'el palomar': ['palomar'],
    palomar: ['el palomar'],
    'san antonio de padua': ['padua'],
    padua: ['san antonio de padua'],
};

/**
 * Divide una cadena de ubicación que declara múltiples sedes o alternativas
 * (ej: "Palermo, CABA o Rosario, Santa Fe", "CABA / Córdoba").
 *
 * @param {string} ubicacionRaw
 * @returns {string[]}
 */
function dividirUbicacionesAlternativas(ubicacionRaw) {
    if (!ubicacionRaw || typeof ubicacionRaw !== 'string') return [];
    return ubicacionRaw
        .split(/\s+(?:o|or)\s+|[/|;\n]+/i)
        .map(p => p.trim())
        .filter(Boolean);
}

/**
 * Tabla plana de equivalencias y localidades para compatibilidad con consumidores externos.
 */
const ALIASES_ZONAS = {
    caba: [...ZONAS_AMPLIAS.caba.sinonimos, ...ZONAS_AMPLIAS.caba.localidades],
    'gba oeste': [...ZONAS_AMPLIAS['gba oeste'].sinonimos, ...ZONAS_AMPLIAS['gba oeste'].localidades],
    'gba norte': [...ZONAS_AMPLIAS['gba norte'].sinonimos, ...ZONAS_AMPLIAS['gba norte'].localidades],
    'gba sur': [...ZONAS_AMPLIAS['gba sur'].sinonimos, ...ZONAS_AMPLIAS['gba sur'].localidades],
};

/**
 * Normaliza una cadena para comparación geográfica:
 * minúsculas, sin acentos (NFD), sin signos de puntuación innecesarios.
 *
 * @param {string} texto
 * @returns {string}
 */
function normalizarTextoGeografico(texto = '') {
    if (!texto || typeof texto !== 'string') return '';
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,;/\\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Verifica si un texto normalizado contiene un término específico respetando límites de palabra.
 *
 * @param {string} textoNorm
 * @param {string} terminoNorm
 * @returns {boolean}
 */
function contieneTerminoConLimites(textoNorm, terminoNorm) {
    if (!textoNorm || !terminoNorm) return false;
    const escaped = terminoNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(textoNorm);
}

/**
 * Determina si una mención de un marcador geográfico corresponde exclusivamente al nombre de una calle
 * dentro de una dirección declarada en CABA o AMBA (ej: "Avenida Santa Fe 1600, Recoleta, CABA",
 * "Calle Chile 1200, San Telmo, CABA").
 *
 * @param {string} textoNorm - Ubicación normalizada.
 * @param {string} marcadorNorm - Marcador geográfico a comprobar (ej: "santa fe", "chile").
 * @returns {boolean}
 */
function esSoloNombreDeCalleLocal(textoNorm, marcadorNorm) {
    if (!textoNorm || !marcadorNorm) return false;

    // Verificar si la sede declara pertenecer a CABA o AMBA
    const tieneJurisdiccionLocal = /\b(?:caba|capital federal|ciudad autonoma de buenos aires|ciudad de buenos aires|buenos aires|gran buenos aires|gba)\b/i.test(textoNorm) ||
        Object.values(ZONAS_AMPLIAS).some(def =>
            def.localidades.some(loc => contieneTerminoConLimites(textoNorm, normalizarTextoGeografico(loc)))
        );

    if (!tieneJurisdiccionLocal) return false;

    const regexCalle = new RegExp(
        `(?:\\b(?:av|ave|avenida|calle|pasaje|diagonal|bv|boulevard|ruta)\\s+${marcadorNorm}\\b|\\b${marcadorNorm}\\s+\\d{1,5}\\b)`,
        'gi'
    );

    if (!regexCalle.test(textoNorm)) return false;

    // Quitamos las ocurrencias de calles y verificamos si aún queda el marcador como jurisdicción aislada
    const sinCalles = textoNorm.replace(regexCalle, ' ');
    return !contieneTerminoConLimites(sinCalles, marcadorNorm);
}

/**
 * Determina si una zona dada (ej: "CABA" o "GBA Oeste") coincide con una localidad/ubicación.
 *
 * Reglas:
 * - Si la ubicación contiene una jurisdicción extranjera explícita y la preferencia no es dicho país,
 *   no se asimila a CABA ni GBA (evita homonimias como "Palermo, Italia" o "Florida, USA"),
 *   salvo que se trate exclusivamente del nombre de una calle en una dirección local (ej: "Calle Chile 1200, CABA").
 * - Si la preferencia es una ZONA AMPLIA (ej: "GBA Oeste", "CABA", "Capital Federal"),
 *   coincide tanto con el nombre de la zona como con cualquiera de sus localidades o barrios componentes,
 *   siempre que la ubicación no pertenezca expresamente a otra provincia o jurisdicción exterior.
 * - Si la preferencia es una LOCALIDAD ESPECÍFICA (ej: "Morón", "Caseros", "Palermo"),
 *   solo coincide con dicha localidad o sus variantes directas exactas con límites de palabra,
 *   evitando expandir indebidamente a otras localidades del mismo cordón geográfico.
 *
 * @param {string} ubicacionTextoNorm - Ubicación ya normalizada.
 * @param {string} zonaTextoNorm - Zona preferida ya normalizada.
 * @returns {boolean}
 */
function coincideZonaConUbicacion(ubicacionTextoNorm, zonaTextoNorm) {
    if (!ubicacionTextoNorm || !zonaTextoNorm) return false;

    // Si la cadena normalizada aún conserva una disyunción ("o", "or"), se evalúa cada rama.
    if (/\b(?:o|or)\b/i.test(ubicacionTextoNorm)) {
        const partes = ubicacionTextoNorm.split(/\b(?:o|or)\b/i).map(p => p.trim()).filter(Boolean);
        if (partes.length > 1) {
            return partes.some(p => coincideZonaConUbicacion(p, zonaTextoNorm));
        }
    }

    // 1. Verificación de jurisdicción extranjera explícita:
    // Si la ubicación contiene un país o región del exterior y NO menciona "argentina",
    // comprobamos si dicho marcador es en realidad el nombre de una calle dentro de una dirección
    // explícitamente ubicada en CABA / Buenos Aires (ej: "Calle Chile 1200, San Telmo, CABA").
    // Si no es un nombre de calle en CABA/AMBA, es una jurisdicción extranjera incompatible.
    const esExtranjera = MARCADORES_EXTRANJEROS.some(p => {
        if (!contieneTerminoConLimites(ubicacionTextoNorm, p)) return false;
        if (contieneTerminoConLimites(ubicacionTextoNorm, 'argentina')) return false;
        if (esSoloNombreDeCalleLocal(ubicacionTextoNorm, p)) return false;
        return true;
    });

    if (esExtranjera) {
        const coincideConPais = MARCADORES_EXTRANJEROS.some(
            p => contieneTerminoConLimites(ubicacionTextoNorm, p) && contieneTerminoConLimites(zonaTextoNorm, p)
        );
        if (!coincideConPais) {
            return false;
        }
    }

    // 2. Determino si la zona preferida es una ZONA AMPLIA del AMBA (ej: "CABA", "Capital Federal", "GBA Oeste", "Zona Oeste").
    let zonaAmpliaDefinida = null;
    for (const def of Object.values(ZONAS_AMPLIAS)) {
        const coincideSinonimo = def.sinonimos.some(sin => {
            const sinNorm = normalizarTextoGeografico(sin);
            return contieneTerminoConLimites(zonaTextoNorm, sinNorm) || contieneTerminoConLimites(sinNorm, zonaTextoNorm);
        });
        if (coincideSinonimo) {
            zonaAmpliaDefinida = def;
            break;
        }
    }

    // 3. Si la preferencia corresponde al AMBA (zona amplia o localidad específica del AMBA),
    // comprobamos si la ubicación contiene un marcador extraprovincial explícito (ej: "Zona Oeste de Córdoba").
    // Si el marcador corresponde a una calle local (ej: "Avenida Santa Fe 1600, CABA"), no se trata de otra provincia.
    const esZonaAmba = Boolean(zonaAmpliaDefinida) ||
        Object.values(ZONAS_AMPLIAS).some(def =>
            def.localidades.some(loc => {
                const locNorm = normalizarTextoGeografico(loc);
                return contieneTerminoConLimites(zonaTextoNorm, locNorm);
            })
        );

    if (esZonaAmba) {
        const esExtraprovincial = MARCADORES_EXTRAPROVINCIALES.some(m => {
            if (!contieneTerminoConLimites(ubicacionTextoNorm, m)) return false;
            if (esSoloNombreDeCalleLocal(ubicacionTextoNorm, m)) return false;
            return true;
        });
        if (esExtraprovincial) {
            return false;
        }
    }

    if (zonaAmpliaDefinida) {
        const terminosPermitidos = [...zonaAmpliaDefinida.sinonimos, ...zonaAmpliaDefinida.localidades];
        for (const termino of terminosPermitidos) {
            const termNorm = normalizarTextoGeografico(termino);
            if (contieneTerminoConLimites(ubicacionTextoNorm, termNorm)) {
                return true;
            }
        }
        return false;
    }

    // 4. Coincidencia directa con límites de palabra para preferencias generales (ej: "Córdoba" en "Córdoba, Argentina").
    if (contieneTerminoConLimites(ubicacionTextoNorm, zonaTextoNorm)) {
        return true;
    }

    // 5. Si la preferencia es una LOCALIDAD ESPECÍFICA (ej: "Morón", "Caseros", "Palermo"),
    // NO se expande a todo el clúster. Solo se cotejan sus variantes directas conocidas con límites de palabra.
    const sinonimosLoc = SINONIMOS_LOCALIDADES[zonaTextoNorm] || [];
    for (const sin of sinonimosLoc) {
        const sinNorm = normalizarTextoGeografico(sin);
        if (contieneTerminoConLimites(ubicacionTextoNorm, sinNorm)) {
            return true;
        }
    }

    return false;
}

/**
 * Verifica si la ubicación de una oferta es compatible con la lista de zonas preferidas.
 *
 * Devuelve:
 * - true si coincide con alguna zona preferida (o no hay zonas configuradas).
 * - false si la ubicación está especificada y no coincide con ninguna zona preferida.
 * - null si la ubicación está ausente o no especificada (incertidumbre conservada).
 *
 * Soporta sedes alternativas (ej: "Palermo, CABA o Rosario, Santa Fe", "CABA / Córdoba"):
 * si al menos una de las alternativas coincide con las zonas preferidas, devuelve true.
 *
 * @param {string|null} ubicacionOferta - Ubicación declarada en la oferta.
 * @param {string[]} zonasPreferidas - Zonas preferidas del candidato.
 * @returns {boolean|null}
 */
function estaEnZonasPreferidas(ubicacionOferta, zonasPreferidas = []) {
    if (!Array.isArray(zonasPreferidas) || zonasPreferidas.length === 0) {
        return true;
    }

    if (!ubicacionOferta || typeof ubicacionOferta !== 'string' || ubicacionOferta.trim() === '') {
        return null; // Ubicación desconocida: no afirma compatibilidad ni incompatibilidad.
    }

    const sedes = dividirUbicacionesAlternativas(ubicacionOferta);
    if (sedes.length === 0) {
        return null;
    }

    let algunNull = false;
    let algunTrue = false;

    for (const sede of sedes) {
        const sedeNorm = normalizarTextoGeografico(sede);
        if (!sedeNorm || MARCADORES_UBICACION_DESCONOCIDA.includes(sedeNorm)) {
            algunNull = true;
            continue;
        }

        let sedeCoincide = false;
        for (const zona of zonasPreferidas) {
            const zonaNorm = normalizarTextoGeografico(zona);
            if (coincideZonaConUbicacion(sedeNorm, zonaNorm)) {
                sedeCoincide = true;
                break;
            }
        }

        if (sedeCoincide) {
            algunTrue = true;
            break;
        }
    }

    // Si al menos una sede alternativa es compatible (ej: "Palermo, CABA o Rosario, Santa Fe"),
    // la oferta ofrece una ubicación compatible.
    if (algunTrue) {
        return true;
    }

    // Si no hubo ninguna sede confirmada como compatible pero hay incertidumbre en alguna sede,
    // se conserva la incertidumbre (null).
    if (algunNull) {
        return null;
    }

    // Si todas las sedes evaluadas son confirmadamente incompatibles, devuelve false.
    return false;
}

// Patrones donde Argentina o Latam forman parte explícita de la misma cláusula de elegibilidad
const PATRONES_APERTURA_ELEGIBILIDAD = [
    /\b(?:us|usa|united\s+states|canada|spain|espana)\s+(?:or|y|\/)\s+(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\s+residents?\b/i,
    /\b(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\s+(?:or|y|\/)\s+(?:us|usa|united\s+states|canada|spain|espana)\s+residents?\b/i,
    /\b(?:us|usa|united\s+states|canada|spain|espana)\s+(?:or|y|\/)\s+(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\s*[-–—]?\s*based\b/i,
    /\b(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\s+(?:or|y|\/)\s+(?:us|usa|united\s+states|canada|spain|espana)\s*[-–—]?\s*based\b/i,
    /\bmust\s+reside\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|espana)\s+(?:or|y|\/)\s+(?:the\s+)?(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\b/i,
    /\bremote\s*[-–—:]\s*(?:us|usa|united\s+states|canada|spain|espana)\s+(?:or|y|\/)\s+(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\s*(?:only\b|residents?\s+only)?/i,
    /\b(?:residents?\s+(?:of|in)|residentes\s+en)\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|espana)\s+(?:or|y|\/)\s+(?:the\s+)?(?:argentina|latam|latin\s+america|sudamerica|south\s+america)\b/i,
];

// Patrones estrictos de restricción territorial a otros países / regiones.
// Requieren contexto expreso de contratación, residencia o elegibilidad para evitar colisiones
// con presencia de oficinas ("offices in the US only") o con el pronombre en inglés ("send us only your resume").
const PATRONES_RESTRICCION = [
    /\b(?:usa|united\s+states|u\s*s\s*a|ee\s*uu)\s+(?:residents?\s+only|based\s+only|citizens?\s+only)\b/i,
    /\b(?:usa|united\s+states|u\s*s\s*a|ee\s*uu)\s*[-–—]?\s*based\s+(?:candidates?|applicants?|engineers?|developers?|roles?)?\s*only\b/i,
    /\bus\s+(?:residents?\s+only|based\s+only|citizens?\s+only)\b/i,
    /\bus\s*[-–—]?\s*based\s+(?:candidates?|applicants?|engineers?|developers?|roles?)?\s*only\b/i,
    /\bcanada\s+(?:residents?\s+only|based\s+only|citizens?\s+only)\b/i,
    /\b(?:residents?\s+(?:of|in)|residentes\s+(?:de|en))\s+(?:the\s+)?(?:us|usa|united\s+states|ee\s*uu|canada|spain|espana|uk|europe|europa)\s+(?:only|solamente|unicamente)\b/i,
    /\b(?:residents?\s+(?:of|in)|residentes\s+(?:de|en))\s+(?:the\s+)?(?:us|usa|united\s+states|ee\s*uu|canada|spain|espana|uk|europe|europa)\b/i,
    /\b(?:only|solo)\s+(?:para\s+)?(?:residentes\s+(?:de|en)\s+)?(?:us|usa|united\s+states|ee\s*uu|canada|spain|espana|uk|europa|europe)\s+(?:residents?|residentes)\b/i,
    /\bmust\s+reside\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|uk|europe)\b/i,
    /\bremote\s*[-–—:]\s*(?:us|usa|united\s+states|canada|spain|espana)\s+(?:residents?\s+only|only\b)/i,
    /\bremote\s*\(\s*(?:us|usa|united\s+states|canada|spain|espana)\s+(?:only|residents?\s+only)\s*\)/i,
    /\b(?:candidates?|applicants?)\s+must\s+be\s+(?:located|based)\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|uk|europe)\b/i,
];

/**
 * Detecta si una oferta de modalidad remota posee una restricción territorial excluyente
 * incompatible con un candidato radicado en Argentina (ej: "Remote — US residents only", "US-based candidates only").
 *
 * Prioriza requisitos explícitos en el texto del puesto y en candidate_required_location.
 * Una mención incidental a la sede administrativa o de búsqueda (ej: "Buenos Aires, Argentina")
 * no invalida un requisito explícito de residencia extranjera en la descripción, ni una mención de
 * clientes/servicios en otra frase ("Our clients are in the US or Argentina") anula una cláusula obligatoria.
 *
 * @param {Object} oferta - Oferta laboral con titulo, descripcion, ubicacion, datos_crudos.
 * @returns {{ detectado: boolean, patron: string|null, evidencia: string|null }}
 */
function detectarRestriccionRemotaIncompatible(oferta = {}) {
    const modalidad = (oferta.modalidad || '').toLowerCase().trim();
    if (modalidad !== 'remoto') {
        return { detectado: false, patron: null, evidencia: null };
    }

    // 1. Verificación estructurada si la plataforma provee candidate_required_location (ej. Remotive, etc.)
    if (oferta.datos_crudos && typeof oferta.datos_crudos === 'object' && oferta.datos_crudos.candidate_required_location) {
        const reqLocRaw = String(oferta.datos_crudos.candidate_required_location).trim();
        const reqLocNorm = normalizarTextoGeografico(reqLocRaw);

        const esAptaReqLoc = /\b(?:argentina|latam|latin\s+america|sudamerica|south\s+america|worldwide|anywhere|global)\b/i.test(reqLocNorm);
        const esRestriccionTerritorialReqLoc = /\b(?:us|usa|united\s+states|u\s*s\s*a|canada|uk|united\s+kingdom|europe|europa|spain|espana|germany|alemania|france|francia)\b/i.test(reqLocNorm);

        if (esRestriccionTerritorialReqLoc && !esAptaReqLoc) {
            return {
                detectado: true,
                patron: 'remoto_restringido_pais',
                evidencia: `candidate_required_location: ${reqLocRaw}`,
            };
        }
    }

    // 2. Verificación en el texto del puesto (título y descripción).
    const textoPuesto = `${oferta.titulo || ''} \n ${oferta.descripcion || ''}`;

    // Dividimos por oraciones y separadores mayores, contemplando también cortes cuando una coma,
    // una conjunción («and», «y», «while», «mientras», «but», «pero») o espacio da paso a menciones sobre otros roles
    // o clientes/oficinas de la empresa (evitando que queden fusionados en una sola cláusula).
    const clausulas = textoPuesto
        .split(/[.\n;!–—]+|(?:\s*,\s*|\s+(?:and|y|while|mientras|but|pero)\s+|\s+)(?=(?:for\s+other|para\s+otr|our\s+clients|nuestros\s+clientes|our\s+offices|nuestras\s+oficinas)\b)/i)
        .map(c => normalizarTextoGeografico(c))
        .filter(Boolean);

    for (const clausula of clausulas) {
        // Si la cláusula contiene una referencia a otros roles:
        // Evaluamos si el texto previo a dicha mención contiene una restricción explícita para la vacante actual.
        const regexOtroRol = /\b(?:for\s+other\s+(?:roles?|positions?|jobs?|openings?)|para\s+otr(?:os?|as?)\s+(?:puestos?|roles?|posiciones?))\b/i;
        const coincidenciaOtroRol = clausula.match(regexOtroRol);

        if (coincidenciaOtroRol) {
            const indiceOtroRol = coincidenciaOtroRol.index;
            const subfrasePrevia = clausula.slice(0, indiceOtroRol).trim();

            if (subfrasePrevia) {
                // Comprobamos si la subfrase previa para esta vacante contiene restricción explícita
                const tieneAperturaPrevia = PATRONES_APERTURA_ELEGIBILIDAD.some(patron => patron.test(subfrasePrevia));
                if (!tieneAperturaPrevia) {
                    for (const patron of PATRONES_RESTRICCION) {
                        const coincidencia = subfrasePrevia.match(patron);
                        if (coincidencia) {
                            return {
                                detectado: true,
                                patron: 'remoto_restringido_pais',
                                evidencia: coincidencia[0],
                            };
                        }
                    }
                }
            }

            // Descartamos la subfrase correspondiente a otros roles para que no confunda aperturas ni restricciones.
            continue;
        }

        // Ignoramos cláusulas que solo describen presencia de oficinas, sedes o clientes
        // (ej: "We have offices in the United States only", "Our clients are in the US or Argentina")
        // sin establecer requisitos hacia los candidatos/postulantes.
        const esMencionExclusivaSedesOClientes = /\b(?:offices?|oficinas?|headquarters?|hq|clientes?|clients?|customers?)\b/i.test(clausula) &&
            !/\b(?:residents?|candidates?|applicants?|engineers?|developers?|roles?|contratacion|hiring)\b/i.test(clausula);
        if (esMencionExclusivaSedesOClientes) {
            continue;
        }

        // Si esta cláusula específica incluye una apertura explícita de elegibilidad conjunta para el puesto
        // (ej: "US or Argentina residents only", "Remote - US or Latam only"), no constituye una restricción excluyente.
        const tieneAperturaLocal = PATRONES_APERTURA_ELEGIBILIDAD.some(patron => patron.test(clausula));
        if (tieneAperturaLocal) {
            continue;
        }

        for (const patron of PATRONES_RESTRICCION) {
            const coincidencia = clausula.match(patron);
            if (coincidencia) {
                return {
                    detectado: true,
                    patron: 'remoto_restringido_pais',
                    evidencia: coincidencia[0],
                };
            }
        }
    }

    return { detectado: false, patron: null, evidencia: null };
}

module.exports = {
    ALIASES_ZONAS,
    normalizarTextoGeografico,
    dividirUbicacionesAlternativas,
    coincideZonaConUbicacion,
    estaEnZonasPreferidas,
    detectarRestriccionRemotaIncompatible,
};
