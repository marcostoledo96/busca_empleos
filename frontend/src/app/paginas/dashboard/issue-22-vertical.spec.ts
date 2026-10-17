import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Dashboard } from './dashboard';
import { DemoService } from '../../servicios/demo.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { Oferta } from '../../modelos/oferta.model';
import { environment } from '../../../environments/environment';

declare const ISSUE22_VERTICAL: string;
const nonce = typeof ISSUE22_VERTICAL === 'undefined' ? null : ISSUE22_VERTICAL;
const suite = nonce ? describe : xdescribe;
const base = 'http://127.0.0.1:43194';
const control = `${base}/__prueba_issue22`;

suite('Issue22 continua real — HTTP/DOM/IndexedDB', () => {
    let fixture: ComponentFixture<Dashboard> | undefined;
    let http: HttpClient;
    let urlOriginal: string;
    let cacheOriginal: string | null;
    const buscar = (selector: string): HTMLElement | null => fixture!.nativeElement.querySelector(selector);
    const observar = () => firstValueFrom(http.get<{ oferta: Oferta; http: { metodo: string; ruta: string; estado: number }[] }>(`${control}/observaciones`));
    async function esperar(condicion: () => boolean | Promise<boolean>): Promise<void> {
        const limite = performance.now() + 15000;
        while (!(await condicion())) {
            if (performance.now() > limite) throw new Error('No se cumplió la condición issue22 en 15 segundos.');
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            fixture?.detectChanges();
        }
        fixture?.detectChanges();
    }
    async function pulsar(selector: string): Promise<void> {
        const boton = buscar(selector) as HTMLButtonElement;
        expect(boton).withContext(selector).not.toBeNull();
        expect(boton.matches(':disabled')).toBeFalse();
        boton.click();
        fixture!.detectChanges();
        await fixture!.whenStable();
    }
    async function abrir(): Promise<void> {
        const tab = Array.from(fixture!.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>).find(tab => tab.textContent?.includes('POSTULADAS'))!;
        tab.click();
        fixture!.detectChanges();
        await fixture!.whenStable();
        expect(tab.getAttribute('aria-selected')).toBe('true');
        expect(buscar('p-tabpanel:not([hidden])')?.textContent).toContain('Seguimiento vertical 45 días');
        await pulsar('p-tabpanel:not([hidden]) [aria-label="Ver detalle de Seguimiento vertical 45 días"]');
        await esperar(() => buscar('#fecha-postulacion') !== null);
    }
    async function editar(selector: string, valor: string): Promise<void> {
        const campo = buscar(selector) as HTMLInputElement;
        campo.value = valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        fixture!.detectChanges();
        await fixture!.whenStable();
    }
    function verificarDetalle(): void {
        expect((buscar('#fecha-postulacion') as HTMLInputElement).value).toBe('2024-02-29');
        expect((buscar('#nota-postulacion') as HTMLTextAreaElement).value).toBe('Envié CV; próxima entrevista');
        expect(fixture!.nativeElement.textContent).toContain('Requiere Java; rechazo independiente');
        expect(buscar('[data-estado="rechazada"]')?.textContent).toContain('RECHAZADA');
        expect(fixture!.componentInstance.statPostuladas()).toBe(1);
        expect(fixture!.componentInstance.statRechazadas()).toBe(0);
        expect(buscar('[aria-labelledby="stat-label-postuladas"]')?.textContent?.trim()).toBe('1');
        expect(buscar('[aria-labelledby="stat-label-rechazadas"]')?.textContent?.trim()).toBe('0');
    }
    async function configurar(): Promise<void> {
        await TestBed.configureTestingModule({ imports: [Dashboard], providers: [provideRouter([]), provideNoopAnimations(),
            provideHttpClient(withInterceptors([(req, next) => {
                if (!req.url.startsWith(`${base}/`)) throw new Error(`HTTP fuera del fixture: ${req.url}`);
                return next(req.clone({ setHeaders: { Authorization: `Bearer ${nonce}` } }));
            }])),
        ] }).compileComponents();
        TestBed.inject(DemoService).esModoDemo.set(false);
        http = TestBed.inject(HttpClient);
    }
    beforeEach(async () => {
        urlOriginal = environment.urlApi;
        cacheOriginal = localStorage.getItem('busca-empleos.dashboard.cache');
        const listo = await fetch(`${control}/listo`, { headers: { Authorization: `Bearer ${nonce}` }, signal: AbortSignal.timeout(3000) });
        if (!listo.ok || (await listo.json()).nonce !== nonce) throw new Error('Fixture issue22 no autorizado.');
        environment.urlApi = `${base}/api`;
        await configurar();
        const persistencia = TestBed.inject(PersistenciaDashboardService);
        persistencia.limpiarCache();
        await persistencia.limpiarSincronizacion();
        fixture = TestBed.createComponent(Dashboard);
        fixture.detectChanges();
        await esperar(() => fixture!.componentInstance.estadoOperativoSincronizacion()?.estado === 'completada');
    });
    afterEach(async () => {
        fixture?.destroy();
        fixture = undefined;
        await new PersistenciaDashboardService().limpiarSincronizacion();
        environment.urlApi = urlOriginal;
        if (cacheOriginal === null) localStorage.removeItem('busca-empleos.dashboard.cache');
        else localStorage.setItem('busca-empleos.dashboard.cache', cacheOriginal);
    });

    it('guardo la histórica por HTTP, sincronizo, recargo IndexedDB y cambio estado/reaparición sin perder día ni nota', async () => {
        const inicial = await observar();
        const id = inicial.oferta.id;
        expect(Date.now() - new Date(inicial.oferta.fecha_extraccion).getTime()).toBeGreaterThan(44 * 86400000);
        expect(inicial.oferta.fecha_postulacion).toBeNull();
        expect(inicial.oferta.estado_postulacion).toBe('cv_enviado');
        await abrir();
        expect((buscar('#fecha-postulacion') as HTMLInputElement).value).toBe('');
        await editar('#fecha-postulacion', '2024-02-29');
        await editar('#nota-postulacion', 'Envié CV; próxima entrevista');
        await pulsar('[aria-label="Guardar seguimiento"]');
        await esperar(() => fixture!.nativeElement.textContent.includes('Seguimiento guardado'));
        verificarDetalle();
        expect((await observar()).oferta).toEqual(jasmine.objectContaining({ id, fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV; próxima entrevista' }));
        fixture!.componentInstance.cargarDatos();
        await esperar(() => !fixture!.componentInstance.sincronizando());
        expect(fixture!.componentInstance.fallbackSincronizacion()).toBeFalse();
        const persistidas = await new PersistenciaDashboardService().obtenerOfertasSincronizadas();
        expect(persistidas.length).toBe(1);
        expect(persistidas[0]).toEqual(jasmine.objectContaining({ id, fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV; próxima entrevista' }));
        // Destruyo componente e inyector: la segunda instancia no hereda signals ni Map en memoria.
        fixture!.destroy();
        fixture = undefined;
        TestBed.resetTestingModule();
        await configurar();
        expect(await TestBed.inject(PersistenciaDashboardService).obtenerOfertasSincronizadas()).toEqual(persistidas);
        fixture = TestBed.createComponent(Dashboard);
        fixture.detectChanges();
        await esperar(() => fixture!.componentInstance.estadoOperativoSincronizacion()?.estado === 'completada');
        await abrir();
        verificarDetalle();
        await pulsar('section[aria-labelledby="seguimiento-titulo"] p-select .p-select-dropdown');
        const opcion = Array.from(document.querySelectorAll('[role="option"]')).find(elemento => elemento.textContent?.includes('En proceso')) as HTMLElement;
        expect(opcion).not.toBeUndefined();
        opcion.click();
        fixture.detectChanges();
        await esperar(async () => (await observar()).oferta.estado_postulacion === 'en_proceso');
        await esperar(() => !fixture!.componentInstance.dialogoVisible());
        await abrir();
        verificarDetalle();
        expect(fixture.nativeElement.textContent).toContain('En proceso');
        await firstValueFrom(http.post(`${control}/reaparicion`, {}));
        const reaparecida = (await observar()).oferta;
        expect(reaparecida.empresa).toBe('Reaparición sintética');
        expect(reaparecida).toEqual(jasmine.objectContaining({ id, estado_postulacion: 'en_proceso', fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV; próxima entrevista', estado_evaluacion: 'rechazada', firma_criterios_evaluacion: 'firma-vertical' }));
        expect(reaparecida.fecha_extraccion).toBe(inicial.oferta.fecha_extraccion);
        fixture.componentInstance.cargarDatos();
        await esperar(() => !fixture!.componentInstance.sincronizando());
        verificarDetalle();
        expect((await new PersistenciaDashboardService().obtenerOfertasSincronizadas())[0]).toEqual(jasmine.objectContaining({ id, estado_postulacion: 'en_proceso', nota_postulacion: 'Envié CV; próxima entrevista' }));
        // Mantengo el editor A con su copia anterior mientras el cliente B escribe sólo la nota.
        await editar('#fecha-postulacion', '2024-03-01');
        await firstValueFrom(http.patch(`${base}/api/ofertas/${id}/seguimiento`, { nota_postulacion: 'Nota del cliente B' }));
        await pulsar('[aria-label="Guardar seguimiento"]');
        await esperar(() => fixture!.nativeElement.textContent.includes('Seguimiento guardado'));
        expect((await observar()).oferta).toEqual(jasmine.objectContaining({
            fecha_postulacion: '2024-03-01', nota_postulacion: 'Nota del cliente B',
        }));
        // Invierto los campos: una nota enviada desde A no puede borrar la fecha que confirmó B.
        await editar('#nota-postulacion', 'Nota del cliente A');
        await firstValueFrom(http.patch(`${base}/api/ofertas/${id}/seguimiento`, { fecha_postulacion: '2024-03-02' }));
        await pulsar('[aria-label="Guardar seguimiento"]');
        await esperar(() => fixture!.nativeElement.textContent.includes('Seguimiento guardado'));
        expect((await observar()).oferta).toEqual(jasmine.objectContaining({
            fecha_postulacion: '2024-03-02', nota_postulacion: 'Nota del cliente A',
        }));
        // Restauro explícitamente el fixture final que también verifica el runner PostgreSQL.
        await firstValueFrom(http.patch(`${base}/api/ofertas/${id}/seguimiento`, {
            fecha_postulacion: '2024-02-29', nota_postulacion: 'Envié CV; próxima entrevista',
        }));
        await firstValueFrom(http.post(`${control}/completado`, {}));
    }, 60000);
});
