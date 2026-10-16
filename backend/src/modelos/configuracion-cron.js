const pool = require('../config/base-datos');
async function obtener() {
    const { rows } = await pool.query('SELECT activo, expresion_cron, zona_horaria FROM configuracion_cron WHERE id = 1');
    return rows[0] || null;
}
async function guardar({ activo, expresionCron, zonaHoraria }) {
    await pool.query(`INSERT INTO configuracion_cron (id, activo, expresion_cron, zona_horaria) VALUES (1, $1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET activo = EXCLUDED.activo, expresion_cron = EXCLUDED.expresion_cron,
        zona_horaria = EXCLUDED.zona_horaria, actualizado_en = clock_timestamp()`, [activo, expresionCron, zonaHoraria]);
}
module.exports = { obtener, guardar };
