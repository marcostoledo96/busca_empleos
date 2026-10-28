# Issue #60 — Auditoría móvil: borrador incompleto

## Corrección T9 — comentario PR-AUDIT-V1 (S22–S25)

**Correcciones T9 verificadas localmente; publicación y CI del nuevo candidato se informan en la PR.** Ejecuté sobre HEAD `91cd7b57efdc4d0b6c9909cae110a26bf8dc404a` + cambios sin commit, BASE `71b81be75da247905ac4d613c49f98feb9ba6c7a`. El árbol del HEAD es `adccbc4367cebebb43090a2824d18fdc181bb8e6`; **no** representa los cambios probados. El SHA-256 del diff de los ocho archivos funcionales/tests finales es `3c97b34ceb0291cb0b3fc1ed21c2539caa7fe24ff4618b63d61515709411d253`. Los hashes individuales y comandos están en [resultados-auditoria.json](resultados-auditoria.json). Después de las suites sólo agregué documentación de evidencia; no atribuyo estos resultados a un commit futuro ni al merge sintético de CI.

- **S23, S7/S8/S11:** protejo texto material, archivo seleccionado, análisis y decisiones de importación con la guarda existente y `beforeunload`. Cancelar la salida conserva texto/propuestas/decisiones; aceptar autoriza el descarte, sin PUT. Blanco, cancelado y aplicado+guardado no generan pendientes fantasma. Mantengo esta revisión separada del CV base y de las preferencias persistidas.
- **S24, S7/S11:** congelo el formulario enviado con copia profunda. Al resolver el PUT aplico normalizaciones del servidor sólo en campos no editados después del envío; conservo los posteriores y comparo contra el baseline realmente confirmado. Aviso: «Guardé las preferencias enviadas. Quedan cambios posteriores sin guardar.». El error conserva el borrador y no anuncia éxito.
- **S25/S12:** uso PrimeIcons instalado para los dos iconos del sidebar y Guardar (incluido su spinner), sin migrar otros iconos ni rediseñar. El navegador integrado, sin fuente Material remota y con monospace forzado, verifica textos sin ligaduras, iconos locales, menú/Escape, foco, geometría del topbar y logout. Revisé las capturas de 320 px: sidebar legible y Guardar sin texto `save`; esto no es una inspección MCP independiente.

| Verificación observada | Resultado | Evidencia local |
|---|---|---|
| Angular focal RED antes de producto | exit1, 4 FAIL / 71 PASS: respuesta tardía, beforeunload y dos salidas de importación | `salida/t9-unit-red.log` |
| E2E focal RED antes de producto | exit1, 6 FAIL / 1 PASS; iconos/save, dos importaciones y PUT200; PUT500 ya conservaba borrador | `salida/t9-e2e-red.log` |
| Identidad SQL read-only antes de escrituras | PG15.19, DB `busca_empleos_issue57_test`, usuario `busca_empleos_test`, localhost55457 | Salida de herramienta; guardas #57 reutilizadas |
| Preflight #61 read-only tras preparar esquema sintético con helper existente | exit0, `PREFLIGHT: OK`; instantáneas iguales antes/después | `salida/t9-preflight.log` |
| Angular focal GREEN | exit0, 75/75 PASS | `salida/t9-unit-green.log` |
| E2E focal GREEN | exit0, 7/7 PASS, 19.6 s | `salida/t9-e2e-green.log` |
| Angular completo | exit0, 577 PASS, 4 skips existentes; 33.234 s de navegador | `salida/t9-angular-full.log` |
| Integrado completo | exit0, 26/26 PASS, 2.2 min; Express+PG reales, llamadas externas simuladas | `salida/t9-integracion-full.log`, `salida/resultados.json` y adjuntos SQL |
| Build producción con red externa bloqueada por proxy loopback | **exit127, FAIL ambiental:** Angular intenta inlinear Google Fonts y recibe `ECONNREFUSED 127.0.0.1:9`; sin reintento ni cambio config | `salida/t9-build.log` |
| Build normal autorizado por el usuario después del bloqueo de red | **exit0**, bundle5.224s; warning CSS610bytes existente | `salida/t9-build-autorizado.log` |
| E2E sintético completo ejecutado por el padre | **exit0, 222/222 PASS**,7.5min | `salida/t9-sintetico-full.log` |
| `git diff --check` | exit0 | Salida de herramienta |

Las rutas `salida/` de la tabla corresponden a `frontend/e2e/integracion/salida/`. La prueba de PUT retiene la respuesta real de Express después de SQL, edita nuevamente y comprueba payload, UI, aviso, guarda, recarga, contador de PUT=1 y filas SQL. Para 500, SQL permanece igual; para 200, SQL contiene «Enviado T9», nunca la edición posterior. Importar/analizar/navegar no genera PUT y conserva preferencias/CV SQL; únicamente el análisis explícito aumenta la llamada IA simulada. Los recorridos existentes preservan guardas de preferencias generales/CV base, guardado ordinario e importación aplicada+guardada sin confirmaciones fantasma.

Capturas Playwright Test, tema oscuro, viewport 320×900, 360×900 y 1440×900: [sidebar320](capturas/issue60-audit-sidebar-320.png), [guardar320](capturas/issue60-audit-guardar-320.png), [sidebar360](capturas/issue60-audit-sidebar-360.png), [guardar360](capturas/issue60-audit-guardar-360.png), [sidebar1440](capturas/issue60-audit-sidebar-1440.png), [guardar1440](capturas/issue60-audit-guardar-1440.png). Los nuevos flujos de importación usan390×844 oscuro y PUT320×844 claro. No equivalen a Android físico ni a toda la matriz S12.

**Verificación independiente T10:** `gentle-ai-verify`, tarea `mvrf68e2-g-6llj`, inspeccionó fuente, logs, adjuntos SQL y cuatro PNG de320/1440, confirmó el hash del diff y no encontró defectos funcionales severos nuevos. No ejecutó pruebas, build, SQL ni navegador: su dictamen no es runtime propio. Baseline confirmado, copia profunda y reconciliación de objetos/listas revisados en fuente; mutaciones anidadas in-place no tienen una regresión específica observada, por lo que no invento cobertura.

**MCP real del padre:** [mcp-auditoria.json](mcp-auditoria.json). En320×844 oscuro, abrí sidebar con clic real: DASHBOARD/PREFERENCIAS sin ligaduras duplicadas, PrimeIcons local cargado, centros clicables. Escape cerró el overlay; Guardar mostró sólo «GUARDAR PREFERENCIAS», icono local,288×44px dentro del viewport y centro clicable. En1440×900 claro, Guardar196.51×44px visible/clicable; sin overflow en ambos. Pegué texto sintético de importación: salida hacia CV abrió confirmación; cancelar conservó texto y ruta; aceptar llevó a `/cv`. Peticiones MCP observadas sólo GET de preferencias/CV, **cero PUT**. El MCP no repitió SQL ni PUT retenido: eso pertenece a los26 integrados. Emulación verificó `innerWidth` real; el resize inicial solicitaba320 pero daba500 y no se acredita como320. Apertura inicial antes del arranque dio conexión rechazada; la inspección efectiva ocurrió tras servidor listo. No son seis recorridos ni Android físico; seis PNG del lote siguen siendo Playwright Test, no MCP.

**Límites S13/S17–S19:** el padre ejecutó el sintético completo una vez, con su writer heredado issue51; esas salidas locales se preservan sin stagear/borrar y no garantizo bytes anteriores. No repetí backend local ni `test:issue61` completo sin cambios backend: estados **NOT RUN en T9**, no traslado sus cantidades del CI anterior. Sí hubo identidad real PG y preflight read-only #61 con instantáneas iguales; no equivale a32/32. El build con proxy falló y queda registrado; tras autorización humana el build normal aprobó y confirmó warning610B. No modifiqué config, environments, dependencias, backend ni cron. Los servidores MCP propios17/18 y página23 se cerraron, PostgreSQL55457 permanece existente. OAuth real, Android físico y PDF físico **NOT RUN**.

**Desviaciones de herramientas:** Angular emitió diagnóstico automático fuera del repositorio durante el fallo de fuentes; verificador bash volcó automáticamente adjuntos base64 extensos a un temporal externo. No crearon scratch manual ni accedieron/modificaron esos temporales, y el padre no los leyó. No se presenta esa salida como evidencia portable. Los logs actuales, JSON y PNG referenciados están dentro del proyecto.

**Atribución CI S26:** la ejecución anterior40439909259 informó HEAD91cd7b5 pero su checkout real fue el merge sintético `refs/pull/68/merge` a`a860b32d15a731bd2093e4098685a77eef9c70cf`, combinando HEAD91cd7b5 y BASE71b81be; no un checkout directo del HEAD. Las pruebas locales de este lote corrieron sobre HEAD91cd7b5+diff identificado arriba; documentación posterior no cambia los ocho archivos probados. El resultado de CI anterior **no prueba este lote nuevo**. Su commit, comentario de avance/final y CI nuevo observado se registran en la misma PR68, sin watcher, merge/cierre ni deploy.

## Corrección T7 — pedido S21

**Sin aprobación de merge/cierre ni atribución a un commit futuro.** Verifiqué el árbol con HEAD `cb6c111e61d22464daac97e8495d9e4dbc1569c1` más cambios sin commit. La evidencia anterior queda abajo como histórico; las suites completas siguientes se ejecutaron **antes del ajuste pasivo de ruta de salida** descrito a continuación, con los mismos bytes funcionales y de tests que el candidato final:

| Comprobación actual | Resultado observado | Tiempo |
|---|---|---|
| Preflight #61 con entorno SQL limpio | 32/32 PASS, exit0 antes de nuevos flujos integrados | 8.309 s |
| E2E sintético completo, una pasada | 222/222 PASS, exit0 | 6.7 min |
| Integración completa, una pasada | 22/22 PASS, exit0; 19 existentes + 3 regresiones | 132.146 s |
| Angular ChromeHeadless | 573 PASS, 4 skips existentes, exit0 | 38.569 s |
| Build | exit0; warning `preferencias.css` +610 bytes | 4.581 s |
| `git diff --check` | exit0 | No medido |

**Ajuste final de contrato de artefactos:** restauré únicamente `outputDir: './test-results'` en `frontend/playwright.config.ts`, compatible con la carga existente de CI desde `frontend/test-results/`; mantuve `reuseExistingServer: false` y no modifiqué el workflow. La ruta intermedia `frontend/e2e/integracion/salida/sintetico/` corresponde a las ejecuciones previas, no al candidato final. Con la configuración final ejecuté **una sola** prueba representativa: `npm --prefix frontend run test:e2e -- --grep 'cargo Preferencias reales'`, exit0, **1/1 PASS en9.3s** (caso3.4s), con instrumentación de montaje y servidor propio. No repetí222/22, Angular ni build por esta modificación pasiva: sus resultados anteriores siguen atribuidos al mismo código funcional/tests, no a una ejecución global de la configuración final. Los hashes previos y finales se distinguen en `resultados-correccion.json`; HEAD continúa `cb6c111` con cambios sin commit. No limpié ni borré manualmente artefactos.

**Causa reproducida y corregida:** el topbar dependía de Material Symbols remoto, ausente en el index aislado. Los textos `light_mode`/`settings` salían de sus botones; el ancho mínimo flex del título y el menú desplazaba logout a x335.75–379.75 en360px. Reproduje sin fuente con monospace: tres RED por iconos fuera de límites, incluido desktop. Usé PrimeIcons ya instalado para los cuatro iconos superiores y acoté el flex/espaciado móvil; no oculté controles ni alteré guardas/auth. GREEN3/3 a320/360/1440: botones44px, iconos contenidos, centro `elementFromPoint` dentro del botón, título sin solapamiento, Tab/Shift+Tab, cambio de tema y logout real. El recorrido A360 original también pasó. La primera pasada posterior al fix detectó un literal incorrecto del test (`Preferencias` vs `PREFERENCIAS`); corregí ese literal, no producto para acomodarlo.

**Preferencias: no reproducido, no causa histórica confirmada.** Antes de tocar producto, ejecuté un caso representativo instrumentando pageerror, consola, scripts y requestfailed: PASS, cero errores JS/peticiones fallidas, imports/componentes HTTP200. Después pasaron los30 casos focales y los222 globales. `reuseExistingServer=false` exige arrancar el harness propio y evita reutilización ambigua; no demuestra que antes hubiera un servidor ajeno, caché corrupta o excepción. No modifiqué `main.ts`, router ni proveedores de Preferencias.

**Reset SQL: no reproducido, no arreglo especulativo.** Ejecuté el recorrido real390oscuro con instrumentación temporal de socket/HTTP/proceso/SQL en el mismo harness: PASS16.5s, mismo PID390273, ocho lecturas de evidencia HTTP200 contando el recorrido A posterior, 75 respuestas terminadas y204 operacionesSQL. Hubo un timeout normal de socket idle seguido por reconexión; ningún socket-error/ECONNRESET/uncaught registrado. Los errores SQL P0001/42703 pertenecen a los fallos deliberados de ese recorrido. No capturé el cierre final del proceso. Retiré la instrumentación de arranque antes de la suite final; no cambié keepalive, aislamiento de transporte, reintentos ni timeouts. La suite final también pasó390oscuro.

Detalles, comandos completos, hashes de fuente y resultados por caso: [resultados-correccion.json](resultados-correccion.json). Logs/probe locales: `frontend/e2e/integracion/salida/issue60-correccion-*.log`, `issue60-lifecycle.ndjson`; salidas anteriores preservadas en `salida/backup-correccion/`. Capturas nuevas de Playwright Test: [320](capturas/issue60-fix-shell-320.png), [360](capturas/issue60-fix-shell-360.png), [desktop](capturas/issue60-fix-shell-1440.png). Muestran el shell en claro después del cambio de tema por clic, con foco sobre Configuración. No son inspección MCP ni Android físico. Los iconos restantes fuera del topbar todavía pueden mostrar ligaduras sin Material Symbols; no acredito fidelidad completa del sitio.

**Desviación de preservación:** la suite sintética existente `detalle-capturas.spec.ts` exporta con rutas fijas a `frontend/.angular/issue51-historico/detalle/despues/` y `docs/evidencias/issue-51/B01/detalle/despues/`, independientemente de `outputDir`. No lo detecté antes de ejecutar el comando completo autorizado: regeneró esas salidas preexistentes fuera del área delegada. Lo informé al padre; no borré ni intenté restaurar archivos ajenos. No garantizo preservación byte a byte de esos artefactos. Las salidas propias nuevas sí están en las rutas autorizadas.

Cobertura de este lote: S2/S7/S11–S12 mediante suites existentes y regresión de shell; S13 con capturas y límite explícito de emulación; S14–S15 con guardas #57, SQL15 aislado validado antes de fixtures y preflight #61; S16 con RED/GREEN mínimo; S17 con los comandos delegados aplicables; S21 con diagnóstico de las tres clases y suites verdes, **sin afirmar que los dos fallos históricos no reproducidos estén causalmente resueltos**. Sin backend modificado, no correspondió repetir #57. Los bytes funcionales y de tests se preservaron en `ba636cf2c8b5729b9be777d97d6e06b2fef9afd4` (tree `2e91b802c8309c40b46a7e40f0319deb401aa51f`); eso no cambia retrospectivamente el HEAD de ejecución descrito arriba. `gentle-ai-verify`, tarea `mvq122tm-c-xfa2`, revisó fuente, logs y las tres capturas de este candidato sin ejecutar pruebas ni hacer escrituras: no encontró blockers nuevos y lo consideró publicable en la misma PR DRAFT, sin declarar causalmente resueltos los fallos históricos. La inspección posterior del padre con **Chrome DevTools MCP** sobre ese commit comprobó los cuatro controles de44×44, límites y centro de clic en320/360/390/412/768; en1440 hay tres controles visibles porque el hamburger se oculta según contrato. Sin overflow en los seis anchos, temas alternados; clic normal en logout360 llegó a `/login` con `Authentication`. Datos exactos en [mcp-correccion.json](mcp-correccion.json). Son mediciones y un recorrido concreto, no seis recorridos completos ni Android físico. La publicación y el CI del nuevo HEAD siguen pendientes y se informarán en la PR sin reutilizar el resultado fallido anterior.

## Histórico previo a T7

**La entrega histórica NO estaba aprobada para merge ni cierre de #60.** La PR **DRAFT** fue elegida explícitamente por el dueño después de observar una prueba global insuficiente. En ese momento quedaban dos bloqueos:

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

**Siguiente paso histórico de auditoría (previo a T7):** diagnosticar los29 fallos del fixture y el reset, acreditar globales verdes y completar brechas antes de considerar resolver #60. La publicación del borrador no satisfacía ese criterio. Los resultados y límites actuales están en la sección T7 al inicio.
