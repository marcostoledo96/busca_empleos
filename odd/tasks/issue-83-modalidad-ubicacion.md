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

## Tasks
T1 | S1 | inline/explore | done | PR84 MERGED 4edef00; fetch exit0; master FF sin cambios; worktree exclusivo; preservados residuos con cambios/ignorados/sin integración.
T2 | S2-S3,S5 | delegated (context backstop) | done | S5 documentada/testeada; focal60PASS worker y padre. B1/B2 causales resueltos por recheck; Adzuna aceptado explícitamente. Commit d4c0b41a7987f6bf59d1fd8fe1b03b58ad1d6d54 (unidad comportamiento414+14líneas).
T3 | S2-S3,S5 | delegated verify + parent spot check | blocked | Risk: item 3. Verificación83 focal60PASS, recheckB1/B2resueltos/deltaAdzunaaceptadoS5. Full entrega exit1:3679PASS166SKIP4FAIL (proxyTLS y missingpdf también BASE); suite global verde espera reparación/entorno fuera de #83. No oculta ni impide PR para auditoría, sin merge.
T4 | S4 | inline | done | Commit funcional d4c0b41 publicado (push exit0); PR85OPEN hacia master, Refs83/type:bug. Comentario6559563062 con HEAD/BASE/pruebas/limitaciones. Fuente revisada sin cambios. Bitácora en commit de cierre; globalFAILprevio explícito, sin merge/cierre.

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
