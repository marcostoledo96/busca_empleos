const pool = require('../config/base-datos');

async function obtenerCvBase() {
    const resultado = await pool.query(
        'SELECT cv_base, cv_base_actualizado_en FROM cv_base WHERE id = 1'
    );
    return resultado.rows[0] || { cv_base: null, cv_base_actualizado_en: null };
}

async function guardarCvBase(texto) {
    const resultado = await pool.query(
        `INSERT INTO cv_base (id, cv_base, cv_base_actualizado_en)
         VALUES (1, $1, clock_timestamp())
         ON CONFLICT (id) DO UPDATE
         SET cv_base = EXCLUDED.cv_base, cv_base_actualizado_en = clock_timestamp()
         RETURNING cv_base, cv_base_actualizado_en`,
        [texto]
    );
    return resultado.rows[0];
}

module.exports = { obtenerCvBase, guardarCvBase };
