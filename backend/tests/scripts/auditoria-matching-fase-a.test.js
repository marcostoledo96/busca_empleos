const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const { TextDecoder } = require('util');
jest.mock('pg', () => ({ Query: class { constructor(text) { this.text = text; } } }));
const { exportarOfertas, CAMPOS, SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_COLUMNAS } = require('./exportar-ofertas');
const { obtenerCasos } = require('./issue-69-postgres-prueba');
const { obtenerMuestraAuditoria } = require('../fixtures/auditoria-matching-fase-a');
const nombres = ['busco-trabajo-auditoria-matching.jsonl', 'busco-trabajo-criterios-sanitizados.json', 'resumen.json'];
const campos = [...CAMPOS, 'vigencia_evaluacion', 'autoria_evaluacion', 'precision_fecha_evaluacion'];
const opciones = { autorizar: true, servidor: '192.0.2.1', puerto: 5432, base: 'sintetica', usuario: 'lector', salida: 'muestra', sintetico: true };
let directorio;
beforeEach(() => { directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'issue75-')); });
afterEach(() => { fs.rmSync(directorio, { recursive: true, force: true }); });

// Solo verifico integridad de la muestra; no adjudico semántica ni ejecuto matching.
function comprobarIntegridad(archivos, idsEsperados) {
    const [jsonl, criterios, resumen] = archivos.map(buffer => new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    const lineas = jsonl === '' ? [] : jsonl.split('\n');
    if (lineas.at(-1) === '') lineas.pop();
    const filas = lineas.map(linea => JSON.parse(linea));
    const meta = JSON.parse(resumen);
    const perfil = JSON.parse(criterios);
    const ids = filas.map(fila => fila.id);
    assert.equal(new Set(ids).size, ids.length, 'IDs duplicados');
    assert.deepEqual(ids, idsEsperados, 'Cobertura exacta y orden por ID');
    assert.equal(meta.completo, true);
    assert.equal(meta.version_esquema_exportacion, 'auditoria-matching-v1');
    assert.equal(meta.total_sql, String(filas.length));
    assert.equal(meta.total_exportado, filas.length);
    const estados = { aprobada: 0, rechazada: 0, pendiente: 0, otros: 0 };
    let errores = 0;
    let solicitadas = 0;
    for (const fila of filas) {
        assert.deepEqual(Object.keys(fila), campos, 'Campos completos, incluso null');
        estados[Object.hasOwn(estados, fila.estado_evaluacion) ? fila.estado_evaluacion : 'otros']++;
        if (fila.evaluacion_error_mensaje === 'REEVALUACION_SOLICITADA') solicitadas++;
        else if (fila.evaluacion_error_mensaje) errores++;
    }
    assert.deepEqual(meta.estados, estados);
    assert.equal(meta.errores_tecnicos, errores);
    assert.equal(meta.reevaluaciones_solicitadas, solicitadas);
    assert.deepEqual(meta.vigencia, { actual: 0, anterior: 0, desconocida: filas.length });
    assert.equal(perfil.firma_actual, null);
    assert.equal(perfil.instrucciones_efectivas_completas, false);
    assert.deepEqual(perfil.criterios_adicionales_ia, { activos: true, detalle: 'omitido_privacidad_no_reconstruible' });
    assert.equal(perfil.prioridad_ia.ranking_separado, true);
    assert.equal(perfil.prioridad_ia.modifica_match, false);
    return filas;
}

async function producir(ofertas, total = ofertas.length, ausentes = []) {
    const preferencias = obtenerCasos().preferencias;
    const antes = structuredClone({ ofertas, preferencias, opciones });
    const consultas = [];
    const cliente = {
        connect: jest.fn(async () => {}), end: jest.fn(async () => {}),
        query: jest.fn(consulta => {
            const sql = typeof consulta === 'string' ? consulta : consulta.text;
            consultas.push(sql);
            if (sql === SQL_IDENTIDAD) return Promise.resolve({ rows: [{
                base: opciones.base, usuario: opciones.usuario, servidor: opciones.servidor,
                puerto: 5432, solo_lectura: 'on', transaccion_solo_lectura: 'on',
            }] });
            if (sql === SQL_PREFERENCIAS) return Promise.resolve({ rows: [{ preferencias }] });
            if (sql === SQL_COLUMNAS) return Promise.resolve({ rows: CAMPOS.filter(c => !ausentes.includes(c)).map(columna => ({ columna })) });
            const emisor = new EventEmitter();
            process.nextTick(() => {
                for (const original of ofertas) {
                    const oferta = { ...original };
                    for (const campo of ausentes) {
                        expect(sql).toContain(`NULL AS ${campo}`);
                        oferta[campo] = null;
                    }
                    emisor.emit('row', { total_sql: String(total), oferta });
                }
                emisor.emit('end');
            });
            return emisor;
        }),
    };
    try {
        await exportarOfertas(opciones, { crearCliente: () => cliente, directorioSalida: directorio });
        expect(consultas).toHaveLength(4);
        expect(consultas[3]).not.toMatch(/WHERE|LIMIT|postulacion/);
        const salida = path.join(directorio, opciones.salida);
        expect(fs.readdirSync(salida).sort()).toEqual([...nombres].sort());
        return nombres.map(nombre => fs.readFileSync(path.join(salida, nombre)));
    } finally {
        expect({ ofertas, preferencias, opciones }).toEqual(antes);
        expect(cliente.end).toHaveBeenCalledTimes(1);
    }
}

function reemplazarFilas(archivos, transformar) {
    const filas = archivos[0].toString('utf8').trim().split('\n').map(JSON.parse);
    return [Buffer.from(`${transformar(filas).map(fila => JSON.stringify(fila)).join('\n')}\n`), ...archivos.slice(1)];
}

test('recorro IDs no consecutivos en lotes estables, sin perder filas ocultas ni incertidumbre histórica', async () => {
    const muestra = obtenerMuestraAuditoria();
    const ids = muestra.map(caso => caso.oferta.id);
    const archivos = await producir(muestra.map(caso => caso.oferta));
    const filas = comprobarIntegridad(archivos, ids);
    expect(filas.map(fila => fila.id)).toEqual(ids);
    const lotes = [];
    for (let inicio = 0; inicio < ids.length; inicio += 5) lotes.push(ids.slice(inicio, inicio + 5));
    expect(lotes.flat()).toEqual(ids);
    expect(new Set(lotes.flat()).size).toBe(ids.length);
    for (const [indice, fila] of filas.entries()) {
        const revision = muestra[indice].revision;
        expect(revision.id).toBe(fila.id);
        expect(revision.historia).toBe('historicamente_no_verificable');
        expect(revision.estado_revision).toBe('ejemplo_manual_pendiente_revision_humana');
        expect(['decision_correcta', 'posible_falso_positivo', 'posible_falso_negativo',
            'inconsistencia', 'error_tecnico', 'informacion_insuficiente']).toContain(revision.hallazgo);
        expect(fila.estado_evaluacion).toBe(revision.decision);
        expect(fila.porcentaje_match).toBe(muestra[indice].revision.porcentaje);
        expect(fila.descripcion).toBe(muestra[indice].revision.evidencia_textual);
        expect(fila.vigencia_evaluacion).toBe('desconocida');
        expect(fila.autoria_evaluacion).toBe('no_persistida');
        expect(fila).not.toHaveProperty('estado_postulacion');
    }
    expect(filas.find(fila => fila.id === 2003).precision_fecha_evaluacion).toBe('no_verificable_puede_incluir_backfill');
    expect(filas.find(fila => fila.id === 1499).explicacion_evaluacion.cumplidos[0].explicacion).toBe('Cumple Java sin conocer Java');
});

test.each(['duplicado', 'omitido', 'sustituido', 'campo', 'utf8', 'resumen', 'criterios'])
('detecto corrupción offline: %s, incluso con conteos iguales', async defecto => {
    const ofertas = obtenerMuestraAuditoria().map(caso => caso.oferta);
    const originales = await producir(ofertas);
    const copia = originales.map(buffer => Buffer.from(buffer));
    let archivos = [...originales];
    if (defecto === 'duplicado') archivos = reemplazarFilas(archivos, filas => [filas[0], filas[0], ...filas.slice(2)]);
    if (defecto === 'omitido') archivos = reemplazarFilas(archivos, filas => filas.slice(1));
    if (defecto === 'sustituido') archivos = reemplazarFilas(archivos, filas => [{ ...filas[0], id: 99999 }, ...filas.slice(1)]);
    if (defecto === 'campo') archivos = reemplazarFilas(archivos, filas => { delete filas[0].descripcion; return filas; });
    if (defecto === 'utf8') {
        const posicion = archivos[0].indexOf('Ejemplo');
        archivos[0] = Buffer.concat([archivos[0].subarray(0, posicion), Buffer.from([0xc3, 0x28]), archivos[0].subarray(posicion + 1)]);
        // La decodificación permisiva produce JSON válido: solo UTF-8 estricto debe rechazarlo.
        expect(() => JSON.parse(archivos[0].toString('utf8').split('\n')[0])).not.toThrow();
    }
    if (defecto === 'resumen') archivos[2] = Buffer.from(JSON.stringify({ ...JSON.parse(archivos[2]), estados: { aprobada: ofertas.length } }));
    if (defecto === 'criterios') archivos[1] = Buffer.from(JSON.stringify({ ...JSON.parse(archivos[1]), firma_actual: 'inventada' }));
    expect(() => comprobarIntegridad(archivos, ofertas.map(fila => fila.id))).toThrow();
    expect(originales).toEqual(copia);
});

test('rechazo líneas vacías interiores y conservo el terminador final legítimo', async () => {
    const ofertas = obtenerMuestraAuditoria().slice(0, 2).map(caso => caso.oferta);
    const archivos = await producir(ofertas);
    const ids = ofertas.map(oferta => oferta.id);
    expect(comprobarIntegridad(archivos, ids).map(fila => fila.id)).toEqual([17, 42]);
    const corruptos = [Buffer.from(archivos[0].toString('utf8').replace('\n', '\n\n')), ...archivos.slice(1)];
    expect(() => comprobarIntegridad(corruptos, ids)).toThrow(SyntaxError);
});

test('no confundo UTF-8 inválido con JSON inválido ni reemplazo silencioso', () => {
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from([0xc3, 0x28]))).toThrow();
});

test('el exportador conserva duplicados almacenados: el método los señala aunque el resumen cierre', async () => {
    const oferta = obtenerMuestraAuditoria()[0].oferta;
    const archivos = await producir([oferta, oferta]);
    expect(JSON.parse(archivos[2]).completo).toBe(true);
    expect(JSON.parse(archivos[2]).total_exportado).toBe(2);
    expect(() => comprobarIntegridad(archivos, [oferta.id, 42])).toThrow();
});

test('una fila omitida por el cliente falla cerrada sin resumen completo', async () => {
    await expect(producir([obtenerMuestraAuditoria()[0].oferta], 2)).rejects.toThrow(
        'No pude completar la exportación. No comparta una salida sin resumen completo.');
    expect(fs.existsSync(path.join(directorio, opciones.salida, 'resumen.json'))).toBe(false);
});

test('distingo columna ausente de null almacenado sin cambiar el esquema de 24 campos', async () => {
    const oferta = obtenerMuestraAuditoria()[0].oferta;
    const archivos = await producir([oferta], 1, ['fecha_publicacion']);
    const filas = comprobarIntegridad(archivos, [oferta.id]);
    expect(JSON.parse(archivos[2]).campos_ausentes).toEqual(['fecha_publicacion']);
    expect(filas[0].fecha_publicacion).toBeNull();
    expect(filas[0].empresa).toBeNull();
    expect(Object.keys(filas[0])).toHaveLength(24);
});
