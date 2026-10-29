// Rutas de evaluación — endpoints para disparar la evaluación con IA.

const { Router } = require('express');
const controlador = require('../controladores/controlador-evaluacion');

const router = Router();

router.post('/ejecutar', controlador.ejecutarEvaluacion);
router.get('/progreso', controlador.obtenerProgresoEvaluacion);
router.post('/cancelar', controlador.cancelarEvaluacion);

// Resetea a 'pendiente' las evaluaciones de la IA de los últimos N días.
// Permite volver a evaluar ofertas recientes tras cambiar el perfil.
router.post('/resetear', controlador.resetearEvaluaciones);

// Consulto el mismo selector protegido sin ejecutar el worker ni adquirir el mutex.
router.get('/reintentar-errores', controlador.previsualizarErrores);
router.post('/reintentar-errores', controlador.reintentarErrores);

module.exports = router;
