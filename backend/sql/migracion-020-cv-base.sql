-- Aíslo el documento fuente de preferencias, sus backups y el perfil efectivo.
CREATE TABLE IF NOT EXISTS cv_base (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cv_base TEXT NOT NULL CHECK (octet_length(cv_base) <= 1048576),
    cv_base_actualizado_en TIMESTAMPTZ NOT NULL
);
