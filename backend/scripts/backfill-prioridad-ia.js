'use strict';

const path = require('path');
const esEntornoTest = process.env.NODE_ENV === 'test';
const archivoEntorno = esEntornoTest ? '.env.test' : '.env';

if (esEntornoTest) {
    delete process.env.DATABASE_URL;
}

require('dotenv').config({
    path: path.resolve(__dirname, '..', archivoEntorno),
    override: esEntornoTest,
});

const pool = require('../src/config/base-datos');
const { detectarPrioridadIa, VERSION_PRIORIDAD_IA } = require('../src/servicios/evaluacion/detector-prioridad-ia');

async function ejecutarBackfill({ aplicar = false, lote = 100 } = {}) {
    const limite = Math.max(1, Math.min(500, Number(lote) || 100));
    const fechaCorte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let ultimoId = 0;
    let procesadas = 0;
    let cambios = 0;

    while (true) {
        const resultado = await pool.query(
            `SELECT id, titulo, descripcion
             FROM ofertas
             WHERE fecha_extraccion >= $1 AND id > $2
             ORDER BY id ASC
             LIMIT $3`,
            [fechaCorte, ultimoId, limite]
        );
        if (resultado.rows.length === 0) break;

        for (const oferta of resultado.rows) {
            const prioridad = detectarPrioridadIa(oferta);
            procesadas += 1;
            cambios += 1;
            if (aplicar) {
                await pool.query(
                    `UPDATE ofertas
                     SET prioridad_ia = $1, puntaje_prioridad_ia = $2,
                         evidencias_prioridad_ia = $3::jsonb, version_prioridad_ia = $4
                     WHERE id = $5 AND fecha_extraccion >= $6`,
                    [prioridad.detectada, prioridad.puntaje, JSON.stringify(prioridad.evidencias), VERSION_PRIORIDAD_IA, oferta.id, fechaCorte]
                );
            }
            ultimoId = oferta.id;
        }
    }

    return { modo: aplicar ? 'apply' : 'dry-run', fecha_corte: fechaCorte.toISOString(), procesadas, cambios };
}

if (require.main === module) {
    ejecutarBackfill({ aplicar: process.argv.includes('--apply') })
        .then((resultado) => console.log(JSON.stringify(resultado)))
        .finally(() => pool.end());
}

module.exports = { ejecutarBackfill };
