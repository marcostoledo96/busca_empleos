const pool = require('../config/base-datos');
const { PLATAFORMAS } = require('../config/plataformas');
const ESTADOS = new Set(['completada', 'sin_resultados', 'parcial', 'error', 'timeout', 'sin_credenciales', 'deshabilitada', 'omitida', 'cancelada']);
const TIPOS_ERROR = new Set(['http', 'limite_solicitudes', 'red', 'respuesta_invalida', 'timeout', 'cancelacion', 'actor', 'cancelacion_no_confirmada', 'persistencia', 'proveedor']);
const CONTADORES = ['nuevas', 'actualizadas', 'reapariciones', 'duplicadas', 'erroresGuardado', 'totalExtraidas',
    'idiomaDescartadas', 'consultasEjecutadas', 'consultasOmitidas', 'peticionesRealizadas', 'totalCrudos', 'totalElegibles',
    'duplicadasDescartadas', 'antiguasDescartadas', 'sinFechaConocida', 'duracionMs', 'duracionScrapingMs'];
const MOTIVOS = new Set(['agotado', 'timeout', 'limite_peticiones', 'limite_paginas', 'sin_credenciales', 'error_proveedor',
    'http', 'limite_solicitudes', 'red', 'respuesta_invalida', 'cancelacion', 'actor', 'cancelacion_no_confirmada', 'limite_resultados', 'interrupcion', 'paginas_agotadas', 'pagina_vacia', 'limite_items', 'error_http', 'evidencia_invalida', 'fuente_deshabilitada', 'politica_destino']);
function limpiarErrores(errores = []) {
    return errores.slice(0, 40).map(error => ({ tipo: TIPOS_ERROR.has(error.tipo) ? error.tipo : 'proveedor',
        ...(Number.isInteger(error.codigoHttp) && error.codigoHttp >= 100 && error.codigoHttp <= 599 ? { codigoHttp: error.codigoHttp } : {}) }));
}
function limpiarFuente(fuente) {
    const plataforma = PLATAFORMAS[fuente.plataforma];
    if (!plataforma) return null;
    const salida = { plataforma: plataforma.id, estado: ESTADOS.has(fuente.estado) ? fuente.estado : 'error',
        estadoScraping: ESTADOS.has(fuente.estadoScraping) ? fuente.estadoScraping : undefined,
        motivoFinalizacion: fuente.estado === 'deshabilitada' ? plataforma.motivo : MOTIVOS.has(fuente.motivoFinalizacion) ? fuente.motivoFinalizacion : 'fin',
        errores: limpiarErrores(fuente.errores) };
    for (const clave of CONTADORES) {
        if (fuente[clave] === null || Number.isFinite(fuente[clave]) && fuente[clave] >= 0) salida[clave] = fuente[clave];
    }
    if (fuente.plataforma === 'getonbrd' && fuente.checkpoint && typeof fuente.checkpoint === 'object') {
        salida.checkpoint = {};
        for (const clave of ['termino_indice', 'pagina_confirmada', 'pagina_siguiente', 'item_offset']) {
            const valor = fuente.checkpoint[clave];
            if (Number.isSafeInteger(valor) && valor >= 0) salida.checkpoint[clave] = valor;
        }
        salida.checkpoint.termino = typeof fuente.checkpoint.termino === 'string' ? fuente.checkpoint.termino.slice(0, 200) : null;
    }
    // Conservo la consulta efectiva, nunca errores textuales ni snapshots de configuración.
    salida.resultadosConsultas = (fuente.resultadosConsultas || []).slice(0, 100).map(consulta => ({
        consulta: typeof consulta.consulta === 'string' ? consulta.consulta.slice(0, 200) : null,
        estado: consulta.estado === null || ESTADOS.has(consulta.estado) ? consulta.estado : 'error',
        peticionesRealizadas: Number.isFinite(consulta.peticionesRealizadas) ? consulta.peticionesRealizadas : null,
        totalCrudos: Number.isFinite(consulta.totalCrudos) ? consulta.totalCrudos : null,
        totalElegibles: Number.isFinite(consulta.totalElegibles) && consulta.totalElegibles >= 0 ? consulta.totalElegibles : null,
        errores: limpiarErrores(consulta.errores),
    }));
    return salida;
}
function sanitizarResumen(resultado) {
    return { estado: ESTADOS.has(resultado.estado) ? resultado.estado : 'error',
        estadoScraping: ESTADOS.has(resultado.estadoScraping) ? resultado.estadoScraping : undefined,
        estadoEvaluacion: ESTADOS.has(resultado.estadoEvaluacion) ? resultado.estadoEvaluacion : undefined,
        motivoFinalizacion: resultado.estadoEvaluacion === 'error' ? 'evaluacion' : ESTADOS.has(resultado.estado) ? resultado.estado : 'error',
        fuentes: (resultado.fuentes || []).map(limpiarFuente).filter(Boolean),
        evaluacionGlobal: true };
}
async function iniciar(tipo) {
    const { rows } = await pool.query('INSERT INTO ejecuciones_busqueda (tipo) VALUES ($1) RETURNING id, inicio', [tipo]);
    return rows[0];
}
async function finalizar(id, resultado) {
    const resumen = sanitizarResumen(resultado);
    const { rowCount } = await pool.query(`UPDATE ejecuciones_busqueda SET fin = clock_timestamp(), estado = $2, resumen = $3
        WHERE id = $1 AND estado = 'ejecutando'`, [id, resumen.estado, JSON.stringify(resumen)]);
    if (rowCount !== 1) throw new Error('No pude finalizar una ejecución que ya no está activa.');
    await acotarHistorial();
}
async function acotarHistorial() {
    await pool.query(`DELETE FROM ejecuciones_busqueda WHERE estado <> 'ejecutando' AND id NOT IN
        (SELECT id FROM ejecuciones_busqueda WHERE estado <> 'ejecutando' ORDER BY id DESC LIMIT 20)`);
}
async function listar() {
    const { rows } = await pool.query(`SELECT id, tipo, inicio, fin, estado, resumen,
        EXTRACT(EPOCH FROM (COALESCE(fin, clock_timestamp()) - inicio)) * 1000 AS duracion_ms
        FROM ejecuciones_busqueda ORDER BY id DESC LIMIT 20`);
    return rows;
}
async function interrumpirPendientes() {
    await pool.query(`UPDATE ejecuciones_busqueda SET estado = 'interrumpida', fin = clock_timestamp(),
        resumen = '{"estado":"interrumpida","motivoFinalizacion":"reinicio","fuentes":[]}'::jsonb WHERE estado = 'ejecutando'`);
    await acotarHistorial();
}
module.exports = { iniciar, finalizar, listar, interrumpirPendientes, sanitizarResumen };
