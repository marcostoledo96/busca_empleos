// Servicio de evaluación con IA — decide si una oferta hace match con mi perfil.
//
// Flujo para cada oferta:
// 1. Construyo un prompt con los datos de la oferta + mi perfil.
// 2. Se lo mando a DeepSeek (IA).
// 3. DeepSeek responde con JSON: { match: true/false, razon: "..." }.
// 4. Parseo la respuesta y actualizo el estado en la base de datos.
//
// ¿Por qué le pido que responda en JSON y no en texto libre?
// Porque el JSON lo puedo parsear programáticamente con JSON.parse().
// Si respondiera en texto libre, tendría que adivinar si dijo "sí" o "no"
// analizando el texto — mucho más frágil y propenso a errores.
//
// ¿Qué es "prompt engineering"? Es el arte de escribir instrucciones claras
// para la IA. Cuanto más específico y estructurado sea el prompt, mejor
// la respuesta. Es como darle un brief a un diseñador: si le decís
// "haceme algo lindo" te da cualquier cosa. Si le decís exactamente qué
// querés, colores, medidas, tipografía — te clava el diseño.

const { consultarDeepSeek } = require('../config/deepseek');
const modeloOferta = require('../modelos/oferta');
const modeloPreferencia = require('../modelos/preferencia');
const evaluacionCache = require('../modelos/evaluacion-cache');
const evaluacionLote = require('../modelos/evaluacion-lote');
const { parsearRespuestaEvaluacionIa } = require('./evaluacion/parser-respuesta-ia');
const { evaluarReglasExclusion } = require('./evaluacion/reglas-exclusion');

// Progreso de la evaluación en curso.
// ¿Por qué un objeto en memoria y no en la BD? Porque el progreso es efímero:
// nace cuando arranca la evaluación y muere cuando termina. No tiene sentido
// guardarlo en la base de datos; alcanza con que sea accesible dentro del
// mismo proceso de Node.js. El frontend hace polling cada 2 segundos.
let progresoEvaluacion = {
    activo: false,
    total: 0,
    evaluadas: 0,
    aprobadas: 0,
    rechazadas: 0,
    errores: 0,
    porcentaje: 0,
};

// Bandera para interrumpir el loop de evaluación.
let _cancelarEvaluacion = false;

/**
 * Devuelvo una copia del estado actual del progreso.
 * @returns {Object} Estado del progreso de evaluación.
 */
function obtenerProgresoEvaluacion() {
    return { ...progresoEvaluacion };
}

/**
 * Activo la bandera de cancelación para que el loop de evaluarOfertasPendientes
 * se detenga después de procesar la oferta actual (no la corta a mitad de oferta).
 */
function cancelarEvaluacionPendiente() {
    _cancelarEvaluacion = true;
}

/**
 * Construyo el texto del perfil del candidato a partir de las preferencias
 * guardadas en la base de datos.
 *
 * ¿Por qué una función y no una constante? Porque ahora el perfil es
 * dinámico: el usuario puede cambiar su stack, su nivel, sus zonas
 * preferidas y sus reglas de exclusión desde la página de preferencias.
 * Cada vez que se evalúa un lote, se lee el perfil actualizado.
 *
 * @param {Object} prefs - Fila de la tabla preferencias.
 * @returns {string} Texto del perfil para el prompt de la IA.
 */
function construirPerfilDesdePreferencias(prefs) {
    const nombre = prefs.nombre || 'Candidato';
    const nivel = prefs.nivel_experiencia || 'junior';
    const stack = prefs.stack_tecnologico || [];
    const modalidad = prefs.modalidad_aceptada || 'cualquiera';
    const zonas = prefs.zonas_preferidas || [];
    const exclusiones = Array.isArray(prefs.reglas_exclusion)
        ? prefs.reglas_exclusion.filter(r => typeof r === 'string' && r.trim().length > 0)
        : [];
    const perfil = prefs.perfil_profesional || '';
    const idioma = prefs.idioma_candidato || 'Español nativo';

    const partes = [];

    partes.push(`Soy ${nombre}, un candidato de nivel ${nivel} buscando empleo en tecnología.`);

    partes.push('');
    partes.push('MIS ROLES OBJETIVO (Aceptar ofertas si se trata de alguno de estos perfiles):');
    partes.push('1. QA Tester / Analista QA / Tester Funcional (experiencia en pruebas E2E, reporte de bugs, metodologías ágiles).');
    partes.push('2. Desarrollador Frontend / Full-Stack / Backend (Angular, React, Node.js, Express, PostgreSQL, C#).');
    partes.push('3. Soporte Técnico IT / Help Desk / Analista de Soporte: SOLO aceptar si el foco es soporte de SOFTWARE, aplicaciones, sistemas, Google Workspace, tickets, accesos o herramientas digitales. El candidato tiene poca experiencia en hardware físico (reparación de equipos, redes físicas, cableado, impresoras). Si la oferta pide principalmente soporte de hardware o infraestructura física, asignar porcentaje bajo (≤30) y rechazar si es excluyente.');

    if (perfil.trim()) {
        partes.push('');
        partes.push('Sobre mí:');
        partes.push(perfil.trim());
    }

    if (stack.length > 0) {
        partes.push('');
        partes.push('Mi stack tecnológico:');
        partes.push(stack.join(', '));
    }

    partes.push('');
    partes.push('Herramientas que manejo:');
    partes.push('Jira, Postman, Git, GitHub Actions (CI/CD), Figma, AnyDesk, Google Workspace (administración), phpMyAdmin, VSCode.');

    partes.push('');
    partes.push('BONUS — Herramientas de IA y Next.js (diferencial fuerte):');
    partes.push('Uso intensivo de herramientas de IA para productividad en desarrollo, testing y documentación: Claude Code, Codex (OpenAI), OpenCode, Antigravity. También menciono GitHub Copilot y ChatGPT como contexto adicional de uso habitual.');
    partes.push('Next.js es parte de mi stack aceptado: lo manejo a nivel práctico junto con React y TypeScript.');
    partes.push('REGLA DE BONUS: Si la oferta valora el uso competente de IA en desarrollo/testing/documentación/productividad, o menciona Next.js favorablemente, sumar al porcentaje de match. Este bonus es un diferencial fuerte de mi perfil.');
    partes.push('REGLA ESTRICTA DE SALVAGUARDA: El bonus de IA y Next.js NO compensa exclusiones. Si la oferta requiere Java como tecnología principal/excluyente, pide nivel Senior/Lead, o exige >3 años / 3+ años / al menos 3 años / mínimo 3 años / 3+ anos de experiencia comprobable, el bonus NO aplica y la oferta debe rechazarse. Tampoco compensa requisitos de inglés avanzado/fluido/bilingüe o ubicación fuera de zonas preferidas.');

    partes.push('');
    partes.push('Metodologías:');
    partes.push('Scrum, Kanban, metodologías ágiles, MoSCoW. Diagramas UML (casos de uso, clases, secuencia, flujo) con PlantUML.');

    partes.push('');
    partes.push('Proyectos propios en producción con usuarios reales (equivalen a experiencia práctica):');
    partes.push('- AeroTest (HealthTech, activo): QA Tester, Desarrollador Full-Stack y Soporte IT en consultorio médico (+80 bugs documentados, app de historias clínicas, chatbot con -80% tiempos de atención).');
    partes.push('- Scout San Patricio: plataforma web institucional con +170 usuarios activos (Blazor, C#, ASP.NET, SQL Server).');
    partes.push('- IFTS N°26: sitio web oficial institucional en producción (Angular, CI/CD con GitHub/Netlify).');
    partes.push('- Busca Empleos AI: sistema automatizado con scraping + IA en producción (Angular 20, Node.js, PostgreSQL, Firebase Auth).');
    partes.push('- SanpaHolmes: e-commerce con +60 transacciones reales simultáneas (React, Node.js, PostgreSQL).');

    partes.push('');
    const modalidadTexto = modalidad === 'cualquiera'
        ? 'Cualquiera (Remoto, Híbrido, Presencial)'
        : modalidad.charAt(0).toUpperCase() + modalidad.slice(1);
    partes.push(`Modalidad aceptada: ${modalidadTexto}.`);

    // Instrucciones sobre Next.js y herramientas IA como favorables.
    partes.push('');
    partes.push('NOTA SOBRE NEXT.JS E IA:');
    partes.push('Next.js está en mi stack aceptado. Si la oferta menciona Next.js como tecnología deseable o requerida, considerarlo como match positivo.');
    partes.push('Si la oferta valora el uso de IA (Claude Code, Codex, OpenCode, Antigravity, Copilot, ChatGPT, LLM, IA generativa, prompt engineering) para desarrollo, testing, documentación o productividad, considerarlo como diferencial positivo de mi perfil. Es un uso fuerte y real, no solo teórico.');
    partes.push('Sin embargo, el bonus por IA/Next.js NO anula las exclusiones: Java como requisito principal sigue siendo rechazo automático, Senior/Lead o >3 años / 3+ años / al menos 3 años / mínimo 3 años excluyentes sigue siendo rechazo, inglés avanzado excluyente sigue siendo rechazo, y ubicación fuera de zona sigue las reglas habituales.');

    if (zonas.length > 0) {
        partes.push(`Zonas preferidas para trabajo presencial: ${zonas.join(', ')}.`);
    }

    if (exclusiones.length > 0) {
        partes.push('');
        partes.push('REGLAS ESTRICTAS DE EXCLUSIÓN:');
        for (const regla of exclusiones) {
            partes.push(`- Si la oferta requiere ${regla} como tecnología principal o excluyente, RECHAZAR automáticamente con match: false. ${regla} NO está en mi stack y NO me interesa.`);
        }
        // Aclaro la diferencia Java/JavaScript que es un error común de la IA.
        if (exclusiones.some(r => r.toLowerCase() === 'java')) {
            partes.push('- Esta regla NO aplica a JavaScript (que SÍ está en mi stack). No confundir Java con JavaScript.');
        }
    }

    partes.push('');
    partes.push('MI NIVEL DE IDIOMAS:');
    partes.push(idioma);
    partes.push('REGLAS ESTRICTAS DE INDUSTRIA Y TIPO DE ROL:');
    partes.push('- Si es un rol tecnológico (ej. Soporte Técnico, Desarrollador, QA) dentro de una empresa o contexto no tecnológico (hotel, hospital, agro, fábrica), SÍ ES VÁLIDO Y DEBE SER ACEPTADO.');
    partes.push('- EXCLUSIÓN ABSOLUTA: Si el ROL en sí mismo es no tecnológico (ej: Agrónomo, Médico, Mecánico, Administrativo puro, Vendedor, Operario), RECHAZAR automáticamente con match: false y porcentaje 0.');
    partes.push('- Cuidado con los roles de CALIDAD (Aseguramiento de Calidad / QA): Solo aceptar si son de QA de Software (testing). Rechazar los que sean QA industrial, farmacéutico o de manufactura.');
    partes.push('- Aunque tenga experiencia en salud, busco EXCLUSIVAMENTE roles tecnológicos (Desarrollo, Testing, Soporte IT). Rechazar cualquier rol de atención al paciente o administración pura.');
    partes.push('- Si la oferta pide "sistemas" refiriéndose a data entry o cajero, RECHAZAR. Solo aceptar si es para CONSTRUIR, TESTEAR o DAR SOPORTE a software/hardware.');
    partes.push('- SOPORTE IT: Si la oferta de Soporte Técnico menciona principalmente reparación de hardware físico, armado de PCs, redes físicas, cableado o mantenimiento de impresoras/periféricos SIN componente de soporte de software, asignar porcentaje ≤30 y rechazar (match: false). Aceptar SOLO si el soporte es de software, aplicaciones, sistemas operativos, herramientas digitales o atención online a usuarios.');

    return partes.join('\n');
}

/**
 * Construyo las instrucciones de sistema para DeepSeek a partir de las preferencias.
 *
 * Estas instrucciones le dicen a la IA QUIÉN ES, CÓMO debe responder,
 * y QUÉ CRITERIOS usar para evaluar. Es el "brief completo" que recibe.
 *
 * @param {Object} prefs - Fila de la tabla preferencias.
 * @returns {string} Instrucciones de sistema completas.
 */
function construirInstruccionesDesdePreferencias(prefs) {
    // Las instrucciones base SIEMPRE se construyen. Si el usuario activó
    // su prompt personalizado, se agrega al final como criterios adicionales
    // que NUNCA pueden anular las exclusiones fuertes (Java, Senior, 3+ años,
    // inglés avanzado, presencial fuera de zona).
    // Antes este campo reemplazaba todo el prompt; ahora es adicional.

    const perfil = construirPerfilDesdePreferencias(prefs);
    const zonas = prefs.zonas_preferidas || [];
    const nivel = prefs.nivel_experiencia || 'junior';

    const partes = [];

    partes.push('Sos un evaluador de ofertas de empleo. Tu trabajo es determinar si una oferta laboral hace "match" con el perfil de un candidato.');
    partes.push('');
    partes.push(perfil);
    partes.push('');
    partes.push('INSTRUCCIONES DE RESPUESTA:');
    partes.push('1. Analizá la oferta comparándola con el perfil del candidato.');
    partes.push('2. Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional.');
    partes.push('3. Formato exacto de respuesta:');
    partes.push('   {"match": true, "porcentaje": 85, "razon": "Explicación breve de por qué matchea"}');
    partes.push('   o');
    partes.push('   {"match": false, "porcentaje": 20, "razon": "Explicación breve de por qué no matchea"}');
    partes.push('');
    partes.push('CRITERIOS DE EVALUACIÓN:');
    partes.push('- "porcentaje" es un número entero de 0 a 100 que indica qué tan compatible es la oferta con el perfil del candidato. Tiene que reflejar la calidad del match: 90-100 = match perfecto, 70-89 = buen match, 50-69 = match parcial, 0-49 = no matchea.');
    partes.push('- match: true si el candidato cumple con al menos el 60% de los requisitos técnicos.');

    // Niveles aceptables dependen del nivel del candidato.
    if (nivel === 'trainee') {
        partes.push('- match: true si el nivel pedido es trainee, o no se especifica nivel.');
        partes.push('- match: false si requiere nivel junior con experiencia comprobable, semi-senior, o senior.');
    } else if (nivel === 'junior') {
        partes.push('- match: true si el nivel pedido es trainee, junior, o no se especifica nivel.');
        partes.push('- Si la oferta pide 1 o 2 años de experiencia: ACEPTAR. El candidato tiene múltiples proyectos en producción con usuarios reales que equivalen a experiencia práctica comprobable.');
        partes.push('- match: false SOLO si requiere explícitamente más de 3 años de experiencia laboral formal, o nivel Semi-Senior/Senior como condición excluyente.');
    } else if (nivel === 'semi-senior') {
        partes.push('- match: true si el nivel pedido es junior, semi-senior, o no se especifica nivel.');
        partes.push('- match: false si requiere nivel Senior o más de 5 años de experiencia comprobable.');
    }

    // Reglas de exclusión dinámicas.
    const exclusiones = prefs.reglas_exclusion || [];
    if (exclusiones.length > 0) {
        for (const regla of exclusiones) {
            partes.push(`- match: false si requiere ${regla} (no confundir con tecnologías similares) como tecnología principal.`);
        }
    }

    partes.push('- match: false si requiere tecnologías completamente fuera del stack del candidato como requisito principal.');
    partes.push('- Las ofertas que pidan .NET, C#, ASP.NET o Blazor son válidas: el candidato tiene experiencia real con esas tecnologías en proyectos en producción. No rechazar por ser "stack Microsoft".');
    partes.push('- Las ofertas de Desarrollador Mobile con React Native son match parcial válido (porcentaje 60-75): el candidato tiene proyectos en React Native pero sin experiencia laboral específica en mobile.');
    partes.push('- BONUS HealthTech: Si la empresa opera en el sector salud o medicina y busca un perfil tecnológico (QA, Dev, Soporte IT), sumar hasta +5 al porcentaje: el candidato tiene experiencia real en ese contexto.');
    partes.push('- Las ofertas que mencionen Jira, Scrum, Agile, CI/CD, Figma o Postman como requisito son favorables: el candidato maneja todas esas herramientas.');

    // Criterio de idioma: basado en el nivel declarado del candidato.
    partes.push('');
    partes.push('CRITERIOS DE IDIOMA (REGLA ESTRICTA):');
    partes.push('Nivel real del candidato en inglés: Listening A1 (básico) | Reading A2 (lectura técnica elemental — entiende documentación, código, APIs, mensajes de error, pero NO textos complejos ni artículos largos en inglés).');
    partes.push('El candidato NO habla portugués ni otros idiomas distintos de español/inglés básico técnico. Si la publicación está principalmente en un idioma que no sea español, debe quedar con score muy bajo o rechazarse.');
    partes.push('- REGLA PRINCIPAL: Si la publicación está escrita principalmente en inglés (más del 50% del texto en inglés), RECHAZAR con match: false y porcentaje ≤15. Una oferta escrita en inglés implica que el trabajo se desarrolla en inglés: las reuniones, el equipo, la comunicación diaria y los entregables serán en inglés. El idioma de la publicación ES una señal directa del idioma de trabajo.');
    partes.push('- Si la oferta requiere inglés fluido/avanzado/bilingüe/conversacional/upper-intermediate como condición excluyente, RECHAZAR con match: false y porcentaje ≤15. El candidato NO puede sostener reuniones, calls ni trabajo diario hablado en inglés (nivel A1 oral).');
    partes.push('- Si la oferta requiere inglés intermedio oral (B1+) para comunicarse con equipos o clientes, RECHAZAR. El candidato tiene nivel A1 en listening/speaking.');
    partes.push('- Si la oferta es en español pero menciona inglés como "deseable", "plus", "nice to have" o "es un plus", NO penalizar. No es excluyente.');
    partes.push('- Si la oferta requiere inglés SOLO para lectura de documentación técnica, código fuente, APIs o mensajes de error, ACEPTAR: el candidato tiene nivel A2 de lectura que cubre ese caso.');
    partes.push('- Si la oferta dice "inglés básico" o "inglés técnico" sin especificar oral, ACEPTAR con precaución (porcentaje sin penalización).');
    partes.push('- Ante la duda sobre el nivel de inglés requerido: si la oferta menciona "daily standups in English", "English-speaking team", "communicate in English", RECHAZAR.');

    // Criterios de ubicación/zona si hay zonas preferidas.
    if (zonas.length > 0) {
        partes.push('');
        partes.push('CRITERIOS DE UBICACIÓN (REGLA ESTRICTA):');
        partes.push(`- Aceptar ofertas presenciales/híbridas ÚNICAMENTE si la ubicación coincide con alguna de estas zonas: ${zonas.join(', ')}.`);
        partes.push('- Si la oferta es PRESENCIAL y la ubicación NO está en las zonas listadas arriba, RECHAZAR automáticamente con match: false y porcentaje 0. El candidato solo puede moverse a las zonas indicadas.');
        partes.push('- Una oferta HÍBRIDA fuera de zona se penaliza fuertemente (porcentaje ≤ 20), salvo que sea remotable en su totalidad.');
        partes.push('- Ofertas remotas no se ven afectadas por la ubicación.');
    }

    partes.push('');
    partes.push('- La "razon" debe ser concisa (1-2 oraciones), en español, y mencionar las tecnologías relevantes.');

    // Si el usuario activó su prompt personalizado, lo agrego como criterios
    // adicionales al final. NUNCA reemplaza las reglas base ni las exclusiones
    // fuertes. Es un complemento, no una superposición.
    if (prefs.usar_prompt_personalizado && prefs.prompt_personalizado && prefs.prompt_personalizado.trim()) {
        partes.push('');
        partes.push('CRITERIOS ADICIONALES DEL USUARIO:');
        partes.push('Los siguientes criterios son preferencias adicionales del usuario. NO anulan las reglas estrictas de exclusión (Java, Senior/SR/Lead, 3+ años excluyentes, inglés avanzado/fluido/bilingüe, presencial fuera de zona). Aplicar estos criterios solo si no contradicen ninguna exclusión fuerte.');
        partes.push(prefs.prompt_personalizado.trim());
    }

    return partes.join('\n');
}

/**
 * Construyo el prompt con los datos de la oferta para enviar a DeepSeek.
 *
 * @param {Object} oferta - La oferta de la base de datos.
 * @returns {string} El prompt armado con los datos de la oferta.
 */
function construirPromptEvaluacion(oferta) {
    // Armo un texto estructurado con los datos relevantes de la oferta.
    // ¿Por qué no mando el JSON crudo? Porque un texto legible es más fácil
    // de procesar para la IA — los JSON crudos tienen ruido (campos internos,
    // IDs, timestamps) que distraen del contenido relevante.
    const partes = [
        `Título: ${oferta.titulo}`,
    ];

    if (oferta.empresa) partes.push(`Empresa: ${oferta.empresa}`);
    if (oferta.ubicacion) partes.push(`Ubicación: ${oferta.ubicacion}`);
    if (oferta.modalidad) partes.push(`Modalidad: ${oferta.modalidad}`);
    if (oferta.nivel_requerido) partes.push(`Nivel requerido: ${oferta.nivel_requerido}`);
    if (oferta.plataforma) partes.push(`Plataforma: ${oferta.plataforma}`);

    partes.push(''); // Línea vacía separadora.
    partes.push('Descripción completa de la oferta:');
    partes.push(oferta.descripcion || 'Sin descripción disponible.');

    return partes.join('\n');
}

/**
 * Verifico si una ubicación coincide con alguna de las zonas preferidas.
 * Comparo en minúsculas para que sea insensible a mayúsculas.
 *
 * @param {string} ubicacion - Ubicación de la oferta.
 * @param {string[]} zonas - Lista de zonas preferidas.
 * @returns {boolean}
 */
function ubicacionEnZonas(ubicacion, zonas) {
    const textoUbicacion = (ubicacion || '').toLowerCase();
    return zonas.some(zona => textoUbicacion.includes((zona || '').toLowerCase()));
}

/**
 * Evalúo una oferta individual con DeepSeek.
 *
 * Ahora recibe las instrucciones y el modelo como parámetros para no
 * leer de la BD en cada oferta (se lee UNA vez por lote en
 * evaluarOfertasPendientes y se pasa a cada evaluación individual).
 *
 * @param {Object} oferta - La oferta de la base de datos.
 * @param {string} instrucciones - Instrucciones de sistema armadas desde preferencias.
 * @param {string} [modelo] - Modelo de IA a usar (ej: 'deepseek-v4-flash').
 * @param {Object} [preferencias] - Preferencias del usuario (para defensas programáticas).
 * @returns {Object} { match: boolean, razon: string, porcentaje: number, error?: boolean }
 */
async function evaluarOferta(oferta, instrucciones, modelo, preferencias) {
    try {
        // Si recibo instrucciones como parámetro las uso; si no,
        // leo las preferencias de la BD (para llamadas sueltas desde la API).
        let instruccionesFinal = instrucciones;
        let modeloFinal = modelo;
        let preferenciasFinal = preferencias;

        if (!instruccionesFinal || !preferenciasFinal) {
            const prefsDeBD = await modeloPreferencia.obtenerPreferencias();
            if (prefsDeBD) {
                if (!instruccionesFinal) {
                    instruccionesFinal = construirInstruccionesDesdePreferencias(prefsDeBD);
                }
                if (!preferenciasFinal) {
                    preferenciasFinal = prefsDeBD;
                }
                modeloFinal = modeloFinal || prefsDeBD.modelo_ia;
            }
        }

        // Si no hay preferencias en BD (edge case), fallback al prompt mínimo.
        if (!instruccionesFinal) {
            instruccionesFinal = 'Sos un evaluador de ofertas de empleo. Respondé con JSON: {"match": true/false, "porcentaje": 0-100, "razon": "..."}';
        }

        // ── Paso 1: Pre-evaluación con reglas de exclusión ──
        // Si la oferta cumple algún criterio de exclusión determinístico
        // (Java, Senior, 3+ años, inglés avanzado, presencial fuera de zona),
        // la rechazo SIN llamar a DeepSeek.
        if (preferenciasFinal) {
            const resultadoExclusion = evaluarReglasExclusion(oferta, preferenciasFinal);
            if (resultadoExclusion.excluida) {
                return {
                    match: false,
                    porcentaje: resultadoExclusion.porcentaje,
                    razon: resultadoExclusion.razon,
                    error: false,
                };
            }
        }

        // Defensa programática: presencial fuera de zona → rechazo sin consultar IA.
        // (Esta defensa se mantiene por compatibilidad y como respaldo extra.)
        const modalidadOferta = (oferta.modalidad || '').toLowerCase().trim();
        const zonasPreferidas = (preferenciasFinal || {}).zonas_preferidas || [];
        const ubicacionOferta = oferta.ubicacion || '';
        const esPresencial = modalidadOferta === 'presencial';
        const estaEnZonas = zonasPreferidas.length === 0 || ubicacionEnZonas(ubicacionOferta, zonasPreferidas);

        if (esPresencial && !estaEnZonas) {
            return {
                match: false,
                porcentaje: 0,
                razon: `La oferta es presencial en ${ubicacionOferta} (fuera de las zonas preferidas) => rechazada.`,
            };
        }

        // ── Paso 2: Llamada a DeepSeek ──
        // Solo llego acá si las reglas de exclusión no se activaron.
        const promptEvaluacion = construirPromptEvaluacion(oferta);
        const respuestaTexto = await consultarDeepSeek(
            instruccionesFinal,
            promptEvaluacion,
            modeloFinal
        );

        // ── Paso 3: Parsear la respuesta de DeepSeek con el parser estricto ──
        const respuesta = parsearRespuestaEvaluacionIa(respuestaTexto);

        // Si el parser no pudo interpretar la respuesta, devuelvo rechazo seguro.
        if (respuesta.error) {
            return {
                match: false,
                porcentaje: 15,
                razon: `No se pudo interpretar la respuesta de DeepSeek: ${respuesta.razon}`,
                error: true,
            };
        }

        // ── Paso 4: Post-evaluación con reglas de exclusión ──
        // Si DeepSeek aprobó la oferta pero las reglas determinísticas dicen
        // que debe ser rechazada (Java, Senior, 3+ años, inglés avanzado),
        // sobreescribo el resultado. La IA puede equivocarse; las reglas no.
        if (respuesta.match && preferenciasFinal) {
            const resultadoPostExclusion = evaluarReglasExclusion(oferta, preferenciasFinal);
            if (resultadoPostExclusion.excluida) {
                return {
                    match: false,
                    porcentaje: resultadoPostExclusion.porcentaje,
                    razon: resultadoPostExclusion.razon,
                    error: false,
                };
            }
        }

        // Si la IA dijo match:false con porcentaje bajo, las reglas también
        // pueden enriquecer la razón si detectan algo que la IA no mencionó.
        // Pero no sobreescribimos si ya fue rechazada — dejamos la razón de la IA.
        return {
            match: respuesta.match,
            razon: respuesta.razon,
            porcentaje: respuesta.porcentaje,
        };

    } catch (error) {
        const razonError = `Error al evaluar con DeepSeek: ${error.message}`;
        console.error(`[Evaluación] Error al evaluar oferta ID ${oferta.id}: ${razonError}`);

        return {
            match: false,
            razon: razonError,
            error: true,
        };
    }
}

/**
 * Evalúo todas las ofertas pendientes de la base de datos.
 *
 * Proceso:
 * 1. Busco todas las ofertas con estado_evaluacion = 'pendiente'.
 * 2. Evalúo cada una con DeepSeek (una por una, para no saturar la API).
 * 3. Actualizo el estado en la BD según el resultado.
 * 4. Retorno un resumen con los contadores.
 *
 * ¿Por qué una por una y no en paralelo? Porque DeepSeek tiene rate limits
 * (límites de velocidad). Si mando 100 requests al mismo tiempo, me bloquean.
 * Procesando de a una, respetamos los límites y además podemos debuggear
 * fácilmente si algo falla.
 *
 * @returns {Object} Resumen: { total, aprobadas, rechazadas, errores, detalle }.
 */
async function evaluarOfertasPendientes() {
    // Inicializo el progreso y reseteo la bandera de cancelación.
    _cancelarEvaluacion = false;
    let loteId = null;
    progresoEvaluacion = {
        activo: true,
        total: 0,
        evaluadas: 0,
        aprobadas: 0,
        rechazadas: 0,
        errores: 0,
        porcentaje: 0,
    };

    try {
        // Leo las preferencias UNA sola vez para todo el lote.
        const prefs = await modeloPreferencia.obtenerPreferencias();
        const instrucciones = prefs
            ? construirInstruccionesDesdePreferencias(prefs)
            : null;
        const modeloIA = prefs
            ? (prefs.modelo_ia_evaluacion || prefs.modelo_ia || 'deepseek-v4-flash')
            : undefined;

        const hashPreferencias = prefs
            ? evaluacionCache.crearHashPreferencias(prefs)
            : null;

        const pendientes = await modeloOferta.obtenerOfertasPendientes();

        progresoEvaluacion.total = pendientes.length;

        // Creo un lote persistente en BD para que el progreso sobreviva reinicios.
        try {
            const lote = await evaluacionLote.crearLote(pendientes.length, modeloIA);
            loteId = lote.id;
        } catch (err) {
            console.warn('[Evaluación] No se pudo crear lote en BD, el progreso solo estará en memoria:', err.message);
        }

        const resumen = {
            total: pendientes.length,
            aprobadas: 0,
            rechazadas: 0,
            errores: 0,
            detalle: [],
        };

        if (pendientes.length === 0) {
            console.log('[Evaluación] No hay ofertas pendientes para evaluar.');
            return resumen;
        }

        console.log(`[Evaluación] Evaluando ${pendientes.length} ofertas pendientes...`);

        for (const oferta of pendientes) {
            // Si el usuario canceló, detengo el loop antes de la siguiente oferta.
            if (_cancelarEvaluacion) {
                console.log('[Evaluación] Cancelada por el usuario.');
                break;
            }

            console.log(`[Evaluación] Procesando oferta ID ${oferta.id}: "${oferta.titulo}"...`);

            let resultado;
            const hashOferta = hashPreferencias
                ? evaluacionCache.crearHashOferta(oferta)
                : null;

            // Verifico si ya existe un resultado cacheado para esta oferta
            // con las preferencias actuales y el mismo modelo.
            // Si hay cache hit, revalido con las reglas de exclusión antes de aceptar.
            // Una oferta que antes pasó pero ahora debería excluirse por reglas
            // determinísticas NO debe ser aprobada desde cache.
            if (hashOferta && hashPreferencias) {
                const cacheado = await evaluacionCache.buscarCache(
                    hashOferta, hashPreferencias, modeloIA
                );

                if (cacheado) {
                    console.log(`[Evaluación] Cache hit para oferta ID ${oferta.id}`);

                    // Revalidación: si el cache dice aprobada pero las reglas
                    // de exclusión la rechazan, sobreescribo a rechazo.
                    if (cacheado.match && prefs) {
                        const resultadoExclusion = evaluarReglasExclusion(oferta, prefs);
                        if (resultadoExclusion.excluida) {
                            console.log(`[Evaluación] Cache rechazado por reglas de exclusión para oferta ID ${oferta.id}: ${resultadoExclusion.razon}`);
                            resultado = {
                                match: false,
                                porcentaje: resultadoExclusion.porcentaje,
                                razon: resultadoExclusion.razon,
                                error: false,
                            };
                        } else {
                            resultado = cacheado;
                        }
                    } else {
                        resultado = cacheado;
                    }
                }
            }

            // Si no había cache, evalúo con DeepSeek y guardo para el futuro.
            if (!resultado) {
                resultado = await evaluarOferta(oferta, instrucciones, modeloIA, prefs);

                // Guardo en cache solo si la evaluación fue exitosa (no errores de API).
                if (!resultado.error && hashOferta && hashPreferencias) {
                    // No espero a que se guarde — si falla el cache no quiero trabar la evaluación.
                    evaluacionCache.guardarCache(
                        hashOferta, hashPreferencias, modeloIA, resultado
                    ).catch(err => console.warn('[Evaluación] No se pudo guardar en cache:', err.message));
                }
            }

            const estado = resultado.match ? 'aprobada' : 'rechazada';
            const errorMensaje = resultado.error ? resultado.razon : null;

            // Actualizo el estado, el porcentaje y el error (si hubo) en la base de datos.
            await modeloOferta.actualizarEvaluacion(oferta.id, estado, resultado.razon, resultado.porcentaje, errorMensaje);

            // Actualizo los contadores del resumen y del progreso.
            progresoEvaluacion.evaluadas++;
            if (resultado.error) {
                resumen.errores++;
                progresoEvaluacion.errores++;
            }
            if (resultado.match) {
                resumen.aprobadas++;
                progresoEvaluacion.aprobadas++;
            } else {
                resumen.rechazadas++;
                progresoEvaluacion.rechazadas++;
            }
            progresoEvaluacion.porcentaje = progresoEvaluacion.total > 0
                ? Math.round((progresoEvaluacion.evaluadas / progresoEvaluacion.total) * 100)
                : 0;

            resumen.detalle.push({
                id: oferta.id,
                titulo: oferta.titulo,
                estado,
                razon: resultado.razon,
                error: resultado.error || false,
            });

            // Actualizo el lote en BD cada 5 ofertas (o en la última) para no
            // saturar PostgreSQL con writes. Si el servidor se reinicia, el
            // frontend ve el último snapshot persistido.
            if (loteId && (progresoEvaluacion.evaluadas % 5 === 0 || progresoEvaluacion.evaluadas === progresoEvaluacion.total)) {
                evaluacionLote.actualizarProgreso(loteId, progresoEvaluacion).catch(
                    err => console.warn('[Evaluación] No se pudo actualizar lote:', err.message)
                );
            }
        }

        console.log(`[Evaluación] Completado. Aprobadas: ${resumen.aprobadas}, Rechazadas: ${resumen.rechazadas}, Errores: ${resumen.errores}`);

        return resumen;
    } finally {
        // Siempre marco el progreso como inactivo al terminar (o al cancelar).
        progresoEvaluacion.activo = false;

        // Marco el lote como finalizado en BD.
        if (loteId) {
            const estadoFinal = _cancelarEvaluacion ? 'cancelado' : 'completado';
            evaluacionLote.finalizarLote(loteId, estadoFinal).catch(
                err => console.warn('[Evaluación] No se pudo finalizar lote:', err.message)
            );
        }
    }
}

/**
 * Rehidrata el progreso de evaluación desde el último lote persistido en BD.
 * Se ejecuta al arrancar el servidor para recuperar el estado si se reinició.
 */
async function rehidratarProgreso() {
    try {
        const lote = await evaluacionLote.obtenerUltimoLote();

        if (lote && lote.estado === 'activo') {
            progresoEvaluacion = {
                activo: true,
                total: lote.total,
                evaluadas: lote.evaluadas,
                aprobadas: lote.aprobadas,
                rechazadas: lote.rechazadas,
                errores: lote.errores,
                porcentaje: lote.porcentaje,
            };

            console.log(`[Evaluación] Progreso rehidratado: lote #${lote.id}, ${lote.porcentaje}%`);
        }
    } catch (err) {
        console.warn('[Evaluación] No se pudo rehidratar el progreso:', err.message);
    }
}

module.exports = {
    construirPromptEvaluacion,
    construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias,
    evaluarOferta,
    evaluarOfertasPendientes,
    obtenerProgresoEvaluacion,
    cancelarEvaluacionPendiente,
    rehidratarProgreso,
};
