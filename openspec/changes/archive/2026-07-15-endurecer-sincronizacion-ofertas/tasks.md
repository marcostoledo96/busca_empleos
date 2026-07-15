# Tasks: Endurecer sincronización de ofertas

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,650–1,950 authored |
| 400-line budget risk | High; configured review budget: 2,000 |
| Chained PRs recommended | No — single PR explicitly requested |
| Suggested split | Single PR: backend contract + frontend cancellation + docs/verification |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Backend secret and HTTP error contract | PR 1 | `npm --prefix backend test -- --runInBand sincronizacion-ofertas controlador-ofertas` | Start backend with production env missing secret; call sync endpoint with invalid cursor and mocked PG failure | `backend/src/modelos/oferta.js`, controller, backend tests |
| 2 | Abort active frontend synchronization safely | PR 1 | `npm --prefix frontend test -- --watch=false` | Browser/component scenario: pending block request → Cancelar → verify aborted request, preserved cursor, no legacy GET | Dashboard/service code and frontend tests |
| 3 | Operational docs and complete verification | PR 1 | `npm --prefix backend test -- --runInBand && npm --prefix frontend test -- --watch=false && npm --prefix frontend run build` | N/A: covered runtime boundaries are exercised by backend Supertest and Angular HTTP testing | `.env.example`, `docs/*`, spec/task evidence |

## Phase 1: RED tests and contracts

- [x] 1.1 Add failing frontend RED tests in `dashboard.spec.ts` and `ofertas.service.spec.ts` for pending HTTP cancellation, preserved confirmed cursor, `estado='cancelada'`, no legacy GET, and resume without duplicates.
- [x] 1.2 Add failing backend RED tests in `backend/tests/modelos/sincronizacion-ofertas.test.js` for production missing secret, non-production ephemeral warning, stable secret across reload, different-secret rejection, and cleanup/release.
- [x] 1.3 Add failing Supertest RED cases in `backend/tests/controladores/controlador-ofertas.test.js` mapping invalid limit/cursor→400, invalidated snapshot→409, unexpected PostgreSQL→generic 500 without internal details.

## Phase 2: GREEN implementation

- [x] 2.1 Update `frontend/src/app/paginas/dashboard/dashboard.ts` with a per-session `Subject<void>`/`takeUntil`, cancellation classification, confirmed-state preservation, and legacy fallback prohibition.
- [x] 2.2 Update `backend/src/modelos/oferta.js` to require non-empty `CURSOR_SINCRONIZACION_SECRETO` in production and use random fallback plus `logger.warn` only in development/test.
- [x] 2.3 Update `backend/src/controladores/controlador-ofertas.js` with the known-error whitelist (`CURSOR_SINCRONIZACION_INVALIDO`=400, `SINCRONIZACION_INVALIDADA`=409) and rethrow all unexpected failures to global 500 middleware.
- [x] 2.4 Run focused tests, then refactor only duplicated fixtures/helpers while preserving scenario-to-test traceability.

## Phase 3: Documentation and verification

- [x] 3.1 Document `CURSOR_SINCRONIZACION_SECRETO`, warning/fail-fast behavior, cursor invalidation on secret rotation, and rollback in `backend/.env.example` and `docs/arquitectura.md`.
- [x] 3.2 Document sync endpoint 400/409/500 taxonomy in `docs/api-rest.md` and cancellation/abort/resume behavior in `docs/frontend.md`.
- [x] 3.3 Map scenarios to tests in the verification report: secret (1.2), errors (1.3), cancel/resume (1.1); run full backend tests, frontend tests, and frontend build. No new E2E is required by design.
- [x] 3.4 Validate rollback: revert code/docs without migration; after secret rotation discard pending cursor and restart synchronization.
