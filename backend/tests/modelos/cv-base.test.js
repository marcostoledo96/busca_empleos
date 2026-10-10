jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/cv-base');
beforeEach(() => jest.clearAllMocks());

test('guardo con una consulta parametrizada atómica y fecha de BD', async () => {
    const fila = { cv_base: "  ' ; -- CV sintético\n", cv_base_actualizado_en: new Date() };
    pool.query.mockResolvedValue({ rows: [fila] });
    expect(await modelo.guardarCvBase(fila.cv_base)).toBe(fila);
    const [sql, parametros] = pool.query.mock.calls[0];
    expect(parametros).toEqual([fila.cv_base]);
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    expect(sql).toContain('clock_timestamp()');
    expect(sql).toContain('RETURNING cv_base, cv_base_actualizado_en');
    expect(sql).not.toContain('preferencias');
    expect(sql).not.toContain(fila.cv_base);
    expect(pool.query).toHaveBeenCalledTimes(1);
});

test('propago error de BD sin devolver éxito', async () => {
    pool.query.mockRejectedValue(new Error('Fallo sintético'));
    await expect(modelo.guardarCvBase('')).rejects.toThrow('Fallo sintético');
});
