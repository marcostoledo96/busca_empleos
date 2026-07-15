# Apply Progress: Endurecer sincronización de ofertas

## Status

- Mode: Standard (strict TDD disabled); requested RED → GREEN cycles completed.
- Delivery: single PR with maintainer-approved `size:exception` (2,000-line limit).
- Completed tasks: 11/11 (1.1–3.4).
- Scope: issue #1 on `fix/endurecer-sincronizacion-ofertas`.

## Result Contract

| Requested outcome | Delivered evidence |
|---|---|
| Cancel a pending HTTP block and preserve confirmed state without legacy fallback | `Dashboard` owns a session `Subject<void>` and applies `takeUntil`; the cancellation test proves teardown, preserved cursor/state `cancelada`, and no `GET /api/ofertas`. |
| Require a stable cursor secret in production | `oferta.js` rejects a blank production secret, uses an ephemeral fallback only with development/test warning, and tests prove same-secret reload acceptance and different-secret rejection. |
| Return 400/409 contract errors and generic 500 operational failures | Controller whitelists only `CURSOR_SINCRONIZACION_INVALIDO` (400) and `SINCRONIZACION_INVALIDADA` (409); Supertest proves PostgreSQL failure reaches global generic 500. |
| Update tests and operational documentation | Backend/frontend tests, `.env.example`, architecture, API, and frontend docs were updated. |

## Scenario-to-test traceability

| Spec scenario | Test coverage |
|---|---|
| Pending-request cancellation, confirmed cursor, no legacy fallback, resume without duplicates | `frontend/src/app/paginas/dashboard/dashboard.spec.ts`; `frontend/src/app/servicios/ofertas.service.spec.ts` |
| Missing production secret, dev/test fallback warning, stable and rotated secret behavior | `backend/tests/modelos/sincronizacion-ofertas.test.js` |
| Invalid parameter/cursor 400, invalidated snapshot 409, operational PostgreSQL failure 500 | `backend/tests/controladores/controlador-ofertas.test.js` |

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| Backend secret and HTTP contract | RED: `npm test -- --runInBand tests/modelos/sincronizacion-ofertas.test.js tests/controladores/controlador-ofertas.test.js` → exit 1; 3 failed, 40 passed. GREEN: same command → exit 0; 43 passed. | Supertest executes the real Express route and global middleware with a mocked PostgreSQL error → generic 500; module reload checks production configuration. | `backend/src/modelos/oferta.js`, `backend/src/controladores/controlador-ofertas.js`, and their tests. |
| Abort active frontend synchronization | RED: `npm test -- --watch=false --browsers=ChromeHeadless` → exit 1; 1 failed, 177 passed. GREEN: same command → exit 0; 178 passed. | Angular `HttpTestingController` verifies HTTP request cancellation on unsubscribe; dashboard pending-observable scenario verifies abort, cursor/state preservation, and no legacy GET. | `frontend/src/app/paginas/dashboard/dashboard.ts` and frontend synchronization tests. |
| Documentation and complete verification | `npm test -- --runInBand` (backend) → exit 0; 27 suites, 692 tests. `npm test -- --watch=false --browsers=ChromeHeadless` (frontend) → exit 0; 178 passed. `npm run build` (frontend) → exit 0. | `npm run test:db` → exit 0; 5 suites, 70 tests against guarded test DB. No separate E2E boundary exists; backend Supertest and Angular HTTP tests cover changed runtime boundaries. | `backend/.env.example`, `docs/arquitectura.md`, `docs/api-rest.md`, `docs/frontend.md`, and OpenSpec task evidence. |

## Rollback

No migrations or dependencies were added. Revert the files named in each work-unit boundary; after rotating `CURSOR_SINCRONIZACION_SECRETO`, discard the pending cursor and restart synchronization.

## Diff and safety checks

- `git diff --check` completed with exit 0.
- Intended tracked source/test/doc diff: 181 additions, 15 deletions (196 lines); below the maintainer-approved 2,000-line limit.
- Pre-existing `.atl`, `PLANIFICACION.md`, `.codegraph`, and `EXPLORACION/PLAN` changes were not modified, staged, committed, or pushed.
