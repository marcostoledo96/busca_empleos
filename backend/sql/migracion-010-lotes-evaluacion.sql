-- Migración 010: Crear tabla de lotes de evaluación.
--
-- ¿Para qué?
-- El progreso de evaluación actual vive en una variable let en memoria.
-- Si el servidor se reinicia (deploy, crash, Railway scaling),
-- el frontend muestra 0% y pierde visibilidad de qué pasó.
-- Esta tabla persiste el estado del lote en BD para que sobreviva reinicios.
--
-- Ejecutar una sola vez con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-010-lotes-evaluacion.sql

CREATE TABLE IF NOT EXISTS evaluacion_lotes (
    id                  SERIAL      PRIMARY KEY,
    estado              VARCHAR(30) NOT NULL DEFAULT 'activo',
    total               INTEGER     NOT NULL DEFAULT 0,
    evaluadas           INTEGER     NOT NULL DEFAULT 0,
    aprobadas           INTEGER     NOT NULL DEFAULT 0,
    rechazadas          INTEGER     NOT NULL DEFAULT 0,
    errores             INTEGER     NOT NULL DEFAULT 0,
    porcentaje          INTEGER     NOT NULL DEFAULT 0,
    modelo_ia           VARCHAR(100),
    creado_en           TIMESTAMP   DEFAULT NOW(),
    actualizado_en      TIMESTAMP   DEFAULT NOW(),
    finalizado_en       TIMESTAMP
);
