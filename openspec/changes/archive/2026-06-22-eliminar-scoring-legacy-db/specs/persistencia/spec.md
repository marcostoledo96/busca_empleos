# Delta for Persistencia

## MODIFIED Requirements

### Requirement: Sin objetos legacy de scoring previo desde B2

El subciclo B2 MUST incluir una migración idempotente que elimine únicamente objetos legacy de scoring previo: `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, el índice legacy asociado y el constraint legacy asociado. La migración MUST usar operaciones tolerantes a ausencia del objeto cuando PostgreSQL lo permita y MUST NOT usar `DROP TABLE`, `DELETE` ni `TRUNCATE`.
(Previously: B1 prohibía `DROP COLUMN` y permitía conservar columnas legadas sin uso activo.)

#### Scenario: migración elimina objetos legacy permitidos

- GIVEN una base conserva `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, índice legacy y constraint legacy
- WHEN se aplica la migración B2
- THEN esos objetos MUST quedar eliminados del esquema
- AND la tabla `ofertas` y sus filas MUST permanecer.

#### Scenario: migración repetible ante objetos ausentes

- GIVEN la migración B2 ya fue aplicada o algunos objetos legacy no existen
- WHEN se ejecuta nuevamente
- THEN MUST finalizar sin error por objetos ausentes.

#### Scenario: comandos destructivos prohibidos

- GIVEN se revisa el SQL de la migración B2
- WHEN se buscan comandos destructivos generales
- THEN MUST NOT existir `DROP TABLE`, `DELETE` ni `TRUNCATE`.

### Requirement: Tests estáticos de seguridad para migración legacy

El cambio MUST incluir tests estáticos que inspeccionen el archivo SQL de B2 sin conectarse a una base real. Esos tests MUST verificar presencia de los objetos legacy esperados, ausencia de `DROP TABLE`/`DELETE`/`TRUNCATE`, e idempotencia básica para objetos opcionales.

#### Scenario: test estático cubre lista de objetos

- GIVEN existe el test estático de la migración B2
- WHEN analiza el SQL
- THEN MUST verificar referencias a `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, índice y constraint legacy.

#### Scenario: test estático bloquea destrucción de datos

- GIVEN el SQL contiene `DROP TABLE`, `DELETE` o `TRUNCATE`
- WHEN corre el test estático
- THEN MUST fallar antes de cualquier ejecución contra DB.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| migración elimina objetos legacy permitidos | revisión SQL de `backend/sql/migracion-016-eliminar-scoring-legacy.sql` |
| migración repetible ante objetos ausentes | test estático sobre `IF EXISTS` / bloque seguro equivalente |
| comandos destructivos prohibidos | test estático con regex anti `DROP TABLE|DELETE|TRUNCATE` |
| test estático cubre lista de objetos | `backend/tests/sql/migracion-016-eliminar-scoring-legacy.test.js` |
| test estático bloquea destrucción de datos | `backend/tests/sql/migracion-016-eliminar-scoring-legacy.test.js` |
