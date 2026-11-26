import type { Oferta } from '../modelos/oferta.model';
import { esRecienteParaReevaluar } from './recencia-reevaluacion';

describe('Recencia para reevaluar', () => {
    const ahora = Date.parse('2026-06-15T12:00:00Z');
    const haceDias = (dias: number, msAntes = 0) => new Date(ahora - dias * 86_400_000 - msAntes).toISOString();
    const casos: [string, number, string | null | undefined, boolean][] = [
        ['admite primera hace 40 días y última hace 1', 40, haceDias(1), true],
        ['rechaza primera hace 40 días y última hace 31', 40, haceDias(31), false],
        ['admite primera hace 1 día con última nula', 1, null, true],
        ['admite primera hace 1 día con última ausente', 1, undefined, true],
        ['rechaza primera hace 31 días con última nula', 31, null, false],
        ['rechaza primera hace 31 días con última ausente', 31, undefined, false],
        ['incluye el límite exacto de 30 días', 40, haceDias(30), true],
        ['excluye un milisegundo anterior al límite', 40, haceDias(30, 1), false],
        ['no reemplaza una última detección inválida por una primera reciente', 1, 'inválida', false],
        ['no reemplaza una última detección vacía por una primera reciente', 1, '', false],
        ['no elige la mayor de ambas fechas ni usa la publicación', 1, haceDias(31), false],
        ['no agrega un límite superior para fechas futuras', 40, haceDias(-1), true],
    ];

    beforeEach(() => spyOn(Date, 'now').and.returnValue(ahora));

    for (const [nombre, diasPrimera, ultima, esperado] of casos) {
        it(nombre, () => {
            const oferta: Pick<Oferta, 'fecha_extraccion' | 'fecha_ultima_extraccion' | 'fecha_publicacion'> = {
                fecha_extraccion: haceDias(diasPrimera),
                fecha_publicacion: haceDias(1),
                ...(ultima === undefined ? {} : { fecha_ultima_extraccion: ultima }),
            };
            expect(esRecienteParaReevaluar(oferta)).toBe(esperado);
        });
    }
});
