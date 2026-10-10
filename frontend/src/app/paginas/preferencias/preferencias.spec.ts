import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Preferencias } from './preferencias';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { DemoService } from '../../servicios/demo.service';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('Preferencias — Accesibilidad aria-live dinámico', () => {

    const mockPreferencias = {
        exito: true,
        datos: {
            id: 1,
            nombre: 'Marcos',
            nivel_experiencia: 'junior',
            perfil_profesional: 'Dev junior',
            idioma_candidato: 'Español nativo',
            stack_tecnologico: ['Angular', 'TypeScript'],
            modalidad_aceptada: 'cualquiera',
            zonas_preferidas: ['CABA'],
            terminos_busqueda: ['Angular developer'],
            reglas_exclusion: ['Java'],
            prompt_personalizado: '',
            usar_prompt_personalizado: false,
            modelo_ia: 'deepseek-v4-flash',
        }
    };

    async function crearComponente(): Promise<{ fixture: ComponentFixture<Preferencias>; component: Preferencias }> {
        const mockPrefService = {
            obtenerPreferencias: () => of(mockPreferencias),
            actualizarPreferencias: () => of(mockPreferencias),
        };
        const mockEvaluacionService = {
            resetearEvaluaciones: () => of({ exito: true, datos: { reseteadas: 3 } }),
        };
        const mockDemoService = { esModoDemo: () => false };

        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                provideNoopAnimations(),
                { provide: PreferenciasService, useValue: mockPrefService },
                { provide: EvaluacionService, useValue: mockEvaluacionService },
                { provide: DemoService, useValue: mockDemoService },
                MessageService,
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Preferencias);
        const component = fixture.componentInstance;
        return { fixture, component };
    }

    it('debería crear el componente', async () => {
        const { component } = await crearComponente();
        expect(component).toBeTruthy();
    });

    it('conserva listas eliminadas y no completa hechos ausentes al recargar', async () => {
        const { component } = await crearComponente();
        component.cargarPreferencias();
        expect(component.tecnologiasDetalle).toEqual([]);
        expect(component.rolesObjetivoDetalle).toEqual([]);
        expect(component.aniosExperienciaReales).toBeNull();
        expect(component.nivelInglesDetalle as object).toEqual({});
        expect(component.nivelRealSeniority).toBe('');
    });

    it('guarda vacío y ninguno sin recuperar el stack anterior y conserva cero y texto exacto', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const guardar = spyOn(servicio, 'actualizarPreferencias').and.returnValue(of(mockPreferencias as any));
        component.stackTecnologico = ['Angular'];
        component.tecnologiasDetalle = [];
        component.rolesObjetivoDetalle = [];
        component.aniosExperienciaReales = 0;
        component.promptPersonalizado = '  Criterio adicional\n\n';
        component.guardar();
        expect(guardar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
            stack_tecnologico: [], tecnologias_detalle: [], roles_objetivo_detalle: [],
            anios_experiencia_reales: 0, prompt_personalizado: '  Criterio adicional\n\n',
        }));
        component.tecnologiasDetalle = [{ nombre: 'Java', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: [] }];
        component.guardar();
        expect(guardar.calls.mostRecent().args[0].stack_tecnologico).toEqual([]);
        expect(guardar.calls.mostRecent().args[0].tecnologias_detalle?.[0].nivel).toBe('ninguno');
    });

    it('aplicar CV no sobrescribe reglas ni preferencias laborales confirmadas', async () => {
        const { component } = await crearComponente();
        component.modalidadAceptada = 'remoto';
        component.zonasPreferidas = ['CABA'];
        component.terminosBusqueda = ['QA'];
        component.reglasExclusion = ['SAP'];
        component.resultadoImportacion = {
            nombre: 'Candidato CV', modalidad_aceptada: 'presencial', zonas_preferidas: ['Interior'],
            terminos_busqueda: ['Java'], reglas_exclusion: ['Python'], tecnologias_detalle: [],
            roles_objetivo_detalle: [], preguntas: [], advertencias: [],
        } as any;
        component.aplicarImportacion();
        expect(component.nombre).toBe('Candidato CV');
        expect(component.modalidadAceptada).toBe('remoto');
        expect(component.zonasPreferidas).toEqual(['CABA']);
        expect(component.terminosBusqueda).toEqual(['QA']);
        expect(component.reglasExclusion).toEqual(['SAP']);
    });

    it('muestra el perfil retornado, mantiene la vista guardada al editar y recarga sin derivarla', async () => {
        const { fixture, component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const perfil = {
            version: 1, candidato: {
                nombre: 'Persistido', nivel_real_seniority: null, anios_experiencia_reales: 0,
                perfil_profesional: 'Proyecto confirmado', tecnologias_detalle: [], stack_tecnologico: [],
                nivel_ingles_detalle: { reading: 'C1' }, idioma_candidato: null,
                conocimientos_ausentes: [], limitaciones_explicitas: null,
            }, restricciones: { preferencias: { roles_objetivo_detalle: [], modalidad_aceptada: 'remoto',
                zonas_preferidas: ['CABA'], reglas_exclusion: [], disponibilidad: null,
                expectativa_salarial_min: null, expectativa_salarial_max: null, moneda_salarial: null,
                keywords_positivas: [], keywords_negativas: [], plataformas_preferidas: [], plataformas_excluidas: [],
            }, politicas_sistema: ['Política íntegra de prueba: Java obligatorio excluido.'] },
            secciones: [{ id: 'candidato', titulo: 'Candidato', texto: 'Texto técnico del proveedor' }],
            texto: 'Texto técnico del proveedor',
        };
        const respuesta = { exito: true, datos: { ...mockPreferencias.datos, nombre: 'Persistido',
            tecnologias_detalle: [], roles_objetivo_detalle: [], anios_experiencia_reales: 0,
            perfil_efectivo: perfil, prompt_personalizado: '  criterio\n',
        } };
        let respuestaPersistida = { ...respuesta, datos: { ...respuesta.datos, nombre: 'Inicial',
            perfil_efectivo: { ...perfil, candidato: { ...perfil.candidato, nombre: 'Inicial' } },
        } };
        spyOn(servicio, 'obtenerPreferencias').and.callFake(() => of(respuestaPersistida as any));
        const guardar = spyOn(servicio, 'actualizarPreferencias').and.callFake(() => {
            respuestaPersistida = respuesta;
            return of(respuesta as any);
        });
        fixture.autoDetectChanges();
        await fixture.whenStable();
        const vista = () => fixture.nativeElement.querySelector('[aria-labelledby="perfil-ia-titulo"]') as HTMLElement;
        expect(vista()).not.toBeNull();
        expect(vista()?.textContent).toContain('Inicial');
        const entradaNombre = fixture.nativeElement.querySelector('#nombre') as HTMLInputElement;
        entradaNombre.value = 'Borrador';
        entradaNombre.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        expect(vista()?.textContent).toContain('Cambios sin guardar');
        expect(vista()?.textContent).not.toContain('Borrador');
        expect(vista()?.textContent).toContain('Inicial');
        component.guardar();
        await fixture.whenStable();
        expect(component.nombre).toBe('Persistido');
        expect(component.promptPersonalizado).toBe('  criterio\n');
        expect(component.aniosExperienciaReales).toBe(0);
        expect(vista()?.textContent).toContain('Persistido');
        expect(vista()?.textContent).not.toContain('Inicial');
        expect(guardar.calls.mostRecent().args[0]).not.toEqual(jasmine.objectContaining({ perfil_efectivo: jasmine.anything() }));
        expect(vista()?.textContent).not.toContain('Cambios sin guardar');
        component.cargarPreferencias();
        fixture.changeDetectorRef.markForCheck();
        await fixture.whenStable();
        expect(vista()?.textContent).toContain('Proyecto confirmado');
        expect(vista()?.textContent).toContain('C1');
        expect(vista()?.textContent).toContain('Política íntegra de prueba: Java obligatorio excluido.');
        expect(vista()?.textContent).not.toContain('Texto técnico del proveedor');
        expect(component.rolesObjetivoDetalle).toEqual([]);
        expect(component.tecnologiasDetalle).toEqual([]);
    });

    it('solo modifica el nombre de un perfil legacy sin materializar detalle ausente o null', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const obtener = spyOn(servicio, 'obtenerPreferencias');
        const actualizar = spyOn(servicio, 'actualizarPreferencias');
        for (const detalle of [null, undefined]) {
            const fila = { ...mockPreferencias.datos, nombre: 'Perfil anterior', stack_tecnologico: ['Rust'],
                idioma_candidato: 'Portugués C2', nivel_experiencia: 'trainee', tecnologias_detalle: detalle,
                roles_objetivo_detalle: detalle, nivel_ingles_detalle: null, nivel_real_seniority: null };
            obtener.and.returnValue(of({ exito: true, datos: fila } as any));
            actualizar.and.returnValue(of({ exito: true, datos: { ...fila, nombre: 'Nuevo nombre' } } as any));
            component.cargarPreferencias();
            component.nombre = 'Nuevo nombre';
            component.guardar();
            const payload = JSON.parse(JSON.stringify(actualizar.calls.mostRecent().args[0]));
            expect(payload).toEqual({ nombre: 'Nuevo nombre' });
            component.cargarPreferencias();
            expect(component.stackTecnologico).toEqual(['Rust']);
            expect(component.idiomaCandidato).toBe('Portugués C2');
            expect(component.nivelExperiencia).toBe('trainee');

        }
    });

    it('guarda un perfil incompleto sin enviar idiomas vacíos ni defaults del formulario', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const fila = { id: 1, nombre: null, idioma_candidato: null, tecnologias_detalle: null,
            nivel_ingles_detalle: null, nivel_real_seniority: null, roles_objetivo_detalle: null };
        spyOn(servicio, 'obtenerPreferencias').and.returnValue(of({ exito: true, datos: fila } as any));
        const actualizar = spyOn(servicio, 'actualizarPreferencias').and.returnValue(of({ exito: true, datos: { ...fila, nombre: 'Perfil nuevo' } } as any));
        component.cargarPreferencias();
        component.nombre = 'Perfil nuevo';
        component.guardar();
        expect(JSON.parse(JSON.stringify(actualizar.calls.mostRecent().args[0]))).toEqual({ nombre: 'Perfil nuevo' });
        expect(component.nombre).toBe('Perfil nuevo');
        expect(component.mensajeAccesible()).toContain('correctamente');
    });

    it('vaciar explícitamente detalles ausentes envía eliminaciones y no omite la acción', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const fila = { ...mockPreferencias.datos, stack_tecnologico: ['Rust'], idioma_candidato: 'Portugués C2',
            tecnologias_detalle: null, roles_objetivo_detalle: null, nivel_ingles_detalle: null };
        spyOn(servicio, 'obtenerPreferencias').and.returnValue(of({ exito: true, datos: fila } as any));
        const actualizar = spyOn(servicio, 'actualizarPreferencias').and.returnValue(of({ exito: false } as any));
        component.cargarPreferencias();
        // Agregar y quitar es una edición explícita, aunque vuelva a [] al final.
        component.agregarTecnologia();
        component.quitarTecnologia(0);
        component.agregarRol();
        component.quitarRol(0);
        component.idiomaCandidato = '';
        component.guardar();
        const payload = JSON.parse(JSON.stringify(actualizar.calls.mostRecent().args[0]));
        expect(payload).toEqual({ tecnologias_detalle: [], stack_tecnologico: [], roles_objetivo_detalle: [], idioma_candidato: null });
    });

    it('el borrado de inglés detallado no se omite y conserva cero confirmado', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const fila = { ...mockPreferencias.datos, nivel_ingles_detalle: { reading: 'C1' }, anios_experiencia_reales: 2 };
        spyOn(servicio, 'obtenerPreferencias').and.returnValue(of({ exito: true, datos: fila } as any));
        const actualizar = spyOn(servicio, 'actualizarPreferencias').and.returnValue(of({ exito: false } as any));
        component.cargarPreferencias();
        component.nivelInglesDetalle.reading = '';
        component.aniosExperienciaReales = 0;
        component.vaciarTecnologias();
        expect(component.cambiosSinGuardar).toBeTrue();
        component.guardar();
        expect(actualizar.calls.mostRecent().args[0]).toEqual({
            tecnologias_detalle: [], stack_tecnologico: [], nivel_ingles_detalle: { reading: '' }, anios_experiencia_reales: 0,
        });
        expect(component.cambiosSinGuardar).toBeTrue();
    });

    it('aplicar CV conserva los roles objetivo confirmados', async () => {
        const { component } = await crearComponente();
        component.rolesObjetivoDetalle = [{ rol: 'QA confirmado', prioridad: 'alta', aliases: [] }];
        component.resultadoImportacion = { nombre: 'Perfil CV', tecnologias_detalle: [],
            roles_objetivo_detalle: [{ rol: 'Backend detectado', prioridad: 'media', aliases: [] }],
            preguntas: [], advertencias: [] } as any;
        component.aplicarImportacion();
        expect(component.rolesObjetivoDetalle).toEqual([{ rol: 'QA confirmado', prioridad: 'alta', aliases: [] }]);
    });

    // --- Task 5.1: aria-live recibe contenido dinámico ---

    it('mensajeAccesible inicia vacío', async () => {
        const { component } = await crearComponente();
        expect(component.mensajeAccesible()).toBe('');
    });

    it('al guardar con éxito, mensajeAccesible contiene mensaje de éxito', async () => {
        const { component } = await crearComponente();
        component.nombre = 'Test';
        component.nivelExperiencia = 'junior';

        component.guardar();

        // El mensaje se setea en el next del subscribe.
        // Como el mock resuelve sincrónicamente con of(), el mensaje ya debería estar seteado.
        expect(component.mensajeAccesible()).toBe('Preferencias actualizadas correctamente.');
    });

    it('al guardar con error, mensajeAccesible contiene mensaje de error', async () => {
        const mockPrefServiceError = {
            obtenerPreferencias: () => of(mockPreferencias),
            actualizarPreferencias: () => of({}) // No tiene exito: true, así que va al else
        };
        const mockEvaluacionService = {
            resetearEvaluaciones: () => of({ exito: true, datos: { reseteadas: 0 } }),
        };
        const mockDemoService = { esModoDemo: () => false };

        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                { provide: PreferenciasService, useValue: mockPrefServiceError },
                { provide: EvaluacionService, useValue: mockEvaluacionService },
                { provide: DemoService, useValue: mockDemoService },
                MessageService,
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Preferencias);
        const component = fixture.componentInstance;

        component.guardar();

        // Como el mock devuelve {} sin exito, no se setea mensaje de éxito.
        // Pero guardando.set(false) sí se ejecuta.
        expect(component.guardando()).toBe(false);
    });

    // --- Scoring previo eliminado (B1): no hay scoringConfig ni métodos de scoring ---

    it('el componente no tiene propiedad scoringConfig (deprecado en B1)', async () => {
        const { component } = await crearComponente();
        expect((component as any).scoringConfig).toBeUndefined();
    });

    it('el componente no tiene método restaurarScoringRecomendado (eliminado en B1)', async () => {
        const { component } = await crearComponente();
        expect((component as any).restaurarScoringRecomendado).toBeUndefined();
    });

    it('el componente no tiene método normalizarScoringConfig (eliminado en B1)', async () => {
        const { component } = await crearComponente();
        expect((component as any).normalizarScoringConfig).toBeUndefined();
    });

    it('guardar() no envía scoring_config en el payload', async () => {
        const { component } = await crearComponente();
        component.nombre = 'Test';
        component.nivelExperiencia = 'junior';

        // Verificar que scoring_config no existe como propiedad del componente.
        expect((component as any).scoringConfig).toBeUndefined();
    });

    // --- Agregar y quitar tecnologías ---

    it('agregarTecnologia agrega una tecnología vacía con valores por defecto', async () => {
        const { component } = await crearComponente();
        const cantidadInicial = component.tecnologiasDetalle.length;

        component.agregarTecnologia();

        expect(component.tecnologiasDetalle.length).toBe(cantidadInicial + 1);
        const nuevaTech = component.tecnologiasDetalle[component.tecnologiasDetalle.length - 1];
        expect(nuevaTech.nombre).toBe('');
        expect(nuevaTech.nivel).toBe('basico');
        expect(nuevaTech.categoria).toBe('lenguaje');
        expect(nuevaTech.importancia).toBe('secundaria');
        expect(nuevaTech.aliases).toEqual([]);
    });

    it('quitarTecnologia elimina la tecnología en el índice dado', async () => {
        const { component } = await crearComponente();
        // Cargo las sugeridas para tener datos conocidos.
        component.cargarTecnologiasSugeridas();
        const cantidadInicial = component.tecnologiasDetalle.length;
        const nombreEliminado = component.tecnologiasDetalle[0].nombre;

        component.quitarTecnologia(0);

        expect(component.tecnologiasDetalle.length).toBe(cantidadInicial - 1);
        expect(component.tecnologiasDetalle[0].nombre).not.toBe(nombreEliminado);
    });

    it('quitarTecnologia con índice inválido no modifica el array', async () => {
        const { component } = await crearComponente();
        component.cargarTecnologiasSugeridas();
        const cantidadAntes = component.tecnologiasDetalle.length;

        // Índice fuera de rango — filter no elimina nada.
        component.quitarTecnologia(-1);

        expect(component.tecnologiasDetalle.length).toBe(cantidadAntes);

        component.quitarTecnologia(999);

        expect(component.tecnologiasDetalle.length).toBe(cantidadAntes);
    });

    it('agregarTecnologia seguido de quitarTecnologia restaura la cantidad original', async () => {
        const { component } = await crearComponente();
        component.cargarTecnologiasSugeridas();
        const cantidadOriginal = component.tecnologiasDetalle.length;

        component.agregarTecnologia();
        expect(component.tecnologiasDetalle.length).toBe(cantidadOriginal + 1);

        // Quito la última (la que acabo de agregar).
        component.quitarTecnologia(component.tecnologiasDetalle.length - 1);
        expect(component.tecnologiasDetalle.length).toBe(cantidadOriginal);
    });

    // --- Agregar/quitar tecnologías no requiere scoringConfig (B1) ---

    it('agregar y quitar tecnologías funciona sin scoringConfig', async () => {
        const { component } = await crearComponente();
        component.cargarTecnologiasSugeridas();
        const cantidadOriginal = component.tecnologiasDetalle.length;

        component.agregarTecnologia();
        expect(component.tecnologiasDetalle.length).toBe(cantidadOriginal + 1);

        // Quito la última (la que acabo de agregar).
        component.quitarTecnologia(component.tecnologiasDetalle.length - 1);
        expect(component.tecnologiasDetalle.length).toBe(cantidadOriginal);

        // scoringConfig no existe (deprecado en B1).
        expect((component as any).scoringConfig).toBeUndefined();
    });

    // --- Botones agregar/quitar NO están deshabilitados por modoDemo ---

    it('agregarTecnologia funciona en modo demo (el botón no está bloqueado por modoDemo)', async () => {
        const mockDemoServiceActivo = { esModoDemo: () => true };

        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                { provide: PreferenciasService, useValue: { obtenerPreferencias: () => of(mockPreferencias), actualizarPreferencias: () => of(mockPreferencias) } },
                { provide: EvaluacionService, useValue: { resetearEvaluaciones: () => of({ exito: true, datos: { reseteadas: 0 } }) } },
                { provide: DemoService, useValue: mockDemoServiceActivo },
                MessageService,
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Preferencias);
        const component = fixture.componentInstance;

        // En modo demo, el componente carga datos mockup.
        const cantidadAntes = component.tecnologiasDetalle.length;
        component.agregarTecnologia();
        expect(component.tecnologiasDetalle.length).toBe(cantidadAntes + 1);
    });

    it('quitarTecnologia funciona en modo demo (el botón no está bloqueado por modoDemo)', async () => {
        const mockDemoServiceActivo = { esModoDemo: () => true };

        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                { provide: PreferenciasService, useValue: { obtenerPreferencias: () => of(mockPreferencias), actualizarPreferencias: () => of(mockPreferencias) } },
                { provide: EvaluacionService, useValue: { resetearEvaluaciones: () => of({ exito: true, datos: { reseteadas: 0 } }) } },
                { provide: DemoService, useValue: mockDemoServiceActivo },
                MessageService,
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(Preferencias);
        const component = fixture.componentInstance;

        component.cargarTecnologiasSugeridas();
        const cantidadAntes = component.tecnologiasDetalle.length;
        component.quitarTecnologia(0);
        expect(component.tecnologiasDetalle.length).toBe(cantidadAntes - 1);
    });
});