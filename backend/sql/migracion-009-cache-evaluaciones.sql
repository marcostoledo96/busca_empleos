-- Migración 009: Crear tabla de cache de evaluaciones.
--
-- ¿Para qué?
-- Evitar re-evaluar la misma oferta varias veces (ej: si aparece en
-- LinkedIn y Computrabajo). El hash se calcula con SHA-256 del contenido
-- normalizado de la oferta + las preferencias del usuario.
-- Si cambian las preferencias, cambia el hash → no se reutilizan resultados viejos.
--
-- Ejecutar una sola vez con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-009-cache-evaluaciones.sql

CREATE TABLE IF NOT EXISTS evaluaciones_cache (
    id                  SERIAL      PRIMARY KEY,
    hash_oferta         TEXT        NOT NULL,
    hash_preferencias   TEXT        NOT NULL,
    modelo_ia           VARCHAR(100) NOT NULL,
    resultado           JSONB       NOT NULL,
    creado_en           TIMESTAMP   DEFAULT NOW(),
    UNIQUE (hash_oferta, hash_preferencias, modelo_ia)
);
