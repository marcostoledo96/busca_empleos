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

## Tasks
T1 | S1-S3,S5-S6 | Explore + Worker | done | RED30+7legacy+21suite; GREEN377 focales y full2869PASS159SKIP0FAIL. DiferencialCV20/20. Semántica original restaurada, issue17 intacta. Commit 91600bc0def9a985b4a7f8d83baed8bf3c92bb66 (333+/97- con docs/tests).
T2 | S3-S6 | Worker | done | REDGET404/SQLsinpredicado; GREEN38PASS39SKIP focal. PG18real2/2PASS, cero fetch; GETunaSELECT, snapshots idénticos, persistencia/caché/manuales conservados. Commit e973d8c37cca0c65aa85384ade74f6917170a587.
T3 | S1-S7 | Verify + inline | done | Full2874PASS161SKIP0FAIL; PG18real2PASS/apagado; Verify independiente sinblockers146PASS37SKIP+14probesPASS+diferencialparser20/20; commit e973d8c37cca0c65aa85384ade74f6917170a587 registra evidencia.
T4 | S8 | inline | done | Push job10exit0 y PR73 abierta hacia master Closes70/type:bug; sin merge/cierre/deploy. Cierre documental identificable por git blame de esta línea, HEAD final exacto en PR/mirrorEngram.

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
