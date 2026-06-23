// Tests de las reglas de exclusión determinísticas.
//
// ¿Qué testeamos acá?
// 1. Java excluyente no confunde con JavaScript.
// 2. Senior/SR/Lead detecta correctamente seniority.
// 3. Experiencia excluyente (3+ años, al menos 3, mínimo 3, etc.).
// 4. Inglés excluyente vs deseable.
// 5. Ubicación presencial fuera/dentro de zona.
// 6. Bonus IA no compensa Java (regla de salvaguarda).

'use strict';

const {
    evaluarReglasExclusion,
    _internas: {
        detectarJavaExcluyente,
        detectarSeniorityExcluyente,
        detectarExperienciaExcluyente,
        detectarInglesExcluyente,
        detectarUbicacionIncompatible,
        PORCENTAJE_EXCLUSION,
    },
} = require('../../src/servicios/evaluacion/reglas-exclusion');

// ──────────────────────────────────────────────────────────────
// Helpers para crear ofertas y preferencias de test
// ──────────────────────────────────────────────────────────────

const crearOferta = (overrides = {}) => ({
    id: 1,
    titulo: 'Desarrollador Frontend Junior',
    empresa: 'TechCorp',
    ubicacion: 'Buenos Aires, Argentina',
    modalidad: 'remoto',
    descripcion: 'Buscamos desarrollador frontend con experiencia en React y TypeScript.',
    plataforma: 'linkedin',
    ...overrides,
});

const preferenciasBase = {
    id: 1,
    nombre: 'Marcos Ezequiel Toledo',
    nivel_experiencia: 'junior',
    stack_tecnologico: ['JavaScript', 'TypeScript', 'Angular', 'React', 'Node.js'],
    modalidad_aceptada: 'cualquiera',
    zonas_preferidas: ['CABA', 'GBA Oeste'],
    reglas_exclusion: ['Java'],
    idioma_candidato: 'Español nativo, Inglés básico oral / intermedio escrito',
};

describe('Reglas de exclusión determinísticas', () => {

    // ──────────────────────────────────────────────────────────
    // Spec: Java excluyente no confunde JavaScript
    // ──────────────────────────────────────────────────────────

    describe('Java excluyente', () => {

        test('detecta Java como tecnología excluyente', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador Java Junior',
                descripcion: 'Buscamos desarrollador Java con Spring Boot.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('java');
        });

        test('NO detecta JavaScript como Java', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador JavaScript Junior',
                descripcion: 'Buscamos desarrollador JavaScript con React.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        test('NO detecta JavaScript cuando dice "con JavaScript"', () => {
            const oferta = crearOferta({
                descripcion: 'Experiencia con JavaScript, TypeScript y Node.js.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        test('detecta Java junto con otras tecnologías', () => {
            const oferta = crearOferta({
                descripcion: 'Requisitos: Java, SQL, Git. Excluyente.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta Spring Boot como ecosistema Java', () => {
            const oferta = crearOferta({
                descripcion: 'Desarrollador backend con Spring Boot.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('spring_boot');
        });

        test('detecta Hibernate como ecosistema Java', () => {
            const oferta = crearOferta({
                descripcion: 'Desarrollador con experiencia en Hibernate.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('hibernate');
        });

        test('detecta J2EE como ecosistema Java', () => {
            const oferta = crearOferta({
                descripcion: 'Desarrollador J2EE para proyecto bancario.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('NO detecta JavaScript cuando dice "conocimientos de JavaScript"', () => {
            const oferta = crearOferta({
                descripcion: 'Se requiere conocimientos de JavaScript y React.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        test('detecta Java en el título de la oferta', () => {
            const oferta = crearOferta({
                titulo: 'Java Developer Senior',
                descripcion: 'Buscamos Java Developer.',
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta Java en datos_crudos', () => {
            const oferta = crearOferta({
                descripcion: '',
                datos_crudos: { description: 'Java backend developer needed' },
            });
            const resultado = detectarJavaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: Senior/SR/Lead excluyente
    // ──────────────────────────────────────────────────────────

    describe('Senior/SR/Lead excluyente', () => {

        test('detecta "Senior" en la oferta', () => {
            const oferta = crearOferta({
                titulo: 'Senior Frontend Developer',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "SR" en la oferta', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador SR',
                descripcion: 'Buscamos desarrollador SR con experiencia.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "Tech Lead" en la oferta', () => {
            const oferta = crearOferta({
                titulo: 'Tech Lead',
                descripcion: 'Buscamos Tech Lead para el equipo.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('tech_lead');
        });

        test('detecta "Team Lead" en la oferta', () => {
            const oferta = crearOferta({
                descripcion: 'Posición de Team Lead para el proyecto.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('team_lead');
        });

        test('detecta "Lead Developer" en la oferta', () => {
            const oferta = crearOferta({
                descripcion: 'Buscamos Lead Developer con experiencia.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('lead_developer');
        });

        test('detecta "Lead Engineer" en la oferta', () => {
            const oferta = crearOferta({
                descripcion: 'Lead Engineer para el equipo de backend.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('lead_engineer');
        });

        test('detecta "Líder" en la oferta', () => {
            const oferta = crearOferta({
                descripcion: 'Buscamos Líder de equipo.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('lider');
        });

        // Spec: lead FP — "lead initiatives" NO excluye (falso positivo corregido)
        test('NO detecta "lead initiatives" como seniority (falso positivo corregido)', () => {
            // Spec: reglas-exclusion-lead-FP
            const oferta = crearOferta({
                descripcion: 'You will lead initiatives across multiple teams.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        // Spec: lead FP — "lead generation" NO excluye (marketing, no rol)
        test('NO detecta "lead generation" como seniority (falso positivo corregido)', () => {
            // Spec: reglas-exclusion-lead-FP
            const oferta = crearOferta({
                descripcion: 'Experiencia en lead generation y marketing digital.',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        test('NO detecta "junior" como seniority excluyente', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador Junior',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        test('NO detecta "trainee" como seniority excluyente', () => {
            const oferta = crearOferta({
                titulo: 'QA Trainee',
            });
            const resultado = detectarSeniorityExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: Experiencia mayor a 3 años excluyente
    // ──────────────────────────────────────────────────────────

    describe('Experiencia excluyente (3+ años)', () => {

        test('detecta "3+ años" como experiencia excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'Se requieren 3+ años de experiencia.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta ">3 años" y "mayor a 3 años" como experiencia excluyente', () => {
            // Caso 1: notación ">3 años" literal
            const ofertaLiteral = crearOferta({
                descripcion: 'Se requiere >3 años de experiencia.',
            });
            const resultadoLiteral = detectarExperienciaExcluyente(ofertaLiteral);
            expect(resultadoLiteral.detectado).toBe(true);

            // Caso 2: texto natural "mayor a 3 años"
            const ofertaNatural = crearOferta({
                descripcion: 'Experiencia mayor a 3 años requerida.',
            });
            const resultadoNatural = detectarExperienciaExcluyente(ofertaNatural);
            expect(resultadoNatural.detectado).toBe(true);
        });

        test('detecta "al menos 3 años"', () => {
            const oferta = crearOferta({
                descripcion: 'Al menos 3 años de experiencia.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "mínimo 3 años"', () => {
            const oferta = crearOferta({
                descripcion: 'Mínimo 3 años de experiencia comprobable.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "at least 3 years" en inglés', () => {
            const oferta = crearOferta({
                descripcion: 'At least 3 years of experience required.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "4+ años" como experiencia excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'Se requieren 4+ años de experiencia.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "5+ años"', () => {
            const oferta = crearOferta({
                descripcion: '5+ años de experiencia.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('NO detecta "3 meses" como experiencia excluyente (falso positivo)', () => {
            const oferta = crearOferta({
                descripcion: 'Capacitación de 3 meses.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });

        test('detecta "más de 3 años"', () => {
            const oferta = crearOferta({
                descripcion: 'Más de 3 años de experiencia.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "mas de 3 anos" (sin acento)', () => {
            const oferta = crearOferta({
                descripcion: 'Mas de 3 anos de experiencia.',
            });
            const resultado = detectarExperienciaExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        // Spec: regresión razón experiencia 3+ — la razón debe mencionar variantes comunes
        test('la razón de exclusión por experiencia menciona variantes comunes', () => {
            const oferta = crearOferta({
                descripcion: 'Se requieren 3+ años de experiencia.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.razon).toContain('3 o más años');
            expect(resultado.razon).toContain('3+');
            expect(resultado.razon).toContain('requisito excluyente');
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: Inglés excluyente
    // ──────────────────────────────────────────────────────────

    describe('Inglés excluyente', () => {

        test('detecta "inglés fluido" como excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'Se requiere inglés fluido.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "inglés avanzado" como excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'Inglés avanzado excluyente.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "bilingual" como excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'We need a bilingual candidate.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "daily standups in English"', () => {
            const oferta = crearOferta({
                descripcion: 'Daily standups in English required.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "English-speaking team"', () => {
            const oferta = crearOferta({
                descripcion: 'Join our English-speaking team.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "inglés requerido"', () => {
            const oferta = crearOferta({
                descripcion: 'Inglés requerido para el puesto.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "conversational English"', () => {
            const oferta = crearOferta({
                descripcion: 'Conversational English required.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('detecta "upper-intermediate"', () => {
            const oferta = crearOferta({
                descripcion: 'Upper-intermediate English level.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(true);
        });

        test('NO detecta "inglés deseable" como excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'Inglés deseable, no excluyente.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            // "deseable" no está en los patrones excluyentes, así que no detecta.
            expect(resultado.detectado).toBe(false);
        });

        test('NO detecta "inglés básico" como excluyente', () => {
            const oferta = crearOferta({
                descripcion: 'Se requiere inglés básico para leer documentación.',
            });
            const resultado = detectarInglesExcluyente(oferta);
            expect(resultado.detectado).toBe(false);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: Ubicación presencial fuera de zona
    // ──────────────────────────────────────────────────────────

    describe('Ubicación/modalidad incompatible', () => {

        test('presencial fuera de zona preferida es excluida', () => {
            const oferta = crearOferta({
                ubicacion: 'Córdoba, Argentina',
                modalidad: 'presencial',
            });
            const resultado = detectarUbicacionIncompatible(oferta, preferenciasBase);
            expect(resultado.detectado).toBe(true);
        });

        test('presencial DENTRO de zona preferida NO es excluida', () => {
            const oferta = crearOferta({
                ubicacion: 'CABA, Argentina',
                modalidad: 'presencial',
            });
            const resultado = detectarUbicacionIncompatible(oferta, preferenciasBase);
            expect(resultado.detectado).toBe(false);
        });

        test('remoto NO es excluida por ubicación', () => {
            const oferta = crearOferta({
                ubicacion: 'Madrid, España',
                modalidad: 'remoto',
            });
            const resultado = detectarUbicacionIncompatible(oferta, preferenciasBase);
            expect(resultado.detectado).toBe(false);
        });

        test('híbrido NO es excluida por ubicación', () => {
            const oferta = crearOferta({
                ubicacion: 'Rosario, Argentina',
                modalidad: 'híbrido',
            });
            const resultado = detectarUbicacionIncompatible(oferta, preferenciasBase);
            expect(resultado.detectado).toBe(false);
        });

        test('sin zonas preferidas no excluye por ubicación', () => {
            const oferta = crearOferta({
                ubicacion: 'Mendoza, Argentina',
                modalidad: 'presencial',
            });
            const prefsSinZonas = { ...preferenciasBase, zonas_preferidas: [] };
            const resultado = detectarUbicacionIncompatible(oferta, prefsSinZonas);
            expect(resultado.detectado).toBe(false);
        });

        test('ubicación vacía con presencial es excluida si no coincide', () => {
            const oferta = crearOferta({
                ubicacion: '',
                modalidad: 'presencial',
            });
            const resultado = detectarUbicacionIncompatible(oferta, preferenciasBase);
            // Ubicación vacía nunca coincide con las zonas.
            expect(resultado.detectado).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: Bonus IA no compensa Java
    // ──────────────────────────────────────────────────────────

    describe('Bonus IA no compensa exclusiones', () => {

        test('oferta con Java + mención de IA sigue excluida', () => {
            const oferta = crearOferta({
                titulo: 'Java Developer con Copilot',
                descripcion: 'Buscamos desarrollador Java Senior con experiencia en GitHub Copilot y IA generativa.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.match).toBe(false);
            expect(resultado.reglas).toContain('java');
        });

        test('oferta con Java + Next.js sigue excluida', () => {
            const oferta = crearOferta({
                descripcion: 'Desarrollador Java Spring Boot. Next.js es un plus.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.match).toBe(false);
            expect(resultado.reglas).toContain('java');
        });

        test('oferta con Senior + IA sigue excluida', () => {
            const oferta = crearOferta({
                titulo: 'Senior Full Stack Developer',
                descripcion: 'Buscamos Senior Developer con experiencia en Claude Code y IA.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.match).toBe(false);
            expect(resultado.reglas).toContain('seniority');
        });

        test('oferta con inglés excluyente + IA sigue excluida', () => {
            const oferta = crearOferta({
                descripcion: 'Inglés fluido excluyente. Se usa IA para productividad.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.reglas).toContain('idioma');
        });
    });

    // ──────────────────────────────────────────────────────────
    // Spec: evaluarReglasExclusion — función principal
    // ──────────────────────────────────────────────────────────

    describe('evaluarReglasExclusion() — función principal', () => {

        test('oferta sin exclusiones devuelve excluida: false', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador Frontend Junior',
                descripcion: 'Buscamos desarrollador frontend con React y TypeScript. Nivel junior.',
                modalidad: 'remoto',
                ubicacion: 'Buenos Aires, Argentina',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(false);
            expect(resultado.match).toBe(true);
            expect(resultado.reglas).toEqual([]);
        });

        test('oferta con Java devuelve porcentaje 10', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador Java Junior',
                descripcion: 'Buscamos desarrollador Java.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.porcentaje).toBe(PORCENTAJE_EXCLUSION.java);
            expect(resultado.porcentaje).toBe(10);
        });

        test('oferta Senior devuelve porcentaje 15', () => {
            const oferta = crearOferta({
                titulo: 'Senior Developer',
                descripcion: 'Buscamos Senior Developer.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.porcentaje).toBe(PORCENTAJE_EXCLUSION.seniority);
            expect(resultado.porcentaje).toBe(15);
        });

        test('oferta con 3+ años devuelve porcentaje 20', () => {
            const oferta = crearOferta({
                descripcion: 'Se requieren 3+ años de experiencia.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.porcentaje).toBe(PORCENTAJE_EXCLUSION.experiencia);
            expect(resultado.porcentaje).toBe(20);
        });

        test('oferta con inglés excluyente devuelve porcentaje 15', () => {
            const oferta = crearOferta({
                descripcion: 'Inglés fluido requerido.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.porcentaje).toBe(PORCENTAJE_EXCLUSION.idioma);
            expect(resultado.porcentaje).toBe(15);
        });

        test('presencial fuera de zona devuelve porcentaje 10', () => {
            const oferta = crearOferta({
                ubicacion: 'Córdoba, Argentina',
                modalidad: 'presencial',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.porcentaje).toBe(PORCENTAJE_EXCLUSION.ubicacion_modalidad);
            expect(resultado.porcentaje).toBe(10);
        });

        test('múltiples exclusiones se registran en reglas[]', () => {
            const oferta = crearOferta({
                titulo: 'Senior Java Developer',
                descripcion: 'Buscamos Senior Java Developer con 3+ años de experiencia. Inglés fluido requerido.',
                modalidad: 'presencial',
                ubicacion: 'Mendoza, Argentina',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(true);
            expect(resultado.reglas.length).toBeGreaterThanOrEqual(3);
            expect(resultado.reglas).toContain('java');
            expect(resultado.reglas).toContain('seniority');
            expect(resultado.reglas).toContain('experiencia');
        });

        test('la razón describe la primera exclusión', () => {
            const oferta = crearOferta({
                descripcion: 'Desarrollador Java Junior.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.razon).toContain('Java');
        });

        test('oferta JavaScript sin exclusiones pasa correctamente', () => {
            const oferta = crearOferta({
                titulo: 'Desarrollador JavaScript Junior',
                descripcion: 'Buscamos desarrollador JavaScript con React. Nivel junior. Remoto.',
            });
            const resultado = evaluarReglasExclusion(oferta, preferenciasBase);

            expect(resultado.excluida).toBe(false);
            expect(resultado.match).toBe(true);
        });
    });
});