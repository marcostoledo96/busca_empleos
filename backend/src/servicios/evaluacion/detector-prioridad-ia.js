'use strict';

const VERSION_PRIORIDAD_IA = 'prioridad-ia-v1';
const SENIALES = [
    { categoria: 'herramienta_ia', patron: /\bclaude\s+code\b/i },
    { categoria: 'herramienta_ia', patron: /\bcodex\b/i },
    { categoria: 'herramienta_ia', patron: /\bopencode\b/i },
    { categoria: 'herramienta_ia', patron: /\b(?:github\s+)?copilot\b/i },
    { categoria: 'herramienta_ia', patron: /\bchatgpt\b/i },
    { categoria: 'ia_generativa', patron: /\b(?:ia|ai)\s+generativa\b/i },
    { categoria: 'ia_generativa', patron: /\bllm\b/i },
    { categoria: 'prompt_engineering', patron: /\bprompt\s+engineering\b/i },
    { categoria: 'nextjs', patron: /\bnext\.?js\b/i },
];

function obtenerTexto(oferta = {}) {
    return [oferta.titulo, oferta.descripcion]
        .filter((valor) => typeof valor === 'string')
        .join(' ');
}

function estaNegada(texto, indice) {
    const contexto = texto.slice(Math.max(0, indice - 45), indice);
    return /\b(?:no|sin|nunca|not|without)\s+(?:se\s+)?(?:requiere|requieren|usar|uso|experiencia\s+con|experience\s+with)?\s*$/i.test(contexto);
}

function recortarEvidencia(texto, inicio, largo) {
    const desde = Math.max(0, inicio - 40);
    return texto.slice(desde, desde + Math.min(120, largo + 80)).trim();
}

function detectarPrioridadIa(oferta) {
    const texto = obtenerTexto(oferta);
    const categorias = new Set();
    const evidencias = [];

    for (const senial of SENIALES) {
        const coincidencia = senial.patron.exec(texto);
        if (!coincidencia || estaNegada(texto, coincidencia.index)) continue;
        categorias.add(senial.categoria);
        if (evidencias.length < 3) {
            evidencias.push(recortarEvidencia(texto, coincidencia.index, coincidencia[0].length));
        }
    }

    return {
        detectada: categorias.size > 0,
        puntaje: Math.min(6, categorias.size * 2),
        categorias: [...categorias],
        evidencias,
        version: VERSION_PRIORIDAD_IA,
    };
}

module.exports = { detectarPrioridadIa, VERSION_PRIORIDAD_IA };
