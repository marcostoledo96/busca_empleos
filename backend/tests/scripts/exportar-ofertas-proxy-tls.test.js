const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const tls = require('tls');
const { EventEmitter } = require('events');
const { spawn, spawnSync } = require('child_process');
const pg = require('pg');
const pki = require('../fixtures/exportador-proxy-tls');
const { exportarOfertas, CAMPOS, SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_COLUMNAS, SQL_OFERTAS } = require('./exportar-ofertas');
const { obtenerCasos, verificarSalida } = require('./issue-69-postgres-prueba');
const RECHAZO = 'Exportación rechazada: autorización o destino inválido.';
const ERROR = 'No pude completar la exportación. No comparta una salida sin resumen completo.';
const ruta = path.join(__dirname, 'exportar-ofertas.js');
let directorio;
let opciones;
const conectarReal = pg.Client.prototype.connect;

beforeEach(() => {
    directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'TESTONLY-exportador-tls-'));
    fs.writeFileSync(path.join(directorio, 'ca.pem'), pki.ca);
    // Nunca intento el backend documental si la implementación todavía ignora el proxy.
    jest.spyOn(pg.Client.prototype, 'connect').mockImplementation(function () {
        if (this.connectionParameters.host !== 'localhost') return Promise.reject(new Error('TESTONLY dial fuera de loopback'));
        return conectarReal.call(this);
    });
    opciones = { autorizar: true, servidor: '192.0.2.10', puerto: 5432, base: 'sintetica', usuario: 'lector',
        salida: 'prueba', sintetico: true, 'proxy-servidor': 'localhost', 'proxy-puerto': 12345,
        'ca-tls': path.join(directorio, 'ca.pem'), 'identidad-tls': 'backend-auditoria.test' };
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(directorio, { recursive: true, force: true }); });

// Solo SSLRequest, Startup, AuthenticationOk y ReadyForQuery; nunca interpreto ni ejecuto SQL.
async function abrirProxy(cert = pki.valido, ssl = true) {
    const sockets = new Set();
    const evidencia = { solicitudes: 0, arranques: [], sni: [], inesperados: [] };
    const contexto = tls.createSecureContext({ key: pki.clave, cert });
    const servidor = net.createServer(socket => {
        sockets.add(socket);
        socket.on('error', () => {});
        socket.on('close', () => sockets.delete(socket));
        let solicitud = Buffer.alloc(0);
        const recibir = bloque => {
            solicitud = Buffer.concat([solicitud, bloque]);
            if (solicitud.length < 8) return;
            socket.removeListener('data', recibir);
            evidencia.solicitudes++;
            if (!solicitud.equals(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]))) {
                evidencia.inesperados.push(solicitud); socket.destroy(); return;
            }
            if (!ssl) { socket.end('N'); return; }
            socket.write('S');
            const seguro = new tls.TLSSocket(socket, { isServer: true, secureContext: contexto });
            sockets.add(seguro);
            seguro.on('error', () => {});
            seguro.on('close', () => sockets.delete(seguro));
            seguro.on('secure', () => evidencia.sni.push(seguro.servername));
            let arranque = Buffer.alloc(0);
            let listo = false;
            seguro.on('data', datos => {
                if (listo) { seguro.end(); return; }
                arranque = Buffer.concat([arranque, datos]);
                if (arranque.length < 4 || arranque.length < arranque.readInt32BE(0)) return;
                evidencia.arranques.push(arranque);
                listo = true;
                seguro.write(Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73]));
            });
        };
        socket.on('data', recibir);
    });
    await new Promise(resolver => servidor.listen(0, 'localhost', resolver));
    opciones['proxy-puerto'] = servidor.address().port;
    return { evidencia, cerrar: async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolver => servidor.close(resolver));
    } };
}

function simularConsultas(cambios = {}) {
    const datos = obtenerCasos();
    const consultas = [];
    const consulta = jest.spyOn(pg.Client.prototype, 'query').mockImplementation(function (sql) {
        consultas.push(typeof sql === 'string' ? sql : sql.text);
        if (sql === SQL_IDENTIDAD) return Promise.resolve({ rows: [{ base: opciones.base, usuario: opciones.usuario,
            servidor: opciones.servidor, puerto: opciones.puerto, solo_lectura: 'on', transaccion_solo_lectura: 'on', ...cambios }] });
        if (sql === SQL_PREFERENCIAS) return Promise.resolve({ rows: [{ preferencias: datos.preferencias }] });
        if (sql === SQL_COLUMNAS) return Promise.resolve({ rows: CAMPOS.map(columna => ({ columna })) });
        const emisor = new EventEmitter();
        process.nextTick(() => {
            for (const oferta of datos.ofertas) emisor.emit('row', { total_sql: '12', oferta });
            emisor.emit('end');
        });
        return emisor;
    });
    return { datos, consultas, consulta };
}

const dependencias = () => ({ directorioSalida: path.join(directorio, 'salida') });
const sinSalida = () => expect(fs.existsSync(path.join(directorio, 'salida'))).toBe(false);

test('autentico identidad distinta del DNS de dial pese a SNI sobrescrito por pg; conservo formato, guardas y permisos', async () => {
    const proxy = await abrirProxy();
    const { datos, consultas } = simularConsultas();
    const comprobar = jest.spyOn(tls, 'checkServerIdentity');
    const conectar = jest.spyOn(pg.Client.prototype, 'connect');
    try {
        const resumen = await exportarOfertas({ ...opciones, ssl: false, options: '-c default_transaction_read_only=off',
            connectionString: 'postgres://NO_USAR', host: 'NO_USAR', port: 1 }, dependencias());
        expect(resumen.completo).toBe(true);
        expect(verificarSalida(path.join(directorio, 'salida/prueba'), datos.ofertas).escenarios).toBe(12);
        expect(consultas).toEqual([SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_COLUMNAS, SQL_OFERTAS]);
        expect(proxy.evidencia.sni).toEqual(['localhost']);
        expect(proxy.evidencia.arranques).toHaveLength(1);
        expect(proxy.evidencia.arranques[0].toString()).toContain('default_transaction_read_only=on');
        expect(proxy.evidencia.arranques[0].toString()).toContain('statement_timeout=120000 -c lock_timeout=5000');
        expect(proxy.evidencia.inesperados).toEqual([]);
        expect(comprobar).toHaveBeenCalledWith('backend-auditoria.test', expect.any(Object));
        const cliente = conectar.mock.instances[0];
        expect(cliente.connectionParameters.ssl.rejectUnauthorized).toBe(true);
        expect(cliente.connectionParameters.ssl.ca.toString()).toBe(pki.ca);
        expect(cliente._connectionTimeoutMillis).toBe(10000);
        const salida = path.join(directorio, 'salida/prueba');
        expect(fs.statSync(salida).mode & 0o777).toBe(0o700);
        for (const nombre of fs.readdirSync(salida)) expect(fs.statSync(path.join(salida, nombre)).mode & 0o777).toBe(0o600);
    } finally { await proxy.cerrar(); }
});

test.each(['CA incorrecta', 'vencido', 'identidad equivocada', 'sin TLS'])('%s bloquea Startup, autenticación, consultas y salida', async caso => {
    const proxy = await abrirProxy(caso === 'vencido' ? pki.vencido : pki.valido, caso !== 'sin TLS');
    const { consultas } = simularConsultas();
    const comprobar = jest.spyOn(tls, 'checkServerIdentity');
    const conectar = jest.spyOn(pg.Client.prototype, 'connect');
    let hijo;
    if (caso === 'CA incorrecta') fs.writeFileSync(opciones['ca-tls'], pki.otraCa);
    if (caso === 'identidad equivocada') opciones['identidad-tls'] = 'localhost';
    try {
        await expect(exportarOfertas(opciones, dependencias())).rejects.toThrow(new Error(ERROR));
        expect(proxy.evidencia.solicitudes).toBe(1);
        expect(proxy.evidencia.arranques).toEqual([]);
        expect(consultas).toEqual([]);
        if (caso === 'vencido') await expect(conectar.mock.results[0].value).rejects.toMatchObject({ code: 'CERT_HAS_EXPIRED' });
        if (caso === 'CA incorrecta') expect(comprobar).not.toHaveBeenCalled();
        if (caso === 'identidad equivocada') {
            expect(comprobar.mock.results[0].value.code).toBe('ERR_TLS_CERT_ALTNAME_INVALID');
        }
        sinSalida();
        const argumentos = ['--autorizar', '--sintetico'];
        for (const [campo, valor] of Object.entries(opciones)) {
            if (!['autorizar', 'sintetico'].includes(campo)) argumentos.push(`--${campo}`, String(valor));
        }
        const resultado = await new Promise((resolver, rechazar) => {
            hijo = spawn(process.execPath, [ruta, ...argumentos], { env: { PATH: process.env.PATH, NODE_ENV: 'test' } });
            let stdout = '';
            let stderr = '';
            hijo.stdout.on('data', bloque => { stdout += bloque; });
            hijo.stderr.on('data', bloque => { stderr += bloque; });
            hijo.on('error', rechazar);
            hijo.on('close', status => resolver({ status, stdout, stderr }));
        });
        expect(resultado).toEqual({ status: 1, stdout: '', stderr: `${ERROR}\n` });
        expect(proxy.evidencia.arranques).toEqual([]);
        expect(proxy.evidencia.solicitudes).toBe(2);
        sinSalida();
    } finally {
        if (hijo && hijo.exitCode === null) hijo.kill();
        await proxy.cerrar();
    }
});

test.each(['base', 'usuario', 'servidor', 'puerto', 'solo_lectura', 'transaccion_solo_lectura'])
('TLS válido no sustituye guarda SQL %s; no leo preferencias ni ofertas', async campo => {
    const proxy = await abrirProxy();
    const { consultas } = simularConsultas({ [campo]: 'incorrecto' });
    try {
        await expect(exportarOfertas(opciones, dependencias())).rejects.toThrow(new Error(RECHAZO));
        expect(proxy.evidencia.arranques).toHaveLength(1);
        expect(consultas).toEqual([SQL_IDENTIDAD]);
        sinSalida();
    } finally { await proxy.cerrar(); }
});

const invalidas = [
    ...['proxy-servidor', 'proxy-puerto', 'ca-tls', 'identidad-tls'].map(campo => ({ [campo]: undefined })),
    { servidor: '/var/run/postgresql' }, { servidor: 'backend.test' },
    { 'proxy-servidor': '' }, { 'proxy-servidor': ' localhost' }, { 'proxy-servidor': '/socket' },
    { 'proxy-servidor': 'postgres://localhost' }, { 'proxy-servidor': 'localhost,otro' },
    { 'proxy-puerto': 0 }, { 'proxy-puerto': 65536 }, { 'proxy-puerto': 1.5 }, { 'proxy-puerto': '5432' },
    { 'identidad-tls': '' }, { 'identidad-tls': '*.test' }, { 'identidad-tls': 'https://backend.test' },
    { 'identidad-tls': 'backend.test\n' }, { 'ca-tls': '' }, { 'ca-tls': '/TESTONLY-no-existe/ca.pem' },
];
test.each(invalidas)('rechazo configuración proxy parcial/insegura antes del cliente: %j', async cambio => {
    const crearCliente = jest.fn();
    const conectar = jest.spyOn(pg.Client.prototype, 'connect');
    await expect(exportarOfertas({ ...opciones, ...cambio }, { ...dependencias(), crearCliente })).rejects.toThrow(new Error(RECHAZO));
    expect(crearCliente).not.toHaveBeenCalled();
    expect(conectar).not.toHaveBeenCalled();
    sinSalida();
});

test('CA ilegible o no certificado se rechaza antes de crear cliente/conectar', async () => {
    const crearCliente = jest.fn();
    fs.writeFileSync(opciones['ca-tls'], 'TESTONLY NO ES UN CERTIFICADO');
    await expect(exportarOfertas(opciones, { ...dependencias(), crearCliente })).rejects.toThrow(new Error(RECHAZO));
    expect(crearCliente).not.toHaveBeenCalled();
    sinSalida();
});

test('CLI documenta flags y rechaza parciales/valores inseguros sin imprimirlos', () => {
    const ayuda = spawnSync(process.execPath, [ruta, '--help'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(ayuda.status).toBe(0);
    expect(ayuda.stderr).toBe('');
    for (const flag of ['proxy-servidor', 'proxy-puerto', 'ca-tls', 'identidad-tls']) expect(ayuda.stdout).toContain(`--${flag}`);
    for (const extra of [['--proxy-servidor', 'NO_IMPRIMIR'], ['--proxy-puerto', 'NaN'], ['--ca-tls'], ['--identidad-tls', '*.test']]) {
        const resultado = spawnSync(process.execPath, [ruta, '--autorizar', '--servidor', '192.0.2.10', '--puerto', '5432',
            '--base', 'sintetica', '--usuario', 'lector', '--salida', 'TESTONLY', ...extra], { encoding: 'utf8', env: { PATH: process.env.PATH } });
        expect(resultado.status).toBe(1);
        expect(resultado.stdout).toBe('');
        expect(resultado.stderr).toBe(`${RECHAZO}\n`);
    }
    sinSalida();
});
