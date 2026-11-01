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

## Tasks
T1 | S1,S2,S7 | inline + exploración delegada | done | fetch 0; PR84/85 MERGED y ancestros; master FF sin cambios; worktree80 creado; candidatos inspeccionados preservados.
T2 | S2-S7 | delegated | done | RED inicial10FAIL/8PASS; corrección contadoresRED6FAIL/GREEN34PASS; backend final3791PASS/166SKIP; Angular40PASS; navegador7PASS; commit 1aa9d80935b6f88baaec7888a701995703b8db15. Sin parser/migración.
T3 | S2-S7 | inline + verificación independiente | done | Independiente145PASS/diferencial48casos(versiones)36idénticos12cambiosesperados; único blocker rehidratación corregido y recheck106PASS. Global final3791PASS166SKIP,90suitesPASS11SKIP. Browser7PASS; UI40PASS. Sin blockers; evidencia commit 1aa9d80935b6f88baaec7888a701995703b8db15.
T4 | S8 | inline | in_progress | BASE b8ca1e0 sincronizada tras fetch; funcional1aa9d80 creado. Commit seguimiento, push y PR pendientes.

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
