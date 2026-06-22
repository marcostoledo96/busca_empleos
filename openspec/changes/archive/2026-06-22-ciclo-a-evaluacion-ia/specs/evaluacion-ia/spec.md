# Delta for Evaluación IA

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Prompt de evaluación con salvaguardas de bonus

El prompt de evaluación MUST indicar que Next.js pertenece al stack/perfil y que Claude Code, Codex, OpenCode y Antigravity son señales positivas cuando la oferta valore buen uso de IA. También MUST declarar que el bonus IA es secundario: Java excluyente, Senior/SR/Lead, 3+ años excluyentes, inglés excluyente, e incumplimientos de ubicación/modalidad MUST prevalecer. El prompt MUST exigir JSON compatible con el parser estricto.
(Previously: el prompt declaraba bonus IA y límites, pero no exigía convivencia explícita con parser estricto, prevalidación/postvalidación ni todas las exclusiones del Ciclo A.)

#### Scenario: prompt comunica bonus y límites

- GIVEN una oferta pendiente de evaluación
- WHEN el sistema construye el mensaje de evaluación para IA
- THEN el prompt MUST mencionar Next.js y herramientas IA del perfil
- AND MUST incluir que el bonus IA no anula exclusiones existentes.

#### Scenario: prompt exige formato estricto

- GIVEN una oferta que llega a DeepSeek
- WHEN el sistema construye el prompt
- THEN MUST pedir `match` boolean, `razon` string y `porcentaje` numérico o null.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| oferta Java no llama DeepSeek | `backend/tests/servicios/servicio-evaluacion.test.js` |
| oferta sin exclusión sigue a IA | `backend/tests/servicios/servicio-evaluacion.test.js` |
| IA aprueba oferta senior por error | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt comunica bonus y límites | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt exige formato estricto | `backend/tests/servicios/servicio-evaluacion.test.js` |
