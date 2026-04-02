-- Migración 004: Agregar columna idioma_candidato a la tabla preferencias.
--
-- ¿Para qué sirve este campo?
-- DeepSeek no tenía criterio de idioma en su prompt, por lo que aprobaba
-- ofertas en inglés aunque el candidato no tenga nivel suficiente.
-- Este campo permite declarar el nivel de idioma del candidato en texto libre
-- (ej: "Español nativo, Inglés básico oral / intermedio escrito") y se inyecta
-- como regla estricta en el prompt de evaluación.
--
-- ¿Por qué TEXT y no un enum?
-- Porque describir el nivel de idioma es complejo y personal:
-- "básico oral pero leo documentación técnica sin problema" no cabe
-- en una lista predefinida de valores.
--
-- Ejecutar una sola vez con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-004-idioma.sql
--
-- Idempotente: IF NOT EXISTS evita errores si ya se ejecutó.

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS idioma_candidato TEXT DEFAULT 'Español nativo, Inglés básico oral / intermedio escrito';
