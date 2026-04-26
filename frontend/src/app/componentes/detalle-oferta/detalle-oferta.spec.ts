import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetalleOferta } from './detalle-oferta';
import { OfertasService } from '../../servicios/ofertas.service';
import { of } from 'rxjs';

describe('DetalleOferta — Accesibilidad de foco en modal', () => {

    const mockOferta = {
        id: 1,
        titulo: 'Frontend Developer',
        empresa: 'Empresa Test',
        ubicacion: 'Buenos Aires',
        modalidad: 'remoto',
        descripcion: 'Descripción de prueba',
        url: 'https://ejemplo.com',
        plataforma: 'linkedin',
        nivel_requerido: 'junior',
        salario_min: null,
        salario_max: null,
        moneda: null,
        estado_evaluacion: 'aprobada',
        razon_evaluacion: 'Coincide con el perfil',
        porcentaje_match: 85,
        estado_postulacion: 'no_postulado',
        fecha_publicacion: '2026-04-01T00:00:00.000Z',
        fecha_extraccion: '2026-04-01T12:00:00.000Z',
        datos_crudos: null,
    };

    async function crearComponente(): Promise<{ fixture: ComponentFixture<DetalleOferta>; component: DetalleOferta }> {
        const mockOfertasService = {
            actualizarPostulacion: () => of({ exito: true, datos: { estado_postulacion: 'cv_enviado' } })
        };

        await TestBed.configureTestingModule({
            imports: [DetalleOferta],
            providers: [
                { provide: OfertasService, useValue: mockOfertasService },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(DetalleOferta);
        const component = fixture.componentInstance;
        return { fixture, component };
    }

    it('debería crear el componente', async () => {
        const { component } = await crearComponente();
        expect(component).toBeTruthy();
    });

    it('debería tener signal visible inicializado en false', async () => {
        const { component } = await crearComponente();
        expect(component.visible()).toBe(false);
    });

    it('debería abrir el modal seteando visible en true', async () => {
        const { component } = await crearComponente();
        component.visible.set(true);
        expect(component.visible()).toBe(true);
    });

    it('debería cerrar el modal seteando visible en false', async () => {
        const { component } = await crearComponente();
        component.visible.set(true);
        component.visible.set(false);
        expect(component.visible()).toBe(false);
    });

    it('severidadEstado devuelve el valor correcto para estados conocidos', async () => {
        const { component } = await crearComponente();
        expect(component.severidadEstado('aprobada')).toBe('success');
        expect(component.severidadEstado('rechazada')).toBe('danger');
        expect(component.severidadEstado('pendiente')).toBe('warn');
        expect(component.severidadEstado('otro')).toBe('info');
    });

    it('severidadPorcentaje devuelve el nivel correcto', async () => {
        const { component } = await crearComponente();
        expect(component.severidadPorcentaje(80)).toBe('success');
        expect(component.severidadPorcentaje(55)).toBe('warn');
        expect(component.severidadPorcentaje(30)).toBe('danger');
    });

    // Verificar que abrirEnPagina llama a window.open cuando hay url
    it('abrirEnPagina llama a window.open con la URL de la oferta', async () => {
        const { fixture, component } = await crearComponente();
        spyOn(window, 'open');
        // Usar setInput para pasar la oferta al input signal
        fixture.componentRef.setInput('oferta', mockOferta as any);
        component.abrirEnPagina();
        expect(window.open).toHaveBeenCalledWith('https://ejemplo.com', '_blank', 'noopener,noreferrer');
    });

    it('abrirEnPagina no hace nada si no hay url en la oferta', async () => {
        const { fixture, component } = await crearComponente();
        spyOn(window, 'open');
        fixture.componentRef.setInput('oferta', { ...mockOferta, url: null } as any);
        component.abrirEnPagina();
        expect(window.open).not.toHaveBeenCalled();
    });
});