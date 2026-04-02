-- Migración 005: Agregar columna fecha_evaluacion a la tabla ofertas.
--
-- Ejecutar una sola vez sobre una BD existente con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-005-fecha-evaluacion.sql
--
-- ¿Para qué sirve fecha_evaluacion?
-- Necesitamos saber CUÁNDO la IA evaluó una oferta para poder resetear
-- solo los matches recientes (ej: "resetear los del último día").
-- Hasta ahora solo existía fecha_extraccion (cuándo se extrajo la oferta),
-- que no es lo mismo que cuándo se evaluó.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ofertas' AND column_name = 'fecha_evaluacion'
    ) THEN
        ALTER TABLE ofertas ADD COLUMN fecha_evaluacion TIMESTAMP DEFAULT NULL;
    END IF;
END $$;

-- Backfill: las ofertas ya evaluadas reciben fecha_extraccion como fecha aproximada.
-- No es perfecta (la extracción y la evaluación pueden ser de distinto momento),
-- pero es la mejor aproximación disponible para datos históricos.
-- Las nuevas evaluaciones tendrán la fecha real de cuando la IA las procesó.
UPDATE ofertas
SET fecha_evaluacion = fecha_extraccion
WHERE estado_evaluacion IN ('aprobada', 'rechazada')
  AND fecha_evaluacion IS NULL;

-- Índice para hacer eficientes las queries de reseteo por rango de fechas.
-- Sin este índice, PostgreSQL escanea toda la tabla. Con él, va directo al rango.
CREATE INDEX IF NOT EXISTS idx_ofertas_fecha_evaluacion
    ON ofertas (fecha_evaluacion DESC NULLS LAST);
