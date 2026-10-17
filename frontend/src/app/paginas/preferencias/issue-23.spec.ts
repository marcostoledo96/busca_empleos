import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Preferencias } from './preferencias';
import { DemoService } from '../../servicios/demo.service';

// Integro DOM y servicio reales con respuestas HTTP sintéticas, sin proveedores externos.
describe('Issue #23 — documento, borrador temporal y revisión explícita', () => {
    const url = 'http://localhost:3000/api/preferencias';
    const extraer = `${url}/importar-cv/extraer-texto`;
    const analizar = `${url}/importar-cv/analizar`;
    const texto = '\ufeff# Ana Sintética\nExperiencia: soporte\nEducación: tecnicatura\nIdiomas: español, inglés\n';
    const fila = { nombre: 'Confirmado', modalidad_aceptada: 'remoto', zonas_preferidas: ['CABA'],
        expectativa_salarial_min: 900, moneda_salarial: 'USD', disponibilidad: 'full_time',
        terminos_busqueda: ['QA'], reglas_exclusion: ['Java'], keywords_positivas: ['Manual'],
        plataformas_preferidas: ['linkedin'], plataformas_excluidas: ['computrabajo'],
        roles_objetivo_detalle: [{ rol: 'QA', prioridad: 'alta', aliases: [] }],
        tecnologias_detalle: [], preguntas_perfil_pendientes: [{ campo: 'previo', pregunta: '¿Previo?', nota: 'Nota previa', estado: 'nota' }] };
    let fixture: ComponentFixture<Preferencias>;
    let http: HttpTestingController;
    let confirmar: jasmine.Spy;
    const elemento = <T extends HTMLElement>(selector: string): T => {
        const encontrado = fixture.nativeElement.querySelector(selector);
        expect(encontrado).withContext(selector).not.toBeNull();
        return encontrado;
    };
    const estado = () => elemento('#importacion-estado').textContent ?? '';
    async function clic(selector: string) {
        elemento<HTMLButtonElement>(selector).click();
        await fixture.whenStable();
    }
    async function seleccionar(nombre = 'sintetico.pdf', contenido: BlobPart = '%PDF-1.7 sintético') {
        const input = elemento<HTMLInputElement>('#archivo-cv');
        const archivos = new DataTransfer();
        archivos.items.add(new File([contenido], nombre, { type: nombre.endsWith('.pdf') ? 'application/pdf' : 'text/markdown' }));
        input.files = archivos.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await fixture.whenStable();
    }
    async function editar(valor: string) {
        const editor = elemento<HTMLTextAreaElement>('#texto-cv-importacion');
        editor.value = valor;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
    }
    async function extraerTexto(valor = texto) {
        await clic('#extraer-texto-cv');
        const peticion = http.expectOne(extraer);
        expect(peticion.request.method).toBe('POST');
        expect((peticion.request.body as FormData).get('cv')).toBeInstanceOf(File);
        peticion.flush({ exito: true, datos: { texto: valor, formato: 'pdf' } });
        await fixture.whenStable();
    }
    async function analizarTexto(valor: string, datos: object = { nombre: 'Propuesto' }) {
        await clic('#analizar-texto-cv');
        const peticion = http.expectOne(analizar);
        const documento = (peticion.request.body as FormData).get('cv') as File;
        expect(documento.name).toMatch(/\.md$/);
        expect(documento.type).toBe('text/markdown');
        expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(await documento.arrayBuffer())).toBe(valor);
        peticion.flush({ exito: true, datos });
        await fixture.whenStable();
    }
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Preferencias],
            providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(),
                { provide: DemoService, useValue: { esModoDemo: () => false } }],
        }).compileComponents();
        confirmar = spyOn(window, 'confirm').and.returnValue(true);
        fixture = TestBed.createComponent(Preferencias);
        fixture.autoDetectChanges();
        http = TestBed.inject(HttpTestingController);
        http.expectOne(url).flush({ exito: true, datos: structuredClone(fila) });
        http.expectOne(`${url}/cv-base`).flush({ exito: true, datos: { cv_base: 'Fuente guardada', cv_base_actualizado_en: '2026-01-01' } });
        fixture.componentInstance.tabActiva.set(5);
        await fixture.whenStable();
    });
    afterEach(() => http.verify());

    it('admite PDF/Markdown, selecciona sin HTTP y extrae texto completo antes de la IA', async () => {
        expect(elemento<HTMLInputElement>('#archivo-cv').accept).toBe('.pdf,.md');
        expect(elemento('label[for="archivo-cv"]')).toBeTruthy();
        await seleccionar();
        http.expectNone(() => true);
        expect(elemento<HTMLButtonElement>('#analizar-texto-cv').disabled).toBeTrue();
        await extraerTexto();
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(texto);
        expect(estado()).toContain('Texto extraído');
        http.expectNone(analizar);
        expect(fixture.componentInstance.cvBaseTexto).toBe('Fuente guardada');
        expect(fixture.componentInstance.nombre).toBe('Confirmado');
        expect(fixture.componentInstance.preguntasPerfilPendientes).toEqual(fila.preguntas_perfil_pendientes as any);
    });

    it('recorre PDF → extracción → corrección exacta → IA simulada → revisión → aplicar → guardar explícitamente', async () => {
        await seleccionar();
        await extraerTexto();
        const corregido = texto + '\nProyecto corregido ñ 🌎\n';
        await editar(corregido);
        expect(estado()).toContain('Texto revisado');
        await analizarTexto(corregido, { nombre: 'Ana propuesta', modalidad_aceptada: 'presencial',
            expectativa_salarial_min: 0, moneda_salarial: 'ARS', terminos_busqueda: ['Inventado'],
            plataformas_preferidas: [], plataformas_excluidas: [], roles_objetivo_detalle: [],
            reglas_exclusion: [], keywords_positivas: ['Inventada'] });
        expect(estado()).toContain('Análisis completado');
        expect(fixture.componentInstance.nombre).toBe('Confirmado');
        const nombre = elemento<HTMLInputElement>('#cv-nombre');
        nombre.value = 'Ana revisada';
        nombre.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        await clic('.importar-resultado .btn-guardar');
        expect(estado()).toContain('Perfil revisado');
        expect(estado()).toContain('Cambios aplicados');
        expect(estado()).toContain('sin guardar');
        expect(fixture.componentInstance.nombre).toBe('Ana revisada');
        expect(fixture.componentInstance.modalidadAceptada).toBe('remoto');
        expect(fixture.componentInstance.expectativaSalarialMin).toBe(900);
        expect(fixture.componentInstance.keywordsPositivas).toEqual(['Manual']);
        expect(fixture.componentInstance.cvBaseTexto).toBe('Fuente guardada');
        http.expectNone(r => r.method === 'PUT' || r.url.includes('/ofertas'));
        await clic('[aria-label="Guardar preferencias"]');
        const guardar = http.expectOne(url);
        expect(guardar.request.method).toBe('PUT');
        expect(Object.keys(guardar.request.body).sort()).toEqual(['fecha_importacion_cv', 'nombre']);
        guardar.flush({ exito: true, datos: { ...fila, nombre: 'Ana revisada' } });
        await fixture.whenStable();
        expect(estado()).toContain('Preferencias guardadas');
    });

    for (const caso of [
        { codigo: 'CV_SIN_TEXTO', error: 'No pude recuperar texto del PDF. Pegá el texto manualmente.', status: 422 },
        { codigo: 'CV_DOCUMENTO_INVALIDO', error: 'El documento está dañado.', status: 422 },
        { codigo: 'RED', error: 'Error de red', status: 0 },
    ]) {
        it(`permite fallback manual y análisis sin reiniciar después de ${caso.codigo}`, async () => {
            await editar('Borrador previo');
            await seleccionar();
            await editar('Texto conservado durante la extracción');
            await clic('#extraer-texto-cv');
            const peticion = http.expectOne(extraer);
            if (caso.status === 0) peticion.error(new ProgressEvent('error'));
            else peticion.flush({ exito: false, codigo: caso.codigo, error: caso.error }, { status: caso.status, statusText: 'Error sintético' });
            await fixture.whenStable();
            expect(elemento('#error-extraccion-cv').textContent).toContain(caso.status === 0 ? 'red' : caso.error);
            expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('Texto conservado durante la extracción');
            expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').disabled).toBeFalse();
            await editar(texto);
            await analizarTexto(texto);
            await clic('.importar-resultado .btn-guardar');
            expect(fixture.componentInstance.nombre).toBe('Propuesto');
            http.expectNone(r => r.method === 'PUT');
            await clic('[aria-label="Guardar preferencias"]');
            http.expectOne(url).flush({ exito: true, datos: { ...fila, nombre: 'Propuesto' } });
        });
    }

    it('acepta pegado sin archivo y conserva texto ante error IA, permitiendo reintentar', async () => {
        await editar(texto);
        await clic('#analizar-texto-cv');
        http.expectOne(analizar).flush({ exito: false, error: 'DeepSeek no disponible' }, { status: 502, statusText: 'Error' });
        await fixture.whenStable();
        expect(elemento('#error-analisis-cv').textContent).toContain('DeepSeek no disponible');
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(texto);
        expect(elemento('#error-analisis-cv').getAttribute('role')).toBe('alert');
        expect(elemento('#importacion-estado').getAttribute('aria-live')).toBe('polite');
        await analizarTexto(texto);
    });

    it('protege el CV base sucio y usa únicamente el texto corregido sin guardarlo', async () => {
        fixture.componentInstance.editarCvBase('Fuente sin guardar');
        await seleccionar('sintetico.md', texto);
        await extraerTexto();
        await editar('Corrección del documento');
        expect(fixture.componentInstance.cvBaseTexto).toBe('Fuente sin guardar');
        confirmar.and.returnValue(false);
        await clic('#usar-texto-cv-base');
        expect(fixture.componentInstance.cvBaseTexto).toBe('Fuente sin guardar');
        confirmar.and.returnValue(true);
        await clic('#usar-texto-cv-base');
        expect(fixture.componentInstance.cvBaseTexto).toBe('Corrección del documento');
        expect(fixture.componentInstance.cvBaseGuardado).toBe('Fuente guardada');
        expect(fixture.componentInstance.cambiosCvPendientes).toBeTrue();
        http.expectNone(r => r.method === 'PUT');
        await clic('#guardar-cv-base');
        const guardar = http.expectOne(`${url}/cv-base`);
        expect(guardar.request.body).toBe('Corrección del documento');
        guardar.flush({ exito: true, datos: { cv_base: 'Corrección del documento', cv_base_actualizado_en: '2026-01-02' } });
    });

    it('conserva decisiones, rechazos y notas si rechazo seleccionar, editar o volver a extraer', async () => {
        await seleccionar();
        await extraerTexto();
        await analizarTexto(texto, { nombre: 'Propuesto', tecnologias_detalle: [
            { nombre: 'Inventada', nivel: 'basico', categoria: 'herramienta', importancia: 'secundaria', aliases: [] }],
            preguntas: [{ campo: 'otro', pregunta: '¿Dato?' }, { campo: 'salario', pregunta: '¿Salario?' }] });
        await clic('[data-rechazar-tecnologia]');
        const nota = elemento<HTMLTextAreaElement>('.importar-pregunta--informativa textarea');
        nota.value = 'Conservo mi nota';
        nota.dispatchEvent(new Event('input', { bubbles: true }));
        await fixture.whenStable();
        await clic('.importar-pregunta--informativa button');
        await clic('.importar-pregunta--accionable button:nth-child(2)');
        const resultado = structuredClone(fixture.componentInstance.resultadoImportacion);
        const preguntas = structuredClone(fixture.componentInstance.preguntasImportacion);
        confirmar.and.returnValue(false);
        await seleccionar('otro.md', 'Otro');
        await editar('Reemplazo rechazado');
        await clic('#extraer-texto-cv');
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(texto);
        expect(fixture.componentInstance.archivoCvSeleccionado?.name).toBe('sintetico.pdf');
        expect(fixture.componentInstance.resultadoImportacion).toEqual(resultado);
        expect(fixture.componentInstance.preguntasImportacion).toEqual(preguntas);
        http.expectNone(() => true);
        confirmar.and.returnValue(true);
        await editar('Reemplazo confirmado');
        expect(fixture.componentInstance.resultadoImportacion).toBeNull();
        expect(fixture.componentInstance.preguntasPerfilPendientes).toEqual(fila.preguntas_perfil_pendientes as any);
    });

    it('cancelar el selector conserva el borrador y permite reseleccionar el mismo archivo', async () => {
        await seleccionar();
        await extraerTexto();
        const input = elemento<HTMLInputElement>('#archivo-cv');
        input.files = new DataTransfer().files;
        input.dispatchEvent(new Event('change'));
        await fixture.whenStable();
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(texto);
        expect(fixture.componentInstance.archivoCvSeleccionado?.name).toBe('sintetico.pdf');
        await seleccionar();
        expect(input.value).toBe('');
        await extraerTexto('Nueva lectura');
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('Nueva lectura');
    });

    it('ignora extracción A tardía después de B y extracción B tardía después de editar', async () => {
        await seleccionar('a.pdf');
        await clic('#extraer-texto-cv');
        const a = http.expectOne(extraer);
        await seleccionar('b.pdf');
        await clic('#extraer-texto-cv');
        const b = http.expectOne(extraer);
        a.flush({ exito: true, datos: { texto: 'Obsoleto A', formato: 'pdf' } });
        await fixture.whenStable();
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('');
        await editar('Edición durante B');
        b.flush({ exito: true, datos: { texto: 'Obsoleto B', formato: 'pdf' } });
        await fixture.whenStable();
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('Edición durante B');
        expect(fixture.componentInstance.nombre).toBe('Confirmado');
    });

    for (const falla of [false, true]) {
        it(`invalida IA al editar y no muestra resultado/error obsoleto: error=${falla}`, async () => {
            await editar('A');
            await clic('#analizar-texto-cv');
            const a = http.expectOne(analizar);
            await editar('B');
            await clic('#analizar-texto-cv');
            const b = http.expectOne(analizar);
            b.flush({ exito: true, datos: { nombre: 'B' } });
            if (falla) a.flush({ error: 'Error obsoleto' }, { status: 502, statusText: 'Error' });
            else a.flush({ exito: true, datos: { nombre: 'A' } });
            await fixture.whenStable();
            expect(fixture.componentInstance.resultadoImportacion?.nombre).toBe('B');
            expect(fixture.nativeElement.textContent).not.toContain('Error obsoleto');
            expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('B');
        });
    }

    it('cancelar importación invalida extracción e IA sin tocar formulario o CV base', async () => {
        await seleccionar();
        await clic('#extraer-texto-cv');
        const extraccion = http.expectOne(extraer);
        await clic('#cancelar-importacion');
        extraccion.flush({ exito: true, datos: { texto: 'Tardío', formato: 'pdf' } });
        await editar('Manual');
        await clic('#analizar-texto-cv');
        const ia = http.expectOne(analizar);
        await clic('#cancelar-importacion');
        ia.flush({ exito: true, datos: { nombre: 'Tardío' } });
        expect(fixture.componentInstance.resultadoImportacion).toBeNull();
        expect(fixture.componentInstance.nombre).toBe('Confirmado');
        expect(fixture.componentInstance.cvBaseTexto).toBe('Fuente guardada');
    });

    it('Markdown preserva BOM, CRLF y multibyte por el contrato de análisis existente', async () => {
        const original = texto.replace(/\n/g, '\r\n');
        await seleccionar('sintetico.md', original);
        await clic('#extraer-texto-cv');
        const peticion = http.expectOne(extraer);
        const archivo = (peticion.request.body as FormData).get('cv') as File;
        expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(await archivo.arrayBuffer())).toBe(original);
        peticion.flush({ exito: true, datos: { texto: original, formato: 'md' } });
        await fixture.whenStable();
        // El navegador representa CRLF como LF; no modifico por eso la cadena fuente.
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(texto);
        await analizarTexto(original);
        http.expectNone(r => r.url.includes('/ofertas'));
    });

    for (const invalido of [
        { nombre: 'no.docx', contenido: 'Texto', mensaje: 'PDF o Markdown' },
        { nombre: 'vacio.pdf', contenido: '', mensaje: 'vacío' },
        { nombre: 'grande.pdf', contenido: 'a'.repeat(5 * 1048576 + 1), mensaje: '5 MiB' },
    ]) {
        it(`rechaza ${invalido.nombre} sin HTTP ni pérdida del borrador`, async () => {
            await editar('Borrador conservado');
            await seleccionar(invalido.nombre, invalido.contenido);
            expect(elemento('#error-extraccion-cv').textContent).toContain(invalido.mensaje);
            expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('Borrador conservado');
            http.expectNone(() => true);
        });
    }

    for (const valor of ['', 'a'.repeat(1048577), 'Inválido\u0000', '\ud800']) {
        it(`rechaza respuesta de extracción inválida (${valor.length} caracteres) sin truncar ni pisar texto`, async () => {
            await seleccionar();
            await editar('Conservado');
            await clic('#extraer-texto-cv');
            http.expectOne(extraer).flush({ exito: true, datos: { texto: valor, formato: 'pdf' } });
            await fixture.whenStable();
            expect(elemento('#error-extraccion-cv').textContent).toContain('No pude validar');
            expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('Conservado');
            http.expectNone(analizar);
        });
    }

    it('admite documento de 5 MiB y texto de 1 MiB exactos, conservando rechazo por presupuesto IA', async () => {
        await seleccionar('limite.md', 'a'.repeat(5 * 1048576));
        expect(fixture.componentInstance.archivoCvSeleccionado?.size).toBe(5 * 1048576);
        const limite = 'ñ'.repeat(524288);
        await extraerTexto(limite);
        await clic('#analizar-texto-cv');
        const peticion = http.expectOne(analizar);
        const documento = (peticion.request.body as FormData).get('cv') as File;
        expect(documento.size).toBe(1048576);
        expect(await documento.text()).toBe(limite);
        peticion.flush({ exito: false, error: 'El texto excede el presupuesto del análisis. No lo recorté.' }, { status: 413, statusText: 'Error' });
        await fixture.whenStable();
        expect(elemento('#error-analisis-cv').textContent).toContain('presupuesto');
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(limite);
        expect(fixture.componentInstance.cvBaseTexto).toBe('Fuente guardada');
    });

    it('no muestra un error tardío de extracción después de pegar texto', async () => {
        await seleccionar();
        await clic('#extraer-texto-cv');
        const peticion = http.expectOne(extraer);
        await editar('Mi corrección');
        peticion.flush({ error: 'Error obsoleto' }, { status: 422, statusText: 'Error' });
        await fixture.whenStable();
        expect(fixture.nativeElement.textContent).not.toContain('Error obsoleto');
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe('Mi corrección');
        expect(elemento<HTMLButtonElement>('#analizar-texto-cv').disabled).toBeFalse();
    });

    it('rechaza texto pegado excesivo sin truncarlo ni llamar IA', async () => {
        const excesivo = 'ñ'.repeat(524289);
        await editar(excesivo);
        await clic('#analizar-texto-cv');
        expect(elemento('#error-analisis-cv').textContent).toContain('1 MiB');
        expect(elemento<HTMLTextAreaElement>('#texto-cv-importacion').value).toBe(excesivo);
        http.expectNone(analizar);
    });
});
