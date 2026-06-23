# Documentación activa Specification

## Purpose

Mantener documentación vigente alineada con la deprecación funcional de scoring previo y con la frecuencia semanal del cron de automatización.

## Requirements

### Requirement: Docs activas advierten eliminación física de scoring previo en B2

La documentación activa MUST NOT describir scoring previo como feature disponible. Para B2, cuando mencione la migración de eliminación legacy, MUST advertir que se destruyen objetos de esquema `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, índice y constraint legacy. También MUST aclarar que no se eliminan tablas ni filas, y que el rollback es limitado: recuperar esos objetos requiere backup, recreación manual o una migración compensatoria.
(Previously: B1 debía aclarar que no había migración destructiva ni `DROP COLUMN` todavía.)

#### Scenario: docs de base de datos advierten destrucción de esquema

- GIVEN una persona lee documentación activa de base de datos
- WHEN revisa la migración B2
- THEN MUST ver una advertencia de eliminación física de objetos legacy de scoring previo
- AND MUST ver que no incluye `DROP TABLE`, `DELETE` ni `TRUNCATE`.

#### Scenario: docs explican rollback limitado

- GIVEN una persona busca cómo revertir B2
- WHEN lee la documentación activa relacionada
- THEN MUST entender que el rollback no restaura automáticamente objetos eliminados
- AND MUST recomendar backup, recreación manual o migración compensatoria.

### Requirement: Docs activas alineadas al cron semanal

La documentación activa MUST describir la automatización como semanal los martes a las 20:00 ART y MUST NOT conservar referencias activas a `cada 48 hs`, `cada 48 horas` o equivalentes. Si una mención histórica fuera imprescindible, SHOULD marcarse explícitamente como obsoleta y fuera del comportamiento vigente.

#### Scenario: docs describen frecuencia vigente

- GIVEN una persona lee documentación activa de automatización, scraping o dashboard
- WHEN busca la frecuencia programada vigente
- THEN MUST encontrar martes 20:00 ART como horario semanal
- AND MUST NOT encontrar 48 horas como comportamiento activo.

#### Scenario: revisión textual evita regresiones

- GIVEN el cambio está listo para verificar
- WHEN se buscan referencias `48 hs`, `48 horas` o `cada 48` en docs activas
- THEN la búsqueda MUST devolver cero referencias activas.

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

## Traceability to Tests

| Scenario | Suggested test/build |
|---|---|
| docs de base de datos advierten destrucción de esquema | revisión de `docs/base-de-datos.md` y change docs |
| docs explican rollback limitado | revisión textual de advertencia y rollback en docs de B2 |
| docs describen frecuencia vigente | Revisión de `docs/**`, `README.md` y docs activas aplicables |
| revisión textual evita regresiones | `grep -R "48 hs\|48 horas\|cada 48" docs README.md AGENTS.md` ajustado a docs activas |
| schema completo documentado | revisión de `docs/base-de-datos.md` contra migraciones 003–017 y `crear-tablas.sql` |
| gotcha de migraciones duplicadas | revisión textual de `docs/base-de-datos.md` — sección de gotchas |
| migración destructiva de scoring advertida | revisión de `docs/base-de-datos.md` — advertencia de eliminación de objetos legacy sin `DROP TABLE` |
| constraints actuales y recomendadas | revisión de `docs/base-de-datos.md` — tabla de constraints activas vs recomendadas |
