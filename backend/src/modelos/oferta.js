// Modelo de ofertas — funciones CRUD para la tabla `ofertas`.
// Cada función ejecuta una query SQL parametrizada contra PostgreSQL.
//
// ¿Por qué queries parametrizadas ($1, $2) y no template literals?
// Porque los parámetros se envían SEPARADOS de la query al servidor de PostgreSQL.
// Así, aunque alguien meta código SQL malicioso en los datos, PostgreSQL lo trata
// como un valor textual y no como parte de la query. Esto previene SQL Injection,
// que es el ataque más común contra bases de datos.

const pool = require('../config/base-datos');
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
    obtenerIdentidadCanonica,
    canonizarUrlPlataforma,
} = require('../servicios/servicio-identidad-ofertas');

const DURACION_CURSOR_SINCRONIZACION_MS = 30 * 60 * 1000;
const secretoConfigurado = (process.env.CURSOR_SINCRONIZACION_SECRETO || '').trim();

if (process.env.NODE_ENV === 'production' && !secretoConfigurado) {
    throw new Error('CURSOR_SINCRONIZACION_SECRETO es obligatorio en producción.');
}

const secretoCursorSincronizacion = secretoConfigurado || crypto.randomBytes(32).toString('hex');

if (!secretoConfigurado && ['development', 'test'].includes(process.env.NODE_ENV)) {
    logger.warn('CURSOR_SINCRONIZACION_SECRETO no está configurado; uso un secreto efímero y los cursores se invalidarán al reiniciar.');
}

function firmarCursor(payload) {
    const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const firma = crypto.createHmac('sha256', secretoCursorSincronizacion).update(cuerpo).digest('base64url');
    return `${cuerpo}.${firma}`;
}

function leerCursor(cursor) {
    if (typeof cursor !== 'string' || cursor.length > 2000) return null;
    const [cuerpo, firma] = cursor.split('.');
    if (!cuerpo || !firma) return null;
    const firmaEsperada = crypto.createHmac('sha256', secretoCursorSincronizacion).update(cuerpo).digest('base64url');
    if (firma.length !== firmaEsperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(firmaEsperada))) return null;
    try {
        const payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
        return payload.version === 1 && Number.isInteger(payload.max_id) && Number.isInteger(payload.ultimo_id)
            && typeof payload.fecha_corte === 'string' && typeof payload.firma === 'string'
            && Number(payload.expira_en) > Date.now()
            ? payload
            : null;
    } catch {
        return null;
    }
}

async function obtenerFirmaSnapshot(cliente, fechaCorte, maxId) {
    const resultado = await cliente.query(
        `SELECT COUNT(*)::integer AS total,
                COALESCE(md5(string_agg(id::text || ':' || xmin::text, ',' ORDER BY id DESC)), md5('')) AS firma
         FROM ofertas
         WHERE COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= $1 AND id <= $2`,
        [fechaCorte, maxId]
    );
    return resultado.rows[0];
}

/**
 * Inserto una nueva oferta o actualizo / registro reaparición de forma atómica.
 * Si ya existe por su identidad canónica, preservo su fecha de primera extracción
 * y aplico reglas de calidad para reaparición o enriquecimiento incremental.
 *
 * @param {Object} datos - Los campos de la oferta a insertar.
 * @returns {Promise<Object>} La oferta enriquecida con metadatos de persistencia.
 */
async function crearOferta(datos) {
    const {
        titulo,
        empresa,
        ubicacion,
        modalidad,
        descripcion,
        url,
        plataforma,
        nivel_requerido,
        salario_min,
        salario_max,
        moneda,
        fecha_publicacion,
        datos_crudos,
        origen_descripcion,
        descripcion_completitud,
        identidad_canonica,
    } = datos;

    const urlCanonica = canonizarUrlPlataforma(url, plataforma);
    const identidadCanonicaFinal = identidad_canonica || obtenerIdentidadCanonica({
        ...datos,
        url: urlCanonica || url,
    });

    const origenDescripcionFinal = origen_descripcion
        || (plataforma === 'bumeran' ? 'tarjeta' : 'scraper');
    const descripcionCompletitudFinal = descripcion_completitud
        || (!descripcion ? 'ausente' : (plataforma === 'bumeran' ? 'parcial' : 'desconocida'));

    const query = `
        WITH previa AS (
            SELECT id, empresa, ubicacion, modalidad, nivel_requerido,
                   salario_min, salario_max, moneda, descripcion, origen_descripcion,
                   fecha_extraccion
            FROM ofertas
            WHERE identidad_canonica = $16
        ),
        upsert AS (
            INSERT INTO ofertas (
                titulo, empresa, ubicacion, modalidad, descripcion,
                url, plataforma, nivel_requerido,
                salario_min, salario_max, moneda,
                fecha_publicacion, datos_crudos,
                origen_descripcion, descripcion_completitud,
                identidad_canonica, fecha_ultima_extraccion
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11,
                $12, $13,
                $14, $15,
                $16, NOW()
            )
            ON CONFLICT (identidad_canonica) DO UPDATE SET
                fecha_ultima_extraccion = NOW(),
                fecha_publicacion = COALESCE(ofertas.fecha_publicacion, EXCLUDED.fecha_publicacion),
                empresa = CASE
                    WHEN (ofertas.empresa IS NULL OR TRIM(ofertas.empresa) = '') AND EXCLUDED.empresa IS NOT NULL AND TRIM(EXCLUDED.empresa) != ''
                    THEN EXCLUDED.empresa
                    ELSE ofertas.empresa
                END,
                ubicacion = CASE
                    WHEN (ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '') AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != ''
                    THEN EXCLUDED.ubicacion
                    ELSE ofertas.ubicacion
                END,
                modalidad = CASE
                    WHEN (ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '') AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != ''
                    THEN EXCLUDED.modalidad
                    ELSE ofertas.modalidad
                END,
                nivel_requerido = CASE
                    WHEN (ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '') AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != ''
                    THEN EXCLUDED.nivel_requerido
                    ELSE ofertas.nivel_requerido
                END,
                salario_min = CASE
                    WHEN ofertas.salario_min IS NULL AND EXCLUDED.salario_min IS NOT NULL
                    THEN EXCLUDED.salario_min
                    ELSE ofertas.salario_min
                END,
                salario_max = CASE
                    WHEN ofertas.salario_max IS NULL AND EXCLUDED.salario_max IS NOT NULL
                    THEN EXCLUDED.salario_max
                    ELSE ofertas.salario_max
                END,
                moneda = CASE
                    WHEN (ofertas.moneda IS NULL OR TRIM(ofertas.moneda) = '') AND EXCLUDED.moneda IS NOT NULL AND TRIM(EXCLUDED.moneda) != ''
                    THEN EXCLUDED.moneda
                    ELSE ofertas.moneda
                END,
                descripcion = CASE
                    WHEN ofertas.origen_descripcion = 'manual'
                    THEN ofertas.descripcion
                    WHEN EXCLUDED.descripcion IS NOT NULL AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0)
                    THEN EXCLUDED.descripcion
                    ELSE ofertas.descripcion
                END,
                descripcion_completitud = CASE
                    WHEN ofertas.origen_descripcion = 'manual'
                    THEN ofertas.descripcion_completitud
                    WHEN EXCLUDED.descripcion IS NOT NULL AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0)
                    THEN EXCLUDED.descripcion_completitud
                    ELSE ofertas.descripcion_completitud
                END,
                origen_descripcion = CASE
                    WHEN ofertas.origen_descripcion = 'manual'
                    THEN ofertas.origen_descripcion
                    WHEN EXCLUDED.descripcion IS NOT NULL AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0)
                    THEN EXCLUDED.origen_descripcion
                    ELSE ofertas.origen_descripcion
                END,
                datos_crudos = COALESCE(ofertas.datos_crudos, '{}'::jsonb) || COALESCE(EXCLUDED.datos_crudos, '{}'::jsonb),
                estado_evaluacion = CASE
                    WHEN (
                        (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                         AND EXCLUDED.descripcion IS NOT NULL
                         AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0))
                        OR
                        ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                         AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != '')
                        OR
                        ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                         AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != '')
                        OR
                        ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                         AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != '')
                    )
                    THEN 'pendiente'
                    ELSE ofertas.estado_evaluacion
                END,
                evaluacion_error_mensaje = CASE
                    WHEN (
                        (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                         AND EXCLUDED.descripcion IS NOT NULL
                         AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0))
                        OR
                        ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                         AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != '')
                        OR
                        ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                         AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != '')
                        OR
                        ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                         AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != '')
                    )
                    THEN 'REEVALUACION_SOLICITADA'
                    ELSE ofertas.evaluacion_error_mensaje
                END,
                porcentaje_match = CASE
                    WHEN (
                        (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                         AND EXCLUDED.descripcion IS NOT NULL
                         AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0))
                        OR
                        ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                         AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != '')
                        OR
                        ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                         AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != '')
                        OR
                        ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                         AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != '')
                    )
                    THEN NULL
                    ELSE ofertas.porcentaje_match
                END,
                razon_evaluacion = CASE
                    WHEN (
                        (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                         AND EXCLUDED.descripcion IS NOT NULL
                         AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0))
                        OR
                        ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                         AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != '')
                        OR
                        ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                         AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != '')
                        OR
                        ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                         AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != '')
                    )
                    THEN 'Información de la oferta actualizada por nueva extracción; requiere reevaluación.'
                    ELSE ofertas.razon_evaluacion
                END,
                explicacion_evaluacion = CASE
                    WHEN (
                        (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                         AND EXCLUDED.descripcion IS NOT NULL
                         AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0))
                        OR
                        ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                         AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != '')
                        OR
                        ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                         AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != '')
                        OR
                        ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                         AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != '')
                    )
                    THEN NULL
                    ELSE ofertas.explicacion_evaluacion
                END,
                firma_criterios_evaluacion = CASE
                    WHEN (
                        (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                         AND EXCLUDED.descripcion IS NOT NULL
                         AND LENGTH(EXCLUDED.descripcion) > COALESCE(LENGTH(ofertas.descripcion), 0))
                        OR
                        ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                         AND EXCLUDED.modalidad IS NOT NULL AND TRIM(EXCLUDED.modalidad) != '')
                        OR
                        ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                         AND EXCLUDED.ubicacion IS NOT NULL AND TRIM(EXCLUDED.ubicacion) != '')
                        OR
                        ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                         AND EXCLUDED.nivel_requerido IS NOT NULL AND TRIM(EXCLUDED.nivel_requerido) != '')
                    )
                    THEN NULL
                    ELSE ofertas.firma_criterios_evaluacion
                END
            RETURNING *, (xmax = 0) AS es_nueva
        )
        SELECT upsert.*,
               previa.id AS previa_id,
               previa.empresa AS previa_empresa,
               previa.ubicacion AS previa_ubicacion,
               previa.modalidad AS previa_modalidad,
               previa.nivel_requerido AS previa_nivel_requerido,
               previa.salario_min AS previa_salario_min,
               previa.salario_max AS previa_salario_max,
               previa.moneda AS previa_moneda,
               previa.descripcion AS previa_descripcion,
               previa.origen_descripcion AS previa_origen_descripcion
        FROM upsert
        LEFT JOIN previa ON TRUE;
    `;

    const parametros = [
        titulo,
        empresa,
        ubicacion,
        modalidad,
        descripcion,
        urlCanonica || url,
        plataforma,
        nivel_requerido,
        salario_min || null,
        salario_max || null,
        moneda || null,
        fecha_publicacion || null,
        datos_crudos ? JSON.stringify(datos_crudos) : null,
        origenDescripcionFinal,
        descripcionCompletitudFinal,
        identidadCanonicaFinal,
    ];

    let resultado;
    try {
        resultado = await pool.query(query, parametros);
    } catch (error) {
        // Reconciliación si la fila histórica tenía la misma URL pero distinta identidad canónica (violación ofertas_url_key)
        const esViolacionUrl = error && (
            error.code === '23505'
            && (error.constraint === 'ofertas_url_key' || String(error.message).includes('ofertas_url_key') || String(error.message).includes('url'))
        );

        if (esViolacionUrl) {
            // Verifico la fila existente que posee actualmente esa URL para evitar fusiones accidentales
            const resExistente = await pool.query(
                `SELECT id, plataforma, identidad_canonica, origen_descripcion, estado_postulacion,
                        empresa, ubicacion, modalidad, nivel_requerido, salario_min, salario_max,
                        moneda, descripcion, fecha_extraccion
                 FROM ofertas
                 WHERE url = $1`,
                [urlCanonica || url]
            );

            if (resExistente.rows.length > 0) {
                const filaPrevia = resExistente.rows[0];
                const platPrevia = String(filaPrevia.plataforma || '').toLowerCase().trim();
                const platNueva = String(plataforma || '').toLowerCase().trim();
                const mismaPlataforma = platPrevia === platNueva || platPrevia === 'general' || platNueva === 'general';

                // Verifico si ambas filas poseen identificadores nativos de proveedor explícitos incompatibles
                const esTipoUrlOHash = (ident) => !ident || ident.includes(':url:') || ident.includes(':url-hash:') || ident.includes(':raw:');
                const idPrevia = !esTipoUrlOHash(filaPrevia.identidad_canonica)
                    ? filaPrevia.identidad_canonica.split(':')[1]
                    : null;
                const idNueva = !esTipoUrlOHash(identidadCanonicaFinal)
                    ? identidadCanonicaFinal.split(':')[1]
                    : null;

                const sonIdsIncompatibles = Boolean(idPrevia && idNueva && idPrevia !== idNueva);
                const esEquivalente = mismaPlataforma && !sonIdsIncompatibles;

                if (esEquivalente) {
                    // Verifico que la identidad nueva no esté ocupada por OTRA fila diferente en la BD
                    const resOcupada = await pool.query(
                        'SELECT id FROM ofertas WHERE identidad_canonica = $1 AND id != $2',
                        [identidadCanonicaFinal, filaPrevia.id]
                    );

                    if (resOcupada.rows.length === 0) {
                        const queryReconciliacionUrl = `
                            WITH previa AS (
                                SELECT id, empresa, ubicacion, modalidad, nivel_requerido,
                                       salario_min, salario_max, moneda, descripcion, origen_descripcion,
                                       fecha_extraccion
                                FROM ofertas
                                WHERE id = ${filaPrevia.id}
                            ),
                            actualizar AS (
                                UPDATE ofertas SET
                                    identidad_canonica = $16::text,
                                    url = COALESCE(ofertas.url, $6::text),
                                    titulo = COALESCE(ofertas.titulo, $1::text),
                                    plataforma = COALESCE(ofertas.plataforma, $7::text),
                                    fecha_ultima_extraccion = NOW(),
                                    fecha_publicacion = COALESCE(ofertas.fecha_publicacion, $12::timestamp),
                                    empresa = CASE
                                        WHEN (ofertas.empresa IS NULL OR TRIM(ofertas.empresa) = '') AND $2::text IS NOT NULL AND TRIM($2::text) != ''
                                        THEN $2::text
                                        ELSE ofertas.empresa
                                    END,
                                    ubicacion = CASE
                                        WHEN (ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '') AND $3::text IS NOT NULL AND TRIM($3::text) != ''
                                        THEN $3::text
                                        ELSE ofertas.ubicacion
                                    END,
                                    modalidad = CASE
                                        WHEN (ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '') AND $4::text IS NOT NULL AND TRIM($4::text) != ''
                                        THEN $4::text
                                        ELSE ofertas.modalidad
                                    END,
                                    nivel_requerido = CASE
                                        WHEN (ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '') AND $8::text IS NOT NULL AND TRIM($8::text) != ''
                                        THEN $8::text
                                        ELSE ofertas.nivel_requerido
                                    END,
                                    salario_min = CASE
                                        WHEN ofertas.salario_min IS NULL AND $9::numeric IS NOT NULL
                                        THEN $9::numeric
                                        ELSE ofertas.salario_min
                                    END,
                                    salario_max = CASE
                                        WHEN ofertas.salario_max IS NULL AND $10::numeric IS NOT NULL
                                        THEN $10::numeric
                                        ELSE ofertas.salario_max
                                    END,
                                    moneda = CASE
                                        WHEN (ofertas.moneda IS NULL OR TRIM(ofertas.moneda) = '') AND $11::text IS NOT NULL AND TRIM($11::text) != ''
                                        THEN $11::text
                                        ELSE ofertas.moneda
                                    END,
                                    descripcion = CASE
                                        WHEN ofertas.origen_descripcion = 'manual'
                                        THEN ofertas.descripcion
                                        WHEN $5::text IS NOT NULL AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0)
                                        THEN $5::text
                                        ELSE ofertas.descripcion
                                    END,
                                    descripcion_completitud = CASE
                                        WHEN ofertas.origen_descripcion = 'manual'
                                        THEN ofertas.descripcion_completitud
                                        WHEN $5::text IS NOT NULL AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0)
                                        THEN $15::text
                                        ELSE ofertas.descripcion_completitud
                                    END,
                                    origen_descripcion = CASE
                                        WHEN ofertas.origen_descripcion = 'manual'
                                        THEN ofertas.origen_descripcion
                                        WHEN $5::text IS NOT NULL AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0)
                                        THEN $14::text
                                        ELSE ofertas.origen_descripcion
                                    END,
                                    datos_crudos = COALESCE(ofertas.datos_crudos, '{}'::jsonb) || COALESCE($13::jsonb, '{}'::jsonb),
                                    estado_evaluacion = CASE
                                        WHEN (
                                            (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                                             AND $5::text IS NOT NULL
                                             AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0))
                                            OR
                                            ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                                             AND $4::text IS NOT NULL AND TRIM($4::text) != '')
                                            OR
                                            ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                                             AND $3::text IS NOT NULL AND TRIM($3::text) != '')
                                            OR
                                            ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                                             AND $8::text IS NOT NULL AND TRIM($8::text) != '')
                                        )
                                        THEN 'pendiente'
                                        ELSE ofertas.estado_evaluacion
                                    END,
                                    evaluacion_error_mensaje = CASE
                                        WHEN (
                                            (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                                             AND $5::text IS NOT NULL
                                             AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0))
                                            OR
                                            ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                                             AND $4::text IS NOT NULL AND TRIM($4::text) != '')
                                            OR
                                            ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                                             AND $3::text IS NOT NULL AND TRIM($3::text) != '')
                                            OR
                                            ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                                             AND $8::text IS NOT NULL AND TRIM($8::text) != '')
                                        )
                                        THEN 'REEVALUACION_SOLICITADA'
                                        ELSE ofertas.evaluacion_error_mensaje
                                    END,
                                    porcentaje_match = CASE
                                        WHEN (
                                            (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                                             AND $5::text IS NOT NULL
                                             AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0))
                                            OR
                                            ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                                             AND $4::text IS NOT NULL AND TRIM($4::text) != '')
                                            OR
                                            ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                                             AND $3::text IS NOT NULL AND TRIM($3::text) != '')
                                            OR
                                            ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                                             AND $8::text IS NOT NULL AND TRIM($8::text) != '')
                                        )
                                        THEN NULL
                                        ELSE ofertas.porcentaje_match
                                    END,
                                    razon_evaluacion = CASE
                                        WHEN (
                                            (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                                             AND $5::text IS NOT NULL
                                             AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0))
                                            OR
                                            ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                                             AND $4::text IS NOT NULL AND TRIM($4::text) != '')
                                            OR
                                            ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                                             AND $3::text IS NOT NULL AND TRIM($3::text) != '')
                                            OR
                                            ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                                             AND $8::text IS NOT NULL AND TRIM($8::text) != '')
                                        )
                                        THEN 'Información de la oferta actualizada por nueva extracción; requiere reevaluación.'
                                        ELSE ofertas.razon_evaluacion
                                    END,
                                    explicacion_evaluacion = CASE
                                        WHEN (
                                            (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                                             AND $5::text IS NOT NULL
                                             AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0))
                                            OR
                                            ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                                             AND $4::text IS NOT NULL AND TRIM($4::text) != '')
                                            OR
                                            ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                                             AND $3::text IS NOT NULL AND TRIM($3::text) != '')
                                            OR
                                            ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                                             AND $8::text IS NOT NULL AND TRIM($8::text) != '')
                                        )
                                        THEN NULL
                                        ELSE ofertas.explicacion_evaluacion
                                    END,
                                    firma_criterios_evaluacion = CASE
                                        WHEN (
                                            (ofertas.origen_descripcion IS DISTINCT FROM 'manual'
                                             AND $5::text IS NOT NULL
                                             AND LENGTH($5::text) > COALESCE(LENGTH(ofertas.descripcion), 0))
                                            OR
                                            ((ofertas.modalidad IS NULL OR TRIM(ofertas.modalidad) = '')
                                             AND $4::text IS NOT NULL AND TRIM($4::text) != '')
                                            OR
                                            ((ofertas.ubicacion IS NULL OR TRIM(ofertas.ubicacion) = '')
                                             AND $3::text IS NOT NULL AND TRIM($3::text) != '')
                                            OR
                                            ((ofertas.nivel_requerido IS NULL OR TRIM(ofertas.nivel_requerido) = '')
                                             AND $8::text IS NOT NULL AND TRIM($8::text) != '')
                                        )
                                        THEN NULL
                                        ELSE ofertas.firma_criterios_evaluacion
                                    END
                                WHERE id = ${filaPrevia.id}
                                RETURNING *, FALSE AS es_nueva
                            )
                            SELECT actualizar.*,
                                   previa.id AS previa_id,
                                   previa.empresa AS previa_empresa,
                                   previa.ubicacion AS previa_ubicacion,
                                   previa.modalidad AS previa_modalidad,
                                   previa.nivel_requerido AS previa_nivel_requerido,
                                   previa.salario_min AS previa_salario_min,
                                   previa.salario_max AS previa_salario_max,
                                   previa.moneda AS previa_moneda,
                                   previa.descripcion AS previa_descripcion,
                                   previa.origen_descripcion AS previa_origen_descripcion
                            FROM actualizar
                            LEFT JOIN previa ON TRUE;
                        `;
                        resultado = await pool.query(queryReconciliacionUrl, parametros);
                    } else {
                        // Identidad nueva ya ocupada por otra fila: aíslo la URL para no sobreescribir
                        const urlDesambiguada = `${urlCanonica || url}#colision-${filaPrevia.id}`;
                        const paramsAlt = [...parametros];
                        paramsAlt[5] = urlDesambiguada;
                        resultado = await pool.query(query, paramsAlt);
                    }
                } else {
                    // Portales distintos o IDs distintos con la misma URL externa:
                    // NO sobrescribo la fila existente. Aíslo el conflicto de URL desambiguando
                    // para que ambas ofertas coexistan de forma independiente.
                    const sufijoOrigen = `#origen-${platNueva}${idNueva ? '-' + idNueva : ''}`;
                    const urlDesambiguada = `${urlCanonica || url}${sufijoOrigen}`;
                    const paramsAlt = [...parametros];
                    paramsAlt[5] = urlDesambiguada;
                    resultado = await pool.query(query, paramsAlt);
                }
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    }

    if (!resultado.rows || resultado.rows.length === 0) {
        return null;
    }

    const fila = resultado.rows[0];
    const esNueva = fila.es_nueva !== undefined ? Boolean(fila.es_nueva) : true;
    let fueActualizada = false;

    // Si no es nueva pero previa_id vino null (carrera concurrente entre dos inserciones simultáneas),
    // consulto la fila previa real para no desincronizar los contadores de actualización.
    if (fila.es_nueva !== undefined && !esNueva && fila.previa_id == null) {
        try {
            const resConcurrente = await pool.query(
                `SELECT id, empresa, ubicacion, modalidad, nivel_requerido,
                        salario_min, salario_max, moneda, descripcion, origen_descripcion
                 FROM ofertas
                 WHERE id = $1`,
                [fila.id]
            );
            if (resConcurrente.rows && resConcurrente.rows.length > 0) {
                const p = resConcurrente.rows[0];
                fila.previa_id = p.id;
                fila.previa_empresa = p.empresa;
                fila.previa_ubicacion = p.ubicacion;
                fila.previa_modalidad = p.modalidad;
                fila.previa_nivel_requerido = p.nivel_requerido;
                fila.previa_salario_min = p.salario_min;
                fila.previa_salario_max = p.salario_max;
                fila.previa_moneda = p.moneda;
                fila.previa_descripcion = p.descripcion;
                fila.previa_origen_descripcion = p.origen_descripcion;
            }
        } catch {
            // Defensivo ante mocks de tests que no soportan esta consulta
        }
    }

    if (!esNueva && fila.previa_id != null) {
        const descripcionCambio = fila.previa_origen_descripcion !== 'manual'
            && Boolean(descripcion)
            && descripcion.length > (fila.previa_descripcion ? fila.previa_descripcion.length : 0);
        const modalidadCompleto = (!fila.previa_modalidad || fila.previa_modalidad.trim() === '')
            && Boolean(modalidad && String(modalidad).trim() !== '');
        const ubicacionCompleto = (!fila.previa_ubicacion || fila.previa_ubicacion.trim() === '')
            && Boolean(ubicacion && String(ubicacion).trim() !== '');
        const empresaCompleto = (!fila.previa_empresa || fila.previa_empresa.trim() === '')
            && Boolean(empresa && String(empresa).trim() !== '');
        const nivelCompleto = (!fila.previa_nivel_requerido || fila.previa_nivel_requerido.trim() === '')
            && Boolean(nivel_requerido && String(nivel_requerido).trim() !== '');
        const salarioMinCompleto = (fila.previa_salario_min == null)
            && salario_min != null;
        const salarioMaxCompleto = (fila.previa_salario_max == null)
            && salario_max != null;
        const monedaCompleto = (!fila.previa_moneda || fila.previa_moneda.trim() === '')
            && Boolean(moneda && String(moneda).trim() !== '');

        fueActualizada = Boolean(
            descripcionCambio
            || modalidadCompleto
            || ubicacionCompleto
            || empresaCompleto
            || nivelCompleto
            || salarioMinCompleto
            || salarioMaxCompleto
            || monedaCompleto
        );
    }

    const esReaparicion = !esNueva && !fueActualizada;
    const resultadoPersistencia = esNueva ? 'insertada' : (fueActualizada ? 'actualizada' : 'reaparicion');

    delete fila.previa_id;
    delete fila.previa_empresa;
    delete fila.previa_ubicacion;
    delete fila.previa_modalidad;
    delete fila.previa_nivel_requerido;
    delete fila.previa_salario_min;
    delete fila.previa_salario_max;
    delete fila.previa_moneda;
    delete fila.previa_descripcion;
    delete fila.previa_origen_descripcion;

    return {
        ...fila,
        es_nueva: esNueva,
        fue_actualizada: fueActualizada,
        es_reaparicion: esReaparicion,
        resultado_persistencia: resultadoPersistencia,
    };
}

/**
 * Obtengo ofertas de la base de datos, con filtros y paginación opcionales.
 *
 * Siempre filtro por fecha_extraccion dentro de los últimos 30 días, para no
 * mostrar ofertas antiguas que ya no son relevantes. Este filtro es FIJO (no
 * depende de parámetros del usuario) y se aplica tanto al SELECT como al COUNT.
 *
 * ¿Por qué NOW() - INTERVAL '30 days' y no '1 month'?
 * Porque '1 month' es ambiguo en PostgreSQL: resta 1 mes calendario, que puede
 * ser 28, 29, 30 o 31 días dependiendo del mes. Si hoy es 31 de marzo,
 * NOW() - INTERVAL '1 month' da 3 de marzo (28 días), no 28 de marzo (3 días).
 * Con '30 days' siempre obtenemos exactamente 30 días atrás, sin ambigüedad.
 *
 * ¿Por qué directo en SQL y no como parámetro?
 * Porque es una expresión fija de PostgreSQL, no input del usuario.
 * No hay riesgo de SQL injection porque no viene de afuera.
 * Si usara un parámetro ($N), tendría que calcular el valor en JavaScript
 * y pasar la fecha como string, lo cual es menos preciso por temas de
 * zona horaria entre el servidor Node y el servidor PostgreSQL.
 * Delegando el cálculo a PostgreSQL, ambos (SELECT y COUNT) usan el mismo
 * instante NOW(), garantizando consistencia exacta.
 *
 * PAGINACIÓN:
 * - Si NO se pasa limite_pagina: retorna TODAS las ofertas de los últimos
 *   30 días sin LIMIT ni OFFSET. El campo limite_pagina del retorno vale null.
 * - Si se pasa limite_pagina: se aplica paginación con LIMIT/OFFSET.
 *   No hay tope máximo artificial — si el caller pide 5000, obtiene 5000.
 *   Es responsabilidad del caller decidir cuántos registros necesita.
 *
 * @param {Object} filtros - Filtros opcionales: { estado, plataforma, limite_pagina, pagina }.
 * @returns {Object} { ofertas, total, pagina, limite_pagina }.
 *   Cuando no hay paginación: pagina=1, limite_pagina=null.
 *   Cuando hay paginación: pagina y limite_pagina con los valores usados.
 */
async function obtenerOfertas(filtros = {}) {
    // Construyo la query dinámicamente según los filtros que vengan.
    // Arranco con el filtro fijo de últimos 30 días y luego agrego los opcionales.
    // El filtro de fecha SIEMPRE va primero porque es una condición fija.
    const condiciones = [`COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - INTERVAL '30 days'`];
    const parametros = [];

    if (filtros.estado) {
        parametros.push(filtros.estado);
        condiciones.push(`estado_evaluacion = $${parametros.length}`);
    }

    if (filtros.plataforma) {
        parametros.push(filtros.plataforma);
        condiciones.push(`plataforma = $${parametros.length}`);
    }

    if (filtros.estado_postulacion) {
        parametros.push(filtros.estado_postulacion);
        condiciones.push(`estado_postulacion = $${parametros.length}`);
    }

    // Las condiciones siempre tienen al menos el filtro de fecha,
    // así que siempre hay WHERE.
    const clausulaWhere = `WHERE ${condiciones.join(' AND ')}`;

    // Sorting: el controlador puede pedir ordenar por determinada columna.
    // Solo permito columnas seguras (whitelist) para evitar SQL injection.
    const columnasPermitidas = [
        'fecha_extraccion', 'fecha_ultima_extraccion', 'fecha_publicacion', 'porcentaje_match',
        'titulo', 'empresa', 'estado_evaluacion'
    ];
    const columnaOrden = columnasPermitidas.includes(filtros.ordenar_por)
        ? filtros.ordenar_por
        : 'fecha_extraccion';
    const direccion = filtros.direccion === 'ASC' ? 'ASC' : 'DESC';

    // Determino si hay paginación o no.
    // Si limite_pagina no viene (undefined, null, vacío), NO pagino:
    // devuelvo todas las ofertas del último mes sin LIMIT/OFFSET.
    // Si viene, valido que sea un entero positivo y lo uso sin tope máximo.
    const limiteRaw = filtros.limite_pagina;
    const hayLimite = limiteRaw !== undefined && limiteRaw !== null && limiteRaw !== '';

    let limite = null;
    let pagina = 1;

    if (hayLimite) {
        limite = parseInt(limiteRaw, 10);
        if (!Number.isFinite(limite) || limite < 1) limite = null;
    }

    // Si limite_pagina vino pero no era un número válido, lo ignoro
    // y no pagino (caigo en el mismo caso que si no se pasó limite_pagina).
    if (limite !== null) {
        pagina = parseInt(filtros.pagina, 10);
        if (!Number.isFinite(pagina) || pagina < 1) pagina = 1;
    }

    // Query de conteo total (sin LIMIT/OFFSET).
    const totalResultado = await pool.query(
        `SELECT COUNT(*)::integer AS total FROM ofertas ${clausulaWhere}`,
        parametros
    );
    const total = totalResultado.rows[0].total;

    let resultado;

    if (limite !== null) {
        // Caso con paginación: aplico LIMIT y OFFSET.
        const offset = (pagina - 1) * limite;
        resultado = await pool.query(
            `SELECT * FROM ofertas ${clausulaWhere} ORDER BY ${columnaOrden} ${direccion} NULLS LAST LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
            [...parametros, limite, offset]
        );
    } else {
        // Sin paginación: traigo todas las ofertas de los últimos 30 días.
        resultado = await pool.query(
            `SELECT * FROM ofertas ${clausulaWhere} ORDER BY ${columnaOrden} ${direccion} NULLS LAST`,
            parametros
        );
    }

    return {
        ofertas: resultado.rows,
        total,
        pagina,
        limite_pagina: limite,
    };
}

/**
 * Retorno una proyección liviana de ofertas recientes con un cursor firmado.
 * El snapshot es lógico: detecto mutaciones del universo fijo y respondo error
 * controlado en vez de afirmar una sincronización completa que ya no existe.
 */
async function obtenerBloqueSincronizacion({ limite, cursor }) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        let snapshot = cursor ? leerCursor(cursor) : null;
        if (cursor && !snapshot) {
            const error = new Error('Cursor de sincronización inválido o vencido.');
            error.codigo = 'CURSOR_SINCRONIZACION_INVALIDO';
            throw error;
        }

        if (!snapshot) {
            const fechaCorte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const maximo = await cliente.query(
                `SELECT COALESCE(MAX(id), 0)::integer AS max_id
                 FROM ofertas WHERE COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= $1`,
                [fechaCorte]
            );
            const maxId = maximo.rows[0].max_id;
            const firma = await obtenerFirmaSnapshot(cliente, fechaCorte, maxId);
            snapshot = {
                version: 1,
                fecha_corte: fechaCorte,
                max_id: maxId,
                ultimo_id: maxId + 1,
                total: firma.total,
                firma: firma.firma,
                expira_en: Date.now() + DURACION_CURSOR_SINCRONIZACION_MS,
            };
        } else {
            const firmaActual = await obtenerFirmaSnapshot(cliente, snapshot.fecha_corte, snapshot.max_id);
            if (firmaActual.total !== snapshot.total || firmaActual.firma !== snapshot.firma) {
                const error = new Error('La sincronización fue invalidada por cambios concurrentes.');
                error.codigo = 'SINCRONIZACION_INVALIDADA';
                throw error;
            }
        }

        const resultado = await cliente.query(
            `SELECT id, titulo, empresa, ubicacion, modalidad, descripcion, url, plataforma,
                    nivel_requerido, salario_min, salario_max, moneda,
                    estado_evaluacion, razon_evaluacion, porcentaje_match,
                    estado_postulacion, fecha_publicacion, fecha_extraccion,
                    fecha_ultima_extraccion, identidad_canonica,
                    prioridad_ia, puntaje_prioridad_ia, evidencias_prioridad_ia,
                    firma_criterios_evaluacion, evaluacion_error_mensaje, fecha_evaluacion,
                    explicacion_evaluacion, origen_descripcion, descripcion_completitud,
                    descripcion_original, descripcion_modificada_en
             FROM ofertas
             WHERE COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= $1 AND id <= $2 AND id < $3
             ORDER BY id DESC
             LIMIT $4`,
            [snapshot.fecha_corte, snapshot.max_id, snapshot.ultimo_id, limite]
        );

        const datos = resultado.rows;
        const completada = datos.length < limite;
        const cursorSiguiente = completada ? null : firmarCursor({
            ...snapshot,
            ultimo_id: datos[datos.length - 1].id,
        });
        await cliente.query('COMMIT');
        return {
            datos,
            total: snapshot.total,
            fecha_corte: snapshot.fecha_corte,
            max_id: snapshot.max_id,
            total_inicial: snapshot.total,
            cursor_siguiente: cursorSiguiente,
            completada,
        };
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        cliente.release();
    }
}

/**
 * Obtengo una oferta específica por su ID.
 *
 * @param {number} id - El ID de la oferta.
 * @returns {Object|null} La oferta encontrada, o null si no existe.
 */
async function obtenerOfertaPorId(id) {
    const resultado = await pool.query(
        'SELECT * FROM ofertas WHERE id = $1',
        [id]
    );

    return resultado.rows.length > 0 ? resultado.rows[0] : null;
}

/**
 * Obtengo todas las ofertas que todavía no fueron evaluadas por la IA.
 *
 * @returns {Array} Lista de ofertas con estado_evaluacion = 'pendiente'.
 */
async function obtenerOfertasPendientes() {
    const resultado = await pool.query(
        `SELECT * FROM ofertas WHERE estado_evaluacion = 'pendiente'
         AND COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - INTERVAL '30 days'
         ORDER BY fecha_extraccion DESC`
    );

    return resultado.rows;
}

/**
 * Obtengo las ofertas con errores de evaluación en los últimos 30 días,
 * excluyendo las que solo tienen una reevaluación solicitada pendiente.
 *
 * @returns {Promise<Array>} Lista de ofertas con error recuperable.
 */
async function obtenerOfertasConErrores() {
    const resultado = await pool.query(
        `SELECT * FROM ofertas
         WHERE COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - INTERVAL '30 days'
           AND evaluacion_error_mensaje IS NOT NULL
           AND evaluacion_error_mensaje != 'REEVALUACION_SOLICITADA'
         ORDER BY fecha_extraccion DESC`
    );

    return resultado.rows;
}

/**
 * Actualizo el resultado de la evaluación de una oferta.
 * Se llama después de que DeepSeek evalúa la oferta.
 *
 * @param {number} id - El ID de la oferta a actualizar.
 * @param {string} estado - El nuevo estado: 'aprobada' o 'rechazada'.
 * @param {string} razon - La razón que dio la IA.
 * @param {number|null} porcentaje - Porcentaje de match (0–100) que asignó la IA.
 * @param {string|null} [errorMensaje] - Mensaje de error si la API falló.
 * @param {Object|null} [prioridadIa] - Señal de ranking separada del match.
 * @param {string|null} [firmaCriterios] - Criterios efectivos exitosos; borro la firma ante error.
 * @param {Object|null} [explicacionEvaluacion] - Desglose explicable de evaluación.
 * @param {string} [descripcionEsperada] - Descripción esperada para CAS.
 * @param {Date|string} [fechaModificacionEsperada] - Fecha de modificación esperada para CAS.
 * @returns {Object|null} La oferta actualizada, o null si el ID no existe o no coincide el CAS.
 */
async function actualizarEvaluacion(id, estado, razon, porcentaje = null, errorMensaje = null, prioridadIa = null, firmaCriterios = null, explicacionEvaluacion = null, descripcionEsperada = undefined, fechaModificacionEsperada = undefined) {
    const prioridad = prioridadIa || { detectada: false, puntaje: 0, evidencias: [], version: null };
    const validarDescripcion = descripcionEsperada !== undefined;
    const validarFechaModificacion = fechaModificacionEsperada !== undefined;
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_evaluacion = $1, razon_evaluacion = $2, porcentaje_match = $3,
              fecha_evaluacion = NOW(), evaluacion_error_mensaje = $5,
              prioridad_ia = $6, puntaje_prioridad_ia = $7,
              evidencias_prioridad_ia = $8::jsonb, version_prioridad_ia = $9,
              firma_criterios_evaluacion = $10,
              explicacion_evaluacion = $11::jsonb
         WHERE id = $4 AND ($13::boolean = false OR descripcion IS NOT DISTINCT FROM $12) AND ($15::boolean = false OR date_trunc('milliseconds', descripcion_modificada_en) IS NOT DISTINCT FROM date_trunc('milliseconds', $14::timestamp))
         RETURNING *`,
        [
            estado,
            razon,
            porcentaje,
            id,
            errorMensaje,
            Boolean(prioridad.detectada),
            prioridad.puntaje || 0,
            JSON.stringify(prioridad.evidencias || []),
            prioridad.version,
            errorMensaje ? null : firmaCriterios,
            explicacionEvaluacion ? JSON.stringify(explicacionEvaluacion) : null,
            validarDescripcion ? descripcionEsperada : null,
            validarDescripcion,
            validarFechaModificacion ? fechaModificacionEsperada : null,
            validarFechaModificacion
        ]
    );

    return resultado.rows.length > 0 ? resultado.rows[0] : null;
}

/**
 * Actualizo el estado de postulación de una oferta.
 * El usuario marca manualmente si ya envió CV, está en proceso, etc.
 *
 * @param {number} id - El ID de la oferta.
 * @param {string} estadoPostulacion - El nuevo estado: 'no_postulado', 'cv_enviado', 'en_proceso', 'descartada'.
 * @returns {Object|null} La oferta actualizada, o null si el ID no existe.
 */
async function actualizarPostulacion(id, estadoPostulacion) {
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_postulacion = $1
         WHERE id = $2
         RETURNING *`,
        [estadoPostulacion, id]
    );

    return resultado.rows.length > 0 ? resultado.rows[0] : null;
}

/**
 * Obtengo estadísticas de las ofertas agrupadas por estado de evaluación.
 * El dashboard necesita estos contadores para mostrar un resumen rápido.
 *
 * Al igual que obtenerOfertas(), filtro por los últimos 30 días para que
 * las estadísticas sean consistentes con lo que el usuario ve en el listado.
 * Una oferta de hace 31 días no debería sumar al total visible.
 *
 * @returns {Object} { total, pendientes, aprobadas, rechazadas }
 */
async function obtenerEstadisticas() {
    const resultado = await pool.query(
        `SELECT estado_evaluacion, COUNT(*)::integer AS cantidad
         FROM ofertas
         WHERE COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - INTERVAL '30 days'
         GROUP BY estado_evaluacion`
    );

    // Convierto el array de filas en un objeto con nombres claros.
    // Si un estado no tiene ofertas, no aparece en el GROUP BY,
    // así que arranco con todo en cero y sobreescribo lo que venga.
    const estadisticas = {
        total: 0,
        pendientes: 0,
        aprobadas: 0,
        rechazadas: 0,
    };

    for (const fila of resultado.rows) {
        estadisticas.total += fila.cantidad;
        if (fila.estado_evaluacion === 'pendiente') estadisticas.pendientes = fila.cantidad;
        if (fila.estado_evaluacion === 'aprobada') estadisticas.aprobadas = fila.cantidad;
        if (fila.estado_evaluacion === 'rechazada') estadisticas.rechazadas = fila.cantidad;
    }

    return estadisticas;
}

/**
 * Actualizo el estado de postulación de múltiples ofertas en una sola operación.
 * Permite al usuario descartar (o cambiar estado a) varias ofertas desde el dashboard.
 *
 * ¿Por qué ANY($2::int[])? Porque PostgreSQL permite pasar un array de enteros
 * como parámetro y compararlos contra una columna en una sola query.
 * Es la forma segura (parametrizada) de hacer un IN (...) dinámico.
 *
 * @param {number[]} ids - Array de IDs de las ofertas a actualizar.
 * @param {string} estadoPostulacion - El nuevo estado: 'no_postulado', 'cv_enviado', 'en_proceso', 'descartada'.
 * @returns {number} Cantidad de filas efectivamente actualizadas.
 */
async function actualizarPostulacionMasiva(ids, estadoPostulacion) {
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_postulacion = $1
         WHERE id = ANY($2::int[])
         RETURNING id`,
        [estadoPostulacion, ids]
    );

    return resultado.rowCount;
}

/**
 * Reseteo a 'pendiente' las evaluaciones de ofertas extraídas en los últimos N días.
 * El marcador persistido solicita omitir caché en su próxima evaluación;
 * no elimino cachés compartidas ni modifico datos de postulación.
 *
 * Esto le permite al usuario volver a evaluar ofertas recientes si cambió
 * su perfil o sus preferencias para la IA.
 *
 * ¿Por qué make_interval en vez de INTERVAL '1 day' * $1?
 * Porque PostgreSQL no permite multiplicar un INTERVAL fijo por un parámetro
 * directamente en todas las versiones. make_interval(days => $1) es la forma
 * estándar y segura de construir un intervalo dinámico a partir de un número.
 *
 * @param {number} dias - Cantidad de días hacia atrás a resetear.
 * @returns {{ id: number, titulo: string }[]} Lista de ofertas reseteadas.
 */
async function resetearEvaluacionesPorDias(dias = 30) {
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
        throw Object.assign(new Error('El campo dias debe ser un número entero entre 1 y 30.'), { status: 400 });
    }
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_evaluacion = 'pendiente',
             razon_evaluacion  = NULL,
             porcentaje_match  = NULL,
             fecha_evaluacion  = NULL,
             firma_criterios_evaluacion = NULL,
             evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA',
             prioridad_ia = false, puntaje_prioridad_ia = 0,
             evidencias_prioridad_ia = '[]'::jsonb, version_prioridad_ia = NULL
         WHERE estado_evaluacion IN ('aprobada', 'rechazada')
           AND fecha_extraccion IS NOT NULL
           AND COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - make_interval(days => $1)
         RETURNING id, titulo`,
        [dias]
    );

    return resultado.rows;
}

/** Selecciono el conjunto completo reciente; nunca omito IDs inválidos silenciosamente. */
async function obtenerOfertasSeleccionadas(ids) {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200
        || ids.some(id => !Number.isSafeInteger(id) || id < 1)
        || new Set(ids).size !== ids.length) {
        const error = new Error('Debo recibir entre 1 y 200 IDs únicos, enteros positivos seguros.');
        error.status = 400;
        throw error;
    }
    const resultado = await pool.query(
        `SELECT * FROM ofertas WHERE id = ANY($1::bigint[])
         AND COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - INTERVAL '30 days'
         ORDER BY fecha_extraccion DESC`,
        [ids]
    );
    if (resultado.rows.length !== ids.length
        || new Set(resultado.rows.map(oferta => Number(oferta.id))).size !== ids.length
        || resultado.rows.some(oferta => !ids.includes(Number(oferta.id)))) {
        const error = new Error('Todas las ofertas seleccionadas deben existir y haberse extraído en los últimos 30 días.');
        error.status = 400;
        throw error;
    }
    return resultado.rows;
}

// Registro el fallo sin reemplazar la evaluación válida ni los datos manuales.
async function registrarErrorEvaluacion(id, mensaje, descripcionEsperada = undefined, fechaModificacionEsperada = undefined) {
    const validarDescripcion = descripcionEsperada !== undefined;
    const validarFechaModificacion = fechaModificacionEsperada !== undefined;
    const resultado = await pool.query(
        'UPDATE ofertas SET evaluacion_error_mensaje = $1 WHERE id = $2 AND ($4::boolean = false OR descripcion IS NOT DISTINCT FROM $3) AND ($6::boolean = false OR date_trunc(\'milliseconds\', descripcion_modificada_en) IS NOT DISTINCT FROM date_trunc(\'milliseconds\', $5::timestamp)) RETURNING *',
        [mensaje, id, validarDescripcion ? descripcionEsperada : null, validarDescripcion, validarFechaModificacion ? fechaModificacionEsperada : null, validarFechaModificacion]
    );
    return resultado.rows[0] || null;
}

/**
 * Actualizo manualmente la descripción de una oferta.
 * Preservo la descripción original la primera vez que se modifica,
 * marco la completitud como 'completa', el origen como 'manual' y
 * reseteo el estado de evaluación a 'pendiente' con 'REEVALUACION_SOLICITADA'.
 *
 * @param {number} id - ID de la oferta.
 * @param {string} nuevaDescripcion - Nuevo texto de descripción (20 a 50.000 caracteres).
 * @returns {Object|null} Oferta actualizada o null si no se encontró.
 */
async function actualizarDescripcionManual(id, nuevaDescripcion) {
    const idNumerico = Number(id);
    if (!Number.isInteger(idNumerico) || idNumerico <= 0) {
        const error = new Error('El ID debe ser un número entero positivo.');
        error.status = 400;
        throw error;
    }

    if (typeof nuevaDescripcion !== 'string') {
        const error = new Error('La descripción debe ser un texto.');
        error.status = 400;
        throw error;
    }

    const descripcionLimpia = nuevaDescripcion.trim();
    if (descripcionLimpia.length < 20 || descripcionLimpia.length > 50000) {
        const error = new Error('La descripción debe tener entre 20 y 50.000 caracteres.');
        error.status = 400;
        throw error;
    }

    const resultado = await pool.query(
        `UPDATE ofertas
         SET descripcion_original = COALESCE(descripcion_original, descripcion),
             descripcion = $1,
             origen_descripcion = 'manual',
             descripcion_completitud = 'completa',
             descripcion_modificada_en = date_trunc('milliseconds', NOW()),
             estado_evaluacion = 'pendiente',
             evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA',
             porcentaje_match = NULL,
             razon_evaluacion = 'Descripción modificada manualmente; requiere reevaluación.',
             explicacion_evaluacion = NULL,
             firma_criterios_evaluacion = NULL
         WHERE id = $2
         RETURNING *`,
        [descripcionLimpia, idNumerico]
    );

    return resultado.rows.length > 0 ? resultado.rows[0] : null;
}

module.exports = {
    registrarErrorEvaluacion,
    obtenerOfertasSeleccionadas,
    crearOferta,
    obtenerOfertas,
    obtenerBloqueSincronizacion,
    obtenerOfertaPorId,
    obtenerOfertasPendientes,
    obtenerOfertasConErrores,
    obtenerOfertasConErrorRecuperable: obtenerOfertasConErrores,
    obtenerEstadisticas,
    actualizarEvaluacion,
    actualizarPostulacion,
    actualizarPostulacionMasiva,
    resetearEvaluacionesPorDias,
    actualizarDescripcionManual,
    _internas: { firmarCursor, leerCursor },
};
