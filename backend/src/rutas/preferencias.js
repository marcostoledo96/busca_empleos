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
// LO EXPORTAMOS para que app.js pueda aplicar rate limiting ANTES de procesar el archivo.
const uploadCv = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const nombreOk = file.originalname.toLowerCase().endsWith('.md');
        const mimeOk = ['text/markdown', 'text/plain', 'application/octet-stream'].includes(file.mimetype);

        if (!nombreOk || !mimeOk) {
            const error = new Error('Solo se permiten archivos Markdown (.md)');
            error.statusCode = 400;
            return cb(error);
        }

        cb(null, true);
    },
});

// Respondo errores de carga también cuando la ruta se monta con rate limiting.
function recibirCv(req, res, next) {
    uploadCv.single('cv')(req, res, error => {
        if (!error) return next();
        const grande = error.code === 'LIMIT_FILE_SIZE';
        return res.status(grande ? 413 : 400).json({
            exito: false, codigo: 'CARGA_INVALIDA',
            error: grande ? 'El CV no puede superar 1 MiB.' : 'Enviá un único archivo Markdown (.md) en el campo cv.',
        });
    });
}

const router = Router();

router.get('/', controlador.obtenerPreferencias);
router.put('/', controlador.actualizarPreferencias);
// NOTA: POST /importar-cv/analizar se monta SEPARADAMENTE en app.js con rate limit
// porque consume IA cara (deepseek-v4-pro) y necesita su propio limitador.
// Se mantiene acá para compatibilidad de tests que importan el router directamente.
router.post('/importar-cv/analizar', recibirCv, controlador.analizarCvMarkdown);

module.exports = router;
module.exports.uploadCv = uploadCv;
module.exports.recibirCv = recibirCv;
