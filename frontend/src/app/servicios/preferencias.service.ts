import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Preferencias, PreferenciasActualizar, PreguntaPerfil } from '../modelos/preferencia.model';
import { RespuestaApi, RespuestaPreferencias } from '../modelos/respuesta-api.model';

export interface CvBase {
    cv_base: string | null;
    cv_base_actualizado_en: string | null;
}

export interface ResultadoImportacionCv {
    nombre: string | null;
    nivel_experiencia: string | null;
    perfil_profesional: string | null;
    idioma_candidato: string | null;
    modalidad_aceptada: string | null;
    zonas_preferidas: string[];
    disponibilidad?: string | null;
    expectativa_salarial_min?: number | null;
    expectativa_salarial_max?: number | null;
    moneda_salarial?: string | null;
    nivel_ingles_detalle?: {
        espanol?: string | null;
        reading?: string | null;
        writing?: string | null;
        speaking?: string | null;
        listening?: string | null;
        regla?: string | null;
    } | null;
    tecnologias_detalle: Array<{ nombre: string; nivel: string; categoria: string; importancia: string; aliases: string[]; evidencia?: string }>;
    roles_objetivo_detalle: Array<{ rol: string; prioridad: string; aliases: string[]; evidencia?: string }>;
    terminos_busqueda: string[];
    reglas_exclusion?: string[];
    keywords_positivas?: string[];
    keywords_negativas?: string[];
    plataformas_preferidas?: string[];
    plataformas_excluidas?: string[];
    // scoring_config fue deprecado en B1. Se conserva el campo opcional
    // para compatibilidad si la API lo devuelve, pero el frontend no lo usa.
    scoring_config?: Record<string, unknown> | null;
    preguntas: PreguntaPerfil[];
    preguntas_perfil_pendientes?: PreguntaPerfil[];
    advertencias: string[];
}

@Injectable({ providedIn: 'root' })
export class PreferenciasService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/preferencias`;

    obtenerPreferencias(): Observable<RespuestaPreferencias<Preferencias>> {
        return this.http.get<RespuestaPreferencias<Preferencias>>(this.urlBase);
    }

    actualizarPreferencias(datos: PreferenciasActualizar): Observable<RespuestaPreferencias<Preferencias>> {
        return this.http.put<RespuestaPreferencias<Preferencias>>(this.urlBase, datos);
    }

    obtenerCvBase(): Observable<RespuestaApi<CvBase>> {
        return this.http.get<RespuestaApi<CvBase>>(`${this.urlBase}/cv-base`);
    }

    guardarCvBase(texto: string): Observable<RespuestaApi<CvBase>> {
        return this.http.put<RespuestaApi<CvBase>>(`${this.urlBase}/cv-base`, texto, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
    }

    // Extraigo texto sin llamar a IA ni guardar el documento.
    extraerTextoCv(archivo: File): Observable<RespuestaApi<{ texto: string; formato: 'pdf' | 'md' }>> {
        const datos = new FormData();
        datos.append('cv', archivo);
        return this.http.post<RespuestaApi<{ texto: string; formato: 'pdf' | 'md' }>>(
            `${this.urlBase}/importar-cv/extraer-texto`, datos
        );
    }

    // Analiza un CV Markdown con DeepSeek. No guarda preferencias.
    analizarCvMarkdown(archivo: File): Observable<RespuestaApi<ResultadoImportacionCv>> {
        const fd = new FormData();
        fd.append('cv', archivo);
        return this.http.post<RespuestaApi<ResultadoImportacionCv>>(
            `${this.urlBase}/importar-cv/analizar`, fd
        );
    }
}
