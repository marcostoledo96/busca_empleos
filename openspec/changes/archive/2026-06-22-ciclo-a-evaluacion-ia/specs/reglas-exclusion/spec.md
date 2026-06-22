# Reglas exclusión Specification

## Purpose

Detectar exclusiones fuertes de ofertas laborales de forma determinística y sin depender de DeepSeek.

## Requirements

### Requirement: Exclusiones fuertes determinísticas

El sistema MUST rechazar sin IA ofertas con Java principal/excluyente, Senior/SR/Lead, 3+ años excluyentes, inglés avanzado/fluido/bilingüe excluyente, o ubicación/modalidad incompatible con preferencias. Cada rechazo SHALL devolver `{ excluida: true, match: false, porcentaje, razon, reglas }`.

#### Scenario: Java excluyente no confunde JavaScript

- GIVEN una oferta que requiere Java como tecnología principal
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 10 y regla `java`.
- AND una mención a JavaScript por sí sola MUST NOT activar esa regla.

#### Scenario: Senior SR Lead excluyente

- GIVEN una oferta Senior, SR o Lead
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 15 y regla `seniority`.

#### Scenario: experiencia mayor a tres años excluyente

- GIVEN una oferta que exige 3+ años, más de 3 años o 4 años como requisito excluyente
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 20 y regla `experiencia`.

#### Scenario: inglés excluyente

- GIVEN una oferta que exige inglés avanzado, fluido o bilingüe como requisito excluyente
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 15 y regla `idioma`.

#### Scenario: ubicación modalidad incompatible

- GIVEN preferencias con zonas aceptadas y una oferta presencial fuera de esas zonas
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 10 y regla `ubicacion_modalidad`.

### Requirement: Exclusiones prevalecen sobre bonus

El sistema MUST NOT permitir que señales positivas como IA, Next.js o stack compatible compensen una exclusión fuerte.

#### Scenario: bonus IA no compensa Java

- GIVEN una oferta que valora IA pero requiere Java excluyente
- WHEN el sistema aplica reglas determinísticas
- THEN la oferta queda rechazada por Java.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| Java excluyente no confunde JavaScript | `backend/tests/servicios/reglas-exclusion.test.js` |
| Senior SR Lead excluyente | `backend/tests/servicios/reglas-exclusion.test.js` |
| experiencia mayor a tres años excluyente | `backend/tests/servicios/reglas-exclusion.test.js` |
| inglés excluyente | `backend/tests/servicios/reglas-exclusion.test.js` |
| ubicación modalidad incompatible | `backend/tests/servicios/reglas-exclusion.test.js` |
| bonus IA no compensa Java | `backend/tests/servicios/reglas-exclusion.test.js` |
