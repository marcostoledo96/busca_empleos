import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RespuestaApi, RespuestaScraping } from '../modelos/respuesta-api.model';

@Injectable({ providedIn: 'root' })
export class ScrapingService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/scraping`;

    // Ejecuta el scraping de LinkedIn. Llama al Actor de Apify y guarda en BD.
    scrapearLinkedin(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/linkedin`, {});
    }

    // Ejecuta el scraping de Computrabajo. Llama al Actor de Apify y guarda en BD.
    scrapearComputrabajo(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/computrabajo`, {});
    }
}
