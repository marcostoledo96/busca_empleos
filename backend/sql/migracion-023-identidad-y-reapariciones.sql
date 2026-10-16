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

-- 3. Funciones auxiliares inmutables para decodificación y codificación compatible con WHATWG URLSearchParams
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
    v_cb1 integer;
    v_cb2 integer;
    v_cb3 integer;
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
        ELSIF v_b >= 194 AND v_b <= 223 THEN
            -- Secuencia UTF-8 de 2 bytes (espera 1 byte de continuación 128..191)
            IF v_i + 1 < v_blen THEN
                v_cb1 := get_byte(v_raw, v_i + 1);
                IF v_cb1 >= 128 AND v_cb1 <= 191 THEN
                    v_sub := substring(v_raw from v_i + 1 for 2);
                    v_res := v_res || convert_from(v_sub, 'UTF8');
                    v_i := v_i + 2;
                ELSE
                    -- cb1 inválido; subparte máxima = solo lead byte (1 byte)
                    v_res := v_res || chr(65533);
                    v_i := v_i + 1;
                END IF;
            ELSE
                -- Truncado / EOF; subparte máxima = solo lead byte (1 byte)
                v_res := v_res || chr(65533);
                v_i := v_i + 1;
            END IF;
        ELSIF v_b >= 224 AND v_b <= 239 THEN
            -- Secuencia UTF-8 de 3 bytes (espera 2 bytes de continuación)
            IF v_i + 1 < v_blen THEN
                v_cb1 := get_byte(v_raw, v_i + 1);
                IF (v_b = 224 AND v_cb1 >= 160 AND v_cb1 <= 191)
                   OR (v_b = 237 AND v_cb1 >= 128 AND v_cb1 <= 159)
                   OR (v_b != 224 AND v_b != 237 AND v_cb1 >= 128 AND v_cb1 <= 191) THEN
                    IF v_i + 2 < v_blen THEN
                        v_cb2 := get_byte(v_raw, v_i + 2);
                        IF v_cb2 >= 128 AND v_cb2 <= 191 THEN
                            v_sub := substring(v_raw from v_i + 1 for 3);
                            v_res := v_res || convert_from(v_sub, 'UTF8');
                            v_i := v_i + 3;
                        ELSE
                            -- cb2 inválido; subparte máxima = lead byte + cb1 (2 bytes)
                            v_res := v_res || chr(65533);
                            v_i := v_i + 2;
                        END IF;
                    ELSE
                        -- Truncado en cb2 / EOF; subparte máxima = lead byte + cb1 (2 bytes)
                        v_res := v_res || chr(65533);
                        v_i := v_i + 2;
                    END IF;
                ELSE
                    -- cb1 inválido; subparte máxima = solo lead byte (1 byte)
                    v_res := v_res || chr(65533);
                    v_i := v_i + 1;
                END IF;
            ELSE
                -- Truncado en cb1 / EOF; subparte máxima = solo lead byte (1 byte)
                v_res := v_res || chr(65533);
                v_i := v_i + 1;
            END IF;
        ELSIF v_b >= 240 AND v_b <= 244 THEN
            -- Secuencia UTF-8 de 4 bytes (espera 3 bytes de continuación)
            IF v_i + 1 < v_blen THEN
                v_cb1 := get_byte(v_raw, v_i + 1);
                IF (v_b = 240 AND v_cb1 >= 144 AND v_cb1 <= 191)
                   OR (v_b = 244 AND v_cb1 >= 128 AND v_cb1 <= 143)
                   OR (v_b >= 241 AND v_b <= 243 AND v_cb1 >= 128 AND v_cb1 <= 191) THEN
                    IF v_i + 2 < v_blen THEN
                        v_cb2 := get_byte(v_raw, v_i + 2);
                        IF v_cb2 >= 128 AND v_cb2 <= 191 THEN
                            IF v_i + 3 < v_blen THEN
                                v_cb3 := get_byte(v_raw, v_i + 3);
                                IF v_cb3 >= 128 AND v_cb3 <= 191 THEN
                                    v_sub := substring(v_raw from v_i + 1 for 4);
                                    v_res := v_res || convert_from(v_sub, 'UTF8');
                                    v_i := v_i + 4;
                                ELSE
                                    -- cb3 inválido; subparte máxima = lead byte + cb1 + cb2 (3 bytes)
                                    v_res := v_res || chr(65533);
                                    v_i := v_i + 3;
                                END IF;
                            ELSE
                                -- Truncado en cb3 / EOF; subparte máxima = lead byte + cb1 + cb2 (3 bytes)
                                v_res := v_res || chr(65533);
                                v_i := v_i + 3;
                            END IF;
                        ELSE
                            -- cb2 inválido; subparte máxima = lead byte + cb1 (2 bytes)
                            v_res := v_res || chr(65533);
                            v_i := v_i + 2;
                        END IF;
                    ELSE
                        -- Truncado en cb2 / EOF; subparte máxima = lead byte + cb1 (2 bytes)
                        v_res := v_res || chr(65533);
                        v_i := v_i + 2;
                    END IF;
                ELSE
                    -- cb1 inválido; subparte máxima = solo lead byte (1 byte)
                    v_res := v_res || chr(65533);
                    v_i := v_i + 1;
                END IF;
            ELSE
                -- Truncado en cb1 / EOF; subparte máxima = solo lead byte (1 byte)
                v_res := v_res || chr(65533);
                v_i := v_i + 1;
            END IF;
        ELSE
            -- Byte inválido fuera del rango de lead bytes (ej. 128..193 o 245..255)
            v_res := v_res || chr(65533);
            v_i := v_i + 1;
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
    v_cb1 integer;
    v_cb2 integer;
    v_cb3 integer;
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
        ELSIF v_b < 128 THEN
            v_res := v_res || '%' || LPAD(UPPER(to_hex(v_b)), 2, '0');
            v_i := v_i + 1;
        ELSIF v_b >= 194 AND v_b <= 223 THEN
            -- Secuencia UTF-8 de 2 bytes
            IF v_i + 1 < v_blen THEN
                v_cb1 := get_byte(v_raw, v_i + 1);
                IF v_cb1 >= 128 AND v_cb1 <= 191 THEN
                    v_res := v_res || '%' || LPAD(UPPER(to_hex(v_b)), 2, '0')
                                   || '%' || LPAD(UPPER(to_hex(v_cb1)), 2, '0');
                    v_i := v_i + 2;
                ELSE
                    v_res := v_res || '%EF%BF%BD';
                    v_i := v_i + 1;
                END IF;
            ELSE
                v_res := v_res || '%EF%BF%BD';
                v_i := v_i + 1;
            END IF;
        ELSIF v_b >= 224 AND v_b <= 239 THEN
            -- Secuencia UTF-8 de 3 bytes
            IF v_i + 1 < v_blen THEN
                v_cb1 := get_byte(v_raw, v_i + 1);
                IF (v_b = 224 AND v_cb1 >= 160 AND v_cb1 <= 191)
                   OR (v_b = 237 AND v_cb1 >= 128 AND v_cb1 <= 159)
                   OR (v_b != 224 AND v_b != 237 AND v_cb1 >= 128 AND v_cb1 <= 191) THEN
                    IF v_i + 2 < v_blen THEN
                        v_cb2 := get_byte(v_raw, v_i + 2);
                        IF v_cb2 >= 128 AND v_cb2 <= 191 THEN
                            v_res := v_res || '%' || LPAD(UPPER(to_hex(v_b)), 2, '0')
                                           || '%' || LPAD(UPPER(to_hex(v_cb1)), 2, '0')
                                           || '%' || LPAD(UPPER(to_hex(v_cb2)), 2, '0');
                            v_i := v_i + 3;
                        ELSE
                            v_res := v_res || '%EF%BF%BD';
                            v_i := v_i + 2;
                        END IF;
                    ELSE
                        v_res := v_res || '%EF%BF%BD';
                        v_i := v_i + 2;
                    END IF;
                ELSE
                    v_res := v_res || '%EF%BF%BD';
                    v_i := v_i + 1;
                END IF;
            ELSE
                v_res := v_res || '%EF%BF%BD';
                v_i := v_i + 1;
            END IF;
        ELSIF v_b >= 240 AND v_b <= 244 THEN
            -- Secuencia UTF-8 de 4 bytes
            IF v_i + 1 < v_blen THEN
                v_cb1 := get_byte(v_raw, v_i + 1);
                IF (v_b = 240 AND v_cb1 >= 144 AND v_cb1 <= 191)
                   OR (v_b = 244 AND v_cb1 >= 128 AND v_cb1 <= 143)
                   OR (v_b >= 241 AND v_b <= 243 AND v_cb1 >= 128 AND v_cb1 <= 191) THEN
                    IF v_i + 2 < v_blen THEN
                        v_cb2 := get_byte(v_raw, v_i + 2);
                        IF v_cb2 >= 128 AND v_cb2 <= 191 THEN
                            IF v_i + 3 < v_blen THEN
                                v_cb3 := get_byte(v_raw, v_i + 3);
                                IF v_cb3 >= 128 AND v_cb3 <= 191 THEN
                                    v_res := v_res || '%' || LPAD(UPPER(to_hex(v_b)), 2, '0')
                                                   || '%' || LPAD(UPPER(to_hex(v_cb1)), 2, '0')
                                                   || '%' || LPAD(UPPER(to_hex(v_cb2)), 2, '0')
                                                   || '%' || LPAD(UPPER(to_hex(v_cb3)), 2, '0');
                                    v_i := v_i + 4;
                                ELSE
                                    v_res := v_res || '%EF%BF%BD';
                                    v_i := v_i + 3;
                                END IF;
                            ELSE
                                v_res := v_res || '%EF%BF%BD';
                                v_i := v_i + 3;
                            END IF;
                        ELSE
                            v_res := v_res || '%EF%BF%BD';
                            v_i := v_i + 2;
                        END IF;
                    ELSE
                        v_res := v_res || '%EF%BF%BD';
                        v_i := v_i + 2;
                    END IF;
                ELSE
                    v_res := v_res || '%EF%BF%BD';
                    v_i := v_i + 1;
                END IF;
            ELSE
                v_res := v_res || '%EF%BF%BD';
                v_i := v_i + 1;
            END IF;
        ELSE
            -- Byte inválido fuera del rango de lead bytes (ej. 128..193 o 245..255)
            v_res := v_res || '%EF%BF%BD';
            v_i := v_i + 1;
        END IF;
    END LOOP;
    RETURN v_res;
END;
$$;

-- Funciones auxiliares inmutables para canonización y cálculo de identidad idéntica a JavaScript
-- Valido cada alternativa decodificada; con claves repetidas uso sólo la primera ocurrencia.
CREATE OR REPLACE FUNCTION fn_parametro_id_023(p_url text, p_claves text[], p_patron text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_clave text;
    v_par text;
    v_valor text;
    v_query text := COALESCE(substring(split_part(p_url, '#', 1) FROM '^[^?]*\?(.*)$'), '');
BEGIN
    FOREACH v_clave IN ARRAY p_claves LOOP
        FOREACH v_par IN ARRAY string_to_array(v_query, '&') LOOP
            IF split_part(v_par, '=', 1) !~* '%00'
               AND fn_url_decode_023(split_part(v_par, '=', 1)) = v_clave THEN
                v_valor := substring(v_par FROM position('=' in v_par) + 1);
                IF position('=' in v_par) > 0 AND v_valor !~* '%00'
                   AND fn_url_decode_023(v_valor) ~ p_patron THEN
                    RETURN fn_url_decode_023(v_valor);
                END IF;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION fn_id_nativo_023(p_url text, p_plataforma text, p_crudos jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_path text := regexp_replace(split_part(split_part(COALESCE(p_url, ''), '?', 1), '#', 1), '^https?://[^/]*', '', 'i');
    v_id text;
    v_clave text;
    v_patron text;
    v_claves text[];
BEGIN
    IF p_plataforma = 'indeed' THEN
        v_patron := '^[a-zA-Z0-9]+$';
        v_claves := ARRAY['jk', 'vjk', 'key', 'jobKey', 'id'];
        v_id := fn_parametro_id_023(p_url, ARRAY['jk', 'vjk'], v_patron);
        IF v_id IS NULL THEN v_id := (regexp_match(v_path, '/job/.*-([a-zA-Z0-9]{16})(?:/|$)', 'i'))[1]; END IF;
    ELSE
        v_patron := '^[0-9]{8,16}$';
        v_claves := ARRAY['jobId', 'currentJobId', 'id'];
        v_id := (regexp_match(v_path, '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})(?:/|$)', 'i'))[1];
        IF v_id IS NULL THEN v_id := fn_parametro_id_023(p_url, ARRAY['currentJobId', 'jobId'], v_patron); END IF;
    END IF;
    IF v_id IS NULL THEN
        FOREACH v_clave IN ARRAY v_claves LOOP
            IF (p_crudos->>v_clave) ~ v_patron THEN v_id := p_crudos->>v_clave; EXIT; END IF;
        END LOOP;
    END IF;
    RETURN CASE WHEN p_plataforma = 'indeed' THEN lower(v_id) ELSE v_id END;
END $$;

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

    -- Uso el mismo selector que el backfill y la identidad en runtime.
    IF v_plat IN ('indeed', 'linkedin') THEN
        v_val := fn_id_nativo_023(v_url, v_plat, '{}'::jsonb);
        IF v_val IS NOT NULL THEN
            IF v_plat = 'linkedin' THEN RETURN 'https://www.linkedin.com/jobs/view/' || v_val; END IF;
            RETURN v_proto || '://' || v_authority || '/viewjob?jk=' || v_val;
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

    IF v_plat IN ('indeed', 'linkedin') THEN
        v_identidad := fn_id_nativo_023(v_url, v_plat, v_datos);
        IF v_identidad IS NOT NULL THEN RETURN v_plat || ':' || v_identidad; END IF;
        v_url_canonica := fn_canonizar_url_023(v_url, v_plat);
        v_identidad := v_plat || ':url:' || v_url_canonica;
        RETURN CASE WHEN length(v_identidad) > 500 THEN v_plat || ':url-hash:' || md5(v_url_canonica) ELSE v_identidad END;
    END IF;

    -- 1. Indeed: jk / vjk (URL o datos_crudos: jk, vjk, key, jobKey, id)
    IF v_plat = 'indeed' THEN
        IF v_url ~* '[?&]jk=([a-zA-Z0-9]+)(?:[&#]|$)' THEN
            v_match := regexp_match(v_url, '[?&]jk=([a-zA-Z0-9]+)(?:[&#]|$)', 'i');
            RETURN 'indeed:' || LOWER(v_match[1]);
        ELSIF v_url ~* '[?&]vjk=([a-zA-Z0-9]+)(?:[&#]|$)' THEN
            v_match := regexp_match(v_url, '[?&]vjk=([a-zA-Z0-9]+)(?:[&#]|$)', 'i');
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
        ELSIF v_url ~* '/job/.*-([a-zA-Z0-9]{16})(?:[/?#]|$)' THEN
            v_match := regexp_match(v_url, '/job/.*-([a-zA-Z0-9]{16})(?:[/?#]|$)', 'i');
            RETURN 'indeed:' || LOWER(v_match[1]);
        END IF;
    END IF;

    -- 2. LinkedIn: jobId (URL o datos_crudos: jobId, currentJobId, id)
    IF v_plat = 'linkedin' THEN
        IF v_url ~* '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})(?:[/?#]|$)' THEN
            v_match := regexp_match(v_url, '/jobs/view/(?:[a-zA-Z0-9_%-]+-)?([0-9]{8,16})(?:[/?#]|$)', 'i');
            RETURN 'linkedin:' || v_match[1];
        ELSIF v_url ~* '[?&]currentJobId=([0-9]{8,16})(?:[&#]|$)' THEN
            v_match := regexp_match(v_url, '[?&]currentJobId=([0-9]{8,16})(?:[&#]|$)', 'i');
            RETURN 'linkedin:' || v_match[1];
        ELSIF v_url ~* '[?&]jobId=([0-9]{8,16})(?:[&#]|$)' THEN
            v_match := regexp_match(v_url, '[?&]jobId=([0-9]{8,16})(?:[&#]|$)', 'i');
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
        IF v_url ~* '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)(?:[/?#]|$)'
           AND (regexp_match(v_url, '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)(?:[/?#]|$)', 'i'))[1] != 'jobs' THEN
            v_match := regexp_match(v_url, '/jobs/(?:[a-zA-Z0-9_-]+/)?([a-zA-Z0-9_-]+)(?:[/?#]|$)', 'i');
            RETURN 'getonbrd:' || v_match[1];
        ELSIF (v_datos->>'id') ~ '^[a-zA-Z0-9_-]+$' THEN
            RETURN 'getonbrd:' || (v_datos->>'id');
        END IF;
    END IF;

    -- 4. Computrabajo
    IF v_plat = 'computrabajo' THEN
        IF (v_datos->>'id') ~ '^[a-zA-Z0-9]+$' THEN
            RETURN 'computrabajo:' || (v_datos->>'id');
        ELSIF v_url ~* '(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})(?:[/?#]|$)' THEN
            v_match := regexp_match(v_url, '(?:ofertas?-de-trabajo-[a-zA-Z0-9]*?-|oferta-de-trabajo-)([a-fA-F0-9]{24,40}|[a-zA-Z0-9]{24,40})(?:[/?#]|$)', 'i');
            RETURN 'computrabajo:' || v_match[1];
        END IF;
    END IF;

    -- 5. Bumeran
    IF v_plat = 'bumeran' THEN
        IF v_url ~* '-([0-9]+)\.html(?:[/?#]|$)' THEN
            v_match := regexp_match(v_url, '-([0-9]+)\.html(?:[/?#]|$)', 'i');
            RETURN 'bumeran:' || v_match[1];
        ELSIF (v_datos->>'id') ~ '^[0-9]+$' THEN
            RETURN 'bumeran:' || (v_datos->>'id');
        END IF;
    END IF;

    -- 6. Glassdoor
    IF v_plat = 'glassdoor' THEN
        IF v_url ~* '[?&](?:jl|jobListingId)=([0-9]+)(?:[&#]|$)' THEN
            v_match := regexp_match(v_url, '[?&](?:jl|jobListingId)=([0-9]+)(?:[&#]|$)', 'i');
            RETURN 'glassdoor:' || v_match[1];
        ELSIF v_url ~* '(?:/|-|_|\b)(?:jl|jobListingId)[-_=]?([0-9]+)(?:[/?#]|$)' THEN
            v_match := regexp_match(v_url, '(?:/|-|_|\b)(?:jl|jobListingId)[-_=]?([0-9]+)(?:[/?#]|$)', 'i');
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
        ELSIF v_plat = 'jooble' AND v_url ~* '/desc/([a-zA-Z0-9_-]+)(?:[/?#]|$)' THEN
            v_match := regexp_match(v_url, '/desc/([a-zA-Z0-9_-]+)(?:[/?#]|$)', 'i');
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

-- 4 y 5. Backfill de identidad_canonica para filas históricas con resolución conservadora de colisiones:
-- Ejecutado en dos fases para garantizar que no haya errores de clave duplicada incluso si
-- el índice único ya existe en la tabla y bajo cualquier orden de evaluación de PostgreSQL.
DO $$
BEGIN
    CREATE TEMP TABLE tmp_backfill_023 ON COMMIT DROP AS
    WITH base_calculada AS (
        SELECT id,
               COALESCE(identidad_canonica, fn_obtener_identidad_canonica_023(url, plataforma, datos_crudos, id)) AS identidad_calc
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
    SET identidad_canonica = ':temp-023-' || o.id || '-' || md5(random()::text)
    FROM tmp_backfill_023 t
    WHERE o.id = t.id;

    -- Fase 2: Asignar las identidades canónicas finales
    UPDATE ofertas o
    SET identidad_canonica = t.identidad_final
    FROM tmp_backfill_023 t
    WHERE o.id = t.id;

    DROP TABLE IF EXISTS tmp_backfill_023;
END $$;

-- 6. Creación de índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_identidad_canonica ON ofertas(identidad_canonica);
CREATE INDEX IF NOT EXISTS idx_ofertas_actividad_reciente ON ofertas(COALESCE(fecha_ultima_extraccion, fecha_extraccion));
