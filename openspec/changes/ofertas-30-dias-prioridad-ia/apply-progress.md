# Apply Progress: Ofertas de 30 días con prioridad IA

## Mode and Delivery

- Mode: Standard testing (Strict TDD disabled)
- Delivery: one PR, maintainer-approved `size:exception`
- Scope: slices 1–2 only; GetOnBrd pilot, migration 019, checkpoints and cron changes deferred
- Authored change estimate: approximately 925 changed lines (tracked diff plus new implementation files and OpenSpec progress/task edits), below the approved 2,000-line hard limit.

## Completed Tasks

- [x] Scope decisions for slices 1–2 and deferred pilot
- [x] 1.1–1.3 IA priority detector, parser compatibility, persistence, cache policy, backfill, preference validation and ranking
- [x] 2.1–2.4 Cursor snapshot endpoint, client persistence/fallback, cancel/progress UI and contracts
- [x] 3.1a Static/mocked contract checks and recorded non-DB suite evidence
- [x] 3.2 Documentation and deferred-pilot record
- [x] 3.1 Real PostgreSQL `_test` validation of migration 018, constraints, backfill and cursor query

## Work Unit Evidence

| Work unit | Focused test command and result | Runtime harness command/scenario and result | Rollback boundary |
|---|---|---|---|
| IA priority | `cd backend && npm test -- --runInBand tests/servicios/detector-prioridad-ia.test.js tests/servicios/servicio-ranking-ofertas.test.js tests/servicios/parser-respuesta-ia.test.js tests/controladores/controlador-ofertas.test.js` → PASS, 78 tests | `cd backend && npm test -- --runInBand` → PASS, 638 passed / 45 skipped; Supertest validates endpoint contract | Revert migration 018, detector/ranking/backfill, evaluation-cache and priority UI fields; legacy match evaluation remains |
| Cursor synchronization | `cd backend && npm test -- --runInBand tests/modelos/sincronizacion-ofertas.test.js tests/sql/migracion-018-prioridad-ia.test.js` → PASS, 3 tests; `cd frontend && npm test -- --watch=false --include=...` → PASS, 19 tests | Model harness consumed 10,000 unique IDs and returned controlled 409 on mutation; Angular Karma validates service/storage fallback | Revert sync route/model/client and disable cursor path; existing `GET /api/ofertas` remains |
| Contracts and docs | `cd frontend && npm run build && npm test -- --watch=false` → PASS, build plus 165 tests | No external pilot runtime by scope; backend/full frontend suites passed | Revert docs and task evidence only; no pilot or cron behavior exists |
| Real PostgreSQL `_test` validation (3.1) | `npm --prefix backend run test:db` → PASS, 5 suites / 65 tests. Migration 018 ran repeatedly; constraints, backfill de 30 días y cursor real fueron verificados. | Harness local `busca_empleos_test` con guarda `_test`; no se usó Railway. | Revert migration 018/backfill and their tests; no production database was used. |

## Validation Summary

- Carry-forward evidence from the prior apply attempt: backend full suite PASS — 638 passed, 45 skipped.
- Carry-forward evidence from the prior apply attempt: frontend build PASS and full Karma suite PASS — 165 tests.
- Carry-forward evidence from the prior apply attempt: JavaScript syntax checks PASS for changed backend modules.
- PostgreSQL runtime verification completed in `busca_empleos_test`: migration 018 is repeatable, its constraints reject invalid values, backfill respeta 30 días y el cursor real recorre el snapshot esperado.
- The guarded DB suite passed 5 suites / 65 tests without Railway.

## Corrective Artifact Audit

| Task area | Implementation/evidence confirmed | Status |
|---|---|---|
| IA priority (1.1–1.3) | Migration 018, detector, ranking, backfill, parser/cache/model/controller changes and targeted Jest files exist | Complete; real DB proof verified |
| Cursor synchronization (2.1–2.4) | Cursor model/controller/route, Angular client/storage/dashboard and 10,000-ID/controller/component test files exist | Complete; real DB proof verified |
| Docs (3.2) | IA, API, database, frontend and automation docs contain the delivered behavior and deferred-pilot boundary | Complete |

## Scope Amendment

The GetOnBrd pilot, external coverage, checkpoints, metrics and migration 019 are deferred to a
future approved change. They are not implemented or tested here.
