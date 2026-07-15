# Plataformas Registry Specification

## Purpose

Centralizar las plataformas soportadas y su estado operativo para evitar divergencias entre backend, frontend, scraping y documentación.

## Requirements

### Requirement: Registry como fuente de verdad

El sistema MUST definir una fuente de verdad de plataformas con, como mínimo, identificador interno, slug público, nombre visible y flag `activa`. Google Jobs, InfoJobs y GetOnBrd MUST permanecer registradas con `activa=false` y MUST NOT eliminarse del dominio.

#### Scenario: plataformas desactivadas preservadas

- GIVEN se consulta el registry de plataformas
- WHEN se listan todas las plataformas conocidas
- THEN Google Jobs, InfoJobs y GetOnBrd MUST existir
- AND las tres MUST tener `activa=false`.

#### Scenario: metadata mínima completa

- GIVEN cualquier plataforma registrada
- WHEN se valida su definición
- THEN MUST tener identificador interno, slug público, nombre visible y `activa` booleano.

### Requirement: Coherencia enum/slug entre capas

El backend y el frontend MUST usar el mismo identificador interno para persistencia, filtros y contratos de API. Para Google Jobs, el identificador interno MUST ser `google_jobs`; `google-jobs` MAY existir solo como slug público/URL y MUST NOT usarse como valor de filtro interno.

#### Scenario: filtro interno consistente

- GIVEN la UI envía un filtro por Google Jobs
- WHEN el backend recibe el parámetro de plataforma
- THEN el valor interno MUST ser `google_jobs`
- AND MUST NOT ser `google-jobs`.

#### Scenario: contrato frontend/backend alineado

- GIVEN se compilan tipos/enums de plataforma
- WHEN se comparan valores válidos de frontend y backend
- THEN MUST coincidir para todas las plataformas registradas.

### Requirement: Plataformas inactivas no disponibles para scraping activo

La UI y el backend MUST NOT ofrecer plataformas con `activa=false` como opciones activas para iniciar scraping. GetOnBrd MUST NOT ejecutarse si está inactiva o sin autorización escrita verificable. El sistema MAY mostrarla como desactivada si queda claro que no ejecuta scraping.

#### Scenario: UI oculta o deshabilita inactivas

- GIVEN Google Jobs e InfoJobs tienen `activa=false`
- WHEN el usuario abre filtros o controles de scraping
- THEN MUST NOT poder seleccionarlas como fuente activa de scraping.

#### Scenario: backend rechaza scraping inactivo

- GIVEN una solicitud intenta ejecutar scraping para una plataforma inactiva
- WHEN el backend valida la plataforma
- THEN MUST impedir la ejecución
- AND MUST devolver una respuesta controlada sin invocar Apify.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| plataformas desactivadas preservadas | `backend/tests/config/plataformas.test.js` |
| metadata mínima completa | `backend/tests/config/plataformas.test.js` |
| filtro interno consistente | `frontend/src/app/paginas/dashboard/*.spec.ts` + test de servicio HTTP |
| contrato frontend/backend alineado | test compartido/fixture de enum o snapshot de registry expuesto |
| UI oculta o deshabilita inactivas | spec de componente de filtros/scraping |
| backend rechaza scraping inactivo | `backend/tests/controladores/*scraping*.test.js` o servicio scraping |
