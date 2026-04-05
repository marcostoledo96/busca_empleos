import { Component, inject, input, model, output } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { Oferta } from '../../modelos/oferta.model';
import { OfertasService } from '../../servicios/ofertas.service';

@Component({
    selector: 'app-detalle-oferta',
    imports: [DatePipe, UpperCasePipe, DialogModule, SelectModule, FormsModule],
    templateUrl: './detalle-oferta.html',
    styleUrl: './detalle-oferta.css'
})
export class DetalleOferta {

    private readonly ofertasService = inject(OfertasService);

    // La oferta a mostrar. null = diálogo cerrado.
    readonly oferta = input<Oferta | null>(null);

    // model() es un signal bidireccional — el padre puede abrirlo/cerrarlo.
    readonly visible = model(false);

    // Cuando es true, el dropdown de postulación queda deshabilitado.
    readonly modoDemo = input(false);

    // Evento que emite cuando se actualiza la postulación.
    readonly postulacionActualizada = output<void>();

    readonly opcionesPostulacion = [
        { label: 'No postulado', value: 'no_postulado' },
        { label: 'CV enviado', value: 'cv_enviado' },
        { label: 'En proceso', value: 'en_proceso' },
        { label: 'Descartada', value: 'descartada' },
    ];

    // Determina el color del tag según el estado.
    severidadEstado(estado: string): 'success' | 'danger' | 'warn' | 'info' {
        const mapa: Record<string, 'success' | 'danger' | 'warn' | 'info'> = {
            'aprobada': 'success',
            'rechazada': 'danger',
            'pendiente': 'warn'
        };
        return mapa[estado] || 'info';
    }

    // Determina el color del tag según el porcentaje de match.
    severidadPorcentaje(porcentaje: number): 'success' | 'danger' | 'warn' | 'info' {
        if (porcentaje >= 70) return 'success';
        if (porcentaje >= 50) return 'warn';
        return 'danger';
    }

    abrirEnPagina(): void {
        const url = this.oferta()?.url;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    cambiarPostulacion(nuevoEstado: string): void {
        const o = this.oferta();
        if (!o) return;
        if (this.modoDemo()) return;

        this.ofertasService.actualizarPostulacion(o.id, nuevoEstado).subscribe({
            next: (respuesta) => {
                if (respuesta.exito) {
                    o.estado_postulacion = respuesta.datos.estado_postulacion;
                    this.postulacionActualizada.emit();
                }
            },
            error: (error) => console.error('Error al actualizar postulación:', error)
        });
    }
}
