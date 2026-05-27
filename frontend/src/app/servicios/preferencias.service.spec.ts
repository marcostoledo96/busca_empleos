import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PreferenciasService } from './preferencias.service';

describe('PreferenciasService', () => {
    let servicio: PreferenciasService;
    let httpMock: HttpTestingController;
    const urlBase = 'http://localhost:3000/api/preferencias';

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        servicio = TestBed.inject(PreferenciasService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(servicio).toBeTruthy();
    });

    it('debería obtener preferencias (GET)', () => {
        const respuestaMock = {
            exito: true,
            datos: {
                id: 1,
                nombre: 'Marcos',
                nivel_experiencia: 'junior',
                perfil_profesional: 'Desarrollador Frontend',
                idioma_candidato: 'es',
                stack_tecnologico: ['Angular', 'React', 'Node.js'],
                modalidad_aceptada: 'remoto',
                zonas_preferidas: ['Buenos Aires'],
                terminos_busqueda: ['desarrollador', 'frontend'],
                reglas_exclusion: ['Java'],
                prompt_personalizado: null,
                usar_prompt_personalizado: false,
                modelo_ia: 'deepseek-v4-flash',
                fecha_creacion: '2025-01-01T00:00:00Z',
                fecha_actualizacion: '2025-01-01T00:00:00Z',
                tecnologias_detalle: [],
                roles_objetivo_detalle: [],
                scoring_config: {
                    umbral_aprobacion: 60,
                    penalizaciones: {},
                    bonificaciones: {},
                },
                preguntas_perfil_pendientes: [],
            },
        };

        servicio.obtenerPreferencias().subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.id).toBe(1);
        });

        const req = httpMock.expectOne(urlBase);
        expect(req.request.method).toBe('GET');
        req.flush(respuestaMock);
    });

    it('debería actualizar preferencias (PUT)', () => {
        const datosActualizar = {
            nivel_experiencia: 'semi-senior' as const,
            modalidad_aceptada: 'hibrido' as const,
        };

        servicio.actualizarPreferencias(datosActualizar).subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.nivel_experiencia).toBe('semi-senior');
        });

        const req = httpMock.expectOne(urlBase);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual(datosActualizar);
        req.flush({
            exito: true,
            datos: {
                id: 1,
                nombre: 'Marcos',
                nivel_experiencia: 'semi-senior',
                perfil_profesional: 'Desarrollador Frontend',
                idioma_candidato: 'es',
                stack_tecnologico: [],
                modalidad_aceptada: 'hibrido',
                zonas_preferidas: [],
                terminos_busqueda: [],
                reglas_exclusion: [],
                prompt_personalizado: null,
                usar_prompt_personalizado: false,
                modelo_ia: 'deepseek-v4-flash',
                fecha_creacion: '2025-01-01T00:00:00Z',
                fecha_actualizacion: '2025-01-02T00:00:00Z',
                tecnologias_detalle: [],
                roles_objetivo_detalle: [],
                scoring_config: {
                    umbral_aprobacion: 60,
                    penalizaciones: {},
                    bonificaciones: {},
                },
                preguntas_perfil_pendientes: [],
            },
        });
    });

    it('debería analizar CV Markdown (POST) con FormData', () => {
        const archivoMock = new File(['contenido cv'], 'cv.md', { type: 'text/markdown' });

        servicio.analizarCvMarkdown(archivoMock).subscribe((resp) => {
            expect(resp.exito).toBeTrue();
            expect(resp.datos.nombre).toBe('Marcos');
        });

        const req = httpMock.expectOne(`${urlBase}/importar-cv/analizar`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body instanceof FormData).toBeTrue();

        // Verifico que el FormData tenga el archivo correcto.
        const formData = req.request.body as FormData;
        const archivos = formData.getAll('cv') as File[];
        expect(archivos.length).toBe(1);
        expect(archivos[0].name).toBe('cv.md');

        req.flush({
            exito: true,
            datos: {
                nombre: 'Marcos',
                nivel_experiencia: 'junior',
                perfil_profesional: 'Desarrollador',
                idioma_candidato: 'es',
                modalidad_aceptada: 'remoto',
                zonas_preferidas: [],
                tecnologias_detalle: [],
                roles_objetivo_detalle: [],
                terminos_busqueda: [],
                preguntas: [],
                advertencias: [],
            },
        });
    });
});
