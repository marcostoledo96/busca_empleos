jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
jest.mock('node-cron', () => ({ createTask: jest.fn(), validate: jest.fn(() => true) }));
jest.mock('../../src/servicios/servicio-evaluacion', () => ({ obtenerProgresoEvaluacion: jest.fn(() => ({ activo: false })), evaluarOfertasPendientes: jest.fn(async () => ({ estado: 'completada', aprobadas: 0, rechazadas: 0, errores: 0 })) }));
jest.mock('../../src/servicios/servicio-notificacion-email', () => ({ enviarResumenCiclo: jest.fn(async () => {}) }));
jest.mock('../../src/utils/bloqueo-concurrente', () => ({ CLAVES: { EVALUACION_OFERTAS: 1 }, intentarAdquirirLock: jest.fn(async () => ({ ok: true, client: {} })), liberarBloqueoSeguro: jest.fn(async () => {}) }));
const pool = require('../../src/config/base-datos');
const cron = require('node-cron');
const scraping = require('../../src/servicios/servicio-scraping');
const evaluacion = require('../../src/servicios/servicio-evaluacion');
const { PLATAFORMAS } = require('../../src/config/plataformas');
const servicio = require('../../src/servicios/servicio-automatizacion');
const modeloCron = require('../../src/modelos/configuracion-cron');
const { DESTINO_SANDBOX } = require('../../src/config/getonbrd');
beforeEach(() => { pool.reiniciar(); jest.clearAllMocks(); servicio._resetearEstado(); delete process.env.GETONBRD_ENABLED; });
afterEach(() => { jest.restoreAllMocks(); delete process.env.GETONBRD_ENABLED; });
// S2,S7,S10: una sola invocación, omisión efectiva y configuración persistida intacta.
test.each([true, false])('ciclo con habilitación %s no crea cron y consulta exactamente una vez o ninguna', async habilitado => {
    const original = scraping.ejecutarScrapingGetonbrd;
    const http = jest.fn(async () => ({ ok: true, json: async () => ({ data: [], meta: { total_pages: 1 } }) }));
    const piloto = jest.spyOn(scraping, 'ejecutarScrapingGetonbrd').mockImplementation(opciones => original({ ...opciones, destino: DESTINO_SANDBOX, cliente: http }));
    const otras = Object.values(PLATAFORMAS).filter(p => p.id !== 'getonbrd').map(p => [p, p.activa]);
    for (const [p] of otras) p.activa = false;
    try {
        await modeloCron.guardar({ activo: false, expresionCron: '17 3 * * 1', zonaHoraria: 'America/Argentina/Buenos_Aires' });
        const antes = await modeloCron.obtener();
        pool.query.mockClear();
        process.env.GETONBRD_ENABLED = String(habilitado);
        const resultado = await servicio.ejecutarCicloCompleto({ terminos: ['qa'] });
        expect(piloto).toHaveBeenCalledTimes(habilitado ? 1 : 0);
        expect(http).toHaveBeenCalledTimes(habilitado ? 1 : 0);
        expect(resultado.fuentes.find(f => f.plataforma === 'getonbrd').estado).toBe(habilitado ? 'sin_resultados' : 'deshabilitada');
        expect(evaluacion.evaluarOfertasPendientes).toHaveBeenCalledTimes(1);
        expect(cron.createTask).not.toHaveBeenCalled();
        expect(await modeloCron.obtener()).toEqual(antes);
        expect(pool.query.mock.calls.filter(([sql]) => /INSERT INTO configuracion_cron/.test(sql))).toHaveLength(0);
    } finally { for (const [p, activa] of otras) p.activa = activa; }
});
test('la rehidratación sin programación explícita no crea ni guarda cron aunque habilite GetOnBrd', async () => {
    process.env.GETONBRD_ENABLED = 'true';
    const resultado = await servicio.rehidratar();
    expect(resultado.activo).toBe(false);
    expect(cron.createTask).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.filter(([sql]) => /INSERT INTO configuracion_cron/.test(sql))).toHaveLength(0);
});
