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
    const exclusiones = prefs.reglas_exclusion || [];
    const perfil = prefs.perfil_profesional || '';

    const partes = [];

    partes.push(`Soy ${nombre}, un candidato de nivel ${nivel} buscando empleo en tecnología.`);

    partes.push('');
    partes.push('MIS ROLES OBJETIVO (Aceptar ofertas si se trata de alguno de estos perfiles):');
    partes.push('1. QA Tester / Analista QA / Tester Funcional (experiencia en pruebas E2E, reporte de bugs, metodologías ágiles).');
    partes.push('2. Desarrollador Frontend / Full-Stack / Backend (Angular, React, Node.js, Express, PostgreSQL, C#).');
    partes.push('3. Soporte Técnico IT / Help Desk / Analista de Soporte (Mantenimiento de hardware/software, Google Workspace, tickets).');

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
    const modalidadTexto = modalidad === 'cualquiera'
        ? 'Cualquiera (Remoto, Híbrido, Presencial)'
        : modalidad.charAt(0).toUpperCase() + modalidad.slice(1);
    partes.push(`Modalidad aceptada: ${modalidadTexto}.`);

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
    partes.push('REGLAS ESTRICTAS DE INDUSTRIA Y TIPO DE ROL:');
    partes.push('- Si es un rol tecnológico (ej. Soporte Técnico, Desarrollador, QA) dentro de una empresa o contexto no tecnológico (hotel, hospital, agro, fábrica), SÍ ES VÁLIDO Y DEBE SER ACEPTADO.');
    partes.push('- EXCLUSIÓN ABSOLUTA: Si el ROL en sí mismo es no tecnológico (ej: Agrónomo, Médico, Mecánico, Administrativo puro, Vendedor, Operario), RECHAZAR automáticamente con match: false y porcentaje 0.');
    partes.push('- Cuidado con los roles de CALIDAD (Aseguramiento de Calidad / QA): Solo aceptar si son de QA de Software (testing). Rechazar los que sean QA industrial, farmacéutico o de manufactura.');
    partes.push('- Aunque tenga experiencia en salud, busco EXCLUSIVAMENTE roles tecnológicos (Desarrollo, Testing, Soporte IT). Rechazar cualquier rol de atención al paciente o administración pura.');
    partes.push('- Si la oferta pide "sistemas" refiriéndose a data entry o cajero, RECHAZAR. Solo aceptar si es para CONSTRUIR, TESTEAR o DAR SOPORTE a software/hardware.');

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
    // Si el usuario activó su prompt personalizado, lo uso tal cual.
    if (prefs.usar_prompt_personalizado && prefs.prompt_personalizado) {
        return prefs.prompt_personalizado;
    }

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
        partes.push('- match: false si requiere nivel Senior o más de 3 años de experiencia comprobable.');
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

    // Criterios de ubicación/zona si hay zonas preferidas.
    if (zonas.length > 0) {
        partes.push('');
        partes.push('CRITERIOS DE UBICACIÓN:');
        partes.push(`- Evaluar positivamente ofertas presenciales/híbridas en: ${zonas.join(', ')}.`);
        partes.push('- Penalizar (reducir porcentaje) ofertas presenciales en zonas lejanas a las preferidas.');
        partes.push('- Ofertas remotas no se ven afectadas por la ubicación.');
    }

    partes.push('');
    partes.push('- La "razon" debe ser concisa (1-2 oraciones), en español, y mencionar las tecnologías relevantes.');

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
 * Evalúo una oferta individual con DeepSeek.
 *
 * Ahora recibe las instrucciones y el modelo como parámetros para no
 * leer de la BD en cada oferta (se lee UNA vez por lote en
 * evaluarOfertasPendientes y se pasa a cada evaluación individual).
 *
 * @param {Object} oferta - La oferta de la base de datos.
 * @param {string} instrucciones - Instrucciones de sistema armadas desde preferencias.
 * @param {string} [modelo] - Modelo de IA a usar (ej: 'deepseek-chat').
 * @returns {Object} { match: boolean, razon: string, porcentaje: number, error?: boolean }
 */
async function evaluarOferta(oferta, instrucciones, modelo) {
    try {
        const prompt = construirPromptEvaluacion(oferta);

        // Si recibo instrucciones como parámetro las uso; si no,
        // leo las preferencias de la BD (para llamadas sueltas desde la API).
        let instruccionesFinal = instrucciones;
        let modeloFinal = modelo;

        if (!instruccionesFinal) {
            const prefs = await modeloPreferencia.obtenerPreferencias();
            if (prefs) {
                instruccionesFinal = construirInstruccionesDesdePreferencias(prefs);
                modeloFinal = modeloFinal || prefs.modelo_ia;
            }
        }

        // Si no hay preferencias en BD (edge case), fallback al prompt mínimo.
        if (!instruccionesFinal) {
            instruccionesFinal = 'Sos un evaluador de ofertas de empleo. Respondé con JSON: {"match": true/false, "porcentaje": 0-100, "razon": "..."}';
        }

        const respuestaTexto = await consultarDeepSeek(instruccionesFinal, prompt, modeloFinal);

        // Intento parsear el JSON de la respuesta.
        // DeepSeek a veces envuelve el JSON en bloques de código markdown (```json).
        // Limpio eso antes de parsear.
        const jsonLimpio = respuestaTexto
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const respuesta = JSON.parse(jsonLimpio);

        // Valido y acoto el porcentaje al rango 0–100.
        const porcentajeCrudo = parseInt(respuesta.porcentaje, 10);
        const porcentaje = Number.isFinite(porcentajeCrudo)
            ? Math.max(0, Math.min(100, porcentajeCrudo))
            : null;

        return {
            match: respuesta.match === true,
            razon: respuesta.razon || 'Sin razón proporcionada.',
            porcentaje,
        };

    } catch (error) {
        // Si la API falla o la respuesta no es JSON válido,
        // no quiero que se rompa todo el flujo. Marco como error
        // y sigo con las demás ofertas.
        const esErrorDeParseo = error instanceof SyntaxError;
        const razonError = esErrorDeParseo
            ? `No se pudo parsear la respuesta de DeepSeek: ${error.message}`
            : `Error al evaluar con DeepSeek: ${error.message}`;

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
    // Leo las preferencias UNA sola vez para todo el lote.
    // Así evito hacer una query por cada oferta (serían N queries innecesarias).
    const prefs = await modeloPreferencia.obtenerPreferencias();
    const instrucciones = prefs
        ? construirInstruccionesDesdePreferencias(prefs)
        : null;
    const modeloIA = prefs ? prefs.modelo_ia : undefined;

    const pendientes = await modeloOferta.obtenerOfertasPendientes();

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
        console.log(`[Evaluación] Procesando oferta ID ${oferta.id}: "${oferta.titulo}"...`);

        const resultado = await evaluarOferta(oferta, instrucciones, modeloIA);
        const estado = resultado.match ? 'aprobada' : 'rechazada';

        // Actualizo el estado y el porcentaje en la base de datos.
        await modeloOferta.actualizarEvaluacion(oferta.id, estado, resultado.razon, resultado.porcentaje);

        // Actualizo los contadores del resumen.
        if (resultado.error) {
            resumen.errores++;
        }

        if (resultado.match) {
            resumen.aprobadas++;
        } else {
            resumen.rechazadas++;
        }

        resumen.detalle.push({
            id: oferta.id,
            titulo: oferta.titulo,
            estado,
            razon: resultado.razon,
            error: resultado.error || false,
        });
    }

    console.log(`[Evaluación] Completado. Aprobadas: ${resumen.aprobadas}, Rechazadas: ${resumen.rechazadas}, Errores: ${resumen.errores}`);

    return resumen;
}

module.exports = {
    construirPromptEvaluacion,
    construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias,
    evaluarOferta,
    evaluarOfertasPendientes,
};
