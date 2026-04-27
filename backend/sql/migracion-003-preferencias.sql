-- Migración 003: Crear tabla de preferencias del usuario.
--
-- Esta tabla almacena la configuración personalizada del candidato:
-- perfil profesional, stack tecnológico, términos de búsqueda, zonas
-- preferidas y configuración del prompt de IA.
--
-- Es una tabla de UNA SOLA FILA (single-row design) porque la app
-- es de uso personal. Siempre se accede con id = 1.
--
-- Ejecutar una sola vez con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-003-preferencias.sql
--
-- Idempotente: si ya existe, no falla (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS preferencias (
    -- Siempre id = 1. Un solo usuario.
    id                          SERIAL      PRIMARY KEY,

    -- === Perfil profesional ===

    -- Nombre del candidato (para el prompt de IA).
    nombre                      VARCHAR(255),

    -- Nivel de experiencia actual.
    -- Valores posibles: 'trainee', 'junior', 'semi-senior'.
    nivel_experiencia           VARCHAR(50)     DEFAULT 'junior',

    -- Descripción libre del perfil, CV, experiencia.
    -- Acá el usuario escribe lo que quiera que la IA sepa sobre él.
    perfil_profesional          TEXT,

    -- Tecnologías que maneja el candidato.
    -- Uso TEXT[] (array nativo de PostgreSQL) en vez de JSONB porque:
    -- 1. El driver pg convierte TEXT[] a array de JavaScript automáticamente.
    -- 2. Puedo hacer queries con ANY() si necesito filtrar.
    -- 3. Es más simple que JSONB para un array plano de strings.
    stack_tecnologico           TEXT[]          DEFAULT '{}',

    -- Modalidad de trabajo aceptada.
    -- Valores posibles: 'cualquiera', 'remoto', 'hibrido', 'presencial'.
    modalidad_aceptada          VARCHAR(50)     DEFAULT 'cualquiera',

    -- === Ubicación ===

    -- Zonas geográficas donde el candidato acepta trabajar presencial.
    -- Valores posibles: 'CABA', 'GBA Oeste', 'GBA Norte', 'GBA Sur', 'Interior'.
    zonas_preferidas            TEXT[]          DEFAULT '{}',

    -- === Búsqueda ===

    -- Palabras clave que se usan para buscar ofertas en Apify.
    -- Reemplaza el array TERMINOS_BUSQUEDA que estaba hardcodeado en apify.js.
    terminos_busqueda           TEXT[]          DEFAULT '{}',

    -- Tecnologías o keywords que deben excluir la oferta automáticamente.
    -- Ejemplo: si tiene 'Java', la IA rechaza ofertas que requieran Java.
    reglas_exclusion            TEXT[]          DEFAULT '{}',

    -- === Configuración de IA ===

    -- Prompt personalizado que reemplaza al auto-generado.
    -- Solo se usa si usar_prompt_personalizado es TRUE.
    prompt_personalizado        TEXT,

    -- Si es TRUE, la IA usa prompt_personalizado en vez del auto-generado.
    -- Si es FALSE, el sistema genera el prompt automáticamente desde los
    -- campos de arriba (stack, perfil, zonas, exclusiones).
    usar_prompt_personalizado   BOOLEAN         DEFAULT FALSE,

    -- Modelo de DeepSeek a usar para la evaluación.
    -- 'deepseek-v4-flash' = rápido y recomendado como default.
    -- 'deepseek-v4-pro' = variante más potente.
    -- Se aceptan aliases legacy en la API para no romper datos históricos.
    modelo_ia                   VARCHAR(100)    DEFAULT 'deepseek-v4-flash',

    -- === Timestamps ===

    fecha_creacion              TIMESTAMP       DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMP       DEFAULT NOW()
);

-- Inserto la fila por defecto con los valores que hoy están hardcodeados
-- en el código. Así la migración no rompe nada: el sistema sigue funcionando
-- igual que antes, pero ahora lee estos valores de la BD.
--
-- Uso ON CONFLICT para que sea idempotente (si ya existe, no inserta otra vez).
INSERT INTO preferencias (
    id,
    nombre,
    nivel_experiencia,
    perfil_profesional,
    stack_tecnologico,
    modalidad_aceptada,
    zonas_preferidas,
    terminos_busqueda,
    reglas_exclusion,
    modelo_ia
) VALUES (
    1,
    'Marcos Ezequiel Toledo',
    'junior',
    'Desarrollador de software junior, QA Tester y soporte IT. Busco empleo en tecnología en Buenos Aires, Argentina.',
    ARRAY['HTML', 'CSS', 'JavaScript', 'TypeScript', 'C#', 'SQL', 'Angular', 'React', 'React Native', 'Node.js', 'Express', 'ASP.NET', 'PostgreSQL', 'SQL Server', 'Git', 'API REST'],
    'cualquiera',
    ARRAY['CABA', 'GBA Oeste'],
    ARRAY['tester', 'qa', 'it', 'soporte it', 'helpdesk', 'desarrollador', 'developer', 'frontend', 'soporte tecnico'],
    ARRAY['Java'],
    'deepseek-v4-flash'
) ON CONFLICT (id) DO NOTHING;
