const fs = require('node:fs');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const modelo = {
    match: true, porcentaje: 60, razon: 'MARCADOR_PRIVADO_DE_PRUEBA',
    explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
};
const escribir = fs.writeFileSync;
const timeout = AbortSignal.timeout;
if (process.env.REVISION_TIMEOUT_MOCK) AbortSignal.timeout = ms => timeout(ms === 90_000 ? 250 : ms);
fs.writeFileSync = (ruta, ...args) => escribir(
    ruta === `/var/tmp/busca-empleos-117-permiso-${process.getuid()}.json` ? process.env.MARCA_MOCK : ruta, ...args);
https.request = (_url, _opciones, callback) => {
    fs.appendFileSync(process.env.CONTADOR_MOCK, 'HTTPS\n', { mode: 0o600 });
    const solicitud = new EventEmitter();
    solicitud.destroy = () => {};
    solicitud.end = () => queueMicrotask(() => {
        const respuesta = new EventEmitter();
        respuesta.statusCode = 200;
        callback(respuesta);
        respuesta.emit('data', Buffer.from(JSON.stringify({
            choices: [{ finish_reason: 'stop', message: {
                content: JSON.stringify(modelo), reasoning_content: 'RAZONAMIENTO_NO_PERSISTIR',
            } }],
            usage: { prompt_tokens: 7000, completion_tokens: 1000 },
        })));
        respuesta.emit('end');
    });
    return solicitud;
};
