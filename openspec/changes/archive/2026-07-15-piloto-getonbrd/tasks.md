# Tasks: Safe GetOnBrd Pilot

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,700–1,950 authored |
| 400-line budget risk | High; review budget 2,000 |
| Chained PRs recommended | No — single-PR requested |
| Suggested split | Single PR with `size:exception` |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Guard, config, inactive registries | Single PR | `npm --prefix backend test -- --runInBand config registry` | N/A: production/live execution forbidden | Revert config and registry files |
| 2 | Fixture client and observable Result Contract | Single PR | `npm --prefix backend test -- --runInBand servicio-scraping` | Fixture sandbox only; no network/BD | Revert scraper and fixture files |
| 3 | Endpoint, automation exclusion, docs | Single PR | `npm --prefix backend test -- --runInBand controlador servicio-automatizacion` | Supertest/mocks; no live production | Revert route, tests, and docs |

## Phase 1: Guards and registries

- [x] 1.1 RED: test alternate host, missing/expired/wrong-scope evidence, and isolated `GETONBRD_ENABLED=true`; each blocks before `fetch`.
- [x] 1.2 Create `backend/src/config/getonbrd.js` with exact sandbox host, limits, versioned evidence fields, and deny-by-default guard; no production calls.
- [x] 1.3 Modify `backend/src/config/plataformas.js` and `frontend/src/app/config/plataformas.ts` to preserve GetOnBrd inactive and unavailable as an active source; test metadata and UI behavior.

## Phase 2: Fixture client and Result Contract

- [x] 2.1 Create `backend/tests/fixtures/getonbrd/paginas.js` with deterministic paginated, empty, duplicate, invalid, old, timeout, and HTTP-error responses.
- [x] 2.2 RED: add service tests for `run_id`, canonical URL normalization, 30-day classification, intra-run/URL deduplication, pagination ceilings, empty-page stop, and `total_pages` as a ceiling.
- [x] 2.3 RED: add tests for timeout, external cancellation, checkpoint preservation, callback ordering, and explicit termination reasons/metrics.
- [x] 2.4 Extend `ejecutarScrapingGetonbrd` in `backend/src/servicios/servicio-scraping.js` with injected client/signal/clock/checkpoint callback, defensive paging, limits, deduplication, and metrics; return the Result Contract without `crearOferta`.
- [x] 2.5 GREEN/REFACTOR: prove fixture scenarios retain only unique offers within 30 days and resume from the last confirmed page; assert no real host, DB, or cron access.

## Phase 3: HTTP and automation wiring

- [x] 3.1 RED: test `backend/src/controladores/controlador-scraping.test.js` for blocked production/inactive requests, Result Contract response, and zero `crearOferta` calls.
- [x] 3.2 Modify `backend/src/controladores/controlador-scraping.js` to run sandbox/fixtures only, apply the guard, and return `run_id`, status, termination reason, checkpoint, offers, and metrics.
- [x] 3.3 RED/GREEN: update `backend/tests/servicios/servicio-automatizacion.test.js` to prove GetOnBrd is absent from active scrapers/cron and reports zero while active platforms still run.

## Phase 4: Documentation and full verification

- [x] 4.1 Update `docs/scraping.md`, `docs/automatizacion.md`, and `docs/api-rest.md` with API-only scope, authorization evidence, limits, metrics, checkpoints, terminations, rollout, and disable-only rollback.
- [x] 4.2 Run full verify: backend Jest suite, frontend tests/build, contract checks, fixture-only runtime harness, and static search proving no live GetOnBrd host or persistence path.
- [x] 4.3 Record uncovered scenarios, exact commands/results, rollback readiness, and confirm no live production execution.
