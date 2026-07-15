# Registry

## MODIFIED Requirements

### Requirement: Registry como fuente de verdad

El sistema MUST definir una fuente con identificador, slug, nombre y `activa`. Google Jobs, InfoJobs y GetOnBrd MUST permanecer inactivas y MUST NOT eliminarse.
(Previously: GetOnBrd no se preservaba inactiva.)

#### Scenario: plataformas desactivadas preservadas

- GIVEN se consulta el registry
- WHEN se listan plataformas
- THEN Google Jobs, InfoJobs y GetOnBrd MUST existir
- AND las tres MUST tener `activa=false`.

#### Scenario: metadata mínima completa

- GIVEN una plataforma registrada
- WHEN se valida
- THEN MUST tener identificador interno, slug público, nombre visible y `activa` booleano.

### Requirement: Plataformas inactivas no disponibles para scraping activo

UI y backend MUST NOT ofrecer inactivas para scraping. GetOnBrd MUST NOT ejecutarse si está inactiva o sin autorización válida; esta sola MUST NOT cambiar estado. MAY mostrarse desactivada.
(Previously: No regulaba la autorización de GetOnBrd.)

#### Scenario: UI oculta o deshabilita inactivas

- GIVEN GetOnBrd está inactiva
- WHEN se abren controles de scraping
- THEN MUST NOT poder seleccionarla como fuente activa.

#### Scenario: backend rechaza scraping inactivo

- GIVEN una solicitud para GetOnBrd inactiva o sin autorización válida
- WHEN el backend la valida
- THEN MUST impedirla
- AND MUST responder sin invocar servicios externos.
