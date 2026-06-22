// Servicio de notificación por email — envía un resumen al finalizar cada ciclo.
//
// ¿Qué hace este servicio? Después de que el ciclo de scraping + evaluación
// termina, arma un email con los resultados y lo envía por SMTP.
// Si las variables SMTP no están configuradas, se deshabilita en modo silencioso:
// loguea un aviso y no crashea la aplicación. Es "soft-disable".
//
// ¿Por qué soft-disable? Porque en desarrollo o tests no tenemos SMTP configurado,
// y no queremos que el servidor entero se rompa por no tener email.
// En producción sí configuramos las variables y el email sale normalmente.

const nodemailer = require('nodemailer');

/**
 * Leo la configuración SMTP desde las variables de entorno.
 * Si falta alguna variable obligatoria, retorno { habilitado: false }
 * con la lista de variables faltantes para loguear un aviso claro.
 *
 * Las variables obligatorias son: SMTP_HOST, SMTP_USER, SMTP_PASS.
 * SMTP_PORT por defecto es 587 si no se especifica.
 * SMTP_FROM por defecto es SMTP_USER si no se especifica.
 * EMAIL_NOTIFICACION_DESTINO es obligatorio para enviar el email.
 *
 * @returns {Object} Configuración saneada o { habilitado: false, faltantes: string[] }
 */
function obtenerConfigEmail() {
    const faltantes = [];
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const destino = process.env.EMAIL_NOTIFICACION_DESTINO;

    if (!host) faltantes.push('SMTP_HOST');
    if (!user) faltantes.push('SMTP_USER');
    if (!pass) faltantes.push('SMTP_PASS');
    if (!destino) faltantes.push('EMAIL_NOTIFICACION_DESTINO');

    if (faltantes.length > 0) {
        return { habilitado: false, faltantes };
    }

    return {
        habilitado: true,
        host,
        port,
        user,
        pass,
        from: from || user,
        destino,
        // Puerto 465 usa SSL/TLS directo (secure: true).
        // Otros puertos (587, etc.) usan STARTTLS (secure: false).
        secure: port === 465,
    };
}

/**
 * Escapo caracteres HTML especiales en un string para prevenir
 * inyección de markup en el email. Aunque los datos vienen de scraping
 * y no son ingresados por el usuario, es buena práctica escaparlos.
 *
 * @param {string} texto - Texto a escapar.
 * @returns {string} Texto escapado para HTML.
 */
function escaparHtml(texto) {
    if (typeof texto !== 'string') return String(texto ?? '');
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Armo el contenido del email de resumen en formato HTML y texto plano.
 * Recibe el objeto resultado del ciclo y genera un email prolijo
 * con las métricas relevantes: ofertas por plataforma, guardadas,
 * descartadas por idioma, evaluación IA, errores y duración.
 *
 * Si el resultado no tiene algún campo (por ejemplo, evaluación es null),
 * muestro un valor por defecto claro en vez de dejar secciones vacías.
 *
 * @param {Object} resumenCiclo - Resultado de ejecutarCicloCompleto().
 * @returns {{ asunto: string, html: string, texto: string }}
 */
function armarResumenEmail(resumenCiclo) {
    const s = resumenCiclo.scraping || {};
    const ev = resumenCiclo.evaluacion;
    const errores = resumenCiclo.errores || [];

    // Datos del scraping por plataforma — solo muestro las que trajeron ofertas.
    const plataformas = [
        { nombre: 'LinkedIn', clave: 'linkedin' },
        { nombre: 'Computrabajo', clave: 'computrabajo' },
        { nombre: 'Indeed', clave: 'indeed' },
        { nombre: 'Bumeran', clave: 'bumeran' },
        { nombre: 'Glassdoor', clave: 'glassdoor' },
        { nombre: 'GetOnBrd', clave: 'getonbrd' },
        { nombre: 'Jooble', clave: 'jooble' },
        { nombre: 'Google Jobs', clave: 'google_jobs' },
        { nombre: 'Remotive', clave: 'remotive' },
        { nombre: 'RemoteOK', clave: 'remoteok' },
        { nombre: 'InfoJobs', clave: 'infojobs' },
        { nombre: 'Adzuna', clave: 'adzuna' },
    ];

    // Filtro solo las plataformas con resultados > 0 para no inflar el email.
    const plataformasConResultados = plataformas.filter(p => (s[p.clave] || 0) > 0);

    const totalExtraidas = s.totalExtraidas ?? 0;
    const guardadas = s.guardadas ?? 0;
    const descartadasPorIdioma = s.descartadasPorIdioma ?? 0;
    const aprobadas = ev ? (ev.aprobadas ?? 0) : 0;
    const rechazadas = ev ? (ev.rechazadas ?? 0) : 0;
    const totalEvaluadas = ev ? (ev.total ?? 0) : 0;
    const erroresIA = ev ? (ev.errores ?? 0) : 0;

    // Fecha y duración del ciclo.
    const fechaEjecucion = resumenCiclo.fechaEjecucion
        ? new Date(resumenCiclo.fechaEjecucion).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
        : new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const duracionSegundos = resumenCiclo.duracionSegundos ?? null;

    // --- Asunto del email ---
    const asunto = `Busca Empleos — Resumen del ciclo (${totalExtraidas} extraídas, ${guardadas} guardadas)`;

    // --- Versión HTML ---
    let filasPlataformas = '';
    if (plataformasConResultados.length > 0) {
        filasPlataformas = plataformasConResultados.map(p =>
            `<tr><td style="padding:4px 12px;border-bottom:1px solid #eee;">${escaparHtml(p.nombre)}</td>` +
            `<td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right;">${s[p.clave]}</td></tr>`
        ).join('\n');
    } else {
        filasPlataformas = '<tr><td colspan="2" style="padding:8px 12px;text-align:center;color:#999;">Sin datos de plataformas</td></tr>';
    }

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;color:#333;background:#f9f9f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #ddd;">
<tr style="background:#2563eb;color:#fff;">
<td style="padding:20px 24px;font-size:20px;font-weight:bold;">
Busca Empleos — Resumen del ciclo
</td>
</tr>
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 12px;font-size:14px;">
<strong>Fecha:</strong> ${escaparHtml(fechaEjecucion)} (Argentina)
</p>
${duracionSegundos !== null ? `<p style="margin:0 0 12px;font-size:14px;"><strong>Duración:</strong> ${duracionSegundos} segundos</p>` : ''}
<h3 style="margin:16px 0 8px;font-size:16px;color:#2563eb;">Extracción por plataforma</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
<thead><tr style="background:#f0f4ff;">
<th style="padding:6px 12px;text-align:left;border-bottom:2px solid #2563eb;">Plataforma</th>
<th style="padding:6px 12px;text-align:right;border-bottom:2px solid #2563eb;">Ofertas</th>
</tr></thead>
<tbody>${filasPlataformas}</tbody>
</table>
<h3 style="margin:16px 0 8px;font-size:16px;color:#2563eb;">Totales</h3>
<ul style="font-size:14px;line-height:1.8;">
<li><strong>Total extraídas:</strong> ${totalExtraidas}</li>
<li><strong>Guardadas (nuevas):</strong> ${guardadas}</li>
<li><strong>Descartadas por idioma:</strong> ${descartadasPorIdioma}</li>
</ul>
${ev ? `
<h3 style="margin:16px 0 8px;font-size:16px;color:#2563eb;">Evaluación IA (DeepSeek)</h3>
<ul style="font-size:14px;line-height:1.8;">
<li><strong>Total evaluadas:</strong> ${totalEvaluadas}</li>
<li><strong>Aprobadas:</strong> ${aprobadas}</li>
<li><strong>Rechazadas:</strong> ${rechazadas}</li>
${erroresIA > 0 ? `<li><strong>Errores de evaluación:</strong> ${erroresIA}</li>` : ''}
</ul>
` : '<p style="font-size:14px;color:#999;">Evaluación IA no disponible en este ciclo.</p>'}
${errores.length > 0 ? `
<h3 style="margin:16px 0 8px;font-size:16px;color:#dc2626;">Errores</h3>
<ul style="font-size:14px;line-height:1.8;color:#dc2626;">
${errores.map(e => `<li>${escaparHtml(e)}</li>`).join('\n')}
</ul>
` : '<p style="font-size:14px;color:#16a34a;">✓ Sin errores en este ciclo.</p>'}
</td></tr>
<tr style="background:#f9f9f9;">
<td style="padding:12px 24px;font-size:12px;color:#999;text-align:center;">
Busca Empleos — Notificación automática
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    // --- Versión texto plano ---
    let textoPlataformas = '';
    if (plataformasConResultados.length > 0) {
        textoPlataformas = plataformasConResultados
            .map(p => `  ${p.nombre}: ${s[p.clave]}`)
            .join('\n');
    } else {
        textoPlataformas = '  Sin datos de plataformas';
    }

    const texto = [
        `Busca Empleos — Resumen del ciclo`,
        ``,
        `Fecha: ${fechaEjecucion} (Argentina)`,
        duracionSegundos !== null ? `Duración: ${duracionSegundos} segundos` : '',
        ``,
        `=== Extracción por plataforma ===`,
        textoPlataformas,
        ``,
        `=== Totales ===`,
        `Total extraídas: ${totalExtraidas}`,
        `Guardadas (nuevas): ${guardadas}`,
        `Descartadas por idioma: ${descartadasPorIdioma}`,
        ``,
    ];

    if (ev) {
        texto.push(
            `=== Evaluación IA (DeepSeek) ===`,
            `Total evaluadas: ${totalEvaluadas}`,
            `Aprobadas: ${aprobadas}`,
            `Rechazadas: ${rechazadas}`,
            erroresIA > 0 ? `Errores de evaluación: ${erroresIA}` : '',
            '',
        );
    } else {
        texto.push('Evaluación IA no disponible en este ciclo.', '');
    }

    if (errores.length > 0) {
        texto.push('=== Errores ===');
        errores.forEach(e => texto.push(`  - ${e}`));
        texto.push('');
    } else {
        texto.push('✓ Sin errores en este ciclo.');
    }

    return {
        asunto,
        html: html.replace(/\n\s*\n/g, '\n'),
        texto: texto.filter(l => l !== null).join('\n'),
    };
}

/**
 * Envío el email de resumen del ciclo.
 * Verifico la configuración SMTP, armo el contenido y lo envío.
 * Si SMTP no está configurado, logueo un aviso y retorno sin error.
 * Si el envío falla, logueo el error y retorno sin propagar la excepción.
 *
 * @param {Object} resumenCiclo - Resultado de ejecutarCicloCompleto().
 * @returns {Promise<{enviado: boolean, deshabilitado?: boolean, messageId?: string}>}
 */
async function enviarResumenCiclo(resumenCiclo) {
    const config = obtenerConfigEmail();

    if (!config.habilitado) {
        console.log(
            `[Notificación Email] Deshabilitado. Faltan variables: ${config.faltantes.join(', ')}. ` +
            `El ciclo continúa normalmente sin notificación por email.`
        );
        return { enviado: false, deshabilitado: true };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });

        const { asunto, html, texto } = armarResumenEmail(resumenCiclo);

        const resultado = await transporter.sendMail({
            from: config.from,
            to: config.destino,
            subject: asunto,
            html,
            text: texto,
        });

        console.log(`[Notificación Email] Resumen enviado a ${config.destino} (ID: ${resultado.messageId})`);
        return { enviado: true, messageId: resultado.messageId };
    } catch (error) {
        console.error(`[Notificación Email] Error al enviar resumen: ${error.message}`);
        return { enviado: false, error: error.message };
    }
}

module.exports = {
    obtenerConfigEmail,
    armarResumenEmail,
    enviarResumenCiclo,
};