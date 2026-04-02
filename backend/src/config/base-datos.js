// Módulo de conexión a PostgreSQL.
// Uso un Pool (pileta de conexiones) en vez de un Client individual.
// ¿Por qué? Porque el pool mantiene varias conexiones abiertas y las reutiliza.
// Cada vez que hago pool.query(), el pool agarra una conexión libre, ejecuta la
// query, y la devuelve a la pileta. Así no tengo que abrir/cerrar conexiones
// constantemente (que es lento).
//
// En producción (Railway) se usa DATABASE_URL que el PaaS inyecta automáticamente.
// En desarrollo se usan las variables PG* del .env (PGHOST, PGPORT, etc.).
// Railway exige SSL en todas las conexiones — se activa cuando NODE_ENV=production.

const { Pool } = require('pg');
const path = require('path');

// Cargo las variables de entorno desde el .env del backend.
// El path.resolve garantiza que encuentre el archivo sin importar
// desde dónde ejecute el script (raíz del proyecto o carpeta tests).
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// En producción (Railway, Render, etc.) el PaaS provee DATABASE_URL automáticamente.
// Esa variable ya incluye host, puerto, usuario y contraseña en una sola cadena.
// En desarrollo usamos las variables PG* del .env, que pg lee de forma nativa.
//
// Railway y la mayoría de PaaS PostgreSQL exigen SSL. Sin él, la conexión se rechaza.
// rejectUnauthorized: false es necesario porque Railway usa certificados internos
// que no están en la cadena de confianza pública — es el estándar para PaaS.
const configuracionPool = {};
if (process.env.DATABASE_URL) {
    configuracionPool.connectionString = process.env.DATABASE_URL;
    configuracionPool.ssl = { rejectUnauthorized: false };
} else if (process.env.NODE_ENV === 'production') {
    // Sin DATABASE_URL pero en producción: forzamos SSL sobre las vars PG* individuales.
    configuracionPool.ssl = { rejectUnauthorized: false };
}
// En desarrollo (sin DATABASE_URL y sin NODE_ENV=production), pg lee las variables
// PG* del .env automáticamente sin necesidad de pasarlas explícitamente al Pool.

const pool = new Pool(configuracionPool);

const configuracionConexion = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || null,
        puerto: process.env.PGPORT ? Number(process.env.PGPORT) : null,
        baseDatos: process.env.PGDATABASE || null,
        usuario: process.env.PGUSER || null,
    };

// Evento que se dispara cuando una conexión nueva se abre.
// Útil para debugging: si veo este log, sé que el pool está funcionando.
pool.on('connect', () => {
    console.log('Base de datos: nueva conexión establecida con PostgreSQL.');
});

// Evento que se dispara si hay un error inesperado en una conexión idle.
// Sin este handler, el error crashearía el proceso de Node.
pool.on('error', (error) => {
    console.error('Base de datos: error inesperado en conexión idle:', error.message);
});

async function obtenerDiagnosticoPersistencia() {
    const resultado = await pool.query(
        `SELECT
            current_database() AS base_datos_actual,
            current_user AS usuario_actual,
            current_setting('port')::integer AS puerto_postgresql,
            COALESCE(inet_server_addr()::text, 'localhost') AS host_postgresql,
            to_regclass('public.ofertas') IS NOT NULL AS tabla_ofertas_existe,
            CASE
                WHEN to_regclass('public.ofertas') IS NULL THEN NULL
                ELSE (SELECT COUNT(*)::integer FROM ofertas)
            END AS total_ofertas`
    );

    return {
        configuracion: configuracionConexion,
        conexion: resultado.rows[0],
    };
}

module.exports = pool;
module.exports.obtenerDiagnosticoPersistencia = obtenerDiagnosticoPersistencia;
