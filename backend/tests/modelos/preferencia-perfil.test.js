jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/preferencia');
const { construirPerfilEfectivo } = require('../../src/servicios/evaluacion/perfil-efectivo');

beforeEach(() => jest.clearAllMocks());

test('creo fila incompleta sin heredar defaults personales del esquema', async () => {
    pool.query.mockImplementation(async (sql, valores) => {
        if (sql.startsWith('SELECT')) return { rows: [] };
        expect(sql).toContain("'{}'::jsonb, NULL, NULL");
        expect(sql).toContain('nivel_real_seniority, anios_experiencia_reales');
        const [id, nombre, nivel_experiencia, perfil_profesional, idioma_candidato, stack_tecnologico] = valores;
        return { rows: [{ id, nombre, nivel_experiencia, perfil_profesional, idioma_candidato, stack_tecnologico, nivel_ingles_detalle: {}, nivel_real_seniority: null, anios_experiencia_reales: null }] };
    });
    const prefs = await modelo.obtenerPreferencias();
    expect(construirPerfilEfectivo(prefs).candidato).toEqual(expect.objectContaining({ nombre: null, nivel_real_seniority: null, anios_experiencia_reales: null, perfil_profesional: null, idioma_candidato: null, stack_tecnologico: [], nivel_ingles_detalle: {} }));
});

test('detalle deriva stack incluso con anterior contradictorio sin mutar entrada', async () => {
    const datos = { tecnologias_detalle: [{ nombre: 'Rust', nivel: 'ninguno' }], stack_tecnologico: ['Rust'], anios_experiencia_reales: 0 };
    pool.query.mockImplementation(async sql => ({ rows: sql.includes('RETURNING') ? [{ id: 1 }] : [] }));
    await modelo.actualizarPreferencias(datos);
    const [sql, valores] = pool.query.mock.calls.at(-1);
    expect(sql).toContain('stack_tecnologico = $1');
    expect(valores[0]).toEqual([]);
    expect(valores).toContain(0);
    expect(valores).toContain(JSON.stringify(datos.tecnologias_detalle));
    expect(datos.stack_tecnologico).toEqual(['Rust']);
});
