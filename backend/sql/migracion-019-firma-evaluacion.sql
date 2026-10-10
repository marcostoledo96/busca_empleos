-- Registro criterios reales solo para evaluaciones nuevas; conservo legacy desconocido.
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS firma_criterios_evaluacion TEXT;
