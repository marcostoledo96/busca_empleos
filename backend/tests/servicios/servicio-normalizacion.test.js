// Tests del servicio de normalización.
// Verifico que los datos crudos de cada plataforma se mapean correctamente
// al esquema de nuestra tabla `ofertas`.
//
// Estos tests usan datos REALES obtenidos de pruebas con los actores de Apify.
// No necesitan mocks porque la normalización es transformación pura de datos:
// recibe un objeto → devuelve otro objeto. Sin efectos secundarios.

const {
    normalizarOfertaLinkedin,
    normalizarOfertaComputrabajo,
    normalizarOfertaIndeed,
    normalizarOfertaBumeran,
    normalizarLote,
} = require('../../src/servicios/servicio-normalizacion');

// Dato crudo real de LinkedIn (obtenido del actor curious_coder/linkedin-jobs-scraper).
const itemLinkedinReal = {
    id: '4386138111',
    link: 'https://ar.linkedin.com/jobs/view/jr-react-native-developer-at-rootstrap-4386138111',
    title: 'Jr React Native Developer',
    companyName: 'Rootstrap',
    location: 'Carcarañá, Santa Fe, Argentina',
    postedAt: '2026-03-21T02:44:27.000Z',
    descriptionText: 'We\'re looking for a Junior React Native Developer to join our multicultural team...',
    descriptionHtml: '<strong>We\'re looking for a Junior React Native Developer</strong>...',
    salary: '',
    seniorityLevel: 'Not Applicable',
    employmentType: 'Full-time',
    workRemoteAllowed: false,
    country: 'AR',
    applicantsCount: '44',
    applyUrl: 'https://job-boards.greenhouse.io/rootstrap/jobs/5161038008',
    industries: 'Software Development',
    jobFunction: 'Engineering and Information Technology',
};

// Dato crudo real de Computrabajo (obtenido del actor shahidirfan/Computrabajo-Jobs-Scraper).
const itemComputrabajoReal = {
    id: 'BD5787E139E8632061373E686DCF3405',
    title: 'Analista de Facturación y Cobranzas',
    company: 'Importante empresa del sector Gastronómico',
    location: 'Villa Luro, Capital Federal',
    postedDate: '2026-03-13T11:13:39',
    descriptionText: 'Buscamos ANALISTA FACTURACION Y COBRANZAS para sumar a nuestro equipo...',
    url: 'https://ar.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-BD5787E139E8632061373E686DCF3405',
    offerAttributes: {
        lss: 'A convenir',
        lsj: 'Contrato por tiempo indeterminado',
        lset: 'Jornada completa',
    },
    scrapedAt: '2026-03-31T14:05:07.418Z',
};

// Dato crudo real de Indeed Argentina (obtenido del actor valig/indeed-jobs-scraper).
const itemIndeedArgentinaReal = {
    key: '5a8b3c2d1e0f9876',
    url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876',
    title: 'Desarrollador Junior .NET',
    jobUrl: 'http://ar.indeed.com/job/desarrollador-junior-net-5a8b3c2d1e0f9876',
    datePublished: '2026-03-30T15:00:00.000Z',
    expired: false,
    language: 'es',
    location: {
        countryName: 'Argentina',
        countryCode: 'AR',
        city: 'Buenos Aires',
        postalCode: '',
        streetAddress: '',
        latitude: -34.6037,
        longitude: -58.3816,
    },
    employer: {
        name: 'EPAM Systems',
        companyPageUrl: 'https://ar.indeed.com/cmp/EPAM-Systems',
    },
    attributes: {},
    baseSalary: null,
    description: {
        text: 'Buscamos un Desarrollador Junior .NET para unirse a nuestro equipo de tecnología...',
        html: '<p>Buscamos un Desarrollador Junior .NET...</p>',
    },
};

// Dato que simula la salida de la pageFunction del cheerio-scraper para Bumeran.
// La pageFunction extrae los datos de las tarjetas de la página de búsqueda.
const itemBumeranReal = {
    url: 'https://www.bumeran.com.ar/empleos/semisr-full-stack-developer-node-react-aws-mindit-hr-agency-1118193886.html',
    titulo: 'SemiSr Full-stack developer (Node/React/AWS)',
    empresa: 'mindIT HR Agency',
    ubicacion: 'Córdoba, Córdoba',
    modalidad: 'Remoto',
    descripcion: 'Nuestro cliente es una empresa tecnológica especializada en EdTech...',
};

describe('Servicio de normalización', () => {

    describe('normalizarOfertaLinkedin()', () => {

        test('mapea todos los campos correctamente', () => {
            const resultado = normalizarOfertaLinkedin(itemLinkedinReal);

            expect(resultado.titulo).toBe('Jr React Native Developer');
            expect(resultado.empresa).toBe('Rootstrap');
            expect(resultado.ubicacion).toBe('Carcarañá, Santa Fe, Argentina');
            expect(resultado.url).toBe('https://ar.linkedin.com/jobs/view/jr-react-native-developer-at-rootstrap-4386138111');
            expect(resultado.plataforma).toBe('linkedin');
            expect(resultado.descripcion).toContain('Junior React Native Developer');
        });

        test('asigna la fecha de publicación como objeto Date', () => {
            const resultado = normalizarOfertaLinkedin(itemLinkedinReal);

            expect(resultado.fecha_publicacion).toBeInstanceOf(Date);
            expect(resultado.fecha_publicacion.toISOString()).toBe('2026-03-21T02:44:27.000Z');
        });

        test('detecta modalidad remota cuando workRemoteAllowed es true', () => {
            const itemRemoto = { ...itemLinkedinReal, workRemoteAllowed: true };
            const resultado = normalizarOfertaLinkedin(itemRemoto);

            expect(resultado.modalidad).toBe('remoto');
        });

        test('deja modalidad como null cuando no es remoto y no tiene info', () => {
            const resultado = normalizarOfertaLinkedin(itemLinkedinReal);

            // workRemoteAllowed es false y no hay otra indicación de modalidad
            expect(resultado.modalidad).toBeNull();
        });

        test('guarda el JSON crudo completo en datos_crudos', () => {
            const resultado = normalizarOfertaLinkedin(itemLinkedinReal);

            expect(resultado.datos_crudos).toEqual(itemLinkedinReal);
        });

        test('maneja salary vacío y no pone salario', () => {
            const resultado = normalizarOfertaLinkedin(itemLinkedinReal);

            expect(resultado.salario_min).toBeNull();
            expect(resultado.salario_max).toBeNull();
            expect(resultado.moneda).toBeNull();
        });

        test('extrae rango salarial cuando viene con formato USD', () => {
            const itemConSalario = {
                ...itemLinkedinReal,
                salary: '$50,000.00/yr - $70,000.00/yr',
            };
            const resultado = normalizarOfertaLinkedin(itemConSalario);

            expect(resultado.salario_min).toBe(50000);
            expect(resultado.salario_max).toBe(70000);
            expect(resultado.moneda).toBe('USD');
        });

        test('detecta nivel junior desde seniorityLevel', () => {
            const itemJunior = { ...itemLinkedinReal, seniorityLevel: 'Entry level' };
            const resultado = normalizarOfertaLinkedin(itemJunior);

            expect(resultado.nivel_requerido).toBe('junior');
        });

        test('maneja item con campos faltantes sin romperse', () => {
            const itemMinimo = {
                link: 'https://linkedin.com/jobs/view/123',
                title: 'Dev',
            };

            const resultado = normalizarOfertaLinkedin(itemMinimo);

            expect(resultado.titulo).toBe('Dev');
            expect(resultado.url).toBe('https://linkedin.com/jobs/view/123');
            expect(resultado.plataforma).toBe('linkedin');
            expect(resultado.empresa).toBeNull();
        });
    });

    describe('normalizarOfertaComputrabajo()', () => {

        test('mapea todos los campos correctamente', () => {
            const resultado = normalizarOfertaComputrabajo(itemComputrabajoReal);

            expect(resultado.titulo).toBe('Analista de Facturación y Cobranzas');
            expect(resultado.empresa).toBe('Importante empresa del sector Gastronómico');
            expect(resultado.ubicacion).toBe('Villa Luro, Capital Federal');
            expect(resultado.plataforma).toBe('computrabajo');
            expect(resultado.url).toContain('computrabajo.com');
        });

        test('asigna la fecha de publicación correctamente', () => {
            const resultado = normalizarOfertaComputrabajo(itemComputrabajoReal);

            expect(resultado.fecha_publicacion).toBeInstanceOf(Date);
        });

        test('guarda el JSON crudo completo en datos_crudos', () => {
            const resultado = normalizarOfertaComputrabajo(itemComputrabajoReal);

            expect(resultado.datos_crudos).toEqual(itemComputrabajoReal);
        });

        test('maneja item con campos faltantes sin romperse', () => {
            const itemMinimo = {
                url: 'https://ar.computrabajo.com/oferta-123',
                title: 'Programador',
            };

            const resultado = normalizarOfertaComputrabajo(itemMinimo);

            expect(resultado.titulo).toBe('Programador');
            expect(resultado.url).toBe('https://ar.computrabajo.com/oferta-123');
            expect(resultado.plataforma).toBe('computrabajo');
            expect(resultado.empresa).toBeNull();
        });
    });

    describe('normalizarOfertaIndeed()', () => {

        test('mapea todos los campos correctamente', () => {
            const resultado = normalizarOfertaIndeed(itemIndeedArgentinaReal);

            expect(resultado.titulo).toBe('Desarrollador Junior .NET');
            expect(resultado.empresa).toBe('EPAM Systems');
            expect(resultado.ubicacion).toBe('Buenos Aires, Argentina');
            expect(resultado.url).toBe('https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876');
            expect(resultado.plataforma).toBe('indeed');
            expect(resultado.descripcion).toContain('Desarrollador Junior .NET');
        });

        test('asigna la fecha de publicación como objeto Date', () => {
            const resultado = normalizarOfertaIndeed(itemIndeedArgentinaReal);

            expect(resultado.fecha_publicacion).toBeInstanceOf(Date);
            expect(resultado.fecha_publicacion.toISOString()).toBe('2026-03-30T15:00:00.000Z');
        });

        test('detecta modalidad remota cuando location.city es "Desde casa"', () => {
            const itemRemoto = {
                ...itemIndeedArgentinaReal,
                location: { ...itemIndeedArgentinaReal.location, city: 'Desde casa' },
            };
            const resultado = normalizarOfertaIndeed(itemRemoto);

            expect(resultado.modalidad).toBe('remoto');
        });

        test('detecta modalidad remota desde atributos', () => {
            const itemConAtributos = {
                ...itemIndeedArgentinaReal,
                attributes: { 'ABC12': 'Remote' },
            };
            const resultado = normalizarOfertaIndeed(itemConAtributos);

            expect(resultado.modalidad).toBe('remoto');
        });

        test('detecta modalidad presencial desde atributos', () => {
            const itemPresencial = {
                ...itemIndeedArgentinaReal,
                attributes: { 'SWG7T': 'In-person' },
            };
            const resultado = normalizarOfertaIndeed(itemPresencial);

            expect(resultado.modalidad).toBe('presencial');
        });

        test('detecta modalidad híbrida desde atributos', () => {
            const itemHibrido = {
                ...itemIndeedArgentinaReal,
                attributes: { 'XYZ99': 'Hybrid work' },
            };
            const resultado = normalizarOfertaIndeed(itemHibrido);

            expect(resultado.modalidad).toBe('hibrido');
        });

        test('detecta nivel junior desde atributos', () => {
            const itemJunior = {
                ...itemIndeedArgentinaReal,
                attributes: { 'Y4JG9': 'Entry level' },
            };
            const resultado = normalizarOfertaIndeed(itemJunior);

            expect(resultado.nivel_requerido).toBe('junior');
        });

        test('detecta nivel senior desde atributos', () => {
            const itemSenior = {
                ...itemIndeedArgentinaReal,
                attributes: { 'Z1234': 'Senior level' },
            };
            const resultado = normalizarOfertaIndeed(itemSenior);

            expect(resultado.nivel_requerido).toBe('senior');
        });

        test('extrae salario y moneda cuando baseSalary viene con datos', () => {
            const itemConSalario = {
                ...itemIndeedArgentinaReal,
                baseSalary: { min: 60000, max: 80000, currencyCode: 'USD' },
            };
            const resultado = normalizarOfertaIndeed(itemConSalario);

            expect(resultado.salario_min).toBe(60000);
            expect(resultado.salario_max).toBe(80000);
            expect(resultado.moneda).toBe('USD');
        });

        test('maneja baseSalary null sin romperse', () => {
            const resultado = normalizarOfertaIndeed(itemIndeedArgentinaReal);

            expect(resultado.salario_min).toBeNull();
            expect(resultado.salario_max).toBeNull();
            expect(resultado.moneda).toBeNull();
        });

        test('guarda el JSON crudo completo en datos_crudos', () => {
            const resultado = normalizarOfertaIndeed(itemIndeedArgentinaReal);

            expect(resultado.datos_crudos).toEqual(itemIndeedArgentinaReal);
        });

        test('maneja item con campos faltantes sin romperse', () => {
            const itemMinimo = {
                url: 'https://ar.indeed.com/viewjob?jk=abc123',
            };

            const resultado = normalizarOfertaIndeed(itemMinimo);

            expect(resultado.url).toBe('https://ar.indeed.com/viewjob?jk=abc123');
            expect(resultado.plataforma).toBe('indeed');
            expect(resultado.titulo).toBeNull();
            expect(resultado.empresa).toBeNull();
        });

        test('tira error si el item no tiene URL', () => {
            const itemSinUrl = { title: 'Sin URL' };

            expect(() => normalizarOfertaIndeed(itemSinUrl)).toThrow(
                'El item de Indeed no tiene URL'
            );
        });
    });

    describe('normalizarOfertaBumeran()', () => {

        test('mapea todos los campos correctamente', () => {
            const resultado = normalizarOfertaBumeran(itemBumeranReal);

            expect(resultado.titulo).toBe('SemiSr Full-stack developer (Node/React/AWS)');
            expect(resultado.empresa).toBe('mindIT HR Agency');
            expect(resultado.ubicacion).toBe('Córdoba, Córdoba');
            expect(resultado.url).toBe('https://www.bumeran.com.ar/empleos/semisr-full-stack-developer-node-react-aws-mindit-hr-agency-1118193886.html');
            expect(resultado.plataforma).toBe('bumeran');
            expect(resultado.descripcion).toContain('EdTech');
        });

        test('mapea modalidad "Remoto" a "remoto"', () => {
            const resultado = normalizarOfertaBumeran(itemBumeranReal);
            expect(resultado.modalidad).toBe('remoto');
        });

        test('mapea modalidad "Híbrido" a "hibrido"', () => {
            const itemHibrido = { ...itemBumeranReal, modalidad: 'Híbrido' };
            const resultado = normalizarOfertaBumeran(itemHibrido);
            expect(resultado.modalidad).toBe('hibrido');
        });

        test('mapea modalidad "Presencial" a "presencial"', () => {
            const itemPresencial = { ...itemBumeranReal, modalidad: 'Presencial' };
            const resultado = normalizarOfertaBumeran(itemPresencial);
            expect(resultado.modalidad).toBe('presencial');
        });

        test('deja modalidad null cuando no tiene dato', () => {
            const itemSinModalidad = { ...itemBumeranReal, modalidad: null };
            const resultado = normalizarOfertaBumeran(itemSinModalidad);
            expect(resultado.modalidad).toBeNull();
        });

        test('no tiene datos de salario ni nivel (no disponibles en la tarjeta)', () => {
            const resultado = normalizarOfertaBumeran(itemBumeranReal);

            expect(resultado.nivel_requerido).toBeNull();
            expect(resultado.salario_min).toBeNull();
            expect(resultado.salario_max).toBeNull();
            expect(resultado.moneda).toBeNull();
        });

        test('no tiene fecha de publicación (no disponible en la tarjeta)', () => {
            const resultado = normalizarOfertaBumeran(itemBumeranReal);
            expect(resultado.fecha_publicacion).toBeNull();
        });

        test('guarda el JSON crudo completo en datos_crudos', () => {
            const resultado = normalizarOfertaBumeran(itemBumeranReal);
            expect(resultado.datos_crudos).toEqual(itemBumeranReal);
        });

        test('maneja item con campos faltantes sin romperse', () => {
            const itemMinimo = {
                url: 'https://www.bumeran.com.ar/empleos/test-123.html',
            };

            const resultado = normalizarOfertaBumeran(itemMinimo);

            expect(resultado.url).toBe('https://www.bumeran.com.ar/empleos/test-123.html');
            expect(resultado.plataforma).toBe('bumeran');
            expect(resultado.titulo).toBeNull();
            expect(resultado.empresa).toBeNull();
        });

        test('tira error si el item no tiene URL', () => {
            const itemSinUrl = { titulo: 'Sin URL' };

            expect(() => normalizarOfertaBumeran(itemSinUrl)).toThrow(
                'El item de Bumeran no tiene URL'
            );
        });
    });

    describe('normalizarLote()', () => {

        test('normaliza un array de items de LinkedIn', () => {
            const items = [itemLinkedinReal, itemLinkedinReal];
            const resultados = normalizarLote(items, 'linkedin');

            expect(resultados).toHaveLength(2);
            expect(resultados[0].plataforma).toBe('linkedin');
            expect(resultados[1].plataforma).toBe('linkedin');
        });

        test('normaliza un array de items de Computrabajo', () => {
            const items = [itemComputrabajoReal];
            const resultados = normalizarLote(items, 'computrabajo');

            expect(resultados).toHaveLength(1);
            expect(resultados[0].plataforma).toBe('computrabajo');
        });

        test('normaliza un array de items de Indeed', () => {
            const items = [itemIndeedArgentinaReal];
            const resultados = normalizarLote(items, 'indeed');

            expect(resultados).toHaveLength(1);
            expect(resultados[0].plataforma).toBe('indeed');
        });

        test('normaliza un array de items de Bumeran', () => {
            const items = [itemBumeranReal];
            const resultados = normalizarLote(items, 'bumeran');

            expect(resultados).toHaveLength(1);
            expect(resultados[0].plataforma).toBe('bumeran');
        });

        test('ignora items que fallan al normalizar y loguea el error', () => {
            // Un item sin URL ni link va a fallar la validación mínima.
            const items = [itemLinkedinReal, { title: 'Sin URL' }, itemLinkedinReal];
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const resultados = normalizarLote(items, 'linkedin');

            expect(resultados).toHaveLength(2);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        test('retorna array vacío si no hay items', () => {
            const resultados = normalizarLote([], 'linkedin');
            expect(resultados).toEqual([]);
        });
    });
});
