-- Migración 018: prioridad IA explicable y preferencia de ranking.
-- Es aditiva e idempotente: no modifica match, porcentajes ni filas existentes.

ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS prioridad_ia BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS puntaje_prioridad_ia INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS evidencias_prioridad_ia JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS version_prioridad_ia VARCHAR(50);

ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS priorizar_ofertas_ia BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS bonus_maximo_prioridad_ia INTEGER NOT NULL DEFAULT 6;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_puntaje_prioridad_ia') THEN
        ALTER TABLE ofertas ADD CONSTRAINT chk_ofertas_puntaje_prioridad_ia
            CHECK (puntaje_prioridad_ia BETWEEN 0 AND 6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_evidencias_prioridad_ia') THEN
        ALTER TABLE ofertas ADD CONSTRAINT chk_ofertas_evidencias_prioridad_ia
            CHECK (jsonb_typeof(evidencias_prioridad_ia) = 'array');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_preferencias_bonus_prioridad_ia') THEN
        ALTER TABLE preferencias ADD CONSTRAINT chk_preferencias_bonus_prioridad_ia
            CHECK (bonus_maximo_prioridad_ia BETWEEN 0 AND 6);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ofertas_prioridad_ia
    ON ofertas (prioridad_ia DESC, puntaje_prioridad_ia DESC)
    WHERE prioridad_ia = TRUE;
