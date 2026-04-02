import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { TablaOfertas } from '../../componentes/tabla-ofertas/tabla-ofertas';
import { DetalleOferta } from '../../componentes/detalle-oferta/detalle-oferta';
import { OfertasService } from '../../servicios/ofertas.service';
import {
    PersistenciaDashboardService,
    type CacheDashboard,
} from '../../servicios/persistencia-dashboard.service';
import { Oferta, Estadisticas } from '../../modelos/oferta.model';

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

    // Estado reactivo de la página.
    readonly ofertas = signal<Oferta[]>([]);
    readonly estadisticas = signal<Estadisticas | null>(null);
    readonly cargando = signal(false);
    readonly ofertaSeleccionada = signal<Oferta | null>(null);
    readonly dialogoVisible = signal(false);
    readonly mensajeEstado = signal<string | null>(null);
    readonly datosDesdeCache = signal(false);

    // Filtro global de plataforma.
    readonly filtroPlataforma = signal<string | null>(null);

    // Opciones del dropdown de plataforma.
    readonly opcionesPlataforma = [
        { label: 'Todas', value: null },
        { label: 'LinkedIn', value: 'linkedin' },
        { label: 'Computrabajo', value: 'computrabajo' },
        { label: 'Indeed', value: 'indeed' },
        { label: 'Bumeran', value: 'bumeran' },
        { label: 'Glassdoor', value: 'glassdoor' },
        { label: 'GetOnBrd', value: 'getonbrd' },
        { label: 'Jooble', value: 'jooble' },
        { label: 'Google Jobs', value: 'google-jobs' },
    ];

    // Computed: aplica el filtro de plataforma al array completo base.
    private readonly ofertasFiltradas = computed(() => {
        const plataforma = this.filtroPlataforma();
        const todas = this.ofertas();
        if (!plataforma) return todas;
        return todas.filter(o => o.plataforma === plataforma);
    });

    // Tab 1: aprobadas por la IA y todavía no postuladas.
    readonly ofertasAprobadas = computed(() =>
        this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'aprobada' &&
                o.estado_postulacion === 'no_postulado'
            )
            .sort((a, b) => (b.porcentaje_match ?? 0) - (a.porcentaje_match ?? 0))
    );

    // Tab 2: las que ya mandé CV o están en proceso.
    readonly ofertasPostuladas = computed(() =>
        this.ofertasFiltradas()
            .filter(o =>
                o.estado_postulacion === 'cv_enviado' ||
                o.estado_postulacion === 'en_proceso'
            )
            .sort((a, b) => (b.porcentaje_match ?? 0) - (a.porcentaje_match ?? 0))
    );

    // Tab 3: rechazadas por la IA o descartadas manualmente.
    readonly ofertasRechazadas = computed(() =>
        this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'rechazada' ||
                o.estado_postulacion === 'descartada'
            )
            .sort((a, b) => (b.porcentaje_match ?? 0) - (a.porcentaje_match ?? 0))
    );

    // Tab 4: pendientes de evaluación (no postuladas ni descartadas).
    readonly ofertasPendientes = computed(() =>
        this.ofertasFiltradas()
            .filter(o =>
                o.estado_evaluacion === 'pendiente' &&
                o.estado_postulacion !== 'cv_enviado' &&
                o.estado_postulacion !== 'en_proceso' &&
                o.estado_postulacion !== 'descartada'
            )
            .sort((a, b) => new Date(b.fecha_extraccion).getTime() - new Date(a.fecha_extraccion).getTime())
    );

    ngOnInit(): void {
        this.restaurarUltimaCargaGuardada();
        this.cargarDatos();
    }

    // Carga ofertas y estadísticas en paralelo.
    cargarDatos(): void {
        this.cargando.set(true);

        forkJoin({
            estadisticas: this.ofertasService.obtenerEstadisticas(),
            ofertas: this.ofertasService.obtenerOfertas(),
        }).subscribe({
            next: ({ estadisticas, ofertas }) => {
                this.cargando.set(false);

                if (!estadisticas.exito || !ofertas.exito) {
                    this.manejarFalloSincronizacion();
                    return;
                }

                this.estadisticas.set(estadisticas.datos);
                this.ofertas.set(ofertas.datos);
                this.persistenciaDashboard.guardarCache({
                    ofertas: ofertas.datos,
                    estadisticas: estadisticas.datos,
                    fechaGuardado: new Date().toISOString(),
                });
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

    // Cuando el usuario hace clic en el ojo de una oferta.
    mostrarDetalle(oferta: Oferta): void {
        this.ofertaSeleccionada.set(oferta);
        this.dialogoVisible.set(true);
    }

    // Cuando una acción del panel de control termina, recargamos los datos.
    onAccionCompletada(): void {
        this.cargarDatos();
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

        this.aplicarCache(cache);
        this.mensajeEstado.set(
            `Recuperé la última carga guardada del ${this.formatearFecha(cache.fechaGuardado)} mientras sincronizo con el backend.`
        );
    }

    private manejarFalloSincronizacion(): void {
        const cache = this.persistenciaDashboard.leerCache();

        if (cache) {
            this.aplicarCache(cache);
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

    private aplicarCache(cache: CacheDashboard): void {
        this.ofertas.set(cache.ofertas);
        this.estadisticas.set(cache.estadisticas);
        this.datosDesdeCache.set(true);
    }

    private formatearFecha(fechaIso: string): string {
        const fecha = new Date(fechaIso);

        if (Number.isNaN(fecha.getTime())) {
            return 'una fecha no válida';
        }

        return fecha.toLocaleString('es-AR');
    }
}
