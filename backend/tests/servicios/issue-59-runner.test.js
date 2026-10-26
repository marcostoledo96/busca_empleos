const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const backend = path.resolve(__dirname, '../..');
const runtime = path.resolve(backend, '../docs/evidencias/issue-59/runtime/pr66-review');
const entorno = { PATH: process.env.PATH, HOME: path.join(runtime, 'home'), NODE_ENV: 'test', TMPDIR: runtime, npm_config_cache: runtime, npm_config_update_notifier: 'false' };
jest.setTimeout(15000);

test('CI ejecuta SQL59 en el job aislado y conserva identidad, salida y exit incluso ante fallos', () => {
    const raiz = path.resolve(backend, '..');
    const workflow = fs.readFileSync(path.join(raiz, '.github/workflows/ci.yml'), 'utf8');
    const job = workflow.split('    integracion-issue57:')[1].split('    # ── Frontend:')[0];
    expect(job).toContain('PGPORT: \'55457\'');
    expect(job).toContain('PGDATABASE: busca_empleos_issue57_test');
    expect(job.match(/image: postgres:/g)).toHaveLength(1);
    const paso = job.split('- name: Integración SQL de proveedores issue59\n')[1];
    expect(paso).toBeDefined();
    const bloque = paso.split('            - name:')[0];
    expect(bloque).toContain('shell: bash');
    expect(bloque).toContain('PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}');
    const comando = bloque.split('              run: |\n')[1].trimEnd()
        .split('\n').map(linea => linea.slice(18)).join('\n');
    expect(comando).toContain('set -o pipefail');
    expect(comando).toContain('npm --prefix backend run test:issue59');
    expect(comando).toContain('git rev-parse HEAD');
    expect(comando).toContain('git rev-parse HEAD^{tree}');
    expect(comando).not.toContain('GITHUB_SHA');
    expect(job).toMatch(/if: always\(\)[\s\S]*uses: actions\/upload-artifact@v4[\s\S]*path: frontend\/e2e\/integracion\/salida\//);
    fs.mkdirSync(runtime, { recursive: true });
    for (const codigo of [42, 0]) {
        const log = path.join(runtime, `pipeline-${codigo}.log`);
        const aislado = comando.replace('frontend/e2e/integracion/salida/issue59-sql.log', log);
        const resultado = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c',
            `npm() { printf 'npm simulado: %s\\n' "$*"; printf 'stderr simulado\\n' >&2; return ${codigo}; };\n${aislado}`],
        { cwd: raiz, env: { ...entorno, PR_HEAD_SHA: 'cabecera-sintetica' }, encoding: 'utf8', timeout: 10000 });
        expect(resultado.error).toBeUndefined();
        expect(resultado.status).toBe(codigo);
        expect(resultado.stderr).toBe('');
        expect(fs.readFileSync(log, 'utf8')).toBe(resultado.stdout);
        expect(resultado.stdout).toContain('PR head SHA: cabecera-sintetica\n');
        for (const [etiqueta, revision] of [['Checkout commit', 'HEAD'], ['Checkout tree', 'HEAD^{tree}']]) {
            const identidad = spawnSync('git', ['rev-parse', revision], { cwd: raiz, env: entorno, encoding: 'utf8' });
            expect(identidad.status).toBe(0);
            expect(resultado.stdout).toContain(`${etiqueta}: ${identidad.stdout.trim()}\n`);
        }
        expect(resultado.stdout).toContain(`npm simulado: --prefix backend run test:issue59\nstderr simulado\nExit SQL59: ${codigo}\n`);
    }
});

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
