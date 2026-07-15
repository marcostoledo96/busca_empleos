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

const DURACION_CURSOR_SINCRONIZACION_MS = 30 * 60 * 1000;
const secretoCursorSincronizacion = process.env.CURSOR_SINCRONIZACION_SECRETO
    || crypto.randomBytes(32).toString('hex');

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
         WHERE fecha_extraccion >= $1 AND id <= $2`,
        [fechaCorte, maxId]
    );
    return resultado.rows[0];
}

/**
 * Inserto una nueva oferta en la base de datos.
 * Si la URL ya existe (duplicada), retorno null sin tirar error.
 *
 * @param {Object} datos - Los campos de la oferta a insertar.
 * @returns {Object|null} La oferta insertada con su ID, o null si ya existía.
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
        datos_crudos
    } = datos;

    // ON CONFLICT (url) DO NOTHING: si la URL ya existe, PostgreSQL no hace nada
    // (no tira error, simplemente ignora el INSERT).
    // RETURNING *: si el INSERT se ejecutó, me devuelve la fila completa.
    // Si no se insertó (conflicto), rows queda vacío.
    const resultado = await pool.query(
        `INSERT INTO ofertas (
            titulo, empresa, ubicacion, modalidad, descripcion,
            url, plataforma, nivel_requerido,
            salario_min, salario_max, moneda,
            fecha_publicacion, datos_crudos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (url) DO NOTHING
        RETURNING *`,
        [
            titulo, empresa, ubicacion, modalidad, descripcion,
            url, plataforma, nivel_requerido,
            salario_min || null, salario_max || null, moneda || null,
            fecha_publicacion || null,
            datos_crudos ? JSON.stringify(datos_crudos) : null
        ]
    );

    // Si rows está vacío, fue un duplicado. Retorno null.
    return resultado.rows.length > 0 ? resultado.rows[0] : null;
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
    const condiciones = [`fecha_extraccion >= NOW() - INTERVAL '30 days'`];
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
        'fecha_extraccion', 'fecha_publicacion', 'porcentaje_match',
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
                 FROM ofertas WHERE fecha_extraccion >= $1`,
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
                    prioridad_ia, puntaje_prioridad_ia, evidencias_prioridad_ia
             FROM ofertas
             WHERE fecha_extraccion >= $1 AND id <= $2 AND id < $3
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
        `SELECT * FROM ofertas WHERE estado_evaluacion = 'pendiente' ORDER BY fecha_extraccion DESC`
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
 * @returns {Object|null} La oferta actualizada, o null si el ID no existe.
 */
async function actualizarEvaluacion(id, estado, razon, porcentaje = null, errorMensaje = null, prioridadIa = null) {
    const prioridad = prioridadIa || { detectada: false, puntaje: 0, evidencias: [], version: null };
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_evaluacion = $1, razon_evaluacion = $2, porcentaje_match = $3,
              fecha_evaluacion = NOW(), evaluacion_error_mensaje = $5,
              prioridad_ia = $6, puntaje_prioridad_ia = $7,
              evidencias_prioridad_ia = $8::jsonb, version_prioridad_ia = $9
         WHERE id = $4
         RETURNING *`,
        [estado, razon, porcentaje, id, errorMensaje, Boolean(prioridad.detectada), prioridad.puntaje || 0, JSON.stringify(prioridad.evidencias || []), prioridad.version]
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
         WHERE fecha_extraccion >= NOW() - INTERVAL '30 days'
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
 * Reseteo a 'pendiente' las evaluaciones de la IA para ofertas evaluadas
 * dentro de los últimos N días.
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
async function resetearEvaluacionesPorDias(dias) {
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_evaluacion = 'pendiente',
             razon_evaluacion  = NULL,
             porcentaje_match  = NULL,
             fecha_evaluacion  = NULL
         WHERE estado_evaluacion IN ('aprobada', 'rechazada')
           AND fecha_evaluacion > NOW() - make_interval(days => $1)
         RETURNING id, titulo`,
        [dias]
    );

    return resultado.rows;
}

module.exports = {
    crearOferta,
    obtenerOfertas,
    obtenerBloqueSincronizacion,
    obtenerOfertaPorId,
    obtenerOfertasPendientes,
    obtenerEstadisticas,
    actualizarEvaluacion,
    actualizarPostulacion,
    actualizarPostulacionMasiva,
    resetearEvaluacionesPorDias,
    _internas: { firmarCursor, leerCursor },
};
