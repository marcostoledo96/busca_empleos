import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Dashboard } from './dashboard';
import { OfertasService } from '../../servicios/ofertas.service';
import { DemoService } from '../../servicios/demo.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { RespuestaApi } from '../../modelos/respuesta-api.model';
import { Oferta } from '../../modelos/oferta.model';
import { Observable, of, throwError } from 'rxjs';

const crearOferta = (id: number, porcentaje: number, bonus: number): Oferta => ({
    id,
    titulo: `Oferta ${id}`,
    empresa: null,
    ubicacion: null,
    modalidad: null,
    descripcion: null,
    url: `https://example.com/${id}`,
    plataforma: 'linkedin',
    nivel_requerido: null,
    salario_min: null,
    salario_max: null,
    moneda: null,
    estado_evaluacion: 'aprobada',
    razon_evaluacion: null,
    porcentaje_match: porcentaje,
    estado_postulacion: 'no_postulado',
    fecha_publicacion: null,
    fecha_extraccion: '2026-07-15T00:00:00.000Z',
    datos_crudos: null,
    puntaje_prioridad_ia: bonus,
});

// Mock del servicio de ofertas.
const crearMockOfertasService = () => ({
    obtenerOfertas: jasmine.createSpy('obtenerOfertas').and.returnValue(of({
        exito: true,
        datos: [],
        total: 0,
    } as RespuestaApi<[]>)),
    actualizarPostulacionMasiva: jasmine.createSpy('actualizarPostulacionMasiva').and.returnValue(of({
        exito: true,
        datos: { actualizadas: 0 },
    } as RespuestaApi<{ actualizadas: number }>)),
    obtenerBloqueSincronizacion: jasmine.createSpy('obtenerBloqueSincronizacion').and.returnValue(of({
        exito: true,
        datos: [],
        total: 0,
        fecha_corte: '2026-06-15T00:00:00.000Z',
        max_id: 0,
        total_inicial: 0,
        cursor_siguiente: null,
        completada: true,
    })),
});

// Mock del servicio de persistencia del dashboard.
const crearMockPersistenciaDashboardService = () => ({
    guardarCache: jasmine.createSpy('guardarCache'),
    leerCache: jasmine.createSpy('leerCache').and.returnValue(null),
    limpiarSincronizacion: jasmine.createSpy('limpiarSincronizacion').and.resolveTo(),
    guardarBloqueSincronizacion: jasmine.createSpy('guardarBloqueSincronizacion').and.resolveTo({ fallback: false, total: 0 }),
    obtenerOfertasSincronizadas: jasmine.createSpy('obtenerOfertasSincronizadas').and.returnValue([]),
});

// Mock del servicio demo.
const crearMockDemoService = () => ({
    esModoDemo: jasmine.createSpy('esModoDemo').and.returnValue(false),
    obtenerOfertasDemo: jasmine.createSpy('obtenerOfertasDemo').and.returnValue([]),
});

const crearMockPreferenciasService = () => ({
    obtenerPreferencias: jasmine.createSpy('obtenerPreferencias').and.returnValue(of({
        exito: true,
        datos: { priorizar_ofertas_ia: false },
    })),
});

describe('Dashboard', () => {
    let componente: Dashboard;
    let fixture: ComponentFixture<Dashboard>;
    let mockOfertasService: ReturnType<typeof crearMockOfertasService>;
    let mockPersistenciaService: ReturnType<typeof crearMockPersistenciaDashboardService>;
    let mockDemoService: ReturnType<typeof crearMockDemoService>;
    let mockPreferenciasService: ReturnType<typeof crearMockPreferenciasService>;

    beforeEach(async () => {
        mockOfertasService = crearMockOfertasService();
        mockPersistenciaService = crearMockPersistenciaDashboardService();
        mockDemoService = crearMockDemoService();
        mockPreferenciasService = crearMockPreferenciasService();

        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [
                { provide: OfertasService, useValue: mockOfertasService },
                { provide: PersistenciaDashboardService, useValue: mockPersistenciaService },
                { provide: DemoService, useValue: mockDemoService },
                { provide: PreferenciasService, useValue: mockPreferenciasService },
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Dashboard);
        componente = fixture.componentInstance;
    });

    it('should create', () => {
        expect(componente).toBeTruthy();
    });

    it('cargarDatos() inicia la sincronización por cursor', async () => {
        await (componente as any).sincronizarOfertas();
        expect(mockOfertasService.obtenerBloqueSincronizacion).toHaveBeenCalledWith(500, null);
    });

    it('espera el reset persistente antes del primer bloque de un snapshot nuevo', async () => {
        let resolverReset!: () => void;
        mockPersistenciaService.limpiarSincronizacion.and.returnValue(new Promise<void>(resolve => {
            resolverReset = resolve;
        }));

        const sincronizacion = (componente as any).sincronizarOfertas();
        expect(mockOfertasService.obtenerBloqueSincronizacion).not.toHaveBeenCalled();

        resolverReset();
        await sincronizacion;
        expect(mockOfertasService.obtenerBloqueSincronizacion).toHaveBeenCalledWith(500, null);
    });

    it('informa fallback en memoria y conserva el progreso del bloque confirmado', async () => {
        const oferta = crearOferta(11, 80, 2);
        mockOfertasService.obtenerBloqueSincronizacion.and.returnValue(of({
            exito: true,
            datos: [oferta],
            total: 1,
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 11,
            total_inicial: 1,
            cursor_siguiente: null,
            completada: true,
        }));
        mockPersistenciaService.guardarBloqueSincronizacion.and.resolveTo({ fallback: true, total: 1 });
        mockPersistenciaService.obtenerOfertasSincronizadas.and.resolveTo([oferta]);

        await (componente as any).sincronizarOfertas();

        expect(componente.progresoSincronizacion()).toBe(100);
        expect(componente.fallbackSincronizacion()).toBeTrue();
        expect(componente.mensajeEstado()).toContain('memoria temporal');
        expect(componente.ofertas().map(ofertaActual => ofertaActual.id)).toEqual([11]);
    });

    it('cancela, conserva el snapshot accesible y reanuda sin duplicar IDs', async () => {
        const oferta = crearOferta(12, 80, 0);
        const ofertaNueva = crearOferta(13, 75, 0);
        mockOfertasService.obtenerBloqueSincronizacion.and.returnValue(of({
            exito: true,
            datos: [oferta],
            total: 2,
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 13,
            total_inicial: 2,
            cursor_siguiente: 'cursor-confirmado',
            completada: false,
        }));
        mockPersistenciaService.guardarBloqueSincronizacion.and.resolveTo({ fallback: false, total: 1 });
        mockPersistenciaService.obtenerOfertasSincronizadas.and.callFake(async () => {
            componente.cancelarSincronizacion();
            return [oferta];
        });

        await (componente as any).sincronizarOfertas();
        expect(componente.mensajeEstado()).toContain('cancelada');
        expect(componente.estadoOperativoSincronizacion()).toEqual({
            estado: 'cancelada',
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 13,
            total_inicial: 2,
            recibidos: 1,
            duplicados: 0,
        });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Recibidos únicos: 1');
        expect(fixture.nativeElement.textContent).not.toContain('Sincronización completada');

        mockOfertasService.obtenerBloqueSincronizacion.and.returnValue(of({
            exito: true,
            datos: [oferta, ofertaNueva],
            total: 2,
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 13,
            total_inicial: 2,
            cursor_siguiente: null,
            completada: true,
        }));
        mockPersistenciaService.obtenerOfertasSincronizadas.and.resolveTo([oferta, ofertaNueva]);
        await (componente as any).sincronizarOfertas();

        expect(mockPersistenciaService.limpiarSincronizacion).toHaveBeenCalledTimes(1);
        expect(componente.ofertas().map(ofertaActual => ofertaActual.id)).toEqual([12, 13]);
        expect(componente.estadoOperativoSincronizacion()).toEqual(jasmine.objectContaining({
            estado: 'completada',
            recibidos: 2,
            duplicados: 1,
        }));
    });

    it('aborta el bloque pendiente, conserva el cursor confirmado y no usa el listado legacy', async () => {
        let abortada = false;
        const ofertaConfirmada = crearOferta(15, 80, 0);
        (componente as any).cursorSincronizacion = 'cursor-confirmado';
        (componente as any).idsSincronizacion.add(ofertaConfirmada.id);
        componente.estadoOperativoSincronizacion.set({
            estado: 'en_progreso',
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 16,
            total_inicial: 2,
            recibidos: 1,
            duplicados: 0,
        });
        mockOfertasService.obtenerBloqueSincronizacion.and.returnValue(new Observable(() => () => {
            abortada = true;
        }));

        const sincronizacion = (componente as any).sincronizarOfertas();
        componente.cancelarSincronizacion();

        expect(abortada).toBeTrue();
        await sincronizacion;
        expect((componente as any).cursorSincronizacion).toBe('cursor-confirmado');
        expect(componente.estadoOperativoSincronizacion()).toEqual(jasmine.objectContaining({
            estado: 'cancelada',
            recibidos: 1,
        }));
        expect(mockOfertasService.obtenerOfertas).not.toHaveBeenCalled();
    });

    it('no reemplaza el estado completada por cancelada', async () => {
        mockOfertasService.obtenerBloqueSincronizacion.and.returnValue(of({
            exito: true,
            datos: [crearOferta(14, 80, 0)],
            total: 1,
            fecha_corte: '2026-06-15T00:00:00.000Z',
            max_id: 14,
            total_inicial: 1,
            cursor_siguiente: null,
            completada: true,
        }));
        mockPersistenciaService.obtenerOfertasSincronizadas.and.resolveTo([crearOferta(14, 80, 0)]);

        await (componente as any).sincronizarOfertas();
        componente.cancelarSincronizacion();

        expect(componente.estadoOperativoSincronizacion()?.estado).toBe('completada');
    });

    it('conserva el orden habitual cuando la preferencia no está disponible', () => {
        mockPreferenciasService.obtenerPreferencias.and.returnValue(throwError(() => new Error('sin preferencias')));

        fixture.detectChanges();

        expect(componente.priorizarOfertasIa()).toBeFalse();
        expect(componente.mensajeEstado()).toContain('orden habitual');
    });

    it('limita el bonus de prioridad IA según la preferencia y conserva el orden observable', () => {
        mockPreferenciasService.obtenerPreferencias.and.returnValue(of({
            exito: true,
            datos: { priorizar_ofertas_ia: true, bonus_maximo_prioridad_ia: 5 },
        }));
        fixture.detectChanges();
        componente.ofertas.set([
            crearOferta(1, 96, 0),
            crearOferta(2, 92, 10),
            crearOferta(3, 89, 100),
        ]);

        expect(componente.ofertasAprobadas().map(oferta => oferta.id)).toEqual([2, 1, 3]);
    });

    it('onPostulacionPendiente({ id: 1, pendiente: true }) agrega al set', () => {
        componente.onPostulacionPendiente({ id: 1, pendiente: true });
        expect(componente.postulacionesPendientes().has(1)).toBeTrue();
    });

    it('onPostulacionPendiente({ id: 1, pendiente: false }) elimina del set', () => {
        // Primero agrega el ID.
        componente.onPostulacionPendiente({ id: 1, pendiente: true });
        // Luego lo elimina.
        componente.onPostulacionPendiente({ id: 1, pendiente: false });
        expect(componente.postulacionesPendientes().has(1)).toBeFalse();
    });
});
