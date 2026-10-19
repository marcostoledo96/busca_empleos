jest.mock('../../src/modelos/oferta', () => ({
    obtenerOfertasPendientes: jest.fn(),
    actualizarEvaluacion: jest.fn(),
    registrarErrorEvaluacion: jest.fn(),
}));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({
    buscarCache: jest.fn(),
    guardarCache: jest.fn(),
}));
jest.mock('../../src/modelos/evaluacion-lote', () => ({
    crearLote: jest.fn(),
    actualizarProgreso: jest.fn(),
    finalizarLote: jest.fn(),
}));

const RESPUESTA_VALIDA = JSON.stringify({ match: true, porcentaje: 81, razon: 'Compatible' });
const OFERTA = {
    id: 26,
    titulo: 'Desarrollador junior',
    descripcion: 'Desarrollo de aplicaciones con JavaScript y React.',
    modalidad: 'remoto',
    ubicacion: 'Argentina',
    estado_evaluacion: 'pendiente',
    porcentaje_match: null,
    firma_criterios_evaluacion: null,
};

function crearSobre(contenido = RESPUESTA_VALIDA, finalizacion = 'stop') {
    return { choices: [{ finish_reason: finalizacion, message: { content: contenido } }] };
}

describe('Issue #26: conecto el cliente DeepSeek real con el worker real', () => {
    let servicio;
    let ofertas;
    let cache;
    let lotes;
    let fetchSimulado;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.replaceProperty(process, 'env', {
            ...process.env,
            DEEPSEEK_API_KEY: 'clave-sintetica-sin-acceso',
            DOTENV_CONFIG_QUIET: 'true',
        });
        fetchSimulado = jest.spyOn(global, 'fetch')
            .mockRejectedValue(new Error('No permito solicitudes no preparadas'));

        ofertas = require('../../src/modelos/oferta');
        cache = require('../../src/modelos/evaluacion-cache');
        lotes = require('../../src/modelos/evaluacion-lote');
        require('../../src/modelos/preferencia').obtenerPreferencias.mockResolvedValue({
            modelo_ia_evaluacion: 'deepseek-flash',
        });
        ofertas.obtenerOfertasPendientes.mockResolvedValue([{ ...OFERTA }]);
        ofertas.actualizarEvaluacion.mockResolvedValue({ id: OFERTA.id });
        ofertas.registrarErrorEvaluacion.mockResolvedValue({ id: OFERTA.id });
        cache.buscarCache.mockResolvedValue(null);
        lotes.crearLote.mockResolvedValue({ id: 26 });
        servicio = require('../../src/servicios/servicio-evaluacion');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function responder(sobre) {
        fetchSimulado.mockResolvedValueOnce({ ok: true, json: async () => sobre });
    }

    function comprobarError(resumen, estado = 'pendiente') {
        expect(resumen).toMatchObject({
            total: 1, errores: 1, aprobadas: 0, rechazadas: 0,
            evaluadas: 0, procesadas: 1, pendientes: 1,
            activo: false, estado: 'error',
        });
        expect(resumen.detalle).toEqual([{
            id: OFERTA.id, titulo: OFERTA.titulo, estado,
            razon: expect.any(String), error: true,
        }]);
        expect(resumen.mensaje_error).toBe(resumen.detalle[0].razon);
        expect(resumen.mensaje_error.length).toBeGreaterThan(0);
        expect(servicio.obtenerProgresoEvaluacion()).toMatchObject({
            errores: 1, aprobadas: 0, rechazadas: 0, evaluadas: 0,
            estado: 'error', mensaje_error: resumen.mensaje_error,
        });
        expect(lotes.finalizarLote).toHaveBeenLastCalledWith(26, 'error');
    }

    test.each([
        ['salida truncada aunque el JSON esté completo', crearSobre(RESPUESTA_VALIDA, 'length')],
        ['choices ausente', {}],
        ['choices vacío', { choices: [] }],
        ['texto vacío', crearSobre('   ')],
        ['JSON mal formado', crearSobre('{"match":')],
        ['match con tipo inválido', crearSobre(JSON.stringify({ match: 'true', porcentaje: 81, razon: 'Compatible' }))],
        ['match positivo con puntaje bajo', crearSobre(JSON.stringify({ match: true, porcentaje: 20, razon: 'Incoherente' }))],
        ['match negativo con puntaje alto sin exclusión', crearSobre(JSON.stringify({ match: false, porcentaje: 81, razon: 'Incoherente' }))],
    ])('mantengo pendiente sin decisión ni caché ante %s', async (_caso, sobre) => {
        responder(sobre);

        const resumen = await servicio.evaluarOfertasPendientes();

        comprobarError(resumen);
        expect(fetchSimulado).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(
            OFERTA.id, 'pendiente', resumen.mensaje_error,
            null, resumen.mensaje_error, null, null, null, OFERTA.descripcion
        );
        expect(ofertas.registrarErrorEvaluacion).not.toHaveBeenCalled();
        expect(cache.guardarCache).not.toHaveBeenCalled();
    });

    test('aplico el contrato JSON legacy válido mediante el parser real y confirmo la caché', async () => {
        responder(crearSobre());

        const resumen = await servicio.evaluarOfertasPendientes();

        expect(resumen).toMatchObject({
            total: 1, aprobadas: 1, rechazadas: 0, errores: 0,
            evaluadas: 1, pendientes: 0, estado: 'completado', mensaje_error: null,
        });
        expect(resumen.detalle).toEqual([{
            id: OFERTA.id, titulo: OFERTA.titulo,
            estado: 'aprobada', razon: 'Compatible', error: false,
        }]);
        expect(fetchSimulado).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetchSimulado.mock.calls[0][1].body).model).toBe('deepseek-flash');
        expect(fetchSimulado.mock.calls[0][1].headers.Authorization).toBe('Bearer clave-sintetica-sin-acceso');
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(
            OFERTA.id, 'aprobada', 'Compatible', 81, null,
            expect.objectContaining({ detectada: false, puntaje: 0 }),
            expect.any(String), null, OFERTA.descripcion
        );
        expect(cache.guardarCache).toHaveBeenCalledTimes(1);
        expect(cache.guardarCache).toHaveBeenCalledWith(
            expect.any(String), ofertas.actualizarEvaluacion.mock.calls[0][6],
            'deepseek-flash', expect.objectContaining({ match: true, porcentaje: 81, razon: 'Compatible' })
        );
        expect(ofertas.registrarErrorEvaluacion).not.toHaveBeenCalled();
        expect(lotes.finalizarLote).toHaveBeenLastCalledWith(26, 'completado');
    });

    test('conservo la aprobación y caché previas ante reevaluación explícita truncada y aplico el reintento válido', async () => {
        const anterior = {
            ...OFERTA,
            estado_evaluacion: 'aprobada',
            razon_evaluacion: 'Evaluación anterior válida',
            porcentaje_match: 90,
            fecha_evaluacion: '2026-01-01T00:00:00.000Z',
            firma_criterios_evaluacion: 'firma-anterior',
            evaluacion_error_mensaje: null,
        };
        const cacheAnterior = {
            match: true, porcentaje: 90, razon: anterior.razon_evaluacion,
            firma_criterios_evaluacion: anterior.firma_criterios_evaluacion,
        };
        const snapshotAnterior = structuredClone(anterior);
        const snapshotCache = structuredClone(cacheAnterior);
        cache.buscarCache.mockResolvedValue(cacheAnterior);
        responder(crearSobre(RESPUESTA_VALIDA, 'length'));

        const fallido = await servicio.evaluarOfertasPendientes([anterior]);

        comprobarError(fallido, 'aprobada');
        expect(fetchSimulado).toHaveBeenCalledTimes(1);
        expect(ofertas.obtenerOfertasPendientes).not.toHaveBeenCalled();
        expect(cache.buscarCache).not.toHaveBeenCalled();
        expect(ofertas.registrarErrorEvaluacion).toHaveBeenCalledTimes(1);
        expect(ofertas.registrarErrorEvaluacion).toHaveBeenCalledWith(
            anterior.id, fallido.mensaje_error, anterior.descripcion
        );
        expect(ofertas.actualizarEvaluacion).not.toHaveBeenCalled();
        expect(cache.guardarCache).not.toHaveBeenCalled();
        expect(anterior).toEqual(snapshotAnterior);
        expect(cacheAnterior).toEqual(snapshotCache);

        responder(crearSobre());
        const reintento = await servicio.evaluarOfertasPendientes([anterior]);

        expect(reintento).toMatchObject({
            errores: 0, aprobadas: 1, rechazadas: 0,
            evaluadas: 1, pendientes: 0, estado: 'completado', mensaje_error: null,
        });
        expect(reintento.detalle).toEqual([{
            id: anterior.id, titulo: anterior.titulo,
            estado: 'aprobada', razon: 'Compatible', error: false,
        }]);
        expect(fetchSimulado).toHaveBeenCalledTimes(2);
        expect(cache.buscarCache).not.toHaveBeenCalled();
        expect(ofertas.registrarErrorEvaluacion).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledTimes(1);
        expect(ofertas.actualizarEvaluacion).toHaveBeenCalledWith(
            anterior.id, 'aprobada', 'Compatible', 81, null,
            expect.objectContaining({ detectada: false, puntaje: 0 }),
            expect.any(String), null, anterior.descripcion
        );
        expect(cache.guardarCache).toHaveBeenCalledTimes(1);
        expect(cache.guardarCache).toHaveBeenCalledWith(
            expect.any(String), ofertas.actualizarEvaluacion.mock.calls[0][6],
            'deepseek-flash', expect.objectContaining({ match: true, porcentaje: 81, razon: 'Compatible' })
        );
        expect(lotes.finalizarLote).toHaveBeenLastCalledWith(26, 'completado');
    });
});
