-- Migración 021: Agregar opción para filtrar nivel de experiencia en LinkedIn.
--
-- Permite al usuario configurar si las búsquedas en LinkedIn deben incluir
-- el filtro de nivel f_E=1,2 (Internship y Entry level) o si deben abarcar
-- todos los niveles para no excluir ofertas compatibles sin etiqueta de nivel.

ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS filtrar_nivel_linkedin BOOLEAN NOT NULL DEFAULT TRUE;
