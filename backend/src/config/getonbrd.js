const DESTINO_SANDBOX = 'https://sandbox.getonbrd.test/api/v0';
const DESTINO_PRODUCCION = 'https://www.getonbrd.com/api/v0';
const HOST_PRODUCCION = 'https://www.getonbrd.com';
const ALCANCE_REQUERIDO = 'GET /api/v0/search/jobs';

const LIMITES_GETONBRD = {
    porPagina: 120,
    paginas: 10,
    items: 1200,
    timeoutMs: 5000,
};

// La evidencia queda nula hasta que exista una autorización escrita verificable.
const EVIDENCIA_AUTORIZACION = null;

function validarEvidencia(evidencia, ahora) {
    if (!evidencia || typeof evidencia !== 'object') return false;

    const fechaRecepcion = new Date(evidencia.received_at);
    const fechaVencimiento = new Date(evidencia.valid_until);
    return typeof evidencia.evidence_id === 'string'
        && evidencia.evidence_id.length > 0
        && evidencia.allowed_host === HOST_PRODUCCION
        && Array.isArray(evidencia.scope)
        && evidencia.scope.includes(ALCANCE_REQUERIDO)
        && !Number.isNaN(fechaRecepcion.getTime())
        && !Number.isNaN(fechaVencimiento.getTime())
        && fechaVencimiento.getTime() >= ahora.getTime()
        && typeof evidencia.document_sha256 === 'string'
        && /^[a-f0-9]{64}$/i.test(evidencia.document_sha256);
}

function validarDestinoGetonbrd({ destino = DESTINO_SANDBOX, evidencia = EVIDENCIA_AUTORIZACION, habilitado = false, ahora = new Date() } = {}) {
    if (destino === DESTINO_SANDBOX) {
        return { permitido: true, destino: 'sandbox', motivo: null };
    }

    if (destino === DESTINO_PRODUCCION && habilitado === true && validarEvidencia(evidencia, ahora)) {
        return { permitido: true, destino: 'produccion', motivo: null };
    }

    return { permitido: false, destino: 'bloqueado', motivo: 'politica_destino' };
}

module.exports = {
    DESTINO_SANDBOX,
    DESTINO_PRODUCCION,
    LIMITES_GETONBRD,
    EVIDENCIA_AUTORIZACION,
    validarDestinoGetonbrd,
};
