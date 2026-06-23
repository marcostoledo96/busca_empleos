# Tasks: Correcciones de auditoría OpenCode

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–650 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (runner+db+docs) → PR 2 (rules+automation) → PR 3 (CI) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Runner bootstrap, migración 017, docs DB | PR 1 | base=main; includes SQL static tests y docs |
| 2 | Reglas exclusion lead/razón, automation erroresGuardado, email | PR 2 | base=main; unit tests incluidos |
| 3 | CI workflow backend+frontend | PR 3 | base=main; verifica jobs en push |

## Phase 1: Runner y Persistencia

- [x] 1.1 En `backend/scripts/migrar.js`, reemplazar `process.exit(1)` cuando falta `schema_migrations` por `asegurarTablaSchemaMigrations(pool)` con DDL idéntico a migración 014, luego continuar flujo normal.
- [x] 1.2 Actualizar texto de ayuda post-migración a `npm run db:migrate:apply`.
- [x] 1.3 Crear `backend/sql/migracion-017-salario-rango.sql` con constraint `chk_ofertas_salario_rango` idempotente, preflight de filas inválidas y sin tocar datos.
- [x] 1.4 En `backend/tests/scripts/migrar.test.js`, agregar test bootstrap crea tabla con DDL 014 y test ayuda muestra `db:migrate:apply`.
- [x] 1.5 Agregar test estático de SQL para migración 017: sin `DROP TABLE/DELETE/TRUNCATE/CASCADE/CONCURRENTLY`.
- [x] 1.6 Quick verify: `npm test -- migrar.test.js` pasa; `node backend/scripts/migrar.js` bootstrappea sin fallar.

## Phase 2: Reglas de Exclusión

- [x] 2.1 En `backend/src/servicios/evaluacion/reglas-exclusion.js`, remover patrón `\blead\b` aislado; agregar `líder/lider` y títulos de rol (`Tech Lead`, `Team Lead`, `Lead Developer`, `Lead Engineer`); preservar exclusión de `Senior`/`SR`.
- [x] 2.2 Mejorar `razon` de exclusión por experiencia 3+ años para mencionar variantes comunes (`3+`, `más de 3`, `mínimo 3`, `4 años`).
- [x] 2.3 En `backend/tests/servicios/reglas-exclusion.test.js`, agregar casos: `lead initiatives` no excluye, `lead generation` no excluye, `Tech Lead`/`Team Lead`/`Lead Developer`/`Líder` excluyen.
- [x] 2.4 Agregar tests de regresión para razón de experiencia específica.
- [x] 2.5 Quick verify: `npm test -- reglas-exclusion.test.js` pasa; escenarios spec ↔ test trazados en comentario del test.

## Phase 3: Automatización y Notificaciones

- [x] 3.1 En `backend/src/servicios/servicio-automatizacion.js`, inicializar `erroresGuardado: 0`; incrementar en catch de `crearOferta`; agregar mensaje a `resultado.errores`.
- [x] 3.2 En `backend/src/servicios/servicio-notificacion-email.js`, incluir `erroresGuardado` en totales HTML/texto del resumen.
- [x] 3.3 En `backend/tests/servicios/servicio-automatizacion.test.js`, agregar asserts: `erroresGuardado === 0` sin fallas, `=== 1` con una falla, `> 1` con múltiples; verificar que email recibe métrica.
- [x] 3.4 En `backend/tests/servicios/servicio-notificacion-email.test.js`, assert HTML/texto incluyen conteo de errores de guardado.
- [x] 3.5 Quick verify: `npm test -- servicio-automatizacion.test.js` y `npm test -- servicio-notificacion-email.test.js` pasan; contrato `resultado.erroresGuardado: number` validado.

## Phase 4: Documentación Activa

- [x] 4.1 Actualizar `docs/base-de-datos.md` con schema real vigente (`ofertas`, `preferencias`, `evaluaciones_cache`, `evaluacion_lotes`, `schema_migrations`), columnas, índices, constraints.
- [x] 4.2 Documentar migraciones 001–017, gotcha de números duplicados y regla de no renombrar migraciones aplicadas.
- [x] 4.3 Documentar comportamiento de bootstrap del runner y rollback de constraint 017.
- [x] 4.4 Quick verify: `grep -c "schema_migrations" docs/base-de-datos.md` > 0; `grep -c "migracion-017" docs/base-de-datos.md` > 0.

## Phase 5: Integración Continua

- [x] 5.1 Crear `.github/workflows/ci.yml` con job `test:unit` (`npm test` en `backend/`), job `test:db` con servicio Postgres (`postgres:15-alpine`, `busca_empleos_test`, credenciales efímeras) y job `frontend` (build + `ng test --watch=false --browsers=ChromeHeadless` si soporta).
- [x] 5.2 Configurar `NODE_ENV=test`, `ALLOW_DB_TESTS=true`, `PGDATABASE=busca_empleos_test`; no usar secrets productivos.
- [x] 5.3 Quick verify: push a branch ejecuta workflow; jobs de backend y DB pasan; si frontend headless falla, documentar en verify como known issue.

## Phase 6: Verificación Global

- [x] 6.1 Suite completa backend: `npm test` en `backend/` pasa (unit + estáticos).
- [x] 6.2 Tests DB local (si hay Postgres): `npm run test:db` o `ALLOW_DB_TESTS=true npm test -- test-db-guard`.
- [x] 6.3 Build frontend: `cd frontend && npm run build` genera artefacto sin errores.
- [x] 6.4 Trazabilidad escenario-spec ↔ archivo de test confirmada para: bootstrap runner, lead FP, erroresGuardado, CI DB seguro.
