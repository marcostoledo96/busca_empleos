# Delta para Interfaz usuario

## ADDED Requirements

### Requirement: Ranking IA explicable y accesible

La UI MUST mostrar la prioridad IA y sus evidencias como texto seguro y accesible, y MUST ordenarla únicamente cuando la preferencia esté habilitada. La UI MUST NOT presentar prioridad como match, aprobación ni reemplazo de exclusiones; ante fallo de preferencia o almacenamiento MUST usar el orden vigente y comunicar el fallback.

#### Scenario: prioridad habilitada y explicada

- GIVEN ofertas ya compatibles con evidencias IA y preferencia habilitada
- WHEN el dashboard renderiza el listado y detalle
- THEN MUST aplicar el ranking y mostrar evidencia textual accesible.

#### Scenario: fallback sin prioridad

- GIVEN la preferencia está deshabilitada o no puede cargarse
- WHEN el dashboard renderiza ofertas
- THEN MUST conservar el orden vigente y no aprobar ni ocultar exclusiones.
