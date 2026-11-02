# Issue 81 — Coherencia de validación y evidencia
Rama: fix/issue-81-validacion; BASE e9222110dde9f3eb61bd05f8b6092088b51f2f03; entrega single-pr hacia master, sin merge/cierre.
Runner: Jest backend offline; previsión ~300 líneas funcionales más tracking; proveedores/BD simulados, sin build.

## Specs
S1. "Eliminá únicamente ramas locales y worktrees obsoletos, limpios y con integración comprobada." "Conservá cualquier trabajo no integrado, cambios pendientes, sesiones activas y archivos privados." "Actualizá `master` mediante fast-forward desde `origin/master`." "Creá una rama/worktree independiente para la issue #81."
S2. "Primero construí una reproducción con datos sintéticos y determiná la causa exacta." "Contrastá las correcciones ya integradas de #79, #83 y #80. No supongas que el defecto histórico sigue existiendo." "Si el caso ya está resuelto, conservá regresiones suficientes y explicá por qué no hace falta modificar código productivo."
S3. "Corregí solamente la causa comprobada." "No elimines ni relajes el validador." "No aceptes indiscriminadamente `match=false` con cualquier porcentaje." "No modifiques porcentajes para esconder inconsistencias." "Conservá las defensas contra exclusiones sin evidencia verificable."
S4. "Mantené la distinción entre elegibilidad pendiente, incompatibilidad comprobada y error técnico." "Preservá los contratos introducidos por #80." "Evitá refactorizaciones extensas, nuevos frameworks o cambios ajenos a #81."
S5. "Agregá regresiones positivas y negativas con ofertas y perfiles inventados." "Comprobá el flujo completo pertinente desde respuesta simulada hasta validación y persistencia." "Verificá que una exclusión válida se reconozca correctamente y que una inventada siga rechazándose."
S6. "Ejecutá pruebas focales y `npm test` backend completo." "Utilizá verificación independiente con Gentle AI cuando corresponda." "Documentá cantidades reales de PASS, FAIL, SKIPPED, NOT RUN y PENDING." "No repitas pruebas válidas innecesariamente."
S7. "Hacé commit y push en la rama exclusiva de #81." "Abrí una PR hacia `master`, vinculada a la issue." "Publicá un comentario técnico con HEAD/BASE, cambios, causa identificada, pruebas realizadas, evidencia y limitaciones." "Dejá la PR abierta para auditoría externa." "No hagas merge ni cierres la issue."
S8. "Sin acceso a producción, migraciones, cambios de preferencias, reevaluaciones reales, despliegues manuales ni llamadas a DeepSeek/Apify." "No publiques el dataset privado, información personal, credenciales, respuestas reales de proveedores ni registros de ofertas de la auditoría."

## Tasks
T1 | S1,S8 | inline | done | API PR84/85/86 MERGED + ancestry; fetch --prune exit0; master FF e922211; worktree exclusivo. No eliminación elegible sin pendientes/ignorados. Evidencia en este commit de tracking.
T2 | S2-S5,S8 | delegated | done | RED confirmado 6 FAIL/28 PASS; ampliado 8 FAIL/40 PASS; GREEN 48 PASS + 1003 relacionadas. Causa: cita completa cruza cláusulas/encabezados transformados. Fix mínimo + contrato v11. Commit 66f26081d0f91ded55968f9df95585c00b58dca3.
T3 | S4-S6,S8 | inline + independent | done | Risk: item 3 (parser compartido con elegibilidad). Global combinado3918PASS166SKIP; independiente48+6PASS/diferencial300PASS sin blockers. Commit 66f26081d0f91ded55968f9df95585c00b58dca3.
T4 | S7-S8 | inline | done | Funcional66f2608 pushed; PR87OPEN/nodraft/master; comentario6566141273 publicado. Tracking final en este commit. CI automática pendiente explícita, sin merge/cierre.

## Log
L1. Pedido original:

Actuá como desarrollador principal y coordinador técnico de Busca Empleos.

**Repositorio:** `marcostoledo96/busca_empleos`
**Issue:** https://github.com/marcostoledo96/busca_empleos/issues/81
**Rama principal:** `master`

Trabajá autónomamente hasta entregar una PR lista para auditoría técnica externa.

### 1. Limpieza segura y sincronización

Antes de implementar:

- Recuperá el contexto relevante de Engram, leé `AGENTS.md` y cargá las skills necesarias.
- Inspeccioná ramas, worktrees, cambios pendientes y sesiones activas.
- Confirmá que las PR #84, #85 y #86 ya están integradas en `master`.
- Ejecutá `git fetch --prune`.
- Eliminá únicamente ramas locales y worktrees obsoletos, limpios y con integración comprobada.
- Conservá cualquier trabajo no integrado, cambios pendientes, sesiones activas y archivos privados.
- No uses `git reset --hard`, `git clean`, borrados forzados ni elimines ramas remotas.
- Actualizá `master` mediante fast-forward desde `origin/master`.
- Creá una rama/worktree independiente para la issue #81.

No solicites autorizaciones innecesarias para operaciones seguras ya comprendidas en este alcance.

### 2. Auditar e implementar la issue #81

Leé la issue completa y examiná el comportamiento vigente antes de modificar código.

**Objetivo:** garantizar que el validador, la evidencia estructurada, las explicaciones y el resultado persistido sean coherentes.

Investigá especialmente:

- Respuestas `match=false` con porcentaje alto que contienen exclusiones obligatorias justificadas.
- Exclusiones geográficas respaldadas por la descripción, pero no reconocidas por el validador.
- Diferencias entre modalidad normalizada, modalidad desconocida y evidencia textual.
- Requisitos obligatorios, opcionales, negados o ausentes.
- Evidencias válidas frente a evidencias inventadas, incompletas o ajenas al aviso.
- Contradicciones entre el parser, la validación y la persistencia.
- Errores técnicos que quedan pendientes y no deben convertirse en rechazos laborales.

Primero construí una reproducción con datos sintéticos y determiná la causa exacta.

Contrastá las correcciones ya integradas de #79, #83 y #80. No supongas que el defecto histórico sigue existiendo.

Si el caso ya está resuelto, conservá regresiones suficientes y explicá por qué no hace falta modificar código productivo.

### 3. Corrección mínima

- Corregí solamente la causa comprobada.
- No elimines ni relajes el validador.
- No aceptes indiscriminadamente `match=false` con cualquier porcentaje.
- No modifiques porcentajes para esconder inconsistencias.
- Conservá las defensas contra exclusiones sin evidencia verificable.
- Mantené la distinción entre elegibilidad pendiente, incompatibilidad comprobada y error técnico.
- Preservá los contratos introducidos por #80.
- Evitá refactorizaciones extensas, nuevos frameworks o cambios ajenos a #81.

### 4. Pruebas y verificación

- Agregá regresiones positivas y negativas con ofertas y perfiles inventados.
- Comprobá el flujo completo pertinente desde respuesta simulada hasta validación y persistencia.
- Verificá que una exclusión válida se reconozca correctamente y que una inventada siga rechazándose.
- Ejecutá pruebas focales y `npm test` backend completo.
- Utilizá verificación independiente con Gentle AI cuando corresponda.
- Documentá cantidades reales de PASS, FAIL, SKIPPED, NOT RUN y PENDING.
- No repitas pruebas válidas innecesariamente.

### 5. Entrega

Cuando esté listo:

1. Hacé commit y push en la rama exclusiva de #81.
2. Abrí una PR hacia `master`, vinculada a la issue.
3. Publicá un comentario técnico con HEAD/BASE, cambios, causa identificada, pruebas realizadas, evidencia y limitaciones.
4. Dejá la PR abierta para auditoría externa.

No hagas merge ni cierres la issue.

### Seguridad y autonomía

Sin acceso a producción, migraciones, cambios de preferencias, reevaluaciones reales, despliegues manuales ni llamadas a DeepSeek/Apify.

No publiques el dataset privado, información personal, credenciales, respuestas reales de proveedores ni registros de ofertas de la auditoría.

Trabajá autónomamente dentro del alcance autorizado. No te detengas ante problemas menores que puedas resolver de forma segura. Si necesitás ampliar permisos o alterar producción, detené únicamente esa operación.

**Empezá por la limpieza segura de Git, sincronizá `master` y continuá con #81 hasta dejar la PR lista para revisión.**

L2. Exploración: mapper mvyhp4q5-1-1tvr sólo trazó código, NO ejecutó reproducción. Geografía #83 opera antes del proveedor. Parser contextual exige cita completa en una cláusula; investigar falsos negativos por segmentación/encabezados con reproducción, sin afirmar causa aún. Root original permanece sucio y preservado; master limpio se actualizó en .codegraph/worktrees/issue-79. Worktrees internos con ignorados/pendientes preservados. Sesiones publicadas de otros proyectos; ninguna sesión par de este clon.

L3. Worker T2 mvyhxztb-2-mxpl y continuación mvyi401f-3-6wo2: RED confirmado 6 FAIL/28 PASS, ampliado 8 FAIL/40 PASS; GREEN48 y relacionadas1003 PASS. Causa localizada parser: cita literal completa no encaja en una cláusula segmentada/encabezado retirado. Rangos fuente de una misma aparición conservan contexto, contrato v11. Padre agregó v11 al allowlist #15 antes de suite completa.
L4. Assess: RDD off; nativeRisk unassessable por untracked, escalación item3 plan exige independiente, sin lifecycle. Suite completa exit1:3877PASS166SKIP/90suitesPASS11SKIP1no-carga por pdf-parse faltante en deps prestadas. Recuperación segura symlink propio a deps existentes issue80; sólo suite no ejecutada corre35PASS exit0. Total combinado3912PASS166SKIP,91suitesPASS11SKIP; no full rerun. Ningún source/lockfile cambiado para corregir entorno.
L5. Inspección de todos los worktrees: ramas no integradas, pendientes o ignorados privados presentes; ninguno eliminable de forma segura. No se borra ningún worktree ni rama, no fuerza ni remotos. Master FF e922211 confirmado. Externos registrados mismo clon antes de inspección. Memorias de preferencias needs_review no usadas como autoridad: pedido actual autoriza explícitamente rama/PR/push.

L6. Independiente mvyibq0k-4-pb86 sin blockers S2-S5/S8; S6 pendiente ambiental resuelta padre35PASS. Focal independiente48PASS,6controles nuevosPASS incorporados en test durable y observados6PASS. Diferencial30escenarios90ejecuciones/version300assertsPASS,22controles idénticos8deltas autorizados. Primer focal scratch exit127 jestfaltante; primer diferencial176PASS4FAIL por índice esperado del harness, ambos corregidos sólo scratch. Límite HTML entre bloques preexistente en BASE se documenta sin ampliar scope. Final combinado3918PASS166SKIP,92suitesPASS11SKIP; testnuevo posterior a full verificado solo, no full rerun. NOTrun local:SQLreal,build/navegador,proveedores/producción;CI aún no iniciada. RDDoff, ninguna lifecycle/revisión nativa iniciada.

L7. Commit funcional66f26081d0f91ded55968f9df95585c00b58dca3(335+/15-,7archivos) pushconfirmado. PR87OPEN/nodraft/base master/Refs#81/type:bug, comentario6566141273 POSTconfirmado. No templatePR en repo. Documento tracking separado mantiene unidad funcional350líneas revisables; PR completa agrega este log/specs original sin dividir artificialmente el comportamiento. CI automática iniciada por PR, pendiente al guardar este snapshot; su resultado final se actualizará en el mismo comentario y memoria sin modificar fuentes ni reiniciar checks.
