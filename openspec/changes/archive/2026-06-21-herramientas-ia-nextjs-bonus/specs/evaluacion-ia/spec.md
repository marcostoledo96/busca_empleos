# Delta for Evaluación IA

## ADDED Requirements

### Requirement: Bonus por buen uso de herramientas IA

El sistema SHOULD otorgar un bonus relevante de scoring/prompt a ofertas que valoren explícitamente el buen uso de herramientas IA compatibles con el perfil, incluyendo Claude Code, Codex, OpenCode y Antigravity. El bonus MUST mejorar la valoración de ofertas ya compatibles, pero MUST NOT convertir una oferta excluida en aprobada.

#### Scenario: oferta compatible recibe bonus IA

- GIVEN una oferta trainee/junior compatible con el stack y sin exclusiones
- AND la oferta valora buen uso de Claude Code, Codex, OpenCode o Antigravity
- WHEN el sistema calcula scoring previo o construye el prompt de evaluación
- THEN la valoración SHOULD incluir un bonus IA relevante y explicable.

#### Scenario: bonus IA no anula Java excluyente

- GIVEN una oferta que valora herramientas IA pero requiere Java como tecnología principal o excluyente
- WHEN el sistema evalúa la oferta
- THEN la oferta MUST rechazarse
- AND el bonus IA MUST NOT modificar esa decisión.

#### Scenario: bonus IA no anula seniority o experiencia excluyente

- GIVEN una oferta que valora herramientas IA pero pide Senior o más de 3 años comprobables
- WHEN el sistema evalúa la oferta
- THEN la oferta MUST rechazarse por seniority o experiencia excluyente
- AND el bonus IA MUST NOT aprobarla ni compensarla.

#### Scenario: bonus IA respeta idioma y ubicación

- GIVEN una oferta que valora herramientas IA pero incumple reglas existentes de idioma o ubicación
- WHEN el sistema aplica filtros y evaluación
- THEN las reglas de idioma/ubicación MUST prevalecer
- AND el bonus IA MUST NOT saltarse esos filtros.

## MODIFIED Requirements

### Requirement: Prompt de evaluación con salvaguardas de bonus

El prompt de evaluación MUST indicar que Next.js pertenece al stack/perfil y que Claude Code, Codex, OpenCode y Antigravity son señales positivas cuando la oferta valore buen uso de IA. También MUST declarar que el bonus IA es secundario: Java excluyente, Senior, más de 3 años comprobables, e incumplimientos de idioma/ubicación MUST prevalecer.
(Previously: el prompt valoraba el stack existente y exclusiones, sin bonus explícito por herramientas IA ni Next.js en el perfil.)

#### Scenario: prompt comunica bonus y límites

- GIVEN una oferta pendiente de evaluación
- WHEN el sistema construye el mensaje de evaluación para IA
- THEN el prompt MUST mencionar Next.js y las herramientas IA del perfil
- AND MUST incluir que el bonus IA no anula exclusiones existentes.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| oferta compatible recibe bonus IA | `backend/tests/servicio-scoring-previo.test.js`, `backend/tests/servicio-evaluacion.test.js` |
| bonus IA no anula Java excluyente | `backend/tests/servicio-scoring-previo.test.js`, `backend/tests/servicio-evaluacion.test.js` |
| bonus IA no anula seniority o experiencia excluyente | `backend/tests/servicio-scoring-previo.test.js`, `backend/tests/servicio-evaluacion.test.js` |
| bonus IA respeta idioma y ubicación | `backend/tests/servicio-scoring-previo.test.js`, `backend/tests/servicio-evaluacion.test.js` |
| prompt comunica bonus y límites | `backend/tests/servicio-evaluacion.test.js` |
