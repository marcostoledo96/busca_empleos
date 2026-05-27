import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OfertasService, FiltrosOfertas } from './ofertas.service';

describe('OfertasService', () => {
    let servicio: OfertasService;
    let httpMock: HttpTestingController;
    const urlBase = 'http://localhost:3000/api/ofertas';

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
            ]
        });
        servicio = TestBed.inject(OfertasService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(servicio).toBeTruthy();
    });

    it('debería obtener ofertas sin filtros', () => {
        const respuestaMock = {
            exito: true,
            datos: [],
            total: 0,
        };

        servicio.obtenerOfertas().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos).toEqual([]);
        });

        const req = httpMock.expectOne(urlBase);
        expect(req.request.method).toBe('GET');
        req.flush(respuestaMock);
    });

    it('debería obtener ofertas con filtros', () => {
        const filtros: FiltrosOfertas = {
            estado: 'aprobada',
            plataforma: 'linkedin',
            ordenar_por: 'porcentaje_match',
            direccion: 'DESC',
        };

        servicio.obtenerOfertas(filtros).subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne((req) =>
            req.url === urlBase &&
            req.params.get('estado') === 'aprobada' &&
            req.params.get('plataforma') === 'linkedin' &&
            req.params.get('ordenar_por') === 'porcentaje_match' &&
            req.params.get('direccion') === 'DESC'
        );
        expect(req.request.method).toBe('GET');
        req.flush({ exito: true, datos: [] });
    });

    it('debería obtener estadísticas', () => {
        servicio.obtenerEstadisticas().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/estadisticas`);
        expect(req.request.method).toBe('GET');
        req.flush({ exito: true, datos: { total: 10, pendientes: 5, aprobadas: 3, rechazadas: 2 } });
    });

    it('debería obtener una oferta por ID', () => {
        servicio.obtenerOfertaPorId(1).subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/1`);
        expect(req.request.method).toBe('GET');
        req.flush({ exito: true, datos: { id: 1, titulo: 'Dev' } });
    });

    it('debería actualizar postulación (PATCH)', () => {
        servicio.actualizarPostulacion(1, 'cv_enviado').subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/1/postulacion`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ estado_postulacion: 'cv_enviado' });
        req.flush({ exito: true, datos: { id: 1 } });
    });

    it('debería actualizar postulación masiva (PATCH)', () => {
        servicio.actualizarPostulacionMasiva([1, 2, 3], 'cv_enviado').subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.actualizadas).toBe(3);
        });

        const req = httpMock.expectOne(`${urlBase}/bulk/postulacion`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ ids: [1, 2, 3], estado_postulacion: 'cv_enviado' });
        req.flush({ exito: true, datos: { actualizadas: 3 } });
    });
});
