// Comparto la política de conexión sin cargar archivos, abrir conexiones ni registrar datos.
function obtenerConfiguracionPostgres(entorno = process.env, advertir = () => {}) {
    const configuracion = {};
    const databaseUrl = (entorno.DATABASE_URL || '').trim();
    if (databaseUrl) {
        try {
            const url = new URL(databaseUrl);
            if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Protocolo no soportado.');
            configuracion.connectionString = databaseUrl;
        } catch {
            advertir('Base de datos: DATABASE_URL está mal formada. ' +
                'La voy a ignorar y voy a intentar conectar usando las variables PG*.');
        }
    }
    const modoSsl = (entorno.PGSSLMODE || '').trim().toLowerCase();
    const host = (entorno.PGHOST || '').trim().toLowerCase();
    const esLocal = !entorno.PGHOST || ['localhost', '127.0.0.1', '::1', 'host.docker.internal', '/var/run/postgresql'].includes(host);
    const usaSsl = configuracion.connectionString || (modoSsl !== 'disable'
        && (modoSsl || entorno.NODE_ENV === 'production' || !esLocal));
    if (usaSsl) configuracion.ssl = { rejectUnauthorized: false };
    return configuracion;
}

module.exports = { obtenerConfiguracionPostgres };
