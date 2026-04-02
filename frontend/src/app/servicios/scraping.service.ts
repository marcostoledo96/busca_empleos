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

    // Ejecuta el scraping de Indeed Argentina. Llama al Actor de Apify y guarda en BD.
    scrapearIndeed(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/indeed`, {});
    }

    // Ejecuta el scraping de Bumeran. Usa cheerio-scraper de Apify y guarda en BD.
    scrapearBumeran(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/bumeran`, {});
    }

    // Ejecuta el scraping de Glassdoor Argentina. Llama al Actor de Apify y guarda en BD.
    scrapearGlassdoor(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/glassdoor`, {});
    }

    // Ejecuta el scraping de GetOnBrd usando su API pública gratuita y guarda en BD.
    scrapearGetonbrd(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/getonbrd`, {});
    }

    // Ejecuta el scraping de Jooble usando su API REST oficial y guarda en BD.
    scrapearJooble(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/jooble`, {});
    }

    // Ejecuta el scraping de Google Jobs usando un actor de Apify y guarda en BD.
    scrapearGoogleJobs(): Observable<RespuestaApi<RespuestaScraping>> {
        return this.http.post<RespuestaApi<RespuestaScraping>>(`${this.urlBase}/google-jobs`, {});
    }
}
