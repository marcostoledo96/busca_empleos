import { Component, ElementRef, inject, input, model, output, effect, signal, computed, OnDestroy } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { Oferta } from '../../modelos/oferta.model';
import { OfertasService } from '../../servicios/ofertas.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-detalle-oferta',
    imports: [DatePipe, UpperCasePipe, DialogModule, SelectModule, FormsModule],
    templateUrl: './detalle-oferta.html',
    styleUrl: './detalle-oferta.css'
})
export class DetalleOferta implements OnDestroy {

    private readonly ofertasService = inject(OfertasService);
    private readonly mensajes = inject(MessageService, { optional: true });
    readonly idsPostulacionPendiente = input<ReadonlySet<number>>(new Set());
    readonly accionMasivaEnCurso = input(false);
    private readonly guardandoIds = signal<ReadonlySet<number>>(new Set());

    postulacionBloqueada(): boolean {
        const id = this.oferta()?.id;
        return this.modoDemo() || this.accionMasivaEnCurso()
            || (id !== undefined && (this.guardandoIds().has(id) || this.idsPostulacionPendiente().has(id)));
    }
    private readonly evaluacionService = inject(EvaluacionService);

    // La oferta a mostrar. null = diálogo cerrado.
    readonly oferta = input<Oferta | null>(null);

    // model() es un signal bidireccional — el padre puede abrirlo/cerrarlo.
    readonly visible = model(false);

    // Cuando es true, el dropdown de postulación queda deshabilitado.
    readonly modoDemo = input(false);

    // Evento que emite cuando se actualiza la postulación.
    readonly postulacionActualizada = output<void>();

    // Evento que emite cuando inicia o termina un optimistic update de postulación.
    // pendiente = true cuando empieza, false cuando termina (éxito o error).
    readonly postulacionPendiente = output<{ id: number; pendiente: boolean }>();

    // Signals de estado para edición de descripción y reevaluación (Issue #17)
    readonly modoEdicionDescripcion = signal<boolean>(false);
    readonly nuevaDescripcion = signal<string>('');
    readonly guardandoDescripcion = signal<boolean>(false);
    readonly errorEdicionDescripcion = signal<string | null>(null);
    readonly reevaluandoOferta = signal<boolean>(false);
    readonly mensajeReevaluacion = signal<string | null>(null);
    readonly ofertaActualizada = output<Oferta>();

    readonly fechaPostulacion = signal('');
    readonly notaPostulacion = signal('');
    readonly errorSeguimiento = signal<string | null>(null);
    readonly mensajeSeguimiento = signal<string | null>(null);
    private readonly seguimientoGuardandoIds = signal<ReadonlySet<number>>(new Set());
    readonly guardandoSeguimiento = computed(() => this.seguimientoGuardandoIds().has(this.oferta()?.id ?? -1));
    readonly seguimientoPendiente = output<{ id: number; pendiente: boolean }>();
    private idBorrador: number | null = null;
    private revisionBorrador = 0;
    private sesionBorrador = 0;

    editarSeguimiento(campo: 'fecha' | 'nota', valor: string): void {
        if (this.modoDemo()) return;
        if (campo === 'fecha') this.fechaPostulacion.set(valor);
        else this.notaPostulacion.set(valor);
        this.revisionBorrador++;
        this.mensajeSeguimiento.set(null);
        this.errorSeguimiento.set(null);
    }

    guardarSeguimiento(): void {
        const oferta = this.oferta();
        if (!oferta || this.modoDemo() || this.guardandoSeguimiento()) return;
        if (this.notaPostulacion().length > 4000) {
            this.errorSeguimiento.set('La nota debe tener hasta 4000 caracteres.');
            return;
        }
        const revision = this.revisionBorrador;
        const sesion = this.sesionBorrador;
        const cambios = {
            fecha_postulacion: this.fechaPostulacion() || null,
            nota_postulacion: this.notaPostulacion() || null,
        };
        this.seguimientoGuardandoIds.update(ids => new Set([...ids, oferta.id]));
        this.errorSeguimiento.set(null);
        this.mensajeSeguimiento.set(null);
        this.seguimientoPendiente.emit({ id: oferta.id, pendiente: true });
        const mismaSesion = () => this.oferta()?.id === oferta.id && this.sesionBorrador === sesion;
        const vigente = () => mismaSesion() && this.revisionBorrador === revision;
        const finalizar = () => {
            this.seguimientoGuardandoIds.update(ids => new Set([...ids].filter(id => id !== oferta.id)));
            this.seguimientoPendiente.emit({ id: oferta.id, pendiente: false });
        };
        const fallar = () => {
            if (mismaSesion()) this.errorSeguimiento.set('No pude guardar el seguimiento. Conservé el borrador; intentá nuevamente.');
            finalizar();
        };
        this.ofertasService.actualizarSeguimiento(oferta.id, cambios).subscribe({
            next: respuesta => {
                if (!respuesta.exito || !respuesta.datos) {
                    fallar();
                    return;
                }
                // Tomo sólo los campos de esta operación: el estado puede haber cambiado en paralelo.
                oferta.fecha_postulacion = respuesta.datos.fecha_postulacion ?? null;
                oferta.nota_postulacion = respuesta.datos.nota_postulacion ?? null;
                this.ofertaActualizada.emit(oferta);
                if (vigente()) {
                    this.fechaPostulacion.set(oferta.fecha_postulacion ?? '');
                    this.notaPostulacion.set(oferta.nota_postulacion ?? '');
                    this.mensajeSeguimiento.set('Seguimiento guardado.');
                }
                finalizar();
            },
            error: fallar,
        });
    }

    readonly opcionesPostulacion = [
        { label: 'No postulado', value: 'no_postulado' },
        { label: 'CV enviado', value: 'cv_enviado' },
        { label: 'En proceso', value: 'en_proceso' },
        { label: 'Descartada', value: 'descartada' },
    ];

    // Guarda el elemento que tenía foco antes de abrir el modal.
    private elementoFocoPrevio: HTMLElement | null = null;

    // ID del timeout de foco programático, para limpiar si el componente se destruye.
    private idTimeoutFoco: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly elemento: ElementRef) {
        effect(() => {
            const oferta = this.oferta();
            if ((oferta?.id ?? null) === this.idBorrador) return;
            this.idBorrador = oferta?.id ?? null;
            this.sesionBorrador++;
            this.revisionBorrador++;
            this.fechaPostulacion.set(oferta?.fecha_postulacion ?? '');
            this.notaPostulacion.set(oferta?.nota_postulacion ?? '');
            this.errorSeguimiento.set(null);
            this.mensajeSeguimiento.set(null);
        });
        // Effect: cuando el modal se abre, mover foco al contenido;
        // cuando se cierra, restaurar foco al elemento que lo abrió.
        effect(() => {
            const abierto = this.visible();
            if (abierto) {
                // Guardar foco previo antes de mover.
                this.elementoFocoPrevio = document.activeElement as HTMLElement;
                // Limpiar timeout anterior antes de crear uno nuevo (por si el modal
                // se abre y cierra rápidamente).
                this.limpiarTimeoutFoco();
                // Timeout para que PrimeNG renderice el dialog.
                this.idTimeoutFoco = setTimeout(() => this.moverFocoAlModal(), 100);
            } else {
                this.limpiarTimeoutFoco();
                this.restaurarFoco();
                this.cancelarEdicionDescripcion();
                this.mensajeReevaluacion.set(null);
            }
        });
    }

    ngOnDestroy(): void {
        this.limpiarTimeoutFoco();
    }

    private limpiarTimeoutFoco(): void {
        if (this.idTimeoutFoco !== null) {
            clearTimeout(this.idTimeoutFoco);
            this.idTimeoutFoco = null;
        }
    }

    // Mueve el foco al primer elemento interactivo dentro del modal.
    private moverFocoAlModal(): void {
        // Si ya hay un elemento enfocado dentro del modal (ej. el dropdown de
        // p-select está abierto), no robar el foco. Esto evita que overlays
        // internos se cierren por un cambio de foco programático.
        const activo = document.activeElement;
        if (activo && this.elemento.nativeElement.contains(activo)) {
            return;
        }

        const dialogContent = this.elemento.nativeElement.querySelector('.p-dialog-content') as HTMLElement
            ?? this.elemento.nativeElement.querySelector('.dialogo-cabecera') as HTMLElement;
        if (dialogContent) {
            const primerInteractivo = dialogContent.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement | null;
            if (primerInteractivo) {
                primerInteractivo.focus();
            } else {
                dialogContent.focus();
            }
        }
    }

    // Restaura el foco al elemento que abrió el modal.
    private restaurarFoco(): void {
        if (this.elementoFocoPrevio) {
            this.elementoFocoPrevio.focus();
            this.elementoFocoPrevio = null;
        }
    }

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

    esFechaAproximada(oferta: Oferta | null): boolean {
        if (!oferta) return false;
        return !!(oferta.fecha_publicacion_aproximada || oferta.datos_crudos?.['fechaAproximada'] || oferta.datos_crudos?.['fechaTexto']);
    }

    tieneUltimaDeteccion(oferta: Oferta | null): boolean {
        if (!oferta?.fecha_ultima_extraccion) return false;
        if (!oferta.fecha_extraccion) return true;
        const tUltima = new Date(oferta.fecha_ultima_extraccion).getTime();
        const tPrimera = new Date(oferta.fecha_extraccion).getTime();
        if (Number.isFinite(tUltima) && Number.isFinite(tPrimera)) {
            return tUltima !== tPrimera;
        }
        return oferta.fecha_ultima_extraccion !== oferta.fecha_extraccion;
    }

    abrirEnPagina(): void {
        const url = this.oferta()?.url;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    cambiarPostulacion(nuevoEstado: string): void {
        const o = this.oferta();
        if (!o || this.postulacionBloqueada() || !this.opcionesPostulacion.some(opcion => opcion.value === nuevoEstado)) return;
        this.guardandoIds.update(ids => new Set([...ids, o.id]));
        const finalizar = () => {
            this.guardandoIds.update(ids => new Set([...ids].filter(id => id !== o.id)));
            this.postulacionPendiente.emit({ id: o.id, pendiente: false });
        };
        const notificarError = () => this.mensajes?.add({
            severity: 'error', summary: 'Postulación no guardada',
            detail: 'El cambio de postulación no se guardó. Intentá nuevamente.',
        });

        const estadoAnterior = o.estado_postulacion;
        const estado = nuevoEstado as Oferta['estado_postulacion'];

        // 1. Optimistic update — se refleja en la UI al instante.
        o.estado_postulacion = estado;
        this.postulacionActualizada.emit();
        this.postulacionPendiente.emit({ id: o.id, pendiente: true });
        this.visible.set(false);

        // 2. Persistir en el backend.
        this.ofertasService.actualizarPostulacion(o.id, nuevoEstado).subscribe({
            next: (respuesta) => {
                if (respuesta.exito) {
                    // Confirmar con los datos reales del backend.
                    o.estado_postulacion = respuesta.datos.estado_postulacion;
                    this.postulacionActualizada.emit();
                    const etiqueta = this.opcionesPostulacion.find(opcion => opcion.value === o.estado_postulacion)?.label;
                    this.mensajes?.add({ severity: 'success', summary: 'Postulación guardada',
                        detail: `Postulación actualizada: ${etiqueta}` });
                } else {
                    // Revertir si el backend respondió con error lógico.
                    o.estado_postulacion = estadoAnterior;
                    this.postulacionActualizada.emit();
                    notificarError();
                }
                finalizar();
            },
            error: () => {
                // Revertir si falló la red o el servidor.
                o.estado_postulacion = estadoAnterior;
                this.postulacionActualizada.emit();
                notificarError();
                finalizar();
            }
        });
    }

    // Evalúa de forma robusta si la oferta cuenta con desglose estructurado disponible.
    tieneDesglose(oferta: Oferta | null): boolean {
        if (!oferta?.explicacion_evaluacion) return false;
        const exp = oferta.explicacion_evaluacion;
        if (exp.desglose_disponible === true) return true;
        return (
            (Array.isArray(exp.cumplidos) && exp.cumplidos.length > 0) ||
            (Array.isArray(exp.no_cumplidos) && exp.no_cumplidos.length > 0) ||
            (Array.isArray(exp.exclusiones) && exp.exclusiones.length > 0) ||
            (Array.isArray(exp.por_confirmar) && exp.por_confirmar.length > 0)
        );
    }

    // Inicia el modo de edición de la descripción copiando el texto actual.
    iniciarEdicionDescripcion(): void {
        if (this.modoDemo()) return;
        const o = this.oferta();
        this.nuevaDescripcion.set(o?.descripcion ?? '');
        this.errorEdicionDescripcion.set(null);
        this.modoEdicionDescripcion.set(true);
    }

    // Cancela la edición y resetea el error sin modificar la oferta.
    cancelarEdicionDescripcion(): void {
        this.modoEdicionDescripcion.set(false);
        this.errorEdicionDescripcion.set(null);
    }

    // Valida y guarda la nueva descripción en el backend.
    guardarDescripcion(): void {
        if (this.modoDemo()) return;
        const o = this.oferta();
        if (!o) return;

        const texto = this.nuevaDescripcion().trim();
        if (texto.length < 20 || texto.length > 50000) {
            this.errorEdicionDescripcion.set('La descripción debe tener entre 20 y 50000 caracteres');
            return;
        }

        this.guardandoDescripcion.set(true);
        this.errorEdicionDescripcion.set(null);

        this.ofertasService.actualizarDescripcion(o.id, this.nuevaDescripcion()).subscribe({
            next: (respuesta) => {
                this.guardandoDescripcion.set(false);
                if (respuesta.exito && respuesta.datos) {
                    // Actualizar la oferta local con los datos actualizados.
                    const { estado_postulacion, fecha_postulacion, nota_postulacion, ...descripcionActualizada } = respuesta.datos;
                    Object.assign(o, descripcionActualizada);
                    this.ofertaActualizada.emit(o);
                    this.modoEdicionDescripcion.set(false);
                } else {
                    this.errorEdicionDescripcion.set(respuesta.error || 'Error al guardar la descripción');
                }
            },
            error: (error) => {
                this.guardandoDescripcion.set(false);
                const mensaje = error?.error?.error || error?.message || 'Error al guardar la descripción';
                this.errorEdicionDescripcion.set(mensaje);
                console.error('Error al guardar descripción:', error);
            }
        });
    }

    // Solicita reevaluación de la oferta con los criterios vigentes.
    solicitarReevaluacion(): void {
        if (this.modoDemo()) return;
        const o = this.oferta();
        if (!o) return;

        this.reevaluandoOferta.set(true);
        this.mensajeReevaluacion.set(null);

        this.evaluacionService.ejecutarEvaluacion([o.id]).subscribe({
            next: () => {
                this.reevaluandoOferta.set(false);
                this.mensajeReevaluacion.set('Reevaluación solicitada correctamente');
                o.estado_evaluacion = 'pendiente';
                this.ofertaActualizada.emit(o);
            },
            error: (error) => {
                this.reevaluandoOferta.set(false);
                this.mensajeReevaluacion.set('Error al solicitar la reevaluación');
                console.error('Error al solicitar reevaluación:', error);
            }
        });
    }
}
