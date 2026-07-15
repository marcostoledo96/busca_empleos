# Apply Progress: Cerrar alcance de ofertas con prioridad IA

## Mode and Delivery

- Mode: Standard testing (Strict TDD disabled).
- Delivery: single PR default.
- Scope: amendment of `ofertas-30-dias-prioridad-ia`; no pilot, coverage, checkpoints or migration 019.
- Changed scope: predecessor specs/progress, async IndexedDB reset and minimal runtime evidence only.

## Completed Tasks

- [x] 1.1–1.2 Predecessor contract and PostgreSQL `_test` progress amendment.
- [x] 2.1–2.3 Awaited IndexedDB reset, fallback and cursor-resume coverage.
- [x] 3.1–3.3 Runtime evaluation, dashboard and accessible-render evidence.
- [x] 4.1–4.2 Focused/full verification and apply artifact.

## Work Unit Evidence

| Work unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| Contract and reset | `npm --prefix frontend test -- --watch=false --include='src/app/servicios/persistencia-dashboard.service.spec.ts'` → PASS, 10 tests | Chrome/Karma persisted ID 801, awaited reset, persisted ID 802, recreated the service and rehydrated only ID 802 → PASS | Predecessor specs/progress, `persistencia-dashboard.service.ts` and its spec |
| Dashboard behavior | `npm --prefix frontend test -- --watch=false --include='src/app/paginas/dashboard/dashboard.spec.ts'` → PASS, 9 tests | Chrome/Karma proves reset resolves before the first request, memory fallback reaches 100%, cancellation resumes from cursor without duplicates, and unavailable preference keeps the usual order → PASS | `dashboard.ts` and `dashboard.spec.ts` |
| Evaluation and accessible evidence | `npm --prefix backend test -- --runInBand tests/servicios/servicio-evaluacion.test.js` → PASS, 1 suite / 57 tests; component specs → PASS, table 11 and detail 9 tests | Jest persists IA priority for hostile text while preserving `match`/percentage; Chrome/Karma renders evidence with ARIA for a rejected offer → PASS | Evaluation and component spec files only |

## Full Verification

| Command | Result |
|---|---|
| `npm --prefix backend test -- --runInBand` | PASS — 27 suites / 685 tests |
| `npm --prefix backend run test:db` | PASS — 5 suites / 65 tests against guarded `busca_empleos_test` |
| `npm --prefix frontend test -- --watch=false` | PASS — 175 tests |
| `npm --prefix frontend run build` | PASS — Angular production build |

## Scenario Traceability

| Scenario | Runtime test |
|---|---|
| New snapshot excludes previous IDs | `persistencia-dashboard.service.spec.ts` — reset/recreate test |
| Reset precedes first block; cancel/resume; storage fallback | `dashboard.spec.ts` — reset ordering, fallback and cancellation tests |
| Hostile text preserves evaluation | `servicio-evaluacion.test.js` — priority persistence test |
| Accessible priority evidence is not approval | `tabla-ofertas.spec.ts`, `detalle-oferta.spec.ts` — rejected offer rendering |
| PostgreSQL migration/backfill/cursor evidence | `npm --prefix backend run test:db` — 5 suites / 65 tests |

## Scope and Rollback

No pilot, external coverage, checkpoints, migration 019, dependencies, secrets or Railway access were added. Revert this change as one unit: the predecessor artifacts, reset implementation and listed tests. The legacy endpoint/listing remains unchanged.
