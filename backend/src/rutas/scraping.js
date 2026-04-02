// Rutas de scraping — endpoints para disparar el scraping de cada plataforma.
//
// Estos son POST porque EJECUTAN una acción (disparan el scraping),
// no solo consultan datos. En REST, POST = "hacé algo", GET = "dame datos".

const { Router } = require('express');
const controlador = require('../controladores/controlador-scraping');

const router = Router();

router.post('/linkedin', controlador.scrapearLinkedin);
router.post('/computrabajo', controlador.scrapearComputrabajo);
router.post('/indeed', controlador.scrapearIndeed);
router.post('/bumeran', controlador.scrapearBumeran);
router.post('/glassdoor', controlador.scrapearGlassdoor);
router.post('/getonbrd', controlador.scrapearGetonbrd);
router.post('/jooble', controlador.scrapearJooble);
router.post('/google-jobs', controlador.scrapearGoogleJobs);

module.exports = router;
