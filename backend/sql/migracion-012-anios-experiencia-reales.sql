-- Migración 012: agregar años reales de experiencia al perfil.
--
-- ¿Para qué?
-- Marcos quiere declarar cuántos años reales de experiencia tiene
-- (actualmente ~1 año) para que el scoring penalice ofertas que pidan más.
--
-- Ejecutar con:
--   psql "TU_URL_RAILWAY" -f backend/sql/migracion-012-anios-experiencia-reales.sql

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS anios_experiencia_reales INTEGER DEFAULT 1;

UPDATE preferencias
SET anios_experiencia_reales = COALESCE(anios_experiencia_reales, 1)
WHERE id = 1;
