const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');

const PUERTO_ISSUE22 = 43194;
const RUTA_CONTROL = '/__prueba_issue22';

async function crearBaseIssue22(dsn) {
    const url = new URL(dsn);
    if (process.env.NODE_ENV !== 'test' || url.hostname !== '127.0.0.1' || url.port !== '55423'
        || url.username !== 'issue22' || url.pathname !== '/busca_empleos_issue22_test' || url.search || url.hash) {
        throw new Error('Exijo el DSN descartable local autorizado para issue22.');
    }
    const esquema = `issue22_vertical_${randomUUID().replaceAll('-', '')}`;
    const verificacion = new Pool({ connectionString: dsn, ssl: false });
    try {
        const identidad = await verificacion.query('SELECT current_database() AS db, host(inet_server_addr()) AS host, inet_server_port() AS puerto');
        if (JSON.stringify(identidad.rows[0]) !== JSON.stringify({ db: 'busca_empleos_issue22_test', host: '127.0.0.1', puerto: 55423 })) {
            throw new Error('Identidad PostgreSQL inesperada.');
        }
        if ((await verificacion.query('SHOW server_encoding')).rows[0].server_encoding !== 'UTF8') throw new Error('Exijo UTF8.');
        await verificacion.query(`CREATE SCHEMA ${esquema}`);
        await verificacion.query(`CREATE TABLE ${esquema}.ofertas (LIKE public.ofertas INCLUDING ALL)`);
        await verificacion.query(`CREATE SEQUENCE ${esquema}.ofertas_id_seq`);
        await verificacion.query(`ALTER TABLE ${esquema}.ofertas ALTER COLUMN id SET DEFAULT nextval('${esquema}.ofertas_id_seq')`);
        await verificacion.query(`CREATE TABLE ${esquema}.preferencias (LIKE public.preferencias INCLUDING ALL)`);
        await verificacion.query(`INSERT INTO ${esquema}.preferencias (id) VALUES (1)`);
    } finally {
        await verificacion.end();
    }
    return new Pool({ connectionString: dsn, ssl: false, options: `-c search_path=${esquema}` });
}

// Sólo escucho loopback desde Jest opt-in; ningún control se monta en la aplicación productiva.
async function iniciarServidorIssue22({ nonce, reaparecer, observar, registrar, completar }) {
    const api = express();
    api.use(cors({ origin: 'http://localhost:9876' }));
    api.use(express.json());
    api.use((req, res, next) => {
        if (req.headers.authorization !== `Bearer ${nonce}`) return res.sendStatus(403);
        res.on('finish', () => registrar(req.method, req.path, res.statusCode));
        next();
    });
    api.get(`${RUTA_CONTROL}/listo`, (req, res) => res.json({ nonce }));
    api.get(`${RUTA_CONTROL}/observaciones`, async (req, res) => res.json(await observar()));
    api.post(`${RUTA_CONTROL}/reaparicion`, async (req, res) => {
        res.json({ exito: true, datos: await reaparecer() });
    });
    api.post(`${RUTA_CONTROL}/completado`, (req, res) => { completar(); res.json({ exito: true }); });
    api.use('/api', require('../../src/utils/middleware-auth').verificarAuth);
    api.use('/api/ofertas', require('../../src/rutas/ofertas'));
    api.get('/api/preferencias', require('../../src/controladores/controlador-preferencias').obtenerPreferencias);
    api.use(require('../../src/utils/middleware-errores').manejarErrores);
    return new Promise((resolve, reject) => {
        const servidor = api.listen(PUERTO_ISSUE22, '127.0.0.1', () => resolve(servidor));
        servidor.once('error', reject);
    });
}

module.exports = { crearBaseIssue22, iniciarServidorIssue22, PUERTO_ISSUE22 };
