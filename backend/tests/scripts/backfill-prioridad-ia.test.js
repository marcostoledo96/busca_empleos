jest.mock('../../src/config/base-datos', () => ({ query: jest.fn(), end: jest.fn() }));

const pool = require('../../src/config/base-datos');
const { ejecutarBackfill } = require('../../scripts/backfill-prioridad-ia');

describe('backfill de prioridad IA', () => {
    beforeEach(() => jest.clearAllMocks());

    test('dry-run solo informa candidatos recientes sin escribir', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 1, titulo: 'Dev Copilot', descripcion: 'Usa GitHub Copilot' }] })
            .mockResolvedValueOnce({ rows: [] });

        const resultado = await ejecutarBackfill({ aplicar: false, lote: 100 });

        expect(resultado).toMatchObject({ modo: 'dry-run', procesadas: 1, cambios: 1 });
        expect(pool.query.mock.calls.some(([sql]) => sql.includes('UPDATE ofertas'))).toBe(false);
        expect(pool.query.mock.calls[0][0]).toContain('fecha_extraccion >= $1');
    });

    test('apply persiste solo filas dentro de la fecha de corte fijada', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 2, titulo: 'Dev IA', descripcion: 'Claude Code' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        await ejecutarBackfill({ aplicar: true, lote: 100 });

        const llamadaUpdate = pool.query.mock.calls.find(([sql]) => sql.includes('UPDATE ofertas'));
        expect(llamadaUpdate[0]).toContain('fecha_extraccion >= $6');
        expect(llamadaUpdate[1][5]).toBeInstanceOf(Date);
    });
});
