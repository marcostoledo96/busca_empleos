const fs = require('fs');
const path = require('path');

describe('Migración 018 — prioridad IA', () => {
    const contenido = fs.readFileSync(
        path.resolve(__dirname, '../../sql/migracion-018-prioridad-ia-ofertas.sql'),
        'utf8'
    );

    test('es aditiva, idempotente y no contiene comandos destructivos', () => {
        expect(contenido).toContain('ADD COLUMN IF NOT EXISTS prioridad_ia');
        expect(contenido).toContain('ADD COLUMN IF NOT EXISTS priorizar_ofertas_ia');
        expect(contenido).toMatch(/puntaje_prioridad_ia BETWEEN 0 AND 6/);
        expect(contenido).not.toMatch(/\b(DROP|DELETE|TRUNCATE|CASCADE)\b/i);
    });
});
