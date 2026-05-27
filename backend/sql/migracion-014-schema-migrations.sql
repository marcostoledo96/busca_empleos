-- Migración 014: Tabla de control de migraciones
-- Fecha: 2026-05-27
-- Propósito: crear una tabla para registrar qué scripts SQL ya fueron aplicados.
-- Esto permite un runner Node.js que aplique automaticamente solo las
-- migraciones pendientes, evitando ejecutar scripts dos veces.
-- NOTA: Esta tabla DEBE estar presente ANTES de que se corra el runner.

CREATE TABLE IF NOT EXISTS schema_migrations (
    id          VARCHAR(255)    PRIMARY KEY,
    aplicado_en TIMESTAMP       DEFAULT NOW(),
    exitoso     BOOLEAN         DEFAULT true
);
