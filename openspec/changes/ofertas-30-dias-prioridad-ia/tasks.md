# Tasks: Ofertas de 30 días con prioridad IA

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,850 authored |
| 400-line budget risk | High; configured guard is 2,000 |
| Chained PRs recommended | No; single PR is mandated |
| Suggested split | One PR, three verifiable work-unit commits |
| Delivery strategy | single-pr-default |
| Chain strategy | none |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | IA priority vertical slice | PR 1 | `cd backend && npm test -- parser-respuesta-ia servicio-evaluacion` | API evaluation with compatible, Java-excluded, and prompt-injection fixtures | Revert IA fields/ranking files; keep legacy evaluation |
| 2 | 30-day cursor sync | PR 1 | `cd backend && npm test -- sincronizacion` and frontend focused specs | Dashboard sync of 10,000 rows, cancel/resume, storage fallback | Disable new sync client; retain `GET /api/ofertas` |
| 3 | Contract/docs verification | PR 1 | backend + frontend suites | No external runtime: pilot deferred for evidence | Revert docs/tests only; no production behavior |

## Scope Decision

- [x] Implement slices 1–2 only: IA ranking and stored-offer synchronization form the useful vertical slice and stay within 2,000 authored lines.
- [x] Defer slice 3 (GetOnBrd coverage pilot, migration 019, checkpoints/metrics) to a follow-up; do not add pilot code or alter the weekly cron in this PR.

## Phase 1: IA Foundation and Persistence

- [x] 1.1 RED: add parser, detector, exclusion, cache-version and migration tests for legacy/extended JSON, negated terms, Java/seniority/locale rejection, dry-run, 30-day limit, and repeatable migration.
- [x] 1.2 Create `backend/sql/migracion-018-prioridad-ia-ofertas.sql`, detector, ranking, and backfill; modify `parser-respuesta-ia.js`, `servicio-evaluacion.js`, `evaluacion-cache.js`, `modelos/oferta.js` and `modelos/preferencia.js`.
- [x] 1.3 Wire preference/ranking endpoints in `controladores/{controlador-ofertas,controlador-preferencias}.js` and `rutas/{ofertas,preferencias}.js`; preserve legacy fallback and unchanged `match`/percentage.

## Phase 2: Cursor Synchronization

- [x] 2.1 RED: add integration tests for 10,000 unique IDs, fixed `maxId`, invalid/expired cursor, concurrent mutation `409`, cancellation and observable counts.
- [x] 2.2 Add the authenticated `GET /api/ofertas/sincronizacion` projection in `modelos/oferta.js`, controller and route with parameterized SQL, snapshot signature and 100–500 limit validation.
- [x] 2.3 RED/component tests for IndexedDB failure, deduplication, cancel/resume and progress; implement `ofertas.service.ts` and `persistencia-dashboard.service.ts` with `Map` fallback.
- [x] 2.4 Wire progress/cancel/fallback UI in `dashboard`, `tabla-ofertas` and `detalle-oferta`; update `oferta.model.ts`, `respuesta-api.model.ts` and `preferencia.model.ts`.

## Phase 3: Verification and Documentation

- [x] 3.1 Complete validation with a safe PostgreSQL database whose runtime name ends in `_test`: apply/reapply migration 018 and exercise the real cursor query, constraints, backfill and destructive model suite. Static/mocked contracts and non-DB suites are present, but this runtime proof is blocked until a documented safe test database is installed.
- [x] 3.1a Add component/controller/model contract checks mapping specs to `dashboard.spec.ts`, `tabla-ofertas.spec.ts`, `detalle-oferta.spec.ts`, `ofertas.service.spec.ts`, `persistencia-dashboard.service.spec.ts`, `sincronizacion-ofertas.test.js`, and `controlador-ofertas.test.js`; retain the recorded non-DB focused/full-suite evidence.
- [x] 3.2 Update `docs/evaluacion-ia.md`, `docs/api-rest.md`, `docs/base-de-datos.md`, `docs/frontend.md` and `docs/automatizacion.md` with rollout, fallback, limits, observability and rollback; record uncovered pilot scenarios as follow-up.

## Corrective Validation Status

- The implementation tasks in phases 1–2 and documentation task 3.2 have corresponding source, test, or documentation artifacts.
- Task 3.1 is complete after the public test tables were reassigned to `marcos`. The guarded runtime was `busca_empleos_test` as `marcos`; migration 018 applied once and re-applied with no pending migrations. `npm run test:db` passed 5 suites / 64 tests. The focused real-PostgreSQL harness verified the three migration constraints, backfill `dry-run` and `--apply` behavior limited to 30 days, and a cursor traversal with unique IDs equal to the declared total. The harness removed only its two uniquely identified fixture rows.
