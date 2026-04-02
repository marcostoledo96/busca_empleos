// Rutas de evaluación — endpoints para disparar la evaluación con IA.

const { Router } = require('express');
const controlador = require('../controladores/controlador-evaluacion');

const router = Router();

router.post('/ejecutar', controlador.ejecutarEvaluacion);
router.get('/progreso', controlador.obtenerProgresoEvaluacion);
router.post('/cancelar', controlador.cancelarEvaluacion);

module.exports = router;
