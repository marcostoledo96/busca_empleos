# Spec — Perfil candidato

## ADDED Requirements

### Requirement: Perfil técnico ampliado con Next.js y herramientas IA

El sistema MUST considerar Next.js como tecnología válida del stack del candidato y MUST incluir Claude Code, Codex, OpenCode y Antigravity como herramientas IA valorables dentro del perfil. Estas incorporaciones SHALL complementar el perfil existente sin cambiar las exclusiones estrictas ni las reglas de seniority, experiencia, idioma o ubicación, y MUST NOT depender de scoring previo.

#### Scenario: Next.js es parte del stack aceptado

- GIVEN una oferta trainee/junior compatible que pide Next.js junto con React o TypeScript
- WHEN el sistema evalúa la oferta contra el perfil del candidato
- THEN Next.js MUST contar como coincidencia técnica válida
- AND la oferta SHALL seguir su flujo normal de evaluación activa.

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

### Requirement: Importación de CV sin scoring previo

El sistema MUST importar datos del CV únicamente como perfil, preferencias o criterios adicionales activos. La importación MUST NOT crear, sugerir ni actualizar configuración de scoring previo.

#### Scenario: importar CV ignora scoring previo

- GIVEN un CV o extracción con datos del candidato
- WHEN el sistema importa el CV al perfil
- THEN MUST persistir solo datos activos del perfil o criterios adicionales
- AND MUST NOT generar `scoring_config` ni pesos de scoring previo.

#### Scenario: datos legados de scoring en importación se descartan

- GIVEN una solicitud de importación que incluye campos legados de scoring previo
- WHEN el sistema procesa la importación
- THEN MUST ignorar esos campos sin error destructivo
- AND MUST NOT usarlos en evaluaciones futuras.

### Requirement: Prompt personalizado como criterios adicionales

El sistema MUST tratar el prompt personalizado activo como criterios adicionales al perfil base. El texto personalizado SHALL agregarse al final bajo un bloque equivalente a `CRITERIOS ADICIONALES` y MUST NOT reemplazar, borrar ni relajar reglas base de Java, Senior/SR/Lead, 3+ años, inglés excluyente, ubicación/modalidad ni bonus no compensatorio.

#### Scenario: prompt personalizado se agrega al final

- GIVEN preferencias con prompt personalizado activo
- WHEN el sistema construye instrucciones desde preferencias
- THEN conserva las reglas base
- AND agrega el texto personalizado al final como criterios adicionales.

#### Scenario: prompt personalizado no relaja Java

- GIVEN un prompt personalizado que pide aceptar ofertas Java
- WHEN el sistema construye instrucciones desde preferencias
- THEN la regla estricta de Java MUST seguir vigente.

#### Scenario: prompt personalizado no reemplaza seniority ni ubicación

- GIVEN un prompt personalizado que prioriza cualquier oferta con IA
- WHEN el sistema construye instrucciones desde preferencias
- THEN Senior/SR/Lead, 3+ años, idioma y ubicación/modalidad MUST seguir siendo exclusiones fuertes.

### Requirement: Etiquetado de UI como criterios adicionales

La interfaz de preferencias SHOULD nombrar esta entrada como criterios adicionales para la IA, no como reemplazo completo del prompt de evaluación.

#### Scenario: texto de preferencias evita ambigüedad

- GIVEN el usuario abre preferencias
- WHEN visualiza el campo de texto personalizado
- THEN la UI SHOULD indicar que son criterios adicionales.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| Next.js es parte del stack aceptado | `backend/tests/servicio-evaluacion.test.js` |
| herramientas IA reconocidas en el perfil | `backend/tests/servicio-evaluacion.test.js` |
| exclusión estricta prevalece sobre perfil ampliado | `backend/tests/servicio-evaluacion.test.js` |
| importar CV ignora scoring previo | `backend/tests/servicios/servicio-importar-cv.test.js` |
| datos legados de scoring en importación se descartan | `backend/tests/servicios/servicio-importar-cv.test.js` |
| prompt personalizado se agrega al final | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt personalizado no relaja Java | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt personalizado no reemplaza seniority ni ubicación | `backend/tests/servicios/servicio-evaluacion.test.js` |
| texto de preferencias evita ambigüedad | `frontend/src/app/paginas/preferencias/*.spec.ts` |
