# Documentación

## ADDED Requirements

### Requirement: Piloto documentado

La documentación MUST declarar GetOnBrd API-only, sandbox/fixtures-only y excluida de cron, UI y producción. MUST definir evidencia, límites, métricas, checkpoints, terminaciones, rollout y rollback.

#### Scenario: piloto consultable

- GIVEN documentación de scraping o automatización
- WHEN busca GetOnBrd
- THEN MUST encontrar límites, autorización y terminaciones.

#### Scenario: rollout sin autorización

- GIVEN falta evidencia válida
- WHEN se revisa el rollout
- THEN MUST ver que producción permanece denegada
- AND MUST ver rollback por deshabilitación sin borrar producción.
