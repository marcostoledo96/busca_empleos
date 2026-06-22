# Delta for Perfil candidato

## ADDED Requirements

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
| prompt personalizado se agrega al final | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt personalizado no relaja Java | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt personalizado no reemplaza seniority ni ubicación | `backend/tests/servicios/servicio-evaluacion.test.js` |
| texto de preferencias evita ambigüedad | `frontend/src/app/paginas/preferencias/*.spec.ts` |
