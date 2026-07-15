```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ede7f4b0421d9ff1a8a1062030fc04c9c4cabcb2cb71d2cd3c7c9682c08f6c8f
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 13/13
test_command: "(set -e; npm --prefix backend test -- --runInBand; npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless)"
test_exit_code: 0
test_output_hash: sha256:66d6b716061d17e1488c0588696386a00b5e4453e3d0e976d65be828de2f7ac8
build_command: "rtk npm run build (cwd: frontend)"
build_exit_code: 0
build_output_hash: sha256:1b5c3ff888af9caad39e8f58220a5720963bbae481ab3acd8729fdd338a3a5ce
```

## Verification Report

**Change**: `piloto-getonbrd`  
**Version**: N/A  
**Mode**: Standard — Strict TDD disabled  
**Persistence**: Hybrid (`openspec` + Engram)  
**Review authority**: `review-5c2a7ba9146c851c`, approved and validated at `post-apply`

### Completeness

| Metric | Value |
|---|---:|
| Requirements | 6 |
| Scenarios | 13 |
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

### Build & Tests Execution

| Check | Result | Evidence |
|---|---|---|
| Backend full suite | ✅ 29 suites, 699 tests passed | Included in primary test output |
| Frontend full suite | ✅ 178 tests passed in ChromeHeadless | Included in primary test output |
| Frontend production build | ✅ Passed | `sha256:1b5c3ff888af9caad39e8f58220a5720963bbae481ab3acd8729fdd338a3a5ce` |
| Strict sandbox/fixture harness | ✅ Passed | `sha256:ec3b15312502e6e44b653787cf8542c63ea3bd62aa5a4d29906d353a7b40a85c` |
| Deny-by-default guard harness | ✅ Passed | `sha256:2cb3fd3bf9968882a86e92185f5a872ad2f67702673578a661f8d5d138f51e1f` |
| Documentation contract harness | ✅ Passed | `sha256:b55f7d4c97ebf91a5d212a9c17481cc5515a70acde78cabb74baa0a1f534ecbb` |
| Static production/HTML/executable-path check | ✅ Passed | `sha256:00b9c46e46cc11b3536fa1de257465eb062384d6258911adb5b0c4daec9eec66` |
| Staged and unstaged diff checks | ✅ Passed | `sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` |

**Coverage**: ➖ No coverage threshold or project coverage command is configured.

The strict harness exercised term and page progression, canonical checkpoint advancement, metrics, and every declared termination reason: `politica_destino`, `paginas_agotadas`, `limite_items`, `limite_paginas`, `respuesta_invalida`, `error_http`, `timeout`, and `cancelacion`. The regular suite also covered `pagina_vacia`.

No real GetOnBrd network request was executed. Sandbox behavior used injected fixtures only. The production-denial case recorded zero client requests.

### Spec Compliance Matrix

| Requirement | Scenario | Runtime evidence | Result |
|---|---|---|---|
| Autorización bloqueante | fixture aislado | `getonbrd-piloto.test.js > normaliza, deduplica...`; strict sandbox harness | ✅ COMPLIANT |
| Autorización bloqueante | sin evidencia | `getonbrd.test.js > deniega sin evidencia`; `getonbrd-piloto.test.js > bloquea producción...`; guard harness | ✅ COMPLIANT |
| Corrida observable | duplicadas | `getonbrd-piloto.test.js > normaliza, deduplica...`; strict sandbox harness | ✅ COMPLIANT |
| Corrida observable | cancelación | `getonbrd-piloto.test.js > conserva el último checkpoint...`; strict sandbox harness | ✅ COMPLIANT |
| Registry como fuente de verdad | plataformas desactivadas preservadas | Backend and frontend `plataformas` suites | ✅ COMPLIANT |
| Registry como fuente de verdad | metadata mínima completa | Backend and frontend `plataformas` suites | ✅ COMPLIANT |
| Inactivas no disponibles | UI oculta o deshabilita inactivas | `frontend/src/app/config/plataformas.spec.ts`; `panel-control.spec.ts` | ✅ COMPLIANT |
| Inactivas no disponibles | backend rechaza scraping inactivo | `controlador-scraping.test.js > retorna Result Contract bloqueado...` | ✅ COMPLIANT |
| Ciclo derivado del registry | ejecución usa plataformas activas registradas | `servicio-automatizacion.test.js > ejecuta scraping de las plataformas activas...` | ✅ COMPLIANT |
| Ciclo derivado del registry | plataforma inactiva no se invoca | `servicio-automatizacion.test.js > plataformas inactivas... NO son invocadas` | ✅ COMPLIANT |
| Ciclo derivado del registry | resultado refleja el registry | `servicio-automatizacion.test.js > resultado.scraping contiene una clave...` | ✅ COMPLIANT |
| Piloto documentado | piloto consultable | Documentation contract harness | ✅ COMPLIANT |
| Piloto documentado | rollout sin autorización | Documentation and guard contract harnesses | ✅ COMPLIANT |

**Compliance summary**: 13/13 scenarios compliant.

### Correctness (Static and Runtime Evidence)

| Concern | Status | Notes |
|---|---|---|
| Zero live production | ✅ | Production is denied before the client; strict harness observed zero production requests. Production URL literals exist only as guard metadata and inert demo-offer URLs, not active request targets. |
| No HTML scraping | ✅ | No GetOnBrd HTML parser, browser, Cheerio, Puppeteer, `pageFunction`, or DOM extraction was added. |
| Deny by default | ✅ | `EVIDENCIA_AUTORIZACION` is `null`; production needs exact destination, explicit flag, current scoped evidence, and SHA-256 metadata. Boolean-only and evidence-only attempts are denied. |
| Fixtures/sandbox only | ✅ | All pilot runtime evidence used an injected fixture client and exact sandbox destination. |
| Normalization | ✅ | Full backend tests cover GetOnBrd field, modality, seniority, salary, timestamp, raw-data, and invalid-URL normalization. |
| 30-day window and deduplication | ✅ | Runtime tests retain one recent canonical URL, reject one 31-day item, and count one duplicate. |
| Terms/pages pagination | ✅ | Strict harness processed an empty first term and two pages for the next term: 3 requests, 3 pages, final checkpoint term index 1/page 2. |
| Timeout/cancellation | ✅ | Runtime tests and strict harness terminate with preserved confirmed checkpoint and explicit reason. |
| Checkpoints/metrics/reasons | ✅ | Result Contract fields and all declared reasons were exercised at runtime. |
| Endpoint blocked | ✅ | Shadow endpoint returns zero-request blocked Result Contract and invokes neither scraper service nor `crearOferta`. |
| Automation blocked | ✅ | GetOnBrd is absent from `SCRAPERS`, inactive in the registry, never invoked, and reported as zero. |
| Frontend blocked | ✅ | No GetOnBrd scraping service method or panel-control execution path exists; active selectors exclude it. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Extend existing scraper service | ✅ Yes | `ejecutarScrapingGetonbrd` owns guard, fixture client, pagination, normalization, and Result Contract. |
| Native/injected dependencies | ✅ Yes | Uses injected client, signal, clock, checkpoint, callback, native `AbortController`, and `randomUUID`; no new dependency. |
| Audited evidence instead of isolated flag | ✅ Yes | Exact host, scope, dates, evidence id, and SHA-256-shaped document identity are required. |
| Serializable checkpoint without PostgreSQL | ✅ Yes | Endpoint and service do not persist pilot offers or checkpoints. |
| Inactive UI/registry/automation | ✅ Yes | Both registries mark GetOnBrd inactive; UI and automation have no executable path. |
| No migration or cron | ✅ Yes | No schema, migration, schedule, or production data path was introduced. |

### Issues Found

**CRITICAL**: None.  
**WARNING**: None.  
**SUGGESTION**: Move the inline `limite_items` and `respuesta_invalida` harness assertions into permanent Jest tests in a future authorized change; current runtime verification passed them, but permanent regression coverage would be stronger.

### Verdict

**PASS**

All 6 requirements and 13 scenarios are covered by passing runtime evidence. The approved review authority matches the verified candidate, production and HTML scraping remain unreachable, and backend, frontend, build, and sandbox harness checks all passed.
