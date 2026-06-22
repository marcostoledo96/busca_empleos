// Tests para el servicio de scoring previo (servicio-scoring-previo.js).
//
// El scoring previo calcula un score deterministico (0-100) basado en reglas
// claras antes de llamar a DeepSeek. Es 100% testeable porque no depende
// de una LLM.

const servicioScoringPrevio = require('../../src/servicios/servicio-scoring-previo');

// Mockeo el modelo de preferencias para aislar el servicio.
jest.mock('../../src/modelos/preferencia', () => ({
    obtenerPreferencias: jest.fn(),
}));

describe('Servicio de scoring previo — calcularScorePrevio()', () => {

    // Perfil base de Marcos (simplificado para testing).
    const perfilBase = () => ({
        nivel_experiencia: 'junior',
        tecnologias_detalle: [
            { nombre: 'React', nivel: 'medio', categoria: 'frontend', aliases: ['react', 'react.js'] },
            { nombre: 'Angular', nivel: 'avanzado', categoria: 'frontend', aliases: ['angular'] },
            { nombre: 'TypeScript', nivel: 'medio', categoria: 'lenguaje', aliases: ['typescript', 'ts'] },
            { nombre: 'JavaScript', nivel: 'avanzado', categoria: 'lenguaje', aliases: ['javascript', 'js'] },
            { nombre: 'Node.js', nivel: 'medio', categoria: 'backend', aliases: ['node.js', 'nodejs'] },
            { nombre: 'Git', nivel: 'avanzado', categoria: 'herramienta', aliases: ['git'] },
        ],
        roles_objetivo_detalle: [
            { rol: 'Desarrollador Frontend', prioridad: 'alta', aliases: ['frontend developer', 'desarrollador frontend'] },
            { rol: 'QA Tester', prioridad: 'alta', aliases: ['qa', 'tester', 'qa manual', 'testing funcional'] },
        ],
        scoring_config: { umbral_aprobacion: 60 },
        conocimientos_ausentes: [],
    });

    // Oferta vacia (sin tecnologias, sin seniority, sin roles, en espanol).
    const ofertaVacia = () => ({
        titulo: '',
        descripcion: '',
        empresa: '',
        ubicacion: '',
        modalidad: '',
        datos_crudos: null,
    });

    describe('oferta vacia', () => {
        test('devuelve el score base de 50', () => {
            const resultado = servicioScoringPrevio.calcularScorePrevio(ofertaVacia(), perfilBase());
            expect(resultado.score_previo).toBe(50);
            expect(resultado.match_previo).toBe(false); // 50 < 60
            expect(resultado.tecnologias.dominadas).toHaveLength(0);
            expect(resultado.tecnologias.desconocidas).toHaveLength(0);
        });
    });

    describe('oferta con tecnologias del stack', () => {
        test('suma puntos por tecnologias dominadas y el score supera el base', () => {
            const oferta = {
                titulo: 'Desarrollador Frontend React y Angular',
                descripcion: 'Buscamos frontend developer con TypeScript y JavaScript. Usamos Node.js y Git.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            // Verifico que detecto tecnologias y sumo puntos.
            const bonificacionTotal = resultado.tecnologias.dominadas.reduce(
                (acc, d) => acc + d.puntos, 0
            );
            expect(bonificacionTotal).toBeGreaterThan(0);
            expect(resultado.score_previo).toBeGreaterThan(50);
        });
    });

    describe('oferta con tecnologia excluida (Java)', () => {
        test('aplica penalizacion cuando la oferta menciona una tecnologia ausente', () => {
            const perfil = {
                ...perfilBase(),
                conocimientos_ausentes: ['Java'],
            };

            const oferta = {
                titulo: 'Desarrollador Java Junior',
                descripcion: 'Se requiere conocimiento en Java y Spring Boot.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfil);

            // Java esta en conocimientos_ausentes → penalizacion de 5 puntos.
            expect(resultado.perfil_ampliado.penalizacion_ausentes).toBe(5);
            expect(resultado.perfil_ampliado.conocimientos_ausentes_detectados).toContain('Java');
            expect(resultado.score_previo).toBeLessThan(50);
        });
    });

    describe('oferta con seniority alto', () => {
        test('penaliza ofertas Senior (SR/Director)', () => {
            const oferta = {
                titulo: 'Senior Software Engineer',
                descripcion: 'Buscamos senior developer con amplia experiencia.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.seniority.penalizacion).toBe(30);
            expect(resultado.score_previo).toBeLessThanOrEqual(20); // 50 - 30
        });

        test('penaliza ofertas Semi Senior (SSR)', () => {
            const oferta = {
                titulo: 'Desarrollador Semi Senior en React',
                descripcion: 'Buscamos desarrollador con experiencia semi senior.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            // Detecta senales de seniority y penaliza.
            expect(resultado.seniority.penalizacion).toBeGreaterThan(0);
            expect(resultado.score_previo).toBeLessThan(50);
        });

        test('NO penaliza ofertas Trainee / Junior', () => {
            const oferta = {
                titulo: 'Trainee Developer',
                descripcion: 'Buscamos trainee para capacitacion de 3 meses.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.seniority.penalizacion).toBe(0);
            expect(resultado.score_previo).toBe(50);
        });
    });

    describe('oferta con ingles avanzado requerido', () => {
        test('penaliza fuertemente si requiere fluidez o bilinguismo', () => {
            const oferta = {
                titulo: 'Frontend Developer',
                descripcion: 'English speaking team. Daily meetings in english. Fluent english required.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.ingles.requiereAvanzado).toBe(true);
            expect(resultado.ingles.penalizacion).toBe(50);
            expect(resultado.score_previo).toBeLessThanOrEqual(20); // 50 - 50, clamp 0-100
        });

        test('penaliza levemente si el texto esta en ingles (sin exigir fluidez)', () => {
            const oferta = {
                titulo: 'Frontend Developer',
                descripcion: 'We are looking for a developer with experience. The company offers remote job. Apply now.',
                empresa: 'Company',
                ubicacion: 'Remote',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            const penalizacion = resultado.ingles.penalizacion;
            expect(penalizacion).toBeGreaterThan(0);
            expect(penalizacion).toBeLessThan(50);
        });
    });

    describe('oferta en idioma no espanol (portugues)', () => {
        test('penaliza MUY fuertemente ofertas en portugues', () => {
            const oferta = {
                titulo: 'Desenvolvedor Junior',
                descripcion: 'Vaga para desenvolvedor junior remoto. Para integrar nosso time. Nossas pessoas. Brasil.',
                empresa: 'Empresa',
                ubicacion: 'Brasil',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.ingles.parecePortugues).toBe(true);
            expect(resultado.ingles.penalizacion).toBe(60);
            expect(resultado.score_previo).toBeLessThanOrEqual(0);
        });
    });

    describe('oferta HealthTech', () => {
        test('detecta sector salud y suma bonus', () => {
            const oferta = {
                titulo: 'Desarrollador Frontend',
                descripcion: 'App de historia clinica para pacientes de un hospital. Trabajo en salud.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.healthtech).toBe(true);
            expect(resultado.score_previo).toBeGreaterThanOrEqual(55);
        });
    });

    // Nota: el servicio de scoring previo no tiene logica explicita de penalizacion
    // por "zona fuera de preferencias + presencial". Este caso queda como gap
    // documentado.
    describe('zona fuera de preferencias + presencial (gap documentado)', () => {
        test('no aplica penalizacion actualmente — logica no implementada', () => {
            const oferta = {
                titulo: 'Desarrollador',
                descripcion: 'Trabajo presencial en Mendoza.',
                empresa: 'Empresa',
                ubicacion: 'Mendoza',
                modalidad: 'presencial',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            // El score base es 50, no hay penalizacion de zona.
            expect(resultado.score_previo).toBe(50);
        });
    });

    describe('preferencias no definidas (fallback)', () => {
        test('no rompe si perfil es undefined o un objeto vacio', () => {
            const oferta = { titulo: 'Test', descripcion: '', empresa: '', ubicacion: '', modalidad: '' };

            // Con perfil undefined.
            const resultadoUndefined = servicioScoringPrevio.calcularScorePrevio(oferta, undefined);
            expect(resultadoUndefined.score_previo).toBe(50);

            // Con perfil vacio.
            const resultadoVacio = servicioScoringPrevio.calcularScorePrevio(oferta, {});
            expect(resultadoVacio.score_previo).toBe(50);
        });
    });

    describe('match previo segun umbral', () => {
        test('match_previo es true si score >= umbral_aprobacion', () => {
            const oferta = {
                titulo: 'QA Tester Junior',
                descripcion: 'QA Manual, testing funcional con Jest y Jira.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.umbral_aprobacion).toBe(60);
            expect(resultado.match_previo).toBe(resultado.score_previo >= 60);
        });
    });

    describe('export de funciones internas', () => {
        test('expone detectarSeniority, detectarIdioma, detectarRolObjetivo, detectarHealthTech, calcularBonusIA, detectarExperienciaExcluyente', () => {
            expect(typeof servicioScoringPrevio._internas.detectarSeniority).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarIdioma).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarRolObjetivo).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarHealthTech).toBe('function');
            expect(typeof servicioScoringPrevio._internas.calcularBonusIA).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarExperienciaExcluyente).toBe('function');
        });
    });

    // === Tests de bonus IA / Next.js ===

    describe('bonus por herramientas IA', () => {
        test('oferta compatible recibe bonus IA cuando menciona herramientas de IA', () => {
            const oferta = {
                titulo: 'Desarrollador Junior React',
                descripcion: 'Buscamos desarrollador junior con React. Usamos Claude Code y Copilot para productividad.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            // Debe detectar herramientas IA y aplicar bonus.
            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.bonus_ia_aplicado).toBeGreaterThan(0);
            expect(resultado.score_previo).toBeGreaterThan(50); // Base + bonus
        });

        test('bonus IA solo, sin Next.js', () => {
            const oferta = {
                titulo: 'QA Tester Junior',
                descripcion: 'Buscamos QA con experiencia en prompt engineering y herramientas de IA para testing.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.nextjs_detectado).toBe(false);
            expect(resultado.bonus_ia.bonus_ia_aplicado).toBeGreaterThan(0);
        });

        test('bonus Next.js solo, sin IA', () => {
            const oferta = {
                titulo: 'Frontend Junior Next.js',
                descripcion: 'Buscamos desarrollador frontend con Next.js y React.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.nextjs_detectado).toBe(true);
            expect(resultado.bonus_ia.herramientas_detectadas.length).toBe(0);
            expect(resultado.bonus_ia.bonus_ia_aplicado).toBeGreaterThan(0);
        });

        test('bonus combinado IA + Next.js respeta cap máximo de +8', () => {
            const oferta = {
                titulo: 'Full Stack Junior',
                descripcion: 'Desarrollador junior con Next.js, React y experiencia en Claude Code y prompt engineering.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.nextjs_detectado).toBe(true);
            // El bonus combinado no puede superar +8.
            expect(resultado.bonus_ia.bonus_ia_aplicado).toBeLessThanOrEqual(8);
        });

        test('regex genérico "ai" NO genera falsos positivos', () => {
            const oferta = {
                titulo: 'Desarrollador Junior',
                descripcion: 'Buscamos alguien con habilidades de comunicación y trabajo en equipo.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.herramientas_detectadas.length).toBe(0);
            expect(resultado.bonus_ia.bonus_ia_aplicado).toBe(0);
        });
    });

    describe('salvaguardas del bonus IA', () => {
        test('Java excluyente: bonus IA no compensa', () => {
            const perfilConJava = {
                ...perfilBase(),
                reglas_exclusion: ['Java'],
            };

            const oferta = {
                titulo: 'Desarrollador Java Junior',
                descripcion: 'Buscamos desarrollador Java con Spring Boot. Usamos ChatGPT y Next.js.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilConJava);

            // El bonus IA debe estar limitado por el cap de Java.
            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.salvaguardas.java_excluyente_aplicado).toBe(true);
            expect(resultado.score_previo).toBeLessThanOrEqual(35);
        });

        test('Senior: bonus IA no compensa seniority alto', () => {
            const oferta = {
                titulo: 'Senior AI Engineer',
                descripcion: 'Buscamos Senior Engineer con experiencia en Claude Code y LLMs.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.salvaguardas.senior_excluyente_aplicado).toBe(true);
            expect(resultado.score_previo).toBeLessThanOrEqual(45);
        });

        test('Inglés excluyente: bonus IA no compensa', () => {
            const oferta = {
                titulo: 'Developer with AI tools',
                descripcion: 'We need a developer fluent in English. Experience with Codex and AI tools required.',
                empresa: 'Company',
                ubicacion: 'Remote',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.salvaguardas.ingles_excluyente_aplicado).toBe(true);
            expect(resultado.score_previo).toBeLessThanOrEqual(15);
        });

        test('JavaScript NO discla exclusión Java', () => {
            const oferta = {
                titulo: 'Frontend Developer',
                descripcion: 'Buscamos desarrollador con JavaScript, Next.js y AI tools.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            // No debe aplicar salvaguarda de Java porque la oferta no menciona Java.
            expect(resultado.bonus_ia.salvaguardas.java_excluyente_aplicado).toBe(false);
            // Debe detectar Next.js y AI tools.
            expect(resultado.bonus_ia.bonus_ia_aplicado).toBeGreaterThan(0);
        });
    });

    // === Tests de experiencia excluyente ===

    describe('experiencia excluyente (>3 años, Lead, etc.)', () => {
        test('detecta "Al menos 3 años" como experiencia excluyente y aplica cap', () => {
            const oferta = {
                titulo: 'Desarrollador Full Stack',
                descripcion: 'Se requiere al menos 3 años de experiencia. Usamos Next.js y herramientas de IA como Copilot.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(true);
            // El score debe quedar por debajo del umbral de aprobación.
            expect(resultado.score_previo).toBeLessThanOrEqual(45);
            expect(resultado.match_previo).toBe(false);
        });

        test('detecta ">3 años" como experiencia excluyente', () => {
            const oferta = {
                titulo: 'Backend Developer',
                descripcion: 'Buscamos desarrollador con >3 años de experiencia en Node.js.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(true);
        });

        test('detecta "3+ años" como experiencia excluyente', () => {
            const oferta = {
                titulo: 'Frontend Developer',
                descripcion: '3+ años de experiencia requeridos. Angular y React.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(true);
        });

        test('detecta "mínimo 3 años" (con acento) como experiencia excluyente', () => {
            const oferta = {
                titulo: 'DevOps Engineer',
                descripcion: 'Mínimo 3 años de experiencia en infraestructura cloud.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
        });

        test('detecta "minimo 3 anos" (sin acentos, sin ñ) como experiencia excluyente', () => {
            const oferta = {
                titulo: 'QA Tester',
                descripcion: 'Minimo 3 anos de experiencia en testing automatizado.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
        });

        test('detecta "at least 3 years" (inglés) como experiencia excluyente', () => {
            const oferta = {
                titulo: 'Software Engineer',
                descripcion: 'We need at least 3 years of experience with React.',
                empresa: 'Company',
                ubicacion: 'Remote',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
        });

        test('detecta "4+ años" y "5+ años" como experiencia excluyente', () => {
            const oferta4 = {
                titulo: 'Senior Developer',
                descripcion: '4+ años de experiencia requeridos.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado4 = servicioScoringPrevio.calcularScorePrevio(oferta4, perfilBase());
            expect(resultado4.experiencia_excluyente.detectado).toBe(true);

            const oferta5 = {
                titulo: 'Lead Developer',
                descripcion: '5+ años de experiencia requeridos.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado5 = servicioScoringPrevio.calcularScorePrevio(oferta5, perfilBase());
            expect(resultado5.experiencia_excluyente.detectado).toBe(true);
        });

        test('detecta "Tech Lead" como experiencia excluyente', () => {
            const oferta = {
                titulo: 'Tech Lead',
                descripcion: 'Buscamos Tech Lead para equipo de desarrollo.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(true);
        });

        test('detecta "Team Lead" como experiencia excluyente', () => {
            const oferta = {
                titulo: 'Team Lead',
                descripcion: 'Buscamos Team Lead para el área de tecnología.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
        });

        test('detecta "Lead Developer" como experiencia excluyente', () => {
            const oferta = {
                titulo: 'Lead Developer',
                descripcion: 'Buscamos Lead Developer con experiencia en React.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
        });

        test('NO detecta "2 años de experiencia" como excluyente', () => {
            const oferta = {
                titulo: 'Desarrollador Junior',
                descripcion: 'Se valoran 2 años de experiencia. Angular y Node.js.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(false);
        });

        test('NO detecta "3 meses de capacitación" como excluyente (falso positivo)', () => {
            const oferta = {
                titulo: 'Trainee Developer',
                descripcion: 'Programa de capacitación de 3 meses para juniors.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(false);
        });

        test('"Al menos 3 años" + Next.js + IA: bonus NO compensa, score queda con cap', () => {
            const oferta = {
                titulo: 'Full Stack Developer',
                descripcion: 'Al menos 3 años de experiencia. Trabajamos con Next.js, React, Claude Code y Copilot.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            // Debe detectar experiencia excluyente.
            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(true);
            // Debe detectar herramientas IA y Next.js.
            expect(resultado.bonus_ia.herramientas_detectadas.length).toBeGreaterThanOrEqual(1);
            expect(resultado.bonus_ia.nextjs_detectado).toBe(true);
            // El bonus IA se suma al score pero el cap de experiencia excluyente lo limita.
            expect(resultado.score_previo).toBeLessThanOrEqual(45);
            expect(resultado.match_previo).toBe(false);
        });

        test('experiencia excluyente con "3+ anos" (sin ñ): bonus IA no compensa', () => {
            const oferta = {
                titulo: 'Desarrollador Backend',
                descripcion: '3+ anos de experiencia. Usamos IA tools y Node.js.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(true);
            expect(resultado.score_previo).toBeLessThanOrEqual(45);
        });

        test('oferta sin experiencia excluyente: no aplica cap', () => {
            const oferta = {
                titulo: 'Desarrollador Junior React',
                descripcion: 'Buscamos desarrollador junior con React y Node.js. Usamos Copilot.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.experiencia_excluyente.detectado).toBe(false);
            expect(resultado.bonus_ia.salvaguardas.experiencia_excluyente_aplicado).toBe(false);
            // No hay cap de experiencia excluyente, el score puede ser alto.
            expect(resultado.score_previo).toBeGreaterThan(50);
        });

        test('experiencia excluyente combinada con Java: aplica el cap más bajo', () => {
            const perfilConJava = {
                ...perfilBase(),
                reglas_exclusion: ['Java'],
            };

            const oferta = {
                titulo: 'Java Developer',
                descripcion: 'Al menos 3 años de experiencia en Java con Spring Boot.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilConJava);

            expect(resultado.bonus_ia.salvaguardas.java_excluyente_aplicado).toBe(true);
            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            // El cap de Java (35) es más bajo que el de experiencia (45).
            expect(resultado.score_previo).toBeLessThanOrEqual(35);
        });

        test('experiencia excluyente combinada con Senior: aplica el cap más bajo', () => {
            const oferta = {
                titulo: 'Senior Developer',
                descripcion: 'Senior Developer con al menos 3 años de experiencia.',
                empresa: 'Empresa',
                ubicacion: 'CABA',
                modalidad: 'remoto',
                datos_crudos: null,
            };

            const resultado = servicioScoringPrevio.calcularScorePrevio(oferta, perfilBase());

            expect(resultado.bonus_ia.salvaguardas.senior_excluyente_aplicado).toBe(true);
            expect(resultado.experiencia_excluyente.detectado).toBe(true);
            // Ambos caps son 45, el score queda limitado.
            expect(resultado.score_previo).toBeLessThanOrEqual(45);
        });
    });
});
