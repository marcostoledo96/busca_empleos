import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DetalleOferta } from './detalle-oferta';
import { OfertasService } from '../../servicios/ofertas.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
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
            actualizarPostulacion: () => of({ exito: true, datos: { estado_postulacion: 'cv_enviado' } }),
            actualizarDescripcion: () => of({ exito: true, datos: mockOferta })
        };
        const mockEvaluacionService = {
            ejecutarEvaluacion: () => of({ exito: true, mensaje: 'Iniciada' })
        };

        await TestBed.configureTestingModule({
            imports: [DetalleOferta],
            providers: [
                { provide: OfertasService, useValue: mockOfertasService },
                { provide: EvaluacionService, useValue: mockEvaluacionService },
                provideNoopAnimations(),
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

    it('renderiza evidencia de prioridad IA accesible sin presentarla como aprobación', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            estado_evaluacion: 'rechazada',
            prioridad_ia: true,
            evidencias_prioridad_ia: ['Claude Code'],
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const etiqueta = fixture.nativeElement.querySelector('[aria-label="Oferta con prioridad por evidencia de IA"]');
        expect(etiqueta?.textContent).toContain('PRIORIDAD_IA');
        expect(fixture.nativeElement.textContent).toContain('Claude Code');
        expect(fixture.nativeElement.textContent).toContain('RECHAZADA');
    });

    it('S3,S8: muestra el enlace original en la cabecera y enfoca el inicio sin saltar al seguimiento; restaura el foco al cerrar', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', mockOferta as any);
        fixture.detectChanges();
        await fixture.whenStable();
        const abrir = document.createElement('button');
        abrir.textContent = 'Abrir detalle';
        fixture.nativeElement.appendChild(abrir);
        abrir.focus();
        expect(document.activeElement).toBe(abrir);

        component.visible.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        const enlace = fixture.nativeElement.querySelector('.p-dialog-header a[aria-label="Abrir oferta en página original"]') as HTMLAnchorElement | null;
        expect(enlace).withContext('El aviso original está disponible en la vista inicial, no sólo en el footer').not.toBeNull();
        expect(enlace?.href).toBe('https://ejemplo.com/');
        expect(enlace?.target).toBe('_blank');
        expect(enlace?.rel).toContain('noopener');
        expect(enlace?.rel).toContain('noreferrer');
        expect(enlace?.closest('details')).toBeNull();
        const contenido = fixture.nativeElement.querySelector('.p-dialog-content') as HTMLElement;
        const cabecera = fixture.nativeElement.querySelector('.p-dialog-header') as HTMLElement;
        expect(contenido.querySelector('#detalle-titulo')?.textContent).toBe(mockOferta.titulo);
        expect(cabecera.querySelector('#detalle-titulo')).toBeNull();
        expect(contenido.querySelector('.detalle-meta')?.textContent).toContain(mockOferta.empresa);
        expect(contenido.querySelector('.detalle-tags')?.textContent).toContain('APROBADA');
        expect(contenido.querySelectorAll('.tag-match').length).toBe(1);
        const activo = document.activeElement as HTMLElement;
        expect(activo.closest('.p-dialog-header')).withContext('El foco inicial permanece arriba, no en p-select').not.toBeNull();
        expect(fixture.nativeElement.querySelector('.p-dialog-content').scrollTop).toBe(0);

        const cerrar = fixture.nativeElement.querySelector('[aria-label="Cerrar detalle de oferta"]') as HTMLButtonElement;
        cerrar.click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.visible()).toBeFalse();
        expect(document.activeElement).toBe(abrir);
    });

    it('S7: una oferta pendiente no muestra el porcentaje anterior aunque no tenga mensaje de error', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', { ...mockOferta, estado_evaluacion: 'pendiente' } as any);
        component.visible.set(true);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('PENDIENTE');
        expect(fixture.nativeElement.textContent).not.toContain('85%');
        expect(fixture.nativeElement.textContent).not.toContain('Compatibilidad estimada:');
    });

    it('en modoDemo bloquea iniciarEdicionDescripcion, guardarDescripcion y solicitarReevaluacion', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', mockOferta as any);
        fixture.componentRef.setInput('modoDemo', true);
        component.visible.set(true);
        fixture.detectChanges();

        // 1. Iniciar edición no debe abrir el formulario
        component.iniciarEdicionDescripcion();
        expect(component.modoEdicionDescripcion()).toBe(false);

        // 2. Guardar descripción no debe hacer nada
        component.guardarDescripcion();
        expect(component.guardandoDescripcion()).toBe(false);

        // 3. Solicitar reevaluación no debe disparar servicio
        component.solicitarReevaluacion();
        expect(component.reevaluandoOferta()).toBe(false);
        expect(component.mensajeReevaluacion()).toBeNull();

        // Tampoco permito guardar seguimiento, ni siquiera invocándolo directamente.
        component.guardarSeguimiento();
        expect(component.guardandoSeguimiento()).toBeFalse();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[aria-label="Guardar seguimiento"]').disabled).toBeTrue();
        expect(fixture.nativeElement.querySelector('#fecha-postulacion').disabled).toBeTrue();
        expect(fixture.nativeElement.querySelector('#nota-postulacion').disabled).toBeTrue();

        // 4. Los botones editoriales de descripción y reevaluación no se renderizan en el DOM
        const btnEditar = fixture.nativeElement.querySelector('.btn-editar-descripcion');
        const btnReevaluar = fixture.nativeElement.querySelector('.btn-reevaluar-oferta');
        expect(btnEditar).toBeNull();
        expect(btnReevaluar).toBeNull();
    });

    it('tieneDesglose detecta correctamente presencia de desglose estructurado', async () => {
        const { component } = await crearComponente();

        expect(component.tieneDesglose(null)).toBe(false);
        expect(component.tieneDesglose({} as any)).toBe(false);
        expect(component.tieneDesglose({ explicacion_evaluacion: null } as any)).toBe(false);

        // Con flag explícito
        expect(component.tieneDesglose({
            explicacion_evaluacion: { desglose_disponible: true }
        } as any)).toBe(true);

        // Sin flag pero con items en cumplidos
        expect(component.tieneDesglose({
            explicacion_evaluacion: { cumplidos: [{ requisito: 'TypeScript' }] }
        } as any)).toBe(true);

        // Sin flag y arrays vacíos
        expect(component.tieneDesglose({
            explicacion_evaluacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [] }
        } as any)).toBe(false);
    });

    it('renderiza banner de reevaluación no aplicada cuando existe firma_criterios_evaluacion previa (O-01)', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            estado_evaluacion: 'aprobada',
            evaluacion_error_mensaje: 'Error de conexión con la IA al reevaluar',
            firma_criterios_evaluacion: 'firma-valida-previa',
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent;
        expect(texto).toContain('Última reevaluación no aplicada');
        expect(texto).toContain('Se conserva la evaluación anterior válida. Motivo: Error de conexión con la IA al reevaluar');
        expect(texto).not.toContain('Evaluación no completada');
    });

    it('renderiza banner neutral de evaluación no completada cuando firma_criterios_evaluacion es null (O-01)', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            estado_evaluacion: 'rechazada',
            evaluacion_error_mensaje: 'No se pudo interpretar la respuesta de DeepSeek',
            firma_criterios_evaluacion: null,
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent;
        expect(texto).toContain('Evaluación no completada');
        expect(texto).toContain('La evaluación no pudo completarse satisfactoriamente. Motivo: No se pudo interpretar la respuesta de DeepSeek');
        expect(texto).not.toContain('Última reevaluación no aplicada');
        expect(texto).not.toContain('Se conserva la evaluación anterior válida');
        const alerta = fixture.nativeElement.querySelector('.alerta-desactualizada');
        expect(alerta.closest('details')).withContext('S4,S7: el fallo técnico no se oculta en matching').toBeNull();
    });

    it('oferta con error técnico en estado pendiente muestra alerta de fallo técnico y no la de criterios modificados', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            estado_evaluacion: 'pendiente',
            evaluacion_error_mensaje: 'Fallo al conectar con el motor de IA (timeout)',
            firma_criterios_evaluacion: null,
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent;
        expect(texto).toContain('Evaluación no completada (fallo técnico)');
        expect(texto).toContain('La evaluación no pudo completarse satisfactoriamente. Motivo: Fallo al conectar con el motor de IA (timeout)');
        expect(texto).not.toContain('Evaluación desactualizada — pendiente de reevaluación');
        expect(texto).not.toContain('La descripción o los criterios se modificaron');
        expect(texto).not.toContain('85%');
        expect(fixture.nativeElement.querySelector('.alerta-desactualizada').closest('details')).toBeNull();
    });

    it('oferta previamente aprobada con reevaluación fallida muestra la evaluación anterior y la alerta de fallo reciente', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            estado_evaluacion: 'aprobada',
            porcentaje_match: 85,
            evaluacion_error_mensaje: 'Error 500: servicio no disponible al reevaluar',
            firma_criterios_evaluacion: 'firma-aprobada-valida',
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent;
        expect(texto).toContain('APROBADA');
        expect(texto).toContain('Compatibilidad estimada: 85%');
        expect(texto).toContain('Última reevaluación no aplicada');
        expect(texto).toContain('Se conserva la evaluación anterior válida. Motivo: Error 500: servicio no disponible al reevaluar');
        expect(texto).not.toContain('Evaluación desactualizada — pendiente de reevaluación');
        expect(fixture.nativeElement.querySelector('.alerta-desactualizada').closest('details')).withContext('S4,S7: conservo visible el fallo de reevaluación').toBeNull();
    });

    it('renderiza Primera detección y no renderiza Última detección si no hay fecha_ultima_extraccion o es idéntica', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            fecha_extraccion: '2026-04-01T12:00:00',
            fecha_ultima_extraccion: null,
            fecha_publicacion: '2026-04-01T12:00:00',
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const metadatos = fixture.nativeElement.querySelector('.detalle-fechas')?.closest('details') as HTMLDetailsElement | null;
        expect(metadatos).withContext('S6: las fechas secundarias se conservan en un plegable').not.toBeNull();
        expect(metadatos?.open).toBeFalse();
        metadatos?.querySelector('summary')?.click();
        fixture.detectChanges();
        expect(metadatos?.open).toBeTrue();
        const texto = metadatos?.textContent ?? '';
        expect(texto).toContain('Primera detección:');
        expect(texto).toContain('01/04/2026');
        expect(texto).not.toContain('Última detección:');
        expect(texto).toContain('Publicada: 01/04/2026');
    });

    it('renderiza Primera detección y Última detección cuando fecha_ultima_extraccion es distinta a fecha_extraccion', async () => {
        const { fixture, component } = await crearComponente();
        fixture.componentRef.setInput('oferta', {
            ...mockOferta,
            fecha_extraccion: '2026-04-01T12:00:00',
            fecha_ultima_extraccion: '2026-04-05T15:30:00',
            fecha_publicacion: null,
        } as any);
        component.visible.set(true);
        fixture.detectChanges();

        const metadatos = fixture.nativeElement.querySelector('.detalle-fechas')?.closest('details') as HTMLDetailsElement | null;
        expect(metadatos).not.toBeNull();
        metadatos?.querySelector('summary')?.click();
        fixture.detectChanges();
        const texto = metadatos?.textContent ?? '';
        expect(texto).toContain('Primera detección:');
        expect(texto).toContain('Última detección:');
        expect(texto).toContain('01/04/2026');
        expect(texto).toContain('05/04/2026');
        expect(texto).toContain('Publicación: Desconocida / No informada');
        expect(texto).not.toContain('Publicada: 05/04/2026');
    });
});
