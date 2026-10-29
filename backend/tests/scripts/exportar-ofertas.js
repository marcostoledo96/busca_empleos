// Exporto únicamente datos auditables, sin iniciar la aplicación ni cargar dotenv.
const fs = require('fs');
const path = require('path');
const net = require('net');
const { construirPerfilEfectivo } = require('../../src/servicios/evaluacion/perfil-efectivo');
const { VERSION_PRIORIDAD_IA } = require('../../src/servicios/evaluacion/detector-prioridad-ia');

const DIRECTORIO_SALIDA = path.resolve(__dirname, '../../../.qa-runtime/issue69');
const CAMPOS = Object.freeze([
    'id', 'titulo', 'empresa', 'ubicacion', 'modalidad', 'descripcion', 'url', 'plataforma',
    'nivel_requerido', 'estado_evaluacion', 'porcentaje_match', 'razon_evaluacion',
    'explicacion_evaluacion', 'evaluacion_error_mensaje', 'fecha_evaluacion',
    'firma_criterios_evaluacion', 'fecha_publicacion', 'fecha_extraccion', 'fecha_ultima_extraccion',
    'origen_descripcion', 'descripcion_completitud',
]);
const CATEGORIAS = ['cumplidos', 'no_cumplidos', 'por_confirmar', 'exclusiones'];
const CAMPOS_REQUISITO = ['requisito', 'tipo', 'evidencia_oferta', 'evidencia_perfil', 'explicacion'];
const MENSAJE_RECHAZO = 'Exportación rechazada: autorización o destino inválido.';
const MENSAJE_ERROR = 'No pude completar la exportación. No comparta una salida sin resumen completo.';
const SQL_IDENTIDAD = `SELECT current_database() AS base, current_user AS usuario,
    inet_server_addr()::text AS servidor, inet_server_port() AS puerto,
    current_setting('port') AS puerto_configurado,
    current_setting('default_transaction_read_only') AS solo_lectura,
    current_setting('transaction_read_only') AS transaccion_solo_lectura`;
const SQL_PREFERENCIAS = 'SELECT to_jsonb(p) AS preferencias FROM preferencias p WHERE id = 1';
const SQL_COLUMNAS = `SELECT attname AS columna FROM pg_catalog.pg_attribute
WHERE attrelid = pg_catalog.to_regclass('ofertas') AND attnum > 0 AND NOT attisdropped`;

function construirConsultaOfertas(columnas) {
    const disponibles = new Set(columnas);
    // Solo interpolo identificadores constantes de la allowlist, nunca nombres recibidos.
    const proyeccion = CAMPOS.map(campo => disponibles.has(campo) ? campo : `NULL AS ${campo}`);
    // Un único SELECT mantiene el conteo y las filas en el mismo snapshot, incluso sin filas.
    return `WITH fuente AS MATERIALIZED (
    SELECT ${proyeccion.join(', ')} FROM ofertas
), conteo AS (SELECT count(*)::text AS total_sql FROM fuente)
SELECT conteo.total_sql, to_jsonb(fuente) AS oferta
FROM conteo LEFT JOIN fuente ON true ORDER BY fuente.id ASC`;
}
const SQL_OFERTAS = construirConsultaOfertas(CAMPOS);

function urlPublica(valor) {
    try {
        const url = new URL(valor);
        const host = url.hostname.toLowerCase();
        if (!['http:', 'https:'].includes(url.protocol) || !host.includes('.')
            || net.isIP(host.replace(/^\[|\]$/g, '')) || /(?:^|\.)(localhost|local|internal|lan|test)$/.test(host)) return null;
        const rutaDecodificada = decodeURIComponent(url.pathname);
        if (/@|token|password|secret|cookie|authorization|bearer|\+\d/i.test(rutaDecodificada)) return null;
        const idIndeed = ['indeed.com', 'www.indeed.com', 'ar.indeed.com'].includes(host)
            && url.pathname === '/viewjob' && url.searchParams.getAll('jk').length === 1
            ? url.searchParams.get('jk') : null;
        url.username = '';
        url.password = '';
        url.search = '';
        if (/^[a-f0-9]{16}$/i.test(idIndeed || '')) url.searchParams.set('jk', idIndeed);
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function sanitizarTexto(valor) {
    if (typeof valor !== 'string') return null;
    const valorCabecera = String.raw`(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s;,]+)`;
    const parametroCabecera = String.raw`[\w.-]+[ \t]*=[ \t]*${valorCabecera}`;
    // Consumo el esquema y sus credenciales/parámetros, no los requisitos tras el separador.
    const autorizacion = new RegExp(String.raw`\b(?:proxy-)?authorization["']?\s*[:=][ \t]*(?:[a-z][\w.+~-]*[ \t]+)?(?:${parametroCabecera}|${valorCabecera})(?:[ \t]*,[ \t]*${parametroCabecera})*`, 'gi');
    const cookies = new RegExp(String.raw`\b(?:set-)?cookie["']?\s*[:=][ \t]*(?:${parametroCabecera}|${valorCabecera})(?:[ \t]*;[ \t]*${parametroCabecera})*`, 'gi');
    return valor
        .replace(autorizacion, '[secreto omitido]')
        .replace(cookies, '[secreto omitido]')
        .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s<>"']+/gi, enlace => urlPublica(enlace) || '[URL omitida]')
        .replace(/\b(?:mailto|tel|data|javascript):[^\s<>]+/gi, '[contacto omitido]')
        .replace(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]{2,}/gi, '[correo omitido]')
        .replace(/\b((?:tel(?:[ée]fono)?|celular|whatsapp|contacto)[ \t]*[:=]?[ \t]*)(\+?\d[\d ().-]{6,}\d)/gi,
            (original, prefijo, telefono) => {
                const cantidadDigitos = (telefono.match(/\d/g) || []).length;
                return cantidadDigitos >= 8 && cantidadDigitos <= 15 ? `${prefijo}[teléfono omitido]` : original;
            })
        .replace(/(?<![\p{L}\p{N}/])\+(?:\d[ ().-]?){7,14}\d(?!\d)/gu, '[teléfono omitido]')
        .replace(/\b(?:bearer\s+\S+|(?:token|api[_ -]?key|password|contrase(?:ñ|n)a|secret|cookie|authorization|credencial)[\w-]*["']?\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s;,]+))/gi, '[secreto omitido]');
}

function redactarIdentidad(valor, nombre) {
    if (typeof nombre !== 'string' || nombre.trim().split(/\s+/).length < 2 || nombre.trim().length < 6) return valor;
    const nombreEscapado = nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patron = new RegExp(`(?<![\\p{L}\\p{N}])${nombreEscapado}(?![\\p{L}\\p{N}])`, 'giu');
    const recorrer = dato => {
        if (typeof dato === 'string') return dato.replace(patron, '[identidad omitida]');
        if (Array.isArray(dato)) return dato.map(recorrer);
        if (dato && typeof dato === 'object') return Object.fromEntries(Object.entries(dato).map(([clave, contenido]) => [clave, recorrer(contenido)]));
        return dato;
    };
    return recorrer(valor);
}

function valorSimple(valor) {
    if (typeof valor === 'string') return sanitizarTexto(valor);
    if (typeof valor === 'number' || typeof valor === 'boolean') return valor;
    return null;
}

function explicacionSegura(valor) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    return Object.fromEntries(CATEGORIAS.map(categoria => [categoria,
        Array.isArray(valor[categoria]) ? valor[categoria].map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            return Object.fromEntries(CAMPOS_REQUISITO.map(campo => [campo, sanitizarTexto(item[campo])]));
        }).filter(Boolean) : [],
    ]));
}

function resumirCriterios(preferencias) {
    if (!preferencias) return { disponible: false, firma_actual: null };
    const perfil = construirPerfilEfectivo(preferencias);
    const candidato = perfil.candidato;
    const laborales = perfil.restricciones.preferencias;
    const listaTextos = valor => Array.isArray(valor) ? valor.map(sanitizarTexto).filter(v => v !== null) : [];
    return {
        disponible: true,
        alcance: 'Criterios actuales; no reconstruyen el perfil histórico ni certifican confirmación humana.',
        roles_objetivo: Array.isArray(laborales.roles_objetivo_detalle)
            ? laborales.roles_objetivo_detalle.map(rol => typeof rol === 'string' ? sanitizarTexto(rol)
                : { rol: sanitizarTexto(rol?.rol), prioridad: sanitizarTexto(rol?.prioridad),
                    aliases: listaTextos(rol?.aliases) }) : [],
        tecnologias_comprobadas: candidato.tecnologias_detalle.map(tecnologia => ({
            nombre: sanitizarTexto(tecnologia.nombre), nivel: sanitizarTexto(tecnologia.nivel),
        })),
        stack_legacy_sin_nivel: listaTextos(candidato.stack_tecnologico),
        experiencia: { nivel: sanitizarTexto(candidato.nivel_real_seniority), anios: valorSimple(candidato.anios_experiencia_reales) },
        modalidades: sanitizarTexto(laborales.modalidad_aceptada),
        zonas: listaTextos(laborales.zonas_preferidas),
        idiomas: { ingles: Object.fromEntries(['espanol', 'reading', 'writing', 'speaking', 'listening', 'regla']
            .map(campo => [campo, sanitizarTexto(candidato.nivel_ingles_detalle?.[campo])])), legacy: sanitizarTexto(candidato.idioma_candidato) },
        exclusiones: { adicionales: listaTextos(laborales.reglas_exclusion), obligatorias: listaTextos(perfil.restricciones.politicas_sistema) },
        criterios_adicionales_ia: {
            activos: preferencias.usar_prompt_personalizado === true,
            detalle: 'omitido_privacidad_no_reconstruible',
        },
        instrucciones_efectivas_completas: false,
        limite_perfil: 'Resumen estructurado sin prompts ni narrativas personales. Los criterios personalizados activos pueden cambiar las instrucciones efectivas y no se reconstruyen aquí.',
        prioridad_ia: {
            version: VERSION_PRIORIDAD_IA,
            seniales: ['Claude Code', 'Codex', 'OpenCode', 'GitHub Copilot', 'ChatGPT', 'IA/AI generativa', 'LLM', 'prompt engineering', 'Next.js'],
            ranking_separado: true, modifica_match: false, no_compensa_exclusiones: true,
            politica: 'Ignoro menciones negadas; dos puntos por categoría, máximo seis, hasta tres evidencias. No otorgo bonus fijo al porcentaje de match.',
            orden_priorizado_activo: preferencias.priorizar_ofertas_ia === true,
            maximo_ranking_configurado: valorSimple(preferencias.bonus_maximo_prioridad_ia),
        },
        firma_actual: null,
        motivo_firma_desconocida: 'El helper canónico importa configuración con dotenv; no lo cargo ni duplico su algoritmo. No comparo firmas contra resúmenes sanitizados.',
    };
}

function sanitizarOferta(oferta) {
    const salida = Object.fromEntries(CAMPOS.map(campo => [campo, valorSimple(oferta[campo])]));
    // Las firmas canónicas y magnitudes numéricas no son texto de contacto.
    if (typeof oferta.firma_criterios_evaluacion === 'string' && /^[a-f0-9]{64}$/i.test(oferta.firma_criterios_evaluacion)) {
        salida.firma_criterios_evaluacion = oferta.firma_criterios_evaluacion;
    }
    for (const campo of ['id', 'porcentaje_match']) {
        if (typeof oferta[campo] === 'string' && /^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(oferta[campo])) salida[campo] = oferta[campo];
    }
    salida.url = urlPublica(oferta.url);
    salida.explicacion_evaluacion = explicacionSegura(oferta.explicacion_evaluacion);
    salida.vigencia_evaluacion = 'desconocida';
    salida.autoria_evaluacion = 'no_persistida';
    salida.precision_fecha_evaluacion = oferta.fecha_evaluacion ? 'no_verificable_puede_incluir_backfill' : 'ausente';
    return salida;
}

function validarOpciones(opciones) {
    if (opciones.autorizar !== true || !['servidor', 'base', 'usuario', 'salida'].every(campo => typeof opciones[campo] === 'string' && opciones[campo].trim())
        || !Number.isInteger(opciones.puerto) || opciones.puerto < 1 || opciones.puerto > 65535
        || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(opciones.salida)) throw new Error(MENSAJE_RECHAZO);
}

function crearCliente(opciones) {
    const { Client } = require('pg');
    // No acepto connectionString ni opciones arbitrarias que puedan anular estas guardas.
    return new Client({
        host: opciones.servidor, port: opciones.puerto, database: opciones.base, user: opciones.usuario,
        password: process.env.PGPASSWORD ?? '',
        options: '-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000',
        application_name: 'auditoria_matching_lectura', connectionTimeoutMillis: 10000,
    });
}

async function exportarOfertas(opciones, dependencias = {}) {
    validarOpciones(opciones);
    const cliente = (dependencias.crearCliente || crearCliente)(opciones);
    const baseSalida = dependencias.directorioSalida || DIRECTORIO_SALIDA;
    let directorio;
    let archivo;
    try {
        await cliente.connect();
        const identidad = (await cliente.query(SQL_IDENTIDAD)).rows[0];
        const socket = opciones.servidor.startsWith('/');
        if (!identidad || identidad.base !== opciones.base || identidad.usuario !== opciones.usuario
            || String(identidad.puerto ?? identidad.puerto_configurado) !== String(opciones.puerto)
            || (socket ? identidad.servidor !== null : identidad.servidor !== opciones.servidor)
            || identidad.solo_lectura !== 'on' || identidad.transaccion_solo_lectura !== 'on') throw new Error(MENSAJE_RECHAZO);
        const preferencias = (await cliente.query(SQL_PREFERENCIAS)).rows[0]?.preferencias;
        const criterios = redactarIdentidad(resumirCriterios(preferencias), preferencias?.nombre);
        const columnas = (await cliente.query(SQL_COLUMNAS)).rows.map(fila => fila.columna);
        const camposAusentes = CAMPOS.filter(campo => !columnas.includes(campo));
        const sqlOfertas = construirConsultaOfertas(columnas);
        for (const ruta of [path.dirname(baseSalida), baseSalida]) {
            if (!fs.existsSync(ruta)) fs.mkdirSync(ruta, { mode: 0o700 });
            if (!fs.lstatSync(ruta).isDirectory() || fs.lstatSync(ruta).isSymbolicLink()) throw new Error(MENSAJE_ERROR);
        }
        if (fs.statSync(baseSalida).mode & 0o077) throw new Error(MENSAJE_ERROR);
        directorio = path.join(baseSalida, opciones.salida);
        fs.mkdirSync(directorio, { mode: 0o700 });
        archivo = fs.openSync(path.join(directorio, 'busco-trabajo-auditoria-matching.jsonl'), 'wx', 0o600);
        const resumen = {
            completo: false, tipo: opciones.sintetico === true ? 'sintetico_no_productivo' : 'exportacion_autorizada',
            version_esquema_exportacion: 'auditoria-matching-v1', exportado_en: new Date().toISOString(),
            campos_ausentes: camposAusentes,
            total_sql: null, total_exportado: 0, estados: { aprobada: 0, rechazada: 0, pendiente: 0, otros: 0 },
            errores_tecnicos: 0, reevaluaciones_solicitadas: 0, vigencia: { actual: 0, anterior: 0, desconocida: 0 },
            limites: ['Solo última evaluación almacenada por oferta, no ledger de decisiones.',
                'Firma no reversible; criterios actuales no se atribuyen al pasado.',
                'Autoría no persistida; fecha almacenada puede ser backfill.',
                'Sanitización heurística; revisión humana local obligatoria antes de compartir.'],
        };
        const { Query } = require('pg');
        await new Promise((resolver, rechazar) => {
            const consulta = cliente.query(new Query(sqlOfertas));
            let fallo;
            consulta.on('row', fila => {
                if (fallo) return;
                try {
                    const total = String(fila.total_sql);
                    if (!/^\d+$/.test(total) || (resumen.total_sql !== null && resumen.total_sql !== total)) throw new Error(MENSAJE_ERROR);
                    resumen.total_sql = total;
                    if (fila.oferta === null) return;
                    const oferta = redactarIdentidad(sanitizarOferta(fila.oferta), preferencias?.nombre);
                    fs.writeSync(archivo, `${JSON.stringify(oferta)}\n`, null, 'utf8');
                    resumen.total_exportado++;
                    const estado = ['aprobada', 'rechazada', 'pendiente'].includes(oferta.estado_evaluacion) ? oferta.estado_evaluacion : 'otros';
                    resumen.estados[estado]++;
                    resumen.vigencia.desconocida++;
                    if (fila.oferta.evaluacion_error_mensaje === 'REEVALUACION_SOLICITADA') resumen.reevaluaciones_solicitadas++;
                    else if (fila.oferta.evaluacion_error_mensaje) resumen.errores_tecnicos++;
                } catch (error) { fallo = error; }
            });
            consulta.on('error', rechazar);
            consulta.on('end', () => fallo ? rechazar(fallo) : resolver());
        });
        fs.closeSync(archivo);
        archivo = undefined;
        if (resumen.total_sql !== String(resumen.total_exportado)) throw new Error(MENSAJE_ERROR);
        const escribirJson = (nombre, valor) => fs.writeFileSync(path.join(directorio, nombre), `${JSON.stringify(valor, null, 4)}\n`, { flag: 'wx', mode: 0o600 });
        escribirJson('busco-trabajo-criterios-sanitizados.json', criterios);
        resumen.completo = true;
        escribirJson('resumen.json', resumen);
        return resumen;
    } catch (error) {
        throw new Error(error.message === MENSAJE_RECHAZO ? MENSAJE_RECHAZO : MENSAJE_ERROR);
    } finally {
        if (archivo !== undefined) fs.closeSync(archivo);
        await cliente.end().catch(() => {});
    }
}

const AYUDA = `Uso: node backend/tests/scripts/exportar-ofertas.js --autorizar --servidor IP_O_SOCKET --puerto NUMERO --base BASE --usuario ROL_LECTOR --salida NOMBRE_NUEVO [--sintetico]
Solo SELECT. No cargo dotenv ni DATABASE_URL. PGPASSWORD es opcional y nunca se imprime.
Compruebo servidor, puerto, base, usuario y modo read-only antes de leer ofertas.
Uso IP literal para TCP (no hostname DNS); para Unix compruebo socket local y puerto configurado.
Salida privada exclusiva: .qa-runtime/issue69/NOMBRE_NUEVO/; no sobrescribo directorios.
JSONL UTF-8 completo, criterios sanitizados sin prompts privados y resumen.json como marca de finalización.
El resumen informa versión de formato, fecha de exportación y columnas ausentes (exportadas como null).
--sintetico etiqueta una prueba; no sustituye el origen SQL. --help muestra esta ayuda.
Reviso manualmente los archivos locales antes de compartir: la sanitización es heurística.
`;

async function ejecutarCli(argumentos = process.argv.slice(2)) {
    if (argumentos.length === 1 && argumentos[0] === '--help') {
        process.stdout.write(AYUDA);
        return;
    }
    try {
        const opciones = {};
        for (let indice = 0; indice < argumentos.length; indice++) {
            const clave = argumentos[indice].replace(/^--/, '');
            if (!argumentos[indice].startsWith('--') || !['autorizar', 'servidor', 'puerto', 'base', 'usuario', 'salida', 'sintetico'].includes(clave)
                || Object.hasOwn(opciones, clave)) throw new Error(MENSAJE_RECHAZO);
            opciones[clave] = ['autorizar', 'sintetico'].includes(clave) ? true : argumentos[++indice];
        }
        opciones.puerto = Number(opciones.puerto);
        await exportarOfertas(opciones);
        process.stdout.write('Exportación completa; revise los archivos privados antes de compartir.\n');
    } catch (error) {
        process.stderr.write(`${error.message === MENSAJE_RECHAZO ? MENSAJE_RECHAZO : MENSAJE_ERROR}\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) ejecutarCli();
module.exports = { exportarOfertas, ejecutarCli, CAMPOS, SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_OFERTAS, SQL_COLUMNAS, construirConsultaOfertas };
