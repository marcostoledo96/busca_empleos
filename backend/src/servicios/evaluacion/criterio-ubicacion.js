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

// Variantes directas para localidades individuales específicas
const SINONIMOS_LOCALIDADES = {
    'el palomar': ['palomar'],
    palomar: ['el palomar'],
    'san antonio de padua': ['padua'],
    padua: ['san antonio de padua'],
};

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
 * Determina si una zona dada (ej: "CABA" o "GBA Oeste") coincide con una localidad/ubicación.
 *
 * Reglas:
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

    // 1. Determino si la zona preferida es una ZONA AMPLIA del AMBA (ej: "CABA", "Capital Federal", "GBA Oeste", "Zona Oeste").
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

    // 2. Si la preferencia es una zona amplia del AMBA (CABA o GBA),
    // comprobamos si la ubicación contiene un marcador extraprovincial explícito (ej: "Zona Oeste de Córdoba").
    // En tal caso, NO debe coincidir con el GBA/CABA.
    if (zonaAmpliaDefinida) {
        const esExtraprovincial = MARCADORES_EXTRAPROVINCIALES.some(m => contieneTerminoConLimites(ubicacionTextoNorm, m));
        if (esExtraprovincial) {
            return false;
        }

        const terminosPermitidos = [...zonaAmpliaDefinida.sinonimos, ...zonaAmpliaDefinida.localidades];
        for (const termino of terminosPermitidos) {
            const termNorm = normalizarTextoGeografico(termino);
            if (contieneTerminoConLimites(ubicacionTextoNorm, termNorm)) {
                return true;
            }
        }
        return false;
    }

    // 3. Coincidencia directa con límites de palabra para preferencias generales (ej: "Córdoba" en "Córdoba, Argentina").
    if (contieneTerminoConLimites(ubicacionTextoNorm, zonaTextoNorm)) {
        return true;
    }

    // 4. Si la preferencia es una LOCALIDAD ESPECÍFICA (ej: "Morón", "Caseros", "Palermo"),
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

    const ubicacionNorm = normalizarTextoGeografico(ubicacionOferta);
    if (!ubicacionNorm) {
        return null;
    }

    for (const zona of zonasPreferidas) {
        const zonaNorm = normalizarTextoGeografico(zona);
        if (coincideZonaConUbicacion(ubicacionNorm, zonaNorm)) {
            return true;
        }
    }

    return false;
}

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
    // Evaluamos cláusula por cláusula para que una frase ajena ("Our clients are in the US or Argentina")
    // no anule un requisito excluyente ("Remote — US residents only", "US-based candidates only").
    const textoPuesto = `${oferta.titulo || ''} \n ${oferta.descripcion || ''}`;
    // Dividimos por oraciones y separadores mayores
    const clausulas = textoPuesto.split(/[.\n;!–—]+/).map(c => normalizarTextoGeografico(c)).filter(Boolean);

    // Patrones de restricción territorial a otros países / regiones.
    // Para "us" exigimos calificadores cívicos/territoriales ("us residents only", "us based only", "us-based candidates only")
    // para evitar colisiones con el pronombre en inglés ("send us only your resume").
    const PATRONES_RESTRICCION = [
        /\b(?:usa|united\s+states|u\s*s\s*a|ee\s*uu)\s+(?:residents?\s+only|based\s+only|citizens?\s+only|only\b)/i,
        /\b(?:usa|united\s+states|u\s*s\s*a|ee\s*uu)\s+based\s+(?:candidates?|applicants?|engineers?|developers?|roles?)?\s*only\b/i,
        /\bus\s+(?:residents?\s+only|based\s+only|citizens?\s+only)\b/i,
        /\bus\s+based\s+(?:candidates?|applicants?|engineers?|developers?|roles?)?\s*only\b/i,
        /\bcanada\s+(?:residents?\s+only|based\s+only|citizens?\s+only|only\b)/i,
        /\bcanada\s+based\s+(?:candidates?|applicants?|engineers?|developers?|roles?)?\s*only\b/i,
        /\b(?:residents?\s+(?:of|in)|residentes\s+en)\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|espana|uk|europe|europa)\b/i,
        /\b(?:only|solo)\s+(?:para\s+)?(?:residentes\s+en\s+)?(?:us|usa|united\s+states|canada|spain|espana|uk|europa|europe)\s+residents?\b/i,
        /\bmust\s+reside\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|uk|europe)\b/i,
        /\bremote\s*[-–—:]\s*(?:us|usa|united\s+states|canada|spain|espana)\s+(?:residents?\s+only|only\b)/i,
        /\b(?:candidates?|applicants?)\s+must\s+be\s+(?:located|based)\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|canada|spain|uk|europe)\b/i,
    ];

    for (const clausula of clausulas) {
        for (const patron of PATRONES_RESTRICCION) {
            const coincidencia = clausula.match(patron);
            if (coincidencia) {
                // Verifico si ESTA CLÁUSULA ESPECÍFICA incluye explícitamente apertura a Argentina o Latam
                const incluyeAperturaLocal = /\b(?:argentina|latam|latin\s+america|sudamerica|south\s+america|worldwide|anywhere|global)\b/i.test(clausula);
                if (!incluyeAperturaLocal) {
                    return {
                        detectado: true,
                        patron: 'remoto_restringido_pais',
                        evidencia: coincidencia[0],
                    };
                }
            }
        }
    }

    return { detectado: false, patron: null, evidencia: null };
}

module.exports = {
    ALIASES_ZONAS,
    normalizarTextoGeografico,
    coincideZonaConUbicacion,
    estaEnZonasPreferidas,
    detectarRestriccionRemotaIncompatible,
};
