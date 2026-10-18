jest.mock('../../src/config/base-datos', () => require('../helpers/bd-busquedas-memoria').crearAdaptadorBusqueda());
jest.mock('../../src/servicios/servicio-evaluacion', () => ({ evaluarOfertasPendientes: jest.fn() }));
const { createHash } = require('node:crypto');
const bd = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/oferta');
const { PLATAFORMAS } = require('../../src/config/plataformas');
const { ejecutarFuente } = require('../../src/servicios/servicio-resultados-fuente');
const { ejecutarScrapingGetonbrd: piloto, _normalizarUrlGetonbrd: validar } = require('../../src/servicios/servicio-scraping');
const { DESTINO_SANDBOX } = require('../../src/config/getonbrd');
const { crearOfertaGetonbrd: oferta, crearRespuestaGetonbrd: respuesta } = require('../fixtures/getonbrd/paginas');
const invalidas = [
    'javascript:alert(1)', 'data:text/html,malicioso', 'ftp://www.getonbrd.com/jobs/comun',
    'http://www.getonbrd.com/jobs/comun', 'https://attacker.example/jobs/comun',
    'https://www.getonbrd.com.attacker.example/jobs/comun', 'https://sub.www.getonbrd.com/jobs/comun',
    'https://getonbrd.com/jobs/comun', 'https://www.getonbrd.com.ar/jobs/comun',
    'https://www.getonbrd.com./jobs/comun', 'https://www.getonbrd.com:80/jobs/comun',
    'https://www.getonbrd.com:444/jobs/comun', 'https://usuario@www.getonbrd.com/jobs/comun',
    'https://:clave@www.getonbrd.com/jobs/comun', 'https://www.getonbrd.com@attacker.example/jobs/comun',
    '//www.getonbrd.com/jobs/comun', '/jobs/comun', 'no es URL', '',
];
const hash = () => createHash('sha256').update(JSON.stringify(bd.ofertas)).digest('hex');
let activa;
beforeEach(() => {
    bd.reiniciar();
    activa = jest.spyOn(PLATAFORMAS.getonbrd, 'activa', 'get').mockReturnValue(true);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Red real prohibida'));
});
afterEach(() => jest.restoreAllMocks());
async function ejecutar(items, maxResultados = 1) {
    const cliente = jest.fn().mockResolvedValue(respuesta(items));
    const resultado = await ejecutarFuente('getonbrd', piloto,
        { destino: DESTINO_SANDBOX, cliente, terminos: ['qa'], maxResultados });
    expect(cliente).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(require('../../src/servicios/servicio-evaluacion').evaluarOfertasPendientes).not.toHaveBeenCalled();
    return resultado;
}
// S5/S10/S11/S13: verifico el helper y el recorrido real por separado.
test('rechazo esquemas, autoridades y valores vacíos en el helper', () => {
    for (const url of [...invalidas, null, undefined, 0, {}]) expect(validar(url)).toBeNull();
});
test('cada rechazo deja el almacenamiento y los campos manuales byte-idénticos', async () => {
    bd.ofertas.push({ id: 900, url: 'https://www.getonbrd.com/jobs/previa',
        estado_postulacion: 'postulado', fecha_postulacion: '2026-10-01', notas: 'Conservar' });
    const guardar = jest.spyOn(modelo, 'crearOferta');
    for (const url of invalidas) {
        const item = oferta({ id: 'comun' });
        item.links.public_url = url;
        const anterior = hash();
        const resultado = await ejecutar([item]);
        expect(resultado).toMatchObject({ estado: 'sin_resultados', nuevas: 0, actualizadas: 0,
            reapariciones: 0, duplicadas: 0, erroresGuardado: 0, totalCrudos: 1, totalExtraidas: 0,
            totalElegibles: 0, invalidas: 1, duplicadas_intra_run: 0 });
        expect(hash()).toBe(anterior);
        expect(guardar).not.toHaveBeenCalled();
    }
});
test('los rechazos no consumen cupo ni identidad del siguiente aviso legítimo', async () => {
    const items = invalidas.map(url => ({ ...oferta({ id: 'comun' }), links: { public_url: url } }));
    items.push(oferta({ id: 'comun', url: 'https://www.getonbrd.com:443/jobs/comun/#detalle' }));
    const resultado = await ejecutar(items);
    expect(resultado).toMatchObject({ estado: 'parcial', motivoFinalizacion: 'limite_items', nuevas: 1,
        totalExtraidas: 1, invalidas: invalidas.length, duplicadas_intra_run: 0, dentro_ventana: 1 });
    expect(bd.ofertas).toEqual([expect.objectContaining({ url: 'https://www.getonbrd.com/jobs/comun' })]);
});
test('conservo variantes HTTPS legítimas y deduplicación canónica', async () => {
    const urls = ['https://www.getonbrd.com/jobs/comun', 'https://www.getonbrd.com/jobs/comun/#x',
        'https://www.getonbrd.com:443/jobs/comun', 'https://WWW.GETONBRD.COM/jobs/comun'];
    for (const url of urls) expect(validar(url)).toBe(urls[0]);
    const resultado = await ejecutar(urls.map(url => oferta({ id: 'comun', url })), 2);
    expect(resultado).toMatchObject({ estado: 'completada', nuevas: 1, totalCrudos: 4,
        totalExtraidas: 1, invalidas: 0, duplicadas_intra_run: 3 });
    expect(bd.ofertas[0].url).toBe(urls[0]);
});

// S9/S13: ejecuto el request documental en el controlador común con HTTP inyectado.
test('el ejemplo operativo documentado conserva el contrato y los alias comunes', async () => {
    const texto = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../docs/api-rest.md'), 'utf8');
    const seccion = texto.split('### POST /api/scraping/getonbrd')[1].split('\n---')[0];
    const body = JSON.parse(seccion.match(/```json\s*([\s\S]*?)```/)[1]);
    expect(body).toEqual({ terminos: ['qa junior'], maxResultados: 10, maxPeticiones: 1 });
    const scraping = require('../../src/servicios/servicio-scraping');
    const cliente = jest.fn().mockResolvedValue(respuesta([oferta({ id: 'documentada' })]));
    jest.spyOn(scraping, 'ejecutarScrapingGetonbrd').mockImplementation(opciones => piloto({ ...opciones, destino: DESTINO_SANDBOX, cliente }));
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await require('../../src/controladores/controlador-scraping').scrapearGetonbrd({ body }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const salida = res.json.mock.calls[0][0];
    expect(salida).toMatchObject({ exito: true, datos: { fuente: { estado: 'completada', nuevas: 1 },
        ofertas_nuevas: 1, ofertas_actualizadas: 0, ofertas_reapariciones: 0, ofertas_duplicadas: 0,
        total_extraidas: 1, historial: { guardado: true }, configuracion: { maxResultados: 10 } } });
    expect(salida.datos.ofertas).toBeUndefined();
    expect(cliente).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
});
test('la deshabilitación conserva los alias legacy sin consultar ni guardar ofertas', async () => {
    activa.mockReturnValue(false);
    const anterior = hash();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await require('../../src/controladores/controlador-scraping').scrapearGetonbrd({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ exito: true, datos: { fuente: { estado: 'deshabilitada' },
        estado: 'bloqueado', motivo_terminacion: 'politica_destino', destino: 'bloqueado', ofertas: [],
        metricas: { requests: 0 }, total_extraidas: 0 } });
    expect(hash()).toBe(anterior);
    expect(global.fetch).not.toHaveBeenCalled();
});
