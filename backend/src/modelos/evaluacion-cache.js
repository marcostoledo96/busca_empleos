// Modelo de cache de evaluaciones — evita re-evaluar ofertas ya procesadas.
//
// La tabla evaluaciones_cache guarda resultados de evaluaciones previas
// indexados por hash de oferta + hash de preferencias + modelo.
//
// Si el contenido de la oferta es idéntico (mismo título, empresa, ubicación,
// modalidad y descripción) y las preferencias del usuario no cambiaron,
// se reutiliza el resultado anterior sin gastar tokens en DeepSeek.

const crypto = require('crypto');
const pool = require('../config/base-datos');

/**
 * Normaliza un texto para hashing: minúsculas, sin acentos, sin espacios extra.
 * Esto hace que "React Developer" y "react   developer" produzcan el mismo hash.
 *
 * @param {string} texto - Texto a normalizar.
 * @returns {string} Texto normalizado.
 */
function normalizarTexto(texto = '') {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Genera un hash SHA-256 del contenido de una oferta.
 * Si dos ofertas tienen el mismo título, empresa, ubicación, modalidad
 * y descripción, producen el mismo hash → se consideran equivalentes.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @returns {string} Hash hexadecimal.
 */
function crearHashOferta(oferta) {
    const base = [
        oferta.titulo,
        oferta.empresa,
        oferta.ubicacion,
        oferta.modalidad,
        oferta.descripcion,
    ].map(normalizarTexto).join('|');

    return crypto.createHash('sha256').update(base).digest('hex');
}

/**
 * Genera un hash SHA-256 de las preferencias del usuario.
 * Solo incluye los campos que afectan el resultado de la evaluación.
 * Si el usuario cambia su stack, nivel, modalidad o exclusiones,
 * el hash cambia → no se reutilizan evaluaciones viejas.
 *
 * @param {Object} preferencias - Fila de la tabla preferencias.
 * @returns {string} Hash hexadecimal.
 */
function crearHashPreferencias(preferencias) {
    const base = JSON.stringify({
        nivel_experiencia: preferencias.nivel_experiencia,
        stack_tecnologico: preferencias.stack_tecnologico,
        modalidad_aceptada: preferencias.modalidad_aceptada,
        zonas_preferidas: preferencias.zonas_preferidas,
        reglas_exclusion: preferencias.reglas_exclusion,
        idioma_candidato: preferencias.idioma_candidato,
    });

    return crypto.createHash('sha256').update(base).digest('hex');
}

/**
 * Busca un resultado cacheado para una oferta.
 *
 * @param {string} hashOferta - Hash de la oferta.
 * @param {string} hashPreferencias - Hash de las preferencias.
 * @param {string} modeloIa - Modelo de IA usado.
 * @returns {Object|null} Resultado cacheado o null si no existe.
 */
async function buscarCache(hashOferta, hashPreferencias, modeloIa) {
    const resultado = await pool.query(
        `SELECT resultado FROM evaluaciones_cache
         WHERE hash_oferta = $1 AND hash_preferencias = $2 AND modelo_ia = $3`,
        [hashOferta, hashPreferencias, modeloIa]
    );

    if (resultado.rows.length > 0) {
        return resultado.rows[0].resultado;
    }

    return null;
}

/**
 * Guarda un resultado de evaluación en el cache.
 * Si ya existe un resultado para la misma combinación (hash + preferencias + modelo),
 * no lo sobrescribe (ON CONFLICT DO NOTHING).
 *
 * @param {string} hashOferta - Hash de la oferta.
 * @param {string} hashPreferencias - Hash de las preferencias.
 * @param {string} modeloIa - Modelo de IA usado.
 * @param {Object} resultado - Resultado de la evaluación.
 */
async function guardarCache(hashOferta, hashPreferencias, modeloIa, resultado) {
    await pool.query(
        `INSERT INTO evaluaciones_cache (hash_oferta, hash_preferencias, modelo_ia, resultado)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (hash_oferta, hash_preferencias, modelo_ia) DO NOTHING`,
        [hashOferta, hashPreferencias, modeloIa, JSON.stringify(resultado)]
    );
}

module.exports = {
    crearHashOferta,
    crearHashPreferencias,
    buscarCache,
    guardarCache,
};
