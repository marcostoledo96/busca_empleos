// Modelo de ofertas — funciones CRUD para la tabla `ofertas`.
// Cada función ejecuta una query SQL parametrizada contra PostgreSQL.
//
// ¿Por qué queries parametrizadas ($1, $2) y no template literals?
// Porque los parámetros se envían SEPARADOS de la query al servidor de PostgreSQL.
// Así, aunque alguien meta código SQL malicioso en los datos, PostgreSQL lo trata
// como un valor textual y no como parte de la query. Esto previene SQL Injection,
// que es el ataque más común contra bases de datos.

const pool = require('../config/base-datos');

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
 * Obtengo ofertas de la base de datos, con filtros opcionales.
 *
 * @param {Object} filtros - Filtros opcionales: { estado, plataforma }.
 * @returns {Array} Lista de ofertas que coinciden con los filtros.
 */
async function obtenerOfertas(filtros = {}) {
    // Construyo la query dinámicamente según los filtros que vengan.
    // Arranco con un array de condiciones y parámetros vacíos.
    const condiciones = [];
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

    // Si hay condiciones, las uno con AND. Si no, no agrego WHERE.
    const clausulaWhere = condiciones.length > 0
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

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

    // NULLS LAST para que las ofertas sin fecha o sin porcentaje queden al final.
    const resultado = await pool.query(
        `SELECT * FROM ofertas ${clausulaWhere} ORDER BY ${columnaOrden} ${direccion} NULLS LAST`,
        parametros
    );

    return resultado.rows;
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
 * @returns {Object|null} La oferta actualizada, o null si el ID no existe.
 */
async function actualizarEvaluacion(id, estado, razon, porcentaje = null) {
    const resultado = await pool.query(
        `UPDATE ofertas
         SET estado_evaluacion = $1, razon_evaluacion = $2, porcentaje_match = $3
         WHERE id = $4
         RETURNING *`,
        [estado, razon, porcentaje, id]
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
 * @returns {Object} { total, pendientes, aprobadas, rechazadas }
 */
async function obtenerEstadisticas() {
    const resultado = await pool.query(
        `SELECT estado_evaluacion, COUNT(*)::integer AS cantidad
         FROM ofertas
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

module.exports = {
    crearOferta,
    obtenerOfertas,
    obtenerOfertaPorId,
    obtenerOfertasPendientes,
    obtenerEstadisticas,
    actualizarEvaluacion,
    actualizarPostulacion
};
