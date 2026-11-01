# Issue 83 — Modalidad y ubicación
Base: 4edef00b4b537b92d0b5ad95a3537f01585e0b35; branch: fix/issue-83-modalidad-ubicacion; entrega: una PR abierta hacia master, sin merge.
Runner: backend npm test (Jest); fixtures sintéticos, sin proveedores ni producción.

## Specs
S1. Limpieza inicial y sincronización

Antes de empezar:

- Recuperá contexto relevante de Engram, leé AGENTS.md y cargá las skills necesarias.
- Inspeccioná ramas locales/remotas, worktrees, cambios pendientes y PRs.
- Confirmá que la PR #84 (#79) ya está mergeada.
- Ejecutá `git fetch --prune` y limpiá únicamente ramas locales y worktrees obsoletos, limpios y con integración comprobada.
- Conservá trabajos activos, ramas no integradas, cambios pendientes y directorios privados como `.qa-runtime`.
- No uses borrados forzados, `reset --hard`, `git clean` ni elimines ramas remotas.
- Actualizá `master` mediante fast-forward y creá una rama/worktree independiente para #83.

No me pidas autorización para cada operación segura dentro de este alcance.


S2. Desarrollar la issue #83

Leé la issue completa y examiná el código vigente, incluyendo las correcciones históricas de #15 y los cambios recién integrados de #79.

**Objetivo:** mejorar la interpretación de modalidad y ubicación de ofertas laborales, evitando exclusiones equivocadas.

Investigá especialmente:

- Ofertas que dicen remoto en la descripción, pero fueron normalizadas como presenciales.
- Ofertas híbridas confundidas con remoto completo.
- Modalidad desconocida tratada incorrectamente como presencial.
- Localidades de CABA/GBA incorrectamente consideradas fuera de las zonas aceptadas.
- Restricciones territoriales reales de puestos remotos.
- Datos de empresa o ubicación contaminados por información del sitio de origen.
- Contradicciones entre título, descripción y metadatos.

**Primero reproducí los problemas con fixtures sintéticos en el código actual.** No supongas que todos los errores históricos siguen existiendo.

Corregí únicamente las causas comprobadas, respetando exclusiones legítimas y conservando la incertidumbre cuando falte información.


S3. Pruebas y auditoría técnica

- Agregá regresiones positivas y negativas.
- Verificá el recorrido desde normalización hasta matching, no solo funciones aisladas.
- Ejecutá pruebas focales y `npm test` backend completo.
- Usá verificación independiente de Gentle AI cuando aporte valor.
- Informá PASS, FAIL, SKIPPED, NOT RUN y PENDING con resultados reales.
- Evitá refactorizaciones, dependencias y pruebas redundantes innecesarias.


S4. Entrega final

Cuando esté implementado y verificado:

1. Hacé commit y push de la rama exclusiva.
2. Abrí una PR hacia `master`, vinculada a #83.
3. Publicá un comentario breve con cambios, HEAD/BASE, pruebas, evidencia y limitaciones.
4. Dejá la PR abierta para auditoría externa.

No hagas merge ni cierres la issue.

**Límites:** sin acceso a producción, cambios de preferencias, migraciones, despliegues manuales, reevaluaciones reales, scraping ni llamadas a DeepSeek/Apify. No publiques datos del dataset privado.

Coordiná cualquier archivo compartido con otros agentes y evitá mezclar cambios de #80, #81 o #82.

Empezá directamente por la limpieza segura de Git, sincronizá `master` y continuá con #83 hasta abrir la PR. Solo detenete ante un bloqueo que requiera permisos fuera del alcance autorizado.

S5. Decisión posterior: respuesta literal del usuario «1» a «Accept and document this change — recommended; consistent with #83.»: acepto la admisión Adzuna de oferta explícitamente remota con oficina opcional y la documento.

S6. Respuesta literal «confirmo» a «¿Confirmás que autorizás reparar por separado los fallos previos de `pdf-parse` y proxy TLS, manteniendo la PR #85 abierta sin merge ni cierre de #83?».

S7. Pedido original literal: «arregla todo lo mencionado en el comentario de la pr». Comentario autorizado: PR85#issuecomment-6559895192 (PR-AUDIT-V1), B1 negaciones de modalidad remota/remoto no permitido; B2 asistencia obligatoria en oficina/por semana/a la oficina/al mes, con negaciones y recorrido hasta matching/caché. Texto original íntegro en L15.

## Tasks
T1 | S1 | inline/explore | done | PR84 MERGED 4edef00; fetch exit0; master FF sin cambios; worktree exclusivo; preservados residuos con cambios/ignorados/sin integración.
T2 | S2-S3,S5,S7 | delegated (context backstop) | done | Commit417454e4c2ba4d99060f3ad4501ea5a282f4ead2;workerRED31FAIL68PASS/GREEN99PASS;relacionadas1458PASS;diferencial168pares60pedidos108idénticos0inesperados. Dos patrones,test+docs.
T3 | S2-S3,S5-S7 | independent verify + parent suite | done | Basef112d16;full3757PASS166SKIP0FAIL/3923,89suitesPASS11SKIP. Independiente mvxzqw08-8-1zbz: B1/B2MET;RED31FAIL68PASS/GREEN99PASS y probes18PASS/72recorridos(12cambiossolicitados6controlesidénticos). ASSESShighitem3/RDDoff; sin lifecycle.
T4 | S4,S6-S7 | inline | in_progress | Frontendseparadoautorizadoen odd/tasks/pr85-e2e-descripcion.md F1/F2done: guardafoco100ms,indepMET,Angular578PASS4SKIP/E2E224PASS;backendB1/B2intacto. Publicarunidadycomentariolote/F3 yCIexactonuevoSHA; sinmerge/cierre.

## Log
L1. Pedido original literal:
Actuá como desarrollador principal de Busca Empleos y trabajá de forma autónoma sobre la issue #83.

**Repositorio:** `marcostoledo96/busca_empleos`
**Issue:** https://github.com/marcostoledo96/busca_empleos/issues/83
**Rama principal real:** `master`

### 1. Limpieza inicial y sincronización

Antes de empezar:

- Recuperá contexto relevante de Engram, leé AGENTS.md y cargá las skills necesarias.
- Inspeccioná ramas locales/remotas, worktrees, cambios pendientes y PRs.
- Confirmá que la PR #84 (#79) ya está mergeada.
- Ejecutá `git fetch --prune` y limpiá únicamente ramas locales y worktrees obsoletos, limpios y con integración comprobada.
- Conservá trabajos activos, ramas no integradas, cambios pendientes y directorios privados como `.qa-runtime`.
- No uses borrados forzados, `reset --hard`, `git clean` ni elimines ramas remotas.
- Actualizá `master` mediante fast-forward y creá una rama/worktree independiente para #83.

No me pidas autorización para cada operación segura dentro de este alcance.

### 2. Desarrollar la issue #83

Leé la issue completa y examiná el código vigente, incluyendo las correcciones históricas de #15 y los cambios recién integrados de #79.

**Objetivo:** mejorar la interpretación de modalidad y ubicación de ofertas laborales, evitando exclusiones equivocadas.

Investigá especialmente:

- Ofertas que dicen remoto en la descripción, pero fueron normalizadas como presenciales.
- Ofertas híbridas confundidas con remoto completo.
- Modalidad desconocida tratada incorrectamente como presencial.
- Localidades de CABA/GBA incorrectamente consideradas fuera de las zonas aceptadas.
- Restricciones territoriales reales de puestos remotos.
- Datos de empresa o ubicación contaminados por información del sitio de origen.
- Contradicciones entre título, descripción y metadatos.

**Primero reproducí los problemas con fixtures sintéticos en el código actual.** No supongas que todos los errores históricos siguen existiendo.

Corregí únicamente las causas comprobadas, respetando exclusiones legítimas y conservando la incertidumbre cuando falte información.

### 3. Pruebas y auditoría técnica

- Agregá regresiones positivas y negativas.
- Verificá el recorrido desde normalización hasta matching, no solo funciones aisladas.
- Ejecutá pruebas focales y `npm test` backend completo.
- Usá verificación independiente de Gentle AI cuando aporte valor.
- Informá PASS, FAIL, SKIPPED, NOT RUN y PENDING con resultados reales.
- Evitá refactorizaciones, dependencias y pruebas redundantes innecesarias.

### 4. Entrega final

Cuando esté implementado y verificado:

1. Hacé commit y push de la rama exclusiva.
2. Abrí una PR hacia `master`, vinculada a #83.
3. Publicá un comentario breve con cambios, HEAD/BASE, pruebas, evidencia y limitaciones.
4. Dejá la PR abierta para auditoría externa.

No hagas merge ni cierres la issue.

**Límites:** sin acceso a producción, cambios de preferencias, migraciones, despliegues manuales, reevaluaciones reales, scraping ni llamadas a DeepSeek/Apify. No publiques datos del dataset privado.

Coordiná cualquier archivo compartido con otros agentes y evitá mezclar cambios de #80, #81 o #82.

Empezá directamente por la limpieza segura de Git, sincronizá `master` y continuá con #83 hasta abrir la PR. Solo detenete ante un bloqueo que requiera permisos fuera del alcance autorizado.

L2. Issue #83 completa al iniciar (GitHub):
## Origen y alcance
Seguimiento de la auditoría #75, posterior al exportador #77 integrado mediante #78. Es la quinta issue del backlog autorizado por el propietario, cuya creación anterior quedó pendiente.

La issue #15 de normalización ya está cerrada. Reviso sus cambios y pruebas para no duplicar trabajo ni asumir que un problema histórico sigue vigente. Los hallazgos del informe privado son casos para reproducir con ejemplos inventados en el código actual; no prueban por sí solos una regresión actual ni autoría de DeepSeek.

## Objetivo
Distingo remoto, híbrido, presencial y desconocido. Conservo la procedencia de las señales y resuelvo o explicito las contradicciones entre título, descripción y metadatos antes de aplicar exclusiones geográficas. No amplío las preferencias del usuario ni interpreto ubicación conocida como prueba de presencialidad.

## Regresiones sintéticas propuestas
- Texto explícitamente remoto frente a metadato presencial: no elijo silenciosamente el dato más restrictivo; documento la precedencia o el conflicto.
- Metadato remoto frente a una exigencia de asistencia periódica a oficina: no presento un puesto híbrido como remoto total.
- Ubicación conocida con modalidad desconocida: no infiero presencialidad ni trabajo remoto.
- Presencialidad explícita fuera de las zonas aceptadas: preservo la exclusión vigente. Desconocimiento no equivale a incompatibilidad.
- Alias de localidades y zonas amplias: respeto las equivalencias configuradas y distingo homónimos de distintas jurisdicciones.
- Trabajo remoto con restricción territorial explícita: conservo esa restricción; remoto no significa disponible desde cualquier país.
- Ruido del sitio mezclado con empresa o ubicación: limpio únicamente lo identificable, preservando nombres, números legítimos y Unicode.
- Negaciones y jornada: «sin posibilidad de remoto» no implica remoto; full-time/part-time no determinan modalidad.

## Implementación mínima
Reviso AGENTS.md, docs/evaluacion-ia.md, el normalizador, los adaptadores pertinentes y criterio-ubicacion.js; verifico sus rutas actuales. Parto de origin/master actualizado, sin reutilizar la rama del exportador.

Reproduzco antes de modificar. Si un caso ya pasa por las correcciones de #15 u otra entrega, conservo su cobertura y lo informo sin forzar un refactor. Reutilizo helpers y contratos existentes; no agrego un segundo normalizador, geocodificación externa ni frameworks por rutina. No mezclo salarios, scoring, cambios de perfil o reparación masiva de registros históricos.

## Aceptación y pruebas
- [ ] Reproducción inicial documentada con SHA y separación de fallos actuales, casos ya corregidos e incertidumbres históricas.
- [ ] Precedencia sustentada en evidencia o conflicto explícito entre fuentes; valores desconocidos preservados.
- [ ] Regresiones positivas y negativas de modalidad, ubicación, alias, homónimos, restricciones y ruido de extracción con datos inventados.
- [ ] Pruebas del recorrido desde normalización hasta el consumidor de matching pertinente, no solamente helpers aislados; proveedores simulados.
- [ ] Focales y npm test backend completo, con PASS/FAIL/SKIPPED/NOT RUN/PENDING/N/A y cantidades reales; los omitidos no se presentan como aprobados.
- [ ] PR focal hacia master, verificación independiente, evidencia asociada a HEAD/BASE y documentación breve del contrato modificado.

## Coordinación
Segundo frente inicial recomendado: Next-2/Pi, en paralelo con #79, que trabaja exclusiones no geográficas. Coordino cualquier edición de archivos compartidos antes de empezar; no mezclo cambios ajenos.

#80 trata elegibilidad y evidencia insuficiente; #81 trata coherencia del validador; #82 trata reconciliación privada del perfil. Esta issue proporciona entradas geográficas coherentes sin absorber esos alcances. Me sincronizo con origin/master antes de entregar y revalido el delta de integración si cambia la base. Mantengo como máximo dos frentes de implementación activos.

## Autorización y límites
Aprobados diagnóstico, corrección focal, pruebas sintéticas, commit/push y PR de este alcance. Sin producción, cambios de preferencias, migraciones, scraping real, proveedores pagos, reevaluaciones, merge automático, builds por iniciativa ni despliegue manual.

No publico el dataset, IDs reales, anuncios, perfil, credenciales, certificados ni logs privados. Uso exclusivamente fixtures sintéticos en el repositorio. El cierre exige validar la corrección vigente, no afirmar que las decisiones históricas quedaron reparadas.

L3. Exploración mvxwj72l-1-4w5r: #15 ya protege jornada/negaciones/aliases/incertidumbre; faltan contradicciones metadata/texto y asistencia periódica. CodeGraph de checkout principal no prueba el worktree nuevo; fallback local declarado. Coordinación enviada a peer anunciado sin aceptación; no hay PRs abiertas en el repo. No se eliminaron worktrees con ignorados ni ramas no integradas. Memorias antiguas needs_review no se usaron como autoridad: permisos actuales explícitos gobiernan.

L4. Implementación mvxwt3gu-2-o9y0: RED inicial20FAIL/11PASS; controles #15/#79 previos753PASS. GREEN final38PASS, relacionadas1458PASS. Padre repitió focal38PASS exit0. 7 archivos de comportamiento/tests/docs, 263+13 líneas según worker; sin limpieza especulativa de ruido y sin modificar criterio-ubicacion/zonas.

L5. ASSESS directo: risk high por escalación item3 (contratos de normalización y matching compartidos), nativeRisk unassessable por untracked, RDD off. Plan: writerSelfVerification + independentVerifier. No STATUS/START/ciclo RDD. Verificador mvxx9q5j-3-eir6 en curso; ajuste de configuración autorizado tras exit1 de discovery en scratch sin config.

L6. npm test -- --runInBand en candidate exit1: 87 suites PASS, 11 SKIPPED, 2 FAIL; 3657PASS166SKIPPED4FAIL (3827 total). Falla carga de extraccion-documento-cv por pdf-parse ausente; 4 exportar-ofertas-proxy-tls esperan solicitudes2 y reciben1. BASE4edef00 en archive scratch/mismas deps exit1: 85suitesPASS11SKIP3FAIL;3618PASS166SKIP5FAIL. Reproduce los mismos cuatro fallos y carga fallida; quinto fallo BASE issue59-runner recibe git rev-parse128 porque archive no incluye .git. No es prueba de suite global verde. Dejo evidencia completa local no pública en .qa-runtime/issue83-full-test.log. No instalo deps ni corrijo proxy/runner ajenos. NOT RUN frontend/builds/SQL/producción/proveedores reales. PENDING verificación independiente y CI/entrega.

L7. Corrección conjunta mvxxjby4-4-l5w9: RED15FAIL43PASS -> GREEN58PASS; relacionadas1458PASS. Recheck independiente limitado mvxxpeqt-5-lxf9: 12PASS seis casos x proveedor +4PASS asistencia afirmativa; diferencial oficina opcional 12adaptadores11PASS1FAIL. B2 resuelto; B1 tareas y once adaptadores resueltos. Excepción directa Adzuna: título «Desarrollo Junior remoto» + descripción «Acceso opcional a un puesto en oficina.» antes [] con dos warnings/hibrido, ahora oferta remoto/sin warnings. Verificador lo había dejado advisory preexistente y docs dicen guardar compatibilidad. Needs decision: aceptar/documentar admisión nueva en #83 o preservar descarte previo. No nueva ronda/corrección automática tras recheck. Full final padre job4 exit1:3677PASS166SKIP4FAIL/3847,2suitesFAIL11SKIP87PASS; mismos errores globales previos. No commit/push/PR hechos aún.


L8. Respuesta original del usuario literal: «1». Seleccionó «Accept and document this change — recommended; consistent with #83.» Aceptada la admisión Adzuna con título remoto y oficina opcional. No se modifica más fuente; se agrega regresión y docs. No autoriza corregir fallos globales previos, merge, cierre ni producción.

L9. S5 implementada por mvxy0wmv-6-fbzk solo test/docs:60PASS; padre repitió60PASS exit0. Fuente idéntica al recheck B1/B2. Full entrega job5 exit1:3679PASS166SKIP4FAIL/3849,2suitesFAIL11SKIP87PASS,25.964s. Sin nuevos fallos respecto BASE; missingpdf y4proxyTLS quedan fuera de alcance/no reparados. Se publica PR abierta con limitación, no aprobación global ni permiso de merge. MASTER remoto sigue4edef00. ASSESS highitem3/nativeunassessable por untracked, RDDoff; evidencia independiente ya obtenida, no nuevo ciclo.

L10. Entrega observada: commit funcional d4c0b41a7987f6bf59d1fd8fe1b03b58ad1d6d54 (7archivos414+14líneas, unidad coherente fuente/tests/docs); pushjob6exit0. PR85 https://github.com/marcostoledo96/busca_empleos/pull/85 creadaexit0 hacia master/Re​fs83/type:bug; comentario6559563062 publicado con evidencia y limitaciones. Advertencia gh50uncommitted era checkout principal ajeno; publicación usa headbranch explícito y se inspeccionan archivosPR. Sin mezcla de fuentes ajenas. Usuario pidió una PR exclusiva: bitácora se añade como commit documental separado, sin alterar bytes funcionales probados. CI41318324395 pendiente; preview Vercel automático reportado por GitHub, no se ejecutó deploy manual ni acceso a producción. T3permanecebloqueada solo para suite global verde por fallos previos fueraalcance; #83focal60PASS y B1/B2causalesresueltos,deltaAdzunaaceptadoS5. Siguiente: auditoría externa y decisión separada si se desea reparar entorno/proxyTLS; no merge/cierre.

L11. Autorización adicional original literal: «apruebo todo»; aclaración: «¿Confirmás que autorizás reparar por separado los fallos previos de `pdf-parse` y proxy TLS, manteniendo la PR #85 abierta sin merge ni cierre de #83?»; respuesta original literal: «confirmo». Aplica solo reparación/entorno y verificación; no merge ni cierre. Investigación: memoria15516 de #79 señala mismo problemaNODE_PATH/proceso hijo; confirmado lock SHA256 a4a362c004f8b767c6d31fb1b38af22e0cea8c072e1ebebe0c38e2fbd047b403 idéntico en issue83 y worktree exportador del mismo clon; pdf disponible allí. Sin indexación útil de test TLS en CodeGraph, lectura acotada de test confirma spawn solo PATH/NODE_ENV (sin NODE_PATH). No se leen .env ni datos privados.

L12. Reparación de entorno sin fuente: RED focal4FAIL30PASS,2suitesFAIL (pdfsin cargar); symlink local ignorado backend/node_modules a instalación del exportador mismo lock. GREEN `cd backend && env -u NODE_PATH npm test -- --runInBand tests/controladores/extraccion-documento-cv.test.js tests/scripts/exportar-ofertas-proxy-tls.test.js --silent`:2suites69PASSexit0. No se instala ni cambia dependencia/version/lockfile/TLS/tests. Full job9 en curso; log local .qa-runtime/issue83-full-local-deps.log no publicado.

L13. Full posterior reparación local job9: `cd backend && env -u NODE_PATH npm test -- --runInBand` exit0,89suitesPASS11SKIPPED,3718PASS166SKIPPED0FAIL/3884,27.459s. Los errores previos eran resolución de dependencias incompleta/no heredada; no atribuirlos a bug TLS ni modificar guardas. Los166omitidos siguen sin ejecutarse. Fuente/tests/lockfiles idénticos al HEAD5316628 (gitdiffbackendexit0); solo evidencia documental. Sin acceso a producción/providers/.env/private ni deploymanual. PR85 abierta, se refresca evidencia sin merge/cierre.

L14. Evidencia PR85 y comentario6559563062 actualizados exitosamente: PASSactual3718/166SKIP/0FAIL y foco69; historial FAIL preservado con causa de entorno. ASSESS actual2docs passive/structuralReadbackOnly/reviewDuefalse/RDDoff; readback docs y gitdiffcheckPASS, backenddiffexit0. Commit documental separado registra reparación local; no código, installs ni lock/version changes. PR85 sigueOPEN; CIprevioHEAD531 backendunit/backendDB/issue57SUCCESS, frontendIN_PROGRESS; al subir docs CI nuevo permanecePENDING hasta resultado real. No merge/cierre/auto-merge.

L15. Pedido nuevo original literal: «arregla todo lo mencionado en el comentario de la pr». Auditoría pública leída íntegra en HEADf112d16 y CI41319471328verde4/4; no implica cobertura B1/B2. Comentario original literal:
PR-AUDIT-V1
VERDICT: NO APTO — dos defectos funcionales bloqueantes en la interpretación de modalidad; CI verde no implica corrección de estos casos.
REPOSITORY: marcostoledo96/busca_empleos
PR: https://github.com/marcostoledo96/busca_empleos/pull/85 (issue #83)
BASE: master @ 4edef00b4b537b92d0b5ad95a3537f01585e0b35; merge-base igual a BASE (3 commits adelante, 0 atrás).
HEAD: f112d16491bc61a8be1822bb033bbeb67a08b5b1
BRANCH: fix/issue-83-modalidad-ubicacion -> master
SCOPE: diff acumulado de 8 archivos (normalizador, reglas geográficas, evaluador, identidad/caché, 2 tests, documentación y bitácora); issue #83, AGENTS.md y base con #79 integrada.
STATUS: OPEN, no Draft, no merge; GitHub Actions 41319471328 COMPLETED/SUCCESS (4/4 jobs). Sin cambios ni aprobación formal por esta auditoría.
FINDINGS:
- B1 / FAIL / REGRESIÓN: `backend/src/servicios/servicio-normalizacion.js:1600,1618-1625,1666-1680`. El detector ahora reconoce `remota` (`remot[oa]`), pero la regex de negación no contempla «No se permite modalidad remota», «Sin posibilidad de modalidad remota» ni «Trabajo remoto no permitido». Resultado de la lógica actual: `remoto`, cuando no existe autorización de trabajo remoto. En BASE «modalidad remota» no activaba la señal remota; es un delta real. Impacto: Adzuna puede admitir un anuncio no remoto; con LinkedIn `workType: On-site`, ubicación Córdoba y descripción negativa, se fabrica conflicto con `presencial`, modalidad `null` y se pierde el rechazo geográfico determinístico (`reglas-exclusion.js:395-425` / `servicio-evaluacion.js:229-266`), permitiendo que el proveedor decida una oferta incompatible. Corrección mínima: reconocer negación local antes de inferir `remota` (y `remoto no permitido`), sin convertir negación sola en presencialidad ni ampliar gramática arbitrariamente. Validar con metadata presente/ausente, Córdoba fuera de zona, Adzuna, proveedor simulado positivo/negativo y caché.
- B2 / FAIL / COBERTURA INCOMPLETA: `backend/src/servicios/servicio-normalizacion.js:1625-1638,1659-1664,1672-1680`. `exigeAsistenciaPeriodica()` solo reconoce `a (la) oficina ... por semana/mes`; no `en oficina una vez por semana` ni `a la oficina 2 días al mes`. Con «Trabajo 100% remoto. Asistencia obligatoria en oficina una vez por semana» o «100% remoto. Debe asistir a la oficina 2 días al mes», el detector retorna `remoto`, no `hibrido`/conflicto, aunque hay obligación periódica explícita. Impacto: se preserva falsamente remoto pleno, incluido el filtro de admisión Adzuna. Corrección mínima: cubrir estas variantes inequívocas y negaciones locales equivalentes, manteniendo oficina opcional como remoto y sin clasificar visitas voluntarias. Validar normalización -> reglas -> proveedor/caché, en casos positivos y negativos.
- PRUEBA PROPIA: extraje las expresiones exactas de HEAD y repliqué su orden de decisión sobre 8 textos sintéticos: 3 PASS / 5 FAIL (3 negaciones, 2 asistencias obligatorias). Comparé patrón de `remota` con BASE. Verificación aislada del detector, NO ejecución del backend ni demostración SQL/producción; impactos consumidores sustentados además en lectura estática de sus ramas.
- CI OBSERVADA (no prueba propia): `https://github.com/marcostoledo96/busca_empleos/actions/runs/41319471328` para HEAD: backend 3718 PASS / 166 SKIPPED / 0 FAIL, 89 suites PASS / 11 SKIPPED; integración backend, PostgreSQL, frontend y E2E PASS (4/4 jobs). El historial local TLS/pdf-parse declarado por el autor no invalida este CI verde ni prueba por sí solo ausencia de defectos nuevos. La nueva focal #83 se ejecuta en CI, pero no cubre B1/B2.
- REVISIÓN ESTÁTICA: conserva procedencia, v6 de criterios, hash de metadatos, conflictos pre/post/caché, exclusiones territoriales explícitas y admisión Adzuna con oficina opcional en los casos representados por tests. No se constató otro bloqueo en ese alcance; no se afirma reparación de registros históricos. #80/#81/#82 quedan fuera.
- SKIPPED: 166 tests backend (11 suites), no equivalen a PASS. NOT RUN por auditor: suite local completa, navegador manual, SQL propio, scraping, API DeepSeek/Apify reales, producción y reevaluación histórica. N/A para este diff: migraciones y dependencias nuevas. PENDING: corregir B1/B2 y obtener regresiones e integración/CI verde del nuevo SHA; reauditar el delta antes de APTO.
- PEDIDO A PI/ANTIGRAVITY: por cada nuevo commit o lote, dejar UN comentario breve de entrega en esta misma PR con HEAD exacto y BASE relevante, cambios/hallazgos atendidos, comandos/pruebas ejecutados y cantidades PASS/FAIL/SKIPPED/NOT RUN/PENDING/N/A, evidencia/logs/enlaces, entorno y límites. Distinguir avance parcial de entrega final; asociar pruebas al SHA realmente probado y explicar delta/no revalidado si difiere del publicado. Sin secretos ni datos reales; la declaración del agente no es PASS independiente.

L16. Corrección PR-AUDIT-V1 por worker mvxzihkk-7-6xgu: dosregex fuente+39tests+docs;delta135+5líneas. RED31FAIL68PASS ->GREEN99PASS;relacionadas1458PASS. Diferencial único f112d16/candidato168pares12adaptadores:60deltaspedidos108controlesidénticos0inesperados. Independiente mvxzqw08-8-1zbz: mismoRED31/GREEN99; probesbaseline6PASS12FAIL->current18PASS con72recorridosproveedor/cachexpos/neg,12cambiosautorizados6controlesidénticos; inputs/preferencias/oferta/cacheinmutables y sinSQLreal. Primerharnesstemporal independiente asumióexplicacionencacheyfalló; corregidoenscratch,sinfuente. B1/B2MET, S2/S3focal/S5/S7MET; sinbloqueos/advisoriesnuevos. No se agrega prueba temporal duplicada alrepo:39regresionesdurablesyafijanelpedido. Full padre job11 exit0:3757PASS166SKIP0FAIL/3923;89suitesPASS11SKIP,27.405s. Padre spotcheck focal99PASS. ASSESSactualhighescalateitem3/nativemedium/reviewDuefalse/RDDoff; plan cumplido sin lifecycle. Basecorrecciónf112d16/master4edef00. Commit/push/CI nuevoSHA pendientes; no inferirAPTOdetodaPRdesdeelverificadordedelta.

L17. Unidad funcional de corrección commit417454e4c2ba4d99060f3ad4501ea5a282f4ead2 (3archivos136+4líneas), exactamente fuente/tests probados99focal/3757full/18probesindependientes. Bitácora se incorpora como segundo commit pasivo del mismo lote, sin cambio de bytes backend. Se publica UN comentario nuevo con ambosSHA y BASEf112d16/master4edef00; CI delHEADpublicado debe esperarse, no se daAPTOintegralantes. Sinmerge/cierre.

L18. Push lote exit0 alHEADd66d4cdde15638b01afd30f1073d4eae66b5159f; BASEPR4edef00, deltaf112d16, source417454e. Comentarioúnicoentrega https://github.com/marcostoledo96/busca_empleos/pull/85#issuecomment-6560174011 publicado(id6560174011), PRbodyactualizado. CI41322730733 ligadoexactSHA/in_progress; job13 espera acotada `timeout1500s gh run watch41322730733 --exit-status --interval20`, sinpollingpadre. Fuente/tests/doccontrato idénticos entre417454e y d66d4cd (diffexit0), pruebas3757/166SKIP/0FAIL+99focal+1458relacionadas+18probesindep. Registro posterior de estado se mantiene local/Engram para no cambiar elSHA queCIestávalidando; no claimCIverdehastaeventoreal. PR85OPEN; nomerge/cierre.

L19. Evento job13exit1: CI41322730733 exactHEADd66d4cd completadoFAIL. BackendunitPASS,backendDBPASS,Issue57integrationPASS;Frontendbuild/headlessPASS peroE2E222PASS1FAIL. Falla frontend/e2e/detalle-ui.spec.ts:222 descripciónexpandir/cancelar/límites/guardar;helper31 expects<details open> tras<summary>Enter, recibeattributonulltras1500ms. Sourcefrontend/.github idénticosf112/d66(gitdiffexit0); no prueba flakiness ni causalidadsinreproducción, no se toca UI por inferencia. Advertencias Node20/ubuntu no son causa del fallo observado. Sin reejecutarCI ni agregarreintentos/skips. Needs decision: autorizar investigación/corrección E2Efrontend separada o dejarPRbloqueada; no hay permiso de ampliarB1B2automáticamente. Comentario único6560174011 se actualiza a avanceparcial/CIFAIL conjoblink, sin nuevo commit por meroestado para conservarSHAexacto. Backend3757PASS166SKIP0FAIL y verificaciónindependienteB1/B2MET siguen válidos; sinAPTOintegral.

L20. Autorización adicional usuario original literal: «autorizo» a investigar/corregirfrontendporseparado. Feature odd/tasks/pr85-e2e-descripcion.md/espejo15625 F1/F2done:callbacks100msrootcomprobado/guardamínima/regresiónpublicaRED-GREEN/independienteMET. PadreAngular578PASS4SKIP/E2E224PASS0FAIL,backend#83intacto. UnidadUI commit39205b9f51a35ccf76bfa94dc40b0e5b7edd3eb3; bitácorasdeesteloteencommitpasivo. Publicación/comentario/CIexactofinalpendientesF3,sinmerge/cierre. No seafirma intercalaciónlocatorpressCIexacta.
