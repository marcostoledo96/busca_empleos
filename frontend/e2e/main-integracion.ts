import { Component, viewChild } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { of } from 'rxjs';
import { Dashboard } from '../src/app/paginas/dashboard/dashboard';
import { AuthService } from '../src/app/servicios/auth.service';
import { authInterceptor } from '../src/app/interceptores/auth.interceptor';

// Rechazo el uso de este bootstrap fuera del servidor efímero de integración.
if (location.origin !== 'http://127.0.0.1:4357') throw new Error('Entrada de integración limitada a loopback:4357.');
document.documentElement.classList.toggle('dark', new URLSearchParams(location.search).get('tema') === 'oscuro');

@Component({
    selector: 'app-root',
    imports: [Dashboard],
    template: `<header>Busco Trabajo · Integración aislada #57</header>
        <button type="button" (click)="dashboard().cargarDatos()">Actualizar listado integrado</button>
        <app-dashboard />`,
    styles: `:host { display: block; max-width: 1280px; margin: auto; padding: 24px; }
        header { margin-bottom: 16px; }
        @media (max-width: 768px) { :host { padding: 16px; } }`,
})
class DashboardIntegrado {
    readonly dashboard = viewChild.required(Dashboard);
}

bootstrapApplication(DashboardIntegrado, { providers: [
    provideRouter([]),
    provideNoopAnimations(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Sustituyo únicamente Firebase; servicios, HTTP, caché e IndexedDB conservan su implementación real.
    { provide: AuthService, useValue: {
        usuarioActual$: of({ uid: 'persona-ficticia-57', email: 'persona-issue57@example.invalid' }),
        obtenerToken: async () => 'issue57-token-ficticio',
    } },
] }).catch(error => { console.error(error); throw error; });
