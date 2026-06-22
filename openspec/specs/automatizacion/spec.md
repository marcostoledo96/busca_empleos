# Automatización Specification

## Purpose

Alinear la descripción operativa del cron semanal sin cambiar su programación backend vigente.

## Requirements

### Requirement: Cron semanal martes 20:00 ART preservado

El backend MUST conservar como default la expresión cron `0 20 * * 2`. Toda descripción humana, comentario activo o estado expuesto SHOULD representar esa expresión como ejecución semanal los martes a las 20:00 ART, sin mencionar frecuencia cada 48 horas como vigente.

#### Scenario: default backend no cambia

- GIVEN la configuración de automatización usa valores por defecto
- WHEN se inicializa o consulta el programador
- THEN la expresión cron default MUST ser `0 20 * * 2`.

#### Scenario: estado humano coincide con cron

- GIVEN el estado de automatización se expone a UI o logs operativos
- WHEN se muestra una descripción legible del cron
- THEN SHOULD indicar martes 20:00 ART
- AND MUST NOT describir una frecuencia cada 48 horas.

#### Scenario: comentarios activos no contradicen comportamiento

- GIVEN una persona revisa comentarios activos del servicio de automatización
- WHEN busca la frecuencia documentada junto al cron default
- THEN SHOULD ver martes 20:00 ART o equivalente semanal
- AND MUST NOT ver referencias activas a cada 48 horas.

## Traceability to Tests

| Scenario | Suggested test/build |
|---|---|
| default backend no cambia | `backend/tests/servicios/servicio-automatizacion.test.js` assert `0 20 * * 2` |
| estado humano coincide con cron | Test de `obtenerEstado()`/estado equivalente + `npm test` en `backend/` |
| comentarios activos no contradicen comportamiento | `grep -R "48 hs\|48 horas\|cada 48" backend/src` revisando solo comentarios/textos activos |
