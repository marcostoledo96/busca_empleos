import { TestBed, ComponentFixture, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Dashboard } from './dashboard';
import { DemoService } from '../../servicios/demo.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { Oferta } from '../../modelos/oferta.model';
import { environment } from '../../../environments/environment';
import { By } from '@angular/platform-browser';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { MessageService } from 'primeng/api';

// Integro componentes y servicios reales con HTTP sintético; no es un puente Express.
describe('Búsquedas — panel y dashboard con HTTP', () => {
    let fixture: ComponentFixture<Dashboard>;
    let http: HttpTestingController;
    let acumuladas: Oferta[];
    const base = environment.urlApi;
    const resumen = {
        plataforma: 'linkedin', nombre: 'LinkedIn', habilitada: true, ejecutable: true,
        terminos: ['soporte IT', 'mesa de ayuda'], ubicacion: ['CABA'], ventanaDias: 14,
        maxResultados: 100, filtros: { nivelesExperiencia: ['entry_level'] },
        advertencias: ['Filtro declarado por el backend'],
        origen: { terminos: 'preferencias', ubicacion: 'preferencias' },
    };
    const oferta = (id: number): Oferta => ({
        id, titulo: `Soporte nuevo ${id}`, empresa: 'Empresa sintética', ubicacion: 'CABA',
        modalidad: 'remoto', descripcion: null, url: `https://example.com/${id}`,
        plataforma: 'linkedin', nivel_requerido: null, salario_min: null, salario_max: null,
        moneda: null, estado_evaluacion: 'aprobada', razon_evaluacion: null,
        porcentaje_match: 85, estado_postulacion: 'no_postulado', fecha_publicacion: null,
        fecha_extraccion: new Date().toISOString(), datos_crudos: null,
    });
    function bloque(datos: Oferta[]): void {
        http.expectOne(r => r.url === `${base}/ofertas/sincronizacion`).flush({
            exito: true, datos, total: datos.length, fecha_corte: new Date().toISOString(),
            max_id: datos.length, total_inicial: datos.length, cursor_siguiente: null, completada: true,
        });
        flushMicrotasks();
        fixture.detectChanges();
    }
    function iniciar(): void {
        fixture.detectChanges();
        http.expectOne(`${base}/preferencias`).flush({ exito: true, datos: {} });
        http.expectOne(`${base}/automatizacion/estado`).flush({ exito: true, datos: {
            activo: false, ultimaEjecucion: null, ultimoResultado: null,
        } });
        http.expectOne(`${base}/evaluacion/progreso`).flush({ exito: true, datos: { activo: false, errores: 0 } });
        http.expectOne(`${base}/automatizacion/progreso`).flush({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } });
        http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [resumen] } });
        flushMicrotasks();
        bloque([]);
    }
    beforeEach(async () => {
        acumuladas = [];
        await TestBed.configureTestingModule({
            imports: [Dashboard], providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } },
                { provide: PersistenciaDashboardService, useValue: {
                    leerCache: () => null, guardarCache: () => {},
                    limpiarSincronizacion: async () => { acumuladas = []; },
                    guardarBloqueSincronizacion: async (datos: Oferta[]) => {
                        acumuladas.push(...datos); return { fallback: false, total: acumuladas.length };
                    },
                    obtenerOfertasSincronizadas: async () => acumuladas,
                } },
            ],
        }).compileComponents();
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(Dashboard);
    });
    afterEach(() => { fixture.destroy(); http.verify(); });

    it('guardo preferencias, extraigo con botón real y veo ofertas nuevas y conteos', fakeAsync(() => {
        iniciar();
        TestBed.inject(PreferenciasService).actualizarPreferencias({ terminos_busqueda: ['mesa de ayuda'] }).subscribe();
        http.expectOne(`${base}/preferencias`).flush({ exito: true, datos: { terminos_busqueda: ['mesa de ayuda'] } });
        fixture.nativeElement.querySelector('button[aria-label="Scrapear LinkedIn"]').click();
        http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: true, datos: {
            plataformas: [{ ...resumen, terminos: ['mesa de ayuda'] }],
        } });
        const ejecucion = http.expectOne(`${base}/scraping/linkedin`);
        expect(ejecucion.request.body).toEqual({});
        ejecucion.flush({ exito: true, datos: { ofertas_nuevas: 1, total_extraidas: 1,
            configuracion: { ...resumen, terminos: ['mesa de ayuda'] }, descartadas_por_idioma: 0 } });
        flushMicrotasks();
        bloque([oferta(1)]);
        expect(fixture.nativeElement.textContent).toContain('Soporte nuevo 1');
        expect(fixture.nativeElement.querySelector('[aria-labelledby="stat-label-total"]').textContent.trim()).toBe('1');
        expect(fixture.nativeElement.textContent).toContain('mesa de ayuda');
        tick(6000);
    }));

    for (const ciclo of [false, true]) {
        for (const falla of [false, true]) {
            it(`descarto preview tardío (${ciclo ? 'ciclo' : 'individual'}, ${falla ? 'error' : 'éxito'}) durante evaluación aceptada`, fakeAsync(() => {
                iniciar();
                const elemento = fixture.debugElement.query(By.directive(PanelControl));
                const panel = elemento.componentInstance as PanelControl;
                const evento = spyOn(panel.accionCompletada, 'emit');
                const mensajes = spyOn(elemento.injector.get(MessageService), 'add');
                if (ciclo) panel.ejecutarCicloCompleto();
                else panel.scrapearLinkedin();
                const pendiente = http.expectOne(`${base}/scraping/previsualizacion`);
                fixture.detectChanges();
                expect(fixture.nativeElement.querySelector('button[aria-label="Evaluar ofertas pendientes con IA"]').disabled).toBeTrue();
                // Una llamada externa o rehidratación puede aceptar evaluación mientras el GET espera.
                panel.ejecutarEvaluacion();
                http.expectOne(`${base}/evaluacion/ejecutar`).flush({ exito: true, en_curso: true });
                expect(panel.evaluando()).toBeTrue();
                if (falla) pendiente.flush({}, { status: 503, statusText: 'Unavailable' });
                else pendiente.flush({ exito: true, datos: { plataformas: [resumen] } });
                http.expectNone(`${base}/scraping/linkedin`);
                http.expectNone(`${base}/automatizacion/ejecutar`);
                expect(panel.cargandoPrevisualizacion()).toBeFalse();
                expect(panel.errorPrevisualizacion()).toBeNull();
                expect(evento).not.toHaveBeenCalled();
                expect(mensajes).not.toHaveBeenCalled();
                fixture.destroy();
            }));
        }
    }

    it('conservo selección manual cuando llegan ofertas frescas', fakeAsync(() => {
        iniciar();
        fixture.componentInstance.cargarDatos();
        flushMicrotasks();
        bloque([oferta(1)]);
        const casilla = fixture.nativeElement.querySelector('input[aria-label="Seleccionar Soporte nuevo 1"]');
        casilla.click();
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('1 oferta seleccionada');
        fixture.componentInstance.cargarDatos();
        flushMicrotasks();
        bloque([oferta(1), oferta(2)]);
        expect(fixture.nativeElement.querySelector('input[aria-label="Seleccionar Soporte nuevo 1"]').checked).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('1 oferta seleccionada');
    }));

    it('preview fallido comunica el problema y no inicia HTTP de extracción', fakeAsync(() => {
        iniciar();
        fixture.nativeElement.querySelector('button[aria-label="Scrapear LinkedIn"]').click();
        http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: false, error: 'Falla sintética' }, { status: 503, statusText: 'Unavailable' });
        fixture.detectChanges();
        http.expectNone(`${base}/scraping/linkedin`);
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No inicié');
        expect(fixture.nativeElement.textContent).not.toContain('Consultando configuración guardada...');
    }));

    it('muestro filtros, advertencias y umbral literalmente, sin activar fuentes inactivas', fakeAsync(() => {
        iniciar();
        fixture.nativeElement.querySelector('.busqueda-resumen button').click();
        const advertencia = 'maxResultados es un umbral de acumulación, no un límite estricto: puedo superar 50.';
        http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [
            { ...resumen, plataforma: 'remoteok', nombre: 'RemoteOK', maxResultados: 50,
                terminos: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'sexto'], ventanaDias: null,
                ubicacion: [], filtros: { categoria: 'support' }, advertencias: [advertencia] },
            { ...resumen, plataforma: 'getonbrd', nombre: 'GetOnBrd', habilitada: false,
                ejecutable: false, maxResultados: null, advertencias: ['Destino bloqueado'] },
        ] } });
        fixture.detectChanges();
        fixture.nativeElement.querySelector('.busqueda-resumen summary').click();
        const texto = fixture.nativeElement.querySelector('.busqueda-resumen').textContent;
        expect(texto).toContain(advertencia);
        expect(texto).toContain('support');
        expect(texto).toContain('No aplica');
        expect(texto).toContain('Sin ubicación aplicable');
        expect(texto).toContain('Sin valor configurable');
        expect(texto).toContain('Deshabilitada');
        expect(texto).toContain('(+1 más)');
        expect(texto).not.toContain('sexto');
        expect(fixture.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]')).toBeNull();
    }));

    it('cuando fallan sincronización y fallback conservo datos anteriores sin fingir actualización', fakeAsync(() => {
        iniciar();
        fixture.componentInstance.ofertas.set([oferta(1)]);
        fixture.componentInstance.cargarDatos();
        flushMicrotasks();
        http.expectOne(r => r.url === `${base}/ofertas/sincronizacion`).flush({}, { status: 500, statusText: 'Error' });
        flushMicrotasks();
        http.expectOne(`${base}/ofertas`).flush({}, { status: 500, statusText: 'Error' });
        flushMicrotasks();
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Soporte nuevo 1');
        expect(fixture.nativeElement.textContent).toContain('No pude actualizar');
        expect(fixture.componentInstance.datosDesdeCache()).toBeTrue();
        expect(fixture.componentInstance.estadoOperativoSincronizacion()?.estado).toBe('fallida');
        expect(fixture.componentInstance.sincronizando()).toBeFalse();
    }));

    it('el ciclo aceptado conserva su snapshot y al terminar refresca ofertas y conteos', fakeAsync(() => {
        iniciar();
        fixture.nativeElement.querySelector('button[aria-label="Ejecutar ciclo completo de scraping y evaluación"]').click();
        http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [resumen] } });
        http.expectOne(`${base}/automatizacion/ejecutar`).flush({ exito: true, datos: { configuracion: [resumen] } }, { status: 202, statusText: 'Accepted' });
        tick(2500);
        http.expectOne(`${base}/automatizacion/progreso`).flush({ exito: true, datos: {
            activo: false, porcentaje: 100, configuracion: [resumen],
            pasos: [{ nombre: 'linkedin', label: 'LinkedIn', estado: 'completada', extraidas: 2 }],
        } });
        tick(1200);
        flushMicrotasks();
        bloque([oferta(1), oferta(2)]);
        expect(fixture.nativeElement.textContent).toContain('Soporte nuevo 2');
        expect(fixture.nativeElement.querySelector('[aria-labelledby="stat-label-total"]').textContent.trim()).toBe('2');
        expect(fixture.nativeElement.textContent).toContain('Configuración del ciclo');
        tick(6000);
    }));
});
