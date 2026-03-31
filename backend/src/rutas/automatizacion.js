// Rutas de automatización — endpoints para controlar el cron.
//
// Base: /api/automatizacion (montada en app.js)
//
// GET  /estado   → Ver si el cron está activo, cuándo se ejecutó, resultado
// POST /iniciar  → Programar el cron (body opcional: { expresionCron: "..." })
// POST /detener  → Detener el cron
// POST /ejecutar → Ejecutar un ciclo completo manualmente (sin cron)

const { Router } = require('express');
const controlador = require('../controladores/controlador-automatizacion');

const router = Router();

router.get('/estado', controlador.obtenerEstado);
router.post('/iniciar', controlador.iniciarCron);
router.post('/detener', controlador.detenerCron);
router.post('/ejecutar', controlador.ejecutarCiclo);

module.exports = router;
