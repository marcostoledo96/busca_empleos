# Issue #71 — HTTP403 sin cancelación ficticia

Conservo el HTTP403 y distingo un inicio rechazado sin run ID de una cancelación remota realmente intentada. No cambio Actor, proxy, permisos, headers, URLs, concurrencia, cuotas, presupuesto ni `maxRetries: 0`. No ejecuto proveedores reales para verificar este cambio.

## Contrato y alcance

| Situación simulada | Resultado esperado |
|---|---|
| HTTP403 en `actor.call`, sin ID | `http`, `codigoHttp: 403`; inicio rechazado, sin intento de cancelación ni segundo arranque. |
| Red/timeout sin ID | Conservo el tipo original y explicito que no puedo confirmar si el Actor inició; no intento abort. |
| Run no terminal sin ID | `respuesta_invalida`, incertidumbre explícita; no consulto ni aborto un ID desconocido. |
| HTTP403 durante polling con ID | Conservo HTTP403; intento abort del run conocido una vez. |
| Abort denegado o no terminal (`ABORTING`) | Agrego `cancelacion_no_confirmada` porque el intento ocurrió realmente. |
| Vence el plazo durante abort | No repito abort ni agrego un segundo evento por la misma cancelación. |
| `FAILED`, `ABORTED`, `TIMED-OUT` | No invento éxito; conservo el dataset útil como resultado parcial. |

Mantengo los códigos existentes y el registro común de errores: orden, atribución a las consultas y copias fuente/consulta. El mensaje del mismo objeto registrado se contextualiza sin agregar otro evento. La UI productiva no cambia: su resumen identifica fuente/estado; agrupa el error global compartido por las diez URLs. Los resultados por consulta siguen disponibles en «Resultados e historial». Agrego fixtures de componente y E2E móvil para fijar ese comportamiento, sin crear otro panel.

## Evidencia del incidente: alcance limitado

Según el registro de investigación de `odd/tasks/issue-71-bumeran-403.md`, Apify OAuth informó que `apify/puppeteer-scraper` es un Actor oficial no deprecado y devolvió cero runs en la cuenta consultada. Eso **no demuestra** ausencia histórica de runs ni que se trate de la cuenta usada por Railway.

Railway devolvió tres registros Bumeran a las 10:11:31 UTC del 28/10/2026: construcción de URLs, diez URLs generadas e inicio del puppeteer-scraper. El filtro adicional HTTP403 entre 10:10 y 10:20 UTC no devolvió coincidencias. Origen exacto del HTTP403 (API de Apify o sitio externo), permisos efectivos, run, tiempo y coste: **NO VERIFICADO**. No concluyo que Bumeran haya bloqueado el sitio ni que se haya iniciado o cancelado un run real.

No agrego bypass de CAPTCHA ni de controles de acceso. Si se verifica que el proveedor no autoriza este uso, corresponde decidir explícitamente entre deshabilitar la fuente o usar una vía autorizada. No activo ni desactivo flags automáticamente; la conservación de ofertas e historial no depende de esa decisión.

## Pruebas y límites de verificación

- RED observado antes de modificar el helper: la suite de resultados por fuente terminó con exit1, **7 fallos y 46 pases**. Cuatro casos HTTP403 sin ID (Bumeran y tres consumidores hermanos) devolvieron indebidamente `cancelacion_no_confirmada`; red y timeout mostraron el mismo problema. La prueba de plazo vencido durante abort quedó esperando un segundo abort y falló por el límite de Jest de 5 s.
- GREEN inicial observado: el mismo comando terminó con exit0, **53/53 pruebas**. Los estados terminales, HTTP403 con run conocido y abort confirmado/denegado/no terminal ya pasaron en RED y se conservaron en GREEN; no atribuyo a la corrección comportamiento que ya existía.
- GREEN final, tras agregar regresiones de éxito por cada consumidor hermano y respuesta no terminal sin ID: exit0, **57/57 pruebas**, una suite, sin snapshots (0,785 s). No ejecuté la suite completa; devuelvo el comando al padre para el cierre largo.
- Comando enfocado: `cd backend && npm test -- --runInBand --no-cache --runTestsByPath tests/servicios/servicio-scraping-resultados-fuente.test.js`.
- Diferencial efímero sin archivos: comparé los servicios públicos LinkedIn/Indeed/Glassdoor cargando en memoria el helper de BASE `9ea533565d2d91c0de4fcbb3769314caffd98992` y el actual. Ambos procesos por consumidor terminaron exit0 y stderr vacío; la única diferencia de stdout normalizado fue el mensaje HTTP403 y la eliminación del falso evento de cancelación en fuente/consultas. Ambos hicieron un único arranque y cero controles remotos. No incorporo pruebas que lean historia Git.
- Amplío la integración Express/PostgreSQL #59 existente para HTTP403 Bumeran individual y ciclo parcial, ofertas/seguimiento conservados e historial fiel. **Pendiente de ejecución**: la guarda #57 exige base `busca_empleos_issue57_test` y rol sintético propios; no la relajo para aceptar otro destino. El contenedor dedicado `busca-empleos-issue71-test` fue inspeccionado: imagen `postgres:15`, etiqueta `busca-empleos.issue=71`, puerto `127.0.0.1:55457`. No hice escrituras SQL.
- El runner SQL existente fija caches en `docs/evidencias/issue-59/runtime`, fuera de la superficie delegada. No lo ejecuto ni sustituyo sus guardas. El padre debe preparar el destino sintético exacto y autorizar la ubicación de salida antes de correrlo.
- La comprobación TypeScript `cd frontend && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.spec.json` terminó exit2: falta el módulo generado `src/environments/environment` en doce imports existentes. No genero configuración ni copio `.env` fuera del alcance autorizado. Componente, E2E móvil, build Angular y suite backend completa quedan pendientes de cierre por el padre.

### Corrección acotada de la expectativa SQL59

El registro `docs/evidencias/issue-59/runtime/issue71/sql59.stderr` muestra **2 pases y 1 fallo**: el caso nuevo esperaba `mensaje` en el historial. En `backend/src/modelos/ejecucion-busqueda.js`, `limpiarErrores()` conserva deliberadamente sólo `tipo` y `codigoHttp` válido antes de persistir el resumen; `listar()` devuelve ese resumen guardado. La prueba existente `sanitizo con lista permitida sin ofertas, credenciales, snapshots ni errores textuales` fija esta protección de privacidad. No es una pérdida del nuevo mensaje en el helper.

Corrijo únicamente la integración existente: exijo igualdad exacta con `{ tipo: 'http', codigoHttp: 403 }` para los errores de fuente y consultas en ambos historiales, sin mensaje textual ni falsa cancelación. En la respuesta individual mantengo y exijo el mensaje detallado exacto. También comparo por la API las entradas previas del historial antes/después de cada ejecución; conservo las comprobaciones de ofertas y seguimiento. No cambio el sanitizador ni la validación. El rerun SQL59 queda pendiente a cargo del padre con el entorno sintético protegido; esta corrección no acredita GREEN por sí sola.

### Verificación posterior en el worktree aislado

Preparé los environments Angular desde los ejemplos seguros y el rol/base exactos del harness #57 dentro del contenedor exclusivo #71. Las limitaciones de preparación descriptas arriba corresponden al primer intento, no a la configuración final.

- Backend completo: exit0, **2891 pases y 161 omisiones existentes** (85 suites aprobadas, 11 omitidas).
- Express/PostgreSQL #57: exit0, **41/41**, con identidad local sintética validada antes de SQL.
- Express/PostgreSQL #59: el primer intento falló por esperar un mensaje textual que el historial omite intencionalmente por privacidad. Corregí la expectativa al contrato sanitizado, sin modificar producción ni relajar la privacidad. El segundo intento terminó exit0, **3/3**, incluyendo Bumeran individual, ciclo parcial y conservación de ofertas, seguimiento e historial previo.
- TypeScript Angular: exit0 después de generar los environments desde ejemplos. Componente afectado: exit0. Suite Angular completa: exit0, **578 pases y 4 omisiones existentes**.
- E2E: el primer intento falló antes de descubrir tests porque el spec de Playwright importaba el fixture Angular de navegador. Separé las expectativas del runner sin cargar Angular en Node ni debilitar assertions; el segundo intento terminó exit0, **21/21 E2E**, incluido el caso móvil con diez URLs, resumen agrupado, detalle y una única representación causal del HTTP403. El recorrido existente también conservó geometría en 320, 360, 390, 768 y 1440 px.
- No repetí backend completo, SQL57 ni Angular después de correcciones limitadas a las expectativas SQL59 y al import del spec E2E.

### Verificación independiente

La inspección inicial no detectó bloqueantes, pero no pudo ejecutar pruebas por requerir una copia temporal aislada fuera del alcance autorizado. Después de la autorización explícita, el verificador comprobó el commit `35a148c77dddf5dde296ab2ddd6bcc21b5425c8a` en una única copia sin `.env` ni credenciales: **exit0, 57/57 pruebas, ninguna omitida**, con mocks y sin proveedores reales. Los blobs backend/documentales de la copia y los hashes del candidato original permanecieron intactos. SQL y UI corresponden a las ejecuciones previas detalladas arriba, corroboradas por lectura sin repetirlas.

No prometo un techo de gasto a partir del recorte local de resultados de Bumeran. Las pruebas usan exclusivamente SDK/HTTP simulados y no acreditan disponibilidad productiva ni costes remotos.
