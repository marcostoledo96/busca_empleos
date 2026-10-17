const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const config = require('../../src/config/getonbrd');

const bytes = Buffer.from('Evidencia oficial sintética para pruebas offline.');
const evidencia = {
    evidence_id: 'fixture', received_at: '2026-01-01T00:00:00.000Z',
    allowed_host: 'https://www.getonbrd.com', scope: ['GET /api/v0/search/jobs'],
    documentos: [{ archivo: 'manual.extracto.txt', url: 'https://www.getonbrd.com/user-manual/get-on-board-s-api',
        sha256: createHash('sha256').update(bytes).digest('hex') }],
};
afterEach(() => jest.restoreAllMocks());
test('permito evidencia pública conservada sin inventar vencimiento y verifico sus bytes', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(bytes);
    expect(config.validarDestinoGetonbrd({ destino: config.DESTINO_PRODUCCION, habilitado: true, evidencia }).permitido).toBe(true);
    expect(config.validarDestinoGetonbrd({ destino: config.DESTINO_PRODUCCION, habilitado: false, evidencia }).permitido).toBe(false);
    expect(config.validarDestinoGetonbrd({ destino: config.DESTINO_PRODUCCION, habilitado: 'false', evidencia }).permitido).toBe(false);
    fs.readFileSync.mockReturnValue(Buffer.from('alterada'));
    expect(config.validarDestinoGetonbrd({ destino: config.DESTINO_PRODUCCION, habilitado: true, evidencia }).permitido).toBe(false);
});
test('verifico evidencia íntegra dentro del root de despliegue backend sin iniciar la app', () => {
    const raizBackend = path.resolve(__dirname, '../..');
    const lectura = jest.spyOn(fs, 'readFileSync');
    expect(config.validarDestinoGetonbrd({ habilitado: true }).permitido).toBe(true);
    const archivosLeidos = lectura.mock.calls.map(([archivo]) => path.relative(raizBackend, archivo));
    expect(archivosLeidos).toHaveLength(config.EVIDENCIA_AUTORIZACION.documentos.length);
    for (const archivo of archivosLeidos) {
        expect(archivo.startsWith(`..${path.sep}`) || path.isAbsolute(archivo)).toBe(false);
        expect(archivo.startsWith(path.join('src', 'config', 'evidencias', 'getonbrd') + path.sep)).toBe(true);
    }
    expect(fs.existsSync(path.join(raizBackend, 'src/config/evidencias/getonbrd/evidencia.json'))).toBe(true);
});

test('el registry y la preview comparten la guarda efectiva y evidencia real conservada', () => {
    const anterior = process.env.GETONBRD_ENABLED;
    try {
        const { PLATAFORMAS, obtenerPlataformasActivas } = require('../../src/config/plataformas');
        process.env.GETONBRD_ENABLED = 'false';
        expect(PLATAFORMAS.getonbrd.activa).toBe(false);
        process.env.GETONBRD_ENABLED = 'true';
        expect(config.validarDestinoGetonbrd().permitido).toBe(true);
        expect(PLATAFORMAS.getonbrd.activa).toBe(true);
        expect(obtenerPlataformasActivas().some(p => p.id === 'getonbrd')).toBe(true);
        jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('No disponible'); });
        expect(config.validarDestinoGetonbrd().permitido).toBe(false);
        expect(PLATAFORMAS.getonbrd.activa).toBe(false);
    } finally {
        if (anterior === undefined) delete process.env.GETONBRD_ENABLED;
        else process.env.GETONBRD_ENABLED = anterior;
    }
});

test.each([
    'https://www.getonbrd.com:444/api/v0', 'https://usuario@www.getonbrd.com/api/v0',
    'http://www.getonbrd.com/api/v0', 'https://www.getonbrd.com/api/v0/private',
])('rechazo destino fuera del alcance %s', destino => {
    expect(config.validarDestinoGetonbrd({ destino, habilitado: true, evidencia }).permitido).toBe(false);
});
test('rechazo fecha futura, vencimiento inválido, alcance distinto y rutas de evidencia externas', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(bytes);
    for (const cambio of [{ received_at: '2099-01-01' }, { valid_until: 'incorrecta' }, { valid_until: '2000-01-01' },
        { scope: ['GET /api/v0/companies'] }, { documentos: [{ ...evidencia.documentos[0], archivo: '../otro' }] }]) {
        expect(config.validarDestinoGetonbrd({ destino: config.DESTINO_PRODUCCION, habilitado: true, evidencia: { ...evidencia, ...cambio } }).permitido).toBe(false);
    }
});
