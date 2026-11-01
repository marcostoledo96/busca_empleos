// Compruebo el mismo pipeline con PostgreSQL real y relaciones sintéticas, sin DDL/DML.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { exportarOfertas, CAMPOS, SQL_PREFERENCIAS, SQL_COLUMNAS, construirConsultaOfertas } = require('./exportar-ofertas');
const casos = require('./fixtures/issue-69-casos.json');

function obtenerCasos() {
    const ofertas = structuredClone(casos.ofertas);
    ofertas[10].descripcion = 'Unicode áéíóú ñ 🚀 C# .NET JavaScript 3+ años.\n'.repeat(5000);
    return { ...casos, ofertas };
}

function verificarSalida(directorio, ofertas) {
    const contenido = fs.readFileSync(path.join(directorio, 'busco-trabajo-auditoria-matching.jsonl'), 'utf8');
    const filas = contenido.trim().split('\n').filter(Boolean).map(linea => JSON.parse(linea));
    const criterios = JSON.parse(fs.readFileSync(path.join(directorio, 'busco-trabajo-criterios-sanitizados.json'), 'utf8'));
    const resumen = JSON.parse(fs.readFileSync(path.join(directorio, 'resumen.json'), 'utf8'));
    assert.equal(filas.length, 12);
    assert.equal(JSON.stringify(filas.map(fila => fila.id)), JSON.stringify(ofertas.map(fila => fila.id)));
    // Los doce escenarios conservan evidencia, sin convertir sospechas en veredictos.
    assert.equal(filas[0].explicacion_evaluacion.cumplidos[0].requisito, 'JavaScript');
    assert.equal(filas[0].estado_evaluacion, 'aprobada');
    assert.equal(filas[1].explicacion_evaluacion.exclusiones[0].tipo, 'obligatorio');
    assert.equal(filas[1].estado_evaluacion, 'rechazada');
    assert.equal(filas[2].estado_evaluacion, 'aprobada');
    assert.equal(filas[2].descripcion, 'Java obligatorio');
    assert.equal(filas[2].porcentaje_match, 90);
    assert.equal(filas[3].estado_evaluacion, 'rechazada');
    assert.equal(filas[3].descripcion, ofertas[3].descripcion);
    assert.equal(filas[4].explicacion_evaluacion, null);
    assert.equal(filas[4].porcentaje_match, null);
    assert.equal(filas[5].porcentaje_match, '140');
    assert.equal(filas[5].estado_evaluacion, 'aprobada');
    assert.equal(filas[6].evaluacion_error_mensaje, 'HTTP 503');
    assert.equal(filas[6].estado_evaluacion, 'pendiente');
    assert.equal(filas[7].descripcion, null);
    assert.equal(filas[7].origen_descripcion, 'tarjeta');
    assert.equal(filas[7].descripcion_completitud, 'parcial');
    assert.equal(filas[8].firma_criterios_evaluacion, 'firma-antigua');
    assert.equal(filas[8].fecha_evaluacion, ofertas[8].fecha_evaluacion);
    assert.equal(filas[8].precision_fecha_evaluacion, 'no_verificable_puede_incluir_backfill');
    assert.equal(filas[9].estado_evaluacion, 'estado_desconocido');
    assert.equal(filas[9].fecha_extraccion, ofertas[9].fecha_extraccion);
    assert.equal(filas[10].descripcion, ofertas[10].descripcion);
    assert.equal(filas[10].titulo, 'Unicode áéíóú ñ 🚀');
    assert.equal(filas[0].url, 'https://www.linkedin.com/jobs/view/4398123456/');
    assert.equal(filas[1].url, 'https://ar.indeed.com/viewjob?jk=abcdef0123456789');
    assert.equal(filas[4].url, 'https://www.bumeran.com.ar/empleos/desarrollo-1234567890.html');
    assert.equal(filas[5].url, 'https://ar.indeed.com/viewjob?jk=abcdef0123456789');
    assert.equal(filas[11].url, 'https://empleos.example/oferta');
    assert.ok(filas[11].descripcion.includes('Requiere experiencia ISO 27001 (2022), C# y .NET. Teléfono: [teléfono omitido]'));
    assert.ok(filas[11].descripcion.includes('[secreto omitido]; Java obligatorio'));
    assert.ok(filas[11].descripcion.includes('[secreto omitido]; Senior 5+ años'));
    assert.ok(filas[11].descripcion.includes('[secreto omitido]; C# y .NET'));
    assert.equal(filas[11].razon_evaluacion, '[secreto omitido]; Java obligatorio');
    assert.equal(filas[11].evaluacion_error_mensaje, '[secreto omitido]; C# y .NET');
    assert.ok(filas[11].descripcion.includes('JavaScript C# .NET 3+ años.'));
    const todo = contenido + JSON.stringify(criterios) + JSON.stringify(resumen);
    for (const privado of ['SECRETO', 'PRIVATE_', 'dXNlcjpwYXNz', 'contacto@example.invalid', '5555', 'usuario:clave', 'NOTA_NO_EXPORTAR', 'CV_NO_EXPORTAR', 'CV_COMPLETO_NO_EXPORTAR', 'Persona Sintética Reservada', 'IDENTIDAD_NO_EXPORTAR', 'RAZONAMIENTO_NO_EXPORTAR', 'reasoning_content', 'datos_crudos', 'estado_postulacion']) {
        assert.ok(!todo.includes(privado), 'No debo filtrar campos o valores privados.');
    }
    assert.equal(filas[11].explicacion_evaluacion.cumplidos[0].evidencia_perfil, null);
    assert.ok(filas.every(fila => fila.vigencia_evaluacion === 'desconocida' && fila.autoria_evaluacion === 'no_persistida'));
    assert.equal(resumen.total_sql, '12');
    assert.equal(resumen.total_exportado, 12);
    assert.equal(resumen.completo, true);
    assert.deepEqual(resumen.estados, { aprobada: 5, rechazada: 3, pendiente: 3, otros: 1 });
    assert.equal(resumen.errores_tecnicos, 2);
    assert.equal(resumen.reevaluaciones_solicitadas, 1);
    assert.equal(resumen.vigencia.desconocida, 12);
    assert.equal(criterios.roles_objetivo[0].rol, 'Desarrollo junior');
    assert.equal(criterios.tecnologias_comprobadas[0].nombre, 'JavaScript');
    assert.equal(criterios.experiencia.anios, 1);
    assert.equal(criterios.modalidades, 'cualquiera');
    assert.equal(criterios.zonas[0], 'Zona sintética');
    assert.equal(criterios.idiomas.ingles.reading, 'A2');
    assert.equal(criterios.exclusiones.adicionales[0], 'Java obligatorio');
    assert.equal(criterios.criterios_adicionales_ia.activos, true);
    assert.equal(criterios.criterios_adicionales_ia.detalle, 'omitido_privacidad_no_reconstruible');
    assert.equal(criterios.instrucciones_efectivas_completas, false);
    assert.equal(criterios.prioridad_ia.version, 'prioridad-ia-v1');
    assert.equal(criterios.prioridad_ia.modifica_match, false);
    assert.equal(criterios.roles_objetivo[0].evidencia, undefined);
    assert.equal(criterios.tecnologias_comprobadas[0].evidencia, undefined);
    assert.equal(resumen.version_esquema_exportacion, 'auditoria-matching-v1');
    assert.equal(new Date(resumen.exportado_en).toISOString(), resumen.exportado_en);
    assert.equal(filas[0].fecha_ultima_extraccion, ofertas[0].fecha_ultima_extraccion);
    assert.ok(filas[11].descripcion.includes('Java obligatorio, Senior 5+ años'));
    assert.equal(criterios.firma_actual, null);
    for (const archivo of fs.readdirSync(directorio)) assert.equal(fs.statSync(path.join(directorio, archivo)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(directorio).mode & 0o777, 0o700);
    return { escenarios: 12, filas: filas.length, total_sql: resumen.total_sql };
}

function adaptarCliente(cliente, datos, consultas) {
    return {
        connect: () => cliente.connect(), end: () => cliente.end(),
        query(consulta, valores) {
            const texto = typeof consulta === 'string' ? consulta : consulta.text;
            const disponibles = CAMPOS.filter(campo => !(datos.columnas_ausentes || []).includes(campo));
            const sqlOfertas = construirConsultaOfertas(disponibles);
            assert.ok(texto.startsWith('SELECT') || texto.startsWith('WITH'));
            consultas.push(texto === sqlOfertas ? 'SELECT proyección allowlisted/NULL + COUNT snapshot único'
                : texto === SQL_PREFERENCIAS ? 'SELECT preferencias sintéticas' : texto === SQL_COLUMNAS ? 'SELECT columnas sintéticas' : 'SELECT identidad/read-only');
            if (texto === SQL_PREFERENCIAS) return cliente.query('SELECT $1::jsonb AS preferencias', [JSON.stringify(datos.preferencias)]);
            if (texto === SQL_COLUMNAS) return cliente.query('SELECT unnest($1::text[]) AS columna', [disponibles]);
            if (texto === sqlOfertas) {
                const columnas = disponibles.map(campo => `${campo} ${campo === 'id' ? 'integer' : ['explicacion_evaluacion', 'porcentaje_match'].includes(campo) ? 'jsonb' : 'text'}`).join(', ');
                consulta.text = texto.replace('FROM ofertas', `FROM jsonb_to_recordset($1::jsonb) AS ofertas(${columnas})`);
                consulta.values = [JSON.stringify(datos.ofertas)];
            }
            return cliente.query(consulta, valores);
        },
    };
}

async function ejecutarPrueba(salida = process.argv[2] || 'salida-sintetica') {
    const { Client } = require('pg');
    const datos = obtenerCasos();
    datos.columnas_ausentes = ['fecha_publicacion'];
    const rutaSocket = path.resolve(__dirname, '../../../.qa-runtime/issue69/socket');
    // Evito el límite AF_UNIX de 108 bytes sin crear enlaces fuera del worktree.
    const descriptorSocket = fs.openSync(rutaSocket, 'r');
    const servidor = `/proc/self/fd/${descriptorSocket}`;
    const opciones = { autorizar: true, sintetico: true, servidor, puerto: 5432, base: 'postgres', usuario: 'postgres', salida };
    const configuracion = { host: servidor, port: 5432, database: 'postgres', user: 'postgres', options: '-c default_transaction_read_only=on' };
    const observador = new Client(configuracion);
    const consultas = [];
    try {
        await observador.connect();
        const sqlContadores = `SELECT (SELECT count(*)::text FROM pg_database) AS bases,
            (SELECT count(*)::text FROM pg_class WHERE relkind IN ('r', 'p')) AS tablas,
            (SELECT count(*)::text FROM pg_namespace) AS esquemas,
            (SELECT count(*)::text FROM pg_roles) AS roles`;
        const antes = (await observador.query(sqlContadores)).rows;
        const consultasRechazo = [];
        await assert.rejects(exportarOfertas({ ...opciones, base: 'destino_incorrecto' }, {
            crearCliente: () => adaptarCliente(new Client(configuracion), datos, consultasRechazo),
        }), { message: 'Exportación rechazada: autorización o destino inválido.' });
        assert.equal(consultasRechazo.length, 1);
        assert.equal(fs.existsSync(path.resolve(rutaSocket, '..', salida)), false);
        await exportarOfertas(opciones, { crearCliente: () => adaptarCliente(new Client(configuracion), datos, consultas) });
        const consultasVacias = [];
        const vacia = await exportarOfertas({ ...opciones, salida: `${salida}-vacia` }, {
            crearCliente: () => adaptarCliente(new Client(configuracion), { ...datos, ofertas: [] }, consultasVacias),
        });
        assert.equal(vacia.total_sql, '0');
        assert.equal(vacia.total_exportado, 0);
        assert.equal(JSON.stringify(vacia.campos_ausentes), JSON.stringify(['fecha_publicacion']));
        assert.equal(fs.readFileSync(path.resolve(rutaSocket, '..', `${salida}-vacia`, 'busco-trabajo-auditoria-matching.jsonl'), 'utf8'), '');
        const despues = (await observador.query(sqlContadores)).rows;
        assert.deepEqual(despues, antes);
        const evidencia = verificarSalida(path.resolve(rutaSocket, '..', salida), datos.ofertas);
        assert.equal(consultas.length, 4);
        assert.equal(consultasVacias.length, 4);
        const resumen = JSON.parse(fs.readFileSync(path.resolve(rutaSocket, '..', salida, 'resumen.json'), 'utf8'));
        assert.equal(JSON.stringify(resumen.campos_ausentes), JSON.stringify(['fecha_publicacion']));
        const { createHash } = require('crypto');
        const hashExportador = createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'exportar-ofertas.js'))).digest('hex');
        process.stdout.write(`${JSON.stringify({ ...evidencia, cero_filas: true, rechazo_destino: true, hash_exportador: hashExportador,
            contadores_sin_cambios: antes[0], consultas, campos_ausentes: resumen.campos_ausentes,
            alcance: 'CTE/recordset sintético con columna ausente; no valida esquema productivo' })}\n`);
    } finally {
        try { await observador.end(); } finally { fs.closeSync(descriptorSocket); }
    }
}

if (require.main === module) ejecutarPrueba().catch(() => {
    process.stderr.write('Falló la prueba sintética aislada.\n');
    process.exitCode = 1;
});
module.exports = { obtenerCasos, verificarSalida, adaptarCliente };
