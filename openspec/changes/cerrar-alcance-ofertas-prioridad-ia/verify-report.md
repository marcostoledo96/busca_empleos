```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0040b8deb0044d9225b6f81cfdaf8f6e187bb8bc7f0f58dcc1e94f3fd1ecaec7
verdict: fail
blockers: 1
critical_findings: 1
requirements: 5/6
scenarios: 6/7
test_command: "npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false"
test_exit_code: 0
test_output_hash: sha256:57b474fb1adec6ffec6571910dc7ed88e1c1871af688666549f3e5c2764ad539
build_command: "npm --prefix frontend run build"
build_exit_code: 0
build_output_hash: sha256:4e4155c3841c866c4e2b460d525e31dd01060af82a623d8fbf701506be9281c1
```

## Verification Report

**Change**: `cerrar-alcance-ofertas-prioridad-ia`  
**Revision**: 2 (the single read-only rerun requested)  
**Version**: N/A  
**Mode**: Standard testing (Strict TDD disabled)  
**Artifact store**: Hybrid (`openspec` + Engram)  
**Review authority**: `review-716ad02601c87d81`, approved, revision `sha256:53d4eaa4d06ded427ae1f5e92823c5e03eb2037f244d0f992ea4254f4ecdcceb`  
**Preflight**: `gentle-ai review validate --gate post-apply --lineage review-716ad02601c87d81` → `allow`; candidate tree `c5eb9397a2ea02aaee84fb4d419d46cebb74edec`.

### Canonical Verification Evidence

The exact canonical evidence bytes are the single JSON line plus its trailing LF between the markers below. The leading envelope's `evidence_revision` is the SHA-256 digest of those 1,176 bytes.

<!-- BEGIN CANONICAL VERIFICATION EVIDENCE -->
```json
{"authority_lineage":"review-716ad02601c87d81","authority_revision":"sha256:53d4eaa4d06ded427ae1f5e92823c5e03eb2037f244d0f992ea4254f4ecdcceb","build_command":"npm --prefix frontend run build","build_exit_code":0,"build_output_bytes":1657,"build_output_hash":"sha256:4e4155c3841c866c4e2b460d525e31dd01060af82a623d8fbf701506be9281c1","candidate_tree":"c5eb9397a2ea02aaee84fb4d419d46cebb74edec","change":"cerrar-alcance-ofertas-prioridad-ia","critical_findings":["session-cancelled-observability-missing-fecha_corte-maxId-counts"],"engram_predecessor_apply_progress":"5-suites/64-tests","engram_predecessor_spec_stale":true,"openspec_predecessor_apply_progress":"5-suites/65-tests","openspec_predecessor_spec_current":true,"requirements_complete":5,"requirements_total":6,"review_revision":2,"scenarios_complete":6,"scenarios_total":7,"schema":"gentle-ai.verification-evidence/v1","test_command":"npm --prefix backend test -- --runInBand && npm --prefix backend run test:db && npm --prefix frontend test -- --watch=false","test_exit_code":0,"test_output_bytes":237032,"test_output_hash":"sha256:57b474fb1adec6ffec6571910dc7ed88e1c1871af688666549f3e5c2764ad539","verdict":"fail"}
```
<!-- END CANONICAL VERIFICATION EVIDENCE -->

### Completeness

| Metric | Value |
|---|---:|
| Tasks total | 10 |
| Tasks complete | 10 |
| Tasks incomplete | 0 |
| Requirements fully compliant | 5 / 6 |
| Scenarios fully compliant | 6 / 7 |

### Build & Tests Execution

| Check | Result | Current runtime evidence |
|---|---|---|
| Backend full suite | ✅ PASS | 27 suites / 685 tests |
| PostgreSQL `_test` suite | ✅ PASS | 5 suites / 65 tests; `_test` guard remained active |
| Frontend full suite | ✅ PASS | 175 / 175 Karma tests |
| Production build | ✅ PASS | Angular bundle generated successfully |

**Test output**: 237,032 bytes; SHA-256 `57b474fb1adec6ffec6571910dc7ed88e1c1871af688666549f3e5c2764ad539`.  
**Build output**: 1,657 bytes; SHA-256 `4e4155c3841c866c4e2b460d525e31dd01060af82a623d8fbf701506be9281c1`.  
**Coverage**: ➖ Not available; no project threshold or coverage command is defined.  
**Carry-forward evidence**: none was used for the current test/build verdict; both declared commands were rerun in revision 2.

### Normative Cancellation Contract

The cancelled-session scenario does require all disputed fields:

- The successor requirement says the system MUST record `fecha_corte`, `maxId`, initial total, received and duplicate counts.
- Its scenario independently says a queried cancelled session MUST show cancellation, `fecha_corte`, `maxId`, consistent counts and no false success.
- The OpenSpec predecessor requirement also retains the metadata/count obligation; the successor delta makes the scenario wording explicit. There is no task or design text that weakens this normative MUST.

### Spec Compliance Matrix

| Requirement | Scenario | Passing runtime evidence | Result |
|---|---|---|---|
| Runtime evidence and coherent progress | evaluation, untrusted text and UI | backend evaluation plus table/detail component tests in current full suites | ✅ COMPLIANT |
| Runtime evidence and coherent progress | preference or storage fallback | dashboard fallback/progress tests in current frontend suite | ✅ COMPLIANT |
| Runtime evidence and coherent progress | documented PostgreSQL progress | current guarded DB run: 5 suites / 65 tests; OpenSpec predecessor progress is current | ✅ COMPLIANT |
| Cancelable resilient transfer | cancellation and resume | dashboard test resumes from the confirmed cursor without duplicate IDs | ✅ COMPLIANT |
| Cancelable resilient transfer | persistent storage failure | persistence/dashboard tests continue in memory and report progress | ✅ COMPLIANT |
| Cancelable resilient transfer | new snapshot excludes previous IDs | real IndexedDB Karma test plus reset-before-request dashboard test | ✅ COMPLIANT |
| Synchronization observability | cancelled session is observable | cancellation test asserts a message and resumed IDs only; required metadata/counts are absent | ⚠️ PARTIAL — CRITICAL |

**Compliance summary**: 6 / 7 scenarios fully compliant.

### Cancellation Runtime Reassessment

| Boundary | Current behavior | Required evidence | Status |
|---|---|---|---|
| Backend model/API | `fecha_corte` and `max_id` exist only inside the signed cursor; the response contains `datos`, `total`, `cursor_siguiente`, `completada` | Exposed/recorded cancelled-session metadata and counts | ❌ Missing |
| Frontend response type | Contains only `cursor_siguiente` and `completada` beyond the generic response | `fecha_corte`, `maxId`, received and duplicate counts | ❌ Missing |
| Dashboard state | Retains cursor, percentage, fallback and a cancellation string | Queryable operational cancelled-session state with consistent counts | ❌ Missing |
| Dashboard test | Asserts the text contains `cancelada`, reset runs once and resumed IDs equal `[12]` | Assertions for metadata, initial/received/duplicate counts and no false success | ⚠️ Partial |

All suites being green does not satisfy this scenario: the only cancellation test passes because it does not assert the missing normative fields.

### Correctness and Design Coherence

| Requirement/decision | Status | Notes |
|---|---|---|
| Remove deferred pilot obligations | ✅ Implemented | OpenSpec predecessor automation/coverage files now contain only deferred-scope notes |
| Await native IndexedDB reset before a new snapshot | ✅ Implemented | reset/resume/fallback tests pass |
| Runtime evidence for delivered slices | ✅ Implemented | current backend, DB and frontend suites pass |
| Full cancelled-session observability | ❌ Incomplete | metadata and received/duplicate counts are neither exposed nor runtime-tested |
| No pilot, migration 019 or new dependency | ✅ Followed | scope remains surgical |

### Engram Predecessor Topic vs OpenSpec

The secondary predecessor topics are stale and do not match current OpenSpec:

- Engram `sdd/ofertas-30-dias-prioridad-ia/spec` still contains the old normative pilot/coverage requirements, while current OpenSpec predecessor files defer them and include the awaited-reset amendment.
- Engram `sdd/ofertas-30-dias-prioridad-ia/apply-progress` still records 5 suites / 64 tests, while current OpenSpec records 5 suites / 65 tests.
- Current OpenSpec is the native authoritative store for this hybrid workspace. The mismatch is therefore a consistency warning, not a basis for weakening the explicit successor cancellation scenario.

No predecessor topic, implementation, proposal, spec, design, task or apply artifact was edited during revision 2. Only this requested verification report was persisted.

### Issues Found

**CRITICAL**

1. `sesión cancelada es observable` remains only partially implemented and tested. The normative contract explicitly requires cancellation, `fecha_corte`, `maxId`, consistent initial/received/duplicate counts and no false success; runtime exposes only a cancellation message, cursor/progress and total.

**WARNING**

1. The Engram predecessor spec topic is stale relative to the amended OpenSpec predecessor specs.
2. The Engram predecessor apply-progress topic is stale at 5/64 relative to OpenSpec 5/65.

**SUGGESTION**: None; remediation was explicitly out of scope.

### Verdict

**FAIL**

Revision 2 confirms the prior blocker with fresh runtime evidence. Tests and build pass, but one normative scenario remains unimplemented and only partially tested; the predecessor Engram/OpenSpec divergence also remains unresolved.
