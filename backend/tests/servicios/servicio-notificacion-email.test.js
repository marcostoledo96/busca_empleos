// Tests del servicio de notificación por email — verifico config, contenido y resiliencia.
//
// ¿Qué es nodemailer? Es una librería de Node.js para enviar emails por SMTP.
// En estos tests mockeamos nodemailer para no enviar emails reales.
// Testeamos la LÓGICA: config soft-disable, armado de HTML/texto, escape de datos,
// y que errores de envío no rompen el ciclo.

jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const servicioNotificacionEmail = require('../../src/servicios/servicio-notificacion-email');

describe('Servicio de notificación por email', () => {
    // Guardo las variables de entorno originales para restaurarlas después de cada test.
    const envOriginal = { ...process.env };

    afterEach(() => {
        // Restauro process.env para que un test no afecte al siguiente.
        process.env = { ...envOriginal };
        jest.clearAllMocks();
    });

    describe('obtenerConfigEmail()', () => {
        test('retorna habilitado=false si faltan variables SMTP obligatorias', () => {
            // Borro las variables SMTP para simular un entorno sin configuración.
            delete process.env.SMTP_HOST;
            delete process.env.SMTP_USER;
            delete process.env.SMTP_PASS;
            delete process.env.EMAIL_NOTIFICACION_DESTINO;

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.habilitado).toBe(false);
            expect(config.faltantes).toContain('SMTP_HOST');
            expect(config.faltantes).toContain('SMTP_USER');
            expect(config.faltantes).toContain('SMTP_PASS');
            expect(config.faltantes).toContain('EMAIL_NOTIFICACION_DESTINO');
        });

        test('retorna habilitado=true con todas las variables configuradas', () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_PORT = '465';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.habilitado).toBe(true);
            expect(config.host).toBe('smtp.gmail.com');
            expect(config.port).toBe(465);
            expect(config.secure).toBe(true);
            expect(config.user).toBe('test@gmail.com');
            expect(config.destino).toBe('destino@gmail.com');
        });

        test('usa puerto 587 por defecto con secure=false', () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';
            delete process.env.SMTP_PORT;

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.port).toBe(587);
            expect(config.secure).toBe(false);
        });

        test('usa SMTP_USER como FROM si SMTP_FROM no está configurado', () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';
            delete process.env.SMTP_FROM;

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.from).toBe('test@gmail.com');
        });

        test('respeta SMTP_FROM si está configurado', () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';
            process.env.SMTP_FROM = 'noreply@buscaempleos.com';

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.from).toBe('noreply@buscaempleos.com');
        });

        test('puerto 465 usa secure=true (SSL/TLS directo)', () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_PORT = '465';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.secure).toBe(true);
        });

        test('puerto 587 usa secure=false (STARTTLS)', () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_PORT = '587';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';

            const config = servicioNotificacionEmail.obtenerConfigEmail();

            expect(config.secure).toBe(false);
        });
    });

    describe('armarResumenEmail()', () => {
        test('genera asunto, HTML y texto plano con métricas completas', () => {
            const resumen = {
                exito: true,
                scraping: {
                    linkedin: 10,
                    computrabajo: 5,
                    indeed: 0,
                    bumeran: 0,
                    glassdoor: 0,
                    getonbrd: 0,
                    jooble: 3,
                    google_jobs: 0,
                    remotive: 0,
                    remoteok: 0,
                    infojobs: 0,
                    adzuna: 0,
                    totalExtraidas: 18,
                    guardadas: 15,
                    descartadasPorIdioma: 3,
                },
                evaluacion: {
                    total: 15,
                    aprobadas: 8,
                    rechazadas: 7,
                    errores: 0,
                },
                errores: [],
                fechaEjecucion: '2026-06-16T20:00:00.000Z',
                duracionSegundos: 120,
            };

            const resultado = servicioNotificacionEmail.armarResumenEmail(resumen);

            // Asunto contiene totales.
            expect(resultado.asunto).toContain('18');
            expect(resultado.asunto).toContain('15');

            // HTML contiene plataformas con resultados.
            expect(resultado.html).toContain('LinkedIn');
            expect(resultado.html).toContain('10');
            expect(resultado.html).toContain('Computrabajo');
            expect(resultado.html).toContain('5');
            expect(resultado.html).toContain('Jooble');
            expect(resultado.html).toContain('3');

            // HTML contiene totales y evaluación.
            expect(resultado.html).toContain('Total extraídas');
            expect(resultado.html).toContain('18');
            expect(resultado.html).toContain('Guardadas');
            expect(resultado.html).toContain('15');
            expect(resultado.html).toContain('Descartadas por idioma');
            expect(resultado.html).toContain('3');
            expect(resultado.html).toContain('Evaluación IA');
            expect(resultado.html).toContain('8'); // aprobadas
            expect(resultado.html).toContain('7'); // rechazadas

            // Texto plano contiene la misma información.
            expect(resultado.texto).toContain('LinkedIn: 10');
            expect(resultado.texto).toContain('Computrabajo: 5');
            expect(resultado.texto).toContain('Total extraídas: 18');
            expect(resultado.texto).toContain('Guardadas (nuevas): 15');
            expect(resultado.texto).toContain('Aprobadas: 8');
        });

        test('maneja métricas en cero sin romper el HTML', () => {
            const resumen = {
                exito: true,
                scraping: {
                    linkedin: 0,
                    computrabajo: 0,
                    indeed: 0,
                    bumeran: 0,
                    glassdoor: 0,
                    getonbrd: 0,
                    jooble: 0,
                    google_jobs: 0,
                    remotive: 0,
                    remoteok: 0,
                    infojobs: 0,
                    adzuna: 0,
                    totalExtraidas: 0,
                    guardadas: 0,
                    descartadasPorIdioma: 0,
                },
                evaluacion: null,
                errores: [],
                fechaEjecucion: '2026-06-16T20:00:00.000Z',
                duracionSegundos: 30,
            };

            const resultado = servicioNotificacionEmail.armarResumenEmail(resumen);

            // Asunto muestra ceros.
            expect(resultado.asunto).toContain('0');

            // HTML contiene "Sin datos de plataformas" cuando todas son cero.
            expect(resultado.html).toContain('Sin datos de plataformas');

            // Texto plano también.
            expect(resultado.texto).toContain('Sin datos de plataformas');

            // Evaluación no disponible.
            expect(resultado.html).toContain('Evaluación IA no disponible');
            expect(resultado.texto).toContain('Evaluación IA no disponible');

            // Sin errores.
            expect(resultado.html).toContain('Sin errores');
            expect(resultado.texto).toContain('Sin errores');
        });

        test('escapa caracteres HTML en datos dinámicos', () => {
            const resumen = {
                exito: true,
                scraping: {
                    linkedin: 1,
                    computrabajo: 0,
                    indeed: 0,
                    bumeran: 0,
                    glassdoor: 0,
                    getonbrd: 0,
                    jooble: 0,
                    google_jobs: 0,
                    remotive: 0,
                    remoteok: 0,
                    infojobs: 0,
                    adzuna: 0,
                    totalExtraidas: 1,
                    guardadas: 1,
                    descartadasPorIdioma: 0,
                },
                evaluacion: null,
                errores: ['Error en <script>alert("xss")</script>', 'Otro error con &comillas"'],
                fechaEjecucion: '2026-06-16T20:00:00.000Z',
                duracionSegundos: 10,
            };

            const resultado = servicioNotificacionEmail.armarResumenEmail(resumen);

            // Los caracteres especiales deben estar escapados en HTML.
            expect(resultado.html).toContain('&lt;script&gt;');
            expect(resultado.html).toContain('&amp;comillas&quot;');
            // El HTML NO debe contener el tag script sin escapar.
            expect(resultado.html).not.toContain('<script>alert');
        });

        test('incluye errores cuando los hay', () => {
            const resumen = {
                exito: true,
                scraping: {
                    linkedin: 5,
                    computrabajo: 0,
                    indeed: 0,
                    bumeran: 0,
                    glassdoor: 0,
                    getonbrd: 0,
                    jooble: 0,
                    google_jobs: 0,
                    remotive: 0,
                    remoteok: 0,
                    infojobs: 0,
                    adzuna: 0,
                    totalExtraidas: 5,
                    guardadas: 4,
                    descartadasPorIdioma: 1,
                },
                evaluacion: { total: 4, aprobadas: 2, rechazadas: 2, errores: 0 },
                errores: ['Error en scraping de LinkedIn: timeout'],
                fechaEjecucion: '2026-06-16T20:00:00.000Z',
                duracionSegundos: 45,
            };

            const resultado = servicioNotificacionEmail.armarResumenEmail(resumen);

            expect(resultado.html).toContain('Errores');
            expect(resultado.html).toContain('Error en scraping de LinkedIn');
            expect(resultado.texto).toContain('Error en scraping de LinkedIn');
        });

        test('incluye errores de evaluación IA cuando los hay', () => {
            const resumen = {
                exito: true,
                scraping: {
                    linkedin: 3, computrabajo: 0, indeed: 0, bumeran: 0, glassdoor: 0,
                    getonbrd: 0, jooble: 0, google_jobs: 0, remotive: 0, remoteok: 0,
                    infojobs: 0, adzuna: 0, totalExtraidas: 3, guardadas: 3,
                    descartadasPorIdioma: 0,
                },
                evaluacion: { total: 3, aprobadas: 1, rechazadas: 1, errores: 1 },
                errores: [],
                fechaEjecucion: '2026-06-16T20:00:00.000Z',
                duracionSegundos: 60,
            };

            const resultado = servicioNotificacionEmail.armarResumenEmail(resumen);

            expect(resultado.html).toContain('Errores de evaluación');
            expect(resultado.html).toContain('1');
            expect(resultado.texto).toContain('Errores de evaluación: 1');
        });
    });

    describe('enviarResumenCiclo()', () => {
        const mockSendMail = jest.fn();
        const mockCreateTransport = jest.fn();

        beforeEach(() => {
            mockSendMail.mockReset();
            mockCreateTransport.mockReset();
            mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
            nodemailer.createTransport = mockCreateTransport;
        });

        test('retorna deshabilitado=true si faltan variables SMTP', async () => {
            delete process.env.SMTP_HOST;
            delete process.env.SMTP_USER;
            delete process.env.SMTP_PASS;
            delete process.env.EMAIL_NOTIFICACION_DESTINO;

            const resultado = await servicioNotificacionEmail.enviarResumenCiclo({
                exito: true,
                scraping: { totalExtraidas: 0, guardadas: 0 },
                errores: [],
            });

            expect(resultado.enviado).toBe(false);
            expect(resultado.deshabilitado).toBe(true);
            expect(mockCreateTransport).not.toHaveBeenCalled();
        });

        test('envía email exitosamente con configuración SMTP completa', async () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_PORT = '465';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';

            mockSendMail.mockResolvedValue({ messageId: '<abc123@gmail.com>' });

            const resumen = {
                exito: true,
                scraping: {
                    linkedin: 5, computrabajo: 0, indeed: 0, bumeran: 0, glassdoor: 0,
                    getonbrd: 0, jooble: 0, google_jobs: 0, remotive: 0, remoteok: 0,
                    infojobs: 0, adzuna: 0, totalExtraidas: 5, guardadas: 4,
                    descartadasPorIdioma: 1,
                },
                evaluacion: { total: 4, aprobadas: 2, rechazadas: 2, errores: 0 },
                errores: [],
                fechaEjecucion: '2026-06-16T20:00:00.000Z',
                duracionSegundos: 120,
            };

            const resultado = await servicioNotificacionEmail.enviarResumenCiclo(resumen);

            expect(resultado.enviado).toBe(true);
            expect(resultado.messageId).toBe('<abc123@gmail.com>');
            expect(mockCreateTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                })
            );
            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'test@gmail.com',
                    to: 'destino@gmail.com',
                    subject: expect.any(String),
                    html: expect.any(String),
                    text: expect.any(String),
                })
            );
        });

        test('loguea error y retorna sin propagar excepción si sendMail falla', async () => {
            process.env.SMTP_HOST = 'smtp.gmail.com';
            process.env.SMTP_USER = 'test@gmail.com';
            process.env.SMTP_PASS = 'password123';
            process.env.EMAIL_NOTIFICACION_DESTINO = 'destino@gmail.com';

            mockSendMail.mockRejectedValue(new Error('Connection refused'));

            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const resultado = await servicioNotificacionEmail.enviarResumenCiclo({
                exito: true,
                scraping: { totalExtraidas: 0, guardadas: 0 },
                errores: [],
            });

            expect(resultado.enviado).toBe(false);
            expect(resultado.error).toContain('Connection refused');
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error al enviar resumen')
            );
            errorSpy.mockRestore();
        });
    });
});