# Preferencias usuario Specification

## Purpose

Definir el contrato activo de preferencias durante la deprecación de scoring previo.

## Requirements

### Requirement: Backend ignora scoring_config legado

El backend MUST ignore cualquier `scoring_config` recibido en payloads de preferencias o perfil. La presencia del campo MUST NOT fallar la solicitud, MUST NOT persistirse como configuración activa y MUST NOT afectar evaluación.

#### Scenario: payload con scoring_config no cambia preferencias activas

- GIVEN una solicitud válida de preferencias que incluye `scoring_config`
- WHEN el backend procesa la solicitud
- THEN MUST guardar solo campos activos permitidos
- AND MUST ignorar `scoring_config` sin usarlo.

#### Scenario: scoring_config malformado no rompe el endpoint

- GIVEN una solicitud válida salvo por `scoring_config` malformado
- WHEN el backend valida el payload
- THEN MUST NOT rechazar la solicitud por ese campo legado
- AND MUST NOT propagarlo a evaluación ni caché.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| payload con scoring_config no cambia preferencias activas | `backend/tests/controladores/preferencias-controlador.test.js` |
| scoring_config malformado no rompe el endpoint | `backend/tests/controladores/preferencias-controlador.test.js` |
