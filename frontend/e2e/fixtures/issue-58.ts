import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ResumenBusqueda, ResultadoBusqueda, ResultadoFuente } from '../../src/app/modelos/respuesta-api.model';

export const mensajeExtenso = 'DiagnosticoSinteticoSinEspacios'.repeat(18);
const ubicacionFija = 'No aplico ubicación ni zonas preferidas: esta integración conserva su ubicación fija.';
const avisos: Record<string, string[]> = {
    linkedin: ['Filtro de nivel de experiencia de LinkedIn desactivado (no aplico f_E).'],
    computrabajo: [ubicacionFija], indeed: [ubicacionFija], glassdoor: [ubicacionFija], adzuna: [ubicacionFija],
    bumeran: [ubicacionFija, 'No aplico maxResultados: el actor existente no recibe ese límite.'],
    jooble: ['Aplico un límite estricto sobre maxResultados: garantizo no superar 40 ofertas.'],
    getonbrd: ['GetOnBrd requiere habilitación explícita mediante GETONBRD_ENABLED=true.'],
    remotive: ['Remotive no dispone de categoría para: administrativo de salud.'],
    remoteok: ['RemoteOK no dispone de etiquetas compatibles para: administrativo de salud.'],
    google_jobs: ['Desactivado por costo y baja utilidad'],
    infojobs: ['Portal developers suspendido'],
};

// Reproduzco mensajes vigentes del contrato; nunca consulto proveedores ni una base real.
export function crearHttpIssue58(escenario: string) {
    let lecturasHistorial = 0;
    let lecturasSync = 0;
    let iniciado = false;
    const configuracion: ResumenBusqueda[] = Object.entries(avisos).map(([plataforma, advertencias]) => ({
        plataforma, nombre: plataforma === 'getonbrd' ? 'GetOnBrd' : plataforma,
        habilitada: !['getonbrd', 'google_jobs', 'infojobs'].includes(plataforma),
        ejecutable: !['getonbrd', 'google_jobs', 'infojobs', 'remotive', 'remoteok'].includes(plataforma),
        terminos: ['administrativo de salud'], ubicacion: ['Argentina'], ventanaDias: 30,
        maxResultados: plataforma === 'bumeran' ? null : 40, filtros: {},
        advertencias: escenario === 'extenso' ? [...advertencias, mensajeExtenso] : advertencias,
        origen: { terminos: 'preferencias', ubicacion: 'fijo' },
    }));
    const estado = escenario === 'fallido' ? 'error' : escenario === 'cancelado' ? 'cancelada'
        : ['parcial', 'multiples'].includes(escenario) ? 'parcial' : 'completada';
    const fuente: ResultadoFuente = { plataforma: 'linkedin', nombre: 'LinkedIn', estado,
        run_id: 'ciclo-58', nuevas: 3, totalElegibles: 5,
        errores: ['parcial', 'multiples', 'fallido'].includes(escenario)
            ? [{ tipo: 'proveedor', codigoHttp: 429, mensaje: 'Cuota sintética agotada' }] : [],
        resultadosConsultas: escenario === 'multiples' ? ['Angular', 'React'].map(consulta => ({
            consulta, estado: 'error', peticionesRealizadas: 1, totalCrudos: 0,
            errores: [{ tipo: 'proveedor', codigoHttp: 503, mensaje: 'Consulta sintética no disponible', consulta }],
        })) : [],
    };
    if (escenario === 'multiples') {
        // Reproduzco la doble representación del mismo evento en ejecucion-fuente.js.
        fuente.errores!.push(...structuredClone(fuente.resultadosConsultas!.flatMap(consulta => consulta.errores)));
    }
    const resultado: ResultadoBusqueda = { estado, estadoScraping: estado,
        estadoEvaluacion: 'completada', fuentes: [fuente], configuracion };
    const ok = (datos: unknown, status = 200) => of(new HttpResponse({ status, body: { exito: true, datos } }));
    const fallo = (status: number, error: string) => throwError(() => new HttpErrorResponse({ status, error: { error } }));
    return (solicitud: HttpRequest<unknown>, ruta: string) => {
        if (ruta.endsWith('/scraping/previsualizacion')) return escenario === 'configuracion'
            ? fallo(503, 'Configuración sintética no disponible') : ok({ plataformas: configuracion });
        if (ruta.endsWith('/automatizacion/historial')) {
            lecturasHistorial++;
            if (escenario === 'historial' || escenario === 'conservado' && lecturasHistorial > 1) {
                return fallo(503, 'Historial sintético no disponible');
            }
            return ok(escenario === 'sin-ejecuciones' ? [] : [{ id: 58, tipo: 'ciclo_manual',
                inicio: '2026-01-15T18:00:00Z', fin: '2026-01-15T18:01:00Z',
                duracion_ms: 60000, estado, resumen: resultado }]);
        }
        if (ruta.endsWith('/automatizacion/estado')) return ok({ activo: false, expresionCron: null,
            ultimaEjecucion: null, ultimoResultado: escenario === 'sin-ejecuciones' ? null : resultado });
        if (ruta.endsWith('/automatizacion/progreso')) return ok({ activo: escenario === 'en-curso' || iniciado,
            porcentaje: 40, pasos: [], configuracion });
        if (ruta.endsWith('/automatizacion/ejecutar')) { iniciado = true; return ok({ configuracion }, 202); }
        if (ruta.endsWith('/ofertas/sincronizacion')) {
            lecturasSync++;
            if (['sincronizacion', 'alternativa'].includes(escenario) || escenario === 'recuperacion' && lecturasSync === 1) {
                return fallo(500, 'Servicio de sincronización sintético no disponible');
            }
        }
        if (ruta.endsWith('/ofertas') && ['sincronizacion', 'recuperacion'].includes(escenario)) {
            return fallo(503, 'Listado alternativo sintético no disponible');
        }
        if (ruta.includes('/scraping/') && solicitud.method === 'POST') return ok({
            mensaje: mensajeExtenso, plataforma: 'linkedin', total_extraidas: 5, ofertas_nuevas: 3,
            ofertas_duplicadas: 0, fuente: { ...fuente, motivoFinalizacion: mensajeExtenso },
            configuracion: configuracion[0],
        });
        return null;
    };
}
