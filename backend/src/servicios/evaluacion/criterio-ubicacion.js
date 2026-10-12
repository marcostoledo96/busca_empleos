// Criterio unificado de normalización y compatibilidad geográfica de ofertas.
// Resuelve equivalencias y localidades de zonas preferidas sin recurrir a geocodificación externa.

/**
 * Tabla de equivalencias y localidades conocidas para zonas preferidas comunes.
 * Las claves están en minúsculas y sin acentos.
 */
const ALIASES_ZONAS = {
    caba: [
        'caba',
        'capital federal',
        'ciudad autonoma de buenos aires',
        'ciudad de buenos aires',
        'buenos aires caba',
        'caba buenos aires',
        'capital federal buenos aires',
        'buenos aires capital federal',
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
    'gba oeste': [
        'gba oeste',
        'zona oeste',
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
    'gba norte': [
        'gba norte',
        'zona norte',
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
    'gba sur': [
        'gba sur',
        'zona sur',
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
 * Determina si una zona dada (ej: "CABA" o "GBA Oeste") coincide con una localidad/ubicación
 * utilizando la tabla de aliases y correspondencias geográficas conocidas.
 *
 * @param {string} ubicacionTextoNorm - Ubicación ya normalizada.
 * @param {string} zonaTextoNorm - Zona preferida ya normalizada.
 * @returns {boolean}
 */
function coincideZonaConUbicacion(ubicacionTextoNorm, zonaTextoNorm) {
    if (!ubicacionTextoNorm || !zonaTextoNorm) return false;

    // Coincidencia directa de subcadena.
    if (ubicacionTextoNorm.includes(zonaTextoNorm)) {
        return true;
    }

    // Búsqueda en la tabla de equivalencias conocidas bidireccional (zona y ubicación pertenecen al mismo clúster).
    for (const [claveZona, aliases] of Object.entries(ALIASES_ZONAS)) {
        const claveZonaNorm = normalizarTextoGeografico(claveZona);
        const coincideConClave = zonaTextoNorm.includes(claveZonaNorm) || claveZonaNorm.includes(zonaTextoNorm);
        const zonaPerteneceACluster = coincideConClave || aliases.some(a => {
            const aNorm = normalizarTextoGeografico(a);
            return zonaTextoNorm.includes(aNorm) || aNorm.includes(zonaTextoNorm);
        });

        if (zonaPerteneceACluster) {
            for (const alias of [claveZona, ...aliases]) {
                const aliasNorm = normalizarTextoGeografico(alias);
                if (ubicacionTextoNorm.includes(aliasNorm)) {
                    return true;
                }
            }
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
 * incompatible con un candidato radicado en Argentina (ej: "Remote — US residents only", "residentes en España").
 *
 * @param {Object} oferta - Oferta laboral con titulo, descripcion, ubicacion, datos_crudos.
 * @returns {{ detectado: boolean, patron: string|null, evidencia: string|null }}
 */
function detectarRestriccionRemotaIncompatible(oferta = {}) {
    const modalidad = (oferta.modalidad || '').toLowerCase().trim();
    if (modalidad !== 'remoto') {
        return { detectado: false, patron: null, evidencia: null };
    }

    const campos = [
        oferta.titulo || '',
        oferta.descripcion || '',
        oferta.ubicacion || '',
    ];

    if (oferta.datos_crudos && typeof oferta.datos_crudos === 'object') {
        if (oferta.datos_crudos.candidate_required_location) {
            campos.push(`candidate_required_location: ${oferta.datos_crudos.candidate_required_location}`);
        }
        if (oferta.datos_crudos.location) {
            campos.push(`location: ${oferta.datos_crudos.location}`);
        }
    }

    const textoUnido = campos.join(' \n ');
    const textoNorm = normalizarTextoGeografico(textoUnido);

    // Si la restricción incluye expresamente Argentina, Latam, Sudamérica o Worldwide, es compatible.
    const esAptaArgentina = /\b(?:argentina|latam|latin\s+america|sudamerica|south\s+america|worldwide|anywhere|global)\b/i.test(textoNorm);
    if (esAptaArgentina) {
        return { detectado: false, patron: null, evidencia: null };
    }

    // Patrones de restricción territorial a otros países / regiones.
    // Para "us" exijo calificadores territoriales/cívicos ("us residents only", "us based only")
    // para evitar colisiones con el pronombre en inglés ("send us only your resume").
    const PATRONES_RESTRICCION = [
        /\b(?:usa|united\s+states|u\s*s\s*a|ee\s*uu)\s+(?:residents?\s+only|based\s+only|only\b)/i,
        /\bus\s+(?:residents?\s+only|based\s+only|citizens?\s+only)\b/i,
        /\b(?:residents?\s+(?:of|in)|residentes\s+en)\s+(?:the\s+)?(?:us|usa|united\s+states|spain|espana|uk|europe|europa|canada)/i,
        /\b(?:only|solo)\s+(?:para\s+)?(?:residentes\s+en\s+)?(?:us|usa|united\s+states|spain|espana|uk|europa|europe)\s+residents?\b/i,
        /\bmust\s+reside\s+in\s+(?:the\s+)?(?:us|usa|united\s+states|spain|uk|europe)\b/i,
        /\bremote\s*[-–—:]\s*(?:us|usa|united\s+states|spain|espana)\s+residents?\s+only\b/i,
        /\bcandidate_required_location\s*:\s*(?:usa|united\s+states|spain|uk|europe)\b/i,
    ];

    for (const patron of PATRONES_RESTRICCION) {
        const coincidencia = textoNorm.match(patron);
        if (coincidencia) {
            return {
                detectado: true,
                patron: 'remoto_restringido_pais',
                evidencia: coincidencia[0],
            };
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
