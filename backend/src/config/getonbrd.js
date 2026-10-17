const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const DESTINO_SANDBOX = 'https://sandbox.getonbrd.test/api/v0';
const DESTINO_PRODUCCION = 'https://www.getonbrd.com/api/v0';
const HOST_PRODUCCION = 'https://www.getonbrd.com';
const ALCANCE_REQUERIDO = 'GET /api/v0/search/jobs';
const DIRECTORIO_EVIDENCIA = path.join(__dirname, 'evidencias/getonbrd');
const LIMITES_GETONBRD = { porPagina: 120, paginas: 10, items: 1200, timeoutMs: 5000 };
const DEFAULTS_GETONBRD = { porPagina: 20, paginas: 2, items: 40 };
let EVIDENCIA_AUTORIZACION = null;
try {
    EVIDENCIA_AUTORIZACION = JSON.parse(fs.readFileSync(path.join(DIRECTORIO_EVIDENCIA, 'evidencia.json'), 'utf8'));
} catch { /* Mantengo producción bloqueada si falta el registro conservado. */ }

function validarEvidencia(evidencia, ahora) {
    if (!evidencia || typeof evidencia !== 'object') return false;
    const recibida = new Date(evidencia.received_at).getTime();
    const vencimiento = evidencia.valid_until === undefined ? null : new Date(evidencia.valid_until).getTime();
    if (typeof evidencia.evidence_id !== 'string' || !evidencia.evidence_id.trim()
        || typeof evidencia.received_at !== 'string' || evidencia.allowed_host !== HOST_PRODUCCION
        || !Array.isArray(evidencia.scope) || evidencia.scope.length !== 1 || evidencia.scope[0] !== ALCANCE_REQUERIDO
        || !Number.isFinite(recibida) || recibida > ahora.getTime()
        || vencimiento !== null && (!Number.isFinite(vencimiento) || vencimiento < ahora.getTime())
        || !Array.isArray(evidencia.documentos) || !evidencia.documentos.length) return false;
    try {
        return evidencia.documentos.every(documento => {
            if (typeof documento.archivo !== 'string' || !/^[a-z0-9-]+\.extracto\.txt$/.test(documento.archivo)
                || typeof documento.url !== 'string' || !/^https:\/\/(www\.getonbrd\.com(?:\.ar)?|api-doc\.getonbrd\.com)\//.test(documento.url)
                || !/^[a-f0-9]{64}$/.test(documento.sha256)) return false;
            const bytes = fs.readFileSync(path.join(DIRECTORIO_EVIDENCIA, documento.archivo));
            return createHash('sha256').update(bytes).digest('hex') === documento.sha256;
        });
    } catch { return false; }
}

function validarDestinoGetonbrd({ destino = DESTINO_PRODUCCION, evidencia = EVIDENCIA_AUTORIZACION,
    habilitado = process.env.GETONBRD_ENABLED === 'true', ahora = new Date() } = {}) {
    // Este dominio reservado nunca representa el sandbox real; el scraper exige cliente simulado.
    if (destino === DESTINO_SANDBOX) return { permitido: true, destino: 'sandbox', motivo: null };
    if (destino !== DESTINO_PRODUCCION) return { permitido: false, destino: 'bloqueado', motivo: 'politica_destino' };
    if (habilitado !== true) return { permitido: false, destino: 'bloqueado', motivo: 'fuente_deshabilitada' };
    if (!validarEvidencia(evidencia, ahora)) return { permitido: false, destino: 'bloqueado', motivo: 'evidencia_invalida' };
    return { permitido: true, destino: 'produccion', motivo: null };
}
module.exports = { DESTINO_SANDBOX, DESTINO_PRODUCCION, LIMITES_GETONBRD, DEFAULTS_GETONBRD,
    EVIDENCIA_AUTORIZACION, validarDestinoGetonbrd };
