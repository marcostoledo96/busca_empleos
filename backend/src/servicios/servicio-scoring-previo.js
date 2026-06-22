// Servicio de scoring previo — calcula un score determinístico antes de DeepSeek.
//
// ¿Por qué existe este servicio?
// Antes: DeepSeek era el juez absoluto. Recibía la oferta completa + el perfil
// completo y decidía todo. Esto tenía problemas:
// - Gasta muchos tokens (prompt de ~150 líneas por oferta).
// - Inconsistente: dos ofertas similares pueden tener scores muy distintos.
// - Imposible de testear: no hay forma de saber por qué dio 82 y no 75.
// - No usa los niveles de tecnología del perfil detallado (P3).
//
// Ahora: el backend calcula un score previo con reglas claras.
// DeepSeek solo refina (±15 puntos) basándose en matices que el regex no captura.
// Esto es más barato, más consistente y totalmente testeable.

const modeloPreferencia = require('../modelos/preferencia');

// Catálogo de tecnologías detectables en ofertas.
// Cada entrada tiene el nombre canónico y los patrones regex (aliases) que la detectan.
// NO incluye Maven ni Gradle (se usan con Kotlin/Scala también).
const CATALOGO_TECNOLOGIAS = [
    { nombre: 'Angular', aliases: [/\bangular\b/i], categoria: 'frontend' },
    { nombre: 'React', aliases: [/\breact\b/i, /\breact\.js\b/i, /\breactjs\b/i], categoria: 'frontend' },
    { nombre: 'Next.js', aliases: [/\bnext\.?js\b/i, /\bnextjs\b/i, /\bnext\s+1[3456789]\+?\b/i, /\bapp router\b/i, /\bpages router\b/i], categoria: 'frontend' },
    { nombre: 'Blazor', aliases: [/\bblazor\b/i], categoria: 'frontend' },
    { nombre: 'Node.js', aliases: [/\bnode\.js\b/i, /\bnodejs\b/i, /\bnode\b/i], categoria: 'backend' },
    { nombre: 'Express', aliases: [/\bexpress\b/i, /\bexpress\.js\b/i], categoria: 'backend' },
    { nombre: 'ASP.NET', aliases: [/\basp\.net\b/i, /\basp net\b/i, /\b\.net\b/i], categoria: 'backend' },
    { nombre: 'PostgreSQL', aliases: [/\bpostgresql\b/i, /\bpostgres\b/i], categoria: 'base_de_datos' },
    { nombre: 'SQL Server', aliases: [/\bsql server\b/i, /\bmssql\b/i], categoria: 'base_de_datos' },
    { nombre: 'HTML5', aliases: [/\bhtml5?\b/i], categoria: 'frontend' },
    { nombre: 'CSS3', aliases: [/\bcss3?\b/i, /\bscss\b/i, /\bsass\b/i], categoria: 'frontend' },
    { nombre: 'JavaScript', aliases: [/\bjavascript\b/i, /\bjs\b/i], categoria: 'lenguaje' },
    { nombre: 'TypeScript', aliases: [/\btypescript\b/i, /\bts\b/i], categoria: 'lenguaje' },
    { nombre: 'C#', aliases: [/\bc#\b/i, /\bc sharp\b/i, /\bcsharp\b/i], categoria: 'lenguaje' },
    { nombre: 'Java', aliases: [/\bjava\b/i], categoria: 'lenguaje' },
    { nombre: 'Spring Boot', aliases: [/\bspring boot\b/i, /\bspringboot\b/i, /\bspring\b/i], categoria: 'backend' },
    { nombre: 'Hibernate', aliases: [/\bhibernate\b/i], categoria: 'backend' },
    { nombre: 'J2EE', aliases: [/\bj2ee\b/i, /\bjee\b/i, /\bjava ee\b/i, /\bjakarta ee\b/i], categoria: 'backend' },
    { nombre: 'Git', aliases: [/\bgit\b/i, /\bgithub\b/i], categoria: 'herramienta' },
    { nombre: 'Jira', aliases: [/\bjira\b/i], categoria: 'herramienta' },
    { nombre: 'Figma', aliases: [/\bfigma\b/i], categoria: 'herramienta' },
    { nombre: 'Jest', aliases: [/\bjest\b/i], categoria: 'testing' },
    { nombre: 'QA Manual', aliases: [/\bqa\b/i, /\bqa manual\b/i, /\btesting funcional\b/i, /\bqa testing\b/i], categoria: 'testing' },
    { nombre: 'Docker', aliases: [/\bdocker\b/i], categoria: 'herramienta' },
    { nombre: 'AWS', aliases: [/\baws\b/i, /\bamazon web services\b/i], categoria: 'cloud' },
    { nombre: 'Kotlin', aliases: [/\bkotlin\b/i], categoria: 'lenguaje' },
    { nombre: 'Go', aliases: [/\bgolang\b/i, /\bgo\b/i], categoria: 'lenguaje' },
    { nombre: 'Python', aliases: [/\bpython\b/i], categoria: 'lenguaje' },
    { nombre: 'PHP', aliases: [/\bphp\b/i], categoria: 'lenguaje' },
    { nombre: 'Ruby', aliases: [/\bruby\b/i, /\brails\b/i], categoria: 'lenguaje' },
    { nombre: 'Swift', aliases: [/\bswift\b/i], categoria: 'lenguaje' },
    { nombre: 'GraphQL', aliases: [/\bgraphql\b/i], categoria: 'backend' },
    { nombre: 'MongoDB', aliases: [/\bmongodb\b/i, /\bmongo\b/i], categoria: 'base_de_datos' },
    { nombre: 'Firebase', aliases: [/\bfirebase\b/i], categoria: 'cloud' },
    { nombre: 'Terraform', aliases: [/\bterraform\b/i], categoria: 'cloud' },
    { nombre: 'Kubernetes', aliases: [/\bkubernetes\b/i, /\bk8s\b/i], categoria: 'cloud' },
];

// Patrones para detectar menciones relevantes de herramientas IA en ofertas.
// Diseñados para evitar falsos positivos: no matchean "ai" suelto ni
// acrónimos irrelevantes. Solo matchean términos concretos de productividad
// de desarrollo con IA.
const PATRONES_HERRAMIENTAS_IA = [
    /\bclaude\s*code\b/i,
    /\bcodex\b/i,
    /\bopencode\b/i,
    /\bantigravity\b/i,
    /\bcopilot\b/i,
    /\bchatgpt\b/i,
    /\bgpt[- ]?4\b/i,
    /\bllm\b/i,
    /\bia generativa\b/i,
    /\bagentes? de ia\b/i,
    /\bai agents?\b/i,
    /\bprompt engineering\b/i,
    /\bautomatizaci[oó]n con ia\b/i,
    /\bintegraci[oó]n de ia\b/i,
    /\bherramientas? de ia\b/i,
    /\bai tools?\b/i,
];

// Patrones para detectar menciones de Next.js en ofertas (ya incluido en catálogo,
// pero se usa para calcular bonus específico de Next.js).
const PATRONES_NEXTJS = [
    /\bnext\.?js\b/i,
    /\bnextjs\b/i,
    /\bnext\s+1[3456789]\+?\b/i,
    /\bapp router\b/i,
    /\bpages router\b/i,
];

// Patrones para detectar nivel de seniority en la oferta.
const PATRONES_SENIORITY = [
    { nivel: 'sr_director', patrones: [/\bsr\.?\b/i, /\bsenior\b/i], penalizacion: 30 },
    { nivel: 'semi_senior', patrones: [/\bssr\.?\b/i, /\bsemi\s*senior\b/i, /\bsemisenior\b/i], penalizacion: 10 },
    { nivel: 'junior', patrones: [/\bjunior\b/i, /\bjr\.?\b/i], penalizacion: 0 },
    { nivel: 'trainee', patrones: [/\btrainee\b/i], penalizacion: 0 },
];

// Patrones para detectar "Lead" como rol seniority (no solo como adjetivo de engineer/developer).
// "Tech Lead", "Team Lead", "Engineering Lead" son roles de liderazgo excluyentes para un junior.
const PATRONES_LEAD = [
    /\btech\s*lead\b/i,
    /\bteam\s*lead\b/i,
    /\bengineering\s*lead\b/i,
    /\blead\s+developer\b/i,
    /\blead\s+engineer\b/i,
    /\blead\b(?:\s+(?:engineer|developer|dev|architect))?\b/i,
];

// Patrones para detectar requisitos de experiencia excluyente (>3 años, 3+ años, etc.).
// Estas frases indican que la oferta exige más experiencia de la que tiene un junior/trainee,
// y el bonus IA/Next.js NO debe compensarlo. Se aplica un hard cap equivalente al de seniority.
const PATRONES_EXPERIENCIA_EXCLUYENTE = [
    // ">3 años", "> 3 años", ">3 anos" (sin ñ)
    />\s*3\s*(años|anos|years|yr|año|ano|year)\b/i,
    // "3+ años", "3+ anos"
    /\b3\s*\+\s*(años|anos|years|yr|año|ano|year)\b/i,
    // "al menos 3 años/anos/years"
    /\bal\s+menos\s+3\s*(años|anos|years|yr|año|ano|year)\b/i,
    // "mínimo 3 años/anos/years" (con y sin acento)
    /\bm[ií]nimo\s+3\s*(años|anos|years|yr|año|ano|year)\b/i,
    // "minimum 3 years"
    /\bminimum\s+3\s*(years|yr|year)\b/i,
    // "at least 3 years"
    /\bat\s+least\s+3\s*(years|yr|year)\b/i,
    // "3 or more years", "3+ years of experience"
    /\b3\s*(or\s+more|o\s+mas)\s*(años|anos|years|yr|año|ano|year)\b/i,
    // Variantes: "4+ años", ">4 años", "5+ años", ">5 años" (también excluyentes)
    /\b[45]\s*\+\s*(años|anos|years|yr|año|ano|year)\b/i,
    />\s*[45]\s*(años|anos|years|yr|año|ano|year)\b/i,
    // "al menos 4/5 años", "mínimo 4/5 años"
    /\b(al\s+menos|m[ií]nimo|at\s+least|minimum)\s+[45]\s*(años|anos|years|yr|año|ano|year)\b/i,
];

// Patrones para detectar requisitos de inglés avanzado.
const PATRONES_INGLES_AVANZADO = [
    /\benglish\b/i,
    /\b(fluent|fluido|avanzado|bilingüe|bilingual|conversational|upper.?intermediate)\b/i,
    /\bdaily\s+(standups?|meetings?)\s+in\s+english\b/i,
    /\benglish.?speaking\s+team\b/i,
    /\bcommunicate\s+in\s+english\b/i,
];

const PATRONES_ESPANOL = [
    /\b(el|la|los|las|para|con|sin|que|una|uno|puesto|trabajo|experiencia|remoto|empresa|requisitos|desarrollador)\b/i,
    /\bespanol\b/i,
];

const PATRONES_INGLES = [
    /\b(the|and|for|with|without|experience|requirements|responsibilities|remote|job|company|developer|we are looking)\b/i,
    /\bapply now\b/i,
];

// Patrones simples para detectar ofertas principalmente en portugués.
// No es NLP completo, pero captura bien casos reales de Brasil/Portugal.
const PATRONES_PORTUGUES = [
    /\b(voce|você|voces|nao|não|desenvolvedor|empresa|vaga|remoto|brasil|portugues|português|trabalho|sua|suas|nosso|nossa|nossas|para integrar nosso time)\b/i,
    /\bjunior\b.*\bbrasil\b/i,
    /\bpelotas\b/i,
];

// Patrones para detectar sector salud (bonus HealthTech).
const PATRONES_HEALTHTECH = [
    /\b(salud|health|médico|medico|clínica|clinica|hospital|laboratorio|paciente|patient|consultorio|historia clínica|radiología|radiologia)\b/i,
];

// Falsos positivos de seniority: no penalizar si son menciones de tiempo corto.
const FALSOS_POSITIVOS_SENIORITY = [
    /\b(3|tres)\s+(meses|months)\b/i,
    /\b(3|tres)\s+(días|dias|days)\b/i,
    /\b(3|tres)\s+(semanas|weeks)\b/i,
    /\bcapacitaci[oó]n\s+de\s+(3|tres)\s+meses\b/i,
];

/**
 * Normaliza texto: minúsculas, sin acentos, sin HTML, sin espacios extra.
 */
function normalizarTexto(texto = '') {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrae texto útil de datos_crudos (JSONB del scraping).
 */
function extraerTextoDatosCrudos(datosCrudos) {
    if (!datosCrudos || typeof datosCrudos !== 'object') return '';

    const campos = ['description', 'descriptionHtml', 'jobDescription', 'job_description', 'requirements', 'requisitos', 'summary', 'html'];
    return campos.map(c => typeof datosCrudos[c] === 'string' ? datosCrudos[c] : '').filter(Boolean).join(' ');
}

/**
 * Construye el texto completo analizable de una oferta.
 */
function extraerTextoOferta(oferta) {
    return normalizarTexto([
        oferta.titulo,
        oferta.descripcion,
        extraerTextoDatosCrudos(oferta.datos_crudos),
    ].filter(Boolean).join(' '));
}

/**
 * Detecta qué tecnologías del catálogo aparecen en la oferta.
 */
function extraerTecnologiasOferta(oferta) {
    const texto = extraerTextoOferta(oferta);
    const tecnologias = [];

    for (const tech of CATALOGO_TECNOLOGIAS) {
        const encontrada = tech.aliases.some(regex => regex.test(texto));
        if (encontrada) {
            tecnologias.push({
                nombre: tech.nombre,
                categoria: tech.categoria,
            });
        }
    }

    return tecnologias;
}

/**
 * Cruza las tecnologías detectadas en la oferta contra el perfil de Marcos.
 * Retorna bonificación total y detalle.
 */
function analizarMatchTecnologico(oferta, perfil) {
    const tecnologiasOferta = extraerTecnologiasOferta(oferta);
    const perfilTecnologias = (perfil.tecnologias_detalle || perfil.tecnologiasDetalle) || [];

    let bonificacion = 0;
    let penalizacion = 0;
    const dominadas = [];
    const desconocidas = [];

    const puntajePorNivel = { avanzado: 8, medio: 5, basico: 2, ninguno: -5 };

    for (const techOferta of tecnologiasOferta) {
        // Buscar en el perfil si existe esta tecnología.
        const nombreOferta = String(techOferta.nombre || '').toLowerCase();
        const match = perfilTecnologias.find(t =>
            t && t.nombre === techOferta.nombre ||
            (Array.isArray(t?.aliases) ? t.aliases : []).some(a => {
                const alias = typeof a === 'string' ? a.toLowerCase() : '';
                return alias && (nombreOferta.includes(alias) || alias.includes(nombreOferta));
            })
        );

        if (match) {
            const nivel = match.nivel || 'basico';
            const puntos = puntajePorNivel[nivel] || 0;

            if (puntos > 0) {
                bonificacion += puntos;
                dominadas.push({ nombre: techOferta.nombre, nivel, puntos });
            } else if (puntos < 0) {
                penalizacion += Math.abs(puntos);
                desconocidas.push({ nombre: techOferta.nombre, nivel: 'ninguno', puntos: -Math.abs(puntos) });
            }
        }
    }

    // Penalización extra por cada tecnología desconocida importante (no en perfil).
    const nombresPerfil = new Set(perfilTecnologias.map(t => t.nombre));
    for (const techOferta of tecnologiasOferta) {
        if (!nombresPerfil.has(techOferta.nombre) && !perfilTecnologias.some(t => t.nombre === techOferta.nombre)) {
            // Solo penalizar si parece importante (backend, frontend, base_de_datos, lenguaje).
            if (['backend', 'frontend', 'base_de_datos', 'lenguaje'].includes(techOferta.categoria)) {
                penalizacion += 5;
                desconocidas.push({ nombre: techOferta.nombre, nivel: 'desconocida', puntos: -5 });
            }
        }
    }

    return { bonificacion, penalizacion, dominadas, desconocidas, tecnologiasDetectadas: tecnologiasOferta };
}

/**
 * Detecta el nivel de seniority y calcula penalización.
 */
function detectarSeniority(oferta) {
    const texto = extraerTextoOferta(oferta);

    // Eliminar falsos positivos.
    let textoLimpio = texto;
    for (const fp of FALSOS_POSITIVOS_SENIORITY) {
        textoLimpio = textoLimpio.replace(fp, '');
    }

    let peorNivel = null;
    let penalizacion = 0;

    for (const regla of PATRONES_SENIORITY) {
        const coincide = regla.patrones.some(p => p.test(textoLimpio));
        if (coincide && regla.penalizacion > penalizacion) {
            peorNivel = regla.nivel;
            penalizacion = regla.penalizacion;
        }
    }

    return {
        nivel: peorNivel || 'no_especificado',
        penalizacion,
    };
}

/**
 * Detecta señales de idioma problemático para el candidato.
 *
 * - Inglés avanzado excluyente penaliza fuerte (-25).
 * - Portugués como idioma principal penaliza MUY fuerte (-60) porque
 *   Marcos no lo habla. Esto hace que una oferta portuguesa quede casi
 *   siempre por debajo del umbral aunque matchee técnicamente.
 */
function detectarIdioma(oferta) {
    const texto = extraerTextoOferta(oferta);

    const requiereAvanzado = PATRONES_INGLES_AVANZADO.some(p => p.test(texto));
    const puntajeEspanol = PATRONES_ESPANOL.reduce((acc, p) => acc + (p.test(texto) ? 1 : 0), 0);
    const puntajeIngles = PATRONES_INGLES.reduce((acc, p) => acc + (p.test(texto) ? 1 : 0), 0);
    const puntajePortugues = PATRONES_PORTUGUES.reduce((acc, p) => acc + (p.test(texto) ? 1 : 0), 0);

    let idiomaPrincipal = 'espanol';
    if (puntajePortugues > puntajeEspanol && puntajePortugues >= 2) {
        idiomaPrincipal = 'portugues';
    } else if (puntajeIngles > puntajeEspanol && puntajeIngles >= 2) {
        idiomaPrincipal = 'ingles';
    }

    const parecePortugues = idiomaPrincipal === 'portugues';
    const pareceIngles = idiomaPrincipal === 'ingles';
    const idiomaNoEspanol = parecePortugues || pareceIngles;

    // Penalización proporcional al contexto:
    // - Portugués: siempre muy fuerte (-60), el candidato no lo habla.
    // - Inglés avanzado explícito (fluent, bilingual, reuniones): fuerte (-50).
    // - Inglés dominante (texto en inglés pero sin exigir fluidez): leve (-20).
    //   Muchas ofertas tech publican en inglés aunque el trabajo sea en español.
    let penalizacionIdioma = 0;
    if (parecePortugues) {
        penalizacionIdioma = 60;
    } else if (requiereAvanzado) {
        penalizacionIdioma = 50;
    } else if (pareceIngles) {
        penalizacionIdioma = 20;
    }

    const penalizacion = penalizacionIdioma;

    return {
        requiereAvanzado,
        parecePortugues,
        pareceIngles,
        idiomaPrincipal,
        idiomaNoEspanol,
        puntajeEspanol,
        puntajeIngles,
        puntajePortugues,
        penalizacion,
    };
}

/**
 * Detecta si el rol de la oferta coincide con los roles objetivo de Marcos.
 */
function detectarRolObjetivo(oferta, perfil) {
    const texto = extraerTextoOferta(oferta);
    const rolesPerfil = (perfil.roles_objetivo_detalle || perfil.rolesObjetivoDetalle) || [];

    let mejorPrioridad = null;
    let bonificacion = 0;

    for (const rol of rolesPerfil) {
        const aliases = Array.isArray(rol.aliases) ? rol.aliases : [];
        const rolTexto = typeof rol.rol === 'string' ? rol.rol.toLowerCase() : '';
        const coincide = aliases.some(a => typeof a === 'string' && texto.includes(a.toLowerCase())) ||
            (rolTexto ? texto.includes(rolTexto) : false);

        if (coincide) {
            if (rol.prioridad === 'alta' && bonificacion < 5) {
                mejorPrioridad = 'alta';
                bonificacion = 5;
            } else if (rol.prioridad === 'media' && bonificacion < 3) {
                mejorPrioridad = 'media';
                bonificacion = 3;
            } else if (!mejorPrioridad) {
                mejorPrioridad = rol.prioridad;
                bonificacion = 1;
            }
        }
    }

    return {
        detectado: !!mejorPrioridad,
        rol: mejorPrioridad,
        bonificacion,
    };
}

/**
 * Detecta si la oferta está relacionada con salud (bonus HealthTech).
 */
function detectarHealthTech(oferta) {
    const texto = extraerTextoOferta(oferta);
    return PATRONES_HEALTHTECH.some(p => p.test(texto));
}

/**
 * Detecta si la oferta tiene requisitos de experiencia excluyente para un junior.
 * Patrones como ">3 años", "3+ años", "al menos 3 años", "mínimo 3 años",
 * y variantes normalizadas sin ñ ("anos") o en inglés ("years").
 *
 * También detecta roles de "Lead" (Tech Lead, Team Lead, etc.) que implican
 * seniority excluyente.
 *
 * Retorna true si alguna señal de experiencia excluyente fue detectada.
 */
function detectarExperienciaExcluyente(oferta) {
    const texto = extraerTextoOferta(oferta);

    // Eliminar falsos positivos de seniority del texto antes de evaluar.
    let textoLimpio = texto;
    for (const fp of FALSOS_POSITIVOS_SENIORITY) {
        textoLimpio = textoLimpio.replace(fp, '');
    }

    const patronesMatcheados = [];

    // Verificar patrones de experiencia excluyente (>3 años, etc.).
    for (const patron of PATRONES_EXPERIENCIA_EXCLUYENTE) {
        if (patron.test(textoLimpio)) {
            const match = textoLimpio.match(patron);
            if (match) {
                patronesMatcheados.push(match[0]);
            }
        }
    }

    // Verificar patrones de "Lead" como rol excluyente.
    for (const patron of PATRONES_LEAD) {
        if (patron.test(textoLimpio)) {
            const match = textoLimpio.match(patron);
            if (match) {
                patronesMatcheados.push(match[0]);
            }
        }
    }

    return {
        detectado: patronesMatcheados.length > 0,
        patrones: patronesMatcheados,
    };
}

/**
 * Detecta menciones relevantes de herramientas IA en la oferta.
 * Retorna las herramientas detectadas y un bonus acotado.
 *
 * Salvaguardas:
 * - El bonus NO compensa exclusiones por Java, seniority, idioma, experiencia excluyente o ubicación.
 * - Se aplica un cap máximo configurable (default: +8 combinado).
 * - Ofertas Senior/SR/Lead o con >3 años excluyentes no reciben bonus IA.
 */
function calcularBonusIA(oferta, perfil) {
    const texto = extraerTextoOferta(oferta);
    const config = perfil.scoring_config || {};
    const bonificaciones = config.bonificaciones || {};
    const limites = config.limites || {};

    const bonusIA = bonificaciones.herramientas_ia ?? 6;
    const bonusNextjs = bonificaciones.nextjs ?? 4;
    const maxCombinado = bonificaciones.herramientas_ia_nextjs_max ?? 8;
    const maxScoreSiJava = limites.max_score_si_java_excluyente ?? 35;
    const maxScoreSiSenior = limites.max_score_si_senior ?? 45;
    const maxScoreSiIngles = limites.max_score_si_ingles_excluyente ?? 15;
    const maxScoreSiExperienciaExcluyente = limites.max_score_si_experiencia_excluyente ?? 45;

    // Detectar herramientas IA mencionadas.
    const herramientasDetectadas = [];
    for (const patron of PATRONES_HERRAMIENTAS_IA) {
        if (patron.test(texto)) {
            // Extraer el nombre de la herramienta del match.
            const match = texto.match(patron);
            if (match) {
                herramientasDetectadas.push(match[0]);
            }
        }
    }

    // Detectar Next.js mencionado.
    const nextjsDetectado = PATRONES_NEXTJS.some(p => p.test(texto));

    // Calcular bonus bruto.
    let bonusBruto = 0;
    if (herramientasDetectadas.length > 0) {
        bonusBruto += Math.min(bonusIA, bonusIA); // Bonus completo si hay cualquier mención.
    }
    if (nextjsDetectado) {
        bonusBruto += Math.min(bonusNextjs, bonusNextjs);
    }

    // Cap combinado: el bonus total no puede superar el máximo configurado.
    const bonusAplicado = Math.min(bonusBruto, maxCombinado);

    return {
        herramientasIA: herramientasDetectadas,
        nextjsDetectado,
        bonusIA: herramientasDetectadas.length > 0 ? Math.min(bonusIA, maxCombinado) : 0,
        bonusNextjs: nextjsDetectado ? Math.min(bonusNextjs, maxCombinado - (herramientasDetectadas.length > 0 ? Math.min(bonusIA, maxCombinado) : 0)) : 0,
        bonusTotal: bonusAplicado,
        maxScoreSiJava,
        maxScoreSiSenior,
        maxScoreSiIngles,
        maxScoreSiExperienciaExcluyente,
    };
}

/**
 * Verifica si la oferta cubre el stack principal completo de Marcos.
 */
function tieneStackPrincipalCompleto(matchTecnologico, perfil) {
    const perfilTecnologias = (perfil.tecnologias_detalle || perfil.tecnologiasDetalle) || [];
    const principales = perfilTecnologias.filter(t => t.importancia === 'principal');
    const dominadas = new Set(matchTecnologico.dominadas.map(d => d.nombre));

    if (principales.length === 0) return false;

    // Al menos el 70% de las principales están en la oferta.
    const cobertura = principales.filter(t => dominadas.has(t.nombre)).length / principales.length;
    return cobertura >= 0.7;
}

/**
 * Acota un número al rango [min, max].
 */
function clamp(numero, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(numero)));
}

/**
 * Calcula el score previo de una oferta usando reglas determinísticas.
 *
 * @param {Object} oferta - Fila de la tabla ofertas.
 * @param {Object} perfil - Fila de preferencias con tecnologias_detalle y scoring_config.
 * @returns {Object} Análisis completo con score_previo, penalizaciones y bonificaciones.
 */
function calcularScorePrevio(oferta, perfil) {
    perfil = perfil || {};
    const config = perfil.scoring_config || {};
    const matchTecnologico = analizarMatchTecnologico(oferta, perfil);
    const seniority = detectarSeniority(oferta);
    const ingles = detectarIdioma(oferta);
    const rol = detectarRolObjetivo(oferta, perfil);
    const esHealthTech = detectarHealthTech(oferta);
    const experienciaExcluyente = detectarExperienciaExcluyente(oferta);

    let score = 50;

    // Tecnologías.
    score += matchTecnologico.bonificacion;
    score -= matchTecnologico.penalizacion;

    // Penalizaciones.
    score -= seniority.penalizacion;
    score -= ingles.penalizacion;

    // === Sprint 3: Perfil ampliado ===

    // Penalizar conocimientos ausentes detectados en la oferta.
    const conocimientosAusentes = Array.isArray(perfil.conocimientos_ausentes)
        ? perfil.conocimientos_ausentes.filter(c => typeof c === 'string')
        : [];
    let penalizacionAusentes = 0;
    const ausentesDetectados = [];

    if (conocimientosAusentes.length > 0) {
        const texto = extraerTextoOferta(oferta);
        for (const conocimiento of conocimientosAusentes) {
            // Buscar el conocimiento como frase completa o palabras clave.
            const patron = new RegExp(
                conocimiento.replace(/[-\s]+/g, '[\\s-]*'),
                'i'
            );
            if (patron.test(texto)) {
                penalizacionAusentes += 5;
                ausentesDetectados.push(conocimiento);
            }
        }
        score -= penalizacionAusentes;
    }

    // Penalizar si la oferta pide un rol demasiado senior vs nivel real.
    // Usamos nivel_experiencia (campo estructurado: trainee | junior | semi-senior)
    // en vez de nivel_real_seniority (texto libre) porque el texto puede contener
    // falsos positivos (p.ej. "sin experiencia senior" incluye la palabra "senior").
    const nivelExperiencia = perfil.nivel_experiencia || 'junior';
    const esJunior = nivelExperiencia === 'trainee' || nivelExperiencia === 'junior';
    const textoOferta = extraerTextoOferta(oferta);
    let penalizacionRolSenior = 0;
    const senalesRolAlto = [];

    if (esJunior) {
        const senalesSenior = [
            { patron: /\bingeniero\s+de\s+software\b/i, nombre: 'ingeniero de software', puntos: 15 },
            { patron: /\bsenior\s+software\b/i, nombre: 'senior software', puntos: 20 },
            { patron: /\b(amplia|sólida|vasta|extensa)\s+experiencia\b/i, nombre: 'experiencia alta requerida', puntos: 10 },
            { patron: /\b(minimo|al menos)\s+[345]\s+años\b/i, nombre: '3+ años requeridos', puntos: 15 },
            { patron: /\b(lead|staff|principal)\s+(engineer|developer)\b/i, nombre: 'rol de liderazgo técnico', puntos: 20 },
            { patron: /\b(arquitecturas?\s+(basadas\s+)?en\s+eventos|event\s+(driven|sourcing))\b/i, nombre: 'arquitectura de eventos', puntos: 5 },
        ];

        for (const senal of senalesSenior) {
            if (senal.patron.test(textoOferta)) {
                penalizacionRolSenior += senal.puntos;
                senalesRolAlto.push(senal.nombre);
            }
        }
        score -= penalizacionRolSenior;
    }

    // Bonificaciones.
    score += rol.bonificacion;

    if (esHealthTech) {
        score += 5;
    }

    const stackCompleto = tieneStackPrincipalCompleto(matchTecnologico, perfil);
    if (stackCompleto) {
        score += 10;
    }

    // === Bonus IA / Next.js ===
    const bonusIA = calcularBonusIA(oferta, perfil);
    score += bonusIA.bonusTotal;

    // === Salvaguardas: caps por exclusiones ===
    // El bonus IA NO puede compensar exclusiones estrictas.
    const tieneJavaExcluyente = (
        Array.isArray(perfil.reglas_exclusion)
            ? perfil.reglas_exclusion
            : []
    ).some(r => typeof r === 'string' && r.toLowerCase() === 'java')
        && matchTecnologico.tecnologiasDetectadas.some(t => t.nombre === 'Java');
    const esSenior = seniority.nivel === 'sr_director';
    const tieneInglesExcluyente = ingles.requiereAvanzado;
    const tieneExperienciaExcluyente = experienciaExcluyente.detectado;

    if (tieneJavaExcluyente) {
        score = Math.min(score, bonusIA.maxScoreSiJava);
    }
    if (esSenior) {
        score = Math.min(score, bonusIA.maxScoreSiSenior);
    }
    if (tieneInglesExcluyente) {
        score = Math.min(score, bonusIA.maxScoreSiIngles);
    }
    if (tieneExperienciaExcluyente) {
        score = Math.min(score, bonusIA.maxScoreSiExperienciaExcluyente);
    }

    const scorePrevio = clamp(score);
    const umbral = config.umbral_aprobacion ?? 60;

    return {
        score_previo: scorePrevio,
        match_previo: scorePrevio >= umbral,
        umbral_aprobacion: umbral,
        tecnologias: {
            dominadas: matchTecnologico.dominadas,
            desconocidas: matchTecnologico.desconocidas,
            detectadas: matchTecnologico.tecnologiasDetectadas,
        },
        seniority,
        ingles,
        rol,
        healthtech: esHealthTech,
        stack_principal_completo: stackCompleto,
        // Sprint 3: perfil ampliado.
        perfil_ampliado: {
            nivel_real_seniority: perfil.nivel_real_seniority || null,
            conocimientos_ausentes_detectados: ausentesDetectados,
            penalizacion_ausentes: penalizacionAusentes,
            senales_rol_alto: senalesRolAlto,
            penalizacion_rol_senior: penalizacionRolSenior,
            limitaciones_explicitas: perfil.limitaciones_explicitas || null,
        },
        // Bonus IA / Next.js.
        bonus_ia: {
            herramientas_detectadas: bonusIA.herramientasIA,
            nextjs_detectado: bonusIA.nextjsDetectado,
            bonus_ia_aplicado: bonusIA.bonusTotal,
            salvaguardas: {
                java_excluyente_aplicado: tieneJavaExcluyente,
                senior_excluyente_aplicado: esSenior,
                ingles_excluyente_aplicado: tieneInglesExcluyente,
                experiencia_excluyente_aplicado: tieneExperienciaExcluyente,
            },
        },
        // Experiencia excluyente detectada (>3 años, Lead, etc.).
        experiencia_excluyente: {
            detectado: experienciaExcluyente.detectado,
            patrones: experienciaExcluyente.patrones,
        },
        version: 'p3_p6_v1',
    };
}

module.exports = {
    calcularScorePrevio,
    extraerTextoOferta,
    extraerTecnologiasOferta,
    // Exporto funciones internas para testing.
    _internas: {
        detectarSeniority,
        detectarIdioma,
        detectarRolObjetivo,
        detectarHealthTech,
        calcularBonusIA,
        detectarExperienciaExcluyente,
    },
};
