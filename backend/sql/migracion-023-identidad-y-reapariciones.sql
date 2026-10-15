-- Migración 023: Identidad canónica y seguimiento de reapariciones de ofertas.
-- Agrego columnas para identificar unívocamente las ofertas entre ejecuciones del scraper
-- y rastrear la última fecha en que fueron vistas, permitiendo revivir ofertas existentes
-- sin duplicar filas y preservando el historial y estado de postulación del usuario.

-- 1. Agrego columnas si no existen (VARCHAR(2500) para compatibilidad con URLs extensas de hasta 2048 chars)
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS identidad_canonica VARCHAR(2500);
ALTER TABLE ofertas ALTER COLUMN identidad_canonica TYPE VARCHAR(2500);
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS fecha_ultima_extraccion TIMESTAMP;

-- 2. Backfill de fecha_ultima_extraccion con fecha_extraccion inicial
UPDATE ofertas
SET fecha_ultima_extraccion = fecha_extraccion
WHERE fecha_ultima_extraccion IS NULL;

-- 3. Backfill de identidad_canonica para filas históricas
UPDATE ofertas
SET identidad_canonica = CASE
    -- Indeed: extraigo jk o vjk del query string o path
    WHEN LOWER(plataforma) = 'indeed' AND url ~* '[?&](jk|vjk)=([a-zA-Z0-9]+)'
        THEN 'indeed:' || LOWER((regexp_match(url, '[?&](?:jk|vjk)=([a-zA-Z0-9]+)', 'i'))[1])
    WHEN LOWER(plataforma) = 'indeed' AND url ~* '/job/.*-([a-zA-Z0-9]{16})'
        THEN 'indeed:' || LOWER((regexp_match(url, '/job/.*-([a-zA-Z0-9]{16})', 'i'))[1])
    WHEN LOWER(plataforma) = 'indeed' AND (datos_crudos->>'jk') ~ '^[a-zA-Z0-9]+$'
        THEN 'indeed:' || LOWER(datos_crudos->>'jk')

    -- LinkedIn: extraigo jobId de /jobs/view/ o parámetros jobId/currentJobId
    WHEN LOWER(plataforma) = 'linkedin' AND url ~* '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})'
        THEN 'linkedin:' || (regexp_match(url, '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})', 'i'))[1]
    WHEN LOWER(plataforma) = 'linkedin' AND url ~* '[?&](currentJobId|jobId)=([0-9]{8,16})'
        THEN 'linkedin:' || (regexp_match(url, '[?&](?:currentJobId|jobId)=([0-9]{8,16})', 'i'))[1]
    WHEN LOWER(plataforma) = 'linkedin' AND (datos_crudos->>'jobId') ~ '^[0-9]{8,16}$'
        THEN 'linkedin:' || (datos_crudos->>'jobId')
    WHEN LOWER(plataforma) = 'linkedin' AND (datos_crudos->>'currentJobId') ~ '^[0-9]{8,16}$'
        THEN 'linkedin:' || (datos_crudos->>'currentJobId')

    -- Getonbrd: slug del path primero (/jobs/{slug}), luego datos_crudos->>'id'
    WHEN LOWER(plataforma) = 'getonbrd' AND url ~* '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)'
        AND (regexp_match(url, '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)', 'i'))[1] != 'jobs'
        THEN 'getonbrd:' || (regexp_match(url, '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)', 'i'))[1]
    WHEN LOWER(plataforma) = 'getonbrd' AND (datos_crudos->>'id') ~ '^[a-zA-Z0-9_-]+$'
        THEN 'getonbrd:' || (datos_crudos->>'id')

    -- Computrabajo: extraigo identificador alfanumérico
    WHEN LOWER(plataforma) = 'computrabajo' AND (datos_crudos->>'id') ~ '^[a-zA-Z0-9]+$'
        THEN 'computrabajo:' || (datos_crudos->>'id')
    WHEN LOWER(plataforma) = 'computrabajo' AND url ~* '(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})'
        THEN 'computrabajo:' || (regexp_match(url, '(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})', 'i'))[1]

    -- Bumeran: extraigo id numérico
    WHEN LOWER(plataforma) = 'bumeran' AND url ~* '-([0-9]+)\.html'
        THEN 'bumeran:' || (regexp_match(url, '-([0-9]+)\.html', 'i'))[1]
    WHEN LOWER(plataforma) = 'bumeran' AND (datos_crudos->>'id') ~ '^[0-9]+$'
        THEN 'bumeran:' || (datos_crudos->>'id')

    -- Glassdoor: query jl/jobListingId, path con jl=id o _jl/id, o datos_crudos
    WHEN LOWER(plataforma) = 'glassdoor' AND url ~* '[?&](jl|jobListingId)=([0-9]+)'
        THEN 'glassdoor:' || (regexp_match(url, '[?&](?:jl|jobListingId)=([0-9]+)', 'i'))[1]
    WHEN LOWER(plataforma) = 'glassdoor' AND url ~* '(?:/|-|_|\b)(?:jl|jobListingId)[-_=]?([0-9]+)'
        THEN 'glassdoor:' || (regexp_match(url, '(?:/|-|_|\b)(?:jl|jobListingId)[-_=]?([0-9]+)', 'i'))[1]
    WHEN LOWER(plataforma) = 'glassdoor' AND (datos_crudos->>'jl') ~ '^[0-9]+$'
        THEN 'glassdoor:' || (datos_crudos->>'jl')
    WHEN LOWER(plataforma) = 'glassdoor' AND (datos_crudos->>'jobListingId') ~ '^[0-9]+$'
        THEN 'glassdoor:' || (datos_crudos->>'jobListingId')
    WHEN LOWER(plataforma) = 'glassdoor' AND (datos_crudos->>'id') ~ '^[0-9]+$'
        THEN 'glassdoor:' || (datos_crudos->>'id')

    -- Plataformas con ID en datos_crudos
    WHEN (datos_crudos->>'id') ~ '^[a-zA-Z0-9_-]+$'
        THEN LOWER(COALESCE(plataforma, 'general')) || ':' || (datos_crudos->>'id')

    -- Fallback conservador para URLs extensas (evita exceder 500 chars usando hash determinista idéntico a JS md5)
    WHEN url IS NOT NULL AND url != '' AND LENGTH(url) > 400
        THEN LOWER(COALESCE(plataforma, 'general')) || ':url-hash:' || md5(url)

    -- Fallback conservador con URL limpia de parámetros volátiles
    WHEN url IS NOT NULL AND url != ''
        THEN LOWER(COALESCE(plataforma, 'general')) || ':url:' || split_part(split_part(url, '#', 1), '?', 1)

    ELSE LOWER(COALESCE(plataforma, 'general')) || ':id:' || id
END
WHERE identidad_canonica IS NULL;

-- 4. Resolución conservadora de colisiones históricas sin pérdida de datos:
-- La fila más antigua (menor id) conserva la identidad intacta.
-- Las filas posteriores se renombran agregando ':colision-historica-${id}'.
WITH duplicados AS (
    SELECT id, identidad_canonica,
           ROW_NUMBER() OVER (PARTITION BY identidad_canonica ORDER BY id ASC) as rn
    FROM ofertas
    WHERE identidad_canonica IS NOT NULL
)
UPDATE ofertas o
SET identidad_canonica = o.identidad_canonica || ':colision-historica-' || o.id
FROM duplicados d
WHERE o.id = d.id AND d.rn > 1;

-- 5. Creación de índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_identidad_canonica ON ofertas(identidad_canonica);
CREATE INDEX IF NOT EXISTS idx_ofertas_actividad_reciente ON ofertas(COALESCE(fecha_ultima_extraccion, fecha_extraccion));
