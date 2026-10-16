CREATE TABLE IF NOT EXISTS ejecuciones_busqueda (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('individual', 'ciclo_manual', 'cron')),
    inicio TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    fin TIMESTAMPTZ,
    estado TEXT NOT NULL DEFAULT 'ejecutando',
    resumen JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS configuracion_cron (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    expresion_cron TEXT NOT NULL,
    zona_horaria TEXT NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
