// Módulo de conexión a PostgreSQL.
// Uso un Pool (pileta de conexiones) en vez de un Client individual.
// ¿Por qué? Porque el pool mantiene varias conexiones abiertas y las reutiliza.
// Cada vez que hago pool.query(), el pool agarra una conexión libre, ejecuta la
// query, y la devuelve a la pileta. Así no tengo que abrir/cerrar conexiones
// constantemente (que es lento).
//
// Las credenciales se cargan desde el archivo .env con las variables PG*.
// pg (el driver) las lee automáticamente si se llaman PGHOST, PGPORT, etc.

const { Pool } = require('pg');
const path = require('path');

// Cargo las variables de entorno desde el .env del backend.
// El path.resolve garantiza que encuentre el archivo sin importar
// desde dónde ejecute el script (raíz del proyecto o carpeta tests).
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool();

const configuracionConexion = {
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
