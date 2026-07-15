```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d01e0adddbc73bac99898c4e954caaecd8212b36b73487965f81e27883109cbe
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 12/12
test_command: "npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless"
test_exit_code: 0
test_output_hash: sha256:3bf112f0d9b75f87905ee250e9ba8b16d4f4c7120c162b0be8bca87734462754
build_command: "npm --prefix frontend run build"
build_exit_code: 0
build_output_hash: sha256:5dfc71f106a7dbc6f9527789ec40c931d2cb1a8bef512abc8090783061de5745
```

## Verification Report

**Change**: `endurecer-sincronizacion-ofertas`
**Version**: N/A
**Mode**: Standard testing (Strict TDD disabled)
**Artifact store**: Hybrid (`openspec` + Engram)
**Review authority**: `review-ca14d3f5fddd775c`, correction generation 1, revision `sha256:3b091a28e6ad04a79e8cd9f1937f113f902be48fbaedb7963e970acae938ef13`
**Preflight identity**: review lineage and authority revision above; canonical evidence revision `sha256:d01e0adddbc73bac99898c4e954caaecd8212b36b73487965f81e27883109cbe`.

### Canonical Verification Evidence

The exact canonical evidence bytes are the single JSON line plus its trailing LF between the markers below. The leading envelope's `evidence_revision` is its SHA-256 digest.

<!-- BEGIN CANONICAL VERIFICATION EVIDENCE -->
```json
{"authority_lineage":"review-ca14d3f5fddd775c","authority_revision":"sha256:3b091a28e6ad04a79e8cd9f1937f113f902be48fbaedb7963e970acae938ef13","build_command":"npm --prefix frontend run build","build_exit_code":0,"build_output_bytes":1657,"build_output_hash":"sha256:5dfc71f106a7dbc6f9527789ec40c931d2cb1a8bef512abc8090783061de5745","change":"endurecer-sincronizacion-ofertas","critical_findings":[],"requirements_complete":5,"requirements_total":5,"review_generation":1,"scenarios_complete":12,"scenarios_total":12,"schema":"gentle-ai.verification-evidence/v1","test_command":"npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless","test_exit_code":0,"test_output_bytes":251798,"test_output_hash":"sha256:3bf112f0d9b75f87905ee250e9ba8b16d4f4c7120c162b0be8bca87734462754","verdict":"pass"}
```
<!-- END CANONICAL VERIFICATION EVIDENCE -->

### Completeness

| Metric | Value |
|---|---:|
| Tasks total | 11 |
| Tasks complete | 11 |
| Tasks incomplete | 0 |
| Requirements fully compliant | 5 / 5 |
| Scenarios fully compliant | 12 / 12 |

### Build & Tests Execution

| Check | Result | Current runtime evidence |
|---|---|---|
| Backend full suite | ✅ PASS | 27 suites / 692 tests |
| PostgreSQL `_test` suite | ✅ PASS | 5 suites / 70 tests against the runtime-guarded test database |
| Frontend full suite | ✅ PASS | 178 / 178 Karma tests in Chrome Headless 149 |
| Production build | ✅ PASS | Angular production bundle generated successfully |

**Test command**: `npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless`
**Test output**: 251,798 bytes; SHA-256 `3bf112f0d9b75f87905ee250e9ba8b16d4f4c7120c162b0be8bca87734462754`.
**Build command**: `npm --prefix frontend run build`
**Build output**: 1,657 bytes; SHA-256 `5dfc71f106a7dbc6f9527789ec40c931d2cb1a8bef512abc8090783061de5745`.
**Coverage**: ➖ Not available; no coverage threshold or verification command is defined for this change.

The backend and DB runs emitted the expected fallback warning when the cursor secret was absent under `NODE_ENV=test`. The frontend run also emitted the pre-existing polling warning cases exercised by their passing tests; neither warning represented a command failure.

### Spec Compliance Matrix

| Requirement | Scenario | Passing runtime evidence | Result |
|---|---|---|---|
| Secreto de firma según ambiente | producción sin secreto | `sincronizacion-ofertas.test.js` > `rechaza iniciar en producción sin CURSOR_SINCRONIZACION_SECRETO` | ✅ COMPLIANT |
| Secreto de firma según ambiente | fallback no productivo | `sincronizacion-ofertas.test.js` > `usa un secreto efímero y advierte fuera de producción` | ✅ COMPLIANT |
| Secreto de firma según ambiente | reinicio con secreto estable | `sincronizacion-ofertas.test.js` > `acepta un cursor tras recargar el módulo con el mismo secreto` | ✅ COMPLIANT |
| Clasificación pública de errores de sincronización | parámetro inválido | `controlador-ofertas.test.js` > `rechaza límites fuera del contrato 100 a 500`; `retorna error sin éxito para un cursor inválido` | ✅ COMPLIANT |
| Clasificación pública de errores de sincronización | snapshot invalidado | `controlador-ofertas.test.js` > `mapea una mutación concurrente a 409 controlado` | ✅ COMPLIANT |
| Clasificación pública de errores de sincronización | error operativo inesperado | `controlador-ofertas.test.js` > `delega un error operativo inesperado al middleware global como 500 genérico` | ✅ COMPLIANT |
| Cobertura de regresión de sincronización | ejecución de regresión | Canonical backend + DB `_test` + frontend command above; all changed runtime scenarios passed | ✅ COMPLIANT |
| Transferencia cancelable con almacenamiento resiliente | cancelación y reanudación | `dashboard.spec.ts` > `cancela, conserva el snapshot accesible y reanuda sin duplicar IDs` | ✅ COMPLIANT |
| Transferencia cancelable con almacenamiento resiliente | cancelación durante una petición pendiente | `dashboard.spec.ts` > `aborta el bloque pendiente, conserva el cursor confirmado y no usa el listado legacy`; `ofertas.service.spec.ts` > `debería abortar el bloque de sincronización cuando se desuscribe` | ✅ COMPLIANT |
| Transferencia cancelable con almacenamiento resiliente | falla de almacenamiento persistente | `dashboard.spec.ts` > `informa fallback en memoria y conserva el progreso del bloque confirmado`; `persistencia-dashboard.service.spec.ts` > `deduplica bloques en memoria cuando IndexedDB no está disponible` | ✅ COMPLIANT |
| Transferencia cancelable con almacenamiento resiliente | snapshot nuevo no rehidrata IDs previos | `dashboard.spec.ts` > `espera el reset persistente antes del primer bloque de un snapshot nuevo`; `persistencia-dashboard.service.spec.ts` > `limpia IndexedDB antes de guardar y rehidratar un snapshot nuevo` | ✅ COMPLIANT |
| Observabilidad y rollback de sincronización | metadatos públicos seguros y estables | `sincronizacion-ofertas.test.js` > `expone metadatos públicos estables sin filtrar internos del cursor` | ✅ COMPLIANT |
| Observabilidad y rollback de sincronización | sesión cancelada es observable | `dashboard.spec.ts` > `cancela, conserva el snapshot accesible y reanuda sin duplicar IDs` | ✅ COMPLIANT |

**Compliance summary**: 12 / 12 scenarios compliant.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Secreto de firma según ambiente | ✅ Implemented | `oferta.js` fails at module load in production without a secret, uses `crypto.randomBytes` plus `logger.warn` in development/test, and signs/verifies with the configured HMAC secret. |
| Clasificación pública de errores de sincronización | ✅ Implemented | The controller whitelists only invalid cursor (`400`) and invalidated snapshot (`409`); all other failures are rethrown to the global generic `500` middleware. |
| Cobertura de regresión de sincronización | ✅ Implemented | Backend, guarded PostgreSQL, Angular component/service, and production build checks produced the recorded output hashes. |
| Transferencia cancelable con almacenamiento resiliente | ✅ Implemented | A per-session `Subject<void>` and `takeUntil` abort the active request; cancellation preserves the confirmed cursor/state and returns before the legacy listing path. |
| Observabilidad y rollback de sincronización | ✅ Implemented | Existing model and dashboard tests prove stable safe metadata, unique/duplicate counts, cancelled state and no false completion. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Cancel by RxJS unsubscription | ✅ Yes | `Subject<void>` + `takeUntil` is used without changing the service interface; `HttpTestingController.cancelled` proves transport teardown. |
| Resolve the cursor secret in `oferta.js` | ✅ Yes | No one-use configuration abstraction or dependency was added. |
| Whitelist public HTTP contract errors | ✅ Yes | Only the specified `400`/`409` codes are handled locally; unexpected PostgreSQL failures reach the existing global middleware. |
| Keep endpoint, DTO and persistence unchanged | ✅ Yes | No new endpoint, table, migration, or dependency was introduced. |

### Issues Found

**CRITICAL**: None.
**WARNING**: `apply-progress.md` says `10/10`, while the tasks artifact and native SDD status contain 11 checked tasks. This is a non-blocking metadata count error; no task is pending.
**SUGGESTION**: None.

### Verdict

**PASS**

All 11 tasks are checked, all 5 requirements and 12 scenarios have passing runtime coverage, and the recorded evidence belongs to correction lineage `review-ca14d3f5fddd775c` at authority revision `sha256:3b091a28e6ad04a79e8cd9f1937f113f902be48fbaedb7963e970acae938ef13`.

**Result Contract**: `PASS`
