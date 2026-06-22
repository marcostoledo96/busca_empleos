# Spec — Evaluación IA

## ADDED Requirements

### Requirement: Bonus por buen uso de herramientas IA

El sistema SHOULD valorar ofertas que mencionen buen uso de herramientas IA compatibles con el perfil, incluyendo Claude Code, Codex, OpenCode y Antigravity, dentro del prompt/criterios activos de DeepSeek. La valoración MUST mejorar ofertas ya compatibles, pero MUST NOT reactivar scoring previo ni convertir una oferta excluida en aprobada.

#### Scenario: oferta compatible recibe bonus IA

- GIVEN una oferta trainee/junior compatible con el stack y sin exclusiones
- AND la oferta valora buen uso de Claude Code, Codex, OpenCode o Antigravity
- WHEN el sistema construye el prompt de evaluación activo
- THEN la valoración SHOULD incluir esa señal positiva sin calcular scoring previo.

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

### Requirement: Prevalidación determinística antes de DeepSeek

El sistema MUST ejecutar reglas de exclusión antes de llamar a DeepSeek. Si una regla excluye la oferta, el sistema MUST retornar rechazo determinístico y MUST NOT consumir una llamada IA.

#### Scenario: oferta Java no llama DeepSeek

- GIVEN una oferta pendiente que requiere Java excluyente
- WHEN el sistema evalúa la oferta
- THEN retorna `match: false`, porcentaje 10 y razón explícita.
- AND DeepSeek MUST NOT ser llamado.

#### Scenario: oferta sin exclusión sigue a IA

- GIVEN una oferta trainee/junior sin exclusiones fuertes
- WHEN el sistema evalúa la oferta
- THEN el sistema MAY llamar a DeepSeek para evaluación semántica.

### Requirement: Postvalidación defensiva del resultado IA

El sistema MUST reaplicar reglas de exclusión después de parsear la respuesta IA. Si DeepSeek aprueba una oferta excluida, el sistema MUST sobrescribir el resultado con rechazo determinístico.

#### Scenario: IA aprueba oferta senior por error

- GIVEN DeepSeek responde `match: true` para una oferta Senior
- WHEN el sistema postvalida el resultado
- THEN retorna `match: false`, porcentaje 15 y razón de seniority.

### Requirement: Scoring previo fuera del flujo activo

El sistema MUST NOT usar scoring previo como paso activo de evaluación, caché, prompt ni decisión final. Las exclusiones determinísticas y DeepSeek SHALL seguir siendo las fuentes activas de evaluación.

#### Scenario: evaluación no calcula scoring previo

- GIVEN una oferta pendiente sin exclusión determinística
- WHEN el sistema ejecuta la evaluación
- THEN MUST evaluar con el flujo activo sin invocar scoring previo
- AND el resultado MUST provenir de reglas determinísticas o DeepSeek.

#### Scenario: caché no depende de scoring previo

- GIVEN una oferta ya evaluada o candidata a cachearse
- WHEN el sistema consulta o guarda caché de evaluación
- THEN MUST NOT leer ni escribir datos de scoring previo como parte del criterio de caché.

## MODIFIED Requirements

### Requirement: Prompt de evaluación con salvaguardas de bonus

El prompt de evaluación MUST indicar que Next.js pertenece al stack/perfil y que Claude Code, Codex, OpenCode y Antigravity son señales positivas cuando la oferta valore buen uso de IA. También MUST declarar que el bonus IA es secundario: Java excluyente, Senior/SR/Lead, 3+ años excluyentes, inglés excluyente, e incumplimientos de ubicación/modalidad MUST prevalecer. El prompt MUST exigir JSON compatible con el parser estricto y MUST NOT incluir instrucciones de scoring previo.
(Previously: el prompt no prohibía explícitamente instrucciones de scoring previo.)

#### Scenario: prompt comunica bonus y límites

- GIVEN una oferta pendiente de evaluación
- WHEN el sistema construye el mensaje de evaluación para IA
- THEN el prompt MUST mencionar Next.js y herramientas IA del perfil
- AND MUST incluir que el bonus IA no anula exclusiones existentes.

#### Scenario: prompt exige formato estricto

- GIVEN una oferta que llega a DeepSeek
- WHEN el sistema construye el prompt
- THEN MUST pedir `match` boolean, `razon` string y `porcentaje` numérico o null.

#### Scenario: prompt no contiene scoring previo

- GIVEN una oferta que llega a DeepSeek
- WHEN el sistema construye el prompt
- THEN MUST NOT incluir instrucciones, pesos ni umbrales de scoring previo.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| oferta compatible recibe bonus IA | `backend/tests/servicios/servicio-evaluacion.test.js` |
| bonus IA no anula Java excluyente | `backend/tests/servicios/servicio-evaluacion.test.js` |
| bonus IA no anula seniority o experiencia excluyente | `backend/tests/servicios/servicio-evaluacion.test.js` |
| bonus IA respeta idioma y ubicación | `backend/tests/servicios/servicio-evaluacion.test.js` |
| oferta Java no llama DeepSeek | `backend/tests/servicios/servicio-evaluacion.test.js` |
| oferta sin exclusión sigue a IA | `backend/tests/servicios/servicio-evaluacion.test.js` |
| IA aprueba oferta senior por error | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt comunica bonus y límites | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt exige formato estricto | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluación no calcula scoring previo | `backend/tests/servicios/servicio-evaluacion.test.js` |
| caché no depende de scoring previo | `backend/tests/servicios/servicio-cache-evaluacion.test.js` |
| prompt no contiene scoring previo | `backend/tests/servicios/servicio-evaluacion.test.js` |
