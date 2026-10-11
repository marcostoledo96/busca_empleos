jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda({ vertical: true }));
jest.mock('apify-client', () => ({ ApifyClient: jest.fn(() => ({ actor: jest.fn(), dataset: jest.fn() })) }));
jest.mock('node-cron', () => ({ validate: jest.fn(() => true), schedule: jest.fn(() => { throw new Error('No autorizo tareas cron'); }) }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => { throw new Error('No autorizo SMTP'); }) }));
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => req.headers.authorization === `Bearer ${process.env.NONCE_VERTICAL}` ? next() : res.sendStatus(401),
}));

const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { iniciarServidorVertical } = require('../helpers/servidor-busquedas-vertical');

test('el adaptador reutiliza caché dentro del flujo y reinicia todos los datos entre escenarios', async () => {
    const pool = require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda({ vertical: true });
    const identidad = ['oferta-sintetica', 'perfil-sintetico', 'modelo-sintetico'];
    const consultarCache = () => pool.query('SELECT resultado FROM evaluaciones_cache', identidad);
    await pool.query('INSERT INTO evaluaciones_cache', [...identidad, JSON.stringify({ escenario: 'primero' })]);
    for (let intento = 0; intento < 2; intento++) {
        expect((await consultarCache()).rows).toEqual([{ resultado: { escenario: 'primero' } }]);
    }
    pool.ofertas.push({ id: 1 });
    pool.lotes.push({ id: 1 });
    pool.obtenerPreferencias().terminos_busqueda = ['QA'];
    await expect(pool.query('consulta sintética desconocida')).rejects.toThrow(/no contemplada/);
    pool.reiniciar();
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.ofertas).toEqual([]);
    expect(pool.lotes).toEqual([]);
    expect(pool.consultasNoContempladas).toEqual([]);
    expect(pool.obtenerPreferencias()).toEqual({ id: 1, terminos_busqueda: ['anterior'], zonas_preferidas: [] });
    expect((await consultarCache()).rows).toEqual([]);
    await pool.query('INSERT INTO evaluaciones_cache', [...identidad, JSON.stringify({ escenario: 'segundo' })]);
    expect((await consultarCache()).rows).toEqual([{ resultado: { escenario: 'segundo' } }]);
});

// La suite habitual informa SKIPPED y no importa app ni levanta Chrome/puertos.
const suite = process.env.BUSQUEDAS_VERTICAL === '1' ? describe : describe.skip;
suite('Puente opt-in Angular → Express → persistencia → dashboard', () => {
    test('ejecuto individual y ciclo en Chrome con fuentes externas sintéticas', async () => {
        const variables = ['NONCE_VERTICAL', 'CORS_ORIGEN', 'APIFY_TOKEN', 'DEEPSEEK_API_KEY', 'JOOBLE_API_KEY', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'SMTP_HOST'];
        const originales = Object.fromEntries(variables.map(nombre => [nombre, process.env[nombre]]));
        const fetchOriginal = global.fetch;
        let servidor;
        let cicloEspia;
        let hijo;
        let salida;
        let salir;
        let liberar = () => {};
        const nonce = randomUUID();
        const completados = [];
        const observaciones = { actores: [], requestsExternas: [], redNoContemplada: [], deepseek: [], http: [] };
        try {
            process.env.NONCE_VERTICAL = nonce;
            process.env.CORS_ORIGEN = 'http://localhost:9876';
            for (const nombre of ['APIFY_TOKEN', 'DEEPSEEK_API_KEY', 'JOOBLE_API_KEY', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY']) process.env[nombre] = 'sintetico';
            delete process.env.SMTP_HOST;
            const pool = require('../../src/config/base-datos');
            const { clienteApify, ACTORES } = require('../../src/config/apify');
            const automatizacion = require('../../src/servicios/servicio-automatizacion');
            cicloEspia = jest.spyOn(automatizacion, 'ejecutarCicloCompleto'); // Sólo observo; conservo la implementación.
            const modeloOferta = require('../../src/modelos/oferta');
            const descripcion = 'Buscamos una persona para nuestro equipo de soporte. Las tareas son resolver los problemas de los usuarios y dar asistencia. Se requiere conocimiento de sistemas y ganas de aprender.';
            clienteApify.actor.mockImplementation(actor => ({ call: jest.fn(async entrada => {
                observaciones.actores.push({ actor, entrada });
                if (!Object.values(ACTORES).includes(actor) || [ACTORES.GOOGLE_JOBS, ACTORES.COMPUTRABAJO].includes(actor)) throw new Error(`Actor no permitido: ${actor}`);
                if (actor === ACTORES.LINKEDIN) await new Promise(resolve => { liberar = resolve; });
                return { defaultDatasetId: actor };
            }) }));
            clienteApify.dataset.mockImplementation(actor => ({ listItems: async () => ({ items: actor === ACTORES.LINKEDIN ? [
                { jobTitle: 'Soporte vertical nuevo', companyName: 'Empresa sintética', location: 'CABA', jobDescription: descripcion, jobUrl: 'https://linkedin.test/vertical', workRemoteAllowed: true },
                { jobTitle: 'English synthetic', jobDescription: 'We are looking for a software engineer to join our team. You will work with our customers and you should have experience with the tools. The ideal candidate has strong skills and will be responsible for the development of our products.', jobUrl: 'https://linkedin.test/english' },
            ] : [] }) }));
            global.fetch = jest.fn(async (url, opciones) => {
                const destino = String(url);
                observaciones.requestsExternas.push(destino);
                if (destino === 'https://api.deepseek.com/v1/chat/completions') {
                    observaciones.deepseek.push(JSON.parse(opciones.body));
                    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ match: true, porcentaje: 85, razon: 'Soporte sintético compatible.' }) } }] }) };
                }
                if (destino.startsWith('https://www.computrabajo.com.ar/trabajo-de-')) return { ok: true, text: async () => '<main>Sin ofertas sintéticas</main>' };
                if (destino.startsWith('https://jooble.org/api/')) return { ok: true, json: async () => ({ totalCount: 0, jobs: [] }) };
                if (destino.startsWith('https://remotive.com/api/remote-jobs')) return { ok: true, json: async () => ({ jobs: [] }) };
                if (destino.startsWith('https://remoteok.com/api')) return { ok: true, json: async () => [{ legal: true }] };
                if (destino.startsWith('https://api.adzuna.com/v1/api/jobs/es/search/')) return { ok: true, json: async () => ({ results: [], count: 0 }) };
                observaciones.redNoContemplada.push(destino);
                throw new Error(`Red externa no contemplada: ${destino}`);
            });
            servidor = await iniciarServidorVertical(require('../../src/app'), nonce, {
                reiniciar: async () => {
                    expect(automatizacion.cicloEnProgreso()).toBe(false);
                    automatizacion._resetearEstado();
                    pool.reiniciar();
                    Object.assign(pool.obtenerPreferencias(), { terminos_busqueda: ['anterior'], zonas_preferidas: [], reglas_exclusion: [], modalidad_aceptada: 'cualquiera' });
                    for (const lista of Object.values(observaciones)) lista.length = 0;
                    const existente = await modeloOferta.crearOferta({ titulo: 'Soporte existente', empresa: 'Sintética', ubicacion: 'CABA', modalidad: 'remoto', descripcion, url: 'https://linkedin.test/existente', plataforma: 'linkedin' });
                    Object.assign(existente, { estado_evaluacion: 'aprobada', porcentaje_match: 90, estado_postulacion: 'cv_enviado' });
                },
                liberar: () => liberar(),
                observar: () => ({ ...observaciones, ofertas: pool.ofertas, lotes: pool.lotes, sqlNoContemplado: pool.consultasNoContempladas, cronActivo: automatizacion.obtenerEstado().activo }),
                registrar: (metodo, ruta, estado) => observaciones.http.push({ metodo, ruta, estado }),
                completar: flujo => completados.push(flujo),
            });
            await expect(iniciarServidorVertical(require('../../src/app'), nonce, {})).rejects.toMatchObject({ code: 'EADDRINUSE' });
            hijo = spawn('npm', ['test', '--', '--watch=false', '--browsers=ChromeHeadless', '--include=src/app/paginas/dashboard/busquedas-vertical.spec.ts', `--define=BUSQUEDAS_VERTICAL=\"${nonce}\"`], {
                cwd: path.resolve(__dirname, '../../../frontend'), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
            });
            hijo.stdout.on('data', datos => process.stdout.write(datos));
            hijo.stderr.on('data', datos => process.stderr.write(datos));
            salida = new Promise((resolve, reject) => {
                hijo.once('error', reject);
                hijo.once('close', (codigo, signal) => resolve({ codigo, signal }));
            });
            salir = setTimeout(() => { if (hijo.exitCode === null) process.kill(-hijo.pid, 'SIGTERM'); }, 150000);
            const resultado = await salida;
            expect(resultado).toEqual({ codigo: 0, signal: null });
            expect(completados.sort()).toEqual(['ciclo', 'individual', 'qa']);
            expect(pool.consultasNoContempladas).toEqual([]);
            expect(observaciones.redNoContemplada).toEqual([]);
            expect(require('node-cron').schedule).not.toHaveBeenCalled();
        } finally {
            clearTimeout(salir);
            liberar();
            if (hijo && hijo.exitCode === null && hijo.signalCode === null) {
                process.kill(-hijo.pid, 'SIGTERM');
                await salida;
            }
            if (cicloEspia) {
                await Promise.allSettled(cicloEspia.mock.results.filter(r => r.type === 'return').map(r => r.value));
                cicloEspia.mockRestore();
            }
            if (servidor) {
                await new Promise((resolve, reject) => { servidor.close(error => error ? reject(error) : resolve()); servidor.closeIdleConnections(); });
                expect(servidor.listening).toBe(false);
            }
            global.fetch = fetchOriginal;
            for (const [nombre, valor] of Object.entries(originales)) {
                if (valor === undefined) delete process.env[nombre];
                else process.env[nombre] = valor;
            }
        }
    }, 180000);
});
