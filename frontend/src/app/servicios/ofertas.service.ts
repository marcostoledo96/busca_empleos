import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Oferta, Estadisticas } from '../modelos/oferta.model';
import { RespuestaApi } from '../modelos/respuesta-api.model';

// Filtros opcionales para la consulta de ofertas.
export interface FiltrosOfertas {
    estado?: 'pendiente' | 'aprobada' | 'rechazada';
    plataforma?: 'linkedin' | 'computrabajo';
}

@Injectable({ providedIn: 'root' })
export class OfertasService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/ofertas`;

    // Obtiene la lista de ofertas, opcionalmente filtrada por estado y/o plataforma.
    obtenerOfertas(filtros?: FiltrosOfertas): Observable<RespuestaApi<Oferta[]>> {
        let params = new HttpParams();
        if (filtros?.estado) {
            params = params.set('estado', filtros.estado);
        }
        if (filtros?.plataforma) {
            params = params.set('plataforma', filtros.plataforma);
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
}
