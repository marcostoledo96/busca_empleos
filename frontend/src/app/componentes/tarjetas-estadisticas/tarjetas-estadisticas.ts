import { Component, input } from '@angular/core';
import { Estadisticas } from '../../modelos/oferta.model';

@Component({
    selector: 'app-tarjetas-estadisticas',
    templateUrl: './tarjetas-estadisticas.html',
    styleUrl: './tarjetas-estadisticas.css'
})
export class TarjetasEstadisticas {
    // Recibe las estadísticas del componente padre.
    // input() es la forma moderna de Angular (signals) para @Input().
    readonly estadisticas = input<Estadisticas | null>(null);
    readonly cargando = input(false);
}
