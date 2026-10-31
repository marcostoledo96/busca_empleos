# Issue 70 — Diagnóstico DeepSeek y preview seguro
Objetivo: observabilidad sin contenido privado y recuperación solamente preparada. Rama: fix/issue-70-diagnostico-deepseek; BASE b3f243baa360c385a4f61a8ebe4399a7450a75d3.
Entrega: single-pr hacia master (elección humana tras informar ~900 líneas); commits por unidad, Jest y PostgreSQL sintético aislado. Risk: item 2 (privacidad de telemetría).

## Specs
S1. «Leé íntegramente `AGENTS.md`, la issue #70, la documentación y los tests existentes.» «Auditá antes de modificar.» «Distinguí causas comprobadas, hipótesis y evidencia faltante.» «Trabajá en una rama y worktree exclusivos.»
S2. «Reutilizá el callback existente `alRecibirMetadatos` para introducir observabilidad segura y proporcional.» «Necesito identificar por qué falla cada evaluación sin exponer prompts, CV, descripciones, razonamiento privado, respuestas crudas ni credenciales.»
S3. «Implementá las correcciones mínimas justificadas por la evidencia y agregá tests de regresión sintéticos.» «Preservá las evaluaciones correctas, caché, firmas, exclusiones, datos de postulación y estados manuales.»
S4. «Prepará un preview seguro de los candidatos a reintento, sin ejecutarlos automáticamente.» «Evitá solicitudes duplicadas, consumo oculto, loops, tormentas de 429 y reevaluación de ofertas exitosas.»
S5. «Evaluá si hacen falta reintentos adicionales, pero no los agregues por conjetura.» «No llamar a DeepSeek real ni utilizar recursos pagos.» «No leer ni modificar producción sin autorización específica.» «No ejecutar reevaluaciones masivas ni recuperar automáticamente los cinco errores históricos.»
S6. «No aumentar `max_tokens`, cambiar modelos, desactivar `thinking`, modificar scoring, prompts o preferencias sin evidencia y aprobación pertinente.» «No realizar migraciones, deploys ni builds por iniciativa.» «No mezclar la issue #71 de Bumeran ni la auditoría semántica de #69.» «Respetar los procesos, worktrees y recursos existentes.»
S7. «Ejecutá tests focales y el `npm test` completo exigido por AGENTS.md.» «Utilizá PostgreSQL sintético aislado cuando sea necesario para verificar persistencia e integridad.» «Documentá PASS, FAIL, SKIPPED y las limitaciones reales.» «Realizá una verificación independiente con Gentle AI.»
S8. «Cuando el alcance esté implementado y verificado, realizá commit y push, y abrí una PR hacia `master` con `Closes #70`.» «Informá HEAD y BASE exactos, archivos cambiados, causa encontrada o incertidumbre restante, resultados de pruebas, evidencia, riesgos y condiciones para una futura recuperación autorizada.» «No hagas merge, no cierres la issue y no despliegues.»

S9. «arregla todo lo mencionado en el comentario de la pr». Comentario PR-AUDIT-V1 #6510793102 (verbatim en L11): «Mínimo: adjuntar logs verificables ya existentes con comando, entorno sintético, SHA de fuentes probadas y 2/2 PASS, o ejecutarlas en un recurso propio aislado permitido; comparar con este HEAD y su delta.» «Mínimo: vincular reporte/log existente del Verify con SHA y pruebas concretas; no repetir evidencia válida por formalidad.» «dejar comentario breve de entrega EN ESTA PR por cada nuevo commit/lote, con HEAD exacto y BASE relevante».

## Tasks
T1 | S1-S3,S5-S6 | Explore + Worker | done | RED30+7legacy+21suite; GREEN377 focales y full2869PASS159SKIP0FAIL. DiferencialCV20/20. Semántica original restaurada, issue17 intacta. Commit 91600bc0def9a985b4a7f8d83baed8bf3c92bb66 (333+/97- con docs/tests).
T2 | S3-S6 | Worker | done | REDGET404/SQLsinpredicado; GREEN38PASS39SKIP focal. PG18real2/2PASS, cero fetch; GETunaSELECT, snapshots idénticos, persistencia/caché/manuales conservados. Commit e973d8c37cca0c65aa85384ade74f6917170a587.
T3 | S1-S7 | Verify + inline | done | Full2874PASS161SKIP0FAIL; PG18real2PASS/apagado; Verify independiente sinblockers146PASS37SKIP+14probesPASS+diferencialparser20/20; commit e973d8c37cca0c65aa85384ade74f6917170a587 registra evidencia.
T4 | S8 | inline | done | Push job10exit0 y PR73 abierta hacia master Closes70/type:bug; sin merge/cierre/deploy. Cierre documental identificable por git blame de esta línea, HEAD final exacto en PR/mirrorEngram.

T5 | S7,S9 | inline, evidencia pasiva existente | done | G1logPGoriginal+entorno/exit0/stop y G2reporteprimarioVerify publicados; 21hash/18blob/JSONlinks/privacyPASS; sin nuevaspruebas/producto. Commit 94e3c74fa50b8cc4cdaf8ed08c6279e6b95b9186.
T6 | S8-S9 | inline | done | Commit94e3c74/pushjob18exit0 y comentario único6537053039publicado/readbackexactojob19exit0. HEADfinaldelcierre se actualiza en el mismo comentario/PR/mirrorEngram; no otorgar APTO del auditor.

## Log
L3. Worker mvu3oq8s-2-xwx0: 8 archivos autorizados, diff303+/71-, RED30fallos93PASS -> GREEN131PASS, parser legacy7FAIL69PASS fuera de superficie. Solicita autorización exacta backend/tests/servicios/evaluacion/parser-respuesta-ia.test.js; no se amplía unilateralmente. DiferencialCV/fullPGVerify pendientes. Sin proveedores/producción/builds/commits. npm ci aislado job2 exit0 (warnings dependencias antiguas, sin cambios de lockfile).

L1. Pedido original (verbatim):

Actuá como ingeniero de software senior especializado en Node.js, PostgreSQL, APIs de IA y calidad de software. Trabajá en Busca Empleos utilizando Gentle Shell y Gentle AI.

**Repositorio:** `marcostoledo96/busca_empleos`

**Issue:** https://github.com/marcostoledo96/busca_empleos/issues/70

**Rama destino:** `master`

### Objetivo

Resolver la issue #70: diagnosticar las respuestas incompletas de DeepSeek y preparar una recuperación segura de las evaluaciones fallidas.

La PR #72 ya fue mergeada y la issue #69 está cerrada. Partí del `origin/master` actual.

### Instrucciones

1. Leé íntegramente `AGENTS.md`, la issue #70, la documentación y los tests existentes. Recuperá el contexto relevante de Engram y utilizá Gentle AI Explore, Worker y Verify según las políticas vigentes. Trabajá en una rama y worktree exclusivos.

2. **Auditá antes de modificar.** Investigá el flujo completo desde la respuesta de DeepSeek hasta su persistencia. Distinguí causas comprobadas, hipótesis y evidencia faltante. No supongas que las respuestas incompletas se deben necesariamente a `max_tokens`, `thinking` o al proveedor.

3. Reutilizá el callback existente `alRecibirMetadatos` para introducir observabilidad segura y proporcional. Necesito identificar por qué falla cada evaluación sin exponer prompts, CV, descripciones, razonamiento privado, respuestas crudas ni credenciales.

4. Implementá las correcciones mínimas justificadas por la evidencia y agregá tests de regresión sintéticos. Preservá las evaluaciones correctas, caché, firmas, exclusiones, datos de postulación y estados manuales. Prepará un preview seguro de los candidatos a reintento, sin ejecutarlos automáticamente.

5. Evaluá si hacen falta reintentos adicionales, pero no los agregues por conjetura. Evitá solicitudes duplicadas, consumo oculto, loops, tormentas de 429 y reevaluación de ofertas exitosas.

### Restricciones

- No llamar a DeepSeek real ni utilizar recursos pagos.
- No leer ni modificar producción sin autorización específica.
- No ejecutar reevaluaciones masivas ni recuperar automáticamente los cinco errores históricos.
- No aumentar `max_tokens`, cambiar modelos, desactivar `thinking`, modificar scoring, prompts o preferencias sin evidencia y aprobación pertinente.
- No realizar migraciones, deploys ni builds por iniciativa.
- No mezclar la issue #71 de Bumeran ni la auditoría semántica de #69.
- Respetar los procesos, worktrees y recursos existentes.

### Verificación y entrega

Ejecutá tests focales y el `npm test` completo exigido por AGENTS.md. Utilizá PostgreSQL sintético aislado cuando sea necesario para verificar persistencia e integridad. Documentá PASS, FAIL, SKIPPED y las limitaciones reales.

Realizá una verificación independiente con Gentle AI. No consideres sus resultados un reemplazo de las pruebas obligatorias.

Cuando el alcance esté implementado y verificado, realizá commit y push, y abrí una PR hacia `master` con `Closes #70`.

Informá HEAD y BASE exactos, archivos cambiados, causa encontrada o incertidumbre restante, resultados de pruebas, evidencia, riesgos y condiciones para una futura recuperación autorizada.

**No hagas merge, no cierres la issue y no despliegues.**

Priorizá máxima calidad necesaria con mínima complejidad suficiente. Avanzá autónomamente dentro de los permisos establecidos, sin pedir confirmaciones por cada decisión técnica menor.

L2. Auditoría Explore mvu3do8p-1-p6ad: callback no usado por evaluador; código normalizado se pierde en catch; mensajes genéricos no permiten atribuir cinco históricos. Selección de errores existente incluye resultados anteriores y estados manuales. No evidencia para retries adicionales. Mantener configuración y firmas intactas. Issue70 leída completa sin comentarios; #69 cerrada y #72 mergeada confirmados. Fuera de alcance producción y datos reales. Worktree exclusivo limpio. CodeGraph del principal no representaba BASE; Explore inicializó índice propio antes de leer código.

L4. Respuesta humana (verbatim): «1». Autoriza únicamente backend/tests/servicios/evaluacion/parser-respuesta-ia.test.js como superficie adicional para actualizar siete expectativas, repetir focales y completar diferencial importación CV.

L5. T1: fullpadre job3 FAIL21/2848PASS159SKIP; regresión propia early-return ampliado detectada y corregida en un lote Worker mvu4f1zt-4-edqy, restauró semántica sin modificar issue17. Focal377/377 y full2869PASS159SKIP0FAIL (22.888s). Diferencial importCV20/20 antes de esa corrección (cliente sin cambios posteriores). DiffT1 333+/97-; revisable por unidad. ASSESS RDDoff nativeunassessable por untracked, escalateitem2 exige Verify independiente T3; no operación lifecycle autorizada.

L6. T2 Worker mvu4jukd-5-hm2w completado: GET autenticado proyecta total/ids; selector compartido protege POST. Focal38PASS39SKIP0FAIL; PG18nuevo cluster local loopback puerto efímero, BD busca_empleos_issue70_test, fixtures transaccionales propias sin migraciones. Job4 exit0 2PASS: frontera30d, orden, read-onlyunaSELECT/snapshots idénticos, nofetch, fallo+recuperación100 y preservación101 previa con firma/postulación/nota/caché. Trap apagó solo cluster propio; no producción. ASSESSfinal mismo plan independienteitem2/RDDoff, sinlifecycle. Limitación preview no reserva IDs ni autoriza POST; cinco históricos desconocidos. Suite final job5exit0 2874PASS161SKIP0FAIL85suitesPASS11SKIP24.397s; PG2SKIP del full verificados aparte2PASS. Verify independiente mvu4sb9b-6-n4o0: focal146PASS37SKIP, dictamen pendiente. Documentación actualizada con evidencia observada. Verify mvu4sb9b-6-n4o0 final sinblockers S1-S7met: propios146PASS37SKIP+14/14probes+parserdiferencial20/20, fuente/test18hashesidénticos. Preexistente: explicaciónsemánticainconsistenteconservatexto, nofiltracióndiagnósticanueva; noauditoríasemántica. SnapshotnoreservaIDs. Unidad1 commit91600bc0def9a985b4a7f8d83baed8bf3c92bb66 exit0, fuentes sin cambios. Unidad2 y publicación pendientes.

L7. Decisiones humanas de entrega (verbatim): «Una sola PR — menos recomendada por tamaño» y «Agregar status:approved a la issue #70». Single-pr aceptado tras advertir carga de revisión/reversión acoplada y ~900 líneas. Agregar solo status:approved a issue70; type:bug a PR. No size:exception: destino sin política propia de tamaño/template (solo CI). master default y permisos admin/maintain/push confirmados por API. Issue abierta sin labels antes de autorización. No merge/cierre/deploy.

L8. Verificación final: padre74PASS cliente/worker; Worker377PASS y full2869PASS159SKIP antes T2; final full2874PASS161SKIP, PG2PASS separados. 159 tests omitidos ajenos no comprobados; no frontend/build/proveedor/producción. ASSESS nativeunassessable por untracked con escalateitem2 plan cumplido selfchecks+Verify, RDDoff sinlifecycle. Erroroperativo inicial assessencodemode rechazado (luego llamada directa), lecturas rutas legacy db/jest/setup inexistentes corregidas sin alterar entorno; primer replyVerify taskIDerróneo noentregado y resuelto con identidad real. Ninguna de esas operaciones produjo pruebaPASS ni cambios de fuente.

L9. Entrega observada: unidades91600bc y e973d8c (ambas exactas arriba), push job10exit0 y PR https://github.com/marcostoledo96/busca_empleos/pull/73 hacia master con Closes70 y type:bug. status:approvedissue70confirmadojob7exit0autorizado. Diff21archivos789+/111-. Worktreepropio limpio tras commits; fuente3SHA256iguales antes/después91600bc/e973d8c. Cierre documental sin cambios de comportamiento; HEADfinal exacto y CI se reportan en PR y mirror para evitar commitrecursivo. Ningún merge/cierre/deploymanual. Pipeline/preview automáticos del repositorio pueden ejecutarse por PR; no inicié comandos de build/deploy.

L10. Pedido humano (verbatim): «arregla todo lo mencionado en el comentario de la pr». BASE de esta continuación af52277be070aa8909d46299c683e128c3cf4bf5; worktree limpio y HEAD remoto coincidente. CI anterior confirmado40969750010SUCCESS4/4. El comentario no identifica defectos comprobados; exige evidencia pública G1/G2. No seleccionar optimización opcional de SELECT ni cambiar producto, CI o pruebas. Se reutilizan registros válidos, no se relanzan.

L11. Comentario de auditoría completo (verbatim), https://github.com/marcostoledo96/busca_empleos/pull/73#issuecomment-6510793102:

PR-AUDIT-V1
VERDICT: EVIDENCIA INSUFICIENTE para APTO FINAL. No identifiqué defectos bloqueantes comprobados en el código revisado; faltan 2 corroboraciones materiales, no son FAIL del producto.
REPOSITORY: marcostoledo96/busca_empleos
PR: #73 https://github.com/marcostoledo96/busca_empleos/pull/73; issue #70.
BASE: master @ b3f243baa360c385a4f61a8ebe4399a7450a75d3.
HEAD: af52277be070aa8909d46299c683e128c3cf4bf5.
BRANCH: fix/issue-70-diagnostico-deepseek -> master; merge-base b3f243baa360c385a4f61a8ebe4399a7450a75d3; 3 commits, último solo documental.
SCOPE: diff acumulado completo: 21 archivos, +791/-111 líneas; cliente DeepSeek, parser, servicio/worker, SQL, controller/ruta GET, pruebas y docs. AGENTS.md e issue #70 leídos; revisados commits, comentarios, reviews, CI e integración contra master.
STATUS: OPEN, no Draft, no merged; usuario autenticado marcostoledo96. CI del HEAD: SUCCESS 4/4 jobs (https://github.com/marcostoledo96/busca_empleos/actions/runs/40969750010). Auditoría READ-ONLY; 0 modificaciones, 0 solicitudes reales a IA, 0 POST de recuperación.
FINDINGS:
- PASS — revisión estática independiente: backend/src/config/deepseek.js:219-285 y backend/src/servicios/servicio-evaluacion.js:146-156,287-310,355-381 usan códigos normalizados y allowlists para modelo/finish_reason/tokens. No incorporan prompts, CV, razonamiento ni respuestas crudas al diagnóstico nuevo; callback síncrono/asíncrono/fallido se aísla de la decisión y no crea reintentos de contenido. Se conservan modelos, max_tokens 4096/16384 y hasta 4 intentos de transporte existentes. Clasifica length, cierres no válidos/ausentes, vacío, JSON, schema, HTTP, timeout, cancelación/transporte; no atribuyo causas a errores históricos.
- PASS — revisión estática independiente: backend/src/modelos/oferta.js:971-988 comparte selector GET/POST: pendiente reciente con fallo no vacío, sin firma/porcentaje previo (0 incluido), sin postulación/fecha/nota manual (incluso nota vacía), y orden estable; preserva reaparición reciente. backend/src/controladores/controlador-evaluacion.js:144-152 proyecta exclusivamente total/IDs, devuelve 503 genérico si SQL falla; backend/src/app.js:166-203 aplica autenticación Firebase y rate limit. El GET no adquiere mutex ni ejecuta worker/IA/escrituras. El POST existente vuelve a seleccionar, sin autorización operativa implícita.
- PASS — integridad por inspección del worker: backend/src/servicios/servicio-evaluacion.js:469-559 mantiene fallo técnico separado del rechazo, conserva resultado válido anterior y difiere caché hasta confirmar persistencia. Tests añadidos cubren fixtures de metadatos, parser, errores y selector. Documentación revisada y consistente; no se mezclaron #69 ni #71.
- PASS — CI observada DIRECTAMENTE en logs del HEAD: npm test backend: 85 suites PASS, 11 SKIPPED; 2874 PASS, 161 SKIPPED, 0 FAIL. Job DB: 16 suites y 212 PASS, 0 FAIL. E2E integración Issue57: 26 PASS; frontend E2E: 222 PASS; 4/4 jobs SUCCESS. Estos resultados son CI, no ejecución propia. Vercel status success no equivale a validación de recuperación en producción.
- SKIPPED — 161 tests en npm test: 2 de PostgreSQL de issue70 requieren doble opt-in, y otros 159 no ejecutados en ese gate; SKIPPED no es PASS ni demostración de cobertura. NO RUN (auditor): 0 tests ejecutados por mí; no dispongo de checkout/dependencias/PG sintético aislado habilitado. No presupongo FAIL.
- PENDING G1 [evidencia material, no defecto probado] — backend/tests/integracion/issue-70-recuperacion.test.js:19-22,123-192: sus 2 pruebas PG sintéticas están SKIPPED en npm test; backend/package.json (script test:db) no las incluye en el job DB observado. Causa: selección de suites de CI; impacto: no puedo corroborar por ejecución propia la conservación SQL real de firma, porcentaje 0, caché y seguimiento. Pi declara 2/2 PASS en PostgreSQL18 aislado. Mínimo: adjuntar logs verificables ya existentes con comando, entorno sintético, SHA de fuentes probadas y 2/2 PASS, o ejecutarlas en un recurso propio aislado permitido; comparar con este HEAD y su delta. No usar datos reales ni reintentar Actions.
- PENDING G2 [evidencia material, no defecto probado] — odd/tasks/issue-70-deepseek.md:18,82-86: declara Gentle AI Verify independiente (146 PASS, 37 SKIPPED, 14 probes y diferencial 20/20), sin log/artefacto primario accesible en PR para contrastar identidad del candidato y alcance. Impacto: el gate de verificación externa exigido por issue70 queda reportado, no corroborado. Mínimo: vincular reporte/log existente del Verify con SHA y pruebas concretas; no repetir evidencia válida por formalidad.
- NOT RUN/N/A: proveedor DeepSeek real, producción, recuperación histórica, deploy manual, reevaluación masiva y validación semántica de matching; no son objetivos autorizados. GET es snapshot no vinculante, no reserva IDs, y cualquier ejecución futura requiere IDs exactos, permiso operativo y revalidación justo antes del POST. No se comprobó causa retrospectiva de los 5 errores.
- Opcional/no bloqueante: evaluar SELECT de IDs para el preview si se necesitara optimizar carga SQL; SELECT * actual devuelve solo IDs por HTTP y sirve al POST. No modificar por rutina. Sin otros defectos confirmados; las pendientes se reevaluarán con evidencia material o cambios del HEAD/BASE.
- PETICIÓN A PI/ANTIGRAVITY (implementador): dejar comentario breve de entrega EN ESTA PR por cada nuevo commit/lote, con HEAD exacto y BASE relevante; cambios y hallazgos atendidos; comandos/pruebas realmente ejecutados con PASS/FAIL/SKIPPED/NOT RUN/PENDING/N/A y cantidades; evidencia/logs/enlaces; entorno, alcance, pendientes y límites. Distinguir avance parcial y entrega final; asociar pruebas al SHA probado, explicar delta/no revalidado si difiere del publicado. Sin secretos ni datos reales. Esas entregas son declaraciones a contrastar, no PASS automático ni autorización para acciones.
- No aprobar/mergear/cerrar/desplegar por esta auditoría. Nuevos commits, cambios materiales de evidencia/CI/revisiones o alcance requieren revisión del delta y del conjunto antes de nuevo dictamen; evitar comentarios duplicados.

L12. G1/G2: docs/evidencias/issue-70 contiene siete artefactos pasivos, log combinado originalPGjob4(2PASS0FAILexit0), stop original, comando/entornoeventjson, reporteprimarioVerifytaskmvu4sb9b-6-n4o0sanitizado10rutas+2Markdownhardbreaks, manifiesto18blobsSHA256 y SHA256SUMS21. PGnoimprimióSHAcontemporáneo, asociaciónretrospectivatransparente:3hashesdelpadreprevios+Verify18bytesunchanged+historialsinfuentesposteriores; noinventarattestationniAPTOexterno. Integridad21checks/18blobs, JSON/logcounts,links,privacyscanPASS; gitdiffcheck detectóprimeroEOF y luego2espaciosoriginalesMarkdown, normalizadosyhashesactualizadosantesGREEN. ASSESSmedium8paths665lines(Selfverification/noindependent/RDDoff/reviewDuefalse), no lifecycle. No código/tests/CI cambiados ni ejecucionesJestPGVerifyActions nuevas, no production/IAreal. Fuenteaf52277 byteidéntica. OptimizaciónopcionalSELECTomitida. Cierre externo del auditor sigue pendiente, no defecto propio ni tarea delegada.

L13. Entrega G1/G2 observada: job18exit0commit94e3c74fa50b8cc4cdaf8ed08c6279e6b95b9186+push, job19exit0 creó un solo comentario https://github.com/marcostoledo96/busca_empleos/pull/73#issuecomment-6537053039 (id6537053039), body readback idéntico, markerPI-EVIDENCIA-G1-G2-V1sin duplicados. Candidatoaf52277/código/tiposdeprueba/limitaciónSHAretrospectivo explicitados, noAPTOexterno ni nuevaejecución. BASEdeltaaf52277 y BASEPRb3f243b exactos en comentario. Este cierre es solo ODD; su HEAD final se sincroniza por PATCH en el mismo comentario y descripciónPR (fuente18byteidéntica), sin otrocomentario/commitrecursivo. Sinmerge/cierreissue/deploy/producción/IAreal/Actionsretry.
