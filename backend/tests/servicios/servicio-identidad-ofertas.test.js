// Tests del servicio de identidad y canonización de ofertas.
//
// Verifico los 8 criterios de aceptación de identidad de ofertas
// definidos en la Issue #19, además de las funciones auxiliares de extracción y canonización.

const {
    extraerIdentificadorPlataforma,
    canonizarUrlPlataforma,
    obtenerIdentidadCanonica,
} = require('../../src/servicios/servicio-identidad-ofertas');

const {
    normalizarOfertaIndeed,
    normalizarOfertaLinkedin,
    normalizarOfertaComputrabajo,
    normalizarOfertaBumeran,
    normalizarOfertaGlassdoor,
    normalizarOfertaGetonbrd,
    normalizarOfertaJooble,
    normalizarOfertaAdzuna,
    normalizarOfertaRemotive,
    normalizarOfertaRemoteOK,
    normalizarOfertaInfojobs,
} = require('../../src/servicios/servicio-normalizacion');

describe('Servicio de identidad y canonización de ofertas', () => {

    describe('Criterios de Aceptación de Identidad', () => {

        // Criterio 1: Dos URLs Indeed con el mismo jk y distinto tracking se reconocen como una oferta.
        test('Criterio 1: Dos URLs Indeed con el mismo jk y distinto tracking se reconocen como una oferta', () => {
            const url1 = 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&from=serp&tk=1i3abc99&utm_source=jobboard';
            const url2 = 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&vjs=3&advn=123456789&mobview=0';

            const identidad1 = obtenerIdentidadCanonica({ url: url1, plataforma: 'indeed' });
            const identidad2 = obtenerIdentidadCanonica({ url: url2, plataforma: 'indeed' });

            expect(identidad1).toBe('indeed:5a8b3c2d1e0f9876');
            expect(identidad2).toBe('indeed:5a8b3c2d1e0f9876');
            expect(identidad1).toBe(identidad2);

            // Verifico además que canonizarUrlPlataforma genere la misma URL canónica
            const can1 = canonizarUrlPlataforma(url1, 'indeed');
            const can2 = canonizarUrlPlataforma(url2, 'indeed');
            expect(can1).toBe('https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876');
            expect(can2).toBe('https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876');
            expect(can1).toBe(can2);
        });

        // Soporte para vjk en Indeed
        test('Criterio 1 (variante vjk): URL Indeed con vjk se reconoce igual que con jk', () => {
            const urlVjk = 'https://ar.indeed.com/viewjob?vjk=5A8B3C2D1E0F9876&from=serp';
            const urlJk = 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876';

            const idVjk = obtenerIdentidadCanonica({ url: urlVjk, plataforma: 'indeed' });
            const idJk = obtenerIdentidadCanonica({ url: urlJk, plataforma: 'indeed' });

            expect(idVjk).toBe('indeed:5a8b3c2d1e0f9876');
            expect(idJk).toBe('indeed:5a8b3c2d1e0f9876');
            expect(idVjk).toBe(idJk);
        });

        // Criterio 2: Dos IDs jk diferentes permanecen separados.
        test('Criterio 2: Dos IDs jk diferentes permanecen separados', () => {
            const url1 = 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876';
            const url2 = 'https://ar.indeed.com/viewjob?jk=bbbbccccddddeeee';

            const identidad1 = obtenerIdentidadCanonica({ url: url1, plataforma: 'indeed' });
            const identidad2 = obtenerIdentidadCanonica({ url: url2, plataforma: 'indeed' });

            expect(identidad1).toBe('indeed:5a8b3c2d1e0f9876');
            expect(identidad2).toBe('indeed:bbbbccccddddeeee');
            expect(identidad1).not.toBe(identidad2);
        });

        // Criterio 3: Dos URLs LinkedIn con el mismo ID se reconocen como una oferta.
        test('Criterio 3: Dos URLs LinkedIn con el mismo ID se reconocen como una oferta', () => {
            const urlSlug = 'https://ar.linkedin.com/jobs/view/jr-react-native-developer-at-rootstrap-4386138111?refId=abc123XYZ&trackingId=tr999';
            const urlCorta = 'https://www.linkedin.com/jobs/view/4386138111?utm_campaign=feed';
            const urlParam = 'https://www.linkedin.com/jobs/search?currentJobId=4386138111&trk=public_jobs';

            const identidad1 = obtenerIdentidadCanonica({ url: urlSlug, plataforma: 'linkedin' });
            const identidad2 = obtenerIdentidadCanonica({ url: urlCorta, plataforma: 'linkedin' });
            const identidad3 = obtenerIdentidadCanonica({ url: urlParam, plataforma: 'linkedin' });

            expect(identidad1).toBe('linkedin:4386138111');
            expect(identidad2).toBe('linkedin:4386138111');
            expect(identidad3).toBe('linkedin:4386138111');
            expect(identidad1).toBe(identidad2);
            expect(identidad2).toBe(identidad3);

            // Canonical URL debe coincidir en https://www.linkedin.com/jobs/view/4386138111
            expect(canonizarUrlPlataforma(urlSlug, 'linkedin')).toBe('https://www.linkedin.com/jobs/view/4386138111');
            expect(canonizarUrlPlataforma(urlCorta, 'linkedin')).toBe('https://www.linkedin.com/jobs/view/4386138111');
            expect(canonizarUrlPlataforma(urlParam, 'linkedin')).toBe('https://www.linkedin.com/jobs/view/4386138111');
        });

        // Criterio 4: Dos IDs LinkedIn distintos no se fusionan.
        test('Criterio 4: Dos IDs LinkedIn distintos no se fusionan', () => {
            const url1 = 'https://www.linkedin.com/jobs/view/4386138111';
            const url2 = 'https://www.linkedin.com/jobs/view/4386138999';

            const identidad1 = obtenerIdentidadCanonica({ url: url1, plataforma: 'linkedin' });
            const identidad2 = obtenerIdentidadCanonica({ url: url2, plataforma: 'linkedin' });

            expect(identidad1).toBe('linkedin:4386138111');
            expect(identidad2).toBe('linkedin:4386138999');
            expect(identidad1).not.toBe(identidad2);
        });

        // Criterio 5: Parámetros relevantes no se eliminan indiscriminadamente.
        test('Criterio 5: Parámetros relevantes no se eliminan indiscriminadamente', () => {
            const urlCompleja = 'https://ejemplo.com/empleos?categoria=backend&nivel=junior&pagina=2&utm_source=twitter&fbclid=AQB123&utm_medium=cpc';

            const can = canonizarUrlPlataforma(urlCompleja, 'general');

            // Parámetros funcionales deben preservarse
            expect(can).toContain('categoria=backend');
            expect(can).toContain('nivel=junior');
            expect(can).toContain('pagina=2');

            // Parámetros de tracking deben removerse
            expect(can).not.toContain('utm_source');
            expect(can).not.toContain('utm_medium');
            expect(can).not.toContain('fbclid');

            // Identidad canónica refleja la URL limpia con parámetros funcionales conservados
            const identidad = obtenerIdentidadCanonica({ url: urlCompleja, plataforma: 'general' });
            expect(identidad).toBe(`general:url:${can}`);
        });

        // Criterio 6: URLs desconocidas se normalizan conservadoramente.
        test('Criterio 6: URLs desconocidas se normalizan conservadoramente', () => {
            const urlDesconocida = 'HTTPS://Sub.Dominio.COM:443/Avisos/Puesto-123/?utm_source=newsletter&gclid=xyz789#descripcion';

            const can = canonizarUrlPlataforma(urlDesconocida, 'portal_nuevo');

            // Host a minúsculas, trailing slash removido, hash removido, tracking removido
            expect(can).toBe('https://sub.dominio.com/Avisos/Puesto-123');

            const identidad = obtenerIdentidadCanonica({ url: urlDesconocida, plataforma: 'portal_nuevo' });
            expect(identidad).toBe('portal_nuevo:url:https://sub.dominio.com/Avisos/Puesto-123');
        });

        // Criterio 7: Una URL no válida no provoca una fusión accidental.
        test('Criterio 7: Una URL no válida no provoca una fusión accidental', () => {
            const urlInvalida1 = 'cadena-no-url-1';
            const urlInvalida2 = 'cadena-no-url-2';
            const urlJavascript = 'javascript:void(0)';
            const urlVacia = '';

            const id1 = obtenerIdentidadCanonica({ url: urlInvalida1, plataforma: 'general' });
            const id2 = obtenerIdentidadCanonica({ url: urlInvalida2, plataforma: 'general' });
            const idJs = obtenerIdentidadCanonica({ url: urlJavascript, plataforma: 'general' });
            const idVacia = obtenerIdentidadCanonica({ url: urlVacia, plataforma: 'general' });

            expect(id1).toBe('general:raw:cadena-no-url-1');
            expect(id2).toBe('general:raw:cadena-no-url-2');
            expect(idJs).toBe('general:raw:javascript:void(0)');
            expect(idVacia).toBe('general:raw:');

            expect(id1).not.toBe(id2);
            expect(id1).not.toBe(idJs);
            expect(id2).not.toBe(idVacia);
        });

        // Criterio 8: La identidad intra-ejecución y la persistente son coherentes.
        test('Criterio 8: La identidad intra-ejecución y la persistente son coherentes', () => {
            const itemIndeed = {
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&from=serp&tk=test',
                title: 'Desarrollador Node.js',
                employer: { name: 'Empresa Test' },
            };

            // Cálculo antes de normalizar
            const idAntes = obtenerIdentidadCanonica({
                url: itemIndeed.url,
                plataforma: 'indeed',
                datos_crudos: itemIndeed,
            });

            // Normalización
            const normalizada = normalizarOfertaIndeed(itemIndeed);
            expect(normalizada.identidad_canonica).toBe(idAntes);

            // Recálculo sobre la oferta ya normalizada
            const idDespues = obtenerIdentidadCanonica(normalizada);
            expect(idDespues).toBe(idAntes);

            // Simulación de persistencia JSON (guardar en base de datos y recuperar)
            const recuperada = JSON.parse(JSON.stringify(normalizada));
            const idPersistida = obtenerIdentidadCanonica(recuperada);
            expect(idPersistida).toBe(idAntes);
        });
    });

    describe('Regla transversal: jamás usar título ni empresa como sustituto de identidad', () => {

        test('dos ofertas con el mismo título y empresa pero distinta URL/ID tienen identidades separadas', () => {
            const ofertaA = {
                titulo: 'Desarrollador Full Stack',
                empresa: 'Globant',
                url: 'https://www.linkedin.com/jobs/view/1000000001',
                plataforma: 'linkedin',
            };
            const ofertaB = {
                titulo: 'Desarrollador Full Stack',
                empresa: 'Globant',
                url: 'https://www.linkedin.com/jobs/view/1000000002',
                plataforma: 'linkedin',
            };

            const idA = obtenerIdentidadCanonica(ofertaA);
            const idB = obtenerIdentidadCanonica(ofertaB);

            expect(idA).toBe('linkedin:1000000001');
            expect(idB).toBe('linkedin:1000000002');
            expect(idA).not.toBe(idB);
        });
    });

    describe('Plataformas específicas', () => {

        describe('GetOnBrd', () => {
            test('extrae slug desde la URL e identidad getonbrd:<slug>', () => {
                const url = 'https://www.getonbrd.com/jobs/programacion/desarrollador-backend-senior-empresa';
                const id = extraerIdentificadorPlataforma(url, 'getonbrd');
                expect(id).toBe('desarrollador-backend-senior-empresa');

                const identidad = obtenerIdentidadCanonica({ url, plataforma: 'getonbrd' });
                expect(identidad).toBe('getonbrd:desarrollador-backend-senior-empresa');
            });

            test('extrae slug desde datos_crudos.id si la URL es genérica', () => {
                const item = {
                    links: { public_url: 'https://www.getonbrd.com/jobs' },
                    id: 'react-dev-slug-123',
                };
                const id = extraerIdentificadorPlataforma(item.links.public_url, 'getonbrd', item);
                expect(id).toBe('react-dev-slug-123');

                const identidad = obtenerIdentidadCanonica({ ...item, url: item.links.public_url, plataforma: 'getonbrd' });
                expect(identidad).toBe('getonbrd:react-dev-slug-123');
            });
        });

        describe('Computrabajo', () => {
            test('extrae ID hexadecimal de la oferta e identidad computrabajo:<id>', () => {
                const url = 'https://ar.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-BD5787E139E8632061373E686DCF3405#lc=123';
                const id = extraerIdentificadorPlataforma(url, 'computrabajo');
                expect(id).toBe('BD5787E139E8632061373E686DCF3405');

                const identidad = obtenerIdentidadCanonica({ url, plataforma: 'computrabajo' });
                expect(identidad).toBe('computrabajo:BD5787E139E8632061373E686DCF3405');

                const can = canonizarUrlPlataforma(url, 'computrabajo');
                expect(can).toBe('https://ar.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-BD5787E139E8632061373E686DCF3405');
                expect(can).not.toContain('#lc=');
            });

            test('usa computrabajo:url:<canonica> si no hay ID disponible', () => {
                const url = 'https://ar.computrabajo.com/ofertas-de-trabajo/puesto-general?utm_source=cpc';
                const identidad = obtenerIdentidadCanonica({ url, plataforma: 'computrabajo' });
                expect(identidad).toBe('computrabajo:url:https://ar.computrabajo.com/ofertas-de-trabajo/puesto-general');
            });
        });

        describe('Bumeran', () => {
            test('extrae ID numérico del path en Bumeran', () => {
                const url = 'https://www.bumeran.com.ar/empleos/semisr-full-stack-developer-node-react-aws-mindit-hr-agency-1118193886.html?utm_campaign=share';
                const id = extraerIdentificadorPlataforma(url, 'bumeran');
                expect(id).toBe('1118193886');

                const identidad = obtenerIdentidadCanonica({ url, plataforma: 'bumeran' });
                expect(identidad).toBe('bumeran:1118193886');
            });
        });

        describe('Glassdoor', () => {
            test('extrae jl de searchParams o datosCrudos', () => {
                const url = 'https://www.glassdoor.com/job-listing/senior-engineer-jl=100889977?utm_source=feed';
                const id = extraerIdentificadorPlataforma(url, 'glassdoor');
                expect(id).toBe('100889977');

                const identidad = obtenerIdentidadCanonica({ url, plataforma: 'glassdoor' });
                expect(identidad).toBe('glassdoor:100889977');
            });
        });

        describe('Jooble, RemoteOK, Remotive, InfoJobs, Adzuna', () => {
            test('Jooble usa item.id si está disponible, o url limpia', () => {
                const item = { link: 'https://jooble.org/desc/9876543210', id: '9876543210' };
                const identidad = obtenerIdentidadCanonica({ url: item.link, plataforma: 'jooble', datos_crudos: item });
                expect(identidad).toBe('jooble:9876543210');
            });

            test('Remotive usa item.id estable', () => {
                const item = { url: 'https://remotive.com/remote-jobs/12345', id: 12345 };
                const identidad = obtenerIdentidadCanonica({ url: item.url, plataforma: 'remotive', datos_crudos: item });
                expect(identidad).toBe('remotive:12345');
            });

            test('RemoteOK usa item.id estable', () => {
                const item = { url: 'https://remoteok.com/remote-jobs/8888', id: '8888' };
                const identidad = obtenerIdentidadCanonica({ url: item.url, plataforma: 'remoteok', datos_crudos: item });
                expect(identidad).toBe('remoteok:8888');
            });

            test('InfoJobs usa item.id si está disponible', () => {
                const item = { link: 'https://www.infojobs.net/madrid/puesto/of-i12345', id: 'i12345' };
                const identidad = obtenerIdentidadCanonica({ url: item.link, plataforma: 'infojobs', datos_crudos: item });
                expect(identidad).toBe('infojobs:i12345');
            });

            test('Adzuna usa item.id si está disponible', () => {
                const item = { redirect_url: 'https://www.adzuna.es/land/ad/445566', id: '445566' };
                const identidad = obtenerIdentidadCanonica({ url: item.redirect_url, plataforma: 'adzuna', datos_crudos: item });
                expect(identidad).toBe('adzuna:445566');
            });

            test('sin ID en proveedor, usa plataforma:url:<canonica>', () => {
                const url = 'https://remoteok.com/remote-jobs/slug-sin-id?utm_source=twitter';
                const identidad = obtenerIdentidadCanonica({ url, plataforma: 'remoteok' });
                expect(identidad).toBe('remoteok:url:https://remoteok.com/remote-jobs/slug-sin-id');
            });
        });
    });

    describe('Integración con servicio-normalizacion', () => {

        test('normalizarOfertaIndeed agrega identidad_canonica y guarda url_original si hay tracking', () => {
            const item = {
                url: 'https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876&from=serp&tk=tracking123',
                title: 'Node Dev',
                location: { city: 'Buenos Aires', countryName: 'Argentina' },
            };
            const resultado = normalizarOfertaIndeed(item);

            expect(resultado.identidad_canonica).toBe('indeed:5a8b3c2d1e0f9876');
            expect(resultado.url).toBe('https://ar.indeed.com/viewjob?jk=5a8b3c2d1e0f9876');
            expect(resultado.datos_crudos.url_original).toBe(item.url);
        });

        test('normalizarOfertaLinkedin agrega identidad_canonica y guarda url_original si hay tracking', () => {
            const item = {
                jobUrl: 'https://www.linkedin.com/jobs/view/4386138111?refId=trackingVal',
                title: 'React Dev',
            };
            const resultado = normalizarOfertaLinkedin(item);

            expect(resultado.identidad_canonica).toBe('linkedin:4386138111');
            expect(resultado.url).toBe('https://www.linkedin.com/jobs/view/4386138111');
            expect(resultado.datos_crudos.url_original).toBe(item.jobUrl);
        });

        test('normalizarOfertaLinkedin con ID no numérico de 8-16 dígitos usa normalización conservadora', () => {
            const item = {
                jobUrl: 'https://www.linkedin.com/jobs/view/short-id-123?refId=trackingVal',
                title: 'React Dev',
            };
            const resultado = normalizarOfertaLinkedin(item);

            expect(resultado.identidad_canonica).toBe('linkedin:url:https://www.linkedin.com/jobs/view/short-id-123');
            expect(resultado.url).toBe('https://www.linkedin.com/jobs/view/short-id-123');
            expect(resultado.datos_crudos.url_original).toBe(item.jobUrl);
        });

        test('normalizarOfertaComputrabajo agrega identidad_canonica y guarda url_original si hay tracking', () => {
            const item = {
                url: 'https://ar.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-BD5787E139E8632061373E686DCF3405#lc=123',
                title: 'Analista',
            };
            const resultado = normalizarOfertaComputrabajo(item);

            expect(resultado.identidad_canonica).toBe('computrabajo:BD5787E139E8632061373E686DCF3405');
            expect(resultado.datos_crudos.url_original).toBe(item.url);
        });

        // B-01: Glassdoor con ID jl en path
        test('B-01: Glassdoor extrae ID jl desde el path (/senior-engineer-jl=100889977) de forma coherente', () => {
            const urlPath = 'https://www.glassdoor.com/job-listing/senior-engineer-jl=100889977?utm_campaign=google';
            const urlQuery = 'https://www.glassdoor.com/job-listing/?jl=100889977';

            const idPath = obtenerIdentidadCanonica({ url: urlPath, plataforma: 'glassdoor' });
            const idQuery = obtenerIdentidadCanonica({ url: urlQuery, plataforma: 'glassdoor' });

            expect(idPath).toBe('glassdoor:100889977');
            expect(idQuery).toBe('glassdoor:100889977');
            expect(idPath).toBe(idQuery);
        });

        // B-01: GetOnBrd prioridad a slug de path sobre datos_crudos.id
        test('B-01: GetOnBrd prioriza slug de path sobre datos_crudos.id arbitrario', () => {
            const item = {
                url: 'https://www.getonbrd.com/jobs/react-developer#seccion',
                plataforma: 'getonbrd',
                datos_crudos: { id: 'uuid-aleatorio-1234' },
            };
            const identidad = obtenerIdentidadCanonica(item);
            expect(identidad).toBe('getonbrd:react-developer');
        });

        // B-04: URL extensa sin ID (> 500 chars) genera clave estable sin colisión ni exceder 500 chars
        test('B-04: URL extensa sin ID (> 500 chars) genera clave estable sin exceder 500 chars', () => {
            const paramLargo = 'a'.repeat(600);
            const urlLarga1 = `https://portal-desconocido.com/empleo?token=${paramLargo}&ref=1`;
            const urlLarga2 = `https://portal-desconocido.com/empleo?token=${paramLargo}&ref=2`;

            const id1 = obtenerIdentidadCanonica({ url: urlLarga1, plataforma: 'general' });
            const id2 = obtenerIdentidadCanonica({ url: urlLarga2, plataforma: 'general' });

            // Longitud segura
            expect(id1.length).toBeLessThanOrEqual(500);
            expect(id2.length).toBeLessThanOrEqual(500);

            // Formato determinista url-hash
            expect(id1).toMatch(/^general:url-hash:[a-f0-9]{32}$/);
            expect(id2).toMatch(/^general:url-hash:[a-f0-9]{32}$/);

            // URLs distintas no colisionan
            expect(id1).not.toBe(id2);

            // Misma URL da exactamente el mismo hash determinista
            const id1Reejecutada = obtenerIdentidadCanonica({ url: urlLarga1, plataforma: 'general' });
            expect(id1Reejecutada).toBe(id1);
        });

        // B-01 reauditoría Lote 6: Precedencia estricta Indeed (jk sobre vjk) y LinkedIn (currentJobId sobre jobId)
        test('B-01 Lote 6: Indeed prioriza jk sobre vjk sin importar el orden en la query', () => {
            const urlInv = 'https://ar.indeed.com/viewjob?vjk=OLD456&jk=NEW123';
            const urlDir = 'https://ar.indeed.com/viewjob?jk=NEW123&vjk=OLD456';

            expect(obtenerIdentidadCanonica({ url: urlInv, plataforma: 'indeed' })).toBe('indeed:new123');
            expect(obtenerIdentidadCanonica({ url: urlDir, plataforma: 'indeed' })).toBe('indeed:new123');
            expect(canonizarUrlPlataforma(urlInv, 'indeed')).toBe('https://ar.indeed.com/viewjob?jk=new123');
            expect(canonizarUrlPlataforma(urlDir, 'indeed')).toBe('https://ar.indeed.com/viewjob?jk=new123');
        });

        test('B-01 Lote 6: LinkedIn prioriza currentJobId sobre jobId sin importar el orden en la query', () => {
            const urlInv = 'https://www.linkedin.com/jobs/search/?jobId=11111111&currentJobId=22222222';
            const urlDir = 'https://www.linkedin.com/jobs/search/?currentJobId=22222222&jobId=11111111';

            expect(obtenerIdentidadCanonica({ url: urlInv, plataforma: 'linkedin' })).toBe('linkedin:22222222');
            expect(obtenerIdentidadCanonica({ url: urlDir, plataforma: 'linkedin' })).toBe('linkedin:22222222');
            expect(canonizarUrlPlataforma(urlInv, 'linkedin')).toBe('https://www.linkedin.com/jobs/view/22222222');
            expect(canonizarUrlPlataforma(urlDir, 'linkedin')).toBe('https://www.linkedin.com/jobs/view/22222222');
        });

        // B-03 reauditoría Lote 6: LinkedIn con 17 dígitos no se captura como ID de 16 dígitos
        test('B-03 Lote 6: LinkedIn con 17 dígitos no se captura como ID parcial y usa fallback URL', () => {
            const url17 = 'https://www.linkedin.com/jobs/view/12345678901234567';
            const id = obtenerIdentidadCanonica({ url: url17, plataforma: 'linkedin' });
            expect(id).toBe('linkedin:url:https://www.linkedin.com/jobs/view/12345678901234567');
            expect(id).not.toBe('linkedin:1234567890123456');
        });

        // B-02 reauditoría Lote 6: UTF-8 percent-encoded truncado WHATWG
        test('B-02 Lote 6: UTF-8 percent-encoded truncado produce reemplazo único U+FFFD', () => {
            const urlTrunc3 = 'https://empleos.example/oferta?q=%E2%82';
            const urlTrunc4 = 'https://empleos.example/oferta?q=%F0%9F%9A';
            const urlInterrumpido = 'https://empleos.example/oferta?q=%E2%28%A1';
            const urlOverlong = 'https://empleos.example/oferta?q=%C0%AF';

            expect(canonizarUrlPlataforma(urlTrunc3, 'general')).toBe('https://empleos.example/oferta?q=%EF%BF%BD');
            expect(canonizarUrlPlataforma(urlTrunc4, 'general')).toBe('https://empleos.example/oferta?q=%EF%BF%BD');
            expect(canonizarUrlPlataforma(urlInterrumpido, 'general')).toBe('https://empleos.example/oferta?q=%EF%BF%BD%28%EF%BF%BD');
            expect(canonizarUrlPlataforma(urlOverlong, 'general')).toBe('https://empleos.example/oferta?q=%EF%BF%BD%EF%BF%BD');
        });
    });
});
