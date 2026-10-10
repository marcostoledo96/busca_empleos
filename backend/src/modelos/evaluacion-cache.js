// Caché de entradas canónicas: no reutilizo los hashes normalizados anteriores.
const pool = require('../config/base-datos');
const { crearHash, construirEntradaOferta, crearFirmaCriterios } = require('../servicios/evaluacion/identidad-evaluacion');

function crearHashOferta(oferta) {
    return crearHash(construirEntradaOferta(oferta));
}

function crearHashPreferencias(preferencias, opciones) {
    return crearFirmaCriterios(preferencias, opciones);
}

async function buscarCache(hashOferta, hashPreferencias, modeloIa) {
    const resultado = await pool.query(
        `SELECT resultado FROM evaluaciones_cache
         WHERE hash_oferta = $1 AND hash_preferencias = $2 AND modelo_ia = $3`,
        [hashOferta, hashPreferencias, modeloIa]
    );
    return resultado.rows.length > 0 ? resultado.rows[0].resultado : null;
}

/** Reemplazo también la fecha cuando renuevo una evaluación compatible. */
async function guardarCache(hashOferta, hashPreferencias, modeloIa, resultado) {
    await pool.query(
        `INSERT INTO evaluaciones_cache (hash_oferta, hash_preferencias, modelo_ia, resultado)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (hash_oferta, hash_preferencias, modelo_ia) DO UPDATE
         SET hash_oferta = EXCLUDED.hash_oferta, hash_preferencias = EXCLUDED.hash_preferencias,
             modelo_ia = EXCLUDED.modelo_ia, resultado = EXCLUDED.resultado, creado_en = NOW()`,
        [hashOferta, hashPreferencias, modeloIa, JSON.stringify(resultado)]
    );
}

module.exports = { crearHashOferta, crearHashPreferencias, buscarCache, guardarCache };
