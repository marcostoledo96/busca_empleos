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

/**
 * Mi perfil como candidato.
 * Se usa como "contexto de sistema" en cada consulta a DeepSeek.
 * Si mis skills cambian, actualizo esto y todas las evaluaciones futuras
 * lo reflejan automáticamente.
 */
const PERFIL_CANDIDATO = `Soy un candidato de nivel Trainee / Junior buscando empleo en tecnología.

Mi stack tecnológico:
- Lenguajes: HTML, CSS, JavaScript, TypeScript, C#, SQL
- Frontend: Angular, React, React Native
- Backend: Node.js, Express, ASP.NET
- Bases de datos: PostgreSQL, SQL Server
- Otros: Git, API REST

Modalidad aceptada: Cualquiera (Remoto, Híbrido, Presencial).
Ubicación: Buenos Aires, Argentina.

REGLA ESTRICTA DE EXCLUSIÓN:
- Si la oferta requiere Java como tecnología principal o excluyente, RECHAZAR automáticamente con match: false. Java NO está en mi stack y NO me interesa.
- Esta regla NO aplica a JavaScript (que SÍ está en mi stack). No confundir Java con JavaScript.`;

/**
 * Instrucciones de sistema para DeepSeek.
 * Le digo exactamente cómo debe responder.
 */
const INSTRUCCIONES_SISTEMA = `Sos un evaluador de ofertas de empleo. Tu trabajo es determinar si una oferta laboral hace "match" con el perfil de un candidato.

${PERFIL_CANDIDATO}

INSTRUCCIONES DE RESPUESTA:
1. Analizá la oferta comparándola con el perfil del candidato.
2. Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional.
3. Formato exacto de respuesta:
   {"match": true, "razon": "Explicación breve de por qué matchea"}
   o
   {"match": false, "razon": "Explicación breve de por qué no matchea"}

CRITERIOS DE EVALUACIÓN:
- match: true si el candidato cumple con al menos el 60% de los requisitos técnicos.
- match: true si el nivel pedido es trainee, junior, o no se especifica nivel.
- match: false si requiere Java (no JavaScript) como tecnología principal.
- match: false si requiere nivel Senior o más de 3 años de experiencia comprobable.
- match: false si requiere tecnologías completamente fuera del stack del candidato (ej: Kotlin, Swift, Rust, Go como principal).
- La "razon" debe ser concisa (1-2 oraciones), en español, y mencionar las tecnologías relevantes.`;

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
 * @param {Object} oferta - La oferta de la base de datos.
 * @returns {Object} { match: boolean, razon: string, error?: boolean }
 */
async function evaluarOferta(oferta) {
    try {
        const prompt = construirPromptEvaluacion(oferta);
        const respuestaTexto = await consultarDeepSeek(INSTRUCCIONES_SISTEMA, prompt);

        // Intento parsear el JSON de la respuesta.
        // DeepSeek a veces envuelve el JSON en bloques de código markdown (```json).
        // Limpio eso antes de parsear.
        const jsonLimpio = respuestaTexto
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const respuesta = JSON.parse(jsonLimpio);

        return {
            match: respuesta.match === true,
            razon: respuesta.razon || 'Sin razón proporcionada.',
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

        const resultado = await evaluarOferta(oferta);
        const estado = resultado.match ? 'aprobada' : 'rechazada';

        // Actualizo el estado en la base de datos.
        await modeloOferta.actualizarEvaluacion(oferta.id, estado, resultado.razon);

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
    evaluarOferta,
    evaluarOfertasPendientes,
    PERFIL_CANDIDATO,
    INSTRUCCIONES_SISTEMA,
};
