import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Preferencias, PreferenciasActualizar } from '../modelos/preferencia.model';
import { RespuestaApi } from '../modelos/respuesta-api.model';

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
    scoring_config?: Record<string, unknown> | null;
    preguntas: Array<{ campo: string; pregunta: string; motivo?: string; sugerencia?: string | null }>;
    preguntas_perfil_pendientes?: Array<{ campo: string; pregunta: string; motivo?: string; sugerencia?: string | null }>;
    advertencias: string[];
}

@Injectable({ providedIn: 'root' })
export class PreferenciasService {

    private readonly http = inject(HttpClient);
    private readonly urlBase = `${environment.urlApi}/preferencias`;

    obtenerPreferencias(): Observable<RespuestaApi<Preferencias>> {
        return this.http.get<RespuestaApi<Preferencias>>(this.urlBase);
    }

    actualizarPreferencias(datos: PreferenciasActualizar): Observable<RespuestaApi<Preferencias>> {
        return this.http.put<RespuestaApi<Preferencias>>(this.urlBase, datos);
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
