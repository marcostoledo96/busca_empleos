import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Oferta, Estadisticas } from '../modelos/oferta.model';
import { RespuestaApi } from '../modelos/respuesta-api.model';

// Filtros opcionales para la consulta de ofertas.
export interface FiltrosOfertas {
    estado?: 'pendiente' | 'aprobada' | 'rechazada';
    plataforma?: 'linkedin' | 'computrabajo' | 'indeed' | 'bumeran';
    estado_postulacion?: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada';
    ordenar_por?: 'fecha_extraccion' | 'fecha_publicacion' | 'porcentaje_match' | 'titulo' | 'empresa' | 'estado_evaluacion';
    direccion?: 'ASC' | 'DESC';
}

@Injectable({ providedIn: 'root' })
export class OfertasService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/ofertas`;

    // Obtiene la lista de ofertas, opcionalmente filtrada y/o ordenada.
    obtenerOfertas(filtros?: FiltrosOfertas): Observable<RespuestaApi<Oferta[]>> {
        let params = new HttpParams();
        if (filtros?.estado) {
            params = params.set('estado', filtros.estado);
        }
        if (filtros?.plataforma) {
            params = params.set('plataforma', filtros.plataforma);
        }
        if (filtros?.estado_postulacion) {
            params = params.set('estado_postulacion', filtros.estado_postulacion);
        }
        if (filtros?.ordenar_por) {
            params = params.set('ordenar_por', filtros.ordenar_por);
        }
        if (filtros?.direccion) {
            params = params.set('direccion', filtros.direccion);
        }
        return this.http.get<RespuestaApi<Oferta[]>>(this.urlBase, { params });
    }

    // Obtiene las estadísticas agregadas (total, pendientes, aprobadas, rechazadas).
    obtenerEstadisticas(): Observable<RespuestaApi<Estadisticas>> {
        return this.http.get<RespuestaApi<Estadisticas>>(`${this.urlBase}/estadisticas`);
    }

    // Obtiene una oferta por su ID.
    obtenerOfertaPorId(id: number): Observable<RespuestaApi<Oferta>> {
        return this.http.get<RespuestaApi<Oferta>>(`${this.urlBase}/${id}`);
    }

    // Actualiza el estado de postulación de una oferta.
    actualizarPostulacion(id: number, estadoPostulacion: string): Observable<RespuestaApi<Oferta>> {
        return this.http.patch<RespuestaApi<Oferta>>(
            `${this.urlBase}/${id}/postulacion`,
            { estado_postulacion: estadoPostulacion }
        );
    }
}
