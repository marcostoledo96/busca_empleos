//!/usr/bin/env node
/**
 * Runner de migraciones SQL para PostgreSQL.
 *
 * ¿Por qué existe?
 * Antes teníamos 15+ scripts SQL que se corrían manualmente con `psql`,
 * sin control de cuáles ya fueron aplicados. Este runner automatiza eso:
 * 1. Lee todos los archivos .sql de la carpeta `sql/`.
 * 2. Filtra solo los que NO están en `schema_migrations`.
 * 3. Los ejecuta en orden alfabético (que debe ser cronológico).
 * 4. Registra cada migración aplicada en `schema_migrations`.
 *
 * Uso:
 *   node scripts/migrar.js         → muestra migraciones pendientes
 *   node scripts/migrar.js --apply → ejecuta las migraciones pendientes
 *   npm run db:migrate:apply       → alias configurado en package.json
 *
 * La tabla schema_migrations se crea automáticamente si no existe (DDL idéntico
 * a migracion-014-schema-migrations.sql). No hace falta ejecutarla manualmente.
 *
 * Las migraciones deben ser idempotentes (usar IF NOT EXISTS, DO $$, etc.)
 * para ser seguras si alguien corre el script directo con psql.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Cargo .env del backend para obtener conexion a PostgreSQL.
// El script está en backend/scripts/, así que el .env está un nivel arriba
// en backend/.env. Uso el mismo criterio que base-datos.js: resolver desde
// __dirname relativo a la ubicación del archivo.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sqlDir = path.resolve(__dirname, '..', 'sql');
const modoApply = process.argv.includes('--apply');

/**
 * Crea la tabla schema_migrations si no existe, usando el mismo DDL que
 * migracion-014-schema-migrations.sql. Esto permite que el runner funcione
 * desde cero sin necesidad de ejecutar la migración manualmente.
 *
 * @param {import('pg').Pool} pool - Pool de conexiones a PostgreSQL.
 */
async function asegurarTablaSchemaMigrations(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id          VARCHAR(255)    PRIMARY KEY,
            aplicado_en TIMESTAMP       DEFAULT NOW(),
            exitoso     BOOLEAN         DEFAULT true
        );
    `);
    console.log('[Migración] Tabla schema_migrations verificada/creada.');
}

async function migrar() {
    const pool = new Pool();

    try {
        // 1. Asegurar que schema_migrations existe antes de consultarla.
        // Si la tabla no existe, la creamos con el DDL de migracion-014.
        // Esto evita que el runner falle en una BD nueva sin la tabla.
        await asegurarTablaSchemaMigrations(pool);

        // 2. Obtener migraciones ya aplicadas.
        const aplicadasResult = await pool.query(
            'SELECT id FROM schema_migrations WHERE exitoso = true;'
        );
        const aplicadas = new Set(aplicadasResult.rows.map(r => r.id));

        // 3. Leer archivos .sql de la carpeta sql/.
        const archivos = fs
            .readdirSync(sqlDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Orden alfabético = cronológico si se nombran bien.

        const pendientes = archivos.filter(f => !aplicadas.has(f));

        if (pendientes.length === 0) {
            console.log('[Migración] No hay migraciones pendientes. La base está al día.');
            return;
        }

        console.log(
            `[Migración] ${pendientes.length} migración(es) pendiente(s).`
        );
        pendientes.forEach(f => console.log(`  - ${f}`));

        if (!modoApply) {
            console.log(
                `\nPara aplicarlas, corré:\n` +
                `  node scripts/migrar.js --apply\n` +
                `o\n` +
                `  npm run db:migrate:apply`
            );
            return;
        }

        // 4. Aplicar cada migración dentro de una transacción.
        for (const archivo of pendientes) {
            const sql = fs.readFileSync(path.join(sqlDir, archivo), 'utf-8');
            const client = await pool.connect();

            try {
                console.log(`[Migración] Aplicando: ${archivo}`);
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (id, exitoso) VALUES ($1, true);',
                    [archivo]
                );
                await client.query('COMMIT');
                console.log(`[Migración] OK: ${archivo}`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[Migración] FALLÓ: ${archivo}`);
                console.error(`  Error: ${error.message}`);
                // Registramos como fallido pero no seguimos — el operador debe revisar.
                await pool.query(
                    'INSERT INTO schema_migrations (id, exitoso) VALUES ($1, false);',
                    [archivo]
                );
                process.exit(1);
            } finally {
                client.release();
            }
        }

        console.log('[Migración] Todas las migraciones pendientes se aplicaron correctamente.');
    } finally {
        await pool.end();
    }
}

migrar().catch(err => {
    console.error('[Migración] Error inesperado:', err.message);
    process.exit(1);
});
