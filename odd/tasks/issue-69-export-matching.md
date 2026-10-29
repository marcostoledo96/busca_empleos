# Issue 69 — Exportación segura de matching
Objetivo: preparar la auditoría offline sin modificar evaluador ni leer producción. Rama: audit/issue-69-export-matching; BASE: 4ae83b2614c4468596d7f2b796725d5f17d40736.
Entrega: single-pr hacia master (elección humana); Jest y PostgreSQL sintético con SELECT. Risk: item 2 (guardas de conexión y sanitización).

## Specs
S1. «No quiero cambiar el scoring ni los prompts antes de tener evidencia real.» «No modifiques otros worktrees ni cambios ajenos.» «Utilizá Gentle AI Explore, Worker y Verify.»
S2. «Auditá el exportador y adaptalo con el menor cambio posible.» «No crees un segundo sistema de exportación si podés aprovechar el existente.»
S3. «Necesito conservar, cuando existan:» Campos exactos de la sección 3 original en L1. «No exportes:» Exclusiones exactas de la sección 3 original en L1. «No recortes las descripciones» «sanitizalos sin perder requisitos importantes.»
S4. «Necesito una exportación completa de todas las evaluaciones existentes, incluidas las que ya no aparecen en las pestañas actuales.» «Aprobadas.» «Rechazadas.» «Pendientes.» «Con error técnico.» «Evaluación vigente, anterior o desconocida, cuando pueda determinarse correctamente.» «Registrá el total de filas y reconciliá ese conteo contra el resultado de lectura SQL.» «No confundas las 182 decisiones del último ciclo con el total histórico.» «Si el archivo es grande, dividilo en lotes numerados o utilizá JSONL UTF-8.»
S5. «Prepará un resumen separado y sanitizado del perfil efectivo, sin nombre, correo, teléfono, dirección ni datos personales innecesarios.» Campos exactos de la sección 5 original en L1. «No publiques el perfil en GitHub.» «Si las preferencias cambiaron desde una evaluación histórica, no atribuyas los criterios actuales a esa evaluación automáticamente. Indicá qué puede y qué no puede reconstruirse.»
S6. «Esta tarea NO autoriza lecturas de producción ejecutadas automáticamente por Pi.» «Primero implementá y probá el exportador con una base sintética aislada.» «Solo SQL SELECT.» «Sin migraciones.» «Sin escrituras.» «Sin creación de tablas.» «Sin modificaciones de configuración.» «Preferir un rol exclusivamente lector.» «Confirmar identidad del servidor y base.» «No incluir credenciales en comandos, logs ni archivos.» «No imprimir datos personales en consola.» «No ejecutar scraping, DeepSeek ni cron.» «No utilices `npm run db:migrate` para diagnóstico.»
S7. «Probá con fixtures sintéticos:» Los doce casos exactos de la sección 7 original en L1. «Verificá que no se pierdan filas y que el exportador no altere PostgreSQL.» «No llames servicios externos reales.»
S8. «Generá un archivo local con un nombre identificable, por ejemplo:» «busco-trabajo-auditoria-matching.json» «busco-trabajo-criterios-sanitizados.json» «La salida debe quedar excluida de Git y de los artefactos públicos.» «No inventes que el dataset productivo fue exportado si solamente generaste fixtures.»
S9. «La auditoría debe conservar casos ambiguos como ambiguos, no forzar un veredicto.» Capacidades exactas de la sección 9 original en L1; no atribuir autoría no persistida.
S10. «Tenés autorización para implementar el exportador, agregar pruebas sintéticas, hacer commits, push y abrir una PR hacia `master`.» «Utilizá `Closes #69`.» «Ejecutá Gentle AI Verify antes de publicar.» «No hagas merge, no cierres la issue ni ejecutes deploy manual.»
S11. «Informame:» Los diez puntos exactos de la sección 11 original en L1, incluyendo límites y CI.

S12. «Rechazar hostnames DNS para conexiones TCP y aceptar únicamente direcciones IP literales válidas o sockets Unix explícitamente autorizados.» «Validar el destino antes de crear el cliente o llamar a `connect()`.» «Mantener las protecciones read-only y las verificaciones de identidad existentes.» «Agregar pruebas sintéticas que demuestren que un destino inválido nunca inicia una conexión.» «Ejecutá los tests focales pertinentes y el `npm test` completo exigido por AGENTS.md.» «Mantené la corrección mínima y proporcional.» Publicación y restricciones exactas en L10.

## Tasks
T1 | S1-S9 | inline cierre autorizado + Worker | done | Commit 0cc35fc9cc16be04a63fec11340687a60cc92cbd; RED13/GREEN45 recuperados, padre45PASS/suite2814PASS159SKIP; PG18real12/12+cero/rechazo/NULL, contadores constantes; hash0291.
T2 | S1-S11 | delegated gentle-ai-verify + parent spot check | done | Commit 0cc35fc9cc16be04a63fec11340687a60cc92cbd; Risk: item 2; Verify mvtic6ad-1-u50u PASS B1-B3/S3,45focal+8stubs; anterior S1-S9PASS, S10-S11preparación.
T3 | S10-S11 | inline | done | Commit de código 0cc35fc9cc16be04a63fec11340687a60cc92cbd + este cierre documental; PR72 master Closes #69, CI40873869610 PASS (4jobs+2checksVercel), no merge/cierreissue/deploymanual; CI del cierre se observa sin modificar fuente.

T4 | S6/S12 | delegated gentle-ai-worker + verify | done | Commit correctivo que incorpora S12 (identificable por git blame de esta línea); delta BASEaf3effd; RED18/GREEN70, suite2839PASS159SKIP, Verify34probesPASS, hash2dad; Risk: item 2. Publicación y HEAD exacto quedan en comentario PR72 y mirrorEngram.

## Log
L1. Pedido original (verbatim):

Actuá como ingeniero senior y auditor de calidad de evaluaciones IA de **Busco Trabajo**, utilizando **Gentle Shell de Pi y Gentle AI**.

**Repositorio:** `marcostoledo96/busca_empleos`
**Issue:** https://github.com/marcostoledo96/busca_empleos/issues/69
**Rama destino:** `master`
**BASE de referencia:** `4ae83b2614c4468596d7f2b796725d5f17d40736`
**Rama propuesta:** `audit/issue-69-export-matching`

### Objetivo

Necesito obtener una exportación completa y segura de las ofertas laborales y sus evaluaciones para entregarla a un auditor independiente en ChatGPT.

Sospecho que DeepSeek clasificó incorrectamente algunas ofertas, tanto por falsos positivos como por falsos negativos.

No quiero cambiar el scoring ni los prompts antes de tener evidencia real.

### 1. Preparación

1. Leé `AGENTS.md` y la issue #69 completa.
2. Recuperá Engram (`project: "busca-empleos"`).
3. Revisá las issues #26, #57, #59, #60 y #70.
4. Descubrí las skills aplicables.
5. Utilizá Gentle AI Explore, Worker y Verify.
6. Sincronizá `origin/master`.
7. Trabajá en un worktree exclusivo.

No modifiques otros worktrees ni cambios ajenos.

### 2. Reutilizar el exportador existente

Ya existe:

`backend/tests/scripts/exportar-ofertas.js`

Actualmente exporta registros desde PostgreSQL, pero tiene limitaciones:

- No incluye el desglose completo de evaluación.
- No incluye el error técnico.
- No incluye firma ni fecha de evaluación.
- Incluye información de postulaciones que no necesitamos.
- La conexión no tiene una guarda explícita de destino.

Auditá el exportador y adaptalo con el menor cambio posible.

No crees un segundo sistema de exportación si podés aprovechar el existente.

### 3. Campos del archivo

Necesito conservar, cuando existan:

- ID de oferta.
- Título.
- Empresa.
- Ubicación.
- Modalidad.
- Descripción completa.
- URL pública.
- Plataforma.
- Nivel solicitado.
- Estado de evaluación.
- Porcentaje de compatibilidad.
- Razón de aprobación/rechazo.
- Explicación estructurada de requisitos cumplidos, incumplidos, por confirmar y exclusiones.
- Mensaje de error técnico, si existe.
- Fecha de evaluación.
- Firma de criterios.
- Fecha de publicación.
- Fecha de última extracción.
- Origen y completitud de la descripción.

**No exportes:**

- Notas personales de postulación.
- Fechas de postulación.
- Estado personal de postulación.
- CV personal completo.
- Información de contacto.
- Credenciales.
- Cookies.
- Tokens.
- Respuestas internas crudas de DeepSeek.
- `reasoning_content`.
- `datos_crudos` completos.

Preservá el contenido técnico de los avisos. No recortes las descripciones, porque necesitamos verificar los requisitos excluyentes.

Cuando existan emails, teléfonos o datos de contacto personales dentro de una descripción, sanitizalos sin perder requisitos importantes.

### 4. Exportar todo, no solo el dashboard

El endpoint habitual `/api/ofertas` aplica reglas de visibilidad y puede omitir registros históricos.

Necesito una exportación completa de todas las evaluaciones existentes, incluidas las que ya no aparecen en las pestañas actuales.

Agrupá los registros por:

- Aprobadas.
- Rechazadas.
- Pendientes.
- Con error técnico.
- Evaluación vigente, anterior o desconocida, cuando pueda determinarse correctamente.

Registrá el total de filas y reconciliá ese conteo contra el resultado de lectura SQL.

No confundas las 182 decisiones del último ciclo con el total histórico.

Si el archivo es grande, dividilo en lotes numerados o utilizá JSONL UTF-8.

### 5. Perfil de evaluación

Para revisar si DeepSeek se equivocó también necesito conocer los criterios que se utilizaron:

- Roles objetivo.
- Tecnologías comprobadas.
- Nivel de experiencia.
- Modalidades aceptadas.
- Zonas geográficas.
- Idiomas.
- Exclusiones obligatorias.
- Criterios adicionales para IA.

Prepará un resumen separado y sanitizado del perfil efectivo, sin nombre, correo, teléfono, dirección ni datos personales innecesarios.

No publiques el perfil en GitHub.

Si las preferencias cambiaron desde una evaluación histórica, no atribuyas los criterios actuales a esa evaluación automáticamente. Indicá qué puede y qué no puede reconstruirse.

### 6. Seguridad de PostgreSQL

Esta tarea NO autoriza lecturas de producción ejecutadas automáticamente por Pi.

Primero implementá y probá el exportador con una base sintética aislada.

Después entregame el comando y el procedimiento para hacer una exportación read-only desde una conexión expresamente autorizada.

Condiciones:

- Solo SQL SELECT.
- Sin migraciones.
- Sin escrituras.
- Sin creación de tablas.
- Sin modificaciones de configuración.
- Preferir un rol exclusivamente lector.
- Confirmar identidad del servidor y base.
- No incluir credenciales en comandos, logs ni archivos.
- No imprimir datos personales en consola.
- No ejecutar scraping, DeepSeek ni cron.

No utilices `npm run db:migrate` para diagnóstico.

Si la conexión autorizada no está disponible, dejá preparado el procedimiento sin inventar una exportación productiva.

### 7. Tests

Probá con fixtures sintéticos:

1. Aprobación correctamente justificada.
2. Rechazo correctamente justificado.
3. Aprobación incompatible con una regla excluyente.
4. Rechazo de una oferta potencialmente compatible.
5. Evaluación sin explicación.
6. Porcentaje inconsistente.
7. Error técnico.
8. Descripción ausente o parcial.
9. Evaluación antigua.
10. Registros históricos.
11. Unicode, tildes y descripciones extensas.
12. Ausencia de filtración de datos personales.

Verificá que no se pierdan filas y que el exportador no altere PostgreSQL.

No llames servicios externos reales.

### 8. Preparación para mi auditoría en ChatGPT

Generá un archivo local con un nombre identificable, por ejemplo:

`busco-trabajo-auditoria-matching.json`

Y, si corresponde:

`busco-trabajo-criterios-sanitizados.json`

La salida debe quedar excluida de Git y de los artefactos públicos.

No necesito un respaldo SQL, una copia completa de PostgreSQL ni el archivo `.env`.

Quiero que esos archivos puedan adjuntarse directamente a una conversación con ChatGPT para una auditoría independiente.

No inventes que el dataset productivo fue exportado si solamente generaste fixtures.

### 9. Trabajo posterior con los datos

Cuando el usuario entregue el archivo, el auditor debe poder:

- Revisar todas las aprobaciones.
- Revisar todos los rechazos.
- Detectar falsos positivos y negativos.
- Comparar el score con los requisitos.
- Verificar exclusiones obligatorias.
- Detectar razones sin evidencia.
- Identificar ofertas con descripción insuficiente.
- Diferenciar errores de DeepSeek de errores de reglas determinísticas.
- Clasificar hallazgos por gravedad y confianza.
- Proponer pruebas de regresión para los errores demostrados.

La auditoría debe conservar casos ambiguos como ambiguos, no forzar un veredicto.

### 10. Publicación

Tenés autorización para implementar el exportador, agregar pruebas sintéticas, hacer commits, push y abrir una PR hacia `master`.

Utilizá `Closes #69`.

No incluyas el archivo real de ofertas ni el perfil personal en commits, PR o comentarios.

Ejecutá Gentle AI Verify antes de publicar.

**No hagas merge, no cierres la issue ni ejecutes deploy manual.**

### 11. Entrega final

Informame:

1. BASE y HEAD.
2. Archivos modificados.
3. Campos exactos de exportación.
4. Garantías read-only.
5. Resultado de pruebas.
6. Verificación independiente.
7. Procedimiento concreto de exportación autorizada.
8. Ruta del archivo que debo adjuntar a ChatGPT.
9. Qué campos faltan o no pueden reconstruirse.
10. URL de PR y resultado de CI.

**Objetivo final: producir un dataset confiable, seguro y completo para que una auditoría externa pueda comprobar si DeepSeek está evaluando correctamente las oportunidades laborales, antes de modificar el comportamiento del evaluador.**

L2. El usuario eligió «Una sola PR a master (menos recomendada)». Sin chain_strategy; revisión posiblemente >400 líneas.
L3. Preparación: fetch origin/master=BASE, worktree exclusivo limpio registrado; principal sucio preservado. Issues 69/26/57/59/60/70 y comentarios leídos; registry resuelto. Explore mvt0r36y-1-b5vb confirmó última evaluación por fila, no ledger ni reconstrucción inversa de firma. No SQL real ejecutado. No .env ni dataset real leídos.

L4. Verify mvt27w2m-4-cox2: FAIL S3, B1 credenciales Basic y cookies, B2 requisito ISO27001(2022) borrado, B3 IDs públicos LinkedIn/Indeed perdidos; focal28PASS no cubría casos. Solo recheck B1-B3 tras corrección conjunta. Parent full suite85/2797PASS159SKIP sobre ed5 anterior. Worker correctivo falló Node write errno -122 antes de agent_settled después de editar exporter/tests/fixture/probe. Estado parcial SHA0291..., no resultados finales ni publicación. df raíz388GB libres/inodos82%libres: no afirmo disco lleno ni causa. No contenedor issue69 quedó corriendo. No commits, push ni PR. Muestra salida-sintetica-final corresponde al candidato ed5 con bloqueantes: no usar para auditoría.

L5. Usuario: «continua». Retomo inline sin relanzar Worker. Recuperada observación14960 del propio Worker: RED13fallos/32pases y GREEN45 focal; diferencial VM5casos sin red. Resultado no propagado por error de cierre del proceso. Hash0291 actual coincide con corrección preservada. Docker daemon no disponible al retomar; investigar runner local aislado, nunca conectar local5432 ni producción.

L6. Padre observó focal45/45PASS y suite85suites/2814testsPASS,159SKIP, exit0. PG18localefímero sin TCP:12/12, cero filas/rechazo/NULL;3bases68tablas4esquemas17rolesiguales; hash0291. Clúster nuevo inicializado/apagado sin tocar existentes, sin DDL/DMLapp. Muestra corregida .qa-runtime/issue69/salida-sintetica-corregida, solo sintética. Docs actualizados. masterdestinoconfirmado, permiso pushtrue y ninguna PRprevia de rama. Retomo Verify limitado.

L7. Verify limitado mvtic6ad-1-u50u PASS B1B2B3/S3;45/45focal+8/8stubs originales/controles, entrada inmutable,total8/8,cierrecliente,4consultas. Hash0291estable; diffchecklimpio. S1S2S4-S9PASSprevio,S10-S11preparación. Sin sweepnuevo. T3inprogress publicaciónautorizada, no merge/deploy. Riesgo residualitem2; revisiónhumana del dataset real requerida. No producción.

L8. Commit0cc35fc9cc16be04a63fec11340687a60cc92cbd reúne exportador/tests/docs/ODD (1286líneasautoradas, singlePRautorizada). Scope scan9paths y secretos:sin hallazgos; datoslocales/criterios/depsignorados. Pushjob4exit0 y PR72confirmada, base master, labeltype:feature, Closes69. CIwatchjob5pendiente; nunca merge/cierreissue/deploy. T1/T2mismo commit de trabajo; fronteraúnica por coherenciaseguridad+tests+docs. Próximo commit solo evidencia/cierredocumental, no nueva unidad código.

L9. CI fuente0cc35fc run40873869610 terminóPASS, watchjob5exit0: backendunit27s, backendDB38s, integración57 3m42s, frontend9m30s; Vercel/previewcommentsPASS por automatización existente, sin deploymanual. BASE4ae83b2614c4468596d7f2b796725d5f17d40736; exportador0291sin cambios. T3cumplepublicaciónyresultadoCI; cierre documental agrega solo evidencia (T1/T2commit0cc, T3estecommit). Última muestra útil solo sintética salida-sintetica-corregida. Ruta futura autorizada .qa-runtime/issue69/auditoria-autorizada-01/{busco-trabajo-auditoria-matching.jsonl,busco-trabajo-criterios-sanitizados.json,resumen.json}, no existe exportproductivo. No hay pendientes funcionales ni cambios de evaluador. El CI que derive del commit documental se informa al entregar; no reinicia revisión de código ni SQL.

L10. Nuevo pedido (verbatim):

Continuá trabajando en la PR #72 de `marcostoledo96/busca_empleos`, issue #69.

El auditor externo detectó un hallazgo bloqueante de seguridad. Leé el comentario completo:

https://github.com/marcostoledo96/busca_empleos/pull/72#issuecomment-6497030599

Corregí el problema de validación del servidor PostgreSQL antes de establecer la conexión.

**Objetivo:**
- Rechazar hostnames DNS para conexiones TCP y aceptar únicamente direcciones IP literales válidas o sockets Unix explícitamente autorizados.
- Validar el destino antes de crear el cliente o llamar a `connect()`.
- Mantener las protecciones read-only y las verificaciones de identidad existentes.
- Agregar pruebas sintéticas que demuestren que un destino inválido nunca inicia una conexión.

Ejecutá los tests focales pertinentes y el `npm test` completo exigido por AGENTS.md.

Mantené la corrección mínima y proporcional. No modifiques scoring, prompts ni reglas de matching. No leas producción, credenciales ni datasets reales. No ejecutes builds ni deploys por iniciativa.

Cuando termines, hacé commit y push a la misma rama de la PR #72. Publicá un comentario de entrega indicando HEAD exacto, cambios, pruebas ejecutadas, resultados y limitaciones.

No hagas merge ni cierres la issue. La auditoría externa recurrente verificará la corrección.

L11. Comentario6497030599 leído completo. Confirma validarOpciones solo string no vacío y connect antes de verificar identidad SQL; DNS debe rechazarse antes de crearCliente. EstadoPRopen/no merge, branch remoto/localaf3sin cambios. Alcance mínimo guardaserver+tests+docs; TLS no se reconfigura, se explicita limitación existente. No SQL/credenciales/datasets reales ni builds.

L12. T4terminado: solo2líneasfuncionales de guarda y ayuda/docs/test. RED18fallos52pases, GREEN70; suite85PASS10SKIP2839PASS159SKIP. Padre70PASS. Verify mvtr3otq-2-6e58 PASS S6/S12,27rechazosantesfactory/connect+7positivos=34sinconexión, inputsinalterados, SQL/read-only/identitysin cambios. SourceSHA2dad7e4b1f682811a189abe45f4ff94c7178b254517085d4a0f88735af8ea7e8. Noproducción/credenciales/datasets/PGreal/build/deploy. TLSheredadosinreconfigurar, no authTLSrealverificada; reauditoríaexternapendiente, noautoadjudicarPASSexterno. ErroroperativoprimernpmtestdesderaízMissingScriptresueltoalbackend, sinFAILfinal. Commitdeestelotecontienetodaevidenciadelcódigo; HEADexactoyresultadoentrega sepublicanenPR72sin otrocierre documentalrecursivo.
