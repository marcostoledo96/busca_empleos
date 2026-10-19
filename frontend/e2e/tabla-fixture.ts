import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { defer, of, switchMap, throwError, timer } from 'rxjs';
import { Oferta } from '../src/app/modelos/oferta.model';
import { crearHttpDetalle, crearOfertasDetalle } from './detalle-fixture';

export const FECHA_TABLA = '2026-10-19T12:00:00.000Z';

export function crearOfertasTabla(): Oferta[] {
    const base = crearOfertasDetalle('aprobada')[0];
    const aprobadas = Array.from({ length: 45 }, (_, indice): Oferta => ({
        ...structuredClone(base), id: 1001 + indice,
        titulo: `Angular junior ${String(indice + 1).padStart(2, '0')}`,
        empresa: indice === 0 ? 'Tecnología del Río' : 'Laboratorio del Sur',
        ubicacion: indice === 0 ? 'Córdoba, Argentina' : 'Buenos Aires, Argentina',
        plataforma: indice % 2 ? 'computrabajo' : 'linkedin', porcentaje_match: 90 - indice,
        fecha_extraccion: '2026-10-18T12:00:00.000Z', fecha_ultima_extraccion: FECHA_TABLA,
        fecha_publicacion: '2026-10-17T12:00:00.000Z', prioridad_ia: indice === 0,
    }));
    const estados = ['rechazada', 'pendiente', 'error', 'reevaluacion-fallida', 'desactualizada', 'historica', 'postulada', 'textos-largos'];
    return [...aprobadas, ...estados.map((estado, indice): Oferta => ({
        ...crearOfertasDetalle(estado)[0], id: 2001 + indice,
        titulo: estado === 'textos-largos' ? crearOfertasDetalle(estado)[0].titulo : `Caso ${estado}`,
        fecha_extraccion: '2026-10-18T12:00:00.000Z', fecha_ultima_extraccion: FECHA_TABLA,
    })), { ...base, id: 3001, titulo: 'Caso descartada', estado_postulacion: 'descartada' },
    { ...base, id: 3002, titulo: 'Caso en proceso', estado_postulacion: 'en_proceso' },
    { ...base, id: 3003, titulo: 'Caso sin compatibilidad', porcentaje_match: null }];
}

export function crearHttpTabla(ofertas: Oferta[], parametros: URLSearchParams) {
    const guardadas = structuredClone(ofertas);
    let detalle = crearHttpDetalle(guardadas, parametros);
    let intentoBulk = 0;
    const responder = (solicitud: HttpRequest<unknown>, ruta: string) => {
        if (ruta !== '/ofertas/bulk/postulacion') return detalle(solicitud, ruta);
        const cuerpo = solicitud.body as { ids: number[]; estado_postulacion: Oferta['estado_postulacion'] };
        const intento = ++intentoBulk;
        return timer(150).pipe(switchMap(() => defer(() => {
            if (parametros.get('errorBulk') === '1' && intento === 1) return throwError(() => new HttpErrorResponse({
                status: 503, error: { error: 'Guardado masivo sintético fallido' },
            }));
            if (solicitud.method !== 'PATCH' || !cuerpo.ids.length || !cuerpo.ids.every(id => guardadas.some(o => o.id === id))) {
                return throwError(() => new Error('IDs masivos inválidos en el fixture'));
            }
            guardadas.filter(o => cuerpo.ids.includes(o.id)).forEach(o => o.estado_postulacion = cuerpo.estado_postulacion);
            detalle = crearHttpDetalle(guardadas, parametros);
            return of(new HttpResponse({ body: { exito: true, datos: { actualizadas: cuerpo.ids.length } } }));
        })));
    };
    return Object.assign(responder, {
        recortar: () => {
            guardadas.splice(15);
            detalle = crearHttpDetalle(guardadas, parametros);
        },
    });
}
