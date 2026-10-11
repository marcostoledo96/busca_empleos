const express = require('express');
const controlador = require('../controladores/controlador-cv-base');
const { MAX_BYTES_CV_BASE } = require('../utils/validacion-cv-base');
const router = express.Router();

router.get('/', controlador.obtenerCvBase);
router.put('/', (req, res, next) => {
    const tipo = req.headers['content-type'] || '';
    if (!/^text\/(plain|markdown)(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(tipo)) {
        return res.status(415).json({ exito: false, error: 'Necesito text/plain o text/markdown con UTF-8.' });
    }
    next();
}, express.raw({ type: () => true, limit: MAX_BYTES_CV_BASE, inflate: false }), controlador.guardarCvBase);

// No registro errores de BD: sus mensajes pueden incluir el documento privado.
router.use((error, req, res, next) => {
    const estado = error.statusCode || error.status || 500;
    const mensajes = {
        400: 'Necesito UTF-8 válido sin caracteres NUL.',
        413: 'El CV supera 1048576 bytes.',
        415: 'No admito esa codificación de contenido.',
    };
    res.status(mensajes[estado] ? estado : 500).json({
        exito: false,
        error: mensajes[estado] || 'No pude acceder al CV base.',
    });
});

module.exports = router;
