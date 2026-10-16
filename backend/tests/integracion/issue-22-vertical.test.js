const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { crearBaseIssue22, iniciarServidorIssue22 } = require('../helpers/servidor-issue22');

const suite = process.env.ISSUE22_VERTICAL === '1' ? describe : describe.skip;
suite('Issue22 continua — PostgreSQL → Express → Chrome → IndexedDB → nueva instancia', () => {
    test('conservo la misma oferta histórica y rechazada durante edición, recarga, estado y reaparición', async () => {
        const nonce = randomUUID();
        const http = [];
        let completada = false;
        let servidor;
        let pool;
        let hijo;
        let salida;
        let plazo;
        try {
            pool = await crearBaseIssue22(process.env.ISSUE22_TEST_DSN);
            jest.resetModules();
            // Inyecto un pool PostgreSQL REAL; no simulo consultas ni respuestas del modelo.
            jest.doMock('../../src/config/base-datos', () => pool);
            jest.doMock('../../src/config/firebase-admin', () => ({ verifyIdToken: async token => {
                if (token !== nonce) throw new Error('Token sintético inválido.');
                return { email: 'sintetico@example.invalid' };
            } }));
            process.env.EMAIL_AUTORIZADO = 'sintetico@example.invalid';
            const modelo = require('../../src/modelos/oferta');
            const fixture = { titulo: 'Seguimiento vertical 45 días', descripcion: 'Descripción sintética estable para conservar evaluación.',
                plataforma: 'linkedin', url: 'https://www.linkedin.com/jobs/view/99022999' };
            const oferta = await modelo.crearOferta(fixture);
            await pool.query("UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '45 days', fecha_ultima_extraccion = NULL WHERE id = $1", [oferta.id]);
            await modelo.actualizarPostulacion(oferta.id, 'cv_enviado');
            await modelo.actualizarEvaluacion(oferta.id, 'rechazada', 'Requiere Java; rechazo independiente', 10, null, null, 'firma-vertical');
            servidor = await iniciarServidorIssue22({ nonce,
                reaparecer: () => modelo.crearOferta({ ...fixture, empresa: 'Reaparición sintética', fecha_postulacion: null, nota_postulacion: 'El scraper no puede borrar datos manuales' }),
                observar: async () => ({ oferta: await modelo.obtenerOfertaPorId(oferta.id), http }),
                registrar: (metodo, ruta, estado) => http.push({ metodo, ruta, estado }),
                completar: () => { completada = true; },
            });
            hijo = spawn('npm', ['test', '--', '--watch=false', '--browsers=ChromeHeadless', '--include=src/app/paginas/dashboard/issue-22-vertical.spec.ts', `--define=ISSUE22_VERTICAL="${nonce}"`], {
                cwd: path.resolve(__dirname, '../../../frontend'), stdio: ['ignore', 'pipe', 'pipe'],
            });
            hijo.stdout.on('data', datos => process.stdout.write(datos));
            hijo.stderr.on('data', datos => process.stderr.write(datos));
            salida = new Promise((resolve, reject) => {
                hijo.once('error', reject);
                hijo.once('close', (codigo, signal) => resolve({ codigo, signal }));
            });
            plazo = setTimeout(() => hijo.kill('SIGTERM'), 150000);
            expect(await salida).toEqual({ codigo: 0, signal: null });
            expect(completada).toBe(true);
            expect(http.filter(fila => fila.ruta.startsWith('/api/ofertas')).every(fila => fila.estado === 200)).toBe(true);
            expect(http.some(fila => fila.metodo === 'PATCH' && fila.ruta.endsWith('/seguimiento'))).toBe(true);
            expect(http.some(fila => fila.metodo === 'PATCH' && fila.ruta.endsWith('/postulacion'))).toBe(true);
            expect(await modelo.obtenerOfertaPorId(oferta.id)).toMatchObject({ fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV; próxima entrevista', estado_postulacion: 'en_proceso', estado_evaluacion: 'rechazada', firma_criterios_evaluacion: 'firma-vertical' });
        } finally {
            clearTimeout(plazo);
            if (hijo && hijo.exitCode === null && hijo.signalCode === null) { hijo.kill('SIGTERM'); await salida; }
            if (servidor) await new Promise((resolve, reject) => { servidor.close(error => error ? reject(error) : resolve()); servidor.closeIdleConnections(); });
            if (pool) await pool.end();
        }
    }, 180000);
});
