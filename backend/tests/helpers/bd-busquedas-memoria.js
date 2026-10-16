// Simulo solamente las consultas de este recorrido; rechazo SQL no contemplado.
function crearAdaptadorBusqueda({ vertical = false } = {}) {
    let preferencias = { id: 1, terminos_busqueda: ['anterior'], zonas_preferidas: [] };
    const ofertas = [];
    const lotes = [];
    const ejecuciones = [];
    let siguienteEjecucion = 1;
    let configuracionCron = null;
    const cache = new Map();
    const consultasNoContempladas = [];
    const adaptador = {
        ofertas,
        lotes,
        consultasNoContempladas,
        connect: async () => ({ query: adaptador.query, release: jest.fn() }),
        obtenerPreferencias: () => preferencias,
        reiniciar: () => {
            preferencias = { id: 1, terminos_busqueda: ['anterior'], zonas_preferidas: [] };
            ofertas.length = 0;
            lotes.length = 0;
            ejecuciones.length = 0;
            siguienteEjecucion = 1;
            configuracionCron = null;
            cache.clear();
            consultasNoContempladas.length = 0;
            adaptador.query.mockClear();
        },
        query: jest.fn(async (sql, valores = []) => {
            if (/INSERT INTO ejecuciones_busqueda/.test(sql)) {
                const fila = { id: siguienteEjecucion++, tipo: valores[0], inicio: new Date(), fin: null, estado: 'ejecutando', resumen: {} };
                ejecuciones.push(fila);
                return { rows: [{ ...fila }], rowCount: 1 };
            }
            if (/UPDATE ejecuciones_busqueda/.test(sql)) {
                if (/estado = 'interrumpida'/.test(sql)) {
                    for (const fila of ejecuciones.filter(fila => fila.estado === 'ejecutando')) {
                        Object.assign(fila, { estado: 'interrumpida', fin: new Date(), resumen: { estado: 'interrumpida', motivoFinalizacion: 'reinicio', fuentes: [] } });
                    }
                    return { rows: [] };
                }
                const fila = ejecuciones.find(fila => fila.id === valores[0] && fila.estado === 'ejecutando');
                if (!fila) return { rows: [], rowCount: 0 };
                Object.assign(fila, { fin: new Date(), estado: valores[1], resumen: JSON.parse(valores[2]) });
                return { rows: [], rowCount: 1 };
            }
            if (/DELETE FROM ejecuciones_busqueda/.test(sql)) {
                const retenidas = new Set(ejecuciones.filter(fila => fila.estado !== 'ejecutando').slice(-20));
                const vigentes = ejecuciones.filter(fila => fila.estado === 'ejecutando' || retenidas.has(fila));
                ejecuciones.splice(0, ejecuciones.length, ...vigentes);
                return { rows: [] };
            }
            if (/FROM ejecuciones_busqueda ORDER BY id DESC LIMIT 20/.test(sql)) {
                return { rows: ejecuciones.slice(-20).reverse().map(fila => ({ ...structuredClone(fila), duracion_ms: (fila.fin || new Date()) - fila.inicio })) };
            }
            if (/SELECT activo, expresion_cron, zona_horaria FROM configuracion_cron/.test(sql)) {
                return { rows: configuracionCron ? [{ ...configuracionCron }] : [] };
            }
            if (/INSERT INTO configuracion_cron/.test(sql)) {
                configuracionCron = { activo: valores[0], expresion_cron: valores[1], zona_horaria: valores[2] };
                return { rows: [], rowCount: 1 };
            }
            if (vertical) {
                if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
                if (/pg_try_advisory_lock/.test(sql)) return { rows: [{ ok: true }] };
                if (/pg_advisory_unlock/.test(sql)) return { rows: [{ pg_advisory_unlock: true }] };
                if (/SELECT COALESCE\(MAX\(id\)/.test(sql)) return { rows: [{ max_id: Math.max(0, ...ofertas.map(o => o.id)) }] };
                if (/string_agg/.test(sql)) return { rows: [{ total: ofertas.length, firma: JSON.stringify(ofertas) }] };
                if (/SELECT id, titulo/.test(sql)) return { rows: ofertas.filter(o => o.id <= valores[1] && o.id < valores[2]).sort((a, b) => b.id - a.id).slice(0, valores[3]).map(o => ({ ...o })) };
                if (/SELECT \* FROM ofertas WHERE estado_evaluacion = 'pendiente'/.test(sql)) return { rows: ofertas.filter(o => o.estado_evaluacion === 'pendiente').map(o => ({ ...o })) };
                if (/UPDATE ofertas\s+SET estado_evaluacion/.test(sql)) {
                    const oferta = ofertas.find(o => o.id === valores[3]);
                    if (!oferta) return { rows: [] };
                    Object.assign(oferta, { estado_evaluacion: valores[0], razon_evaluacion: valores[1], porcentaje_match: valores[2], evaluacion_error_mensaje: valores[4], prioridad_ia: valores[5], puntaje_prioridad_ia: valores[6], evidencias_prioridad_ia: JSON.parse(valores[7]), firma_criterios_evaluacion: valores[9], fecha_evaluacion: new Date().toISOString() });
                    return { rows: [{ ...oferta }] };
                }
                if (/SELECT resultado FROM evaluaciones_cache/.test(sql)) return { rows: cache.has(valores.join('|')) ? [{ resultado: cache.get(valores.join('|')) }] : [] };
                if (/INSERT INTO evaluaciones_cache/.test(sql)) { cache.set(valores.slice(0, 3).join('|'), JSON.parse(valores[3])); return { rows: [] }; }
                if (/INSERT INTO evaluacion_lotes/.test(sql)) {
                    const lote = { id: lotes.length + 1, estado: 'activo', total: valores[0], modelo_ia: valores[1] };
                    lotes.push(lote);
                    return { rows: [lote] };
                }
                if (/UPDATE evaluacion_lotes/.test(sql)) {
                    const terminal = /SET estado/.test(sql);
                    const lote = lotes.find(l => l.id === valores[terminal ? 1 : 5]);
                    if (terminal) lote.estado = valores[0];
                    else Object.assign(lote, Object.fromEntries(['evaluadas', 'aprobadas', 'rechazadas', 'errores', 'porcentaje'].map((campo, i) => [campo, valores[i]])));
                    return { rows: [] };
                }
                if (/SELECT \* FROM evaluacion_lotes/.test(sql)) return { rows: lotes.slice(-1) };
            }
            if (/SELECT \* FROM preferencias/.test(sql)) return { rows: [{ ...preferencias }] };
            if (/UPDATE preferencias SET backup_preferencias/.test(sql)) return { rows: [] };
            if (/UPDATE preferencias\s+SET/.test(sql)) {
                for (const coincidencia of sql.matchAll(/(terminos_busqueda|zonas_preferidas|filtrar_nivel_linkedin) = \$(\d+)/g)) {
                    preferencias[coincidencia[1]] = valores[Number(coincidencia[2]) - 1];
                }
                return { rows: [{ ...preferencias }] };
            }
            if (/INSERT INTO ofertas/.test(sql)) {
                if (ofertas.some(oferta => oferta.url === valores[5])) return { rows: [] };
                const campos = ['titulo', 'empresa', 'ubicacion', 'modalidad', 'descripcion', 'url', 'plataforma', 'nivel_requerido', 'salario_min', 'salario_max', 'moneda', 'fecha_publicacion', 'datos_crudos'];
                const oferta = Object.fromEntries(campos.map((campo, indice) => [campo, valores[indice]]));
                Object.assign(oferta, { id: ofertas.length + 1, fecha_extraccion: new Date().toISOString(), estado_evaluacion: 'pendiente', estado_postulacion: 'no_postulado' });
                ofertas.push(oferta);
                return { rows: [oferta] };
            }
            if (/SELECT COUNT\(\*\)::integer AS total FROM ofertas/.test(sql)) return { rows: [{ total: ofertas.length }] };
            if (/SELECT \* FROM ofertas/.test(sql)) return { rows: [...ofertas] };
            consultasNoContempladas.push(sql);
            throw new Error(`Consulta no contemplada en el adaptador: ${sql}`);
        }),
    };
    return adaptador;
}
module.exports = { crearAdaptadorBusqueda };
