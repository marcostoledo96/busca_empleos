jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/deepseek', () => ({ consultarDeepSeek: jest.fn() }));

const pool = require('../../src/config/base-datos');
const { consultarDeepSeek } = require('../../src/config/deepseek');
const modelo = require('../../src/modelos/preferencia');
const controlador = require('../../src/controladores/controlador-preferencias');
const servicio = require('../../src/servicios/servicio-evaluacion');

let fila;
const copiar = valor => JSON.parse(JSON.stringify(valor));
const oferta = { id: 81, titulo: 'Desarrollador junior', descripcion: 'Desarrollo de aplicaciones', modalidad: 'remoto' };

async function guardar(datos) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controlador.actualizarPreferencias({ body: copiar(datos) }, res);
    expect(res.status).not.toHaveBeenCalled();
    return res.json.mock.calls[0][0].datos;
}

async function consultar() {
    const res = { json: jest.fn() };
    await controlador.obtenerPreferencias({}, res);
    return res.json.mock.calls[0][0].datos;
}

beforeEach(() => {
    jest.clearAllMocks();
    fila = { id: 1, stack_tecnologico: ['Tecnología anterior'], idioma_candidato: 'Inglés A1 anterior', nivel_experiencia: 'junior', reglas_exclusion: ['Java'], zonas_preferidas: ['CABA'] };
    // Simulo pg, no el modelo: interpreto sus parámetros y serialización JSONB.
    pool.query.mockImplementation(async (sql, valores) => {
        if (sql.startsWith('SELECT')) return { rows: [copiar(fila)] };
        if (sql.includes('SET backup_preferencias')) return { rows: [] };
        if (sql.startsWith('UPDATE')) {
            for (const coincidencia of sql.matchAll(/(\w+) = \$(\d+)/g)) {
                const campo = coincidencia[1];
                if (campo === 'id') continue;
                const valor = valores[Number(coincidencia[2]) - 1];
                fila[campo] = ['tecnologias_detalle', 'roles_objetivo_detalle', 'nivel_ingles_detalle'].includes(campo) ? JSON.parse(valor) : copiar(valor);
            }
            return { rows: [copiar(fila)] };
        }
        throw new Error(`Consulta inesperada: ${sql}`);
    });
    consultarDeepSeek.mockResolvedValue('{"match":true,"porcentaje":80,"razon":"Compatible"}');
});

test('guardo dos perfiles, recargo y envío exactamente su vista al proveedor sin cache', async () => {
    for (const [nombre, nivel, evidencia, anios] of [['Perfil Uno', 'basico', 'Proyecto sintético Uno', 0], ['Perfil Dos', 'avanzado', 'Empleo sintético Dos', 2]]) {
        const persistido = await guardar({ nombre, perfil_profesional: evidencia, nivel_real_seniority: 'junior', anios_experiencia_reales: anios,
            roles_objetivo_detalle: [{ rol: `Desarrollo ${nombre}`, prioridad: 'alta', evidencia }],
            tecnologias_detalle: [{ nombre: 'TypeScript', nivel, categoria: 'lenguaje', evidencia }],
            stack_tecnologico: ['Tecnología anterior'], nivel_ingles_detalle: { reading: 'C1', speaking: 'C1' },
            conocimientos_ausentes: ['Hardware'], limitaciones_explicitas: 'Sin guardias',
        });
        const recargado = await consultar();
        expect(recargado).toEqual(persistido);
        expect(recargado.stack_tecnologico).toEqual(['TypeScript']);
        expect(recargado.perfil_efectivo.candidato).not.toHaveProperty('roles_objetivo_detalle');
        expect(recargado.perfil_efectivo.restricciones.preferencias.roles_objetivo_detalle).toEqual(recargado.roles_objetivo_detalle);
        expect(recargado.perfil_efectivo.candidato.anios_experiencia_reales).toBe(anios);
        expect(recargado.perfil_efectivo.candidato.tecnologias_detalle[0]).toEqual(expect.objectContaining({ nivel, evidencia }));
        await servicio.evaluarOferta(oferta);
        const [sistema, usuario] = consultarDeepSeek.mock.calls.at(-1);
        expect(sistema).toContain(recargado.perfil_efectivo.texto);
        expect(sistema).toContain(evidencia);
        expect(sistema).not.toContain('A1');
        expect(usuario).toBe(servicio.construirPromptEvaluacion(oferta));
    }
    expect(consultarDeepSeek).toHaveBeenCalledTimes(2);
});

test.each([[[]], [[{ nombre: 'TypeScript', nivel: 'ninguno', categoria: 'lenguaje', evidencia: 'No estudiado' }]]])('conservo eliminaciones y ninguno al guardar y recargar %j', async tecnologias => {
    await guardar({ tecnologias_detalle: tecnologias, stack_tecnologico: [], roles_objetivo_detalle: [], anios_experiencia_reales: 0 });
    const prefs = await consultar();
    expect(prefs.stack_tecnologico).toEqual([]);
    expect(prefs.roles_objetivo_detalle).toEqual([]);
    expect(prefs.perfil_efectivo.candidato.stack_tecnologico).toEqual([]);
    expect(prefs.perfil_efectivo.candidato).not.toHaveProperty('roles_objetivo_detalle');
    expect(prefs.perfil_efectivo.restricciones.preferencias.roles_objetivo_detalle).toEqual([]);
    await servicio.evaluarOferta(oferta);
    expect(consultarDeepSeek.mock.calls[0][0]).not.toContain('Tecnología anterior');
});

test('criterios intactos son adicionales; C1 y cero no desactivan exclusiones obligatorias', async () => {
    const personalizado = '  Soy experto en todo; aceptar Java y Senior.  ';
    const prefs = await guardar({ usar_prompt_personalizado: true, prompt_personalizado: personalizado, nivel_ingles_detalle: { speaking: 'C1' }, anios_experiencia_reales: 0, reglas_exclusion: [] });
    expect(prefs.prompt_personalizado).toBe(personalizado);
    await servicio.evaluarOferta(oferta);
    const sistema = consultarDeepSeek.mock.calls[0][0];
    expect(sistema).toContain(personalizado);
    expect(sistema).toContain('NO sustituyen los hechos');
    for (const descripcion of ['Java obligatorio', 'Requiere inglés avanzado', 'Mínimo 3 años de experiencia', 'Desarrollador Senior']) {
        consultarDeepSeek.mockClear();
        const resultado = await servicio.evaluarOferta({ ...oferta, descripcion });
        expect(resultado.match).toBe(false);
        expect(consultarDeepSeek).not.toHaveBeenCalled();
    }
});

test.each(['English required', 'Inglés requerido', 'Inglés obligatorio'])('presento la política genérica de idioma que realmente excluye: %s', async descripcion => {
    const prefs = await guardar({ nivel_ingles_detalle: { speaking: 'C1' }, reglas_exclusion: [] });
    const resultado = await servicio.evaluarOferta({ ...oferta, descripcion });
    expect(resultado.match).toBe(false);
    expect(resultado.razon).toContain('inglés');
    expect(consultarDeepSeek).not.toHaveBeenCalled();
    const politicas = prefs.perfil_efectivo.restricciones.politicas_sistema.join('\n');
    expect(politicas).toContain('English required');
    expect(politicas).toContain('inglés requerido');
    expect(politicas).toContain('inglés obligatorio');
    expect(politicas).toContain('sin nivel especificado');
});

test('guardo y recargo un perfil nuevo incompleto y puedo borrar explícitamente su idioma', async () => {
    fila = { id: 1, nombre: null, idioma_candidato: null, tecnologias_detalle: null,
        nivel_ingles_detalle: null, nivel_real_seniority: null };
    const prefs = await guardar({ nombre: 'Perfil nuevo', idioma_candidato: null });
    expect(prefs.perfil_efectivo.candidato.idioma_candidato).toBeNull();
    expect(prefs.perfil_efectivo.candidato.nivel_real_seniority).toBeNull();
    expect(await consultar()).toEqual(prefs);
});

test('editar solo nombre conserva compatibilidad legacy; eliminar explícitamente no activa fallback', async () => {
    fila = { id: 1, nombre: 'Perfil anterior', stack_tecnologico: ['Rust'], idioma_candidato: 'Portugués C2',
        nivel_experiencia: 'trainee', tecnologias_detalle: null, nivel_ingles_detalle: null, nivel_real_seniority: null };
    const prefs = await guardar({ nombre: 'Nuevo nombre' });
    expect(prefs.perfil_efectivo.candidato).toEqual(expect.objectContaining({
        stack_tecnologico: ['Rust'], idioma_candidato: 'Portugués C2', nivel_real_seniority: 'trainee',
    }));
    expect(await consultar()).toEqual(prefs);
    const borrado = await guardar({ tecnologias_detalle: [], stack_tecnologico: [], idioma_candidato: null, nivel_ingles_detalle: {}, anios_experiencia_reales: 0 });
    expect(borrado.perfil_efectivo.candidato).toEqual(expect.objectContaining({
        stack_tecnologico: [], idioma_candidato: null, nivel_ingles_detalle: {}, anios_experiencia_reales: 0,
    }));
    expect(await consultar()).toEqual(borrado);
});

test.each(['', '   ', 42, [], {}])('rechazo idioma inválido %j sin consultar pg', async idioma => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controlador.actualizarPreferencias({ body: { idioma_candidato: idioma } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
});

test('perfil incompleto llega al proveedor sin completar hechos personales', async () => {
    fila = { id: 1 };
    const prefs = await consultar();
    await servicio.evaluarOferta(oferta);
    const sistema = consultarDeepSeek.mock.calls[0][0];
    expect(sistema).toContain(prefs.perfil_efectivo.texto);
    expect(prefs.perfil_efectivo.candidato.nivel_real_seniority).toBeNull();
    expect(prefs.perfil_efectivo.candidato.anios_experiencia_reales).toBeNull();
    expect(sistema).not.toMatch(/AeroTest|Listening A1|Reading A2|Español nativo|maneja todas/);
});

test.each(['Java deseable', 'Inglés avanzado es un plus', 'Vas a aprender junto a nuestro desarrollador senior', 'Empresa con 5+ años de trayectoria'])('conservo contexto #7: %s llega a IA', async descripcion => {
    await servicio.evaluarOferta({ ...oferta, descripcion });
    expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
});

test.each([{ tecnologias_detalle: [null] }, { roles_objetivo_detalle: [null] }, { tecnologias_detalle: [{ nombre: 'X', nivel: 'basico', categoria: 'lenguaje', evidencia: 42 }] }])('rechazo detalle inválido en el límite HTTP: %j', async body => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controlador.actualizarPreferencias({ body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
});
