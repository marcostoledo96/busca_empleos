const { spawnSync } = require('node:child_process');
const path = require('node:path');

const backend = path.resolve(__dirname, '../..');
const runtime = path.resolve(backend, '../docs/evidencias/issue-59/runtime');
const entorno = { PATH: process.env.PATH, HOME: path.join(runtime, 'home'), NODE_ENV: 'test', TMPDIR: runtime, npm_config_cache: runtime, npm_config_update_notifier: 'false' };
jest.setTimeout(15000);

// La enumeración no carga adaptadores ni abre sockets; no heredo PG, credenciales ni NODE_OPTIONS.
test.each([
    ['test', ['test', '--', '--listTests', '--json', '--runInBand']],
    ['test:integracion', ['run', 'test:integracion', '--', '--listTests', '--json']],
])('%s excluye SQL explícito sin ocultarlo con SKIP', (nombre, argumentos) => {
    const resultado = spawnSync('npm', argumentos, { cwd: backend, env: entorno, encoding: 'utf8', timeout: 10000 });
    expect(resultado.error).toBeUndefined();
    expect(resultado.status).toBe(0);
    const inicio = resultado.stdout.indexOf('["');
    expect(inicio).toBeGreaterThanOrEqual(0);
    const archivos = JSON.parse(resultado.stdout.slice(inicio));
    expect(archivos.length).toBeGreaterThan(0);
    expect(archivos.some(archivo => archivo.endsWith('issue-57-seguridad.test.js'))).toBe(true);
    expect(archivos.some(archivo => /issue-(57-backend|59-proveedores)\.test\.js$/.test(archivo))).toBe(false);
    expect(resultado.stderr).toBe('');
});

test('la prueba de seguridad pasa por npm test sin PG ni preload heredado', () => {
    const resultado = spawnSync('npm', ['test', '--', '--runInBand', '--runTestsByPath',
        'tests/servicios/issue-59-seguridad.test.js'], { cwd: backend, env: entorno, encoding: 'utf8', timeout: 10000 });
    expect(resultado.error).toBeUndefined();
    expect(resultado.status).toBe(0);
    expect(resultado.stderr).toContain('1 passed, 1 total');
    expect(resultado.stderr).not.toContain('FAIL');
});

test('el runner SQL ofrece ayuda y rechaza entorno ausente antes de migrar o conectar', () => {
    const script = path.resolve(backend, 'scripts/test-issue-59.js');
    const ayuda = spawnSync(process.execPath, [script, '--help'], { env: entorno, encoding: 'utf8' });
    expect(ayuda.status).toBe(0);
    expect(ayuda.stdout).toContain('Uso: npm run test:issue59');
    expect(ayuda.stderr).toBe('');
    const rechazado = spawnSync(process.execPath, [script], { env: entorno, encoding: 'utf8' });
    expect(rechazado.status).toBe(1);
    expect(rechazado.stdout).toBe('');
    expect(rechazado.stderr).toBe('Entorno issue57 no permitido.\n');
});
