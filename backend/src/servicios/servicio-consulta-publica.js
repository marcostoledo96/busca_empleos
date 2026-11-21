const { obtenerIdentidadCanonica } = require('./servicio-identidad-ofertas');

const MAXIMO_CANDIDATOS = 200;
const MAXIMO_DESCRIPCION = 4000;
const DIA_MS = 24 * 60 * 60 * 1000;
const MODALIDADES = ['remoto', 'hibrido', 'presencial'];
const NIVELES = ['trainee', 'junior', 'semi-senior', 'senior'];
const CAMPOS_FILTRO = ['texto', 'nivel', 'pais', 'modalidad', 'dias', 'limite'];
const CLAVE_DE_CREDENCIAL = /^(?:auth(?:orization)?|bearer|token|.*token|api(?:key|secret)|.*credential[s]?|.*password|passwd|secret|clientsecret|sessionid|signature|sig|xamzsignature|xgoogsignature)$/u;

// Solo tomo Argentina como país cuando aparece como componente explícito de la ubicación.
const PAIS_ARGENTINA = "lower(ubicacion) ~ '(^|,)[[:space:]]*argentina[[:space:]]*(,|$)'";
const COLUMNAS = `id, titulo, empresa, ubicacion, modalidad, nivel_requerido, plataforma, url,
    datos_crudos ->> 'url_original' AS url_original,
    (${PAIS_ARGENTINA}) AS en_argentina,
    fecha_publicacion AT TIME ZONE 'UTC' AS publicada,
    fecha_extraccion AT TIME ZONE 'UTC' AS primera_deteccion,
    fecha_ultima_extraccion AT TIME ZONE 'UTC' AS ultima_deteccion`;

function errorPublico(codigo, mensaje) {
    return Object.assign(new Error(mensaje), { codigo });
}

function validarFiltros(filtros) {
    if (!filtros || ![Object.prototype, null].includes(Object.getPrototypeOf(filtros))
        || Reflect.ownKeys(filtros).some(campo => !CAMPOS_FILTRO.includes(campo))) {
        throw errorPublico('FILTROS_INVALIDOS', 'Los filtros de consulta no son válidos.');
    }
    const { texto, nivel, pais, modalidad, dias = 30, limite = 5 } = filtros;
    if (!Number.isInteger(dias) || dias < 1 || dias > 30
        || !Number.isInteger(limite) || limite < 1 || limite > 5
        || (nivel !== undefined && !NIVELES.includes(nivel))
        || (pais !== undefined && pais !== 'Argentina')
        || (modalidad !== undefined && !MODALIDADES.includes(modalidad))
        || (texto !== undefined && (typeof texto !== 'string' || texto.length > 120
            || !/^[\p{L}\p{N}]+(?: +[\p{L}\p{N}]+)*$/u.test(texto.trim())))) {
        throw errorPublico('FILTROS_INVALIDOS', 'Los filtros de consulta no son válidos.');
    }
    return { palabras: texto?.trim().split(/ +/) ?? null, nivel, pais, modalidad, dias, limite };
}

function enlaceSeguro(valor) {
    if (typeof valor !== 'string' || valor.length > 2048 || /[\s\p{Cc}\\]/u.test(valor)
        || !/^https?:\/\/[^/?#]+/i.test(valor)) return null;
    try {
        const url = new URL(valor);
        if (url.username || url.password) return null;
        for (const parametros of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
            for (const clave of parametros.keys()) {
                if (CLAVE_DE_CREDENCIAL.test(clave.toLowerCase().replace(/[^a-z0-9]/g, ''))) return null;
            }
        }
        return valor;
    } catch {
        return null;
    }
}

function proyectar(oferta) {
    const url = enlaceSeguro(oferta.url_original ?? oferta.url);
    if (!url) return null;
    return {
        id: oferta.id,
        titulo: oferta.titulo,
        empresa: oferta.empresa,
        ubicacion: oferta.ubicacion,
        pais: oferta.en_argentina ? 'Argentina' : null,
        modalidad: MODALIDADES.includes(oferta.modalidad) ? oferta.modalidad : 'desconocida',
        nivel: NIVELES.includes(oferta.nivel_requerido) ? oferta.nivel_requerido : null,
        fuente: oferta.plataforma,
        url,
        fecha_publicacion: oferta.publicada?.toISOString() ?? null,
        fecha_primera_deteccion: oferta.primera_deteccion?.toISOString() ?? null,
        fecha_ultima_deteccion: oferta.ultima_deteccion?.toISOString() ?? null,
        vigencia_aviso: 'desconocida',
    };
}

function crearConsultaPublica({ pool, reloj = () => new Date() }) {
    async function consultar(sql, parametros) {
        try {
            return (await pool.query(sql, parametros)).rows;
        } catch {
            throw errorPublico('LECTURA_NO_DISPONIBLE', 'No pude consultar las ofertas.');
        }
    }

    async function listar(filtros = {}) {
        const { palabras, nivel, pais, modalidad, dias, limite } = validarFiltros(filtros);
        const hasta = reloj();
        const desde = new Date(hasta.getTime() - dias * DIA_MS);
        // Proyectar solo las claves que usa la identidad compartida para resolver IDs nativos.
        const candidatas = await consultar(`SELECT ${COLUMNAS}, identidad_canonica, jsonb_build_object(
                'id', datos_crudos ->> 'id', 'jobId', datos_crudos ->> 'jobId',
                'currentJobId', datos_crudos ->> 'currentJobId', 'jk', datos_crudos ->> 'jk',
                'vjk', datos_crudos ->> 'vjk', 'key', datos_crudos ->> 'key',
                'jobKey', datos_crudos ->> 'jobKey', 'jl', datos_crudos ->> 'jl',
                'jobListingId', datos_crudos ->> 'jobListingId') AS datos_crudos
            FROM ofertas
            WHERE fecha_publicacion > ($1::timestamptz AT TIME ZONE 'UTC')
                AND fecha_publicacion <= ($2::timestamptz AT TIME ZONE 'UTC')
                AND ($3::text IS NULL OR nivel_requerido = $3)
                AND ($4::text IS NULL OR modalidad = $4)
                AND (NOT $5::boolean OR (${PAIS_ARGENTINA}))
                AND ($6::text[] IS NULL OR regexp_split_to_array(lower(titulo), '[^[:alnum:]]+')
                    @> ARRAY(SELECT lower(palabra) FROM unnest($6::text[]) AS palabra))
            ORDER BY fecha_publicacion DESC, id DESC LIMIT $7`,
        [desde, hasta, nivel, modalidad, pais !== undefined, palabras, MAXIMO_CANDIDATOS]);

        const identidades = new Set();
        const unicas = [];
        for (const candidata of candidatas) {
            const oferta = proyectar(candidata);
            if (!oferta) continue;
            const identidad = obtenerIdentidadCanonica(candidata);
            if (identidades.has(identidad)) continue;
            identidades.add(identidad);
            unicas.push(oferta);
        }
        return {
            ofertas: unicas.slice(0, limite),
            alcance: {
                publicacion_desde_exclusiva: desde.toISOString(),
                publicacion_hasta_inclusiva: hasta.toISOString(),
                candidatos_examinados: candidatas.length,
                maximo_candidatos: MAXIMO_CANDIDATOS,
                limite_resultados: limite,
                posible_truncamiento: candidatas.length === MAXIMO_CANDIDATOS || unicas.length > limite,
            },
        };
    }

    async function obtenerDetalle(id) {
        if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
            throw errorPublico('ID_INVALIDO', 'El ID debe ser un entero positivo válido.');
        }
        const [fila] = await consultar(`SELECT ${COLUMNAS},
                CASE WHEN origen_descripcion IN ('scraper', 'tarjeta') AND descripcion_modificada_en IS NULL
                    THEN NULLIF(btrim(left(descripcion, $2)), '') END AS descripcion_publica
            FROM ofertas WHERE id = $1`, [id, MAXIMO_DESCRIPCION]);
        const oferta = fila && proyectar(fila);
        return oferta ? { ...oferta, descripcion: fila.descripcion_publica } : null;
    }

    return { listar, obtenerDetalle };
}

module.exports = { crearConsultaPublica };
