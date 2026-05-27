import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Dashboard } from './dashboard';
import { OfertasService } from '../../servicios/ofertas.service';
import { DemoService } from '../../servicios/demo.service';
import { PersistenciaDashboardService } from '../../servicios/persistencia-dashboard.service';
import { RespuestaApi } from '../../modelos/respuesta-api.model';
import { of } from 'rxjs';

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
});

// Mock del servicio de persistencia del dashboard.
const crearMockPersistenciaDashboardService = () => ({
    guardarCache: jasmine.createSpy('guardarCache'),
    leerCache: jasmine.createSpy('leerCache').and.returnValue(null),
});

// Mock del servicio demo.
const crearMockDemoService = () => ({
    esModoDemo: jasmine.createSpy('esModoDemo').and.returnValue(false),
    obtenerOfertasDemo: jasmine.createSpy('obtenerOfertasDemo').and.returnValue([]),
});

describe('Dashboard', () => {
    let componente: Dashboard;
    let fixture: ComponentFixture<Dashboard>;
    let mockOfertasService: ReturnType<typeof crearMockOfertasService>;
    let mockPersistenciaService: ReturnType<typeof crearMockPersistenciaDashboardService>;
    let mockDemoService: ReturnType<typeof crearMockDemoService>;

    beforeEach(async () => {
        mockOfertasService = crearMockOfertasService();
        mockPersistenciaService = crearMockPersistenciaDashboardService();
        mockDemoService = crearMockDemoService();

        await TestBed.configureTestingModule({
            imports: [Dashboard],
            providers: [
                { provide: OfertasService, useValue: mockOfertasService },
                { provide: PersistenciaDashboardService, useValue: mockPersistenciaService },
                { provide: DemoService, useValue: mockDemoService },
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

    it('cargarDatos() llama a ofertasService.obtenerOfertas()', () => {
        componente.cargarDatos();
        expect(mockOfertasService.obtenerOfertas).toHaveBeenCalled();
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
