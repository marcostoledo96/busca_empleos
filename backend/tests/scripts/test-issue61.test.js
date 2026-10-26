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
])('rechazo %s antes de importar pg o preparar fixtures', (clave, valor) => {
    const codigo = `const Module=require('module'); const cargar=Module._load;
        Module._load=function(nombre,...resto) {
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

test('ayuda del runner sin conexión', () => {
    const resultado = spawnSync(process.execPath, [cli, '--help'], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toBe('Uso: node scripts/test-issue61.js\nEjecuto SQL11 en PostgreSQL 15 sintético con las guardas de issue57, antes de crear fixtures.\n');
    expect(resultado.stderr).toBe('');
});
