# Issue #60 — Evidencia funcional móvil

## Alcance y estado

BASE: `71b81be75da247905ac4d613c49f98feb9ba6c7a` (`origin/master`).
Rama: `test/issue-60-e2e-funcional-mobile`. Estado: integración T2 13/13 PASS sobre `d58efe8` + árbol sucio, sin commit de entrega. El diff-check global sigue pendiente por whitespace del documento ODD del padre, fuera de este lote. T3 y la verificación independiente de T4 siguen pendientes.
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
| F — Preferencias, importación y CV | Sólo navegación real | Sólo acceso | Sin nuevas mutaciones | T3 pendiente |
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

## Limitaciones que deben conservarse

La emulación Chromium no demuestra Android físico ni teclado virtual real. Un proveedor de identidad sintético no demuestra login Google real. No se verificó producción ni se solicitó una sesión Firebase. La inspección MCP debe distinguirse de Playwright Test. Solo se atribuirán resultados al árbol/commit realmente probado; el HEAD definitivo dependerá de CI. No se declara extracción PDF real cuando se simula ni creación de PDF por interceptar `window.print()`.
