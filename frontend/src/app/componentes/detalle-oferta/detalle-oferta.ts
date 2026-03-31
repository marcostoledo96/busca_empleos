import { Component, input, model } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { Oferta } from '../../modelos/oferta.model';

@Component({
    selector: 'app-detalle-oferta',
    imports: [DatePipe, DialogModule, TagModule, ButtonModule],
    templateUrl: './detalle-oferta.html',
    styleUrl: './detalle-oferta.css'
})
export class DetalleOferta {

    // La oferta a mostrar. null = diálogo cerrado.
    readonly oferta = input<Oferta | null>(null);

    // model() es un signal bidireccional — el padre puede abrirlo/cerrarlo.
    readonly visible = model(false);

    // Determina el color del tag según el estado.
    severidadEstado(estado: string): 'success' | 'danger' | 'warn' | 'info' {
        const mapa: Record<string, 'success' | 'danger' | 'warn' | 'info'> = {
            'aprobada': 'success',
            'rechazada': 'danger',
            'pendiente': 'warn'
        };
        return mapa[estado] || 'info';
    }

    abrirEnPagina(): void {
        const url = this.oferta()?.url;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }
}
