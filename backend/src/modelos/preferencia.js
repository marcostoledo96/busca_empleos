// Modelo de preferencias — funciones para leer y actualizar la configuración del usuario.
//
// La tabla preferencias tiene UNA SOLA FILA (id = 1) porque la app es de uso personal.
// No hay CRUD completo: no se crean ni se eliminan preferencias, solo se leen y actualizan.
//
// ¿Por qué no usar un archivo .env o .json para esto?
// Porque quiero que el usuario pueda cambiar su perfil, keywords y prompt
// desde el frontend (sin tocar archivos ni reiniciar el servidor).
// La BD persiste los cambios automáticamente.

const pool = require('../config/base-datos');

// ID fijo de la fila de preferencias. Siempre es 1.
const ID_PREFERENCIAS = 1;

/**
 * Obtengo las preferencias actuales del usuario.
 * Si la tabla está vacía, llamo a crearPreferenciasPorDefecto() para
 * garantizar que siempre haya una fila con id = 1.
 *
 * @returns {Object} Las preferencias del usuario.
 */
async function obtenerPreferencias() {
    const resultado = await pool.query(
        'SELECT * FROM preferencias WHERE id = $1',
        [ID_PREFERENCIAS]
    );

    if (resultado.rows.length > 0) {
        return resultado.rows[0];
    }

    return crearPreferenciasPorDefecto();
}

/**
 * Creo la fila de preferencias con los valores por defecto del perfil.
 * Si ya existe (ON CONFLICT), no modifica ningún dato.
 *
 * ¿Por qué uso ON CONFLICT DO UPDATE SET id = EXCLUDED.id?
 * Porque necesito el RETURNING * para devolver la fila existente.
 * El SET id = EXCLUDED.id es una operación sin efecto real: el id ya es 1.
 *
 * @returns {Object} Las preferencias creadas (o las existentes sin cambios).
 */
async function crearPreferenciasPorDefecto() {
    const resultado = await pool.query(
        `INSERT INTO preferencias (
            id, nombre, nivel_experiencia, perfil_profesional,
            idioma_candidato, stack_tecnologico, modalidad_aceptada, zonas_preferidas,
            terminos_busqueda, reglas_exclusion, modelo_ia
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
        RETURNING *`,
        [
            ID_PREFERENCIAS,
            'Marcos Ezequiel Toledo',
            'junior',
            'QA Tester, Desarrollador Full Stack y Soporte IT. Estudiante en el último cuatrimestre de la Tecnicatura Superior en Desarrollo de Software (IFTS 16, promedio 9.19). Perfil híbrido con experiencia real en HealthTech (AeroTest): documenté +80 bugs críticos, desarrollé app de historias clínicas (Angular 20, Node.js, PostgreSQL) y automaticé flujos con chatbots reduciendo tiempos de atención un 80%. Dirigente Scout +15 años. Busco roles técnicos de Desarrollo, Testing o Soporte IT en Buenos Aires, Argentina.',
            'Español nativo. Inglés: Reading A2 (lectura técnica elemental — documentación, código, APIs), Listening/Speaking A1 (básico, no conversacional)',
            ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'C#', 'SQL', 'Angular 20', 'React', 'React Native', 'Next.js', 'Node.js', 'Express', 'ASP.NET', 'Blazor', 'PostgreSQL', 'SQL Server', 'Git', 'API REST', 'Figma', 'Jest', 'xUnit', 'Moq'],
            'cualquiera',
            ['CABA', 'GBA Oeste'],
            ['qa tester', 'soporte tecnico it', 'programador', 'desarrollador junior c#', 'frontend developer angular', 'full stack node'],
            ['Java'],
            'deepseek-v4-flash',
        ]
    );

    return resultado.rows[0];
}

/**
 * Actualizo las preferencias del usuario.
 * Solo actualizo los campos que vengan en el objeto `datos`.
 * Los campos que no vengan se mantienen como estaban.
 *
 * ¿Por qué construyo la query dinámicamente?
 * Porque si el usuario solo quiere cambiar el nombre, no tiene sentido
 * sobreescribir todos los demás campos. Además, así el frontend puede
 * mandar solo los campos que cambió.
 *
 * @param {Object} datos - Los campos a actualizar.
 * @returns {Object|null} Las preferencias actualizadas, o null si no existe la fila.
 */
async function actualizarPreferencias(datos) {
    // Si viene tecnologias_detalle pero no viene stack_tecnologico, lo derivo
    // automáticamente para mantener compatibilidad con el prompt y código viejo.
    if (datos.tecnologias_detalle !== undefined && datos.stack_tecnologico === undefined) {
        datos.stack_tecnologico = datos.tecnologias_detalle
            .filter(tech => tech && tech.nombre && tech.nivel !== 'ninguno')
            .map(tech => tech.nombre)
            .filter((nombre, index, arr) => arr.indexOf(nombre) === index);
    }

    // Defino los campos que se pueden actualizar.
    // Si alguien manda un campo que no está en esta lista, se ignora.
    // Esto previene que se modifiquen campos internos como id o fecha_creacion.
    const camposPermitidos = [
        'nombre', 'nivel_experiencia', 'perfil_profesional', 'idioma_candidato',
        'stack_tecnologico', 'modalidad_aceptada', 'zonas_preferidas',
        'terminos_busqueda', 'reglas_exclusion',
        'prompt_personalizado', 'usar_prompt_personalizado', 'modelo_ia',
        'tecnologias_detalle', 'roles_objetivo_detalle',
        'preguntas_perfil_pendientes',
        'modelo_ia_evaluacion', 'modelo_ia_importacion',
        'disponibilidad', 'expectativa_salarial_min', 'expectativa_salarial_max',
        'moneda_salarial', 'nivel_ingles_detalle',
        'keywords_positivas', 'keywords_negativas',
        'plataformas_preferidas', 'plataformas_excluidas',
        'max_caracteres_descripcion_ia',
        'temperatura_evaluacion', 'temperatura_importacion',
        'anios_experiencia_reales',
        'priorizar_ofertas_ia', 'bonus_maximo_prioridad_ia',
        'nivel_real_seniority', 'conocimientos_ausentes', 'limitaciones_explicitas',
        'fecha_importacion_cv',
    ];

    // Campos que son JSONB en PostgreSQL. Necesito stringificarlos
    // explícitamente porque el driver pg puede no serializarlos bien
    // en ciertas versiones de Railway.
    const camposJsonb = new Set([
        'tecnologias_detalle', 'roles_objetivo_detalle',
        'preguntas_perfil_pendientes', 'nivel_ingles_detalle',
    ]);

    // Filtro solo los campos permitidos que vengan en datos.
    const camposActualizar = [];
    const valores = [];

    for (const campo of camposPermitidos) {
        if (datos[campo] !== undefined) {
            const valor = camposJsonb.has(campo)
                ? JSON.stringify(datos[campo])
                : datos[campo];
            valores.push(valor);
            camposActualizar.push(`${campo} = $${valores.length}`);
        }
    }

    // Si no hay nada que actualizar, retorno las preferencias actuales.
    if (camposActualizar.length === 0) {
        return obtenerPreferencias();
    }

    // Guardo backup de las preferencias actuales antes de sobrescribir.
    // El campo backup_preferencias guarda una copia completa de la fila anterior.
    try {
        const actuales = await pool.query('SELECT * FROM preferencias WHERE id = $1', [ID_PREFERENCIAS]);
        if (actuales.rows.length > 0) {
            await pool.query(
                'UPDATE preferencias SET backup_preferencias = $1::jsonb WHERE id = $2',
                [JSON.stringify(actuales.rows[0]), ID_PREFERENCIAS]
            );
        }
    } catch {
        // Si falla el backup, no bloqueo la actualización.
    }

    // Siempre actualizo fecha_actualizacion al momento actual.
    camposActualizar.push(`fecha_actualizacion = NOW()`);

    // Agrego el ID como último parámetro para el WHERE.
    valores.push(ID_PREFERENCIAS);

    const resultado = await pool.query(
        `UPDATE preferencias
         SET ${camposActualizar.join(', ')}
         WHERE id = $${valores.length}
         RETURNING *`,
        valores
    );

    return resultado.rows.length > 0 ? resultado.rows[0] : null;
}

module.exports = {
    obtenerPreferencias,
    actualizarPreferencias,
    crearPreferenciasPorDefecto,
};
