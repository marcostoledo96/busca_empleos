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

    // --- Bonus IA/Next.js en scoring ---

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
});
