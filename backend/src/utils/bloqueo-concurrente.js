// Utilidad de bloqueo concurrente — Advisory Locks de PostgreSQL.
//
// ¿Por qué Advisory Locks y no un booleano en memoria?
// Porque el bloqueo en memoria se pierde si el servidor se reinicia o si
// hay múltiples instancias. Los Advisory Locks son gestionados por PostgreSQL,
// así que sobreviven reinicios y funcionan incluso con múltiples procesos de Node.js.
//
// ¿Cómo funcionan?
// pg_try_advisory_lock(clave) intenta adquirir un lock con un número entero.
// Si ya está tomado, retorna false. Si lo consigue, retorna true.
// pg_advisory_unlock(clave) libera el lock.

const pool = require('../config/base-datos');

const CLAVES = {
    EVALUACION_OFERTAS: 10001,
};

/**
 * Intenta adquirir un Advisory Lock de PostgreSQL.
 *
 * @param {number} clave - Número identificador del lock.
 * @returns {Object} { ok: true, client } si se adquirió, { ok: false } si ya está tomado.
 */
async function intentarAdquirirLock(clave) {
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [clave]);
        if (!rows[0].ok) {
            client.release();
            return { ok: false };
        }
        return { ok: true, client };
    } catch (err) {
        client.release();
        throw err;
    }
}

/**
 * Libera un Advisory Lock y devuelve el cliente al pool.
 *
 * @param {Object} client - Cliente de PostgreSQL con el lock adquirido.
 * @param {number} clave - Número identificador del lock.
 */
async function liberarBloqueo(client, clave) {
    try {
        await client.query('SELECT pg_advisory_unlock($1)', [clave]);
    } finally {
        client.release();
    }
}

/**
 * Libera un Advisory Lock de forma segura, sin tirar error si ya fue liberado.
 *
 * @param {Object|null} client - Cliente de PostgreSQL con el lock adquirido.
 * @param {number} clave - Número identificador del lock.
 */
async function liberarBloqueoSeguro(client, clave) {
    if (!client || !clave) return;
    try { await client.query('SELECT pg_advisory_unlock($1)', [clave]); } catch (_) {}
    try { client.release(); } catch (_) {}
}

module.exports = { CLAVES, intentarAdquirirLock, liberarBloqueo, liberarBloqueoSeguro };
