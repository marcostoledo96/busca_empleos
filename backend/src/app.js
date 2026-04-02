// Configuración de la aplicación Express.
//
// ¿Por qué separar app.js de index.js?
// Porque en los tests necesito importar la app SIN que arranque el servidor
// (sin llamar a app.listen). Si todo estuviera en index.js, al importarlo
// en un test, el servidor se levantaría automáticamente y los tests se colgarían.
//
// Con esta separación:
// - app.js: configura Express (rutas, middlewares) y EXPORTA la app.
// - index.js: importa la app y llama a app.listen().
// - Los tests: importan app.js directamente sin levantar el servidor.
//
// Es el patrón estándar de cualquier proyecto Express testeado.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Importo las rutas organizadas por dominio.
const rutasOfertas = require('./rutas/ofertas');
const rutasScraping = require('./rutas/scraping');
const rutasEvaluacion = require('./rutas/evaluacion');
const rutasAutomatizacion = require('./rutas/automatizacion');
const rutasPreferencias = require('./rutas/preferencias');

// Importo los middlewares de manejo de errores.
const { rutaNoEncontrada, manejarErrores } = require('./utils/middleware-errores');

// Importo el middleware de autenticación Firebase.
const { verificarAuth } = require('./utils/middleware-auth');

const app = express();

// === Middlewares globales ===

// helmet() agrega headers de seguridad HTTP automáticamente:
// - X-Content-Type-Options: nosniff (evita que el browser adivine el Content-Type)
// - X-Frame-Options: SAMEORIGIN (previene clickjacking con iframes)
// - Strict-Transport-Security (fuerza HTTPS en producción)
// y otros más. Es una capa de defensa casi gratis.
app.use(helmet());

// cors() permite que el frontend (Angular en localhost:4200) haga requests
// al backend (Express en localhost:3000). Sin esto, el browser bloquea
// las peticiones por la "Same-Origin Policy" (política de seguridad del navegador).
//
// Restrinjo el origin al frontend para que no cualquier sitio pueda llamar a la API.
const origenesConfigurados = (process.env.CORS_ORIGEN || '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

const origenesPermitidos = origenesConfigurados.length > 0
    ? origenesConfigurados
    : [
        'http://localhost:4200',
        'https://busca-empleos.vercel.app',
    ];

app.use(cors({
    origin: (origin, callback) => {
        // Requests server-to-server o health checks pueden no traer Origin.
        if (!origin) {
            return callback(null, true);
        }

        if (origenesPermitidos.includes(origin)) {
            return callback(null, true);
        }

        // No lanzar error: devolver false hace que cors() omita el header
        // sin generar un 500 que oculte el diagnóstico real.
        console.warn(`[CORS] Origen bloqueado: ${origin} | Permitidos: ${origenesPermitidos.join(', ')}`);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    credentials: false,
}));

// express.json() parsea el body de las requests que vienen en formato JSON.
// Sin esto, req.body sería undefined en los controladores que reciben datos.
// Limito el tamaño del body a 1MB para prevenir ataques de payload gigante.
app.use(express.json({ limit: '1mb' }));

// Rate limiter para los endpoints que consumen créditos de APIs externas.
// Limito a 5 requests por minuto desde la misma IP — evita que un bug
// en el frontend o alguien curioso me vacíe los créditos de Apify/DeepSeek.
// En ambiente de test (Jest setea NODE_ENV='test') uso un middleware vacío
// para que los tests no se bloqueen con 429.
const esTest = process.env.NODE_ENV === 'test';
const limitadorCostoso = esTest
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000, // 1 minuto
        max: 5,              // máximo 5 requests por ventana
        message: {
            exito: false,
            error: 'Demasiadas solicitudes. Esperá un minuto antes de intentar de nuevo.',
        },
        standardHeaders: true,
        legacyHeaders: false,
    });

// === Rutas ===

// Endpoint de salud — público, sin autenticación.
// Solo sirve para verificar que el servidor anda (monitoreo, health checks).
app.get('/api/salud', (req, res) => {
    res.json({
        exito: true,
        mensaje: 'El servidor está funcionando correctamente.',
    });
});

// Todas las rutas de la API requieren autenticación Firebase.
// El middleware verifica el JWT Bearer token antes de llegar a cualquier controlador.
// Montamos como middleware global sobre /api para no repetirlo en cada router.
app.use('/api', verificarAuth);

// Cada grupo de rutas se monta bajo su propio prefijo.
// Las rutas internas del archivo se concatenan con el prefijo.
// Ej: rutasOfertas tiene GET '/' → se convierte en GET '/api/ofertas/'.
app.use('/api/ofertas', rutasOfertas);

// Scraping, evaluación y automatización consumen APIs pagas → rate limit.
app.use('/api/scraping', limitadorCostoso, rutasScraping);
app.use('/api/evaluacion', limitadorCostoso, rutasEvaluacion);
app.use('/api/automatizacion', limitadorCostoso, rutasAutomatizacion);
app.use('/api/preferencias', rutasPreferencias);

// === Manejo de errores ===

// Ruta no encontrada (404) — DEBE ir después de todas las rutas reales.
app.use(rutaNoEncontrada);

// Manejador de errores — DEBE ser el ÚLTIMO middleware.
// Express lo reconoce como error handler por tener 4 parámetros.
app.use(manejarErrores);

module.exports = app;
