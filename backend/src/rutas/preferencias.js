// Rutas de preferencias — mapea URLs HTTP a los controladores.
//
// Rutas:
// - GET  /                        → obtener preferencias actuales.
// - PUT  /                        → actualizar preferencias (parcial o completa).
// - POST /importar-cv/analizar    → analizar CV Markdown con IA (no guarda).

const { Router } = require('express');
const multer = require('multer');
const controlador = require('../controladores/controlador-preferencias');

// Multer para recibir archivos Markdown (máx 1MB).
const uploadCv = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const nombreOk = file.originalname.toLowerCase().endsWith('.md');
        const mimeOk = ['text/markdown', 'text/plain', 'application/octet-stream'].includes(file.mimetype);

        if (!nombreOk || !mimeOk) {
            return cb(new Error('Solo se permiten archivos Markdown (.md)'));
        }

        cb(null, true);
    },
});

const router = Router();

router.get('/', controlador.obtenerPreferencias);
router.put('/', controlador.actualizarPreferencias);
router.post('/importar-cv/analizar', uploadCv.single('cv'), controlador.analizarCvMarkdown);

module.exports = router;
