import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { Oferta } from '../../modelos/oferta.model';

@Component({
    selector: 'app-tabla-ofertas',
    imports: [DatePipe, TableModule, TagModule, ButtonModule, SelectModule, InputTextModule, FormsModule],
    templateUrl: './tabla-ofertas.html',
    styleUrl: './tabla-ofertas.css'
})
export class TablaOfertas {

    // Datos que recibe del componente padre.
    readonly ofertas = input<Oferta[]>([]);
    readonly cargando = input(false);

    // Evento que emite cuando el usuario hace clic en una oferta.
    readonly ofertaSeleccionada = output<Oferta>();

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
        { label: 'Computrabajo', value: 'computrabajo' }
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

    // Determina el icono del tag según la plataforma.
    iconoPlataforma(plataforma: string): string {
        return plataforma === 'linkedin' ? 'pi pi-linkedin' : 'pi pi-globe';
    }

    verDetalle(oferta: Oferta): void {
        this.ofertaSeleccionada.emit(oferta);
    }
}
