import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { routes } from './app.routes';
import { authGuard } from './guards/auth.guard';
import { cambiosCvGuard } from './guards/cambios-cv.guard';
import { cambiosCvImprimibleGuard } from './guards/cambios-cv-imprimible.guard';
import { Cv } from './paginas/cv/cv';
import { DemoService } from './servicios/demo.service';

@Component({ template: 'Destino sintético' })
class Destino {}

describe('Rutas — CV imprimible y conservación de navegación existente', () => {
    it('protege /cv con la autenticación existente y el guard del borrador local', async () => {
        const ruta = routes.find(r => r.path === 'cv')!;
        expect(ruta.canActivate).toEqual([authGuard]);
        expect(ruta.canDeactivate).toEqual([cambiosCvImprimibleGuard]);
        expect(await (ruta.loadComponent as () => Promise<unknown>)()).toBe(Cv);
    });
    it('conserva autenticación de dashboard, editor de Preferencias y fallback', () => {
        expect(routes.find(r => r.path === '')!.canActivate).toEqual([authGuard]);
        const preferencias = routes.find(r => r.path === 'preferencias')!;
        expect(preferencias.canActivate).toEqual([authGuard]);
        expect(preferencias.canDeactivate).toEqual([cambiosCvGuard]);
        expect(routes.find(r => r.path === 'login')!.canActivate).toBeUndefined();
        expect(routes.find(r => r.path === '**')!.redirectTo).toBe('login');
    });
    it('CanDeactivate conserva el borrador si rechazo salir y permite descartar explícitamente', async () => {
        TestBed.configureTestingModule({
            providers: [provideRouter([
                { path: 'cv', component: Cv, canDeactivate: [cambiosCvImprimibleGuard] },
                { path: 'destino', component: Destino },
            ]), provideHttpClient(), provideHttpClientTesting(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        });
        const navegador = await RouterTestingHarness.create();
        await navegador.navigateByUrl('/cv', Cv);
        const http = TestBed.inject(HttpTestingController);
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: {} });
        http.expectOne('http://localhost:3000/api/preferencias/cv-base').flush({ exito: true, datos: { cv_base: null } });
        navegador.detectChanges();
        await navegador.fixture.whenStable();
        const nombre = navegador.routeNativeElement!.querySelector('#nombre') as HTMLInputElement;
        nombre.value = 'Nombre manual'; nombre.dispatchEvent(new Event('input'));
        await navegador.fixture.whenStable();
        const confirmar = spyOn(window, 'confirm').and.returnValue(false);
        await navegador.navigateByUrl('/destino');
        expect(TestBed.inject(Router).url).toBe('/cv');
        expect((navegador.routeNativeElement!.querySelector('#nombre') as HTMLInputElement).value).toBe('Nombre manual');
        confirmar.and.returnValue(true);
        await navegador.navigateByUrl('/destino', Destino);
        expect(TestBed.inject(Router).url).toBe('/destino');
        http.verify();
    });
    it('CanDeactivate permite salir de un borrador intacto sin pedir confirmación', async () => {
        TestBed.configureTestingModule({ providers: [provideRouter([
            { path: 'cv', component: Cv, canDeactivate: [cambiosCvImprimibleGuard] },
            { path: 'destino', component: Destino },
        ]), provideHttpClient(), { provide: DemoService, useValue: { esModoDemo: () => true } }] });
        const navegador = await RouterTestingHarness.create();
        await navegador.navigateByUrl('/cv', Cv);
        const confirmar = spyOn(window, 'confirm');
        await navegador.navigateByUrl('/destino', Destino);
        expect(confirmar).not.toHaveBeenCalled();
    });
});
