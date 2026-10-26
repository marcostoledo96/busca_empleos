const http = require('http');
const https = require('https');
const { randomBytes } = require('crypto');
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const entero = valor => Number.isSafeInteger(valor) && valor >= 0;
const texto = valor => typeof valor === 'string' && valor.length > 0;
const fecha = valor => texto(valor) && Number.isFinite(Date.parse(valor));
const strings = valor => Array.isArray(valor) && valor.every(item => typeof item === 'string');
const ofertas = valor => Array.isArray(valor) && valor.every(fila => objeto(fila) && entero(fila.id) && fila.id > 0
    && texto(fila.titulo) && (fila.empresa === null || typeof fila.empresa === 'string') && texto(fila.plataforma));
const contratos = [
    ['/api/salud', cuerpo => cuerpo.mensaje === 'El servidor está funcionando correctamente.'],
    ['/api/ofertas', cuerpo => ofertas(cuerpo.datos) && entero(cuerpo.total) && cuerpo.total >= cuerpo.datos.length
        && cuerpo.pagina === 1 && cuerpo.limite_pagina === null && cuerpo.total === cuerpo.datos.length],
    ['/api/ofertas/sincronizacion?limite=100', cuerpo => ofertas(cuerpo.datos) && cuerpo.datos.length <= 100
        && fecha(cuerpo.fecha_corte) && entero(cuerpo.max_id) && entero(cuerpo.total_inicial)
        && cuerpo.total_inicial >= cuerpo.datos.length && cuerpo.datos.every(fila => fila.id <= cuerpo.max_id)
        && typeof cuerpo.completada === 'boolean'
        && (cuerpo.completada ? cuerpo.cursor_siguiente === null : texto(cuerpo.cursor_siguiente))],
    ['/api/automatizacion/historial', cuerpo => Array.isArray(cuerpo.datos) && cuerpo.datos.every(fila =>
        objeto(fila) && typeof fila.id === 'string' && /^[1-9]\d*$/.test(fila.id)
        && ['individual', 'ciclo_manual', 'cron'].includes(fila.tipo)
        && fecha(fila.inicio) && (fila.fin === null || fecha(fila.fin) && Date.parse(fila.fin) >= Date.parse(fila.inicio))
        && ['ejecutando', 'completada', 'sin_resultados', 'parcial', 'error', 'timeout', 'sin_credenciales',
            'deshabilitada', 'omitida', 'cancelada', 'interrumpida'].includes(fila.estado))],
    ['/api/scraping/previsualizacion', cuerpo => objeto(cuerpo.datos) && Array.isArray(cuerpo.datos.plataformas)
        && cuerpo.datos.plataformas.length > 0 && cuerpo.datos.plataformas.every(fila => objeto(fila)
            && texto(fila.plataforma) && texto(fila.nombre) && typeof fila.habilitada === 'boolean'
            && typeof fila.ejecutable === 'boolean' && (!fila.ejecutable || fila.habilitada)
            && strings(fila.terminos) && strings(fila.consultasEfectivas) && strings(fila.advertencias)
            && entero(fila.ventanaDias) && fila.ventanaDias > 0 && entero(fila.maxResultados) && fila.maxResultados > 0)],
    ['/api/preferencias', cuerpo => objeto(cuerpo.datos) && cuerpo.datos.id === 1
        && strings(cuerpo.datos.terminos_busqueda) && strings(cuerpo.datos.reglas_exclusion)
        && strings(cuerpo.datos.stack_tecnologico) && objeto(cuerpo.datos.perfil_efectivo)
        && texto(cuerpo.firma_criterios_evaluacion)],
];

function leer(url, token) {
    return new Promise(resolve => {
        let codigo = 0, terminado = false, bytes = 0;
        const inicio = Date.now();
        const finalizar = (motivo, cuerpo) => {
            if (terminado) return;
            terminado = true;
            clearTimeout(plazo);
            resolve({ codigo, duracion: Date.now() - inicio, motivo, cuerpo });
        };
        const transporte = url.protocol === 'https:' ? https : http;
        const req = transporte.request(url, { method: 'GET', agent: false, headers: {
            Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        } }, res => {
            codigo = res.statusCode;
            if (codigo !== 200) { finalizar(codigo === 401 || codigo === 403 ? 'NO VERIFICADO' : 'FALLO HTTP'); res.destroy(); return; }
            const cache = `${res.headers['x-cache'] || ''} ${res.headers['cf-cache-status'] || ''}`;
            if (res.headers.age !== undefined || /\b(HIT|STALE|UPDATING|REVALIDATED)\b/i.test(cache)) {
                finalizar('FALLO caché'); res.destroy(); return;
            }
            if (!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] || '')) {
                finalizar('FALLO tipo de respuesta'); res.destroy(); return;
            }
            const partes = [];
            res.on('data', parte => {
                bytes += parte.length;
                if (bytes > 1024 * 1024) { finalizar('FALLO límite de cuerpo'); res.destroy(); return; }
                partes.push(parte);
            });
            res.on('end', () => {
                try { finalizar(null, JSON.parse(Buffer.concat(partes).toString('utf8'))); }
                catch { finalizar('FALLO JSON inválido'); }
            });
            res.on('error', () => finalizar('NO VERIFICADO transporte'));
            res.on('aborted', () => finalizar('NO VERIFICADO transporte'));
        });
        // El plazo absoluto también limita DNS/TLS y respuestas que gotean bytes.
        const plazo = setTimeout(() => { finalizar('NO VERIFICADO tiempo agotado'); req.destroy(); }, 5000);
        req.on('error', () => finalizar('NO VERIFICADO transporte'));
        req.end();
    });
}

async function main(argumentos = process.argv.slice(2), entorno = process.env) {
    if (argumentos.length === 1 && argumentos[0] === '--help') {
        console.log('Uso: node scripts/smoke-release.js\nRELEASE_URL: origen HTTPS explícito. RELEASE_TOKEN: sesión Firebase sólo en entorno, nunca argv.\nSólo seis GET; 5s y 1 MiB por respuesta. HTTP sólo loopback con NODE_ENV=test y DB_TEST_SINTETICA=true.\nExit 0: seis contratos efectivos; exit 1: FALLO o NO VERIFICADO. No imprime cuerpos ni revisa logs del servidor.');
        return 0;
    }
    let origen;
    const token = entorno.RELEASE_TOKEN || '';
    try {
        if (argumentos.length || !entorno.RELEASE_URL || token && !/^[A-Za-z0-9._~-]+$/.test(token)) throw new Error();
        origen = new URL(entorno.RELEASE_URL);
        const loopback = ['127.0.0.1', '[::1]'].includes(origen.hostname);
        if (origen.username || origen.password || origen.pathname !== '/' || origen.search || origen.hash
            || !(origen.protocol === 'https:' || origen.protocol === 'http:' && loopback
                && entorno.NODE_ENV === 'test' && entorno.DB_TEST_SINTETICA === 'true')) throw new Error();
    } catch {
        console.log('SMOKE: NO VERIFICADO (configuración u opciones no permitidas; consulte --help)');
        return 1;
    }
    let fallo = false, desconocido = !token;
    const nonce = randomBytes(12).toString('hex');
    for (const [ruta, validar] of contratos) {
        const url = new URL(ruta, origen);
        url.searchParams.set('_smoke', nonce);
        const resultado = await leer(url, ruta === '/api/salud' ? '' : token);
        let motivo = resultado.motivo;
        if (!motivo && (!objeto(resultado.cuerpo) || resultado.cuerpo.exito !== true || !validar(resultado.cuerpo))) motivo = 'FALLO contrato inválido';
        if (motivo?.startsWith('NO VERIFICADO')) desconocido = true;
        else if (motivo) fallo = true;
        console.log(`GET ${ruta} HTTP ${resultado.codigo} ${resultado.duracion}ms ${motivo || 'OK'}`);
    }
    console.log(`SMOKE: ${desconocido ? 'NO VERIFICADO' : fallo ? 'FALLO' : 'OK'}`);
    return fallo || desconocido ? 1 : 0;
}
if (require.main === module) {
    main().then(codigo => { process.exitCode = codigo; }).catch(() => {
        console.log('SMOKE: NO VERIFICADO (error interno)'); process.exitCode = 1;
    });
}
module.exports = { main };
