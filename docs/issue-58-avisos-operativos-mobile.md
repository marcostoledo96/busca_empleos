# Issue #58 — Avisos operativos y experiencia móvil

## Alcance verificado

Trabajo sobre la base `39bfed2ccbe56c2857ab28332b7982909ef8d6b5`, en el worktree
`busca_empleos-issue-58`. Este informe registra la candidata verificada; el HEAD exacto y el CI se fijan en la PR de entrega. La revisión independiente y la integración sintética finalizaron satisfactoriamente. No certifico producción.

Conservo The Silent Processor, los componentes, los `details` nativos y los estilos
existentes. No cambio contratos, polling, scrapers, preferencias ni proveedores.

## Auditoría y correcciones

| Criterio | Estado y evidencia |
| --- | --- |
| S1 | Audito antes de implementar. Reproduzco cuatro regresiones unitarias y capturo el baseline antes de cambiar comportamiento. No reimplemento desplegables. |
| S2 | Quito los errores de ejecución del listado informativo. Agrupo avisos por fuente, sin fusionar diagnósticos de consultas o ejecuciones distintas. Conservo los tres snapshots técnicos, aunque difieran. Los avisos empiezan cerrados. |
| S3 | Distingo sin ejecuciones, en curso y resultado anterior conservado. Mantengo los estados terminales completada, parcial, error y cancelada. Un HTTP 202 conserva el seguimiento activo; no representa éxito terminal. |
| S4 | Muestro causa, conservación de datos y REINTENTAR fuera de los detalles cuando fallan sincronización y alternativa. Una alternativa exitosa informa recuperación mediante `status`, no un bloqueo nuevo. La siguiente sincronización exitosa elimina la causa obsoleta. |
| S5 | Mantengo marca, estilos, bibliotecas y fuentes inactivas. Cuento fuentes configuradas desde la respuesta y omisiones sólo desde `motivoOmision` del snapshot; no infiero operatividad. `sin_resultados` no genera error. |
| S6 | Verifico Chromium a 320×844, 360×800, 390×844, 768×900 y 1440×900. Uso claro en 320/390/1440 y oscuro en 360/768. |
| S7 | Cubro los catorce escenarios enumerados debajo, además de cancelación, ausencia de ejecuciones, aceptación 202 y alternativa exitosa. |
| S8 | Verifico detalles inicialmente cerrados, apertura/cierre, Tab/Shift+Tab/Enter, foco visible, controles de 44 px, límites de texto renderizado, mensajes sin espacios, toast íntegro y ausencia de overflow horizontal. Consultar información no produce POST/PATCH. |
| S9 | Reproduzco mensajes vigentes del backend local. No conservo el ejemplo obsoleto de categoría `it`: Remotive informa categorías incompatibles según el término. No pruebo conectividad de proveedores. |
| S10 | Utilizo interceptores sintéticos y bloqueo solicitudes del navegador fuera del servidor local. No inicializo Firebase ni ejecuto scraping, IA, correo, cron, migraciones o conexiones productivas. |
| S11 | Candidata final: 571 tests Angular aprobados y 4 omisiones previas; 222 E2E aprobados, build aprobado y 3 E2E de integración #57 aprobados después de la autorización humana acotada. |
| S12 | Limito los cambios productivos a presentación de PanelControl y al defecto concreto de Dashboard. No necesito cambiar CSS: geometría, foco, objetivos táctiles y toast ya estaban resueltos. |
| S13 | Verificación independiente aprobada: 110 Angular y 20 E2E propios; 12 hashes de fuente intactos. Capturas ANTES/DESPUÉS adjuntas en docs/evidencias/issue-58 y conclusiones guardadas en Engram. |
| S14 | No hago commits, push, PR, merge, cierre ni deploy desde este actor; corresponde a T3. |
| S15 | Entrego evidencia de implementación y límites. BASE/HEAD definitivo, CI y recomendación de cierre requieren la verificación y entrega del orquestador. |

Ya estaban resueltos los detalles inicialmente plegados, su teclado/foco, el
layout responsive, el tamaño táctil y el ancho del toast. Los verifico y los
conservo. Los defectos nuevos eran la repetición de errores en avisos, la pérdida
de contexto por deduplicar strings, el resumen antiguo mostrado como ciclo actual
y la recuperación alternativa presentada como sincronización bloqueante sin causa.

Para errores de una fuente parcial uso `status`: hay resultados aprovechables.
Para errores, timeout o interrupción bloqueantes uso `alert`. El contexto diferencia
búsqueda individual, ciclo y ciclo anterior conservado, incluye `run_id` cuando
existe y conserva cada consulta. Los diagnósticos históricos siguen disponibles en
Resultados e historial, sin convertirlos en un fallo nuevo del servicio.

## Escenarios y fixtures

`frontend/e2e/fixtures/issue-58.ts` amplía el interceptor existente; las rutas no
previstas siguen fallando, nunca se envían a la API real. Las pruebas registran
método/ruta y preservan los fixtures y regresiones existentes.

| Escenario S7 | Parámetro sintético `issue58` |
| --- | --- |
| Aplicación sin errores | `normal` |
| Todas las fuentes con avisos | `advertencias` |
| GetOnBrd deshabilitado | `getonbrd` |
| Historial HTTP 503 | `historial` |
| Sincronización HTTP 500 | `sincronizacion` |
| Resultado parcial | `parcial` |
| Ciclo fallido | `fallido` |
| Búsqueda en curso y resultado anterior | `en-curso` |
| Recuperación después del error | `recuperacion` |
| Configuración no disponible | `configuracion` |
| Historial anterior conservado | `conservado` |
| Fuente inactiva | `inactiva` |
| Mensajes extensos sin espacios | `extenso` |
| Múltiples avisos de una fuente | `multiples` |

Los avisos reproducen ubicación fija para Computrabajo, Indeed, Bumeran, Glassdoor
y Adzuna; límite no configurable de Bumeran; límite estricto de Jooble; categorías
y etiquetas incompatibles de Remotive/RemoteOK; flag de GetOnBrd; costo de Google
Jobs y suspensión de InfoJobs. Verifico estos textos contra
`backend/src/servicios/servicio-configuracion-busqueda.js`,
`servicio-traductor-consultas.js` y `backend/src/config/plataformas.js`, sólo mediante
lectura. No habilito fuentes para silenciarlos.

## Comandos y resultados observados

Ejecuto desde `frontend/`, en primer plano, con `TMPDIR=.angular/issue58` y
`NG_CLI_ANALYTICS=false`. El TMPDIR heredado causaba inicialmente un socket de
Chrome demasiado largo; la ruta relativa local permite ejecutar Chromium sin
cambiar launchers ni políticas. Los entornos ignorados contienen únicamente
configuración pública ficticia. El URL base de desarrollo conserva
`http://localhost:3000/api`, requerido literalmente por pruebas existentes y
siempre interceptado en estos recorridos. El build usa un URL local sintético.

| Comando | Resultado final | Log local en `frontend/.angular/issue58/` |
| --- | --- | --- |
| `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/componentes/panel-control/panel-control.spec.ts --include=src/app/paginas/dashboard/dashboard.spec.ts` | 108 PASS | `unit-green-entrega.log` |
| `npm test -- --watch=false --browsers=ChromeHeadless` | 569 PASS; 4 omisiones preexistentes | `unit-full-entrega.log` |
| `npm run test:e2e -- e2e/avisos-operativos.spec.ts` | 20 PASS | `browser-green.log` |
| `npm run test:e2e -- e2e/avisos-operativos.spec.ts e2e/dashboard.spec.ts` | 31 PASS | `browser-green-final.log` |
| `npm run test:e2e` | 222 PASS | `e2e-full-entrega.log` |
| `npm run build` | PASS; advertencia de presupuesto en Preferencias: 15,61 kB frente a 15 kB | `build-entrega.log` |

No oculto intentos fallidos: `unit-red-confirmado.log` muestra los cuatro RED
esperados (101 PASS); `conteos-red.log`, el RED de conteos (87 PASS).
`browser-red.log` registra 10 PASS/10 FAIL en baseline: seis detectaron los
comportamientos pendientes y cuatro señalaron un locator de botón desktop oculto
a 320 px, corregido con `includeHidden` sin cambiar comportamiento productivo.
La primera suite Angular completa detectó el URL sintético incompatible y la
pérdida de la descripción accesible de GetOnBrd; corrijo ambos, no sus tests.
La primera suite E2E completa dio 219 PASS/3 FAIL: conservo el texto previo
`Estado de sincronización: fallida.` y diferencio el contexto `Ciclo` del rótulo
`Último ciclo`, manteniendo todas las assertions existentes. Los logs de esos
intentos son `unit-full.log` y `e2e-full.log`.

### Límite inicial de integración #57 — resuelto mediante autorización acotada

Inicialmente no ejecuté `npm run test:e2e:integracion`: su `playwright.integracion.config.ts`
inicia `servidor.cjs api`, que llama a `backend/scripts/test-issue-57.js --api`.
Éste invoca `prepararBase()` de `backend/tests/helpers/issue-57-entorno.js`, que
crea un esquema, ejecuta SQL de inicialización y la migración
`024-resultados-fuentes.sql`. Eso incumpliría la prohibición de migraciones,
aunque la base sea sintética. No reescribo su setup ni repito suites PostgreSQL.

La alternativa factible sin migraciones es el recorrido Angular/HTTP existente
`busquedas-flujo.spec.ts`/`busquedas-vertical.spec.ts`, incluido en la suite Angular,
y los E2E `controles.spec.ts`, `dashboard.spec.ts` y `avisos-operativos.spec.ts`,
incluidos en los 222 PASS. No lo presento como equivalente a una integración real
con PostgreSQL. El usuario resolvió este límite autorizando posteriormente sólo la preparación y las migraciones del entorno sintético validado. El resultado final se documenta abajo; la alternativa sintética no se presenta como equivalente a PostgreSQL.

## Evidencia visual ANTES/DESPUÉS

Las capturas son artefactos locales de verificación, en `frontend/.angular/issue58/`;
no deben agregarse al staging automáticamente. Parte de `.angular/` aparece como
untracked en este worktree, por lo que el orquestador debe excluirla explícitamente. Cada par usa la misma escena,
viewport y fixture. No uso capturas tomadas después de corregir como baseline.

- `antes-sincronizacion-320.png` / `despues-sincronizacion-320.png`: antes sólo
  aparece el estado fallido; después quedan visibles la causa y REINTENTAR sin
  abrir Detalle de sincronización. Conservo las ofertas anteriores en ambos.
- `antes-parcial-320.png` / `despues-parcial-320.png`: mantengo el parcial visible,
  sin repetir sus errores dentro de avisos informativos.
- `antes-en-curso-320.png` / `despues-en-curso-320.png`: el baseline etiqueta el
  resultado previo como último ciclo completado; después distingo En curso y
  Resultado anterior conservado. El overlay de progreso permanece intacto.
- `antes-avisos-{ancho}-{tema}.png` / `despues-avisos-{ancho}-{tema}.png`: agrupo
  la lectura por fuente conservando advertencias y textos sin espacios.
- `antes-toast-{ancho}-{tema}.png` / `despues-toast-{ancho}-{tema}.png`: conservo
  texto completo y límites existentes; no fue necesaria una nueva corrección CSS.

Los pares de matriz son `320-claro`, `360-oscuro`, `390-claro`, `768-oscuro` y
`1440-claro`. También capturo los catorce escenarios a 320 px con detalles cerrados.
Las assertions comprueban límites de los elementos y fragmentos renderizados,
scrollWidth/clientWidth, scrollHeight/clientHeight y ausencia de ellipsis/clamp:
no alcanza con encontrar el texto en el DOM. Comparo visualmente muestras de
sincronización, curso, toast y avisos oscuros; la matriz completa tiene medición
automatizada, no una auditoría visual humana de cada píxel.

## Corrección focal B1 — representaciones agregadas y por consulta

La verificación independiente encontró una omisión de S2/S8: el productor
`backend/src/utils/ejecucion-fuente.js` agrega el mismo evento tanto a
`fuente.errores` como a `resultadosConsultas[].errores`. Mi fixture inicial no
reproducía esa forma, por lo que el primer GREEN no probaba ese caso real.

Corrijo exclusivamente esa duplicación dentro de cada resultado de fuente:
identifico el evento por tipo, mensaje, código HTTP y consulta, y consumo una sola
representación agregada por cada evento de consulta. No deduplico entre runs ni
por plataforma/texto. Conservo repeticiones presentes sólo en la fuente. Si un
error global sin `consulta` aparece también en todas las consultas, como hace
Apify, mantengo el número de eventos globales y agrego sus consultas afectadas,
sin presentarlo como un fallo independiente de cada consulta. No modifico los arrays
recibidos ni cambio contratos o backend.

Agrego dos pruebas Angular con copias deserializadas de la forma real: dos
HTTP 503 Angular/React reflejados en la fuente y dos errores globales idénticos
conservados; y un error global de Actor reflejado en ambas consultas. El escenario
E2E `multiples` ahora refleja los eventos de consulta también en `fuente.errores`;
conservo su assertion de exactamente dos mensajes y ambas etiquetas, sin relajarla.
La prueba previa de ejecuciones distintas continúa pasando.

Resultados de esta corrección, con logs en `frontend/.angular/issue58/`:

| Verificación | Resultado | Log |
| --- | --- | --- |
| RED Angular focal, mismo comando panel-control + dashboard indicado arriba | 2 FAIL/108 PASS; observa 4 en vez de 2 y 3 en vez de 1 | `B1-unit-red.log` |
| RED `npm run test:e2e -- e2e/avisos-operativos.spec.ts` | 1 FAIL/19 PASS; múltiples recibe 4, espera 2 | `B1-browser-red.log` |
| GREEN Angular focal panel-control + dashboard | 110 PASS | `B1-unit-green.log` |
| GREEN `npm run test:e2e -- e2e/avisos-operativos.spec.ts` | 20 PASS | `B1-browser-green.log` |
| `npm test -- --watch=false --browsers=ChromeHeadless` | 571 PASS, 4 omisiones preexistentes | `B1-unit-full.log` |
| `npm run test:e2e` | 222 PASS | `B1-e2e-full.log` |
| `npm run build` | PASS; misma advertencia de presupuesto de Preferencias | `B1-build.log` |
| `git diff --check` | PASS | Salida vacía |

Ejecuto cada suite completa y build una vez después de los focales verdes, sin
reintentos por cuota y sin usar `/tmp`. Conservo TMPDIR relativo local. La nueva
autorización humana L8 permite preparación/migraciones sólo para la integración
#57 aislada y validada; la limitación anterior describe T1 antes de esa excepción.
No ejecuto esa integración en esta corrección: el orquestador la realiza después,
junto con el recheck independiente acotado a B1. No afirmo que esos checks estén
aprobados todavía.

## Artefactos generados y alcance de entrega

`git diff --check` pasa después de los cambios y de esta documentación.
La suite E2E existente también genera cinco artefactos sintéticos no rastreados en
`docs/evidencias/issue-51/B01/detalle/despues/` (cuatro PNG y `matriz.json`).
Ese destino no figuraba entre las superficies adicionales de salida; lo detecto al
inspeccionar el estado final, lo informo y no elimino ni muevo sus archivos. No
modifiqué el código de esas pruebas para desviar sus salidas.

Los resultados finales de la revisión independiente y la evidencia durable se registran debajo. El HEAD y el CI exactos se publican en la PR; no hago merge ni cierro la issue.
No inspecciono producción ni afirmo disponibilidad real de proveedores.


## Cierre de verificación de la candidata

La verificación independiente encontró B1 y aprobó su corrección en un recheck
acotado: **110 tests Angular y 20 E2E propios, ambos EXIT0**. Incluyen los catorce
escenarios, cinco viewports, temas representativos, teclado, foco, controles
táctiles, ausencia de POST/PATCH al consultar, preservación de historial,
recuperación y geometría completa del toast. Los 12 archivos controlados por
SHA256 no cambiaron durante esa verificación. No quedan bloqueantes de B1.

El primer intento independiente no ejecutó la suite: falló con cuota de escritura,
EXIT134. No lo contabilizo como PASS. Después de la autorización humana, eliminé
sólo la copia temporal duplicada autorizada y la prueba nueva dentro del worktree
pasó. Otros temporales no se eliminaron ni se incorporan a la entrega.

### Integración real de #57

Después de la excepción humana explícita comprobé:
contenedor PostgreSQL 15 local en 127.0.0.1:55457, base
`busca_empleos_issue57_test` y usuario `busca_empleos_test`.
Ejecuté con entorno vacío y únicamente las variables sintéticas exigidas por
`validarEntorno`, sin heredar DATABASE_URL ni credenciales de servicios.

`npm run test:e2e:integracion`: **3 aprobados; 0 inesperados, omitidos o flaky**.
Recorridos 1440 claro, 390 oscuro y 320 claro, con Angular, Express y PostgreSQL
reales; proveedores y Firebase son sintéticos. El runner preparó exclusivamente
su esquema de prueba. Los errores de historial/columna ausente de su log forman
parte del escenario deliberado de esquema antiguo; los tests comprueban la
recuperación posterior. Los puertos efímeros 3057/4357 quedaron libres.
No repito las suites completas de PostgreSQL, ya que no modifiqué backend ni SQL.

### Inspección renderizada con Playwright MCP

Confirmé causa y REINTENTAR visibles fuera de details a 320; dos eventos
Angular/React a 360 oscuro; recuperación sin alerta anterior a 390; y vía
alternativa informativa sin bloqueo falso a 1440. Abrir/cerrar avisos con Enter
preserva el foco y no hace POST/PATCH. La medición inicial de apertura inmediata
se corrigió esperando el cambio real del atributo open; no era una falla de UI.
El primer script de inspección usó URL, no disponible en el sandbox MCP; corregí
el predicado del bloqueo de red antes del recorrido. No cuento ese error como
verificación exitosa.

| Toast | Límites horizontales medidos | Texto |
| --- | --- | --- |
| 320 | 16–296 px | 617 caracteres; fragmentos dentro del viewport |
| 390 oscuro | 16–366,4 px | Íntegro, sin recorte |
| 1440 | 1016–1416 px; ancho 400 px | Íntegro, sin recorte |

Los errores de consola de los escenarios degradados son los HTTP sintéticos
intencionales. No observé excepciones JavaScript nuevas en el recorrido.
Cerré mi pestaña y detuve únicamente el servidor local de inspección.

### Capturas durables para auditoría

Cada vínculo conserva la misma escena antes/después; los originales se tomaron
antes de implementar, no reconstruí el baseline después del arreglo.

| Escena | ANTES | DESPUÉS |
| --- | --- | --- |
| Falla de sincronización, 320 | [Captura](evidencias/issue-58/antes-sincronizacion-320.png) | [Captura](evidencias/issue-58/despues-sincronizacion-320.png) |
| Ciclo en curso, 320 | [Captura](evidencias/issue-58/antes-en-curso-320.png) | [Captura](evidencias/issue-58/despues-en-curso-320.png) |
| Resultado parcial, 320 | [Captura](evidencias/issue-58/antes-parcial-320.png) | [Captura](evidencias/issue-58/despues-parcial-320.png) |
| Avisos agrupados, 360 oscuro | [Captura](evidencias/issue-58/antes-avisos-360-oscuro.png) | [Captura](evidencias/issue-58/despues-avisos-360-oscuro.png) |
| Regresión toast, 360 oscuro | [Captura](evidencias/issue-58/antes-toast-360-oscuro.png) | [Captura](evidencias/issue-58/despues-toast-360-oscuro.png) |

### Aceptación de #58

| Criterio literal de la issue | Estado |
| --- | --- |
| Desde celular se distingue enseguida «buscar funciona» / «buscar falla» y el motivo práctico. | Verificado en escenarios sintéticos; no afirmo disponibilidad productiva. |
| Advertencias normales colapsadas a demanda, no decenas de alertas abiertas. | PASS. |
| Críticos visibles, accesibles y sin duplicaciones confusas. | PASS, incluido B1 corregido y revalidado independientemente. |
| No eliminar límites/validaciones ni habilitar GetOnBrd o proveedores inactivos. | PASS; no cambio backend, contratos ni configuración de proveedores. |
| Screenshot ANTES/DESPUÉS, E2E Chromium móvil/desktop, tests Angular y build. | PASS, resultados finales y capturas vinculados arriba. |
| Cambios solo UI/normalización visual salvo bug demostrado; no backend/DB, no deploy, PR independiente sin merge. | PASS del alcance; entrega por una única PR a master sin merge. La preparación SQL ocurrió sólo en el entorno sintético autorizado. |

**Riesgo:** la presentación comparte errores y estados de búsquedas existentes;
lo cubren las regresiones y el E2E integrado, pero no certifican APIs externas,
Firebase real ni funcionamiento productivo. RDD permanece desactivado por
configuración del clon; no generé una aprobación nativa ficticia.
