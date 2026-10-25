const fs = require('fs');
const path = require('path');

const TOKEN = 'issue57-token-ficticio';
const EMAIL = 'persona-issue57@example.invalid';
const SINTETICA = 'issue57-sintetico';

function validarEntorno(entorno = process.env, esquemaPropio) {
    const esperadas = {
        NODE_ENV: 'test', DB_TEST_SINTETICA: 'true', PGHOST: '127.0.0.1', PGPORT: '55457',
        PGDATABASE: 'busca_empleos_issue57_test', PGUSER: 'busca_empleos_test',
        PGPASSWORD: 'sintetica_issue57', PGSSLMODE: 'disable',
    };
    const prohibidas = ['DATABASE_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGPASSFILE',
        'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_NOTIFICACION_DESTINO',
        'FIREBASE_PRIVATE_KEY', 'FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS',
        'INFOJOBS_CLIENT_SECRET'];
    const credenciales = ['APIFY_TOKEN', 'DEEPSEEK_API_KEY', 'JOOBLE_API_KEY', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY'];
    if (Object.entries(esperadas).some(([clave, valor]) => entorno[clave] !== valor)
        || prohibidas.some(clave => entorno[clave])
        || credenciales.some(clave => entorno[clave] && entorno[clave] !== SINTETICA)
        || (entorno.EMAIL_AUTORIZADO && entorno.EMAIL_AUTORIZADO !== EMAIL)
        || (entorno.PGOPTIONS && entorno.PGOPTIONS !== `-c search_path=${esquemaPropio}`)) {
        throw new Error('Entorno issue57 no permitido.');
    }
}

async function prepararBase() {
    validarEntorno();
    const { Pool } = require('pg');
    const verificacion = new Pool({ ssl: false, connectionTimeoutMillis: 3000 });
    const esquema = `issue57_${process.pid}_${Date.now()}`;
    try {
        const { rows } = await verificacion.query('SELECT current_database() AS db, current_user AS usuario, version() AS version');
        if (rows[0].db !== 'busca_empleos_issue57_test' || rows[0].usuario !== 'busca_empleos_test'
            || !rows[0].version.startsWith('PostgreSQL 15.')) throw new Error('Servidor sintético inesperado.');
        await verificacion.query(`CREATE SCHEMA ${esquema}`);
    } finally {
        await verificacion.end();
    }
    Object.assign(process.env, {
        PGOPTIONS: `-c search_path=${esquema}`, APIFY_TOKEN: SINTETICA,
        DEEPSEEK_API_KEY: SINTETICA, JOOBLE_API_KEY: SINTETICA, ADZUNA_APP_ID: SINTETICA,
        ADZUNA_APP_KEY: SINTETICA, EMAIL_AUTORIZADO: EMAIL, GETONBRD_ENABLED: 'false',
        CURSOR_SINCRONIZACION_SECRETO: SINTETICA, CORS_ORIGEN: 'http://127.0.0.1:4200,http://localhost:4200',
    });
    const pool = require('../../src/config/base-datos');
    const directorio = path.resolve(__dirname, '../../sql');
    for (const nombre of fs.readdirSync(directorio).filter(nombre => nombre.endsWith('.sql')).sort()) {
        // Acoto los guards legacy al esquema propio, como en la integración de #56.
        const sql = fs.readFileSync(path.join(directorio, nombre), 'utf8')
            .replace(/WHERE table_name =/g, 'WHERE table_schema = current_schema() AND table_name =');
        await pool.query(sql);
    }
    await pool.query(fs.readFileSync(path.resolve(__dirname, '../../migrations/024-resultados-fuentes.sql'), 'utf8'));
    await pool.query(`UPDATE preferencias SET nombre='Persona sintética', perfil_profesional='Desarrollo junior JavaScript',
        prompt_personalizado='Evalúo solamente ofertas sintéticas', terminos_busqueda=ARRAY['desarrollo junior'] WHERE id=1`);
    const actual = await pool.query('SELECT current_schema() AS esquema');
    if (actual.rows[0].esquema !== esquema) throw new Error('Esquema sintético incorrecto.');
    return { pool, esquema };
}

function ofertaLinkedin(indice = 1) {
    return {
        jobTitle: `Desarrollo junior sintético ${indice}`, companyName: 'Empresa ficticia',
        location: 'Buenos Aires, Argentina', jobDescription: 'Buscamos una persona junior para desarrollar aplicaciones JavaScript. Capacitación y trabajo en equipo.',
        jobUrl: `https://www.linkedin.com/jobs/view/${57000000 + indice}`,
        publishedAt: new Date().toISOString(), experienceLevel: 'Entry level', workRemoteAllowed: true,
    };
}

module.exports = { validarEntorno, prepararBase, ofertaLinkedin, TOKEN, EMAIL, SINTETICA };
