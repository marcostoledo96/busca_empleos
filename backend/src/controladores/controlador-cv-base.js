const modelo = require('../modelos/cv-base');
const { decodificarCvBase } = require('../utils/validacion-cv-base');

async function obtenerCvBase(req, res, next) {
    try {
        res.json({ exito: true, datos: await modelo.obtenerCvBase() });
    } catch (error) {
        next(error);
    }
}

async function guardarCvBase(req, res, next) {
    try {
        const texto = decodificarCvBase(req.body || Buffer.alloc(0));
        const datos = await modelo.guardarCvBase(texto);
        res.json({ exito: true, datos });
    } catch (error) {
        next(error);
    }
}

module.exports = { obtenerCvBase, guardarCvBase };
