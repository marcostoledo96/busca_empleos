import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { throwError } from 'rxjs';
import { DetalleOferta } from '../src/app/componentes/detalle-oferta/detalle-oferta';
import { crearOfertasDetalle, crearHttpDetalle } from './detalle-fixture';

// Aíslo el modal histórico sin Firebase ni solicitudes reales.
const parametros = new URLSearchParams(location.search);
const ofertas = crearOfertasDetalle(parametros.get('detalle') || 'aprobada');
const httpDetalle = crearHttpDetalle(ofertas, parametros);
const llamadas = signal<string[]>([]);
const fixtureHttp: HttpInterceptorFn = solicitud => {
    const ruta = new URL(solicitud.url, location.origin).pathname.replace(/^.*\/api/, '');
    llamadas.update(actuales => [...actuales, `${solicitud.method} ${ruta}`]);
    return httpDetalle(solicitud, ruta) ?? throwError(() => new Error(`Solicitud no prevista por el fixture: ${solicitud.method} ${ruta}`));
};

@Component({
    selector: 'app-root',
    imports: [DetalleOferta],
    template: `<header>Busco Trabajo · Entorno sintético E2E histórico</header>
        @for (item of ofertas; track item.id) {
            <button type="button" (click)="abrir(item.id)">{{ item.titulo }}</button>
        }
        <app-detalle-oferta [oferta]="oferta()" [(visible)]="visible" />
        <details><summary>Registro del fixture</summary><output aria-label="Llamadas simuladas">{{ llamadas().join('\n') }}</output></details>`,
    styles: `:host { display: block; max-width: 1280px; margin: auto; padding: 24px; }
        header { font-family: var(--font-mono); margin-bottom: 24px; }
        output { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
        @media (max-width: 768px) { :host { padding: 16px; } }`,
})
class EscenarioDetalleHistorico {
    readonly ofertas = ofertas;
    readonly oferta = signal(ofertas[0]);
    readonly visible = signal(false);
    readonly llamadas = llamadas;

    abrir(id: number): void {
        this.oferta.set(ofertas.find(item => item.id === id)!);
        this.visible.set(true);
    }
}

document.documentElement.classList.toggle('dark', parametros.get('tema') === 'oscuro');
bootstrapApplication(EscenarioDetalleHistorico, { providers: [
    provideNoopAnimations(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
    provideHttpClient(withInterceptors([fixtureHttp])),
] }).catch(console.error);
