import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PanelControl } from './panel-control';
import { ScrapingService } from '../../servicios/scraping.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { AutomatizacionService } from '../../servicios/automatizacion.service';
import { MessageService } from 'primeng/api';
import { of, throwError, Observable, Subject } from 'rxjs';
import { ProgresoAutomatizacion, ResumenBusqueda, ResultadoFuente, RespuestaApi, RespuestaScraping } from '../../modelos/respuesta-api.model';

describe('PanelControl — Selector mobile de scraping', () => {

    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;

    const mockScrapingService = {
        obtenerPrevisualizacion: () => of({ exito: true, datos: { plataformas: [] } }),
        scrapearGetonbrd: (): Observable<RespuestaApi<RespuestaScraping>> => of({ exito: true, datos: {
            mensaje: '', plataforma: 'getonbrd', total_extraidas: 2, ofertas_nuevas: 2, ofertas_duplicadas: 0,
            fuente: { plataforma: 'getonbrd', estado: 'completada', nuevas: 2 },
        } }),
        scrapearLinkedin:     () => of({ exito: true, datos: { total_extraidas: 5, ofertas_nuevas: 3 } }),
        scrapearComputrabajo: () => of({ exito: true, datos: { total_extraidas: 2, ofertas_nuevas: 1 } }),
        scrapearIndeed:       () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0 } }),
        scrapearBumeran:      () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearGlassdoor:    () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearJooble:       () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearGoogleJobs:   () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearRemotive:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearRemoteOK:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearInfojobs:     () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
        scrapearAdzuna:       () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
    };

    const mockEvaluacionService = {
        ejecutarEvaluacion: () => of({ exito: true }),
        cancelarEvaluacion: () => of({ exito: true }),
        obtenerProgreso:    () => of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } }),
        reintentarErrores:  () => of({ exito: true, en_curso: true, total: 1, mensaje: 'Reintentando...' }),
    };

    // Versión mutable del mock para poder cambiar respuestas dentro de los tests.
    let mockEvaluacionServiceMutable: jasmine.SpyObj<EvaluacionService>;

    const mockAutomatizacionService = {
        obtenerHistorial: () => of({ exito: true, datos: [] }),
        obtenerEstado:  () => of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } }),
        iniciarCron:    () => of({ exito: true, datos: { activo: true,  expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } }),
        detenerCron:    () => of({ exito: true }),
        obtenerProgreso:() => of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } as ProgresoAutomatizacion }),
        ejecutarCiclo:  () => of({ exito: true }),
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService,       useValue: mockScrapingService },
                { provide: EvaluacionService,     useValue: mockEvaluacionService },
                { provide: AutomatizacionService, useValue: mockAutomatizacionService },
                provideNoopAnimations(),
                MessageService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('priorizo acciones y conservo configuración e historial cerrados sin disparar operaciones', () => {
        const extraer = spyOn(mockScrapingService, 'scrapearLinkedin').and.callThrough();
        const cron = spyOn(mockAutomatizacionService, 'iniciarCron').and.callThrough();
        const evaluar = spyOn(mockEvaluacionService, 'ejecutarEvaluacion').and.callThrough();
        const raiz: HTMLElement = fixture.nativeElement;
        const detalles = raiz.querySelector<HTMLDetailsElement>('details[aria-label="Configuración efectiva de búsquedas"]');
        expect(detalles).not.toBeNull();
        expect(detalles?.open).toBeFalse();
        const accion = raiz.querySelector('[aria-label="Acciones de scraping"]')!;
        expect(accion.compareDocumentPosition(detalles!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        detalles!.open = true;
        raiz.querySelector<HTMLButtonElement>('details button')!.click();
        fixture.detectChanges();
        expect(extraer).not.toHaveBeenCalled();
        expect(cron).not.toHaveBeenCalled();
        expect(evaluar).not.toHaveBeenCalled();
        expect(raiz.querySelector<HTMLDetailsElement>('details[aria-label="Resultados e historial"]')?.open).toBeFalse();
    });

    it('mantengo errores, límites y fuentes bloqueadas visibles fuera de los detalles', () => {
        component.previsualizacion.set([{ plataforma: 'jooble', nombre: 'Jooble', habilitada: true,
            ejecutable: false, terminos: [], ubicacion: [], ventanaDias: 30, maxResultados: 40,
            advertencias: ['Falta la clave del proveedor'], filtros: {},
            origen: { terminos: 'preferencias', ubicacion: 'preferencias' } }]);
        component.resultadoIndividual.set({ plataforma: 'linkedin', estado: 'parcial',
            motivoFinalizacion: 'Límite de peticiones', errores: [{ tipo: 'proveedor', mensaje: 'Cuota agotada' }] });
        component.errorHistorial.set('No pude leer el historial');
        fixture.detectChanges();
        const resumen: HTMLElement = fixture.nativeElement.querySelector('[aria-label="Estado operativo de búsquedas"]');
        expect(resumen).not.toBeNull();
        expect(resumen.textContent).toContain('Cuota agotada');
        expect(resumen.textContent).toContain('Límite de peticiones');
        expect(resumen.textContent).toContain('Falta la clave del proveedor');
        expect(resumen.textContent).toContain('No pude leer el historial');
        expect(resumen.closest('details')).toBeNull();
    });

    const resumenGetonbrd: ResumenBusqueda = {
        plataforma: 'getonbrd', nombre: 'GetOnBrd', habilitada: true, ejecutable: true,
        terminos: ['junior'], ubicacion: [], ventanaDias: 30, maxResultados: 40,
        filtros: {}, advertencias: [], origen: { terminos: 'preferencias', ubicacion: 'defecto' },
    };

    function habilitarGetonbrd(): void {
        spyOn(mockScrapingService, 'obtenerPrevisualizacion').and.returnValue(of({
            exito: true, datos: { plataformas: [resumenGetonbrd] },
        }) as any);
        component.actualizarPrevisualizacion();
        fixture.detectChanges();
    }

    it('deniego GetOnBrd inicialmente y explico la ausencia de previsualización', () => {
        expect(component.opcionesPlataforma.some(o => o.value === 'getonbrd')).toBeFalse();
        const boton = fixture.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]');
        expect(boton).not.toBeNull();
        expect(boton.disabled).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('No pude confirmar la disponibilidad de GetOnBrd');
    });

    for (const cambios of [
        { habilitada: false, ejecutable: false },
        { habilitada: true, ejecutable: false },
        { habilitada: false, ejecutable: true },
    ]) {
        it(`deniego GetOnBrd con disponibilidad ${JSON.stringify(cambios)} y muestro el motivo`, () => {
            spyOn(mockScrapingService, 'obtenerPrevisualizacion').and.returnValue(of({
                exito: true, datos: { plataformas: [{ ...resumenGetonbrd, ...cambios, advertencias: ['Evidencia no válida'] }] },
            }) as any);
            const extraer = spyOn(mockScrapingService, 'scrapearGetonbrd').and.callThrough();
            const evento = spyOn(component.accionCompletada, 'emit');
            component.actualizarPrevisualizacion();
            component.plataformaSeleccionadaModel = 'getonbrd';
            component.scrapearGetonbrd();
            fixture.detectChanges();
            expect(component.plataformaSeleccionada()).toBe('linkedin');
            expect(component.opcionesPlataforma.some(o => o.value === 'getonbrd')).toBeFalse();
            expect(extraer).not.toHaveBeenCalled();
            expect(evento).not.toHaveBeenCalled();
            expect(component.scrapeandoAlguno()).toBeFalse();
            expect(fixture.nativeElement.textContent).toContain('Evidencia no válida');
        });
    }

    it('habilito desktop y mobile sólo con ambos permisos efectivos, sin iniciar cron ni IA', () => {
        const cron = spyOn(mockAutomatizacionService, 'iniciarCron').and.callThrough();
        const evaluar = spyOn(mockEvaluacionService, 'ejecutarEvaluacion').and.callThrough();
        habilitarGetonbrd();
        expect(component.opcionesPlataforma.find(o => o.value === 'getonbrd')?.label).toBe('GetOnBrd');
        expect(fixture.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]').disabled).toBeFalse();
        expect(cron).not.toHaveBeenCalled();
        expect(evaluar).not.toHaveBeenCalled();
    });

    for (const accion of ['desktop', 'mobile']) {
        it(`ejecuto GetOnBrd desde ${accion}, mantengo carga y publico el resultado común`, () => {
            habilitarGetonbrd();
            const pendiente = new Subject<RespuestaApi<RespuestaScraping>>();
            const extraer = spyOn(mockScrapingService, 'scrapearGetonbrd').and.returnValue(pendiente);
            const evento = spyOn(component.accionCompletada, 'emit');
            if (accion === 'desktop') fixture.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]').click();
            else {
                component.plataformaSeleccionadaModel = 'getonbrd';
                fixture.detectChanges();
                fixture.nativeElement.querySelector('.scraping-selector-mobile__btn-extraer').click();
            }
            fixture.detectChanges();
            expect(extraer).toHaveBeenCalledTimes(1);
            expect(component.scrapeandoGetonbrd()).toBeTrue();
            expect(component.scrapeandoAlguno()).toBeTrue();
            expect(component.mostrarOverlayIndividual()).toBeTrue();
            expect(component.plataformaEnProceso()).toBe('GetOnBrd');
            expect(fixture.nativeElement.querySelector('.scraping-selector-mobile__btn-extraer').disabled).toBeTrue();
            const fuente: ResultadoFuente = { plataforma: 'getonbrd', estado: 'completada', nuevas: 2 };
            pendiente.next({ exito: true, datos: { mensaje: '', plataforma: 'getonbrd', total_extraidas: 2, ofertas_nuevas: 2, ofertas_duplicadas: 0, fuente } });
            pendiente.complete();
            fixture.detectChanges();
            expect(component.resultadoIndividual()).toEqual(fuente);
            expect(component.scrapeandoGetonbrd()).toBeFalse();
            expect(component.mostrarOverlayIndividual()).toBeFalse();
            expect(evento).toHaveBeenCalledTimes(1);
            expect(fixture.nativeElement.querySelector('app-resultado-fuente').textContent).toContain('GetOnBrd — Completada');
        });
    }

    it('retiro GetOnBrd si falla la actualización y no conservo un permiso anterior', () => {
        habilitarGetonbrd();
        component.plataformaSeleccionadaModel = 'getonbrd';
        (mockScrapingService.obtenerPrevisualizacion as jasmine.Spy).and.returnValue(throwError(() => new Error('Sin conexión')));
        const extraer = spyOn(mockScrapingService, 'scrapearGetonbrd').and.callThrough();
        component.actualizarPrevisualizacion();
        component.scrapearPlataformaSeleccionada();
        fixture.detectChanges();
        expect(component.opcionesPlataforma.some(o => o.value === 'getonbrd')).toBeFalse();
        expect(extraer).not.toHaveBeenCalled();
        expect(component.errorPrevisualizacion()).toContain('No pude consultar');
        expect(fixture.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]').disabled).toBeTrue();
    });

    it('retiro el permiso mientras consulto y no inicio GetOnBrd si el preview no confirma la fuente', () => {
        habilitarGetonbrd();
        const pendiente = new Subject<any>();
        (mockScrapingService.obtenerPrevisualizacion as jasmine.Spy).and.returnValue(pendiente);
        const extraer = spyOn(mockScrapingService, 'scrapearGetonbrd').and.callThrough();
        component.actualizarPrevisualizacion();
        fixture.detectChanges();
        expect(component.getonbrdDisponible()).toBeFalse();
        expect(component.opcionesPlataforma.some(o => o.value === 'getonbrd')).toBeFalse();
        expect(fixture.nativeElement.querySelector('[aria-label="Scrapear GetOnBrd"]').disabled).toBeTrue();
        pendiente.next({ exito: false, error: 'No pude resolver la configuración', datos: { plataformas: [] } });
        pendiente.complete();
        expect(component.errorPrevisualizacion()).toBe('No pude resolver la configuración');
        (mockScrapingService.obtenerPrevisualizacion as jasmine.Spy).and.returnValue(of({ exito: true, datos: { plataformas: [] } }));
        component.scrapearGetonbrd();
        expect(extraer).not.toHaveBeenCalled();
        expect(component.errorPrevisualizacion()).toContain('No pude confirmar');
    });

    it('consulto otra vez antes de ejecutar y respeto una revocación del backend', () => {
        habilitarGetonbrd();
        (mockScrapingService.obtenerPrevisualizacion as jasmine.Spy).and.returnValue(of({
            exito: true, datos: { plataformas: [{ ...resumenGetonbrd, habilitada: false, ejecutable: false, advertencias: ['Fuente deshabilitada'] }] },
        }));
        const extraer = spyOn(mockScrapingService, 'scrapearGetonbrd').and.callThrough();
        component.scrapearGetonbrd();
        expect(extraer).not.toHaveBeenCalled();
        expect(component.errorPrevisualizacion()).toBe('GetOnBrd no está disponible. Fuente deshabilitada');
        expect(component.resultadoIndividual()).toBeNull();
    });

    it('uso el ciclo común una sola vez sin disparar un scraping individual adicional', fakeAsync(() => {
        habilitarGetonbrd();
        const ciclo = spyOn(mockAutomatizacionService, 'ejecutarCiclo').and.returnValue(of({
            exito: true, datos: { configuracion: [resumenGetonbrd] },
        }) as any);
        const extraer = spyOn(mockScrapingService, 'scrapearGetonbrd').and.callThrough();
        const evaluar = spyOn(mockEvaluacionService, 'ejecutarEvaluacion').and.callThrough();
        component.ejecutarCicloCompleto();
        expect(ciclo).toHaveBeenCalledTimes(1);
        expect(component.configuracionCiclo()).toEqual([resumenGetonbrd]);
        expect(extraer).not.toHaveBeenCalled();
        expect(evaluar).not.toHaveBeenCalled();
        component.resultadoCiclo.set({ estado: 'parcial', fuentes: [{ plataforma: 'getonbrd', estado: 'parcial', nuevas: 2 }] });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('app-resultado-fuente').textContent).toContain('GetOnBrd — Parcial');
        fixture.destroy();
        tick(500);
    }));

    for (const estado of ['parcial', 'cancelada', 'deshabilitada', 'error', 'timeout'] as const) {
        it(`muestro ${estado} con métricas y checkpoint, sin inventar una búsqueda vacía`, () => {
            habilitarGetonbrd();
            const fuente: ResultadoFuente = {
                plataforma: 'getonbrd', estado, nuevas: estado === 'parcial' ? 2 : 0,
                actualizadas: 1, reapariciones: 1, peticionesRealizadas: 2,
                run_id: 'run-sintetico', checkpoint: { termino_indice: 0, termino: 'junior', pagina_confirmada: 1, pagina_siguiente: 2, item_offset: 3 },
                errores: [{ tipo: 'limite_solicitudes', codigoHttp: 429, mensaje: 'Sin reintentos' }],
                motivoFinalizacion: 'limite_solicitudes',
            };
            const datos: RespuestaScraping = { mensaje: '', plataforma: 'getonbrd', total_extraidas: 2, ofertas_nuevas: 2, ofertas_duplicadas: 0, fuente };
            spyOn(mockScrapingService, 'scrapearGetonbrd').and.returnValue(
                ['error', 'timeout'].includes(estado)
                    ? throwError(() => ({ status: estado === 'error' ? 502 : 504, error: { error: 'No pude completar la consulta al proveedor.', datos } }))
                    : of({ exito: true, datos })
            );
            const mensajes = spyOn((component as any).mensajes, 'add');
            const evento = spyOn(component.accionCompletada, 'emit');
            component.scrapearGetonbrd();
            fixture.detectChanges();
            const texto = fixture.nativeElement.querySelector('app-resultado-fuente').textContent;
            expect(texto).toContain('429');
            expect(texto).toContain('run-sintetico');
            expect(texto).toContain('Checkpoint');
            expect(texto).toContain('Página siguiente: 2');
            expect(texto).toContain('Posición: 3');
            expect(texto).toContain('Peticiones: 2');
            if (estado === 'cancelada') expect(texto).toContain('Cancelada');
            expect(component.resultadoIndividual()).toEqual(fuente);
            expect(component.scrapeandoAlguno()).toBeFalse();
            expect(component.mostrarOverlayIndividual()).toBeFalse();
            expect(mensajes).toHaveBeenCalledWith(jasmine.objectContaining({ severity: ['error', 'timeout'].includes(estado) ? 'error' : 'warn' }));
            if (estado === 'parcial') expect(evento).toHaveBeenCalledTimes(1);
            if (estado === 'deshabilitada') expect(evento).not.toHaveBeenCalled();
        });
    }

    for (const estado of ['error', 'completada'] as const) {
        it(`notifico el ciclo terminal con paso ${estado} sin confundir 100% con éxito`, fakeAsync(() => {
            const datos = {
                activo: false, porcentaje: 100,
                pasos: [{ nombre: 'evaluacion', label: 'Evaluación IA', estado, extraidas: 1 }],
            };
            const progresoSpy = spyOn(mockAutomatizacionService, 'obtenerProgreso').and.returnValue(of({ exito: true, datos }));
            const mensajesSpy = spyOn((component as any).mensajes, 'add');
            const eventoSpy = spyOn(component.accionCompletada, 'emit');
            component.ejecutandoCiclo.set(true);
            component.mostrarOverlayCiclo.set(true);
            (component as any).iniciarPolling();
            tick(2000);
            expect(component.ejecutandoCiclo()).toBeFalse();
            expect(component.progresoCiclo()).toEqual(datos);
            tick(1200);
            expect(mensajesSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({
                severity: estado === 'error' ? 'error' : 'success',
                summary: estado === 'error' ? 'Ciclo con errores' : 'Ciclo completo',
            }));
            if (estado === 'error') {
                expect(mensajesSpy).toHaveBeenCalledWith(jasmine.objectContaining({
                    detail: jasmine.stringMatching('parciales'),
                }));
            }
            expect(eventoSpy).toHaveBeenCalledTimes(1);
            expect(component.mostrarOverlayCiclo()).toBeFalse();
            tick(4000);
            expect(progresoSpy).toHaveBeenCalledTimes(1);
        }));
    }

    it('no emito éxito ni finalización ante un resultado individual fallido', () => {
        spyOn(mockScrapingService, 'scrapearLinkedin').and.returnValue(of({
            exito: false, datos: { total_extraidas: 0, ofertas_nuevas: 0 },
        }));
        const evento = spyOn(component.accionCompletada, 'emit');
        const mensajes = spyOn((component as any).mensajes, 'add');
        component.scrapearLinkedin();
        expect(evento).not.toHaveBeenCalled();
        expect(mensajes).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
        expect(component.mostrarOverlayIndividual()).toBeFalse();
    });

    it('modo demo bloquea también las llamadas directas sin spinner ni HTTP', () => {
        fixture.componentRef.setInput('modoDemo', true);
        const preview = spyOn(mockScrapingService, 'obtenerPrevisualizacion').and.callThrough();
        const extraer = spyOn(mockScrapingService, 'scrapearLinkedin').and.callThrough();
        component.scrapearLinkedin();
        component.ejecutarCicloCompleto();
        expect(preview).not.toHaveBeenCalled();
        expect(extraer).not.toHaveBeenCalled();
        expect(component.mostrarOverlayIndividual()).toBeFalse();
        expect(component.mostrarOverlayCiclo()).toBeFalse();
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

    it('opcionesPlataforma debería contener las 9 plataformas activas', () => {
        expect(component.opcionesPlataforma.length).toBe(9);
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

    it('opcionesPlataforma no debería incluir Google Jobs (inactiva)', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'google_jobs');
        expect(opcion).toBeUndefined();
    });

    it('opcionesPlataforma no debería incluir InfoJobs (inactiva)', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'infojobs');
        expect(opcion).toBeUndefined();
    });

    it('etiquetasPorPlataforma debería tener etiqueta para infojobs (para overlays de scraping histórico)', () => {
        // etiquetasPorPlataforma incluye TODAS las plataformas (activas e inactivas)
        // porque puede usarse para mostrar labels en overlays o mensajes.
        // Solo opcionesPlataforma (selector de scraping) excluye inactivas.
        expect(component.etiquetasPorPlataforma['infojobs']).toBe('InfoJobs');
    });

    it('scrapearPlataformaSeleccionada() con infojobs no debería llamar a scrapearInfojobs()', () => {
        spyOn(component, 'scrapearInfojobs');
        component.plataformaSeleccionada.set('infojobs');
        component.scrapearPlataformaSeleccionada();
        expect(component.scrapearInfojobs).not.toHaveBeenCalled();
    });

    it('scrapeandoAlguno() debería ser false incluso cuando scrapeandoInfojobs es true (InfoJobs desactivado)', () => {
        component.scrapeandoInfojobs.set(true);
        expect(component.scrapeandoAlguno()).toBeFalse();
    });

    // --- InfoJobs deshabilitado por falta de credenciales ---

    it('scrapearInfojobs() muestra toast info (no success) cuando InfoJobs está deshabilitado', fakeAsync(() => {
        // Simulo la respuesta del backend cuando faltan ambas credenciales.
        const mockScrapingServiceLocal = jasmine.createSpyObj('ScrapingService', ['scrapearInfojobs']);
        mockScrapingServiceLocal.scrapearInfojobs.and.returnValue(of({
            exito: true,
            datos: {
                mensaje: 'InfoJobs está deshabilitado por falta de credenciales.',
                plataforma: 'infojobs',
                ofertas_nuevas: 0,
                ofertas_duplicadas: 0,
                total_extraidas: 0,
                codigo_resultado: 'infojobs_deshabilitado_sin_credenciales',
                advertencia: 'Configurá INFOJOBS_CLIENT_ID y INFOJOBS_CLIENT_SECRET en el backend para activarlo.',
            },
        }));

        // Overrideo el servicio inyectado en el componente ya creado.
        mockScrapingServiceLocal.obtenerPrevisualizacion = mockScrapingService.obtenerPrevisualizacion;
        (component as any).scrapingService = mockScrapingServiceLocal;

        const mensajesSpy = spyOn((component as any).mensajes, 'add');
        const accionCompletadaSpy = spyOn(component.accionCompletada, 'emit');

        component.scrapearInfojobs();
        tick(0);

        // Debe mostrar un toast de tipo 'info', no 'success'.
        expect(mensajesSpy).toHaveBeenCalledOnceWith(
            jasmine.objectContaining({ severity: 'info' })
        );
        // No debe emitir accionCompletada: no se guardó nada en la BD.
        expect(accionCompletadaSpy).not.toHaveBeenCalled();
        // El estado de carga debe haberse limpiado.
        expect(component.scrapeandoInfojobs()).toBeFalse();
        expect(component.mostrarOverlayIndividual()).toBeFalse();

        discardPeriodicTasks();
    }));

    it('scrapearInfojobs() muestra toast success cuando el scraping se ejecutó normalmente', fakeAsync(() => {
        const mockScrapingServiceLocal = jasmine.createSpyObj('ScrapingService', ['scrapearInfojobs']);
        mockScrapingServiceLocal.scrapearInfojobs.and.returnValue(of({
            exito: true,
            datos: {
                mensaje: 'Scraping de InfoJobs completado: 3 ofertas nuevas.',
                plataforma: 'infojobs',
                ofertas_nuevas: 3,
                ofertas_duplicadas: 1,
                total_extraidas: 4,
            },
        }));

        mockScrapingServiceLocal.obtenerPrevisualizacion = mockScrapingService.obtenerPrevisualizacion;
        (component as any).scrapingService = mockScrapingServiceLocal;

        const mensajesSpy = spyOn((component as any).mensajes, 'add');
        const accionCompletadaSpy = spyOn(component.accionCompletada, 'emit');

        component.scrapearInfojobs();
        tick(0);

        expect(mensajesSpy).toHaveBeenCalledOnceWith(
            jasmine.objectContaining({ severity: 'success' })
        );
        expect(accionCompletadaSpy).toHaveBeenCalledTimes(1);

        discardPeriodicTasks();
    }));

    // --- Visibilidad del selector mobile en el DOM ---

    it('el bloque .scraping-selector-mobile debería existir en el template', () => {
        const el = fixture.nativeElement.querySelector('.scraping-selector-mobile');
        expect(el).toBeTruthy();
    });

    it('los botones .scraping-solo-desktop deberían existir en el template', () => {
        const botones = fixture.nativeElement.querySelectorAll('.scraping-solo-desktop');
        expect(botones.length).toBe(10);
    });

    it('el p-select del selector mobile debería existir en el template', () => {
        const selectEl = fixture.nativeElement.querySelector('p-select');
        expect(selectEl).toBeTruthy();
    });

    // --- Adzuna: integración en opciones y dispatcher ---

    it('opcionesPlataforma debería incluir Adzuna con valor adzuna', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'adzuna');
        expect(opcion).toBeTruthy();
        expect(opcion!.label).toBe('Adzuna');
    });

    it('etiquetasPorPlataforma debería tener etiqueta para adzuna', () => {
        expect(component.etiquetasPorPlataforma['adzuna']).toBe('Adzuna');
    });

    it('scrapearPlataformaSeleccionada() con adzuna llama a scrapearAdzuna()', () => {
        spyOn(component, 'scrapearAdzuna');
        component.plataformaSeleccionada.set('adzuna');
        component.scrapearPlataformaSeleccionada();
        expect(component.scrapearAdzuna).toHaveBeenCalled();
    });

    it('scrapeandoAlguno() debería ser true cuando scrapeandoAdzuna es true', () => {
        component.scrapeandoAdzuna.set(true);
        expect(component.scrapeandoAlguno()).toBeTrue();
    });

    it('el botón de Adzuna debería existir en el template', () => {
        const boton = fixture.nativeElement.querySelector('[aria-label="Scrapear Adzuna"]');
        expect(boton).toBeTruthy();
    });
});

// ============================================================
// Suite de tests: Polling defensivo (requests solapadas y 429)
// ============================================================

describe('PanelControl — Polling defensivo', () => {

    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;
    let evalSpy: jasmine.SpyObj<EvaluacionService>;
    let autoSpy: jasmine.SpyObj<AutomatizacionService>;

    beforeEach(async () => {
        evalSpy = jasmine.createSpyObj('EvaluacionService', [
            'ejecutarEvaluacion', 'cancelarEvaluacion', 'obtenerProgreso', 'reintentarErrores'
        ]);
        evalSpy.reintentarErrores.and.returnValue(
            of({ exito: true, en_curso: true, total: 1, mensaje: 'Reintentando...' })
        );
        autoSpy = jasmine.createSpyObj('AutomatizacionService', [
            'obtenerEstado', 'obtenerProgreso', 'iniciarCron', 'detenerCron', 'ejecutarCiclo'
        ]);
        autoSpy.obtenerHistorial = jasmine.createSpy().and.returnValue(of({ exito: true, datos: [] }));

        // Por defecto: sin evaluación activa en el ngOnInit para no activar rehidratación.
        // Cada test que necesite polling activo configura su propio retorno.
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } })
        );
        autoSpy.obtenerEstado.and.returnValue(
            of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } })
        );
        // Sin ciclo activo por defecto — los tests de polling lo configuran manualmente.
        autoSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } })
        );

        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService, useValue: { obtenerPrevisualizacion: () => of({ exito: true, datos: { plataformas: [] } }) } },
                { provide: EvaluacionService, useValue: evalSpy },
                { provide: AutomatizacionService, useValue: autoSpy },
                MessageService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();
        // Reseteo el contador del spy después del ngOnInit para que los tests que
        // verifican conteos exactos no sean afectados por la llamada de rehidratación.
        evalSpy.obtenerProgreso.calls.reset();
        autoSpy.obtenerProgreso.calls.reset();
    });

    afterEach(() => {
        // Destruyo el componente para limpiar todos los intervalos.
        fixture.destroy();
    });

    it('el polling de evaluación no dispara requests solapadas', fakeAsync(() => {
        // Simulo una request lenta que no resuelve durante el test
        // usando un Observable que no emite nada mientras pollea.
        // Con el guard, aunque el tick se repita, solo debe haber 1 llamada en vuelo.
        let resolveFn: (() => void) | null = null;
        evalSpy.obtenerProgreso.and.callFake(() =>
            // Observable que resuelve cuando `resolveFn` es invocada.
            new Observable((observer: any) => {
                // Guardar el observer para resolver manualmente.
                resolveFn = () => {
                    observer.next({ exito: true, datos: { activo: true, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } });
                    observer.complete();
                };
            })
        );

        // Arranco el polling (expongo el método vía cualquier llamada que lo active).
        // Llamo directamente al método privado via cast para el test.
        (component as any).iniciarPollingEvaluacion();

        // Avanzo 6 segundos (3 ticks de 2000ms): con el guard, solo debe haber 1 llamada
        // porque la primera request nunca resolvió.
        tick(2000);
        tick(2000);
        tick(2000);

        expect(evalSpy.obtenerProgreso).toHaveBeenCalledTimes(1);

        // Resuelvo la primera request.
        if (resolveFn) (resolveFn as () => void)();
        tick(0);

        // Ahora el siguiente tick sí debe poder disparar.
        tick(2000);
        expect(evalSpy.obtenerProgreso).toHaveBeenCalledTimes(2);

        discardPeriodicTasks();
    }));

    it('el polling de evaluación se detiene tras 5 errores 429 consecutivos', fakeAsync(() => {
        // Simulo respuestas 429.
        evalSpy.obtenerProgreso.and.returnValue(
            throwError(() => ({ status: 429 }))
        );

        (component as any).iniciarPollingEvaluacion();

        // 5 ticks = 5 errores 429 → el polling debe detenerse.
        for (let i = 0; i < 5; i++) {
            tick(2000);
        }

        const llamadasAntes = evalSpy.obtenerProgreso.calls.count();

        // Un tick más no debe generar nuevas llamadas porque el intervalo fue limpiado.
        tick(2000);

        expect(evalSpy.obtenerProgreso.calls.count()).toBe(llamadasAntes);
        expect((component as any).intervalIdPollingEval).toBeNull();

        discardPeriodicTasks();
    }));

    it('el polling de automatización no dispara requests solapadas', fakeAsync(() => {
        let resolveFn: (() => void) | null = null;
        autoSpy.obtenerProgreso.and.callFake(() =>
            new Observable((observer: any) => {
                resolveFn = () => {
                    observer.next({ exito: true, datos: { activo: true, porcentaje: 10, pasos: [] } });
                    observer.complete();
                };
            })
        );

        (component as any).iniciarPolling();

        tick(2000);
        tick(2000);
        tick(2000);

        // Solo 1 llamada — las siguientes fueron bloqueadas por el guard.
        expect(autoSpy.obtenerProgreso).toHaveBeenCalledTimes(1);

        if (resolveFn) (resolveFn as () => void)();
        tick(0);
        tick(2000);

        expect(autoSpy.obtenerProgreso).toHaveBeenCalledTimes(2);

        discardPeriodicTasks();
    }));

    it('el polling de automatización se detiene tras 5 errores 429 consecutivos', fakeAsync(() => {
        autoSpy.obtenerProgreso.and.returnValue(
            throwError(() => ({ status: 429 }))
        );

        (component as any).iniciarPolling();

        for (let i = 0; i < 5; i++) {
            tick(2000);
        }

        const llamadasAntes = autoSpy.obtenerProgreso.calls.count();
        tick(2000);

        expect(autoSpy.obtenerProgreso.calls.count()).toBe(llamadasAntes);
        expect((component as any).intervalIdPolling).toBeNull();

        discardPeriodicTasks();
    }));

    it('ngOnDestroy limpia ambos intervalos de polling', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: true, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } })
        );

        (component as any).iniciarPollingEvaluacion();
        (component as any).iniciarPolling();

        expect((component as any).intervalIdPollingEval).not.toBeNull();
        expect((component as any).intervalIdPolling).not.toBeNull();

        component.ngOnDestroy();

        expect((component as any).intervalIdPollingEval).toBeNull();
        expect((component as any).intervalIdPolling).toBeNull();

        discardPeriodicTasks();
    }));

    // --- Regresión: un solo 429 no corta el polling ---
    //
    // El comportamiento esperado es: solo se corta después de MAX_ERRORES_429
    // errores 429 CONSECUTIVOS. Un único 429 aislado no debe detener el polling.

    it('el polling de evaluación NO se detiene con un único error 429', fakeAsync(() => {
        let llamada = 0;
        evalSpy.obtenerProgreso.and.callFake(() => {
            llamada++;
            if (llamada === 2) {
                // Solo la segunda llamada da 429.
                return throwError(() => ({ status: 429 }));
            }
            return of({ exito: true, datos: { activo: true, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } });
        });

        (component as any).iniciarPollingEvaluacion();

        tick(2000); // 1.ª call: éxito
        tick(2000); // 2.ª call: 429 único
        tick(2000); // 3.ª call: debe continuar (solo 1 error, no 5)

        // El polling sigue activo: el intervalo no fue limpiado.
        expect((component as any).intervalIdPollingEval).not.toBeNull();
        // Hubo al menos 3 llamadas.
        expect(evalSpy.obtenerProgreso).toHaveBeenCalledTimes(3);

        discardPeriodicTasks();
    }));

    it('el polling de evaluación retoma normalmente después de un 429 aislado', fakeAsync(() => {
        // 4 éxitos, luego 1 error 429, luego 4 éxitos más.
        // El contador interno debe resetearse con cada éxito, así que
        // al final el polling sigue activo y el intervalId no es null.
        let llamada = 0;
        evalSpy.obtenerProgreso.and.callFake(() => {
            llamada++;
            if (llamada === 3) {
                return throwError(() => ({ status: 429 }));
            }
            return of({ exito: true, datos: { activo: true, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } });
        });

        (component as any).iniciarPollingEvaluacion();

        // 6 ticks: 2 éxitos → 1 error 429 → 3 éxitos más.
        for (let i = 0; i < 6; i++) tick(2000);

        // El contador de errores fue reseteado por los éxitos posteriores.
        expect((component as any).errores429Eval).toBe(0);
        // El polling sigue activo.
        expect((component as any).intervalIdPollingEval).not.toBeNull();

        discardPeriodicTasks();
    }));

    it('un error de red (no 429) no detiene el polling de evaluación', fakeAsync(() => {
        let llamada = 0;
        evalSpy.obtenerProgreso.and.callFake(() => {
            llamada++;
            if (llamada % 2 === 0) {
                // Cada segunda llamada da un error 500 (no 429).
                return throwError(() => ({ status: 500, message: 'Internal Server Error' }));
            }
            return of({ exito: true, datos: { activo: true, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } });
        });

        (component as any).iniciarPollingEvaluacion();

        // 10 ticks alternando éxito/error 500.
        for (let i = 0; i < 10; i++) tick(2000);

        // El polling sigue activo: errores 500 no incrementan el contador de 429.
        expect((component as any).intervalIdPollingEval).not.toBeNull();
        expect((component as any).errores429Eval).toBe(0);

        discardPeriodicTasks();
    }));

    it('el polling de automatización retoma normalmente después de un 429 aislado', fakeAsync(() => {
        let llamada = 0;
        autoSpy.obtenerProgreso.and.callFake(() => {
            llamada++;
            if (llamada === 2) {
                return throwError(() => ({ status: 429 }));
            }
            return of({ exito: true, datos: { activo: true, porcentaje: 10, pasos: [] } });
        });

        (component as any).iniciarPolling();

        // 5 ticks: 1 éxito → 1 error 429 → 3 éxitos.
        for (let i = 0; i < 5; i++) tick(2000);

        // Contador reseteado por el éxito del tick 3.
        expect((component as any).errores429Ciclo).toBe(0);
        expect((component as any).intervalIdPolling).not.toBeNull();

        discardPeriodicTasks();
    }));

    it('un error de red (no 429) no detiene el polling de automatización', fakeAsync(() => {
        autoSpy.obtenerProgreso.and.returnValue(
            throwError(() => ({ status: 503, message: 'Service Unavailable' }))
        );

        (component as any).iniciarPolling();

        for (let i = 0; i < 10; i++) tick(2000);

        // Errores 503 no incrementan el contador de 429, el polling sigue.
        expect((component as any).intervalIdPolling).not.toBeNull();
        expect((component as any).errores429Ciclo).toBe(0);

        discardPeriodicTasks();
    }));
});

// ============================================================
// Suite de tests: Rehidratación de evaluación activa al montar
// ============================================================

describe('PanelControl — Rehidratación de evaluación al remount', () => {

    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;
    let evalSpy: jasmine.SpyObj<EvaluacionService>;
    let autoSpy: jasmine.SpyObj<AutomatizacionService>;

    const progresoActivoMock = {
        activo: true,
        evaluadas: 3,
        total: 10,
        aprobadas: 2,
        rechazadas: 1,
        errores: 0,
        porcentaje: 30
    };

    beforeEach(async () => {
        evalSpy = jasmine.createSpyObj('EvaluacionService', [
            'ejecutarEvaluacion', 'cancelarEvaluacion', 'obtenerProgreso', 'reintentarErrores'
        ]);
        evalSpy.reintentarErrores.and.returnValue(
            of({ exito: true, en_curso: true, total: 1, mensaje: 'Reintentando...' })
        );
        autoSpy = jasmine.createSpyObj('AutomatizacionService', [
            'obtenerEstado', 'obtenerProgreso', 'iniciarCron', 'detenerCron', 'ejecutarCiclo'
        ]);
        autoSpy.obtenerHistorial = jasmine.createSpy().and.returnValue(of({ exito: true, datos: [] }));

        autoSpy.obtenerEstado.and.returnValue(
            of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } })
        );
        autoSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } })
        );

        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService, useValue: { obtenerPrevisualizacion: () => of({ exito: true, datos: { plataformas: [] } }) } },
                { provide: EvaluacionService, useValue: evalSpy },
                { provide: AutomatizacionService, useValue: autoSpy },
                MessageService,
            ],
        }).compileComponents();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('rehidrata error terminal visible y limpia el aviso al iniciar un nuevo lote', async () => {
        evalSpy.obtenerProgreso.and.returnValue(of({ exito: true, datos: {
            ...progresoActivoMock, activo: false, estado: 'error', mensaje_error: 'Fallo SQL sintético', pendientes: 7,
        } }));
        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.autoDetectChanges();
        await fixture.whenStable();
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Fallo SQL sintético');
        expect(fixture.nativeElement.textContent).toContain('3 resultado(s) actualizado(s), 7 pendiente(s)');
        expect(fixture.nativeElement.textContent).not.toContain('Evaluación completada');
        expect(component.evaluando()).toBeFalse();
        evalSpy.ejecutarEvaluacion.and.returnValue(of({ exito: true, en_curso: true, mensaje: 'Iniciada' }));
        component.ejecutarEvaluacion([1]);
        await fixture.whenStable();
        expect(component.errorEvaluacion()).toBeNull();
        expect(component.progresoEvaluacion()).toBeNull();
        expect(component.evaluando()).toBeTrue();
    });

    it('al remontarse con evaluación activa, evaluando() queda en true', fakeAsync(() => {
        // El backend reporta evaluación en curso.
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: progresoActivoMock })
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges(); // dispara ngOnInit → rehidratarEvaluacion()

        // La señal debe haberse rehidratado.
        expect(component.evaluando()).toBeTrue();

        discardPeriodicTasks();
    }));

    it('al remontarse con evaluación activa, progresoEvaluacion() NO queda en null', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: progresoActivoMock })
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const progreso = component.progresoEvaluacion();
        expect(progreso).not.toBeNull();
        expect(progreso!.evaluadas).toBe(3);
        expect(progreso!.porcentaje).toBe(30);

        discardPeriodicTasks();
    }));

    it('al remontarse sin evaluación activa, evaluando() queda en false', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } })
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(component.evaluando()).toBeFalse();
        expect(component.progresoEvaluacion()).toBeNull();

        discardPeriodicTasks();
    }));

    it('al remontarse con evaluación activa, se inicia el polling de evaluación', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: progresoActivoMock })
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();

        // El polling debe estar activo (intervalId no nulo).
        expect((component as any).intervalIdPollingEval).not.toBeNull();

        discardPeriodicTasks();
    }));

    it('si GET /progreso falla al remontarse, el componente arranca en estado inicial sin error', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(
            throwError(() => ({ status: 500 }))
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        // No debe lanzar excepción.
        expect(() => fixture.detectChanges()).not.toThrow();

        expect(component.evaluando()).toBeFalse();
        expect(component.progresoEvaluacion()).toBeNull();

        discardPeriodicTasks();
    }));

    // --- Manejo de 409 en ejecutarEvaluacion() ---

    it('un 409 en ejecutarEvaluacion() rehidrata el estado en vez de mostrar error', fakeAsync(() => {
        // Primera llamada a obtenerProgreso: arranca sin evaluación.
        // Segunda llamada (tras el 409): reporta evaluación activa.
        let llamadaProgreso = 0;
        evalSpy.obtenerProgreso.and.callFake(() => {
            llamadaProgreso++;
            if (llamadaProgreso === 1) {
                // ngOnInit → rehidratarEvaluacion: sin evaluación activa.
                return of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } });
            }
            // Llamada desde rehidratarEvaluacion() después del 409.
            return of({ exito: true, datos: progresoActivoMock });
        });

        evalSpy.ejecutarEvaluacion.and.returnValue(
            throwError(() => ({ status: 409, error: { error: 'Ya hay una evaluación en curso' } }))
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges(); // ngOnInit → 1.ª llamada a obtenerProgreso (activo: false)

        // Ahora el usuario intenta iniciar evaluación → backend responde 409.
        component.ejecutarEvaluacion();
        tick(500); // Deja pasar el setTimeout del polling interno que luego se limpia.

        // La rehidratación debe haber corrido: evaluando = true.
        expect(component.evaluando()).toBeTrue();
        expect(component.progresoEvaluacion()).not.toBeNull();
        expect(component.progresoEvaluacion()!.porcentaje).toBe(30);

        discardPeriodicTasks();
    }));

    it('un 409 en ejecutarEvaluacion() NO muestra toast de error', fakeAsync(() => {
        let llamadaProgreso = 0;
        evalSpy.obtenerProgreso.and.callFake(() => {
            llamadaProgreso++;
            if (llamadaProgreso === 1) {
                return of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } });
            }
            return of({ exito: true, datos: progresoActivoMock });
        });
        evalSpy.ejecutarEvaluacion.and.returnValue(
            throwError(() => ({ status: 409, error: { error: 'Ya hay una evaluación en curso' } }))
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const mensajesSpy = spyOn((component as any).mensajes, 'add');
        component.ejecutarEvaluacion();
        tick(500);

        // El toast de error NO debe haberse mostrado por el 409.
        const llamadasError = mensajesSpy.calls.all().filter(c => (c.args[0] as { severity?: string })?.severity === 'error');
        expect(llamadasError.length).toBe(0);

        discardPeriodicTasks();
    }));

    it('un error no-409 en ejecutarEvaluacion() sí muestra toast de error', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } })
        );
        evalSpy.ejecutarEvaluacion.and.returnValue(
            throwError(() => ({ status: 500, error: { error: 'Error interno del servidor' } }))
        );

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();

        const mensajesSpy = spyOn((component as any).mensajes, 'add');
        component.ejecutarEvaluacion();
        tick(500);

        const llamadasError = mensajesSpy.calls.all().filter(c => (c.args[0] as { severity?: string })?.severity === 'error');
        expect(llamadasError.length).toBe(1);
        expect(component.evaluando()).toBeFalse();

        discardPeriodicTasks();
    }));
});

// ============================================================
// Suite de tests: ejecutarCicloCompleto() — 202 y 409
// ============================================================

describe('PanelControl — Ciclo completo: 202 Accepted y 409 Conflict', () => {

    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;
    let autoSpy: jasmine.SpyObj<AutomatizacionService>;

    beforeEach(async () => {
        autoSpy = jasmine.createSpyObj('AutomatizacionService', [
            'obtenerEstado', 'obtenerProgreso', 'iniciarCron', 'detenerCron', 'ejecutarCiclo'
        ]);
        autoSpy.obtenerHistorial = jasmine.createSpy().and.returnValue(of({ exito: true, datos: [] }));

        autoSpy.obtenerEstado.and.returnValue(
            of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } })
        );
        // Sin ciclo activo por defecto en el ngOnInit.
        autoSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } })
        );

        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService, useValue: { obtenerPrevisualizacion: () => of({ exito: true, datos: { plataformas: [] } }) } },
                { provide: EvaluacionService, useValue: {
                    ejecutarEvaluacion: () => of({ exito: true }),
                    cancelarEvaluacion: () => of({ exito: true }),
                    obtenerProgreso: () => of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } }),
                }},
                { provide: AutomatizacionService, useValue: autoSpy },
                MessageService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    // --- 202 Accepted: inicio exitoso, NO cierre del overlay ---

    it('al recibir 202, ejecutandoCiclo sigue en true (no se pone en false)', fakeAsync(() => {
        // Simulo que el backend responde 202 (Observable next sin datos especiales).
        autoSpy.ejecutarCiclo.and.returnValue(of({ exito: true, datos: {} }));

        component.ejecutarCicloCompleto();
        tick(600); // Espero el setTimeout de 500ms del polling

        // El ciclo sigue activo: no se cerró al recibir el 202.
        expect(component.ejecutandoCiclo()).toBeTrue();
    }));

    it('al recibir 202, mostrarOverlayCiclo sigue en true', fakeAsync(() => {
        autoSpy.ejecutarCiclo.and.returnValue(of({ exito: true, datos: {} }));

        component.ejecutarCicloCompleto();
        tick(600);

        expect(component.mostrarOverlayCiclo()).toBeTrue();
    }));

    it('al recibir 202, NO se emite accionCompletada', fakeAsync(() => {
        autoSpy.ejecutarCiclo.and.returnValue(of({ exito: true, datos: {} }));

        const emitSpy = spyOn(component.accionCompletada, 'emit');

        component.ejecutarCicloCompleto();
        tick(600);

        // No se debe emitir accionCompletada hasta que el polling detecte el fin.
        expect(emitSpy).not.toHaveBeenCalled();
    }));

    it('al recibir 202, el polling se inicia para seguir el progreso', fakeAsync(() => {
        autoSpy.ejecutarCiclo.and.returnValue(of({ exito: true, datos: {} }));
        // El polling consulta obtenerProgreso periódicamente.
        // Reseteo los calls del ngOnInit para contar solo los del polling post-202.
        autoSpy.obtenerProgreso.calls.reset();
        // Devuelvo activo:false para que el polling no cierre el ciclo prematuramente.
        autoSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: true, porcentaje: 10, pasos: [] } })
        );

        component.ejecutarCicloCompleto();
        tick(501);  // Dispara setTimeout(() => iniciarPolling(), 500)
        tick(2000); // Primer tick del intervalo de polling

        // El polling debe haber consultado al menos una vez.
        expect(autoSpy.obtenerProgreso).toHaveBeenCalled();

        discardPeriodicTasks();
    }));

    // --- Polling detecta fin del ciclo y cierra overlay ---

    it('el polling cierra overlay y emite accionCompletada cuando activo=false y porcentaje=100', fakeAsync(() => {
        autoSpy.ejecutarCiclo.and.returnValue(of({ exito: true, datos: {} }));

        // Configuro el progreso para que primero responda activo y luego terminado.
        // El primer call es del setTimeout de 500ms (iniciarPolling no llama obtenerProgreso,
        // solo arranca el setInterval). Los siguientes calls son del interval de 2000ms.
        let llamada = 0;
        autoSpy.obtenerProgreso.and.callFake(() => {
            llamada++;
            if (llamada <= 1) {
                // Primer tick del polling: ciclo activo al 50%.
                return of({ exito: true, datos: { activo: true, porcentaje: 50, pasos: [] } });
            }
            // Segundo tick: ciclo completado.
            return of({ exito: true, datos: { activo: false, porcentaje: 100, pasos: [] } });
        });
        autoSpy.obtenerProgreso.calls.reset();

        const emitSpy = spyOn(component.accionCompletada, 'emit');

        component.ejecutarCicloCompleto();
        tick(501);   // Dispara setTimeout(() => iniciarPolling(), 500)
        tick(2000);  // Primer tick del polling: activo=true, porcentaje=50
        tick(2000);  // Segundo tick: activo=false, porcentaje=100 → detiene polling, programa cierre en 1200ms
        tick(1200);  // Se ejecuta el setTimeout de cierre del overlay

        // El overlay y el ciclo deben estar cerrados.
        expect(component.mostrarOverlayCiclo()).toBeFalse();
        expect(component.ejecutandoCiclo()).toBeFalse();
        expect(emitSpy).toHaveBeenCalledTimes(1);

        discardPeriodicTasks();
    }));

    // --- 409 Conflict: rehidratación en vez de error ---

    it('al recibir 409, se rehidrata el ciclo activo sin mostrar error', fakeAsync(() => {
        // Simulo 409 del backend.
        autoSpy.ejecutarCiclo.and.returnValue(
            throwError(() => ({ status: 409, error: { error: 'Ya hay un ciclo en ejecución' } }))
        );
        // La rehidratación consulta obtenerProgreso y recibe ciclo activo.
        let llamadaProgreso = 0;
        autoSpy.obtenerProgreso.and.callFake(() => {
            llamadaProgreso++;
            if (llamadaProgreso <= 1) {
                // ngOnInit: sin ciclo.
                return of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } });
            }
            // Rehidratación tras 409: ciclo activo.
            return of({ exito: true, datos: { activo: true, porcentaje: 40, pasos: [] } });
        });
        autoSpy.obtenerProgreso.calls.reset();

        const mensajesSpy = spyOn((component as any).mensajes, 'add');

        component.ejecutarCicloCompleto();
        tick(600);

        // Se rehidrata: overlay sigue visible, ciclo sigue activo.
        expect(component.ejecutandoCiclo()).toBeTrue();
        expect(component.mostrarOverlayCiclo()).toBeTrue();

        // Se muestra un toast info, no error.
        const llamadasError = mensajesSpy.calls.all().filter(c => (c.args[0] as { severity?: string })?.severity === 'error');
        expect(llamadasError.length).toBe(0);

        // Se muestra toast info sobre ciclo ya en ejecución.
        const llamadasInfo = mensajesSpy.calls.all().filter(c => (c.args[0] as { severity?: string })?.severity === 'info');
        expect(llamadasInfo.length).toBeGreaterThan(0);

        discardPeriodicTasks();
    }));

    it('al recibir 409, se reanuda el polling del ciclo', fakeAsync(() => {
        autoSpy.ejecutarCiclo.and.returnValue(
            throwError(() => ({ status: 409, error: { error: 'Ya hay un ciclo en ejecución' } }))
        );
        let llamadaProgreso = 0;
        autoSpy.obtenerProgreso.and.callFake(() => {
            llamadaProgreso++;
            if (llamadaProgreso <= 1) {
                return of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } });
            }
            return of({ exito: true, datos: { activo: true, porcentaje: 40, pasos: [] } });
        });
        autoSpy.obtenerProgreso.calls.reset();

        component.ejecutarCicloCompleto();
        tick(600); // setTimeout + rehidratación

        // El polling debe estar activo.
        expect((component as any).intervalIdPolling).not.toBeNull();

        discardPeriodicTasks();
    }));

    // --- Errores que NO son 409 siguen siendo fatales ---

    it('al recibir error 500, se cierra overlay y se muestra error', fakeAsync(() => {
        autoSpy.ejecutarCiclo.and.returnValue(
            throwError(() => ({ status: 500, error: { error: 'Error interno' } }))
        );
        autoSpy.obtenerProgreso.calls.reset();

        const mensajesSpy = spyOn((component as any).mensajes, 'add');

        component.ejecutarCicloCompleto();
        tick(600);

        expect(component.ejecutandoCiclo()).toBeFalse();
        expect(component.mostrarOverlayCiclo()).toBeFalse();

        const llamadasError = mensajesSpy.calls.all().filter(c => (c.args[0] as { severity?: string })?.severity === 'error');
        expect(llamadasError.length).toBe(1);

        discardPeriodicTasks();
    }));
});

describe('PanelControl — Visualización de consultas efectivas y equivalencias (Issue #14)', () => {
    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;

    beforeEach(async () => {
        const mockScrapingService = {
            obtenerPrevisualizacion: () => of({
                exito: true,
                datos: {
                    plataformas: [
                        {
                            plataforma: 'indeed',
                            nombre: 'Indeed',
                            habilitada: true,
                            ejecutable: true,
                            terminos: ['soporte IT'],
                            ubicacion: ['Argentina'],
                            ventanaDias: 14,
                            maxResultados: 50,
                            filtros: { country: 'ar' },
                            consultasEfectivas: ['"soporte IT"'],
                            equivalenciasAplicadas: { 'c#': 'c-sharp' },
                            equivalenciasSugeridas: { 'soporte it': ['help desk', 'mesa de ayuda'] },
                            advertencias: [],
                            origen: { terminos: 'preferencias' as const, ubicacion: 'preferencias' as const },
                        },
                    ],
                },
            }),
        };

        const mockEval = {
            obtenerProgreso: () => of({ exito: true, datos: { activo: false } }),
            reintentarErrores: () => of({ exito: true, en_curso: true, total: 1, mensaje: 'Reintentando...' }),
        };
        const mockAuto = {
            obtenerHistorial: () => of({ exito: true, datos: [] }),
            obtenerEstado: () => of({ exito: true, datos: { activo: false } }),
            obtenerProgreso: () => of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } as ProgresoAutomatizacion }),
        };

        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService, useValue: mockScrapingService },
                { provide: EvaluacionService, useValue: mockEval },
                { provide: AutomatizacionService, useValue: mockAuto },
                MessageService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('renderiza consultas efectivas, equivalencias aplicadas y sugerencias en el resumen', () => {
        component.actualizarPrevisualizacion();
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent;
        expect(texto).toContain('Consultas efectivas: "soporte IT"');
        expect(texto).toContain('Equivalencias aplicadas:');
        expect(texto).toContain('Sugerencias disponibles (no enviadas):');
        expect(component.formatearConsultas(['"soporte IT"'])).toBe('"soporte IT"');
        expect(component.hayEquivalencias({ 'c#': 'c-sharp' })).toBeTrue();
        expect(component.hayEquivalencias({})).toBeFalse();
    });
});

describe('PanelControl — Reintento de errores técnicos e interrupción por reinicio', () => {
    let component: PanelControl;
    let fixture: ComponentFixture<PanelControl>;
    let evalSpy: jasmine.SpyObj<EvaluacionService>;
    let autoSpy: jasmine.SpyObj<AutomatizacionService>;

    beforeEach(async () => {
        evalSpy = jasmine.createSpyObj('EvaluacionService', [
            'ejecutarEvaluacion', 'cancelarEvaluacion', 'obtenerProgreso', 'reintentarErrores'
        ]);
        autoSpy = jasmine.createSpyObj('AutomatizacionService', [
            'obtenerEstado', 'obtenerProgreso', 'iniciarCron', 'detenerCron', 'ejecutarCiclo'
        ]);
        autoSpy.obtenerHistorial = jasmine.createSpy().and.returnValue(of({ exito: true, datos: [] }));

        evalSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } })
        );
        evalSpy.reintentarErrores.and.returnValue(
            of({ exito: true, en_curso: true, total: 3, mensaje: 'Reintento iniciado para 3 ofertas' })
        );
        autoSpy.obtenerEstado.and.returnValue(
            of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } })
        );
        autoSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } })
        );

        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService, useValue: { obtenerPrevisualizacion: () => of({ exito: true, datos: { plataformas: [] } }) } },
                { provide: EvaluacionService, useValue: evalSpy },
                { provide: AutomatizacionService, useValue: autoSpy },
                MessageService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PanelControl);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('reintentarErrores() inicia evaluación y polling cuando hay ofertas fallidas', fakeAsync(() => {
        evalSpy.reintentarErrores.and.returnValue(
            of({ exito: true, en_curso: true, total: 3, mensaje: 'Reintento iniciado para 3 ofertas' })
        );
        const mensajesSpy = spyOn((component as any).mensajes, 'add');

        component.reintentarErrores();
        tick();

        expect(component.evaluando()).toBeTrue();
        expect(component.reintentandoErrores()).toBeFalse();
        expect(mensajesSpy).toHaveBeenCalledWith(jasmine.objectContaining({
            severity: 'info',
            summary: 'Reintentando errores',
            detail: 'Reintentando evaluación de ofertas con fallos técnicos...',
        }));
        expect((component as any).intervalIdPollingEval).not.toBeNull();

        (component as any).detenerPollingEvaluacion();
    }));

    it('reintentarErrores() muestra toast informativo y no inicia polling cuando total === 0', fakeAsync(() => {
        evalSpy.reintentarErrores.and.returnValue(
            of({ exito: true, en_curso: false, total: 0, mensaje: 'No hay ofertas recientes con errores técnicos para reintentar.' })
        );
        const mensajesSpy = spyOn((component as any).mensajes, 'add');

        component.reintentarErrores();
        tick();

        expect(component.evaluando()).toBeFalse();
        expect(component.reintentandoErrores()).toBeFalse();
        expect(mensajesSpy).toHaveBeenCalledWith(jasmine.objectContaining({
            severity: 'info',
            summary: 'Sin errores técnicos',
            detail: 'No hay ofertas recientes con errores técnicos para reintentar.',
        }));
        expect((component as any).intervalIdPollingEval).toBeNull();
    }));

    it('interrupción de lote por reinicio muestra alerta sin quedar bloqueado como en curso', fakeAsync(() => {
        evalSpy.obtenerProgreso.and.returnValue(of({
            exito: true,
            datos: {
                activo: false,
                estado: 'error' as const,
                mensaje_error: 'La evaluación previa fue interrumpida por reinicio del servidor.',
                total: 10,
                evaluadas: 4,
                aprobadas: 2,
                rechazadas: 1,
                errores: 1,
                porcentaje: 40,
            }
        }));
        const mensajesSpy = spyOn((component as any).mensajes, 'add');

        (component as any).rehidratarEvaluacion();
        tick();
        fixture.detectChanges();

        expect(component.evaluando()).toBeFalse();
        expect(component.busquedaOcupada()).toBeFalse();
        expect(component.errorEvaluacion()).toContain('interrumpida por reinicio del servidor');
        expect(mensajesSpy).toHaveBeenCalledWith(jasmine.objectContaining({
            summary: 'Evaluación interrumpida',
            detail: 'La evaluación previa fue interrumpida por reinicio del servidor.',
        }));
        const alerta = fixture.nativeElement.querySelector('[role="alert"]');
        expect(alerta?.textContent).toContain('interrumpida por reinicio del servidor');
    }));

    it('botón "Reintentar errores" se habilita y deshabilita según el estado del panel', () => {
        const botonReintentar = fixture.nativeElement.querySelector('.btn-reintentar') as HTMLButtonElement;
        expect(botonReintentar).toBeTruthy();
        expect(botonReintentar.disabled).toBeFalse();

        // Cuando está evaluando, debe deshabilitarse
        component.evaluando.set(true);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeTrue();

        component.evaluando.set(false);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeFalse();

        // Cuando reintentandoErrores está en true, debe deshabilitarse
        component.reintentandoErrores.set(true);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeTrue();

        component.reintentandoErrores.set(false);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeFalse();

        // Cuando hay scraping en curso (busquedaOcupada)
        component.scrapeandoLinkedin.set(true);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeTrue();

        component.scrapeandoLinkedin.set(false);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeFalse();

        // En modo demo
        fixture.componentRef.setInput('modoDemo', true);
        fixture.detectChanges();
        expect(botonReintentar.disabled).toBeTrue();
    });
});
