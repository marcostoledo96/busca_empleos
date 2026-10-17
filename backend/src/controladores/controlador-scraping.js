// Comparto el resultado por fuente con el ciclo, conservando los campos HTTP anteriores.
const servicioScraping = require('../servicios/servicio-scraping');
const resultados = require('../servicios/servicio-resultados-fuente');
const { PLATAFORMAS } = require('../config/plataformas');
const { resolverConfiguracion, resolverConfiguraciones, leerPreferenciasBusqueda, validarOpciones } = require('../servicios/servicio-configuracion-busqueda');

async function previsualizarBusquedas(req, res) {
    const configuraciones = await resolverConfiguraciones({}, { previsualizacion: true });
    res.json({ exito: true, datos: { plataformas: Object.values(configuraciones).map(configuracion => configuracion.resumen) } });
}
function respuestaCompatible(fuente, resumen) {
    const datos = {
        ...fuente, fuente, configuracion: resumen || null,
        mensaje: `Scraping de ${fuente.nombre} completado: ${fuente.nuevas} ofertas nuevas, ${fuente.actualizadas} actualizadas y ${fuente.reapariciones} reapariciones.`,
        ofertas_nuevas: fuente.nuevas, ofertas_actualizadas: fuente.actualizadas,
        ofertas_reapariciones: fuente.reapariciones, ofertas_duplicadas: fuente.duplicadas,
        ofertas_errores: fuente.erroresGuardado, total_extraidas: fuente.totalExtraidas,
        descartadas_por_idioma: fuente.idiomaDescartadas,
    };
    const valores = { maxResultados: fuente.maxResultados !== undefined ? fuente.maxResultados : resumen?.maxResultados !== undefined ? resumen.maxResultados : 50,
        ventanaDias: fuente.ventanaDias ?? 30, consultasEjecutadas: fuente.consultasEjecutadas,
        consultasOmitidas: fuente.consultasOmitidas ?? 0,
        consultasOmitidasPorPresupuesto: fuente.consultasOmitidasPorPresupuesto ?? [],
        totalCrudos: fuente.totalCrudos, totalElegibles: fuente.totalElegibles,
        duplicadasDescartadas: fuente.duplicadasDescartadas ?? 0, antiguasDescartadas: fuente.antiguasDescartadas ?? 0,
        sinFechaConocida: fuente.sinFechaConocida ?? 0, motivoFinalizacion: fuente.motivoFinalizacion };
    for (const [clave, valor] of Object.entries(valores)) {
        datos[clave] = valor;
        datos[clave.replace(/[A-Z]/g, letra => `_${letra.toLowerCase()}`)] = valor;
    }
    if (!['completada', 'sin_resultados'].includes(fuente.estado)) datos.mensaje = `${fuente.nombre}: ${fuente.estado}. Conservo los resultados disponibles.`;
    if (fuente.estado === 'deshabilitada') {
        datos.mensaje = `${fuente.nombre} está desactivado. ${fuente.motivoFinalizacion}`;
        datos.codigo_resultado = 'PLATAFORMA_INACTIVA';
        datos.advertencia = fuente.motivoFinalizacion;
    }
    // Conservo los alias del piloto solamente cuando no se ejecutó la fuente.
    if (fuente.plataforma === 'getonbrd' && fuente.estado === 'deshabilitada') Object.assign(datos, {
        run_id: null, estado: 'bloqueado', motivo_terminacion: 'politica_destino', destino: 'bloqueado', ofertas: [],
        checkpoint: { termino_indice: 0, termino: null, pagina_confirmada: 0, pagina_siguiente: 1 },
        metricas: { requests: 0, paginas: 0, recibidas: 0, normalizadas: 0, dentro_ventana: 0,
            fuera_ventana: 0, duplicadas_intra_run: 0, invalidas: 0, latencia_ms: 0 },
    });
    return datos;
}
function crearControlador(plataforma, funcion) {
    return async (req, res) => {
        let configuracion;
        if (PLATAFORMAS[plataforma].activa) {
            const body = req.body === undefined ? {} : req.body;
            validarOpciones(body);
            configuracion = resolverConfiguracion(plataforma, body, await leerPreferenciasBusqueda());
        }
        const resultado = await resultados.conHistorial('individual', async () => {
            const fuente = await resultados.ejecutarFuente(plataforma, servicioScraping[funcion], configuracion?.opciones);
            return { estado: fuente.estado, fuentes: [fuente] };
        });
        const fuente = resultado.fuentes[0];
        const fallo = ['error', 'timeout'].includes(fuente.estado);
        const status = fuente.erroresGuardado && fuente.estado === 'error' ? 500 : fuente.estado === 'timeout' ? 504 : fallo ? 502 : 200;
        return res.status(status).json({
            exito: !fallo,
            ...(fallo ? { error: fuente.erroresGuardado ? 'No se pudo persistir ninguna oferta por fallos en la base de datos.' : 'No pude completar la consulta al proveedor.' } : {}),
            datos: { ...respuestaCompatible(fuente, configuracion?.resumen), historial: resultado.historial },
        });
    };
}
module.exports = {
    previsualizarBusquedas,
    scrapearLinkedin: crearControlador('linkedin', 'ejecutarScrapingLinkedin'),
    scrapearComputrabajo: crearControlador('computrabajo', 'ejecutarScrapingComputrabajo'),
    scrapearIndeed: crearControlador('indeed', 'ejecutarScrapingIndeed'),
    scrapearBumeran: crearControlador('bumeran', 'ejecutarScrapingBumeran'),
    scrapearGlassdoor: crearControlador('glassdoor', 'ejecutarScrapingGlassdoor'),
    scrapearGetonbrd: crearControlador('getonbrd', 'ejecutarScrapingGetonbrd'),
    scrapearJooble: crearControlador('jooble', 'ejecutarScrapingJooble'),
    scrapearGoogleJobs: crearControlador('google_jobs', 'ejecutarScrapingGoogleJobs'),
    scrapearRemotive: crearControlador('remotive', 'ejecutarScrapingRemotive'),
    scrapearRemoteOK: crearControlador('remoteok', 'ejecutarScrapingRemoteOK'),
    scrapearInfojobs: crearControlador('infojobs', 'ejecutarScrapingInfojobs'),
    scrapearAdzuna: crearControlador('adzuna', 'ejecutarScrapingAdzuna'),
};
