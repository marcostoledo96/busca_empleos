const { preparar, instantanea, ejecutar } = require('../helpers/issue-61-entorno');
const { crearProveedores, cerrarRed } = require('../helpers/issue-57-proveedores');
const { TOKEN, EMAIL } = require('../helpers/issue-57-entorno');
const { spawn } = require('child_process');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const evidencia = [];
async function comprobarInstantanea(antes, resultado) {
    const despues = await instantanea(base.pool, base.origen);
    expect(despues).toEqual(antes);
    const hash = valor => createHash('sha256').update(JSON.stringify(valor)).digest('hex');
    evidencia.push({ caso: expect.getState().currentTestName, ...resultado,
        snapshotAntes: hash(antes), snapshotDespues: hash(despues), sinEscrituras: true });
}
const proveedores = crearProveedores();
for (const nombre of ['dotenv', 'apify-client', 'node-cron', 'nodemailer']) {
    jest.doMock(nombre, () => proveedores.modulos[nombre]);
}
jest.doMock('../../src/config/firebase-admin', () => proveedores.modulos.firebase);
jest.setTimeout(30000);
let base, pool, servidor, app, restaurar, preflight, errores;
beforeEach(() => { errores = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => {
    const llamadas = errores.mock.calls;
    errores.mockRestore();
    if (expect.getState().currentTestName.includes('preferencias ausentes')) {
        expect(llamadas).toHaveLength(8);
        for (const llamada of llamadas) {
            expect(llamada[0]).toMatch(/^\[Error\] GET \/api\/(ofertas|ofertas\/sincronizacion|scraping\/previsualizacion|preferencias)(\?[^ ]+)?:$/);
            expect(llamada[1]).toBe('No pude leer las preferencias requeridas. No modifiqué datos.');
        }
    } else if (expect.getState().currentTestName.includes('esquema ilegible')) {
        expect(llamadas).toHaveLength(4);
        for (const llamada of llamadas) expect(llamada.join(' ')).not.toContain(TOKEN);
    } else expect(llamadas).toEqual([]);
});
const rutas = ['/api/salud', '/api/ofertas', '/api/ofertas/sincronizacion?limite=100',
    '/api/automatizacion/historial', '/api/scraping/previsualizacion', '/api/preferencias'];
function cli(token = TOKEN) {
    return new Promise(resolve => {
        const proceso = spawn(process.execPath, ['scripts/smoke-release.js'], { env: {
            ...process.env, RELEASE_URL: `http://127.0.0.1:${servidor.address().port}`, RELEASE_TOKEN: token,
        }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        proceso.stdout.on('data', datos => { stdout += datos; });
        proceso.stderr.on('data', datos => { stderr += datos; });
        proceso.on('close', status => resolve({ status, stdout, stderr }));
    });
}
beforeAll(async () => {
    base = await preparar();
    await base.pool.query(`CREATE SCHEMA ${base.prefijo}_vacio`);
    preflight = ejecutar(base.origen);
    if (preflight.status === 0) console.info(preflight.stdout.trim());
    await base.pool.query(`UPDATE preferencias SET nombre = 'Persona sintética', perfil_profesional = 'Perfil sintético',
        prompt_personalizado = NULL WHERE id = 1`);
    await base.pool.query(`INSERT INTO ofertas (titulo, empresa, url, plataforma, fecha_publicacion, identidad_canonica)
        VALUES ('contenido-privado', 'Empresa sintética', 'https://example.invalid/issue61', 'linkedin', NOW(), 'issue61-sintetica')`);
    await base.pool.query(`INSERT INTO ejecuciones_busqueda (tipo, estado, fin) VALUES ('ciclo_manual', 'completada', clock_timestamp())`);
    // La fixture aplica los archivos históricos reales, no una copia del contrato.
    Object.assign(process.env, { PGOPTIONS: `-c search_path=${base.origen} -c default_transaction_read_only=on`,
        EMAIL_AUTORIZADO: EMAIL, APIFY_TOKEN: 'issue57-sintetico', DEEPSEEK_API_KEY: 'issue57-sintetico',
        CURSOR_SINCRONIZACION_SECRETO: 'issue57-sintetico' });
    restaurar = cerrarRed(proveedores);
    pool = require('../../src/config/base-datos');
    app = require('../../src/app');
    servidor = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
});
afterAll(async () => {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    if (pool) await pool.end();
    if (base) await base.pool.end();
    restaurar?.();
    fs.writeFileSync(path.resolve(__dirname, '../../../docs/evidencias/issue-61/runtime/http.json'), JSON.stringify(evidencia, null, 4));
});
test('CLI real PASS sobre seis GET reales, preflight efectivo y snapshots intactos', async () => {
    const antes = await instantanea(base.pool, base.origen);
    expect(preflight.status).toBe(0);
    expect(preflight.stdout).toBe('PREFLIGHT: OK\nMigraciones y contratos críticos verificados.\n');
    const resultado = await cli();
    expect(resultado).toEqual(expect.objectContaining({ status: 0 }));
    expect(resultado.stderr).toBe('');
    for (const ruta of rutas) expect(resultado.stdout).toContain(`GET ${ruta} HTTP 200`);
    expect(resultado.stdout).toContain('SMOKE: OK');
    expect(resultado.stdout).not.toContain(TOKEN);
    expect(resultado.stdout).not.toContain('Marcos');
    expect(resultado.stdout).not.toContain('contenido-privado');
    const modelo = require('../../src/modelos/preferencia');
    expect(await modelo.obtenerPreferencias({ soloLectura: true })).toEqual(await modelo.obtenerPreferencias());
    expect((await pool.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only).toBe('on');
    await comprobarInstantanea(antes, resultado);
    expect(proveedores.llamadas).toEqual([]);
    expect(proveedores.inesperadas).toEqual([]);
});
test('sin sesión: cada GET privado protege con 401, smoke NO VERIFICADO, sin escrituras', async () => {
    const antes = await instantanea(base.pool, base.origen);
    for (const ruta of rutas.slice(1)) expect((await request(app).get(ruta)).status).toBe(401);
    const resultado = await cli('');
    expect(resultado.status).toBe(1);
    expect(resultado.stdout.match(/HTTP 401/g)).toHaveLength(5);
    expect(resultado.stdout).toContain('SMOKE: NO VERIFICADO');
    expect(resultado.stderr).toBe('');
    await comprobarInstantanea(antes, resultado);
});
test('esquema ilegible: SQL real produce 500/503, smoke falla sin cuerpos ni escrituras', async () => {
    const antes = await instantanea(base.pool, base.origen);
    const opciones = process.env.PGOPTIONS;
    // pg-pool descarta clientes tras errores SQL; las reconexiones también usan el esquema vacío.
    process.env.PGOPTIONS = `-c search_path=${base.prefijo}_vacio -c default_transaction_read_only=on`;
    await pool.query(`SET search_path TO ${base.prefijo}_vacio`);
    try {
        const resultado = await cli();
        expect(resultado.status).toBe(1);
        expect(resultado.stderr).toBe('');
        expect(resultado.stdout.match(/HTTP 500/g)).toHaveLength(3);
        expect(resultado.stdout.match(/HTTP 503/g)).toHaveLength(2);
        expect(resultado.stdout).toContain('SMOKE: FALLO');
        expect(resultado.stdout).not.toMatch(/relation|contenido-privado|issue57-token/);
        await comprobarInstantanea(antes, resultado);
        expect(proveedores.llamadas).toEqual([]);
        expect(proveedores.inesperadas).toEqual([]);
    } finally {
        process.env.PGOPTIONS = opciones;
        await pool.query(`SET search_path TO ${base.origen}`);
    }
});

test('preferencias ausentes: GET falla cerrado 503 sin INSERT; inicialización normal conserva su comportamiento', async () => {
    await base.pool.query('UPDATE preferencias SET id = 2 WHERE id = 1');
    const antes = await instantanea(base.pool, base.origen);
    for (const ruta of [rutas[1], rutas[2], rutas[4], rutas[5]]) {
        const respuesta = await request(app).get(ruta).set('Authorization', `Bearer ${TOKEN}`);
        expect(respuesta.status).toBe(503);
        expect(respuesta.body).toEqual({ exito: false, error: 'No pude leer las preferencias requeridas. No modifiqué datos.' });
    }
    const resultado = await cli();
    expect(resultado.status).toBe(1);
    expect(resultado.stdout.match(/HTTP 503/g)).toHaveLength(4);
    expect(resultado.stdout).not.toContain('SMOKE: OK');
    await comprobarInstantanea(antes, resultado);
    const modelo = require('../../src/modelos/preferencia');
    // Sólo el fixture habilita escritura para probar la inicialización anterior.
    await pool.query('SET default_transaction_read_only = off');
    const creada = await modelo.obtenerPreferencias();
    expect(creada.id).toBe(1);
    expect((await modelo.obtenerPreferencias({ soloLectura: true })).id).toBe(1);
    await pool.query('SET default_transaction_read_only = on');
    expect(proveedores.llamadas).toEqual([]);
    expect(proveedores.inesperadas).toEqual([]);
});
