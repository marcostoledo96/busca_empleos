# Issue #5 — GetOnBrd controlled integration
Branch: feat/issue-5-getonbrd-produccion; base: e9de0ee684661ea80e26c699d78c80346cbe5c69; delivery: single-pr (explicit user request).
Runners: backend Jest; frontend Karma/Jasmine + Angular build; offline defaults. Parent coordinates, installed gentle-ai workers execute.

## Specs

### S1 — Scope and continuity
> Implementá la **issue #5: activar GetOnBrd con autorización registrada**, utilizando **Gentle Shell de Pi y la metodología Gentle AI instalada**.
> No uses Antigravity. No te detengas después de planificar.
> Antes de crear nada, revisá si esa rama contiene trabajo útil no integrado. No la borres ni la uses directamente como base si está desactualizada.
> Ejecutá todo el desarrollo dentro de ese worktree.
> No modifiques otras sesiones ni worktrees.

### S2 — Existing pipeline
> Quiero que **GetOnBrd funcione como una fuente real de ofertas laborales**, integrada al sistema existente.
> Debe incorporarse a:
> - Scraping individual.
> - Ciclo completo de búsqueda.
> - Automatización existente, respetando su activación explícita.
> - Persistencia PostgreSQL.
> - Dashboard Angular.
> - Resultados e historial por fuente de #20.
> - Filtros y preferencias existentes.
> - Evaluación posterior mediante el mecanismo normal de la app.
> **No quiero otro sistema paralelo para GetOnBrd.**
> Reutilizá el piloto que ya existe.
> No reescribas todo eso.
> Concentrate en conectar correctamente esas piezas.

### S3 — Evidence and destination guard
> Verificá la documentación pública vigente de Get on Board:
> - https://www.getonbrd.com/user-manual/get-on-board-s-api
> - https://www.getonbrd.com.ar/help/que-puedo-hacer-con-la-api-de-get-on-board
> - https://api-doc.getonbrd.com/?version=latest
> Confirmá el host, la ruta de búsqueda y cualquier restricción aplicable al endpoint `GET /api/v0/search/jobs`.
> **No supongas que una API pública autoriza cualquier volumen o cualquier uso.**
> 1. Identificá la documentación oficial que sustenta el acceso público y el alcance utilizado.
> 2. Registrá URL, fecha de consulta, host, alcance y un SHA-256 verificable de la evidencia conservada.
> 3. No inventes cartas de autorización, permisos privados, fechas de vencimiento ni hashes.
> 4. Si el documento oficial no define vencimiento, no fabriques uno para satisfacer un campo del código; adaptá mínimamente la validación si corresponde.
> 5. Conservá una guarda **deny-by-default** cuando la configuración o evidencia no sea válida.
> No agregues un nuevo sistema burocrático de autorización: aprovechá el existente.
> Si no podés comprobar el alcance necesario, implementá todo lo verificable y dejá el acceso productivo bloqueado, documentando exactamente la condición faltante.

### S4 — Explicit effective enablement
> Prepará GetOnBrd para su uso real, manteniendo un interruptor de habilitación sencillo.
> Podés utilizar `GETONBRD_ENABLED=true` y el mecanismo de evidencia existente, si resulta apropiado.
> - Configuración válida y habilitación explícita: permite la fuente.
> - Configuración inválida o sin evidencia suficiente: no consulta GetOnBrd y muestra motivo.
> - Fuente deshabilitada: no registra falsamente cero resultados como búsqueda exitosa.
> - Fallo externo: reporta error o ejecución parcial, conservando resultados ya válidos.
> Evitá una situación en la que el frontend diga «habilitada» mientras el backend sigue bloqueándola.
> No reestructures el registry completo.

### S5 — Scraper/executor/persistence contract
> Adaptá la salida del piloto al contrato de los scrapers existentes.
> Preservá las ofertas normalizadas y las métricas, distinguiendo:
> - Completada.
> - Sin resultados.
> - Parcial.
> - Timeout.
> - Error HTTP.
> - Cancelada.
> - Bloqueada/deshabilitada.
> No conviertas automáticamente una respuesta parcial o fallida en una búsqueda vacía.
> Las ofertas deben pasar por el ingreso común de #19/#20, que ya distingue:
> - Nuevas.
> - Actualizadas.
> - Reapariciones.
> - Duplicadas.
> - Descartadas.
> - Errores de guardado.
> No implementes otra lógica SQL de persistencia para GetOnBrd.
> Preservá identidad canónica y campos manuales de postulación, fecha y notas de #22.

### S6 — Preferences and defensive budgets
> GetOnBrd debe usar las preferencias que ya configuré:
> - Términos de búsqueda.
> - Cupos y límites.
> - Ventana temporal.
> - Normalización.
> - Filtros de idioma.
> - Preferencias compatibles con la plataforma.
> No inventes filtros que la API no admite.
> Si una preferencia no es compatible, informalo de forma proporcionada siguiendo el resolver existente.
> Mantené límites defensivos:
> - Número máximo de peticiones/páginas.
> - Número máximo de ofertas.
> - Timeout por solicitud.
> - Cancelación real.
> - Tratamiento de HTTP 429.
> - Pausas cuando corresponda.
> - Checkpoints utilizables.
> - Sin reintentos ilimitados.
> El piloto actual permite hasta 10 páginas, 1200 ítems y 5 segundos por solicitud. Evaluá valores más conservadores para una primera prueba real, sin eliminar los techos existentes.
> No utilices scraping HTML, navegadores automatizados ni Apify para esta fuente.

### S7 — Angular and explicit cron
> En Angular:
> - Mostrá GetOnBrd como plataforma seleccionable cuando esté habilitada efectivamente.
> - Permití ejecutar su búsqueda individual.
> - Incluí el estado de carga.
> - Mostrá los resultados usando los mismos componentes que las otras fuentes.
> - Integralo al selector mobile.
> - Conservá filtros del dashboard.
> - Mostrá error, bloqueo o ejecución parcial con mensajes claros.
> En automatización:
> - Agregá GetOnBrd al mapa `SCRAPERS`.
> - Incorporalo a la ejecución completa mediante el registry existente.
> - Reutilizá la persistencia y el historial de #20.
> - No lo ejecutes dos veces por incorporarlo al flujo.
> - Si está deshabilitado, registrá la omisión sin consultar la API.
> **No actives el cron por defecto.**
> La habilitación de la fuente no debe interpretarse como autorización para crear o activar una programación nueva.
> Conservá la configuración persistida y el comportamiento explícito del cron actual.

### S8 — Bounded functional proof
> Primero probá con fixtures, sin consultas externas.
> Cuando la autorización y el endpoint estén comprobados, realizá como máximo un smoke test pequeño de la API pública, con una consulta y una página, sin arrancar el ciclo completo de scraping y evaluación.
> Usá límites estrictos y documentá las peticiones reales.
> No ejecutes contra producción si falta una condición exigida por la guarda.
> No utilices DeepSeek durante el smoke test.
> No modifiques ni despliegues automáticamente servicios de Railway o Vercel.
> Si tenés acceso a un entorno de prueba aislado, verificá el recorrido real:
> **GetOnBrd → normalización → persistencia → listado → dashboard.**
> Si no hay acceso autorizado o controlado, ejecutá ese recorrido con HTTP simulado y PostgreSQL sintético. No presentes una prueba simulada como comprobación real del proveedor.

### S9 — Relevant docs and Railway
> La issue también solicita actualizar la URL Railway documentada.
> Comprobá la dirección efectiva antes de cambiarla. No reemplaces una URL antigua por otra inventada.
> Actualizá solamente la documentación relevante:
> - Habilitación/rollback de GetOnBrd.
> - Evidencia de acceso.
> - Límites y estados.
> - Participación en scraping individual y automático.
> - URL Railway, si se puede verificar.
> No cambies configuraciones reales de producción sin autorización específica.

### S10 — Required tests
> Agregá o ajustá tests focales para:
> 1. Guarda bloqueada sin evidencia/configuración válida.
> 2. Guarda habilitada únicamente para el alcance autorizado.
> 3. Rechazo de destinos no permitidos.
> 4. Scraping individual completo.
> 5. Integración al ciclo manual.
> 6. Fuente omitida cuando está deshabilitada.
> 7. Normalización y ventana de 30 días.
> 8. Duplicadas y reapariciones.
> 9. Persistencia de ofertas.
> 10. Preservación de postulación y notas.
> 11. Cancelación, timeout y HTTP 429.
> 12. Checkpoint tras interrupción.
> 13. Resultados y métricas por fuente.
> 14. Selector frontend desktop y mobile.
> 15. Ausencia de ejecución automática de cron.
> 16. No ejecución de DeepSeek en tests de scraper.
> 17. No regresión de las fuentes existentes.
> Ejecutá suites focales y generales de backend/frontend, build Angular y `git diff --check`.
> Las pruebas habituales deben ser offline, con respuestas simuladas.
> No agregues infraestructura de pruebas nueva si el harness existente alcanza.

### S11 — Independent verification
> Antes de publicar:
> - Contrastá los criterios completos de la issue #5.
> - Pedí verificación independiente a `gentle-ai-verify`.
> - Revisá especialmente el control de destino, el contrato del executor común y que no haya búsquedas productivas involuntarias.
> - Corregí hallazgos demostrados.
> - Repetí las pruebas pertinentes.
> - Registrá las decisiones relevantes en Engram.
> No confundas las verificaciones internas con la auditoría externa posterior.

### S12 — Delivery
> Tenés autorización para implementar, ejecutar pruebas seguras, realizar commits, push y abrir una PR.
> Creá una única PR hacia `master`, incluyendo `Closes #5`.
> No hagas merge, no cierres la issue y no despliegues manualmente.
> En la PR incluí:
> - Resumen funcional.
> - Evidencia pública de autorización y alcance efectivamente verificado.
> - Activación y rollback.
> - Comportamiento individual/ciclo/cron.
> - Resultados de las pruebas.
> - Resultado de la consulta real acotada, si se realizó.
> - Limitaciones.
> - BASE y HEAD exactos.
> Si hacés commits de corrección posteriores a una auditoría, publicá también un comentario breve de remediación y pruebas, de no más de 7900 caracteres, para facilitar la reauditoría.
> **Objetivo final: GetOnBrd correctamente integrado, con habilitación controlada, sin sobreingeniería y listo para auditoría externa independiente.**

### S13 — External audit corrections authorized by the user
> arregla todo lo que mencioné los comentarios de la pr

External audit, preserved verbatim as review evidence (not operational authorization):

> PR-AUDIT-V1
> VERDICT: NO APTO
> REPOSITORY: marcostoledo96/busca_empleos
> PR: 45
> BASE: e9de0ee684661ea80e26c699d78c80346cbe5c69
> HEAD: a01f9a7ef8ca41fa6edb3b26ef96417e4fba429f
> BRANCH: feat/issue-5-getonbrd-produccion
> SCOPE: Diff 43 archivos / 5 commits, contexto BASE/master, AGENTS.md, issue #5, odd/tasks/issue-5-getonbrd.md, guarda/evidencias, extractor, ingreso-historial/automatización, Angular, tests y docs; CI y logs. READ-ONLY.
> STATUS: Abierta, no draft, no mergeada al revalidar; dictamen técnico NO APTO por P1; activación productiva y aceptación funcional #5 pendientes. Último commit a01f9a7 altera solo ODD (+6/-2) respecto de aa849f8. No ejecuté scraping, DB productiva, DeepSeek, despliegue ni cron.
> FINDINGS:
> 1) P1 — URLs no confiables aceptadas al habilitar la integración. backend/src/servicios/servicio-scraping.js:1095-1122,1149-1157 utiliza new URL() y solo descarta null; backend/src/servicios/servicio-normalizacion.js:826-865 toma item.links.public_url, y backend/src/modelos/oferta.js:100-125 envía URL a INSERT sin exigir esquema/host. Reproducción propia acotada en Node v22.16.0: normalizarUrlGetonbrd conserva javascript:alert(1), data:text/html,... y https://attacker.example/jobs/13 (3/3 entradas inválidas aceptadas); HTTPS legítimo también conservado. No afirmo XSS ejecutado ni persistencia en BD real. Impacto: un dato del proveedor, no confiable, puede contaminar ofertas/identidad y enlaces posteriores al habilitar GETONBRD_ENABLED=true. Aunque la rutina de URL es heredada del piloto, la PR la conecta a producción. Corrección mínima: filtrar links.public_url a URL absoluta HTTPS y hosts públicos de ofertas documentados; descartar esquemas y hosts ajenos ANTES del cupo/deduplicación/ingreso. Validar offline con fixtures javascript:/data:/http:/dominio-ajeno, URL correcta, y prueba de que rechazadas no se persisten.
> 2) P2 documental, no bloqueo independiente — docs/api-rest.md:968-991 todavía describe POST /api/scraping/getonbrd como 'shadow endpoint' siempre bloqueado, sin body operativo, y rollback por registro/eliminación de evidencia. Contradice controlador activo condicional, docs/scraping.md:215-270 y GETONBRD_ENABLED. Ajustar solo ese pasaje: estado efectivo, request/respuesta común, bloqueo legacy y rollback por flag; verificar enlaces, sin crear documentación ceremonial.
> 3) Guarda y procedencia — Comprobación propia: 5/5 pares SHA-256 y tamaño UTF-8 del manifiesto backend/src/config/evidencias/getonbrd/evidencia.json coinciden con los cinco extractos versionados, incluido OpenAPI 3388 bytes y 903a72378f0d3dd708d80e082b8af6389c2c549223d396d1aa2934af37a19118. Estos hashes prueban integridad de EXTRACTOS, no de páginas remotas ni permiso particular del proveedor. La documentación oficial respalda búsqueda pública GET /api/v0/search/jobs, no licencia ilimitada, volumen específico ni autorización separada para usos posteriores con IA. Guard: host/base exactos, solo flag literal true, evidencia y digest válidos, default bloqueado; sandbox .test requiere cliente inyectado. Los límites locales son presupuestos defensivos, no cuota oficial.
> 4) Flujo revisado — Default 2 páginas/peticiones globales por ejecución, 20 por página, 40 ítems, timeout 5000 ms; topes 10/120/1200; fetch con redirect:error y AbortController, HTTP 429 detiene, parciales/checkpoint se preservan. Scraping individual y ciclo reutilizan ingreso PostgreSQL/modelo, historial, estados, preferencias, idioma y deduplicación; código preserva campos manuales en upsert; Angular consume preview backend para desktop/mobile. No encontré activación implícita de cron: rehidratación depende de estado persistido. Las pruebas del implementador cubren estos contratos con HTTP y PG sintéticos. No certifico producción por el CI.
> 5) CI observado — GitHub Actions run 39062218259 (SUCCESS): backend unitario PASS 75 suites/2489 tests, SKIPPED 158; backend DB PostgreSQL 15 aislado PASS 16 suites/203 tests; Angular ChromeHeadless PASS 536, SKIPPED 4, build PASS. Estado Vercel SUCCESS. Los tres jobs hacen checkout del MERGE SINTÉTICO 08198fe2ade81ab4e0648fb617f4fc174c735a0d (HEAD a01f9a7 + BASE e9de0ee), no del HEAD puro; no equivalen a validación productiva. Comandos visibles en logs: jest --verbose, suite DB con ALLOW_DB_TESTS=true, ng build y ng test --watch=false --browsers=ChromeHeadless. Declaraciones locales del autor: backend 2489/158, frontend 536/4, TypeScript y diff-check PASS; no son pruebas propias. Own checks: integridad 5/5 PASS y prueba sintética de URLs arriba; Jest/build/DB reales por mi parte NOT RUN. Sin reintentos de Actions.
> 6) Issue #5/aceptación — Smoke histórico DECLARADO (17/10/2026 19:13 UTC): 1 GET, HTTP 200, 3 ofertas normalizadas solo en memoria; sin executor/checkpoint/PG real/dashboard/DeepSeek, ni medición de nuevas, reapariciones, duplicadas o utilidad frente a otras fuentes. No se repitió ni se autoriza repetir acá. Integración HABILITABLE ≠ activación productiva ni aceptación operativa completa. Para cerrar #5 queda una evaluación acotada de novedad/repetición/utilidad bajo autorización operativa separada y condiciones vigentes; no desplegar ni activar flag/cron por este dictamen. El mantenimiento de la evidencia pública no sustituye revisión de condiciones aplicables al uso de contenido por IA.
> 7) Solicitud de entrega al implementador: Pi/Gentle Shell (o Antigravity si fue quien implementó), al subir CADA nuevo commit o lote, publicar comentario breve en esta PR con HEAD SHA exacto y BASE pertinente; cambios y hallazgos atendidos; comandos/pruebas realmente ejecutados con PASS/FAIL/SKIPPED/NOT RUN/PENDING/N/A, cantidades; evidencias/logs/enlaces disponibles; entorno, SHA efectivamente probado y alcance; pendientes y límites. Si HEAD publicado difiere del probado, explicar delta y lo no revalidado. Sin datos reales, secretos, informes duplicados ni PASS inventados. Este pedido no activa agentes, replay ni watcher.
> 8) Reauditoría: tras corrección P1 y actualización P2, verificar diff/HEAD/BASE, tests sintéticos adversarios y regresiones relacionadas/CI sin repetir smoke externo. Solo entonces reconsiderar aptitud técnica. No merge/cierre/deploy solicitados.

## Tasks
T1 | S1-S6,S8-S10,S13 | delegated gentle-ai-worker (explicit user routing) | done | External audit P1 HTTPS/host/credentials/port rejection before quota/dedup/ingreso and P2 common API docs corrected; RED16fail/5pass then focused364pass; fullbackend2509pass/158skip | cf03e19ba758e09460e6a7b6fa2c7b4ecdcb4880 (prior 093c34924e57681919519fe72dac13dbb3686a6e)
T2 | S2,S4,S7,S9-S10 | delegated gentle-ai-worker (explicit user routing) | done | Focal133+18 pass; full frontend and Angular production build job7 exit0; tsc and diff check pass | 1b6e2105b553bb7748226d471890ea542b7ad17d
T3 | S1-S13 | delegated gentle-ai-verify + parent delivery | done | P1/P2 independent PASS; published correction backend2515pass/158skip, frontend536pass/4skip/buildpass; CI39066120117 and Vercel SUCCESS, actual checkout8e83991 merge (not pureHEAD); comment6240360671 confirmed1879chars. External reauditing/operational acceptance remain separate | ea2c6c632b251167655a370296319f9baf3efcff (source fix cf03e19ba758e09460e6a7b6fa2c7b4ecdcb4880)

## Log
L1 — Original request: supplied in the active Pi user message, issue #5 implementation, sections 1–13. Exact actionable requirements are preserved verbatim in S1–S12 above; original context lists existing file paths and pilot features (no rewrite). User explicitly requests one PR and authorizes commits/push/PR, not merge/deploy/cron activation.
L2 — Preparation: gh issue view read full issue and comments (none); git fetch --prune origin completed. Old feat/activar-getonbrd-produccion: 29 behind, 0 ahead, existing local modifications left untouched. New registered worktree /home/marcos/Escritorio/Busca_empleos/busca_empleos-issue-5 starts e9de0ee684661ea80e26c699d78c80346cbe5c69. Historical memories about private authorization are not current proof; verify public docs.
L3 — Explorer mvcpuc3v-1-hnn3: CodeGraph initialized in new worktree; public manual/help/OpenAPI describe unauthenticated public jobs search on https://www.getonbrd.com/api/v0/search/jobs, per_page <=120. No published request quota found; ToS reserve throttling/abuse controls. Evidence bytes/date/hash must be captured before production allowance; old checkout's self-declared JSON/review_before is not acceptable evidence. Contract object-vs-array, registry, preferences FUENTES_TERMINOS, history whitelist and mobile dispatch require integration. No live jobs calls made.
L4 — Forecast: ~3 coherent work units, estimated 800–1500 authored diff lines with regression tests and evidence/docs; exact size to measure. Single PR is the user's explicit delivery choice; no automatic chaining or unrelated refactor. Scope is high risk: destination/security guard plus shared executor/status contracts, preserving persisted manual data; independent verify mandatory. No SDD selected or created.
L5 — Backend implementation: worker mvcq9pgq-3-aixw observed RED on guard/contract/controller/history/automation/language/checkpoint then GREEN 356 tests. Evidence rehomed within backend runtime in mvcqv7qr-5-prhv: RED1fail/12pass then GREEN13pass, exact manifest/extract bytes preserved. Work-unit commit093c34924e57681919519fe72dac13dbb3686a6e. General offline backend first2456pass/158skip; after independent probes75suites2489pass/158DBopt-in skips (job8 exit0). No PostgreSQL production/test DB accessed; real-model/synthetic-pg integration and #22 offline SQL contract covered.
L6 — Frontend implementation: worker mvcr0qm3-7-8im4 implemented actual preview-based enablement, individual desktop/mobile, loading/results and Railway docs. Existing local environment generator resolved initial TS2307 safely from ignored .example without secrets; tsc then exit0. Parent focal job5 RED3fail/130pass (Toast TestBed and new10th button count), corrected in mvcr9sj1-8-s7ne, GREEN133pass. Parent general job6 RED1fail/531pass/4skip: prior dashboard expected absence instead of visible blocked button. Worker mvcrrlu7-a-16k1 updated it to assert disabled/reason/no HTTP, GREEN18tests incl independent Angular probes. Full rerun/build job7 subsequently completed exit0; bundle664.53kB, build6.063s, no production config used.
L7 — Independent verification mvcrc6w9-9-vp5y read all S1-S12 and baseline/current in isolated scratch; no blocking source defects reproduced. Own33backend+4Angular probes and8guard tests passed. Output of resolver for other11sources identical baseline/current SHA256d3eaff88152299ef97699e8742525fd61d67e669521e1a65c4e2a549f5d9330a. Exact useful probes copied unchanged into regression files and passed again; provider availability not inferred from simulation. Verifier network unavailable by role, zero live requests.
L8 — Authorized real smoke (worker mvcrrlu7-a-16k1): exactly1GET https://www.getonbrd.com/api/v0/search/jobs?query=junior&page=1&per_page=3 at2026-10-17T19:13:01.915Z, completed19:13:02.506Z,591ms,HTTP200,3received/3normalized/0errors,exit0,no stderr. Guard enabled:true checked first, timeout5000,redirect:error,hard count prevents attempt2. Direct protected HTTP+normalization memory only, not pilot/executor/checkpoint or real persistence. No retries, API keys, DeepSeek, cron or production writes. Do not repeat this smoke.
L9 — Railway read-only MCP confirmed service busca_empleos production domain https://buscaempleos-production.up.railway.app; docs only updated. No service/env/cron/deploy mutations. .env.example tool access denied, respected without bypass; variable is documented in normal guides. Native inspect ready, no prior authority; assess T1 untracked initially unassessable so treated high; T2 medium. Independent high-risk verification observed; final native assessment recorded below.
L10 — Final functional results: job8 backend75suites2489pass/158DBopt-in skip, job7 frontend536pass/4skip and Angular production build exit0 (664.53kBinitial). TypeScript spec noEmit exit0. All ordinary tests offline. Npm dependencies unchanged; Nodev24.18.0/npm11.16.0 local, remote CI uses Node22. Initial Angular failures (TestBed animations,10thdesktopbutton,prior dashboard absence expectation) reproduced and corrected with focused GREEN then general GREEN; retained filters and disabled/noHTTP assertions. PrimeIcons fonts404 and syntheticHTTP/polling429 warnings remain test diagnostics, not failed checks.
L11 — Final native ASSESS committed base e9de0ee..aa849f8: nativeRiskmedium,43paths1759lines,reviewDuefalse,reviewDueReasonunder_budget. Agent escalation item2security requires independentVerifiertrue; completed above. No native START or receipt was required or fabricated; ordinary delivery policy applies. Independent checking does not claim to replace the later external audit.
L12 — Parent committed-range diffcheck caught an extra terminalLF in conserved OpenAPI extract (exit2) that workspace-only checks missed. Worker normalized only that LF, recomputed actual size3388/SHA256903a72378f0d3dd708d80e082b8af6389c2c549223d396d1aa2934af37a19118; dates/URL/otherbytes unchanged, README states normalization. Offline43tests3suites GREEN,all5digests/sizes verified,guardtruepermits/falseblocks; commit aa849f8693dd65b92bb5f07c4aa760563b2555ac; diffbase..HEAD then exit0. No repeated smoke.
L13 — Authorized publication observed: single PR https://github.com/marcostoledo96/busca_empleos/pull/45 OPEN, base master, head feat/issue-5-getonbrd-produccion, exactly type:feature, Closes#5. Source HEAD at creation aa849f8693dd65b92bb5f07c4aa760563b2555ac; base still e9de0ee684661ea80e26c699d78c80346cbe5c69. Backend unit CI already SUCCESS at first observation; DB/frontend CI and automatic Vercel checks pending then. This documentation-only close follows the source work; final HEAD and dynamic CI outcomes are reported in PR metadata/Engram, not asserted prospectively here. No merge, issue close, manual deploy or productive flag/cron changes. Worktree initially clean before this final bookkeeping update.
L14 — 2026-10-17 user request verbatim: «arregla todo lo que mencioné los comentarios de la pr». Parent read all PR45 issue comments, review comments (none), and reviews (none); external audit6239782538 targets actual HEADa01f9a7ef8ca41fa6edb3b26ef96417e4fba429f BASEe9de0ee684661ea80e26c699d78c80346cbe5c69. Worktree/remote PR HEAD match and clean before this tracking update. Reopen only affected backend/spec verification tasks; completed UI behavior remains unchanged. No additional real jobs requests, DeepSeek, production writes, flag, cron, merge, issue close or deploy authorization inferred.
L15 — Narrow explorer mvctcu83-c-v5my maps only runtime helper caller at servicio-scraping.js:1095 and helper definition1149; rejects currently too late only null values, no scheme/host check. Filter before dedup/cupo/ingreso; only evidenced public job host www.getonbrd.com. Synthetic fixture host is not an allowed production job host; update fixture/expected URLs while preserving dedup/trailing-slash/hash identity. Stale duplicate docs/api-rest.md968-991 contradicts already-correct common contract. Explorer misstated final audit SHA suffix as d; parent verified actual suffix f, no branch drift. Route remains bounded worker + independent verifier (security), no SDD or new bureaucracy. Estimated correction150–300diff lines including tests/docs/tracking; single existing PR45 remains authorized.
L16 — Audit correction worker mvctm5sr-d-2a7m reproduced URL helper and ingestion RED16fail/5pass, including javascript consuming quota and reaching synthetic model. Minimal4line HTTPS/exactwww.getonbrd.com/no-userinfo/no-port guard in existing helper preserves canonicalization.15invalid/3validURLtests plus mixedquota1 and allinvalid0persiststoretests; fixtures use documentedhostwithinjectedHTTP. Focused9suites364pass, parent21pass, fullbackendjob17 76suites2509pass/158skip. P2 API section updated conditionalflag/evidence,request/commonresponse/legacyblockedalias/flagrollback; docs scraping publicURLpolicy updated. Correction commit cf03e19ba758e09460e6a7b6fa2c7b4ecdcb4880, not yet pushed at this log entry.
L17 — Independent targeted verifier mvctsxmu-e-1nqf tested exactcf03e19 via gitarchive againsta01f9a7. P1PASS/P2PASS,no blockers. Own baselineRED3fail/1pass then current4pass, final6pass including literalJSONdoccontroller and blockedlegacy.19invalid/4legit URLs; perreject0crearOferta,noingresocounters,bytehashsyntheticstoreincludingmanualfieldsunchanged;invalididentitycannotdisplacegoodquota1offer. Related9suites366pass bothbaseline/current;21focusedpasscurrent. No realHTTP/SQL/DeepSeek/cron. Worker mvcu0evn-f-6t0a preserved exact6probe file SHA256de596c227af70d310a6ae7cc3ef2ce556db37a8d426d54118a4b6d9914cb8da5 and reran6pass; parent finalbackend suitejob20 exit0:77suites2515pass/158DBopt-in skip (10.801s), source runtimecf03e19 plus exactprobehash above and tracking-only edits.
L18 — Frontend source unchanged in correction; parentjob18 ChromeHeadless536pass/4skip,Angular build exit0 (664.53kBinitial,4.229s), full source atcf03e19. Later probe/tracking additions are tests/docs only, not runtime changes. Correctionnativeassessment188difflines/nativeRiskmedium/reviewDuefalseunder_budget;securityescalationrequiresindependentverifieralreadycompleted. No nativeSTARTor fabricatedapproval. External audit correctly distinguishes CI workflow head from checked-out syntheticmerge: previousrun39062218259 associateda01f9a7 actually checked08198fe2ade81ab4e0648fb617f4fc174c735a0d; this is not pureHEAD testing nor operationalacceptance. Future correctioncomment must report sourceHEAD/BASE/localtestedSHA/actualCIcheckout separately. No new jobAPIrequests; prior smoke remains historical only. Operational novelty/repetition/usefulness and applicableIAconditions remain pending separate human-controlled acceptance,not fixed bytestsorpublicevidence.
L19 — Correction batch published cf03e19 + ea2c6c632b251167655a370296319f9baf3efcff. Job22 reran fullbackend on clean committed ea2:77suites2515PASS/158SKIP (10.862s),diffPRbase..HEADPASS,pushSUCCESS. First immediatePRbindingassert stopped before any metadata/comment writes; fresh PR/remote-ref reads confirmed ea2 OPENmaster with no newcomment. Job23 updated PRbody exactHEAD/count2055diffLines and corrected oldcomment6239503582 to distinguish CI merge from associated head, then created one1879char remediationcomment https://github.com/marcostoledo96/busca_empleos/pull/45#issuecomment-6240360671. No force-push, repeated tests/push or duplicated comment during binding resolution.
L20 — CI39066120117 observed completed SUCCESS for associatedHEAD ea2c6c6; Backendunit,BackendDB/PostgreSQLisolated,Frontendbuildtests,Vercel/PreviewComments all SUCCESS. Parent read actual checkout logs (job24exit0): all3Actions jobs checked out 8e83991ee0b98c939e9f74c5f811b4bb036d37c2, merging ea2c6c632b251167655a370296319f9baf3efcff into BASEe9de0ee684661ea80e26c699d78c80346cbe5c69. Thus localbackendHEADtesting and CIsyntheticmergetesting are separate evidence, neither claims production. Source/runtime fixed and tested; this final tracking-only close adds no code changes and its newHEAD is reported in PR/comment metadata after push. Operational novelty/repetition/usefulness, IAconditions and external verdict remain pending separate acceptance; no repeat smoke or production/cron/DeepSeek/merge/issueclose/manualdeploy.
