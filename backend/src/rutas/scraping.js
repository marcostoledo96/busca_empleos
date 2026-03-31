// Rutas de scraping — endpoints para disparar el scraping de cada plataforma.
//
// Estos son POST porque EJECUTAN una acción (disparan el scraping),
// no solo consultan datos. En REST, POST = "hacé algo", GET = "dame datos".

const { Router } = require('express');
const controlador = require('../controladores/controlador-scraping');

const router = Router();

router.post('/linkedin', controlador.scrapearLinkedin);
router.post('/computrabajo', controlador.scrapearComputrabajo);

module.exports = router;
