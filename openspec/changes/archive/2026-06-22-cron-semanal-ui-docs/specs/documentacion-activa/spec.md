# Delta for Documentación activa

## ADDED Requirements

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
| docs describen frecuencia vigente | Revisión de `docs/**`, `README.md` y docs activas aplicables |
| revisión textual evita regresiones | `grep -R "48 hs\|48 horas\|cada 48" docs README.md AGENTS.md` ajustado a docs activas |
