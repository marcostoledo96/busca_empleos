import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Dashboard } from './dashboard';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { DetalleOferta } from '../../componentes/detalle-oferta/detalle-oferta';
import { DemoService } from '../../servicios/demo.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { Oferta } from '../../modelos/oferta.model';

@Component({ selector: 'app-panel-control', template: '' })
class PanelSintetico22 {
    readonly modoDemo = input(false);
    readonly accionCompletada = output<void>();
    readonly evaluacionEnProgreso = output<void>();
    readonly evaluando = signal(false);
    readonly ejecutandoCiclo = signal(false);
    readonly scrapeandoAlguno = signal(false);
    ejecutarEvaluacion(): void {}
}

const historica = (cambios = {}): Oferta => ({
    id: 22, titulo: 'Angular histórica', empresa: 'Empresa sintética', ubicacion: 'Buenos Aires',
    plataforma: 'linkedin', estado_evaluacion: 'rechazada', razon_evaluacion: 'Requiere Java',
    estado_postulacion: 'cv_enviado', porcentaje_match: 30,
    fecha_extraccion: new Date(Date.now() - 45 * 86400000).toISOString(),
    fecha_postulacion: '2026-01-02', nota_postulacion: 'Envié CV; espero respuesta',
    descripcion: 'Descripción sintética suficientemente extensa', url: 'https://example.test',
    datos_crudos: null, modalidad: null, nivel_requerido: null, salario_min: null,
    salario_max: null, moneda: null, fecha_publicacion: null, ...cambios,
} as Oferta);

describe('Issue 22 — seguimiento visible, persistencia y concurrencia', () => {
    let fixture: ComponentFixture<Dashboard>;
    let dashboard: Dashboard;
    let http: HttpTestingController;
    let persistencia: PersistenciaDashboardService;
    const url = 'http://localhost:3000/api/ofertas';
    const buscar = (selector: string): any => fixture.nativeElement.querySelector(selector);
    const renderizar = () => { fixture.detectChanges(); tick(400); fixture.detectChanges(); };
    const detalle = (): DetalleOferta => fixture.debugElement.query(By.directive(DetalleOferta)).componentInstance;
    const abrir = () => { dashboard.mostrarDetalle(dashboard.ofertas()[0]); renderizar(); };
    const editar = (selector: string, valor: string) => {
        const campo = buscar(selector);
        expect(campo).withContext(selector).not.toBeNull();
        if (!campo) return;
        campo.value = valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        renderizar();
    };
    const guardar = () => { buscar('[aria-label="Guardar seguimiento"]').click(); renderizar(); };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        }).overrideComponent(Dashboard, {
            remove: { imports: [PanelControl] }, add: { imports: [PanelSintetico22] },
        }).compileComponents();
        spyOn(Dashboard.prototype, 'ngOnInit');
        persistencia = TestBed.inject(PersistenciaDashboardService);
        await persistencia.limpiarSincronizacion();
        persistencia.limpiarCache();
        fixture = TestBed.createComponent(Dashboard);
        dashboard = fixture.componentInstance;
        dashboard.ofertas.set([historica()]);
        http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => { http.verify(); persistencia.limpiarCache(); });

    it('particiono todos los estados sin duplicar rechazo IA y postulación y distingo descarte manual', fakeAsync(() => {
        const ofertas = [];
        let id = 0;
        for (const estado_evaluacion of ['aprobada', 'rechazada', 'pendiente']) {
            for (const estado_postulacion of ['no_postulado', 'cv_enviado', 'en_proceso', 'descartada']) {
                ofertas.push(historica({ id: ++id, estado_evaluacion, estado_postulacion,
                    evaluacion_error_mensaje: estado_evaluacion === 'pendiente' ? 'Timeout técnico' : null }));
            }
        }
        dashboard.ofertas.set(ofertas); renderizar();
        const categorias = [dashboard.ofertasAprobadas(), dashboard.ofertasPostuladas(),
            dashboard.ofertasRechazadas(), dashboard.ofertasPendientes()];
        // Verifico el quinto contador por el DOM, sin acoplar la prueba a un nuevo método.
        expect(buscar('[aria-labelledby="stat-label-descartadas"]')?.textContent).toContain('3');
        expect(categorias.map(c => c.length)).toEqual([1, 6, 1, 1]);
        expect(new Set(categorias.flat().map(o => o.id)).size).toBe(9);
        expect(fixture.nativeElement.textContent).toContain('RECHAZADAS POR IA');
        expect(fixture.nativeElement.textContent).toContain('DESCARTADAS MANUALMENTE');
        expect(dashboard.statTotal()).toBe(12);
    }));

    it('recupero una histórica desde IndexedDB en una instancia nueva y muestro día, nota e IA independiente', async () => {
        const oferta = historica();
        await persistencia.guardarBloqueSincronizacion([oferta]);
        const reiniciada = new PersistenciaDashboardService();
        dashboard.ofertas.set(await reiniciada.obtenerOfertasSincronizadas());
        dashboard.pestanaActiva.set(1);
        fixture.detectChanges(); await fixture.whenStable();
        dashboard.mostrarDetalle(dashboard.ofertas()[0]);
        fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        expect(buscar('#fecha-postulacion')?.value).toBe('2026-01-02');
        expect(buscar('#nota-postulacion')?.value).toBe('Envié CV; espero respuesta');
        expect(fixture.nativeElement.textContent).toContain('Seguimiento de postulación');
        expect(fixture.nativeElement.textContent).toContain('CV enviado');
        expect(fixture.nativeElement.textContent).toContain('Requiere Java');
        expect(dashboard.statPostuladas()).toBe(1);
        expect(dashboard.statRechazadas()).toBe(0);
    });

    it('fallo HTTP conserva borrador, diálogo y datos guardados; reintento y limpieza son explícitos', fakeAsync(() => {
        abrir(); editar('#fecha-postulacion', '2026-02-03'); editar('#nota-postulacion', 'Llamar el lunes');
        guardar();
        const req = http.expectOne(`${url}/22/seguimiento`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ fecha_postulacion: '2026-02-03', nota_postulacion: 'Llamar el lunes' });
        expect(buscar('[aria-label="Guardar seguimiento"]').disabled).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('Guardando seguimiento');
        expect(fixture.nativeElement.textContent).not.toContain('Seguimiento guardado');
        guardar(); http.expectNone(r => r.method === 'PATCH');
        req.flush({}, { status: 500, statusText: 'Fallo sintético' }); renderizar();
        expect(buscar('[role="alert"]')?.textContent).toContain('No pude guardar el seguimiento');
        expect(buscar('#nota-postulacion').value).toBe('Llamar el lunes');
        expect(buscar('#fecha-postulacion').value).toBe('2026-02-03');
        expect(dashboard.ofertas()[0]).toEqual(historica({ fecha_extraccion: dashboard.ofertas()[0].fecha_extraccion }));
        expect(dashboard.dialogoVisible()).toBeTrue();
        guardar();
        http.expectOne(`${url}/22/seguimiento`).flush({ exito: true, datos: historica({
            fecha_postulacion: '2026-02-03', nota_postulacion: 'Llamar el lunes' }) }); renderizar();
        expect(fixture.nativeElement.textContent).toContain('Seguimiento guardado');
        editar('#fecha-postulacion', ''); editar('#nota-postulacion', ''); guardar();
        const limpiar = http.expectOne(`${url}/22/seguimiento`);
        expect(limpiar.request.body).toEqual({ fecha_postulacion: null, nota_postulacion: null });
        limpiar.flush({ exito: true, datos: historica({ fecha_postulacion: null, nota_postulacion: null }) }); renderizar();
        expect(buscar('#fecha-postulacion').value).toBe('');
        expect(buscar('#nota-postulacion').value).toBe('');
        expect(persistencia.leerCache()?.ofertas[0]).toEqual(jasmine.objectContaining({ fecha_postulacion: null, nota_postulacion: null }));
    }));

    it('respuesta antigua no pisa ediciones posteriores ni el estado cambiado; GET tardío tampoco pisa el seguimiento', fakeAsync(() => {
        abrir();
        dashboard.onProgresoEvaluacion();
        const lectura = http.expectOne(url);
        editar('#nota-postulacion', 'Primera nota'); guardar();
        const escritura = http.expectOne(`${url}/22/seguimiento`);
        editar('#nota-postulacion', 'Segunda nota todavía sin guardar');
        // El control rápido continúa independiente y mantiene su cierre optimista de #21.
        detalle().cambiarPostulacion('en_proceso'); renderizar();
        http.expectOne(`${url}/22/postulacion`).flush({ exito: true, datos: historica({ estado_postulacion: 'en_proceso' }) }); renderizar();
        escritura.flush({ exito: true, datos: historica({ nota_postulacion: 'Primera nota' }) }); renderizar();
        dashboard.dialogoVisible.set(true); renderizar();
        expect(buscar('#nota-postulacion').value).toBe('Segunda nota todavía sin guardar');
        expect(dashboard.ofertas()[0].estado_postulacion).toBe('en_proceso');
        lectura.flush({ exito: true, datos: [historica()] }); renderizar();
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({
            estado_postulacion: 'en_proceso', nota_postulacion: 'Primera nota', fecha_postulacion: '2026-01-02' }));
        expect(persistencia.leerCache()?.ofertas[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Primera nota' }));
        expect(buscar('#nota-postulacion').value).toBe('Segunda nota todavía sin guardar');
        expect(fixture.nativeElement.textContent).not.toContain('Seguimiento guardado');
    }));

    it('cambiar de oferta durante PATCH no cambia el editor ni los mensajes de la nueva oferta', fakeAsync(() => {
        abrir(); editar('#nota-postulacion', 'Nota oferta anterior'); guardar();
        const req = http.expectOne(`${url}/22/seguimiento`);
        dashboard.ofertas.update(ofertas => [...ofertas, historica({ id: 23, nota_postulacion: 'Otra nota' })]);
        dashboard.mostrarDetalle(dashboard.ofertas()[1]); renderizar();
        req.flush({ exito: true, datos: historica({ nota_postulacion: 'Nota oferta anterior' }) }); renderizar();
        expect(buscar('#nota-postulacion').value).toBe('Otra nota');
        expect(fixture.nativeElement.textContent).not.toContain('Seguimiento guardado');
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Nota oferta anterior' }));
    }));

    it('un PATCH de descripción tardío no elimina seguimiento ni estado actualizado', fakeAsync(() => {
        abrir();
        buscar('[aria-label="Completar o editar descripción"]').click(); renderizar();
        editar('[aria-label="Editor de descripción de la oferta"]', 'Nueva descripción suficientemente extensa');
        buscar('[aria-label="Guardar descripción"]').click(); renderizar();
        const descripcion = http.expectOne(`${url}/22/descripcion`);
        editar('#nota-postulacion', 'Nota guardada durante descripción'); guardar();
        http.expectOne(`${url}/22/seguimiento`).flush({ exito: true, datos: historica({ nota_postulacion: 'Nota guardada durante descripción' }) }); renderizar();
        detalle().cambiarPostulacion('en_proceso'); renderizar();
        http.expectOne(`${url}/22/postulacion`).flush({ exito: true, datos: historica({ estado_postulacion: 'en_proceso' }) }); renderizar();
        descripcion.flush({ exito: true, datos: historica({ descripcion: 'Nueva descripción suficientemente extensa' }) }); renderizar();
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({
            estado_postulacion: 'en_proceso', fecha_postulacion: '2026-01-02', nota_postulacion: 'Nota guardada durante descripción',
            descripcion: 'Nueva descripción suficientemente extensa',
        }));
    }));

    for (const fallo of ['logico', 'red']) {
        it(`conservo borrador y datos frente a fallo ${fallo}`, fakeAsync(() => {
            abrir(); editar('#nota-postulacion', 'Borrador conservado'); guardar();
            const req = http.expectOne(`${url}/22/seguimiento`);
            if (fallo === 'logico') req.flush({ exito: false, error: 'Fallo sintético' });
            else req.error(new ProgressEvent('error'));
            renderizar();
            expect(buscar('[role="alert"]')?.textContent).toContain('No pude guardar');
            expect(buscar('#nota-postulacion').value).toBe('Borrador conservado');
            expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Envié CV; espero respuesta' }));
            expect(dashboard.dialogoVisible()).toBeTrue();
            expect(buscar('[aria-label="Guardar seguimiento"]').disabled).toBeFalse();
            expect(fixture.nativeElement.textContent).not.toContain('Seguimiento guardado');
        }));
    }

    it('la categoría de descarte manual admite selección masiva sin perder fecha ni nota', fakeAsync(() => {
        spyOn(dashboard, 'cargarDatos');
        dashboard.ofertas.set([historica({ estado_postulacion: 'descartada' })]); renderizar();
        fixture.nativeElement.querySelectorAll('p-tab')[4].click(); renderizar();
        const panel = buscar('p-tabpanel:not([hidden])');
        panel.querySelector('thead input[type=checkbox]').click(); renderizar();
        dashboard.onAccionMasiva({ ids: [22], estadoPostulacion: 'en_proceso' });
        http.expectOne(`${url}/bulk/postulacion`).flush({ exito: true, datos: { actualizadas: 1 } }); renderizar();
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({
            estado_postulacion: 'en_proceso', fecha_postulacion: '2026-01-02', nota_postulacion: 'Envié CV; espero respuesta' }));
        expect(dashboard.statDescartadas()).toBe(0);
        expect(dashboard.statPostuladas()).toBe(1);
    }));

    it('informo un fallo aunque haya una edición posterior, sin perder ese borrador', fakeAsync(() => {
        abrir(); editar('#nota-postulacion', 'Nota enviada'); guardar();
        const req = http.expectOne(`${url}/22/seguimiento`);
        editar('#nota-postulacion', 'Edición posterior que debo conservar');
        req.flush({}, { status: 500, statusText: 'Fallo sintético' }); renderizar();
        expect(buscar('#nota-postulacion').value).toBe('Edición posterior que debo conservar');
        expect(buscar('[role="alert"]')?.textContent).toContain('No pude guardar');
        expect(buscar('[aria-label="Guardar seguimiento"]').disabled).toBeFalse();
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Envié CV; espero respuesta' }));
    }));

    it('un bloque tardío no degrada el seguimiento en pantalla ni en el snapshot persistido', fakeAsync(() => {
        let snapshot: Oferta[] = [];
        spyOn(persistencia, 'limpiarSincronizacion').and.resolveTo();
        spyOn(persistencia, 'guardarBloqueSincronizacion').and.callFake(async ofertas => {
            snapshot = structuredClone(ofertas);
            return { fallback: false, total: ofertas.length };
        });
        spyOn(persistencia, 'obtenerOfertasSincronizadas').and.callFake(async () => structuredClone(snapshot));
        dashboard.filtroPlataforma.set('linkedin'); dashboard.pestanaActiva.set(1);
        abrir(); dashboard.cargarDatos(); renderizar();
        const lectura = http.expectOne(`${url}/sincronizacion?limite=500`);
        editar('#nota-postulacion', 'Nota antes de recibir bloque'); guardar();
        http.expectOne(`${url}/22/seguimiento`).flush({ exito: true, datos: historica({ nota_postulacion: 'Nota antes de recibir bloque' }) }); renderizar();
        lectura.flush({ exito: true, datos: [historica()], completada: true, cursor_siguiente: null,
            fecha_corte: new Date().toISOString(), max_id: 22, total_inicial: 1 }); renderizar();
        expect(snapshot[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Nota antes de recibir bloque' }));
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Nota antes de recibir bloque' }));
        expect(persistencia.leerCache()?.ofertas[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Nota antes de recibir bloque' }));
        expect(dashboard.filtroPlataforma()).toBe('linkedin');
        expect(dashboard.pestanaActiva()).toBe(1);
        expect(dashboard.estadoOperativoSincronizacion()?.estado).toBe('completada');
    }));

    it('la conciliación de bulk conserva una nota confirmada durante su GET y acepta el estado fresco', fakeAsync(() => {
        dashboard.pestanaActiva.set(1); abrir();
        dashboard.onAccionMasiva({ ids: [22], estadoPostulacion: 'en_proceso' });
        http.expectOne(`${url}/bulk/postulacion`).flush({ exito: true, datos: { actualizadas: 0 } }); renderizar();
        const conciliacion = http.expectOne(url);
        editar('#nota-postulacion', 'Nota confirmada durante conciliación'); guardar();
        http.expectOne(`${url}/22/seguimiento`).flush({ exito: true, datos: historica({ nota_postulacion: 'Nota confirmada durante conciliación' }) }); renderizar();
        conciliacion.flush({ exito: true, datos: [historica({ estado_postulacion: 'en_proceso' })] }); renderizar();
        expect(dashboard.ofertas()[0]).toEqual(jasmine.objectContaining({
            estado_postulacion: 'en_proceso', fecha_postulacion: '2026-01-02', nota_postulacion: 'Nota confirmada durante conciliación' }));
        expect(persistencia.leerCache()?.ofertas[0]).toEqual(jasmine.objectContaining({ nota_postulacion: 'Nota confirmada durante conciliación' }));
        expect(buscar('#nota-postulacion').value).toBe('Nota confirmada durante conciliación');
        expect(dashboard.accionMasivaEnCurso()).toBeFalse();
    }));

    it('sin fecha conocida queda vacío y el límite de nota impide envío', fakeAsync(() => {
        dashboard.ofertas.set([historica({ fecha_postulacion: null, nota_postulacion: null })]);
        abrir();
        expect(buscar('#fecha-postulacion').value).toBe('');
        editar('#nota-postulacion', 'a'.repeat(4001)); guardar();
        http.expectNone(r => r.method === 'PATCH');
        expect(fixture.nativeElement.textContent).toContain('4000');
    }));
});
