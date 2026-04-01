// Rutas de preferencias — mapea URLs HTTP a los controladores.
//
// Solo dos rutas:
// - GET /  → obtener preferencias actuales.
// - PUT /  → actualizar preferencias (parcial o completa).
//
// Uso PUT (no PATCH) porque conceptualmente estoy "reemplazando" la configuración
// del usuario, aunque el modelo solo actualice los campos que vengan.

const { Router } = require('express');
const controlador = require('../controladores/controlador-preferencias');

const router = Router();

router.get('/', controlador.obtenerPreferencias);
router.put('/', controlador.actualizarPreferencias);

module.exports = router;
