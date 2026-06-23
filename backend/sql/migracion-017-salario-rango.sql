-- Migración 017: Constraint de rango salarial
-- Fecha: 2026-06-23
-- Propósito: garantizar que salario_min <= salario_max cuando ambos no son NULL.
-- Esto previene que se guarden ofertas con rangos salariales invertidos.
--
-- Estrategia idempotente:
-- 1. Verificar si ya existe la constraint (pg_constraint).
-- 2. Contar filas inválidas (salario_min > salario_max WHERE ambos no son NULL).
-- 3. Si hay filas inválidas, RAISE EXCEPTION para bloquear la migración.
--    El operador debe corregir los datos antes de aplicar.
-- 4. Si no hay filas inválidas, agregar la constraint.
-- 5. Si la constraint ya existe, no hacer nada (idempotente).
--
-- NO modifica datos. NO usa DROP TABLE, DELETE, TRUNCATE ni CASCADE.
-- Rollback: ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_salario_rango;

DO $$
BEGIN
    -- Si la constraint ya existe, no hacer nada (idempotente).
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofertas_salario_rango'
    ) THEN
        RAISE NOTICE '[Migración 017] La constraint chk_ofertas_salario_rango ya existe. Saltando.';
        RETURN;
    END IF;

    -- Preflight: contar filas donde salario_min > salario_max (ambos no NULL).
    -- Si hay filas inválidas, la migración falla con mensaje descriptivo.
    -- El operador debe corregir los datos antes de volver a ejecutar.
    DECLARE
        filas_invalidas INTEGER;
    BEGIN
        SELECT COUNT(*) INTO filas_invalidas
        FROM ofertas
        WHERE salario_min IS NOT NULL
          AND salario_max IS NOT NULL
          AND salario_min > salario_max;

        IF filas_invalidas > 0 THEN
            RAISE EXCEPTION '[Migración 017] Se encontraron % filas con salario_min > salario_max. Corregir los datos antes de aplicar esta migración.', filas_invalidas;
        END IF;
    END;

    -- No hay filas inválidas, es seguro agregar la constraint.
    ALTER TABLE ofertas
        ADD CONSTRAINT chk_ofertas_salario_rango
        CHECK (salario_min IS NULL OR salario_max IS NULL OR salario_min <= salario_max);

    RAISE NOTICE '[Migración 017] Constraint chk_ofertas_salario_rango agregada exitosamente.';
END
$$;