import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Cv } from './cv';
import { DemoService } from '../../servicios/demo.service';
import { AuthService } from '../../servicios/auth.service';
import { authInterceptor } from '../../interceptores/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('Verificación independiente #24 — S2-S12/S14', () => {
    let f: ComponentFixture<Cv>, h: HttpTestingController;
    const url = `${environment.urlApi}/preferencias`;
    const original = 'Preámbulo intacto\n## Desarrollo\nDev sintético, 2022\n## QA\nPruebas sintéticas, 2023\n## Soporte IT\nEquipos, 2024\n## Salud\nHospital sintético, 2025\n## Educación\nCurso, 2021\n## Idiomas\nEspañol declarado\n## Privado\nINSTRUCCIÓN PRIVADA';
    const persona = { nombre: 'Nombre confirmado', perfil_profesional: 'Resumen privado: no postular',
        tecnologias_detalle: [{ nombre: 'Angular', nivel: 'basico', importancia: 'principal' },
            { nombre: 'Java', nivel: 'ninguno', importancia: 'principal' },
            { nombre: 'Cobol', nivel: 'avanzado', importancia: 'penalizable' }],
        roles_objetivo_detalle: [{ rol: 'Director OBJETIVO' }] };
    const perfil = () => ({ exito: true, datos: { nombre: 'SIN GUARDAR', perfil_efectivo: {
        candidato: persona, texto: 'PROMPT PRIVADO', restricciones: { politica: 'EXCLUSIÓN PRIVADA' } } } });
    const cv = (texto: string | null = original) => ({ exito: true, datos: { cv_base: texto } });
    const q = (s: string): any => f.nativeElement.querySelector(s);
    const all = (s: string): any[] => Array.from(f.nativeElement.querySelectorAll(s));
    const tick = () => f.whenStable();
    async function click(s: string) { q(s).click(); await tick(); }
    async function input(s: string, v: string) { q(s).value = v; q(s).dispatchEvent(new Event('input')); await tick(); }
    async function open() {
        await TestBed.configureTestingModule({ imports: [Cv], providers: [provideRouter([]),
            provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
            { provide: DemoService, useValue: { esModoDemo: () => false } },
            { provide: AuthService, useValue: { obtenerToken: () => Promise.resolve('token-sintetico') } }],
        }).compileComponents();
        f = TestBed.createComponent(Cv); f.autoDetectChanges();
        h = TestBed.inject(HttpTestingController); await tick();
    }
    function requests(): [TestRequest, TestRequest] {
        const rs = h.match(() => true);
        expect(rs.length).toBe(2);
        expect(rs.map(r => r.request.url).sort()).toEqual([url, `${url}/cv-base`]);
        rs.forEach(r => { expect(r.request.method).toBe('GET'); expect(r.request.headers.get('Authorization')).toBe('Bearer token-sintetico'); });
        return [rs.find(r => r.request.url === url)!, rs.find(r => r.request.url !== url)!];
    }
    async function load(texto: string | null = original, datos: any = perfil()) {
        const [p, c] = requests(); p.flush(datos); c.flush(cv(texto)); await tick();
    }
    async function preview() { await click('#confirmar-revision'); await click('#ver-previa'); }
    afterEach(() => h.verify());

    it('S3/S4/S5/S11: dos GET autenticados, fuentes separadas, positivos solamente, sin impresión ni persistencia', async () => {
        const print = spyOn(window, 'print'), before = JSON.stringify(persona);
        await open(); await load(); expect(q('#nombre').value).toBe('Nombre confirmado');
        expect(q('#fuente-cv').textContent).toBe(original); expect(q('#habilidades').value).toBe('Angular');
        expect(all('.bloque-incluir').every(e => !e.checked)).toBeTrue();
        await preview(); expect(q('.cv-documento').textContent.trim()).toBe('Nombre confirmadoHabilidades y tecnologíasAngular');
        expect(JSON.stringify(persona)).toBe(before); expect(print).not.toHaveBeenCalled(); h.expectNone(() => true);
    });
    it('S4/S5/S6/S8: ausencia total permite completar hechos manuales, nunca rellena secciones', async () => {
        await open(); await load(null, { exito: true, datos: {} }); await preview();
        expect(q('.cv-documento').textContent.trim()).toBe(''); expect(f.nativeElement.textContent).toContain('Faltan datos');
        await click('#volver-editar'); await input('#nombre', 'Manual'); await input('#contacto', 'manual@example.invalid');
        await input('#resumen', 'Resumen manual'); await click('#agregar-bloque'); await input('.bloque-titulo', 'Educación');
        await input('.bloque-texto', 'Curso manual 2020'); await click('.bloque-incluir'); await preview();
        expect(q('.cv-documento').textContent).toContain('Curso manual 2020'); expect(q('.cv-documento').textContent).toContain('manual@example.invalid');
        h.expectNone(() => true);
    });
    for (const [valor, titulo] of [['desarrollo', 'Desarrollo'], ['qa', 'QA'], ['soporte', 'Soporte IT'], ['salud', 'Salud']]) {
        it(`S7/S8: ${valor} sólo reordena hechos conservando texto y selección`, async () => {
            await open(); await load(); await click('.bloque-incluir');
            const before = all('.bloque-texto').map(e => e.value).sort();
            q('#enfoque').value = valor; q('#enfoque').dispatchEvent(new Event('change')); await tick();
            expect(q('.bloque-titulo').value).toBe(titulo);
            expect(all('.bloque-texto').map(e => e.value).sort()).toEqual(before);
            expect(all('.bloque-incluir').filter(e => e.checked).length).toBe(1); h.expectNone(() => true);
        });
    }
    for (const fuente of ['perfil', 'cv']) for (const fallo of ['exito', '401', '500']) {
        it(`S9/S11: rechazo ${fuente}/${fallo} conserva borrador y no inicia peticiones adicionales`, async () => {
            await open(); await load(); await input('#nombre', 'Edición local');
            spyOn(window, 'confirm').and.returnValue(true); await click('#recargar-fuentes');
            const [p, c] = requests(), malo = fuente === 'perfil' ? p : c, bueno = fuente === 'perfil' ? c : p;
            bueno.flush(fuente === 'perfil' ? cv('NO APLICAR') : perfil());
            if (fallo === 'exito') malo.flush({ exito: false });
            else malo.flush({}, { status: Number(fallo), statusText: 'Error sintético' });
            await tick(); expect(q('#nombre').value).toBe('Edición local'); expect(q('#fuente-cv').textContent).toBe(original);
            expect(q('[role="alert"]').textContent).toBe('No pude cargar las fuentes. Conservé el borrador anterior. Podés reintentar.');
            h.expectNone(() => true);
        });
    }
    it('S9: cancelar recarga no consulta; respuesta parcial nunca borra edición; reintento refleja fuente corregida', async () => {
        await open(); await load(); await input('#nombre', 'Local'); const confirmar = spyOn(window, 'confirm').and.returnValue(false);
        await click('#recargar-fuentes'); h.expectNone(() => true); expect(q('#nombre').value).toBe('Local');
        confirmar.and.returnValue(true); await click('#recargar-fuentes'); const [p,c] = requests();
        c.flush(cv('Corrección fuente')); await input('#contacto', 'Editado mientras espero'); p.flush(perfil()); await tick();
        expect(q('#contacto').value).toBe('Editado mientras espero'); expect(q('#fuente-cv').textContent).toBe(original);
        await click('#recargar-fuentes'); await load('Corrección fuente'); expect(q('.bloque-texto').value).toBe('Corrección fuente');
    });
    it('S6/S10/S11: texto desconocido y hostil intacto, enlaces seguros, revisión invalidada, impresión explícita', async () => {
        const print = spyOn(window, 'print'); await open();
        const hostile = '<img src=x onerror="alert(1)">\n<script>alert(2)</script>\n**Sin encabezado**'; await load(hostile);
        expect(q('.bloque-texto').value).toBe(hostile); await click('.bloque-incluir');
        await input('#enlaces', 'javascript:alert(1)\ndata:text/html,x\nhttps://user:pass@example.invalid\nhttps://example.invalid/cv\nmailto:x@example.invalid');
        await preview(); expect(q('.cv-documento').textContent).toContain(hostile); expect(q('.cv-documento img')).toBeNull();
        expect(q('.cv-documento script')).toBeNull(); expect(all('.cv-documento a').map(e => e.getAttribute('href'))).toEqual(['https://example.invalid/cv','mailto:x@example.invalid']);
        expect(print).not.toHaveBeenCalled(); await click('#imprimir-cv'); expect(print).toHaveBeenCalledTimes(1);
        await click('#volver-editar'); await input('#nombre', 'Otra edición'); expect(q('#ver-previa').disabled).toBeTrue(); h.expectNone(() => true);
    });
    for (const fuente of ['perfil', 'cv']) {
        it(`S3/S9: fallo inicial ${fuente} no publica fuente parcial ni documento`, async () => {
            await open(); const [p,c] = requests();
            (fuente === 'perfil' ? c : p).flush(fuente === 'perfil' ? cv() : perfil());
            (fuente === 'perfil' ? p : c).flush({ exito: false }); await tick();
            expect(q('.cv-documento')).toBeNull(); expect(q('#nombre')).toBeNull();
            expect(q('[role="alert"]')).not.toBeNull(); h.expectNone(() => true);
            await click('#recargar-fuentes'); await load(); expect(q('#nombre').value).toBe('Nombre confirmado');
        });
    }
    it('S4/S6/S10: límite de 100 tecnologías, bloques duplicados y texto extenso se preservan sin fabricar ni truncar', async () => {
        await open();
        const tecnologias = Array.from({ length: 100 }, (_, i) => ({ nombre: `Tech${i}`, nivel: i % 2 ? 'ninguno' : 'basico', importancia: 'principal' }));
        const datos = perfil(); datos.datos.perfil_efectivo.candidato = { ...persona, tecnologias_detalle: tecnologias };
        const largo = 'Hecho sintético 2020, sin inferencias.\n'.repeat(600);
        await load(`## Experiencia\n${largo}\n## Experiencia\nSegundo hecho`, datos);
        expect(all('.bloque-titulo').map(e => e.value)).toEqual(['Experiencia', 'Experiencia']);
        expect(q('#habilidades').value.split(', ').length).toBe(50);
        for (const e of all('.bloque-incluir')) e.click(); await tick(); await preview();
        expect(q('.cv-documento').textContent).toContain(largo.trim());
        expect(q('.cv-documento').textContent).toContain('Segundo hecho'); h.expectNone(() => true);
    });

});
