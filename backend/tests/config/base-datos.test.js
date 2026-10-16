// Tests para el módulo de conexión a la base de datos.
// Verifico que el pool se conecte correctamente y cierre sin errores.

const { URL } = require('node:url');

describe('Configuración sintética explícita', () => {
    const entornoOriginal = { ...process.env };
    let configurarEntorno;

    beforeEach(() => {
        process.env = { NODE_ENV: 'test', DB_TEST_SINTETICA: 'true', PGHOST: '127.0.0.1', PGPORT: '55439', PGDATABASE: 'issue19_test', PGUSER: 'sintetico', PGPASSWORD: 'sintetica', PGSSLMODE: 'disable' };
        configurarEntorno = jest.fn();
        jest.doMock('dotenv', () => ({ config: configurarEntorno }));
        jest.doMock('pg', () => ({ Pool: jest.fn(() => ({ on: jest.fn() })) }));
    });

    afterEach(() => {
        process.env = { ...entornoOriginal };
        jest.dontMock('dotenv');
        jest.dontMock('pg');
        jest.resetModules();
    });

    test('omito archivos de entorno únicamente con opt-in sintético validado', () => {
        jest.isolateModules(() => require('../../src/config/base-datos'));
        expect(configurarEntorno).not.toHaveBeenCalled();
        expect(process.env.PGPORT).toBe('55439');
    });

    test('permito el sentinel production_test sin dotenv y con pool local seguro', () => {
        process.env.NODE_ENV = 'production_test';
        jest.isolateModules(() => {
            require('../../src/config/base-datos');
            expect(require('pg').Pool).toHaveBeenCalledWith({});
        });
        expect(configurarEntorno).not.toHaveBeenCalled();
        expect(process.env).toEqual(expect.objectContaining({
            NODE_ENV: 'production_test', PGHOST: '127.0.0.1', PGPORT: '55439',
            PGDATABASE: 'issue19_test', PGUSER: 'sintetico', PGPASSWORD: 'sintetica', PGSSLMODE: 'disable',
        }));
        expect(process.env.DATABASE_URL).toBeUndefined();
    });

    test.each([
        ['PGHOST', 'servidor.example'], ['PGDATABASE', 'real'], ['NODE_ENV', 'production'],
        ['PGPORT', ''], ['DATABASE_URL', 'postgres://invalido'],
    ])('rechazo opt-in inseguro: %s', (clave, valor) => {
        process.env[clave] = valor;
        expect(() => jest.isolateModules(() => require('../../src/config/base-datos'))).toThrow('Configuración sintética de BD inválida.');
        expect(configurarEntorno).not.toHaveBeenCalled();
        expect(require('pg').Pool).not.toHaveBeenCalled();
    });

    test('sin opt-in el sentinel conserva .env y override falso', () => {
        delete process.env.DB_TEST_SINTETICA;
        process.env.NODE_ENV = 'production_test';
        jest.isolateModules(() => require('../../src/config/base-datos'));
        expect(configurarEntorno).toHaveBeenCalledWith({
            path: require('node:path').resolve(__dirname, '../../.env'), override: false,
        });
    });

    test('conservo la carga normal de .env.test sin opt-in', () => {
        delete process.env.DB_TEST_SINTETICA;
        jest.isolateModules(() => require('../../src/config/base-datos'));
        expect(configurarEntorno).toHaveBeenCalledWith(expect.objectContaining({ override: true }));
    });
});
let pool;

const hayBaseConfigurada = Boolean(process.env.DATABASE_URL || process.env.PGDATABASE);
const contexto = hayBaseConfigurada ? describe : describe.skip;

function obtenerNombreBaseConfigurada() {
    if (process.env.DATABASE_URL) {
        try {
            const url = new URL(process.env.DATABASE_URL);
            return url.pathname.replace(/^\/+/, '') || null;
        } catch {
            return null;
        }
    }

    return process.env.PGDATABASE || null;
}

contexto('Módulo de conexión a PostgreSQL', () => {
    beforeAll(() => {
        pool = require('../../src/config/base-datos');
    });
    // Después de todos los tests, cierro el pool para que Jest no quede colgado.
    afterAll(async () => {
        await pool.end();
    });

    test('debería conectarse a la base de datos y responder un SELECT 1', async () => {
        const resultado = await pool.query('SELECT 1 AS numero');

        expect(resultado.rows).toHaveLength(1);
        expect(resultado.rows[0].numero).toBe(1);
    });

    test('debería retornar la fecha actual del servidor', async () => {
        const resultado = await pool.query('SELECT NOW() AS ahora');

        expect(resultado.rows).toHaveLength(1);
        // Verifico que sea una fecha válida (no null, no undefined).
        expect(resultado.rows[0].ahora).toBeInstanceOf(Date);
    });

    test('debería estar conectado a la base de datos configurada en el entorno', async () => {
        const resultado = await pool.query('SELECT current_database() AS nombre_bd');
        const nombreBaseConfigurada = obtenerNombreBaseConfigurada();

        expect(nombreBaseConfigurada).toBeTruthy();
        expect(resultado.rows[0].nombre_bd).toBe(nombreBaseConfigurada);
    });
});
