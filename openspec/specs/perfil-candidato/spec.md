# Delta for Perfil candidato

## ADDED Requirements

### Requirement: Perfil técnico ampliado con Next.js y herramientas IA

El sistema MUST considerar Next.js como tecnología válida del stack del candidato y MUST incluir Claude Code, Codex, OpenCode y Antigravity como herramientas IA valorables dentro del perfil. Estas incorporaciones SHALL complementar el perfil existente sin cambiar las exclusiones estrictas ni las reglas de seniority, experiencia, idioma o ubicación.

#### Scenario: Next.js es parte del stack aceptado

- GIVEN una oferta trainee/junior compatible que pide Next.js junto con React o TypeScript
- WHEN el sistema evalúa la oferta contra el perfil del candidato
- THEN Next.js MUST contar como coincidencia técnica válida
- AND la oferta SHALL seguir su flujo normal de scoring/evaluación.

#### Scenario: herramientas IA reconocidas en el perfil

- GIVEN una oferta compatible que valora Claude Code, Codex, OpenCode o Antigravity
- WHEN el sistema compara la oferta con el perfil del candidato
- THEN esas herramientas MUST reconocerse como capacidades valorables del perfil
- AND ninguna herramienta IA SHALL convertirse por sí sola en criterio excluyente.

#### Scenario: exclusión estricta prevalece sobre perfil ampliado

- GIVEN una oferta que pide Next.js y también Java como tecnología principal o excluyente
- WHEN el sistema evalúa la oferta
- THEN la oferta MUST rechazarse por la regla estricta de Java
- AND el match por Next.js o herramientas IA MUST NOT anular el rechazo.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| Next.js es parte del stack aceptado | `backend/tests/servicio-evaluacion.test.js` / `backend/tests/servicio-scoring-previo.test.js` |
| herramientas IA reconocidas en el perfil | `backend/tests/servicio-evaluacion.test.js` / `backend/tests/servicio-scoring-previo.test.js` |
| exclusión estricta prevalece sobre perfil ampliado | `backend/tests/servicio-evaluacion.test.js` / `backend/tests/servicio-scoring-previo.test.js` |
