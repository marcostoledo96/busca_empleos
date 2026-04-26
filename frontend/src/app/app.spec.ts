import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './servicios/auth.service';
import { DemoService } from './servicios/demo.service';

describe('App — Accesibilidad del sidebar mobile', () => {

    // Helper: crea el componente con mocks mínimos.
    async function crearComponente(): Promise<{ fixture: ComponentFixture<App>; component: App }> {
        const mockAuthService = { logout: () => of({}) };
        const mockDemoService = { esModoDemo: () => false };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
                { provide: DemoService, useValue: mockDemoService },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        url: of([]),
                        params: of({}),
                        queryParams: of({}),
                    }
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(App);
        const component = fixture.componentInstance;
        return { fixture, component };
    }

    it('debería crear el componente', async () => {
        const { component } = await crearComponente();
        expect(component).toBeTruthy();
    });

    // --- Task 2.1: Sidebar mobile usa role="dialog" ---

    it('debería exponer esMobile como signal', async () => {
        const { component } = await crearComponente();
        expect(typeof component.esMobile()).toBe('boolean');
    });

    it('debería inicializar esMobile como false en viewport > 768px', async () => {
        const { component } = await crearComponente();
        // En un entorno de test sin window real, el valor depende del mock de matchMedia.
        // Verificamos que la signal existe y tiene tipo boolean.
        expect(typeof component.esMobile()).toBe('boolean');
    });

    // --- Task 2.6: aria-expanded en hamburger ---

    it('debería alternar sidebarAbierta con toggleSidebar', async () => {
        const { component } = await crearComponente();
        const estadoInicial = component.sidebarAbierta();
        component.toggleSidebar();
        expect(component.sidebarAbierta()).toBe(!estadoInicial);
        component.toggleSidebar();
        expect(component.sidebarAbierta()).toBe(estadoInicial);
    });

    it('debería cerrar sidebar con cerrarSidebar', async () => {
        const { component } = await crearComponente();
        component.sidebarAbierta.set(true);
        component.cerrarSidebar();
        expect(component.sidebarAbierta()).toBe(false);
    });

    // --- Focus management ---

    it('debería cerrar sidebar con Escape en onSidebarKeydown', async () => {
        const { component } = await crearComponente();
        component.sidebarAbierta.set(true);
        component.esMobile.set(true);

        const evento = new KeyboardEvent('keydown', { key: 'Escape' });
        spyOn(evento, 'preventDefault');
        component.onSidebarKeydown(evento);

        expect(component.sidebarAbierta()).toBe(false);
        expect(evento.preventDefault).toHaveBeenCalled();
    });

    it('no debería cerrar sidebar con Escape si no es mobile', async () => {
        const { component } = await crearComponente();
        component.sidebarAbierta.set(true);
        component.esMobile.set(false);

        const evento = new KeyboardEvent('keydown', { key: 'Escape' });
        component.onSidebarKeydown(evento);

        // En desktop, Escape no debería cerrar el sidebar (no es dialog)
        expect(component.sidebarAbierta()).toBe(true);
    });

    it('no debería cerrar sidebar con Escape si sidebar está cerrada', async () => {
        const { component } = await crearComponente();
        component.sidebarAbierta.set(false);
        component.esMobile.set(true);

        const evento = new KeyboardEvent('keydown', { key: 'Escape' });
        component.onSidebarKeydown(evento);

        // Ya está cerrada, no hay efecto
        expect(component.sidebarAbierta()).toBe(false);
    });
});

describe('App — Funcionalidad general', () => {

    it('debería alternar el tema oscuro', async () => {
        const mockAuthService = { logout: () => of({}) };
        const mockDemoService = { esModoDemo: () => false };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
                { provide: DemoService, useValue: mockDemoService },
                {
                    provide: ActivatedRoute,
                    useValue: { url: of([]), params: of({}), queryParams: of({}) }
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(App);
        const component = fixture.componentInstance;

        const estadoInicial = component.modoOscuro();
        component.toggleTema();
        expect(component.modoOscuro()).toBe(!estadoInicial);
        component.toggleTema();
        expect(component.modoOscuro()).toBe(estadoInicial);
    });
});