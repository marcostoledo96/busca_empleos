const { validarDestinoGetonbrd, DESTINO_SANDBOX, DESTINO_PRODUCCION } = require('../../src/config/getonbrd');

describe('Guarda de destino GetOnBrd', () => {
    test.each([
        ['host alternativo', 'https://otro-host.test/api/v0', null],
        ['sin evidencia', DESTINO_PRODUCCION, null],
        ['evidencia vencida', DESTINO_PRODUCCION, {
            evidence_id: 'autorizacion-1',
            received_at: '2026-01-01T00:00:00.000Z',
            allowed_host: 'https://www.getonbrd.com',
            scope: ['GET /api/v0/search/jobs'],
            valid_until: '2026-01-02T00:00:00.000Z',
            document_sha256: 'a'.repeat(64),
        }],
        ['scope incorrecto', DESTINO_PRODUCCION, {
            evidence_id: 'autorizacion-1',
            received_at: '2026-01-01T00:00:00.000Z',
            allowed_host: 'https://www.getonbrd.com',
            scope: ['GET /api/v0/companies'],
            valid_until: '2030-01-01T00:00:00.000Z',
            document_sha256: 'a'.repeat(64),
        }],
    ])('deniega %s', (_caso, destino, evidencia) => {
        expect(validarDestinoGetonbrd({ destino, evidencia, habilitado: true }).permitido).toBe(false);
    });

    test('acepta solo el sandbox exacto aunque el booleano esté apagado', () => {
        expect(validarDestinoGetonbrd({ destino: DESTINO_SANDBOX, habilitado: false }).permitido).toBe(true);
    });
});
