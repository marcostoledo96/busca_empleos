# Delta for Documentación activa

## ADDED Requirements

### Requirement: Documentación de base de datos como fuente de verdad

`docs/base-de-datos.md` MUST describir el schema real vigente incluyendo `ofertas`, `preferencias`, `evaluaciones_cache`, `evaluacion_lotes` y `schema_migrations`; migraciones existentes; gotchas; y constraints actuales/recomendadas.

#### Scenario: schema completo documentado

- GIVEN una persona lee `docs/base-de-datos.md`
- WHEN busca tablas vigentes
- THEN MUST encontrar `ofertas`, `preferencias`, `evaluaciones_cache`, `evaluacion_lotes` y `schema_migrations`
- AND sus columnas, índices o constraints principales SHOULD estar descriptos.

#### Scenario: gotcha de migraciones duplicadas

- GIVEN una persona revisa historial de migraciones
- WHEN lee la documentación DB
- THEN MUST ver el gotcha de números de migración duplicados
- AND MUST ver que no se deben renombrar migraciones existentes.

#### Scenario: migración destructiva de scoring advertida

- GIVEN una persona revisa la migración de eliminación de scoring legacy
- WHEN lee la documentación DB
- THEN MUST entender que destruye objetos de esquema legacy
- AND MUST ver que no elimina tablas ni filas.

#### Scenario: constraints actuales y recomendadas

- GIVEN una persona consulta integridad de datos
- WHEN lee la documentación DB
- THEN MUST distinguir constraints actuales de constraints recomendadas o pendientes.
