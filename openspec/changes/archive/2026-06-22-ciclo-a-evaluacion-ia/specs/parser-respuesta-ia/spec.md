# Parser respuesta IA Specification

## Purpose

Validar y normalizar respuestas crudas de DeepSeek antes de que el sistema use el resultado de evaluación.

## Requirements

### Requirement: Schema estricto de respuesta IA

El sistema MUST aceptar únicamente respuestas JSON con `match` boolean real, `razon` string y `porcentaje` numérico entero o `null`. El sistema MAY limpiar fences Markdown antes de parsear. El sistema MUST rechazar tipos ambiguos, incluyendo `match: "true"` o `match: "false"`.

#### Scenario: JSON válido sin fence

- GIVEN una respuesta `{"match":true,"razon":"Compatible","porcentaje":80}`
- WHEN el sistema parsea la respuesta IA
- THEN retorna un objeto seguro con esos valores normalizados.

#### Scenario: JSON válido con fence Markdown

- GIVEN una respuesta envuelta en ```json con campos válidos
- WHEN el sistema parsea la respuesta IA
- THEN elimina el fence y retorna el objeto seguro.

#### Scenario: boolean como string es inválido

- GIVEN una respuesta con `match` igual a `"false"`
- WHEN el sistema valida el schema
- THEN MUST rechazarla como inválida.

### Requirement: Normalización segura de porcentaje y razón

El sistema MUST normalizar `porcentaje` a entero dentro de 0-100 cuando el tipo sea numérico válido, MUST aceptar `null`, y MUST usar una razón fallback cuando falte una explicación usable.

#### Scenario: porcentaje fuera de rango se ajusta

- GIVEN una respuesta válida con `porcentaje` 150
- WHEN el sistema normaliza el resultado
- THEN retorna porcentaje 100.

#### Scenario: razón vacía usa fallback

- GIVEN una respuesta con `razon` vacía o solo espacios
- WHEN el sistema normaliza el resultado
- THEN retorna una razón fallback descriptiva.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| JSON válido sin fence | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| JSON válido con fence Markdown | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| boolean como string es inválido | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| porcentaje fuera de rango se ajusta | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| razón vacía usa fallback | `backend/tests/servicios/parser-respuesta-ia.test.js` |
