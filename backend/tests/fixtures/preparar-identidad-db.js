// Preparo exclusivamente un contenedor sintético ya verificado, sin cargar dotenv.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function preparar() {
    if (process.env.DB_TEST_SINTETICA !== 'true' || process.env.PGHOST !== '127.0.0.1'
        || process.env.PGDATABASE !== 'issue19_test' || process.env.PGPORT !== '55439') {
        throw new Error('Rechazo preparar una conexión no sintética.');
    }
    const cliente = new Client();
    await cliente.connect();
    try {
        const { rows: [servidor] } = await cliente.query("SELECT current_setting('cluster_name') AS cluster, current_database() AS bd, current_user AS usuario");
        if (servidor.cluster !== 'issue19_remediacion_sintetica' || servidor.bd !== 'issue19_test' || servidor.usuario !== 'sintetico') {
            throw new Error('El servidor no es el contenedor sintético esperado.');
        }
        const carpeta = path.resolve(__dirname, '../../sql');
        await cliente.query(fs.readFileSync(path.join(carpeta, 'migracion-014-schema-migrations.sql'), 'utf8'));
        const aplicadas = new Set((await cliente.query('SELECT id FROM schema_migrations WHERE exitoso = true')).rows.map(fila => fila.id));
        for (const archivo of fs.readdirSync(carpeta).filter(nombre => nombre.endsWith('.sql')).sort()) {
            if (aplicadas.has(archivo)) continue;
            // No importo perfiles personales: sólo esquema y defaults, sin DML de preferencias.
            const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8')
                .replace(/INSERT INTO preferencias\b[^;]*;/gi, '')
                .replace(/UPDATE preferencias\b[^;]*;/gi, '');
            await cliente.query('BEGIN');
            try {
                await cliente.query(sql);
                await cliente.query('INSERT INTO schema_migrations (id, exitoso) VALUES ($1, true)', [archivo]);
                await cliente.query('COMMIT');
                console.log(`Aplicada sintética: ${archivo}`);
            } catch (error) {
                await cliente.query('ROLLBACK');
                throw error;
            }
        }
        console.log((await cliente.query("SELECT id, exitoso FROM schema_migrations WHERE id LIKE 'migracion-02%' ORDER BY id")).rows);
    } finally {
        await cliente.end();
    }
}

preparar().catch(error => { console.error(error.message); process.exitCode = 1; });
