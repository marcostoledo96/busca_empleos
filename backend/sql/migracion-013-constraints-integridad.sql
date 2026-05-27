-- Migración 013: Constraints de integridad de datos
-- Fecha: 2026-05-27
-- Propósito: garantizar que los estados y porcentajes en la tabla 'ofertas'
-- solo puedan tener valores dentro de los dominios esperados por la aplicación.
-- Esto previene que scripts, migraciones manuales o bugs inserten datos inválidos.
-- NOTA: Antes de aplicar, limpia filas con valores inválidos si las hubiera.
-- Estas columnas no deben tener NULL en ofertas nuevas, pero permitimos NULL
-- para ofertas históricas que fueron insertadas antes de esta migración.

DO $$
BEGIN
    -- Constraint para estado_evaluacion
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_estado_evaluacion'
    ) THEN
        ALTER TABLE ofertas
        ADD CONSTRAINT chk_ofertas_estado_evaluacion
        CHECK (estado_evaluacion IS NULL OR estado_evaluacion IN ('pendiente', 'aprobada', 'rechazada'));
    END IF;

    -- Constraint para estado_postulacion
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_estado_postulacion'
    ) THEN
        ALTER TABLE ofertas
        ADD CONSTRAINT chk_ofertas_estado_postulacion
        CHECK (estado_postulacion IS NULL OR estado_postulacion IN ('no_postulado', 'cv_enviado', 'en_proceso', 'descartada'));
    END IF;

    -- Constraint para porcentaje_match (0-100)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_porcentaje_match'
    ) THEN
        ALTER TABLE ofertas
        ADD CONSTRAINT chk_ofertas_porcentaje_match
        CHECK (porcentaje_match IS NULL OR (porcentaje_match >= 0 AND porcentaje_match <= 100));
    END IF;

    -- Constraint para score_previo (0-100)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_score_previo'
    ) THEN
        ALTER TABLE ofertas
        ADD CONSTRAINT chk_ofertas_score_previo
        CHECK (score_previo IS NULL OR (score_previo >= 0 AND score_previo <= 100));
    END IF;
END
$$;
