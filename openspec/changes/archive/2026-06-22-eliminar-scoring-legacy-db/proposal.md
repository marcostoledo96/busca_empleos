# Proposal: B2 — Eliminar scoring legacy de base de datos

## Intent

B1 dejó de usar scoring previo en código y UI pero conservó las columnas, índice y constraint legacy en PostgreSQL. Este cambio completa la deprecación eliminando físicamente esos objetos de esquema para reducir deuda técnica y evitar confusiones futuras.

## Scope

### In Scope
- Migración SQL `016` idempotente que elimine objetos legacy de scoring previo.
- Tests estáticos de la migración sin ejecutar contra DB real.
- Actualización de documentación activa con advertencia de destrucción y rollback limitado.

### Out of Scope
- Cualquier cambio de código de aplicación (backend/frontend): B1 ya limpió eso.
- Ejecución real de la migración en base de datos productiva.
- Backup o exportación de datos legacy: se asume que el usuario autorizó el borrado.
- Recreación automática de objetos eliminados en rollback.

## Capabilities

### New Capabilities
<!-- None: this is a pure cleanup migration. -->

### Modified Capabilities
- `persistencia`: B1 prohibía `DROP COLUMN`; B2 lo permite únicamente para objetos legacy de scoring previo, con operaciones idempotentes y sin `DROP TABLE`/`DELETE`/`TRUNCATE`.
- `documentacion-activa`: Docs deben advertir que B2 destruye objetos de esquema y que el rollback es limitado.

## Approach

- Crear `backend/sql/migracion-016-eliminar-scoring-legacy.sql` usando `DROP ... IF EXISTS` para tolerar re-ejecución.
- Objetos a eliminar: `ofertas.score_previo`, `ofertas.analisis_previo`, `ofertas.scoring_version`, `preferencias.scoring_config`, índice `idx_ofertas_score_previo`, constraint `chk_ofertas_score_previo`.
- Escribir tests estáticos que parseen el SQL con regex para confirmar presencia de objetos legacy y ausencia de comandos prohibidos.
- Actualizar `docs/base-de-datos.md` y artefactos del change con advertencia de destrucción física y nota de rollback limitado.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/sql/migracion-016-eliminar-scoring-legacy.sql` | New | Migración idempotente de eliminación legacy. |
| `backend/tests/sql/migracion-016-eliminar-scoring-legacy.test.js` | New | Tests estáticos de seguridad e idempotencia. |
| `docs/base-de-datos.md` | Modified | Advertencia de destrucción y rollback limitado. |
| `openspec/specs/persistencia/spec.md` | Modified | Delta: B2 permite DROP COLUMN legacy. |
| `openspec/specs/documentacion-activa/spec.md` | Modified | Delta: docs advierten destrucción física. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pérdida irreversible de datos legacy sin backup | Med | Documentar explícitamente que el usuario autorizó el borrado; la migración usa `IF EXISTS` para no fallar si ya fue aplicada. |
| Rollback complejo si algo falla post-eliminación | Med | Documentar que el rollback requiere backup previo, recreación manual o migración compensatoria; no hay reversión automática de `DROP COLUMN`. |
| Confusión con `porcentaje_match` actual | Low | Revisar docs para que no se mencione `score_previo` como feature vigente. |

## Rollback Plan

1. **Antes de aplicar:** backup del esquema (`pg_dump --schema-only`) o de la base completa.
2. **Post-aplicación:** no hay rollback automático de `DROP COLUMN`. Para revertir se necesita:
   - Restaurar backup, o
   - Recrear manualmente columnas/índice/constraint con tipos aproximados, o
   - Escribir y ejecutar una migración compensatoria que recree los objetos (sin recuperar datos ya eliminados).

## Dependencies

- B1 (`deprecar-scoring-previo-codigo`) completado y verificado: el código activo ya no lee ni escribe estos objetos.

## Success Criteria

- [ ] `backend/sql/migracion-016-eliminar-scoring-legacy.sql` existe y es idempotente.
- [ ] Tests estáticos pasan: detectan objetos legacy, bloquean `DROP TABLE`/`DELETE`/`TRUNCATE`.
- [ ] Documentación activa refleja advertencia de destrucción y rollback limitado.
- [ ] Ningún archivo de código de app fuera de openspec/migraciones/tests/docs fue modificado.
