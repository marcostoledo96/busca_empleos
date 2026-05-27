import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AutomatizacionService } from './automatizacion.service';

describe('AutomatizacionService', () => {
    let servicio: AutomatizacionService;
    let httpMock: HttpTestingController;
    const urlBase = 'http://localhost:3000/api/automatizacion';

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        servicio = TestBed.inject(AutomatizacionService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(servicio).toBeTruthy();
    });

    it('debería obtener estado del cron (GET)', () => {
        servicio.obtenerEstado().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.activo).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/estado`);
        expect(req.request.method).toBe('GET');
        req.flush({
            exito: true,
            datos: {
                activo: true,
                expresionCron: '0 */2 * * *',
                ultimaEjecucion: '2025-01-01T12:00:00Z',
                ultimoResultado: {},
            },
        });
    });

    it('debería iniciar cron (POST)', () => {
        servicio.iniciarCron('0 */2 * * *').subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/iniciar`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ expresionCron: '0 */2 * * *' });
        req.flush({ exito: true, datos: { activo: true } });
    });

    it('debería detener cron (POST)', () => {
        servicio.detenerCron().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/detener`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { activo: false } });
    });

    it('debería ejecutar ciclo manual (POST)', () => {
        servicio.ejecutarCiclo().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/ejecutar`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: {} });
    });

    it('debería obtener progreso (GET)', () => {
        servicio.obtenerProgreso().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.porcentaje).toBe(75);
        });

        const req = httpMock.expectOne(`${urlBase}/progreso`);
        expect(req.request.method).toBe('GET');
        req.flush({
            exito: true,
            datos: {
                activo: true,
                pasos: [],
                porcentaje: 75,
            },
        });
    });
});
