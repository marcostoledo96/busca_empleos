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
const baseDatos = require('../config/base-datos');

/**
 * GET /api/ofertas
 * Retorno la lista de ofertas, con filtros y sorting opcionales por query params.
 *
 * Query params soportados:
 * - estado: 'pendiente' | 'aprobada' | 'rechazada'
 * - plataforma: 'linkedin' | 'computrabajo' | 'indeed' | 'bumeran'
 * - estado_postulacion: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada'
 * - ordenar_por: 'fecha_extraccion' | 'fecha_publicacion' | 'porcentaje_match' | 'titulo' | 'empresa' | 'estado_evaluacion'
 * - direccion: 'ASC' | 'DESC'
 *
 * Ejemplo: GET /api/ofertas?estado=aprobada&ordenar_por=porcentaje_match&direccion=DESC
 */
async function listarOfertas(req, res) {
    const filtros = {};

    if (req.query.estado) filtros.estado = req.query.estado;
    if (req.query.plataforma) filtros.plataforma = req.query.plataforma;
    if (req.query.estado_postulacion) filtros.estado_postulacion = req.query.estado_postulacion;
    if (req.query.ordenar_por) filtros.ordenar_por = req.query.ordenar_por;
    if (req.query.direccion) filtros.direccion = req.query.direccion;

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
 * GET /api/ofertas/diagnostico/persistencia
 * Retorno información mínima para verificar que la API está leyendo
 * la base correcta y cuántas ofertas persistidas ve en este momento.
 */
async function obtenerDiagnosticoPersistencia(req, res) {
    const diagnostico = await baseDatos.obtenerDiagnosticoPersistencia();

    res.json({
        exito: true,
        datos: {
            ...diagnostico,
            fecha_consulta: new Date().toISOString(),
        },
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

/**
 * PATCH /api/ofertas/:id/postulacion
 * Actualizo el estado de postulación de una oferta.
 *
 * Body: { estado_postulacion: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada' }
 */
async function actualizarPostulacion(req, res) {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({
            exito: false,
            error: 'El ID debe ser un número entero positivo.',
        });
    }

    const { estado_postulacion } = req.body;
    const estadosValidos = ['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'];

    if (!estado_postulacion || !estadosValidos.includes(estado_postulacion)) {
        return res.status(400).json({
            exito: false,
            error: `El estado_postulacion debe ser uno de: ${estadosValidos.join(', ')}.`,
        });
    }

    const oferta = await modeloOferta.actualizarPostulacion(id, estado_postulacion);

    if (!oferta) {
        return res.status(404).json({
            exito: false,
            error: 'Oferta no encontrada.',
        });
    }

    res.json({
        exito: true,
        datos: oferta,
        mensaje: `Estado de postulación actualizado a '${estado_postulacion}'.`,
    });
}

module.exports = {
    listarOfertas,
    obtenerEstadisticas,
    obtenerDiagnosticoPersistencia,
    obtenerOferta,
    actualizarPostulacion,
};
