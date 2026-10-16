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

    it('debería pedir un bloque de sincronización con cursor', () => {
        servicio.obtenerBloqueSincronizacion(500, 'cursor-firmado').subscribe((resp) => {
            expect(resp.completada).toBeFalse();
            expect(resp.fecha_corte).toBe('2026-06-15T00:00:00.000Z');
            expect(resp.max_id).toBe(100);
            expect(resp.total_inicial).toBe(100);
        });

        const req = httpMock.expectOne((request) => request.url === `${urlBase}/sincronizacion`
            && request.params.get('limite') === '500'
            && request.params.get('cursor') === 'cursor-firmado');
        expect(req.request.method).toBe('GET');
        req.flush({
            exito: true,
            datos: [],
            total: 100,
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 100,
            total_inicial: 100,
            cursor_siguiente: 'siguiente',
            completada: false,
        });
    });

    it('debería abortar el bloque de sincronización cuando se desuscribe', () => {
        const suscripcion = servicio.obtenerBloqueSincronizacion().subscribe();
        const req = httpMock.expectOne(`${urlBase}/sincronizacion?limite=500`);

        suscripcion.unsubscribe();

        expect(req.cancelled).toBeTrue();
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

    for (const masiva of [false, true]) {
        for (const fallo of ['false', '500', 'red']) {
            it(`conservo el contrato de error ${fallo} en postulación ${masiva ? 'masiva' : 'individual'}`, () => {
                const respuesta = jasmine.createSpy('respuesta');
                const error = jasmine.createSpy('error');
                if (masiva) servicio.actualizarPostulacionMasiva([1, 2], 'en_proceso').subscribe({ next: respuesta, error });
                else servicio.actualizarPostulacion(1, 'en_proceso').subscribe({ next: respuesta, error });
                const req = httpMock.expectOne(`${urlBase}/${masiva ? 'bulk' : '1'}/postulacion`);
                expect(req.request.method).toBe('PATCH');
                expect(req.request.body).toEqual(masiva
                    ? { ids: [1, 2], estado_postulacion: 'en_proceso' }
                    : { estado_postulacion: 'en_proceso' });
                if (fallo === 'false') {
                    req.flush({ exito: false, error: 'Fallo sintético' });
                    expect(respuesta).toHaveBeenCalledOnceWith({ exito: false, error: 'Fallo sintético' });
                    expect(error).not.toHaveBeenCalled();
                } else {
                    if (fallo === '500') req.flush({}, { status: 500, statusText: 'Fallo' });
                    else req.error(new ProgressEvent('error'));
                    expect(error.calls.mostRecent().args[0].status).toBe(fallo === '500' ? 500 : 0);
                    expect(respuesta).not.toHaveBeenCalled();
                }
            });
        }
    }

    for (const cambios of [
        { fecha_postulacion: '2026-01-02', nota_postulacion: 'Envié CV' },
        { fecha_postulacion: null, nota_postulacion: null },
        { nota_postulacion: 'a'.repeat(4000) },
    ]) {
        it(`envío seguimiento parcial sin agregar estado ni fecha por defecto: ${Object.keys(cambios)}`, () => {
            servicio.actualizarSeguimiento(22, cambios).subscribe(respuesta => expect(respuesta.exito).toBeTrue());
            const req = httpMock.expectOne(`${urlBase}/22/seguimiento`);
            expect(req.request.method).toBe('PATCH');
            expect(req.request.body).toEqual(cambios);
            req.flush({ exito: true, datos: { id: 22, ...cambios } });
        });
    }

    it('debería actualizar descripción manualmente (PATCH)', () => {
        servicio.actualizarDescripcion(42, 'Texto completo de la oferta...').subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.descripcion).toBe('Texto completo de la oferta...');
        });

        const req = httpMock.expectOne(`${urlBase}/42/descripcion`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ descripcion: 'Texto completo de la oferta...' });
        req.flush({ exito: true, datos: { id: 42, descripcion: 'Texto completo de la oferta...' } });
    });
});
