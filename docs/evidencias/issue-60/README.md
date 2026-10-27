# Issue #60 — Evidencia funcional móvil

## Alcance y estado

BASE: `71b81be75da247905ac4d613c49f98feb9ba6c7a` (`origin/master`).
Rama: `test/issue-60-e2e-funcional-mobile`. Estado actual: T3 focal 6/6 PASS y Angular 573 PASS (4 skips existentes) sobre `ca1e26f` + árbol sucio. La integración final fue 18/19 por ECONNRESET en un recorrido anterior de búsqueda; no declaro entrega completa ni verificación independiente T4. Conservo debajo el historial de T2 y de la primera ejecución parcial de T3.
Reutilizo los dos harnesses existentes. No uso datos personales, proveedores reales, cron activo ni escrituras productivas.

## Inventario previo a nuevos tests

| Funcionalidad | Test existente | Nivel | Positivo existente | Negativo existente | Persistencia demostrada | Riesgo pendiente |
|---|---|---|---|---|---|---|
| Acceso/rutas | `frontend/src/app/app.routes.spec.ts`, `guards/auth.guard.ts` | Unitario/configuración | Declaración de rutas y guarda de borrador | Redirección prevista sin sesión | No aplica | Falta navegación de navegador por las guardas reales; integración monta Dashboard directamente |
| Dashboard y búsqueda | `frontend/e2e/dashboard.spec.ts`, `controles.spec.ts` | Navegador sintético | Acciones, carga, temas, ciclo manual | Estados de error/recuperación | No | No acredita SQL |
| Avisos operativos | `frontend/e2e/avisos-operativos.spec.ts` | Navegador sintético | Estado parcial, cancelación, recuperación | Fallos de búsqueda/ciclo, 202 no terminal | No | Reutilizar, no duplicar |
| Búsqueda/historial/ciclo | `frontend/e2e/integracion/busqueda-real.integracion.ts` | Angular → Express → PostgreSQL aislado | Buscar, historial, ciclo terminal parcial/sin resultados | Fallo SQL, ciclo parcial | Sí, ofertas/historial y evidencia SQL | Extender mutaciones de usuario y auth |
| Listado | `frontend/e2e/tabla-ui.spec.ts` | Navegador sintético | Filtros, pestañas, selección, paginación, responsive, teclado | Vacío/error, selección/bulk | No | Falta recorrido integrado con seguimiento SQL |
| Detalle | `frontend/e2e/detalle-ui.spec.ts` | Navegador sintético | Matching, foco, fecha/nota, borrador | Guardado HTTP fallido, límites Unicode | No | Falta escritura, recarga y lectura SQL reales |
| Evaluación IA | `frontend/e2e/controles.spec.ts`, integración #57 y helpers de proveedores | UI sintética / Express real con proveedor ficticio | Evaluar, reintentar, ciclo | Error/cancelación | Según recorrido, no toda la matriz IA | No confundir resultado anterior, técnico y rechazo |
| Preferencias | `frontend/e2e/preferencias.spec.ts`, `preferencias-harness.spec.ts` | Navegador con HTTP simulado | Pestañas, edición, guardado, importación | Guardado fallido, aislamiento | No | Falta persistencia real y navegación entre pantallas |
| CV imprimible | `frontend/src/app/paginas/cv/cv.spec.ts` | Unitario/componente | Fuentes confirmadas, vista y llamada a impresión | Datos ausentes/privados | No | Falta recorrido navegador; `window.print` no demuestra PDF |
| Automatización | `controles.spec.ts`, `avisos-operativos.spec.ts`, `busqueda-real.integracion.ts` | Sintético + integración SQL | Cron inactivo, progreso y terminal | Parcial/error/recuperación | Sí para historial de integración | Cron debe continuar inactivo; no hace falta iniciarlo para verificar consulta |

Inventario: agente `gentle-ai-explore`, tarea `mvpn5j1w-1-l6oc`; revisión read-only, no ejecución. CodeGraph inicializado en worktree. Las referencias describen cobertura existente, no resultados observados de esta issue.

## Entorno y aislamiento

- Worktree independiente; cambios ajenos del workspace original preservados.
- PostgreSQL 15 descartable en contenedor `busca-empleos-issue60-pg`, puerto `127.0.0.1:55457`; sin volúmenes ni datos copiados.
- Se reutilizan las identidades sintéticas exactas y validación de base/usuario/versión/esquema de #57.
- Dependencias instaladas con `npm ci` en backend y frontend, exit 0. Sin actualización de lockfiles. npm informó scripts de instalación pendientes y deprecaciones existentes; no se aprobaron scripts globalmente.
- Antes de pruebas integradas: `npm --prefix backend run test:issue61` bajo entorno limpio con variables sintéticas; exit 0; 32/32 pruebas, dos suites, 7.842 s. Log: `frontend/e2e/integracion/salida/issue60-preflight-inicial.log` (artefacto local ignorado).
- RDD: desactivado por `clone_local`; no se inicia revisión nativa ni se modifica ese modo.

## Matriz de ejecución

| Recorrido | UI | Express real | PostgreSQL real de test | Estado |
|---|---|---|---|---|
| A — Login y navegación | PASS | Guardas e interceptor reales | Sin mutaciones | Autoverificado; identidad externa simulada |
| B — Buscar empleo | PASS | Sí | Ofertas e historial reales | Autoverificado |
| C — Consultar ofertas | PASS de recorrido integrado básico | Sí | Lectura real | Casos visuales exhaustivos existentes quedan para T4 |
| D — Registrar postulación | PASS | Sí | Estado, fecha, dos notas y bulk parcial/reintento | Autoverificado |
| E — Evaluación IA | PASS | Sí; DeepSeek ficticio | Resultados, firma y recuperación reales | API #57 41/41 verificada por el padre |
| F — Preferencias, importación y CV | PASS 6/6 | Sí, identidad/IA externas sintéticas | Preferencias/CV base reales, SQL antes/después | T3 funcional PASS; validación global parcial por ECONNRESET ajeno al recorrido F |
| G — Automatización inactiva e historial | PASS | Sí; cron sin activar | Historial y estados terminales reales | Autoverificado |

## Implementación y ejecuciones observadas de T2

### Árbol y fronteras

Las ejecuciones finales de abajo corresponden a `d58efe8` **más cambios sin commit**, no al HEAD de entrega. Después sólo actualicé esta evidencia. El arreglo de producto se limita a una línea autorizada de `tabla-ofertas.ts`; el resto del lote correctivo ajusta pruebas.

- Reutilizo `main-integracion.ts`, las rutas y el shell reales, `authGuard`, `AuthService` y el interceptor reales. Sustituyo el objeto Firebase SDK `Auth` exclusivamente en la entrada loopback:4357. La sesión, token y resolución del popup son sintéticos; no pruebo Google OAuth, Firebase remoto ni el popup real. La aplicación productiva no importa esta entrada.
- Mantengo Firebase Admin, Apify y DeepSeek ficticios en #57 y el bloqueo existente de transportes externos. Las nuevas pruebas del navegador abortan destinos fuera del origen de integración. No activo cron ni nuevas fuentes.
- Las mutaciones de seguimiento, descripción y evaluación llegan a controladores/modelos reales y PostgreSQL aislado. `/__issue57/evidencia` ejecuta `SELECT` sobre el esquema validado; no devuelve almacenamiento Angular ni respuestas de escritura prefabricadas.
- El trigger nuevo `postulacion_parcial` omite la actualización de la segunda oferta sintética, para ejercitar un contador parcial real y conciliación antes de reintentar. Las lecturas indisponibles 503 y la previsualización 429 se inyectan explícitamente en el contenedor API de prueba, conservando autenticación; no demuestran un fallo SQL de lectura ni un rate limiter real. El fallo SQL de guardado usa el trigger existente.
- Los estados 429/503 de Apify se traducen a HTTP **502** en el contrato real de Express. No los presento como HTTP 429/503 del backend.
- Generé `environment.ts` y `environment.prod.ts` exclusivamente desde sus `.example`, mediante `npm --prefix frontend run prebuild`, exit 0, con autorización explícita. Permanecen ignorados; no se incorporan credenciales reales.

### Registro de verificaciones

El prefijo limpio utilizado para los dos runners fue:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable
```

| Comando después del prefijo, salvo Angular/build/diff | Resultado observado | Evidencia local ignorada, bajo `frontend/e2e/integracion/salida/` |
|---|---|---|
| `npm --prefix backend run test:issue57` | Exit 0; 41/41, 2 suites, 13.872 s; ejecutado por el padre después de reponer PostgreSQL | `issue60-test-issue57-repuesto.log`; backend sin cambios posteriores, no lo repetí |
| `npm --prefix frontend run test:e2e:integracion -- --grep 'Angular → Express → SQL\|D bulk SQL parcial\|B/D interrupción'` | Exit 0; 5/5 afectados, 1.1 min | `issue60-t2-focal.log`; copia de resultados en `backup-t2/focal-green/` |
| `npm --prefix frontend run test:e2e:integracion` | Exit 0; 13/13, cero skips/retries/flaky; 102.287 s | `issue60-t2-integracion-final.log`; resultados y adjuntos conservados en `backup-t2/integracion-green/` |
| `CHROME_BIN=/usr/bin/google-chrome npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` | Exit 0; 571 PASS, 4 omitidos reportados de 575; 36.038 s de ejecución | `issue60-t2-angular.log`; este lote no agrega skips |
| `npm --prefix frontend run build` | Exit 0; 5.033 s | `issue60-t2-build.log`; warning existente de `preferencias.css`: presupuesto 15 kB excedido por 610 bytes |
| `git diff --check` | Exit 2 | Espacio final en `odd/tasks/issue-60-e2e-funcional-mobile.md:37` (entrada L7 del padre); no edité ese archivo, fuera de la superficie autorizada |

Estos resultados **reemplazan las conclusiones parciales anteriores**, no borran sus fallos. Hubo un bloqueo ambiental `ECONNREFUSED`, resuelto por el padre con preflight #61 repuesto exit 0, y luego una ejecución 8 PASS/5 FAIL. Preservé esa ejecución antes de limpiar Playwright: `backup-t2/issue60-e2e-repuesto.log`, `backup-t2/resultados.json` y sus trazas. No atribuyo validez a pruebas ejecutadas mientras PostgreSQL no estaba disponible.

### RED/GREEN y corrección acotada

- **RED de producto:** tras ordenar por título, selecciono IDs 1 y 2 visibles; aplicar elimina la selección sin emitir PATCH. `ofertasVisiblesActuales()` consultaba `tabla.filteredValue ?? this.ofertas()`, aunque PrimeNG mantiene su arreglo ordenado en `tabla.value`. Trace RED conservado: `backup-t2/resultados/recorridos-mobile.integrac-f03f3--página-invalidan-selección/trace.zip`.
- **GREEN:** uso `tabla.filteredValue ?? tabla.value ?? this.ofertas()` antes de paginar/revalidar. El E2E exige selección de ambas filas, PATCH `[1,2]`, respuesta parcial, conciliación a una oferta, reintento `[2]` y conservación de las otras 23. También vuelve a seleccionar 1/2 ordenadas para confirmar/cancelar la reevaluación compartida sin nuevas llamadas IA.
- Los otros cuatro fallos eran de prueba: el diálogo genérico también encontraba el sidebar; los diagnósticos JS ahora vienen de un chunk lazy; el handler de aborto aún no había terminado al desregistrarlo. Acoto el diálogo por su heading, mantengo los cinco diagnósticos exactos y exijo origen local + extensión JS; espero la finalización de la ruta antes de desregistrarla. No cambié timeouts ni oculté errores.

### Recorridos y evidencia SQL finales

Los adjuntos SQL están embebidos como JSON en `backup-t2/integracion-green/resultados.json`; las capturas se conservan junto a cada resultado. Esquema observado: `issue57_43123_1793055627962`, base `busca_empleos_issue57_test`.

| Recorrido | Viewport | Tema | PASS observado y adjunto |
|---|---|---|---|
| A: rutas sin sesión, login SDK sintético, navegación, recarga, retroceso, logout, foco/teclado | 360×800; 412×915; 768×900 | Claro; oscuro; claro | Tres casos PASS; SQL sin modificaciones; `login.png` |
| A: rechazo de token y sesión ausente | 390×844 | Claro por defecto | 401/403 reales y mensajes útiles; controles de reintento habilitados |
| B/C/G: configuración, fuente, búsqueda, listado/filtro/detalle, error SQL y recuperación, ciclo parcial y vacío terminal | 1440×900; 390×844; 320×844 | Claro; oscuro; claro | `SQL-y-fronteras`, `SQL-ciclo-terminal`; `detalle.png`, `error503.png`, `ciclo-parcial.png`, `dashboard-recuperado.png` |
| D: estado/fecha/nota → recarga → segunda nota → recarga | 390×844 | Oscuro | `SQL-seguimiento-dos-revisiones`: ID1 `cv_enviado`, fecha `2026-01-15`, primera nota 1320 caracteres; segunda `Segunda revisión sintética confirmada`; ID2 intacto. `seguimiento-390-oscuro.png` |
| D: SQL500/400, doble clic, revisión tardía y borrador | 320×844 | Claro | `SQL-reintento-y-versiones`; una solicitud retenida y una segunda revisión, sin sobrescribir el borrador reciente |
| D: selección, filtro/página, cancelar, bulk parcial y reintento | 1440×900 | Claro | `SQL-bulk-parcial-reintento`: parcial ID1 `cv_enviado`/ID2 `no_postulado`; final ambos `cv_enviado`; PATCH `[[1,2],[2]]`; otras 23 filas idénticas |
| B/G: lectura503/429, historial conservado, proveedor429/503, ciclo fallido y recuperación | 412×915 | Oscuro | `SQL-recuperacion-lecturas-proveedor-ciclo`; el 202 se sigue hasta terminal; cron inactivo |
| E: individual, JSON incompleto y seleccionada | 390×844 | Oscuro | `SQL-IA-individual-incompleta-seleccionada`: score85 y firma conservados ante fallo; recuperación limpia errores; seguimiento intacto |
| B/D: sincronización cancelada/reanudada y rollback SQL de estado | 360×800 | Claro | `SQL-interrupcion-rollback`; estados, evaluaciones y llamadas de proveedor idénticos al inicio |

Riesgo compartido: el helper de selección interviene tanto en bulk como en reevaluación. Verifiqué ambos consumidores y la suite Angular. La inspección independiente debe revisar también selección global tras orden/filtro/página y los límites del doble SDK; no presento el login sintético como OAuth real.

### Autocomprobación de specs y pendientes

- **S2:** rutas/guardas/shell reales, login/logout SDK sintético, recarga/retroceso y 401/403 PASS; autenticación externa fuera del alcance.
- **S3/S10:** búsqueda, lectura indisponible, proveedor429/503, cancelación/reanudación, fallo SQL, ciclo parcial/fallido/vacío y recuperación PASS; cron inactivo y ciclos seguidos hasta terminal.
- **S4/S12:** integración PASS en los seis tamaños pedidos y ambos temas representativos. Mantengo sin duplicar los casos visuales exhaustivos existentes de tabla/detalle, matching/prioridad y tarjetas/paginación móvil; su suite sintética completa y la inspección interactiva independiente quedan para T4. Chromium no acredita Android físico.
- **S5:** SQL confirma estado/fecha/dos notas tras recarga, rechazo400/500, borrador reciente, doble envío, rollback y bulk parcial seguro. Cambio de oferta durante guardado mantiene su caso existente de `detalle-ui.spec.ts`; no lo duplico ni lo presento como integración SQL nueva.
- **S6:** UI+SQL individual/seleccionada, JSON incompleto, resultado válido anterior y recuperación PASS; el padre comprobó API #57 41/41 con técnico503, reintento, rechazo, exclusión Java y cancelación. Abrir detalle no invoca IA; expansión de explicación mantiene su caso existente sin duplicar.
- **S11:** 400/401/403/500/503 observados con contratos reales; 429 de lectura inyectado explícitamente; 409 en #57. Datos y controles comprobados, sin falsa confirmación basada sólo en 200/202.
- **S14/S15:** conservo validaciones de identidad/esquema, bloqueo de red y fuentes; preflight #61 original32/32 y repuesto exit0 aportados por el padre. Sin operaciones productivas.
- **S16:** fix mínimo autorizado de una línea en revalidación desktop, RED/GREEN arriba; sin nuevas dependencias, skips ni inflación de timeouts.
- **T3:** quedan intactas las guardas de borrador y la navegación real a Preferencias/CV. No implementé su suite de persistencia/importación/impresión.

## T3 — Primera ejecución parcial y defecto reproducido (historial)

Árbol probado: `ca1e26f61d264c2aa85489676acf0bdab3e67a32` **más cambios sin commit**. No atribuyo estos resultados a un HEAD futuro. Mantengo el ODD del padre sin editar.

Agregué `preferencias-cv.integracion.ts` al descubrimiento existente, sin otro harness ni dependencias. Reutilizo Angular con rutas reales → Express #57 → modelos reales → PostgreSQL validado. Amplío `/__issue57/evidencia` con `SELECT *` de `preferencias` y `cv_base`, incluidos sus campos y timestamps. La allowlist admite `preferencias_cv`; un trigger `BEFORE INSERT OR UPDATE` rechaza ambas tablas antes de modificar datos. No simulo sus respuestas de guardado. Identidad externa y salida DeepSeek son sintéticas; el escenario `ia_cv` devuelve propuestas revisables y preguntas, no modifica preferencias.

Genero los PDF pequeños en memoria con objetos, stream y xref válidos, sin biblioteca adicional. **pdf-parse real** recuperó texto seleccionable del PDF válido y devolvió `SIN_TEXTO_EXTRAIBLE` para una página sin texto; el documento malformado devolvió `DOCUMENTO_INVALIDO`. Markdown también usa el extractor real. El exceso de 5 MiB se rechaza en el cliente: no lo presento como HTTP413 observado. No se acreditó OCR ni generación de PDF.

### Verificación observada

Los comandos SQL utilizan exactamente el prefijo limpio documentado arriba. No se modificaron fuente Angular ni shell: build no aplicable a este lote.

| Comando | Resultado |
|---|---|
| `npm --prefix frontend run test:e2e:integracion -- preferencias-cv.integracion.ts` | Tres ejecuciones, exit1: 0/6 por fixture inicial con tipo incorrecto (415); 1/6 tras corregir a Markdown raw; última 2/6 PASS, 4 FAIL, 1.4 min. Sin skips/retries ni timeout aumentado. |
| `npm --prefix backend run test:issue57` | Exit0, 41/41, dos suites, 13.209 s. |
| `npm --prefix frontend run test:e2e:integracion` | Exit1, 15/19 PASS, 4 FAIL, 174.073 s. Los 13 recorridos preexistentes siguen PASS; los dos nuevos PASS son CV base y documentos rechazados. |

### Evidencia y autocomprobación por spec

- **S7 parcial / RED de producto:** a 320×844 claro, las siete pestañas reales no desbordan; se editan nombre, términos, LinkedIn y modelo, sin llamar IA. SQL500 conserva todos los campos anteriores y el formulario. Al salir a `/cv` **no aparece confirmación y se pierde el borrador**: el test espera `dialog` y falla tras navegar. `cambios-cv.guard.ts` sólo consulta `cambiosCvPendientes`/`guardandoCvBase`; `Preferencias.advertirSalidaCv()` usa la misma condición. Existe `cambiosSinGuardar`, pero no participa en esas guardas. No se corrigió por estar fuera de superficie autorizada. El reintento/recarga de preferencias generales permanece sin acreditar por este bloqueo.
- **S8 PASS acotado:** CV base a 390×844 oscuro: lectura, edición Markdown, fallo SQL500, conservación exacta de fila y timestamp, borrador entre pestañas, salida cancelada, reintento explícito y recarga, con SQL antes/después. Extracción negativa a 320×844 PASS: PDF vacío422, inválido422 y tamaño rechazado localmente; conserva borrador, preferencias y CV base sin llamadas IA. Ambas importaciones positivas llegan a extraer, corregir, analizar multipart explícitamente, confirmar Docker, ignorar modalidad y aplicar sin escritura automática; fallan luego por locator ambiguo del mensaje de éxito (toast + status), **no por defecto demostrado de importación**. Falta observar sus asserts finales de recarga y SQL confirmado.
- **S9 parcial:** desde Preferencias se abre `/cv` real con fuentes guardadas, aviso por contacto faltante, bloques inicialmente excluidos, selección explícita y preview. El borrador sobrevive volver a editar y cancelar salida. A 390×844 oscuro no hay desborde. En print el documento tiene fondo blanco y texto `rgb(23,23,23)`; el test esperaba erróneamente negro puro y falla. A4, captura print y contador de `window.print()` están implementados pero **no alcanzados**: no declaro impresión ni PDF comprobados.
- **S11/S12 parcial:** SQL500 real, controles recuperados, datos conservados y errores visibles en los dos PASS. Capturas 320 de siete pestañas y errores, 390 oscuro de CV base y preview. El archivo `cv-print-A4.png` aún no se produjo. Inspección interactiva y Android físico no ejecutados.
- **S14/S15:** guardas existentes #57, allowlist previa a escrituras, esquema aislado y red bloqueada; preflight #61 32/32 aportado por el padre. No cron, producción, datos personales ni llamadas reales.
- **S16:** RED reproducido, sin fix de producto ni GREEN atribuido. Detengo correcciones tras las dos pasadas permitidas. Para corregir ambos tipos de salida propongo autorizar exclusivamente `frontend/src/app/guards/cambios-cv.guard.ts`, `frontend/src/app/guards/cambios-cv.guard.spec.ts`, `frontend/src/app/paginas/preferencias/preferencias.ts` y `frontend/src/app/paginas/preferencias/preferencias.spec.ts`. Además hay que acotar el locator de éxito y usar contraste/color real en el test print antes de volver a validar.

Artefactos locales ignorados: `frontend/e2e/integracion/salida/resultados.json` (stats, duraciones y adjuntos SQL), `resultados/preferencias-cv*/` (capturas, error-context y trazas). Resguardo previo de T2 en `backup-t2/antes-t3/`; no borré sus copias anteriores. El adjunto PASS `SQL-cv-base-antes-despues` incluye todas las columnas de preferencias y CV base; `SQL-importacion-rechazos` conserva el estado final. Los adjuntos positivos de importación e impresión no se alcanzaron.

## T3 — Reanudación autorizada y resultados finales

El usuario autorizó explícitamente los cuatro archivos de guarda/componente y sus specs. Mantengo `ca1e26f61d264c2aa85489676acf0bdab3e67a32` + dirty como identidad del árbol probado. No edité ODD ni ejecuté commits/push. Resguardé la ejecución parcial en `salida/backup-t3/antes-reanudacion/` y el focal GREEN en `salida/backup-t3/focal-green/` antes de limpiar resultados.

### RED/GREEN y cambio mínimo

Dos tests nuevos de unidad reprodujeron el defecto sin modificar producto: **69 PASS/2 FAIL**, 4.834 s, fallos exactos de ruta y beforeunload ante preferencias generales pendientes. Reutilicé el E2E RED previo (salida real sin diálogo y pérdida del borrador); no lo presento como una nueva ejecución. Agregué `cambiosSinGuardar` a las dos condiciones existentes, manteniendo protección del CV base. La confirmación ahora nombra preferencias y CV base. Focal Angular después: **71/71 PASS**, 4.406 s, incluyendo cancelar, descartar, SQL500 simulado, reintento/guardado y regresión del CV base.

Acoté el mensaje de éxito de Playwright a `role=status`, sin quitar assertions SQL. Para print verifico fondo blanco y contraste WCAG AA ≥4.5:1: `rgb(23,23,23)` es legible, no un defecto por no ser negro puro. El primer focal reanudado llegó a SQL final pero detectó que el test no había agregado su término libre: Enter se enviaba antes de elegir la sugerencia. Una corrección aún seleccionaba el `option` que envuelve al input de chips; el snapshot lo demostró. La segunda, acotada al overlay real de sugerencias, agregó el término y conservó la assertion SQL exacta; sin modificar producto ni timeouts.

### Comandos y resultados

Los comandos SQL llevan exactamente el prefijo limpio de Entorno. El único fallo final no está en una lista de fallos ambientales aceptados: **por eso el estado global sigue parcial**, aunque los seis casos T3 pasaron también en la suite completa.

| Comando | Resultado observado |
|---|---|
| `npm --prefix backend run test:issue61` | Exit0; 32/32, 2 suites, 6.727 s. Antes de reanudar E2E; base sintética validada. |
| `CHROME_BIN=/usr/bin/google-chrome npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless --include=src/app/guards/cambios-cv.guard.spec.ts --include=src/app/paginas/preferencias/preferencias.spec.ts` | RED exit1 69/71; GREEN exit0 71/71. Duraciones arriba. |
| `npm --prefix frontend run test:e2e:integracion -- preferencias-cv.integracion.ts` | Reanudación: exit1 5/6 en 23.5 s; corrección exit1 5/6 en 32.0 s; final exit0 **6/6 en 25.8 s**. |
| `npm --prefix frontend run test:e2e:integracion` | Una ejecución final: exit1 **18/19**, 121.908 s. Falla `Angular → Express → SQL 390 oscuro`, `busqueda-real.integracion.ts:260`, al consultar `/__issue57/evidencia`: `socket hang up (ECONNRESET)`. No atribuyo causa raíz ni lo oculto con retry. Los seis T3 PASS. |
| `CHROME_BIN=/usr/bin/google-chrome npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` | Exit0; **573 PASS de 577**, cuatro skips preexistentes; 39.725 s (38.728 s de tests). Log `salida/issue60-t3-angular.log`. |
| `npm --prefix frontend run build` | Exit0, 4.873 s; warning preexistente de presupuesto CSS Preferencias +610 bytes. Prebuild confirma que no modificó environments. |

Backend #57 41/41 en 13.209 s se ejecutó en la primera parte del mismo lote; helpers sin cambios posteriores. No repetí otras suites backend ni el harness sintético completo (los ejecuta el padre).

### Autocomprobación final S7–S9 / S11–S12 / S14–S16

| Spec | Resultado y evidencia final observada |
|---|---|
| S7 | PASS: siete pestañas reales a 320×844 claro, valores actuales, nombre/búsqueda/LinkedIn/modelo, sin llamadas IA; SQL500 conserva fila/timestamp, borrador y controles; ruta cancelada y beforeunload cancelado; reintento, recarga y SQL exacto con nombre, modelo, plataformas y ambos términos. `SQL-preferencias-antes-despues`. |
| S8 | PASS: CV base Markdown editado/SQL500/borrador/salida cancelada/reintento/recarga; `SQL-cv-base-antes-despues`. Importación MD y PDF real → texto revisado/corregido → análisis multipart explícito de ese texto → confirmo Docker e ignoro modalidad → aplicar sin guardar → SQL todavía idéntico → guardar explícito → recarga y SQL confirma Docker básico/preguntas decididas/nombre sin cambiar modalidad ni CV base. `SQL-importacion-md/pdf` incluye antes, extraído, aplicado y después, todas las columnas reales. Rechazos vacío422/dañado422/tamaño local conservan SQL/texto. |
| S9 | PASS: acceso real desde Preferencias, fuentes guardadas verificadas, faltantes visibles, bloques no incluidos por defecto, selección manual y vista previa; al volver a editar y cancelar salida conservo borrador. Print CSS A4 y contraste AA sobre blanco, incluso tema oscuro; contador de print=0 antes y =1 únicamente tras clic. `SQL-cv-impresion-sin-escrituras` confirma fuentes y llamadas sin cambios. **Sólo window.print, no PDF generado.** |
| S11 | PASS acotado a T3: errores SQL500 en ambas escrituras, sin falsa confirmación, fila/timestamp sin cambio, controles habilitados y reintento efectivo; rechazos422 reales y límite local. Los estados HTTP de otras pantallas conservan cobertura T2; no fuerzo todos en cada pantalla. |
| S12 | PASS representativo T3: siete pestañas/errores a320 claro, editor390 oscuro, importaciones412 claro y preview390 oscuro, sin scroll horizontal. Capturas de pestañas, CV base/error, imports, preview y print. No atribuyo nueva inspección MCP ni Android físico; controles/teclado exhaustivos ya existentes quedan en T4. |
| S14/S15 | PASS: mismo harness main-integracion + Express#57 + PG, identidad/esquema validados, preflight32/32, bloqueos de red conservados y cron inactivo. Sólo identidad externa/DeepSeek ficticios. Extracción PDF con pdf-parse real, sin dependencias nuevas. |
| S16 | PASS: fix mínimo en dos condiciones + texto de confirmación, RED/GREEN unidad/E2E, sin rediseño. No intenté arreglar ECONNRESET sin diagnóstico ni autorización para ampliar el recorrido de búsqueda. |

Artefactos locales de ejecución final en `salida/resultados.json` y `salida/resultados/`; el focal completo GREEN permanece independiente en `backup-t3/focal-green/`. Capturas `pestana-320-0..6.png`, `cv-base-error-borrador-390-oscuro.png`, `importado-md/pdf-412-claro.png`, `importacion-error-320.png`, `cv-previa-390-oscuro.png` y `cv-print-A4.png` en los directorios de sus tests. No incluyo documentos personales ni datos reales.

## Diagnóstico acotado del ECONNRESET (sin corrección especulativa)

Inspeccioné el request exacto que falló (`busqueda-real.integracion.ts:260` → GET directo a `127.0.0.1:3057/__issue57/evidencia` con Authorization sintética), configuración Playwright (`retries: 0`, sin cabecera Connection ni agente custom) y servidor #57 (sin overrides de keep-alive). La API siguió atendiendo los casos posteriores; `api.log` no acredita una caída del proceso. El bundle **instalado** de Playwright1.64.1 crea un Agent `keepAlive: true` para APIRequestContext y `_sendRequestWithRetries` usa `maxRetries ??= 0`: no consulté documentación remota ni inferí comportamiento de otra versión.

Ejecuté **un solo probe**, no una suite ni un retry: `env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable node frontend/e2e/integracion/salida/probe-transporte.cjs`. Exit0; cuatro solicitudes, **4/4 HTTP200**, sin errores de socket, aproximadamente11.9s incluido arranque/cleanup. Artefactos ignorados: `salida/probe-transporte.cjs` y `salida/probe-transporte.json`. Reutiliza `iniciarApi(0)`, validación de base y esquema sintético, proveedor/red bloqueados; no modifica parámetros del servidor ni cliente. Instrumentación observacional de `http.request`, eventos connection/timeout/close y request.reusedSocket.

Observado sobre Node **v24.18.0** / Playwright **1.64.1**:

- Servidor: `keepAliveTimeout=5000`, `keepAliveTimeoutBuffer=1000`, `headersTimeout=60000`, `requestTimeout=300000`; anuncia `Connection: keep-alive`, `Keep-Alive: timeout=5`.
- Primeras dos solicitudes y una tras4500ms usan socket1 (reutilizado); respuestas200 y evidencia del mismo esquema validado.
- A6000ms inactivo se observa timeout del servidor y cierre limpio de socket1 (error=false).
- Tras6500ms el cliente abre socket2 nuevo (reutilizado=false), obtiene200 y cierra al dispose.

**Conclusión limitada:** no reproduje el ECONNRESET ni confirmé la hipótesis del idle keep-alive. El probe demuestra cierre/reapertura normales en esos puntos, no descarta una carrera justo en otro límite ni explica el fallo histórico. No agregué `Connection: close`, retries, tuning ni cambios al harness sin prueba causal. No repetí el caso390 ni la suite19 sin bytes funcionales nuevos. Mantengo **status parcial** por la validación global18/19; T3 propio6/6 y Angular/build anteriores conservan sus resultados. El padre decide el diagnóstico adicional y la verificación final independiente.

## Limitaciones que deben conservarse

La emulación Chromium no demuestra Android físico ni teclado virtual real. Un proveedor de identidad sintético no demuestra login Google real. No se verificó producción ni se solicitó una sesión Firebase. La inspección MCP debe distinguirse de Playwright Test. Solo se atribuirán resultados al árbol/commit realmente probado; el HEAD definitivo dependerá de CI. No se declara extracción PDF real cuando se simula ni creación de PDF por interceptar `window.print()`.
