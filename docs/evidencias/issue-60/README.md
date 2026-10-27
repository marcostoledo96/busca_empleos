# Issue #60 — Auditoría móvil: borrador incompleto

**NO aprobado para merge ni cierre de #60.** La entrega como PR **DRAFT** fue elegida explícitamente por el dueño después de observar una prueba global insuficiente. Quedan dos bloqueos:

1. **Integración: 18 PASS / 1 FAIL.** `ECONNRESET` al leer `/__issue57/evidencia` al final de `Angular → Express → SQL 390 oscuro`. Causa desconocida; un probe de transporte respondió 4/4, pero **no reprodujo ni resolvió** el fallo. No lo clasifico como ambiental demostrado.
2. **E2E sintético: 193 PASS / 29 FAIL.** Todos los fallos están en `preferencias.spec.ts` y `preferencias-harness.spec.ts`. El primer snapshot contiene la cabecera del fixture pero no el componente. Causa no diagnosticada; no afirmo que sea preexistente.

No agregué retries, SKIP ni aumentos de timeout para esconderlos. Referencia de entrega: **Refs #60**, no declaración de resolución. El historial de decisiones está en `odd/tasks/issue-60-e2e-funcional-mobile.md`.

## Candidato y atribución

- BASE: `71b81be75da247905ac4d613c49f98feb9ba6c7a`, `origin/master` confirmado al iniciar.
- Rama: `test/issue-60-e2e-funcional-mobile`.
- `ca1e26f61d264c2aa85489676acf0bdab3e67a32`: acceso, ofertas, seguimiento y selección ordenada.
- `3eae48754faa0c04b10a8123234f33f5f82252fa`: preservación de preferencias/CV y evidencia parcial; **no commit de finalización íntegra**.
- La integrada 18/19, focal CV 6/6, Angular 573 y build se ejecutaron sobre `ca1e26f` más cambios sin commit, posteriormente preservados en `3eae487`. No atribuyo retroactivamente esas ejecuciones al HEAD de publicación.
- Backend amplio, DB, #59 y E2E sintético se ejecutaron con HEAD `3eae487` y cambios documentales locales. Después sólo se consolidan evidencia y tareas; **CI del HEAD de publicación se informa separadamente en la PR**.

## Inventario previo a pruebas nuevas

| Funcionalidad | Pruebas existentes | Nivel | Positivo / negativo existente | Persistencia acreditada entonces | Brecha priorizada |
|---|---|---|---|---|---|
| Acceso/rutas | `app.routes.spec.ts`, `guards/auth.guard.ts` | Unitario/configuración | Rutas protegidas y borrador | No aplica | Login/navegación por guardas reales en navegador |
| Dashboard/búsqueda | `e2e/dashboard.spec.ts`, `controles.spec.ts` | UI sintética | Acciones, carga, temas / errores | No | No acreditar SQL con mocks |
| Avisos | `e2e/avisos-operativos.spec.ts` | UI sintética | Parcial/cancelación/recuperación / fallos | No | Reutilizar, no duplicar |
| Búsqueda/historial/ciclo | `e2e/integracion/busqueda-real.integracion.ts` | Angular→Express→PG | Buscar y terminales / fallo SQL, parcial | Sí | Añadir mutaciones y auth sin tercer harness |
| Listado | `e2e/tabla-ui.spec.ts` | UI sintética | Filtro, orden, selección, páginas / vacío/error | No | Selección efectiva cruzada con SQL |
| Detalle | `e2e/detalle-ui.spec.ts` | UI sintética | Matching, foco, fecha/nota / HTTP fallido y borrador | No | Guardar, recargar y leer SQL reales |
| IA | Controles, integración #57 y proveedores #59 | Mixto | Evaluar/reintentar / error/cancelación | Según prueba | Distinguir técnico, rechazo y resultado anterior |
| Preferencias | `e2e/preferencias.spec.ts`, `preferencias-harness.spec.ts` | HTTP simulado | Pestañas/edición/importación / fallo guardado | No | Preferencias y CV persistidos realmente |
| CV imprimible | `paginas/cv/cv.spec.ts` | Unitario/componente | Fuentes, vista, print / datos ausentes | No | Navegador, fuentes confirmadas y acción explícita |
| Automatización | Controles, avisos e integración #57 | Mixto | Progreso/terminal / error/recuperación | Historial integrado | Conservar cron inactivo |

El inventario lo realizó `gentle-ai-explore`, tarea `mvpn5j1w-1-l6oc`, antes de escribir pruebas; inicializó CodeGraph en el worktree. Describe cobertura de fuente, no PASS de ejecución.

## Matriz funcional observada

**PASS acotado no equivale a aprobación completa de la issue.** Las pruebas globales siguen FAIL.

| Recorrido | UI | Express real | PostgreSQL aislado real | Estado y límite |
|---|---|---|---|---|
| A — Acceso y navegación | Login, rutas, reload/back/logout, error y 401/403 | Sí, auth backend | Lectura y comparación sin mutación | PASS acotado; Firebase SDK/Admin sintéticos, no OAuth remoto |
| B — Buscar empleo | Configuración, fuente, buscar, carga, ciclo y recuperación | Sí | Ofertas, historial, terminales | **FAIL global**: una lectura de evidencia sufrió reset; otros recorridos pasan |
| C — Listado/detalle | Pestaña, filtro, orden, selección, modal y foco | Sí | Listado leído del servidor | PASS acotado; no toda combinación visual/estado |
| D — Seguimiento | Estado, fecha, dos revisiones de nota, recargas, errores y bulk | Sí | Escritura/SELECT y comparación de registros ajenos | PASS de recorridos concretos, no toda variante concurrente integrada |
| E — Evaluación | Individual/seleccionada, error/incompleta y recuperación | Sí; DeepSeek ficticio | Resultado/firma conservados y recuperados | PASS acotado; vigencia/presentación no exhaustivas |
| F — Preferencias/CV | Siete pestañas, borradores, importación/revisión, impresión | Sí | Preferencias/CV base guardados y recargados | Focal integrado **6/6 PASS**, pero **29 FAIL sintéticos**; no aprobación completa |
| G — Automatización | Estado, historial, progreso, ciclos terminales y fallos | Sí | Ejecuciones reales de test | PASS acotado; cron siempre inactivo |

### Persistencia concreta

- Seguimiento: `cv_enviado`, fecha `2026-01-15`, nota sintética de 1320 caracteres y segunda nota `Segunda revisión sintética confirmada`, después de recargar ambas veces; otra oferta intacta.
- Bulk: primer PATCH `[1,2]`; actualización parcial de ID1; reintento sólo `[2]`; otras **23 filas proyectadas** idénticas. No afirmo igualdad de columnas que la proyección no consulta.
- Preferencias: nombre sintético, término de búsqueda, plataforma/modelo; error SQL conserva datos y borrador, reintento y recarga muestran los valores guardados. Visitar siete pestañas **no demuestra editar todos sus controles**.
- CV base: escritura explícita, fallo SQL, borrador conservado, reintento, recarga y SELECT. Importar/analizar/aplicar no guarda automáticamente; sólo Guardar produce la persistencia comprobada.
- Búsqueda/evaluación/historial: se consulta el estado persistido y terminal. HTTP202 por sí solo no es PASS.

`resultados-integrados.json` conserva los resultados 18/19 y hashes de los adjuntos SQL, sin documentos ni rutas personales. Los adjuntos completos se generan en `frontend/e2e/integracion/salida/resultados.json`; el runner limpia su salida al iniciar otra ejecución.

## Pruebas agregadas frente a reutilizadas

- Reutilicé los dos harnesses, configuraciones, Express/PG/guardas #57, contratos #59 y preflight #61. **No creé otro harness, dependencia o job de CI.**
- Agregué diez recorridos en `recorridos-mobile.integracion.ts` y seis en `preferencias-cv.integracion.ts`.
- Conservé los tres recorridos de `busqueda-real.integracion.ts`; ajusté el selector del detalle al shell real y la ubicación dinámica del JS sin omitir diagnósticos de consola.
- Amplié fixtures/fallos sólo en helpers de prueba y agregué regresiones unitarias de protección de borradores. Las suites existentes se ejecutaron, no se duplicaron centenares de casos.

## Defectos y RED/GREEN

| Defecto reproducido | Corrección mínima | Evidencia |
|---|---|---|
| Selección masiva se vacía tras ordenar; no sale PATCH | `tabla-ofertas.ts`: usar `filteredValue → tabla.value → ofertas` para la página visible | RED del trace; focal 5/5 GREEN, integrada T2 13/13; bulk y reevaluación seleccionada conservan selección válida |
| Salida/cierre omite borradores de preferencias generales | Incluir `cambiosSinGuardar` además del CV base en guarda y beforeunload | Focal Angular RED 69 PASS/2 FAIL → GREEN 71/71; focal F 6/6 |

Los fallos de localizadores/arranque de pruebas no se presentan como RED de producto. El reset y los 29 fallos sintéticos siguen sin resolver. No se abrieron issues adicionales: permanecen vinculados al trabajo incompleto de #60, sin una causa nueva confirmada que atribuir a otro subsistema.

## Resultados de comandos

Los comandos SQL se ejecutaron con entorno limpio, sin DATABASE_URL ni credenciales externas.

| Comando | Exit / resultado | Tiempo observado |
|---|---|---|
| `npm --prefix backend test -- --runInBand` | 0; 2769 PASS, 159 skips existentes; 84 suites PASS, 10 skip | 31.979 s |
| `npm --prefix backend run test:integracion` | 0; 62 PASS, 7 skips existentes | 3.072 s |
| `npm --prefix backend run test:db` | 0; 211/211 | 11.274 s |
| `npm --prefix backend run test:issue57` | 0; 41/41 | 13.209 s, lote T3 |
| `npm --prefix backend run test:issue59` | 0; 2/2 | 4.333 s |
| `npm --prefix backend run test:issue61` | 0; 32/32 | 6.727 s, antes de focal T3 |
| `CHROME_BIN=/usr/bin/google-chrome npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` | 0; 573 PASS, 4 skips existentes | 39.725 s |
| `npm --prefix frontend run test:e2e` | **1; 193 PASS, 29 FAIL**, sin skips nuevos | 10 min 20 s de proceso |
| `npm --prefix frontend run test:e2e:integracion` | **1; 18 PASS, 1 FAIL**, sin retries/skips | 121.908 s |
| Integración focal `-- preferencias-cv.integracion.ts` | 0; 6/6 | 25.8 s |
| `npm --prefix frontend run build` | 0; warning existente `preferencias.css` +610 bytes | 4.873 s |
| `git diff --check` | 0 en consolidación documental; no sustituye pruebas funcionales | No medido |

No repetí suites completas sin cambios. No se alteraron scripts, jobs ni matriz CI. La integración pasó de **3 a 19 casos**; la ejecución actual costó unos 122 s y falló. No medí en este entorno el baseline de tres casos: **no atribuyo una diferencia exacta de CI**. La suite sintética fallida costó 10 min 20 s. CI remoto puede diferir y debe evaluarse por su SHA.

## Móvil, capturas e inspección MCP

| Viewport | Tema representativo MCP | Observación efectiva |
|---|---|---|
| 320×844 | Oscuro | Sin overflow; detalle dentro de x16–304; Escape cierra y devuelve foco a tarjeta |
| 360×800 | Claro | Geometría Dashboard sin overflow |
| 390×844 | Oscuro | Geometría Dashboard, navegación a Preferencias y CV sin overflow |
| 412×915 | Claro | Geometría Dashboard sin overflow |
| 768×900 | Oscuro | Geometría Dashboard sin overflow |
| 1440×900 | Claro | Geometría Dashboard sin overflow |

Estas seis mediciones **no son seis recorridos completos**. Fuente: [mcp-geometria.json](mcp-geometria.json), Chrome DevTools MCP contra la entrada local aislada de `3eae487`. También hice búsqueda sintética desde el botón real y observé dos ofertas, cron `false` y avisos plegados en una observación a320. El array vacío `technicalNotices` de la matriz **no es prueba de plegado**. No acredité completamente el overlay del selector: la consulta puntual devolvió lista vacía.

Capturas preservadas de **Playwright Test**, no MCP; proceden de la ejecución integrada anterior al commit `3eae487`:

- [Error visible 320 claro](capturas/test-error-320-claro.png).
- [Seguimiento 390 oscuro](capturas/test-seguimiento-390-oscuro.png).
- [Formulario después de importar PDF 412 claro](capturas/test-importacion-pdf-412-claro.png), no captura del parser en ejecución.
- [Vista previa para imprimir](capturas/test-cv-print-a4.png), **no página A4 renderizada ni PDF**. La prueba verifica CSS A4 y contraste.

Limitaciones MCP: Playwright MCP no inició por ENOENT en su directorio externo de artefactos; no lo creé ni reintenté. DevTools denegó guardar captura en el worktree por sus raíces configuradas; no evadí esa restricción. El resize de ventana daba ancho mínimo500: usé emulación y comprobé `innerWidth` real para cada medición. Hubo un404 de recurso no identificado en la consola; no atribuyo causa ni certifico consola limpia. Material Symbols no se carga en el index de integración (también en la base): aparecen nombres de iconos y algunas superposiciones. **Fidelidad visual productiva completa no acreditada.**

## Verificación independiente y brechas

- `gentle-ai-verify` **mvpveuyf-4-j8jq**: sobre `ca1e26f`, focal independiente 3/3, build0; baseline con tres RED y candidato con siete invariantes PASS reportados. Confirmó SQL real, selección y frontera auth. No aprobó toda A–G.
- Incidente de ese delegado: usó un scratch externo contra la instrucción del padre de mantenerlo dentro del proyecto. El padre no accedió, borró ni reutilizó esos archivos; sólo recibió su resultado. Se conserva esta desviación para auditoría.
- `gentle-ai-verify` **mvpxzxsg-8-coxx**: auditoría final **read-only de fuente/evidencia**, sin tests/build/probes ni scratch; revisó A–G, guardas, SQL, mocks y cuatro PNG. Dictamen: **apto sólo para DRAFT INCOMPLETO**, no merge/cierre. Ocurrió antes del resultado final de los 29 fallos sintéticos; no los diagnosticó ni invalida ese resultado.
- Brechas señaladas: siete pestañas no equivale a editar todos los campos; propuesta de modalidad del mock es una pregunta, no un valor factual conflictivo; edición general durante PUT no probada; cambio de oferta durante guardado sólo sintético; vigencia/criterios IA y overlays no exhaustivos. No se inventa PASS para ellas.

## Seguridad y límites finales

- PostgreSQL15 descartable, loopback55457, sin volúmenes ni copia de producción. #57 valida base/usuario/versión mediante consulta **antes de crear esquema**. Para `test:db` creé otra base sintética `busca_empleos_test` dentro del mismo contenedor y comprobé identidad antes del migrador existente.
- Firebase SDK/Admin, Apify, DeepSeek, correo y cron son dobles de prueba; transportes externos cerrados. Guardas, servicios/controladores/modelos y HTTP/SQL permanecen reales donde se declara integración. Rutas y auth de producción no se eliminaron.
- Lecturas HTTP429/503 del contenedor son inyecciones HTTP, no fallos SQL; guardado fallido sí usa triggers SQL BEFORE. Errores429/503 del proveedor Apify se traducen a502 por el contrato real.
- PDF válido/vacío/dañado: **pdf-parse real**, sin OCR. Exceso5MiB se rechaza en cliente, no prueba HTTP413. Análisis IA sintético no se guarda automáticamente.
- Print: una llamada explícita a `window.print()`, CSS/contraste; no archivo PDF, impresora física ni paginación real.
- SKIPPED: producción, Google OAuth/Firebase remoto, Android físico y teclado virtual. Sin sesión productiva; no se solicitaron contraseñas/cookies/tokens. Ninguna operación productiva, despliegue, cron o scraping pago.
- Skills efectivamente cargadas por padre/agentes: Gentle AI, branch-pr, Playwright best practices, Angular developer, systematic debugging, Node backend, PostgreSQL, ponytail y cognitive-doc-design. No se usaron skills Angular deprecadas ni Antigravity. MCP usados: GitHub para issue y Chrome DevTools para inspección. El explorer utilizó CodeGraph; no atribuyo a un MCP concreto su transporte. Playwright MCP sólo intentado e indisponible. Engram guarda tareas/decisiones.
- RDD `off` por `clone_local`, mantenido. ASSESS read-only pidió verificador independiente por riesgo de auth/borradores; no se inició revisión nativa ni se fabricó receipt.

**Siguiente paso de auditoría:** diagnosticar los29 fallos del fixture y el reset, acreditar globales verdes y completar brechas antes de considerar resolver #60. La publicación del borrador no satisface ese criterio.
