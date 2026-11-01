// Pruebas focales para Issue #15: normalización de modalidad, idioma, ubicación y salario.
'use strict';

const {
    normalizarOfertaJooble,
    normalizarOfertaAdzuna,
    normalizarOfertaComputrabajo,
    _parsearSalario,
    _detectarModalidadJooble,
    _detectarModalidadTexto,
    _mapearModalidadComputrabajo,
    detectarIdioma,
} = require('../../src/servicios/servicio-normalizacion');

const {
    estaEnZonasPreferidas,
    detectarRestriccionRemotaIncompatible,
} = require('../../src/servicios/evaluacion/criterio-ubicacion');

const {
    evaluarReglasExclusion,
    _internas: {
        detectarInglesExcluyente,
        detectarUbicacionIncompatible,
    },
} = require('../../src/servicios/evaluacion/reglas-exclusion');

const {
    VERSION_CONTRATO_EVALUACION,
    construirCriteriosEvaluacion,
    crearFirmaCriterios,
    crearHash,
    obtenerVigenciaEvaluacion,
} = require('../../src/servicios/evaluacion/identidad-evaluacion');

describe('Issue #15: Pruebas focales de normalización', () => {

    // ──────────────────────────────────────────────────────────
    // 1. Modalidad
    // ──────────────────────────────────────────────────────────
    describe('Modalidad', () => {
        test('1. Full-time no se transforma en presencial (permanece null/desconocido)', () => {
            expect(_detectarModalidadJooble('Full-time')).toBeNull();
            expect(_detectarModalidadJooble('full time')).toBeNull();
        });

        test('2. Part-time no se transforma en presencial (permanece null/desconocido)', () => {
            expect(_detectarModalidadJooble('Part-time')).toBeNull();
            expect(_detectarModalidadJooble('part time')).toBeNull();
        });

        test('3. «Sin posibilidad de trabajo remoto» no se interpreta como remoto', () => {
            const texto = 'Puesto presencial en Madrid. Sin posibilidad de trabajo remoto';
            const modalidad = _detectarModalidadTexto(texto);
            expect(modalidad).not.toBe('remoto');
            expect(modalidad).toBe('presencial');

            // En Adzuna debe descartarse por no ser trabajo a distancia
            expect(() => normalizarOfertaAdzuna({
                redirect_url: 'https://adzuna.es/job/1',
                title: 'Desarrollador Java',
                description: texto,
            })).toThrow(/Adzuna: oferta descartada por no ser trabajo a distancia/);
        });

        test('4. Una oferta híbrida no se clasifica como remoto pleno', () => {
            const texto = '3 días en oficina y 2 de teletrabajo';
            const modalidad = _detectarModalidadTexto(texto);
            expect(modalidad).toBe('hibrido');
            expect(modalidad).not.toBe('remoto');

            // En Adzuna, al no ser remoto pleno, se descarta explícitamente con motivo
            expect(() => normalizarOfertaAdzuna({
                redirect_url: 'https://adzuna.es/job/2',
                title: 'Desarrollador Node.js',
                description: texto,
            })).toThrow(/modalidad detectada: hibrido/);
        });

        test('4b. 100% remoto se clasifica como remoto pleno en Adzuna', () => {
            const oferta = normalizarOfertaAdzuna({
                redirect_url: 'https://adzuna.es/job/3',
                title: 'Desarrollador React',
                description: 'Posición 100% remoto para toda España',
                _pais: 'es',
            });
            expect(oferta.modalidad).toBe('remoto');
        });

        test('4c. «Remote work is not available» no se interpreta como remoto', () => {
            const texto = 'Software Engineer on-site. Remote work is not available.';
            const modalidad = _detectarModalidadTexto(texto);
            expect(modalidad).not.toBe('remoto');
        });

        test('5. Las etiquetas de Computrabajo producen los valores canónicos', () => {
            expect(_mapearModalidadComputrabajo('Híbrido')).toBe('hibrido');
            expect(_mapearModalidadComputrabajo('hibrido')).toBe('hibrido');
            expect(_mapearModalidadComputrabajo('Remoto')).toBe('remoto');
            expect(_mapearModalidadComputrabajo('remoto')).toBe('remoto');
            expect(_mapearModalidadComputrabajo('No remoto')).toBeNull();
            expect(_mapearModalidadComputrabajo('Presencial')).toBe('presencial');
            expect(_mapearModalidadComputrabajo('presencial')).toBe('presencial');
            expect(_mapearModalidadComputrabajo('Jornada completa')).toBeNull();
            expect(_mapearModalidadComputrabajo(null)).toBeNull();

            const ofertaComp = normalizarOfertaComputrabajo({
                url: 'https://computrabajo.com.ar/oferta/1',
                title: 'Frontend Junior',
                modalidadDetalle: 'Híbrido',
            });
            expect(ofertaComp.modalidad).toBe('hibrido');
        });

        test('6. Una modalidad ausente permanece desconocida (null)', () => {
            expect(_detectarModalidadJooble(null)).toBeNull();
            expect(_detectarModalidadJooble('')).toBeNull();
            expect(_detectarModalidadTexto('')).toBeNull();
            expect(_mapearModalidadComputrabajo(null)).toBeNull();
        });
    });

    // ──────────────────────────────────────────────────────────
    // 2. Idioma
    // ──────────────────────────────────────────────────────────
    describe('Idioma', () => {
        test('7. Una oferta española con encabezados Requirements y Nice to have no se descarta por idioma', () => {
            const titulo = 'Desarrollador React Junior';
            const descripcion = 'Buscamos desarrollador frontend para sumar a nuestro equipo de trabajo. ' +
                'Requirements: experiencia comprobable con React y JavaScript. ' +
                'Nice to have: conocimientos en TypeScript y Tailwind. ' +
                'Ofrecemos excelente clima laboral y oportunidades de crecimiento.';

            const idioma = detectarIdioma(titulo, descripcion);
            expect(idioma).toBe('es');
        });

        test('8. Una publicación realmente inglesa se identifica cuando hay evidencia suficiente', () => {
            const titulo = 'Software Engineer - Backend';
            const descripcion = 'We are looking for a Software Engineer to join our team. ' +
                'You will be responsible for designing and developing scalable web applications. ' +
                'We offer competitive salary and benefits. What you will do: build microservices with Node.js and PostgreSQL.';

            const idioma = detectarIdioma(titulo, descripcion);
            expect(idioma).toBe('en');
        });

        test('9. Inglés avanzado deseable no equivale a requisito obligatorio excluyente', () => {
            const ofertaDeseable = {
                titulo: 'Desarrollador Fullstack Junior',
                descripcion: 'Requisitos: experiencia en React y Node.js. Inglés avanzado deseable / valorable.',
            };
            const resultado = detectarInglesExcluyente(ofertaDeseable);
            expect(resultado.detectado).toBe(false);

            const exclusion = evaluarReglasExclusion(ofertaDeseable, { reglas_exclusion: [] });
            expect(exclusion.excluida).toBe(false);
        });

        test('10. El requisito excluyente se detecta cuando es explícito', () => {
            const ofertaExcluyente = {
                titulo: 'Desarrollador Fullstack',
                descripcion: 'Requisitos excluyentes: inglés avanzado obligatorio para interactuar con clientes de USA.',
            };
            const resultado = detectarInglesExcluyente(ofertaExcluyente);
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('ingles_avanzado');
        });
    });

    // ──────────────────────────────────────────────────────────
    // 3. Ubicación
    // ──────────────────────────────────────────────────────────
    describe('Ubicación y Zonas', () => {
        const zonas = ['CABA', 'GBA Oeste'];

        test('12. CABA y Capital Federal se reconocen como equivalentes', () => {
            expect(estaEnZonasPreferidas('CABA', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Capital Federal, Buenos Aires', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Ciudad Autónoma de Buenos Aires', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Palermo, Buenos Aires', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Belgrano, Capital Federal', zonas)).toBe(true);
        });

        test('13. Morón y Hurlingham se comparan correctamente con GBA Oeste', () => {
            expect(estaEnZonasPreferidas('Morón, Buenos Aires', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Hurlingham, Buenos Aires', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Castelar, Buenos Aires', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Ramos Mejía', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('San Justo, La Matanza', zonas)).toBe(true);
            expect(estaEnZonasPreferidas('Ituzaingó', zonas)).toBe(true);
        });

        test('13b. Reconoce bidireccionalmente aliases cuando la preferencia usa sinónimos como Capital Federal o Zona Oeste', () => {
            // Preferencia configurada como 'Capital Federal' debe reconocer 'Palermo' y 'CABA'
            expect(estaEnZonasPreferidas('Palermo', ['Capital Federal'])).toBe(true);
            expect(estaEnZonasPreferidas('CABA, Buenos Aires', ['Capital Federal'])).toBe(true);

            // Preferencia configurada como 'Zona Oeste' debe reconocer 'Morón' y 'GBA Oeste'
            expect(estaEnZonasPreferidas('Morón', ['Zona Oeste'])).toBe(true);
            expect(estaEnZonasPreferidas('Castelar, Buenos Aires', ['Zona Oeste'])).toBe(true);
        });

        test('13c. Preferencias de localidades específicas no se expanden a todo el clúster (B-01)', () => {
            // Si la preferencia es Morón, Moreno NO debe coincidir
            expect(estaEnZonasPreferidas('Moreno, Buenos Aires', ['Morón'])).toBe(false);
            // Si la preferencia es Caseros, Hurlingham NO debe coincidir
            expect(estaEnZonasPreferidas('Hurlingham, Buenos Aires', ['Caseros'])).toBe(false);
            // Localidad configurada exacta sí coincide
            expect(estaEnZonasPreferidas('Morón, Buenos Aires', ['Morón'])).toBe(true);
            expect(estaEnZonasPreferidas('Caseros, Buenos Aires', ['Caseros'])).toBe(true);
            // Zonas amplias sí aceptan cualquiera de sus localidades
            expect(estaEnZonasPreferidas('Moreno, Buenos Aires', ['GBA Oeste'])).toBe(true);
            expect(estaEnZonasPreferidas('Hurlingham, Buenos Aires', ['GBA Oeste'])).toBe(true);
        });

        test('13d. Zonas amplias de GBA no se asimilan a otras provincias (Córdoba, Rosario, Tierra del Fuego) (B-01)', () => {
            // "Zona Oeste de Córdoba" no debe asimilarse a GBA Oeste
            expect(estaEnZonasPreferidas('Zona Oeste de Córdoba', ['GBA Oeste'])).toBe(false);
            // "Zona Norte de Rosario" no debe asimilarse a GBA Norte
            expect(estaEnZonasPreferidas('Zona Norte de Rosario', ['GBA Norte'])).toBe(false);
            // "Sur de Tierra del Fuego" no debe asimilarse a GBA Sur
            expect(estaEnZonasPreferidas('Sur de Tierra del Fuego', ['GBA Sur'])).toBe(false);

            // Presencial en Zona Oeste de Córdoba activa la exclusión presencial_fuera_de_zona
            const resCordoba = detectarUbicacionIncompatible(
                { modalidad: 'presencial', ubicacion: 'Zona Oeste de Córdoba' },
                { zonas_preferidas: ['GBA Oeste'] }
            );
            expect(resCordoba.detectado).toBe(true);
            expect(resCordoba.patron).toBe('presencial_fuera_de_zona');

            // En cambio, localidades y referencias reales a GBA/Buenos Aires sí se aceptan
            expect(estaEnZonasPreferidas('Morón, Buenos Aires', ['GBA Oeste'])).toBe(true);
            expect(estaEnZonasPreferidas('Zona Oeste, Buenos Aires', ['GBA Oeste'])).toBe(true);
            expect(estaEnZonasPreferidas('Zona Oeste', ['GBA Oeste'])).toBe(true);
        });

        test('13e. Jurisdicciones extranjeras explícitas no se asimilan por homonimia y sedes alternativas no se anulan mutuamente (B-01)', () => {
            // Homonimias con países extranjeros explícitos dan false
            expect(estaEnZonasPreferidas('Palermo, Italia', ['CABA'])).toBe(false);
            expect(estaEnZonasPreferidas('Florida, USA', ['GBA Norte'])).toBe(false);

            // Oferta presencial en jurisdicción extranjera activa rechazo geográfico
            const resPalermoItalia = detectarUbicacionIncompatible(
                { modalidad: 'presencial', ubicacion: 'Palermo, Italia' },
                { zonas_preferidas: ['CABA'] }
            );
            expect(resPalermoItalia.detectado).toBe(true);
            expect(resPalermoItalia.patron).toBe('presencial_fuera_de_zona');

            const resFloridaUsa = detectarUbicacionIncompatible(
                { modalidad: 'presencial', ubicacion: 'Florida, USA' },
                { zonas_preferidas: ['GBA Norte'] }
            );
            expect(resFloridaUsa.detectado).toBe(true);
            expect(resFloridaUsa.patron).toBe('presencial_fuera_de_zona');

            // Direcciones con nombres de calles que coinciden con provincias/países pero declaradas en CABA (B-01)
            expect(estaEnZonasPreferidas('Avenida Santa Fe 1600, Recoleta, CABA', ['CABA'])).toBe(true);
            expect(estaEnZonasPreferidas('Calle Chile 1200, San Telmo, CABA', ['CABA'])).toBe(true);
            expect(estaEnZonasPreferidas('Santa Fe 1600, CABA', ['CABA'])).toBe(true);
            expect(estaEnZonasPreferidas('Chile 1200, CABA', ['CABA'])).toBe(true);

            const resAvSantaFe = detectarUbicacionIncompatible(
                { modalidad: 'presencial', ubicacion: 'Avenida Santa Fe 1600, Recoleta, CABA' },
                { zonas_preferidas: ['CABA'] }
            );
            expect(resAvSantaFe.detectado).toBe(false);

            const resCalleChile = detectarUbicacionIncompatible(
                { modalidad: 'presencial', ubicacion: 'Calle Chile 1200, San Telmo, CABA' },
                { zonas_preferidas: ['CABA'] }
            );
            expect(resCalleChile.detectado).toBe(false);

            // Cadena con sedes alternativas disyuntivas: si una alternativa es compatible, la oferta es compatible
            expect(estaEnZonasPreferidas('Palermo, CABA o Rosario, Santa Fe', ['CABA'])).toBe(true);
            expect(estaEnZonasPreferidas('Palermo, CABA / Rosario, Santa Fe', ['CABA'])).toBe(true);

            const resSedesMixtas = detectarUbicacionIncompatible(
                { modalidad: 'presencial', ubicacion: 'Palermo, CABA o Rosario, Santa Fe' },
                { zonas_preferidas: ['CABA'] }
            );
            expect(resSedesMixtas.detectado).toBe(false);

            // Si todas las alternativas son incompatibles (extranjeras o extraprovinciales), da false
            expect(estaEnZonasPreferidas('Palermo, Italia o Rosario, Santa Fe', ['CABA'])).toBe(false);
        });

        test('14. Ubicación ausente no activa una exclusión geográfica automática (conserva incertidumbre)', () => {
            expect(estaEnZonasPreferidas('', zonas)).toBeNull();
            expect(estaEnZonasPreferidas(null, zonas)).toBeNull();

            const ofertaPresencialSinUbicacion = {
                modalidad: 'presencial',
                ubicacion: '',
            };
            const resultado = detectarUbicacionIncompatible(ofertaPresencialSinUbicacion, { zonas_preferidas: zonas });
            expect(resultado.detectado).toBe(false);
        });

        test('15. Una oferta claramente presencial fuera de zona conserva el rechazo cuando está demostrado', () => {
            const ofertaCordoba = {
                modalidad: 'presencial',
                ubicacion: 'Córdoba, Argentina',
            };
            const resultado = detectarUbicacionIncompatible(ofertaCordoba, { zonas_preferidas: zonas });
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('presencial_fuera_de_zona');
        });

        test('16. Una oferta remota restringida a otro país no se considera automáticamente compatible con Argentina', () => {
            const ofertaRemotaUSA = {
                modalidad: 'remoto',
                titulo: 'Remote React Developer',
                descripcion: 'This position is 100% remote. Remote — US residents only.',
                ubicacion: 'United States',
            };
            const resultado = detectarUbicacionIncompatible(ofertaRemotaUSA, { zonas_preferidas: zonas });
            expect(resultado.detectado).toBe(true);
            expect(resultado.patron).toBe('remoto_restringido_pais');
            expect(resultado.evidencia).toContain('us residents only');

            // En cambio, una oferta remota abierta a Latam o Argentina NO se rechaza
            const ofertaRemotaLatam = {
                modalidad: 'remoto',
                titulo: 'Desarrollador Node.js',
                descripcion: 'Posición remota para toda Latinoamérica (Argentina, Chile, Uruguay).',
                ubicacion: 'Latam',
            };
            const resultadoLatam = detectarUbicacionIncompatible(ofertaRemotaLatam, { zonas_preferidas: zonas });
            expect(resultadoLatam.detectado).toBe(false);
        });

        test('16b. Giros en inglés con el pronombre "us" (ej: "Send us only your resume") NO activan falsa restricción', () => {
            const ofertaConPronombreUs = {
                modalidad: 'remoto',
                titulo: 'Remote Frontend Developer',
                descripcion: 'We are hiring remotely worldwide. Please send us only your resume and GitHub profile. Join us only if you love coding.',
            };
            const res = detectarRestriccionRemotaIncompatible(ofertaConPronombreUs);
            expect(res.detectado).toBe(false);
        });

        test('16c. Restricción remota explícita no se anula por menciones ajenas de Argentina en otra cláusula (B-02)', () => {
            // Caso del repro de auditoría con punto: "Remote — US residents only. Our clients are in the US or Argentina."
            const ofertaClientesArgPunto = {
                modalidad: 'remoto',
                titulo: 'Senior Backend Engineer',
                descripcion: 'Remote — US residents only. Our clients are in the US or Argentina.',
                ubicacion: 'Remoto',
            };
            const resPunto = detectarRestriccionRemotaIncompatible(ofertaClientesArgPunto);
            expect(resPunto.detectado).toBe(true);
            expect(resPunto.patron).toBe('remoto_restringido_pais');

            // Caso del repro de auditoría con coma: "Remote — US residents only, our clients are in the US or Argentina."
            const ofertaClientesArgComa = {
                modalidad: 'remoto',
                titulo: 'Senior Backend Engineer',
                descripcion: 'Remote — US residents only, our clients are in the US or Argentina.',
                ubicacion: 'Remoto',
            };
            const resComa = detectarRestriccionRemotaIncompatible(ofertaClientesArgComa);
            expect(resComa.detectado).toBe(true);
            expect(resComa.patron).toBe('remoto_restringido_pais');

            // Ambas llegan a detectarUbicacionIncompatible de forma idéntica
            const resIncompatPunto = detectarUbicacionIncompatible(ofertaClientesArgPunto, { zonas_preferidas: zonas });
            expect(resIncompatPunto.detectado).toBe(true);
            expect(resIncompatPunto.patron).toBe('remoto_restringido_pais');

            const resIncompatComa = detectarUbicacionIncompatible(ofertaClientesArgComa, { zonas_preferidas: zonas });
            expect(resIncompatComa.detectado).toBe(true);
            expect(resIncompatComa.patron).toBe('remoto_restringido_pais');

            // Presencia de oficinas de la empresa sin restricción de elegibilidad para el candidato (B-02)
            const ofertaSedeEmpresa = {
                modalidad: 'remoto',
                titulo: 'Worldwide Engineer',
                descripcion: 'We have offices in the United States only. Fully remote worldwide.',
                ubicacion: 'Remoto',
            };
            const resSede = detectarRestriccionRemotaIncompatible(ofertaSedeEmpresa);
            expect(resSede.detectado).toBe(false);

            const resIncompatSede = detectarUbicacionIncompatible(ofertaSedeEmpresa, { zonas_preferidas: zonas });
            expect(resIncompatSede.detectado).toBe(false);

            // Requisito explícito de "US-based candidates only"
            const ofertaUsBased = {
                modalidad: 'remoto',
                titulo: 'DevOps Engineer',
                descripcion: 'We are hiring for our cloud platform. US-based candidates only.',
                ubicacion: 'Remoto',
            };
            const resUsBased = detectarRestriccionRemotaIncompatible(ofertaUsBased);
            expect(resUsBased.detectado).toBe(true);
            expect(resUsBased.patron).toBe('remoto_restringido_pais');

            // Combinación sede Buenos Aires + US residents only
            const ofertaSedeArg = {
                modalidad: 'remoto',
                titulo: 'Remote React Engineer',
                descripcion: 'Remote — US residents only.',
                ubicacion: 'Buenos Aires, Argentina',
            };
            expect(detectarRestriccionRemotaIncompatible(ofertaSedeArg).detectado).toBe(true);

            // Candidate required location estructurado con 'US' o 'Canada'
            expect(detectarRestriccionRemotaIncompatible({
                modalidad: 'remoto',
                datos_crudos: { candidate_required_location: 'US' },
            }).detectado).toBe(true);

            expect(detectarRestriccionRemotaIncompatible({
                modalidad: 'remoto',
                datos_crudos: { candidate_required_location: 'Canada' },
            }).detectado).toBe(true);

            // Apertura genuina en la misma cláusula ("US or Argentina residents only")
            expect(detectarRestriccionRemotaIncompatible({
                modalidad: 'remoto',
                titulo: 'Fullstack Dev',
                descripcion: 'Remote position: US or Argentina residents only.',
            }).detectado).toBe(false);

            // Apertura para OTROS roles no cancela la exclusión remota explícita de este aviso (B-01)
            const ofertaOtrosRolesPunto = {
                modalidad: 'remoto',
                titulo: 'Senior DevOps',
                descripcion: 'Remote: US residents only. For other roles we hire US or Argentina residents.',
                ubicacion: 'Remoto',
            };
            const resOtrosRolesPunto = detectarRestriccionRemotaIncompatible(ofertaOtrosRolesPunto);
            expect(resOtrosRolesPunto.detectado).toBe(true);
            expect(resOtrosRolesPunto.patron).toBe('remoto_restringido_pais');
            expect(detectarUbicacionIncompatible(ofertaOtrosRolesPunto, { zonas_preferidas: zonas }).detectado).toBe(true);

            // Variante con conjunción «and» sin puntuación de cierre
            const ofertaOtrosRolesAnd = {
                modalidad: 'remoto',
                titulo: 'Senior DevOps',
                descripcion: 'Remote: US residents only and for other roles we hire US or Argentina residents.',
                ubicacion: 'Remoto',
            };
            const resOtrosRolesAnd = detectarRestriccionRemotaIncompatible(ofertaOtrosRolesAnd);
            expect(resOtrosRolesAnd.detectado).toBe(true);
            expect(resOtrosRolesAnd.patron).toBe('remoto_restringido_pais');
            expect(detectarUbicacionIncompatible(ofertaOtrosRolesAnd, { zonas_preferidas: zonas }).detectado).toBe(true);

            // Variante con solo espacio sin puntuación
            const ofertaOtrosRolesSinPunt = {
                modalidad: 'remoto',
                titulo: 'Senior DevOps',
                descripcion: 'Remote: US residents only for other roles we hire US or Argentina residents.',
                ubicacion: 'Remoto',
            };
            const resOtrosRolesSinPunt = detectarRestriccionRemotaIncompatible(ofertaOtrosRolesSinPunt);
            expect(resOtrosRolesSinPunt.detectado).toBe(true);
            expect(resOtrosRolesSinPunt.patron).toBe('remoto_restringido_pais');
            expect(detectarUbicacionIncompatible(ofertaOtrosRolesSinPunt, { zonas_preferidas: zonas }).detectado).toBe(true);

            // Variante en español con «y para otros roles»
            const ofertaOtrosRolesEspanol = {
                modalidad: 'remoto',
                titulo: 'Desarrollador Senior',
                descripcion: 'Remoto: solo residentes de USA y para otros roles contratamos en Argentina.',
                ubicacion: 'Remoto',
            };
            const resOtrosRolesEspanol = detectarRestriccionRemotaIncompatible(ofertaOtrosRolesEspanol);
            expect(resOtrosRolesEspanol.detectado).toBe(true);
            expect(resOtrosRolesEspanol.patron).toBe('remoto_restringido_pais');

            // US-based candidates only
            const ofertaUsBasedRol = {
                modalidad: 'remoto',
                titulo: 'React Engineer',
                descripcion: 'Remote role. US-based candidates only.',
            };
            expect(detectarRestriccionRemotaIncompatible(ofertaUsBasedRol).detectado).toBe(true);

            // Sede en el exterior sin restricción de residencia no debe rechazarse
            expect(detectarRestriccionRemotaIncompatible({
                modalidad: 'remoto',
                titulo: 'Worldwide Fullstack Developer',
                descripcion: 'Global team hiring anywhere in the world.',
                ubicacion: 'San Francisco, CA, USA',
            }).detectado).toBe(false);
        });

        test('17. Ambas defensas de ubicación llegan a la misma decisión', () => {
            const ofertaCaba = { modalidad: 'presencial', ubicacion: 'Capital Federal, Buenos Aires' };
            const ofertaFuera = { modalidad: 'presencial', ubicacion: 'Rosario, Santa Fe' };
            const ofertaVacia = { modalidad: 'presencial', ubicacion: '' };
            const ofertaRemotaUS = { modalidad: 'remoto', descripcion: 'US residents only' };
            const ofertaPalermoItalia = { modalidad: 'presencial', ubicacion: 'Palermo, Italia' };
            const ofertaFloridaUsa = { modalidad: 'presencial', ubicacion: 'Florida, USA' };
            const ofertaSedesMixtas = { modalidad: 'presencial', ubicacion: 'Palermo, CABA o Rosario, Santa Fe' };
            const ofertaRemotaComa = { modalidad: 'remoto', descripcion: 'Remote — US residents only, our clients are in the US or Argentina.' };
            const ofertaOficinasUs = { modalidad: 'remoto', descripcion: 'We have offices in the United States only. Fully remote worldwide.' };

            const ofertaAvSantaFe = { modalidad: 'presencial', ubicacion: 'Avenida Santa Fe 1600, Recoleta, CABA' };
            const ofertaCalleChile = { modalidad: 'presencial', ubicacion: 'Calle Chile 1200, San Telmo, CABA' };
            const ofertaOtrosRoles = { modalidad: 'remoto', descripcion: 'Remote: US residents only. For other roles we hire US or Argentina residents.' };

            // Comprobación de reglas-exclusion
            const exclCaba = detectarUbicacionIncompatible(ofertaCaba, { zonas_preferidas: zonas });
            const exclFuera = detectarUbicacionIncompatible(ofertaFuera, { zonas_preferidas: zonas });
            const exclVacia = detectarUbicacionIncompatible(ofertaVacia, { zonas_preferidas: zonas });
            const exclRemotaUS = detectarUbicacionIncompatible(ofertaRemotaUS, { zonas_preferidas: zonas });
            const exclPalermoItalia = detectarUbicacionIncompatible(ofertaPalermoItalia, { zonas_preferidas: zonas });
            const exclFloridaUsa = detectarUbicacionIncompatible(ofertaFloridaUsa, { zonas_preferidas: zonas });
            const exclSedesMixtas = detectarUbicacionIncompatible(ofertaSedesMixtas, { zonas_preferidas: zonas });
            const exclRemotaComa = detectarUbicacionIncompatible(ofertaRemotaComa, { zonas_preferidas: zonas });
            const exclOficinasUs = detectarUbicacionIncompatible(ofertaOficinasUs, { zonas_preferidas: zonas });
            const exclAvSantaFe = detectarUbicacionIncompatible(ofertaAvSantaFe, { zonas_preferidas: zonas });
            const exclCalleChile = detectarUbicacionIncompatible(ofertaCalleChile, { zonas_preferidas: zonas });
            const exclOtrosRoles = detectarUbicacionIncompatible(ofertaOtrosRoles, { zonas_preferidas: zonas });

            expect(exclCaba.detectado).toBe(false);
            expect(exclFuera.detectado).toBe(true);
            expect(exclVacia.detectado).toBe(false);
            expect(exclRemotaUS.detectado).toBe(true);
            expect(exclPalermoItalia.detectado).toBe(true);
            expect(exclFloridaUsa.detectado).toBe(true);
            expect(exclSedesMixtas.detectado).toBe(false);
            expect(exclRemotaComa.detectado).toBe(true);
            expect(exclOficinasUs.detectado).toBe(false);
            expect(exclAvSantaFe.detectado).toBe(false);
            expect(exclCalleChile.detectado).toBe(false);
            expect(exclOtrosRoles.detectado).toBe(true);

            // Comprobación de criterio unificado directo
            expect(estaEnZonasPreferidas(ofertaCaba.ubicacion, zonas)).toBe(true);
            expect(estaEnZonasPreferidas(ofertaFuera.ubicacion, zonas)).toBe(false);
            expect(estaEnZonasPreferidas(ofertaVacia.ubicacion, zonas)).toBeNull();
            expect(detectarRestriccionRemotaIncompatible(ofertaRemotaUS).detectado).toBe(true);
            expect(estaEnZonasPreferidas(ofertaPalermoItalia.ubicacion, zonas)).toBe(false);
            expect(estaEnZonasPreferidas(ofertaFloridaUsa.ubicacion, zonas)).toBe(false);
            expect(estaEnZonasPreferidas(ofertaSedesMixtas.ubicacion, zonas)).toBe(true);
            expect(detectarRestriccionRemotaIncompatible(ofertaRemotaComa).detectado).toBe(true);
            expect(detectarRestriccionRemotaIncompatible(ofertaOficinasUs).detectado).toBe(false);
            expect(estaEnZonasPreferidas(ofertaAvSantaFe.ubicacion, zonas)).toBe(true);
            expect(estaEnZonasPreferidas(ofertaCalleChile.ubicacion, zonas)).toBe(true);
            expect(detectarRestriccionRemotaIncompatible(ofertaOtrosRoles).detectado).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // 4. Salario
    // ──────────────────────────────────────────────────────────
    describe('Salarios', () => {
        test('18. El ejemplo de ARS 1.500.000–2.000.000 se interpreta correctamente con período mensual', () => {
            const res = _parsearSalario('AR$1.500.000 - AR$2.000.000 por mes');
            expect(res.min).toBe(1500000);
            expect(res.max).toBe(2000000);
            expect(res.moneda).toBe('ARS');
            expect(res.periodo).toBe('mes');
        });

        test('19. Jooble conserva los montos y desestructura correctamente salario_min y salario_max', () => {
            const itemJooble = {
                link: 'https://jooble.org/desc/12345',
                title: 'Junior Dev',
                salary: '$80,000 - $120,000 / year',
                type: 'Remote',
            };
            const normalizada = normalizarOfertaJooble(itemJooble);
            expect(normalizada.salario_min).toBe(80000);
            expect(normalizada.salario_max).toBe(120000);
            expect(normalizada.moneda).toBeNull(); // $ aislado sin divisa explícita no inventa USD
            expect(normalizada.modalidad).toBe('remoto');
        });

        test('20. Se distinguen miles y decimales según el formato argentino e internacional', () => {
            // Argentino: puntos de miles
            const resArg = _parsearSalario('AR$500.000');
            expect(resArg.min).toBe(500000);
            expect(resArg.max).toBeNull();
            expect(resArg.moneda).toBe('ARS');
            expect(resArg.periodo).toBeNull();

            // Internacional: comas de miles y per year
            const resUsd = _parsearSalario('USD 50,000 - 70,000 per year');
            expect(resUsd.min).toBe(50000);
            expect(resUsd.max).toBe(70000);
            expect(resUsd.moneda).toBe('USD');
            expect(resUsd.periodo).toBe('año');

            // Europeo: euros mensuales con punto de miles
            const resEur = _parsearSalario('€2.500 mensuales');
            expect(resEur.min).toBe(2500);
            expect(resEur.max).toBeNull();
            expect(resEur.moneda).toBe('EUR');
            expect(resEur.periodo).toBe('mes');
        });

        test('21. Moneda desconocida ($ aislado sin divisa) permanece desconocida', () => {
            const res = _parsearSalario('$100.000');
            expect(res.min).toBe(100000);
            expect(res.max).toBeNull();
            expect(res.moneda).toBeNull(); // Desconocida, no asumida como USD
            expect(res.periodo).toBeNull();
        });

        test('22. El período se conserva cuando está presente', () => {
            expect(_parsearSalario('USD 3000 / mes').periodo).toBe('mes');
            expect(_parsearSalario('$40,000 / año').periodo).toBe('año');
            expect(_parsearSalario('USD 25 por hora').periodo).toBe('hora');
        });

        test('22b. Reconoce moneda explícita, períodos con barra (/year, /hr) y preserva texto_original (B-03)', () => {
            // $80,000 - $120,000 / year -> moneda null, periodo año
            const resYear = _parsearSalario('$80,000 - $120,000 / year');
            expect(resYear.min).toBe(80000);
            expect(resYear.max).toBe(120000);
            expect(resYear.moneda).toBeNull();
            expect(resYear.periodo).toBe('año');
            expect(resYear.texto_original).toBe('$80,000 - $120,000 / year');

            // USD explícito con / hr
            const resHr = _parsearSalario('USD 25 / hr');
            expect(resHr.min).toBe(25);
            expect(resHr.moneda).toBe('USD');
            expect(resHr.periodo).toBe('hora');

            // Texto sin montos ("A convenir") conserva texto_original
            const resConvenir = _parsearSalario('A convenir');
            expect(resConvenir.min).toBeNull();
            expect(resConvenir.max).toBeNull();
            expect(resConvenir.texto_original).toBe('A convenir');

            // Cifras decimales
            const resDecimal = _parsearSalario('USD 25.50 / hr');
            expect(resDecimal.min).toBe(25.5);
            expect(resDecimal.moneda).toBe('USD');
            expect(resDecimal.periodo).toBe('hora');

            const resDecimalArg = _parsearSalario('AR$1.500.000,50 por mes');
            expect(resDecimalArg.min).toBe(1500000.5);
            expect(resDecimalArg.moneda).toBe('ARS');
            expect(resDecimalArg.periodo).toBe('mes');
        });

        test('23. La ausencia de salario no se convierte en cero', () => {
            const resVacio = _parsearSalario('');
            expect(resVacio.min).toBeNull();
            expect(resVacio.max).toBeNull();
            expect(resVacio.salario_min).toBeNull();
            expect(resVacio.salario_max).toBeNull();
            expect(resVacio.moneda).toBeNull();
            expect(resVacio.periodo).toBeNull();

            const resNull = _parsearSalario(null);
            expect(resNull.min).toBeNull();
            expect(resNull.max).toBeNull();
        });
    });

    // ──────────────────────────────────────────────────────────
    // 5. Vigencia e identidad de evaluación (#9 y #15 - B-02)
    // ──────────────────────────────────────────────────────────
    describe('Vigencia e identidad de evaluación (B-02)', () => {
        test('24. Versión del contrato de evaluación se incrementó a evaluacion-v3 o superior', () => {
            expect(['evaluacion-v3', 'evaluacion-v4', 'evaluacion-v5', 'evaluacion-v6', 'evaluacion-v7', 'evaluacion-v8']).toContain(VERSION_CONTRATO_EVALUACION);
        });

        test('25. Cambio de contrato de evaluación provoca miss de firma y marca evaluaciones v2 como vigencia anterior', () => {
            const prefs = {
                nombre: 'Perfil sintético',
                zonas_preferidas: ['CABA'],
                modelo_ia: 'deepseek-v4-flash',
            };

            // Firma calculada bajo contrato anterior v2
            const firmaV2 = crearHash(construirCriteriosEvaluacion(prefs, { version: 'evaluacion-v2' }));
            // Firma actual bajo contrato vigente v3
            const firmaV3 = crearFirmaCriterios(prefs);

            expect(firmaV3).not.toBe(firmaV2);

            // Una oferta previamente evaluada y guardada con firma v2 se reconoce como vigencia anterior
            const evaluacionGuardadaV2 = {
                id: 101,
                estado_evaluacion: 'rechazada',
                firma_criterios_evaluacion: firmaV2,
            };
            expect(obtenerVigenciaEvaluacion(evaluacionGuardadaV2, firmaV3)).toBe('anterior');

            // Una evaluación calculada con el contrato vigente v3 tiene vigencia actual
            const evaluacionGuardadaV3 = {
                id: 102,
                estado_evaluacion: 'aprobada',
                firma_criterios_evaluacion: firmaV3,
            };
            expect(obtenerVigenciaEvaluacion(evaluacionGuardadaV3, firmaV3)).toBe('actual');
        });
    });
});

