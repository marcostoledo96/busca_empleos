import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
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
    ],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

    private readonly ofertasService = inject(OfertasService);
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
    readonly estadoOperativoSincronizacion = signal<EstadoOperativoSincronizacion | null>(null);
    readonly priorizarOfertasIa = signal(false);
    private readonly bonusMaximoPrioridadIa = signal(0);
    private cursorSincronizacion: string | null = null;
    private cancelarSincronizacionSolicitada = false;
    private cancelacionSincronizacion: Subject<void> | null = null;
    private readonly idsSincronizacion = new Set<number>();

    // Guarda para evitar requests superpuestos durante el refresh de polling.
    private refrescandoEnSegundoPlano = false;

    // Trackea IDs con optimistic update de postulación en curso.
    // Solo estos IDs preservan su estado local durante el merge del polling.
    readonly postulacionesPendientes = signal<Set<number>>(new Set());

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

    // Tab 3: rechazadas por la IA o descartadas manualmente.
    readonly ofertasRechazadas = computed(() =>
        this.ordenarOfertas(this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'rechazada' ||
                o.estado_postulacion === 'descartada'
            ))
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

    ngOnInit(): void {
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
        void this.sincronizarOfertas();
    }

    cancelarSincronizacion(): void {
        if (this.estadoOperativoSincronizacion()?.estado === 'completada') return;
        this.cancelarSincronizacionSolicitada = true;
        this.cancelacionSincronizacion?.next();
    }

    private async sincronizarOfertas(): Promise<void> {
        this.sincronizando.set(true);
        this.cancelarSincronizacionSolicitada = false;
        const cancelacion = new Subject<void>();
        this.cancelacionSincronizacion = cancelacion;
        if (!this.cursorSincronizacion) {
            await this.persistenciaDashboard.limpiarSincronizacion();
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

        try {
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
                const persistencia = await this.persistenciaDashboard.guardarBloqueSincronizacion(respuesta.datos);
                this.fallbackSincronizacion.set(persistencia.fallback);
                const ofertasSincronizadas = await this.persistenciaDashboard.obtenerOfertasSincronizadas();
                this.ofertas.set(this.ordenarOfertas(ofertasSincronizadas));
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
            if (this.cancelarSincronizacionSolicitada) {
                this.estadoOperativoSincronizacion.update(estado => estado && estado.estado !== 'completada'
                    ? { ...estado, estado: 'cancelada' }
                    : estado);
                this.mensajeEstado.set('Sincronización cancelada. Podés reanudarla sin duplicar los bloques ya confirmados.');
                return;
            }
            console.error('Error al sincronizar dashboard:', error);
            this.estadoOperativoSincronizacion.update(estado => estado && { ...estado, estado: 'fallida' });
            this.cargarDatosLegacy();
        } finally {
            cancelacion.complete();
            if (this.cancelacionSincronizacion === cancelacion) {
                this.cancelacionSincronizacion = null;
            }
            this.sincronizando.set(false);
        }
    }

    private cargarDatosLegacy(): void {
        this.cargando.set(true);

        this.ofertasService.obtenerOfertas().subscribe({
            next: (respuesta) => {
                this.cargando.set(false);

                if (!respuesta.exito) {
                    this.manejarFalloSincronizacion();
                    return;
                }

                this.ofertas.set(respuesta.datos);
                this.guardarCacheActual();
                this.datosDesdeCache.set(false);
                this.mensajeEstado.set(null);
            },
            error: (error) => {
                this.cargando.set(false);
                console.error('Error al cargar dashboard:', error);
                this.manejarFalloSincronizacion();
            }
        });
    }

    // Refresh liviano durante el polling de evaluación.
    // Solo recarga ofertas (sin spinner, sin tocar estado de carga principal).
    // Evita requests superpuestos con una guarda.
    // Hace merge con el estado local para no pisar optimistic updates en curso.
    onProgresoEvaluacion(): void {
        if (this.refrescandoEnSegundoPlano) return;
        this.refrescandoEnSegundoPlano = true;

        this.ofertasService.obtenerOfertas().subscribe({
            next: (respuesta) => {
                this.refrescandoEnSegundoPlano = false;
                if (respuesta.exito) {
                    const ofertasActuales = this.ofertas();
                    const ofertasApi = respuesta.datos;

                    // Merge: preservo el estado local de postulación SOLO si
                    // hay un optimistic update en curso para ese ID.
                    // Si no está pendiente, adoptamos el valor del backend
                    // (puede que el usuario ya haya revertido o el backend se actualizó).
                    const idsPendientes = this.postulacionesPendientes();
                    const ofertasMergeadas = ofertasApi.map(api => {
                        const local = ofertasActuales.find(o => o.id === api.id);
                        if (local && idsPendientes.has(api.id) && local.estado_postulacion !== api.estado_postulacion) {
                            return { ...api, estado_postulacion: local.estado_postulacion };
                        }
                        return api;
                    });

                    this.ofertas.set(ofertasMergeadas);
                    this.persistenciaDashboard.guardarCache({
                        ofertas: ofertasMergeadas,
                        estadisticas: null,
                        fechaGuardado: new Date().toISOString(),
                        version: 1,
                    });
                }
            },
            error: () => {
                this.refrescandoEnSegundoPlano = false;
                // Silencioso — no interrumpimos la UI por un fallo de polling.
            }
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
        this.preferenciasService.obtenerPreferencias().subscribe({
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
        this.ofertasService.actualizarPostulacionMasiva(evento.ids, evento.estadoPostulacion).subscribe({
            next: (resp) => {
                if (resp.exito) {
                    this.cargarDatos();
                }
            },
            error: (error) => {
                console.error('Error al aplicar acción masiva:', error);
            }
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
