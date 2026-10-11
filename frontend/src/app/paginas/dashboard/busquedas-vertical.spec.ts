import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { concatMap, firstValueFrom } from 'rxjs';
import { Dashboard } from './dashboard';
import { PanelControl } from '../../componentes/panel-control/panel-control';
import { DemoService } from '../../servicios/demo.service';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { environment } from '../../../environments/environment';

// El harness pasa un nonce por --define; la suite habitual informa tres SKIPPED.
declare const BUSQUEDAS_VERTICAL: string;
const nonce = typeof BUSQUEDAS_VERTICAL === 'undefined' ? null : BUSQUEDAS_VERTICAL;
const suite = nonce ? describe : xdescribe;
const base = 'http://127.0.0.1:43193';
const control = `${base}/__prueba_busquedas_vertical`;
const terminosGuardados = ['soporte IT', 'mesa de ayuda'];
const terminosEjecutados = [...terminosGuardados, 'asistencia técnica'];

interface Observaciones {
    actores: { actor: string; entrada: { urls?: string[] } }[];
    requestsExternas: string[];
    redNoContemplada: string[];
    deepseek: unknown[];
    http: { metodo: string; ruta: string; estado: number }[];
    ofertas: { titulo: string; estado_evaluacion: string; estado_postulacion: string; plataforma: string; datos_crudos: string }[];
    lotes: { estado: string; aprobadas: number; errores: number }[];
    sqlNoContemplado: string[];
    cronActivo: boolean;
}

suite('Búsquedas verticales opt-in — Chrome/HttpClient/Express/IndexedDB', () => {
    let fixture: ComponentFixture<Dashboard> | undefined;
    let http: HttpClient;
    let urlOriginal: string;
    let cambiarDespuesDelPreview = false;
    let cacheOriginal: string | null;
    let configurado = false;

    // Espero condiciones observables con plazo, no duermo para adivinar cuándo terminó HTTP.
    async function esperar(condicion: () => boolean | Promise<boolean>): Promise<void> {
        const limite = performance.now() + 25000;
        while (!(await condicion())) {
            if (performance.now() > limite) throw new Error('No se cumplió la condición vertical dentro de 25 segundos');
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            fixture?.detectChanges();
        }
        fixture?.detectChanges();
    }
    const observar = () => firstValueFrom(http.get<Observaciones>(`${control}/observaciones`));
    const pulsar = (etiqueta: string) => {
        const boton = fixture!.nativeElement.querySelector(`button[aria-label="${etiqueta}"]`) as HTMLButtonElement;
        expect(boton).not.toBeNull();
        expect(boton.disabled).toBeFalse();
        boton.click();
        fixture!.detectChanges();
    };

    beforeEach(async () => {
        configurado = false;
        urlOriginal = environment.urlApi;
        cacheOriginal = localStorage.getItem('busca-empleos.dashboard.cache');
        // Verifico identidad antes de crear servicios: jamás uso localhost:3000 ni otra API.
        const listo = await fetch(`${control}/listo`, { headers: { Authorization: `Bearer ${nonce}` }, signal: AbortSignal.timeout(3000) });
        if (!listo.ok || (await listo.json()).nonce !== nonce) throw new Error('El servidor no es el fixture autorizado por el harness');
        environment.urlApi = `${base}/api`;
        cambiarDespuesDelPreview = false;
        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } },
                provideHttpClient(withInterceptors([(req, next) => {
                    if (!req.url.startsWith(`${base}/`)) throw new Error(`HTTP fuera del fixture: ${req.url}`);
                    return next(req.clone({ setHeaders: { Authorization: `Bearer ${nonce}` } })).pipe(concatMap(async evento => {
                        if (evento instanceof HttpResponse && req.url.endsWith('/scraping/previsualizacion') && cambiarDespuesDelPreview) {
                            cambiarDespuesDelPreview = false;
                            // Simulo otro cliente guardando después del GET: sigue siendo un PUT real.
                            await firstValueFrom(TestBed.inject(PreferenciasService).actualizarPreferencias({ terminos_busqueda: terminosEjecutados }));
                        }
                        return evento;
                    }));
                }])),
            ],
        }).compileComponents();
        configurado = true;
        http = TestBed.inject(HttpClient);
        await firstValueFrom(http.post(`${control}/reiniciar`, {}));
        const persistencia = TestBed.inject(PersistenciaDashboardService);
        persistencia.limpiarCache();
        await persistencia.limpiarSincronizacion();
        fixture = TestBed.createComponent(Dashboard);
        fixture.detectChanges();
        await esperar(() => fixture!.componentInstance.estadoOperativoSincronizacion()?.estado === 'completada');
        const panel = fixture.debugElement.query(By.directive(PanelControl)).componentInstance as PanelControl;
        await esperar(() => panel.previsualizacion().length > 0 && !panel.cargandoPrevisualizacion());
    });

    afterEach(async () => {
        fixture?.destroy();
        fixture = undefined;
        environment.urlApi = urlOriginal;
        if (cacheOriginal === null) localStorage.removeItem('busca-empleos.dashboard.cache');
        else localStorage.setItem('busca-empleos.dashboard.cache', cacheOriginal);
        if (configurado) await TestBed.inject(PersistenciaDashboardService).limpiarSincronizacion();
    });

    it('QA guardado → ciclo parcial real → omisiones explícitas → ofertas y refresco final', async () => {
        const dashboard = fixture!.componentInstance;
        const elemento = fixture!.debugElement.query(By.directive(PanelControl));
        const panel = elemento.componentInstance as PanelControl;
        const evento = spyOn(panel.accionCompletada, 'emit').and.callThrough();
        await firstValueFrom(TestBed.inject(PreferenciasService).actualizarPreferencias({ terminos_busqueda: ['QA'] }));
        pulsar('Ejecutar ciclo completo de scraping y evaluación');
        await esperar(async () => (await observar()).actores.some(a => a.entrada.urls?.some(url => url.includes('keywords=QA')) === true));
        expect(evento).not.toHaveBeenCalled();
        expect(panel.previsualizacion().find(p => p.plataforma === 'indeed')!.ejecutable).toBeFalse();
        await firstValueFrom(http.post(`${control}/liberar`, {}));
        await esperar(() => evento.calls.count() === 1 && dashboard.ofertas().length === 2 && !dashboard.sincronizando());
        const omitidas = panel.configuracionCiclo().filter(p => p.motivoOmision);
        expect(omitidas.map(p => p.plataforma).sort()).toEqual(['adzuna', 'bumeran', 'indeed', 'jooble']);
        expect(omitidas.every(p => p.terminos.join() === 'QA' && p.advertencias.includes(p.motivoOmision!))).toBeTrue();
        const estado = await firstValueFrom(http.get<{ datos: { ultimoResultado: { omisiones: unknown[]; errores: string[] } } }>(`${base}/api/automatizacion/estado`));
        expect(estado.datos.ultimoResultado.omisiones.length).toBe(4);
        expect(estado.datos.ultimoResultado.errores).toEqual([]);
        const evidencia = await observar();
        expect(evidencia.actores.length).toBe(2); // LinkedIn y Glassdoor; sin Indeed ni Bumeran.
        expect(evidencia.actores[0].entrada.urls?.map(url => new URL(url).searchParams.get('keywords'))).toEqual(['QA']);
        expect(evidencia.requestsExternas.some(url => /jooble|adzuna/.test(url))).toBeFalse();
        expect(evidencia.requestsExternas).toContain('https://www.computrabajo.com.ar/trabajo-de-qa');
        expect(evidencia.redNoContemplada).toEqual([]);
        expect(evidencia.sqlNoContemplado).toEqual([]);
        expect(evidencia.cronActivo).toBeFalse();
        expect(evidencia.http.some(r => r.ruta === '/api/automatizacion/ejecutar' && r.estado === 202)).toBeTrue();
        expect(evidencia.ofertas[1].estado_evaluacion).toBe('aprobada');
        expect(fixture!.nativeElement.textContent).toContain('Omitida');
        expect(fixture!.nativeElement.textContent).toContain('Soporte vertical nuevo');
        expect(fixture!.nativeElement.querySelector('[aria-labelledby="stat-label-total"]').textContent.trim()).toBe('2');
        await firstValueFrom(http.post(`${control}/completado`, { flujo: 'qa' }));
    }, 45000);

    for (const ciclo of [false, true]) {
        it(`guardo preferencias → ${ciclo ? 'ciclo 202/poll/evaluación' : 'individual'} → oferta persistida → evento → DOM/conteos`, async () => {
            const dashboard = fixture!.componentInstance;
            const panel = fixture!.debugElement.query(By.directive(PanelControl)).componentInstance as PanelControl;
            const evento = spyOn(panel.accionCompletada, 'emit').and.callThrough();
            expect(dashboard.ofertas().length).toBe(1);
            expect(fixture!.nativeElement.textContent).not.toContain('Soporte vertical nuevo');
            expect(fixture!.nativeElement.querySelector('[aria-labelledby="stat-label-total"]').textContent.trim()).toBe('1');
            dashboard.filtroPlataforma.set('linkedin');
            await firstValueFrom(TestBed.inject(PreferenciasService).actualizarPreferencias({ terminos_busqueda: terminosGuardados }));
            cambiarDespuesDelPreview = true;
            pulsar(ciclo ? 'Ejecutar ciclo completo de scraping y evaluación' : 'Scrapear LinkedIn');
            await esperar(async () => (await observar()).actores.some(a => a.entrada.urls?.some(url => url.includes('keywords=soporte+IT')) === true));
            expect(dashboard.filtroPlataforma()).toBe('linkedin');
            expect(dashboard.ofertas()[0].estado_postulacion).toBe('cv_enviado');
            expect(fixture!.nativeElement.textContent).not.toContain('Soporte vertical nuevo');
            expect(evento).not.toHaveBeenCalled();
            expect(panel.previsualizacion().find(p => p.plataforma === 'linkedin')!.terminos).toEqual(terminosGuardados);
            await firstValueFrom(http.post(`${control}/liberar`, {}));
            await esperar(() => evento.calls.count() === 1 && dashboard.ofertas().length === 2 && !dashboard.sincronizando());
            expect(dashboard.filtroPlataforma()).toBe('linkedin');
            expect(dashboard.ofertas().find(o => o.titulo === 'Soporte existente')!.estado_postulacion).toBe('cv_enviado');
            const resumen = ciclo ? panel.configuracionCiclo().find(p => p.plataforma === 'linkedin')! : panel.configuracionIndividual()!;
            expect(resumen.terminos).toEqual(terminosEjecutados);
            expect(fixture!.nativeElement.textContent).toContain('asistencia técnica');
            if (!ciclo) {
                const pendientes = Array.from(fixture!.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>).find(tab => tab.textContent?.includes('PENDIENTES'))!;
                pendientes.click();
                fixture!.detectChanges();
            }
            expect(fixture!.nativeElement.textContent).toContain('Soporte vertical nuevo');
            expect(fixture!.nativeElement.textContent).not.toContain('English synthetic');
            expect(fixture!.nativeElement.querySelector('[aria-labelledby="stat-label-total"]').textContent.trim()).toBe('2');
            expect(fixture!.nativeElement.querySelector(`[aria-labelledby="stat-label-${ciclo ? 'aprobadas' : 'pendientes'}"]`).textContent.trim()).toBe('1');
            expect(dashboard.fallbackSincronizacion()).toBeFalse();
            // Una instancia vacía lee el store real: no puedo aprobar sólo con el Map en memoria.
            const persistidas = await new PersistenciaDashboardService().obtenerOfertasSincronizadas();
            expect(persistidas.map(o => o.titulo)).toContain('Soporte vertical nuevo');
            expect(persistidas.length).toBe(2);
            for (const fuente of ['getonbrd', 'google-jobs', 'infojobs']) {
                await firstValueFrom(http.post(`${base}/api/scraping/${fuente}`, {}));
            }
            const evidencia = await observar();
            expect(evidencia.sqlNoContemplado).toEqual([]);
            expect(evidencia.redNoContemplada).toEqual([]);
            expect(evidencia.cronActivo).toBeFalse();
            expect(evidencia.ofertas.map(o => o.titulo)).toEqual(['Soporte existente', 'Soporte vertical nuevo']);
            expect(evidencia.ofertas[1].plataforma).toBe('linkedin');
            expect(evidencia.ofertas[1].datos_crudos).toContain('jobTitle');
            expect(evidencia.actores[0].entrada.urls?.map(url => new URL(url).searchParams.get('keywords'))).toEqual(terminosEjecutados);
            expect(evidencia.requestsExternas.some(url => /getonbrd|infojobs|google/i.test(url))).toBeFalse();
            if (ciclo) {
                expect(evidencia.http.some(r => r.ruta === '/api/automatizacion/ejecutar' && r.estado === 202)).toBeTrue();
                expect(evidencia.http.some(r => r.ruta === '/api/automatizacion/progreso' && r.estado === 200)).toBeTrue();
                expect(evidencia.deepseek.length).toBe(1);
                expect(evidencia.lotes[0]).toEqual(jasmine.objectContaining({ estado: 'completado', aprobadas: 1, errores: 0 }));
                expect(evidencia.ofertas[1].estado_evaluacion).toBe('aprobada');
            } else {
                expect(evidencia.deepseek.length).toBe(0);
                expect(evidencia.ofertas[1].estado_evaluacion).toBe('pendiente');
            }
            await firstValueFrom(http.post(`${control}/completado`, { flujo: ciclo ? 'ciclo' : 'individual' }));
        }, 45000);
    }
});
