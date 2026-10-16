import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Dashboard } from './dashboard';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { TablaOfertas } from '../../componentes/tabla-ofertas/tabla-ofertas';
import { DetalleOferta } from '../../componentes/detalle-oferta/detalle-oferta';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { DemoService } from '../../servicios/demo.service';
import { Oferta } from '../../modelos/oferta.model';

// Aíslo scraping/polling del panel; tabla, diálogo, toast y HTTP de ofertas son reales.
@Component({ selector: 'app-panel-control', template: '' })
class PanelSintetico {
    readonly modoDemo = input(false);
    readonly accionCompletada = output<void>();
    readonly evaluacionEnProgreso = output<void>();
    readonly evaluando = signal(false);
    readonly ejecutandoCiclo = signal(false);
    readonly scrapeandoAlguno = signal(false);
    ejecutarEvaluacion(): void {}
}

const crearOfertas = (cantidad = 45): Oferta[] => Array.from({ length: cantidad }, (_, i) => ({
    id: i + 1, titulo: `${i < 7 ? 'Angular' : 'React'} ${i + 1}`, empresa: 'Empresa sintética',
    ubicacion: 'Buenos Aires', plataforma: 'linkedin', estado_evaluacion: 'aprobada',
    estado_postulacion: 'no_postulado', porcentaje_match: 100 - i,
    fecha_extraccion: new Date().toISOString(), descripcion: 'Descripción manual sin cambios',
    url: 'https://example.test', datos_crudos: null,
} as Oferta));

describe('Issue 21 — integración dashboard, tabla y detalle', () => {
    let fixture: ComponentFixture<Dashboard>;
    let dashboard: Dashboard;
    let http: HttpTestingController;
    let sincronizadas: Oferta[];
    const url = 'http://localhost:3000/api/ofertas';
    const buscar = (selector: string): any => selector === 'p-toast' || selector.startsWith('p-tabpanel')
        ? fixture.nativeElement.querySelector(selector)
        : (fixture.nativeElement.querySelector('p-tabpanel:not([hidden])') ?? fixture.nativeElement).querySelector(selector);
    const renderizar = () => { fixture.detectChanges(); tick(400); fixture.detectChanges(); };
    const tabla = (): TablaOfertas => fixture.debugElement.queryAll(By.directive(TablaOfertas))
        .find(elemento => !elemento.nativeElement.closest('p-tabpanel')?.hidden)!.componentInstance;
    const detalle = (): DetalleOferta => fixture.debugElement.query(By.directive(DetalleOferta)).componentInstance;
    const filtrar = (texto: string) => {
        const campo = buscar('#filtro-busqueda-input');
        campo.value = texto;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        renderizar();
    };
    const seleccionar = () => { buscar('thead input[type=checkbox]').click(); renderizar(); };
    const aplicar = () => {
        tabla().estadoBulkSeleccionado = 'en_proceso';
        renderizar();
        buscar('[aria-label="Aplicar acción masiva"]').click();
        renderizar();
    };
    const aviso = (texto: string) => {
        const toast = buscar('p-toast');
        expect(toast?.textContent).toContain(texto);
        expect(toast?.querySelector('[role="alert"]')).not.toBeNull();
    };

    const iniciarParcialPostuladas = (cantidad = 2) => {
        dashboard.ofertas.set(crearOfertas(3).map(o => ({ ...o, estado_postulacion: 'cv_enviado' })));
        renderizar();
        fixture.nativeElement.querySelectorAll('p-tab')[1].click(); renderizar();
        seleccionar(); aplicar();
        const escritura = http.expectOne(`${url}/bulk/postulacion`);
        expect(escritura.request.body).toEqual({ ids: [1, 2, 3], estado_postulacion: 'en_proceso' });
        escritura.flush({ exito: true, datos: { actualizadas: cantidad } }); renderizar();
        return crearOfertas(3).map(o => ({ ...o,
            estado_postulacion: o.id <= cantidad ? 'en_proceso' : 'cv_enviado' } as Oferta));
    };
    const responderConciliacion = (datos: Oferta[]) => {
        const lectura = http.expectOne(r => r.method === 'GET' && r.url.startsWith(url));
        expect(lectura.request.url).toBe(url);
        lectura.flush({ exito: true, datos, total_inicial: datos.length, max_id: 45,
            completada: true, cursor_siguiente: null, fecha_corte: '2026-10-01' });
        renderizar();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } },
                { provide: PersistenciaDashboardService, useValue: {
                    guardarCache: jasmine.createSpy('guardarCache'), leerCache: () => null,
                    limpiarSincronizacion: async () => { sincronizadas = []; },
                    guardarBloqueSincronizacion: async (datos: Oferta[]) => {
                        sincronizadas = datos;
                        return { fallback: false };
                    },
                    obtenerOfertasSincronizadas: async () => sincronizadas,
                } }],
        }).overrideComponent(Dashboard, {
            remove: { imports: [PanelControl] }, add: { imports: [PanelSintetico] },
        }).compileComponents();
        spyOn(Dashboard.prototype, 'ngOnInit');
        fixture = TestBed.createComponent(Dashboard);
        dashboard = fixture.componentInstance;
        dashboard.ofertas.set(crearOfertas());
        http = TestBed.inject(HttpTestingController);
        const original = window.matchMedia.bind(window);
        spyOn(window, 'matchMedia').and.callFake(consulta => consulta === '(max-width: 768px)'
            ? ({ matches: false } as MediaQueryList) : original(consulta));
    });
    afterEach(() => http.verify());

    it('filtro real → selección → 500 visible → conservo → reintento → confirmación completa', fakeAsync(() => {
        const refrescar = spyOn(dashboard, 'cargarDatos');
        renderizar(); filtrar('Angular'); seleccionar(); aplicar();
        const req = http.expectOne(`${url}/bulk/postulacion`);
        expect(req.request.body).toEqual({ ids: [1, 2, 3, 4, 5, 6, 7], estado_postulacion: 'en_proceso' });
        expect(buscar('[aria-label="Aplicar acción masiva"]').disabled).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('Procesando');
        expect(buscar('p-toast')?.textContent || '').not.toContain('actualizadas');
        dashboard.onAccionMasiva({ ids: [1], estadoPostulacion: 'en_proceso' });
        http.expectNone(r => r.method === 'PATCH');
        req.flush({}, { status: 500, statusText: 'Error sintético' }); renderizar();
        aviso('no se guardó');
        expect(tabla().seleccionadas().size).toBe(7);
        expect(dashboard.ofertas().every(o => o.estado_postulacion === 'no_postulado')).toBeTrue();
        aplicar();
        http.expectOne(`${url}/bulk/postulacion`).flush({ exito: true, datos: { actualizadas: 7 } }); renderizar();
        aviso('7 ofertas actualizadas');
        expect(tabla().seleccionadas().size).toBe(0);
        expect(dashboard.ofertas().filter(o => o.estado_postulacion === 'en_proceso').map(o => o.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(buscar('#filtro-busqueda-input').value).toBe('Angular');
        expect(refrescar).toHaveBeenCalledTimes(1);
    }));

    it('PrimeNG filtra y pagina antes de enviar sólo los IDs de esa página', fakeAsync(() => {
        renderizar(); filtrar('React'); buscar('.p-paginator-next').click(); renderizar(); seleccionar(); aplicar();
        const req = http.expectOne(`${url}/bulk/postulacion`);
        expect(req.request.body.ids).toEqual(Array.from({ length: 18 }, (_, i) => i + 28));
        req.flush({ exito: false }); renderizar();
        aviso('no se guardó');
        expect(tabla().seleccionadas().size).toBe(18);
    }));

    it('invalido selección al cambiar plataforma y pestaña; el padre rechaza IDs ocultos o inválidos', fakeAsync(() => {
        renderizar(); seleccionar();
        dashboard.filtroPlataforma.set('indeed'); renderizar();
        expect(tabla().seleccionadas().size).toBe(0);
        dashboard.onAccionMasiva({ ids: [1], estadoPostulacion: 'cv_enviado' });
        http.expectNone(r => r.method === 'PATCH');
        buscar('app-tabla-ofertas button')?.click(); renderizar();
        dashboard.filtroPlataforma.set(null); renderizar(); seleccionar();
        const tabs = fixture.nativeElement.querySelectorAll('p-tab');
        tabs[1].click(); renderizar(); tabs[0].click(); renderizar();
        expect(tabla().seleccionadas().size).toBe(0);
        for (const evento of [{ ids: [], estadoPostulacion: 'cv_enviado' },
            { ids: [0, -1, 1.2, 999], estadoPostulacion: 'cv_enviado' },
            { ids: [1], estadoPostulacion: 'inventado' }]) dashboard.onAccionMasiva(evento);
        http.expectNone(r => r.method === 'PATCH');
    }));

    it('limpiar filtros restablece plataforma y texto real; separo vacío global y categoría', fakeAsync(() => {
        renderizar(); filtrar('inexistente'); dashboard.filtroPlataforma.set('linkedin'); renderizar();
        expect(fixture.nativeElement.textContent).toContain('No hay ofertas que coincidan con los filtros actuales');
        const limpiar = [...fixture.nativeElement.querySelectorAll('button')].find((boton: any) => boton.textContent.trim() === 'Limpiar filtros') as HTMLButtonElement;
        limpiar.click(); renderizar();
        expect(dashboard.filtroPlataforma()).toBeNull();
        expect(buscar('#filtro-busqueda-input').value).toBe('');
        fixture.nativeElement.querySelectorAll('p-tab')[1].click(); renderizar();
        expect(fixture.nativeElement.textContent).toContain('Esta categoría no tiene ofertas disponibles');
        dashboard.ofertas.set([]); renderizar();
        dashboard.mensajeEstado.set('No pude sincronizar; conservo caché'); renderizar();
        expect(fixture.nativeElement.textContent).toContain('No hay ofertas guardadas');
        expect(fixture.nativeElement.textContent).toContain('No pude sincronizar; conservo caché');
    }));

    for (const fallo of ['false', '500', 'red']) {
        it(`detalle ${fallo}: cierro optimista, bloqueo mismo ID en tabla, revierto y notifico fuera del diálogo`, fakeAsync(() => {
            renderizar();
            const oferta = dashboard.ofertas()[0];
            dashboard.mostrarDetalle(oferta); renderizar();
            detalle().cambiarPostulacion('cv_enviado'); renderizar();
            expect(dashboard.dialogoVisible()).toBeFalse();
            expect(oferta.estado_postulacion).toBe('cv_enviado');
            expect(dashboard.postulacionesPendientes().has(1)).toBeTrue();
            tabla().cambiarPostulacion(oferta, 'en_proceso');
            detalle().cambiarPostulacion('en_proceso');
            dashboard.onAccionMasiva({ ids: [2], estadoPostulacion: 'en_proceso' });
            const req = http.expectOne(`${url}/1/postulacion`);
            http.expectNone(r => r.method === 'PATCH');
            if (fallo === 'false') req.flush({ exito: false });
            else if (fallo === '500') req.flush({}, { status: 500, statusText: 'Fallo' });
            else req.error(new ProgressEvent('error'));
            renderizar();
            expect(oferta.estado_postulacion).toBe('no_postulado');
            expect(dashboard.ofertas()[1].estado_postulacion).toBe('no_postulado');
            expect(dashboard.postulacionesPendientes().size).toBe(0);
            aviso('El cambio de postulación no se guardó');
        }));
    }

    it('confirmo detalle sólo después del backend y bloqueo detalle durante un cambio de tabla', fakeAsync(() => {
        renderizar(); const oferta = dashboard.ofertas()[0];
        dashboard.mostrarDetalle(oferta); renderizar();
        tabla().cambiarPostulacion(oferta, 'en_proceso'); renderizar();
        detalle().cambiarPostulacion('cv_enviado');
        const req = http.expectOne(`${url}/1/postulacion`);
        http.expectNone(r => r.method === 'PATCH');
        req.flush({ exito: true, datos: { estado_postulacion: 'en_proceso' } }); renderizar();
        aviso('Postulación actualizada: En proceso');
        detalle().cambiarPostulacion('cv_enviado'); renderizar();
        http.expectOne(`${url}/1/postulacion`).flush({ exito: true, datos: { estado_postulacion: 'cv_enviado' } }); renderizar();
        aviso('Postulación actualizada: CV enviado');
        expect(oferta.estado_postulacion).toBe('cv_enviado');
    }));

    it('parcial: muestro conteo real sin atribuir IDs y mantengo bloqueo hasta verificar', fakeAsync(() => {
        renderizar(); seleccionar(); aplicar();
        http.expectOne(`${url}/bulk/postulacion`).flush({ exito: true, datos: { actualizadas: 2 } }); renderizar();
        aviso('2 de 20');
        expect(dashboard.ofertas().every(o => o.estado_postulacion === 'no_postulado')).toBeTrue();
        expect(tabla().seleccionadas().size).toBe(20);
        expect(dashboard.postulacionesPendientes().size).toBe(20);
        expect(buscar('[aria-label="Aplicar acción masiva"]').disabled).toBeTrue();
        responderConciliacion(crearOfertas());
        expect(dashboard.postulacionesPendientes().size).toBe(0);
    }));

    it('parcial con refresh HTTP real conserva filtros y sólo los IDs válidos para reintento', fakeAsync(() => {
        renderizar(); filtrar('Angular'); seleccionar(); aplicar();
        http.expectOne(`${url}/bulk/postulacion`).flush({ exito: true, datos: { actualizadas: 2 } }); renderizar();
        const datos = crearOfertas().map(o => ({ ...o, estado_postulacion: o.id <= 2 ? 'en_proceso' : o.estado_postulacion } as Oferta));
        responderConciliacion(datos);
        expect(buscar('#filtro-busqueda-input').value).toBe('Angular');
        expect([...tabla().seleccionadas()]).toEqual([3, 4, 5, 6, 7]);
        expect(dashboard.ofertas().filter(o => o.estado_postulacion === 'en_proceso').map(o => o.id)).toEqual([1, 2]);
        expect(dashboard.sincronizando()).toBeFalse();
    }));

    it('B-01: Postuladas parcial 2/3 bloquea hasta GET y reintenta únicamente el ID no actualizado', fakeAsync(() => {
        const refrescar = spyOn(dashboard, 'cargarDatos').and.callThrough();
        const datos = iniciarParcialPostuladas();
        aviso('2 de 3');
        expect(buscar('[aria-label="Aplicar acción masiva"]').disabled).toBeTrue();
        expect(buscar('[aria-label="Aplicar acción masiva"]').textContent).toContain('Procesando');
        expect(dashboard.postulacionesPendientes().size).toBe(3);
        expect(dashboard.ofertas().every(o => o.estado_postulacion === 'cv_enviado')).toBeTrue();
        aplicar();
        tabla().cambiarPostulacion(dashboard.ofertas()[0], 'descartada');
        dashboard.mostrarDetalle(dashboard.ofertas()[0]); renderizar();
        detalle().cambiarPostulacion('descartada');
        http.expectNone(r => r.method === 'PATCH');
        responderConciliacion(datos);
        expect([...tabla().seleccionadas()]).toEqual([3]);
        expect(dashboard.accionMasivaConfirmada()).toBe(0);
        expect(dashboard.postulacionesPendientes().size).toBe(0);
        aplicar();
        const reintento = http.expectOne(`${url}/bulk/postulacion`);
        expect(reintento.request.body).toEqual({ ids: [3], estado_postulacion: 'en_proceso' });
        refrescar.and.stub();
        reintento.flush({ exito: true, datos: { actualizadas: 1 } }); renderizar();
        aviso('1 ofertas actualizadas.');
        expect(tabla().seleccionadas().size).toBe(0);
        expect(dashboard.ofertas().every(o => o.estado_postulacion === 'en_proceso')).toBeTrue();
    }));

    it('B-01 reproducción exacta: GET conserva tres Postuladas pero el segundo PATCH debe excluir los dos éxitos', fakeAsync(() => {
        const refrescar = spyOn(dashboard, 'cargarDatos').and.callThrough();
        const datos = iniciarParcialPostuladas();
        responderConciliacion(datos);
        expect([...tabla().seleccionadas()]).toEqual([3]);
        aplicar();
        const reintento = http.expectOne(`${url}/bulk/postulacion`);
        expect(reintento.request.body).toEqual({ ids: [3], estado_postulacion: 'en_proceso' });
        refrescar.and.stub();
        reintento.flush({ exito: true, datos: { actualizadas: 1 } }); renderizar();
        aviso('1 ofertas actualizadas.');
    }));

    it('cero confirmado también espera GET sin inventar éxitos por ID', fakeAsync(() => {
        const datos = iniciarParcialPostuladas(0);
        expect(dashboard.accionMasivaEnCurso()).toBeTrue();
        aviso('0 de 3');
        responderConciliacion(datos);
        expect([...tabla().seleccionadas()]).toEqual([1, 2, 3]);
        expect(dashboard.ofertas().every(o => o.estado_postulacion === 'cv_enviado')).toBeTrue();
        expect(dashboard.accionMasivaEnCurso()).toBeFalse();
    }));

    for (const fallo of ['false', '500', 'red', 'invalida', 'ausente', 'duplicada', 'estado', 'null', '204']) {
        it(`conciliación ${fallo}: advierto, no invento estados y exijo nueva selección explícita`, fakeAsync(() => {
            iniciarParcialPostuladas();
            const lectura = http.expectOne(r => r.method === 'GET' && r.url.startsWith(url));
            if (fallo === '500') lectura.flush({}, { status: 500, statusText: 'Fallo sintético' });
            else if (fallo === 'red') lectura.error(new ProgressEvent('error'));
            else if (fallo === 'null' || fallo === '204') lectura.flush(null, {
                status: fallo === '204' ? 204 : 200, statusText: fallo === '204' ? 'No Content' : 'OK',
            });
            else lectura.flush({ exito: fallo !== 'false', datos: fallo === 'invalida' ? null
                : fallo === 'duplicada' ? [...crearOfertas(3), crearOfertas(1)[0]]
                    : fallo === 'estado' ? crearOfertas(3).map(o => ({ ...o, estado_postulacion: 'inventado' })) : [] });
            renderizar();
            aviso('No pude confirmar los estados');
            aviso('Seleccioná nuevamente');
            expect(tabla().seleccionadas().size).toBe(0);
            expect(dashboard.ofertas().every(o => o.estado_postulacion === 'cv_enviado')).toBeTrue();
            expect(dashboard.postulacionesPendientes().size).toBe(0);
            expect(dashboard.accionMasivaEnCurso()).toBeFalse();
            tabla().aplicarAccionMasiva();
            http.expectNone(r => r.method === 'PATCH');
        }));
    }

    for (const cambio of ['busqueda', 'plataforma', 'pestaña', 'pagina', 'orden', 'cancelar']) {
        it(`conciliación no restaura selección después de cambiar ${cambio}`, fakeAsync(() => {
            const datos = iniciarParcialPostuladas();
            const original = tabla();
            if (cambio === 'busqueda') filtrar('React');
            if (cambio === 'plataforma') dashboard.filtroPlataforma.set('indeed');
            if (cambio === 'pestaña') fixture.nativeElement.querySelectorAll('p-tab')[0].click();
            if (cambio === 'pagina') original.tabla()!.onPageChange({ first: 20, rows: 20 });
            if (cambio === 'orden') buscar('th[pSortableColumn="titulo"]').click();
            if (cambio === 'cancelar') buscar('[aria-label="Cancelar selección masiva"]').click();
            renderizar(); responderConciliacion(datos);
            expect(original.seleccionadas().size).toBe(0);
            expect(dashboard.ofertas().filter(o => o.estado_postulacion === 'en_proceso').map(o => o.id)).toEqual([1, 2]);
            original.aplicarAccionMasiva();
            http.expectNone(r => r.method === 'PATCH');
        }));
    }

    it('conciliación usa destino original aunque cambie el modelo y conserva filtros válidos', fakeAsync(() => {
        const datos = iniciarParcialPostuladas();
        tabla().estadoBulkSeleccionado = 'cv_enviado';
        responderConciliacion(datos);
        expect([...tabla().seleccionadas()]).toEqual([3]);
        expect(dashboard.pestanaActiva()).toBe(1);
    }));

    for (const completarAntes of [true, false]) {
        it(`GET anterior al PATCH termina ${completarAntes ? 'durante' : 'después de'} conciliación sin reintroducir éxitos`, fakeAsync(() => {
            dashboard.ofertas.set(crearOfertas(3).map(o => ({ ...o, estado_postulacion: 'cv_enviado' })));
            renderizar(); fixture.nativeElement.querySelectorAll('p-tab')[1].click(); renderizar();
            dashboard.onProgresoEvaluacion();
            const antigua = http.expectOne(url);
            seleccionar(); aplicar();
            http.expectOne(`${url}/bulk/postulacion`).flush({ exito: true, datos: { actualizadas: 2 } }); renderizar();
            const viejas = crearOfertas(3).map(o => ({ ...o, estado_postulacion: 'cv_enviado' } as Oferta));
            if (completarAntes) { antigua.flush({ exito: true, datos: viejas }); renderizar(); }
            responderConciliacion(viejas.map(o => ({ ...o, estado_postulacion: o.id <= 2 ? 'en_proceso' : 'cv_enviado' })));
            if (!completarAntes) { antigua.flush({ exito: true, datos: viejas }); renderizar(); }
            expect([...tabla().seleccionadas()]).toEqual([3]);
            expect(dashboard.ofertas().map(o => o.estado_postulacion)).toEqual(['en_proceso', 'en_proceso', 'cv_enviado']);
        }));
    }

    it('polling iniciado durante la conciliación no pisa estados confirmados ni reintroduce selección', fakeAsync(() => {
        const datos = iniciarParcialPostuladas();
        const conciliacion = http.expectOne(url);
        dashboard.onProgresoEvaluacion();
        const polling = http.expectOne(url);
        conciliacion.flush({ exito: true, datos }); renderizar();
        polling.flush({ exito: true, datos: crearOfertas(3).map(o => ({ ...o, estado_postulacion: 'cv_enviado' })) });
        renderizar();
        expect([...tabla().seleccionadas()]).toEqual([3]);
        expect(dashboard.ofertas().map(o => o.estado_postulacion)).toEqual(['en_proceso', 'en_proceso', 'cv_enviado']);
        expect(dashboard.postulacionesPendientes().size).toBe(0);
    }));

    it('los contenedores activos no superponen su caja inline sobre los controles de ofertas', fakeAsync(() => {
        renderizar();
        const panel = buscar('p-tabpanel:not([hidden])');
        expect(getComputedStyle(panel).display).toBe('block');
        expect(getComputedStyle(panel.querySelector('app-tabla-ofertas')).display).toBe('block');
        fixture.nativeElement.querySelectorAll('p-tabpanel[hidden]').forEach((oculto: HTMLElement) => {
            expect(getComputedStyle(oculto).display).toBe('none');
        });
    }));

    it('bulk bloquea detalle y protege confirmaciones ante GET iniciado antes de la escritura', fakeAsync(() => {
        spyOn(dashboard, 'cargarDatos'); renderizar();
        dashboard.onProgresoEvaluacion();
        const lectura = http.expectOne(url);
        seleccionar(); aplicar();
        dashboard.mostrarDetalle(dashboard.ofertas()[0]); renderizar();
        detalle().cambiarPostulacion('cv_enviado');
        const req = http.expectOne(`${url}/bulk/postulacion`);
        http.expectNone(r => r.method === 'PATCH');
        req.flush({ exito: true, datos: { actualizadas: 20 } }); renderizar();
        lectura.flush({ exito: true, datos: crearOfertas() }); renderizar();
        expect(dashboard.ofertas().filter(o => o.estado_postulacion === 'en_proceso').length).toBe(20);
    }));

    for (const fallo of ['false', 'red']) {
        it(`bulk ${fallo}: conservo estado y selección sin éxito ni refresh`, fakeAsync(() => {
            const refrescar = spyOn(dashboard, 'cargarDatos');
            renderizar(); seleccionar(); aplicar();
            const req = http.expectOne(`${url}/bulk/postulacion`);
            if (fallo === 'false') req.flush({ exito: false }); else req.error(new ProgressEvent('error'));
            renderizar(); aviso('no se guardó');
            expect(tabla().seleccionadas().size).toBe(20);
            expect(dashboard.ofertas().every(o => o.estado_postulacion === 'no_postulado')).toBeTrue();
            expect(refrescar).not.toHaveBeenCalled();
            expect(dashboard.postulacionesPendientes().size).toBe(0);
        }));
    }
});
