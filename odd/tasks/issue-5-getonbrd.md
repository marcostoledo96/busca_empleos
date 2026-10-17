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

## Tasks
T1 | S1-S6,S8-S10 | delegated gentle-ai-worker (explicit user routing) | done | RED/GREEN observed; focused 356 tests, evidence packaging 13; full backend 2456 pass/158 skipped (DB opt-in) | 093c34924e57681919519fe72dac13dbb3686a6e
T2 | S2,S4,S7,S9-S10 | delegated gentle-ai-worker (explicit user routing) | done | Focal133+18 pass; full frontend and Angular production build job7 exit0; tsc and diff check pass | 1b6e2105b553bb7748226d471890ea542b7ad17d
T3 | S1-S12 | delegated gentle-ai-verify + parent delivery | in_progress | Independent verification no blockers; smoke1GET HTTP200; full backend2489pass/frontend/build pass; preserve probes/evidence, native review and PR pending | commit pending

## Log
L1 — Original request: supplied in the active Pi user message, issue #5 implementation, sections 1–13. Exact actionable requirements are preserved verbatim in S1–S12 above; original context lists existing file paths and pilot features (no rewrite). User explicitly requests one PR and authorizes commits/push/PR, not merge/deploy/cron activation.
L2 — Preparation: gh issue view read full issue and comments (none); git fetch --prune origin completed. Old feat/activar-getonbrd-produccion: 29 behind, 0 ahead, existing local modifications left untouched. New registered worktree /home/marcos/Escritorio/Busca_empleos/busca_empleos-issue-5 starts e9de0ee684661ea80e26c699d78c80346cbe5c69. Historical memories about private authorization are not current proof; verify public docs.
L3 — Explorer mvcpuc3v-1-hnn3: CodeGraph initialized in new worktree; public manual/help/OpenAPI describe unauthenticated public jobs search on https://www.getonbrd.com/api/v0/search/jobs, per_page <=120. No published request quota found; ToS reserve throttling/abuse controls. Evidence bytes/date/hash must be captured before production allowance; old checkout's self-declared JSON/review_before is not acceptable evidence. Contract object-vs-array, registry, preferences FUENTES_TERMINOS, history whitelist and mobile dispatch require integration. No live jobs calls made.
L4 — Forecast: ~3 coherent work units, estimated 800–1500 authored diff lines with regression tests and evidence/docs; exact size to measure. Single PR is the user's explicit delivery choice; no automatic chaining or unrelated refactor. Scope is high risk: destination/security guard plus shared executor/status contracts, preserving persisted manual data; independent verify mandatory. No SDD selected or created.
L5 — Backend implementation: worker mvcq9pgq-3-aixw observed RED on guard/contract/controller/history/automation/language/checkpoint then GREEN 356 tests. Evidence rehomed within backend runtime in mvcqv7qr-5-prhv: RED1fail/12pass then GREEN13pass, exact manifest/extract bytes preserved. Work-unit commit093c34924e57681919519fe72dac13dbb3686a6e. General offline backend first2456pass/158skip; after independent probes75suites2489pass/158DBopt-in skips (job8 exit0). No PostgreSQL production/test DB accessed; real-model/synthetic-pg integration and #22 offline SQL contract covered.
L6 — Frontend implementation: worker mvcr0qm3-7-8im4 implemented actual preview-based enablement, individual desktop/mobile, loading/results and Railway docs. Existing local environment generator resolved initial TS2307 safely from ignored .example without secrets; tsc then exit0. Parent focal job5 RED3fail/130pass (Toast TestBed and new10th button count), corrected in mvcr9sj1-8-s7ne, GREEN133pass. Parent general job6 RED1fail/531pass/4skip: prior dashboard expected absence instead of visible blocked button. Worker mvcrrlu7-a-16k1 updated it to assert disabled/reason/no HTTP, GREEN18tests incl independent Angular probes. Full rerun/build job7 subsequently completed exit0; bundle664.53kB, build6.063s, no production config used.
L7 — Independent verification mvcrc6w9-9-vp5y read all S1-S12 and baseline/current in isolated scratch; no blocking source defects reproduced. Own33backend+4Angular probes and8guard tests passed. Output of resolver for other11sources identical baseline/current SHA256d3eaff88152299ef97699e8742525fd61d67e669521e1a65c4e2a549f5d9330a. Exact useful probes copied unchanged into regression files and passed again; provider availability not inferred from simulation. Verifier network unavailable by role, zero live requests.
L8 — Authorized real smoke (worker mvcrrlu7-a-16k1): exactly1GET https://www.getonbrd.com/api/v0/search/jobs?query=junior&page=1&per_page=3 at2026-10-17T19:13:01.915Z, completed19:13:02.506Z,591ms,HTTP200,3received/3normalized/0errors,exit0,no stderr. Guard enabled:true checked first, timeout5000,redirect:error,hard count prevents attempt2. Direct protected HTTP+normalization memory only, not pilot/executor/checkpoint or real persistence. No retries, API keys, DeepSeek, cron or production writes. Do not repeat this smoke.
L9 — Railway read-only MCP confirmed service busca_empleos production domain https://buscaempleos-production.up.railway.app; docs only updated. No service/env/cron/deploy mutations. .env.example tool access denied, respected without bypass; variable is documented in normal guides. Native inspect ready, no prior authority for current diff; assess T1 untracked initially unassessable so treated high; T2 medium. Complete PR slice assessment/review still pending; independent high-risk verification already observed.
