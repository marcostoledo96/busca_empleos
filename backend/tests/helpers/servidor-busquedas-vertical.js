const express = require('express');
const cors = require('cors');
const { createServer } = require('node:http');

const PUERTO_VERTICAL = 43193;
const RUTA_CONTROL = '/__prueba_busquedas_vertical';

// Sólo monto este control sobre loopback desde el harness opt-in, nunca en app.js.
async function iniciarServidorVertical(app, nonce, controles) {
    const contenedor = express();
    contenedor.use(RUTA_CONTROL, cors({ origin: 'http://localhost:9876' }), express.json(), (req, res, next) => {
        if (req.headers.authorization !== `Bearer ${nonce}`) return res.sendStatus(403);
        next();
    });
    contenedor.get(`${RUTA_CONTROL}/listo`, (req, res) => res.json({ nonce }));
    contenedor.post(`${RUTA_CONTROL}/reiniciar`, async (req, res, next) => {
        try { await controles.reiniciar(); res.json({ exito: true }); } catch (error) { next(error); }
    });
    contenedor.post(`${RUTA_CONTROL}/liberar`, (req, res) => { controles.liberar(); res.json({ exito: true }); });
    contenedor.get(`${RUTA_CONTROL}/observaciones`, (req, res) => res.json(controles.observar()));
    contenedor.post(`${RUTA_CONTROL}/completado`, (req, res) => { controles.completar(req.body.flujo); res.json({ exito: true }); });
    contenedor.use((req, res, next) => {
        const ruta = req.path;
        res.on('finish', () => controles.registrar(req.method, ruta, res.statusCode));
        next();
    });
    contenedor.use(app);
    const servidor = createServer(contenedor);
    await new Promise((resolve, reject) => {
        servidor.once('error', reject); // EADDRINUSE falla cerrado; no mato al dueño del puerto.
        servidor.listen(PUERTO_VERTICAL, '127.0.0.1', resolve);
    });
    return servidor;
}

module.exports = { iniciarServidorVertical, PUERTO_VERTICAL, RUTA_CONTROL };
