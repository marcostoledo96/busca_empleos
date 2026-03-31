import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RespuestaApi, RespuestaEvaluacion } from '../modelos/respuesta-api.model';

@Injectable({ providedIn: 'root' })
export class EvaluacionService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/evaluacion`;

    // Evalúa todas las ofertas pendientes usando DeepSeek.
    ejecutarEvaluacion(): Observable<RespuestaApi<RespuestaEvaluacion>> {
        return this.http.post<RespuestaApi<RespuestaEvaluacion>>(`${this.urlBase}/ejecutar`, {});
    }
}
