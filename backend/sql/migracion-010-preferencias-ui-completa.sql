-- Migración 010: Completar preferencias con campos para UI completa.
--
-- Agrega 14 campos nuevos para soportar la nueva página de preferencias
-- con pestañas: Perfil, Tecnologías, Roles, Scoring, Búsqueda, IA, Importar CV.
--
-- Ejecutar una sola vez con:
--   sudo -u postgres psql -d busca_empleos -f backend/sql/migracion-010-preferencias-ui-completa.sql

ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS modelo_ia_evaluacion VARCHAR(100) DEFAULT 'deepseek-v4-flash';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS modelo_ia_importacion VARCHAR(100) DEFAULT 'deepseek-v4-pro';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS disponibilidad VARCHAR(50) DEFAULT 'full_time';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS expectativa_salarial_min NUMERIC DEFAULT NULL;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS expectativa_salarial_max NUMERIC DEFAULT NULL;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS moneda_salarial VARCHAR(10) DEFAULT 'NO_FILTRAR';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS nivel_ingles_detalle JSONB NOT NULL DEFAULT '{
    "espanol": "nativo",
    "reading": "A2",
    "writing": "A2_basico",
    "speaking": "A1",
    "listening": "A1",
    "regla": "Aceptar lectura tecnica e ingles deseable. Penalizar ingles conversacional, fluido, avanzado, bilingue o reuniones en ingles."
}'::jsonb;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS keywords_positivas TEXT[] DEFAULT '{}';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS keywords_negativas TEXT[] DEFAULT '{}';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS plataformas_preferidas TEXT[] DEFAULT '{}';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS plataformas_excluidas TEXT[] DEFAULT '{}';
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS max_caracteres_descripcion_ia INTEGER DEFAULT 2500;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS temperatura_evaluacion NUMERIC DEFAULT 0;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS temperatura_importacion NUMERIC DEFAULT 0;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS backup_preferencias JSONB DEFAULT NULL;

-- Backfill: inicializar campos nuevos con defaults donde aplique.
UPDATE preferencias
SET
    modelo_ia_evaluacion = COALESCE(modelo_ia_evaluacion, modelo_ia, 'deepseek-v4-flash'),
    modelo_ia_importacion = COALESCE(modelo_ia_importacion, 'deepseek-v4-pro'),
    disponibilidad = COALESCE(disponibilidad, 'full_time'),
    moneda_salarial = COALESCE(moneda_salarial, 'NO_FILTRAR'),
    max_caracteres_descripcion_ia = COALESCE(max_caracteres_descripcion_ia, 2500),
    temperatura_evaluacion = COALESCE(temperatura_evaluacion, 0),
    temperatura_importacion = COALESCE(temperatura_importacion, 0)
WHERE id = 1;
