# Documentación activa Specification

## Purpose

Mantener documentación vigente alineada con la deprecación funcional de scoring previo.

## Requirements

### Requirement: Docs activas marcan scoring previo deprecado/eliminado

La documentación activa MUST NOT describir scoring previo como feature disponible. Cuando mencione el concepto por contexto histórico, MUST marcarlo como deprecado o eliminado del flujo activo, y MUST aclarar que no se ejecuta `DROP COLUMN` en este subciclo.

#### Scenario: docs de evaluación no promueven scoring previo

- GIVEN una persona lee la documentación activa de evaluación IA
- WHEN busca el flujo de evaluación actual
- THEN MUST ver reglas determinísticas y DeepSeek como flujo activo
- AND scoring previo MUST figurar ausente, deprecado o eliminado.

#### Scenario: docs de base de datos preservan columnas

- GIVEN una persona lee documentación activa de base de datos
- WHEN revisa el alcance del subciclo B1
- THEN MUST indicar que no hay migración destructiva ni `DROP COLUMN` todavía.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| docs de evaluación no promueven scoring previo | `docs/evaluacion-ia.md` review + `backend/tests/servicios/servicio-evaluacion.test.js` |
| docs de base de datos preservan columnas | `docs/base-de-datos.md` review + migración inexistente verificada en repo |
