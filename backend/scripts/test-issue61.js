const path = require('path');
const { spawnSync } = require('child_process');
const { validarEntorno } = require('../tests/helpers/issue-57-entorno');

function main(argumentos = process.argv.slice(2)) {
    if (argumentos.length === 1 && argumentos[0] === '--help') {
        console.log('Uso: node scripts/test-issue61.js\nEjecuto preflight SQL11 y smoke HTTP real en PostgreSQL 15 sintético con las guardas de issue57, antes de crear fixtures.');
        return;
    }
    validarEntorno();
    if (process.env.RELEASE_URL || process.env.RELEASE_TOKEN) throw new Error('No acepto destinos o sesiones de release en el runner sintético.');
    if (argumentos.length) throw new Error('Opción no permitida.');
    const resultado = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', '--no-cache',
        '--runTestsByPath', 'tests/integracion/issue-61-esquema.test.js', 'tests/integracion/issue-61-http.test.js'],
    { cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'inherit', timeout: 180000 });
    process.exitCode = resultado.status ?? 1;
}

if (require.main === module) {
    try { main(); } catch { console.error('Entorno issue61 no permitido; no preparo fixtures.'); process.exitCode = 1; }
}
module.exports = { main };
