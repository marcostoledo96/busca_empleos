// Modelo de lotes de evaluación — persiste el progreso en BD.
//
// Antes: el progreso vivía solo en memoria (let progresoEvaluacion).
// Si el servidor se reiniciaba, el frontend veía 0% y no sabía qué pasó.
//
// Ahora: cada lote de evaluación se guarda en `evaluacion_lotes`.
// El frontend puede consultar el último lote aunque el servidor se haya reiniciado.

const pool = require('../config/base-datos');

/**
 * Crea un nuevo lote de evaluación.
 *
 * @param {number} total - Total de ofertas a evaluar.
 * @param {string} modeloIa - Modelo de IA usado.
 * @returns {Object} El lote creado.
 */
async function crearLote(total, modeloIa) {
    const resultado = await pool.query(
        `INSERT INTO evaluacion_lotes (estado, total, modelo_ia)
         VALUES ('activo', $1, $2)
         RETURNING *`,
        [total, modeloIa]
    );

    return resultado.rows[0];
}

/**
 * Actualiza el progreso del lote activo.
 *
 * @param {number} loteId - ID del lote.
 * @param {Object} progreso - Datos del progreso actual.
 * @param {number} progreso.evaluadas - Ofertas ya evaluadas.
 * @param {number} progreso.aprobadas - Ofertas aprobadas.
 * @param {number} progreso.rechazadas - Ofertas rechazadas.
 * @param {number} progreso.errores - Errores de API.
 * @param {number} progreso.porcentaje - Porcentaje de avance (0-100).
 */
async function actualizarProgreso(loteId, progreso) {
    await pool.query(
        `UPDATE evaluacion_lotes
         SET evaluadas = $1, aprobadas = $2, rechazadas = $3,
             errores = $4, porcentaje = $5, actualizado_en = NOW()
         WHERE id = $6`,
        [
            progreso.evaluadas,
            progreso.aprobadas,
            progreso.rechazadas,
            progreso.errores,
            progreso.porcentaje,
            loteId,
        ]
    );
}

/**
 * Marca un lote como finalizado.
 *
 * @param {number} loteId - ID del lote.
 * @param {string} estado - Estado final ('completado' o 'cancelado').
 */
async function finalizarLote(loteId, estado = 'completado') {
    await pool.query(
        `UPDATE evaluacion_lotes
         SET estado = $1, finalizado_en = NOW(), actualizado_en = NOW()
         WHERE id = $2`,
        [estado, loteId]
    );
}

module.exports = {
    crearLote,
    actualizarProgreso,
    finalizarLote,
};
