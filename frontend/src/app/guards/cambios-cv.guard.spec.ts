import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Preferencias } from '../paginas/preferencias/preferencias';
import { DemoService } from '../servicios/demo.service';
import { cambiosCvGuard } from './cambios-cv.guard';
import { routes } from '../app.routes';

@Component({ template: 'Destino sintético' })
class Destino {}

describe('Cambios del CV — navegación real', () => {
    it('la ruta protegida conserva autenticación y agrega protección al salir', () => {
        const ruta = routes.find(r => r.path === 'preferencias')!;
        expect(ruta.canActivate?.length).toBe(1);
        expect(ruta.canDeactivate).toEqual([cambiosCvGuard]);
    });

    it('protege preferencias generales, conserva el borrador tras fallo y permite salir guardado o descartado', async () => {
        TestBed.configureTestingModule({
            providers: [provideRouter([
                { path: 'preferencias', component: Preferencias, canDeactivate: [cambiosCvGuard] },
                { path: 'destino', component: Destino },
            ]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        });
        const http = TestBed.inject(HttpTestingController);
        const harness = await RouterTestingHarness.create();
        const componente = await harness.navigateByUrl('/preferencias', Preferencias);
        const url = 'http://localhost:3000/api/preferencias';
        http.expectOne(url).flush({ exito: true, datos: { nombre: 'Nombre confirmado' } });
        http.expectOne(`${url}/cv-base`).flush({ exito: true, datos: { cv_base: null } });
        const confirmar = spyOn(window, 'confirm').and.returnValue(false);
        componente.nombre = 'Borrador general';
        componente.guardar();
        http.expectOne(url).flush({}, { status: 500, statusText: 'Fallo sintético' });
        await harness.navigateByUrl('/destino');
        expect(harness.routeDebugElement?.componentInstance).toBe(componente);
        expect(confirmar).toHaveBeenCalled();
        expect(componente.nombre).toBe('Borrador general');
        componente.guardar();
        http.expectOne(url).flush({ exito: true, datos: { nombre: 'Borrador general' } });
        confirmar.calls.reset();
        await harness.navigateByUrl('/destino', Destino);
        expect(confirmar).not.toHaveBeenCalled();
        const segundo = await harness.navigateByUrl('/preferencias', Preferencias);
        http.expectOne(url).flush({ exito: true, datos: { nombre: 'Borrador general' } });
        http.expectOne(`${url}/cv-base`).flush({ exito: true, datos: { cv_base: null } });
        segundo.nombre = 'Descartable';
        confirmar.and.returnValue(true);
        await harness.navigateByUrl('/destino', Destino);
        expect(confirmar).toHaveBeenCalled();
        http.verify();
    });

    it('bloquea salida sucia, permite cancelar, confirmar o salir después de guardar', async () => {
        TestBed.configureTestingModule({
            providers: [provideRouter([
                { path: 'preferencias', component: Preferencias, canDeactivate: [cambiosCvGuard] },
                { path: 'destino', component: Destino },
            ]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        });
        const http = TestBed.inject(HttpTestingController);
        const harness = await RouterTestingHarness.create();
        const componente = await harness.navigateByUrl('/preferencias', Preferencias);
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: {} });
        const url = 'http://localhost:3000/api/preferencias/cv-base';
        http.expectOne(url).flush({ exito: true, datos: { cv_base: 'Confirmado', cv_base_actualizado_en: '2026-01-01T00:00:00Z' } });
        componente.editarCvBase('Pendiente');
        const confirmar = spyOn(window, 'confirm').and.returnValue(false);
        await harness.navigateByUrl('/destino');
        expect(harness.routeDebugElement?.componentInstance).toBe(componente);
        expect(confirmar).toHaveBeenCalled();
        componente.guardarFuenteCv();
        await harness.navigateByUrl('/destino');
        expect(harness.routeDebugElement?.componentInstance).toBe(componente);
        http.expectOne(url).flush({ exito: true, datos: { cv_base: 'Pendiente', cv_base_actualizado_en: '2026-01-02T00:00:00Z' } });
        const salida = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
        componente.advertirSalidaCv(salida);
        expect(salida.defaultPrevented).toBeFalse();
        confirmar.calls.reset();
        await harness.navigateByUrl('/destino', Destino);
        expect(confirmar).not.toHaveBeenCalled();
        const segundo = await harness.navigateByUrl('/preferencias', Preferencias);
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: {} });
        http.expectOne(url).flush({ exito: true, datos: { cv_base: null, cv_base_actualizado_en: null } });
        segundo.editarCvBase('Descartable');
        confirmar.and.returnValue(true);
        await harness.navigateByUrl('/destino', Destino);
        http.verify();
    });
});
