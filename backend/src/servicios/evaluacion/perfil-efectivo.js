// Construyo una vista pura del perfil persistido, sin completar hechos personales.

/**
 * @typedef {Object} PerfilEfectivo
 * @property {number} version
 * @property {Object} candidato Hechos confirmados; null significa dato no declarado.
 * @property {{preferencias: Object, politicas_sistema: string[]}} restricciones
 * @property {{id: string, titulo: string, texto: string}[]} secciones
 * @property {string} texto Representación incorporada literalmente al mensaje de sistema.
 */

/** @param {Object} [prefs] @returns {PerfilEfectivo} */
function construirPerfilEfectivo(prefs = {}) {
    // [] es una eliminación explícita, incluso si una migración lo puso como default.
    // Solo admito compatibilidad legacy cuando el detalle no existe o es null.
    const tecnologias = Array.isArray(prefs.tecnologias_detalle) ? prefs.tecnologias_detalle : null;
    const ingles = prefs.nivel_ingles_detalle ?? null;
    const candidato = {
        nombre: prefs.nombre ?? null,
        nivel_real_seniority: prefs.nivel_real_seniority ?? prefs.nivel_experiencia ?? null,
        anios_experiencia_reales: prefs.anios_experiencia_reales ?? null,
        perfil_profesional: prefs.perfil_profesional ?? null,
        tecnologias_detalle: tecnologias ?? [],
        stack_tecnologico: tecnologias === null ? (prefs.stack_tecnologico ?? [])
            : [...new Set(tecnologias.filter(t => t.nivel !== 'ninguno').map(t => t.nombre))],
        nivel_ingles_detalle: ingles,
        idioma_candidato: ingles === null ? (prefs.idioma_candidato ?? null) : null,
        conocimientos_ausentes: prefs.conocimientos_ausentes ?? [],
        limitaciones_explicitas: prefs.limitaciones_explicitas ?? null,
    };
    // Los roles buscados expresan objetivos, no capacidades ni experiencia.
    const preferencias = { roles_objetivo_detalle: prefs.roles_objetivo_detalle ?? [] };
    for (const campo of ['modalidad_aceptada', 'zonas_preferidas', 'reglas_exclusion', 'disponibilidad',
        'expectativa_salarial_min', 'expectativa_salarial_max', 'moneda_salarial', 'keywords_positivas',
        'keywords_negativas', 'plataformas_preferidas', 'plataformas_excluidas']) {
        preferencias[campo] = prefs[campo] ?? null;
    }
    const politicasSistema = [
        'Java o su ecosistema como tecnología principal o requisito obligatorio: rechazar. No confundir Java con JavaScript; menciones opcionales no activan la exclusión.',
        'Senior/SR/Lead como nivel requerido del candidato: rechazar; no confundir con empresa líder o mentor senior.',
        'Experiencia excluyente 3+ años, >3 años, mínimo/al menos 3 o cantidades mayores: rechazar; no atribuir trayectoria empresarial al candidato.',
        'Inglés avanzado/fluido/bilingüe/conversacional requerido: rechazar independientemente del idioma declarado por el candidato. También rechazo English required, inglés requerido, inglés obligatorio o excluyente, incluso sin nivel especificado; inglés deseable no activa exclusión.',
        'Presencial fuera de zonas_preferidas: rechazar cuando hay zonas guardadas; remoto no se excluye por ubicación.',
    ];
    const restricciones = { preferencias, politicas_sistema: politicasSistema };
    const secciones = [
        { id: 'candidato', titulo: 'CANDIDATO CONFIRMADO', texto: `CANDIDATO CONFIRMADO:\n${JSON.stringify(candidato, null, 4)}` },
        { id: 'preferencias', titulo: 'PREFERENCIAS LABORALES', texto: `PREFERENCIAS LABORALES:\n${JSON.stringify(preferencias, null, 4)}` },
        { id: 'politicas', titulo: 'POLÍTICAS OBLIGATORIAS DEL SISTEMA', texto: `POLÍTICAS OBLIGATORIAS DEL SISTEMA (no editables mediante preferencias):\n${politicasSistema.map(p => `- ${p}`).join('\n')}` },
    ];
    return { version: 1, candidato, restricciones, secciones, texto: secciones.map(s => s.texto).join('\n\n') };
}

module.exports = { construirPerfilEfectivo };
