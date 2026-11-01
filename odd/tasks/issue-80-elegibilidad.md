# Issue 80 — Afinidad y elegibilidad pendiente
Rama: fix/issue-80-elegibilidad; BASE: b8ca1e0e7033958b09d89f02671fcf0de845422f; entrega: PR independiente hacia master, sin merge/cierre.
Runner: Jest backend con proveedores simulados; estrategia: single-pr solicitada; previsión inicial ~350 líneas funcionales, ajustar tras reproducción.

## Specs
S1. "Eliminá exclusivamente ramas locales y worktrees obsoletos, limpios y cuya integración esté comprobada." "Conservá ramas con cambios pendientes, worktrees activos, datos privados y sesiones de otros agentes."
S2. "Primero reproducí los problemas con casos sintéticos sobre el código actual." "Aprovechá las correcciones integradas de #79 y #83. No dupliques sus reglas ni atribuyas automáticamente los errores históricos al código vigente o a DeepSeek."
S3. "No inventes requisitos, capacidades, datos personales ni equivalencias académicas." "No conviertas información desconocida en cumplimiento o incumplimiento automático." "Mantené separadas las condiciones deseables, obligatorias y pendientes de confirmación."
S4. "No permitas que un porcentaje alto compense una exclusión obligatoria." "Garantizá coherencia entre evaluación, validación, persistencia y presentación." "No cambies arbitrariamente los umbrales de matching ni el cálculo de porcentajes."
S5. "si resolver el problema exige crear un nuevo estado persistido o una migración, documentá la alternativa mínima y detené solo esa modificación para obtener una decisión de diseño. Continuá los demás trabajos independientes permitidos."
S6. "Agregá pruebas de regresión positivas y negativas con ofertas y perfiles inventados." "Verificá el flujo completo pertinente, no solamente funciones aisladas." "Simulá proveedores externos; no hagas llamadas reales a DeepSeek ni Apify." "Ejecutá pruebas focales y `npm test` backend completo." "Si modificás la interfaz, verificá los estados visibles mediante pruebas automatizadas con datos sintéticos."
S7. "La issue #81 trata específicamente las contradicciones del validador. No absorbas ese alcance ni modifiques simultáneamente archivos utilizados por otra sesión sin coordinar."
S8. "Hacé commit y push en la rama de #80." "Abrí una PR independiente hacia `master`." "No hagas merge ni cierres la issue." "No publicar el dataset privado, informes de auditoría, ofertas reales, datos personales, credenciales ni logs sensibles."
S9. "arregla todo lo comentado en el comentario de la pr" — PR-AUDIT-V1 comentario6563865508. "antes de aprobar, aplicar una comprobación conservadora al desglose: obligación en `cumplidos` sin evidencia acreditada del perfil → `por_confirmar`/estado pendiente, conservando afinidad; `no_cumplidos` o `exclusiones` obligatorias contradictorias con `match:true` no pueden producir aprobación (diferenciar incompatibilidad probada de dato incierto). No inventar equivalencias, bloquear deseables ni rediseñar el parser de #81." "la captura específica de elegibilidad no fue inspeccionada: límite explícito / revisión visual puntual PENDING"
S10. "arregla todo lo mencionado en el comentario de la pr" — PR-AUDIT-V2 comentario6564469167. "no tratar `perfil_profesional` como certificado de que una titulación está obtenida o una residencia está vigente por simple substring. Requerir evidencia afirmativa de cumplimiento ACTUAL del mismo hecho, o preservar el obligatorio en `por_confirmar` con score técnico intacto; negaciones/planes/cursadas sin graduación no son incompatibilidad probada." "Mantener cumplimientos confirmados, exclusiones duras reales, deseables no bloqueantes, inglés obligatorio vs deseable, #79/#83, coherencia de cache v8 (versionar si cambia el contrato), sin ampliar el parser #81 ni inventar equivalencias."

## Tasks
T1 | S1,S2,S7 | inline + exploración delegada | done | fetch 0; PR84/85 MERGED y ancestros; master FF sin cambios; worktree80 creado; candidatos inspeccionados preservados.
T2 | S2-S7,S9-S10 | delegated | done | V2 ycontextofuentecompletocorregidos. REDcontexto4FAIL/140PASS;GREEN144PASS4suites+1543relacionadas. Hechosafirmativosactualesautónomos,v9,sinblacklist/parser81;commitd3170af80b2c3ba901a2c2621b98901a13001d5a.
T3 | S2-S7,S9-S10 | inline + verificación independiente | done | Parentglobal3850PASS166SKIP/90suitesPASS11SKIP;recheckdirigido144PASS+52/52probes,0blockers.Browser7PASSsinUIposterior.FuenteSHA256191b779e268207d36a58b1512cb5761183f3b60e701364507b80a0f1d8d8096f.
T4 | S8-S10 | inline | done | Funcionald3170afpushedexit0ycomentarioúnicoV2creado6565023510enPR86. Cierretracking posterior sinfuentes;CIexactayHEADfinalseactualizanenmismocomentario/Engram alconfirmar,pendientesalregistrar. PRabiertanomergenocierre.

## Log
L1 — Solicitud original:
Actuá como desarrollador principal y coordinador técnico de Busca Empleos.

**Repositorio:** `marcostoledo96/busca_empleos`
**Issue:** https://github.com/marcostoledo96/busca_empleos/issues/80
**Rama principal:** `master`

Trabajá autónomamente hasta entregar una PR lista para auditoría externa.

### 1. Limpieza segura y sincronización

Antes de implementar:

- Recuperá el contexto de Engram, leé AGENTS.md y cargá las skills necesarias.
- Inspeccioná Git, worktrees, ramas locales/remotas y trabajos activos de otros agentes.
- Confirmá que las PR #84 y #85 están integradas en `master`.
- Ejecutá `git fetch --prune`.
- Eliminá exclusivamente ramas locales y worktrees obsoletos, limpios y cuya integración esté comprobada.
- Conservá ramas con cambios pendientes, worktrees activos, datos privados y sesiones de otros agentes.
- No utilices `reset --hard`, `git clean`, borrados forzados ni elimines ramas remotas.
- Actualizá `master` mediante fast-forward y creá una rama/worktree independiente para #80.

No solicites autorizaciones innecesarias para operaciones seguras dentro del alcance ya aprobado.

### 2. Implementar la issue #80

Leé la issue completa y auditá el comportamiento vigente antes de modificar código.

**Objetivo:** distinguir correctamente entre afinidad técnica, elegibilidad real y requisitos todavía desconocidos.

Investigá:

- Ofertas con buen encaje tecnológico, pero requisitos obligatorios no acreditados.
- Restricciones de residencia o elegibilidad territorial.
- Titulaciones específicas sin equivalencia confirmada.
- Inglés obligatorio frente a inglés deseable, respetando las reglas existentes.
- Ofertas sin descripción o con información insuficiente que reciben puntuaciones altas.
- Contradicciones entre estado de aprobación, porcentaje, razones y explicaciones estructuradas.
- Errores técnicos confundidos con decisiones laborales.

Primero reproducí los problemas con casos sintéticos sobre el código actual.

Aprovechá las correcciones integradas de #79 y #83. No dupliques sus reglas ni atribuyas automáticamente los errores históricos al código vigente o a DeepSeek.

### 3. Implementación mínima

- Reutilizá los estados y contratos existentes siempre que permitan representar correctamente la incertidumbre.
- No inventes requisitos, capacidades, datos personales ni equivalencias académicas.
- No conviertas información desconocida en cumplimiento o incumplimiento automático.
- No permitas que un porcentaje alto compense una exclusión obligatoria.
- Mantené separadas las condiciones deseables, obligatorias y pendientes de confirmación.
- Garantizá coherencia entre evaluación, validación, persistencia y presentación.

**Importante:** si resolver el problema exige crear un nuevo estado persistido o una migración, documentá la alternativa mínima y detené solo esa modificación para obtener una decisión de diseño. Continuá los demás trabajos independientes permitidos.

No cambies arbitrariamente los umbrales de matching ni el cálculo de porcentajes.

### 4. Pruebas y verificación

- Agregá pruebas de regresión positivas y negativas con ofertas y perfiles inventados.
- Verificá el flujo completo pertinente, no solamente funciones aisladas.
- Simulá proveedores externos; no hagas llamadas reales a DeepSeek ni Apify.
- Ejecutá pruebas focales y `npm test` backend completo.
- Si modificás la interfaz, verificá los estados visibles mediante pruebas automatizadas con datos sintéticos.
- Realizá una verificación independiente con Gentle AI cuando aporte valor.
- Informá PASS, FAIL, SKIPPED, NOT RUN y PENDING con cantidades y evidencia real.

Evitá agregar dependencias, infraestructura o pruebas redundantes sin necesidad.

### 5. Entrega

Cuando la solución esté implementada y verificada:

1. Hacé commit y push en la rama de #80.
2. Abrí una PR independiente hacia `master`.
3. Publicá un resumen breve con HEAD/BASE, archivos modificados, problemas corregidos, pruebas ejecutadas y limitaciones.
4. Dejá la PR abierta para auditoría técnica externa.

No hagas merge ni cierres la issue.

### Coordinación y seguridad

La issue #81 trata específicamente las contradicciones del validador. No absorbas ese alcance ni modifiques simultáneamente archivos utilizados por otra sesión sin coordinar.

Mantené un máximo de dos frentes de implementación activos y sincronizate con `origin/master` antes de entregar.

No acceder a producción, ejecutar reevaluaciones reales, modificar preferencias personales, migrar datos, desplegar manualmente ni utilizar proveedores pagos.

No publicar el dataset privado, informes de auditoría, ofertas reales, datos personales, credenciales ni logs sensibles.

**Empezá directamente por la limpieza segura de Git y continuá con #80 hasta dejar la PR lista para revisión.**

L2 — Evidencia inicial: PR84 merge 4edef00 y PR85 merge b8ca1e0 son ancestros de origin/master; worktree master limpio y actualizado. Checkout original sucio preservado. Worktrees internos inspeccionados contienen cambios/bitácoras/ignorados; ninguno removible con prueba suficiente. Worktrees hermanos no inspeccionados fuera de raíces registradas, se preservan por defecto. No peers anunciados de este clon. Engram 15678 confirma cleanup previo; preferencias antiguas needs_review no usadas como autoridad, pedido actual autoriza entrega.
L3 — Mapa read-only: estados pendiente/aprobada/rechazada y por_confirmar ya disponibles, candidato para incertidumbre sin migración. Parser match boolean no debe aceptar null ni debilitar defensas #81. Sin descripción aún admite evaluación afín: reproducir antes de decidir fix. Riesgo inicial: item 3 (helpers de evaluación compartidos por recorridos no nombrados); verificación independiente al final.
L4 — RED inicial 10 FAIL/8 PASS, luego reglas/caché/instrucciones explícitas y UI reprodujeron defectos adicionales antes de corregir. Focal backend inicial 1526 PASS; UI RED2FAIL/16PASS, GREEN18PASS y detalle40PASS. El guardia sin descripción ejecuta exclusiones vigentes antes de diferir; afinidad válida no se recalcula. Parser #81 sin cambios. Contrato v7 invalida identidad anterior sin borrar datos.
L5 — Primer global3749PASS/1FAILversión/166SKIP + suite PDF no iniciada. Actualizada allowlist de versión, instalaciones existentes completas reutilizadas mediante enlaces ignorados; sin nuevas dependencias ni cambios en lockfile. Primer intento navegador exit127/0tests por runner incompleto, después7PASS (2nuevos5controles) sin retries. Environments desde ejemplos públicos/env limpio.
L6 — Independiente145PASS y diferencial48casos por versión (36idénticos12diferenciasintencionales) descubrió rehidratación procesadas1->0. Corrección acotada respeta evaluadas=resultadosválidospersistidos; pendientes de progreso no equivalen elegibilidad laboral. RED6FAIL/28PASS; GREEN34PASS, otras142PASS. Recheck independiente106PASS/0FAIL (34SKIP por filtro adicional), sin blockers. No agrega campos, no deriva desde porcentaje redondeado ni repara históricos.
L7 — Candidato final backend npm test -- --runInBand: 3791PASS/166SKIPPED,90suitesPASS/11SKIPPED,exit0. Angular40PASS y navegador7PASS/0FAIL. No builds locales, SQL real, producción, reevaluaciones ni proveedores. RDDoff; assess high por item3 requirió independiente ya ejecutado; no lifecycle. PR única solicitada:610líneasfuncionales(591+19),principalmentepruebas; no recortar cobertura para umbral orientativo. Una unidad coherente backend+presentación, documentación de seguimiento separada.
L8 — Push exit0 y PR creada confirmada: https://github.com/marcostoledo96/busca_empleos/pull/86, base master, type:bug, sin merge/cierre. Funcional1aa9d80/seguimiento4d5ec14. Checkout original conserva50cambiospreexistentes; warning de gh no corresponde al worktree de entrega. Fuentes verificadas sin cambios posteriores. Este cierre actualiza solo bitácora; CI del HEAD final pendiente al registrar, se informará en PR y Engram con identidad exacta sin nuevas fuentes.
L9 — CI41348518534 exact b54e00e final SUCCESS4/4; resumen PR actualizado y confirmado. Registro histórico, no válido para el siguiente delta.
L10 — Corrección del usuario (2026-11-01), literal: arregla todo lo comentado en el comentario de la pr
L11 — Auditoría autorizada por L10; contenido íntegro del comentario público6563865508:
PR-AUDIT-V1
VERDICT: ⛔ **NO APTO PARA MERGE** — 1 bloqueo funcional P1 comprobado; el CI verde no lo resuelve.
REPOSITORY: marcostoledo96/busca_empleos
PR: #86 — https://github.com/marcostoledo96/busca_empleos/pull/86 — Issue #80 OPEN
BASE: master @ b8ca1e0e7033958b09d89f02671fcf0de845422f (merge-base idéntica)
HEAD: b54e00e4a894392baf549bf4c93bd105624ff664
BRANCH: fix/issue-80-elegibilidad → master
SCOPE: diff acumulado 3 commits / 17 archivos (backend, contrato/cache, persistencia/lote, Angular, Playwright, pruebas y docs). #79/#83 ya integradas en BASE. Sin migraciones ni parser #81 modificado.
STATUS: PR abierta, no draft. Auditoría externa read-only del HEAD indicado, CI observado PASS 4/4 para el mismo árbol de contenido (merge de prueba 6c4992f = mismo tree SHA que HEAD). No autoriza merge.
FINDINGS:
**B1 · P1 / FAIL — Requisito obligatorio no acreditado puede quedar APROBADO.** `backend/src/servicios/servicio-evaluacion.js:134-143` solo mira obligatorios en `por_confirmar` cuando `match=true`; `:534` persiste `aprobada` si no aparece `pendiente`. `parser-respuesta-ia.js:329-405` no impide esas contradicciones de categorías para `match=true` (alcance #81 independiente).
**Reproducción propia sintética sobre funciones fuente exactas del HEAD, sin proveedor:** parser + `resolverElegibilidad` con `match:true`, score 91 y (a) `cumplidos:[{tipo:'obligatorio', requisito:'Licenciatura obligatoria', evidencia_perfil:''}]` → `pendiente:false` → `aprobada`; (b) `no_cumplidos` con obligación incompatible → `aprobada`; (c) `exclusiones` con obligación y `match:true` → `aprobada`. Control: obligación correctamente en `por_confirmar` → `pendiente:true`. 5 escenarios ejecutados: 3 FAIL de aceptación, 1 PASS; 1 exploratorio de rechazo por score bajo, no clasificado como defecto. No son llamadas a DeepSeek ni Jest.
**Impacto:** una afinidad alta puede acreditar falsamente elegibilidad y dejar razón/categoría/estado incoherentes, con persistencia/caché de un resultado aprobatorio válido en apariencia. El cambio v7 mejora casos bien clasificados, pero no cierra esta ruta.
**Corrección mínima:** antes de aprobar, aplicar una comprobación conservadora al desglose: obligación en `cumplidos` sin evidencia acreditada del perfil → `por_confirmar`/estado pendiente, conservando afinidad; `no_cumplidos` o `exclusiones` obligatorias contradictorias con `match:true` no pueden producir aprobación (diferenciar incompatibilidad probada de dato incierto). No inventar equivalencias, bloquear deseables ni rediseñar el parser de #81. Conservar defensas determinísticas y firma/caché v7 o versionar si cambia contrato.
**Validación requerida:** regresiones de consumidor público con proveedor/pool simulados para (a)-(c), contracasos de cumplimiento confirmado, exclusión real, deseable, extracto suficiente/insuficiente, caché hit/miss, selección/reintento, persistencia y reinicio; volver a ejecutar `cd backend && npm test` y gates vigentes en HEAD corregido. No pedir infraestructura nueva.
**CI observada, no pruebas propias:** https://github.com/marcostoledo96/busca_empleos/actions/runs/41348518534 (HEAD b54e00e; árbol merge idéntico): backend 3791 PASS / 166 SKIPPED, 90 suites PASS / 11 SKIPPED; Angular ChromeHeadless 583 PASS / 4 SKIPPED; Playwright 226 PASS, incl. 2 `@issue80`; SQL aislado 212 PASS; integración #57 26 PASS; 4 jobs success, 0 failed/pending. Los errores SQL/HTTP de fixtures en logs son pruebas negativas simuladas, no fallos del job.
**QA visual:** inspeccioné 6 capturas CI de `pendiente` en distintos tamaños/temas; muestran el aviso histórico de reevaluación, NO el nuevo aviso laboral. Los 2 E2E de #80 pasaron en navegador real (CI), pero la captura específica de elegibilidad no fue inspeccionada: límite explícito / revisión visual puntual PENDING; no atribuyo PASS visual solo a lectura estática.
**Pruebas externas propias:** parse/resolver focal sintético 5 ejecutadas (3 FAIL funcionales); npm test local NOT RUN, Angular local NOT RUN, navegador propio NOT RUN, BD real/proveedores reales N/A por restricciones/entorno sin checkout ni dependencias. `git diff --check` y RED/GREEN iniciales declarados por implementador; no los presento como propios. No hacer build/retry Actions por esta auditoría.
**A favor / sin bloqueo separado:** guardia sin descripción evita IA y score inventado; las obligaciones correctamente clasificadas se persisten pendientes, sin error técnico ni prioridad IA; estado/contadores y UI tratados con pruebas sintéticas; versión de contrato v7; no cambios SQL productivos. Regresión real de DeepSeek N/A; no certifico su respuesta semántica.
**Solicitud a Pi/Gentle Shell o Antigravity que implemente:** por cada commit/lote nuevo, dejar comentario breve de entrega EN ESTA PR: HEAD SHA exacto y BASE relevante; cambios/hallazgos atendidos; comandos y pruebas realmente ejecutados con PASS/FAIL/SKIPPED/NOT RUN/PENDING/N/A y cantidades; evidencia/logs/enlaces; entorno, alcance, pendientes y límites. Diferenciar avance parcial de entrega final; vincular resultados al SHA probado y explicar delta/no revalidado si difiere del HEAD publicado; sin secretos, CV/datos reales ni matrices privadas. El comentario no activa tareas ni sustituye verificación externa.
**Seguimiento de dictamen:** reauditar en el siguiente HEAD/evidencia material y comprobar integración y gates antes de cambiar a APTO; no trasladar automáticamente resultados de este HEAD.
L12 — Verificación del primer delta B1:3fallosoriginalesreproducidos;focal75PASS/relacionadas1543PASS/browser7PASS/capturas2inspeccionadas. Global13FAIL3809PASS166SKIP (issue17fixtures12 y recuperaciónissue18). Independiente128PASS y diferencial29casos/version evidencia B2: Aspiro a obtener Licenciatura en Sistemas.; Licenciatura en Sistemas pendiente de finalizar.; Carezco de Licenciatura en Sistemas.; perfil Deseables:\n- Licenciatura en Sistemas con cita inventada deseable Licenciatura en Sistemas, todos aprueban indebidamente. B3: Licenciatura en Sistemas obligatoria y Docker deseable. rebaja obligación a deseable. B4: anios_experiencia_reales1/cita1 año de experiencia queda pendiente aunque confirmado; No cuento con Licenciatura en Sistemas. en perfil_profesional no reconoce incompatibilidad literal. Se aplica una tanda acotada sobre estos bloqueos y fallos globales; sin nuevos commits/push ni aprobación externa.
L13 — Tanda acotada ejecutada: RED20FAIL/105PASS;GREEN125PASS en4suites +1543PASS relacionadas. Nuevas pruebas conservan score91/estado/razón/categorías/error/cache/persistencia/reinicio. Fixtures positivos#17/#18usanhechos/citasliteralessintéticas,sin cambiaraserciones;unknownsseconservan. Parentglobal3831PASS166SKIP/90suitesPASS11SKIP,exit0. Recheckindependiente125PASS+35/35probes públicos,0blockers,fuenteSHA25621fd5d531df3c00fb744847f17c28903fb548cd46309eb87b2ebd5f0f4493014. Browser7PASS;capturasnuevasespecíficas2inspeccionadas porpadre: aviso yrazónactualvisibles,sinrótulohistórico/error. Límitefonticonospreexistentedelharness. Sin nuevaauditoríageneral/proveedores/SQLreal/buildmanual.
L14 — Commit funcional c2120ffcbb0aa4e8c1e9ca8373cbecd56e224ad5,12files+358/-45;BASEdelta b54e00e4a894392baf549bf4c93bd105624ff664 ymasterb8ca1e0. Fetchprune/mergeffexit0antescommit. Parser#81sin cambios,contratov8,sinmigración/umbrales. Risk:item3helperscompartidos,assessplanindependiente cumplido,RDDoff. No mergeautorizado ni cambio del dictamenexterno; comentario yCIfinalpendientes.
L15 — Pushfuncionalc2120ffexit0; comentario único del lote creado y confirmado https://github.com/marcostoledo96/busca_empleos/pull/86#issuecomment-6564390885. IncluyeBASEmasterb8ca1e0/BASEdeltab54e00e,RED/GREENreal,global3831PASS166SKIP,independiente125PASS+35probes,browser7PASS/capturas2inspeccionadas ylímites. No editar dictamen del auditor. Cierre documental sin fuentes;elHEADpublicadofinalyCIexactaseactualizanenmismocomentarioycuerpoPR trasconfirmación, sin nuevoscomentariosniActionsretry. CI remota pendiente al registrar; sin afirmar entrega verificada remotamente todavía.
L16 — Cierre histórico V1: CI41354179485 exact97f4969 terminóSUCCESS4/4; comentarios/bodyactualizados yconfirmados. No sustituye prueba de V2.
L17 — Solicitud literal nueva (2026-11-01): arregla todo lo mencionado en el comentario de la pr
L18 — PR-AUDIT-V2 autorizado por L17, comentario6564469167 íntegro:
PR-AUDIT-V2
VERDICT: ⛔ **NO APTO PARA MERGE** — 1 bloqueo funcional P1 nuevo, reproducido independientemente en HEAD 97f4969 (no subsanado por el verde de CI).
REPOSITORY: marcostoledo96/busca_empleos
PR: #86 — https://github.com/marcostoledo96/busca_empleos/pull/86 — Issue #80 OPEN
BASE: master @ b8ca1e0e7033958b09d89f02671fcf0de845422f; merge-base comprobada idéntica.
HEAD: 97f4969b18ad1fecdffcf9714d2f8fe02da24fa5 (5 commits; penúltimo c2120ffc es funcional y último 97f4969 documenta).
BRANCH: fix/issue-80-elegibilidad → master
SCOPE: reauditoría del delta b54e00e…97f4969 (2 commits, 13 archivos cambiados) y recorrido acumulado BASE…HEAD (5 commits, 20 archivos). Backend de elegibilidad, parser, identidad v8, caché, persistencia/lotes, UI y E2E; guardias #79/#83 y alcance de #81 respetados. PR OPEN, no draft, sin merge.
STATUS: Corregido B1 de V1 para categorías sin evidencia. La entrega de Pi confirma 3831 PASS/166 SKIPPED backend y 7 PASS E2E locales (DECLARADOS por implementador; no ejecutados por este auditor). No consta PASS de todo el árbol actual por esas cifras. CI observada del candidato (no pruebas propias): https://github.com/marcostoledo96/busca_empleos/actions/runs/41354179485 — 3 jobs PASS, 0 FAIL, 1 PENDING, 0 SKIPPED de 4 jobs registrados; NO hay gate completo para el HEAD actual. El verde histórico de b54e00e (4/4) no se transfiere.
FINDINGS:
**B1 de V1 — PASS focal externo en el delta:** 3 contraejemplos sintéticos `match:true`, 91%, obligación sin `evidencia_perfil` en `cumplidos`/`no_cumplidos`/`exclusiones` ahora quedan `pendiente` y migran a `por_confirmar` sin falsa exclusión. Código revalidado, NO traspaso la aprobación general desde V1. La firma de evaluación pasó de v7 a v8; el parser de #81 no fue modificado.
**B2 · P1 / FAIL — Estar cursando una titulación o proyectar residencia se acredita falsamente como requisito cumplido.** `backend/src/servicios/servicio-evaluacion.js:139-176`: `hechosLiterales` incluye `perfil_profesional` íntegro; `cumplimientoAcreditado` exige coincidencia textual y excluye algunas palabras (`aspiro`, `pendiente`, `no`), pero NO distingue cursada en progreso, condición de estudiante ni residencia futura de titulación/residencia acreditada. `:177-209` deja ese obligatorio en `cumplidos`, no pone `pendiente`; `:600` persiste `aprobada` y `:289` admite caché firmada. Contradice la aceptación de #80: obligación desconocida no equivale a cumplida.
**Reproducción externa, sin ofertas/perfiles reales:** ejecuté funciones REALES de parser, perfil efectivo, entradas y servicio del HEAD, cargadas en sandbox JS, con proveedor/pool/caché y reglas preexclusión simulados. Oferta: «Licenciatura en Sistemas obligatoria» y respuesta sintética `match:true`, 91%, `cumplidos` citando requisito y perfil. (a) Perfil «Actualmente curso la Licenciatura en Sistemas.» → `aprobada`; (b) «Soy estudiante de Licenciatura en Sistemas.» → `aprobada`; (c) requisito «Residir en provincia Delta es obligatorio», perfil «Planeo residir en provincia Delta.» → `aprobada`. En los 3 casos la ruta pública `evaluarOfertasPendientes` invocó UPDATE `aprobada`, contó 1 aprobada/0 errores y escribió caché. Ninguno acredita título obtenido ni residencia actual. Controles: «Licenciatura en Sistemas: confirmado.» → aprobada; «Licenciatura en Sistemas pendiente de finalizar.» → pendiente.
**Pruebas propias y límites:** 11 probes parser+resolver aislados: **7 PASS / 4 FAIL** de criterios esperados (4 falsas aprobaciones, incl. «Me estoy formando»); 5 escenarios por flujo público `evaluarOfertasPendientes`: **2 PASS / 3 FAIL**. Total 16 ejecuciones sintéticas, con escenarios parcialmente repetidos, NO son Jest ni validación end-to-end SQL real. Tests backend/Angular/Playwright propios NOT RUN; BD real, DeepSeek/Apify real, producción, despliegue N/A por restricciones. El stub de exclusiones se limitó a avisos sin exclusiones determinísticas; no se declara probado su motor completo. CI y pruebas declaradas se distinguen arriba.
**Impacto:** una titulación en curso o una mudanza proyectada aparecen como cumplimiento de un obligatorio, con score 91 y estado aprobada, persistido/cachable; el detalle UI mostraría aprobación en lugar de confirmación pendiente al consumir ese estado. La incertidumbre de elegibilidad se vuelve un hecho sin prueba, precisamente el riesgo que #80 debe evitar.
**Corrección mínima:** no tratar `perfil_profesional` como certificado de que una titulación está obtenida o una residencia está vigente por simple substring. Requerir evidencia afirmativa de cumplimiento ACTUAL del mismo hecho, o preservar el obligatorio en `por_confirmar` con score técnico intacto; negaciones/planes/cursadas sin graduación no son incompatibilidad probada. Mantener cumplimientos confirmados, exclusiones duras reales, deseables no bloqueantes, inglés obligatorio vs deseable, #79/#83, coherencia de cache v8 (versionar si cambia el contrato), sin ampliar el parser #81 ni inventar equivalencias.
**Validación mínima a Pi:** agregar RED/GREEN del recorrido público con los 3 casos (curso, estudiante, mudanza futura), controles de título obtenido/residencia acreditada e incompatibilidad explícita, y revalidar los tres B1 de V1; probar proveedor/cache hit-miss, persistencia/rehidratación, selección/reintento, descripción nula/parcial, inglés obligatorio/deseable, frontend pendiente y regressions #79/#83. Ejecutar suites vigentes y reportar CI de HEAD real; no cambiar tests para ocultar fallos ni usar proveedores pagos/datos privados.
**Entrega requerida — Pi/Gentle Shell/Antigravity:** comentar EN ESTA PR por cada commit/lote con HEAD y BASE exactos; cambios/hallazgos corregidos, comandos ejecutados y conteos PASS/FAIL/SKIPPED/NOT RUN/PENDING/N/A, logs/enlaces/capturas verificables, entorno, límites, avance parcial/final y deltas no revalidados respecto del último SHA probado. No publicar secretos, datos personales ni matrices privadas. Mantener PR abierta para nueva auditoría; no merge automático.
L19 — PrimerdeltaV2:RED11FAIL/127PASS,GREEN138PASS4suites+1543related/browser7PASS. Independiente1blocker: Cuando me gradúe podré decir:\n«Obtuve la Licenciatura en Sistemas». y Todavía no puedo afirmar lo siguiente:\n«Obtuve la Licenciatura en Sistemas». apruebanporcitalíneaseparada,8FAILen4rutas. Diferencial34escenarios136ejecuciones/version:baseline92PASS44FAIL/candidato128PASS8FAIL,100idénticos36deltasintencionales,stderr0. PredicadoafirmativoactualfuncionaencasosV2originalesperopérdidacontextopersiste;unatandadirigidaarequerirafirmaciónfuenteautónomacompleta sinblacklistnidiseñoNLPgeneral.
L20 — CorreccióncontextualRED4FAIL140PASS/GREEN144PASSy1543related. Recheckindependientedelúnicoblocker144PASS+52/52probes0FAIL/stderr0;contratoconservadordefuenteautónomaconsideradocompatibleS10,sindecisióndiseñopendiente. Parentglobalfinal3850PASS166SKIP,90suitesPASS11SKIP,exit0;browser7PASSsinUIchanges. FuenteSHA256191b779e268207d36a58b1512cb5761183f3b60e701364507b80a0f1d8d8096f. Sincambioparser81/schema/score/umbral/deps/producción/proveedores/buildmanual. Evidenciavinculadaalcódigoverificado,noafirmaNLgeneralniaprobaciónexterna.
L21 — Funcionald3170af80b2c3ba901a2c2621b98901a13001d5a7files141+/21-trasfetchprune/masterFFactualizado,pushexit0. ComentarioúnicodeloteV2creadoyconfirmado https://github.com/marcostoledo96/busca_empleos/pull/86#issuecomment-6565023510,BASEdelta97f4969/baseb8ca1e0,evidencialocalyCIPENDINGsinatribuirverdeprevio. Este cierre sólo bitácora; fuenteSHA256finalinmutable. HEADfinal/CIexactaseactualizanenmismocomentario ycuerpoPRtrasconfirmación,sinotroPOST/retryActions/buildmanual/merge/cierre ni cambiar dictamen del auditor.
