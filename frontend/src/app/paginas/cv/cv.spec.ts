import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Cv } from './cv';
import { DemoService } from '../../servicios/demo.service';

// Uso únicamente hechos sintéticos y verifico las acciones desde la interfaz.
describe('CV imprimible — fuentes confirmadas y borrador local', () => {
    let fixture: ComponentFixture<Cv>;
    let http: HttpTestingController;
    const demo = signal(false);
    const url = 'http://localhost:3000/api/preferencias';
    const markdown = '# Experiencia QA\nTester en Empresa Sintética, 2024.\n## Educación\nCurso sintético, 2023.\n## Desarrollo\nProyecto Angular.\n## Soporte IT\nReparación de equipos.\n## Salud\nAdministración sanitaria.\n## Notas privadas\nNo postular a Java.';
    const candidato = {
        nombre: 'Persona Sintética', perfil_profesional: 'Resumen confirmado.',
        tecnologias_detalle: [
            { nombre: 'Angular', nivel: 'medio', importancia: 'principal' },
            { nombre: 'Java', nivel: 'ninguno', importancia: 'principal' },
            { nombre: 'Cobol', nivel: 'medio', importancia: 'penalizable' },
        ],
    };
    async function abrir(modoDemo = false) {
        demo.set(modoDemo);
        await TestBed.configureTestingModule({
            imports: [Cv], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
                { provide: DemoService, useValue: { esModoDemo: demo } }],
        }).compileComponents();
        fixture = TestBed.createComponent(Cv);
        fixture.autoDetectChanges();
        http = TestBed.inject(HttpTestingController);
        await fixture.whenStable();
    }
    async function responder(texto: string | null = markdown, persona: object = candidato) {
        http.expectOne(url).flush({ exito: true, datos: {
            nombre: 'Nombre obsoleto', perfil_efectivo: { candidato: persona,
                texto: 'PROMPT PRIVADO', secciones: [{ texto: 'POLÍTICA PRIVADA' }],
                restricciones: { preferencias: { roles_objetivo_detalle: [{ rol: 'Director deseado' }] } },
            },
        } });
        http.expectOne(`${url}/cv-base`).flush({ exito: true, datos: { cv_base: texto } });
        await fixture.whenStable();
    }
    function elemento(selector: string): any { return fixture.nativeElement.querySelector(selector); }
    function texto(): string { return fixture.nativeElement.textContent; }
    async function editar(selector: string, valor: string) {
        const campo = elemento(selector);
        campo.value = valor;
        campo.dispatchEvent(new Event('input'));
        await fixture.whenStable();
    }
    async function click(selector: string) {
        elemento(selector).click();
        await fixture.whenStable();
    }
    async function seleccionarBloques() {
        for (const campo of fixture.nativeElement.querySelectorAll('.bloque-incluir')) {
            if (!campo.checked) campo.click();
        }
        await fixture.whenStable();
    }
    async function previsualizar() {
        await click('#confirmar-revision');
        await click('#ver-previa');
    }
    afterEach(() => http?.verify());

    it('S2/S3: carga dos GET confirmados y genera una única vista previa sin imprimir', async () => {
        const imprimir = spyOn(window, 'print');
        await abrir(); await responder(); await seleccionarBloques(); await previsualizar();
        expect(elemento('.cv-documento').textContent).toContain('Persona Sintética');
        expect(elemento('.cv-documento').textContent).toContain('Tester en Empresa Sintética, 2024.');
        expect(imprimir).not.toHaveBeenCalled();
        expect(elemento('.cv-documento').textContent).not.toContain('Nombre obsoleto');
    });
    it('S4/S5: datos ausentes no inventan experiencia, estudios ni idiomas', async () => {
        await abrir(); await responder(null, {}); await previsualizar();
        expect(elemento('.cv-documento').textContent.trim()).toBe('');
        expect(texto()).toContain('Faltan datos');
    });
    it('S4: ofrece sólo tecnologías positivas del candidato autoritativo', async () => {
        await abrir(); await responder();
        expect(elemento('#habilidades').value).toBe('Angular');
        await previsualizar();
        expect(elemento('.cv-documento').textContent).not.toMatch(/Java|Cobol/);
    });
    it('S4/S11: excluye políticas y roles objetivo de la propuesta imprimible', async () => {
        await abrir(); await responder(); await previsualizar();
        expect(elemento('.cv-documento').textContent).not.toMatch(/PROMPT|POLÍTICA|Director|No postular/);
    });
    it('S6: conserva bloques desconocidos y Markdown original sin selección automática', async () => {
        await abrir(); await responder('Texto sin encabezado\n<script>alert(1)</script>\n## Raro\nOriginal **sin resumir**');
        const campos = fixture.nativeElement.querySelectorAll('.bloque-texto');
        expect(campos[0].value).toBe('Texto sin encabezado\n<script>alert(1)</script>');
        expect(campos[1].value).toBe('Original **sin resumir**');
        expect(Array.from(fixture.nativeElement.querySelectorAll('.bloque-incluir')).every((c: any) => !c.checked)).toBeTrue();
    });
    it('S4: advierte posibles discrepancias y permite consultar las dos fuentes', async () => {
        await abrir(); await responder();
        expect(texto()).toContain('posibles discrepancias');
        expect(elemento('#fuente-cv').textContent).toBe(markdown);
        expect(elemento('#fuente-perfil').textContent).toContain('Resumen confirmado.');
    });
    it('S8: completa contacto, resumen y habilidades sin modificar la fuente', async () => {
        await abrir(); await responder();
        await editar('#contacto', 'persona@example.invalid');
        await editar('#resumen', 'Resumen manual');
        await editar('#habilidades', 'Angular, SQL manual');
        await previsualizar();
        expect(elemento('.cv-documento').textContent).toContain('persona@example.invalid');
        expect(elemento('.cv-documento').textContent).toContain('Resumen manual');
        expect(elemento('.cv-documento').textContent).toContain('SQL manual');
        http.expectNone(r => r.method !== 'GET');
    });
    it('S6/S8: permite editar hechos, ocultar y reordenar bloques existentes', async () => {
        await abrir(); await responder();
        await editar('.bloque-texto', 'Hecho corregido manualmente, 2025.');
        await click('.bloque-incluir');
        await click('.bloque-bajar');
        await previsualizar();
        expect(elemento('.cv-documento').textContent).toContain('Hecho corregido manualmente, 2025.');
        expect(elemento('.cv-documento').textContent).not.toContain('Curso sintético');
    });
    for (const [enfoque, titulo] of [['desarrollo', 'Desarrollo'], ['qa', 'Experiencia QA'], ['soporte', 'Soporte IT'], ['salud', 'Salud']]) {
        it(`S7: ${enfoque} prioriza hechos existentes sin reescribir ni seleccionar`, async () => {
            await abrir(); await responder();
            const campo = elemento('#enfoque'); campo.value = enfoque; campo.dispatchEvent(new Event('change'));
            await fixture.whenStable();
            expect(elemento('.bloque-titulo').value).toBe(titulo);
            expect(Array.from(fixture.nativeElement.querySelectorAll('.bloque-texto')).map((c: any) => c.value).join(' ')).toContain('Tester en Empresa Sintética, 2024.');
            expect(Array.from(fixture.nativeElement.querySelectorAll('.bloque-incluir')).every((c: any) => !c.checked)).toBeTrue();
            http.expectNone(r => r.method !== 'GET');
        });
    }
    it('S7: advierte evidencia limitada sin inventar contenido', async () => {
        await abrir(); await responder('## Educación\nCurso');
        expect(texto()).toContain('Evidencia limitada');
    });
    it('S8: agregar bloque exige entrada manual y revisión explícita', async () => {
        await abrir(); await responder(null, {}); await click('#agregar-bloque');
        await editar('.bloque-titulo', 'Educación'); await editar('.bloque-texto', 'Curso manual');
        await click('.bloque-incluir');
        expect(elemento('#ver-previa').disabled).toBeTrue();
        await previsualizar(); expect(elemento('.cv-documento').textContent).toContain('Curso manual');
        await click('#volver-editar'); await editar('#nombre', 'Cambio');
        expect(elemento('#confirmar-revision').checked).toBeFalse();
    });
    it('S9: recarga explícita refleja correcciones posteriores de las fuentes', async () => {
        await abrir(); await responder(); await click('#recargar-fuentes');
        await responder('## Educación\nCorrección persistida');
        expect(elemento('.bloque-texto').value).toBe('Corrección persistida');
    });
    it('S9: rechazar recarga preserva borrador y no consulta fuentes', async () => {
        await abrir(); await responder(); await editar('#nombre', 'Manual');
        spyOn(window, 'confirm').and.returnValue(false); await click('#recargar-fuentes');
        expect(elemento('#nombre').value).toBe('Manual'); http.expectNone(() => true);
    });
    it('S9: confirmar recarga no pierde ediciones hechas mientras llegan respuestas', async () => {
        await abrir(); await responder(); await editar('#nombre', 'Primero');
        spyOn(window, 'confirm').and.returnValue(true); await click('#recargar-fuentes');
        await editar('#nombre', 'Edición tardía'); await responder('## Otra\nNueva');
        expect(elemento('#nombre').value).toBe('Edición tardía');
        expect(texto()).toContain('Conservé');
    });
    it('S9: un error preserva el borrador anterior y ofrece reintentar', async () => {
        await abrir(); await responder(); await click('#recargar-fuentes');
        const preferencias = http.expectOne(url);
        const fuente = http.expectOne(`${url}/cv-base`);
        fuente.flush({ exito: true, datos: { cv_base: 'No aplicar' } });
        preferencias.flush({}, { status: 500, statusText: 'Error sintético' });
        await fixture.whenStable();
        expect(elemento('#nombre').value).toBe('Persona Sintética');
        expect(texto()).toContain('No pude cargar');
    });
    it('S10: sólo imprime desde vista previa mediante acción explícita y permite volver', async () => {
        const imprimir = spyOn(window, 'print'); await abrir(); await responder();
        expect(elemento('#imprimir-cv')).toBeNull(); await previsualizar();
        expect(imprimir).not.toHaveBeenCalled(); await click('#imprimir-cv');
        expect(imprimir).toHaveBeenCalledTimes(1); await click('#volver-editar');
        expect(elemento('#nombre')).not.toBeNull();
    });
    it('S11: texto hostil no crea HTML y enlaces admiten sólo http(s)/mailto', async () => {
        await abrir(); await responder(); await editar('#nombre', '<img src=x onerror=alert(1)>');
        await editar('#enlaces', 'javascript:alert(1)\nhttps://portfolio.example.invalid\nmailto:persona@example.invalid\ndata:text/html,mal');
        await previsualizar();
        expect(elemento('.cv-documento img')).toBeNull();
        expect(elemento('.cv-documento').textContent).toContain('<img src=x onerror=alert(1)>');
        const enlaces = fixture.nativeElement.querySelectorAll('.cv-documento a');
        expect(enlaces.length).toBe(2);
        expect(texto()).toContain('Enlaces no admitidos');
    });
    it('S11: demo no consulta fuentes reales ni genera un CV ficticio', async () => {
        await abrir(true); http.expectNone(() => true);
        expect(texto()).toContain('modo demo'); expect(elemento('#ver-previa')).toBeNull();
    });
    it('S8: previene pérdida de borrador al cerrar la pestaña', async () => {
        await abrir(); await responder(); await editar('#nombre', 'Manual');
        // Invoco el listener sin disparar el detector de recarga de Karma.
        const evento = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
        fixture.componentInstance.avisarSalida(evento);
        expect(evento.defaultPrevented).toBeTrue();
    });
    it('S4: un resumen de la fuente requiere selección explícita aunque incluya instrucciones', async () => {
        await abrir(); await responder(null, { ...candidato, perfil_profesional: 'Instrucción privada para matching' });
        expect(elemento('#incluir-resumen').checked).toBeFalse();
        await previsualizar();
        expect(elemento('.cv-documento').textContent).not.toContain('Instrucción privada');
    });
    it('S9: una carga anterior no reemplaza fuentes de una solicitud posterior', async () => {
        await abrir();
        const anteriores = http.match(r => r.url.startsWith(url));
        fixture.componentInstance.cargarFuentes();
        await responder('## Educación\nFuente nueva');
        anteriores.find(r => r.request.url === url)!.flush({ exito: true, datos: { perfil_efectivo: { candidato } } });
        anteriores.find(r => r.request.url.endsWith('/cv-base'))!.flush({ exito: true, datos: { cv_base: 'Viejo' } });
        await fixture.whenStable();
        expect(elemento('.bloque-texto').value).toBe('Fuente nueva');
    });
    it('S9: también preserva ediciones realizadas durante la primera carga', async () => {
        await abrir(); fixture.componentInstance.nombre = 'Manual mientras espero'; fixture.componentInstance.editar();
        await responder();
        expect(fixture.componentInstance.nombre).toBe('Manual mientras espero');
        expect(texto()).toContain('Conservé');
    });
    it('S8: permite ocultar habilidades y ordenar las secciones principales', async () => {
        await abrir(); await responder(); await editar('#resumen', 'Resumen manual');
        await click('#incluir-habilidades');
        const bajar = elemento('[aria-label="Bajar Perfil profesional"]'); bajar.click(); await fixture.whenStable();
        await click('.bloque-incluir'); await previsualizar();
        const titulos = Array.from(fixture.nativeElement.querySelectorAll('.cv-documento h2')).map((n: any) => n.textContent);
        expect(titulos).toEqual(['Experiencia QA', 'Perfil profesional']);
        expect(elemento('.cv-documento').textContent).not.toContain('Angular');
    });
    it('S10: la hoja permanece blanca y legible en tema oscuro', async () => {
        await abrir(); await responder(); await previsualizar();
        document.documentElement.classList.add('dark');
        try {
            const estilo = getComputedStyle(elemento('.cv-documento'));
            expect(estilo.backgroundColor).toBe('rgb(255, 255, 255)');
            expect(estilo.color).toBe('rgb(23, 23, 23)');
            expect(parseFloat(estilo.fontSize)).toBeGreaterThanOrEqual(14);
        } finally {
            document.documentElement.classList.remove('dark');
        }
    });
    it('S10: reglas de impresión A4 aíslan shell y controles, sin bloquear fragmentación larga', async () => {
        await abrir(); await responder(); await previsualizar();
        const reglas = Array.from(document.styleSheets).flatMap(hoja => Array.from(hoja.cssRules));
        const reglasImpresion = reglas.filter((r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText === 'print');
        const estilosImpresion = reglasImpresion.flatMap(r => Array.from(r.cssRules))
            .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
        expect(estilosImpresion.some(r => r.selectorText === 'body:has(app-cv)' && r.style.getPropertyValue('page') === 'cv')).toBeTrue();
        const impresion = reglasImpresion.map(r => r.cssText).join('\n');
        expect(impresion).toContain('body:has(app-cv) .sidebar');
        expect(impresion).toContain('body:has(app-cv) .topbar');
        expect(impresion).toContain('body:has(app-cv) .footer');
        expect(impresion).toContain('body:has(app-cv) .cv-controles');
        expect(impresion).toContain('size: a4');
        expect(impresion).toContain('margin: 16mm 17mm');
        expect(impresion).toContain('break-after: avoid');
        expect(impresion).toContain('break-inside: auto');
        expect(impresion).not.toContain('overflow: hidden');
    });
    it('S10: texto largo permanece completo y no se transforma en HTML', async () => {
        const largo = 'Texto sintético extenso.\n'.repeat(400);
        await abrir(); await responder(`## Experiencia\n${largo}`); await click('.bloque-incluir'); await previsualizar();
        expect(elemento('.cv-documento').textContent).toContain(largo.trim());
    });
});
