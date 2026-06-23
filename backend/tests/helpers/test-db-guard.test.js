// Tests unitarios para el guardián de seguridad de BD de test.
// Uso pools falsos (mocks) para no necesitar una conexión real a PostgreSQL.
// Esto permite probar los caminos felices y de error sin riesgo.

const { asegurarBaseDeDatosDeTest } = require('./test-db-guard');

// Pool falso que simula una conexión a PostgreSQL.
// Retorna el nombre de base de datos que le indiquemos.
function crearPoolFalso(nombreBaseDeDatos) {
    return {
        query: jest.fn().mockResolvedValue({
            rows: [{ db: nombreBaseDeDatos }]
        })
    };
}

describe('asegurarBaseDeDatosDeTest', () => {
    test('debería pasar si el nombre de la BD termina en "_test"', async () => {
        const poolFalso = crearPoolFalso('busca_empleos_test');

        const resultado = await asegurarBaseDeDatosDeTest(poolFalso);

        expect(resultado).toBe('busca_empleos_test');
        expect(poolFalso.query).toHaveBeenCalledWith('SELECT current_database() AS db');
    });

    test('debería pasar con otros nombres que terminen en "_test"', async () => {
        const poolFalso = crearPoolFalso('mi_proyecto_test');

        const resultado = await asegurarBaseDeDatosDeTest(poolFalso);

        expect(resultado).toBe('mi_proyecto_test');
    });

    test('debería lanzar error si la BD no termina en "_test"', async () => {
        const poolFalso = crearPoolFalso('busca_empleos');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('Tests destructivos bloqueados');
    });

    test('debería lanzar error si la BD es "production"', async () => {
        const poolFalso = crearPoolFalso('production');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('Tests destructivos bloqueados');
    });

    test('debería lanzar error si la BD es "busca_empleos" (sin sufijo _test)', async () => {
        const poolFalso = crearPoolFalso('busca_empleos');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('"busca_empleos"');
    });

    test('el mensaje de error debería mencionar DATABASE_URL como posible causa', async () => {
        const poolFalso = crearPoolFalso('busca_empleos');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('DATABASE_URL');
    });

    test('el mensaje de error debería sugerir usar una BD con sufijo "_test"', async () => {
        const poolFalso = crearPoolFalso('busca_empleos');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('"_test"');
    });

    test('debería lanzar error si la BD tiene "test" en el medio pero no al final', async () => {
        const poolFalso = crearPoolFalso('busca_test_empleos');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('Tests destructivos bloqueados');
    });

    test('debería lanzar error si la BD se llama "test" sin guion bajo (nombre ambiguo)', async () => {
        const poolFalso = crearPoolFalso('test');

        // "test" solo no termina en "_test", así que se bloquea.
        // Esto es intencional: el nombre "test" por sí solo es ambiguo.
        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('Tests destructivos bloqueados');
    });

    test('debería lanzar error si la BD tiene nombre vacío (caso extremo)', async () => {
        const poolFalso = crearPoolFalso('');

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('Tests destructivos bloqueados');
    });

    test('debería propagar errores de conexión del pool', async () => {
        const poolFalso = {
            query: jest.fn().mockRejectedValue(new Error('Connection refused'))
        };

        await expect(asegurarBaseDeDatosDeTest(poolFalso))
            .rejects.toThrow('Connection refused');
    });
});