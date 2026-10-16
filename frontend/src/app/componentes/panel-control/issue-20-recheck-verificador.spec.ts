import { TestBed } from '@angular/core/testing';
import { ResultadoFuenteVista } from './resultado-fuente';

describe('Issue #20 — consulta sin atribución verificable', () => {
    it('muestro No informado para estado null sin inventar éxito ni error', async () => {
        await TestBed.configureTestingModule({ imports: [ResultadoFuenteVista] }).compileComponents();
        const fixture = TestBed.createComponent(ResultadoFuenteVista);
        try {
            fixture.componentRef.setInput('fuente', {
                plataforma: 'linkedin', estado: 'sin_resultados', totalElegibles: 0,
                resultadosConsultas: [{ consulta: 'qa', estado: null, totalElegibles: null,
                    totalCrudos: null, peticionesRealizadas: null, errores: [] }],
                errores: [],
            });
            fixture.autoDetectChanges();
            await fixture.whenStable();
            const resumen = (fixture.nativeElement as HTMLElement).querySelector('details details summary');
            expect(resumen).not.toBeNull();
            expect(resumen?.textContent).toContain('Consulta: qa');
            expect(resumen?.textContent).toContain('No informado');
            expect(resumen?.textContent).not.toContain('Completada');
            expect(resumen?.textContent).not.toContain('Error');
        } finally {
            fixture.destroy();
        }
    });
});
