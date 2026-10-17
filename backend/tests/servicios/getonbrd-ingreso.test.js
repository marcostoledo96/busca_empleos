jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
jest.mock('../../src/servicios/servicio-evaluacion', () => ({ evaluarOfertasPendientes: jest.fn() }));
const { PLATAFORMAS } = require('../../src/config/plataformas');
const modelo = require('../../src/modelos/oferta');
const historial = require('../../src/modelos/ejecucion-busqueda');
const evaluacion = require('../../src/servicios/servicio-evaluacion');
const { ejecutarFuente, conHistorial } = require('../../src/servicios/servicio-resultados-fuente');
const { ejecutarScrapingGetonbrd } = require('../../src/servicios/servicio-scraping');
const { DESTINO_SANDBOX } = require('../../src/config/getonbrd');
const { crearRespuestaGetonbrd, crearOfertaGetonbrd } = require('../fixtures/getonbrd/paginas');

test('recorro HTTP simulado → normalización → ingreso/modelo real → listado e historial con pg sintético, sin IA', async () => {
    const activa = jest.spyOn(PLATAFORMAS.getonbrd, 'activa', 'get').mockReturnValue(true);
    try {
        const cliente = jest.fn().mockResolvedValue(crearRespuestaGetonbrd([crearOfertaGetonbrd({ id: 'persistida' })]));
        const resultado = await conHistorial('individual', async () => {
            const fuente = await ejecutarFuente('getonbrd', ejecutarScrapingGetonbrd,
                { destino: DESTINO_SANDBOX, cliente, terminos: ['qa'] });
            return { estado: fuente.estado, fuentes: [fuente] };
        });
        expect(resultado).toMatchObject({ estado: 'completada', fuentes: [{ nuevas: 1, totalExtraidas: 1, peticionesRealizadas: 1 }] });
        const listado = await modelo.obtenerOfertas({ plataforma: 'getonbrd' });
        expect(listado.ofertas).toEqual([expect.objectContaining({ plataforma: 'getonbrd', titulo: 'Desarrollador frontend junior',
            estado_postulacion: 'no_postulado', url: 'https://fixture.getonbrd.test/jobs/persistida' })]);
        const ejecuciones = await historial.listar();
        expect(ejecuciones[0].resumen.fuentes[0]).toMatchObject({ plataforma: 'getonbrd', estado: 'completada', nuevas: 1,
            checkpoint: { pagina_confirmada: 1, pagina_siguiente: 2 } });
        expect(evaluacion.evaluarOfertasPendientes).not.toHaveBeenCalled();
        expect(cliente).toHaveBeenCalledTimes(1);
    } finally { activa.mockRestore(); }
});
