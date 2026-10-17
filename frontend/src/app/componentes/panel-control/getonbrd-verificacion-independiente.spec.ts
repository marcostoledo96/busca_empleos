import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { PanelControl } from './panel-control';
import { ScrapingService } from '../../servicios/scraping.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { AutomatizacionService } from '../../servicios/automatizacion.service';
import { obtenerOpcionesFiltroPlataforma } from '../../config/plataformas';
describe('GetOnBrd: verificación independiente S4/S7', () => {
    let fixture: ComponentFixture<PanelControl>;
    let panel: PanelControl;
    let scraping: any;
    let automatizacion: any;
    const resumen = { plataforma: 'getonbrd', nombre: 'GetOnBrd', habilitada: true, ejecutable: true, advertencias: [], terminos: ['qa'], ubicacion: [], filtros: {}, origen: {}, ventanaDias: 30, maxResultados: 3 };
    beforeEach(async () => {
        scraping = { obtenerPrevisualizacion: jasmine.createSpy().and.returnValue(of({ exito: true, datos: { plataformas: [] } })), scrapearGetonbrd: jasmine.createSpy() };
        automatizacion = { obtenerHistorial: () => of({ exito: true, datos: [] }), obtenerEstado: () => of({ exito: true, datos: { activo: false } }), obtenerProgreso: () => of({ exito: true, datos: { activo: false, pasos: [] } }), iniciarCron: jasmine.createSpy() };
        await TestBed.configureTestingModule({ imports: [PanelControl], providers: [provideNoopAnimations(), MessageService,
            { provide: ScrapingService, useValue: scraping }, { provide: AutomatizacionService, useValue: automatizacion },
            { provide: EvaluacionService, useValue: { obtenerProgreso: () => of({ exito: true, datos: { activo: false } }) } },
        ] }).compileComponents();
        fixture = TestBed.createComponent(PanelControl); panel = fixture.componentInstance; fixture.detectChanges();
    });
    afterEach(() => fixture.destroy());
    const boton = (f: ComponentFixture<PanelControl>) => f.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]') as HTMLButtonElement;
    it('estado inicial y fallo de preview mantienen ambos caminos cerrados sin cron', () => {
        expect(boton(fixture).disabled).toBeTrue();
        scraping.obtenerPrevisualizacion.and.returnValue(throwError(() => Error('offline')));
        panel.scrapearGetonbrd(); fixture.detectChanges();
        expect(scraping.scrapearGetonbrd).not.toHaveBeenCalled();
        expect(panel.opcionesPlataforma.some(p => p.value === 'getonbrd')).toBeFalse();
        expect(automatizacion.iniciarCron).not.toHaveBeenCalled();
    });
    it('revocación posterior a preview habilitada impide el POST mobile y conserva filtros', () => {
        scraping.obtenerPrevisualizacion.and.returnValue(of({ exito: true, datos: { plataformas: [resumen] } }));
        panel.actualizarPrevisualizacion(); panel.plataformaSeleccionadaModel = 'getonbrd'; fixture.detectChanges();
        expect(boton(fixture).disabled).toBeFalse();
        scraping.obtenerPrevisualizacion.and.returnValue(of({ exito: true, datos: { plataformas: [{ ...resumen, habilitada: false, ejecutable: false, advertencias: ['Acceso revocado'] }] } }));
        panel.scrapearPlataformaSeleccionada(); fixture.detectChanges();
        expect(scraping.scrapearGetonbrd).not.toHaveBeenCalled();
        expect(boton(fixture).disabled).toBeTrue();
        expect(panel.opcionesPlataforma.some(p => p.value === 'getonbrd')).toBeFalse();
        expect(obtenerOpcionesFiltroPlataforma().some(p => p.value === 'getonbrd')).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('Acceso revocado');
    });
    for (const mobile of [false, true]) it(`acción ${mobile ? 'mobile' : 'desktop'} muestra carga y resultado parcial común`, () => {
        const pendiente = new Subject<any>();
        scraping.obtenerPrevisualizacion.and.returnValue(of({ exito: true, datos: { plataformas: [resumen] } }));
        scraping.scrapearGetonbrd.and.returnValue(pendiente);
        panel.actualizarPrevisualizacion(); fixture.detectChanges();
        if (mobile) { panel.plataformaSeleccionadaModel = 'getonbrd'; fixture.detectChanges(); fixture.nativeElement.querySelector('.scraping-selector-mobile__btn-extraer').click(); }
        else boton(fixture).click();
        fixture.detectChanges();
        expect(scraping.scrapearGetonbrd).toHaveBeenCalledTimes(1);
        expect(panel.scrapeandoAlguno()).toBeTrue(); expect(boton(fixture).disabled).toBeTrue();
        pendiente.next({ exito: true, datos: { configuracion: resumen, plataforma: 'getonbrd', total_extraidas: 1, ofertas_nuevas: 1, ofertas_duplicadas: 0, fuente: { plataforma: 'getonbrd', estado: 'parcial', nuevas: 1, errores: [{ tipo: 'limite_solicitudes', codigoHttp: 429 }] } } }); pendiente.complete(); fixture.detectChanges();
        expect(panel.scrapeandoAlguno()).toBeFalse();
        expect(fixture.nativeElement.querySelector('app-resultado-fuente').textContent).toContain('GetOnBrd — Parcial');
        expect(fixture.nativeElement.querySelector('app-resultado-fuente').textContent).toContain('429');
        expect(automatizacion.iniciarCron).not.toHaveBeenCalled();
    });
});
