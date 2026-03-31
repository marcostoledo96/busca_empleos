import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RespuestaApi, EstadoAutomatizacion } from '../modelos/respuesta-api.model';

@Injectable({ providedIn: 'root' })
export class AutomatizacionService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/automatizacion`;

    // Consulta si el cron está activo, cuándo fue la última ejecución, etc.
    obtenerEstado(): Observable<RespuestaApi<EstadoAutomatizacion>> {
        return this.http.get<RespuestaApi<EstadoAutomatizacion>>(`${this.urlBase}/estado`);
    }

    // Programa el cron para que se ejecute periódicamente.
    iniciarCron(expresionCron?: string): Observable<RespuestaApi<EstadoAutomatizacion>> {
        const body = expresionCron ? { expresionCron } : {};
        return this.http.post<RespuestaApi<EstadoAutomatizacion>>(`${this.urlBase}/iniciar`, body);
    }

    // Detiene el cron activo.
    detenerCron(): Observable<RespuestaApi<EstadoAutomatizacion>> {
        return this.http.post<RespuestaApi<EstadoAutomatizacion>>(`${this.urlBase}/detener`, {});
    }

    // Ejecuta un ciclo completo manualmente (sin esperar al cron).
    ejecutarCiclo(): Observable<RespuestaApi<Record<string, unknown>>> {
        return this.http.post<RespuestaApi<Record<string, unknown>>>(`${this.urlBase}/ejecutar`, {});
    }
}
