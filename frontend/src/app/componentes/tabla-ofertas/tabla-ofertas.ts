import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
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
import { obtenerOpcionesFiltroPlataforma } from '../../config/plataformas';

@Component({
    selector: 'app-tabla-ofertas',
    imports: [DatePipe, UpperCasePipe, TableModule, SelectModule, FormsModule],
    templateUrl: './tabla-ofertas.html',
    styleUrl: './tabla-ofertas.css',
    host: { '(window:resize)': 'limpiarSeleccion()' }
})
export class TablaOfertas {

    private readonly ofertasService = inject(OfertasService);

    // Datos que recibe del componente padre.
    readonly ofertas = input<Oferta[]>([]);
    readonly cargando = input(false);
    readonly sortField = input('porcentaje_match');
    readonly sortOrder = input(-1);

    // Cuando es true, bloquea checkboxes, dropdowns de postulación y acciones masivas.
    readonly modoDemo = input(false);
    readonly evaluacionOcupada = input(false);
    readonly reevaluarSeleccionadas = output<number[]>();
    readonly confirmandoReevaluacion = signal(false);

    constructor() {
        // Ante un refresh descarto la selección: nunca confirmo IDs de otra vista.
        effect(() => {
            this.ofertas();
            this.paginaActualCards.set(0);
            this.limpiarSeleccion();
        });
    }

    esReciente(oferta: Oferta): boolean {
        const fecha = new Date(oferta.fecha_extraccion).getTime();
        return Number.isFinite(fecha) && fecha >= Date.now() - 30 * 86400000;
    }

    readonly seleccionReevaluable = computed(() => {
        const ids = this.seleccionadas();
        return ids.size > 0 && ids.size <= 200 && this.ofertas()
            .filter(o => ids.has(o.id) && Number.isSafeInteger(o.id) && o.id > 0 && this.esReciente(o)).length === ids.size;
    });

    solicitarReevaluacion(): void {
        if (this.modoDemo() || this.evaluacionOcupada() || !this.seleccionReevaluable()) return;
        this.confirmandoReevaluacion.set(true);
    }

    confirmarReevaluacion(): void {
        if (!this.confirmandoReevaluacion() || this.modoDemo() || this.evaluacionOcupada() || !this.seleccionReevaluable()) return;
        this.reevaluarSeleccionadas.emit([...this.seleccionadas()]);
        this.limpiarSeleccion();
    }

    errorEvaluacionOferta(oferta: Oferta): string | null {
        const datos = oferta as Oferta & { evaluacion_error_mensaje?: string | null; fecha_evaluacion?: string | null };
        const mensaje = datos.evaluacion_error_mensaje;
        if (!mensaje || mensaje === 'REEVALUACION_SOLICITADA') return null;
        const conservado = datos.fecha_evaluacion && oferta.razon_evaluacion !== mensaje;
        return `Error de evaluación: ${mensaje}. ${conservado ? 'Resultado anterior conservado' : 'Sin resultado válido nuevo'}.`;
    }

    textoVigencia(oferta: Oferta): string {
        if (oferta.estado_evaluacion === 'pendiente') return 'Sin evaluación';
        if (oferta.vigencia_evaluacion === 'actual') return 'Evaluación actual';
        if (oferta.vigencia_evaluacion === 'anterior') return 'Evaluación anterior';
        return 'Vigencia desconocida';
    }

    // Evento que emite cuando el usuario hace clic en una oferta.
    readonly ofertaSeleccionada = output<Oferta>();

    // Evento que emite cuando se actualiza una postulación (para refrescar datos).
    readonly postulacionActualizada = output<void>();

    // Evento que emite cuando inicia o termina un optimistic update de postulación.
    // pendiente = true cuando empieza, false cuando termina (éxito o error).
    readonly postulacionPendiente = output<{ id: number; pendiente: boolean }>();

    // Evento que emite cuando el usuario aplica una acción masiva.
    readonly accionMasiva = output<{ ids: number[]; estadoPostulacion: string }>();

    // Set de IDs de ofertas seleccionadas con checkbox.
    readonly seleccionadas = signal<Set<number>>(new Set());

    // Estado del dropdown de selección masiva.
    estadoBulkSeleccionado: string | null = null;

    // === Vista cards (mobile) — paginación y filtro propio ===
    readonly paginaActualCards = signal(0);
    readonly filasPorPaginaCards = 20;
    readonly filtroTextoCards = signal('');

    // Ofertas filtradas por el buscador de la vista cards.
    readonly ofertasFiltradasCards = computed(() => {
        const texto = this.filtroTextoCards().toLowerCase().trim();
        if (!texto) return this.ofertas();
        return this.ofertas().filter(o =>
            o.titulo?.toLowerCase().includes(texto) ||
            o.empresa?.toLowerCase().includes(texto) ||
            o.ubicacion?.toLowerCase().includes(texto)
        );
    });

    // Ofertas de la página actual en la vista cards.
    readonly ofertasPaginadasCards = computed(() => {
        const inicio = this.paginaActualCards() * this.filasPorPaginaCards;
        return this.ofertasFiltradasCards().slice(inicio, inicio + this.filasPorPaginaCards);
    });

    // Total de páginas en la vista cards.
    readonly totalPaginasCards = computed(() =>
        Math.ceil(this.ofertasFiltradasCards().length / this.filasPorPaginaCards)
    );

    // Páginas visibles en el paginador de cards (máximo 5, centradas en la página actual).
    // Evita que el paginador desborde horizontalmente en mobile con muchas páginas.
    readonly paginasVisiblesCards = computed(() => {
        const total = this.totalPaginasCards();
        const actual = this.paginaActualCards();
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i);
        }
        let inicio = Math.max(0, actual - 2);
        const fin = Math.min(total - 1, inicio + 4);
        inicio = Math.max(0, fin - 4);
        return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
    });

    // Cambia de página en la vista cards.
    irAPaginaCards(pagina: number): void {
        if (pagina >= 0 && pagina < this.totalPaginasCards()) {
            this.limpiarSeleccion();
            this.paginaActualCards.set(pagina);
        }
    }

    // Actualiza el filtro de texto de la vista cards y resetea la página.
    filtrarCards(evento: Event): void {
        const valor = (evento.target as HTMLInputElement).value;
        this.limpiarSeleccion();
        this.filtroTextoCards.set(valor);
        this.paginaActualCards.set(0);
    }

    // Opciones de estado para la acción masiva (mismo set que el individual).
    readonly opcionesAccionMasiva = [
        { label: 'No postulado', value: 'no_postulado' },
        { label: 'CV enviado', value: 'cv_enviado' },
        { label: 'En proceso', value: 'en_proceso' },
        { label: 'Descartar', value: 'descartada' },
    ];

    // True si al menos una oferta de la página está seleccionada.
    readonly algunaSeleccionada = computed(() => this.seleccionadas().size > 0);

    contarSeleccionadasVisibles(visibles: Oferta[]): number {
        return visibles.filter(oferta => this.seleccionadas().has(oferta.id)).length;
    }

    // Comparo el mismo conjunto visible que uso al seleccionar la página.
    todasSeleccionadas(visibles = this.ofertas()): boolean {
        return visibles.length > 0 && this.contarSeleccionadasVisibles(visibles) === visibles.length;
    }

    // Opciones para los filtros de los dropdowns.
    readonly opcionesEstado = [
        { label: 'Todos', value: null },
        { label: 'Pendientes', value: 'pendiente' },
        { label: 'Aprobadas', value: 'aprobada' },
        { label: 'Rechazadas', value: 'rechazada' }
    ];

    readonly opcionesPlataforma = obtenerOpcionesFiltroPlataforma();

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

    // Permite activar una card con Enter o Espacio desde el teclado.
    activarCardConTeclado(evento: KeyboardEvent, oferta: Oferta): void {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            this.verDetalle(oferta);
        }
    }

    // Cambia el estado de postulación con optimistic update.
    // El cambio se ve instantáneo; si el backend falla, se revierte solo.
    cambiarPostulacion(oferta: Oferta, nuevoEstado: string): void {
        if (this.modoDemo()) return;

        const estadoAnterior = oferta.estado_postulacion;
        const estado = nuevoEstado as Oferta['estado_postulacion'];

        // 1. Optimistic update — se refleja en la UI al instante.
        oferta.estado_postulacion = estado;
        this.postulacionActualizada.emit();
        this.postulacionPendiente.emit({ id: oferta.id, pendiente: true });

        // 2. Persistir en el backend.
        this.ofertasService.actualizarPostulacion(oferta.id, nuevoEstado).subscribe({
            next: (respuesta) => {
                this.postulacionPendiente.emit({ id: oferta.id, pendiente: false });
                if (respuesta.exito) {
                    // Confirmar con los datos reales del backend.
                    oferta.estado_postulacion = respuesta.datos.estado_postulacion;
                    this.postulacionActualizada.emit();
                } else {
                    // Revertir si el backend respondió pero con error lógico.
                    oferta.estado_postulacion = estadoAnterior;
                    this.postulacionActualizada.emit();
                    console.error('Error al actualizar postulación:', respuesta.error);
                }
            },
            error: (error) => {
                this.postulacionPendiente.emit({ id: oferta.id, pendiente: false });
                // Revertir si falló la red o el servidor.
                oferta.estado_postulacion = estadoAnterior;
                this.postulacionActualizada.emit();
                console.error('Error al actualizar postulación:', error);
            }
        });
    }

    // Alterna la selección de una oferta individual.
    toggleSeleccion(id: number): void {
        if (this.modoDemo() || this.evaluacionOcupada()) return;
        this.confirmandoReevaluacion.set(false);
        const actual = new Set(this.seleccionadas());
        if (actual.has(id)) {
            actual.delete(id);
        } else {
            actual.add(id);
        }
        this.seleccionadas.set(actual);
    }

    // Alterna la selección de todas las ofertas visibles.
    toggleSeleccionarTodas(visibles = this.ofertas()): void {
        if (this.modoDemo() || this.evaluacionOcupada()) return;
        this.confirmandoReevaluacion.set(false);
        if (visibles.every(o => this.seleccionadas().has(o.id))) {
            this.seleccionadas.set(new Set());
        } else {
            this.seleccionadas.set(new Set(visibles.map(o => o.id)));
        }
    }

    // Limpia la selección actual.
    limpiarSeleccion(): void {
        this.seleccionadas.set(new Set());
        this.estadoBulkSeleccionado = null;
        this.confirmandoReevaluacion.set(false);
    }

    // Aplica la acción masiva y emite el evento al padre para confirmación.
    aplicarAccionMasiva(): void {
        if (!this.estadoBulkSeleccionado || this.seleccionadas().size === 0) return;
        const ids = Array.from(this.seleccionadas());
        this.accionMasiva.emit({ ids, estadoPostulacion: this.estadoBulkSeleccionado });
        this.limpiarSeleccion();
    }
}
