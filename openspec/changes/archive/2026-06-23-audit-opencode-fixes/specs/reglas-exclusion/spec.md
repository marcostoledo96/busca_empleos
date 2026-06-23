# Delta for Reglas exclusión

## MODIFIED Requirements

### Requirement: Exclusiones fuertes determinísticas

El sistema MUST rechazar sin IA ofertas con Java principal/excluyente, Senior/SR/Lead en título o rol, 3+ años excluyentes, inglés avanzado/fluido/bilingüe excluyente, o ubicación/modalidad incompatible con preferencias. La regla Lead MUST cubrir variantes de título/rol como `Tech Lead`, `Team Lead`, `Lead Developer` o `Líder`, pero MUST NOT rechazar usos verbales o contextuales como `lead initiatives`. La razón de 3+ años SHOULD mencionar variantes comunes como `3+`, `más de 3`, `mínimo 3`, `4 años` o equivalentes. Cada rechazo SHALL devolver `{ excluida: true, match: false, porcentaje, razon, reglas }`.
(Previously: Lead se trataba como seniority amplio y la razón de experiencia era genérica.)

#### Scenario: Java excluyente no confunde JavaScript

- GIVEN una oferta que requiere Java como tecnología principal
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 10 y regla `java`.
- AND una mención a JavaScript por sí sola MUST NOT activar esa regla.

#### Scenario: Senior SR Lead excluyente

- GIVEN una oferta Senior, SR, Tech Lead, Team Lead, Lead Developer o Líder
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 15 y regla `seniority`.

#### Scenario: lead verbal no excluyente

- GIVEN una oferta dice `lead initiatives` sin usar Lead como título o rol
- WHEN el sistema aplica reglas determinísticas
- THEN MUST NOT rechazar por regla `seniority` debido a esa frase.

#### Scenario: experiencia mayor a tres años excluyente

- GIVEN una oferta exige 3+, más de 3, mínimo 3 o 4 años como requisito excluyente
- WHEN el sistema aplica reglas determinísticas
- THEN rechaza con porcentaje 20 y regla `experiencia`
- AND la razón SHOULD mencionar esas variantes comunes.

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
