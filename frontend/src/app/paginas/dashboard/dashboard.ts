import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { TablaOfertas } from '../../componentes/tabla-ofertas/tabla-ofertas';
import { DetalleOferta } from '../../componentes/detalle-oferta/detalle-oferta';
import { OfertasService } from '../../servicios/ofertas.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { Oferta } from '../../modelos/oferta.model';
import { DemoService } from '../../servicios/demo.service';
import { obtenerOpcionesFiltroPlataforma } from '../../config/plataformas';
import { EstadoOperativoSincronizacion } from '../../modelos/respuesta-api.model';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-dashboard',
    imports: [
        PanelControl,
        TablaOfertas,
        DetalleOferta,
        TabsModule,
        SelectModule,
        FormsModule,
        ToastModule,
    ],
    providers: [MessageService],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {

    private readonly ofertasService = inject(OfertasService);
    private readonly mensajes = inject(MessageService);
    readonly pestanaActiva = signal<string | number>(0);
    readonly accionMasivaEnCurso = signal(false);
    readonly accionMasivaConfirmada = signal(0);
    readonly conciliacionMasiva = signal<{ idsReintentables: number[] } | null>(null);
    readonly alcanceSeleccion = computed(() => `${this.modoReevaluacion() ? 'reevaluacion' : this.pestanaActiva()}:${this.filtroPlataforma() ?? 'todas'}`);
    private readonly ruta = inject(ActivatedRoute, { optional: true });
    readonly modoReevaluacion = signal(false);
    readonly ofertasReevaluables = computed(() => this.ordenarOfertas(this.ofertasFiltradas().filter(oferta => {
        const fecha = new Date(oferta.fecha_extraccion).getTime();
        return Number.isFinite(fecha) && fecha >= Date.now() - 30 * 86400000;
    })));

    seleccionarParaReevaluar(): void {
        if (this.modoDemo()) return;
        this.filtroPlataforma.set(null);
        this.modoReevaluacion.set(true);
        // Leo vigencia autoritativa; no la deduzco del formulario ni del caché local.
        this.cargarDatos();
    }
    private readonly persistenciaDashboard = inject(PersistenciaDashboardService);
    private readonly preferenciasService = inject(PreferenciasService);
    private readonly demoService = inject(DemoService);

    // Expone el estado del modo demo al template para pasarlo a los hijos.
    readonly modoDemo = this.demoService.esModoDemo;

    // Estado reactivo de la página.
    readonly ofertas = signal<Oferta[]>([]);
    readonly cargando = signal(false);
    readonly ofertaSeleccionada = signal<Oferta | null>(null);
    readonly dialogoVisible = signal(false);
    readonly mensajeEstado = signal<string | null>(null);
    readonly datosDesdeCache = signal(false);
    readonly sincronizando = signal(false);
    readonly progresoSincronizacion = signal(0);
    readonly fallbackSincronizacion = signal(false);
    readonly sincronizacionRecuperada = signal(false);
    readonly causaErrorSincronizacion = signal<string | null>(null);
    readonly estadoOperativoSincronizacion = signal<EstadoOperativoSincronizacion | null>(null);
    readonly priorizarOfertasIa = signal(false);
    private readonly bonusMaximoPrioridadIa = signal(0);
    private cursorSincronizacion: string | null = null;
    private cancelarSincronizacionSolicitada = false;
    private cancelacionSincronizacion: Subject<void> | null = null;
    private readonly idsSincronizacion = new Set<number>();

    // Guarda para evitar requests superpuestos durante el refresh de polling.
    private refrescandoEnSegundoPlano = false;
    private recargaPendiente = false;
    private destruido = false;
    private readonly destruccion = new Subject<void>();
    private readonly versionesPostulacion = new Map<number, number>();

    ngOnDestroy(): void {
        this.destruido = true;
        this.recargaPendiente = false;
        this.cancelacionSincronizacion?.next();
        this.destruccion.next();
        this.destruccion.complete();
    }

    private continuarRecargaPendiente(): void {
        if (!this.recargaPendiente || this.destruido) return;
        this.recargaPendiente = false;
        this.cursorSincronizacion = null;
        this.cargarDatos();
    }

    // Capturo versiones antes del GET: también protejo cambios que se confirman
    // durante la lectura, aunque ya no estén pendientes al recibir la respuesta.
    private capturarPostulaciones(): Map<number, number> {
        const versiones = new Map(this.versionesPostulacion);
        for (const id of [...this.postulacionesPendientes(), ...this.seguimientosPendientes]) versiones.set(id, -1);
        return versiones;
    }

    private aplicarOfertas(ofertasApi: Oferta[], versiones: Map<number, number>, conservarAusentes = false): void {
        const actuales = new Map(this.ofertas().map(oferta => [oferta.id, oferta]));
        const combinadas = ofertasApi.map(api => {
            const local = actuales.get(api.id);
            if (!local) return api;
            Object.assign(local, this.protegerCamposManuales(api, local, versiones));
            return local;
        });
        if (conservarAusentes) {
            const recibidas = new Set(ofertasApi.map(oferta => oferta.id));
            combinadas.push(...this.ofertas().filter(oferta => !recibidas.has(oferta.id)));
        }
        this.ofertas.set(this.ordenarOfertas(combinadas));
    }

    private protegerCamposManuales(api: Oferta, local: Oferta | undefined, versiones: Map<number, number>): Oferta {
        const proteger = this.postulacionesPendientes().has(api.id) || this.seguimientosPendientes.has(api.id)
            || (versiones.get(api.id) ?? 0) !== (this.versionesPostulacion.get(api.id) ?? 0);
        if (!local || !proteger) return api;
        return {
            ...api,
            estado_postulacion: local.estado_postulacion,
            fecha_postulacion: local.fecha_postulacion,
            nota_postulacion: local.nota_postulacion,
        };
    }

    // Trackea IDs con optimistic update de postulación en curso.
    // Solo estos IDs preservan su estado local durante el merge del polling.
    readonly postulacionesPendientes = signal<Set<number>>(new Set());
    private readonly seguimientosPendientes = new Set<number>();

    onSeguimientoPendiente(evento: { id: number; pendiente: boolean }): void {
        this.versionesPostulacion.set(evento.id, (this.versionesPostulacion.get(evento.id) ?? 0) + 1);
        if (evento.pendiente) this.seguimientosPendientes.add(evento.id);
        else this.seguimientosPendientes.delete(evento.id);
    }

    // Filtro global de plataforma.
    readonly filtroPlataforma = signal<string | null>(null);

    // Opciones del dropdown de plataforma.
    // Sale del registry: incluye todas las plataformas (activas e inactivas)
    // para permitir filtrar ofertas históricas. Usa el id interno como valor.
    readonly opcionesPlataforma = obtenerOpcionesFiltroPlataforma();

    // Computed: aplica el filtro de plataforma al array completo base.
    private readonly ofertasFiltradas = computed(() => {
        const plataforma = this.filtroPlataforma();
        const todas = this.ofertas();
        if (!plataforma) return todas;
        return todas.filter(o => o.plataforma === plataforma);
    });

    // Tab 1: aprobadas por la IA y todavía no postuladas.
    readonly ofertasAprobadas = computed(() =>
        this.ordenarOfertas(this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'aprobada' &&
                o.estado_postulacion === 'no_postulado'
            ))
    );

    // Tab 2: las que ya mandé CV o están en proceso.
    readonly ofertasPostuladas = computed(() =>
        this.ordenarOfertas(this.ofertasFiltradas()
            .filter(o =>
                o.estado_postulacion === 'cv_enviado' ||
                o.estado_postulacion === 'en_proceso'
            ))
    );

    // Separo el rechazo de IA del descarte personal, sin duplicar postuladas.
    readonly ofertasRechazadas = computed(() =>
        this.ordenarOfertas(this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'rechazada' &&
                o.estado_postulacion === 'no_postulado'
            ))
    );

    readonly ofertasDescartadas = computed(() =>
        this.ordenarOfertas(this.ofertasFiltradas().filter(o => o.estado_postulacion === 'descartada'))
    );

    // Tab 4: pendientes de evaluación (no postuladas ni descartadas).
    readonly ofertasPendientes = computed(() =>
        this.ordenarOfertas(this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'pendiente' &&
                o.estado_postulacion !== 'cv_enviado' &&
                o.estado_postulacion !== 'en_proceso' &&
                o.estado_postulacion !== 'descartada'
            ))
    );

    // Cards superiores: derivadas de los mismos computed que las tabs,
    // garantizando consistencia total entre lo que muestra el resumen y las tabs.
    readonly statTotal = computed(() => this.ofertasFiltradas().length);
    readonly statPendientes = computed(() => this.ofertasPendientes().length);
    readonly statAprobadas = computed(() => this.ofertasAprobadas().length);
    readonly statPostuladas = computed(() => this.ofertasPostuladas().length);
    readonly statRechazadas = computed(() => this.ofertasRechazadas().length);
    readonly statDescartadas = computed(() => this.ofertasDescartadas().length);

    ngOnInit(): void {
        this.modoReevaluacion.set(this.ruta?.snapshot.queryParamMap.get('reevaluar') === '1');
        // En modo demo no hacemos ninguna petición al backend.
        if (this.demoService.esModoDemo()) {
            this.ofertas.set(this.demoService.obtenerOfertasDemo());
            return;
        }
        this.restaurarUltimaCargaGuardada();
        this.cargarPreferenciaPrioridadIa();
        this.cargarDatos();
    }

    // Carga ofertas del backend. Las estadísticas se derivan de las ofertas
    // en computed signals, así que no necesita llamar a /estadisticas.
    cargarDatos(): void {
        if (this.modoDemo() || this.destruido) return;
        if (this.sincronizando() || this.refrescandoEnSegundoPlano) {
            this.recargaPendiente = true;
            return;
        }
        void this.sincronizarOfertas();
    }

    cancelarSincronizacion(): void {
        if (this.estadoOperativoSincronizacion()?.estado === 'completada') return;
        this.cancelarSincronizacionSolicitada = true;
        this.cancelacionSincronizacion?.next();
    }

    private async sincronizarOfertas(): Promise<void> {
        this.sincronizando.set(true);
        this.sincronizacionRecuperada.set(false);
        if (this.causaErrorSincronizacion()) this.mensajeEstado.set(null);
        this.causaErrorSincronizacion.set(null);
        const versiones = this.capturarPostulaciones();
        const ofertasAnteriores = this.ofertas().map(oferta => ({ ...oferta }));
        this.cancelarSincronizacionSolicitada = false;
        const cancelacion = new Subject<void>();
        this.cancelacionSincronizacion = cancelacion;
        try {
            if (!this.cursorSincronizacion) {
                await this.persistenciaDashboard.limpiarSincronizacion();
                if (this.destruido) return;
                this.idsSincronizacion.clear();
                this.estadoOperativoSincronizacion.set({
                    estado: 'en_progreso',
                    fecha_corte: '',
                    max_id: 0,
                    total_inicial: 0,
                    recibidos: 0,
                    duplicados: 0,
                });
                this.progresoSincronizacion.set(0);
                this.fallbackSincronizacion.set(false);
            }

            do {
                if (this.cancelarSincronizacionSolicitada) {
                    this.estadoOperativoSincronizacion.update(estado => estado && estado.estado !== 'completada'
                        ? { ...estado, estado: 'cancelada' }
                        : estado);
                    this.mensajeEstado.set('Sincronización cancelada. Podés reanudarla sin duplicar los bloques ya confirmados.');
                    return;
                }
                const respuesta = await firstValueFrom(
                    this.ofertasService.obtenerBloqueSincronizacion(500, this.cursorSincronizacion)
                        .pipe(takeUntil(cancelacion))
                );
                if (!respuesta.exito) throw new Error(respuesta.error || 'No se pudo sincronizar.');
                const duplicados = (this.estadoOperativoSincronizacion()?.duplicados ?? 0)
                    + respuesta.datos.filter(oferta => this.idsSincronizacion.has(oferta.id)).length;
                respuesta.datos.forEach(oferta => this.idsSincronizacion.add(oferta.id));
                if (this.destruido) return;
                // Protejo también el bloque persistido, no sólo la vista posterior.
                const actuales = new Map(this.ofertas().map(oferta => [oferta.id, oferta]));
                const bloque = respuesta.datos.map(api => this.protegerCamposManuales(api, actuales.get(api.id), versiones));
                const persistencia = await this.persistenciaDashboard.guardarBloqueSincronizacion(bloque);
                if (this.destruido) return;
                this.fallbackSincronizacion.set(persistencia.fallback);
                const ofertasSincronizadas = await this.persistenciaDashboard.obtenerOfertasSincronizadas();
                if (this.destruido) return;
                this.aplicarOfertas(ofertasSincronizadas, versiones, !respuesta.completada);
                this.cursorSincronizacion = respuesta.cursor_siguiente;
                this.estadoOperativoSincronizacion.set({
                    estado: 'en_progreso',
                    fecha_corte: respuesta.fecha_corte,
                    max_id: respuesta.max_id,
                    total_inicial: respuesta.total_inicial,
                    recibidos: this.idsSincronizacion.size,
                    duplicados,
                });
                this.progresoSincronizacion.set(respuesta.total_inicial
                    ? Math.round((this.idsSincronizacion.size / respuesta.total_inicial) * 100)
                    : 100);
                if (respuesta.completada) {
                    if (this.idsSincronizacion.size !== respuesta.total_inicial) {
                        throw new Error('La sincronización no coincide con el total declarado.');
                    }
                    this.cursorSincronizacion = null;
                    this.estadoOperativoSincronizacion.update(estado => estado && { ...estado, estado: 'completada' });
                    this.guardarCacheActual();
                    this.datosDesdeCache.set(false);
                    this.mensajeEstado.set(persistencia.fallback
                        ? 'Sincronización completada usando memoria temporal porque IndexedDB no estuvo disponible.'
                        : null);
                    return;
                }
            } while (this.cursorSincronizacion);
        } catch (error) {
            if (this.destruido) return;
            if (this.cancelarSincronizacionSolicitada) {
                this.estadoOperativoSincronizacion.update(estado => estado && estado.estado !== 'completada'
                    ? { ...estado, estado: 'cancelada' }
                    : estado);
                this.mensajeEstado.set('Sincronización cancelada. Podés reanudarla sin duplicar los bloques ya confirmados.');
                return;
            }
            console.error('Error al sincronizar dashboard:', error);
            const fallo = error as { error?: { error?: string }; message?: string };
            this.causaErrorSincronizacion.set(fallo?.error?.error || fallo?.message || 'No pude comunicarme con el servicio de sincronización.');
            this.estadoOperativoSincronizacion.update(estado => estado && { ...estado, estado: 'fallida' });
            this.aplicarOfertas(ofertasAnteriores, versiones);
            await this.cargarDatosLegacy(versiones);
        } finally {
            cancelacion.complete();
            if (this.cancelacionSincronizacion === cancelacion) {
                this.cancelacionSincronizacion = null;
            }
            this.sincronizando.set(false);
            this.continuarRecargaPendiente();
        }
    }

    private async cargarDatosLegacy(versiones: Map<number, number>): Promise<void> {
        this.cargando.set(true);

        try {
            const respuesta = await firstValueFrom(this.ofertasService.obtenerOfertas().pipe(takeUntil(this.destruccion)));
            if (this.destruido) return;
            if (!respuesta.exito) throw new Error(respuesta.error || 'No pude cargar las ofertas.');
            this.aplicarOfertas(respuesta.datos, versiones);
            this.guardarCacheActual();
            this.datosDesdeCache.set(false);
            this.sincronizacionRecuperada.set(true);
            this.mensajeEstado.set(`Ofertas actualizadas mediante vía alternativa; sincronización falló. ${this.causaErrorSincronizacion() || ''}`);
        } catch (error) {
            if (!this.destruido) {
                console.error('Error al cargar dashboard:', error);
                this.manejarFalloSincronizacion();
            }
        } finally {
            this.cargando.set(false);
        }
    }

    // Refresh liviano durante el polling de evaluación.
    // Solo recarga ofertas (sin spinner, sin tocar estado de carga principal).
    // Evita requests superpuestos con una guarda.
    // Hace merge con el estado local para no pisar optimistic updates en curso.
    onProgresoEvaluacion(): void {
        if (this.modoDemo() || this.destruido || this.sincronizando() || this.refrescandoEnSegundoPlano) return;
        this.refrescandoEnSegundoPlano = true;
        const versiones = this.capturarPostulaciones();

        this.ofertasService.obtenerOfertas().pipe(takeUntil(this.destruccion)).subscribe({
            next: (respuesta) => {
                if (respuesta.exito && !this.destruido) {
                    this.aplicarOfertas(respuesta.datos, versiones);
                    this.guardarCacheActual();
                }
            },
            error: () => {
                this.refrescandoEnSegundoPlano = false;
                this.continuarRecargaPendiente();
            },
            complete: () => {
                this.refrescandoEnSegundoPlano = false;
                this.continuarRecargaPendiente();
            },
        });
    }

    private ordenarOfertas(ofertas: Oferta[]): Oferta[] {
        return [...ofertas].sort((a, b) => {
            const bonusA = this.priorizarOfertasIa() ? Math.min(this.bonusMaximoPrioridadIa(), Number(a.puntaje_prioridad_ia) || 0) : 0;
            const bonusB = this.priorizarOfertasIa() ? Math.min(this.bonusMaximoPrioridadIa(), Number(b.puntaje_prioridad_ia) || 0) : 0;
            const puntajeA = (a.porcentaje_match ?? 0) + bonusA;
            const puntajeB = (b.porcentaje_match ?? 0) + bonusB;
            return puntajeB - puntajeA
                || (b.porcentaje_match ?? 0) - (a.porcentaje_match ?? 0)
                || new Date(b.fecha_extraccion).getTime() - new Date(a.fecha_extraccion).getTime()
                || b.id - a.id;
        });
    }

    private cargarPreferenciaPrioridadIa(): void {
        this.preferenciasService.obtenerPreferencias().pipe(takeUntil(this.destruccion)).subscribe({
            next: (respuesta) => {
                this.priorizarOfertasIa.set(Boolean(respuesta.exito && respuesta.datos.priorizar_ofertas_ia));
                this.bonusMaximoPrioridadIa.set(Math.min(6, Math.max(0, Number(respuesta.datos.bonus_maximo_prioridad_ia) || 0)));
            },
            error: () => {
                this.priorizarOfertasIa.set(false);
                this.bonusMaximoPrioridadIa.set(0);
                this.mensajeEstado.set('No pude leer la preferencia de prioridad IA; conservé el orden habitual.');
            },
        });
    }

    private guardarCacheActual(): void {
        this.persistenciaDashboard.guardarCache({
            ofertas: this.ofertas(),
            estadisticas: null,
            fechaGuardado: new Date().toISOString(),
            version: 1,
        });
    }

    // Cuando el usuario hace clic en el ojo de una oferta.
    mostrarDetalle(oferta: Oferta): void {
        this.ofertaSeleccionada.set(oferta);
        this.dialogoVisible.set(true);
    }

    // Cuando se actualiza una postulación desde un hijo, forzamos la
    // re-evaluación de los computed signals sin recargar todas las ofertas.
    // El objeto oferta ya fue mutado con optimistic update en el hijo,
    // así que solo necesitamos que Angular detecte el cambio.
    // Además invalidamos el cache local para que no muestre datos viejos
    // en caso de recarga.
    onAccionCompletada(): void {
        this.ofertas.update(arr => [...arr]);
        this.datosDesdeCache.set(false);

        // Actualizar cache con el estado actual para no perder cambios.
        this.persistenciaDashboard.guardarCache({
            ofertas: this.ofertas(),
            estadisticas: null,
            fechaGuardado: new Date().toISOString(),
            version: 1,
        });
    }

    // Trackea el inicio/fin de optimistic updates de postulación.
    // Solo los IDs marcados como pendientes preservan su estado local
    // durante el merge de datos del polling.
    onPostulacionPendiente(evento: { id: number; pendiente: boolean }): void {
        this.versionesPostulacion.set(evento.id, (this.versionesPostulacion.get(evento.id) ?? 0) + 1);
        this.postulacionesPendientes.update(setActual => {
            const nuevo = new Set(setActual);
            if (evento.pendiente) {
                nuevo.add(evento.id);
            } else {
                nuevo.delete(evento.id);
            }
            return nuevo;
        });
    }

    // Cuando la tabla dispara una acción masiva de postulación.
    onAccionMasiva(evento: { ids: number[]; estadoPostulacion: string }): void {
        if (this.modoDemo() || this.accionMasivaEnCurso() || this.postulacionesPendientes().size) return;
        const estados = ['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'];
        const categoria = this.modoReevaluacion() ? this.ofertasReevaluables()
            : [this.ofertasAprobadas(), this.ofertasPostuladas(), this.ofertasRechazadas(), this.ofertasPendientes(), this.ofertasDescartadas()][Number(this.pestanaActiva())] ?? [];
        const permitidas = new Set(categoria.map(o => o.id));
        const ids = [...new Set(evento.ids)];
        if (!estados.includes(evento.estadoPostulacion) || !ids.length
            || !ids.every(id => Number.isSafeInteger(id) && id > 0 && permitidas.has(id))) return;
        const estado = evento.estadoPostulacion as Oferta['estado_postulacion'];
        this.accionMasivaEnCurso.set(true);
        ids.forEach(id => this.onPostulacionPendiente({ id, pendiente: true }));
        const finalizar = () => {
            ids.forEach(id => this.onPostulacionPendiente({ id, pendiente: false }));
            this.accionMasivaEnCurso.set(false);
        };
        const fallar = () => {
            finalizar();
            this.mensajes.add({ severity: 'error', summary: 'Acción masiva no guardada',
                detail: 'El cambio masivo no se guardó. Conservé la selección válida para volver a intentar.' });
        };
        this.ofertasService.actualizarPostulacionMasiva(ids, estado).pipe(takeUntil(this.destruccion)).subscribe({
            next: (resp) => {
                const cantidad = resp.datos?.actualizadas;
                if (!resp.exito || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > ids.length) {
                    fallar();
                    return;
                }
                if (cantidad === ids.length) {
                    this.ofertas().filter(o => ids.includes(o.id)).forEach(o => o.estado_postulacion = estado);
                    this.onAccionCompletada();
                    this.accionMasivaConfirmada.update(valor => valor + 1);
                    this.mensajes.add({ severity: 'success', summary: 'Acción masiva guardada',
                        detail: `${cantidad} ofertas actualizadas.` });
                } else {
                    // El contador no identifica éxitos: mantengo guardas hasta una lectura fresca.
                    this.mensajes.add({ severity: 'warn', summary: 'Actualización parcial',
                        detail: `${cantidad} de ${ids.length} ofertas actualizadas. Voy a verificar los estados antes de habilitar el reintento.` });
                    this.conciliarAccionMasiva(ids, estado, finalizar);
                    return;
                }
                finalizar();
                this.cargarDatos();
            },
            error: fallar,
        });
    }

    private conciliarAccionMasiva(ids: number[], destino: Oferta['estado_postulacion'], finalizar: () => void): void {
        const fallar = () => {
            this.conciliacionMasiva.set({ idsReintentables: [] });
            finalizar();
            this.mensajes.add({ severity: 'warn', summary: 'Conciliación no confirmada',
                detail: 'No pude confirmar los estados. Limpié la selección para evitar un reintento inseguro. Seleccioná nuevamente las ofertas y el estado destino.' });
        };
        // No uso sincronización/caché: pueden corresponder a un snapshot anterior al PATCH.
        const versiones = this.capturarPostulaciones();
        this.ofertasService.obtenerOfertas().pipe(takeUntil(this.destruccion)).subscribe({
            next: respuesta => {
                const datos = respuesta?.datos;
                const estados = ['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'];
                if (!respuesta?.exito || !Array.isArray(datos)
                    || datos.some(o => !o || !Number.isSafeInteger(o.id) || o.id <= 0 || !estados.includes(o.estado_postulacion))
                    || new Set(datos.map(o => o.id)).size !== datos.length
                    || !ids.every(id => datos.some(o => o.id === id))) {
                    fallar();
                    return;
                }
                const actuales = new Map(this.ofertas().map(oferta => [oferta.id, oferta]));
                const conciliadas = datos.map(api => ({
                    ...this.protegerCamposManuales(api, actuales.get(api.id), versiones),
                    // Acepto el estado fresco del bulk, pero no una nota anterior al guardado paralelo.
                    estado_postulacion: api.estado_postulacion,
                }));
                // Avanzo versiones al cerrar las guardas; lecturas anteriores siguen sin poder pisarlas.
                finalizar();
                this.aplicarOfertas(conciliadas, this.capturarPostulaciones());
                this.conciliacionMasiva.set({ idsReintentables: datos
                    .filter(o => ids.includes(o.id) && o.estado_postulacion !== destino).map(o => o.id) });
                this.guardarCacheActual();
            },
            error: fallar,
        });
    }

    private restaurarUltimaCargaGuardada(): void {
        const cache = this.persistenciaDashboard.leerCache();

        if (!cache) {
            return;
        }

        this.ofertas.set(cache.ofertas);
        this.datosDesdeCache.set(true);
        this.mensajeEstado.set(
            `Recuperé la última carga guardada del ${this.formatearFecha(cache.fechaGuardado)} mientras sincronizo con el backend.`
        );
    }

    private manejarFalloSincronizacion(): void {
        this.datosDesdeCache.set(true);
        if (this.ofertas().length) {
            this.mensajeEstado.set('No pude actualizar las ofertas. Conservo los datos anteriores; no están confirmados como actualizados. Volvé a intentar.');
            return;
        }
        const cache = this.persistenciaDashboard.leerCache();

        if (cache) {
            this.ofertas.set(cache.ofertas);
            this.datosDesdeCache.set(true);
            this.mensajeEstado.set(
                `No pude sincronizar con el backend. Estoy mostrando la última carga guardada del ${this.formatearFecha(cache.fechaGuardado)}.`
            );
            return;
        }

        this.datosDesdeCache.set(false);
        this.mensajeEstado.set(
            'No pude cargar las ofertas guardadas. Verificá que el backend esté corriendo y conectado a PostgreSQL.'
        );
    }

    private formatearFecha(fechaIso: string): string {
        const fecha = new Date(fechaIso);

        if (Number.isNaN(fecha.getTime())) {
            return 'una fecha no válida';
        }

        return fecha.toLocaleString('es-AR');
    }
}
