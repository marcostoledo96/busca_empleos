import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Preferencias, PreferenciasActualizar } from '../modelos/preferencia.model';
import { RespuestaApi } from '../modelos/respuesta-api.model';

@Injectable({ providedIn: 'root' })
export class PreferenciasService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/preferencias`;

    // Obtiene las preferencias actuales del usuario.
    obtenerPreferencias(): Observable<RespuestaApi<Preferencias>> {
        return this.http.get<RespuestaApi<Preferencias>>(this.urlBase);
    }

    // Actualiza las preferencias. Solo manda los campos que cambiaron.
    actualizarPreferencias(datos: PreferenciasActualizar): Observable<RespuestaApi<Preferencias>> {
        return this.http.put<RespuestaApi<Preferencias>>(this.urlBase, datos);
    }
}
