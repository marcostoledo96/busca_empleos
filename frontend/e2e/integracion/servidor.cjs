// Valido el entorno heredado antes de iniciar procesos sin credenciales personales.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validarEntorno } = require('../../../backend/tests/helpers/issue-57-entorno');
validarEntorno();
const api = process.argv[2] === 'api';
if (!api && process.argv[2] !== 'angular') throw new Error('Servidor de prueba desconocido.');
const entorno = { PATH: process.env.PATH, NG_CLI_ANALYTICS: 'false' };
if (api) {
    for (const clave of ['NODE_ENV', 'DB_TEST_SINTETICA', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE']) {
        entorno[clave] = process.env[clave];
    }
}
const salida = path.resolve(__dirname, 'salida');
fs.mkdirSync(salida, { recursive: true });
const log = fs.createWriteStream(path.join(salida, api ? 'api.log' : 'angular.log'));
const hijo = spawn(process.execPath, api
    ? ['../backend/scripts/test-issue-57.js', '--api']
    : ['node_modules/@angular/cli/bin/ng.js', 'serve', '--configuration', 'integracion', '--host', '127.0.0.1', '--port', '4357'],
{ env: entorno, stdio: ['ignore', 'pipe', 'pipe'] });
for (const [flujo, destino] of [[hijo.stdout, process.stdout], [hijo.stderr, process.stderr]]) {
    flujo.on('data', datos => { log.write(datos); destino.write(datos); });
}
for (const senal of ['SIGINT', 'SIGTERM']) process.once(senal, () => hijo.kill(senal));
hijo.once('error', error => { console.error(error); process.exitCode = 1; log.end(); });
hijo.once('exit', codigo => { process.exitCode = codigo ?? 1; log.end(); });
