-- Migración 024: Reparación y sincronización de identidades canónicas históricas.
--
-- Propósito: Garantizar que bases de datos donde la migración 023 ya fue aplicada
-- previamente actualicen sus identidades canónicas históricas con la versión
-- definitiva de las funciones canónicas inmutables (minúsculas de host, descarte de puertos
-- por defecto, trailing slash de raíz, espacios con +, conservación de utmax y sin truncamiento).
--
-- Idempotente: Si las identidades ya son idénticas, no modifica ninguna fila.
-- Resuelve colisiones históricas conservadoramente preservando siempre la fila más antigua.

-- 1. Actualización de funciones auxiliares inmutables (versión idéntica y compatible con runtime JS)
CREATE OR REPLACE FUNCTION fn_canonizar_url_023(p_url text, p_plataforma text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_url text := TRIM(COALESCE(p_url, ''));
    v_proto text;
    v_rest text;
    v_authority text;
    v_path text;
    v_query text := '';
    v_param text;
    v_clave text;
    v_val text;
    v_params_limpios text[] := ARRAY[]::text[];
    v_plat text := LOWER(TRIM(COALESCE(p_plataforma, 'general')));
    v_pos_slash integer;
    v_pos_q integer;
BEGIN
    IF v_url = '' THEN RETURN ''; END IF;

    -- Quitar fragmento #
    v_url := split_part(v_url, '#', 1);

    -- Extraer protocolo: http o https
    IF v_url ~* '^https?://' THEN
        v_proto := LOWER(substring(v_url from '^([a-zA-Z]+)://'));
        v_rest := substring(v_url from '^[a-zA-Z]+://(.*)$');
    ELSE
        -- Si no tiene protocolo estándar http/https, devolver URL limpia
        RETURN v_url;
    END IF;

    -- Separar query string si existe
    v_pos_q := position('?' in v_rest);
    IF v_pos_q > 0 THEN
        v_query := substring(v_rest from v_pos_q + 1);
        v_rest := substring(v_rest from 1 for v_pos_q - 1);
    END IF;

    -- Extraer authority (host y puerto) y path
    v_pos_slash := position('/' in v_rest);
    IF v_pos_slash > 0 THEN
        v_authority := substring(v_rest from 1 for v_pos_slash - 1);
        v_path := substring(v_rest from v_pos_slash);
    ELSE
        v_authority := v_rest;
        v_path := '/';
    END IF;

    -- Host a minúsculas
    v_authority := LOWER(TRIM(v_authority));

    -- Eliminar puertos por defecto (:80 para http, :443 para https)
    IF v_proto = 'http' AND v_authority LIKE '%:80' THEN
        v_authority := substring(v_authority from 1 for length(v_authority) - 3);
    ELSIF v_proto = 'https' AND v_authority LIKE '%:443' THEN
        v_authority := substring(v_authority from 1 for length(v_authority) - 4);
    END IF;

    -- Normalizar path: si tiene longitud > 1 y termina en '/', quitar la barra final (idéntico a JS)
    IF LENGTH(v_path) > 1 AND RIGHT(v_path, 1) = '/' THEN
        v_path := LEFT(v_path, -1);
    END IF;

    -- Filtrar parámetros de tracking
    IF v_query != '' THEN
        FOREACH v_param IN ARRAY string_to_array(v_query, '&') LOOP
            IF v_param IS NOT NULL AND v_param != '' THEN
                v_clave := split_part(v_param, '=', 1);
                IF position('=' in v_param) > 0 THEN
                    v_val := substring(v_param from position('=' in v_param) + 1);
                ELSE
                    v_val := '';
                END IF;

                -- Comparación exacta case-insensitive de clave
                -- Parámetros de tracking universales (regex ^utm_ para no borrar utmax)
                IF v_clave ~* '^utm_'
                   OR LOWER(v_clave) IN ('fbclid', 'gclid', 'msclkid', 'dclid', 'mc_cid', 'mc_eid', 'igshid') THEN
                    CONTINUE;
                END IF;

                -- Parámetros de tracking específicos de plataforma
                IF v_plat = 'indeed' AND LOWER(v_clave) IN ('from', 'vjs', 'tk', 'advn', 'adloc', 'qd', 'subts', 'iaf', 'attributionid', 'mobview') THEN
                    CONTINUE;
                END IF;
                IF v_plat = 'linkedin' AND LOWER(v_clave) IN ('refid', 'trackingid', 'trk', 'midtoken', 'originalsubdomain', 'trkinfo') THEN
                    CONTINUE;
                END IF;
                IF v_plat = 'computrabajo' AND LOWER(v_clave) = 'id_origen' THEN
                    CONTINUE;
                END IF;

                -- Normalizar espacios (%20 y literal espacio a + idéntico a URLSearchParams)
                v_val := replace(replace(v_val, '%20', '+'), ' ', '+');

                v_params_limpios := array_append(v_params_limpios, v_clave || '=' || v_val);
            END IF;
        END LOOP;
    END IF;

    -- Ordenar parámetros alfabéticamente (idéntico a parseada.searchParams.sort() de JS)
    IF array_length(v_params_limpios, 1) > 0 THEN
        SELECT array_agg(p ORDER BY p ASC) INTO v_params_limpios FROM unnest(v_params_limpios) AS p;
        RETURN v_proto || '://' || v_authority || v_path || '?' || array_to_string(v_params_limpios, '&');
    ELSE
        RETURN v_proto || '://' || v_authority || v_path;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_obtener_identidad_canonica_023(p_url text, p_plataforma text, p_datos_crudos jsonb, p_id integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_plat text := LOWER(TRIM(COALESCE(p_plataforma, 'general')));
    v_url text := TRIM(COALESCE(p_url, ''));
    v_datos jsonb := COALESCE(p_datos_crudos, '{}'::jsonb);
    v_url_canonica text;
    v_identidad text;
    v_match text[];
BEGIN
    IF v_plat = '' THEN v_plat := 'general'; END IF;

    -- 1. Indeed: jk / vjk
    IF v_plat = 'indeed' THEN
        IF v_url ~* '[?&](jk|vjk)=([a-zA-Z0-9]+)' THEN
            v_match := regexp_match(v_url, '[?&](?:jk|vjk)=([a-zA-Z0-9]+)', 'i');
            RETURN 'indeed:' || LOWER(v_match[1]);
        ELSIF v_url ~* '/job/.*-([a-zA-Z0-9]{16})' THEN
            v_match := regexp_match(v_url, '/job/.*-([a-zA-Z0-9]{16})', 'i');
            RETURN 'indeed:' || LOWER(v_match[1]);
        ELSIF (v_datos->>'jk') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'indeed:' || LOWER(v_datos->>'jk');
        END IF;
    END IF;

    -- 2. LinkedIn: jobId
    IF v_plat = 'linkedin' THEN
        IF v_url ~* '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})' THEN
            v_match := regexp_match(v_url, '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})', 'i');
            RETURN 'linkedin:' || v_match[1];
        ELSIF v_url ~* '[?&](currentJobId|jobId)=([0-9]{8,16})' THEN
            v_match := regexp_match(v_url, '[?&](?:currentJobId|jobId)=([0-9]{8,16})', 'i');
            RETURN 'linkedin:' || v_match[1];
        ELSIF (v_datos->>'jobId') ~ '^[0-9]{8,16}$' THEN
            RETURN 'linkedin:' || (v_datos->>'jobId');
        ELSIF (v_datos->>'currentJobId') ~ '^[0-9]{8,16}$' THEN
            RETURN 'linkedin:' || (v_datos->>'currentJobId');
        END IF;
    END IF;

    -- 3. GetOnBrd: slug o id
    IF v_plat = 'getonbrd' THEN
        IF v_url ~* '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)'
           AND (regexp_match(v_url, '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)', 'i'))[1] != 'jobs' THEN
            v_match := regexp_match(v_url, '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)', 'i');
            RETURN 'getonbrd:' || v_match[1];
        ELSIF (v_datos->>'id') ~ '^[a-zA-Z0-9_-]+$' THEN
            RETURN 'getonbrd:' || (v_datos->>'id');
        END IF;
    END IF;

    -- 4. Computrabajo
    IF v_plat = 'computrabajo' THEN
        IF (v_datos->>'id') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'computrabajo:' || (v_datos->>'id');
        ELSIF v_url ~* '(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})' THEN
            v_match := regexp_match(v_url, '(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})', 'i');
            RETURN 'computrabajo:' || v_match[1];
        END IF;
    END IF;

    -- 5. Bumeran
    IF v_plat = 'bumeran' THEN
        IF v_url ~* '-([0-9]+)\.html' THEN
            v_match := regexp_match(v_url, '-([0-9]+)\.html', 'i');
            RETURN 'bumeran:' || v_match[1];
        ELSIF (v_datos->>'id') ~ '^[0-9]+$' THEN
            RETURN 'bumeran:' || (v_datos->>'id');
        END IF;
    END IF;

    -- 6. Glassdoor
    IF v_plat = 'glassdoor' THEN
        IF v_url ~* '[?&](jl|jobListingId)=([0-9]+)' THEN
            v_match := regexp_match(v_url, '[?&](?:jl|jobListingId)=([0-9]+)', 'i');
            RETURN 'glassdoor:' || v_match[1];
        ELSIF v_url ~* '(?:/|-|_|\b)(?:jl|jobListingId)[-_=]?([0-9]+)' THEN
            v_match := regexp_match(v_url, '(?:/|-|_|\b)(?:jl|jobListingId)[-_=]?([0-9]+)', 'i');
            RETURN 'glassdoor:' || v_match[1];
        ELSIF (v_datos->>'jl') ~ '^[0-9]+$' THEN
            RETURN 'glassdoor:' || (v_datos->>'jl');
        ELSIF (v_datos->>'jobListingId') ~ '^[0-9]+$' THEN
            RETURN 'glassdoor:' || (v_datos->>'jobListingId');
        ELSIF (v_datos->>'id') ~ '^[0-9]+$' THEN
            RETURN 'glassdoor:' || (v_datos->>'id');
        END IF;
    END IF;

    -- 7. Plataformas con ID en datos_crudos
    IF (v_datos->>'id') ~ '^[a-zA-Z0-9_-]+$' THEN
        RETURN v_plat || ':' || (v_datos->>'id');
    END IF;

    -- 8. Fallback por URL canonizada
    IF v_url != '' THEN
        -- Comprobar si la URL tiene protocolo http/https válido
        IF v_url !~* '^https?://' THEN
            v_identidad := v_plat || ':raw:' || v_url;
            IF LENGTH(v_identidad) > 500 THEN
                RETURN v_plat || ':raw-hash:' || md5(v_url);
            ELSE
                RETURN v_identidad;
            END IF;
        END IF;

        v_url_canonica := fn_canonizar_url_023(v_url, v_plat);
        v_identidad := v_plat || ':url:' || v_url_canonica;

        -- Umbral idéntico a JS (500 caracteres para la identidad resultante)
        IF LENGTH(v_identidad) > 500 THEN
            RETURN v_plat || ':url-hash:' || md5(v_url_canonica);
        ELSE
            RETURN v_identidad;
        END IF;
    END IF;

    -- 9. Fallback defensivo por ID de fila
    RETURN v_plat || ':id:' || p_id;
END;
$$;

-- 2. Reparación atómica de identidades canónicas divergentes
WITH base_calculada AS (
    SELECT id,
           fn_obtener_identidad_canonica_023(url, plataforma, datos_crudos, id) AS identidad_calc
    FROM ofertas
),
resolucion AS (
    SELECT id,
           CASE
               WHEN ROW_NUMBER() OVER (PARTITION BY identidad_calc ORDER BY id ASC) > 1
               THEN identidad_calc || ':colision-historica-' || id
               ELSE identidad_calc
           END AS identidad_final
    FROM base_calculada
)
UPDATE ofertas o
SET identidad_canonica = r.identidad_final
FROM resolucion r
WHERE o.id = r.id AND (o.identidad_canonica IS NULL OR o.identidad_canonica != r.identidad_final);
