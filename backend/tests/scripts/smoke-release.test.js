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
let servidor, cambiar, llamadas = [], llamadasAjenas = [];
async function cli(entorno = {}, args = []) {
    const inicio = llamadas.length;
    const resultado = await new Promise(resolve => {
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
    const propias = llamadas.slice(inicio);
    if (resultado.stdout.startsWith('GET ')) {
        expect(propias).toHaveLength(6);
        const urls = propias.map(llamada => new URL(llamada.url, 'http://localhost'));
        const nonce = urls[0].searchParams.get('_smoke');
        expect(nonce).toMatch(/^[a-f0-9]{24}$/);
        expect(urls.map(url => url.searchParams.getAll('_smoke'))).toEqual(Array(6).fill([nonce]));
        expect(urls.map(url => {
            url.searchParams.delete('_smoke');
            return `${url.pathname}${url.search}`;
        })).toEqual(Object.keys(cuerpos).map(ruta => ruta.endsWith('sincronizacion') ? `${ruta}?limite=100` : ruta));
        for (const [i, llamada] of propias.entries()) {
            expect(llamada.method).toBe('GET');
            const token = entorno.RELEASE_TOKEN ?? TOKEN;
            expect(llamada.headers.authorization).toBe(i && token ? `Bearer ${token}` : undefined);
        }
    } else {
        expect(propias).toEqual([]);
    }
    return resultado;
}
beforeAll(async () => {
    servidor = await new Promise(resolve => {
        const s = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost');
            const llamada = { url: req.url, headers: req.headers, method: req.method };
            res.setHeader('Content-Type', 'application/json');
            if (!url.searchParams.has('_smoke') && !req.headers.authorization) {
                llamadasAjenas.push({ ...llamada, estado: 404 });
                res.writeHead(404).end();
                return;
            }
            // Registro también nonce inválido, auth inesperada y rutas ajenas al contrato para que fallen las assertions.
            llamadas.push(llamada);
            const ruta = url.pathname;
            if (!Object.hasOwn(cuerpos, ruta)) { res.writeHead(404).end(); return; }
            if (cambiar?.(ruta, req, res)) return;
            res.end(JSON.stringify(cuerpos[ruta]));
        }).listen(0, '127.0.0.1', () => resolve(s));
    });
});
beforeEach(() => { llamadas = []; llamadasAjenas = []; cambiar = null; });
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
test('separo un GET raíz ajeno sin contaminar los seis GET del CLI', async () => {
    const estadoAjeno = await new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: servidor.address().port, path: '/',
            headers: { 'X-Prueba-Ajena': 'inyeccion-local' } }, res => {
            res.resume();
            res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
    });
    const resultado = await cli();
    expect(llamadas).toHaveLength(6);
    expect(estadoAjeno).toBe(404);
    expect(llamadasAjenas).toContainEqual(expect.objectContaining({ url: '/', method: 'GET', estado: 404,
        headers: expect.objectContaining({ 'x-prueba-ajena': 'inyeccion-local' }) }));
    expect(resultado.status).toBe(0);
    expect(resultado.stderr).toBe('');
    expect(resultado.stdout).not.toContain(TOKEN);
    expect(resultado.stdout).not.toContain('contenido-privado');
    expect(resultado.stdout.replace(/\d+ms/g, '<tiempo>ms')).toBe(
        Object.keys(cuerpos).map(ruta => {
            const endpoint = ruta.endsWith('sincronizacion') ? `${ruta}?limite=100` : ruta;
            return `GET ${endpoint} HTTP 200 <tiempo>ms OK\n`;
        }).join('') + 'SMOKE: OK\n',
    );
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

test.each([
    'ejecutando', 'completada', 'sin_resultados', 'parcial', 'error', 'timeout',
    'sin_credenciales', 'deshabilitada', 'omitida', 'cancelada', 'interrumpida',
    'desconocida', null, '',
])('valido el estado de historial %s sin exponer contenido privado', async estado => {
    cambiar = (ruta, req, res) => {
        if (ruta !== '/api/automatizacion/historial') return false;
        res.end(JSON.stringify({ exito: true, datos: [{ id: '1', tipo: 'individual',
            inicio: '2026-10-26T00:00:00.000Z', fin: null, estado,
            resumen: { detalle: 'contenido-privado' } }] }));
        return true;
    };
    const valido = !['desconocida', null, ''].includes(estado);
    const resultado = await cli();
    expect(resultado.status).toBe(valido ? 0 : 1);
    expect(resultado.stderr).toBe('');
    expect(resultado.stdout).not.toContain(TOKEN);
    expect(resultado.stdout).not.toContain('contenido-privado');
    expect(resultado.stdout.replace(/\d+ms/g, '<tiempo>ms')).toBe(
        Object.keys(cuerpos).map(ruta => {
            const endpoint = ruta.endsWith('sincronizacion') ? `${ruta}?limite=100` : ruta;
            const estadoContrato = !valido && ruta === '/api/automatizacion/historial'
                ? 'FALLO contrato inválido' : 'OK';
            return `GET ${endpoint} HTTP 200 <tiempo>ms ${estadoContrato}\n`;
        }).join('') + `SMOKE: ${valido ? 'OK' : 'FALLO'}\n`,
    );
    expect(llamadas).toHaveLength(6);
    expect(llamadas.every(llamada => llamada.method === 'GET')).toBe(true);
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
