// Controlador de ofertas — maneja las requests HTTP para consultar ofertas.
//
// ¿Qué es un controlador? Es la capa que recibe la request HTTP (lo que
// manda el frontend o un cliente como Postman), extrae los datos que necesita
// (query params, body, etc.), llama al modelo/servicio correspondiente,
// y envía la respuesta JSON al cliente.
//
// Los controladores deben ser FINOS: no tienen lógica de negocio.
// Solo traducen HTTP → llamada al modelo → respuesta JSON.
// Es como un mozo en un restaurante: toma tu pedido, se lo lleva a la cocina,
// y te trae el plato. No cocina.

const modeloOferta = require('../modelos/oferta');

/**
 * GET /api/ofertas
 * Retorno la lista de ofertas, con filtros opcionales por query params.
 *
 * Query params soportados:
 * - estado: 'pendiente' | 'aprobada' | 'rechazada'
 * - plataforma: 'linkedin' | 'computrabajo'
 *
 * Ejemplo: GET /api/ofertas?estado=aprobada&plataforma=linkedin
 */
async function listarOfertas(req, res) {
    const filtros = {};

    if (req.query.estado) filtros.estado = req.query.estado;
    if (req.query.plataforma) filtros.plataforma = req.query.plataforma;

    const ofertas = await modeloOferta.obtenerOfertas(filtros);

    res.json({
        exito: true,
        datos: ofertas,
        total: ofertas.length,
    });
}

/**
 * GET /api/ofertas/estadisticas
 * Retorno el conteo de ofertas agrupado por estado de evaluación.
 * El dashboard usa estos números para mostrar un resumen rápido.
 */
async function obtenerEstadisticas(req, res) {
    const estadisticas = await modeloOferta.obtenerEstadisticas();

    res.json({
        exito: true,
        datos: estadisticas,
    });
}

/**
 * GET /api/ofertas/:id
 * Retorno una oferta específica por su ID.
 * Si el ID no es válido, retorno 400. Si no existe, retorno 404.
 */
async function obtenerOferta(req, res) {
    // Valido que el ID sea un número entero positivo.
    // Esto es validación en el BOUNDARY del sistema (la API HTTP),
    // que es donde corresponde validar input externo.
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({
            exito: false,
            error: 'El ID debe ser un número entero positivo.',
        });
    }

    const oferta = await modeloOferta.obtenerOfertaPorId(id);

    if (!oferta) {
        return res.status(404).json({
            exito: false,
            error: 'Oferta no encontrada.',
        });
    }

    res.json({
        exito: true,
        datos: oferta,
    });
}

module.exports = { listarOfertas, obtenerEstadisticas, obtenerOferta };
