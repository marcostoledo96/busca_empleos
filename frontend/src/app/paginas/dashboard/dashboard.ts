import { Component, inject, OnInit, signal } from '@angular/core';
import { TarjetasEstadisticas } from '../../componentes/tarjetas-estadisticas/tarjetas-estadisticas';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { TablaOfertas } from '../../componentes/tabla-ofertas/tabla-ofertas';
import { DetalleOferta } from '../../componentes/detalle-oferta/detalle-oferta';
import { OfertasService } from '../../servicios/ofertas.service';
import { Oferta, Estadisticas } from '../../modelos/oferta.model';

@Component({
    selector: 'app-dashboard',
    imports: [
        TarjetasEstadisticas,
        PanelControl,
        TablaOfertas,
        DetalleOferta
    ],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

    private readonly ofertasService = inject(OfertasService);

    // Estado reactivo de la página.
    readonly ofertas = signal<Oferta[]>([]);
    readonly estadisticas = signal<Estadisticas | null>(null);
    readonly cargando = signal(false);
    readonly ofertaSeleccionada = signal<Oferta | null>(null);
    readonly dialogoVisible = signal(false);

    ngOnInit(): void {
        this.cargarDatos();
    }

    // Carga ofertas y estadísticas en paralelo.
    cargarDatos(): void {
        this.cargando.set(true);

        this.ofertasService.obtenerEstadisticas().subscribe({
            next: (respuesta) => {
                if (respuesta.exito) {
                    this.estadisticas.set(respuesta.datos);
                }
            },
            error: (error) => console.error('Error al cargar estadísticas:', error)
        });

        this.ofertasService.obtenerOfertas().subscribe({
            next: (respuesta) => {
                this.cargando.set(false);
                if (respuesta.exito) {
                    this.ofertas.set(respuesta.datos);
                }
            },
            error: (error) => {
                this.cargando.set(false);
                console.error('Error al cargar ofertas:', error);
            }
        });
    }

    // Cuando el usuario hace clic en el ojo de una oferta.
    mostrarDetalle(oferta: Oferta): void {
        this.ofertaSeleccionada.set(oferta);
        this.dialogoVisible.set(true);
    }

    // Cuando una acción del panel de control termina, recargamos los datos.
    onAccionCompletada(): void {
        this.cargarDatos();
    }
}
