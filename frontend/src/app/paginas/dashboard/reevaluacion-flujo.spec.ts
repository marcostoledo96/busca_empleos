import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Dashboard } from './dashboard';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { By } from '@angular/platform-browser';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Preferencias } from '../preferencias/preferencias';
import { DemoService } from '../../servicios/demo.service';
import { TablaOfertas } from '../../componentes/tabla-ofertas/tabla-ofertas';
import { Oferta } from '../../modelos/oferta.model';

const AHORA = Date.parse('2026-06-15T12:00:00Z');
const fechaHaceDias = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

const ofertaSintetica = (id: number, vigencia: Oferta['vigencia_evaluacion'] = 'anterior', dias = 1): Oferta => ({
    id, titulo: `Oferta sintética ${id}`, empresa: 'Empresa de prueba', ubicacion: null, modalidad: null,
    descripcion: null, url: 'https://prueba.invalid', plataforma: 'linkedin', nivel_requerido: null,
    salario_min: null, salario_max: null, moneda: null, estado_evaluacion: 'rechazada',
    razon_evaluacion: 'Evaluación anterior', porcentaje_match: 20, estado_postulacion: 'cv_enviado',
    fecha_publicacion: null, fecha_extraccion: fechaHaceDias(dias),
    datos_crudos: null, firma_criterios_evaluacion: null, vigencia_evaluacion: vigencia,
});

const ofertaReaparecida = (): Oferta => ({
    ...ofertaSintetica(1, 'anterior', 40),
    fecha_ultima_extraccion: fechaHaceDias(1),
    fecha_publicacion: '2026-05-01',
    situacion_evaluacion: 'por_confirmar',
    estado_evaluacion: 'pendiente',
    razon_evaluacion: 'Motivo sintético de confirmación',
    porcentaje_match: 60,
    fecha_postulacion: '2026-05-08',
    nota_postulacion: 'Seguimiento manual sintético',
});

// Controlo solamente el reloj del polling; Angular y los demás timers siguen reales.
function controlarPolling() {
    const intervalos = new Map<number, () => void>();
    const setIntervalReal = window.setInterval.bind(window);
    const clearIntervalReal = window.clearInterval.bind(window);
    let siguienteId = -1;
    spyOn(window, 'setInterval').and.callFake((callback: TimerHandler, periodo?: number, ...args: any[]) => {
        if (periodo !== 2000 || typeof callback !== 'function') {
            return setIntervalReal(callback, periodo, ...args);
        }
        const id = siguienteId--;
        intervalos.set(id, () => callback(...args));
        return id;
    });
    spyOn(window, 'clearInterval').and.callFake((id?: number) => {
        if (id !== undefined && intervalos.delete(id)) return;
        clearIntervalReal(id);
    });
    return {
        avanzar: () => [...intervalos.values()].forEach(callback => callback()),
        activos: () => intervalos.size,
    };
}

// Verifico respuestas persistidas con servicios HTTP reales, sin proveedor ni red.
describe('Reevaluación — aviso del perfil guardado', () => {
    let fixture: ComponentFixture<Preferencias>;
    let http: HttpTestingController;
    const url = 'http://localhost:3000/api';
    const datos = { id: 1, nombre: 'Perfil sintético', tecnologias_detalle: [], roles_objetivo_detalle: [] };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
                provideNoopAnimations(), { provide: DemoService, useValue: { esModoDemo: () => false } }],
        }).compileComponents();
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(Preferencias);
        fixture.autoDetectChanges();
        http.expectOne(`${url}/preferencias`).flush({ exito: true, datos, firma_criterios_evaluacion: 'inicial' });
        http.expectOne(`${url}/preferencias/cv-base`).flush({ exito: true,
            datos: { cv_base: null, cv_base_actualizado_en: null } });
        await fixture.whenStable();
    });

    afterEach(() => http.verify());

    it('ofrece selección solamente cuando PUT confirma un cambio relevante, sin evaluar al guardar', async () => {
        fixture.componentInstance.nombre = 'Borrador';
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).not.toContain('Tu perfil cambió.');
        fixture.componentInstance.guardar();
        http.expectOne(`${url}/preferencias`).flush({ exito: true, datos, cambio_criterios: true,
            firma_criterios_evaluacion: 'guardada' });
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain('Tu perfil cambió.');
        const enlace = fixture.nativeElement.querySelector('a[href="/?reevaluar=1"]');
        expect(enlace).not.toBeNull();
        http.expectNone(req => req.method === 'POST');
        const nombre = fixture.nativeElement.querySelector('#nombre') as HTMLInputElement;
        nombre.value = 'Otro borrador sin confirmar';
        nombre.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain('Cambios sin guardar');
        expect(fixture.nativeElement.textContent).toContain('Tu perfil cambió.');
    });

    it('no inventa invalidaciones al guardar sin cambio relevante', async () => {
        fixture.componentInstance.guardar();
        http.expectOne(`${url}/preferencias`).flush({ exito: true, datos, cambio_criterios: false });
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).not.toContain('Tu perfil cambió.');
        http.expectNone(req => req.method === 'POST');
    });
});

describe('Reevaluación — selección visible', () => {
    let fixture: ComponentFixture<TablaOfertas>;

    beforeEach(async () => {
        spyOn(Date, 'now').and.returnValue(AHORA);
        await TestBed.configureTestingModule({ imports: [TablaOfertas],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
        }).compileComponents();
        fixture = TestBed.createComponent(TablaOfertas);
        fixture.componentRef.setInput('ofertas', [ofertaSintetica(1), ofertaSintetica(2, 'desconocida')]);
        fixture.autoDetectChanges();
        await fixture.whenStable();
    });

    it('confirma la cantidad y los 30 días antes de emitir los IDs seleccionados', async () => {
        const casilla = fixture.nativeElement.querySelector('input[aria-label="Seleccionar Oferta sintética 1"]') as HTMLInputElement;
        casilla.click();
        await fixture.whenStable();
        const boton = fixture.nativeElement.querySelector('[data-accion="reevaluar"]') as HTMLButtonElement;
        expect(boton).not.toBeNull();
        boton?.click();
        await fixture.whenStable();
        const confirmacion = fixture.nativeElement.querySelector('[aria-label="Confirmar reevaluación"]');
        expect(confirmacion?.textContent).toContain('1 oferta');
        expect(confirmacion?.textContent).toContain('30 días');
        expect(confirmacion?.textContent).toContain('la última detección o, si no está registrada, la primera');
        expect(confirmacion?.textContent).toContain('perfil guardado');
        expect(confirmacion?.textContent).toContain('pagas');
    });

    it('muestra fallo separado junto al resultado anterior en tabla y cards', async () => {
        fixture.componentRef.setInput('ofertas', [{ ...ofertaSintetica(1), fecha_evaluacion: '2026-01-01', evaluacion_error_mensaje: 'Timeout sintético' }]);
        await fixture.whenStable();
        for (const vista of ['.vista-desktop', '.vista-mobile']) {
            const texto = fixture.nativeElement.querySelector(vista).textContent;
            expect(texto).toContain('Timeout sintético');
            expect(texto).toContain('Resultado anterior conservado');
            expect(texto).toContain('20');
            expect(texto).toContain('RECHAZADA');
        }
    });

    it('identifica evaluaciones anteriores y desconocidas por texto en tabla y cards', () => {
        for (const vista of ['.vista-desktop', '.vista-mobile']) {
            const texto = fixture.nativeElement.querySelector(vista).textContent;
            expect(texto).toContain('Evaluación anterior');
            expect(texto).toContain('Vigencia desconocida');
        }
    });

    it('selecciona una oferta desde cards y solo la emite después de confirmar', async () => {
        const emitir = spyOn(fixture.componentInstance.reevaluarSeleccionadas, 'emit');
        const casilla = fixture.nativeElement.querySelector('input[aria-label="Seleccionar en tarjeta Oferta sintética 2"]') as HTMLInputElement;
        casilla.click();
        await fixture.whenStable();
        (fixture.nativeElement.querySelector('[data-accion="reevaluar"]') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(emitir).not.toHaveBeenCalled();
        (fixture.nativeElement.querySelector('[data-accion="confirmar-reevaluacion"]') as HTMLButtonElement).click();
        expect(emitir).toHaveBeenCalledOnceWith([2]);
        expect(fixture.componentInstance.seleccionadas().size).toBe(0);
    });

    it('habilita la confirmación en la tabla independiente para una oferta reaparecida', async () => {
        fixture.componentRef.setInput('ofertas', [ofertaReaparecida()]);
        await fixture.whenStable();
        const raiz = fixture.nativeElement as HTMLElement;
        const emitir = spyOn(fixture.componentInstance.reevaluarSeleccionadas, 'emit');
        raiz.querySelector<HTMLInputElement>('input[aria-label="Seleccionar Oferta sintética 1"]')!.click();
        await fixture.whenStable();
        const boton = raiz.querySelector<HTMLButtonElement>('[data-accion="reevaluar"]')!;
        expect(boton.disabled).withContext('primera detección hace 40 días; última hace 1 día').toBeFalse();
        expect(emitir).not.toHaveBeenCalled();
        if (boton.disabled) return;
        boton.click();
        await fixture.whenStable();
        expect(raiz.querySelector('[aria-label="Confirmar reevaluación"]')).not.toBeNull();
        expect(emitir).not.toHaveBeenCalled();
    });

    it('bloquea históricos, más de 200, ocupación y demo; permite exactamente 200 recientes', async () => {
        const componente = fixture.componentInstance;
        fixture.componentRef.setInput('ofertas', [ofertaSintetica(1, 'anterior', 31)]);
        await fixture.whenStable();
        componente.toggleSeleccion(1);
        componente.solicitarReevaluacion();
        expect(componente.confirmandoReevaluacion()).toBeFalse();
        fixture.componentRef.setInput('ofertas', Array.from({ length: 201 }, (_, i) => ofertaSintetica(i + 1)));
        await fixture.whenStable();
        componente.toggleSeleccionarTodas();
        expect(componente.seleccionReevaluable()).toBeFalse();
        componente.toggleSeleccion(201);
        expect(componente.seleccionReevaluable()).toBeTrue();
        fixture.componentRef.setInput('evaluacionOcupada', true);
        componente.solicitarReevaluacion();
        expect(componente.confirmandoReevaluacion()).toBeFalse();
        fixture.componentRef.setInput('evaluacionOcupada', false);
        fixture.componentRef.setInput('modoDemo', true);
        componente.solicitarReevaluacion();
        expect(componente.confirmandoReevaluacion()).toBeFalse();
    });

    it('marca todas solamente para la página visible, también después de paginar y filtrar', async () => {
        const ofertas = Array.from({ length: 45 }, (_, i) => ({
            ...ofertaSintetica(i + 1), titulo: i >= 40 ? `Grupo reciente ${i + 1}` : `Oferta sintética ${i + 1}`,
        }));
        fixture.componentRef.setInput('ofertas', ofertas);
        await fixture.whenStable();
        const cabecera = () => fixture.nativeElement.querySelector('input[aria-label="Seleccionar ofertas de esta página"]') as HTMLInputElement;
        const comprobarPagina = async (ids: number[]) => {
            cabecera().click();
            await fixture.whenStable();
            expect([...fixture.componentInstance.seleccionadas()]).toEqual(ids);
            expect(fixture.nativeElement.querySelector('.reevaluacion-seleccion').textContent).toContain(`${ids.length} ofertas seleccionadas`);
            expect(cabecera().checked).toBeTrue();
            expect(cabecera().indeterminate).toBeFalse();
        };
        await comprobarPagina(Array.from({ length: 20 }, (_, i) => i + 1));
        (fixture.nativeElement.querySelector('.p-paginator-next') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(fixture.componentInstance.seleccionadas().size).toBe(0);
        expect(cabecera().checked).toBeFalse();
        expect(cabecera().indeterminate).toBeFalse();
        await comprobarPagina(Array.from({ length: 20 }, (_, i) => i + 21));
        (fixture.nativeElement.querySelector('input[aria-label="Seleccionar Oferta sintética 21"]') as HTMLInputElement).click();
        await fixture.whenStable();
        expect(cabecera().checked).toBeFalse();
        expect(cabecera().indeterminate).toBeTrue();
        const buscador = fixture.nativeElement.querySelector('#filtro-busqueda-input') as HTMLInputElement;
        buscador.value = 'Grupo reciente';
        buscador.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        await comprobarPagina([41, 42, 43, 44, 45]);
    });

    it('descarta selección al filtrar, cambiar página y refrescar los datos', async () => {
        const componente = fixture.componentInstance;
        componente.toggleSeleccion(1);
        window.dispatchEvent(new Event('resize'));
        expect(componente.seleccionadas().size).toBe(0);
        componente.toggleSeleccion(1);
        const buscador = fixture.nativeElement.querySelector('#filtro-busqueda-input') as HTMLInputElement;
        buscador.value = 'Oferta sintética 2';
        buscador.dispatchEvent(new Event('input'));
        expect(componente.seleccionadas().size).toBe(0);
        // El buscador ahora filtra ambas vistas; limpio antes de pedir una segunda página.
        buscador.value = '';
        buscador.dispatchEvent(new Event('input'));
        fixture.componentRef.setInput('ofertas', Array.from({ length: 25 }, (_, i) => ofertaSintetica(i + 1)));
        await fixture.whenStable();
        componente.toggleSeleccion(1);
        componente.irAPaginaCards(1);
        expect(componente.seleccionadas().size).toBe(0);
        componente.toggleSeleccion(21);
        fixture.componentRef.setInput('ofertas', [ofertaSintetica(2)]);
        await fixture.whenStable();
        expect(componente.seleccionadas().size).toBe(0);
        expect(componente.confirmandoReevaluacion()).toBeFalse();
    });
});

describe('Reevaluación — recorrido HTTP y DOM integrado', () => {
    const url = 'http://localhost:3000/api';
    let http: HttpTestingController;
    let harness: RouterTestingHarness;
    let reloj: ReturnType<typeof controlarPolling>;
    const progreso = (activo: boolean) => ({ exito: true, datos: { activo, total: 1,
        evaluadas: activo ? 0 : 1, aprobadas: activo ? 0 : 1, rechazadas: 0, errores: 0, porcentaje: activo ? 0 : 100 } });
    const sincronizacion = (datos: Oferta[]) => ({ exito: true, datos, completada: true,
        cursor_siguiente: null, fecha_corte: '2026-01-01', max_id: 3, total_inicial: datos.length });

    beforeEach(async () => {
        spyOn(Date, 'now').and.returnValue(AHORA);
        await TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                provideRouter([{ path: 'preferencias', component: Preferencias }, { path: '', component: Dashboard }]),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        }).compileComponents();
        // Ejercito el fallback existente sin depender del almacenamiento de otros tests.
        spyOn(indexedDB, 'open').and.throwError('IndexedDB sintético no disponible');
        TestBed.inject(PersistenciaDashboardService).limpiarCache();
        http = TestBed.inject(HttpTestingController);
        reloj = controlarPolling();
        harness = await RouterTestingHarness.create();
        harness.fixture.autoDetectChanges();
    });

    afterEach(() => {
        harness.fixture.destroy();
        expect(reloj.activos()).toBe(0);
        reloj.avanzar();
        http.expectNone(`${url}/evaluacion/progreso`);
        http.verify();
        TestBed.inject(PersistenciaDashboardService).limpiarCache();
    });

    it('admite la oferta reaparecida, cancela sin POST, confirma un solo ID y refresca sin pisar postulación', async () => {
        const reaparecida = ofertaReaparecida();
        TestBed.inject(PersistenciaDashboardService).guardarCache({
            ofertas: [ofertaSintetica(1, 'actual')], estadisticas: null,
            fechaGuardado: new Date().toISOString(), version: 1,
        });
        await harness.navigateByUrl('/preferencias');
        http.expectOne(`${url}/preferencias`).flush({ exito: true, datos: { nombre: 'Guardado' } });
        http.expectOne(`${url}/preferencias/cv-base`).flush({ exito: true,
            datos: { cv_base: null, cv_base_actualizado_en: null } });
        await harness.fixture.whenStable();
        const preferencias = harness.routeDebugElement!.componentInstance as Preferencias;
        preferencias.nombre = 'Perfil confirmado nuevo';
        preferencias.guardar();
        http.expectOne(`${url}/preferencias`).flush({ exito: true,
            datos: { nombre: 'Perfil confirmado nuevo' }, cambio_criterios: true, firma_criterios_evaluacion: 'nueva' });
        await harness.fixture.whenStable();
        http.expectNone(req => req.method === 'POST');
        (harness.routeNativeElement!.querySelector('a[href="/?reevaluar=1"]') as HTMLAnchorElement).click();
        await harness.fixture.whenStable();
        http.expectOne(`${url}/preferencias`).flush({ exito: true, datos: {} });
        http.expectOne(`${url}/automatizacion/estado`).flush({ exito: true, datos: { activo: false } });
        http.expectOne(`${url}/automatizacion/progreso`).flush({ exito: true, datos: { activo: false } });
        http.expectOne(`${url}/automatizacion/historial`).flush({ exito: true, datos: [] });
        http.expectOne(`${url}/evaluacion/progreso`).flush(progreso(false));
        http.expectOne(`${url}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [] } });
        await harness.fixture.whenStable();
        const dashboardAntes = harness.routeDebugElement!.componentInstance as Dashboard;
        expect(dashboardAntes.ofertas()[0].vigencia_evaluacion).toBe('actual');
        const casillaCache = harness.routeNativeElement!.querySelector('input[aria-label="Seleccionar Oferta sintética 1"]') as HTMLInputElement;
        expect(casillaCache.disabled).toBeTrue();
        http.expectOne(req => req.url === `${url}/ofertas/sincronizacion`).flush(sincronizacion([
            reaparecida, ofertaSintetica(2, 'desconocida'), ofertaSintetica(3, 'anterior', 31),
        ]));
        await harness.fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 0));
        await harness.fixture.whenStable();
        const raiz = harness.routeNativeElement!;
        expect(raiz.textContent).toContain('Seleccionar ofertas para reevaluar');
        expect(raiz.textContent).toContain('desde la última detección; si no está registrada, desde la primera');
        expect(raiz.textContent).not.toContain('Oferta sintética 3');
        expect(raiz.textContent).toContain('Vigencia desconocida');
        const tabla = harness.routeDebugElement!.query(By.directive(TablaOfertas)).componentInstance as TablaOfertas;
        expect(tabla.seleccionadas().size).toBe(0);
        const seleccion = raiz.querySelector<HTMLInputElement>('input[aria-label="Seleccionar Oferta sintética 1"]');
        expect(seleccion).withContext('primera detección hace 40 días; última hace 1 día').not.toBeNull();
        http.expectNone(req => req.method === 'POST');
        if (!seleccion) return;
        for (const vista of ['.vista-desktop', '.vista-mobile']) {
            const region = raiz.querySelector(vista)!;
            expect(region.querySelector('[data-estado="por_confirmar"]')?.textContent).toContain('Por confirmar');
            expect(region.textContent).toContain('Motivo sintético de confirmación');
            expect(region.textContent).toContain('Evaluación anterior');
            const fecha = (valor: string) => formatDate(valor, 'dd/MM/yyyy HH:mm', 'en-US');
            expect(region.querySelector('[title^="Primera detección:"]')?.getAttribute('title')).toBe(
                `Primera detección: ${fecha(reaparecida.fecha_extraccion)} | Última detección: ${fecha(reaparecida.fecha_ultima_extraccion!)}`);
            expect(region.textContent).toContain('Pub: 01/05/26');
        }
        seleccion.click();
        await harness.fixture.whenStable();
        const abrirConfirmacion = async () => {
            raiz.querySelector<HTMLButtonElement>('[data-accion="reevaluar"]')!.click();
            await harness.fixture.whenStable();
            return raiz.querySelector<HTMLElement>('[aria-label="Confirmar reevaluación"]')!;
        };
        const confirmacion = await abrirConfirmacion();
        expect(confirmacion.textContent).toContain('1 oferta');
        expect(confirmacion.textContent).toContain('30 días');
        expect(confirmacion.textContent).toContain('perfil guardado');
        expect(confirmacion.textContent).toContain('pagas');
        http.expectNone(req => req.method === 'POST');
        confirmacion.querySelector<HTMLButtonElement>('.btn-bulk-cancelar')!.click();
        await harness.fixture.whenStable();
        expect(raiz.querySelector('[aria-label="Confirmar reevaluación"]')).toBeNull();
        expect(seleccion.checked).toBeTrue();
        http.expectNone(req => req.method === 'POST');
        await abrirConfirmacion();
        raiz.querySelector<HTMLButtonElement>('[data-accion="confirmar-reevaluacion"]')!.click();
        const inicio = http.expectOne(`${url}/evaluacion/ejecutar`);
        expect(inicio.request.method).toBe('POST');
        expect(inicio.request.body).toEqual({ ids: [1] });
        inicio.flush({ exito: true, mensaje: 'Evaluación iniciada.', en_curso: true, cantidad: 1, periodo_dias: 30 });
        await harness.fixture.whenStable();
        expect(raiz.querySelector('[aria-label="Cancelar evaluación en progreso"]')).not.toBeNull();
        expect(reloj.activos()).toBe(1);
        reloj.avanzar();
        http.expectOne(`${url}/evaluacion/progreso`).flush(progreso(true));
        http.expectOne(`${url}/ofertas`).flush({ exito: true,
            datos: [reaparecida, ofertaSintetica(2, 'desconocida')] });
        await harness.fixture.whenStable();
        const barra = raiz.querySelector('[role="progressbar"][aria-label="Progreso de evaluación"]');
        expect(barra?.getAttribute('aria-valuenow')).toBe('0');
        expect(barra?.getAttribute('aria-valuetext')).toBe('Resultados válidos: 0/1 · Intentos procesados: 0%');
        (raiz.querySelector('[aria-label="Cancelar evaluación en progreso"]') as HTMLButtonElement).click();
        http.expectOne(`${url}/evaluacion/cancelar`).flush({ exito: true });
        http.expectNone(req => req.url.includes('scraping'));
        // Avanzo el polling reutilizado después de cancelar, con HTTP sintético.
        reloj.avanzar();
        http.expectOne(`${url}/evaluacion/progreso`).flush(progreso(false));
        const actuales: Oferta[] = [{ ...reaparecida, estado_evaluacion: 'aprobada', situacion_evaluacion: 'aprobada',
            vigencia_evaluacion: 'actual', porcentaje_match: 90, razon_evaluacion: 'Nuevo resultado',
            firma_criterios_evaluacion: 'nueva' }, ofertaSintetica(2, 'desconocida')];
        http.expectOne(`${url}/ofertas`).flush({ exito: true, datos: actuales });
        await harness.fixture.whenStable();
        http.expectOne(req => req.url === `${url}/ofertas/sincronizacion`).flush(sincronizacion(actuales));
        await harness.fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 0));
        await harness.fixture.whenStable();
        expect(raiz.textContent).toContain('Evaluación actual');
        expect(raiz.textContent).toContain('90');
        const dashboard = harness.routeDebugElement!.componentInstance as Dashboard;
        expect(dashboard.ofertas().find(o => o.id === 1)).toEqual(jasmine.objectContaining({
            estado_postulacion: 'cv_enviado', fecha_postulacion: reaparecida.fecha_postulacion,
            nota_postulacion: reaparecida.nota_postulacion, razon_evaluacion: 'Nuevo resultado',
            fecha_extraccion: reaparecida.fecha_extraccion, fecha_publicacion: reaparecida.fecha_publicacion,
        }));
        expect(raiz.querySelector('[aria-label="Confirmar reevaluación"]')).toBeNull();
        expect(tabla.seleccionadas().size).toBe(0);
        http.expectNone(`${url}/evaluacion/ejecutar`);
        expect(harness.routeDebugElement!.query(By.directive(PanelControl)).componentInstance.evaluando()).toBeFalse();
        expect(reloj.activos()).toBe(0);
        reloj.avanzar();
        http.expectNone(`${url}/evaluacion/progreso`);
    });
});

describe('Reevaluación — errores y exclusión mutua con HTTP real', () => {
    let fixture: ComponentFixture<PanelControl>;
    let http: HttpTestingController;
    let reloj: ReturnType<typeof controlarPolling>;
    const url = 'http://localhost:3000/api';

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [PanelControl],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
        }).compileComponents();
        http = TestBed.inject(HttpTestingController);
        reloj = controlarPolling();
        fixture = TestBed.createComponent(PanelControl);
        fixture.autoDetectChanges();
        http.expectOne(`${url}/automatizacion/estado`).flush({ exito: true, datos: { activo: false } });
        http.expectOne(`${url}/automatizacion/progreso`).flush({ exito: true, datos: { activo: false } });
        http.expectOne(`${url}/automatizacion/historial`).flush({ exito: true, datos: [] });
        http.expectOne(`${url}/evaluacion/progreso`).flush({ exito: true, datos: { activo: false } });
        http.expectOne(`${url}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [] } });
        await fixture.whenStable();
    });

    afterEach(() => {
        fixture.destroy();
        expect(reloj.activos()).toBe(0);
        reloj.avanzar();
        http.expectNone(`${url}/evaluacion/progreso`);
        http.verify();
    });

    for (const status of [400, 409]) {
        it(`no inicia polling ni anuncia éxito cuando la selección recibe HTTP ${status}`, async () => {
            fixture.componentInstance.ejecutarEvaluacion([1]);
            http.expectOne(`${url}/evaluacion/ejecutar`).flush({ error: 'Selección rechazada por el servidor' },
                { status, statusText: 'Rechazada' });
            await fixture.whenStable();
            expect(fixture.componentInstance.evaluando()).toBeFalse();
            expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
            expect(fixture.nativeElement.textContent).not.toContain('Evaluación completada');
            expect(reloj.activos()).toBe(0);
            reloj.avanzar();
            http.expectNone(`${url}/evaluacion/progreso`);
            http.expectNone(req => req.url.includes('scraping'));
        });
    }

    for (const terminal of [
        { estado: 'error', errores: 0, mensaje_error: 'Fallo de persistencia' },
        { estado: 'error', errores: 1, mensaje_error: 'Timeout del proveedor' },
        { errores: 1, mensaje_error: null },
        { estado: 'cancelado', errores: 0, mensaje_error: null },
    ]) {
        it(`detiene polling y muestra contadores parciales sin éxito falso: ${JSON.stringify(terminal)}`, async () => {
            const refrescar = spyOn(fixture.componentInstance.accionCompletada, 'emit');
            fixture.componentInstance.ejecutarEvaluacion([1, 2]);
            http.expectOne(`${url}/evaluacion/ejecutar`).flush({ exito: true, en_curso: true });
            expect(reloj.activos()).toBe(1);
            reloj.avanzar();
            http.expectOne(`${url}/evaluacion/progreso`).flush({ exito: true, datos: {
                activo: false, total: 2, evaluadas: 1, procesadas: 1 + terminal.errores,
                pendientes: 1, aprobadas: 1, rechazadas: 0, porcentaje: 50, ...terminal,
            } });
            await fixture.whenStable();
            const raiz = fixture.nativeElement as HTMLElement;
            expect(raiz.textContent).not.toContain('Evaluación completada');
            expect(raiz.textContent).toContain('1 resultado(s) actualizado(s), 1 pendiente(s)');
            if (terminal.estado !== 'cancelado') {
                expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('último resultado válido');
            } else {
                expect(raiz.textContent).toContain('Evaluación cancelada');
            }
            expect(fixture.componentInstance.evaluando()).toBeFalse();
            expect(refrescar).toHaveBeenCalledTimes(1);
            expect(reloj.activos()).toBe(0);
            reloj.avanzar();
            http.expectNone(`${url}/evaluacion/progreso`);
        });
    }

    it('limpia el intervalo al destruir el panel durante una evaluación activa', () => {
        fixture.componentInstance.ejecutarEvaluacion([1]);
        http.expectOne(`${url}/evaluacion/ejecutar`).flush({ exito: true, en_curso: true });
        expect(reloj.activos()).toBe(1);
        fixture.destroy();
        expect(reloj.activos()).toBe(0);
        reloj.avanzar();
        http.expectNone(`${url}/evaluacion/progreso`);
    });

    it('valida IDs, máximo, demo y ocupación antes del POST, y no duplica un inicio pendiente', () => {
        const componente = fixture.componentInstance;
        for (const ids of [[], [1, 1], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1],
            Array.from({ length: 201 }, (_, i) => i + 1)]) componente.ejecutarEvaluacion(ids);
        http.expectNone(`${url}/evaluacion/ejecutar`);
        fixture.componentRef.setInput('modoDemo', true);
        componente.ejecutarEvaluacion([1]);
        fixture.componentRef.setInput('modoDemo', false);
        componente.ejecutandoCiclo.set(true);
        componente.ejecutarEvaluacion([1]);
        componente.ejecutandoCiclo.set(false);
        componente.scrapeandoLinkedin.set(true);
        componente.ejecutarEvaluacion([1]);
        componente.scrapeandoLinkedin.set(false);
        http.expectNone(`${url}/evaluacion/ejecutar`);
        componente.ejecutarEvaluacion([1]);
        componente.ejecutarEvaluacion([2]);
        const solicitudes = http.match(`${url}/evaluacion/ejecutar`);
        expect(solicitudes.length).toBe(1);
        expect(solicitudes[0].request.body).toEqual({ ids: [1] });
        solicitudes[0].flush({ exito: false, en_curso: false, mensaje: 'No se inició' });
        expect(componente.evaluando()).toBeFalse();
        expect(componente.errorEvaluacion()).toBe('No se inició');
    });
});
