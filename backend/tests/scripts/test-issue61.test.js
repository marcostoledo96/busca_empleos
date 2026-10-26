const path = require('path');
const { spawnSync } = require('child_process');
const cli = path.resolve(__dirname, '../../scripts/test-issue61.js');
const entornoSeguro = {
    PATH: process.env.PATH, NODE_ENV: 'test', DB_TEST_SINTETICA: 'true', PGHOST: '127.0.0.1',
    PGPORT: '55457', PGDATABASE: 'busca_empleos_issue57_test', PGUSER: 'busca_empleos_test',
    PGPASSWORD: 'sintetica_issue57', PGSSLMODE: 'disable',
};

test.each([
    ['DATABASE_URL', 'postgres://privado:secreto@produccion.invalid/real'],
    ['PGHOST', 'produccion.invalid'], ['PGPORT', '5432'], ['PGDATABASE', 'real'],
    ['NODE_ENV', 'production'], ['DB_TEST_SINTETICA', 'false'], ['PGUSER', 'otro'],
    ['PGPASSWORD', 'otra'], ['PGSSLMODE', 'require'], ['PGSERVICE', 'privado'],
    ['PGSERVICEFILE', 'privado'], ['PGPASSFILE', 'privado'], ['PGOPTIONS', '-c search_path=public'],
    ['APIFY_TOKEN', 'privado'], ['DEEPSEEK_API_KEY', 'privado'], ['SMTP_PASS', 'privado'],
    ['RELEASE_URL', 'https://produccion.invalid'], ['RELEASE_TOKEN', 'privado'],
])('rechazo %s antes de importar pg o preparar fixtures', (clave, valor) => {
    const codigo = `const Module=require('module'); const cargar=Module._load;
        Module._load=function(nombre,...resto) {
            if (nombre==='child_process') return { spawnSync() { process.stdout.write('SPAWN PROHIBIDO'); process.exit(9); } };
            if (nombre==='pg' || nombre.includes('jest/bin') || nombre.includes('issue-61-entorno')) {
                process.stdout.write('CARGA PROHIBIDA');
                process.exit(9);
            }
            return cargar.call(this,nombre,...resto);
        };
        try { require(${JSON.stringify(cli)}).main([]); }
        catch { process.stderr.write('Entorno issue61 no permitido; no preparo fixtures.\\n'); process.exitCode=1; }`;
    const resultado = spawnSync(process.execPath, ['-e', codigo], {
        env: { ...entornoSeguro, [clave]: valor }, encoding: 'utf8', timeout: 5000,
    });
    expect(resultado.status).toBe(1);
    expect(resultado.stdout).toBe('');
    expect(resultado.stderr).toBe('Entorno issue61 no permitido; no preparo fixtures.\n');
});

test('conservo un solo job PG15 existente y aíslo SQL/HTTP del Jest común', () => {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const workflow = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../../.github/workflows/ci.yml'), 'utf8'));
    expect(Object.keys(workflow.jobs)).toEqual(['test-unit', 'test-db', 'integracion-issue57', 'frontend']);
    const job = workflow.jobs['integracion-issue57'];
    expect(Object.keys(job.services)).toEqual(['postgres']);
    expect(job.services.postgres.image).toBe('postgres:15-alpine');
    expect(job.services.postgres.ports).toEqual(['55457:5432']);
    expect(job.strategy).toBeUndefined();
    const paso = job.steps.find(item => item.name === 'Preflight efectivo y smoke read-only issue61');
    expect(paso.run).toContain('set -o pipefail');
    expect(paso.run).toContain('env -i PATH="$PATH"');
    expect(paso.run).toContain('npm --prefix backend run test:issue61');
    expect(paso.run).not.toContain('DATABASE_URL');
    const paquete = require('../../package.json');
    for (const script of ['test', 'test:integracion']) {
        const patron = paquete.scripts[script].match(/testPathIgnorePatterns="([^"]+)"/)[1];
        for (const caso of ['esquema', 'http']) expect(new RegExp(patron).test(`tests/integracion/issue-61-${caso}.test.js`)).toBe(true);
    }
});

test('ayuda del runner sin conexión', () => {
    const resultado = spawnSync(process.execPath, [cli, '--help'], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toBe('Uso: node scripts/test-issue61.js\nEjecuto preflight SQL11 y smoke HTTP real en PostgreSQL 15 sintético con las guardas de issue57, antes de crear fixtures.\n');
    expect(resultado.stderr).toBe('');
});
