# Delta for Documentación activa

## MODIFIED Requirements

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

## Traceability to Tests

| Scenario | Suggested test/build |
|---|---|
| docs de base de datos advierten destrucción de esquema | revisión de `docs/base-de-datos.md` y change docs |
| docs explican rollback limitado | revisión textual de advertencia y rollback en docs de B2 |
