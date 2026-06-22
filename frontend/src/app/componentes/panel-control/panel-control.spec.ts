import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { PanelControl } from './panel-control';
import { ScrapingService } from '../../servicios/scraping.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { AutomatizacionService } from '../../servicios/automatizacion.service';
import { MessageService } from 'primeng/api';
import { of, throwError, Observable } from 'rxjs';

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
        scrapearAdzuna:       () => of({ exito: true, datos: { total_extraidas: 0, ofertas_nuevas: 0, ofertas_duplicadas: 0 } }),
    };

    const mockEvaluacionService = {
        ejecutarEvaluacion: () => of({ exito: true }),
        cancelarEvaluacion: () => of({ exito: true }),
        obtenerProgreso:    () => of({ exito: true, datos: { activo: false, evaluadas: 0, total: 0, aprobadas: 0, rechazadas: 0, errores: 0, porcentaje: 0 } }),
    };

    // Versión mutable del mock para poder cambiar respuestas dentro de los tests.
    let mockEvaluacionServiceMutable: jasmine.SpyObj<EvaluacionService>;

    const mockAutomatizacionService = {
        obtenerEstado:  () => of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } }),
        iniciarCron:    () => of({ exito: true, datos: { activo: true,  expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } }),
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

    it('opcionesPlataforma debería contener las 10 plataformas activas', () => {
        expect(component.opcionesPlataforma.length).toBe(10);
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

    it('opcionesPlataforma no debería incluir Google Jobs', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'googlejobs');
        expect(opcion).toBeUndefined();
        expect(component.etiquetasPorPlataforma['googlejobs']).toBeUndefined();
    });

    it('opcionesPlataforma no debería incluir InfoJobs (desactivado temporalmente)', () => {
        const opcion = component.opcionesPlataforma.find(o => o.value === 'infojobs');
        expect(opcion).toBeUndefined();
    });

    it('etiquetasPorPlataforma no debería tener etiqueta para infojobs (desactivado temporalmente)', () => {
        expect(component.etiquetasPorPlataforma['infojobs']).toBeUndefined();
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
            'ejecutarEvaluacion', 'cancelarEvaluacion', 'obtenerProgreso'
        ]);
        autoSpy = jasmine.createSpyObj('AutomatizacionService', [
            'obtenerEstado', 'obtenerProgreso', 'iniciarCron', 'detenerCron', 'ejecutarCiclo'
        ]);

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
                { provide: ScrapingService, useValue: {} },
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
            'ejecutarEvaluacion', 'cancelarEvaluacion', 'obtenerProgreso'
        ]);
        autoSpy = jasmine.createSpyObj('AutomatizacionService', [
            'obtenerEstado', 'obtenerProgreso', 'iniciarCron', 'detenerCron', 'ejecutarCiclo'
        ]);

        autoSpy.obtenerEstado.and.returnValue(
            of({ exito: true, datos: { activo: false, expresionCron: null, ultimaEjecucion: null, ultimoResultado: null } })
        );
        autoSpy.obtenerProgreso.and.returnValue(
            of({ exito: true, datos: { activo: false, porcentaje: 0, pasos: [] } })
        );

        await TestBed.configureTestingModule({
            imports: [PanelControl],
            providers: [
                { provide: ScrapingService, useValue: {} },
                { provide: EvaluacionService, useValue: evalSpy },
                { provide: AutomatizacionService, useValue: autoSpy },
                MessageService,
            ],
        }).compileComponents();
    });

    afterEach(() => {
        fixture.destroy();
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
                { provide: ScrapingService, useValue: {} },
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
