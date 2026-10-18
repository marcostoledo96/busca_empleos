jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/preferencia');
const { construirPerfilEfectivo } = require('../../src/servicios/evaluacion/perfil-efectivo');

beforeEach(() => jest.clearAllMocks());

test('normalizo modelos al leer sin persistir ni alterar otros campos', async () => {
    const fila = { id: 1, modelo_ia: 'deepseek-v4-flash', modelo_ia_evaluacion: 'deepseek-v4-flash',
        modelo_ia_importacion: 'deepseek-v4-pro', nombre: 'Perfil sintético', temperatura_evaluacion: 0.7 };
    pool.query.mockResolvedValue({ rows: [fila] });
    expect(await modelo.obtenerPreferencias()).toEqual({ ...fila, modelo_ia: 'deepseek-flash', modelo_ia_evaluacion: 'deepseek-flash' });
    expect(fila.modelo_ia).toBe('deepseek-v4-flash');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/^SELECT/);
});

test.each(['modelo_ia', 'modelo_ia_evaluacion', 'modelo_ia_importacion'])('normalizo solo el campo enviado %s y conservo el resto al guardar y recargar', async campo => {
    let fila = { id: 1, nombre: 'Perfil sintético', modelo_ia: 'deepseek-v4-pro', modelo_ia_evaluacion: 'deepseek-v4-pro',
        modelo_ia_importacion: 'deepseek-v4-pro', temperatura_importacion: 0.6, preguntas_perfil_pendientes: [{ estado: 'ignorada' }] };
    const original = { ...fila };
    pool.query.mockImplementation(async (sql, valores) => {
        if (sql.includes('RETURNING')) {
            expect(sql).toContain(`${campo} = $1`);
            expect(valores).toEqual(['deepseek-flash', 1]);
            fila = { ...fila, [campo]: valores[0] };
        }
        return { rows: [{ ...fila }] };
    });
    const datos = { [campo]: 'deepseek-v4-flash' };
    expect(await modelo.actualizarPreferencias(datos)).toEqual({ ...original, [campo]: 'deepseek-flash' });
    expect(await modelo.obtenerPreferencias()).toEqual({ ...original, [campo]: 'deepseek-flash' });
    expect(datos[campo]).toBe('deepseek-v4-flash');
});

test('serializo identidad, estados, respuesta y nota sin transformar el JSONB revisado', async () => {
    const preguntas = ['pendiente', 'respondida', 'aplicada', 'ignorada', 'nota'].map((estado, indice) => ({
        id: `pregunta-${indice}`, campo: 'docker', pregunta: '¿Nivel?', estado,
        ...(estado === 'ignorada' ? {} : { respuesta: 'Básico' }),
        ...(estado === 'nota' ? { nota: 'Uso local confirmado' } : {}),
    }));
    pool.query.mockImplementation(async (sql, valores) => {
        if (!sql.includes('RETURNING')) return { rows: [] };
        const serializado = valores.find(valor => typeof valor === 'string' && valor.startsWith('[{'));
        expect(JSON.parse(serializado)).toEqual(preguntas);
        expect(sql).toContain('preguntas_perfil_pendientes = $');
        return { rows: [{ id: 1, preguntas_perfil_pendientes: JSON.parse(serializado) }] };
    });
    const guardado = await modelo.actualizarPreferencias({ preguntas_perfil_pendientes: preguntas });
    expect(guardado.preguntas_perfil_pendientes).toEqual(preguntas);
});

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
