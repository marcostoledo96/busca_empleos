# Issue #12 — CV base editable

## Alcance y autorización
Implementación backend/frontend/PostgreSQL, worktree aislado, dependencias, pruebas/build, commits/push y una única PR a `master` con `Closes #12` autorizados. Sin merge, cierre manual, despliegue manual, API paga, base productiva ni CV personal. Conservo #7–#11 y el worktree original con cambios ajenos.

- Rama: `feat/issue-12-cv-base-editable`.
- BASE: `3b10bbea86eda10c480f51de84472dac69638a09`.
- Entrega: una PR solicitada explícitamente; presupuesto previsto 700–1100 líneas incluyendo pruebas/docs. Diff funcional final: 977 adiciones/19 eliminaciones, 24 archivos, antes de este documento. Mayor carga de auditoría informada; no reduzco pruebas para achicar artificialmente el diff.

## Diseño y fases proporcionales
Los agentes SDD específicos no están disponibles: exploración combinó inicio/propuesta/especificación/diseño/tareas; workers acotados implementaron y un verificador independiente revisó. Persistencia Engram; sin OpenSpec ni ledger nativo de intentos inventado.

Uso una tabla singleton `cv_base` independiente: preferencias emplea `SELECT *`, `RETURNING *` y backups completos; agregar columnas allí expondría el documento en respuestas ajenas. Migración 020 idempotente, límite inclusivo 1048576 bytes, fila ausente distinta de texto vacío guardado, fecha de PostgreSQL. `GET/PUT /api/preferencias/cv-base` autenticados; PUT texto crudo UTF-8 `text/plain` o `text/markdown` evita descontar envoltorio JSON. No uso `cv.md` oculto ni altero perfil/IA/caché.

Textarea con guardado explícito, estados/fecha, protección Router y beforeunload. Durante guardar bloqueo edición/archivo; la respuesta tampoco reemplaza texto local. Archivo inicial explícito y UTF-8 estricto. Analizar crea File en memoria del snapshot elegido y reutiliza #10/#11. Guardar fuente, analizar, aplicar revisión y guardar preferencias son cuatro acciones independientes. Reevaluación #9 sigue explícita.

## Tareas, rutas y commits
- [x] T1 persistencia/API/migración/pruebas/docs: writer delegado por múltiples archivos y verificador independiente. Commit `8e3812ac6e5d7a713f42a2d54f488833d35ee73a` (355 adiciones). RED reportado por writer: módulo de ruta ausente; GREEN11 y finalmente27 focales. Backend1810 PASS/49 SKIPPED. Verificador observó27 focales PASS y persistencia PostgreSQL aislada1 PASS.
- [x] T2 editor/servicio/guard/importación/pruebas/docs: writer delegado. Commit `29f9aa67e3d8c821714ee5eae83a9040c8ebb28c` (591 adiciones/19 eliminaciones). RED1 y GREEN85 focales; full248 PASS/build PASS. Ajusté solo respuestas GET sintéticas de fixtures #9, sin debilitar assertions.
- [x] T3 verificación independiente y corrección acotada: verificador delegado leyó diff completo, comprobó suites/build/BD/recorrido. Sin bloqueadores; detectó spinner demo que corregí mediante worker con RED85 PASS/1 FAIL, GREEN86 PASS. Commit `0991cccfeb0cac89ed9bb8b01152b2cff1405d46` (31 adiciones); full249/build PASS del writer, focal86 PASS repetido independientemente. Commit de evidencia documental al cerrar este checkpoint.
- [ ] T4 en curso: parent verifica scope/privacidad, publica rama/una PR y consulta CI; no inventa aprobación de auditoría externa.

## Evidencia de verificación
Los focales y suites completas se superponen; no sumo sus conteos.

| Comprobación | Resultado observado |
|---|---|
| Backend `NODE_ENV=test npm test -- --runInBand` | PASS1810, SKIPPED49, FAIL0; writer y verificador |
| Angular focal Preferencias/servicio/guard/reevaluación | PASS86, FAIL0; verificador final |
| Angular `npm test -- --watch=false --browsers=ChromeHeadless` | PASS249, FAIL0; writer final (verificador anterior248) |
| Angular `npm run build` | PASS; writer final y verificador antes de corrección demo |
| PostgreSQL aislado `npm run db:migrate:apply` | PASS23 migraciones |
| PostgreSQL aislado `npm run test:db` | PASS76 pruebas/7 suites, FAIL0 |
| `git diff --check` | PASS; writer y verificador |

Angular focal usa cuatro `--include`: `src/app/paginas/preferencias/preferencias.spec.ts`, `src/app/servicios/preferencias.service.spec.ts`, `src/app/guards/cambios-cv.guard.spec.ts`, `src/app/paginas/dashboard/reevaluacion-flujo.spec.ts`.

BD: PostgreSQL18.6, cluster efímero exclusivo, `NODE_ENV=test ALLOW_DB_TESTS=true`, `DATABASE_URL=''`, destino localhost/base con sufijo `_test`, SSL deshabilitado. Sin `.env`/`.env.test` que reemplace destino. SQL confirmó identidad y directorio del cluster; detenido al finalizar, temporal retenido sin eliminación. No toqué ninguna BD existente.

## Aceptación comprobada
- GET inexistente/null versus CV vacío; roundtrip íntegro Markdown/UTF-8/BOM/CRLF/multibyte/fecha. Límite inclusivo1MiB y rechazos de tipo, exceso, NUL y UTF-8 inválido. Auth y error BD sin éxito ni logs del documento.
- UI carga/pendiente/guardando/guardado/error; edición bloqueada y snapshot conservado ante respuestas tardías. Guard Router con navegación real y handler beforeunload; archivo asíncrono con identidad y confirmación antes de reemplazar pendientes.
- Recorrido sintético DOM/componente/servicio HTTP: escribir/guardar/recargar/editar/analizar texto exacto/revisar correcciones-notas/guardar fuente sin borrar revisión/aplicar/guardar preferencias/recargar/error sin confirmar perfil nuevo.
- #11 conserva preguntas/correcciones/notas y preferencias manuales; #9 mantiene reevaluación explícita sin scraping ni POST automático. Regresiones #7–#11 y documento largo #10 verdes. Fuente no se incorpora a perfil efectivo/prompts/caché.

## Revisión nativa y límites
RDD permanece habilitado por decisión global del usuario. ASSESS no pudo producir riesgo por scope untracked: se aplicó verificación independiente conservadora. START de T1/T2 expiró antes de ejecutar consentimiento: `lineage_created=false`, sin autoridad ni aprobación. No repito automáticamente ni modifico el switch.

La corrección demo `29f9aa6..0991ccc` obtuvo review nativa medium/reliability `review-5009ef8fb198153f`, aprobada y reconocida con authority burned. Cubre únicamente esas31 líneas, no toda la feature. La verificación independiente leyó toda la feature; auditoría externa pendiente.

NOT RUN: inspección visual desktop/mobile/screenshots, diálogo nativo beforeunload visible, E2E integrado Angular→Express→DB, Firebase/DeepSeek reales y despliegue real. DOM/HTTP mock y PostgreSQL real son evidencias separadas, no un E2E completo. Advertencia no bloqueante: ChromeHeadless reportó404 de fuentes PrimeIcons. Sin fallos funcionales finales conocidos.

## Siguiente paso
Publicar una PR verificable, consultar CI sin reruns manuales, conservar issue abierta y no hacer merge. `.atl`, `.codegraph`, dependencias/environments/cachés/build locales quedan fuera del commit. Auditor externo decide su veredicto; Marcos decide merge posterior.
