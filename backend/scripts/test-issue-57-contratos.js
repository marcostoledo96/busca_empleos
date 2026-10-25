// Compruebo descubrimiento y el shell configurado sin PostgreSQL ni proveedores externos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const raiz = path.resolve(__dirname, '../..');
const salida = path.join(raiz, '.codegraph/issue57-correccion');
fs.mkdirSync(salida, { recursive: true });
const entorno = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test' };
let fallos = 0;
function comprobar(nombre, prueba) {
    try { prueba(); console.log(`PASS ${nombre}`); }
    catch (error) { fallos++; console.error(`FAIL ${nombre}: ${error.message}`); }
}
comprobar('descubrimiento ordinario sin SQL opt-in ni exclusiones ajenas', () => {
    const argumentos = ['--prefix', 'backend', 'test', '--', '--listTests', '--json', '--runInBand',
        '--cacheDirectory', path.join(salida, 'jest-cache')];
    const resultado = spawnSync('npm', argumentos, { cwd: raiz, env: entorno, encoding: 'utf8' });
    assert.equal(resultado.status, 0, resultado.stderr);
    const lista = JSON.parse(resultado.stdout.slice(resultado.stdout.indexOf('[')));
    const jest = require('../package.json').scripts.test;
    assert.ok(!lista.some(archivo => archivo.endsWith('/issue-57-backend.test.js')));
    assert.ok(lista.some(archivo => archivo.endsWith('/issue-57-seguridad.test.js')));
    // Comparo con el descubrimiento completo: sólo puede faltar el archivo SQL autorizado.
    const completa = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--listTests', '--json',
        '--runInBand', '--cacheDirectory', path.join(salida, 'jest-cache')],
    { cwd: path.join(raiz, 'backend'), env: entorno, encoding: 'utf8' });
    assert.equal(completa.status, 0, completa.stderr);
    assert.deepEqual(JSON.parse(completa.stdout).filter(archivo => !lista.includes(archivo)),
        [path.join(raiz, 'backend/tests/integracion/issue-57-backend.test.js')]);
    assert.ok(!/SKIP/.test(jest));
});
const workflow = fs.readFileSync(path.join(raiz, '.github/workflows/ci.yml'), 'utf8');
const job = workflow.split('    integracion-issue57:')[1].split('    # ── Frontend:')[0];
for (const nombre of ['Integración backend focal', 'E2E real con API efímera aislada']) {
    comprobar(`pipeline ${nombre} conserva exit 23 y crea log`, () => {
        const bloque = job.split(`- name: ${nombre}\n`)[1].split('            - name:')[0];
        const shell = bloque.match(/^\s+shell: (.+)$/m)?.[1];
        const comando = bloque.match(/^\s+run: (.+)$/m)[1];
        const log = path.join(salida, nombre.startsWith('Integración') ? 'shell-backend.log' : 'shell-e2e.log');
        const pipeline = comando.replace(/tee \S+$/, `tee '${log}'`);
        // Reproduzco los templates documentados de Actions: implícito bash -e, explícito bash -e -o pipefail.
        const args = shell === 'bash' ? ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c'] : ['-e', '-c'];
        assert.ok(shell === undefined || shell === 'bash', 'Shell no contemplado por esta prueba focal.');
        const resultado = spawnSync('bash', [...args, `npm() { printf 'npm ficticio\\n'; return 23; }; ${pipeline}`],
            { cwd: raiz, env: entorno, encoding: 'utf8' });
        assert.equal(fs.readFileSync(log, 'utf8'), 'npm ficticio\n');
        assert.equal(resultado.status, 23);
    });
}
process.exitCode = fallos ? 1 : 0;
