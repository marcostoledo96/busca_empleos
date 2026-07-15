const { detectarPrioridadIa } = require('../../src/servicios/evaluacion/detector-prioridad-ia');

describe('detectarPrioridadIa', () => {
    test('detecta evidencias concretas y las acota', () => {
        const resultado = detectarPrioridadIa({
            titulo: 'Desarrollador con IA',
            descripcion: 'Valoramos Claude Code, GitHub Copilot y prompt engineering para desarrollo.'
        });

        expect(resultado.detectada).toBe(true);
        expect(resultado.puntaje).toBeGreaterThan(0);
        expect(resultado.evidencias).toHaveLength(3);
        expect(resultado.version).toBe('prioridad-ia-v1');
    });

    test('no detecta AI aislado ni términos negados', () => {
        const resultado = detectarPrioridadIa({
            descripcion: 'No se requiere Copilot ni herramientas de IA. AI es solo una sigla interna.'
        });

        expect(resultado.detectada).toBe(false);
        expect(resultado.evidencias).toEqual([]);
    });
});
