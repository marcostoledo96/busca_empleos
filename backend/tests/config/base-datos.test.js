// Tests para el módulo de conexión a la base de datos.
// Verifico que el pool se conecte correctamente y cierre sin errores.

const pool = require('../../src/config/base-datos');

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

    test('debería estar conectado a la base de datos "busca_empleos"', async () => {
        const resultado = await pool.query('SELECT current_database() AS nombre_bd');

        expect(resultado.rows[0].nombre_bd).toBe('busca_empleos');
    });
});
