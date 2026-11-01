import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { DetalleOferta } from './detalle-oferta';
import { Oferta } from '../../modelos/oferta.model';
import { OfertasService } from '../../servicios/ofertas.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';

describe('Issue #17 — DetalleOferta: Matching Explicable y Edición Manual de Descripción', () => {

    let fixture: ComponentFixture<DetalleOferta>;
    let component: DetalleOferta;
    let mockOfertasService: {
        actualizarPostulacion: jasmine.Spy;
        actualizarDescripcion: jasmine.Spy;
    };
    let mockEvaluacionService: {
        ejecutarEvaluacion: jasmine.Spy;
    };

    const crearOfertaBase = (parcial?: Partial<Oferta>): Oferta => ({
        id: 17,
        titulo: 'Desarrollador Fullstack Junior',
        empresa: 'Tecnologías del Plata',
        ubicacion: 'Buenos Aires, Argentina',
        modalidad: 'híbrido',
        descripcion: 'Buscamos desarrollador junior con conocimientos de TypeScript y Angular.',
        url: 'https://ejemplo.com/oferta/17',
        plataforma: 'linkedin',
        nivel_requerido: 'junior',
        salario_min: '800000',
        salario_max: '1100000',
        moneda: '$',
        estado_evaluacion: 'aprobada',
        razon_evaluacion: 'Perfil alineado con requerimientos de frontend y backend.',
        porcentaje_match: 85,
        estado_postulacion: 'no_postulado',
        fecha_publicacion: '2026-10-10T10:00:00.000Z',
        fecha_extraccion: '2026-10-10T12:00:00.000Z',
        datos_crudos: null,
        origen_descripcion: 'tarjeta',
        descripcion_completitud: 'parcial',
        ...parcial,
    });

    beforeEach(async () => {
        mockOfertasService = {
            actualizarPostulacion: jasmine.createSpy('actualizarPostulacion').and.returnValue(
                of({ exito: true, datos: { estado_postulacion: 'cv_enviado' } })
            ),
            actualizarDescripcion: jasmine.createSpy('actualizarDescripcion').and.callFake((id: number, descripcion: string) =>
                of({
                    exito: true,
                    datos: {
                        id,
                        descripcion,
                        origen_descripcion: 'manual',
                        descripcion_completitud: 'completa',
                        descripcion_modificada_en: '2026-10-13T20:00:00.000Z',
                        estado_evaluacion: 'pendiente',
                        evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA'
                    } as Oferta
                })
            )
        };

        mockEvaluacionService = {
            ejecutarEvaluacion: jasmine.createSpy('ejecutarEvaluacion').and.returnValue(
                of({ exito: true, mensaje: 'Evaluación iniciada', id_tarea: 'tarea-17' })
            )
        };

        await TestBed.configureTestingModule({
            imports: [DetalleOferta],
            providers: [
                { provide: OfertasService, useValue: mockOfertasService },
                { provide: EvaluacionService, useValue: mockEvaluacionService },
                provideNoopAnimations(),
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DetalleOferta);
        component = fixture.componentInstance;
    });

    it('renderiza desglose estructurado con cumplidos, exclusiones, no cumplidos y por confirmar', () => {
        const ofertaConDesglose = crearOfertaBase({
            explicacion_evaluacion: {
                desglose_disponible: true,
                cumplidos: [
                    {
                        requisito: 'Angular',
                        tipo: 'obligatorio',
                        evidencia_oferta: 'Experiencia previa con Angular',
                        evidencia_perfil: 'Proyectos desarrollados en Angular 20',
                        explicacion: 'Coincide con el framework del stack principal.'
                    }
                ],
                no_cumplidos: [
                    {
                        requisito: 'Docker',
                        tipo: 'deseable',
                        evidencia_oferta: 'Deseable nociones de contenedores',
                        evidencia_perfil: 'El perfil no declara Docker',
                        explicacion: 'No se encontraron evidencias de Docker en el perfil.'
                    }
                ],
                por_confirmar: [
                    {
                        requisito: 'Inglés conversacional B2',
                        tipo: 'deseable',
                        evidencia_oferta: 'Reuniones en inglés con clientes',
                        evidencia_perfil: 'Lectura técnica sin nivel conversacional declarado',
                        explicacion: 'Nivel no detallado en extracto disponible.'
                    }
                ],
                exclusiones: [
                    {
                        requisito: 'Java empresarial',
                        tipo: 'obligatorio',
                        evidencia_oferta: 'Mantenimiento de microservicios en Java Spring',
                        evidencia_perfil: 'Exclusión explícita de Java en el perfil',
                        explicacion: 'El perfil excluye activamente vacantes de Java.'
                    }
                ]
            }
        });

        fixture.componentRef.setInput('oferta', ofertaConDesglose);
        component.visible.set(true);
        fixture.detectChanges();

        const desglose = fixture.nativeElement.querySelector('.seccion-matching details') as HTMLDetailsElement | null;
        expect(desglose).withContext('S4: el análisis completo usa details nativo cerrado al abrir').not.toBeNull();
        expect(desglose?.open).toBeFalse();
        const resumen = desglose?.querySelector('summary');
        expect(resumen?.textContent?.trim()).toBeTruthy();
        resumen?.click();
        fixture.detectChanges();
        expect(desglose?.open).toBeTrue();

        const texto = desglose?.textContent ?? '';
        const explicacion = ofertaConDesglose.explicacion_evaluacion!;
        for (const grupo of [explicacion.cumplidos, explicacion.no_cumplidos, explicacion.exclusiones, explicacion.por_confirmar]) {
            for (const item of grupo) {
                for (const evidencia of [item.requisito, item.explicacion, item.evidencia_oferta, item.evidencia_perfil]) {
                    expect(texto).withContext('S4: conservo cada requisito, explicación y evidencia de oferta/perfil').toContain(evidencia!);
                }
            }
        }
        expect(mockEvaluacionService.ejecutarEvaluacion).not.toHaveBeenCalled();
        expect(mockOfertasService.actualizarDescripcion).not.toHaveBeenCalled();
        expect(mockOfertasService.actualizarPostulacion).not.toHaveBeenCalled();

        // Sección a favor del match
        expect(texto).toContain('A favor del match');
        expect(texto).toContain('Angular');
        expect(texto).toContain('Experiencia previa con Angular');
        expect(texto).toContain('Proyectos desarrollados en Angular 20');

        // Sección en contra del match
        expect(texto).toContain('En contra del match');
        expect(texto).toContain('Exclusiones obligatorias');
        expect(texto).toContain('Java empresarial');
        expect(texto).toContain('Mantenimiento de microservicios en Java Spring');
        expect(texto).toContain('Requisitos no cumplidos');
        expect(texto).toContain('Docker');

        // Sección por confirmar
        expect(texto).toContain('Por confirmar');
        expect(texto).toContain('Inglés conversacional B2');
    });

    it('muestra advertencia clara cuando hay exclusión obligatoria con porcentaje de match alto', () => {
        const ofertaExcluidaAlta = crearOfertaBase({
            porcentaje_match: 88,
            estado_evaluacion: 'rechazada',
            explicacion_evaluacion: {
                desglose_disponible: true,
                cumplidos: [
                    { requisito: 'TypeScript', tipo: 'obligatorio' },
                    { requisito: 'Node.js', tipo: 'obligatorio' }
                ],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [
                    {
                        requisito: 'Java 17',
                        tipo: 'obligatorio',
                        explicacion: 'Excluido estrictamente por tecnología vetada.'
                    }
                ]
            }
        });

        fixture.componentRef.setInput('oferta', ofertaExcluidaAlta);
        component.visible.set(true);
        fixture.detectChanges();

        const alerta = fixture.nativeElement.querySelector('.alerta-exclusion-score-alto');
        expect(alerta).toBeTruthy();
        expect(alerta.textContent).toContain('Atención: Compatibilidad estimada alta rechazada por exclusión');
        expect(fixture.nativeElement.textContent).toContain('88%');
        expect((fixture.nativeElement.textContent as string).match(/88\s*%/g)?.length).toBe(1);
        expect(alerta.closest('details')).withContext('S4: la alerta crítica no queda plegada').toBeNull();
    });

    it('S4: mantiene la exclusión obligatoria visible con matching cerrado incluso con compatibilidad baja', () => {
        fixture.componentRef.setInput('oferta', crearOfertaBase({
            porcentaje_match: 30,
            estado_evaluacion: 'rechazada',
            explicacion_evaluacion: {
                desglose_disponible: true,
                cumplidos: [],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: [{ requisito: 'Java obligatorio', tipo: 'obligatorio', explicacion: 'Tecnología excluida del perfil.' }]
            }
        }));
        component.visible.set(true);
        fixture.detectChanges();

        const desglose = fixture.nativeElement.querySelector('.seccion-matching details') as HTMLDetailsElement | null;
        expect(desglose).not.toBeNull();
        expect(desglose?.open).toBeFalse();
        const alertas = Array.from(fixture.nativeElement.querySelectorAll('[role="alert"]')) as HTMLElement[];
        const exclusion = alertas.find(alerta => alerta.textContent?.includes('Java obligatorio'));
        expect(exclusion).withContext('La advertencia identifica el requisito excluyente sin abrir el análisis').toBeDefined();
        expect(exclusion?.closest('details')).toBeNull();
    });

    it('muestra fallback con leyenda explicativa cuando es un registro histórico sin desglose', () => {
        const ofertaHistorica = crearOfertaBase({
            razon_evaluacion: 'Evaluación histórica migrada sin estructura detallada.',
            explicacion_evaluacion: null
        });

        fixture.componentRef.setInput('oferta', ofertaHistorica);
        component.visible.set(true);
        fixture.detectChanges();

        const elementoAviso = fixture.nativeElement.querySelector('.aviso-historico-sin-desglose');
        expect(elementoAviso).toBeTruthy();
        expect(elementoAviso.textContent).toContain(
            'Esta evaluación histórica no cuenta con desglose estructurado detallado. Podés solicitar una reevaluación para obtener el análisis completo.'
        );
        expect(fixture.nativeElement.textContent).toContain('Evaluación histórica migrada sin estructura detallada.');
    });

    it('presenta la compatibilidad estimada sin referirse a probabilidad de contratación', () => {
        const oferta = crearOfertaBase({
            porcentaje_match: 75,
            explicacion_evaluacion: {
                desglose_disponible: true,
                cumplidos: [{ requisito: 'JavaScript', tipo: 'obligatorio' }],
                no_cumplidos: [],
                por_confirmar: [],
                exclusiones: []
            }
        });

        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent.toLowerCase();
        expect(texto).toContain('compatibilidad estimada: 75%');
        expect(texto.match(/75\s*%/g)?.length).withContext('S3: no duplico el porcentaje entre cabecera y matching').toBe(1);
        expect(texto).not.toContain('probabilidad de ser contratado');
        expect(texto).not.toContain('probabilidad de contratación');
    });

    it('muestra badges de procedencia de descripción correspondientes', () => {
        // Caso extracto parcial de tarjeta
        const ofertaTarjeta = crearOfertaBase({
            origen_descripcion: 'tarjeta',
            descripcion_completitud: 'parcial'
        });
        fixture.componentRef.setInput('oferta', ofertaTarjeta);
        component.visible.set(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Extracto parcial de tarjeta');

        // Caso manual
        const ofertaManual = crearOfertaBase({
            origen_descripcion: 'manual',
            descripcion_completitud: 'completa'
        });
        fixture.componentRef.setInput('oferta', ofertaManual);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Descripción completada manualmente');

        // Caso completa original
        const ofertaCompleta = crearOfertaBase({
            origen_descripcion: 'scraper',
            descripcion_completitud: 'completa'
        });
        fixture.componentRef.setInput('oferta', ofertaCompleta);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Descripción completa');
    });

    it('S7: muestra una sola advertencia de evaluación desactualizada y oculta la compatibilidad anterior', () => {
        const ofertaDesactualizada = crearOfertaBase({
            estado_evaluacion: 'pendiente',
            evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA'
        });

        fixture.componentRef.setInput('oferta', ofertaDesactualizada);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent as string;
        expect(texto.split('Evaluación desactualizada — pendiente de reevaluación').length - 1).toBe(1);
        expect(texto).not.toContain('85%');
        expect(texto).not.toContain('Compatibilidad estimada:');

        const alerta = fixture.nativeElement.querySelector('.alerta-desactualizada');
        expect(alerta).toBeTruthy();
        expect(alerta.textContent).toContain('Evaluación desactualizada — pendiente de reevaluación');
        expect(alerta.closest('details')).toBeNull();

        const btnReevaluar = fixture.nativeElement.querySelector('.btn-reevaluar-oferta');
        expect(btnReevaluar).toBeTruthy();
    });

    const crearPendienteLaboral = (cambios: Partial<Oferta> = {}): Oferta => crearOfertaBase({
        estado_evaluacion: 'pendiente', evaluacion_error_mensaje: null,
        firma_criterios_evaluacion: 'criterios-sinteticos-v7', vigencia_evaluacion: 'desconocida',
        razon_evaluacion: 'Pendiente de confirmación: Residencia en provincia Delta. Afinidad técnica estimada: 91%.',
        porcentaje_match: 91,
        explicacion_evaluacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [
            { requisito: 'Residencia en provincia Delta', tipo: 'obligatorio', evidencia_oferta: 'Residencia obligatoria en provincia Delta.',
                evidencia_perfil: '', explicacion: 'Residencia no declarada en el perfil sintético.' }
        ] },
        ...cambios,
    });

    it('#80: anuncia confirmación laboral sin atribuir cambios de criterios ni mostrar aprobación o error', async () => {
        fixture.componentRef.setInput('oferta', crearPendienteLaboral());
        component.visible.set(true);
        fixture.autoDetectChanges();
        await fixture.whenStable();

        const texto = fixture.nativeElement.textContent as string;
        const alerta = fixture.nativeElement.querySelector('[role="status"].alerta-desactualizada') as HTMLElement;
        expect(alerta.textContent).toContain('Elegibilidad pendiente de confirmación');
        expect(alerta.textContent).not.toContain('se modificaron');
        expect(texto).not.toContain('Evaluación desactualizada');
        expect(fixture.nativeElement.querySelector('.tag-match')).toBeNull();
        expect(fixture.nativeElement.querySelector('.tag-detalle[data-estado="error"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('.tag-detalle[data-estado="pendiente"]')).not.toBeNull();
        expect(mockEvaluacionService.ejecutarEvaluacion).not.toHaveBeenCalled();
        expect(mockOfertasService.actualizarDescripcion).not.toHaveBeenCalled();
        expect(mockOfertasService.actualizarPostulacion).not.toHaveBeenCalled();
    });

    it('#80: presenta la razón pendiente como actual y mantiene la evidencia por confirmar sin exigir score', async () => {
        const oferta = crearPendienteLaboral({ descripcion: null, porcentaje_match: null,
            razon_evaluacion: 'Pendiente de confirmación: falta la descripción de la oferta.',
            explicacion_evaluacion: { cumplidos: [], no_cumplidos: [], exclusiones: [], por_confirmar: [
                { requisito: 'Descripción de la oferta', tipo: 'desconocido', explicacion: 'Necesito la descripción para evaluar requisitos.' }
            ] },
        });
        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.autoDetectChanges();
        await fixture.whenStable();

        const razon = fixture.nativeElement.querySelector('.detalle-razon') as HTMLElement;
        expect(razon.textContent).toContain(oferta.razon_evaluacion!);
        expect(razon.textContent).not.toContain('Motivo de la evaluación anterior');
        const desglose = fixture.nativeElement.querySelector('.seccion-matching details') as HTMLDetailsElement;
        desglose.querySelector('summary')!.click();
        await fixture.whenStable();
        expect(desglose.open).toBeTrue();
        expect(desglose.textContent).toContain('Por confirmar (1)');
        expect(desglose.textContent).toContain('Necesito la descripción para evaluar requisitos.');
        expect(fixture.nativeElement.querySelector('.tag-match')).toBeNull();
        expect(mockEvaluacionService.ejecutarEvaluacion).not.toHaveBeenCalled();
    });

    for (const [nombre, cambios, aviso] of [
        ['reevaluación solicitada', { evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA' }, 'Evaluación desactualizada — pendiente de reevaluación'],
        ['vigencia anterior', { vigencia_evaluacion: 'anterior' }, 'Evaluación desactualizada — pendiente de reevaluación'],
        ['fallo técnico', { evaluacion_error_mensaje: 'Servicio sintético no disponible (HTTP 503).' }, 'Evaluación no completada (fallo técnico)'],
    ] as const) {
        it(`#80 control: conservo ${nombre} aunque la razón anterior fuera laboral`, async () => {
            fixture.componentRef.setInput('oferta', crearPendienteLaboral(cambios));
            component.visible.set(true);
            fixture.autoDetectChanges();
            await fixture.whenStable();
            const texto = fixture.nativeElement.textContent as string;
            expect(texto).toContain(aviso);
            expect(texto).toContain('Motivo de la evaluación anterior:');
            expect(texto).not.toContain('Elegibilidad pendiente de confirmación');
            expect(fixture.nativeElement.querySelector('.tag-match')).toBeNull();
        });
    }

    it('S6: ofrece un resumen breve y permite consultar la descripción completa sin ejecutar servicios', () => {
        const inicio = 'Buscamos una persona junior para desarrollar interfaces accesibles. ';
        const descripcion = inicio + 'El equipo trabaja con Angular y TypeScript en productos internos. '.repeat(24)
            + '\nBeneficios: capacitación y acompañamiento técnico.';
        fixture.componentRef.setInput('oferta', crearOfertaBase({ descripcion }));
        component.visible.set(true);
        fixture.detectChanges();

        const seccion = fixture.nativeElement.querySelector('.seccion-descripcion') as HTMLElement;
        const divulgacion = seccion.querySelector('details');
        expect(divulgacion).not.toBeNull();
        expect(divulgacion?.open).toBeFalse();
        const resumen = Array.from(seccion.querySelectorAll('p, .detalle-descripcion'))
            .find(elemento => !elemento.closest('details') && elemento.textContent?.includes('Buscamos una persona junior'));
        expect(resumen).withContext('El extracto permanece visible sin abrir el texto completo').toBeDefined();
        expect((resumen?.textContent ?? '').length).toBeGreaterThan(0);
        expect((resumen?.textContent ?? '').length).toBeLessThan(descripcion.length);
        const disparador = divulgacion?.querySelector('summary');
        expect(disparador?.textContent?.trim()).toBeTruthy();
        disparador?.click();
        fixture.detectChanges();
        expect(divulgacion?.open).toBeTrue();
        expect(divulgacion?.querySelector('.detalle-descripcion')?.textContent).toBe(descripcion);
        expect(mockEvaluacionService.ejecutarEvaluacion).not.toHaveBeenCalled();
        expect(mockOfertasService.actualizarDescripcion).not.toHaveBeenCalled();
        expect(mockOfertasService.actualizarPostulacion).not.toHaveBeenCalled();
    });

    it('S6,S8: permite entrar a la edición mediante un botón accesible fuera de los plegables cerrados', () => {
        const oferta = crearOfertaBase();
        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.detectChanges();

        const editar = fixture.nativeElement.querySelector('button[aria-label="Completar o editar descripción"]') as HTMLButtonElement;
        expect(editar).not.toBeNull();
        expect(editar.closest('details')).toBeNull();
        expect(editar.disabled).toBeFalse();
        editar.click();
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('textarea[aria-label="Editor de descripción de la oferta"]') as HTMLTextAreaElement;
        expect(editor).not.toBeNull();
        expect(editor.closest('details:not([open])')).toBeNull();
        expect(component.nuevaDescripcion()).toBe(oferta.descripcion!);
        expect(mockOfertasService.actualizarDescripcion).not.toHaveBeenCalled();
        expect(mockEvaluacionService.ejecutarEvaluacion).not.toHaveBeenCalled();
    });

    it('gestiona el flujo de edición: abrir, cancelar sin modificar y validar longitud mínima', () => {
        const descripcionOriginal = 'Descripción original con suficiente longitud para la prueba.';
        const oferta = crearOfertaBase({
            descripcion: descripcionOriginal
        });

        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.detectChanges();

        // 1. Abrir edición
        component.iniciarEdicionDescripcion();
        expect(component.modoEdicionDescripcion()).toBe(true);
        expect(component.nuevaDescripcion()).toBe(descripcionOriginal);

        // 2. Modificar texto pero cancelar
        component.nuevaDescripcion.set('Texto que el usuario decidió descartar...');
        component.cancelarEdicionDescripcion();
        expect(component.modoEdicionDescripcion()).toBe(false);
        expect(oferta.descripcion).toBe(descripcionOriginal);

        // 3. Abrir de nuevo e intentar guardar texto corto (< 20 caracteres)
        component.iniciarEdicionDescripcion();
        component.nuevaDescripcion.set('Corto');
        component.guardarDescripcion();

        expect(component.errorEdicionDescripcion()).toBe('La descripción debe tener entre 20 y 50000 caracteres');
        expect(mockOfertasService.actualizarDescripcion).not.toHaveBeenCalled();
    });

    it('guarda exitosamente una nueva descripción, actualiza la oferta local y emite evento', () => {
        const oferta = crearOfertaBase({ id: 17, descripcion: 'Descripción vieja parcial.' });
        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.detectChanges();

        let ofertaEmitida: Oferta | null = null;
        component.ofertaActualizada.subscribe((actualizada) => {
            ofertaEmitida = actualizada;
        });

        const nuevaDescripcionPegada = 'Nueva descripción completa y detallada pegada manualmente desde el portal de empleo con más de veinte caracteres.';
        component.iniciarEdicionDescripcion();
        component.nuevaDescripcion.set(nuevaDescripcionPegada);
        component.guardarDescripcion();

        expect(mockOfertasService.actualizarDescripcion).toHaveBeenCalledWith(17, nuevaDescripcionPegada);
        expect(component.modoEdicionDescripcion()).toBe(false);
        expect(oferta.descripcion).toBe(nuevaDescripcionPegada);
        expect(oferta.origen_descripcion).toBe('manual');
        expect(ofertaEmitida).toBeTruthy();
        expect((ofertaEmitida as unknown as Oferta).id).toBe(17);
    });

    it('conserva el borrador en el textarea cuando falla el guardado en el backend', () => {
        mockOfertasService.actualizarDescripcion.and.returnValue(
            throwError(() => ({ error: { error: 'Error del servidor al actualizar' } }))
        );

        const oferta = crearOfertaBase({ id: 17 });
        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.detectChanges();

        const borradorValioso = 'Borrador valioso con requerimientos detallados y beneficios que Marcos copió y no debe perderse bajo ningún concepto.';
        component.iniciarEdicionDescripcion();
        component.nuevaDescripcion.set(borradorValioso);
        component.guardarDescripcion();

        expect(component.guardandoDescripcion()).toBe(false);
        expect(component.modoEdicionDescripcion()).toBe(true);
        expect(component.nuevaDescripcion()).toBe(borradorValioso);
        expect(component.errorEdicionDescripcion()).toBe('Error del servidor al actualizar');
    });

    it('ejecuta reevaluación explícita llamando a EvaluacionService y actualizando estado a pendiente', () => {
        const oferta = crearOfertaBase({ id: 17, estado_evaluacion: 'aprobada' });
        fixture.componentRef.setInput('oferta', oferta);
        component.visible.set(true);
        fixture.detectChanges();

        let ofertaEmitida: Oferta | null = null;
        component.ofertaActualizada.subscribe((actualizada) => {
            ofertaEmitida = actualizada;
        });

        component.solicitarReevaluacion();

        expect(mockEvaluacionService.ejecutarEvaluacion).toHaveBeenCalledWith([17]);
        expect(component.reevaluandoOferta()).toBe(false);
        expect(component.mensajeReevaluacion()).toContain('Reevaluación solicitada correctamente');
        expect(oferta.estado_evaluacion).toBe('pendiente');
        expect(ofertaEmitida).toBeTruthy();
    });
});
