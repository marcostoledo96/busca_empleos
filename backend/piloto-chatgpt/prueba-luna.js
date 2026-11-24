const { homedir } = require('node:os');
const { join } = require('node:path');
const { transporteManual } = require('./manual');
const { abrirSesion } = require('./oauth');
const { crearClienteResponses } = require('./responses');

const MODELO = 'gpt-6-luna';
const RESPONSES = 'https://api.openai.com/v1/responses';
const USO = 'Uso: node backend/piloto-chatgpt/prueba-luna.js --creditos-desactivados';
const CASO = 'Oferta ficticia: Soporte IT Junior, presencial en CABA; Active Directory se menciona sin indicar si es obligatorio. Perfil ficticio: soporte básico, experiencia con Active Directory desconocida. Devolvé únicamente un objeto JSON con estado "por_confirmar" y motivo breve; no inventes experiencia.';
const CODIGOS = new Set(['acceso_rechazado', 'limite_de_uso', 'proveedor_no_disponible', 'salida_invalida',
    'plazo_agotado', 'respuesta_incompleta', 'respuesta_fallida', 'stream_interrumpido', 'fallo_de_transporte',
    'sin-sesion', 'alcance-insuficiente', 'cancelado']);

async function ejecutar(args, { interactivo, fetch = globalThis.fetch, abrir = abrirSesion, escribir = console.log, signal } = {}) {
    if (args.length === 1 && args[0] === '--help') { escribir(USO); return 0; }
    if (args.length !== 1 || args[0] !== '--creditos-desactivados') { escribir(USO); return 2; }
    if (!interactivo) { escribir('La prueba requiere una terminal interactiva en Ubuntu.'); return 2; }

    let sesion;
    let enviado = false;
    let fallo;
    try {
        signal?.throwIfAborted();
        const transporteOAuth = transporteManual('vincular', fetch, signal);
        sesion = abrir({ modo: 'local-manual', directorio: join(homedir(), '.config', 'busco-trabajo-catalogo'), fetch: transporteOAuth });
        // Consumo el único intento antes de enviarlo: un fallo de red no habilita otro.
        const cliente = crearClienteResponses({ fetch: (destino, opciones) => {
            if (enviado || destino !== RESPONSES || opciones.method !== 'POST') throw new Error('Solicitud no autorizada.');
            signal?.throwIfAborted();
            enviado = true;
            return fetch(destino, { ...opciones, signal: signal ? AbortSignal.any([signal, opciones.signal]) : opciones.signal });
        } });
        await sesion.conToken((contexto) => cliente.generarRespuesta({ ...contexto, modelo: MODELO,
            input: [{ role: 'user', content: CASO }],
            validar: (datos) => datos?.estado === 'por_confirmar' && typeof datos.motivo === 'string' && Boolean(datos.motivo.trim())
                && Object.keys(datos).length === 2,
        }));
    } catch (error) {
        fallo = CODIGOS.has(error?.codigo) ? error.codigo : 'sin_diagnostico';
    } finally {
        try { await sesion?.cerrar(); } catch { fallo = 'cierre_local'; }
    }
    if (signal?.aborted || fallo) {
        escribir(`Prueba no completada (${signal?.aborted ? 'cancelado' : fallo}). No la repitas.`);
        return signal?.aborted ? 130 : 1;
    }
    escribir(JSON.stringify({ modelo: MODELO, estado: 'por_confirmar', salida_validada: true }));
    return 0;
}

if (require.main === module) {
    const control = new AbortController();
    const abortar = () => control.abort();
    process.once('SIGINT', abortar);
    process.once('SIGTERM', abortar);
    ejecutar(process.argv.slice(2), {
        interactivo: process.platform === 'linux' && process.stdin.isTTY && process.stdout.isTTY,
        signal: control.signal,
    }).then((codigo) => { process.exitCode = codigo; }).finally(() => {
        process.removeListener('SIGINT', abortar);
        process.removeListener('SIGTERM', abortar);
    });
}

module.exports = { ejecutar };
