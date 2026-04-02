import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { FormsModule } from '@angular/forms';
import { Oferta } from '../../modelos/oferta.model';
import { OfertasService } from '../../servicios/ofertas.service';

@Component({
    selector: 'app-tabla-ofertas',
    imports: [DatePipe, UpperCasePipe, TableModule, SelectModule, FormsModule],
    templateUrl: './tabla-ofertas.html',
    styleUrl: './tabla-ofertas.css'
})
export class TablaOfertas {

    private readonly ofertasService = inject(OfertasService);

    // Datos que recibe del componente padre.
    readonly ofertas = input<Oferta[]>([]);
    readonly cargando = input(false);
    readonly sortField = input('porcentaje_match');
    readonly sortOrder = input(-1);

    // Evento que emite cuando el usuario hace clic en una oferta.
    readonly ofertaSeleccionada = output<Oferta>();

    // Evento que emite cuando se actualiza una postulación (para refrescar datos).
    readonly postulacionActualizada = output<void>();

    // Evento que emite cuando el usuario aplica una acción masiva.
    readonly accionMasiva = output<{ ids: number[]; estadoPostulacion: string }>();

    // Set de IDs de ofertas seleccionadas con checkbox.
    readonly seleccionadas = signal<Set<number>>(new Set());

    // Estado del dropdown de selección masiva.
    estadoBulkSeleccionado: string | null = null;

    // Opciones de estado para la acción masiva (mismo set que el individual).
    readonly opcionesAccionMasiva = [
        { label: 'No postulado', value: 'no_postulado' },
        { label: 'CV enviado', value: 'cv_enviado' },
        { label: 'En proceso', value: 'en_proceso' },
        { label: 'Descartar', value: 'descartada' },
    ];

    // True si al menos una oferta de la página está seleccionada.
    readonly algunaSeleccionada = computed(() => this.seleccionadas().size > 0);

    // True si TODAS las ofertas visibles están seleccionadas.
    readonly todasSeleccionadas = computed(() => {
        const total = this.ofertas().length;
        if (total === 0) return false;
        return this.ofertas().every(o => this.seleccionadas().has(o.id));
    });

    // Opciones para los filtros de los dropdowns.
    readonly opcionesEstado = [
        { label: 'Todos', value: null },
        { label: 'Pendientes', value: 'pendiente' },
        { label: 'Aprobadas', value: 'aprobada' },
        { label: 'Rechazadas', value: 'rechazada' }
    ];

    readonly opcionesPlataforma = [
        { label: 'Todas', value: null },
        { label: 'LinkedIn', value: 'linkedin' },
        { label: 'Computrabajo', value: 'computrabajo' },
        { label: 'Indeed', value: 'indeed' },
        { label: 'Bumeran', value: 'bumeran' },
            { label: 'Glassdoor', value: 'glassdoor' },
    ];

    readonly opcionesPostulacion = [
        { label: 'No postulado', value: 'no_postulado' },
        { label: 'CV enviado', value: 'cv_enviado' },
        { label: 'En proceso', value: 'en_proceso' },
        { label: 'Descartada', value: 'descartada' },
    ];

    // Determina el color del tag según el estado de evaluación.
    severidadEstado(estado: string): 'success' | 'danger' | 'warn' | 'info' {
        const mapa: Record<string, 'success' | 'danger' | 'warn' | 'info'> = {
            'aprobada': 'success',
            'rechazada': 'danger',
            'pendiente': 'warn'
        };
        return mapa[estado] || 'info';
    }

    // Determina el color del tag para el estado de postulación.
    severidadPostulacion(estado: string): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
        const mapa: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
            'no_postulado': 'secondary',
            'cv_enviado': 'info',
            'en_proceso': 'warn',
            'descartada': 'danger',
        };
        return mapa[estado] || 'secondary';
    }

    // Texto legible para el estado de postulación.
    textoPostulacion(estado: string): string {
        const mapa: Record<string, string> = {
            'no_postulado': 'No postulado',
            'cv_enviado': 'CV enviado',
            'en_proceso': 'En proceso',
            'descartada': 'Descartada',
        };
        return mapa[estado] || estado;
    }

    // Retorna el nivel semántico del match para colorear monocromáticamente.
    nivelMatch(porcentaje: number): 'alto' | 'medio' | 'bajo' {
        if (porcentaje >= 70) return 'alto';
        if (porcentaje >= 40) return 'medio';
        return 'bajo';
    }

    // Determina el icono del tag según la plataforma.
    iconoPlataforma(plataforma: string): string {
        const mapa: Record<string, string> = {
            'linkedin': 'pi pi-linkedin',
            'computrabajo': 'pi pi-globe',
            'indeed': 'pi pi-search',
            'bumeran': 'pi pi-briefcase',
        };
        return mapa[plataforma] || 'pi pi-question';
    }

    verDetalle(oferta: Oferta): void {
        this.ofertaSeleccionada.emit(oferta);
    }

    // Cambia el estado de postulación de una oferta vía API.
    cambiarPostulacion(oferta: Oferta, nuevoEstado: string): void {
        this.ofertasService.actualizarPostulacion(oferta.id, nuevoEstado).subscribe({
            next: (respuesta) => {
                if (respuesta.exito) {
                    oferta.estado_postulacion = respuesta.datos.estado_postulacion;
                    this.postulacionActualizada.emit();
                }
            },
            error: (error) => console.error('Error al actualizar postulación:', error)
        });
    }

    // Alterna la selección de una oferta individual.
    toggleSeleccion(id: number): void {
        const actual = new Set(this.seleccionadas());
        if (actual.has(id)) {
            actual.delete(id);
        } else {
            actual.add(id);
        }
        this.seleccionadas.set(actual);
    }

    // Alterna la selección de todas las ofertas visibles.
    toggleSeleccionarTodas(): void {
        if (this.todasSeleccionadas()) {
            this.seleccionadas.set(new Set());
        } else {
            this.seleccionadas.set(new Set(this.ofertas().map(o => o.id)));
        }
    }

    // Limpia la selección actual.
    limpiarSeleccion(): void {
        this.seleccionadas.set(new Set());
        this.estadoBulkSeleccionado = null;
    }

    // Aplica la acción masiva y emite el evento al padre para confirmación.
    aplicarAccionMasiva(): void {
        if (!this.estadoBulkSeleccionado || this.seleccionadas().size === 0) return;
        const ids = Array.from(this.seleccionadas());
        this.accionMasiva.emit({ ids, estadoPostulacion: this.estadoBulkSeleccionado });
        this.limpiarSeleccion();
    }
}
