// Rutas de ofertas — mapea URLs HTTP a los controladores.
//
// ¿Qué es un Router? Es como un "mini-servidor" dentro de Express que agrupa
// rutas relacionadas. En vez de poner todas las rutas sueltas en app.js
// (que se haría un quilombo), las organizo por dominio: ofertas, scraping,
// evaluación. Cada archivo de rutas maneja un dominio.
//
// Cuando en app.js hago: app.use('/api/ofertas', rutasOfertas),
// todas las rutas definidas acá quedan bajo /api/ofertas/*. Es como crear
// un "namespace" o "subcarpeta" de URLs.

const { Router } = require('express');
const controlador = require('../controladores/controlador-ofertas');

const router = Router();

// IMPORTANTE: /estadisticas DEBE ir ANTES que /:id.
// ¿Por qué? Porque Express evalúa las rutas en orden.
// Si /:id va primero, cuando alguien pida /api/ofertas/estadisticas,
// Express pensaría que "estadisticas" es un :id y lo manejaría el
// controlador equivocado. Es un gotcha clásico de Express.
router.get('/estadisticas', controlador.obtenerEstadisticas);
router.get('/:id', controlador.obtenerOferta);
router.get('/', controlador.listarOfertas);

// PATCH para actualizar el estado de postulación de una oferta.
// Uso PATCH (no PUT) porque solo modifico UN campo, no la oferta entera.
router.patch('/:id/postulacion', controlador.actualizarPostulacion);

module.exports = router;
