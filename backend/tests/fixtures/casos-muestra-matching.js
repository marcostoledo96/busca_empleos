// Fixture de 25 casos sintéticos de prueba para el motor de matching explicable y coherente.
//
// Cada caso cubre un escenario clave del motor:
// - Compatibilidad en QA, Soporte y Desarrollo Angular.
// - Reglas determinísticas de exclusión (Java, Seniority, Experiencia, Inglés, Ubicación).
// - Distinción de contextos (mentores, empresas líderes, trayectoria institucional vs requisitos del candidato).
// - Avisos incompletos y descripciones parciales (Bumeran/tarjetas) vs completas y ausentes.
// - Manejo de incertidumbre (por_confirmar).
// - Validación de coherencia lógica (porcentajes incompatibles, sin exclusión, fuera de rango o vacíos).
// - Respaldo y compatibilidad retroactiva con ofertas legacy.
//
// Todos los casos están marcados con estado_revision: 'propuesta_pendiente_revision_humana'.

'use strict';

const PERFIL_MARCOS_BASE = {
    nombre: 'Marcos Ezequiel Toledo',
    nivel_experiencia: 'Junior',
    roles_objetivo: ['QA Tester Manual', 'Soporte IT', 'Desarrollador Junior', 'Frontend Developer'],
    stack_tecnologico: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Angular', 'React', 'Node.js', 'Express', 'SQL', 'PostgreSQL', 'C#', '.NET'],
    nivel_ingles: 'Intermedio técnico (lectura/escritura)',
    reglas_exclusion: ['Java', 'Senior', 'SR', 'Lead', '3+ años', 'Inglés avanzado fluido'],
    zonas_preferidas: ['CABA', 'Buenos Aires', 'Capital Federal'],
};

const CASOS_MUESTRA_MATCHING = [
    // Caso 1: QA manual compatible
    {
        id: 'caso-01-qa-manual-compatible',
        titulo: 'QA Tester Manual Junior',
        empresa: 'FinTech Soluciones',
        ubicacion: 'CABA',
        modalidad: 'Híbrido',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos QA Tester Manual Junior para sumarse al equipo de calidad. Tareas: diseño y ejecución de casos de prueba, reporte de bugs en Jira, validación de APIs con Postman y consultas SQL básicas para verificación de datos. No se requiere experiencia previa en automatización.',
        perfil: { ...PERFIL_MARCOS_BASE, perfil_profesional: 'Diseño y ejecución de casos de prueba.' },
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 85,
            razon: 'El perfil de Marcos como QA Tester junior con manejo de SQL y testing funcional coincide con la vacante.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Diseño y ejecución de casos de prueba', tipo: 'obligatorio', evidencia_oferta: 'diseño y ejecución de casos de prueba', evidencia_perfil: 'Diseño y ejecución de casos de prueba.', explicacion: 'Práctica declarada en el perfil sintético' },
                    { requisito: 'SQL', tipo: 'obligatorio', evidencia_oferta: 'consultas SQL básicas', evidencia_perfil: 'SQL', explicacion: 'Cumple conocimientos de bases de datos' },
                ],
                no_cumplidos: [],
                por_confirmar: [
                    { requisito: 'Postman', tipo: 'deseable', evidencia_oferta: 'validación de APIs con Postman', evidencia_perfil: '', explicacion: 'Herramienta a validar' },
                ],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje_min: 70, excluida: false, inconsistente: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['QA Tester Manual', 'casos de prueba', 'SQL'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 2: Soporte IT compatible
    {
        id: 'caso-02-soporte-it-compatible',
        titulo: 'Analista de Soporte Técnico IT Nivel 1',
        empresa: 'Logística Baires',
        ubicacion: 'CABA',
        modalidad: 'Presencial',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Empresa logística busca Soporte IT Junior para atención a usuarios internos, configuración de software corporativo, resolución de incidencias en puestos de trabajo, redes LAN básicas y gestión de tickets. Modalidad presencial en Barracas, CABA.',
        perfil: { ...PERFIL_MARCOS_BASE, perfil_profesional: 'Soporte IT. Disponibilidad presencial en Barracas, CABA.' },
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 80,
            razon: 'Cumple con el perfil de Soporte IT y la ubicación presencial está dentro de CABA.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Soporte IT', tipo: 'obligatorio', evidencia_oferta: 'Soporte IT Junior para atención a usuarios', evidencia_perfil: 'Soporte IT.', explicacion: 'Coincidencia directa con perfil' },
                    { requisito: 'Barracas', tipo: 'obligatorio', evidencia_oferta: 'Barracas, CABA', evidencia_perfil: 'Disponibilidad presencial en Barracas, CABA.', explicacion: 'Disponibilidad declarada; no infiero residencia desde zonas preferidas' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje_min: 60, excluida: false, inconsistente: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['Soporte IT Junior', 'Barracas, CABA'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 3: Desarrollo Angular compatible
    {
        id: 'caso-03-desarrollo-angular-compatible',
        titulo: 'Desarrollador Frontend Junior (Angular)',
        empresa: 'Software Factory Argentina',
        ubicacion: 'Buenos Aires',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos Desarrollador Frontend Trainee/Junior con conocimientos en Angular, TypeScript, HTML5 y CSS3. Participará en la creación de componentes reutilizables y consumo de servicios REST. Trabajo 100% remoto para Argentina.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 90,
            razon: 'Fuerte coincidencia en stack tecnológico: Angular, TypeScript, HTML y CSS en posición Junior remota.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Angular', tipo: 'obligatorio', evidencia_oferta: 'conocimientos en Angular', evidencia_perfil: 'Angular', explicacion: 'Stack principal' },
                    { requisito: 'TypeScript', tipo: 'obligatorio', evidencia_oferta: 'TypeScript', evidencia_perfil: 'TypeScript', explicacion: 'Lenguaje declarado' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje_min: 75, excluida: false, inconsistente: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['Angular', 'TypeScript', 'Frontend'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 4: Requisito Java obligatorio (exclusión)
    {
        id: 'caso-04-requisito-java-obligatorio',
        titulo: 'Desarrollador Backend Junior (Java / Spring Boot)',
        empresa: 'Banco Digital',
        ubicacion: 'CABA',
        modalidad: 'Híbrido',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos Backend Junior. Requisitos obligatorios: Java 17, Spring Boot, Hibernate y microservicios. Excluyente contar con conocimientos sólidos de Java.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: null,
        resultado_esperado: { match: false, porcentaje: 10, excluida: true, regla: 'java' },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: true },
        evidencias: ['Java 17', 'Spring Boot', 'Excluyente contar con conocimientos sólidos de Java'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 5: Java deseable y no excluyente (no exclusión)
    {
        id: 'caso-05-java-deseable-no-excluyente',
        titulo: 'Desarrollador Frontend Angular / TypeScript',
        empresa: 'Global Tech',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos Frontend Developer Jr con Angular y TypeScript excluyentes. Requisitos deseables: nociones de Java o backend no excluyente.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 80,
            razon: 'Cumple con los requisitos obligatorios de Angular y TypeScript. La mención de Java es solo deseable.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Angular', tipo: 'obligatorio', evidencia_oferta: 'Angular y TypeScript excluyentes', evidencia_perfil: 'Angular', explicacion: 'Cumple' },
                ],
                no_cumplidos: [
                    { requisito: 'Java', tipo: 'deseable', evidencia_oferta: 'nociones de Java no excluyente', evidencia_perfil: 'No trabaja con Java', explicacion: 'Deseable no cumplido, no excluye' },
                ],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje_min: 60, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['Angular', 'Java deseable no excluyente'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 6: Inglés avanzado obligatorio (exclusión)
    {
        id: 'caso-06-ingles-avanzado-obligatorio',
        titulo: 'Fullstack Junior Developer (English Required)',
        empresa: 'US Consulting Partner',
        ubicacion: 'Buenos Aires',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'We are hiring a Junior Developer for our US based client. Requirements: fluent English is mandatory. Daily standups in English and direct client communication.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: null,
        resultado_esperado: { match: false, porcentaje: 15, excluida: true, regla: 'idioma' },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: true },
        evidencias: ['fluent English is mandatory', 'Daily standups in English'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 7: Inglés avanzado deseable (no exclusión)
    {
        id: 'caso-07-ingles-avanzado-deseable',
        titulo: 'Programador Web Junior',
        empresa: 'Agencia Digital BA',
        ubicacion: 'CABA',
        modalidad: 'Híbrido',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos programador web junior con JavaScript y React. Toda la comunicación del equipo es en español. Nivel de inglés intermedio o avanzado es un plus valorable, no excluyente.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 75,
            razon: 'Cumple el stack frontend y la comunicación es en español; inglés avanzado es solo deseable.',
            explicacion: {
                cumplidos: [
                    { requisito: 'JavaScript', tipo: 'obligatorio', evidencia_oferta: 'JavaScript y React', evidencia_perfil: 'JavaScript', explicacion: 'Stack coincide' },
                ],
                no_cumplidos: [
                    { requisito: 'Inglés avanzado', tipo: 'deseable', evidencia_oferta: 'inglés intermedio o avanzado es un plus valorable, no excluyente', evidencia_perfil: 'Inglés técnico básico', explicacion: 'Requisito deseable no bloqueante' },
                ],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje_min: 60, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['comunicación en español', 'inglés avanzado no excluyente'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 8: Mención a un mentor Senior sin exigir seniority al candidato
    {
        id: 'caso-08-mencion-mentor-senior',
        titulo: 'Desarrollador Junior / Trainee',
        empresa: 'Innova Software',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos Desarrollador Junior para integrarse a nuestro equipo. Vas a trabajar junto a un desarrollador Senior que será tu mentor y te acompañará en tu aprendizaje profesional.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 85,
            razon: 'La posición es Junior y la mención de Senior refiere al mentor del equipo, no a la experiencia del candidato.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Junior', tipo: 'obligatorio', evidencia_oferta: 'Desarrollador Junior para integrarse', evidencia_perfil: 'Junior', explicacion: 'Coincide' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['junto a un desarrollador Senior que será tu mentor'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 9: Empresa líder que no busca un candidato líder
    {
        id: 'caso-09-empresa-lider-no-lider-candidato',
        titulo: 'Analista QA Junior',
        empresa: 'Compañía Líder en Retail',
        ubicacion: 'CABA',
        modalidad: 'Híbrido',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Somos una empresa líder en el rubro retail tecnológico. Buscamos un Analista QA Junior para testing de nuestras aplicaciones web.',
        perfil: { ...PERFIL_MARCOS_BASE, perfil_profesional: 'Analista QA Junior.' },
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 80,
            razon: 'El adjetivo líder califica a la empresa y no impone un puesto de liderazgo al candidato.',
            explicacion: {
                cumplidos: [
                    { requisito: 'QA Junior', tipo: 'obligatorio', evidencia_oferta: 'Analista QA Junior', evidencia_perfil: 'Analista QA Junior.', explicacion: 'Apto' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['empresa líder en el rubro retail'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 10: Años de existencia de la empresa frente a años exigidos al candidato
    {
        id: 'caso-10-anios-existencia-empresa-vs-candidato',
        titulo: 'Trainee de Sistemas',
        empresa: 'Corporación Centenaria',
        ubicacion: 'CABA',
        modalidad: 'Presencial',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Con más de 15 años de trayectoria en el mercado, incorporamos a un Trainee de Sistemas sin experiencia previa para capacitarlo. Desarrollo con JavaScript.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 80,
            razon: 'Los 15 años corresponden a la antigüedad de la empresa; no se exige experiencia al postulante.',
            explicacion: {
                cumplidos: [
                    { requisito: 'JavaScript', tipo: 'obligatorio', evidencia_oferta: 'Desarrollo con JavaScript', evidencia_perfil: 'JavaScript', explicacion: 'Acredito la tecnología, no infiero años desde Junior/Trainee' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['15 años de trayectoria en el mercado'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 11: Modalidad y ubicación compatibles (presencial CABA)
    {
        id: 'caso-11-modalidad-ubicacion-compatible-caba',
        titulo: 'Soporte Técnico Presencial Microcentro',
        empresa: 'Estudio Jurídico',
        ubicacion: 'CABA',
        modalidad: 'Presencial',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Se busca técnico de soporte presencial para oficinas en Microcentro, Capital Federal. Configuración de PCs e impresoras.',
        perfil: { ...PERFIL_MARCOS_BASE, perfil_profesional: 'Disponibilidad presencial en Microcentro, Capital Federal.' },
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 75,
            razon: 'Puesto presencial en CABA, dentro de las zonas preferidas del candidato.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Microcentro', tipo: 'obligatorio', evidencia_oferta: 'Microcentro, Capital Federal', evidencia_perfil: 'Disponibilidad presencial en Microcentro, Capital Federal.', explicacion: 'Disponibilidad declarada' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['Microcentro, Capital Federal'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 12: Restricción remota territorial incompatible (remoto solo residentes USA/UE)
    {
        id: 'caso-12-remoto-restriccion-territorial-incompatible',
        titulo: 'Frontend Developer Remote (US Only)',
        empresa: 'American StartUp',
        ubicacion: 'Remoto',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: '100% Remote position. Only applicants based in the United States and eligible to work in the US will be considered. Must be located in the US.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: null,
        resultado_esperado: { match: false, porcentaje: 10, excluida: true, regla: 'ubicacion_modalidad' },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: true },
        evidencias: ['Must be located in the US', 'Only applicants based in the United States'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 13: Descripción parcial conocida (extracto de tarjeta Bumeran)
    {
        id: 'caso-13-descripcion-parcial-tarjeta',
        titulo: 'Desarrollador Junior Angular',
        empresa: 'Empresa Confidencial',
        ubicacion: 'CABA',
        modalidad: 'Híbrido',
        origen_descripcion: 'tarjeta',
        descripcion_completitud: 'parcial',
        descripcion: 'Buscamos Desarrollador Junior Angular para sumarse a importante proyecto...',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 70,
            razon: 'El extracto parcial coincide en título y rol, sin requisitos no mencionados asumidos como ausentes.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Angular', tipo: 'obligatorio', evidencia_oferta: 'Desarrollador Junior Angular', evidencia_perfil: 'Angular', explicacion: 'Coincide' },
                ],
                no_cumplidos: [],
                por_confirmar: [
                    { requisito: 'Herramientas de testing', tipo: 'desconocido', evidencia_oferta: 'Aviso incompleto', evidencia_perfil: '', explicacion: 'Pendiente de confirmación por extracto parcial' },
                ],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['Extracto parcial', 'origen tarjeta'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 14: Descripción ausente
    {
        id: 'caso-14-descripcion-ausente',
        titulo: 'Desarrollador Junior React / Node',
        empresa: 'Consultora IT',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'ausente',
        descripcion: '',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 60,
            razon: 'Título compatible con el perfil junior, pero sin descripción para validar detalles.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Rol Junior React/Node', tipo: 'obligatorio', evidencia_oferta: 'Título de la oferta', evidencia_perfil: 'React y Node confirmados', explicacion: 'Inferido del título' },
                ],
                no_cumplidos: [],
                por_confirmar: [
                    { requisito: 'Responsabilidades del puesto', tipo: 'desconocido', evidencia_oferta: 'Descripción ausente', evidencia_perfil: '', explicacion: 'Sin contenido disponible' },
                ],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: false, pendiente: true, porcentaje: null, excluida: false },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: false },
        evidencias: ['Descripción ausente'],
        // No consumo la respuesta simulada afín: sin descripción mantengo pendiente sin score.
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 15: Tecnologías sin evidencia suficiente (van a por_confirmar)
    {
        id: 'caso-15-tecnologias-sin-evidencia-por-confirmar',
        titulo: 'Fullstack Developer Junior',
        empresa: 'Cloud Hub',
        ubicacion: 'Buenos Aires',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Puesto junior. Usamos TypeScript, Node.js y despliegues en Docker sobre AWS ECS.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 75,
            razon: 'Coincide en TypeScript y Node.js; Docker y AWS no están confirmados en el perfil y pasan a confirmación.',
            explicacion: {
                cumplidos: [
                    { requisito: 'TypeScript', tipo: 'obligatorio', evidencia_oferta: 'TypeScript', evidencia_perfil: 'TypeScript', explicacion: 'Cumple' },
                    { requisito: 'Node.js', tipo: 'obligatorio', evidencia_oferta: 'Node.js', evidencia_perfil: 'Node.js', explicacion: 'Cumple' },
                ],
                no_cumplidos: [],
                por_confirmar: [
                    { requisito: 'Docker', tipo: 'deseable', evidencia_oferta: 'Docker sobre AWS', evidencia_perfil: 'null no declarado', explicacion: 'Sin evidencia confirmada' },
                    { requisito: 'AWS ECS', tipo: 'deseable', evidencia_oferta: 'AWS ECS', evidencia_perfil: 'null no declarado', explicacion: 'Sin evidencia confirmada' },
                ],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['Docker', 'AWS ECS', 'por_confirmar'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 16: Requisitos obligatorios y deseables mezclados
    {
        id: 'caso-16-requisitos-obligatorios-y-deseables-mezclados',
        titulo: 'Desarrollador Web Junior',
        empresa: 'Digital Media',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Requisitos obligatorios: JavaScript, HTML5, CSS3. Requisitos deseables / plus: experiencia con GraphQL, Docker y microservicios.',
        perfil: { ...PERFIL_MARCOS_BASE, perfil_profesional: 'HTML5. CSS3.' },
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 75,
            razon: 'Cumple todos los requisitos obligatorios; los requisitos deseables no cumplidos no impiden el match.',
            explicacion: {
                cumplidos: [
                    { requisito: 'JavaScript', tipo: 'obligatorio', evidencia_oferta: 'JavaScript', evidencia_perfil: 'JavaScript', explicacion: 'Cumple' },
                    { requisito: 'HTML5', tipo: 'obligatorio', evidencia_oferta: 'HTML5', evidencia_perfil: 'HTML5.', explicacion: 'Cumple' },
                    { requisito: 'CSS3', tipo: 'obligatorio', evidencia_oferta: 'CSS3', evidencia_perfil: 'CSS3.', explicacion: 'Cumple' },
                ],
                no_cumplidos: [
                    { requisito: 'GraphQL', tipo: 'deseable', evidencia_oferta: 'plus GraphQL', evidencia_perfil: 'No declarado', explicacion: 'Deseable ausente' },
                ],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje_min: 60, excluida: false },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['obligatorios cumplidos', 'deseables no impiden match'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 17: Porcentaje bajo con aprobación (inconsistente)
    {
        id: 'caso-17-porcentaje-bajo-con-aprobacion-inconsistente',
        titulo: 'Desarrollador Junior PHP',
        empresa: 'Hosting Web',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Desarrollo en PHP y Laravel.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 35,
            razon: 'Aprobado a pesar de tener pocas tecnologías coincidentes.',
            explicacion: {
                cumplidos: [],
                no_cumplidos: [{ requisito: 'PHP', tipo: 'obligatorio', evidencia_oferta: 'PHP', evidencia_perfil: '', explicacion: 'No coincide' }],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: true, porcentaje: 35, inconsistente: true, invalido: true },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: false },
        evidencias: ['match true con porcentaje 35 < 60'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 18: Porcentaje alto con rechazo explicado por exclusión Java (válido)
    {
        id: 'caso-18-porcentaje-alto-con-rechazo-por-exclusion-java',
        titulo: 'Desarrollador Fullstack Java y Angular',
        empresa: 'Consultora Enterprise',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Puesto de desarrollo web. Se valoran conocimientos en Angular y se requiere Java para backend.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: false,
            porcentaje: 85,
            razon: 'Coincide fuertemente en frontend (Angular) pero se rechaza incondicionalmente por requerir Java obligatorio.',
            explicacion: {
                cumplidos: [
                    { requisito: 'Angular', tipo: 'obligatorio', evidencia_oferta: 'Angular', evidencia_perfil: 'Angular confirmado', explicacion: 'Cumple' },
                ],
                no_cumplidos: [
                    { requisito: 'Java', tipo: 'obligatorio', evidencia_oferta: 'Java para backend', evidencia_perfil: 'Exclusión estricta', explicacion: 'No acepta Java' },
                ],
                por_confirmar: [],
                exclusiones: [
                    { requisito: 'Java', tipo: 'obligatorio', evidencia_oferta: 'Java obligatorio', evidencia_perfil: 'Regla de exclusión estricta de Java', explicacion: 'Rechazo incondicional por política' },
                ],
            },
        }),
        resultado_esperado: { match: false, inconsistente: false, invalido: false },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: true },
        evidencias: ['porcentaje 85 con rechazo justificado por exclusión Java'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 19: Porcentaje alto con rechazo sin exclusión ni explicación (inconsistente)
    {
        id: 'caso-19-porcentaje-alto-con-rechazo-sin-exclusion-inconsistente',
        titulo: 'Desarrollador React Junior',
        empresa: 'Startup',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Desarrollo en React y Node.js.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: false,
            porcentaje: 80,
            razon: 'Buen perfil pero se decide no matchear.',
            explicacion: {
                cumplidos: [
                    { requisito: 'React', tipo: 'obligatorio', evidencia_oferta: 'React', evidencia_perfil: 'React', explicacion: 'Cumple' },
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: false, porcentaje: 80, inconsistente: true, invalido: true },
        explicacion_esperada: { tiene_cumplidos: true, tiene_exclusiones: false },
        evidencias: ['match false con porcentaje 80 sin exclusión'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 20: Porcentaje vacío ""
    {
        id: 'caso-20-porcentaje-vacio',
        titulo: 'Desarrollador Junior',
        empresa: 'Tech',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Desarrollo con JavaScript.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: '',
            razon: 'Aprobado sin porcentaje numérico.',
            explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
        }),
        resultado_esperado: { match: true, porcentaje: null, inconsistente: true, invalido: true },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: false },
        evidencias: ['porcentaje string vacío'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 21: Porcentaje no numérico o fuera de rango (150 o -10)
    {
        id: 'caso-21-porcentaje-fuera-de-rango',
        titulo: 'Desarrollador Angular Junior',
        empresa: 'Tech',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Desarrollo con Angular.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 150,
            razon: 'Excelente candidato superando el 100%.',
            explicacion: { cumplidos: [], no_cumplidos: [], por_confirmar: [], exclusiones: [] },
        }),
        resultado_esperado: { match: true, porcentaje: null, inconsistente: true, invalido: true },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: false },
        evidencias: ['porcentaje 150 fuera de rango [0, 100]'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 22: Datos del perfil incompletos
    {
        id: 'caso-22-datos-perfil-incompletos',
        titulo: 'Programador Junior',
        empresa: 'Startup',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Buscamos programador junior para desarrollo web.',
        perfil: {
            nombre: 'Candidato con datos parciales',
            nivel_experiencia: 'Junior',
            stack_tecnologico: [],
            reglas_exclusion: ['Java'],
            zonas_preferidas: [],
        },
        respuesta_ia_simulada: JSON.stringify({
            match: false,
            porcentaje: 20,
            razon: 'El perfil no registra tecnologías confirmadas en su stack.',
            explicacion: {
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [
                    { requisito: 'Tecnologías del candidato', tipo: 'desconocido', evidencia_oferta: 'desarrollo web', evidencia_perfil: 'stack vacío []', explicacion: 'Sin datos declarados' },
                ],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: false, porcentaje: 20, excluida: false },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: false },
        evidencias: ['stack_tecnologico vacío []'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 23: Requisito excluyente en extracto parcial (conserva exclusión)
    {
        id: 'caso-23-requisito-excluyente-en-extracto-parcial',
        titulo: 'Backend Developer (Java excluyente)',
        empresa: 'Tech Card',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'tarjeta',
        descripcion_completitud: 'parcial',
        descripcion: 'Búsqueda urgente: Java Developer con Spring Boot...',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: null,
        resultado_esperado: { match: false, porcentaje: 10, excluida: true, regla: 'java' },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: true },
        evidencias: ['Java en extracto parcial'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 24: Exclusión en post-evaluación que DeepSeek omitió
    {
        id: 'caso-24-exclusion-post-evaluacion-omitida-por-deepseek',
        titulo: 'Desarrollador Web Junior',
        empresa: 'Enterprise S.A.',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Desarrollo web junior con JavaScript. Requisito para el puesto: Java obligatorio para soporte de servicios legados.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 85,
            razon: 'Aprobado por coincidencia con JavaScript.',
            explicacion: {
                cumplidos: [{ requisito: 'JavaScript', tipo: 'obligatorio', evidencia_oferta: 'JavaScript', evidencia_perfil: 'JavaScript', explicacion: 'Cumple' }],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [],
            },
        }),
        resultado_esperado: { match: false, porcentaje: 10, excluida: true, regla: 'java' },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: true },
        evidencias: ['Post-evaluación intercepta omisión de IA'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },

    // Caso 25: Oferta legacy sin desglose estructurado
    {
        id: 'caso-25-oferta-legacy-sin-desglose',
        titulo: 'Desarrollador Junior Angular',
        empresa: 'Agencia Web',
        ubicacion: 'CABA',
        modalidad: 'Remoto',
        origen_descripcion: 'detalle',
        descripcion_completitud: 'completa',
        descripcion: 'Desarrollo con Angular.',
        perfil: PERFIL_MARCOS_BASE,
        respuesta_ia_simulada: JSON.stringify({
            match: true,
            porcentaje: 75,
            razon: 'Compatible con Angular.',
        }),
        resultado_esperado: { match: true, porcentaje: 75, desglose_disponible: false },
        explicacion_esperada: { tiene_cumplidos: false, tiene_exclusiones: false },
        evidencias: ['Respuesta legacy sin campo explicacion'],
        estado_revision: 'propuesta_pendiente_revision_humana',
    },
];

module.exports = {
    PERFIL_MARCOS_BASE,
    CASOS_MUESTRA_MATCHING,
};
