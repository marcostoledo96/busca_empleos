-- Migración 008: Agregar columna evaluacion_error_mensaje a ofertas.
--
-- ¿Para qué?
-- Cuando DeepSeek falla (timeout, rate limit, error de red),
-- el backend intentaba guardar el error en razon_evaluacion,
-- pero ese campo es para la razón que da la IA, no para errores técnicos.
-- Esta columna separa errores de API de razones de evaluación.
--
-- Ejecutar una sola vez con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-008-error-evaluacion.sql

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS evaluacion_error_mensaje TEXT;
