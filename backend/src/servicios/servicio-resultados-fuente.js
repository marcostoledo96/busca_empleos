// Comparto scraping e ingreso; no atribuyo la evaluación global a una fuente.
const { PLATAFORMAS } = require('../config/plataformas');
const modeloOferta = require('../modelos/oferta');
const historial = require('../modelos/ejecucion-busqueda');
const { filtrarOfertasPorIdioma, guardarLoteOfertasAislado } = require('./servicio-ingreso-ofertas');

function estadoGeneral(fuentes) {
    const activas = fuentes.filter(f => !['deshabilitada', 'omitida'].includes(f.estado));
    const correctas = activas.filter(f => ['completada', 'sin_resultados'].includes(f.estado));
    if (activas.some(f => f.estado === 'parcial')) return 'parcial';
    if (correctas.length < activas.length) return correctas.length ? 'parcial' : 'error';
    return correctas.some(f => f.estado === 'completada') ? 'completada' : 'sin_resultados';
}

async function ejecutarFuente(plataforma, scraper, opciones = {}) {
    const inicio = Date.now();
    const registro = PLATAFORMAS[plataforma];
    const base = { plataforma, nombre: registro?.label || plataforma, nuevas: 0, actualizadas: 0,
        reapariciones: 0, duplicadas: 0, erroresGuardado: 0, totalExtraidas: 0, idiomaDescartadas: 0,
        consultasEjecutadas: 0, peticionesRealizadas: 0, totalCrudos: 0, totalElegibles: 0,
        resultadosConsultas: [], errores: [], duracionMs: 0 };
    if (!registro?.activa) return { ...base, estado: 'deshabilitada', motivoFinalizacion: registro?.motivo || 'Fuente deshabilitada.' };
    let datos;
    try {
        datos = await scraper(opciones);
        if (!Array.isArray(datos) && !datos?.deshabilitado) throw new Error('Respuesta inválida.');
    } catch (error) {
        const timeout = ['ETIMEDOUT', 'ECONNABORTED'].includes(error.code) || error.name === 'AbortError';
        return { ...base, estado: timeout ? 'timeout' : 'error', estadoScraping: timeout ? 'timeout' : 'error',
            peticionesRealizadas: null, duracionMs: Date.now() - inicio, motivoFinalizacion: timeout ? 'timeout' : 'error_proveedor',
            errores: [{ tipo: timeout ? 'timeout' : 'proveedor', mensaje: 'No pude completar la fuente.' }] };
    }
    const ofertas = Array.isArray(datos) ? datos : [];
    const metricas = datos.metricas || Object.fromEntries(['maxResultados', 'ventanaDias', 'consultasEjecutadas',
        'consultasOmitidas', 'consultasOmitidasPorPresupuesto', 'totalCrudos', 'totalElegibles', 'duplicadasDescartadas',
        'antiguasDescartadas', 'sinFechaConocida', 'motivoFinalizacion'].filter(clave => datos[clave] !== undefined).map(clave => [clave, datos[clave]]));
    const estadoProveedor = metricas.estado || (datos.deshabilitado ? 'sin_credenciales' : ofertas.length ? 'completada' : 'sin_resultados');
    const filtradas = filtrarOfertasPorIdioma(ofertas);
    const estadoScraping = ['completada', 'sin_resultados'].includes(estadoProveedor)
        ? (filtradas.length ? 'completada' : 'sin_resultados') : estadoProveedor;
    // Si ingreso descarta ofertas, no conservo una atribución por consulta que ya no puedo verificar.
    const resultadosConsultas = (metricas.resultadosConsultas || []).map(consulta => filtradas.length === ofertas.length
        ? consulta : { ...consulta, totalElegibles: null,
            estado: ['completada', 'sin_resultados'].includes(consulta.estado) ? null : consulta.estado });
    const persistencia = await guardarLoteOfertasAislado(filtradas, modeloOferta);
    const fallas = persistencia.errores;
    return { ...base, ...metricas, plataforma, nombre: base.nombre, estadoScraping,
        estado: fallas ? (filtradas.length > fallas ? 'parcial' : 'error') : estadoScraping,
        resultadosConsultas,
        ...(datos.deshabilitado ? { codigo_resultado: datos.codigo_resultado, advertencia: datos.advertencia } : {}),
        nuevas: persistencia.guardadas, actualizadas: persistencia.actualizadas,
        reapariciones: persistencia.reapariciones, duplicadas: persistencia.duplicadas,
        erroresGuardado: fallas, totalExtraidas: ofertas.length,
        idiomaDescartadas: (metricas.idiomaDescartadas || 0) + ofertas.length - filtradas.length,
        consultasEjecutadas: metricas.consultasEjecutadas ?? null,
        peticionesRealizadas: metricas.peticionesRealizadas ?? null,
        totalCrudos: metricas.totalCrudos ?? ofertas.length, totalElegibles: filtradas.length,
        motivoFinalizacion: metricas.motivoFinalizacion || estadoScraping,
        duracionScrapingMs: metricas.duracionMs ?? Date.now() - inicio,
        duracionMs: Date.now() - inicio,
        errores: [...(metricas.errores || []), ...(fallas ? [{ tipo: 'persistencia', mensaje: 'No pude guardar todas las ofertas.' }] : [])],
    };
}

async function conHistorial(tipo, ejecutar) {
    let fila;
    try { fila = await historial.iniciar(tipo); }
    catch { throw Object.assign(new Error('No pude iniciar el historial de la ejecución.'), { statusCode: 503 }); }
    let resultado;
    try { resultado = await ejecutar(); }
    catch (error) {
        try { await historial.finalizar(fila.id, { estado: 'error', fuentes: [], motivoFinalizacion: 'interrupcion' }); }
        catch { console.error('[Historial] No pude finalizar la ejecución fallida.'); }
        throw error;
    }
    try {
        await historial.finalizar(fila.id, resultado);
        resultado.historial = { id: fila.id, guardado: true };
    } catch {
        resultado.historial = { id: fila.id, guardado: false, error: 'No pude finalizar el historial; el resultado de scraping se conserva.' };
    }
    return resultado;
}

module.exports = { ejecutarFuente, estadoGeneral, conHistorial };
