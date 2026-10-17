-- Conservo las fechas desconocidas como NULL; no infiero envíos históricos.
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS fecha_postulacion DATE;
ALTER TABLE ofertas ADD COLUMN IF NOT EXISTS nota_postulacion TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_ofertas_nota_postulacion_longitud'
          AND conrelid = 'ofertas'::regclass
    ) THEN
        ALTER TABLE ofertas ADD CONSTRAINT chk_ofertas_nota_postulacion_longitud
            CHECK (char_length(nota_postulacion) <= 4000);
    END IF;
END $$;
