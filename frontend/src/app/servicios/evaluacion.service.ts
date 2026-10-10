import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RespuestaApi, InicioEvaluacion, ProgresoEvaluacion } from '../modelos/respuesta-api.model';

@Injectable({ providedIn: 'root' })
export class EvaluacionService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/evaluacion`;

    // Inicia la evaluación en segundo plano. El backend responde de inmediato.
    ejecutarEvaluacion(ids?: number[]): Observable<InicioEvaluacion> {
        return this.http.post<InicioEvaluacion>(`${this.urlBase}/ejecutar`, ids === undefined ? {} : { ids });
    }

    // Devuelve el estado actual del progreso (para polling).
    obtenerProgreso(): Observable<RespuestaApi<ProgresoEvaluacion>> {
        return this.http.get<RespuestaApi<ProgresoEvaluacion>>(`${this.urlBase}/progreso`);
    }

    // Solicita la cancelación de la evaluación en curso.
    cancelarEvaluacion(): Observable<RespuestaApi<void>> {
        return this.http.post<RespuestaApi<void>>(`${this.urlBase}/cancelar`, {});
    }

    // Resetea a "pendiente" las evaluaciones de los últimos N días.
    resetearEvaluaciones(dias: number): Observable<RespuestaApi<{ reseteadas: number; ofertas: { id: number; titulo: string }[] }>> {
        return this.http.post<RespuestaApi<{ reseteadas: number; ofertas: { id: number; titulo: string }[] }>>(
            `${this.urlBase}/resetear`,
            { dias }
        );
    }
}
