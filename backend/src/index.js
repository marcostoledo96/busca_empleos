// Punto de entrada del servidor — importo la app y la levanto.
//
// Este archivo es el que se ejecuta con `npm start` o `npm run dev`.
// Su ÚNICA responsabilidad es llamar a app.listen() con el puerto correcto.
// Toda la configuración de Express (rutas, middlewares, etc.) está en app.js.

const app = require('./app');
const baseDatos = require('./config/base-datos');

// Railway (y la mayoría de PaaS) inyectan PORT automáticamente.
// Respeto PORT primero, luego PUERTO como fallback para desarrollo local.
const PUERTO = process.env.PORT || process.env.PUERTO || 3000;
const MAXIMO_INTENTOS_POSTGRES = Number(process.env.POSTGRES_MAX_INTENTOS_CONEXION || 10);
const ESPERA_POSTGRES_MS = Number(process.env.POSTGRES_ESPERA_REINTENTO_MS || 3000);

function esperar(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function obtenerDiagnosticoConReintentos() {
    let ultimoError = null;

    for (let intento = 1; intento <= MAXIMO_INTENTOS_POSTGRES; intento += 1) {
        try {
            if (intento > 1) {
                console.log(
                    `Base de datos: reintento ${intento} de ${MAXIMO_INTENTOS_POSTGRES}...`
                );
            }

            return await baseDatos.obtenerDiagnosticoPersistencia();
        } catch (error) {
            ultimoError = error;

            console.error(
                `Base de datos: falló el intento ${intento} de ${MAXIMO_INTENTOS_POSTGRES}: ${error.message}`
            );

            if (intento < MAXIMO_INTENTOS_POSTGRES) {
                await esperar(ESPERA_POSTGRES_MS);
            }
        }
    }

    throw ultimoError;
}

async function iniciarServidor() {
    try {
        const diagnostico = await obtenerDiagnosticoConReintentos();

        console.log(
            'Base de datos activa:',
            `${diagnostico.conexion.base_datos_actual} en ${diagnostico.conexion.host_postgresql}:${diagnostico.conexion.puerto_postgresql}`
        );
        console.log(
            'Persistencia detectada:',
            diagnostico.conexion.tabla_ofertas_existe
                ? `${diagnostico.conexion.total_ofertas} ofertas visibles al arrancar.`
                : 'la tabla ofertas todavía no existe.'
        );

        app.listen(PUERTO, () => {
            console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
            console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('No pude iniciar el backend porque falló la conexión a PostgreSQL.');
        console.error('Configuración detectada:', {
            entorno: process.env.NODE_ENV || 'development',
            usaDatabaseUrl: Boolean(process.env.DATABASE_URL),
            databaseUrlPareceValida: /^(postgres|postgresql):\/\//i.test(process.env.DATABASE_URL || ''),
            host: process.env.PGHOST || null,
            puerto: process.env.PGPORT || null,
            modoSsl: process.env.PGSSLMODE || null,
            maximoIntentosPostgres: MAXIMO_INTENTOS_POSTGRES,
            esperaReintentoMs: ESPERA_POSTGRES_MS,
        });
        console.error(error.message);
        process.exit(1);
    }
}

iniciarServidor();
