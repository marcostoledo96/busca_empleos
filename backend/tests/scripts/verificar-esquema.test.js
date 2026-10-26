const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const raiz = path.resolve(__dirname, '../..');
const cli = path.join(raiz, 'scripts/verificar-esquema.js');
const { crearPoolSimulado } = require('../helpers/issue-61-preflight-mocks');
const ejecutar = argumentos => spawnSync(process.execPath, [cli, ...argumentos], {
    env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 18000,
});

test('ayuda sin conexión ni archivos de entorno', () => {
    const resultado = ejecutar(['--help']);
    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toBe('Uso: node scripts/verificar-esquema.js [--help]\nVerifico migraciones y contratos críticos en una transacción READ ONLY.\nUso DATABASE_URL o PG* del entorno; no cargo archivos .env ni reparo el esquema.\n');
    expect(resultado.stderr).toBe('');
});

test.each([[[]], [['--apply']], [['--directorio', 'privado']]])('fallo cerrado y sanitizado: %j', argumentos => {
    const resultado = ejecutar(argumentos);
    expect(resultado.status).toBe(1);
    expect(resultado.stdout).toBe('');
    expect(resultado.stderr).toBe('PREFLIGHT: ERROR\nNo pude verificar configuración, conexión o permisos de forma segura.\nNo recomiendo continuar con el despliegue.\n');
});

test('descubro basenames exactos y rechazo duplicados sin un contador histórico', () => {
    const { obtenerMigraciones } = require(cli);
    const directorios = ['sql', 'migrations'].map(nombre => path.join(raiz, nombre));
    const nombres = obtenerMigraciones(directorios);
    const esperadas = directorios.flatMap(directorio => fs.readdirSync(directorio).filter(nombre => nombre.endsWith('.sql'))).sort();
    expect(nombres).toEqual(esperadas);
    expect(nombres).toEqual(expect.arrayContaining(['024-resultados-fuentes.sql', 'migracion-024-reparar-identidades-canonicas.sql']));
    expect(() => obtenerMigraciones([directorios[0], directorios[0]])).toThrow('Migraciones ambiguas.');
});

test('rechazo basenames con controles antes de formar un diagnóstico', () => {
    const leer = jest.spyOn(fs, 'readdirSync').mockReturnValue([{ name: 'privada\n.sql', isFile: () => true }]);
    try {
        expect(() => require(cli).obtenerMigraciones(['directorio-simulado'])).toThrow('Nombre de migración no seguro.');
    } finally {
        leer.mockRestore();
    }
});

test('la configuración compartida es pura y conserva URL, SSL y fallback', () => {
    const { obtenerConfiguracionPostgres } = require('../../src/config/configuracion-postgres');
    expect(obtenerConfiguracionPostgres({ PGHOST: '127.0.0.1' })).toEqual({});
    expect(obtenerConfiguracionPostgres({ PGHOST: 'remoto.invalid' })).toEqual({ ssl: { rejectUnauthorized: false } });
    expect(obtenerConfiguracionPostgres({ DATABASE_URL: 'postgres://sintetico:clave@db.invalid/test' })).toEqual({
        connectionString: 'postgres://sintetico:clave@db.invalid/test', ssl: { rejectUnauthorized: false },
    });
    const advertir = jest.fn();
    expect(obtenerConfiguracionPostgres({ DATABASE_URL: 'invalida', PGSSLMODE: 'disable' }, advertir)).toEqual({});
    expect(advertir).toHaveBeenCalledTimes(1);
});

describe('transacción acotada y cierre aun con fallos', () => {
    const entornoOriginal = process.env;
    let simulacion;
    let verificarEsquema;
    let ConstructorPool;
    beforeEach(() => {
        process.env = { PGHOST: '127.0.0.1', PGPORT: '55457', PGDATABASE: 'sintetica_test',
            PGUSER: 'sintetico', PGPASSWORD: 'secreto-sintetico', PGSSLMODE: 'disable' };
        simulacion = crearPoolSimulado({});
        ConstructorPool = jest.fn(() => simulacion.pool);
        jest.doMock('pg', () => ({ Pool: ConstructorPool }));
        jest.isolateModules(() => { ({ verificarEsquema } = require(cli)); });
    });
    afterEach(() => {
        process.env = entornoOriginal;
        jest.useRealTimers();
        jest.dontMock('pg');
        jest.resetModules();
    });
    test('inicio explícito READ ONLY, SELECT de catálogo y cierre al faltar contratos', async () => {
        await expect(verificarEsquema()).rejects.toThrow('Contrato ausente.');
        expect(simulacion.cliente.query.mock.calls[0]).toEqual(['BEGIN READ ONLY']);
        expect(simulacion.cliente.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
        expect(simulacion.cliente.query.mock.calls.slice(1, -1).every(([sql]) => sql.trim().startsWith('SELECT'))).toBe(true);
        expect(ConstructorPool).toHaveBeenCalledWith(expect.objectContaining({ max: 1,
            connectionTimeoutMillis: 3000, query_timeout: 2500, application_name: 'issue61-preflight',
            options: expect.stringContaining('default_transaction_read_only=on') }));
        const opciones = ConstructorPool.mock.calls[0][0].options;
        expect(opciones).toContain('statement_timeout=2000');
        expect(opciones).toContain('lock_timeout=1000');
        expect(opciones).toContain('idle_in_transaction_session_timeout=3000');
        expect(simulacion.cliente.release.mock.calls).toEqual([[true]]);
        expect(simulacion.pool.end).toHaveBeenCalledTimes(1);
    });
    test('atiendo errores de red del cliente adquirido sin eventos sin manejar', async () => {
        simulacion.cliente.query.mockImplementationOnce(async () => {
            expect(simulacion.cliente.listenerCount('error')).toBe(1);
            simulacion.cliente.emit('error', new Error('dato privado de conexión'));
            throw new Error('Conexión interrumpida.');
        });
        await expect(verificarEsquema()).rejects.toThrow('Conexión interrumpida.');
        expect(simulacion.cliente.release.mock.calls).toEqual([[true]]);
        expect(simulacion.pool.end).toHaveBeenCalledTimes(1);
    });
    test('cierro el pool si falla la conexión', async () => {
        simulacion.pool.connect.mockRejectedValueOnce(new Error('secreto SQL privado'));
        await expect(verificarEsquema()).rejects.toThrow();
        expect(simulacion.cliente.query).not.toHaveBeenCalled();
        expect(simulacion.pool.end).toHaveBeenCalledTimes(1);
    });
    test('corto una conexión bloqueada al alcanzar el límite global', async () => {
        jest.useFakeTimers();
        simulacion.cliente.query.mockImplementationOnce(() => new Promise((resolve, reject) => {
            simulacion.cliente.release.mockImplementationOnce(() => reject(new Error('Conexión cerrada.')));
        }));
        const resultado = expect(verificarEsquema()).rejects.toThrow('Conexión cerrada.');
        await jest.advanceTimersByTimeAsync(10000);
        await resultado;
        expect(simulacion.cliente.release.mock.calls).toEqual([[true]]);
        expect(simulacion.pool.end).toHaveBeenCalledTimes(1);
    });
    test('rechazo PGOPTIONS que intenta cambiar el rol', async () => {
        process.env.PGOPTIONS = '-c role=privilegiado';
        await expect(verificarEsquema()).rejects.toThrow('Opciones de conexión no permitidas.');
        expect(ConstructorPool).not.toHaveBeenCalled();
    });
    test('rechazo opciones de URL que podrían reemplazar los límites', async () => {
        process.env.DATABASE_URL = 'postgres://sintetico:clave@127.0.0.1/test?options=-c%20statement_timeout=0';
        await expect(verificarEsquema()).rejects.toThrow('Opciones de conexión no permitidas.');
        expect(ConstructorPool).not.toHaveBeenCalled();
    });
});
