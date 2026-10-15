-- Migración 022: soporte de matching explicable y descripción mutable.
-- Agregué columnas para persistir explicaciones estructuradas de evaluación
-- y rastrear origen, completitud y ediciones manuales de la descripción.

ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS explicacion_evaluacion JSONB;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS descripcion_original TEXT;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS origen_descripcion VARCHAR(50) DEFAULT 'scraper';
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS descripcion_completitud VARCHAR(50) DEFAULT 'desconocida';
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS descripcion_modificada_en TIMESTAMP(3);

-- Si la columna ya fue creada sin precision limitada, normalizo su tipo a TIMESTAMP(3)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ofertas' AND column_name = 'descripcion_modificada_en'
          AND (datetime_precision IS NULL OR datetime_precision > 3)
    ) THEN
        ALTER TABLE ofertas ALTER COLUMN descripcion_modificada_en TYPE TIMESTAMP(3);
    END IF;
END $$;

-- Backfill idempotente: ofertas existentes de Bumeran provienen de tarjeta con descripción parcial.
UPDATE ofertas
SET origen_descripcion = 'tarjeta',
    descripcion_completitud = 'parcial'
WHERE plataforma = 'bumeran'
  AND (origen_descripcion IS NULL OR origen_descripcion = 'scraper');
