import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EvaluacionService } from './evaluacion.service';

describe('EvaluacionService', () => {
    let servicio: EvaluacionService;
    let httpMock: HttpTestingController;
    const urlBase = 'http://localhost:3000/api/evaluacion';

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        servicio = TestBed.inject(EvaluacionService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(servicio).toBeTruthy();
    });

    it('debería ejecutar evaluación (POST)', () => {
        servicio.ejecutarEvaluacion().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.en_curso).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/ejecutar`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { mensaje: 'Evaluación iniciada', en_curso: true } });
    });

    it('debería obtener progreso de evaluación (GET)', () => {
        servicio.obtenerProgreso().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.activo).toBeTrue();
            expect(resp.datos.porcentaje).toBe(50);
        });

        const req = httpMock.expectOne(`${urlBase}/progreso`);
        expect(req.request.method).toBe('GET');
        req.flush({
            exito: true,
            datos: {
                activo: true,
                total: 10,
                evaluadas: 5,
                aprobadas: 3,
                rechazadas: 2,
                errores: 0,
                porcentaje: 50,
            },
        });
    });

    it('debería cancelar evaluación (POST)', () => {
        servicio.cancelarEvaluacion().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/cancelar`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: null });
    });

    it('debería resetear evaluaciones (POST)', () => {
        servicio.resetearEvaluaciones(7).subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.reseteadas).toBe(5);
        });

        const req = httpMock.expectOne(`${urlBase}/resetear`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ dias: 7 });
        req.flush({
            exito: true,
            datos: {
                reseteadas: 5,
                ofertas: [
                    { id: 1, titulo: 'Dev Frontend' },
                ],
            },
        });
    });
});
