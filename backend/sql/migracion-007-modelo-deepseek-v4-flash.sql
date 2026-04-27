-- Migración 007: Actualizar el modelo por defecto de DeepSeek a V4 Flash.
--
-- Ejecutar una sola vez sobre una BD existente con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-007-modelo-deepseek-v4-flash.sql
--
-- ¿Por qué hace falta esta migración?
-- Cambiar el default en el código no alcanza si la fila de preferencias ya existe.
-- Esta migración alinea el schema y el dato persistido para que el sistema use
-- `deepseek-v4-flash` como modelo real por defecto.

ALTER TABLE preferencias
    ALTER COLUMN modelo_ia SET DEFAULT 'deepseek-v4-flash';

UPDATE preferencias
SET modelo_ia = 'deepseek-v4-flash'
WHERE id = 1
  AND modelo_ia IN ('deepseek-chat', 'deepseek-reasoner');
