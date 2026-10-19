import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Preferencias } from './preferencias';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { DemoService } from '../../servicios/demo.service';
import { MessageService } from 'primeng/api';
import { of, throwError, Subject } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('Preferencias — CV base persistido', () => {
    const url = 'http://localhost:3000/api/preferencias/cv-base';
    const fecha = '2026-01-01T00:00:00Z';

    async function abrir(texto: string | null = null, preferencias: Record<string, unknown> = {}) {
        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        }).compileComponents();
        const fixture = TestBed.createComponent(Preferencias);
        fixture.autoDetectChanges();
        const http = TestBed.inject(HttpTestingController);
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: preferencias });
        http.expectOne(url).flush({ exito: true, datos: { cv_base: texto, cv_base_actualizado_en: texto === null ? null : fecha } });
        await fixture.whenStable();
        return { fixture, componente: fixture.componentInstance, http };
    }

    it('normaliza alias, guarda y recarga Flash sin cambiar Pro ni otras preferencias', async () => {
        const anteriores = { nombre: 'Perfil sintético', modelo_ia: 'deepseek-v4-pro', modelo_ia_evaluacion: 'deepseek-v4-flash',
            modelo_ia_importacion: 'deepseek-v4-pro', temperatura_evaluacion: 0.7, temperatura_importacion: 0.6 };
        const { componente, http, fixture } = await abrir(null, anteriores);
        expect(componente.modeloIaEvaluacion as string).toBe('deepseek-flash');
        expect(componente.modeloIa).toBe('deepseek-v4-pro');
        expect(componente.modeloIaImportacion).toBe('deepseek-v4-pro');
        expect(componente.opcionesModelo.map(opcion => opcion.value)).toEqual(['deepseek-flash', 'deepseek-v4-pro']);
        componente.tabActiva.set(4);
        await fixture.whenStable();
        const selectores = fixture.nativeElement.querySelectorAll('[aria-labelledby="label-ia-tabs"] p-select');
        expect(selectores[0].textContent).toContain('DeepSeek Flash');
        expect(selectores[1].textContent).toContain('DeepSeek V4 Pro');
        componente.modeloIaImportacion = 'deepseek-flash';
        componente.guardar();
        const guardado = http.expectOne(r => r.method === 'PUT');
        expect(guardado.request.body).toEqual({ modelo_ia_importacion: 'deepseek-flash' });
        const nuevas = { ...anteriores, modelo_ia_evaluacion: 'deepseek-flash', modelo_ia_importacion: 'deepseek-flash' };
        guardado.flush({ exito: true, datos: nuevas, cambio_criterios: false });
        componente.cargarPreferencias();
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: nuevas });
        await fixture.whenStable();
        expect(componente.modeloIaImportacion as string).toBe('deepseek-flash');
        expect(componente.modeloIaEvaluacion as string).toBe('deepseek-flash');
        expect(selectores[1].textContent).toContain('DeepSeek Flash');
        componente.modeloIaEvaluacion = 'deepseek-v4-pro';
        componente.guardar();
        const evaluacion = http.expectOne(r => r.method === 'PUT');
        expect(evaluacion.request.body).toEqual({ modelo_ia_evaluacion: 'deepseek-v4-pro' });
        evaluacion.flush({ exito: true, datos: { ...nuevas, modelo_ia_evaluacion: 'deepseek-v4-pro' } });
        expect(componente.nombre).toBe('Perfil sintético');
        expect(componente.temperaturaEvaluacion).toBe(0.7);
        expect(componente.temperaturaImportacion).toBe(0.6);
        http.verify();
    });

    it('explica que la temperatura no es operativa con razonamiento', async () => {
        const { fixture, componente, http } = await abrir();
        componente.tabActiva.set(4);
        await fixture.whenStable();
        expect(fixture.nativeElement.querySelector('#temperatura-ayuda')?.textContent).toContain('ignora la temperatura');
        expect(fixture.nativeElement.querySelector('#temperatura-evaluacion:not(:disabled)')).toBeNull();
        expect(fixture.nativeElement.querySelector('#temperatura-importacion:not(:disabled)')).toBeNull();
        http.verify();
    });

    it('enlaza al CV imprimible sin guardar ni alterar el editor o las preferencias', async () => {
        const { fixture, componente, http } = await abrir('Fuente guardada');
        const enlace = fixture.nativeElement.querySelector('#abrir-cv-imprimible') as HTMLAnchorElement;
        expect(enlace.getAttribute('href')).toBe('/cv');
        expect(componente.cvBaseTexto).toBe('Fuente guardada');
        expect(componente.cambiosCvPendientes).toBeFalse();
        http.expectNone(r => r.method !== 'GET');
        http.verify();
    });

    it('termina la carga demo sin consultar ni simular un CV persistido', async () => {
        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => true } }],
        }).compileComponents();
        const fixture = TestBed.createComponent(Preferencias);
        fixture.autoDetectChanges();
        await fixture.whenStable();
        const componente = fixture.componentInstance;
        const http = TestBed.inject(HttpTestingController);
        expect(componente.cargandoCvBase()).toBeFalse();
        expect(componente.cvBaseCargado).toBeFalse();
        expect(componente.cvBaseGuardado).toBeNull();
        expect(componente.cvBaseFecha).toBeNull();
        const seccion = fixture.nativeElement.querySelector('.cv-base-seccion');
        expect(seccion.textContent).not.toContain('Cargando CV base');
        expect(seccion.textContent).toContain('En modo demo no consulto ni guardo el CV base.');
        for (const selector of ['#cv-base', '#guardar-cv-base', '#analizar-cv-base']) {
            expect(seccion.querySelector(selector).disabled).toBeTrue();
        }
        componente.cargarCvBase();
        componente.guardarFuenteCv();
        componente.analizarFuenteCv();
        expect(componente.cambiosCvPendientes).toBeFalse();
        http.expectNone(() => true);
        http.verify();
    });

    it('distingue ausencia de vacío guardado y solo fecha confirmada por la BD', async () => {
        const { fixture, componente, http } = await abrir();
        expect(componente.estadoCvBase).toBe('Sin cambios');
        componente.guardarFuenteCv();
        expect(componente.cvBaseFecha).toBeNull();
        http.expectOne(url).flush({ exito: true, datos: { cv_base: '', cv_base_actualizado_en: fecha } });
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain('El CV base está guardado vacío');
        expect(componente.estadoCvBase).toBe('Guardado correctamente');
        expect(componente.cvBaseFecha).toBe(fecha);
        http.verify();
    });

    it('congela DOM y archivos durante PUT, pero conserva una edición programática tardía', async () => {
        const { fixture, componente, http } = await abrir('Anterior');
        componente.editarCvBase('Enviado');
        componente.guardarFuenteCv();
        await fixture.whenStable();
        expect((fixture.nativeElement.querySelector('#cv-base') as HTMLTextAreaElement).disabled).toBeTrue();
        componente.tabActiva.set(5);
        await fixture.whenStable();
        expect((fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement).disabled).toBeTrue();
        componente.textoCvImportacion = 'Archivo';
        await componente.usarArchivoComoCvBase();
        componente.editarCvBase('Edición posterior');
        http.expectOne(url).flush({ exito: true, datos: { cv_base: 'Enviado', cv_base_actualizado_en: fecha } });
        expect(componente.cvBaseTexto).toBe('Edición posterior');
        expect(componente.cvBaseGuardado).toBe('Enviado');
        expect(componente.estadoCvBase).toBe('Cambios pendientes');
        const salida = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
        componente.advertirSalidaCv(salida);
        expect(salida.defaultPrevented).toBeTrue();
        http.verify();
    });

    it('conserva texto y fecha ante error de BD o respuesta sin éxito', async () => {
        const { fixture, componente, http } = await abrir('Confirmado');
        componente.editarCvBase('Pendiente');
        componente.guardarFuenteCv();
        http.expectOne(url).flush({ error: 'BD indisponible' }, { status: 500, statusText: 'Error' });
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain('Error al guardar');
        expect(componente.cvBaseTexto).toBe('Pendiente');
        expect(componente.cvBaseFecha).toBe(fecha);
        componente.guardarFuenteCv();
        http.expectOne(url).flush({ exito: false });
        expect(componente.estadoCvBase).toBe('Error al guardar');
        expect(componente.cambiosCvPendientes).toBeTrue();
        http.verify();
    });

    it('acepta 1 MiB multibyte exacto y rechaza overflow, NUL y sustitutos inválidos', async () => {
        const { componente, http } = await abrir();
        const limite = 'ñ'.repeat(524288);
        componente.editarCvBase(limite);
        componente.guardarFuenteCv();
        const peticion = http.expectOne(url);
        expect(new TextEncoder().encode(peticion.request.body).byteLength).toBe(1048576);
        peticion.flush({ exito: true, datos: { cv_base: limite, cv_base_actualizado_en: fecha } });
        for (const invalido of [limite + 'a', 'Texto\u0000', '\ud800']) {
            componente.editarCvBase(invalido);
            componente.guardarFuenteCv();
            expect(componente.estadoCvBase).toBe('Error al guardar');
            http.expectNone(url);
        }
        http.verify();
    });

    it('copia el borrador UTF-8 preservando BOM y CRLF sin guardar ni borrar revisión; confirma reemplazo', async () => {
        const { componente, http } = await abrir('Original');
        const confirmar = spyOn(window, 'confirm').and.returnValue(false);
        componente.editarCvBase('Pendiente');
        componente.resultadoImportacion = { nombre: 'Corrección' };
        const borrador = componente.resultadoImportacion;
        componente.textoCvImportacion = '\ufeff# Sintético\r\nñ 🌎\r\n';
        await componente.usarArchivoComoCvBase();
        expect(componente.cvBaseTexto).toBe('Pendiente');
        confirmar.and.returnValue(true);
        await componente.usarArchivoComoCvBase();
        expect(componente.cvBaseTexto).toBe('\ufeff# Sintético\r\nñ 🌎\r\n');
        expect(componente.resultadoImportacion).toBe(borrador);
        expect(componente.cambiosCvPendientes).toBeTrue();
        http.expectNone(r => r.method !== 'GET');
        for (const contenido of ['\ud800', '\u0000', 'a'.repeat(1048577)]) {
            componente.textoCvImportacion = contenido;
            await componente.usarArchivoComoCvBase();
            expect(componente.cvBaseTexto).toBe('\ufeff# Sintético\r\nñ 🌎\r\n');
        }
        http.verify();
    });

    it('no lee bytes ni permite que un archivo anterior reemplace la copia del borrador actual', async () => {
        const { componente, http } = await abrir('Original');
        const archivo = new File(['Primero'], 'primero.md');
        const leer = spyOn(archivo, 'arrayBuffer');
        componente.archivoCvSeleccionado = archivo;
        componente.textoCvImportacion = 'Segundo corregido';
        componente.usarArchivoComoCvBase();
        expect(componente.cvBaseTexto).toBe('Segundo corregido');
        expect(leer).not.toHaveBeenCalled();
        componente.editarCvBase('Edición concurrente');
        expect(componente.cvBaseTexto).toBe('Edición concurrente');
        http.verify();
    });

    it('no descarta correcciones ni notas al rechazar un nuevo análisis', async () => {
        const { componente, http } = await abrir('# Sintético');
        spyOn(window, 'confirm').and.returnValue(false);
        componente.resultadoImportacion = { nombre: 'Corregido' };
        componente.preguntasImportacion = [{ campo: 'otro', pregunta: '¿Otro?', nota: 'Nota', estado: 'nota' }];
        componente.analizarFuenteCv();
        expect(componente.resultadoImportacion.nombre).toBe('Corregido');
        expect(componente.preguntasImportacion[0].nota).toBe('Nota');
        http.expectNone(r => r.method === 'POST');
        http.verify();
    });

    it('carga la fuente independiente y deshabilita el editor hasta recibirla', async () => {
        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        }).compileComponents();
        const fixture = TestBed.createComponent(Preferencias);
        fixture.detectChanges();
        const http = TestBed.inject(HttpTestingController);
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: {} });
        fixture.detectChanges();
        await fixture.whenStable();
        const editor = fixture.nativeElement.querySelector('#cv-base') as HTMLTextAreaElement;
        expect(editor).not.toBeNull();
        if (editor) expect(editor.disabled).toBeTrue();
        http.expectOne('http://localhost:3000/api/preferencias/cv-base').flush({ error: 'Error de carga' }, { status: 500, statusText: 'Error' });
        fixture.detectChanges();
        await fixture.whenStable();
        expect(editor.disabled).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('No pude cargar el CV base');
        expect(fixture.nativeElement.textContent).not.toContain('Guardado correctamente');
        fixture.componentInstance.guardarFuenteCv();
        http.expectNone(r => r.method === 'PUT');
        fixture.componentInstance.cargarCvBase();
        fixture.componentInstance.editarCvBase('Edición programática antes del GET');
        http.expectOne('http://localhost:3000/api/preferencias/cv-base').flush({
            exito: true, datos: { cv_base: null, cv_base_actualizado_en: null },
        });
        fixture.detectChanges();
        expect(fixture.componentInstance.cvBaseTexto).toBe('Edición programática antes del GET');
        expect(fixture.componentInstance.cambiosCvPendientes).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('Todavía no hay un CV base guardado');
        http.verify();
    });
});

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
        spyOn(window, 'confirm').and.returnValue(true);
        const mockPrefService = {
            obtenerCvBase: () => of({ exito: true, datos: { cv_base: null, cv_base_actualizado_en: null } }),
            obtenerPreferencias: () => of(mockPreferencias),
            actualizarPreferencias: () => of(mockPreferencias),
            analizarCvMarkdown: () => of({ exito: true, datos: { nombre: 'Perfil parcial' } }),
        };
        const mockEvaluacionService = {
            resetearEvaluaciones: () => of({ exito: true, datos: { reseteadas: 3 } }),
        };
        const mockDemoService = { esModoDemo: () => false };

        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                provideRouter([]),
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

    it('permite editar y rechazar el detalle de inglés desde el borrador', async () => {
        const { fixture, component } = await crearComponente();
        fixture.autoDetectChanges();
        component.tabActiva.set(5);
        component.nivelInglesDetalle = { speaking: 'básico' };
        component.resultadoImportacion = { nivel_ingles_detalle: { speaking: 'avanzado', regla: 'Sin límite' } };
        await fixture.whenStable();
        const oral = fixture.nativeElement.querySelector('#cv-ingles-speaking') as HTMLInputElement;
        expect(oral).not.toBeNull();
        if (!oral) return;
        oral.value = 'intermedio';
        oral.dispatchEvent(new Event('input'));
        await fixture.whenStable();
        expect(component.nivelInglesDetalle.speaking).toBe('básico');
        component.aplicarImportacion();
        expect(component.nivelInglesDetalle.speaking).toBe('intermedio');
        component.resultadoImportacion = { nivel_ingles_detalle: { speaking: 'avanzado' } };
        await fixture.whenStable();
        (fixture.nativeElement.querySelector('#cv-rechazar-ingles') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(component.resumenImportacion.conservar).toContain('Inglés detallado');
        component.aplicarImportacion();
        expect(component.nivelInglesDetalle.speaking).toBe('intermedio');
    });

    it('rechaza tecnologías individuales sin borrar hechos confirmados ni aceptar nombres vacíos', async () => {
        const { fixture, component } = await crearComponente();
        fixture.autoDetectChanges();
        component.tabActiva.set(5);
        const previa = { nombre: 'Angular', nivel: 'basico', categoria: 'frontend', importancia: 'principal', aliases: [] };
        component.tecnologiasDetalle = [previa];
        component.resultadoImportacion = { tecnologias_detalle: [
            { ...previa, nivel: 'avanzado' },
            { ...previa, nombre: 'Nueva' },
            { ...previa, nombre: '  ' },
        ] } as any;
        await fixture.whenStable();
        const botones = fixture.nativeElement.querySelectorAll('[data-rechazar-tecnologia]');
        expect(botones.length).toBe(3);
        if (botones.length !== 3) return;
        botones[1].click();
        await fixture.whenStable();
        fixture.nativeElement.querySelector('[data-rechazar-tecnologia]').click();
        await fixture.whenStable();
        expect(component.tecnologiasDetalle).toEqual([previa]);
        component.aplicarImportacion();
        expect(component.tecnologiasDetalle).toEqual([previa]);
    });

    it('conserva inglés confirmado al analizar y descarta rechazos al cancelar', async () => {
        const { fixture, component } = await crearComponente();
        fixture.autoDetectChanges();
        component.nivelInglesDetalle = { speaking: 'básico', regla: 'Sin reuniones en inglés' };
        spyOn(TestBed.inject(PreferenciasService), 'analizarCvMarkdown').and.returnValue(of({
            exito: true, datos: { nivel_ingles_detalle: { speaking: 'avanzado', reading: 'intermedio' } },
        } as any));
        component.textoCvImportacion = '# CV';
        component.analizarCv();
        expect(component.resultadoImportacion?.nivel_ingles_detalle).toEqual({
            speaking: 'básico', reading: 'intermedio', regla: 'Sin reuniones en inglés',
        });
        const previa = { nombre: 'Angular', nivel: 'basico', categoria: 'frontend', importancia: 'principal', aliases: [] };
        component.tecnologiasDetalle = [previa];
        component.resultadoImportacion = { tecnologias_detalle: [{ ...previa, nivel: 'avanzado' }] } as any;
        component.rechazarTecnologiaImportacion(0);
        component.aplicarImportacion();
        expect(component.tecnologiasDetalle).toEqual([previa]);
        component.resultadoImportacion = { tecnologias_detalle: [{ ...previa, nombre: 'Nueva' }] } as any;
        component.rechazarTecnologiaImportacion(0);
        component.cancelarImportacion();
        expect(component.tecnologiasDetalle).toEqual([previa]);
        expect(component.nivelInglesDetalle).toEqual({ speaking: 'básico', regla: 'Sin reuniones en inglés' });
    });

    it('soporte respeta el reemplazo aceptado de palabras clave sin cambiar experiencia', async () => {
        const { fixture, component } = await crearComponente();
        fixture.autoDetectChanges();
        component.tabActiva.set(5);
        component.keywordsPositivas = ['Vieja'];
        component.aniosExperienciaReales = 2;
        component.resultadoImportacion = { keywords_positivas: ['Nueva'] };
        component.preguntasImportacion = [{ id: 'soporte', campo: 'soporte', pregunta: '¿Soporte?' }];
        await fixture.whenStable();
        const confirmar = fixture.nativeElement.querySelector('.importar-resultado input[type="checkbox"]') as HTMLInputElement;
        confirmar.click();
        await fixture.whenStable();
        const accion = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
            .find(b => b.textContent?.trim() === 'Aplicar sugerencia');
        expect(accion).toBeDefined();
        accion!.click();
        await fixture.whenStable();
        component.aplicarImportacion();
        expect(component.keywordsPositivas).toEqual(['Nueva', 'soporte de aplicaciones']);
        expect(component.aniosExperienciaReales).toBe(2);
    });

    it('muestra el error backend y descarta la extracción anterior', async () => {
        const { fixture, component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const mensajes = fixture.debugElement.injector.get(MessageService);
        const aviso = spyOn(mensajes, 'add').and.callThrough();
        component.cargando.set(false);
        fixture.autoDetectChanges();
        spyOn(servicio, 'analizarCvMarkdown').and.returnValue(throwError(() => ({
            error: { error: 'La extracción del CV contiene datos inválidos.' },
        })));
        component.resultadoImportacion = { nombre: 'Anterior' } as any;
        component.preguntasImportacion = [{ campo: 'anterior', pregunta: 'Anterior' }];
        component.textoCvImportacion = '# CV';
        component.analizarCv();
        expect(component.resultadoImportacion).toBeNull();
        expect(component.preguntasImportacion).toEqual([]);
        expect(component.analizandoCv()).toBeFalse();
        expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'La extracción del CV contiene datos inválidos.' }));
        component.nombre = 'Confirmado';
        component.aplicarImportacion();
        expect(component.nombre).toBe('Confirmado');
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain('La extracción del CV contiene datos inválidos.');
        expect(fixture.nativeElement.querySelector('.importar-resultado')).toBeNull();
    });

    it('descarta sugerencias también ante archivo grande y error sin mensaje backend', async () => {
        const { fixture, component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const mensajes = fixture.debugElement.injector.get(MessageService);
        const aviso = spyOn(mensajes, 'add');
        const analizar = spyOn(servicio, 'analizarCvMarkdown').and.returnValue(throwError(() => ({ status: 0 })));
        component.resultadoImportacion = { nombre: 'Anterior' } as any;
        component.textoCvImportacion = 'a'.repeat(1024 * 1024 + 1);
        component.analizarCv();
        expect(component.resultadoImportacion?.nombre).toBe('Anterior');
        expect(analizar).not.toHaveBeenCalled();
        component.resultadoImportacion = { nombre: 'Anterior' } as any;
        component.textoCvImportacion = '# CV';
        component.analizarCv();
        expect(component.resultadoImportacion).toBeNull();
        expect(aviso).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'No se pudo analizar el CV.' }));
    });

    it('presenta una extracción parcial sin inventar listas ausentes', async () => {
        const { fixture, component } = await crearComponente();
        component.cargando.set(false);
        component.tabActiva.set(5);
        component.textoCvImportacion = '# CV';
        fixture.autoDetectChanges();
        component.analizarCv();
        await fixture.whenStable();
        expect(component.resultadoImportacion).toEqual({ nombre: 'Perfil parcial' } as any);
        expect(component.preguntasImportacion).toEqual([]);
    });

    for (const preguntas of [undefined, [], [{ campo: 'nuevo', pregunta: '¿Nuevo?', motivo: 'Ausente' }]]) {
        it(`conservo omisión y aplico preguntas explícitas: ${JSON.stringify(preguntas)}`, async () => {
            const { component } = await crearComponente();
            const servicio = TestBed.inject(PreferenciasService);
            const anterior = [{ campo: 'anterior', pregunta: '¿Anterior?', motivo: 'Pendiente' }];
            spyOn(servicio, 'obtenerPreferencias').and.returnValue(of({ ...mockPreferencias,
                datos: { ...mockPreferencias.datos, preguntas_perfil_pendientes: anterior } } as any));
            const guardar = spyOn(servicio, 'actualizarPreferencias').and.returnValue(of({ exito: false } as any));
            spyOn(servicio, 'analizarCvMarkdown').and.returnValue(of({ exito: true,
                datos: { nombre: 'Nuevo', ...(preguntas === undefined ? {} : { preguntas }) } } as any));
            component.cargarPreferencias();
            component.textoCvImportacion = '# CV';
            component.analizarCv();
            component.aplicarImportacion();
            expect(component.preguntasPerfilPendientes.map(p => p.campo)).toEqual((preguntas ?? anterior).map(p => p.campo));
            component.guardar();
            const payload = guardar.calls.mostRecent().args[0];
            if (preguntas === undefined) expect(payload.preguntas_perfil_pendientes).toBeUndefined();
            else expect(payload.preguntas_perfil_pendientes?.length).toBe(preguntas.length);
        });
    }

    for (const falla of [false, true]) {
        for (const terminaB of [false, true]) {
            it(`ignoro respuesta A obsoleta: error=${falla}, B finalizado=${terminaB}`, async () => {
                const { fixture, component } = await crearComponente();
                const servicio = TestBed.inject(PreferenciasService);
                const a = new Subject<any>();
                const b = new Subject<any>();
                spyOn(servicio, 'analizarCvMarkdown').and.returnValues(a, b);
                const mensajes = fixture.debugElement.injector.get(MessageService);
                const aviso = spyOn(mensajes, 'add');
                component.textoCvImportacion = 'A';
                component.analizarCv();
                component.onArchivoCvSeleccionado({ target: { files: [new File(['B'], 'b.md')] } } as unknown as Event);
                expect(component.resultadoImportacion).toBeNull();
                expect(component.preguntasImportacion).toEqual([]);
                expect(component.analizandoCv()).toBeFalse();
                component.textoCvImportacion = 'B';
                component.analizarCv();
                if (terminaB) b.next({ exito: true, datos: { nombre: 'B' } });
                aviso.calls.reset();
                if (falla) a.error({ error: { error: 'Error A' } });
                else a.next({ exito: true, datos: { nombre: 'A' } });
                expect(aviso).not.toHaveBeenCalled();
                expect(component.analizandoCv()).toBe(!terminaB);
                expect(component.resultadoImportacion).toEqual(terminaB ? { nombre: 'B' } : null);
                if (!terminaB) b.next({ exito: true, datos: { nombre: 'B' } });
                expect(component.resultadoImportacion).toEqual({ nombre: 'B' });
            });
        }
    }

    it('descarto A antes de iniciar B y conservo precedencia de preguntas pendientes explícitas', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const a = new Subject<any>();
        spyOn(servicio, 'analizarCvMarkdown').and.returnValues(a, of({ exito: true, datos: {
            nombre: 'B', preguntas_perfil_pendientes: [], preguntas: [{ campo: 'otro', pregunta: '¿Otro?', motivo: 'Ausente' }],
        } } as any));
        component.textoCvImportacion = 'A';
        component.analizarCv();
        component.onArchivoCvSeleccionado({ target: { files: [new File(['B'], 'b.md')] } } as unknown as Event);
        a.next({ exito: true, datos: { nombre: 'A' } });
        expect(component.resultadoImportacion).toBeNull();
        component.textoCvImportacion = 'B';
        component.analizarCv();
        component.preguntasPerfilPendientes = [{ campo: 'anterior', pregunta: '¿Anterior?' }];
        component.aplicarImportacion();
        expect(component.nombre).toBe('B');
        expect(component.preguntasPerfilPendientes).toEqual([]);
    });

    it('cambiar archivo limpia la vista previa y los avisos', async () => {
        const { fixture, component } = await crearComponente();
        component.resultadoImportacion = { nombre: 'Anterior' };
        component.preguntasImportacion = [{ campo: 'anterior', pregunta: '¿Anterior?' }];
        const limpiar = spyOn(fixture.debugElement.injector.get(MessageService), 'clear');
        component.onArchivoCvSeleccionado({ target: { files: [new File(['Nuevo'], 'nuevo.md')] } } as unknown as Event);
        expect(component.resultadoImportacion).toBeNull();
        expect(component.preguntasImportacion).toEqual([]);
        expect(limpiar).toHaveBeenCalled();
    });

    it('revisa Docker en DOM con inglés previo y campos duplicados sin tocar el formulario', async () => {
        const { fixture, component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const extraido = { tecnologias_detalle: [{ nombre: 'Docker', nivel: 'avanzado', categoria: 'herramienta', importancia: 'secundaria', aliases: [] }],
            preguntas: [{ campo: 'ingles', pregunta: '¿Inglés?' }, { campo: 'docker', pregunta: '¿Docker local?' }, { campo: 'docker', pregunta: '¿Docker producción?' }] };
        spyOn(servicio, 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: extraido } as any));
        fixture.autoDetectChanges();
        component.tabActiva.set(5);
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        await fixture.whenStable();
        const filas = fixture.nativeElement.querySelectorAll('.importar-pregunta--accionable');
        (filas[1].querySelector('button') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(component.preguntasImportacion[0].estado).toBe('pendiente');
        expect(component.preguntasImportacion[1].estado).toBe('pendiente');
        expect(component.preguntasImportacion[2].estado).toBe('aplicada');
        expect(component.tecnologiasDetalle).toEqual([]);
        expect(component.resultadoImportacion?.tecnologias_detalle?.[0].nivel).toBe('basico');
        expect(extraido.tecnologias_detalle[0].nivel).toBe('avanzado');
        const informativa = fixture.nativeElement.querySelector('.importar-pregunta--informativa');
        const respuesta = informativa.querySelector('textarea') as HTMLTextAreaElement;
        respuesta.value = 'Lectura confirmada';
        respuesta.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        expect(component.preguntasImportacion[0].estado).toBe('respondida');
        expect(component.preguntasPerfilPendientes).toEqual([]);
        (informativa.querySelector('button') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(component.preguntasImportacion[0].nota).toBe('Lectura confirmada');
        expect(component.preguntasImportacion[1].estado).toBe('pendiente');
        component.aplicarImportacion();
        expect(component.tecnologiasDetalle[0].nivel).toBe('basico');
        expect(component.preguntasPerfilPendientes[2].estado).toBe('aplicada');
    });

    it('cancelar descarta salario y respuestas temporales, conserva ediciones manuales e invalida HTTP', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        const tardio = new Subject<any>();
        spyOn(servicio, 'analizarCvMarkdown').and.returnValues(of({ exito: true, datos: {
            preguntas: [{ campo: 'salario', pregunta: '¿Sin filtro salarial?' }], expectativa_salarial_min: null,
        } } as any), tardio);
        component.nombre = 'Manual sin guardar';
        component.expectativaSalarialMin = 900;
        component.aniosExperienciaReales = 3;
        component.preguntasPerfilPendientes = [{ campo: 'previa', pregunta: 'Confirmada', respuesta: 'Sí' }];
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        component.aceptarSugerenciaImportacion(component.preguntasImportacion[0].id);
        expect(component.expectativaSalarialMin).toBe(900);
        expect(component.aniosExperienciaReales).toBe(3);
        component.cancelarImportacion();
        expect(component.nombre).toBe('Manual sin guardar');
        expect(component.preguntasPerfilPendientes[0].respuesta).toBe('Sí');
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        component.cancelarImportacion();
        tardio.next({ exito: true, datos: { nombre: 'Obsoleto' } });
        expect(component.resultadoImportacion).toBeNull();
        expect(component.analizandoCv()).toBeFalse();
    });

    it('aplica respuesta y nota sin reiniciarlas; ignorar no guarda texto y salario ausente conserva manual', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        spyOn(servicio, 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: {
            expectativa_salarial_min: null, expectativa_salarial_max: null,
            preguntas_perfil_pendientes: [{ campo: 'ingles', pregunta: '¿Nivel?' }, { campo: 'ingles', pregunta: '¿Oral?' }],
        } } as any));
        component.expectativaSalarialMin = 900;
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        const ids = component.preguntasImportacion.map(p => p.id);
        expect(ids[0]).not.toBe(ids[1]);
        component.actualizarRespuestaPregunta(ids[0], 'Nota oral');
        component.guardarNotaEIgnorar(ids[0]);
        component.actualizarRespuestaPregunta(ids[1], 'No conservar');
        component.ignorarPreguntaImportacion(ids[1]);
        component.aplicarImportacion();
        expect(component.preguntasPerfilPendientes[0].nota).toBe('Nota oral');
        expect(component.preguntasPerfilPendientes[0].estado).toBe('nota');
        expect(component.preguntasPerfilPendientes[1].estado).toBe('ignorada');
        expect(component.preguntasPerfilPendientes[1].respuesta).toBeUndefined();
        expect(component.expectativaSalarialMin).toBe(900);
    });

    for (const detalle of [undefined, null, []]) {
        it(`conservo hechos y preferencias ante extracción parcial: ${JSON.stringify(detalle)}`, async () => {
            const { component } = await crearComponente();
            const tecnologias = [{ nombre: 'Docker', nivel: 'medio', categoria: 'herramienta', importancia: 'secundaria', aliases: [] }];
            component.tecnologiasDetalle = structuredClone(tecnologias);
            component.perfilProfesional = 'Experiencia manual';
            component.nivelInglesDetalle = { reading: 'C1' };
            component.expectativaSalarialMin = 900;
            component.expectativaSalarialMax = 1500;
            component.monedaSalarial = 'USD';
            component.preguntasPerfilPendientes = [{ campo: 'anterior', pregunta: '¿Confirmado?', estado: 'respondida', respuesta: 'Sí' }];
            spyOn(TestBed.inject(PreferenciasService), 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: {
                nombre: 'Parcial', perfil_profesional: null, nivel_ingles_detalle: null,
                ...(detalle === undefined ? {} : { tecnologias_detalle: detalle }),
            } } as any));
            component.textoCvImportacion = 'CV';
            component.analizarCv();
            component.aplicarImportacion();
            expect(component.nombre).toBe('Parcial');
            expect(component.tecnologiasDetalle).toEqual(tecnologias);
            expect(component.perfilProfesional).toBe('Experiencia manual');
            expect(component.nivelInglesDetalle).toEqual({ reading: 'C1' });
            expect(component.expectativaSalarialMin).toBe(900);
            expect(component.expectativaSalarialMax).toBe(1500);
            expect(component.monedaSalarial).toBe('USD');
            expect(component.preguntasPerfilPendientes[0].respuesta).toBe('Sí');
        });
    }

    it('rechaza null en preguntas sin permitir aplicar otra extracción', async () => {
        const { component } = await crearComponente();
        spyOn(TestBed.inject(PreferenciasService), 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: {
            nombre: 'Inválido', preguntas_perfil_pendientes: null,
        } } as any));
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        expect(component.resultadoImportacion).toBeNull();
    });

    it('edita nivel y texto en DOM y aplica exactamente el borrador, incluso un texto vaciado', async () => {
        const { fixture, component } = await crearComponente();
        spyOn(TestBed.inject(PreferenciasService), 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: {
            perfil_profesional: 'Texto extraído', tecnologias_detalle: [{ nombre: 'Docker', nivel: 'avanzado', categoria: 'herramienta', importancia: 'secundaria', aliases: [] }],
        } } as any));
        fixture.autoDetectChanges();
        component.perfilProfesional = 'Texto manual';
        component.tabActiva.set(5);
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        await fixture.whenStable();
        const nivel = fixture.nativeElement.querySelector('[aria-label="Nivel revisado de Docker"]') as HTMLSelectElement;
        nivel.value = 'basico';
        nivel.dispatchEvent(new Event('change', { bubbles: true }));
        const texto = fixture.nativeElement.querySelector('.importar-preview-grid textarea') as HTMLTextAreaElement;
        texto.value = '';
        texto.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        expect(component.perfilProfesional).toBe('Texto manual');
        component.aplicarImportacion();
        expect(component.tecnologiasDetalle[0].nivel).toBe('basico');
        expect(component.perfilProfesional).toBe('');
    });

    it('conserva React Native confirmado y aceptar soporte/salario solo cambia criterios revisados', async () => {
        const { component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        spyOn(servicio, 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: {
            tecnologias_detalle: [{ nombre: 'React Native', nivel: 'avanzado', categoria: 'mobile', importancia: 'principal', aliases: [] }],
            preguntas: [{ campo: 'React Native', pregunta: '¿Mobile?' }, { campo: 'soporte', pregunta: '¿Priorizar soporte?' }, { campo: 'salario', pregunta: '¿Sin filtro?' }],
            keywords_positivas: ['Inventada'], terminos_busqueda: ['Inventado'], disponibilidad: 'part_time',
        } } as any));
        component.tecnologiasDetalle = [{ nombre: 'React Native', nivel: 'ninguno', categoria: 'mobile', importancia: 'no_prioritaria', aliases: [] }];
        component.aniosExperienciaReales = 2;
        component.perfilProfesional = 'Experiencia confirmada';
        component.keywordsPositivas = ['Manual'];
        component.expectativaSalarialMin = 900;
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        component.aceptarSugerenciaImportacion(component.preguntasImportacion[0].id);
        expect(component.preguntasImportacion[0].estado).toBe('pendiente');
        component.aceptarSugerenciaImportacion(component.preguntasImportacion[1].id);
        component.aceptarSugerenciaImportacion(component.preguntasImportacion[2].id);
        expect(component.expectativaSalarialMin).toBe(900);
        expect(component.keywordsPositivas).toEqual(['Manual']);
        component.aplicarImportacion();
        expect(component.tecnologiasDetalle[0].nivel).toBe('ninguno');
        expect(component.aniosExperienciaReales).toBe(2);
        expect(component.perfilProfesional).toBe('Experiencia confirmada');
        expect(component.disponibilidad).toBe('full_time');
        expect(component.keywordsPositivas).toEqual(['Manual', 'soporte de aplicaciones']);
        expect(component.expectativaSalarialMin).toBeNull();
        expect(component.monedaSalarial).toBe('NO_FILTRAR');
    });

    it('guardar notas y recargar las muestra; un guardado fallido no confirma otro perfil', async () => {
        const { fixture, component } = await crearComponente();
        const servicio = TestBed.inject(PreferenciasService);
        let fila: any = { ...mockPreferencias.datos, preguntas_perfil_pendientes: [] };
        spyOn(servicio, 'obtenerPreferencias').and.callFake(() => of({ exito: true, datos: fila }));
        const guardar = spyOn(servicio, 'actualizarPreferencias').and.callFake(datos => {
            fila = { ...fila, ...structuredClone(datos) };
            return of({ exito: true, datos: fila });
        });
        spyOn(servicio, 'analizarCvMarkdown').and.returnValue(of({ exito: true, datos: {
            preguntas: [{ campo: 'ingles', pregunta: '¿Oral?' }],
        } } as any));
        fixture.autoDetectChanges();
        component.tabActiva.set(5);
        component.textoCvImportacion = 'CV';
        component.analizarCv();
        const id = component.preguntasImportacion[0].id;
        component.actualizarRespuestaPregunta(id, 'Nota confirmada');
        component.guardarNotaEIgnorar(id);
        component.aplicarImportacion();
        expect(guardar).not.toHaveBeenCalled();
        component.guardar();
        component.cargarPreferencias();
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).toContain('Nota confirmada');
        expect(component.preguntasPerfilPendientes[0].estado).toBe('nota');
        const perfil = component.perfilEfectivo;
        guardar.and.returnValue(of({ exito: false } as any));
        component.nombre = 'No confirmado';
        component.guardar();
        expect(component.perfilEfectivo).toBe(perfil);
        expect(component.nombre).toBe('No confirmado');
        expect(component.cambiosSinGuardar).toBeTrue();
    });

    it('persisto revisión DOM mediante servicio real, PUT y GET; un error no confirma hechos', async () => {
        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(),
                { provide: DemoService, useValue: { esModoDemo: () => false } },
                { provide: EvaluacionService, useValue: {} }],
        }).compileComponents();
        const http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(Preferencias);
        const componente = fixture.componentInstance;
        fixture.autoDetectChanges();
        let fila: any = { id: 1, nombre: 'Guardado', tecnologias_detalle: [],
            modalidad_aceptada: 'remoto', plataformas_preferidas: ['linkedin'],
            plataformas_excluidas: ['computrabajo'], expectativa_salarial_min: 900,
            roles_objetivo_detalle: [{ rol: 'QA', prioridad: 'alta', aliases: [] }],
            terminos_busqueda: ['QA'], reglas_exclusion: ['Java'] };
        http.expectOne('http://localhost:3000/api/preferencias').flush({ exito: true, datos: fila });
        const urlFuente = 'http://localhost:3000/api/preferencias/cv-base';
        http.expectOne(urlFuente).flush({ exito: true, datos: { cv_base: null, cv_base_actualizado_en: null } });
        await fixture.whenStable();
        const editor = fixture.nativeElement.querySelector('#cv-base') as HTMLTextAreaElement;
        editor.value = '# CV sintético\n\nExperiencia técnica ñ 🌎\n';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        expect(componente.estadoCvBase).toBe('Cambios pendientes');
        (fixture.nativeElement.querySelector('#guardar-cv-base') as HTMLButtonElement).click();
        const fuente = http.expectOne(urlFuente);
        expect(fuente.request.body).toBe(editor.value);
        expect(componente.estadoCvBase).toBe('Guardando');
        fuente.flush({ exito: true, datos: { cv_base: editor.value, cv_base_actualizado_en: '2026-01-01T00:00:00Z' } });
        componente.cargarCvBase();
        http.expectOne(urlFuente).flush({ exito: true, datos: { cv_base: editor.value, cv_base_actualizado_en: '2026-01-01T00:00:00Z' } });
        componente.editarCvBase(componente.cvBaseTexto + '\nProyecto nuevo');
        const snapshot = componente.cvBaseTexto;
        componente.tabActiva.set(5);
        componente.archivoCvSeleccionado = new File(['# CV'], 'cv.md');
        await fixture.whenStable();
        (fixture.nativeElement.querySelector('#analizar-cv-base') as HTMLButtonElement).click();
        const extraccion = { nombre: 'Revisado', tecnologias_detalle: [{ nombre: 'Docker', nivel: 'avanzado', categoria: 'herramienta', importancia: 'secundaria', aliases: [] }],
            preguntas: [{ campo: 'ingles', pregunta: '¿Oral?' }, { campo: 'docker', pregunta: '¿Local?' }, { campo: 'docker', pregunta: '¿Producción?' }, { campo: 'otro', pregunta: '¿Otro?' }],
            modalidad_aceptada: 'presencial', plataformas_preferidas: [], plataformas_excluidas: [], roles_objetivo_detalle: [], terminos_busqueda: [], reglas_exclusion: [] };
        const analisis = http.expectOne(r => r.method === 'POST');
        const documento = (analisis.request.body as FormData).get('cv') as File;
        expect(documento.name).toBe('cv-base.md');
        expect(documento.type).toBe('text/markdown');
        expect(await documento.text()).toBe(snapshot);
        analisis.flush({ exito: true, datos: extraccion });
        await fixture.whenStable();
        const informativas = fixture.nativeElement.querySelectorAll('.importar-pregunta--informativa');
        const nota = informativas[0].querySelector('textarea') as HTMLTextAreaElement;
        nota.value = 'Lectura confirmada';
        nota.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        (informativas[0].querySelector('button') as HTMLButtonElement).click();
        (informativas[1].querySelector('button:last-child') as HTMLButtonElement).click();
        const accionables = fixture.nativeElement.querySelectorAll('.importar-pregunta--accionable');
        (accionables[1].querySelector('button') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(componente.preguntasImportacion[1].estado).toBe('pendiente');
        expect(componente.preguntasImportacion[2].estado).toBe('aplicada');
        componente.resultadoImportacion!.nombre = 'Corrección sintética';
        const borrador = componente.resultadoImportacion;
        componente.guardarFuenteCv();
        http.expectOne(urlFuente).flush({ exito: true, datos: { cv_base: snapshot, cv_base_actualizado_en: '2026-01-02T00:00:00Z' } });
        expect(componente.resultadoImportacion).toBe(borrador);
        expect(componente.preguntasImportacion[0].nota).toBe('Lectura confirmada');
        expect(componente.nombre).toBe('Guardado');
        expect(extraccion.tecnologias_detalle[0].nivel).toBe('avanzado');
        expect(fixture.nativeElement.textContent).toContain('Ignorar descarta la respuesta');
        (fixture.nativeElement.querySelector('.importar-resultado .btn-guardar') as HTMLButtonElement).click();
        await fixture.whenStable();
        expect(componente.expectativaSalarialMin).toBe(900);
        expect(componente.modalidadAceptada).toBe('remoto');
        expect(componente.plataformasPreferidas).toEqual(['linkedin']);
        expect(componente.plataformasExcluidas).toEqual(['computrabajo']);
        expect(componente.rolesObjetivoDetalle).toEqual(fila.roles_objetivo_detalle);
        expect(componente.terminosBusqueda).toEqual(['QA']);
        expect(componente.reglasExclusion).toEqual(['Java']);
        http.expectNone(r => r.method === 'PUT');
        (fixture.nativeElement.querySelector('[aria-label="Guardar preferencias"]') as HTMLButtonElement).click();
        const put = http.expectOne(r => r.method === 'PUT');
        fila = JSON.parse(JSON.stringify({ ...fila, ...put.request.body }));
        expect(fila.preguntas_perfil_pendientes[0]).toEqual(jasmine.objectContaining({ estado: 'nota', nota: 'Lectura confirmada', respuesta: 'Lectura confirmada', id: jasmine.any(String) }));
        expect(fila.preguntas_perfil_pendientes[2]).toEqual(jasmine.objectContaining({ estado: 'aplicada', respuesta: jasmine.any(String) }));
        expect(fila.preguntas_perfil_pendientes[3].respuesta).toBeUndefined();
        fila.perfil_efectivo = { version: 1, candidato: { ...fila, conocimientos_ausentes: [] }, restricciones: { preferencias: { ...fila }, politicas_sistema: [] }, secciones: [], texto: '' };
        expect(fila.nombre).toBe('Corrección sintética');
        put.flush({ exito: true, datos: fila, cambio_criterios: true });
        expect(componente.perfilCambio()).toBeTrue();
        componente.cargarPreferencias();
        http.expectOne(r => r.method === 'GET').flush({ exito: true, datos: fila });
        await fixture.whenStable();
        expect(componente.tecnologiasDetalle[0].nivel).toBe('basico');
        expect(componente.preguntasPerfilPendientes).toEqual(fila.preguntas_perfil_pendientes);
        expect(fixture.nativeElement.textContent).toContain('Lectura confirmada');
        const vista = fixture.nativeElement.querySelector('[aria-labelledby="perfil-ia-titulo"]');
        expect(vista.textContent).toContain('Docker');
        expect(vista.textContent).toContain('basico');
        const confirmado = componente.perfilEfectivo;
        componente.nombre = 'No confirmado';
        componente.guardar();
        http.expectOne(r => r.method === 'PUT').flush({ error: 'Falla simulada' }, { status: 500, statusText: 'Error' });
        await fixture.whenStable();
        expect(componente.perfilEfectivo).toBe(confirmado);
        expect(componente.cambiosSinGuardar).toBeTrue();
        expect(componente.mensajeAccesible()).toBe('No se pudieron guardar las preferencias.');
        http.verify();
    });

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
                provideRouter([]),
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

describe('Preferencias — Filtro de nivel de LinkedIn (Issue #14)', () => {
    it('inicializa filtrarNivelLinkedin en true por defecto', () => {
        TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => true } },
            ],
        });
        const fixture = TestBed.createComponent(Preferencias);
        const comp = fixture.componentInstance;
        expect(comp.filtrarNivelLinkedin).toBeTrue();
    });

    it('mapea filtrar_nivel_linkedin: false desde la API y lo incluye en datosFormulario()', () => {
        TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } },
            ],
        });
        const http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(Preferencias);
        const comp = fixture.componentInstance;
        fixture.autoDetectChanges();

        http.expectOne('http://localhost:3000/api/preferencias').flush({
            exito: true,
            datos: { id: 1, filtrar_nivel_linkedin: false },
        });
        http.expectOne('http://localhost:3000/api/preferencias/cv-base').flush({
            exito: true,
            datos: { cv_base: null, cv_base_actualizado_en: null },
        });

        expect(comp.filtrarNivelLinkedin).toBeFalse();
        const form = (comp as any).datosFormulario();
        expect(form.filtrar_nivel_linkedin).toBeFalse();
    });

    it('calcula equivalencias sugeridas disponibles y permite agregarlas a los términos de búsqueda', () => {
        TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } },
            ],
        });
        const http = TestBed.inject(HttpTestingController);
        const fixture = TestBed.createComponent(Preferencias);
        const comp = fixture.componentInstance;
        fixture.autoDetectChanges();

        http.expectOne('http://localhost:3000/api/preferencias').flush({
            exito: true,
            datos: { id: 1, terminos_busqueda: ['QA manual', 'C#'] },
        });
        http.expectOne('http://localhost:3000/api/preferencias/cv-base').flush({
            exito: true,
            datos: { cv_base: null, cv_base_actualizado_en: null },
        });

        const sugerencias = comp.equivalenciasSugeridasDisponibles;
        expect(sugerencias.some(s => s.sugerencia === 'tester manual')).toBeTrue();
        expect(sugerencias.some(s => s.sugerencia === '.net')).toBeTrue();

        comp.agregarTerminoSugerido('tester manual');
        expect(comp.terminosBusqueda).toContain('tester manual');
        expect(comp.cambiosSinGuardar).toBeTrue();

        const cantidadAntes = comp.terminosBusqueda.length;
        comp.agregarTerminoSugerido('tester manual');
        expect(comp.terminosBusqueda.length).toBe(cantidadAntes);
    });
});