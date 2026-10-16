import { Component, input } from '@angular/core';
import { ResultadoFuente } from '../../modelos/respuesta-api.model';
import { PLATAFORMAS } from '../../config/plataformas';

export function etiquetaEstado(estado?: string): string {
    const etiquetas: Record<string, string> = {
        completada: 'Completada', sin_resultados: 'Sin resultados', parcial: 'Parcial',
        error: 'Error', timeout: 'Timeout', sin_credenciales: 'Sin credenciales',
        deshabilitada: 'Deshabilitada', interrumpida: 'Interrumpida', omitida: 'Omitida', ejecutando: 'En ejecución',
    };
    return estado ? etiquetas[estado] || estado : 'No informado';
}

@Component({
    selector: 'app-resultado-fuente',
    template: `
        <details>
            <summary>{{ fuente().nombre || nombres[fuente().plataforma] || fuente().plataforma }} — {{ etiquetaEstado(fuente().estado) }}</summary>
            <p>Scraping: {{ etiquetaEstado(fuente().estadoScraping) }}</p>
            <p>Nuevas: {{ fuente().nuevas ?? 'No medido' }} · Actualizadas: {{ fuente().actualizadas ?? 'No medido' }} · Reapariciones: {{ fuente().reapariciones ?? 'No medido' }}</p>
            <p>Existentes (legacy, no sumable): {{ fuente().duplicadas ?? 'No medido' }} · Intra-ejecución: {{ fuente().duplicadasDescartadas ?? 'No medido' }}</p>
            <p>Descartadas por idioma: {{ fuente().idiomaDescartadas ?? 'No medido' }} · Por antigüedad: {{ fuente().antiguasDescartadas ?? 'No medido' }}</p>
            <p>Brutas: {{ fuente().totalCrudos ?? 'No medido' }} · Elegibles: {{ fuente().totalElegibles ?? 'No medido' }} · Peticiones: {{ fuente().peticionesRealizadas ?? 'No medido' }} · Consultas ejecutadas: {{ fuente().consultasEjecutadas ?? 'No medido' }}</p>
            <p>Duración: {{ fuente().duracionMs ?? 'No medido' }} ms · Finalización: {{ fuente().motivoFinalizacion || 'No informado' }}</p>
            @for (error of fuente().errores; track $index) {
                <p>Error: {{ error.tipo }} {{ error.codigoHttp }} {{ error.mensaje }}</p>
            }
            @for (consulta of fuente().resultadosConsultas; track $index) {
                <details>
                    <summary>Consulta: {{ consulta.consulta ?? 'No informada' }} — {{ etiquetaEstado(consulta.estado) }}</summary>
                    <p>Peticiones: {{ consulta.peticionesRealizadas ?? 'No medido' }} · Brutas: {{ consulta.totalCrudos ?? 'No medido' }}</p>
                    @for (error of consulta.errores; track $index) {
                        <p>Error: {{ error.tipo }} {{ error.codigoHttp }} {{ error.mensaje }}</p>
                    }
                </details>
            }
        </details>
    `,
    styles: ':host { display: block; overflow-wrap: anywhere; } summary { cursor: pointer; }',
})
export class ResultadoFuenteVista {
    readonly fuente = input.required<ResultadoFuente>();
    readonly etiquetaEstado = etiquetaEstado;
    readonly nombres = Object.fromEntries(Object.values(PLATAFORMAS).map(p => [p.id, p.label]));
}
