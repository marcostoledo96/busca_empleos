// Mantengo la prueba SQL explícita y separada de las suites sin PostgreSQL.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validarEntorno } = require('../tests/helpers/issue-57-entorno');

function main() {
    if (process.argv[2] === '--help') {
        console.log('Uso: npm run test:issue59 [-- --help]\nEjecuto Express → adaptador real → PostgreSQL15 aislado. Exijo las variables sintéticas de #57; valido identidad antes de SQL. Bloqueo .env y red externa mediante preload propio.');
        return;
    }
    if (process.argv.length > 2) throw new Error('Opción desconocida; consulto --help.');
    validarEntorno();
    const resultado = spawnSync(process.execPath, [
        '--require', path.resolve(__dirname, '../tests/helpers/issue-59-seguridad.js'),
        require.resolve('jest/bin/jest'), '--runInBand', '--verbose',
        '--cacheDirectory', path.resolve(__dirname, '../../docs/evidencias/issue-59/runtime/jest-cache'),
        '--runTestsByPath', 'tests/integracion/issue-59-proveedores.test.js',
    ], { cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'inherit' });
    if (resultado.error) throw resultado.error;
    process.exitCode = resultado.status ?? 1;
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
