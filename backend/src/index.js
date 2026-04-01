// Punto de entrada del servidor — importo la app y la levanto.
//
// Este archivo es el que se ejecuta con `npm start` o `npm run dev`.
// Su ÚNICA responsabilidad es llamar a app.listen() con el puerto correcto.
// Toda la configuración de Express (rutas, middlewares, etc.) está en app.js.

const app = require('./app');
const baseDatos = require('./config/base-datos');

const PUERTO = process.env.PUERTO || 3000;

async function iniciarServidor() {
    try {
        const diagnostico = await baseDatos.obtenerDiagnosticoPersistencia();

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
        console.error(error.message);
        process.exit(1);
    }
}

iniciarServidor();
