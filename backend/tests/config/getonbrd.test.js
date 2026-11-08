const crypto = require('node:crypto');
const {
    ATTESTATION_PAYLOAD,
    EVIDENCIA_AUTORIZACION,
    HASH_ATTESTATION,
    DESTINO_PRODUCCION,
    obtenerConfiguracionGetonbrd,
    validarAttestationCanonica,
    validarDestinoGetonbrd,
} = require('../../src/config/getonbrd');

describe('Guarda de destino GetOnBrd', () => {
    const ahora = new Date('2026-07-15T12:00:00.000Z');
    const evidenciaValida = () => ({ ...EVIDENCIA_AUTORIZACION, scope: [...EVIDENCIA_AUTORIZACION.scope] });

    afterEach(() => {
        delete process.env.GETONBRD_ENABLED;
    });

    test('verifica el payload UTF-8 canónico y su SHA-256 público', () => {
        expect(crypto.createHash('sha256').update(ATTESTATION_PAYLOAD, 'utf8').digest('hex')).toBe(HASH_ATTESTATION);
        expect(HASH_ATTESTATION).toBe('282b2eb4907a1a5fe1053ec28b6d2a02820aef97dfedab6542e46c3786449618');
        expect(validarAttestationCanonica(EVIDENCIA_AUTORIZACION, ahora)).toBe(true);
    });

    test.each([
        ['hash inválido', { document_sha256: 'a'.repeat(64) }],
        ['payload inválido', { payload: '{}' }],
        ['host alternativo', { allowed_host: 'https://otro-host.test' }],
        ['scope alternativo', { scope: ['GET /api/v0/companies'] }],
        ['fecha de revisión alterada', { reviewed_at: '2026-07-14' }],
        ['revisión vencida', { review_before: '2026-07-14' }],
        ['evidencia faltante', null],
    ])('deniega attestation con %s', (_caso, cambio) => {
        const evidencia = cambio === null ? null : { ...evidenciaValida(), ...cambio };
        expect(validarAttestationCanonica(evidencia, ahora)).toBe(false);
    });

    test('el kill switch bloquea por defecto y no toma evidencia de variables ni requests', () => {
        process.env.GETONBRD_ENABLED = 'false';
        expect(validarDestinoGetonbrd(obtenerConfiguracionGetonbrd(), ahora)).toMatchObject({ permitido: false, destino: 'bloqueado' });

        process.env.GETONBRD_ENABLED = 'true';
        const requestManipulado = {
            destino: 'https://otro-host.test/api/v0',
            evidencia: evidenciaValida(),
            habilitado: true,
        };
        expect(validarDestinoGetonbrd(requestManipulado, ahora)).toMatchObject({ permitido: false, destino: 'bloqueado' });
    });

    test('autoriza únicamente la configuración canónica con el flag activo', () => {
        process.env.GETONBRD_ENABLED = 'true';
        expect(validarDestinoGetonbrd(obtenerConfiguracionGetonbrd(), ahora)).toEqual({
            permitido: true,
            destino: 'produccion',
            motivo: null,
        });
    });
});
