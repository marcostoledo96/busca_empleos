import { Component, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './servicios/auth.service';
import { environment } from '../environments/environment';

const CLAVE_TEMA = 'busca-empleos.tema';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App {
    private readonly router = inject(Router);
    private readonly documento = inject(DOCUMENT);
    readonly authService = inject(AuthService);

    readonly entorno = environment;
    readonly sidebarAbierta = signal(false);
    readonly modoOscuro = signal(false);

    constructor() {
        const temaGuardado = localStorage.getItem(CLAVE_TEMA);
        if (temaGuardado === 'dark') {
            this.modoOscuro.set(true);
            this.documento.documentElement.classList.add('dark');
        }
    }

    readonly nombreSeccion = toSignal(
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            startWith(null),
            map(() => this.router.url.startsWith('/preferencias') ? 'PREFERENCIAS' : 'DASHBOARD')
        ),
        { initialValue: 'DASHBOARD' }
    );

    // Controla si la ruta actual es la página de login.
    // Cuando es true, el template oculta el sidebar, topbar y footer.
    readonly esPaginaLogin = toSignal(
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            startWith(null),
            map(() => this.router.url === '/login' || this.router.url.startsWith('/login?'))
        ),
        { initialValue: false }
    );

    toggleSidebar(): void {
        this.sidebarAbierta.update(v => !v);
    }

    cerrarSidebar(): void {
        this.sidebarAbierta.set(false);
    }

    toggleTema(): void {
        const activarOscuro = !this.modoOscuro();
        this.modoOscuro.set(activarOscuro);
        if (activarOscuro) {
            this.documento.documentElement.classList.add('dark');
            localStorage.setItem(CLAVE_TEMA, 'dark');
        } else {
            this.documento.documentElement.classList.remove('dark');
            localStorage.setItem(CLAVE_TEMA, 'light');
        }
    }

    cerrarSesion(): void {
        this.authService.logout().subscribe();
    }
}
