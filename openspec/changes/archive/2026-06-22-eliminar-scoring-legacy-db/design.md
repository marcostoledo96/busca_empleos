# Design: B2 — Eliminar scoring legacy de base de datos

## Technical Approach

Crear una migración SQL 016, idempotente y acotada, que elimine físicamente los objetos legacy de scoring previo que B1 dejó sin uso activo. El cambio no toca código de aplicación fuera del change OpenSpec en esta fase de diseño. La implementación deberá agregar el SQL, ajustar tests estáticos en `backend/tests/scripts/migrar.test.js` y documentar advertencia/rollback manual.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Migración destructiva controlada | `migracion-016-eliminar-scoring-legacy.sql` con allowlist exacta de objetos. | Mantener columnas legacy indefinidamente. | B2 existe para cerrar deuda de esquema después de B1. |
| Idempotencia | Usar `DROP ... IF EXISTS` y no depender del estado previo. | Consultas manuales a catálogos. | Es más simple, legible y tolera bases ya parcialmente limpiadas. |
| Orden de borrado | `DROP INDEX` → `DROP CONSTRAINT` → `DROP COLUMN`. | Dropear columnas primero y dejar cascada implícita. | El orden explícito hace auditable qué se destruye y evita dependencias sorpresa. |
| Sin ejecución real por defecto | Verificación estática; DB real solo con test DB segura o confirmación explícita. | Ejecutar `db:migrate` durante apply/verify. | Esta migración destruye datos de columnas; no corresponde tocar una DB real sin guarda. |

## Data Flow

```text
schema actual legacy
  ├─ ofertas.idx_ofertas_score_previo
  ├─ ofertas.chk_ofertas_score_previo
  ├─ ofertas.score_previo / analisis_previo / scoring_version
  └─ preferencias.scoring_config
        ↓ migración 016 (transacción del runner)
schema activo sin objetos de scoring previo legacy
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/sql/migracion-016-eliminar-scoring-legacy.sql` | Create | Migra B2 con `DROP INDEX IF EXISTS idx_ofertas_score_previo`, `ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_score_previo`, `ALTER TABLE ofertas DROP COLUMN IF EXISTS score_previo`, `analisis_previo`, `scoring_version`, y `ALTER TABLE preferencias DROP COLUMN IF EXISTS scoring_config`. |
| `backend/tests/scripts/migrar.test.js` | Modify | Agregar bloque “Migración 016” con lectura estática del SQL; permitir solo `DROP INDEX`, `DROP CONSTRAINT` y `DROP COLUMN` de la allowlist; bloquear `DROP TABLE`, `DELETE`, `TRUNCATE`, `CASCADE` y `CONCURRENTLY`. |
| `docs/base-de-datos.md` | Modify | Documentar migración 016, objetos destruidos, que no borra tablas/filas y rollback manual limitado. |
| `openspec/changes/eliminar-scoring-legacy-db/design.md` | Create | Diseño técnico de B2. |

## Interfaces / Contracts

No cambia API HTTP. Contrato DB esperado después de B2:

```sql
DROP INDEX IF EXISTS idx_ofertas_score_previo;
ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_score_previo;
ALTER TABLE ofertas DROP COLUMN IF EXISTS score_previo;
ALTER TABLE ofertas DROP COLUMN IF EXISTS analisis_previo;
ALTER TABLE ofertas DROP COLUMN IF EXISTS scoring_version;
ALTER TABLE preferencias DROP COLUMN IF EXISTS scoring_config;
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static SQL | Archivo 016 existe y referencia todos los objetos legacy. | Jest en `backend/tests/scripts/migrar.test.js`, sin conexión DB. |
| Safety | No hay `DROP TABLE`, `DELETE`, `TRUNCATE`, `CASCADE`, `CONCURRENTLY`. | Regex sobre líneas SQL no comentadas. |
| Idempotence | Cada operación destructiva usa `IF EXISTS`. | Assert de patrones exactos por objeto. |
| Optional DB | Aplicación real de migración. | Solo `npm run test:db`/DB `_test` o confirmación explícita de Marcos. |

## Migration / Rollout

Rollout: backup previo recomendado, revisar SQL con tests estáticos, aplicar 016 con `node scripts/migrar.js --apply` únicamente contra DB confirmada. Riesgo central: se destruyen datos históricos de `score_previo`, `analisis_previo`, `scoring_version` y `scoring_config`; una vez dropeadas, esas columnas no vuelven con sus datos salvo restaurando backup.

Rollback manual: recrear columnas/constraint/índice con una migración compensatoria o SQL manual y, si se necesitan datos, restaurarlos desde backup. No hay rollback automático porque `DROP COLUMN` elimina datos.

## Open Questions

- [ ] Confirmar si antes de aplicar en una DB real se exportan los valores legacy a backup/auditoría.
