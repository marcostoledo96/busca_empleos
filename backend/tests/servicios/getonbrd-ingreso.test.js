jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
jest.mock('../../src/servicios/servicio-evaluacion', () => ({ evaluarOfertasPendientes: jest.fn() }));
const { PLATAFORMAS } = require('../../src/config/plataformas');
const modelo = require('../../src/modelos/oferta');
const bd = require('../../src/config/base-datos');
beforeEach(() => bd.reiniciar());
const historial = require('../../src/modelos/ejecucion-busqueda');
const evaluacion = require('../../src/servicios/servicio-evaluacion');
const { ejecutarFuente, conHistorial } = require('../../src/servicios/servicio-resultados-fuente');
const { ejecutarScrapingGetonbrd } = require('../../src/servicios/servicio-scraping');
const { DESTINO_SANDBOX } = require('../../src/config/getonbrd');
const { crearRespuestaGetonbrd, crearOfertaGetonbrd } = require('../fixtures/getonbrd/paginas');

const URLS_INVALIDAS = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://www.getonbrd.com/jobs/segura',
    'https://attacker.example/jobs/segura',
];

test('descarto enlaces inválidos antes del cupo, la identidad y el ingreso común', async () => {
    const activa = jest.spyOn(PLATAFORMAS.getonbrd, 'activa', 'get').mockReturnValue(true);
    const guardar = jest.spyOn(modelo, 'crearOferta');
    try {
        const cliente = jest.fn().mockResolvedValue(crearRespuestaGetonbrd([
            ...URLS_INVALIDAS.map(url => crearOfertaGetonbrd({ id: 'segura', url })),
            crearOfertaGetonbrd({ id: 'segura', url: 'https://www.getonbrd.com/jobs/segura/#detalle' }),
        ]));
        const resultado = await ejecutarFuente('getonbrd', ejecutarScrapingGetonbrd,
            { destino: DESTINO_SANDBOX, cliente, terminos: ['qa'], maxResultados: 1 });
        expect(resultado).toMatchObject({ estado: 'parcial', motivoFinalizacion: 'limite_items',
            nuevas: 1, totalCrudos: 5, totalExtraidas: 1, totalElegibles: 1, invalidas: 4,
            normalizadas: 5, dentro_ventana: 1, duplicadas_intra_run: 0,
            checkpoint: { pagina_confirmada: 1, pagina_siguiente: 2, item_offset: 0 } });
        expect(guardar).toHaveBeenCalledTimes(1);
        expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://www.getonbrd.com/jobs/segura' }));
        const listado = await modelo.obtenerOfertas({ plataforma: 'getonbrd' });
        expect(listado.ofertas.filter(oferta => oferta.url.includes('segura'))).toEqual([
            expect.objectContaining({ url: 'https://www.getonbrd.com/jobs/segura', estado_postulacion: 'no_postulado' }),
        ]);
        expect(listado.ofertas.every(oferta => !URLS_INVALIDAS.includes(oferta.url))).toBe(true);
        expect(evaluacion.evaluarOfertasPendientes).not.toHaveBeenCalled();
        expect(cliente).toHaveBeenCalledTimes(1);
    } finally {
        guardar.mockRestore();
        activa.mockRestore();
    }
});

test('un lote de enlaces inválidos no invoca el modelo ni modifica el listado', async () => {
    const activa = jest.spyOn(PLATAFORMAS.getonbrd, 'activa', 'get').mockReturnValue(true);
    const guardar = jest.spyOn(modelo, 'crearOferta');
    try {
        const anterior = await modelo.obtenerOfertas({ plataforma: 'getonbrd' });
        const cliente = jest.fn().mockResolvedValue(crearRespuestaGetonbrd(
            URLS_INVALIDAS.map(url => crearOfertaGetonbrd({ id: 'rechazada', url }))));
        const resultado = await ejecutarFuente('getonbrd', ejecutarScrapingGetonbrd,
            { destino: DESTINO_SANDBOX, cliente, terminos: ['qa'], maxResultados: 1 });
        expect(resultado).toMatchObject({ estado: 'sin_resultados', nuevas: 0, actualizadas: 0,
            reapariciones: 0, duplicadas: 0, erroresGuardado: 0, totalCrudos: 4,
            totalExtraidas: 0, totalElegibles: 0, invalidas: 4, duplicadas_intra_run: 0 });
        expect(guardar).not.toHaveBeenCalled();
        expect(await modelo.obtenerOfertas({ plataforma: 'getonbrd' })).toEqual(anterior);
        expect(evaluacion.evaluarOfertasPendientes).not.toHaveBeenCalled();
        expect(cliente).toHaveBeenCalledTimes(1);
    } finally {
        guardar.mockRestore();
        activa.mockRestore();
    }
});

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
            estado_postulacion: 'no_postulado', url: 'https://www.getonbrd.com/jobs/persistida' })]);
        const ejecuciones = await historial.listar();
        expect(ejecuciones[0].resumen.fuentes[0]).toMatchObject({ plataforma: 'getonbrd', estado: 'completada', nuevas: 1,
            checkpoint: { pagina_confirmada: 1, pagina_siguiente: 2 } });
        expect(evaluacion.evaluarOfertasPendientes).not.toHaveBeenCalled();
        expect(cliente).toHaveBeenCalledTimes(1);
    } finally { activa.mockRestore(); }
});
