const { construirPerfilEfectivo } = require('../../src/servicios/evaluacion/perfil-efectivo');

test('no completo hechos ausentes y separo políticas de hechos', () => {
    const perfil = construirPerfilEfectivo({});
    expect(perfil.candidato).toEqual({ nombre: null, nivel_real_seniority: null, anios_experiencia_reales: null, perfil_profesional: null, tecnologias_detalle: [], stack_tecnologico: [], nivel_ingles_detalle: null, idioma_candidato: null, conocimientos_ausentes: [], limitaciones_explicitas: null });
    expect(perfil.texto).not.toMatch(/AeroTest|A1|A2|Español nativo|React Native|Jira/);
    expect(perfil.restricciones.politicas_sistema).toHaveLength(5);
});

test.each([[[]], [[{ rol: 'QA objetivo', prioridad: 'alta', evidencia: 'Interés declarado' }]]])('separo roles buscados de capacidades confirmadas: %j', roles => {
    const vista = construirPerfilEfectivo({ roles_objetivo_detalle: roles });
    expect(vista.candidato).not.toHaveProperty('roles_objetivo_detalle');
    expect(vista.restricciones.preferencias.roles_objetivo_detalle).toEqual(roles);
    expect(vista.secciones.find(s => s.id === 'candidato').texto).not.toContain('roles_objetivo_detalle');
    const textoPreferencias = vista.secciones.find(s => s.id === 'preferencias').texto;
    expect(JSON.parse(textoPreferencias.slice(textoPreferencias.indexOf(':') + 1)).roles_objetivo_detalle).toEqual(roles);
});

test('solo uso campos legacy si falta detalle; [] y {} son explícitos', () => {
    const legacy = { stack_tecnologico: ['Rust'], idioma_candidato: 'Portugués C2', nivel_experiencia: 'trainee' };
    expect(construirPerfilEfectivo(legacy).candidato).toEqual(expect.objectContaining({ stack_tecnologico: ['Rust'], idioma_candidato: 'Portugués C2', nivel_real_seniority: 'trainee' }));
    const explicito = construirPerfilEfectivo({ ...legacy, tecnologias_detalle: [], nivel_ingles_detalle: {}, nivel_real_seniority: 'junior' });
    expect(explicito.candidato.stack_tecnologico).toEqual([]);
    expect(explicito.candidato.idioma_candidato).toBeNull();
    expect(explicito.candidato.nivel_real_seniority).toBe('junior');
});

test('conservo evidencia, ninguno, cero y valores laborales sin mutar preferencias', () => {
    const prefs = { tecnologias_detalle: [{ nombre: 'Rust', nivel: 'ninguno', evidencia: 'No estudiado' }], stack_tecnologico: ['Rust'], anios_experiencia_reales: 0, modalidad_aceptada: 'remoto', disponibilidad: 'part_time', expectativa_salarial_min: 0, expectativa_salarial_max: 100, moneda_salarial: 'USD', priorizar_ofertas_ia: false, bonus_maximo_prioridad_ia: 0 };
    const antes = JSON.stringify(prefs);
    const vista = construirPerfilEfectivo(prefs);
    expect(vista.candidato.stack_tecnologico).toEqual([]);
    expect(vista.candidato.tecnologias_detalle).toEqual(prefs.tecnologias_detalle);
    expect(vista.candidato.anios_experiencia_reales).toBe(0);
    expect(vista.restricciones.preferencias).toEqual(expect.objectContaining({ modalidad_aceptada: 'remoto', disponibilidad: 'part_time', expectativa_salarial_min: 0, expectativa_salarial_max: 100, moneda_salarial: 'USD' }));
    expect(vista.secciones.map(s => s.texto).join('\n\n')).toBe(vista.texto);
    expect(JSON.stringify(prefs)).toBe(antes);
});
