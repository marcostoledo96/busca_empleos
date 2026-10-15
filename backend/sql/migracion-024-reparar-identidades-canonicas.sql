-- Migración 024: Reparación y sincronización de identidades canónicas históricas.
--
-- Propósito: Garantizar que bases de datos donde la migración 023 ya fue aplicada
-- previamente actualicen sus identidades canónicas históricas con la versión
-- definitiva de las funciones canónicas inmutables (minúsculas de host, descarte de puertos
-- por defecto, trailing slash de raíz, espacios con +, conservación de utmax, sin truncamiento
-- y paridad 1:1 estricta con URLSearchParams de WHATWG / Node.js).
--
-- Idempotente: Si las identidades ya son idénticas, no modifica ninguna fila.
-- Resuelve colisiones históricas conservadoramente en dos fases (evitando violaciones de
-- índice UNIQUE existente por orden de evaluación de filas) preservando siempre la fila más antigua.

-- 1. Funciones auxiliares inmutables para decodificación y codificación compatible con WHATWG URLSearchParams
CREATE OR REPLACE FUNCTION fn_url_decode_023(p_input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_len integer;
    v_i integer := 1;
    v_hex text;
    v_raw bytea := ''::bytea;
    v_res text := '';
    v_b integer;
    v_blen integer;
    v_char text;
    v_char_bytes bytea;
    v_seq_len integer := 0;
    v_valid boolean := false;
    v_sub bytea;
BEGIN
    IF p_input IS NULL THEN RETURN ''; END IF;
    v_len := length(p_input);
    WHILE v_i <= v_len LOOP
        IF substring(p_input from v_i for 1) = '%' AND v_i + 2 <= v_len AND substring(p_input from v_i + 1 for 2) ~ '^[0-9a-fA-F]{2}$' THEN
            v_hex := substring(p_input from v_i + 1 for 2);
            v_raw := v_raw || decode(v_hex, 'hex');
            v_i := v_i + 3;
        ELSIF substring(p_input from v_i for 1) = '+' THEN
            v_raw := v_raw || decode('20', 'hex');
            v_i := v_i + 1;
        ELSE
            v_char := substring(p_input from v_i for 1);
            v_char_bytes := convert_to(v_char, 'UTF8');
            v_raw := v_raw || v_char_bytes;
            v_i := v_i + 1;
        END IF;
    END LOOP;
    v_blen := octet_length(v_raw);
    v_i := 0;
    WHILE v_i < v_blen LOOP
        v_b := get_byte(v_raw, v_i);
        IF v_b = 0 THEN
            -- En PostgreSQL text no admite NUL (0x00); omito para comparación de clave sin abortar
            v_i := v_i + 1;
        ELSIF v_b < 128 THEN
            v_res := v_res || chr(v_b);
            v_i := v_i + 1;
        ELSE
            v_seq_len := 0;
            v_valid := false;
            IF (v_b & 224) = 192 AND v_b >= 194 THEN v_seq_len := 2;
            ELSIF (v_b & 240) = 224 THEN v_seq_len := 3;
            ELSIF (v_b & 248) = 240 AND v_b <= 244 THEN v_seq_len := 4;
            END IF;
            IF v_seq_len > 0 AND v_i + v_seq_len <= v_blen THEN
                v_sub := substring(v_raw from v_i + 1 for v_seq_len);
                BEGIN
                    v_res := v_res || convert_from(v_sub, 'UTF8');
                    v_valid := true;
                EXCEPTION WHEN OTHERS THEN
                    v_valid := false;
                END;
            END IF;
            IF v_valid THEN
                v_i := v_i + v_seq_len;
            ELSE
                v_res := v_res || chr(65533);
                v_i := v_i + 1;
            END IF;
        END IF;
    END LOOP;
    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION fn_url_encode_form_023(p_input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_len integer;
    v_i integer := 1;
    v_hex text;
    v_raw bytea := ''::bytea;
    v_res text := '';
    v_b integer;
    v_blen integer;
    v_char text;
    v_char_bytes bytea;
    v_seq_len integer := 0;
    v_valid boolean := false;
    v_sub bytea;
    v_k integer;
BEGIN
    IF p_input IS NULL THEN RETURN ''; END IF;
    v_len := length(p_input);
    WHILE v_i <= v_len LOOP
        IF substring(p_input from v_i for 1) = '%' AND v_i + 2 <= v_len AND substring(p_input from v_i + 1 for 2) ~ '^[0-9a-fA-F]{2}$' THEN
            v_hex := substring(p_input from v_i + 1 for 2);
            v_raw := v_raw || decode(v_hex, 'hex');
            v_i := v_i + 3;
        ELSIF substring(p_input from v_i for 1) = '+' THEN
            v_raw := v_raw || decode('20', 'hex');
            v_i := v_i + 1;
        ELSE
            v_char := substring(p_input from v_i for 1);
            v_char_bytes := convert_to(v_char, 'UTF8');
            v_raw := v_raw || v_char_bytes;
            v_i := v_i + 1;
        END IF;
    END LOOP;
    v_blen := octet_length(v_raw);
    v_i := 0;
    WHILE v_i < v_blen LOOP
        v_b := get_byte(v_raw, v_i);
        IF v_b = 32 THEN
            v_res := v_res || '+';
            v_i := v_i + 1;
        ELSIF (v_b >= 48 AND v_b <= 57)
           OR (v_b >= 65 AND v_b <= 90)
           OR (v_b >= 97 AND v_b <= 122)
           OR v_b = 42
           OR v_b = 45
           OR v_b = 46
           OR v_b = 95 THEN
            v_res := v_res || chr(v_b);
            v_i := v_i + 1;
        ELSIF v_b >= 128 THEN
            v_seq_len := 0;
            v_valid := false;
            IF (v_b & 224) = 192 AND v_b >= 194 THEN v_seq_len := 2;
            ELSIF (v_b & 240) = 224 THEN v_seq_len := 3;
            ELSIF (v_b & 248) = 240 AND v_b <= 244 THEN v_seq_len := 4;
            END IF;
            IF v_seq_len > 0 AND v_i + v_seq_len <= v_blen THEN
                v_sub := substring(v_raw from v_i + 1 for v_seq_len);
                BEGIN
                    PERFORM convert_from(v_sub, 'UTF8');
                    v_valid := true;
                EXCEPTION WHEN OTHERS THEN
                    v_valid := false;
                END;
            END IF;
            IF v_valid THEN
                FOR v_k IN 0 .. v_seq_len - 1 LOOP
                    v_res := v_res || '%' || LPAD(UPPER(to_hex(get_byte(v_sub, v_k))), 2, '0');
                END LOOP;
                v_i := v_i + v_seq_len;
            ELSE
                v_res := v_res || '%EF%BF%BD';
                v_i := v_i + 1;
            END IF;
        ELSE
            v_res := v_res || '%' || LPAD(UPPER(to_hex(v_b)), 2, '0');
            v_i := v_i + 1;
        END IF;
    END LOOP;
    RETURN v_res;
END;
$$;

-- Funciones auxiliares inmutables actualizadas (versión idéntica y compatible con runtime JS)
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
    v_clave_limpia text;
    v_plat text := LOWER(TRIM(COALESCE(p_plataforma, 'general')));
    v_pos_slash integer;
    v_pos_q integer;
    v_match text[];
    v_idx integer := 0;
    v_items text[] := ARRAY[]::text[];
    v_params_limpios text[] := ARRAY[]::text[];
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

    -- Formatos específicos por plataforma si hay ID nativo reconocible
    IF v_plat = 'indeed' THEN
        IF v_url ~* '[?&](jk|vjk)=([a-zA-Z0-9]+)' THEN
            v_match := regexp_match(v_url, '[?&](?:jk|vjk)=([a-zA-Z0-9]+)', 'i');
            RETURN v_proto || '://' || v_authority || '/viewjob?jk=' || LOWER(v_match[1]);
        ELSIF v_url ~* '/job/.*-([a-zA-Z0-9]{16})' THEN
            v_match := regexp_match(v_url, '/job/.*-([a-zA-Z0-9]{16})', 'i');
            RETURN v_proto || '://' || v_authority || '/viewjob?jk=' || LOWER(v_match[1]);
        END IF;
    END IF;

    IF v_plat = 'linkedin' THEN
        IF v_url ~* '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})' THEN
            v_match := regexp_match(v_url, '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})', 'i');
            RETURN 'https://www.linkedin.com/jobs/view/' || v_match[1];
        END IF;
    END IF;

    -- Normalizar path: si tiene longitud > 1 y termina en '/', quitar la barra final (idéntico a JS)
    IF LENGTH(v_path) > 1 AND RIGHT(v_path, 1) = '/' THEN
        v_path := LEFT(v_path, -1);
    END IF;

    -- Filtrar parámetros de tracking
    IF v_query != '' THEN
        FOREACH v_param IN ARRAY string_to_array(v_query, '&') LOOP
            IF v_param IS NOT NULL AND v_param != '' THEN
                v_idx := v_idx + 1;
                v_clave := split_part(v_param, '=', 1);
                IF position('=' in v_param) > 0 THEN
                    v_val := substring(v_param from position('=' in v_param) + 1);
                ELSE
                    v_val := '';
                END IF;

                -- Clave decodificada para comparación precisa de tracking y ordenamiento estable
                v_clave_limpia := fn_url_decode_023(v_clave);

                -- Parámetros de tracking universales (regex ^utm_ para no borrar utmax)
                IF v_clave_limpia ~* '^utm_'
                   OR LOWER(v_clave_limpia) IN ('fbclid', 'gclid', 'msclkid', 'dclid', 'mc_cid', 'mc_eid', 'igshid') THEN
                    CONTINUE;
                END IF;

                -- Parámetros de tracking específicos de plataforma
                IF v_plat = 'indeed' AND LOWER(v_clave_limpia) IN ('from', 'vjs', 'tk', 'advn', 'adloc', 'qd', 'subts', 'iaf', 'attributionid', 'mobview') THEN
                    CONTINUE;
                END IF;
                IF v_plat = 'linkedin' AND LOWER(v_clave_limpia) IN ('refid', 'trackingid', 'trk', 'midtoken', 'originalsubdomain', 'trkinfo') THEN
                    CONTINUE;
                END IF;
                IF v_plat = 'computrabajo' AND LOWER(v_clave_limpia) = 'id_origen' THEN
                    CONTINUE;
                END IF;

                -- Guardar clave decodificada para ordenamiento, ordinalidad para estabilidad de claves repetidas, y par serializado form-url-encoded
                v_items := array_append(v_items, v_clave_limpia || E'\x01' || LPAD(v_idx::text, 6, '0') || E'\x01' || fn_url_encode_form_023(v_clave) || '=' || fn_url_encode_form_023(v_val));
            END IF;
        END LOOP;
    END IF;

    -- Ordenar parámetros alfabéticamente por clave con ordenamiento binario C y estabilidad ordinal (idéntico a parseada.searchParams.sort() de JS)
    IF array_length(v_items, 1) > 0 THEN
        SELECT array_agg(split_part(x, E'\x01', 3) ORDER BY x COLLATE "C" ASC)
        INTO v_params_limpios
        FROM unnest(v_items) AS x;
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

    -- 1. Indeed: jk / vjk (URL o datos_crudos: jk, vjk, key, jobKey, id)
    IF v_plat = 'indeed' THEN
        IF v_url ~* '[?&](jk|vjk)=([a-zA-Z0-9]+)' THEN
            v_match := regexp_match(v_url, '[?&](?:jk|vjk)=([a-zA-Z0-9]+)', 'i');
            RETURN 'indeed:' || LOWER(v_match[1]);
        ELSIF v_url ~* '/job/.*-([a-zA-Z0-9]{16})' THEN
            v_match := regexp_match(v_url, '/job/.*-([a-zA-Z0-9]{16})', 'i');
            RETURN 'indeed:' || LOWER(v_match[1]);
        ELSIF (v_datos->>'jk') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'indeed:' || LOWER(v_datos->>'jk');
        ELSIF (v_datos->>'vjk') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'indeed:' || LOWER(v_datos->>'vjk');
        ELSIF (v_datos->>'key') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'indeed:' || LOWER(v_datos->>'key');
        ELSIF (v_datos->>'jobKey') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'indeed:' || LOWER(v_datos->>'jobKey');
        ELSIF (v_datos->>'id') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'indeed:' || LOWER(v_datos->>'id');
        END IF;
    END IF;

    -- 2. LinkedIn: jobId (URL o datos_crudos: jobId, currentJobId, id)
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
        ELSIF (v_datos->>'id') ~ '^[0-9]{8,16}$' THEN
            RETURN 'linkedin:' || (v_datos->>'id');
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

    -- 7. Plataformas agregadas autorizadas (Jooble, RemoteOK, Remotive, InfoJobs, Adzuna)
    IF v_plat IN ('jooble', 'remoteok', 'remotive', 'infojobs', 'adzuna') THEN
        IF (v_datos->>'id') ~ '^[a-zA-Z0-9_-]+$' THEN
            RETURN v_plat || ':' || (v_datos->>'id');
        ELSIF v_plat = 'jooble' AND v_url ~* '/desc/([a-zA-Z0-9_-]+)' THEN
            v_match := regexp_match(v_url, '/desc/([a-zA-Z0-9_-]+)', 'i');
            RETURN 'jooble:' || v_match[1];
        END IF;
    END IF;

    -- 8. Fallback por URL canonizada (aplica a General y fuentes no contempladas arriba)
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

-- 2. Reparación atómica de identidades canónicas divergentes en dos fases:
-- Fase 1: Despeja claves que cambiarán a identificadores únicos temporales para evitar
-- violaciones del índice UNIQUE existente en PostgreSQL sin importar el orden de fila.
-- Fase 2: Asigna las identidades definitivas resueltas.
DO $$
BEGIN
    CREATE TEMP TABLE tmp_migracion_024 ON COMMIT DROP AS
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
    SELECT r.id, r.identidad_final
    FROM resolucion r
    JOIN ofertas o ON o.id = r.id
    WHERE o.identidad_canonica IS NULL OR o.identidad_canonica != r.identidad_final;

    -- Fase 1: Asignar identificadores temporales únicos para liberar los valores actuales
    UPDATE ofertas o
    SET identidad_canonica = ':temp-024-' || o.id || '-' || md5(random()::text)
    FROM tmp_migracion_024 t
    WHERE o.id = t.id;

    -- Fase 2: Asignar las identidades canónicas finales
    UPDATE ofertas o
    SET identidad_canonica = t.identidad_final
    FROM tmp_migracion_024 t
    WHERE o.id = t.id;

    DROP TABLE IF EXISTS tmp_migracion_024;
END $$;
