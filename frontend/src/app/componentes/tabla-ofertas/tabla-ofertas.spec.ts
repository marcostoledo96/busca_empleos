import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TablaOfertas } from './tabla-ofertas';
import { OfertasService } from '../../servicios/ofertas.service';
import { of } from 'rxjs';

describe('TablaOfertas — Activación por teclado en cards mobile', () => {

    const mockOfertas = [
        {
            id: 1,
            titulo: 'Frontend Developer',
            empresa: 'Empresa A',
            ubicacion: 'Buenos Aires',
            modalidad: 'remoto',
            descripcion: 'Desc',
            url: 'https://a.com',
            plataforma: 'linkedin',
            nivel_requerido: 'junior',
            salario_min: null,
            salario_max: null,
            moneda: null,
            estado_evaluacion: 'aprobada',
            razon_evaluacion: 'Match',
            porcentaje_match: 90,
            estado_postulacion: 'no_postulado',
            fecha_publicacion: '2026-04-01T00:00:00.000Z',
            fecha_extraccion: '2026-04-01T12:00:00.000Z',
            datos_crudos: null,
        },
        {
            id: 2,
            titulo: 'Backend Developer',
            empresa: 'Empresa B',
            ubicacion: 'Remoto',
            modalidad: 'remoto',
            descripcion: 'Desc B',
            url: 'https://b.com',
            plataforma: 'computrabajo',
            nivel_requerido: 'semi-senior',
            salario_min: 50000,
            salario_max: 80000,
            moneda: '$',
            estado_evaluacion: 'pendiente',
            razon_evaluacion: null,
            porcentaje_match: null,
            estado_postulacion: 'cv_enviado',
            fecha_publicacion: null,
            fecha_extraccion: '2026-04-02T12:00:00.000Z',
            datos_crudos: null,
        },
    ];

    let component: TablaOfertas;

    beforeEach(async () => {
        const mockOfertasService = {
            actualizarPostulacion: () => of({ exito: true, datos: { estado_postulacion: 'cv_enviado' } })
        };

        await TestBed.configureTestingModule({
            imports: [TablaOfertas],
            providers: [
                { provide: OfertasService, useValue: mockOfertasService },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(TablaOfertas);
        component = fixture.componentInstance;
    });

    it('debería crear el componente', () => {
        expect(component).toBeTruthy();
    });

    // --- Task 3.1: Card es activable por teclado ---

    it('activarCardConTeclado con Enter emite ofertaSeleccionada', () => {
        const emitido = jasmine.createSpy('ofertaSeleccionada');
        component.ofertaSeleccionada.subscribe(emitido);

        const oferta = mockOfertas[0] as any;
        const evento = new KeyboardEvent('keydown', { key: 'Enter' });
        spyOn(evento, 'preventDefault');

        component.activarCardConTeclado(evento, oferta);

        expect(evento.preventDefault).toHaveBeenCalled();
        expect(emitido).toHaveBeenCalledWith(oferta);
    });

    it('activarCardConTeclado con Espacio emite ofertaSeleccionada', () => {
        const emitido = jasmine.createSpy('ofertaSeleccionada');
        component.ofertaSeleccionada.subscribe(emitido);

        const oferta = mockOfertas[1] as any;
        const evento = new KeyboardEvent('keydown', { key: ' ' });
        spyOn(evento, 'preventDefault');

        component.activarCardConTeclado(evento, oferta);

        expect(evento.preventDefault).toHaveBeenCalled();
        expect(emitido).toHaveBeenCalledWith(oferta);
    });

    it('activarCardConTeclado con otras teclas NO emite ofertaSeleccionada', () => {
        const emitido = jasmine.createSpy('ofertaSeleccionada');
        component.ofertaSeleccionada.subscribe(emitido);

        const oferta = mockOfertas[0] as any;
        const evento = new KeyboardEvent('keydown', { key: 'Tab' });

        component.activarCardConTeclado(evento, oferta);

        expect(emitido).not.toHaveBeenCalled();
    });

    it('verDetalle emite la oferta recibida', () => {
        const emitido = jasmine.createSpy('ofertaSeleccionada');
        component.ofertaSeleccionada.subscribe(emitido);

        const oferta = mockOfertas[0] as any;
        component.verDetalle(oferta);

        expect(emitido).toHaveBeenCalledWith(oferta);
    });

    // --- nivelMatch ---

    it('nivelMatch retorna niveles correctos', () => {
        expect(component.nivelMatch(80)).toBe('alto');
        expect(component.nivelMatch(55)).toBe('medio');
        expect(component.nivelMatch(20)).toBe('bajo');
    });
});