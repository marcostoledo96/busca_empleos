// Controlador de preferencias — maneja las requests HTTP para leer y actualizar
// la configuración del usuario (perfil, stack, keywords, prompt IA, etc.).
//
// Operaciones: obtener (GET), actualizar (PUT), importar CV (POST).
// No hay creación ni eliminación porque la tabla tiene una sola fila fija.

const modeloPreferencia = require('../modelos/preferencia');
const { consultarDeepSeek } = require('../config/deepseek');
const { IDS_PLATAFORMAS, normalizarIdPlataforma } = require('../config/plataformas');

/**
 * Normaliza los campos de plataformas en el objeto datos, convirtiendo
 * slugs HTTP (ej: 'google-jobs') a ids internos canónicos (ej: 'google_jobs').
 *
 * Se llama DESPUÉS de la validación y ANTES de persistir, para garantizar
 * que la BD siempre reciba el id interno, nunca el slug HTTP.
 */
function normalizarPlataformasEnDatos(datos) {
    if (datos.plataformas_preferidas && Array.isArray(datos.plataformas_preferidas)) {
        datos.plataformas_preferidas = datos.plataformas_preferidas.map(p => normalizarIdPlataforma(p) || p);
    }
    if (datos.plataformas_excluidas && Array.isArray(datos.plataformas_excluidas)) {
        datos.plataformas_excluidas = datos.plataformas_excluidas.map(p => normalizarIdPlataforma(p) || p);
    }
}

// Valores válidos para los campos con opciones fijas.
// Los defino acá para validar en el boundary del sistema (la API HTTP).
const NIVELES_VALIDOS = ['trainee', 'junior', 'semi-senior'];
const MODALIDADES_VALIDAS = ['cualquiera', 'remoto', 'hibrido', 'presencial'];
const ZONAS_VALIDAS = ['CABA', 'GBA Oeste', 'GBA Norte', 'GBA Sur', 'Interior'];
const MODELOS_IA_VALIDOS = [
    // Solo modelos DeepSeek compatibles con la API configurada.
    // Los demás (kimi, glm, qwen, mimo) requieren endpoints distintos
    // que todavía no están integrados en este servicio.
    'deepseek-v4-flash',
    'deepseek-v4-pro',
];

// Valores válidos para tecnologias_detalle.
const NIVELES_TECNOLOGIA = new Set(['ninguno', 'basico', 'medio', 'avanzado']);
const CATEGORIAS_TECNOLOGIA = new Set([
    'frontend', 'backend', 'base_de_datos', 'lenguaje',
    'testing', 'herramienta', 'metodologia', 'cloud', 'mobile', 'otro',
]);
const IMPORTANCIAS_TECNOLOGIA = new Set(['principal', 'secundaria', 'penalizable', 'no_prioritaria']);
const PRIORIDADES_ROL = new Set(['alta', 'media', 'baja']);
const DISPONIBILIDADES_VALIDAS = ['full_time', 'part_time', 'freelance', 'a_coordinar'];
const MONEDAS_SALARIALES_VALIDAS = ['ARS', 'USD', 'NO_FILTRAR'];

function validarArrayStrings(valor, campo, { maxItems = 100, permitirVacio = true } = {}) {
    if (!Array.isArray(valor)) {
        return `${campo} debe ser un array.`;
    }
    // Filtro strings vacías en silencio — el AutoComplete puede dejar items en blanco.
    const filtrado = valor.filter(item => typeof item === 'string' && item.trim().length > 0);
    if (!permitirVacio && filtrado.length === 0) {
        return `${campo} debe tener al menos un elemento.`;
    }
    if (filtrado.length > maxItems) {
        return `${campo} no puede superar ${maxItems} elementos.`;
    }
    return null;
}

function validarModeloIa(valor, campo) {
    if (valor === undefined) return null;
    if (!MODELOS_IA_VALIDOS.includes(valor)) {
        return `${campo} debe ser uno de: ${MODELOS_IA_VALIDOS.join(', ')}.`;
    }
    return null;
}

function validarNumeroEnRango(valor, campo, min, max) {
    if (valor === undefined || valor === null || valor === '') return null;
    const numero = Number(valor);
    if (Number.isNaN(numero) || numero < min || numero > max) {
        return `${campo} debe estar entre ${min} y ${max}.`;
    }
    return null;
}

function validarNivelInglesDetalle(valor) {
    if (valor === undefined) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
        return 'nivel_ingles_detalle debe ser un objeto.';
    }
    const campos = ['espanol', 'reading', 'writing', 'speaking', 'listening', 'regla'];
    for (const campo of campos) {
        if (valor[campo] !== undefined && valor[campo] !== null && typeof valor[campo] !== 'string') {
            return `nivel_ingles_detalle.${campo} debe ser string o null.`;
        }
    }
    return null;
}

function validarPlataformas(valor, campo) {
    if (valor === undefined) return null;
    const error = validarArrayStrings(valor, campo, { maxItems: 20, permitirVacio: true });
    if (error) return error;
    // Normalizo cada valor: acepto ids internos (google_jobs) y slugs HTTP (google-jobs).
    // Si un valor no se puede normalizar (no existe en el registry), es inválido.
    const invalidas = valor.filter(item => normalizarIdPlataforma(item) === null);
    if (invalidas.length > 0) {
        return `${campo} contiene plataformas inválidas: ${invalidas.join(', ')}.`;
    }
    return null;
}

/**
 * Valida que tecnologias_detalle sea un array JSON bien formado.
 * Cada item debe tener nombre (string), nivel, categoria, importancia y aliases opcionales.
 */
function validarTecnologiasDetalle(tecnologias) {
    if (!Array.isArray(tecnologias)) {
        return 'tecnologias_detalle debe ser un array.';
    }

    if (tecnologias.length > 100) {
        return 'tecnologias_detalle no puede superar 100 tecnologías.';
    }

    for (let i = 0; i < tecnologias.length; i++) {
        const tech = tecnologias[i];
        const prefijo = `tecnologias_detalle[${i}]`;

        if (!tech.nombre || typeof tech.nombre !== 'string' || tech.nombre.trim().length === 0) {
            return `${prefijo}: nombre es obligatorio.`;
        }

        if (!NIVELES_TECNOLOGIA.has(tech.nivel)) {
            return `${prefijo}: nivel inválido "${tech.nivel}". Debe ser: ${[...NIVELES_TECNOLOGIA].join(', ')}.`;
        }

        if (!CATEGORIAS_TECNOLOGIA.has(tech.categoria)) {
            return `${prefijo}: categoria inválida "${tech.categoria}". Debe ser: ${[...CATEGORIAS_TECNOLOGIA].join(', ')}.`;
        }

        if (tech.importancia && !IMPORTANCIAS_TECNOLOGIA.has(tech.importancia)) {
            return `${prefijo}: importancia inválida "${tech.importancia}".`;
        }

        if (tech.aliases !== undefined) {
            if (!Array.isArray(tech.aliases)) {
                return `${prefijo}: aliases debe ser un array.`;
            }
            if (tech.aliases.length > 20) {
                return `${prefijo}: aliases no puede superar 20.`;
            }
        }
    }

    return null; // sin errores
}

/**
 * Valida que roles_objetivo_detalle sea un array JSON bien formado.
 */
function validarRolesObjetivoDetalle(roles) {
    if (!Array.isArray(roles)) {
        return 'roles_objetivo_detalle debe ser un array.';
    }

    if (roles.length > 30) {
        return 'roles_objetivo_detalle no puede superar 30 roles.';
    }

    for (let i = 0; i < roles.length; i++) {
        const rol = roles[i];
        const prefijo = `roles_objetivo_detalle[${i}]`;

        if (!rol.rol || typeof rol.rol !== 'string' || rol.rol.trim().length === 0) {
            return `${prefijo}: rol es obligatorio.`;
        }

        if (!PRIORIDADES_ROL.has(rol.prioridad)) {
            return `${prefijo}: prioridad inválida "${rol.prioridad}". Debe ser: ${[...PRIORIDADES_ROL].join(', ')}.`;
        }
    }

    return null;
}

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
    try {
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
    const errorModeloIa = validarModeloIa(datos.modelo_ia, 'modelo_ia');
    if (errorModeloIa) errores.push(errorModeloIa);
    const errorModeloEval = validarModeloIa(datos.modelo_ia_evaluacion, 'modelo_ia_evaluacion');
    if (errorModeloEval) errores.push(errorModeloEval);
    const errorModeloImport = validarModeloIa(datos.modelo_ia_importacion, 'modelo_ia_importacion');
    if (errorModeloImport) errores.push(errorModeloImport);

    // Valido stack_tecnologico: debe ser un array de strings.
    // Si tecnologias_detalle tiene al menos una entrada válida (nivel != ninguno),
    // permito que stack_tecnologico esté vacío — el modelo lo deriva automáticamente.
    const tieneTecnologiasValidas = Array.isArray(datos.tecnologias_detalle)
        && datos.tecnologias_detalle.some(t => t && t.nombre && t.nivel !== 'ninguno');

    if (datos.stack_tecnologico !== undefined) {
        if (!Array.isArray(datos.stack_tecnologico)) {
            errores.push('stack_tecnologico debe ser un array.');
        } else if (!tieneTecnologiasValidas && datos.stack_tecnologico.length === 0) {
            errores.push('stack_tecnologico debe tener al menos una tecnología si tecnologias_detalle está vacío o no tiene tecnologías con nivel distinto a ninguno.');
        } else if (datos.stack_tecnologico.length > 0 && !datos.stack_tecnologico.every(item => typeof item === 'string' && item.trim().length > 0)) {
            errores.push('stack_tecnologico debe contener solo strings no vacíos.');
        }
    }

    // Valido terminos_busqueda: debe ser un array de strings no vacío.
    if (datos.terminos_busqueda !== undefined) {
        const error = validarArrayStrings(datos.terminos_busqueda, 'terminos_busqueda', { maxItems: 100, permitirVacio: false });
        if (error) errores.push(error);
    }

    // Valido zonas_preferidas: si viene, debe ser un array de strings.
    // Ya no restringimos a zonas predefinidas porque el CV importado puede
    // contener ubicaciones reales como "Buenos Aires, Argentina".
    if (datos.zonas_preferidas !== undefined) {
        if (!Array.isArray(datos.zonas_preferidas)) {
            errores.push('zonas_preferidas debe ser un array.');
        } else if (datos.zonas_preferidas.length > 0) {
            // Validar contra zonas del enum si los valores no son conocidos
            // Permitimos valores personalizados del CV, pero no arrays vacíos.
            const zonasInvalidas = datos.zonas_preferidas.filter(
                z => typeof z !== 'string' || z.trim().length === 0
            );
            if (zonasInvalidas.length > 0) {
                errores.push('zonas_preferidas contiene valores inválidos.');
            }
        }
    }

    // Valido reglas_exclusion: debe ser un array de strings (puede estar vacío).
    if (datos.reglas_exclusion !== undefined) {
        const error = validarArrayStrings(datos.reglas_exclusion, 'reglas_exclusion', { maxItems: 100, permitirVacio: true });
        if (error) errores.push(error);
    }

    // Valido usar_prompt_personalizado: debe ser boolean.
    if (datos.usar_prompt_personalizado !== undefined) {
        if (typeof datos.usar_prompt_personalizado !== 'boolean') {
            errores.push('usar_prompt_personalizado debe ser true o false.');
        }
    }

    // Valido idioma_candidato: si viene, debe ser string no vacío.
    if (datos.idioma_candidato !== undefined) {
        if (typeof datos.idioma_candidato !== 'string' || datos.idioma_candidato.trim().length === 0) {
            errores.push('idioma_candidato debe ser un texto no vacío.');
        }
    }

    // Valido tecnologias_detalle: array JSON con nivel, categoria, nombre y aliases.
    if (datos.tecnologias_detalle !== undefined) {
        const errorTecnologias = validarTecnologiasDetalle(datos.tecnologias_detalle);
        if (errorTecnologias) errores.push(errorTecnologias);
    }

    // Valido roles_objetivo_detalle: array JSON con rol y prioridad.
    if (datos.roles_objetivo_detalle !== undefined) {
        const errorRoles = validarRolesObjetivoDetalle(datos.roles_objetivo_detalle);
        if (errorRoles) errores.push(errorRoles);
    }

    // Valido preguntas_perfil_pendientes: array JSON de preguntas.
    if (datos.preguntas_perfil_pendientes !== undefined) {
        if (!Array.isArray(datos.preguntas_perfil_pendientes)) {
            errores.push('preguntas_perfil_pendientes debe ser un array.');
        }
    }

    if (datos.disponibilidad !== undefined) {
        if (!DISPONIBILIDADES_VALIDAS.includes(datos.disponibilidad)) {
            errores.push(`disponibilidad debe ser una de: ${DISPONIBILIDADES_VALIDAS.join(', ')}.`);
        }
    }

    if (datos.moneda_salarial !== undefined) {
        if (!MONEDAS_SALARIALES_VALIDAS.includes(datos.moneda_salarial)) {
            errores.push(`moneda_salarial debe ser una de: ${MONEDAS_SALARIALES_VALIDAS.join(', ')}.`);
        }
    }

    const errorSalarioMin = validarNumeroEnRango(datos.expectativa_salarial_min, 'expectativa_salarial_min', 0, 999999999);
    if (errorSalarioMin) errores.push(errorSalarioMin);
    const errorSalarioMax = validarNumeroEnRango(datos.expectativa_salarial_max, 'expectativa_salarial_max', 0, 999999999);
    if (errorSalarioMax) errores.push(errorSalarioMax);
    if (
        datos.expectativa_salarial_min !== undefined && datos.expectativa_salarial_max !== undefined &&
        datos.expectativa_salarial_min !== null && datos.expectativa_salarial_max !== null &&
        Number(datos.expectativa_salarial_min) > Number(datos.expectativa_salarial_max)
    ) {
        errores.push('expectativa_salarial_min no puede ser mayor que expectativa_salarial_max.');
    }

    const errorNivelIngles = validarNivelInglesDetalle(datos.nivel_ingles_detalle);
    if (errorNivelIngles) errores.push(errorNivelIngles);

    const errorKeywordsPos = datos.keywords_positivas !== undefined
        ? validarArrayStrings(datos.keywords_positivas, 'keywords_positivas', { maxItems: 100, permitirVacio: true })
        : null;
    if (errorKeywordsPos) errores.push(errorKeywordsPos);

    const errorKeywordsNeg = datos.keywords_negativas !== undefined
        ? validarArrayStrings(datos.keywords_negativas, 'keywords_negativas', { maxItems: 100, permitirVacio: true })
        : null;
    if (errorKeywordsNeg) errores.push(errorKeywordsNeg);

    const errorPlataformasPref = validarPlataformas(datos.plataformas_preferidas, 'plataformas_preferidas');
    if (errorPlataformasPref) errores.push(errorPlataformasPref);
    const errorPlataformasExc = validarPlataformas(datos.plataformas_excluidas, 'plataformas_excluidas');
    if (errorPlataformasExc) errores.push(errorPlataformasExc);

    const errorMaxChars = validarNumeroEnRango(datos.max_caracteres_descripcion_ia, 'max_caracteres_descripcion_ia', 500, 10000);
    if (errorMaxChars) errores.push(errorMaxChars);
    const errorTempEval = validarNumeroEnRango(datos.temperatura_evaluacion, 'temperatura_evaluacion', 0, 1);
    if (errorTempEval) errores.push(errorTempEval);
    const errorTempImport = validarNumeroEnRango(datos.temperatura_importacion, 'temperatura_importacion', 0, 1);
    if (errorTempImport) errores.push(errorTempImport);

    const errorAniosExperiencia = validarNumeroEnRango(datos.anios_experiencia_reales, 'anios_experiencia_reales', 0, 50);
    if (errorAniosExperiencia) errores.push(errorAniosExperiencia);

    // Si hay errores de validación, respondo 400 con todos los errores juntos.
    if (errores.length > 0) {
        return res.status(400).json({
            exito: false,
            error: errores.join(' '),
        });
    }

    // Sanitizo JSONB antes de pasar al modelo: elimino undefined que rompen PostgreSQL.
    if (datos.nivel_ingles_detalle) {
        datos.nivel_ingles_detalle = JSON.parse(JSON.stringify(datos.nivel_ingles_detalle));
    }
    if (datos.preguntas_perfil_pendientes) {
        datos.preguntas_perfil_pendientes = JSON.parse(JSON.stringify(datos.preguntas_perfil_pendientes));
    }

    // Normalizo slugs HTTP a ids internos antes de persistir.
    // Si el cliente mandó 'google-jobs', lo convierto a 'google_jobs'
    // para que la BD siempre reciba el id canónico.
    normalizarPlataformasEnDatos(datos);

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
} catch (err) {
    console.error('[PUT /api/preferencias] Error interno:', err.message, err.stack);
    return res.status(500).json({
        exito: false,
        error: 'Error interno al guardar preferencias.',
    });
}
}

/**
 * POST /api/preferencias/importar-cv/analizar
 * Recibe un archivo Markdown con el CV y lo analiza con DeepSeek para extraer
 * preferencias estructuradas (tecnologías, roles, idioma, zonas, etc.).
 * No guarda nada — solo devuelve la sugerencia para que el usuario confirme.
 */
async function analizarCvMarkdown(req, res) {
    // Multer ya validó que el archivo existe y es .md. Si no, no llega acá.
    const archivo = req.file;

    if (!archivo) {
        return res.status(400).json({
            exito: false,
            error: 'No se recibió ningún archivo. Asegurate de enviar un .md.',
        });
    }

    const contenidoMarkdown = archivo.buffer.toString('utf-8');

    if (!contenidoMarkdown || contenidoMarkdown.trim().length === 0) {
        return res.status(400).json({
            exito: false,
            error: 'El archivo está vacío.',
        });
    }

    try {
        // Obtener preferencias actuales para usar el modelo configurado.
        let modeloImportacion = 'deepseek-v4-pro';
        try {
            const prefs = await modeloPreferencia.obtenerPreferencias();
            modeloImportacion = prefs.modelo_ia_importacion || 'deepseek-v4-pro';
        } catch {
            // Si falla la lectura, usar V4 Pro por defecto.
        }

        const promptSistema = construirPromptExtraccionSistema();
        const promptUsuario = construirPromptExtraccionUsuario(contenidoMarkdown);

        // Usar el modelo de importación (V4 Pro por defecto), no el de evaluación.
        const respuestaTexto = await consultarDeepSeek(promptSistema, promptUsuario, modeloImportacion);

        // Limpiar markdown code blocks.
        const jsonLimpio = respuestaTexto
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const datos = JSON.parse(jsonLimpio);

        // Validación manual básica.
        if (!datos.tecnologias_detalle || !Array.isArray(datos.tecnologias_detalle)) {
            return res.status(422).json({
                exito: false,
                error: 'DeepSeek no pudo extraer tecnologías del CV.',
                datosCrudos: datos,
            });
        }

        res.json({
            exito: true,
            datos: {
                nombre: datos.nombre || null,
                nivel_experiencia: datos.nivel_experiencia || null,
                perfil_profesional: datos.perfil_profesional || null,
                idioma_candidato: datos.idioma_candidato || null,
                modalidad_aceptada: datos.modalidad_aceptada || null,
                zonas_preferidas: datos.zonas_preferidas || [],
                disponibilidad: datos.disponibilidad || null,
                expectativa_salarial_min: datos.expectativa_salarial_min ?? null,
                expectativa_salarial_max: datos.expectativa_salarial_max ?? null,
                moneda_salarial: datos.moneda_salarial || 'NO_FILTRAR',
                nivel_ingles_detalle: datos.nivel_ingles_detalle || null,
                tecnologias_detalle: datos.tecnologias_detalle || [],
                roles_objetivo_detalle: datos.roles_objetivo_detalle || [],
                terminos_busqueda: datos.terminos_busqueda || [],
                reglas_exclusion: datos.reglas_exclusion || [],
                keywords_positivas: datos.keywords_positivas || [],
                keywords_negativas: datos.keywords_negativas || [],
                plataformas_preferidas: datos.plataformas_preferidas || [],
                plataformas_excluidas: datos.plataformas_excluidas || [],
                preguntas: datos.preguntas || [],
                preguntas_perfil_pendientes: datos.preguntas_perfil_pendientes || datos.preguntas || [],
                advertencias: datos.advertencias || [],
            },
        });
    } catch (error) {
        const esErrorParseo = error instanceof SyntaxError;

        console.error('[Importar CV] Error:', error.message);

        return res.status(500).json({
            exito: false,
            error: esErrorParseo
                ? 'DeepSeek devolvió una respuesta que no se pudo interpretar. Probá de nuevo.'
                : 'No se pudo analizar el CV. Verificá que DeepSeek esté disponible.',
        });
    }
}

/**
 * Prompt de sistema para extracción de CV.
 */
function construirPromptExtraccionSistema() {
    return `Sos un extractor de perfiles laborales. Tu trabajo es leer un CV en Markdown y devolver datos estructurados en JSON.

Reglas estrictas:
- NO inventes tecnologías que no aparezcan en el CV.
- Si una tecnología aparece en proyectos reales y en producción, nivel "avanzado".
- Si aparece en proyectos reales pero de forma parcial, nivel "medio".
- Si aparece solo como formación, cursada o mención secundaria, nivel "basico" o "medio".
- Si el CV incluye una sección "Perfil estructurado para Busca Empleos AI", usala como fuente prioritaria.
- Si una tecnología aparece como "penalizable" o "no dominada", nivel "ninguno".
- NO confundas Java con JavaScript. Son tecnologías distintas.
- Para cada tecnología incluí aliases técnicos (mínimo 1, máximo 5).
- Si hay datos que no podés inferir con certeza, ponelos en "advertencias".
- Si detectás que faltan datos importantes, generá "preguntas" para el usuario.

Devolvé SOLO JSON válido con este formato:
{
  "nombre": string | null,
  "nivel_experiencia": "trainee" | "junior" | "semi-senior" | null,
  "perfil_profesional": string | null,
  "idioma_candidato": string | null,
  "modalidad_aceptada": "cualquiera" | "remoto" | "hibrido" | "presencial" | null,
  "zonas_preferidas": string[],
  "disponibilidad": "full_time" | "part_time" | "freelance" | "a_coordinar" | null,
  "expectativa_salarial_min": number | null,
  "expectativa_salarial_max": number | null,
  "moneda_salarial": "ARS" | "USD" | "NO_FILTRAR" | null,
  "nivel_ingles_detalle": {
    "espanol": string | null,
    "reading": string | null,
    "writing": string | null,
    "speaking": string | null,
    "listening": string | null,
    "regla": string | null
  },
  "tecnologias_detalle": [
    {
      "nombre": string,
      "nivel": "ninguno" | "basico" | "medio" | "avanzado",
      "categoria": "frontend" | "backend" | "base_de_datos" | "lenguaje" | "testing" | "herramienta" | "metodologia" | "cloud" | "otro",
      "importancia": "principal" | "secundaria" | "penalizable",
      "aliases": string[],
      "evidencia": string
    }
  ],
  "roles_objetivo_detalle": [
    {
      "rol": string,
      "prioridad": "alta" | "media" | "baja",
      "aliases": string[],
      "evidencia": string
    }
  ],
  "terminos_busqueda": string[],
  "reglas_exclusion": string[],
  "keywords_positivas": string[],
  "keywords_negativas": string[],
  "plataformas_preferidas": string[],
  "plataformas_excluidas": string[],
  "preguntas": [
    {
      "campo": string,
      "pregunta": string,
      "motivo": string,
      "sugerencia": string | null
    }
  ],
  "preguntas_perfil_pendientes": [
    {
      "campo": string,
      "pregunta": string,
      "motivo": string,
      "sugerencia": string | null
    }
  ],
  "advertencias": string[]
}`;
}

/**
 * Prompt de usuario con el contenido del CV.
 */
function construirPromptExtraccionUsuario(contenidoMarkdown) {
    // Recorto a 15000 caracteres para no exceder límites de tokens.
    const contenidoRecortado = contenidoMarkdown.slice(0, 15000);

    return `Analizá este CV en Markdown y extraé los datos estructurados.

CV:
"""${contenidoRecortado}"""`;
}

module.exports = {
    obtenerPreferencias,
    actualizarPreferencias,
    analizarCvMarkdown,
    NIVELES_VALIDOS,
    MODALIDADES_VALIDAS,
    ZONAS_VALIDAS,
    MODELOS_IA_VALIDOS,
};
