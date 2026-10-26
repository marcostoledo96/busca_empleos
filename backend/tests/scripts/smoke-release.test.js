const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const TOKEN = 'secreto-ficticio-no-imprimir';
const cuerpos = {
    '/api/salud': { exito: true, mensaje: 'El servidor está funcionando correctamente.' },
    '/api/ofertas': { exito: true, datos: [], total: 0, pagina: 1, limite_pagina: null },
    '/api/ofertas/sincronizacion': { exito: true, datos: [], fecha_corte: '2026-10-26T00:00:00.000Z', max_id: 0,
        total_inicial: 0, cursor_siguiente: null, completada: true },
    '/api/automatizacion/historial': { exito: true, datos: [] },
    '/api/scraping/previsualizacion': { exito: true, datos: { plataformas: [{ plataforma: 'linkedin', nombre: 'LinkedIn',
        habilitada: true, ejecutable: true, terminos: ['junior'], consultasEfectivas: ['junior'],
        ventanaDias: 30, maxResultados: 50, advertencias: [] }] } },
    '/api/preferencias': { exito: true, datos: { id: 1, terminos_busqueda: [], reglas_exclusion: [],
        stack_tecnologico: [], perfil_efectivo: {} }, firma_criterios_evaluacion: 'firma' },
};
let servidor, cambiar, llamadas;
async function cli(entorno = {}, args = []) {
    return new Promise(resolve => {
        const proceso = spawn(process.execPath, [path.resolve(__dirname, '../../scripts/smoke-release.js'), ...args], {
            env: { PATH: process.env.PATH, NODE_ENV: 'test', DB_TEST_SINTETICA: 'true',
                RELEASE_URL: `http://127.0.0.1:${servidor.address().port}`, RELEASE_TOKEN: TOKEN, ...entorno },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '', stderr = '';
        proceso.stdout.on('data', data => { stdout += data; });
        proceso.stderr.on('data', data => { stderr += data; });
        proceso.on('close', status => resolve({ status, stdout, stderr }));
    });
}
beforeAll(async () => {
    servidor = await new Promise(resolve => {
        const s = http.createServer((req, res) => {
            llamadas.push({ url: req.url, headers: req.headers, method: req.method });
            const ruta = new URL(req.url, 'http://localhost').pathname;
            res.setHeader('Content-Type', 'application/json');
            if (cambiar?.(ruta, req, res)) return;
            res.end(JSON.stringify(cuerpos[ruta]));
        }).listen(0, '127.0.0.1', () => resolve(s));
    });
});
beforeEach(() => { llamadas = []; cambiar = null; });
afterAll(async () => { await new Promise(resolve => servidor.close(resolve)); });
function salidaSegura(resultado, status = 1) {
    expect(resultado.status).toBe(status);
    expect(resultado.stderr).toBe('');
    expect(resultado.stdout).not.toContain(TOKEN);
    expect(resultado.stdout).not.toContain('contenido-privado');
    expect(resultado.stdout).not.toContain('SMOKE: OK');
    const lineas = resultado.stdout.trim().split('\n');
    if (lineas.length === 1) {
        expect(resultado.stdout).toBe('SMOKE: NO VERIFICADO (configuración u opciones no permitidas; consulte --help)\n');
    } else {
        expect(lineas).toHaveLength(7);
        for (const [i, ruta] of Object.keys(cuerpos).entries()) {
            const endpoint = ruta.endsWith('sincronizacion') ? `${ruta}?limite=100` : ruta;
            expect(lineas[i].startsWith(`GET ${endpoint} HTTP `)).toBe(true);
            expect(lineas[i].slice(`GET ${endpoint} HTTP `.length)).toMatch(/^\d{1,3} \d+ms (OK|FALLO (HTTP|caché|contrato inválido|JSON inválido|límite de cuerpo|tipo de respuesta)|NO VERIFICADO( transporte| tiempo agotado)?)$/);
        }
        expect(lineas[6]).toMatch(/^SMOKE: (FALLO|NO VERIFICADO)$/);
    }
}
test('PASS requiere los seis GET efectivos; no envía token al health, exige no-cache y nonce', async () => {
    const resultado = await cli();
    expect(resultado.status).toBe(0);
    expect(resultado.stderr).toBe('');
    expect(resultado.stdout.split('\n')).toHaveLength(8);
    expect(resultado.stdout).toContain('SMOKE: OK');
    expect(llamadas).toHaveLength(6);
    for (const [i, llamada] of llamadas.entries()) {
        expect(llamada.method).toBe('GET');
        expect(llamada.headers['cache-control']).toBe('no-cache, no-store');
        expect(llamada.headers['if-none-match']).toBeUndefined();
        expect(llamada.url).toMatch(/[?&]_smoke=[a-f0-9]+/);
        expect(llamada.headers.authorization).toBe(i ? `Bearer ${TOKEN}` : undefined);
    }
});
test('acepto empresa NULL: el contrato SQL permite ofertas sin empresa conocida', async () => {
    cambiar = (ruta, req, res) => {
        if (ruta !== '/api/ofertas') return false;
        res.end(JSON.stringify({ ...cuerpos[ruta], total: 1,
            datos: [{ id: 1, titulo: 'contenido-privado', empresa: null, plataforma: 'linkedin' }] }));
        return true;
    };
    const resultado = await cli();
    expect(resultado.status).toBe(0);
    expect(resultado.stderr).toBe('');
    expect(resultado.stdout).not.toContain('contenido-privado');
});

test.each(Object.keys(cuerpos))('rechazo contrato vacío de %s', async ruta => {
    cambiar = (actual, req, res) => { if (actual !== ruta) return false; res.end('{"exito":true,"datos":{}}'); return true; };
    const resultado = await cli();
    salidaSegura(resultado);
    expect(resultado.stdout).toContain('contrato inválido');
});
test.each([401, 403, 500, 503, 304, 202, 302])('HTTP %s nunca es PASS ni sigue redirect', async status => {
    cambiar = (ruta, req, res) => {
        if (ruta !== '/api/ofertas') return false;
        res.statusCode = status;
        res.setHeader('Location', `http://127.0.0.1:${servidor.address().port}/contenido-privado`);
        res.end('contenido-privado'); return true;
    };
    const resultado = await cli();
    salidaSegura(resultado);
    expect(llamadas).toHaveLength(6);
    expect(resultado.stdout).toContain(status === 401 || status === 403 ? 'NO VERIFICADO' : 'FALLO');
});
test.each([
    ['JSON roto', {}, 'contenido-privado'],
    ['exito false', {}, '{"exito":false}'],
    ['cache Age', { Age: '12' }, JSON.stringify(cuerpos['/api/ofertas'])],
    ['cache Age cero', { Age: '0' }, JSON.stringify(cuerpos['/api/ofertas'])],
    ['cache HIT', { 'X-Cache': 'HIT' }, JSON.stringify(cuerpos['/api/ofertas'])],
    ['cache CDN', { 'CF-Cache-Status': 'STALE' }, JSON.stringify(cuerpos['/api/ofertas'])],
    ['tipo incorrecto', { 'Content-Type': 'text/html' }, JSON.stringify(cuerpos['/api/ofertas'])],
    ['incoherente', {}, '{"exito":true,"datos":[{"id":1}],"total":0,"pagina":1,"limite_pagina":50}'],
    ['body excesivo', {}, 'x'.repeat(1024 * 1024 + 1)],
])('rechazo %s sin imprimir cuerpo', async (nombre, headers, cuerpo) => {
    cambiar = (ruta, req, res) => {
        if (ruta !== '/api/ofertas') return false;
        for (const [clave, valor] of Object.entries(headers)) res.setHeader(clave, valor);
        res.end(cuerpo); return true;
    };
    salidaSegura(await cli());
});
test('acoto una respuesta que no finaliza, incluso si gotea bytes', async () => {
    cambiar = (ruta, req, res) => {
        if (ruta !== '/api/ofertas') return false;
        res.write('{'); const intervalo = setInterval(() => res.write(' '), 100);
        res.on('close', () => clearInterval(intervalo)); return true;
    };
    const inicio = Date.now();
    salidaSegura(await cli());
    expect(Date.now() - inicio).toBeLessThan(7000);
}, 8000);
test.each([
    { RELEASE_URL: 'http://example.invalid' }, { RELEASE_URL: 'https://user:secreto@example.invalid' },
    { RELEASE_URL: 'https://example.invalid/path' }, { RELEASE_URL: 'https://example.invalid?token=secreto' },
    { RELEASE_URL: 'http://127.0.0.1', NODE_ENV: 'production' }, { RELEASE_TOKEN: 'secreto\ninyectado' },
])('configuración insegura falla sin red ni secretos %#', async env => {
    salidaSegura(await cli(env)); expect(llamadas).toEqual([]);
});
test('sin token NO VERIFICADO aunque todos los endpoints fueran públicos por error', async () => {
    const resultado = await cli({ RELEASE_TOKEN: '' });
    salidaSegura(resultado); expect(resultado.stdout).toContain('NO VERIFICADO');
});
test('no acepto credenciales ni opciones por argv; ayuda no hace red', async () => {
    salidaSegura(await cli({}, ['--token', TOKEN]));
    expect(llamadas).toEqual([]);
    const ayuda = await cli({}, ['--help']);
    expect(ayuda.status).toBe(0); expect(ayuda.stdout).toContain('RELEASE_TOKEN');
    expect(llamadas).toEqual([]);
});
