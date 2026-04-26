import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ScrapingService } from '../../servicios/scraping.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { AutomatizacionService } from '../../servicios/automatizacion.service';
import { ProgresoAutomatizacion, ProgresoEvaluacion } from '../../modelos/respuesta-api.model';

@Component({
    selector: 'app-panel-control',
    imports: [ButtonModule, ToastModule, ToggleSwitchModule, ProgressBarModule, FormsModule, TooltipModule, SelectModule],
    providers: [MessageService],
    templateUrl: './panel-control.html',
    styleUrl: './panel-control.css'
})
export class PanelControl implements OnInit, OnDestroy {

    private readonly scrapingService = inject(ScrapingService);
    private readonly evaluacionService = inject(EvaluacionService);
    private readonly automatizacionService = inject(AutomatizacionService);
    private readonly mensajes = inject(MessageService);

    // Signals para controlar el estado de carga de cada botón.
    readonly scrapeandoLinkedin = signal(false);
    readonly scrapeandoComputrabajo = signal(false);
    readonly scrapeandoIndeed = signal(false);
    readonly scrapeandoBumeran = signal(false);
    readonly scrapeandoGlassdoor = signal(false);
    readonly scrapeandoGetonbrd = signal(false);
    readonly scrapeandoJooble = signal(false);
    readonly scrapeandoGoogleJobs = signal(false);
    readonly scrapeandoRemotive = signal(false);
    readonly scrapeandoRemoteOK = signal(false);
    readonly evaluando = signal(false);

    // Computed: hay algún scraping individual en curso (para deshabilitar selector mobile).
    readonly scrapeandoAlguno = computed(() =>
        this.scrapeandoLinkedin() ||
        this.scrapeandoComputrabajo() ||
        this.scrapeandoIndeed() ||
        this.scrapeandoBumeran() ||
        this.scrapeandoGlassdoor() ||
        this.scrapeandoGetonbrd() ||
        this.scrapeandoJooble() ||
        this.scrapeandoGoogleJobs() ||
        this.scrapeandoRemotive() ||
        this.scrapeandoRemoteOK()
    );
    readonly progresoEvaluacion = signal<ProgresoEvaluacion | null>(null);

    // ID del intervalo de polling para la evaluación.
    private intervalIdPollingEval: ReturnType<typeof setInterval> | null = null;

    // Estado de la automatización.
    readonly cronActivo = signal(false);
    readonly ultimaEjecucion = signal<string | null>(null);

    // Overlay de scraping individual (spinner simple, sin % real).
    readonly mostrarOverlayIndividual = signal(false);
    readonly plataformaEnProceso = signal('');

    // Overlay del ciclo completo (con pasos reales y % via polling).
    readonly mostrarOverlayCiclo = signal(false);
    readonly progresoCiclo = signal<ProgresoAutomatizacion | null>(null);
    readonly ejecutandoCiclo = signal(false);

    // ID del intervalo de polling — para poder limpiarlo al destruir.
    private intervalIdPolling: ReturnType<typeof setInterval> | null = null;

    // Plataforma seleccionada en el selector mobile de scraping.
    readonly plataformaSeleccionada = signal<string>('linkedin');

    // Modelo two-way para p-select: sincroniza con la signal plataformaSeleccionada.
    get plataformaSeleccionadaModel(): string {
        return this.plataformaSeleccionada();
    }
    set plataformaSeleccionadaModel(valor: string) {
        this.plataformaSeleccionada.set(valor);
    }

    // Opciones para el p-select mobile de plataformas de scraping.
    readonly opcionesPlataforma = [
        { value: 'linkedin',      label: 'LinkedIn'     },
        { value: 'computrabajo',  label: 'Computrabajo' },
        { value: 'indeed',        label: 'Indeed'       },
        { value: 'bumeran',       label: 'Bumeran'      },
        { value: 'glassdoor',     label: 'Glassdoor'    },
        { value: 'getonbrd',      label: 'GetOnBrd'     },
        { value: 'jooble',        label: 'Jooble'       },
        { value: 'googlejobs',    label: 'Google Jobs'  },
        { value: 'remotive',      label: 'Remotive'     },
        { value: 'remoteok',      label: 'RemoteOK'     },
    ];

    // Mapeo de valores del selector a etiquetas para mostrar en el overlay.
    readonly etiquetasPorPlataforma: Record<string, string> = {
        linkedin: 'LinkedIn',
        computrabajo: 'Computrabajo',
        indeed: 'Indeed',
        bumeran: 'Bumeran',
        glassdoor: 'Glassdoor',
        getonbrd: 'GetOnBrd',
        jooble: 'Jooble',
        googlejobs: 'Google Jobs',
        remotive: 'Remotive',
        remoteok: 'RemoteOK',
    };

    // Evento que emite cuando una acción completó para que el padre recargue datos.
    readonly accionCompletada = output<void>();

    // Evento que emite en cada tick de polling de evaluación,
    // para que el dashboard refresque ofertas en segundo plano.
    readonly evaluacionEnProgreso = output<void>();

    // Input que bloquea todas las acciones en modo demo.
    readonly modoDemo = input(false);

    ngOnInit(): void {
        this.consultarEstadoCron();
    }

    ngOnDestroy(): void {
        this.detenerPolling();
        this.detenerPollingEvaluacion();
    }

    // Consulto el estado del cron al iniciar el componente.
    consultarEstadoCron(): void {
        this.automatizacionService.obtenerEstado().subscribe({
            next: (respuesta) => {
                if (respuesta.exito) {
                    this.cronActivo.set(respuesta.datos.activo);
                    this.ultimaEjecucion.set(respuesta.datos.ultimaEjecucion);
                }
            },
            error: () => {} // Silencioso — no es crítico si falla al iniciar.
        });
    }

    // Inicia el polling al endpoint de progreso (cada 2 segundos).
    private iniciarPolling(): void {
        this.detenerPolling(); // Evito duplicados.
        this.intervalIdPolling = setInterval(() => {
            this.automatizacionService.obtenerProgreso().subscribe({
                next: (respuesta) => {
                    if (respuesta.exito) {
                        this.progresoCiclo.set(respuesta.datos);
                        // Si el backend terminó, detengo el polling.
                        if (!respuesta.datos.activo && respuesta.datos.porcentaje >= 100) {
                            this.detenerPolling();
                        }
                    }
                },
                error: () => {} // Silencioso — no corto el polling por un error de red.
            });
        }, 2000);
    }

    // Limpia el intervalo de polling.
    private detenerPolling(): void {
        if (this.intervalIdPolling !== null) {
            clearInterval(this.intervalIdPolling);
            this.intervalIdPolling = null;
        }
    }

    // Inicia el polling al endpoint de progreso de evaluación (cada 2 segundos).
    private iniciarPollingEvaluacion(): void {
        this.detenerPollingEvaluacion();
        this.intervalIdPollingEval = setInterval(() => {
            this.evaluacionService.obtenerProgreso().subscribe({
                next: (respuesta) => {
                    if (respuesta.exito) {
                        this.progresoEvaluacion.set(respuesta.datos);
                        // Emito evento para que el dashboard refresque ofertas en segundo plano.
                        this.evaluacionEnProgreso.emit();
                        // Si el backend terminó, detengo el polling y notifico.
                        if (!respuesta.datos.activo) {
                            this.detenerPollingEvaluacion();
                            this.evaluando.set(false);
                            const p = respuesta.datos;
                            this.mensajes.add({
                                severity: 'success',
                                summary: 'Evaluación completada',
                                detail: `${p.aprobadas} aprobadas, ${p.rechazadas} rechazadas de ${p.total}`,
                                life: 5000
                            });
                            this.accionCompletada.emit();
                            // Limpio el progreso después de mostrar el toast.
                            setTimeout(() => this.progresoEvaluacion.set(null), 1500);
                        }
                    }
                },
                error: () => {} // Silencioso — no corto el polling por un error de red.
            });
        }, 2000);
    }

    // Limpia el intervalo de polling de evaluación.
    private detenerPollingEvaluacion(): void {
        if (this.intervalIdPollingEval !== null) {
            clearInterval(this.intervalIdPollingEval);
            this.intervalIdPollingEval = null;
        }
    }

    // Ejecuta el ciclo completo (scraping de las 4 plataformas + evaluación IA).
    ejecutarCicloCompleto(): void {
        this.ejecutandoCiclo.set(true);
        this.mostrarOverlayCiclo.set(true);
        this.progresoCiclo.set(null);

        // Espero 500ms antes de iniciar el polling para que el backend
        // tenga tiempo de inicializar el objeto de progreso.
        setTimeout(() => this.iniciarPolling(), 500);

        this.automatizacionService.ejecutarCiclo().subscribe({
            next: (respuesta) => {
                this.detenerPolling();
                this.ejecutandoCiclo.set(false);

                // Aseguro que el overlay muestre 100% antes de cerrar.
                if (this.progresoCiclo()) {
                    this.progresoCiclo.set({ ...this.progresoCiclo()!, porcentaje: 100, activo: false });
                }

                setTimeout(() => {
                    this.mostrarOverlayCiclo.set(false);
                    this.progresoCiclo.set(null);
                    this.mensajes.add({
                        severity: 'success',
                        summary: 'Ciclo completo',
                        detail: 'Scraping y evaluación finalizados.',
                        life: 5000
                    });
                    this.accionCompletada.emit();
                }, 1200);
            },
            error: (error) => {
                this.detenerPolling();
                this.ejecutandoCiclo.set(false);
                this.mostrarOverlayCiclo.set(false);
                this.progresoCiclo.set(null);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en ciclo completo',
                    detail: error.error?.error || 'Error al ejecutar el ciclo.',
                    life: 5000
                });
            }
        });
    }

    // Cuando el usuario toglea el switch del cron.
    toggleCron(activar: boolean): void {
        if (activar) {
            this.automatizacionService.iniciarCron().subscribe({
                next: (respuesta) => {
                    this.cronActivo.set(true);
                    this.mensajes.add({
                        severity: 'success',
                        summary: 'Cron activado',
                        detail: 'Scraping automático cada 48 horas.',
                        life: 4000
                    });
                },
                error: () => {
                    this.cronActivo.set(false);
                    this.mensajes.add({
                        severity: 'error',
                        summary: 'Error al activar cron',
                        detail: 'No se pudo programar la automatización.',
                        life: 5000
                    });
                }
            });
        } else {
            this.automatizacionService.detenerCron().subscribe({
                next: () => {
                    this.cronActivo.set(false);
                    this.mensajes.add({
                        severity: 'info',
                        summary: 'Cron desactivado',
                        detail: 'La automatización fue detenida.',
                        life: 4000
                    });
                },
                error: () => {
                    this.cronActivo.set(true);
                    this.mensajes.add({
                        severity: 'error',
                        summary: 'Error al detener cron',
                        detail: 'No se pudo detener la automatización.',
                        life: 5000
                    });
                }
            });
        }
    }

    // Ejecuta el scraping de la plataforma seleccionada en el selector mobile.
    scrapearPlataformaSeleccionada(): void {
        const plataforma = this.plataformaSeleccionada();
        switch (plataforma) {
            case 'linkedin':      this.scrapearLinkedin();      break;
            case 'computrabajo':  this.scrapearComputrabajo();  break;
            case 'indeed':        this.scrapearIndeed();        break;
            case 'bumeran':       this.scrapearBumeran();       break;
            case 'glassdoor':     this.scrapearGlassdoor();     break;
            case 'getonbrd':      this.scrapearGetonbrd();      break;
            case 'jooble':        this.scrapearJooble();        break;
            case 'googlejobs':    this.scrapearGoogleJobs();    break;
            case 'remotive':      this.scrapearRemotive();      break;
            case 'remoteok':      this.scrapearRemoteOK();      break;
            default: break;
        }
    }

    scrapearLinkedin(): void {
        this.scrapeandoLinkedin.set(true);
        this.plataformaEnProceso.set('LinkedIn');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearLinkedin().subscribe({
            next: (respuesta) => {
                this.scrapeandoLinkedin.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'LinkedIn completado',
                    detail: `${datos.ofertas_nuevas} ofertas nuevas de ${datos.total_extraidas} extraídas`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoLinkedin.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en LinkedIn',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearComputrabajo(): void {
        this.scrapeandoComputrabajo.set(true);
        this.plataformaEnProceso.set('Computrabajo');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearComputrabajo().subscribe({
            next: (respuesta) => {
                this.scrapeandoComputrabajo.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Computrabajo completado',
                    detail: `${datos.ofertas_nuevas} ofertas nuevas de ${datos.total_extraidas} extraídas`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoComputrabajo.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Computrabajo',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearIndeed(): void {
        this.scrapeandoIndeed.set(true);
        this.plataformaEnProceso.set('Indeed');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearIndeed().subscribe({
            next: (respuesta) => {
                this.scrapeandoIndeed.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Indeed completado',
                    detail: `${datos.ofertas_nuevas} ofertas nuevas de ${datos.total_extraidas} extraídas`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoIndeed.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Indeed',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearBumeran(): void {
        this.scrapeandoBumeran.set(true);
        this.plataformaEnProceso.set('Bumeran');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearBumeran().subscribe({
            next: (respuesta) => {
                this.scrapeandoBumeran.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Bumeran completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoBumeran.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Bumeran',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearGlassdoor(): void {
        this.scrapeandoGlassdoor.set(true);
        this.plataformaEnProceso.set('Glassdoor');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearGlassdoor().subscribe({
            next: (respuesta) => {
                this.scrapeandoGlassdoor.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Glassdoor completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoGlassdoor.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Glassdoor',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearGetonbrd(): void {
        this.scrapeandoGetonbrd.set(true);
        this.plataformaEnProceso.set('GetOnBrd');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearGetonbrd().subscribe({
            next: (respuesta) => {
                this.scrapeandoGetonbrd.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'GetOnBrd completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoGetonbrd.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en GetOnBrd',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearJooble(): void {
        this.scrapeandoJooble.set(true);
        this.plataformaEnProceso.set('Jooble');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearJooble().subscribe({
            next: (respuesta) => {
                this.scrapeandoJooble.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Jooble completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoJooble.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Jooble',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearGoogleJobs(): void {
        this.scrapeandoGoogleJobs.set(true);
        this.plataformaEnProceso.set('Google Jobs');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearGoogleJobs().subscribe({
            next: (respuesta) => {
                this.scrapeandoGoogleJobs.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Google Jobs completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoGoogleJobs.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Google Jobs',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearRemotive(): void {
        this.scrapeandoRemotive.set(true);
        this.plataformaEnProceso.set('Remotive');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearRemotive().subscribe({
            next: (respuesta) => {
                this.scrapeandoRemotive.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Remotive completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoRemotive.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Remotive',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    scrapearRemoteOK(): void {
        this.scrapeandoRemoteOK.set(true);
        this.plataformaEnProceso.set('RemoteOK');
        this.mostrarOverlayIndividual.set(true);
        this.scrapingService.scrapearRemoteOK().subscribe({
            next: (respuesta) => {
                this.scrapeandoRemoteOK.set(false);
                this.mostrarOverlayIndividual.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'RemoteOK completado',
                    detail: `${datos.ofertas_nuevas} nuevas, ${datos.ofertas_duplicadas} ya en BD (${datos.total_extraidas} extraídas)`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoRemoteOK.set(false);
                this.mostrarOverlayIndividual.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en RemoteOK',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    ejecutarEvaluacion(): void {
        this.evaluando.set(true);
        this.progresoEvaluacion.set(null);

        // Espero 500ms antes de iniciar el polling para que el backend
        // tenga tiempo de inicializar el objeto de progreso.
        setTimeout(() => this.iniciarPollingEvaluacion(), 500);

        this.evaluacionService.ejecutarEvaluacion().subscribe({
            next: () => {
                // El backend responde de inmediato (fire-and-forget).
                // El polling se encarga de detectar cuándo terminó.
            },
            error: (error) => {
                this.detenerPollingEvaluacion();
                this.evaluando.set(false);
                this.progresoEvaluacion.set(null);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en evaluación',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    cancelarEvaluacion(): void {
        this.evaluacionService.cancelarEvaluacion().subscribe({
            next: () => {
                this.mensajes.add({
                    severity: 'info',
                    summary: 'Cancelando',
                    detail: 'Se solicitó la cancelación. La oferta actual termina antes de detenerse.',
                    life: 4000
                });
            },
            error: () => {}
        });
    }
}
