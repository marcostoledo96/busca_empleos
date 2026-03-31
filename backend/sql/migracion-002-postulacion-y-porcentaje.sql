-- Migración 002: Agregar columnas porcentaje_match y estado_postulacion.
--
-- Ejecutar una sola vez sobre una BD existente con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-002-postulacion-y-porcentaje.sql
--
-- Si las columnas ya existen, no falla (IF NOT EXISTS no existe para ALTER TABLE ADD COLUMN
-- en todas las versiones, así que uso DO $$ para manejar errores).

DO $$
BEGIN
    -- Porcentaje de compatibilidad que asigna DeepSeek (0–100).
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ofertas' AND column_name = 'porcentaje_match'
    ) THEN
        ALTER TABLE ofertas ADD COLUMN porcentaje_match INTEGER;
    END IF;

    -- Estado de postulación del usuario.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ofertas' AND column_name = 'estado_postulacion'
    ) THEN
        ALTER TABLE ofertas ADD COLUMN estado_postulacion VARCHAR(30) DEFAULT 'no_postulado';
    END IF;
END $$;

-- Índices nuevos.
CREATE INDEX IF NOT EXISTS idx_ofertas_estado_postulacion
    ON ofertas (estado_postulacion);

CREATE INDEX IF NOT EXISTS idx_ofertas_porcentaje_match
    ON ofertas (porcentaje_match DESC NULLS LAST);
