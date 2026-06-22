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
const { normalizarIdPlataforma } = require('../config/plataformas');

/**
 * GET /api/ofertas
 * Retorno la lista de ofertas, con filtros y sorting opcionales por query params.
 *
 * Query params soportados:
 * - estado: 'pendiente' | 'aprobada' | 'rechazada'
 * - plataforma: 'linkedin' | 'computrabajo' | 'indeed' | 'bumeran' | ...
 *   Se aceptan tanto ids internos ('google_jobs') como slugs HTTP ('google-jobs').
 *   El controlador normaliza slugs a ids internos antes de pasar al modelo.
 * - estado_postulacion: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada'
 * - ordenar_por: 'fecha_extraccion' | 'fecha_publicacion' | 'porcentaje_match' | 'titulo' | 'empresa' | 'estado_evaluacion'
 * - direccion: 'ASC' | 'DESC'
 *
 * Ejemplo: GET /api/ofertas?estado=aprobada&ordenar_por=porcentaje_match&direccion=DESC
 */
async function listarOfertas(req, res) {
    const filtros = {};

    if (req.query.estado) filtros.estado = req.query.estado;
    // Normalizo el filtro de plataforma: si el cliente manda 'google-jobs',
    // lo convierto a 'google_jobs' para que coincida con el valor almacenado en BD.
    if (req.query.plataforma) {
        const plataformaNormalizada = normalizarIdPlataforma(req.query.plataforma);
        if (plataformaNormalizada) {
            filtros.plataforma = plataformaNormalizada;
        } else {
            // Si no es un id/slug conocido, paso el valor original
            // y dejo que el modelo lo maneje (devolverá 0 resultados).
            filtros.plataforma = req.query.plataforma;
        }
    }
    if (req.query.estado_postulacion) filtros.estado_postulacion = req.query.estado_postulacion;
    if (req.query.ordenar_por) filtros.ordenar_por = req.query.ordenar_por;
    if (req.query.direccion) filtros.direccion = req.query.direccion;
    if (req.query.limite_pagina) filtros.limite_pagina = req.query.limite_pagina;
    if (req.query.pagina) filtros.pagina = req.query.pagina;

    const resultado = await modeloOferta.obtenerOfertas(filtros);

    // Compatibilidad con mocks legacy que retornan un array directamente.
    const esArrayLegacy = Array.isArray(resultado);
    const ofertas = esArrayLegacy ? resultado : resultado.ofertas;
    const total = esArrayLegacy ? resultado.length : resultado.total;
    const pagina = esArrayLegacy ? 1 : resultado.pagina;
    const limitePagina = esArrayLegacy ? ofertas.length : resultado.limite_pagina;

    res.json({
        exito: true,
        datos: ofertas,
        total,
        pagina,
        limite_pagina: limitePagina,
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
    // Este endpoint expone metadatos internos de la base de datos.
    // Solo se habilita si la variable explícita está seteada, nunca en producción por defecto.
    const habilitado = process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA === 'true';

    if (!habilitado || process.env.NODE_ENV === 'production') {
        return res.status(404).json({ exito: false, error: 'No encontrado' });
    }

    const diagnostico = await baseDatos.obtenerDiagnosticoPersistencia();

    const conexion = diagnostico.conexion || {};

    const sanitizado = {
        base_de_datos: conexion.base_datos_actual || null,
        tabla_ofertas_existe: conexion.tabla_ofertas_existe || false,
        total_ofertas: conexion.total_ofertas || 0,
        estrategia: diagnostico.resumen?.estrategia || null,
        ssl_activo: diagnostico.resumen?.usaSsl || false,
        fecha_consulta: new Date().toISOString(),
    };

    res.json({
        exito: true,
        datos: sanitizado,
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

/**
 * PATCH /api/ofertas/bulk/postulacion
 * Actualizo el estado de postulación de múltiples ofertas en una sola operación.
 *
 * Body: { ids: [1, 2, 3], estado_postulacion: 'descartada' }
 *
 * ¿Por qué PATCH y no POST? Porque PATCH modifica recursos existentes
 * sin reemplazarlos. Es semánticamente correcto para actualizaciones parciales.
 */
async function actualizarPostulacionMasiva(req, res) {
    const { ids, estado_postulacion } = req.body;

    // Valido que ids sea un array no vacío de números enteros positivos.
    if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        !ids.every(id => Number.isInteger(id) && id > 0)
    ) {
        return res.status(400).json({
            exito: false,
            error: 'El campo ids debe ser un array no vacío de números enteros positivos.',
        });
    }

    const MAXIMO_BULK = 200;
    if (ids.length > MAXIMO_BULK) {
        return res.status(400).json({
            exito: false,
            error: `No se pueden procesar más de ${MAXIMO_BULK} IDs en una sola operación.`,
        });
    }

    const estadosValidos = ['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'];

    if (!estado_postulacion || !estadosValidos.includes(estado_postulacion)) {
        return res.status(400).json({
            exito: false,
            error: `El estado_postulacion debe ser uno de: ${estadosValidos.join(', ')}.`,
        });
    }

    const actualizadas = await modeloOferta.actualizarPostulacionMasiva(ids, estado_postulacion);

    res.json({
        exito: true,
        datos: { actualizadas },
        mensaje: `${actualizadas} oferta(s) actualizadas a '${estado_postulacion}'.`,
    });
}

module.exports = {
    listarOfertas,
    obtenerEstadisticas,
    obtenerDiagnosticoPersistencia,
    obtenerOferta,
    actualizarPostulacion,
    actualizarPostulacionMasiva,
};
