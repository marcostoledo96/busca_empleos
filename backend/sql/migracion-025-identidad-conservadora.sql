-- Corrijo instalaciones que ya registraron 023/024: el runner no las vuelve a ejecutar.
-- Conservo las funciones legacy para portales fuera del alcance de esta reparación.
DO $$ BEGIN
    IF to_regprocedure('fn_canonizar_url_legacy_023(text,text)') IS NULL THEN
        ALTER FUNCTION fn_canonizar_url_023(text,text) RENAME TO fn_canonizar_url_legacy_023;
    END IF;
    IF to_regprocedure('fn_obtener_identidad_legacy_023(text,text,jsonb,integer)') IS NULL THEN
        ALTER FUNCTION fn_obtener_identidad_canonica_023(text,text,jsonb,integer) RENAME TO fn_obtener_identidad_legacy_023;
    END IF;
END $$;

-- Valido la primera ocurrencia de cada clave decodificada, como URLSearchParams.get().
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
    v_plat text := lower(trim(p_plataforma));
    v_url text := trim(p_url);
    v_base text;
    v_id text;
    v_par text;
    v_clave text;
    v_items text[] := ARRAY[]::text[];
    v_query text;
BEGIN
    IF v_plat NOT IN ('indeed', 'linkedin') THEN RETURN fn_canonizar_url_legacy_023(p_url, p_plataforma); END IF;
    IF v_url !~* '^https?://' THEN RETURN v_url; END IF;
    v_id := fn_id_nativo_023(v_url, v_plat, '{}'::jsonb);
    IF v_id IS NOT NULL THEN
        IF v_plat = 'linkedin' THEN RETURN 'https://www.linkedin.com/jobs/view/' || v_id; END IF;
        v_base := fn_canonizar_url_legacy_023(substring(v_url FROM '^([a-zA-Z]+://[^/?#]+)'), 'general');
        RETURN rtrim(v_base, '/') || '/viewjob?jk=' || v_id;
    END IF;
    -- Sin ID no dejo que los regex legacy rescaten una clave inválida o de otro nombre.
    v_base := fn_canonizar_url_legacy_023(split_part(split_part(v_url, '#', 1), '?', 1), 'general');
    FOREACH v_par IN ARRAY string_to_array(COALESCE(substring(split_part(v_url, '#', 1) FROM '^[^?]*\?(.*)$'), ''), '&') LOOP
        v_clave := lower(fn_url_decode_023(split_part(v_par, '=', 1)));
        IF (v_plat = 'indeed' AND v_clave IN ('from', 'vjs', 'tk', 'advn', 'adloc', 'qd', 'subts', 'iaf', 'attributionid', 'mobview'))
           OR (v_plat = 'linkedin' AND v_clave IN ('refid', 'trackingid', 'trk', 'midtoken', 'originalsubdomain', 'trkinfo')) THEN CONTINUE; END IF;
        v_items := array_append(v_items, v_par);
    END LOOP;
    v_query := array_to_string(v_items, '&');
    RETURN fn_canonizar_url_legacy_023(v_base || CASE WHEN v_query != '' THEN '?' || v_query ELSE '' END, 'general');
END $$;

CREATE OR REPLACE FUNCTION fn_obtener_identidad_canonica_023(p_url text, p_plataforma text, p_datos_crudos jsonb, p_id integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_plat text := lower(trim(p_plataforma));
    v_id text;
    v_identidad text;
    v_url text;
BEGIN
    IF v_plat NOT IN ('indeed', 'linkedin') THEN RETURN fn_obtener_identidad_legacy_023(p_url, p_plataforma, p_datos_crudos, p_id); END IF;
    v_id := fn_id_nativo_023(p_url, v_plat, p_datos_crudos);
    IF v_id IS NOT NULL THEN RETURN v_plat || ':' || v_id; END IF;
    v_url := fn_canonizar_url_023(p_url, p_plataforma);
    v_identidad := v_plat || ':url:' || v_url;
    RETURN CASE WHEN length(v_identidad) > 500 THEN v_plat || ':url-hash:' || md5(v_url) ELSE v_identidad END;
END $$;

-- Una identidad nativa ya asignada no es evidencia de que otro ID sea el mismo aviso.
CREATE OR REPLACE FUNCTION fn_identidad_historica_023(p_existente text, p_url text, p_plataforma text, p_crudos jsonb, p_id integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN (p_plataforma = 'indeed' AND p_existente ~ '^indeed:[a-z0-9]+$')
                     OR (p_plataforma = 'linkedin' AND p_existente ~ '^linkedin:[0-9]{8,16}$')
                THEN p_existente
                ELSE fn_obtener_identidad_canonica_023(p_url, p_plataforma, p_crudos, p_id) END;
$$;

-- Serializo la reconciliación. No fusiono ni elimino filas, ni toco contenido/fechas/estados.
DO $$
DECLARE
    v_fila record;
    v_url text;
    v_base text;
    v_sufijo integer;
BEGIN
    LOCK TABLE ofertas IN SHARE ROW EXCLUSIVE MODE;
    CREATE TEMP TABLE tmp_identidad_025 ON COMMIT DROP AS
    WITH calculada AS (
        SELECT id, identidad_canonica,
               fn_identidad_historica_023(identidad_canonica, url, plataforma, datos_crudos, id) AS identidad
        FROM ofertas
        WHERE plataforma IN ('indeed', 'linkedin')
    )
    SELECT id, CASE WHEN row_number() OVER (PARTITION BY identidad ORDER BY (identidad_canonica = identidad) DESC NULLS LAST, id) > 1
                    THEN identidad || ':colision-historica-' || id ELSE identidad END AS identidad
    FROM calculada;
    -- Dos fases para no depender del orden bajo el índice UNIQUE no diferible.
    UPDATE ofertas o SET identidad_canonica = ':temp-025-' || o.id || '-' || md5(random()::text)
    FROM tmp_identidad_025 t WHERE o.id = t.id AND o.identidad_canonica IS DISTINCT FROM t.identidad;
    UPDATE ofertas o SET identidad_canonica = t.identidad
    FROM tmp_identidad_025 t WHERE o.id = t.id AND o.identidad_canonica IS DISTINCT FROM t.identidad;
    -- Planifico todas las URLs antes de liberar claves: también admito ciclos A↔B.
    CREATE TEMP TABLE tmp_urls_025 (id integer PRIMARY KEY, url text) ON COMMIT DROP;
    INSERT INTO tmp_urls_025 (id)
    SELECT id FROM ofertas WHERE plataforma IN ('indeed', 'linkedin')
        AND identidad_canonica ~ '^(indeed:[a-z0-9]+|linkedin:[0-9]{8,16})$';
    FOR v_fila IN SELECT o.* FROM ofertas o JOIN tmp_urls_025 t USING (id) ORDER BY id LOOP
        IF v_fila.plataforma = 'indeed' THEN
            v_base := fn_canonizar_url_023(substring(v_fila.url FROM '^([a-zA-Z]+://[^/?#]+)'), 'general');
            IF v_base IS NULL OR v_base !~* '^https?://[^/?#[:space:]]+/?$' THEN
                RAISE EXCEPTION 'No puedo reconciliar una URL nativa inválida o extensa (oferta %).', v_fila.id;
            END IF;
            v_url := rtrim(v_base, '/') || '/viewjob?jk=' || split_part(v_fila.identidad_canonica, ':', 2);
        ELSE
            v_url := 'https://www.linkedin.com/jobs/view/' || split_part(v_fila.identidad_canonica, ':', 2);
        END IF;
        IF v_url IS NULL OR length(v_url) > 2000 THEN
            RAISE EXCEPTION 'No puedo reconciliar una URL nativa inválida o extensa (oferta %).', v_fila.id;
        END IF;
        v_base := v_url;
        v_sufijo := 0;
        WHILE EXISTS (SELECT 1 FROM ofertas o WHERE o.url = v_url AND o.id != v_fila.id
                      AND NOT EXISTS (SELECT 1 FROM tmp_urls_025 t WHERE t.id = o.id))
              OR EXISTS (SELECT 1 FROM tmp_urls_025 t WHERE t.url = v_url AND t.id != v_fila.id) LOOP
            v_sufijo := v_sufijo + 1;
            v_url := v_base || '#identidad-historica-' || v_fila.id || '-' || v_sufijo;
        END LOOP;
        UPDATE tmp_urls_025 SET url = v_url WHERE id = v_fila.id;
    END LOOP;
    UPDATE ofertas o SET url = 'https://identidad.invalid/' || o.id || '-' || md5(random()::text)
    FROM tmp_urls_025 t WHERE o.id = t.id AND o.url IS DISTINCT FROM t.url;
    UPDATE ofertas o SET url = t.url
    FROM tmp_urls_025 t WHERE o.id = t.id AND o.url IS DISTINCT FROM t.url;
    DROP TABLE tmp_urls_025;
    DROP TABLE tmp_identidad_025;
END $$;
