const { validarEntorno } = require('./issue-57-entorno');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const raiz = path.resolve(__dirname, '../..');
const directorios = ['sql', 'migrations'].map(nombre => path.join(raiz, nombre));
const citar = nombre => `"${nombre.replace(/"/g, '""')}"`;

async function preparar() {
    validarEntorno();
    const { Pool } = require('pg');
    const pool = new Pool({ max: 1, ssl: false, connectionTimeoutMillis: 3000 });
    const prefijo = `issue61_${process.pid}_${Date.now()}`;
    try {
        const { rows } = await pool.query('SELECT current_database() AS db, current_user AS usuario, version() AS version');
        if (rows[0].db !== 'busca_empleos_issue57_test' || rows[0].usuario !== 'busca_empleos_test'
            || !rows[0].version.startsWith('PostgreSQL 15.')) throw new Error('Servidor sintético inesperado.');
        const origen = `${prefijo}_origen`;
        await pool.query(`CREATE SCHEMA ${origen}`);
        await pool.query(`SET search_path TO ${origen}`);
        await pool.query('CREATE TABLE schema_migrations (id VARCHAR(255) PRIMARY KEY, aplicado_en TIMESTAMP DEFAULT NOW(), exitoso BOOLEAN DEFAULT true)');
        const archivos = directorios.flatMap(directorio => fs.readdirSync(directorio)
            .filter(nombre => nombre.endsWith('.sql')).sort().map(nombre => ({ nombre, ruta: path.join(directorio, nombre) })));
        for (const archivo of archivos) {
            const sql = fs.readFileSync(archivo.ruta, 'utf8')
                .replace(/WHERE table_name =/g, 'WHERE table_schema = current_schema() AND table_name =');
            await pool.query(sql);
            await pool.query('INSERT INTO schema_migrations (id, exitoso) VALUES ($1, true) ON CONFLICT (id) DO NOTHING', [archivo.nombre]);
        }
        return { pool, prefijo, origen, archivos };
    } catch (error) {
        await pool.end();
        throw error;
    }
}

async function fixture(base, indice, omitir = '') {
    const { pool, origen, prefijo } = base;
    const esquema = `${prefijo}_${indice}`;
    await pool.query(`CREATE SCHEMA ${esquema}`);
    const { rows } = await pool.query(`SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = $1 ORDER BY table_name, ordinal_position`, [origen]);
    const tablas = new Map();
    for (const fila of rows) {
        if (omitir === fila.table_name || omitir === `${fila.table_name}.${fila.column_name}`) continue;
        if (!tablas.has(fila.table_name)) tablas.set(fila.table_name, []);
        tablas.get(fila.table_name).push(citar(fila.column_name));
    }
    for (const [tabla, columnas] of tablas) {
        await pool.query(`CREATE TABLE ${esquema}.${citar(tabla)} AS SELECT ${columnas.join(', ')} FROM ${origen}.${citar(tabla)} LIMIT 0`);
        if (tabla !== 'schema_migrations') await pool.query(`INSERT INTO ${esquema}.${citar(tabla)} DEFAULT VALUES`);
    }
    if (tablas.has('schema_migrations')) {
        const columnas = tablas.get('schema_migrations').join(', ');
        await pool.query(`INSERT INTO ${esquema}.schema_migrations SELECT ${columnas} FROM ${origen}.schema_migrations`);
    }
    await pool.query(`CREATE TABLE ${esquema}.centinela (id SERIAL PRIMARY KEY, valor TEXT)`);
    await pool.query(`INSERT INTO ${esquema}.centinela (valor) VALUES ('dato sintético privado issue61')`);
    return esquema;
}

async function instantanea(pool, esquema) {
    const catalogo = await pool.query(`SELECT c.relname, c.relkind, c.relacl::text, c.relowner,
        a.attname, a.atttypid, a.attnotnull, a.attnum, a.attacl::text,
        pg_get_expr(d.adbin, d.adrelid) AS defecto
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
        LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = $1 ORDER BY c.relname, a.attnum`, [esquema]);
    const tablas = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [esquema]);
    const datos = {};
    for (const { tablename } of tablas.rows) {
        datos[tablename] = (await pool.query(`SELECT row_to_json(t)::text AS fila FROM ${esquema}.${citar(tablename)} t ORDER BY row_to_json(t)::text`)).rows;
    }
    const secuencias = (await pool.query(`SELECT sequencename, last_value, start_value, increment_by, min_value, max_value, cycle, cache_size
        FROM pg_sequences WHERE schemaname = $1 ORDER BY sequencename`, [esquema])).rows;
    const estadoSecuencias = [];
    for (const { sequencename } of secuencias) {
        estadoSecuencias.push((await pool.query(`SELECT last_value, is_called FROM ${esquema}.${citar(sequencename)}`)).rows);
    }
    const esquemaCatalogo = (await pool.query('SELECT nspname, nspowner, nspacl::text FROM pg_namespace WHERE nspname = $1', [esquema])).rows;
    const restricciones = (await pool.query(`SELECT conname, contype, pg_get_constraintdef(oid) AS definicion
        FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1) ORDER BY conname`, [esquema])).rows;
    const indices = (await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname`, [esquema])).rows;
    const triggers = (await pool.query(`SELECT t.tgname, pg_get_triggerdef(t.oid) AS definicion
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 ORDER BY c.relname, t.tgname`, [esquema])).rows;
    const roles = (await pool.query(`SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin
        FROM pg_roles WHERE rolname LIKE $1 ORDER BY rolname`, [`${esquema.split('_').slice(0, 3).join('_')}%`])).rows;
    return { catalogo: catalogo.rows, esquemaCatalogo, restricciones, indices, triggers, roles,
        datos, secuencias, estadoSecuencias };
}

function ejecutar(esquema, cambios = {}, directoriosPrueba) {
    validarEntorno();
    const entorno = { ...process.env, PGOPTIONS: `-c search_path=${esquema}`, ...cambios };
    const argumentos = directoriosPrueba
        ? ['-e', `require(${JSON.stringify(path.join(raiz, 'scripts/verificar-esquema.js'))}).ejecutarCli([], ${JSON.stringify(directoriosPrueba)})`]
        : [path.join(raiz, 'scripts/verificar-esquema.js')];
    return spawnSync(process.execPath, argumentos, { env: entorno, encoding: 'utf8', timeout: 18000 });
}

module.exports = { preparar, fixture, instantanea, ejecutar, directorios };
