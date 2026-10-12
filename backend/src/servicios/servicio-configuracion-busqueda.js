// Resuelvo una configuración por ejecución; nunca escribo preferencias ni consulto proveedores.
const pool = require('../config/base-datos');
const { TERMINOS_BUSQUEDA_DEFECTO, construirUrlsBumeran, formatearTerminoComputrabajo } = require('../config/apify');
const { PLATAFORMAS, normalizarIdPlataforma } = require('../config/plataformas');
const {
    traducirParaLinkedin,
    traducirParaBumeran,
    traducirParaIndeed,
    traducirParaJooble,
    traducirParaAdzuna,
    traducirParaComputrabajo,
    traducirParaRemotive,
    traducirParaRemoteOK,
    esTerminoUtilizable,
    obtenerEquivalenciasSugeridas,
    SIGLAS_VALIDAS,
} = require('./servicio-traductor-consultas');

const FUENTES_TERMINOS = new Set(['linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor', 'jooble', 'adzuna', 'remotive', 'remoteok']);
const TAGS_REMOTEOK_DEFECTO = ['frontend', 'react', 'angular', 'node', 'fullstack', 'javascript', 'qa'];

function errorConfiguracion(mensaje, status = 400) {
    return Object.assign(new Error(mensaje), { status, statusCode: status });
}

function validarLista(lista, campo) {
    if (!Array.isArray(lista) || lista.length > 100 || lista.some(valor => typeof valor !== 'string' || !valor.trim() || valor.length > 200)) {
        throw errorConfiguracion(`${campo}: necesito hasta hasta 100 textos no vacíos de hasta 200 caracteres.`);
    }
    return lista.map(valor => valor.trim());
}

function validarOpciones(opciones = {}) {
    if (!opciones || typeof opciones !== 'object' || Array.isArray(opciones)) {
        throw errorConfiguracion('Las opciones de búsqueda deben ser un objeto.');
    }
    const camposPermitidos = new Set([
        'terminos', 'terminos_busqueda', 'maxResultados', 'ubicacion', 'ubicaciones',
        'filtrarNivelLinkedin', 'filtrar_nivel_linkedin',
        'queryIndeed', 'consultasJooble', 'consultasAdzuna', 'categoriasRemotive', 'tagsRemoteOK',
    ]);
    if (Object.keys(opciones).some(campo => !camposPermitidos.has(campo))) {
        throw errorConfiguracion('Recibí opciones de búsqueda no reconocidas.');
    }
    if (opciones.terminos !== undefined && opciones.terminos_busqueda !== undefined) {
        throw errorConfiguracion('No puedo recibir terminos y terminos_busqueda simultáneamente.');
    }
    const terminos = opciones.terminos !== undefined ? opciones.terminos : opciones.terminos_busqueda;
    if (terminos !== undefined) validarLista(terminos, 'Los términos');
    if (opciones.maxResultados !== undefined && (!Number.isInteger(opciones.maxResultados) || opciones.maxResultados < 1 || opciones.maxResultados > 500)) {
        throw errorConfiguracion('maxResultados debe ser un entero entre 1 y 500.');
    }
    if (opciones.ubicacion !== undefined && (typeof opciones.ubicacion !== 'string' || !opciones.ubicacion.trim() || opciones.ubicacion.length > 200)) {
        throw errorConfiguracion('ubicacion debe ser un texto no vacío de hasta 200 caracteres.');
    }
    if (opciones.ubicaciones !== undefined) {
        validarLista(opciones.ubicaciones, 'Las ubicaciones');
        if (!opciones.ubicaciones.length || opciones.ubicacion !== undefined) {
            throw errorConfiguracion('Necesito ubicaciones no vacías y no puedo combinarlas con ubicacion.');
        }
    }
    if (opciones.filtrarNivelLinkedin !== undefined && typeof opciones.filtrarNivelLinkedin !== 'boolean') {
        throw errorConfiguracion('filtrarNivelLinkedin debe ser un booleano.');
    }
    if (opciones.filtrar_nivel_linkedin !== undefined && typeof opciones.filtrar_nivel_linkedin !== 'boolean') {
        throw errorConfiguracion('filtrar_nivel_linkedin debe ser un booleano.');
    }
    return { ...opciones, ...(terminos !== undefined ? { terminos: validarLista(terminos, 'Los términos') } : {}) };
}

function palabrasBusqueda(terminos) {
    return [...new Set(terminos.flatMap(termino => termino.toLowerCase().replace(/[^a-z0-9áéíóúüñ#+\s]/g, '').trim().split(/\s+/).filter(palabra => palabra.length >= 3 || SIGLAS_VALIDAS.has(palabra))))];
}

function resolverConfiguracion(idOSlug, opciones = {}, preferencias = {}, { previsualizacion = false, omitirIncompatibles = false } = {}) {
    const id = normalizarIdPlataforma(idOSlug);
    if (!id) throw errorConfiguracion('La plataforma solicitada no existe.');
    const plataforma = PLATAFORMAS[id];
    const entrada = validarOpciones(opciones);
    preferencias = preferencias || {};
    const explicitos = entrada.terminos;
    const guardados = preferencias.terminos_busqueda;
    const origenTerminos = explicitos !== undefined ? 'ejecucion' : guardados !== undefined ? 'preferencias' : 'defecto';
    const terminos = validarLista(explicitos !== undefined ? explicitos : guardados !== undefined ? guardados : TERMINOS_BUSQUEDA_DEFECTO, 'Los términos');
    if (!terminos.length && !previsualizacion) {
        throw errorConfiguracion('Necesito términos de búsqueda no vacíos; no los sustituyo por defaults.');
    }
    const usaTerminos = FUENTES_TERMINOS.has(id);
    const advertencias = [];
    const defectoMax = ['linkedin', 'indeed'].includes(id) ? 100 : 50;
    const maxResultados = Math.min(entrada.maxResultados ?? defectoMax, id === 'adzuna' ? 50 : 500);
    const filtros = {};
    let ubicacion = [];
    let ventanaDias = (id === 'linkedin' || id === 'glassdoor') ? 14 : 30;
    let origenUbicacion = 'fijo';
    const opcionesResueltas = { maxResultados, ...(usaTerminos ? { terminos } : {}) };

    if (!plataforma.activa) advertencias.push(plataforma.motivo || 'Plataforma inactiva.');
    if (id === 'linkedin') {
        const zonas = preferencias.zonas_preferidas == null ? [] : validarLista(preferencias.zonas_preferidas, 'Las zonas');
        ubicacion = entrada.ubicacion !== undefined ? [entrada.ubicacion.trim()] : entrada.ubicaciones !== undefined ? validarLista(entrada.ubicaciones, 'Las ubicaciones') : zonas.length ? zonas : ['Argentina'];
        origenUbicacion = entrada.ubicacion !== undefined || entrada.ubicaciones !== undefined ? 'ejecucion' : zonas.length ? 'preferencias' : 'defecto';
        if (ubicacion.length === 1) opcionesResueltas.ubicacion = ubicacion[0];
        else opcionesResueltas.ubicaciones = ubicacion;

        const filtrarNivel = entrada.filtrarNivelLinkedin !== undefined
            ? entrada.filtrarNivelLinkedin
            : entrada.filtrar_nivel_linkedin !== undefined
                ? entrada.filtrar_nivel_linkedin
                : (preferencias.filtrar_nivel_linkedin ?? true);
        opcionesResueltas.filtrarNivelLinkedin = Boolean(filtrarNivel);
        filtros.filtrarNivelLinkedin = Boolean(filtrarNivel);
        filtros.nivelesExperiencia = filtrarNivel ? ['internship', 'entry_level'] : [];
        if (!filtrarNivel) {
            advertencias.push('Filtro de nivel de experiencia de LinkedIn desactivado (no aplico f_E).');
        }
    } else {
        if (entrada.ubicacion !== undefined || entrada.ubicaciones !== undefined || preferencias.zonas_preferidas?.length) {
            advertencias.push('No aplico ubicación ni zonas preferidas: esta integración conserva su ubicación fija.');
        }
        if (['computrabajo', 'bumeran', 'indeed'].includes(id)) ubicacion = ['Argentina'];
        if (id === 'glassdoor') {
            ubicacion = ['Buenos Aires', 'Argentina'];
            Object.assign(filtros, { soloUnicas: true, incluirSinSalario: true });
        }
        if (id === 'jooble') { ubicacion = ['Remote']; filtros.maxPaginasPorTermino = 2; }
        if (id === 'adzuna') { ubicacion = ['España']; filtros.prefijo = 'remote'; filtros.normalizacion = 'solo_indicadores_remoto'; }
    }

    let consultasEfectivas = [];
    let equivalenciasAplicadas = {};
    let terminosUtiles = true;
    let urlsUtiles = true;

    if (id === 'linkedin') {
        const tr = traducirParaLinkedin(terminos);
        consultasEfectivas = tr.consultas;
        equivalenciasAplicadas = tr.equivalencias;
        terminosUtiles = tr.consultas.length > 0;
        urlsUtiles = tr.consultas.length > 0;
        opcionesResueltas.terminos = consultasEfectivas;
    } else if (id === 'computrabajo') {
        filtros.transformacionTerminos = 'minusculas_sin_signos';
        const tr = traducirParaComputrabajo(terminos);
        consultasEfectivas = tr.consultas;
        equivalenciasAplicadas = tr.equivalencias;
        terminosUtiles = tr.consultas.length > 0;
        urlsUtiles = tr.urls.length > 0 && terminos.every(termino => formatearTerminoComputrabajo(termino).length > 0);
    } else if (id === 'bumeran') {
        filtros.transformacionTerminos = 'slug_seguro_con_equivalencias';
        const tr = traducirParaBumeran(terminos);
        consultasEfectivas = tr.consultas;
        equivalenciasAplicadas = tr.equivalencias;
        terminosUtiles = tr.consultas.length > 0;
        urlsUtiles = tr.urls.length > 0 && terminos.every(termino => traducirParaBumeran([termino]).urls.length > 0);
        filtros.urls = tr.urls;
    } else if (id === 'indeed') {
        filtros.transformacionTerminos = 'frases_preservadas_con_or';
        const tr = traducirParaIndeed(terminos);
        consultasEfectivas = tr.terminosProcesados;
        equivalenciasAplicadas = tr.equivalencias;
        opcionesResueltas.queryIndeed = tr.query;
        terminosUtiles = tr.terminosProcesados.length > 0 && terminos.every(termino => esTerminoUtilizable(termino));
    } else if (id === 'jooble') {
        filtros.transformacionTerminos = 'frases_completas';
        const tr = traducirParaJooble(terminos);
        consultasEfectivas = tr.consultas;
        equivalenciasAplicadas = tr.equivalencias;
        filtros.palabras = tr.consultas;
        opcionesResueltas.consultasJooble = tr.consultas;
        terminosUtiles = tr.consultas.length > 0 && terminos.every(termino => esTerminoUtilizable(termino));
    } else if (id === 'adzuna') {
        filtros.transformacionTerminos = 'frases_con_prefijo_remote';
        const tr = traducirParaAdzuna(terminos);
        consultasEfectivas = tr.consultas;
        equivalenciasAplicadas = tr.equivalencias;
        filtros.palabras = tr.consultas;
        opcionesResueltas.consultasAdzuna = tr.consultas;
        terminosUtiles = tr.consultas.length > 0 && terminos.every(termino => esTerminoUtilizable(termino));
    } else if (id === 'remotive') {
        const tr = traducirParaRemotive(terminos);
        filtros.categorias = tr.categorias;
        if (tr.categorias.length > 0) {
            filtros.categoria = tr.categorias[0];
            opcionesResueltas.categoriasRemotive = tr.categorias;
            consultasEfectivas = tr.categorias;
        } else {
            filtros.categoria = null;
            consultasEfectivas = [];
        }
        advertencias.push(...tr.advertencias);
        if (!tr.compatible) {
            terminosUtiles = false;
        }
    } else if (id === 'remoteok') {
        const tr = traducirParaRemoteOK(terminos);
        filtros.tags = tr.tags;
        opcionesResueltas.tagsRemoteOK = tr.tags;
        consultasEfectivas = tr.tags;
        advertencias.push(...tr.advertencias);
        if (!tr.compatible) {
            terminosUtiles = false;
        }
    } else if (id === 'glassdoor') {
        consultasEfectivas = terminos;
        terminosUtiles = terminos.length > 0;
    }

    if (id === 'bumeran') advertencias.push('No aplico maxResultados: el actor existente no recibe ese límite.');
    if (['jooble', 'remoteok'].includes(id)) {
        advertencias.push(`maxResultados es un umbral de acumulación, no un límite estricto: puedo superar ${maxResultados} al incorporar una página o lote completo.`);
    }
    if (entrada.maxResultados > maxResultados) advertencias.push(`Limito maxResultados a ${maxResultados} para esta fuente.`);

    // Informo ausencia de credenciales sin exponerlas; no pruebo conectividad.
    let credencialesDisponibles = true;
    if (id === 'adzuna') {
        credencialesDisponibles = Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
        if (!credencialesDisponibles) advertencias.push('Adzuna no tiene ambas credenciales configuradas.');
    }
    if (id === 'jooble' && !process.env.JOOBLE_API_KEY) {
        credencialesDisponibles = false;
        advertencias.push('Jooble no tiene API key configurada.');
    }
    if (['linkedin', 'indeed', 'bumeran', 'glassdoor'].includes(id) && !process.env.APIFY_TOKEN) {
        credencialesDisponibles = false;
        advertencias.push('Apify no tiene token configurado.');
    }

    let motivoOmision;
    if (plataforma.activa && (!terminosUtiles || !urlsUtiles)) {
        const mensaje = `Necesito términos de búsqueda utilizables para ${plataforma.label}; no envío consultas vacías ni las sustituyo por defaults.`;
        if (!previsualizacion && !omitirIncompatibles) {
            throw Object.assign(errorConfiguracion(mensaje), { codigo: 'consulta_incompatible_fuente' });
        }
        if (terminos.length) motivoOmision = mensaje;
        advertencias.push(mensaje);
    }

    const equivalenciasSugeridas = usaTerminos ? obtenerEquivalenciasSugeridas(terminos) : {};

    return {
        opciones: opcionesResueltas,
        resumen: {
            plataforma: id,
            nombre: plataforma.label,
            habilitada: plataforma.activa,
            ejecutable: plataforma.activa && terminosUtiles && urlsUtiles && credencialesDisponibles,
            ...(motivoOmision ? { motivoOmision } : {}),
            terminos: usaTerminos ? terminos : [],
            consultasEfectivas,
            equivalenciasAplicadas,
            equivalenciasSugeridas,
            ubicacion,
            ventanaDias,
            maxResultados: id === 'bumeran' ? null : maxResultados,
            filtros,
            advertencias,
            origen: { terminos: usaTerminos ? origenTerminos : 'fijo', ubicacion: origenUbicacion },
        },
    };
}

async function leerPreferenciasBusqueda() {
    try {
        // Evito obtenerPreferencias(): crea una fila cuando falta, incompatible con preview read-only.
        const resultado = await pool.query('SELECT * FROM preferencias WHERE id = $1', [1]);
        return resultado.rows[0] || {};
    } catch (error) {
        throw errorConfiguracion('No pude leer las preferencias de búsqueda. No ejecuté proveedores.', 503);
    }
}

async function resolverConfiguraciones(opciones = {}, modo = {}) {
    validarOpciones(opciones);
    const preferencias = await leerPreferenciasBusqueda();
    return Object.fromEntries(Object.keys(PLATAFORMAS).map(id => [id, resolverConfiguracion(id, opciones, preferencias, modo)]));
}

module.exports = {
    validarOpciones,
    resolverConfiguracion,
    resolverConfiguraciones,
    leerPreferenciasBusqueda,
    palabrasBusqueda,
};
