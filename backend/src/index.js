// Punto de entrada del servidor — importo la app y la levanto.
//
// Este archivo es el que se ejecuta con `npm start` o `npm run dev`.
// Su ÚNICA responsabilidad es llamar a app.listen() con el puerto correcto.
// Toda la configuración de Express (rutas, middlewares, etc.) está en app.js.

const app = require('./app');

const PUERTO = process.env.PUERTO || 3000;

app.listen(PUERTO, () => {
    console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});
