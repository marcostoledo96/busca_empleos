// Precargo este guard antes de Jest; impido leer .env y abrir conexiones externas aun fuera de sus mocks.
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const leer = fs.readFileSync;
fs.readFileSync = function (archivo, ...opciones) {
    if (/(^|[/\\])\.env(?:\.|$)/.test(String(archivo))) {
        throw Object.assign(new Error('Bloqueé la lectura de variables privadas en issue59.'), { code: 'ENOENT' });
    }
    return leer.call(this, archivo, ...opciones);
};
const conectar = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...argumentos) {
    const entrada = Array.isArray(argumentos[0]) ? argumentos[0] : argumentos;
    const opciones = typeof entrada[0] === 'object' ? entrada[0] : { port: entrada[0], host: typeof entrada[1] === 'string' ? entrada[1] : 'localhost' };
    const host = opciones.host || 'localhost';
    if (opciones.path || !['127.0.0.1', 'localhost', '::1'].includes(host)
        || [5432, 5433, 6379].includes(Number(opciones.port))) {
        throw new Error('Bloqueé un destino de red no autorizado en issue59.');
    }
    return conectar.apply(this, argumentos);
};
// Mantengo los caches generados por los runners dentro de la superficie autorizada.
process.env.TMPDIR = path.resolve(__dirname, '../../../docs/evidencias/issue-59/runtime');
process.env.npm_config_cache = process.env.TMPDIR;
fs.mkdirSync(process.env.TMPDIR, { recursive: true });
