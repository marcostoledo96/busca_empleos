-- Migración 015: Índices para consultas de ofertas de los últimos 30 días
-- Fecha: 2026-06-22
-- Propósito: agregar índices que aceleren las queries de listado y estadísticas
-- que filtran por fecha_extraccion (ventana de 30 días) y estado_evaluacion.
--
-- Índices creados:
--   1. idx_ofertas_fecha_extraccion_desc: para ORDER BY fecha_extraccion DESC
--      (el orden por defecto del listado de ofertas).
--   2. idx_ofertas_estado_fecha_extraccion: para WHERE estado_evaluacion = $1
--      AND fecha_extraccion >= NOW() - INTERVAL '30 days'
--      (filtro combinado que usan obtenerOfertas y obtenerEstadisticas).
--
-- Uso CREATE INDEX IF NOT EXISTS para que la migración sea idempotente:
-- si se ejecuta más de una vez, no falla por índices existentes.
-- No uso CONCURRENTLY porque el runner de migraciones ejecuta dentro de
-- una transacción (BEGIN/COMMIT), y PostgreSQL no permite CREATE INDEX
-- CONCURRENTLY dentro de transacciones.
-- No uso DROP, DELETE ni TRUNCATE — esta migración no altera datos.

CREATE INDEX IF NOT EXISTS idx_ofertas_fecha_extraccion_desc
    ON ofertas (fecha_extraccion DESC);

CREATE INDEX IF NOT EXISTS idx_ofertas_estado_fecha_extraccion
    ON ofertas (estado_evaluacion, fecha_extraccion DESC);