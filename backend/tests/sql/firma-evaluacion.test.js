const fs = require('fs');
const path = require('path');
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn(), connect: jest.fn() }));
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/oferta');

beforeEach(() => jest.clearAllMocks());

test('migración 019 agrega solo firma nullable e idempotente sin backfill', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../sql/migracion-019-firma-evaluacion.sql'), 'utf8');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS firma_criterios_evaluacion TEXT/i);
    expect(sql).not.toMatch(/NOT NULL|DEFAULT|UPDATE|DELETE|DROP|TRUNCATE/i);
    const esquema = fs.readFileSync(path.join(__dirname, '../../sql/crear-tablas.sql'), 'utf8');
    expect(esquema).toMatch(/firma_criterios_evaluacion\s+TEXT/);
});

test('persiste firma exitosa con prioridad y fecha sin tocar campos manuales', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 9 }] });
    await modelo.actualizarEvaluacion(9, 'aprobada', 'Compatible', 80, null, null, 'firma');
    const [sql, valores] = pool.query.mock.calls[0];
    expect(sql).toContain('firma_criterios_evaluacion = $10');
    expect(sql).toContain('fecha_evaluacion = NOW()');
    expect(sql).not.toContain('estado_postulacion');
    expect(valores[9]).toBe('firma');
});

test('un error borra firma incluso si el llamador entrega una firma', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 9 }] });
    await modelo.actualizarEvaluacion(9, 'rechazada', 'Timeout', 15, 'Timeout', null, 'firma');
    expect(pool.query.mock.calls[0][1][9]).toBeNull();
});

test('proyección de sincronización incluye firma y error para no anunciar errores como actuales', async () => {
    const cliente = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(cliente);
    cliente.query.mockImplementation(async sql => {
        if (sql.includes('MAX(id)')) return { rows: [{ max_id: 9 }] };
        if (sql.includes('AS firma')) return { rows: [{ total: 1, firma: 'snapshot' }] };
        if (sql.includes('SELECT id, titulo')) return { rows: [{ id: 9, firma_criterios_evaluacion: 'firma', evaluacion_error_mensaje: 'Timeout' }] };
        return { rows: [] };
    });
    const resultado = await modelo.obtenerBloqueSincronizacion({ limite: 100 });
    const sql = cliente.query.mock.calls.find(([consulta]) => consulta.includes('SELECT id, titulo'))[0];
    expect(sql).toContain('firma_criterios_evaluacion');
    expect(sql).toContain('evaluacion_error_mensaje');
    expect(resultado.datos[0].firma_criterios_evaluacion).toBe('firma');
});
