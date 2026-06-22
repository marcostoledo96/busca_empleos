# Documentación activa Specification

## Purpose

Mantener documentación vigente alineada con la deprecación funcional de scoring previo y con la frecuencia semanal del cron de automatización.

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

### Requirement: Docs activas alineadas al cron semanal

La documentación activa MUST describir la automatización como semanal los martes a las 20:00 ART y MUST NOT conservar referencias activas a `cada 48 hs`, `cada 48 horas` o equivalentes. Si una mención histórica fuera imprescindible, SHOULD marcarse explícitamente como obsoleta y fuera del comportamiento vigente.

#### Scenario: docs describen frecuencia vigente

- GIVEN una persona lee documentación activa de automatización, scraping o dashboard
- WHEN busca la frecuencia programada vigente
- THEN MUST encontrar martes 20:00 ART como horario semanal
- AND MUST NOT encontrar 48 horas como comportamiento activo.

#### Scenario: revisión textual evita regresiones

- GIVEN el cambio está listo para verificar
- WHEN se buscan referencias `48 hs`, `48 horas` o `cada 48` en docs activas
- THEN la búsqueda MUST devolver cero referencias activas.

## Traceability to Tests

| Scenario | Suggested test/build |
|---|---|
| docs de evaluación no promueven scoring previo | `docs/evaluacion-ia.md` review + `backend/tests/servicios/servicio-evaluacion.test.js` |
| docs de base de datos preservan columnas | `docs/base-de-datos.md` review + migración inexistente verificada en repo |
| docs describen frecuencia vigente | Revisión de `docs/**`, `README.md` y docs activas aplicables |
| revisión textual evita regresiones | `grep -R "48 hs\|48 horas\|cada 48" docs README.md AGENTS.md` ajustado a docs activas |
