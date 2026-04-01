// Controlador de preferencias — maneja las requests HTTP para leer y actualizar
// la configuración del usuario (perfil, stack, keywords, prompt IA, etc.).
//
// Solo dos operaciones: obtener (GET) y actualizar (PUT).
// No hay creación ni eliminación porque la tabla tiene una sola fila fija.

const modeloPreferencia = require('../modelos/preferencia');

// Valores válidos para los campos con opciones fijas.
// Los defino acá para validar en el boundary del sistema (la API HTTP).
const NIVELES_VALIDOS = ['trainee', 'junior', 'semi-senior'];
const MODALIDADES_VALIDAS = ['cualquiera', 'remoto', 'hibrido', 'presencial'];
const ZONAS_VALIDAS = ['CABA', 'GBA Oeste', 'GBA Norte', 'GBA Sur', 'Interior'];
const MODELOS_IA_VALIDOS = ['deepseek-chat', 'deepseek-reasoner'];

/**
 * GET /api/preferencias
 * Retorno las preferencias actuales del usuario.
 */
async function obtenerPreferencias(req, res) {
    const preferencias = await modeloPreferencia.obtenerPreferencias();

    res.json({
        exito: true,
        datos: preferencias,
    });
}

/**
 * PUT /api/preferencias
 * Actualizo las preferencias del usuario.
 * Valido los campos en el boundary antes de pasarlos al modelo.
 *
 * El body puede contener cualquier combinación de campos válidos.
 * Los campos no enviados no se modifican.
 */
async function actualizarPreferencias(req, res) {
    const datos = req.body;
    const errores = [];

    // Valido nivel_experiencia si viene.
    if (datos.nivel_experiencia !== undefined) {
        if (!NIVELES_VALIDOS.includes(datos.nivel_experiencia)) {
            errores.push(`nivel_experiencia debe ser uno de: ${NIVELES_VALIDOS.join(', ')}.`);
        }
    }

    // Valido modalidad_aceptada si viene.
    if (datos.modalidad_aceptada !== undefined) {
        if (!MODALIDADES_VALIDAS.includes(datos.modalidad_aceptada)) {
            errores.push(`modalidad_aceptada debe ser uno de: ${MODALIDADES_VALIDAS.join(', ')}.`);
        }
    }

    // Valido modelo_ia si viene.
    if (datos.modelo_ia !== undefined) {
        if (!MODELOS_IA_VALIDOS.includes(datos.modelo_ia)) {
            errores.push(`modelo_ia debe ser uno de: ${MODELOS_IA_VALIDOS.join(', ')}.`);
        }
    }

    // Valido stack_tecnologico: debe ser un array de strings no vacío.
    if (datos.stack_tecnologico !== undefined) {
        if (!Array.isArray(datos.stack_tecnologico) || datos.stack_tecnologico.length === 0) {
            errores.push('stack_tecnologico debe ser un array con al menos una tecnología.');
        } else if (!datos.stack_tecnologico.every(item => typeof item === 'string' && item.trim().length > 0)) {
            errores.push('stack_tecnologico debe contener solo strings no vacíos.');
        }
    }

    // Valido terminos_busqueda: debe ser un array de strings no vacío.
    if (datos.terminos_busqueda !== undefined) {
        if (!Array.isArray(datos.terminos_busqueda) || datos.terminos_busqueda.length === 0) {
            errores.push('terminos_busqueda debe ser un array con al menos un término.');
        } else if (!datos.terminos_busqueda.every(item => typeof item === 'string' && item.trim().length > 0)) {
            errores.push('terminos_busqueda debe contener solo strings no vacíos.');
        }
    }

    // Valido zonas_preferidas: cada zona debe ser del enum predefinido.
    if (datos.zonas_preferidas !== undefined) {
        if (!Array.isArray(datos.zonas_preferidas)) {
            errores.push('zonas_preferidas debe ser un array.');
        } else if (datos.zonas_preferidas.length > 0) {
            const zonasInvalidas = datos.zonas_preferidas.filter(z => !ZONAS_VALIDAS.includes(z));
            if (zonasInvalidas.length > 0) {
                errores.push(`zonas_preferidas contiene valores inválidos: ${zonasInvalidas.join(', ')}. Valores permitidos: ${ZONAS_VALIDAS.join(', ')}.`);
            }
        }
    }

    // Valido reglas_exclusion: debe ser un array de strings (puede estar vacío).
    if (datos.reglas_exclusion !== undefined) {
        if (!Array.isArray(datos.reglas_exclusion)) {
            errores.push('reglas_exclusion debe ser un array.');
        } else if (datos.reglas_exclusion.length > 0 && !datos.reglas_exclusion.every(item => typeof item === 'string' && item.trim().length > 0)) {
            errores.push('reglas_exclusion debe contener solo strings no vacíos.');
        }
    }

    // Valido usar_prompt_personalizado: debe ser boolean.
    if (datos.usar_prompt_personalizado !== undefined) {
        if (typeof datos.usar_prompt_personalizado !== 'boolean') {
            errores.push('usar_prompt_personalizado debe ser true o false.');
        }
    }

    // Si hay errores de validación, respondo 400 con todos los errores juntos.
    if (errores.length > 0) {
        return res.status(400).json({
            exito: false,
            error: errores.join(' '),
        });
    }

    const preferencias = await modeloPreferencia.actualizarPreferencias(datos);

    if (!preferencias) {
        return res.status(404).json({
            exito: false,
            error: 'No se encontraron preferencias para actualizar.',
        });
    }

    res.json({
        exito: true,
        datos: preferencias,
        mensaje: 'Preferencias actualizadas correctamente.',
    });
}

module.exports = {
    obtenerPreferencias,
    actualizarPreferencias,
    // Exporto las constantes para que los tests puedan validar contra ellas.
    NIVELES_VALIDOS,
    MODALIDADES_VALIDAS,
    ZONAS_VALIDAS,
    MODELOS_IA_VALIDOS,
};
