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
                        explicacion: 'No se encontraron evidencias de Docker en el perfil.'
                    }
                ],
                por_confirmar: [
                    {
                        requisito: 'Inglés conversacional B2',
                        tipo: 'deseable',
                        explicacion: 'Nivel no detallado en extracto disponible.'
                    }
                ],
                exclusiones: [
                    {
                        requisito: 'Java empresarial',
                        tipo: 'obligatorio',
                        evidencia_oferta: 'Mantenimiento de microservicios en Java Spring',
                        explicacion: 'El perfil excluye activamente vacantes de Java.'
                    }
                ]
            }
        });

        fixture.componentRef.setInput('oferta', ofertaConDesglose);
        component.visible.set(true);
        fixture.detectChanges();

        const texto = fixture.nativeElement.textContent;

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
        expect(alerta.textContent).toContain('88%');
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

    it('muestra badge y alerta de evaluación desactualizada cuando está pendiente o con reevaluación solicitada', () => {
        const ofertaDesactualizada = crearOfertaBase({
            estado_evaluacion: 'pendiente',
            evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA'
        });

        fixture.componentRef.setInput('oferta', ofertaDesactualizada);
        component.visible.set(true);
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector('.tag-desactualizada');
        expect(badge).toBeTruthy();
        expect(badge.textContent).toContain('Evaluación desactualizada — pendiente de reevaluación');

        const alerta = fixture.nativeElement.querySelector('.alerta-desactualizada');
        expect(alerta).toBeTruthy();
        expect(alerta.textContent).toContain('Evaluación desactualizada — pendiente de reevaluación');

        const btnReevaluar = fixture.nativeElement.querySelector('.btn-reevaluar-oferta');
        expect(btnReevaluar).toBeTruthy();
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
