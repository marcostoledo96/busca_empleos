// Mantengo los límites y la telemetría separados de las reglas de cada proveedor.
const TIEMPO_FUENTE_MS = 180000;
const TIEMPO_PETICION_MS = 15000;

function crearEjecucionFuente(plataforma, opciones = {}) {
    const inicio = Date.now();
    const acotar = (valor, maximo) => Number.isFinite(valor) && valor > 0 ? Math.min(valor, maximo) : maximo;
    const limite = inicio + acotar(opciones.timeoutMs, TIEMPO_FUENTE_MS);
    const errores = [];
    const consultas = new Map();
    const consultaPorUrl = new Map();
    const consultasAtribuibles = new Set();
    let peticiones = 0;
    let snapshot = () => ({ ofertas: [], metricas: {} });
    let estadoForzado;
    let motivoForzado;
    let esApify = false;
    let idiomaDescartadas = null;
    const restante = () => Math.max(0, limite - Date.now());
    const registrarError = (tipo, consulta, codigoHttp) => {
        const mensajes = {
            http: 'El proveedor rechazó la petición.', limite_solicitudes: 'Alcancé el límite de solicitudes del proveedor.',
            red: 'No pude comunicarme con el proveedor.', respuesta_invalida: 'Recibí una respuesta inválida del proveedor.',
            timeout: 'Alcancé el tiempo máximo permitido.', cancelacion: 'Detuve la ejecución por cancelación.',
            actor: 'El Actor no finalizó correctamente.', cancelacion_no_confirmada: 'No pude confirmar la cancelación remota del Actor.',
        };
        const error = { tipo, mensaje: mensajes[tipo] || 'No pude completar la fuente.', ...(consulta !== undefined ? { consulta } : {}), ...(codigoHttp ? { codigoHttp } : {}) };
        errores.push(error);
        if (consulta !== undefined && consultas.has(consulta)) consultas.get(consulta).errores.push(error);
        else if (esApify) for (const detalle of consultas.values()) detalle.errores.push(error);
        return error;
    };
    const comprobar = () => {
        if (opciones.signal?.aborted || !restante()) {
            const tipo = opciones.signal?.aborted ? 'cancelacion' : 'timeout';
            if (!errores.some(e => e.tipo === tipo)) registrarError(tipo);
            throw Object.assign(new Error('Detuve la fuente.'), { controlado: true });
        }
    };
    const consultaEjecutada = consulta => {
        if (!consultas.has(consulta)) consultas.set(consulta, { consulta, peticionesRealizadas: 0, totalCrudos: 0, errores: [] });
        return consultas.get(consulta);
    };
    const esperar = async ms => {
        comprobar();
        await new Promise(resolve => {
            const finalizar = () => { clearTimeout(timer); opciones.signal?.removeEventListener('abort', finalizar); resolve(); };
            const timer = setTimeout(finalizar, Math.min(ms, restante()));
            opciones.signal?.addEventListener('abort', finalizar, { once: true });
        });
        comprobar();
    };
    const solicitar = async (url, opcionesFetch = {}, consulta, formato = 'json', campo) => {
        comprobar();
        const detalle = consultaEjecutada(consulta);
        detalle.peticionesRealizadas++;
        peticiones++;
        const abortador = new AbortController();
        const cancelar = () => abortador.abort();
        opciones.signal?.addEventListener('abort', cancelar, { once: true });
        const timer = setTimeout(cancelar, Math.min(acotar(opciones.timeoutPeticionMs, TIEMPO_PETICION_MS), restante()));
        let quitarAbort;
        let etapa = 'red';
        try {
            // La carrera sólo descarta la lectura; aborto también el fetch real y nunca persisto desde esta tarea.
            const abortada = new Promise((_, reject) => {
                const rechazar = () => reject(Object.assign(new Error('Petición abortada.'), { abortada: true }));
                quitarAbort = () => abortador.signal.removeEventListener('abort', rechazar);
                abortador.signal.addEventListener('abort', rechazar, { once: true });
                if (abortador.signal.aborted) rechazar();
            });
            const operacion = (async () => {
                const respuesta = await fetch(url, { ...opcionesFetch, signal: abortador.signal });
                if (abortador.signal.aborted) throw new Error('Petición abortada.');
                if (!respuesta?.ok) {
                    registrarError(respuesta?.status === 429 ? 'limite_solicitudes' : 'http', consulta, respuesta?.status);
                    // No leo ni guardo cuerpos de error que puedan contener credenciales.
                    await respuesta?.body?.cancel?.();
                    return { ok: false, status: respuesta?.status || 0 };
                }
                etapa = 'respuesta_invalida';
                const cuerpo = await respuesta[formato]();
                if (abortador.signal.aborted) throw new Error('Lectura abortada.');
                if (formato === 'json' && !(campo ? Array.isArray(cuerpo?.[campo]) : Array.isArray(cuerpo))) throw new Error('Estructura inválida.');
                if (formato === 'text' && typeof cuerpo !== 'string') throw new Error('HTML inválido.');
                if (formato === 'json') detalle.totalCrudos += campo ? cuerpo[campo].length : Math.max(0, cuerpo.length - 1);
                return { ok: true, json: async () => cuerpo, text: async () => cuerpo };
            })();
            return await Promise.race([operacion, abortada]);
        } catch (error) {
            registrarError(abortador.signal.aborted ? (opciones.signal?.aborted ? 'cancelacion' : 'timeout') : etapa, consulta);
            return { ok: false, status: 0 };
        } finally {
            clearTimeout(timer);
            quitarAbort?.();
            opciones.signal?.removeEventListener('abort', cancelar);
        }
    };
    const finalizar = (resultado, error) => {
        const parcial = resultado ? { metricas: {} } : snapshot();
        resultado = resultado || parcial.ofertas.slice();
        if (error && !error.controlado) registrarError('respuesta_invalida');
        const metricas = { ...parcial.metricas, ...resultado.metricas };
        const consultasPrevistas = Number.isFinite(metricas.consultasEjecutadas)
            ? metricas.consultasEjecutadas + (metricas.consultasOmitidas || 0) : null;
        const timeout = errores.some(e => e.tipo === 'timeout');
        const limitado = ['limite_peticiones', 'limite_paginas'].includes(metricas.motivoFinalizacion);
        let estado = resultado.length ? 'completada' : 'sin_resultados';
        if (errores.length || limitado) estado = 'error';
        if (timeout) estado = 'timeout';
        if (resultado.length && (errores.length || limitado)) estado = 'parcial';
        if (estadoForzado) estado = estadoForzado;
        Object.assign(metricas, {
            plataforma, estado, totalElegibles: resultado.length,
            consultasEjecutadas: consultas.size,
            ...(consultasPrevistas !== null ? { consultasOmitidas: Math.max(0, consultasPrevistas - consultas.size) } : {}),
            peticionesRealizadas: esApify ? null : peticiones,
            totalCrudos: metricas.totalCrudos || 0,
            idiomaDescartadas,
            errores: errores.slice(), duracionMs: Date.now() - inicio,
            motivoFinalizacion: motivoForzado || (timeout ? 'timeout' : limitado ? metricas.motivoFinalizacion : errores.length ? errores[0].tipo : metricas.motivoFinalizacion || 'agotado'),
            resultadosConsultas: [...consultas.values()].map(c => {
                const totalElegibles = consultasAtribuibles.has(c.consulta)
                    ? resultado.filter(oferta => consultaPorUrl.get(oferta.url) === c.consulta).length : null;
                return {
                    ...c, totalElegibles,
                    estado: c.errores.length
                        ? (totalElegibles > 0 ? 'parcial' : c.errores.some(e => e.tipo === 'timeout') ? 'timeout' : 'error')
                        : totalElegibles === null ? (c.totalCrudos === 0 ? 'sin_resultados' : null)
                            : totalElegibles === 0 ? 'sin_resultados' : 'completada',
                };
            }),
        });
        for (const [clave, valor] of Object.entries({ ...metricas, metricas })) Object.defineProperty(resultado, clave, { value: valor, enumerable: false, configurable: true, writable: true });
        return resultado;
    };
    const ejecutarActor = async (cliente, actor, input, consultasReales) => {
        esApify = true;
        comprobar();
        // Reservo margen para arranque, lectura del dataset y eventual abort (15 s por HTTP del SDK).
        if (restante() < 45000) { registrarError('timeout'); throw Object.assign(new Error('Sin margen para iniciar Actor.'), { controlado: true }); }
        for (const consulta of consultasReales) {
            const detalle = consultaEjecutada(consulta);
            detalle.peticionesRealizadas = null;
            detalle.totalCrudos = null;
        }
        let run;
        try {
            run = await cliente.actor(actor).call(input, { timeout: Math.min(120, Math.floor((restante() - 45000) / 1000)), waitSecs: 1 });
            const terminales = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];
            while (run?.status && !terminales.includes(run.status) && restante() > 45000 && !opciones.signal?.aborted) {
                await esperar(1000);
                if (restante() <= 45000) break;
                const actual = await cliente.run(run.id).get();
                if (!actual?.status) throw Object.assign(new Error('Run inválido.'), { tipo: 'respuesta_invalida' });
                run = actual;
            }
            if (!run?.status) throw Object.assign(new Error('Run inválido.'), { tipo: 'respuesta_invalida' });
            if (!terminales.includes(run.status)) {
                registrarError('timeout');
                if (run?.id) {
                    try {
                        const detenida = await cliente.run(run.id).abort();
                        if (!['ABORTED', 'SUCCEEDED', 'FAILED', 'TIMED-OUT'].includes(detenida?.status)) registrarError('cancelacion_no_confirmada');
                    } catch { registrarError('cancelacion_no_confirmada'); }
                } else registrarError('cancelacion_no_confirmada');
            } else if (run.status !== 'SUCCEEDED') registrarError(run.status === 'TIMED-OUT' ? 'timeout' : 'actor');
            comprobar();
            if (!run?.defaultDatasetId) return { items: [] };
            const datos = await cliente.dataset(run.defaultDatasetId).listItems();
            comprobar();
            if (!Array.isArray(datos?.items)) throw new Error('Dataset inválido.');
            return datos;
        } catch (error) {
            if (!error.controlado) {
                const codigoHttp = error.statusCode;
                registrarError(error.tipo || (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
                    ? 'timeout' : codigoHttp === 429 ? 'limite_solicitudes' : codigoHttp ? 'http' : 'red'), undefined, codigoHttp);
                error.controlado = true;
            }
            if (!run) registrarError('cancelacion_no_confirmada');
            else if (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
                try {
                    const detenida = await cliente.run(run.id).abort();
                    if (!['ABORTED', 'SUCCEEDED', 'FAILED', 'TIMED-OUT'].includes(detenida?.status)) registrarError('cancelacion_no_confirmada');
                } catch { registrarError('cancelacion_no_confirmada'); }
            }
            throw error;
        }
    };
    return {
        solicitar, esperar, finalizar, ejecutarActor, comprobar, registrarError,
        atribuirOfertas: (consulta, ofertas) => {
            consultasAtribuibles.add(consulta);
            for (const oferta of ofertas) {
                if (oferta.url && !consultaPorUrl.has(oferta.url)) consultaPorUrl.set(oferta.url, consulta);
            }
        },
        recibidas: (consulta, cantidad) => { consultaEjecutada(consulta).totalCrudos += cantidad; },
        contarIdioma: descartada => { idiomaDescartadas = (idiomaDescartadas || 0) + (descartada ? 1 : 0); },
        conservar: obtener => { snapshot = obtener; },
        sinCredenciales: () => { estadoForzado = 'sin_credenciales'; motivoForzado = 'sin_credenciales'; return finalizar([]); },
    };
}

module.exports = { crearEjecucionFuente };
