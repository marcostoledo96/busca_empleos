# Tasks: Estado operativo de cancelación de sincronización

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220–320 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR: backend contract + frontend runtime + docs |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Public snapshot metadata and HTTP contract | PR 1 | `npm --prefix backend test -- --runInBand` | Supertest: 200, invalid cursor, 409 | Backend model/tests and contract assertions |
| 2 | Cancel/resume state and accessible dashboard | PR 1 | `npm --prefix frontend test -- --watch=false` | Jasmine component: cancel, duplicate, resume, complete | Dashboard model/template/tests |
| 3 | Documentation and final gates | PR 1 | `npm --prefix frontend run build` | N/A: docs/build verification only | `docs/api-rest.md`, `docs/frontend.md` |

## Phase 1: Backend contract

- [x] 1.1 RED: extend `backend/tests/modelos/sincronizacion-ofertas.test.js` to require stable `fecha_corte`, `max_id`, `total_inicial` and reject cursor internals.
- [x] 1.2 Update `backend/src/modelos/oferta.js` to expose only public snapshot metadata while preserving `total` and cursor compatibility.
- [x] 1.3 RED/GREEN: extend `backend/tests/controladores/controlador-ofertas.test.js` for endpoint JSON success, invalid cursor and 409 with `exito: false`.

## Phase 2: Frontend state and runtime

- [x] 2.1 Add `RespuestaSincronizacionOfertas<T>` and `EstadoOperativoSincronizacion` to `frontend/src/app/modelos/respuesta-api.model.ts`.
- [x] 2.2 RED: extend `frontend/src/app/servicios/ofertas.service.spec.ts` to verify the existing URL/query and metadata transport.
- [x] 2.3 RED: extend `frontend/src/app/paginas/dashboard/dashboard.spec.ts` for unique/duplicate counts, cancellation snapshot, no false success, and resume deduplication.
- [x] 2.4 Update `frontend/src/app/paginas/dashboard/dashboard.ts` to reset state for new snapshots, count before persistence, advance only after confirmed save, freeze cancellation, and complete only at `recibidos === total_inicial`.
- [x] 2.5 Update `frontend/src/app/paginas/dashboard/dashboard.html` with accessible text for state, `fecha_corte`, `maxId`, total, unique received and duplicates; never announce completion for cancellation.
- [x] 2.6 GREEN: verify storage fallback remains in-memory and cancellation-after-completion preserves `completada`.

## Phase 3: Documentation and verification

- [x] 3.1 Document public fields, forbidden cursor internals and error semantics in `docs/api-rest.md`.
- [x] 3.2 Document local state transitions, deduplication and cancellation/resume semantics in `docs/frontend.md`.
- [x] 3.3 Run backend tests, frontend runtime tests and `npm --prefix frontend run build`; record results and uncovered scenarios.
- [x] 3.4 Update `tasks.md` checkboxes and apply-progress after each work unit; keep the implementation within the 400-line budget.
