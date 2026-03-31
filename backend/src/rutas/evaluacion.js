// Rutas de evaluación — endpoint para disparar la evaluación con IA.

const { Router } = require('express');
const controlador = require('../controladores/controlador-evaluacion');

const router = Router();

router.post('/ejecutar', controlador.ejecutarEvaluacion);

module.exports = router;
