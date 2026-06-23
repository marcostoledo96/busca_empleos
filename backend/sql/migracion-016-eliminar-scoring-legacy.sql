-- Migración 016: Eliminar objetos legacy de scoring previo.
--
-- ¿Para qué?
-- El sistema de scoring previo fue deprecado en B1 (DeepSeek + reglas-exclusion
-- son el único flujo de evaluación). Las columnas score_previo, analisis_previo,
-- scoring_version y scoring_config quedaron como esquema muerto que confunde
-- el modelo de datos y ocupa espacio innecesario.
--
-- ⚠️ ADVERTENCIA DE DESTRUCCIÓN DE DATOS LEGACY
-- Esta migración elimina FÍSICAMENTE columnas e índice. Los datos contenidos
-- en score_previo, analisis_previo, scoring_version y scoring_config se pierden
-- de forma irreversible después de ejecutar este script.
-- ROLLBACK: No hay rollback automático. Restaurar requiere backup previo,
-- recreación manual de columnas/constraint/índice o una migración compensatoria.
--
-- Ejecutar con:
--   sudo -u postgres psql -d busca_empleos -f backend/sql/migracion-016-eliminar-scoring-legacy.sql

-- 1. Eliminar índice legacy
DROP INDEX IF EXISTS idx_ofertas_score_previo;

-- 2. Eliminar constraint legacy
ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_score_previo;

-- 3. Eliminar columnas legacy de ofertas
ALTER TABLE ofertas DROP COLUMN IF EXISTS score_previo;
ALTER TABLE ofertas DROP COLUMN IF EXISTS analisis_previo;
ALTER TABLE ofertas DROP COLUMN IF EXISTS scoring_version;

-- 4. Eliminar columna legacy de preferencias
ALTER TABLE preferencias DROP COLUMN IF EXISTS scoring_config;