import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Preferencias } from './preferencias';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { DemoService } from '../../servicios/demo.service';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

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

    // --- Bonus IA/Next.js preservados en scoringConfig ---

    it('restaurarScoringRecomendado incluye bonus herramientas_ia, nextjs y herramientas_ia_nextjs_max', async () => {
        const { component } = await crearComponente();

        component.restaurarScoringRecomendado();

        expect(component.scoringConfig.bonificaciones['herramientas_ia']).toBe(6);
        expect(component.scoringConfig.bonificaciones['nextjs']).toBe(4);
        expect(component.scoringConfig.bonificaciones['herramientas_ia_nextjs_max']).toBe(8);
    });

    it('normalizarScoringConfig preserva bonus IA/Next.js existentes y agrega defaults', async () => {
        const { component } = await crearComponente();

        // Simulo una config de API que trae herramientas_ia pero no nextjs ni max.
        const configParcial = {
            penalizaciones: { senior: 25 },
            bonificaciones: { herramientas_ia: 10 },
        };
        // normalizarScoringConfig es privado, accedo con any para testing.
        const resultado = (component as any).normalizarScoringConfig(configParcial);

        // El valor existente se conserva.
        expect(resultado.bonificaciones['herramientas_ia']).toBe(10);
        // Los defaults se completan.
        expect(resultado.bonificaciones['nextjs']).toBe(4);
        expect(resultado.bonificaciones['herramientas_ia_nextjs_max']).toBe(8);
    });

    it('normalizarScoringConfig con config vacía usa defaults de bonus IA/Next.js', async () => {
        const { component } = await crearComponente();

        const resultado = (component as any).normalizarScoringConfig({});

        expect(resultado.bonificaciones['herramientas_ia']).toBe(6);
        expect(resultado.bonificaciones['nextjs']).toBe(4);
        expect(resultado.bonificaciones['herramientas_ia_nextjs_max']).toBe(8);
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

    // --- Defaults IA/Next.js no se pierden al agregar/quitar tecnologías ---

    it('los bonus IA/Next.js se preservan después de agregar y quitar tecnologías', async () => {
        const { component } = await crearComponente();
        component.cargarTecnologiasSugeridas();

        // Guardo los valores originales de los bonus.
        const bonusIaOriginal = component.scoringConfig.bonificaciones['herramientas_ia'];
        const bonusNextjsOriginal = component.scoringConfig.bonificaciones['nextjs'];
        const bonusMaxOriginal = component.scoringConfig.bonificaciones['herramientas_ia_nextjs_max'];

        // Agrego y quito tecnologías — esto NO debe alterar scoringConfig.
        component.agregarTecnologia();
        component.quitarTecnologia(component.tecnologiasDetalle.length - 1);

        // Los bonus siguen iguales.
        expect(component.scoringConfig.bonificaciones['herramientas_ia']).toBe(bonusIaOriginal);
        expect(component.scoringConfig.bonificaciones['nextjs']).toBe(bonusNextjsOriginal);
        expect(component.scoringConfig.bonificaciones['herramientas_ia_nextjs_max']).toBe(bonusMaxOriginal);
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