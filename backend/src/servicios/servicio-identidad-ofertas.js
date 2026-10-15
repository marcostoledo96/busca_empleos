// Servicio de identidad y canonización de ofertas de empleo.
//
// Centralizo las reglas para extraer identificadores únicos estables de cada plataforma,
// canonizar URLs limpiando parámetros volátiles o de tracking, y calcular
// la identidad canónica de una oferta.
//
// Regla fundamental: en ningún caso utilizo título ni empresa como sustituto
// de identidad de oferta.

const PARAMETROS_TRACKING_UNIVERSALES = new Set([
    'fbclid',
    'gclid',
    'msclkid',
    'dclid',
    'mc_cid',
    'mc_eid',
    'igshid',
]);

const PARAMETROS_TRACKING_INDEED = new Set([
    'from',
    'vjs',
    'tk',
    'advn',
    'adloc',
    'qd',
    'subts',
    'iaf',
    'attributionid',
    'mobview',
]);

const PARAMETROS_TRACKING_LINKEDIN = new Set([
    'refid',
    'trackingid',
    'trk',
    'midtoken',
    'originalsubdomain',
    'trkinfo',
]);

/**
 * Determino si un parámetro de búsqueda corresponde a tracking universal.
 *
 * @param {string} clave - Nombre del parámetro.
 * @returns {boolean}
 */
function esParametroTrackingUniversal(clave) {
    const c = String(clave || '').toLowerCase();
    if (c.startsWith('utm_')) return true;
    return PARAMETROS_TRACKING_UNIVERSALES.has(c);
}

/**
 * Determino si un parámetro de Indeed corresponde a tracking.
 *
 * @param {string} clave - Nombre del parámetro.
 * @returns {boolean}
 */
function esParametroTrackingIndeed(clave) {
    const c = String(clave || '').toLowerCase();
    if (esParametroTrackingUniversal(c)) return true;
    return PARAMETROS_TRACKING_INDEED.has(c);
}

/**
 * Determino si un parámetro de LinkedIn corresponde a tracking.
 *
 * @param {string} clave - Nombre del parámetro.
 * @returns {boolean}
 */
function esParametroTrackingLinkedin(clave) {
    const c = String(clave || '').toLowerCase();
    if (esParametroTrackingUniversal(c)) return true;
    return PARAMETROS_TRACKING_LINKEDIN.has(c);
}

/**
 * Extraigo el identificador único nativo de la plataforma si existe y es confiable.
 *
 * @param {string|null|undefined} url - URL de la oferta.
 * @param {string} plataforma - Nombre de la plataforma.
 * @param {Object} [datosCrudos=null] - Datos crudos del proveedor.
 * @returns {string|null} Identificador extraído o null.
 */
function extraerIdentificadorPlataforma(url, plataforma, datosCrudos = null) {
    const plat = String(plataforma || '').toLowerCase().trim();
    const crudos = datosCrudos && typeof datosCrudos === 'object' ? datosCrudos : null;

    let urlObj = null;
    if (url && typeof url === 'string') {
        try {
            urlObj = new URL(url.trim());
        } catch {
            urlObj = null;
        }
    }

    if (plat === 'indeed') {
        // Extraigo jk o vjk de searchParams o datosCrudos
        let jk = null;
        if (urlObj) {
            jk = urlObj.searchParams.get('jk') || urlObj.searchParams.get('vjk');
        }
        if (!jk && crudos) {
            jk = crudos.jk || crudos.vjk || crudos.key || crudos.jobKey || crudos.id;
        }
        if (!jk && typeof url === 'string') {
            const matchJk = url.match(/[?&](?:jk|vjk)=([a-zA-Z0-9]+)/i);
            if (matchJk) {
                jk = matchJk[1];
            } else {
                const matchJob = url.match(/\/job\/.*-([a-zA-Z0-9]{16})(?:[/?#]|$)/i);
                if (matchJob) {
                    jk = matchJob[1];
                }
            }
        }
        if (jk && /^[a-zA-Z0-9]+$/.test(String(jk))) {
            return String(jk).toLowerCase();
        }
        return null;
    }

    if (plat === 'linkedin') {
        // Extraigo job ID de /jobs/view/{id}, /jobs/view/{slug}-{id}, currentJobId o jobId.
        // Validar numérico /^\d{8,16}$/
        let jobId = null;
        if (urlObj) {
            const pathname = urlObj.pathname;
            const matchView = pathname.match(/\/jobs\/view\/(?:[a-zA-Z0-9_%-]+-)?(\d{8,16})(?:[/?#]|$)/i);
            if (matchView) {
                jobId = matchView[1];
            }
            if (!jobId) {
                const qId = urlObj.searchParams.get('currentJobId') || urlObj.searchParams.get('jobId');
                if (qId && /^\d{8,16}$/.test(qId)) {
                    jobId = qId;
                }
            }
        } else if (typeof url === 'string') {
            const matchView = url.match(/\/jobs\/view\/(?:[a-zA-Z0-9_%-]+-)?(\d{8,16})(?:[/?#]|$)/i);
            if (matchView) {
                jobId = matchView[1];
            }
        }

        if (!jobId && crudos) {
            const idCandidato = crudos.jobId || crudos.currentJobId || crudos.id;
            if (idCandidato && /^\d{8,16}$/.test(String(idCandidato))) {
                jobId = String(idCandidato);
            }
        }

        return jobId || null;
    }

    if (plat === 'getonbrd') {
        let id = null;
        if (urlObj) {
            const match = urlObj.pathname.match(/\/jobs\/(?:[a-zA-Z0-9_-]+\/)?([a-zA-Z0-9_-]+)(?:[/?#]|$)/i);
            if (match && match[1] && match[1] !== 'jobs') {
                id = match[1];
            }
        }
        if (!id && crudos && crudos.id) {
            id = String(crudos.id).trim();
        }
        if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
            return id;
        }
        return null;
    }

    if (plat === 'computrabajo') {
        let id = null;
        if (crudos && crudos.id) {
            id = String(crudos.id).trim();
        }
        if (!id && urlObj) {
            const match = urlObj.pathname.match(/(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})/i)
                || urlObj.pathname.match(/([a-fA-F0-9]{32})/i);
            if (match) {
                id = match[1];
            }
        }
        if (id && /^[a-zA-Z0-9]+$/.test(id)) {
            return id;
        }
        return null;
    }

    if (plat === 'bumeran') {
        let id = null;
        if (urlObj) {
            const match = urlObj.pathname.match(/\/empleos\/.*-(\d+)\.html/i)
                || urlObj.pathname.match(/-(\d+)\.html/i);
            if (match) {
                id = match[1];
            }
        }
        if (!id && crudos && crudos.id) {
            id = String(crudos.id).trim();
        }
        if (id && /^\d+$/.test(id)) {
            return id;
        }
        return null;
    }

    if (plat === 'glassdoor') {
        let id = null;
        if (urlObj) {
            id = urlObj.searchParams.get('jl') || urlObj.searchParams.get('jobListingId');
            if (!id) {
                const match = urlObj.pathname.match(/jl=(\d+)/i) || urlObj.pathname.match(/jobListingId=(\d+)/i);
                if (match) {
                    id = match[1];
                }
            }
        }
        if (!id && crudos) {
            id = crudos.jl || crudos.jobListingId || crudos.id;
        }
        if (id && /^[a-zA-Z0-9]+$/.test(String(id))) {
            return String(id);
        }
        return null;
    }

    if (['jooble', 'remoteok', 'remotive', 'infojobs', 'adzuna'].includes(plat)) {
        if (crudos && crudos.id != null) {
            const idStr = String(crudos.id).trim();
            if (idStr && /^[a-zA-Z0-9_-]+$/.test(idStr)) {
                return idStr;
            }
        }
        if (plat === 'jooble' && urlObj) {
            const match = urlObj.pathname.match(/\/desc\/([a-zA-Z0-9_-]+)/i);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    return null;
}

/**
 * Canonizo una URL según la plataforma limpiando tracking y normalizando componentes.
 *
 * @param {string} url - URL a canonizar.
 * @param {string} [plataforma='general'] - Plataforma asociada.
 * @returns {string} URL canonizada o la URL original si es inválida.
 */
function canonizarUrlPlataforma(url, plataforma = 'general') {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return url || '';
    }

    const plat = String(plataforma || 'general').toLowerCase().trim();
    const urlLimpia = url.trim();

    let parseada;
    try {
        parseada = new URL(urlLimpia);
    } catch {
        return urlLimpia;
    }

    if (!['http:', 'https:'].includes(parseada.protocol)) {
        return urlLimpia;
    }

    parseada.host = parseada.host.toLowerCase();
    parseada.hash = '';

    if (plat === 'indeed') {
        const jk = extraerIdentificadorPlataforma(urlLimpia, 'indeed');
        if (jk) {
            parseada.pathname = '/viewjob';
            parseada.search = `?jk=${jk}`;
            return parseada.toString();
        }
        // Sin jk: remuevo tracking conocido de Indeed
        const paramsABorrar = [];
        for (const [clave] of parseada.searchParams.entries()) {
            if (esParametroTrackingIndeed(clave)) {
                paramsABorrar.push(clave);
            }
        }
        for (const clave of paramsABorrar) {
            parseada.searchParams.delete(clave);
        }
        if (parseada.pathname.length > 1 && parseada.pathname.endsWith('/')) {
            parseada.pathname = parseada.pathname.slice(0, -1);
        }
        parseada.searchParams.sort();
        return parseada.toString();
    }

    if (plat === 'linkedin') {
        const jobId = extraerIdentificadorPlataforma(urlLimpia, 'linkedin');
        if (jobId) {
            return `https://www.linkedin.com/jobs/view/${jobId}`;
        }
        // Sin jobId numérico: normalización conservadora
        const paramsABorrar = [];
        for (const [clave] of parseada.searchParams.entries()) {
            if (esParametroTrackingLinkedin(clave)) {
                paramsABorrar.push(clave);
            }
        }
        for (const clave of paramsABorrar) {
            parseada.searchParams.delete(clave);
        }
        if (parseada.pathname.length > 1 && parseada.pathname.endsWith('/')) {
            parseada.pathname = parseada.pathname.slice(0, -1);
        }
        parseada.searchParams.sort();
        return parseada.toString();
    }

    if (plat === 'computrabajo') {
        const paramsABorrar = [];
        for (const [clave] of parseada.searchParams.entries()) {
            if (esParametroTrackingUniversal(clave) || clave.toLowerCase() === 'id_origen') {
                paramsABorrar.push(clave);
            }
        }
        for (const clave of paramsABorrar) {
            parseada.searchParams.delete(clave);
        }
        if (parseada.pathname.length > 1 && parseada.pathname.endsWith('/')) {
            parseada.pathname = parseada.pathname.slice(0, -1);
        }
        parseada.searchParams.sort();
        return parseada.toString();
    }

    if (plat === 'glassdoor') {
        const paramsABorrar = [];
        for (const [clave] of parseada.searchParams.entries()) {
            const cl = clave.toLowerCase();
            if (cl === 'jl' || cl === 'joblistingid') {
                continue; // Conservo identificador
            }
            if (esParametroTrackingUniversal(clave)) {
                paramsABorrar.push(clave);
            }
        }
        for (const clave of paramsABorrar) {
            parseada.searchParams.delete(clave);
        }
        if (parseada.pathname.length > 1 && parseada.pathname.endsWith('/')) {
            parseada.pathname = parseada.pathname.slice(0, -1);
        }
        parseada.searchParams.sort();
        return parseada.toString();
    }

    // Regla conservadora para getonbrd, bumeran, jooble, remoteok, remotive, infojobs, adzuna y general
    const paramsABorrar = [];
    for (const [clave] of parseada.searchParams.entries()) {
        if (esParametroTrackingUniversal(clave)) {
            paramsABorrar.push(clave);
        }
    }
    for (const clave of paramsABorrar) {
        parseada.searchParams.delete(clave);
    }
    if (parseada.pathname.length > 1 && parseada.pathname.endsWith('/')) {
        parseada.pathname = parseada.pathname.slice(0, -1);
    }
    parseada.searchParams.sort();
    return parseada.toString();
}

/**
 * Obtengo la identidad canónica única e inmutable de una oferta.
 *
 * En ningún caso se utiliza título ni empresa para sustituir la identidad.
 *
 * @param {Object|string} oferta - Objeto oferta o URL cruda.
 * @returns {string} Identidad canónica estructurada.
 */
function obtenerIdentidadCanonica(oferta) {
    if (!oferta) {
        return 'general:raw:';
    }

    const esString = typeof oferta === 'string';
    const platOriginal = esString ? '' : (oferta.plataforma || '');
    const plat = String(platOriginal || '').toLowerCase().trim();
    const platPrefijo = plat || 'general';

    const urlCruda = esString
        ? oferta
        : (oferta.url || oferta.jobUrl || oferta.link || oferta.redirect_url || oferta.application_link || '');

    const datosCrudos = !esString && typeof oferta === 'object'
        ? (oferta.datos_crudos || oferta.datosCrudos || oferta)
        : null;

    if (!urlCruda || typeof urlCruda !== 'string' || urlCruda.trim() === '') {
        const idDirecto = extraerIdentificadorPlataforma(null, plat, datosCrudos);
        if (idDirecto) {
            return `${platPrefijo}:${idDirecto}`;
        }
        return `${platPrefijo}:raw:`;
    }

    const urlLimpia = urlCruda.trim();

    // Verifico si es una URL sintácticamente válida
    let parseada;
    try {
        parseada = new URL(urlLimpia);
        if (!['http:', 'https:'].includes(parseada.protocol)) {
            throw new Error('Protocolo no soportado');
        }
    } catch {
        // URLs no válidas: retorno plataforma:raw:urlLimpia para evitar colisiones accidentales
        return `${platPrefijo}:raw:${urlLimpia}`;
    }

    const id = extraerIdentificadorPlataforma(urlLimpia, plat, datosCrudos);

    if (plat === 'indeed') {
        if (id) {
            return `indeed:${id.toLowerCase()}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, 'indeed');
        return `indeed:url:${urlCanonica}`;
    }

    if (plat === 'linkedin') {
        if (id) {
            return `linkedin:${id}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, 'linkedin');
        return `linkedin:url:${urlCanonica}`;
    }

    if (plat === 'getonbrd') {
        if (id) {
            return `getonbrd:${id}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, 'getonbrd');
        return `getonbrd:url:${urlCanonica}`;
    }

    if (plat === 'computrabajo') {
        if (id) {
            return `computrabajo:${id}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, 'computrabajo');
        return `computrabajo:url:${urlCanonica}`;
    }

    if (plat === 'bumeran') {
        if (id) {
            return `bumeran:${id}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, 'bumeran');
        return `bumeran:url:${urlCanonica}`;
    }

    if (plat === 'glassdoor') {
        if (id) {
            return `glassdoor:${id}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, 'glassdoor');
        return `glassdoor:url:${urlCanonica}`;
    }

    if (['jooble', 'remoteok', 'remotive', 'infojobs', 'adzuna'].includes(plat)) {
        if (id) {
            return `${plat}:${id}`;
        }
        const urlCanonica = canonizarUrlPlataforma(urlLimpia, plat);
        return `${plat}:url:${urlCanonica}`;
    }

    // Desconocidas o General
    const urlCanonica = canonizarUrlPlataforma(urlLimpia, plat);
    return `${platPrefijo}:url:${urlCanonica}`;
}

module.exports = {
    extraerIdentificadorPlataforma,
    canonizarUrlPlataforma,
    obtenerIdentidadCanonica,
    // Exporto auxiliares para verificación y tests si hiciera falta
    _esParametroTrackingUniversal: esParametroTrackingUniversal,
    _esParametroTrackingIndeed: esParametroTrackingIndeed,
    _esParametroTrackingLinkedin: esParametroTrackingLinkedin,
};
