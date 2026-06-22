# Persistencia Specification

## Purpose

Proteger datos y esquema durante la deprecación funcional de scoring previo.

## Requirements

### Requirement: Sin DROP COLUMN en subciclo B1

El subciclo B1 MUST NOT crear ni ejecutar migraciones destructivas que eliminen columnas de scoring previo. Las columnas legadas MAY permanecer en la base sin usarse por código activo.

#### Scenario: no existe migración destructiva

- GIVEN el cambio `deprecar-scoring-previo-codigo`
- WHEN se revisan las migraciones incluidas en el subciclo B1
- THEN MUST NOT existir migración con `DROP COLUMN` para scoring previo.

#### Scenario: columnas legadas no bloquean el flujo activo

- GIVEN la base conserva columnas legadas de scoring previo
- WHEN el sistema evalúa, cachea, muestra o importa datos
- THEN MUST ignorar esas columnas como fuente de comportamiento activo.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| no existe migración destructiva | revisión de migraciones en repo / CI de cambios |
| columnas legadas no bloquean el flujo activo | `backend/tests/servicios/servicio-evaluacion.test.js`, `backend/tests/servicios/servicio-cache-evaluacion.test.js` |
