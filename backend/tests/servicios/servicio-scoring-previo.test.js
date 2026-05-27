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
        test('expone detectarSeniority, detectarIdioma, detectarRolObjetivo, detectarHealthTech', () => {
            expect(typeof servicioScoringPrevio._internas.detectarSeniority).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarIdioma).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarRolObjetivo).toBe('function');
            expect(typeof servicioScoringPrevio._internas.detectarHealthTech).toBe('function');
        });
    });
});
