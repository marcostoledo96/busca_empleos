# Tasks: B2 — Eliminar scoring legacy de base de datos

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~70 (SQL + tests + docs) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Migración SQL 016

- [x] 1.1 Crear `backend/sql/migracion-016-eliminar-scoring-legacy.sql` con `DROP INDEX IF EXISTS idx_ofertas_score_previo`, `ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_score_previo`, `ALTER TABLE ofertas DROP COLUMN IF EXISTS score_previo`, `DROP COLUMN IF EXISTS analisis_previo`, `DROP COLUMN IF EXISTS scoring_version`, y `ALTER TABLE preferencias DROP COLUMN IF EXISTS scoring_config`.
- [x] 1.2 Validar que el archivo no contenga `DROP TABLE`, `DELETE`, `TRUNCATE`, `CASCADE` ni `CONCURRENTLY` fuera de comentarios.

## Phase 2: Tests estáticos

- [x] 2.1 En `backend/tests/scripts/migrar.test.js`, agregar bloque `describe('Migración 016 — Eliminar scoring legacy')` con: test de existencia del archivo, tests que verifiquen referencia a `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, índice y constraint legacy, test de idempotencia (`IF EXISTS` / `DROP CONSTRAINT IF EXISTS`), test de bloqueo de comandos destructivos (`DROP TABLE`, `DELETE`, `TRUNCATE`), y test de ausencia de `CONCURRENTLY`.
- [x] 2.2 Ejecutar `npm test` y confirmar que tests estáticos pasan sin conexión a base de datos real.

## Phase 3: Documentación activa

- [x] 3.1 En `docs/base-de-datos.md`, agregar migración 016 a la tabla de migraciones con advertencia de eliminación física de objetos legacy.
- [x] 3.2 Agregar nota de rollback limitado: `DROP COLUMN` destruye datos irreversiblemente; rollback requiere backup previo, recreación manual o migración compensatoria.

## Phase 4: Verify y Archive

- [x] 4.1 Verificar `npm test` completo sin fallos y confirmar que ningún archivo de código de app fuera de `backend/sql/`, `backend/tests/scripts/`, `docs/` ni `openspec/` fue modificado.
- [x] 4.2 Ejecutar migración 016 contra DB real (`railway`) — ejecutada por Marcos. Runner de migraciones corregido (bug del path de `.env` en `migrar.js`). Test de regresión agregado.
- [x] 4.3 Ejecutar `sdd-archive` para mover `openspec/changes/eliminar-scoring-legacy-db` a `openspec/changes/archive/YYYY-MM-DD-eliminar-scoring-legacy-db/`.

## Criterios de éxito

- `backend/sql/migracion-016-eliminar-scoring-legacy.sql` existe, es idempotente y solo destruye objetos legacy permitidos.
- Tests estáticos pasan: detectan objetos legacy, bloquean `DROP TABLE`/`DELETE`/`TRUNCATE`, verifican `IF EXISTS`.
- Documentación activa refleja advertencia de destrucción física y rollback limitado.
- Cero archivos de aplicación modificados fuera del alcance del change.
