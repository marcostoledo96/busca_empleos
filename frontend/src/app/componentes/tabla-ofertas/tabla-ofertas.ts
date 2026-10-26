import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DatePipe, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { FilterService, MessageService } from 'primeng/api';
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
    imports: [DatePipe, NgTemplateOutlet, UpperCasePipe, TableModule, SelectModule, FormsModule],
    templateUrl: './tabla-ofertas.html',
    styleUrl: './tabla-ofertas.css',
    host: { '(window:resize)': 'limpiarSeleccion()' }
})
export class TablaOfertas {

    private readonly ofertasService = inject(OfertasService);
    private readonly mensajes = inject(MessageService, { optional: true });
    private readonly filtros = inject(FilterService);
    readonly tabla = viewChild<Table>('tablaOfertas');
    readonly accionMasivaEnCurso = input(false);
    readonly accionMasivaConfirmada = input(0);
    readonly conciliacionMasiva = input<{ idsReintentables: number[] } | null>(null);
    readonly alcanceSeleccion = input('');
    readonly totalOfertas = input(0);
    readonly filtroPlataformaActivo = input(false);
    readonly idsPostulacionPendiente = input<ReadonlySet<number>>(new Set());
    readonly limpiarFiltros = output<void>();
    readonly guardandoIds = signal<ReadonlySet<number>>(new Set());
    readonly bulkEmitida = signal(false);
    readonly procesandoBulk = computed(() => this.accionMasivaEnCurso() || this.bulkEmitida());
    readonly hayPostulacionesPendientes = computed(() => this.guardandoIds().size > 0 || this.idsPostulacionPendiente().size > 0);

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

    private ultimoOrden: { field?: string; order?: number } | null = null;
    private ultimoFiltro = '';

    onFiltrado(evento: { filters?: unknown }): void {
        const filtro = JSON.stringify(evento.filters ?? {});
        // PrimeNG reemite al refrescar value; conservo sólo los IDs aún visibles.
        if (filtro !== this.ultimoFiltro) this.limpiarSeleccion();
        else this.revalidarSeleccion();
        this.ultimoFiltro = filtro;
    }

    onOrdenamiento(orden: { field?: string; order?: number }): void {
        // PrimeNG reemite el mismo orden al reemplazar value; sólo limpio
        // cuando cambia el criterio, no cuando llegan ofertas actualizadas.
        if (this.ultimoOrden && (orden.field !== this.ultimoOrden.field || orden.order !== this.ultimoOrden.order)) {
            this.limpiarSeleccion();
        }
        this.ultimoOrden = { field: orden.field, order: orden.order };
    }

    constructor() {
        // Conservo IDs estables al refrescar; excluyo los que ya no pertenecen
        // a esta vista y vuelvo a pedir confirmación con los datos actuales.
        effect(() => {
            const idsVisibles = new Set(this.ofertas().map(oferta => oferta.id));
            untracked(() => {
                this.seleccionadas.update(ids => new Set([...ids].filter(id => idsVisibles.has(id))));
                this.confirmandoReevaluacion.set(false);
                const pagina = Math.max(0, Math.min(this.paginaActualCards(), this.totalPaginasCards() - 1));
                if (pagina !== this.paginaActualCards()) this.limpiarSeleccion();
                this.paginaActualCards.set(pagina);
            });
        });
        effect(() => {
            const resultado = this.conciliacionMasiva();
            if (!resultado) return;
            untracked(() => {
                const permitidas = new Set(resultado.idsReintentables);
                this.seleccionadas.update(ids => new Set([...ids].filter(id => permitidas.has(id))));
                this.revalidarSeleccion();
                this.confirmandoReevaluacion.set(false);
            });
        });
        effect(() => {
            this.alcanceSeleccion();
            this.accionMasivaConfirmada();
            untracked(() => {
                this.limpiarSeleccion();
                this.bulkEmitida.set(false);
            });
        });
    }

    // Consulto la página efectiva de PrimeNG, no un segundo filtro de escritorio.
    ofertasVisiblesActuales(): Oferta[] {
        const actuales = new Set(this.ofertas().map(o => o.id));
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
            return this.ofertasPaginadasCards();
        }
        const tabla = this.tabla();
        const inicio = tabla?.first || 0;
        return (tabla?.filteredValue ?? tabla?.value ?? this.ofertas()).slice(inicio, inicio + (tabla?.rows || 20))
            .filter(o => actuales.has(o.id));
    }

    private revalidarSeleccion(): number[] {
        const visibles = new Set(this.ofertasVisiblesActuales().map(o => o.id));
        const ids = [...this.seleccionadas()].filter(id => visibles.has(id));
        this.seleccionadas.set(new Set(ids));
        return ids;
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
        if (!this.seleccionReevaluable()) return;
        this.revalidarSeleccion();
        if (this.modoDemo() || this.evaluacionOcupada() || this.procesandoBulk() || this.hayPostulacionesPendientes() || !this.seleccionReevaluable()) return;
        this.confirmandoReevaluacion.set(true);
    }

    confirmarReevaluacion(): void {
        if (!this.seleccionReevaluable()) return;
        const ids = this.revalidarSeleccion();
        if (!this.confirmandoReevaluacion() || this.modoDemo() || this.evaluacionOcupada() || this.procesandoBulk() || this.hayPostulacionesPendientes() || !this.seleccionReevaluable()) return;
        this.reevaluarSeleccionadas.emit(ids);
        this.limpiarSeleccion();
    }

    errorEvaluacionOferta(oferta: Oferta): string | null {
        const mensaje = oferta.evaluacion_error_mensaje;
        return mensaje && mensaje !== 'REEVALUACION_SOLICITADA' ? mensaje : null;
    }

    private resultadoConservado(oferta: Oferta): boolean {
        const fecha = (oferta as Oferta & { fecha_evaluacion?: string | null }).fecha_evaluacion;
        // Conservo también el contrato histórico de resultados fechados, sin presentarlos como nuevos.
        return !!oferta.firma_criterios_evaluacion || !!(fecha && oferta.razon_evaluacion !== oferta.evaluacion_error_mensaje);
    }

    compatibilidadVisible(oferta: Oferta): boolean {
        const porcentaje = oferta.porcentaje_match;
        return porcentaje !== null && Number.isFinite(porcentaje) && porcentaje >= 0 && porcentaje <= 100
            && oferta.estado_evaluacion !== 'pendiente'
            && oferta.evaluacion_error_mensaje !== 'REEVALUACION_SOLICITADA'
            && (!this.errorEvaluacionOferta(oferta) || this.resultadoConservado(oferta));
    }

    nivelCompatibilidad(oferta: Oferta): string {
        if (oferta.estado_evaluacion === 'rechazada') return 'bajo';
        if (oferta.vigencia_evaluacion !== 'actual' || this.errorEvaluacionOferta(oferta)) return 'anterior';
        return this.nivelMatch(oferta.porcentaje_match!);
    }

    etiquetaEvaluacion(oferta: Oferta): string {
        return this.errorEvaluacionOferta(oferta) && !this.compatibilidadVisible(oferta)
            ? 'Error técnico' : oferta.estado_evaluacion;
    }

    textoVigencia(oferta: Oferta): string {
        if (oferta.evaluacion_error_mensaje === 'REEVALUACION_SOLICITADA') return 'Desactualizada · reevaluación pendiente';
        if (this.errorEvaluacionOferta(oferta)) return this.compatibilidadVisible(oferta)
            ? 'Resultado anterior conservado' : 'Sin resultado válido nuevo';
        if (oferta.estado_evaluacion === 'pendiente') return 'Pendiente de evaluación';
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
    readonly ofertasFiltradasCards = computed<Oferta[]>(() =>
        this.filtros.filter(this.ofertas(), ['titulo', 'empresa', 'ubicacion'], this.filtroTextoCards(), 'contains')
    );

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
        this.tabla()?.filterGlobal(valor, 'contains');
    }

    readonly hayFiltrosActivos = computed(() => !!this.filtroTextoCards().trim() || this.filtroPlataformaActivo());
    readonly mensajeVacio = computed(() => this.hayFiltrosActivos()
        ? 'No hay ofertas que coincidan con los filtros actuales'
        : this.totalOfertas() > 0 || this.ofertas().length > 0
            ? 'Esta categoría no tiene ofertas disponibles'
            : 'No hay ofertas guardadas');

    restablecerFiltros(): void {
        this.filtroTextoCards.set('');
        this.paginaActualCards.set(0);
        this.limpiarSeleccion();
        this.tabla()?.filterGlobal('', 'contains');
        this.limpiarFiltros.emit();
    }

    postulacionBloqueada(id: number): boolean {
        return this.modoDemo() || this.procesandoBulk() || this.guardandoIds().has(id) || this.idsPostulacionPendiente().has(id);
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

    esFechaAproximada(oferta: Oferta): boolean {
        return !!(oferta.fecha_publicacion_aproximada || oferta.datos_crudos?.['fechaAproximada'] || oferta.datos_crudos?.['fechaTexto']);
    }

    tieneReaparicion(oferta: Oferta): boolean {
        if (!oferta.fecha_ultima_extraccion) return false;
        if (!oferta.fecha_extraccion) return true;
        const tUltima = new Date(oferta.fecha_ultima_extraccion).getTime();
        const tPrimera = new Date(oferta.fecha_extraccion).getTime();
        if (Number.isFinite(tUltima) && Number.isFinite(tPrimera)) {
            return tUltima !== tPrimera;
        }
        return oferta.fecha_ultima_extraccion !== oferta.fecha_extraccion;
    }

    verDetalle(oferta: Oferta): void {
        this.ofertaSeleccionada.emit(oferta);
    }

    // Permite activar una card con Enter o Espacio desde el teclado.
    activarCardConTeclado(evento: KeyboardEvent, oferta: Oferta): void {
        if (evento.repeat || evento.defaultPrevented || evento.target !== evento.currentTarget) return;
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            this.verDetalle(oferta);
        }
    }

    // Cambia el estado de postulación con optimistic update.
    // El cambio se ve instantáneo; si el backend falla, se revierte solo.
    cambiarPostulacion(oferta: Oferta, nuevoEstado: string): void {
        if (this.postulacionBloqueada(oferta.id) || !this.opcionesPostulacion.some(o => o.value === nuevoEstado)) return;
        this.guardandoIds.update(ids => new Set([...ids, oferta.id]));

        const finalizar = () => {
            this.guardandoIds.update(ids => new Set([...ids].filter(id => id !== oferta.id)));
            this.postulacionPendiente.emit({ id: oferta.id, pendiente: false });
        };
        const notificarError = () => this.mensajes?.add({
            severity: 'error', summary: 'Postulación no guardada',
            detail: 'El cambio de postulación no se guardó. Intentá nuevamente.',
        });
        const estadoAnterior = oferta.estado_postulacion;
        const estado = nuevoEstado as Oferta['estado_postulacion'];

        // 1. Optimistic update — se refleja en la UI al instante.
        oferta.estado_postulacion = estado;
        this.postulacionActualizada.emit();
        this.postulacionPendiente.emit({ id: oferta.id, pendiente: true });

        // 2. Persistir en el backend.
        this.ofertasService.actualizarPostulacion(oferta.id, nuevoEstado).subscribe({
            next: (respuesta) => {
                if (respuesta.exito) {
                    // Confirmar con los datos reales del backend.
                    oferta.estado_postulacion = respuesta.datos.estado_postulacion;
                    this.postulacionActualizada.emit();
                    this.mensajes?.add({ severity: 'success', summary: 'Postulación guardada',
                        detail: `Postulación actualizada: ${this.textoPostulacion(oferta.estado_postulacion)}` });
                } else {
                    // Revertir si el backend respondió pero con error lógico.
                    oferta.estado_postulacion = estadoAnterior;
                    this.postulacionActualizada.emit();
                    notificarError();
                }
                finalizar();
            },
            error: () => {
                // Revertir si falló la red o el servidor.
                oferta.estado_postulacion = estadoAnterior;
                this.postulacionActualizada.emit();
                notificarError();
                finalizar();
            }
        });
    }

    // Alterna la selección de una oferta individual.
    toggleSeleccion(id: number): void {
        if (this.modoDemo() || this.evaluacionOcupada() || this.procesandoBulk()) return;
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
        if (this.modoDemo() || this.evaluacionOcupada() || this.procesandoBulk()) return;
        this.confirmandoReevaluacion.set(false);
        const ids = new Set(this.seleccionadas());
        const desmarcar = visibles.every(o => ids.has(o.id));
        for (const oferta of visibles) {
            if (desmarcar) ids.delete(oferta.id);
            else ids.add(oferta.id);
        }
        this.seleccionadas.set(ids);
    }

    // Limpia la selección actual.
    limpiarSeleccion(): void {
        this.seleccionadas.set(new Set());
        this.estadoBulkSeleccionado = null;
        this.confirmandoReevaluacion.set(false);
    }

    // Aplica la acción masiva y emite el evento al padre para confirmación.
    aplicarAccionMasiva(): void {
        if (this.modoDemo() || this.evaluacionOcupada() || this.procesandoBulk() || this.hayPostulacionesPendientes() ||
            !this.opcionesAccionMasiva.some(o => o.value === this.estadoBulkSeleccionado)) return;
        const ids = this.revalidarSeleccion();
        if (ids.length === 0) return;
        this.bulkEmitida.set(true);
        // Cubro el mismo turno hasta que el padre propague su bloqueo, sin trabar un rechazo previo al HTTP.
        queueMicrotask(() => this.bulkEmitida.set(false));
        this.accionMasiva.emit({ ids, estadoPostulacion: this.estadoBulkSeleccionado! });
    }
}
