import { Component, ElementRef, inject, signal, ViewChild, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './servicios/auth.service';
import { DemoService } from './servicios/demo.service';
import { environment } from '../environments/environment';

const CLAVE_TEMA = 'busca-empleos.tema';
const MOBILE_BREAKPOINT = 768;

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './app.html',
    styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly documento = inject(DOCUMENT);
    readonly authService = inject(AuthService);
    readonly demoService = inject(DemoService);

    readonly entorno = environment;
    readonly sidebarAbierta = signal(false);
    readonly modoOscuro = signal(false);
    // Expone el estado del modo demo al template.
    readonly esModoDemo = this.demoService.esModoDemo;

    // Detecta si el viewport actual es mobile (≤768px).
    readonly esMobile = signal(false);

    // Referencia al sidebar para manejo de foco.
    private sidebarEl: HTMLElement | null = null;
    private readonly mediaQuery: MediaQueryList;
    private readonly mediaQueryListener: (e: MediaQueryListEvent) => void;

    // Elementos focusable dentro del sidebar para focus trap.
    private sidebarEnlaces: HTMLElement[] = [];

    // Guarda el elemento que tenía foco antes de abrir el sidebar.
    private elementoFocoPrevio: HTMLElement | null = null;

    constructor() {
        const temaGuardado = localStorage.getItem(CLAVE_TEMA);
        if (temaGuardado === 'dark') {
            this.modoOscuro.set(true);
            this.documento.documentElement.classList.add('dark');
        }

        // Escucha cambios de tamaño de viewport para determinar si es mobile.
        this.mediaQuery = this.documento.defaultView!.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
        this.esMobile.set(this.mediaQuery.matches);
        this.mediaQueryListener = (e: MediaQueryListEvent) => {
            this.esMobile.set(e.matches);
            // Si pasamos de mobile a desktop con sidebar abierta, la cerramos.
            if (!e.matches && this.sidebarAbierta()) {
                this.sidebarAbierta.set(false);
            }
        };
        this.mediaQuery.addEventListener('change', this.mediaQueryListener);

        // Effect: cuando sidebarAbierta cambia, mover foco.
        effect(() => {
            const abierta = this.sidebarAbierta();
            if (abierta) {
                // Guardar foco previo y mover al primer elemento del sidebar.
                this.elementoFocoPrevio = this.documento.activeElement as HTMLElement;
                // Timeout para que el sidebar termine de mostrarse.
                setTimeout(() => this.moverFocoAlSidebar(), 50);
            } else {
                // Restaurar foco al hamburger.
                this.restaurarFoco();
            }
        });
    }

    ngAfterViewInit(): void {
        this.sidebarEl = this.documento.querySelector('.sidebar');
    }

    ngOnDestroy(): void {
        this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
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
        // En modo demo, salir del modo en lugar de cerrar sesión de Firebase.
        if (this.demoService.esModoDemo()) {
            this.demoService.desactivarDemo();
            return;
        }
        this.authService.logout().subscribe();
    }

    // Maneja el teclado dentro del sidebar (Escape para cerrar, Tab para focus trap).
    onSidebarKeydown(evento: KeyboardEvent): void {
        if (!this.esMobile() || !this.sidebarAbierta()) return;

        if (evento.key === 'Escape') {
            evento.preventDefault();
            this.cerrarSidebar();
            return;
        }

        if (evento.key === 'Tab') {
            this.manejarFocusTrap(evento);
        }
    }

    // Mueve el foco al primer elemento interactivo del sidebar.
    private moverFocoAlSidebar(): void {
        const primerEnlace = this.documento.querySelector('.sidebar-enlace') as HTMLElement | null;
        if (primerEnlace) {
            primerEnlace.focus();
        } else if (this.sidebarEl) {
            this.sidebarEl.focus();
        }
    }

    // Restaura el foco al botón que abrió el sidebar.
    private restaurarFoco(): void {
        const hamburger = this.documento.getElementById('btn-hamburger');
        if (hamburger) {
            hamburger.focus();
        } else if (this.elementoFocoPrevio) {
            this.elementoFocoPrevio.focus();
        }
    }

    // Implementa focus trap: el Tab no sale del sidebar.
    private manejarFocusTrap(evento: KeyboardEvent): void {
        const enlaces = Array.from(this.documento.querySelectorAll('.sidebar .sidebar-enlace, .sidebar .sidebar-titulo a, .sidebar button')) as HTMLElement[];
        if (enlaces.length === 0) return;

        const primero = enlaces[0];
        const ultimo = enlaces[enlaces.length - 1];

        if (evento.shiftKey) {
            // Shift+Tab en el primer elemento → ir al último.
            if (this.documento.activeElement === primero) {
                evento.preventDefault();
                ultimo.focus();
            }
        } else {
            // Tab en el último elemento → ir al primero.
            if (this.documento.activeElement === ultimo) {
                evento.preventDefault();
                primero.focus();
            }
        }
    }
}
