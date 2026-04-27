import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PanelControl } from './panel-control';
import { ScrapingService } from '../../servicios/scraping.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { AutomatizacionService } from '../../servicios/automatizacion.service';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

describe('PanelControl — Selector mobile de scraping', () => {

    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;

    const mockScrapingService = {
        scrapearLinkedin:     () => of({ exito: true, datos: { total_extraidas: 5, ofertas_nuevas: 3 } }),
        scrapearComputrabajo: () => of({ exito: true, datos: { total_extraidas: 2, ofertas_nuevas: 1 } }),
        scrapearIndeed:       () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0 } }),
        scrapearBumeran:      () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearGlassdoor:    () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearGetonbrd:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearJooble:       () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearGoogleJobs:   () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearRemotive:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearRemoteOK:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearInfojobs:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
    };

    const mockEvaluacionService = {
        ejecutarEvaluacion: () => of({ exito: true }),
        cancelarEvaluacion: () => of({ exito: true }),
        obtenerProgreso:    () => of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, porcentaje: 0 } }),
    };

    const mockAutomatizacionService = {
        obtenerEstado:  () => of({ exito: true, datos: { activo: false, ultimaEjecucion: null } }),
        iniciarCron:    () => of({ exito: true, datos: { activo: true, ultimaEjecucion: null } }),
        detenerCron:    () => of({ exito: true }),
        obtenerProgreso:() => of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } }),
        ejecutarCiclo:  () => of({ exito: true }),
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService,       useValue: mockScrapingService },
                { provide: EvaluacionService,     useValue: mockEvaluacionService },
                { provide: AutomatizacionService, useValue: mockAutomatizacionService },
                MessageService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    // --- Plataforma seleccionada por defecto ---

    it('debería crear el componente', () => {
        expect(component).toBeTruthy();
    });

    it('la plataforma seleccionada por defecto debería ser linkedin', () => {
        expect(component.plataformaSeleccionada()).toBe('linkedin');
    });

    // --- Sincronización del modelo two-way con la signal ---

    it('plataformaSeleccionadaModel setter actualiza la signal', () => {
        component.plataformaSeleccionadaModel = 'indeed';
        expect(component.plataformaSeleccionada()).toBe('indeed');
    });

    it('plataformaSeleccionadaModel getter refleja el valor de la signal', () => {
        component.plataformaSeleccionada.set('bumeran');
        expect(component.plataformaSeleccionadaModel).toBe('bumeran');
    });

    // --- opciones del p-select ---

    it('opcionesPlataforma debería contener las 11 plataformas', () => {
        expect(component.opcionesPlataforma.length).toBe(11);
    });

    it('opcionesPlataforma debería incluir LinkedIn con valor linkedin', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'linkedin');
        expect(opcion).toBeTruthy();
        expect(opcion!.label).toBe('LinkedIn');
    });

    it('opcionesPlataforma no debería incluir plataformas sin value ni label', () => {
        const invalidas = component.opcionesPlataforma.filter(o => !o.value || !o.label);
        expect(invalidas.length).toBe(0);
    });

    // --- Dispatcher de scraping ---

    it('scrapearPlataformaSeleccionada() con linkedin llama a scrapearLinkedin()', () => {
        spyOn(component, 'scrapearLinkedin');
        component.plataformaSeleccionada.set('linkedin');
        component.scrapearPlataformaSeleccionada();
        expect(component.scrapearLinkedin).toHaveBeenCalled();
    });

    it('scrapearPlataformaSeleccionada() con computrabajo llama a scrapearComputrabajo()', () => {
        spyOn(component, 'scrapearComputrabajo');
        component.plataformaSeleccionada.set('computrabajo');
        component.scrapearPlataformaSeleccionada();
        expect(component.scrapearComputrabajo).toHaveBeenCalled();
    });

    it('scrapearPlataformaSeleccionada() con indeed llama a scrapearIndeed()', () => {
        spyOn(component, 'scrapearIndeed');
        component.plataformaSeleccionada.set('indeed');
        component.scrapearPlataformaSeleccionada();
        expect(component.scrapearIndeed).toHaveBeenCalled();
    });

    // --- Estado de carga ---

    it('scrapeandoAlguno() debería ser false por defecto', () => {
        expect(component.scrapeandoAlguno()).toBeFalse();
    });

    it('scrapeandoAlguno() debería ser true cuando scrapeandoLinkedin es true', () => {
        component.scrapeandoLinkedin.set(true);
        expect(component.scrapeandoAlguno()).toBeTrue();
    });

    // --- Etiquetas para aria-label ---

    it('etiquetasPorPlataforma debería tener etiqueta para linkedin', () => {
        expect(component.etiquetasPorPlataforma['linkedin']).toBe('LinkedIn');
    });

    it('etiquetasPorPlataforma debería tener etiqueta para googlejobs', () => {
        expect(component.etiquetasPorPlataforma['googlejobs']).toBe('Google Jobs');
    });

    it('opcionesPlataforma debería incluir InfoJobs con valor infojobs', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'infojobs');
        expect(opcion).toBeTruthy();
        expect(opcion!.label).toBe('InfoJobs');
    });

    it('etiquetasPorPlataforma debería tener etiqueta para infojobs', () => {
        expect(component.etiquetasPorPlataforma['infojobs']).toBe('InfoJobs');
    });

    it('scrapearPlataformaSeleccionada() con infojobs llama a scrapearInfojobs()', () => {
        spyOn(component, 'scrapearInfojobs');
        component.plataformaSeleccionada.set('infojobs');
        component.scrapearPlataformaSeleccionada();
        expect(component.scrapearInfojobs).toHaveBeenCalled();
    });

    it('scrapeandoAlguno() debería ser true cuando scrapeandoInfojobs es true', () => {
        component.scrapeandoInfojobs.set(true);
        expect(component.scrapeandoAlguno()).toBeTrue();
    });

    // --- Visibilidad del selector mobile en el DOM ---

    it('el bloque .scraping-selector-mobile debería existir en el template', () => {
        const el = fixture.nativeElement.querySelector('.scraping-selector-mobile');
        expect(el).toBeTruthy();
    });

    it('los botones .scraping-solo-desktop deberían existir en el template', () => {
        const botones = fixture.nativeElement.querySelectorAll('.scraping-solo-desktop');
        expect(botones.length).toBe(11);
    });

    it('el p-select del selector mobile debería existir en el template', () => {
        const selectEl = fixture.nativeElement.querySelector('p-select');
        expect(selectEl).toBeTruthy();
    });
});
