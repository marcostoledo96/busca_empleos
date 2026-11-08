const { createHash } = require('node:crypto');

const DESTINO_PRODUCCION = 'https://www.getonbrd.com/api/v0';
const HOST_PRODUCCION = 'https://www.getonbrd.com';
const ALCANCE_REQUERIDO = 'GET /api/v0/search/jobs';
const HASH_ATTESTATION = '282b2eb4907a1a5fe1053ec28b6d2a02820aef97dfedab6542e46c3786449618';
const ATTESTATION_PAYLOAD = '{"attestation":"maintainer-authorized","change":"activar-getonbrd-produccion","date":"2026-07-15","host":"https://www.getonbrd.com","private_data_excluded":true,"scope":["GET /api/v0/search/jobs"],"source":"maintainer-confirmed-in-conversation"}';

const LIMITES_GETONBRD = {
    porPagina: 120,
    paginas: 10,
    items: 1200,
    timeoutMs: 5000,
};

const EVIDENCIA_AUTORIZACION = Object.freeze({
    version: 1,
    evidence_id: 'activar-getonbrd-produccion-2026-07-15',
    payload: ATTESTATION_PAYLOAD,
    document_sha256: HASH_ATTESTATION,
    received_at: '2026-07-15',
    reviewed_at: '2026-07-15',
    review_before: '2026-08-14',
    allowed_host: HOST_PRODUCCION,
    scope: Object.freeze([ALCANCE_REQUERIDO]),
});

function validarAttestationCanonica(evidencia, ahora = new Date()) {
    if (!evidencia || typeof evidencia !== 'object') return false;

    const fechaRevision = new Date(`${evidencia.reviewed_at}T00:00:00.000Z`);
    const fechaLimite = new Date(`${evidencia.review_before}T23:59:59.999Z`);
    const digest = typeof evidencia.payload === 'string'
        ? createHash('sha256').update(evidencia.payload, 'utf8').digest('hex')
        : null;

    return evidencia.version === 1
        && evidencia.evidence_id === EVIDENCIA_AUTORIZACION.evidence_id
        && evidencia.received_at === '2026-07-15'
        && evidencia.reviewed_at === '2026-07-15'
        && evidencia.allowed_host === HOST_PRODUCCION
        && Array.isArray(evidencia.scope)
        && evidencia.scope.length === 1
        && evidencia.scope[0] === ALCANCE_REQUERIDO
        && evidencia.payload === ATTESTATION_PAYLOAD
        && evidencia.document_sha256 === HASH_ATTESTATION
        && digest === HASH_ATTESTATION
        && !Number.isNaN(fechaRevision.getTime())
        && !Number.isNaN(fechaLimite.getTime())
        && fechaRevision.getTime() <= ahora.getTime()
        && ahora.getTime() <= fechaLimite.getTime();
}

function obtenerConfiguracionGetonbrd() {
    return {
        destino: DESTINO_PRODUCCION,
        evidencia: EVIDENCIA_AUTORIZACION,
        habilitado: process.env.GETONBRD_ENABLED === 'true',
    };
}

function validarDestinoGetonbrd(configuracion, ahora = new Date()) {
    if (!configuracion || typeof configuracion !== 'object') {
        return { permitido: false, destino: 'bloqueado', motivo: 'politica_destino' };
    }

    const permitido = configuracion.destino === DESTINO_PRODUCCION
        && configuracion.habilitado === true
        && validarAttestationCanonica(configuracion.evidencia, ahora);

    return permitido
        ? { permitido: true, destino: 'produccion', motivo: null }
        : { permitido: false, destino: 'bloqueado', motivo: 'politica_destino' };
}

function getonbrdEstaHabilitado(ahora = new Date()) {
    return validarDestinoGetonbrd(obtenerConfiguracionGetonbrd(), ahora).permitido;
}

module.exports = {
    ATTESTATION_PAYLOAD,
    DESTINO_PRODUCCION,
    EVIDENCIA_AUTORIZACION,
    HASH_ATTESTATION,
    LIMITES_GETONBRD,
    getonbrdEstaHabilitado,
    obtenerConfiguracionGetonbrd,
    validarAttestationCanonica,
    validarDestinoGetonbrd,
};
