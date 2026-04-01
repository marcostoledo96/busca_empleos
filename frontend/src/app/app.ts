import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App {
    private readonly router = inject(Router);
    readonly sidebarAbierta = signal(false);

    readonly nombreSeccion = toSignal(
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            startWith(null),
            map(() => this.router.url.startsWith('/preferencias') ? 'PREFERENCIAS' : 'DASHBOARD')
        ),
        { initialValue: 'DASHBOARD' }
    );

    toggleSidebar(): void {
        this.sidebarAbierta.update(v => !v);
    }

    cerrarSidebar(): void {
        this.sidebarAbierta.set(false);
    }
}
