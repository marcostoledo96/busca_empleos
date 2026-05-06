// Tests para el módulo de conexión a la base de datos.
// Verifico que el pool se conecte correctamente y cierre sin errores.

const { URL } = require('node:url');
const pool = require('../../src/config/base-datos');

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

describe('Módulo de conexión a PostgreSQL', () => {
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
