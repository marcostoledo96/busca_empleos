const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const hash = valor => createHash('sha256').update(JSON.stringify(valor)).digest('hex');
const { preparar, fixture, instantanea, ejecutar, directorios } = require('../helpers/issue-61-entorno');
const ERROR = 'No pude verificar configuración, conexión o permisos de forma segura.';
const diagnostico = detalle => `PREFLIGHT: ERROR\n${detalle}\nNo recomiendo continuar con el despliegue.\n`;
let base;
let indice = 0;
const evidencia = [];

beforeAll(async () => { base = await preparar(); }, 30000);
afterAll(async () => {
    if (base) await base.pool.end();
    fs.writeFileSync(path.resolve(__dirname, '../../../docs/evidencias/issue-61/runtime/sql11.json'), JSON.stringify(evidencia, null, 4));
});

async function comprobar(esquema, compatible, cambios, carpetas, detalle = ERROR) {
    const antes = await instantanea(base.pool, esquema);
    const inicio = Date.now();
    const resultado = ejecutar(esquema, cambios, carpetas);
    const despues = await instantanea(base.pool, esquema);
    expect(despues).toEqual(antes);
    expect(resultado.error).toBeUndefined();
    expect(resultado.signal).toBeNull();
    expect(resultado.status).toBe(compatible ? 0 : 1);
    expect(resultado.stdout).toBe(compatible ? 'PREFLIGHT: OK\nMigraciones y contratos críticos verificados.\n' : '');
    expect(resultado.stderr).toBe(compatible ? '' : diagnostico(detalle));
    const conexiones = await base.pool.query(`SELECT count(*)::int AS cantidad FROM pg_stat_activity
        WHERE application_name = 'issue61-preflight'`);
    expect(conexiones.rows[0].cantidad).toBe(0);
    evidencia.push({ caso: expect.getState().currentTestName, salida: resultado.stdout, error: resultado.stderr,
        codigo: resultado.status, duracionMs: Date.now() - inicio, instantaneasIguales: true,
        snapshotAntes: hash(antes), snapshotDespues: hash(despues), conexionesRestantes: 0 });
}

test('SQL01: migraciones completas PASS y sin escrituras', async () => {
    await comprobar(await fixture(base, ++indice), true);
});
test.each([
    ['SQL02', 'ofertas.fecha_ultima_extraccion'],
    ['SQL03', 'ejecuciones_busqueda'],
    ['SQL04', 'configuracion_cron'],
    ['SQL05', 'ofertas.nota_postulacion'],
])('%s: falta contrato %s FAIL', async (caso, omitir) => {
    await comprobar(await fixture(base, ++indice, omitir), false, {}, undefined, `Falta: ${omitir}`);
});
test('SQL06: falta una migración del ledger FAIL; distingo ambos 024', async () => {
    const esquema = await fixture(base, ++indice);
    // Construyo un ledger incompleto sin borrar filas ni tocar migraciones históricas.
    await base.pool.query(`UPDATE ${esquema}.schema_migrations SET id = 'fixture-no-requerida.sql'
        WHERE id = '024-resultados-fuentes.sql'`);
    await comprobar(esquema, false, {}, undefined, 'Migraciones pendientes: 024-resultados-fuentes.sql');
});
test.each([false, null])('SQL07: éxito %s es inseguro FAIL', async exitoso => {
    const esquema = await fixture(base, ++indice);
    await base.pool.query(`UPDATE ${esquema}.schema_migrations SET exitoso = $1
        WHERE id = 'migracion-024-reparar-identidades-canonicas.sql'`, [exitoso]);
    await comprobar(esquema, false, {}, undefined, 'Migraciones fallidas o sin éxito confirmado: migracion-024-reparar-identidades-canonicas.sql');
});
test('SQL08: ledger ausente FAIL y no lo recreo', async () => {
    await comprobar(await fixture(base, ++indice, 'schema_migrations'), false, {}, undefined, 'Falta: schema_migrations');
});
test('SQL09: conexión rechazada FAIL sin secretos ni mutaciones', async () => {
    await comprobar(await fixture(base, ++indice), false, { PGPASSWORD: 'clave-incorrecta-privada-issue61' });
});
test('SQL10: permisos insuficientes FAIL sin elevar el rol', async () => {
    const esquema = await fixture(base, ++indice);
    const rol = `${base.prefijo}_lector`;
    await base.pool.query(`CREATE ROLE ${rol} LOGIN PASSWORD 'sintetica_issue61_lector' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
    await base.pool.query(`GRANT USAGE ON SCHEMA ${esquema} TO ${rol}`);
    await base.pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${esquema} TO ${rol}`);
    await base.pool.query(`REVOKE SELECT ON ${esquema}.ofertas FROM ${rol}`);
    await comprobar(esquema, false, { PGUSER: rol, PGPASSWORD: 'sintetica_issue61_lector' });
    await base.pool.query(`GRANT SELECT ON ${esquema}.ofertas TO ${rol}`);
    await comprobar(esquema, true, { PGUSER: rol, PGPASSWORD: 'sintetica_issue61_lector' });
});
test('SQL11: nueva migración requerida, primero FAIL y registrada PASS', async () => {
    const esquema = await fixture(base, ++indice);
    const carpeta = path.resolve(__dirname, '../../../docs/evidencias/issue-61/runtime/migraciones-futuras');
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(path.join(carpeta, '999-contrato-futuro-issue61.sql'), '-- Fixture sintético; no ejecuto SQL.\n');
    await comprobar(esquema, false, {}, [...directorios, carpeta], 'Migraciones pendientes: 999-contrato-futuro-issue61.sql');
    await base.pool.query(`INSERT INTO ${esquema}.schema_migrations (id, exitoso) VALUES ('999-contrato-futuro-issue61.sql', true)`);
    await comprobar(esquema, true, {}, [...directorios, carpeta]);
});
test('ledger ambiguo con éxito y fallo para el mismo basename FAIL', async () => {
    const esquema = await fixture(base, ++indice);
    await base.pool.query(`INSERT INTO ${esquema}.schema_migrations (id, exitoso) VALUES ('024-resultados-fuentes.sql', false)`);
    await comprobar(esquema, false, {}, undefined, 'Migraciones fallidas o sin éxito confirmado: 024-resultados-fuentes.sql');
});

test('diagnóstico acotado a 20 migraciones requeridas; nunca imprimo IDs privados desconocidos', async () => {
    const esquema = await fixture(base, ++indice);
    await base.pool.query(`UPDATE ${esquema}.schema_migrations SET id = $1 || id`, ['id privado desconocido\\n']);
    const requeridas = base.archivos.map(archivo => archivo.nombre).sort();
    const esperadas = requeridas.slice(0, 20).map(nombre => `Migraciones pendientes: ${nombre}`);
    if (requeridas.length > 20) esperadas.push('Hay más incompatibilidades; muestro las primeras 20.');
    await comprobar(esquema, false, {}, undefined, esperadas.join('\n'));
});

test.each(['schema_migrations.id', 'schema_migrations.aplicado_en', 'schema_migrations.exitoso',
    'ofertas.identidad_canonica', 'ofertas.estado_postulacion', 'ofertas.fecha_postulacion',
    'ofertas.firma_criterios_evaluacion', 'ofertas.explicacion_evaluacion',
    'preferencias.terminos_busqueda', 'cv_base.cv_base', 'cv_base.cv_base_actualizado_en',
    'ejecuciones_busqueda.resumen', 'evaluacion_lotes.estado', 'evaluaciones_cache.resultado'])('contrato adicional ausente: %s', async omitir => {
    await comprobar(await fixture(base, ++indice, omitir), false, {}, undefined, `Falta: ${omitir}`);
});
