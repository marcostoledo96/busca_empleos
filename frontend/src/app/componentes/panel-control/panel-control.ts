import { Component, inject, OnInit, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ScrapingService } from '../../servicios/scraping.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { AutomatizacionService } from '../../servicios/automatizacion.service';

@Component({
    selector: 'app-panel-control',
    imports: [ButtonModule, ToastModule, ToggleSwitchModule, FormsModule],
    providers: [MessageService],
    templateUrl: './panel-control.html',
    styleUrl: './panel-control.css'
})
export class PanelControl implements OnInit {

    private readonly scrapingService = inject(ScrapingService);
    private readonly evaluacionService = inject(EvaluacionService);
    private readonly automatizacionService = inject(AutomatizacionService);
    private readonly mensajes = inject(MessageService);

    // Signals para controlar el estado de carga de cada botón.
    readonly scrapeandoLinkedin = signal(false);
    readonly scrapeandoComputrabajo = signal(false);
    readonly scrapeandoIndeed = signal(false);
    readonly scrapeandoBumeran = signal(false);
    readonly evaluando = signal(false);

    // Estado de la automatización.
    readonly cronActivo = signal(false);
    readonly ultimaEjecucion = signal<string | null>(null);

    // Evento que emite cuando una acción completó para que el padre recargue datos.
    readonly accionCompletada = output<void>();

    ngOnInit(): void {
        this.consultarEstadoCron();
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

    scrapearLinkedin(): void {
        this.scrapeandoLinkedin.set(true);
        this.scrapingService.scrapearLinkedin().subscribe({
            next: (respuesta) => {
                this.scrapeandoLinkedin.set(false);
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
        this.scrapingService.scrapearComputrabajo().subscribe({
            next: (respuesta) => {
                this.scrapeandoComputrabajo.set(false);
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
        this.scrapingService.scrapearIndeed().subscribe({
            next: (respuesta) => {
                this.scrapeandoIndeed.set(false);
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
        this.scrapingService.scrapearBumeran().subscribe({
            next: (respuesta) => {
                this.scrapeandoBumeran.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Bumeran completado',
                    detail: `${datos.ofertas_nuevas} ofertas nuevas de ${datos.total_extraidas} extraídas`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.scrapeandoBumeran.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en Bumeran',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }

    ejecutarEvaluacion(): void {
        this.evaluando.set(true);
        this.evaluacionService.ejecutarEvaluacion().subscribe({
            next: (respuesta) => {
                this.evaluando.set(false);
                const datos = respuesta.datos;
                this.mensajes.add({
                    severity: 'success',
                    summary: 'Evaluación completada',
                    detail: `${datos.aprobadas} aprobadas, ${datos.rechazadas} rechazadas de ${datos.total_evaluadas}`,
                    life: 5000
                });
                this.accionCompletada.emit();
            },
            error: (error) => {
                this.evaluando.set(false);
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error en evaluación',
                    detail: error.error?.error || 'Error al conectar con el servidor',
                    life: 5000
                });
            }
        });
    }
}
