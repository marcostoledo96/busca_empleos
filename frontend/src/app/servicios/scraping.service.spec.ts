import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ScrapingService } from './scraping.service';

describe('ScrapingService', () => {
    let servicio: ScrapingService;
    let httpMock: HttpTestingController;
    const urlBase = 'http://localhost:3000/api/scraping';

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        servicio = TestBed.inject(ScrapingService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(servicio).toBeTruthy();
    });

    it('debería ejecutar scraping de LinkedIn (POST)', () => {
        servicio.scrapearLinkedin().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/linkedin`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 5, plataforma: 'linkedin' } });
    });

    it('debería ejecutar scraping de Computrabajo (POST)', () => {
        servicio.scrapearComputrabajo().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/computrabajo`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 3, plataforma: 'computrabajo' } });
    });

    it('debería ejecutar scraping de Indeed (POST)', () => {
        servicio.scrapearIndeed().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/indeed`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 2, plataforma: 'indeed' } });
    });

    it('debería ejecutar scraping de Bumeran (POST)', () => {
        servicio.scrapearBumeran().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/bumeran`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 1, plataforma: 'bumeran' } });
    });

    it('debería ejecutar scraping de Glassdoor (POST)', () => {
        servicio.scrapearGlassdoor().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/glassdoor`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 4, plataforma: 'glassdoor' } });
    });

    it('debería ejecutar scraping de GetOnBrd (POST)', () => {
        servicio.scrapearGetonbrd().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/getonbrd`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 2, plataforma: 'getonbrd' } });
    });

    it('debería ejecutar scraping de Jooble (POST)', () => {
        servicio.scrapearJooble().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/jooble`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 6, plataforma: 'jooble' } });
    });

    it('debería ejecutar scraping de Google Jobs (POST)', () => {
        servicio.scrapearGoogleJobs().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/google-jobs`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 8, plataforma: 'google-jobs' } });
    });

    it('debería ejecutar scraping de Remotive (POST)', () => {
        servicio.scrapearRemotive().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/remotive`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 1, plataforma: 'remotive' } });
    });

    it('debería ejecutar scraping de RemoteOK (POST)', () => {
        servicio.scrapearRemoteOK().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/remoteok`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 0, plataforma: 'remoteok' } });
    });

    it('debería ejecutar scraping de InfoJobs (POST)', () => {
        servicio.scrapearInfojobs().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/infojobs`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 2, plataforma: 'infojobs' } });
    });

    it('debería ejecutar scraping de Adzuna (POST)', () => {
        servicio.scrapearAdzuna().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
        });

        const req = httpMock.expectOne(`${urlBase}/adzuna`);
        expect(req.request.method).toBe('POST');
        req.flush({ exito: true, datos: { ofertas_nuevas: 7, plataforma: 'adzuna' } });
    });
});
