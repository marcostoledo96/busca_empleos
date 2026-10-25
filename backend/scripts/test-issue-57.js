// Ejecuto este archivo aparte; nunca lo importo desde la aplicación productiva.
const path = require('path');
const { spawnSync } = require('child_process');
const { validarEntorno, prepararBase, TOKEN } = require('../tests/helpers/issue-57-entorno');

async function iniciarApi(puerto = 3057) {
    validarEntorno();
    const { crearProveedores, cerrarRed, instalarModulos } = require('../tests/helpers/issue-57-proveedores');
    const { prepararControles } = require('../tests/helpers/issue-57-runtime');
    const proveedores = crearProveedores();
    const restaurarModulos = instalarModulos(proveedores);
    const restaurarRed = cerrarRed(proveedores);
    let pool;
    let servidor;
    try {
        const base = await prepararBase();
        pool = base.pool;
        const controles = await prepararControles(pool, base.esquema);
        const express = require('express');
        const contenedor = express();
        const automatizacion = require('../src/servicios/servicio-automatizacion');
        const { verificarAuth } = require('../src/utils/middleware-auth');
        contenedor.use('/__issue57', verificarAuth, express.json({ limit: '4kb' }));
        contenedor.get('/__issue57/evidencia', async (req, res) => {
            res.json({ ...await controles.evidencia(), llamadas: proveedores.llamadas, inesperadas: proveedores.inesperadas });
        });
        contenedor.post('/__issue57/control', async (req, res) => {
            if (automatizacion.cicloEnProgreso()) return res.status(409).json({ error: 'Espero el estado terminal antes de cambiar fixtures.' });
            const { escenario = 'correcto', fallo = 'ninguno', reset = false } = req.body;
            // Valido antes de modificar PostgreSQL, incluso ante controles de prueba inválidos.
            if (typeof reset !== 'boolean' || Object.keys(req.body).some(clave => !['escenario', 'fallo', 'reset'].includes(clave))) {
                return res.status(400).json({ error: 'Control sintético inválido.' });
            }
            proveedores.cambiar(escenario);
            await controles.fallo(fallo);
            if (reset) {
                await controles.reset();
                proveedores.llamadas.length = 0;
            }
            res.json({ exito: true });
        });
        contenedor.use(require('../src/app'));
        contenedor.use((error, req, res, next) => res.status(400).json({ exito: false, error: error.message }));
        servidor = await new Promise((resolve, reject) => {
            const escucha = contenedor.listen(puerto, '127.0.0.1', () => resolve(escucha));
            escucha.once('error', reject);
        });
        const cerrar = async () => {
            proveedores.liberar();
            proveedores.liberarEvaluacion();
            await new Promise(resolve => servidor.close(resolve));
            await pool.end();
            restaurarRed();
            restaurarModulos();
            if (proveedores.inesperadas.length) throw new Error('Detecté operaciones externas inesperadas.');
        };
        return { servidor, cerrar, proveedores };
    } catch (error) {
        if (servidor) await new Promise(resolve => servidor.close(resolve));
        if (pool) await pool.end();
        restaurarRed();
        restaurarModulos();
        throw error;
    }
}

async function main() {
    const opcion = process.argv[2];
    if (opcion === '--help') {
        console.log('Uso: node scripts/test-issue-57.js [--api | --comprobar-api]\nSin opciones ejecuto Jest focal. --api escucha en 127.0.0.1:3057. --comprobar-api verifica el servidor efímero. Exijo las variables sintéticas documentadas.');
        return;
    }
    validarEntorno();
    if (opcion === '--api' || opcion === '--comprobar-api') {
        const api = await iniciarApi(opcion === '--api' ? 3057 : 0);
        if (opcion === '--comprobar-api') {
            const assert = require('assert/strict');
            const request = require('supertest');
            try {
                assert.equal(api.servidor.address().address, '127.0.0.1');
                assert.equal((await request(api.servidor).get('/__issue57/evidencia')).status, 401);
                const autorizada = ruta => request(api.servidor).get(ruta).set('Authorization', `Bearer ${TOKEN}`);
                const evidencia = await autorizada('/__issue57/evidencia');
                assert.equal(evidencia.status, 200);
                assert.equal(evidencia.body.esquema.base, 'busca_empleos_issue57_test');
                const busqueda = await request(api.servidor).post('/api/scraping/linkedin')
                    .set('Authorization', `Bearer ${TOKEN}`).send({ maxResultados: 2 });
                assert.equal(busqueda.status, 200);
                assert.equal((await autorizada('/__issue57/evidencia')).body.ofertas.length, 2);
                assert.deepEqual(api.proveedores.inesperadas, []);
                console.log('API sintética: loopback, auth, búsqueda real y SQL verificados.');
            } finally { await api.cerrar(); }
        } else {
            console.log('API sintética lista en http://127.0.0.1:3057');
            const cerrar = () => api.cerrar().catch(error => { console.error(error.message); process.exitCode = 1; });
            process.once('SIGTERM', cerrar);
            process.once('SIGINT', cerrar);
        }
        return;
    }
    if (opcion) throw new Error('Opción desconocida; consulto --help.');
    const resultado = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand',
        '--runTestsByPath', 'tests/integracion/issue-57-seguridad.test.js', 'tests/integracion/issue-57-backend.test.js'],
    { cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'inherit' });
    if (resultado.error) throw resultado.error;
    process.exitCode = resultado.status ?? 1;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { iniciarApi };
