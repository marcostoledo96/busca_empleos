#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { obtenerConfiguracionPostgres } = require('../src/config/configuracion-postgres');

// Selecciono contratos de sincronización, seguimiento, evaluación, perfil e historial de los modelos actuales.
const CONTRATOS = {
    schema_migrations: ['id', 'aplicado_en', 'exitoso'],
    ofertas: ['id', 'titulo', 'empresa', 'ubicacion', 'modalidad', 'nivel_requerido',
        'salario_min', 'salario_max', 'moneda', 'descripcion', 'url', 'plataforma', 'fecha_extraccion',
        'fecha_ultima_extraccion', 'fecha_publicacion', 'identidad_canonica', 'estado_evaluacion',
        'razon_evaluacion', 'porcentaje_match', 'fecha_evaluacion', 'evaluacion_error_mensaje',
        'estado_postulacion', 'fecha_postulacion', 'nota_postulacion', 'firma_criterios_evaluacion',
        'explicacion_evaluacion', 'origen_descripcion', 'descripcion_completitud', 'descripcion_original',
        'descripcion_modificada_en', 'prioridad_ia', 'puntaje_prioridad_ia', 'evidencias_prioridad_ia'],
    preferencias: ['id', 'nombre', 'nivel_experiencia', 'perfil_profesional', 'idioma_candidato',
        'stack_tecnologico', 'modalidad_aceptada', 'zonas_preferidas', 'terminos_busqueda', 'reglas_exclusion',
        'tecnologias_detalle', 'roles_objetivo_detalle', 'nivel_ingles_detalle', 'modelo_ia',
        'modelo_ia_evaluacion', 'modelo_ia_importacion', 'prompt_personalizado', 'usar_prompt_personalizado',
        'preguntas_perfil_pendientes', 'filtrar_nivel_linkedin', 'anios_experiencia_reales',
        'nivel_real_seniority', 'conocimientos_ausentes', 'limitaciones_explicitas',
        'priorizar_ofertas_ia', 'bonus_maximo_prioridad_ia'],
    cv_base: ['id', 'cv_base', 'cv_base_actualizado_en'],
    ejecuciones_busqueda: ['id', 'tipo', 'inicio', 'fin', 'estado', 'resumen'],
    configuracion_cron: ['id', 'activo', 'expresion_cron', 'zona_horaria', 'actualizado_en'],
    evaluacion_lotes: ['id', 'estado', 'total', 'evaluadas', 'aprobadas', 'rechazadas', 'errores',
        'porcentaje', 'modelo_ia', 'creado_en', 'actualizado_en', 'finalizado_en'],
    evaluaciones_cache: ['hash_oferta', 'hash_preferencias', 'modelo_ia', 'resultado', 'creado_en'],
};
const DIRECTORIOS = ['sql', 'migrations'].map(nombre => path.resolve(__dirname, '..', nombre));
const ERROR = 'No pude verificar configuración, conexión o permisos de forma segura.';
const MAXIMO_DIAGNOSTICOS = 20;
class IncompatibilidadEsquema extends Error {
    constructor(fallas) {
        super('Contrato ausente.');
        this.fallas = fallas.slice(0, MAXIMO_DIAGNOSTICOS);
        this.hayMas = fallas.length > MAXIMO_DIAGNOSTICOS;
    }
}
const citar = nombre => `"${nombre.replace(/"/g, '""')}"`;

function obtenerMigraciones(directorios = DIRECTORIOS) {
    const nombres = directorios.flatMap(directorio => fs.readdirSync(directorio, { withFileTypes: true })
        .filter(entrada => entrada.isFile() && entrada.name.endsWith('.sql')).map(entrada => entrada.name)).sort();
    if (!nombres.length || new Set(nombres).size !== nombres.length) throw new Error('Migraciones ambiguas.');
    if (nombres.some(nombre => nombre.length > 255 || !/^[a-zA-Z0-9_.-]+\.sql$/.test(nombre))) {
        throw new Error('Nombre de migración no seguro.');
    }
    return nombres;
}

function configurarConexion(entorno) {
    const configuracion = obtenerConfiguracionPostgres(entorno);
    // Evito el fallback silencioso y la lectura implícita de pgpass ante credenciales incompletas.
    if (entorno.DATABASE_URL) {
        if (!configuracion.connectionString) throw new Error('Configuración incompleta.');
        const url = new URL(configuracion.connectionString);
        if ([...url.searchParams.keys()].some(clave => !['sslmode'].includes(clave))) {
            throw new Error('Opciones de conexión no permitidas.');
        }
        if (!url.hostname || !url.username || !url.password || url.pathname.length < 2) throw new Error('Configuración incompleta.');
    } else if (!['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'].every(clave => entorno[clave])) {
        throw new Error('Configuración incompleta.');
    }
    if (entorno.PGSERVICE || entorno.PGSERVICEFILE || entorno.PGPASSFILE) throw new Error('Configuración no permitida.');
    if (entorno.PGOPTIONS && !/^-c search_path=[a-z_][a-z0-9_]*$/.test(entorno.PGOPTIONS)) {
        throw new Error('Opciones de conexión no permitidas.');
    }
    return {
        ...configuracion, max: 1, connectionTimeoutMillis: 3000, idleTimeoutMillis: 1000,
        query_timeout: 2500, application_name: 'issue61-preflight',
        options: `${entorno.PGOPTIONS || ''} -c default_transaction_read_only=on -c statement_timeout=2000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=3000`,
    };
}

async function verificarEsquema(directorios = DIRECTORIOS) {
    const requeridas = obtenerMigraciones(directorios);
    const configuracion = configurarConexion(process.env);
    const { Pool } = require('pg');
    const pool = new Pool(configuracion);
    let cliente;
    let liberado = false;
    let falloConexion = false;
    pool.on('error', () => { falloConexion = true; });
    const limite = setTimeout(() => {
        falloConexion = true;
        if (cliente && !liberado) {
            liberado = true;
            cliente.release(true);
        }
    }, 10000);
    try {
        cliente = await pool.connect();
        cliente.on('error', () => { falloConexion = true; });
        await cliente.query('BEGIN READ ONLY');
        const { rows } = await cliente.query(`SELECT current_schema() AS esquema,
            current_setting('transaction_read_only') AS solo_lectura`);
        const esquema = rows[0].esquema;
        if (!esquema || rows[0].solo_lectura !== 'on') throw new Error('Transacción inválida.');
        // pg_attribute distingue ausencia real de columnas ocultas por information_schema por permisos.
        const catalogo = await cliente.query(`SELECT c.relname AS tabla, c.relkind, a.attname AS columna, i.data_type AS tipo
            FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
            LEFT JOIN information_schema.columns i ON i.table_schema = n.nspname
                AND i.table_name = c.relname AND i.column_name = a.attname
            WHERE n.nspname = $1 AND c.relname = ANY($2::text[])`, [esquema, Object.keys(CONTRATOS)]);
        const fallas = [];
        let ledgerLegible = false;
        for (const [tabla, columnas] of Object.entries(CONTRATOS)) {
            const disponibles = catalogo.rows.filter(fila => fila.tabla === tabla && ['r', 'p'].includes(fila.relkind));
            if (!disponibles.length) {
                fallas.push({ tipo: 'faltante', identificador: tabla });
                continue;
            }
            const ausentes = columnas.filter(columna => !disponibles.some(fila => fila.columna === columna));
            for (const columna of ausentes) fallas.push({ tipo: 'faltante', identificador: `${tabla}.${columna}` });
            if (ausentes.length) continue;
            if (tabla === 'schema_migrations' && disponibles.find(fila => fila.columna === 'exitoso').tipo !== 'boolean') {
                throw new Error('Ledger inválido.');
            }
            // Verifico permisos de las columnas sin recuperar ofertas, preferencias ni CV.
            await cliente.query(`SELECT ${columnas.map(citar).join(', ')} FROM ${citar(esquema)}.${citar(tabla)} LIMIT 0`);
            if (tabla === 'schema_migrations') ledgerLegible = true;
        }
        if (ledgerLegible) {
            const ledger = await cliente.query(`SELECT id, bool_and(exitoso IS TRUE) AS exitoso
                FROM ${citar(esquema)}.schema_migrations WHERE id = ANY($1::text[]) GROUP BY id`, [requeridas]);
            // Sólo genero diagnósticos desde la lista requerida del repo, nunca desde IDs desconocidos del ledger.
            for (const nombre of requeridas) {
                const registro = ledger.rows.find(fila => fila.id === nombre);
                if (!registro) fallas.push({ tipo: 'pendiente', identificador: nombre });
                else if (registro.exitoso !== true) fallas.push({ tipo: 'fallida', identificador: nombre });
            }
        }
        await cliente.query('ROLLBACK');
        if (falloConexion) throw new Error('Verificación incompleta.');
        if (fallas.length) throw new IncompatibilidadEsquema(fallas);
    } finally {
        clearTimeout(limite);
        // Destruyo la única conexión también al fallar: PostgreSQL revierte la transacción abierta.
        if (cliente && !liberado) cliente.release(true);
        await pool.end();
    }
}

async function ejecutarCli(argumentos = process.argv.slice(2), directorios = DIRECTORIOS) {
    try {
        if (argumentos.length === 1 && argumentos[0] === '--help') {
            console.log('Uso: node scripts/verificar-esquema.js [--help]\nVerifico migraciones y contratos críticos en una transacción READ ONLY.\nUso DATABASE_URL o PG* del entorno; no cargo archivos .env ni reparo el esquema.');
            return;
        }
        if (argumentos.length) throw new Error('Opción no permitida.');
        await verificarEsquema(directorios);
        console.log('PREFLIGHT: OK\nMigraciones y contratos críticos verificados.');
    } catch (error) {
        const etiquetas = { faltante: 'Falta', pendiente: 'Migraciones pendientes', fallida: 'Migraciones fallidas o sin éxito confirmado' };
        const detalles = error instanceof IncompatibilidadEsquema
            ? error.fallas.map(falla => `${etiquetas[falla.tipo]}: ${falla.identificador}`)
            : [ERROR];
        if (error instanceof IncompatibilidadEsquema && error.hayMas) detalles.push('Hay más incompatibilidades; muestro las primeras 20.');
        console.error(['PREFLIGHT: ERROR', ...detalles, 'No recomiendo continuar con el despliegue.'].join('\n'));
        process.exitCode = 1;
    }
}

if (require.main === module) ejecutarCli();
module.exports = { obtenerMigraciones, verificarEsquema, ejecutarCli };
