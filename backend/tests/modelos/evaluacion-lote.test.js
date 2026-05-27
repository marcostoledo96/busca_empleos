// Tests para el modelo de lotes de evaluacion (evaluacion-lote.js).
//
// Mockeo el pool de PostgreSQL para que los tests sean puros unitarios.

jest.mock('../../src/config/base-datos');

const modeloLote = require('../../src/modelos/evaluacion-lote');
const pool = require('../../src/config/base-datos');

describe('Modelo de lotes de evaluacion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // === crearLote ===

    describe('crearLote()', () => {
        test('inserta un lote nuevo con estado activo', async () => {
            const loteMock = {
                id: 1,
                estado: 'activo',
                total: 10,
                modelo_ia: 'deepseek-v4-flash',
                evaluadas: 0,
                aprobadas: 0,
                rechazadas: 0,
                errores: 0,
                porcentaje: 0,
            };

            pool.query.mockResolvedValueOnce({
                rows: [loteMock],
            });

            const resultado = await modeloLote.crearLote(10, 'deepseek-v4-flash');

            expect(resultado).toEqual(loteMock);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO evaluacion_lotes (estado, total, modelo_ia)"),
                [10, 'deepseek-v4-flash']
            );
        });
    });

    // === actualizarProgreso ===

    describe('actualizarProgreso()', () => {
        test('actualiza los campos de progreso correctamente', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const progreso = {
                evaluadas: 5,
                aprobadas: 3,
                rechazadas: 2,
                errores: 0,
                porcentaje: 50,
            };

            await modeloLote.actualizarProgreso(1, progreso);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE evaluacion_lotes'),
                [5, 3, 2, 0, 50, 1]
            );
        });
    });

    // === finalizarLote ===

    describe('finalizarLote()', () => {
        test('marca el lote como completado', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await modeloLote.finalizarLote(1, 'completado');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE evaluacion_lotes"),
                expect.arrayContaining(['completado', 1])
            );
        });

        test('permite marcar el lote como cancelado', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await modeloLote.finalizarLote(1, 'cancelado');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE evaluacion_lotes"),
                expect.arrayContaining(['cancelado', 1])
            );
        });
    });

    // === obtenerUltimoLote ===

    describe('obtenerUltimoLote()', () => {
        test('devuelve el lote mas reciente', async () => {
            const loteMock = {
                id: 3,
                estado: 'completado',
                total: 20,
                modelo_ia: 'deepseek-v4-flash',
            };

            pool.query.mockResolvedValueOnce({
                rows: [loteMock],
            });

            const resultado = await modeloLote.obtenerUltimoLote();

            expect(resultado).toEqual(loteMock);
            // obtenerUltimoLote solo pasa el SQL string, no un array vacio de params.
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM evaluacion_lotes ORDER BY creado_en DESC LIMIT 1')
            );
        });

        test('devuelve null si no hay lotes', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const resultado = await modeloLote.obtenerUltimoLote();

            expect(resultado).toBeNull();
        });
    });
});
