# Apply Progress: Safe GetOnBrd Pilot

## Status

All 13 tasks are complete. Mode: Standard (RED/GREEN tests requested by the task plan; Strict TDD is disabled).
Delivery: single PR with approved `size:exception` under the 2,000-line budget.

## Completed Tasks

- [x] 1.1–1.3 Guard, evidence validation, and inactive backend/frontend registries.
- [x] 2.1–2.5 Fixture client, Result Contract, 30-day window, canonical URL deduplication, defensive paging, cancellation, timeout, checkpoints, and metrics.
- [x] 3.1–3.3 Blocked shadow endpoint and automation exclusion.
- [x] 4.1–4.3 Documentation, verification, rollback, and production-block evidence.

## Result Contract Evidence

- `backend/src/config/getonbrd.js:33-42` accepts only the exact sandbox by default and denies production without the enabled flag plus current, scoped, SHA-identified evidence.
- `backend/src/servicios/servicio-scraping.js:541-547` builds and returns the Result Contract before invoking a client when the policy denies a destination.
- `backend/src/servicios/servicio-scraping.js:571-641` implements injected client/signal, timeout, defensive pagination, canonical deduplication, 30-day filtering, checkpoints, metrics, and termination reasons.
- `backend/src/controladores/controlador-scraping.js:228-243` returns the blocked HTTP Result Contract with zero requests and no offers; its test proves zero service and `crearOferta` calls.

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness and exact result | Rollback boundary |
|---|---|---|---|
| Guard and registries | `npm test -- --runInBand tests/config/getonbrd.test.js tests/servicios/getonbrd-piloto.test.js tests/controladores/controlador-scraping.test.js tests/servicios/servicio-automatizacion.test.js` → 4 suites, 76 tests passed | N/A for live execution: production is deliberately forbidden; unit tests assert the client is not called for production | `backend/src/config/getonbrd.js`, both registries, frontend selector/service removal |
| Fixture Result Contract | Same focused command → `getonbrd-piloto.test.js` passed 4 tests covering unique 30-day offers, empty stop, HTTP error, cancellation, timeout, checkpoint resume, limits, and metrics | `node -e ... ejecutarScrapingGetonbrd({ destino: DESTINO_SANDBOX, cliente: fixture })` → `{"destino":"sandbox","motivo":"pagina_vacia","requests":1}`; no network or DB | `backend/src/servicios/servicio-scraping.js`, `backend/tests/fixtures/getonbrd/`, pilot tests |
| Endpoint, automation, docs | `npm test -- --runInBand tests/controladores/controlador-scraping.test.js tests/servicios/servicio-automatizacion.test.js` → included in focused run above; controller and automation assertions passed | Supertest/mocks only: blocked endpoint returns zero-request contract and automation reports GetOnBrd as zero without invocation | Controller, automation mapping, frontend panel/service, docs |

## Full Verification

| Command | Result |
|---|---|
| `npm test -- --runInBand` in `backend` | 29 suites, 698 tests passed |
| `npm test -- --watch=false --browsers=ChromeHeadless` in `frontend` | 178 tests passed |
| `npm run build` in `frontend` | Passed; output at `frontend/dist/frontend` |
| `git diff --check` | Passed with no whitespace errors |
| Static search for product host / legacy base in `backend/src` | Only `backend/src/config/getonbrd.js:2-3` contains the host as the guarded authorization target; no scraper/automation/UI caller targets it |

## Production Safety Evidence

- The production denial test supplies a production destination and a mock client; the Result Contract is `estado: bloqueado`, `motivo_terminacion: politica_destino`, and the client has zero calls.
- Missing, expired, wrong-scope evidence and an isolated enabled boolean are denied by `backend/tests/config/getonbrd.test.js`.
- The HTTP endpoint test asserts zero calls to `ejecutarScrapingGetonbrd` and `modeloOferta.crearOferta`.
- GetOnBrd is absent from `SCRAPERS`, absent from active frontend controls, and inactive in both registries.

## DB Verification

No new schema, query, migration, or persistence behavior was introduced. The safe boundary is tested by mocked `crearOferta` zero-call assertions; no separate DB mutation was run.

## Rollback

Revert only the GetOnBrd config/service/controller/registry/UI/test/doc files listed above. The adapter remains disabled, has no production data, no cron schedule, and no migration to reverse.

## Uncovered Scenarios

No real GetOnBrd sandbox or production request was made by design. A future authorized rollout still needs external evidence review and a real sandbox contract check.
