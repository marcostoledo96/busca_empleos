```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:32e29af6ec12c2466e9539df74a7539bde0ea6ad268f557b2cc8409f760441ce
verdict: fail
blockers: 3
critical_findings: 3
requirements: 3/11
scenarios: 15/30
test_command: npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false
test_exit_code: 0
test_output_hash: sha256:811eb45731dc341e11b3d0dc6429e6cc3e05513866a13ee0e6d19486e479e1b3
build_command: npm --prefix frontend run build
build_exit_code: 0
build_output_hash: sha256:51d3f6b7432ab03fa23f02c5ca49d8296653b4304e004baf8cb308115606a431
```

## Verification Report

**Change**: `ofertas-30-dias-prioridad-ia`  
**Revision**: 2 (single corrective rerun)  
**Version**: N/A  
**Mode**: Standard (Strict TDD not detected)  
**Artifact store**: Hybrid (`both`)  
**Review authority**: `review-0ef0b036643c8eec-scope2`, generation 2, approved (carried from revision 1)  
**Receipt handling**: not reopened or revalidated in revision 2, as instructed  
**Candidate tree from approved revision-1 preflight**: `f280c51ab910ae5c0f32cacb6d66835f6754daaa`

### Completeness

| Metric | Value |
|---|---:|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |
| Spec requirements | 11 |
| Fully compliant requirements | 3 |
| Spec scenarios | 30 |
| Runtime-compliant scenarios | 15 |
| Partial scenarios | 5 |
| Untested/unimplemented scenarios | 10 |

The normative specs contain 11 requirements and 30 scenarios. Tasks explicitly defer the GetOnBrd pilot, migration 019, checkpoints and pilot metrics, but the corresponding 3 requirements and 7 scenarios remain normative in the retrieved specs.

### Build and Test Execution

| Evidence | Command | Exit | Result | Output SHA-256 |
|---|---|---:|---|---|
| Canonical full test command | `npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false` | 0 | Backend 27 suites/684 tests; DB 5 suites/65 tests; frontend 168 tests; exact output 235,701 bytes | `811eb45731dc341e11b3d0dc6429e6cc3e05513866a13ee0e6d19486e479e1b3` |
| Canonical frontend build | `npm --prefix frontend run build` | 0 | Angular production build passed; exact output 1,657 bytes | `51d3f6b7432ab03fa23f02c5ca49d8296653b4304e004baf8cb308115606a431` |

**Coverage**: not collected; no project coverage threshold is configured.

### Safe PostgreSQL and Runtime Harness Evidence

The following focused PostgreSQL harnesses are unchanged carry-forward evidence from revision 1 against the approved candidate tree; they were not rerun in revision 2. Revision 2 reran the full backend, safe DB and frontend suites above.

| Harness | Result | Output SHA-256 |
|---|---|---|
| DB preflight | `busca_empleos_test`, user `marcos`, `local-socket`, `_test` guard passed; no Railway access | `e7c4be8cc60a21b26b06d3c655d0b09221cf091c63d5cde097ec08b49e364a76` |
| Migration runner twice | Exit 0 twice; no pending migration remained | `3c66ab1fe3c088143d967d8ac7b76f68c2f0b155389b3deb6ba68d2a86875fd7` |
| Migration 018/backfill/cursor harness | Executed migration SQL twice against fixtures; preserved row count; verified 3 constraints and `23514` rejections; dry-run wrote nothing; apply touched only the recent row; preserved evaluation and description; rejected manipulated cursor; invalidated mutated snapshot; cleaned fixtures | `de04c050be305b4a7c9ad603f9316818b638de197f353ddcbe07118d70256cae` |
| Real 10,000-row cursor harness | Declared 10,000, received 10,000 unique IDs in 21 requests, preserved descriptions, excluded a concurrent later ID, cleaned 10,001 fixtures | `2624f593806e15bcc2297364891c3707c13a2f959e244d039f25d891dac1166d` |
| Cache/expired-cursor harness | Rejected a correctly signed but expired cursor; old policy cache hit remained readable only under its old hash and missed under the current policy hash; cleaned fixtures | `55ce9ccea3a2f535e263e4a97e0955d531e658237f0507bb342cd2adfe38f533` |
| Post-harness DB check | `ofertas` fixture count returned to 0 | N/A (diagnostic output) |

No secret file was read and no remote/Railway database was used.

### Corrective Gatekeeper Reassessment (Revision 2)

1. **Normative precedence confirmed**: the 3 pilot requirements and 7 pilot scenarios in `automatizacion` and `cobertura-scraping` still use normative `MUST`. `tasks.md` defers that slice, but neither proposal, design nor delta specs formally remove it from this change. Specs take precedence over task scheduling, so these obligations remain blockers and the change cannot pass.
2. **Eight delivered-slice scenarios rechecked against current tests**: none can be upgraded beyond the revision-1 status. Existing green tests prove lower-level pieces, not the complete scenario contracts:
   - evaluation → priority/evidence persistence while preserving match/percentage: **PARTIAL**;
   - untrusted job-text/prompt-injection isolation: **UNTESTED**;
   - legacy/unavailable preference fallback: **PARTIAL**;
   - rendered accessible priority evidence in list and detail: **PARTIAL**;
   - disabled/unavailable preference/storage fallback preserving order/exclusions and communicating fallback: **PARTIAL**;
   - cancel → resume from confirmed blocks without duplicates: **UNTESTED**;
   - persistent-storage failure through the complete dashboard progress/message contract: **PARTIAL**;
   - canceled-session operational observability with consistent counts and no false success: **UNTESTED**.
3. **IndexedDB reset defect confirmed at runtime**: current source clears only the in-memory `Map` and fallback flag. A read-only Playwright/native-IndexedDB semantics harness persisted old ID `101`, applied the exact observable reset, wrote new ID `202`, then executed the service's `getAll` + merge sequence. Exact output:

   ```json
   {"harness":"indexeddb-reset-rehydration-r2","resetClearedOnlyMemory":true,"fallbackAfterReset":false,"persistedIdsAfterNewBlock":[101,202],"rehydratedIds":[101,202],"staleRowRehydrated":true,"verdict":"BUG_CONFIRMED"}
   ```

   Output SHA-256 (including final newline): `a5d3d5fe14541ab13a855117228376ca0237d352b729b9a70ec615eea9e9b167`.
4. **Apply-progress 3.1 inconsistency confirmed**: `tasks.md` marks 3.1 complete and the current DB suite passes 65/65, while OpenSpec `apply-progress.md` still marks 3.1 unchecked/blocked and retains the old permissions failure. No planning artifact was edited during verification.

### Spec Compliance Matrix

| Requirement | Scenario | Runtime evidence | Result |
|---|---|---|---|
| Bonus por buen uso de herramientas IA | Oferta compatible recibe prioridad IA | Detector/ranking tests and DB backfill harness pass, but no test covers the complete evaluation → persistence path while asserting unchanged match/percentage | ⚠️ PARTIAL |
| Bonus por buen uso de herramientas IA | Java excluyente conserva rechazo | `servicio-evaluacion.test.js` — “oferta con Java + IA…” and pre/post exclusion tests | ✅ COMPLIANT |
| Bonus por buen uso de herramientas IA | Seniority, idioma o ubicación conservan rechazo | `reglas-exclusion.test.js` IA + senior/English cases and `servicio-evaluacion.test.js` senior/location cases | ✅ COMPLIANT |
| Bonus por buen uso de herramientas IA | Evidencia no confiable no altera evaluación | Pure detector exists, but no runtime prompt-injection fixture verifies unchanged evaluation output | ❌ UNTESTED |
| Schema estricto de respuesta IA | JSON legacy válido sin fence | `parser-respuesta-ia.test.js` legacy valid cases | ✅ COMPLIANT |
| Schema estricto de respuesta IA | JSON extendido válido con fence | `parser-respuesta-ia.test.js` extended fenced case | ✅ COMPLIANT |
| Schema estricto de respuesta IA | Campo legacy ambiguo es inválido | `parser-respuesta-ia.test.js` string boolean cases | ✅ COMPLIANT |
| Schema estricto de respuesta IA | Extensión inválida usa fallback | `parser-respuesta-ia.test.js` invalid extension normalization | ✅ COMPLIANT |
| Preferencia compatible de prioridad IA | Usuario habilita prioridad | Backend ranking test and Angular dashboard bonus-limit test | ✅ COMPLIANT |
| Preferencia compatible de prioridad IA | Cliente legacy o preferencia inaccesible | Disabled ranking is tested; preference read failure/legacy response fallback is not exercised at component runtime | ⚠️ PARTIAL |
| Persistencia aditiva y cacheada de prioridad IA | Backfill de prueba | Real `_test` DB harness verifies dry-run without writes | ✅ COMPLIANT |
| Persistencia aditiva y cacheada de prioridad IA | Backfill excluye ofertas históricas | Real `_test` DB harness verifies the 31-day row remains unchanged in dry-run/apply | ✅ COMPLIANT |
| Persistencia aditiva y cacheada de prioridad IA | Política de caché cambia | Real cache harness proves old-policy hit and current-policy miss while preserving old match payload | ✅ COMPLIANT |
| Persistencia aditiva y cacheada de prioridad IA | Migración repetible y segura | Real `_test` DB harness executes migration 018 twice, preserves rows and verifies constraints | ✅ COMPLIANT |
| Ranking IA explicable y accesible | Prioridad habilitada y explicada | Ranking test passes and templates compile with text/ARIA bindings; no component test renders and asserts evidence in list and detail | ⚠️ PARTIAL |
| Ranking IA explicable y accesible | Fallback sin prioridad | Disabled ranking test passes; no component test exercises failed preference/storage while asserting order, exclusions and fallback message | ⚠️ PARTIAL |
| Métricas aisladas del piloto de cobertura | Piloto finaliza por motivo contractual | Explicitly deferred; no implementation or runtime test | ❌ UNTESTED |
| Métricas aisladas del piloto de cobertura | Piloto deshabilitado | Existing cron remains static, but no scenario test covers the specified pilot-disabled contract | ❌ UNTESTED |
| Recorrido completo, estable y seguro por cursor | Recorrido completo del snapshot lógico | Real 10,000-row PostgreSQL harness | ✅ COMPLIANT |
| Recorrido completo, estable y seguro por cursor | Inserción concurrente queda fuera del snapshot | Real 10,000-row harness inserts ID after first block and proves exclusion/unchanged total | ✅ COMPLIANT |
| Recorrido completo, estable y seguro por cursor | Borrado o actualización invalida el snapshot | Real `_test` DB harness mutates a snapshot row and receives `SINCRONIZACION_INVALIDADA`; controller 409 test also passes | ✅ COMPLIANT |
| Recorrido completo, estable y seguro por cursor | Cursor inválido o manipulado | Real harnesses reject manipulated and correctly signed expired cursors | ✅ COMPLIANT |
| Transferencia cancelable con almacenamiento resiliente | Cancelación y reanudación | No runtime test exercises cancel → resume with confirmed blocks and no duplicates | ❌ UNTESTED |
| Transferencia cancelable con almacenamiento resiliente | Falla de almacenamiento persistente | Service tests cover memory fallback/deduplication and IndexedDB rehydration, but not the full dashboard fallback message and progress contract | ⚠️ PARTIAL |
| Observabilidad y rollback de sincronización | Sesión cancelada es observable | No runtime test or structured operational state proves cancellation, counts and absence of false success | ❌ UNTESTED |
| Piloto condicionado por contrato externo probado | Evidencia habilita piloto | Explicitly deferred; no implementation or runtime test | ❌ UNTESTED |
| Piloto condicionado por contrato externo probado | Evidencia ausente | Explicitly deferred; no implementation or runtime test | ❌ UNTESTED |
| Checkpoints, límites y terminación observable | Finalización por corte comprobado | Explicitly deferred; no implementation or runtime test | ❌ UNTESTED |
| Checkpoints, límites y terminación observable | Finalización por páginas agotadas | Explicitly deferred; no implementation or runtime test | ❌ UNTESTED |
| Checkpoints, límites y terminación observable | Timeout o cancelación | Explicitly deferred; no implementation or runtime test | ❌ UNTESTED |

**Compliance summary**: 15/30 scenarios compliant, 5 partial, 10 untested/unimplemented.

### Correctness (Static Evidence)

| Requirement area | Status | Evidence |
|---|---|---|
| Priority signal isolation | ✅ Implemented | `detectarPrioridadIa()` is pure; ranking adds a bounded bonus without mutating match fields; exclusion checks still precede/follow IA evaluation |
| Configurable bounded bonus | ✅ Implemented | Backend and frontend clamp `bonus_maximo_prioridad_ia` to 0..6; migration and controller validate the same range |
| Description preservation | ✅ Implemented | Cursor projection selects `descripcion`; real 10,000-row and focused DB harnesses assert it |
| Cache versioning | ✅ Implemented | `crearHashPreferencias()` includes `VERSION_PRIORIDAD_IA` |
| Migration/backfill 30-day boundary | ✅ Implemented | Additive SQL, constraints, date-bounded SELECT and UPDATE; proven on `_test` DB |
| Cursor snapshot | ✅ Implemented | Signed v1 cursor, 30-minute expiry, fixed `fecha_corte`/`max_id`, `(id,xmin)` signature and 409 invalidation |
| IndexedDB rehydration/fallback | ⚠️ Incomplete reset behavior | Rehydration and memory fallback exist, but `limpiarSincronizacion()` clears only the in-memory `Map`, not the IndexedDB object store |
| Pilot coverage | ❌ Not implemented | Deferred by tasks while still present in normative specs |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Detector and ranking remain separate from match | ✅ Yes | Runtime exclusion/ranking evidence passes |
| Native APIs/no new dependency | ✅ Yes | Uses `crypto`, IndexedDB, `fetch`/Angular HTTP and PostgreSQL |
| Keyset cursor with fixed universe and mutation signature | ✅ Yes | Real 10,000-row, insertion and invalidation harnesses pass |
| IndexedDB with memory fallback | ⚠️ Partial | Rehydration/fallback pass, but reset does not clear persisted rows |
| Pilot GetOnBrd and migration 019 | ❌ Deferred | Tasks narrowed scope, but proposal/design/specs were not amended to remove normative obligations |
| OpenSpec/Engram progress coherence | ⚠️ No | Engram apply-progress and `tasks.md` say complete; OpenSpec `apply-progress.md` still says task 3.1 is pending/blocked |

### Issues Found

**CRITICAL**

1. **Normative pilot scope is unimplemented**: 3 requirements and 7 scenarios in `automatizacion`/`cobertura-scraping` remain normative, while tasks explicitly defer their implementation. Specs take precedence, so final compliance cannot pass.
2. **Required runtime scenario coverage is incomplete in delivered slices**: 8 non-pilot scenarios are only partial or untested. Per SDD verification rules, source inspection and a green aggregate suite cannot mark those scenarios compliant.
3. **Snapshot reset leaves stale IndexedDB rows**: `PersistenciaDashboardService.limpiarSincronizacion()` clears only the `Map`. A fresh/restarted snapshot can rehydrate rows from the previous snapshot, violating consistent restart/deduplication semantics.

**WARNING**

1. `openspec/.../apply-progress.md` is stale and still marks 3.1 blocked, contradicting `tasks.md`, Engram apply-progress and the current successful `_test` DB evidence.
2. `controlador-ofertas.js` returns internal `error.message` content for synchronization failures (approved review finding R1-001, informational there); sanitize unexpected errors at the trust boundary.
3. No coverage report or threshold is configured, so line/branch coverage was not evaluated.

**SUGGESTION**

1. Before archive, either amend the delta specs to formally remove/defer the pilot requirements from this change or implement and test them in a separate normative change.
2. Add scenario-level runtime tests for evaluation→priority persistence, prompt-injection isolation, preference/storage fallback, rendered accessible evidence, cancel/resume and cancellation observability.
3. Add a runtime test proving that snapshot reset clears persisted IndexedDB rows before a new synchronization.

### Canonical Verification Evidence

The exact UTF-8 preimage is the content inside the following fenced block, excluding the fence delimiters and including the final newline.

<!-- canonical-evidence-preimage:start -->
```text
schema=gentle-ai.verification-evidence/v1
verification_revision=2
change=ofertas-30-dias-prioridad-ia
mode=standard
artifact_store=both
review_receipt=approved-not-reopened
review_lineage=review-0ef0b036643c8eec-scope2
review_generation=2
candidate_tree=f280c51ab910ae5c0f32cacb6d66835f6754daaa
requirements_total=11
requirements_complete=3
scenarios_total=30
scenarios_compliant=15
scenarios_partial=5
scenarios_untested=10
tasks_total=12
tasks_complete=12
tasks_incomplete=0
apply_progress_3_1=stale-pending-contradicts-tasks-and-runtime
pilot_formally_out_of_scope=false
test_command=npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false
test_exit_code=0
test_output_hash=sha256:811eb45731dc341e11b3d0dc6429e6cc3e05513866a13ee0e6d19486e479e1b3
test_output_bytes=235701
build_command=npm --prefix frontend run build
build_exit_code=0
build_output_hash=sha256:51d3f6b7432ab03fa23f02c5ca49d8296653b4304e004baf8cb308115606a431
build_output_bytes=1657
indexeddb_harness=playwright-native-indexeddb-read-only-semantics
indexeddb_harness_exit_code=0
indexeddb_harness_output_hash=sha256:a5d3d5fe14541ab13a855117228376ca0237d352b729b9a70ec615eea9e9b167
indexeddb_harness_output={"harness":"indexeddb-reset-rehydration-r2","resetClearedOnlyMemory":true,"fallbackAfterReset":false,"persistedIdsAfterNewBlock":[101,202],"rehydratedIds":[101,202],"staleRowRehydrated":true,"verdict":"BUG_CONFIRMED"}
critical_findings=3
blockers=3
verdict=fail
```
<!-- canonical-evidence-preimage:end -->

### Verdict

**FAIL**

The revision-2 suites and build pass, and the revision-1 PostgreSQL/cursor harness evidence remains bound to the approved candidate tree. The implementation still does not satisfy all normative specs, required scenario-level runtime evidence is incomplete, and the IndexedDB reset defect is runtime-confirmed. No implementation or planning artifact was edited and no commit/push was performed.
