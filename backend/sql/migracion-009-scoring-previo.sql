-- Migración 009: Agregar columnas de scoring previo a ofertas.
--
-- ¿Para qué?
-- En vez de que DeepSeek decida todo, el backend calcula un score_previo
-- usando reglas determinísticas (tecnologías detectadas, niveles del perfil,
-- penalizaciones y bonificaciones). DeepSeek solo refina (±15 puntos).
-- Esto reduce tokens, es testeable y más predecible.
--
-- Ejecutar una sola vez con:
--   sudo -u postgres psql -d busca_empleos -f backend/sql/migracion-009-scoring-previo.sql

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS score_previo INTEGER;

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS analisis_previo JSONB;

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(50) DEFAULT 'p3_p5_v1';

CREATE INDEX IF NOT EXISTS idx_ofertas_score_previo
    ON ofertas (score_previo DESC NULLS LAST);
