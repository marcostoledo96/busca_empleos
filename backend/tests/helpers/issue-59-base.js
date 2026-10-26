// Reutilizo la preparación #57 antes del comando legacy que necesita tablas de test.
const { spawnSync } = require('node:child_process');
const { prepararBase } = require('./issue-57-entorno');

async function main() {
    const { pool, esquema } = await prepararBase();
    await pool.end();
    console.log(`Validé PostgreSQL15 sintético; ejecuto test:db en ${esquema}.`);
    const resultado = spawnSync('npm', ['run', 'test:db'], { env: process.env, stdio: 'inherit' });
    if (resultado.error) throw resultado.error;
    process.exitCode = resultado.status ?? 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
