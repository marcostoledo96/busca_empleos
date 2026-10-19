import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { DetalleOferta } from './detalle-oferta';
import { OfertasService } from '../../servicios/ofertas.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { Oferta } from '../../modelos/oferta.model';

describe('Issue 50 — verificación independiente', () => {
    const crearOferta = (id = 1) => ({ id, titulo: 'Oferta junior', url: 'https://example.invalid/aviso',
        estado_evaluacion: 'aprobada', porcentaje_match: 84, estado_postulacion: 'no_postulado',
        descripcion: 'Descripción completa sintética para verificar sin red.', nota_postulacion: null,
        fecha_postulacion: null } as Oferta);
    async function preparar() {
        const respuesta = new Subject<any>();
        const seguimiento = jasmine.createSpy().and.returnValue(respuesta);
        const postulacion = jasmine.createSpy();
        const descripcion = jasmine.createSpy();
        const evaluar = jasmine.createSpy();
        await TestBed.configureTestingModule({ imports: [DetalleOferta], providers: [provideNoopAnimations(),
            { provide: OfertasService, useValue: { actualizarSeguimiento: seguimiento,
                actualizarPostulacion: postulacion, actualizarDescripcion: descripcion } },
            { provide: EvaluacionService, useValue: { ejecutarEvaluacion: evaluar } },
        ] }).compileComponents();
        const f = TestBed.createComponent(DetalleOferta);
        return { f, c: f.componentInstance, respuesta, seguimiento, postulacion, descripcion, evaluar };
    }
    it('S3,S7: acepto sólo porcentajes finitos en rango y separo error, pendiente y prioridad', async () => {
        const { f, c } = await preparar();
        const casos: [unknown, number][] = [[null, 0], [undefined, 0], [NaN, 0], [Infinity, 0],
            [-1, 0], [101, 0], ['84', 0], [0, 1], [100, 1]];
        c.visible.set(true);
        for (const [porcentaje_match, cantidad] of casos) {
            f.componentRef.setInput('oferta', { ...crearOferta(), porcentaje_match }); f.detectChanges();
            expect(f.nativeElement.querySelectorAll('.tag-match').length).toBe(cantidad);
        }
        for (const estado_evaluacion of ['pendiente', 'rechazada', 'aprobada']) {
            f.componentRef.setInput('oferta', { ...crearOferta(), estado_evaluacion, prioridad_ia: true,
                evaluacion_error_mensaje: 'Fallo técnico', firma_criterios_evaluacion: null }); f.detectChanges();
            expect(f.nativeElement.querySelectorAll('.tag-match').length).toBe(0);
            expect(f.nativeElement.textContent).toContain('ERROR TÉCNICO');
        }
    });
    it('S4,S6,S9: conservo evidencia completa y navegar no modifica la oferta ni escribe', async () => {
        const { f, c, seguimiento, postulacion, descripcion, evaluar } = await preparar();
        const o = crearOferta();
        const grupos = ['cumplidos', 'no_cumplidos', 'exclusiones', 'por_confirmar'];
        o.explicacion_evaluacion = Object.fromEntries(grupos.map((g, i) => [g, [{ requisito: `R${i}`,
            tipo: 'obligatorio', explicacion: `X${i}`, evidencia_oferta: `O${i}`, evidencia_perfil: `P${i}` }]])) as any;
        const antes = JSON.stringify(o);
        f.componentRef.setInput('oferta', o); c.visible.set(true); f.detectChanges();
        const alerta = f.nativeElement.querySelector('[role="alert"]');
        expect(alerta.textContent).toContain('R2'); expect(alerta.closest('details')).toBeNull();
        for (const s of f.nativeElement.querySelectorAll('summary')) s.click();
        f.detectChanges();
        const texto = f.nativeElement.querySelector('.seccion-matching details').textContent;
        for (let i = 0; i < 4; i++) for (const prefijo of ['R', 'X', 'O', 'P']) expect(texto).toContain(`${prefijo}${i}`);
        expect(f.nativeElement.querySelector('.detalle-descripcion').textContent).toBe(o.descripcion);
        expect(JSON.stringify(o)).toBe(antes);
        for (const espia of [seguimiento, postulacion, descripcion, evaluar]) expect(espia).not.toHaveBeenCalled();
    });
    it('S5: un rechazo conserva datos y la revisión posterior sobrevive a la confirmación', async () => {
        const { f, c, respuesta } = await preparar();
        const o = crearOferta(); f.componentRef.setInput('oferta', o); f.detectChanges();
        c.editarSeguimiento('nota', 'Enviado'); c.guardarSeguimiento();
        c.editarSeguimiento('nota', '');
        respuesta.next({ exito: true, datos: { ...o, nota_postulacion: 'Enviado' } }); f.detectChanges();
        expect(c.notaPostulacion()).toBe(''); expect(o.nota_postulacion).toBe('Enviado');
        c.editarSeguimiento('nota', 'Borrador rechazado');
        const antes = JSON.stringify(o); c.guardarSeguimiento(); respuesta.error(new Error('503')); f.detectChanges();
        expect(JSON.stringify(o)).toBe(antes); expect(c.notaPostulacion()).toBe('Borrador rechazado');
        expect(c.errorSeguimiento()).toBe('No pude guardar el seguimiento. Conservé el borrador; intentá nuevamente.');
        f.componentRef.setInput('oferta', crearOferta(2)); f.detectChanges(); expect(c.notaPostulacion()).toBe('');
        f.componentRef.setInput('oferta', o); f.detectChanges(); expect(c.notaPostulacion()).toBe('Borrador rechazado');
    });
});
