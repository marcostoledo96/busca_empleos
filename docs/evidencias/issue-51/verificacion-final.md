# Issue #51 — Verificación independiente y recorrido MCP

## Identidad del candidato y pruebas

- Base integrada: `bd12660c263ef55bd61486b179fc19ce787d0e66` (PR #52, #53 y #54 incluidas).
- Fuente productiva verificada: `d817b148e02aab68f7506384e61f8a0842bc934d`.
- La corrección posterior B1 sólo agrega attachments/guards a tres specs E2E; no cambia `frontend/src`, backend, dependencias ni workflow.
- El manifiesto `fuentes-verificadas.sha256` identifica los diez archivos exactos. Angular completo observado por el padre: 561 aprobados, cuatro omisiones verticales heredadas. Build del worker: exit0, warning de Preferencias sin cambios (15.61kB/15kB). No atribuyo ese build a una repetición sobre un SHA futuro.
- Tras B1: RED de un caso por attachments vacíos, GREEN1/1 y suite Playwright completa198/198, sin omisiones ni retries. Localmente no repito Angular/build tras cambios exclusivos en artifacts; el CI de entrega comprueba el HEAD publicado.
- `git diff --check` y diez hashes: exit0.

## Revisión independiente

`gentle-ai-verify` (`mvfgbhh0-6-tku9`) inspeccionó el diff contra la base, funciones conectadas e imágenes históricas/antes/después. Ejecutó26/26 E2E,58 probes de estados,24 de selección y diez combinaciones responsive con controles reales. Confirmó preservación de #21, límites200/recencia, payload visible, confirmaciones, bloqueos, reintento, estados IA distintos de postulación y foco/teclado. No encontró un defecto funcional nuevo del listado.

Único bloqueo: B1, los PNG no estaban dentro de las rutas del upload existente. `gentle-ai-worker` lo corrigió con la interfaz pública `testInfo.attach`, sin combinaciones nuevas ni relajar assertions. Recheck independiente `mvfh2c8s-8-6jn4`: **PASS**. Observó116/116 PNG válidos y SHA256 idéntico al original:10 tabla,12 dashboard,4 fallback320 y90 detalle; todos dentro de `frontend/test-results/`. El workflow existente cubre esa ruta. Este recheck no afirma que GitHub Actions ya haya corrido: su estado se informa por separado en la PR.

El primer lanzamiento independiente anterior no produjo veredicto: Pi falló al escribir, errno-122. Se diagnosticó el tmpfs separado de `/tmp`, se limpió con autorización y exclusiones de sesiones activas, y Marcos autorizó continuar antes del nuevo lanzamiento. No se ocultó una revisión fallida como PASS.

## MCP realmente ejecutados

### Playwright MCP

Angular real local, harness existente `?tabla=1`, HTTP simulado; no Firebase, scrapers ni DeepSeek. Matriz focal con oferta de título/empresa sin espacios, y un recorrido separado con `Angular junior 01`:

| Viewport | Claro | Oscuro | Overflow global | Selección móvil |
|---|---|---|---|---|
|1440×900|PASS|PASS|No|No aplica|
|1024×768|PASS|PASS|No; tabla interna931px/scroll1180px|No aplica|
|768×900|PASS|PASS|No|44×44px|
|390×844|PASS|PASS|No|44×44px|
|320×844|PASS|PASS|No|44×44px|

En esta sesión MCP el área de documento mide cuatro píxeles menos que el viewport nominal (scrollbar), condición ya declarada en las capturas iniciales. Los E2E reproducibles tienen sus capturas de ancho exacto; no mezclo ambas metodologías como pares equivalentes.

Recorrido escritorio: Dashboard → plataforma LinkedIn → pestaña Rechazadas → Aprobadas → búsqueda → selección visible de una oferta → botón de detalle → Escape → foco devuelto al mismo botón. Registro HTTP de escrituras `[]`.

En390 y320: Space selecciona checkbox sin modal; Space abre dropdown sin modal; overlay fuera de tarjeta, dentro del viewport (150px ancho); Escape vuelve al selector. Enter y Space en tarjeta abren un único diálogo, Escape lo cierra y devuelve foco a tarjeta. Outline de foco observado solid1.6px. Registro de escrituras `[]`.

Inspeccioné las capturas finales `mcp-final-1440-claro.png` y `mcp-final-320-oscuro.png`, además de los pares equivalentes ya revisados. La captura320 final usa una oferta normal; los textos extremos corresponden a la matriz E2E separada. No es un ANTES/DESPUÉS equivalente.

Diagnóstico de probes MCP, no fallas del producto: el primer script usó un globalURL no disponible; otro agotó30s porque el input terminó con texto duplicado. Inspeccioné su valor y usé selección completa/Backspace/escritura secuencial; la búsqueda y el recorrido pasaron. Una captura oscura tomada durante la transición del tema mostró un fondo intermedio; la regeneré desactivando animaciones/transiciones sólo en el navegador. Fondo estable de tarjeta `rgb(19,19,19)`, título `rgb(226,226,226)`, empresa `rgb(198,198,198)`. No modifiqué CSS para esa captura.

Consola MCP: sólo dos errores de fuentes externas bloqueadas (Google Fonts y Material Symbols). No se observaron errores de renderizado del producto; los nombres de iconos/fuentes fallback son una limitación deliberada del aislamiento.

### Chrome DevTools MCP

`list_pages`, `navigate_page` y `evaluate_script` sobre el harness sintético: inspección DOM/estilos, región visible, geometría y overflow. Tabla con `overflow-x:auto`; familia declarada `Inter, system-ui, sans-serif`. El tamaño de su sesión fue1905px, usado como diagnóstico adicional, no como una fila de la matriz requerida.

## Skills y límites

- Orquestación: `gentle-ai`, `gentle-ai-branch-pr`.
- Exploración/implementación: `angular-developer`, `angular-component`, `angular-signals`, `redesign-existing-projects`, `frontend-design`, `ui-ux-pro-max`, `design-taste-frontend-v1`, `playwright-best-practices`, `ponytail`.
- Revisión: `web-design-guidelines`, `ponytail-review`, `polish`. Guidelines obtenidas por el padre desde su URL oficial; no atribuyo ese fetch al verificador sin webtools.
- `audit-website` fue leída, pero `squirrel` no está instalado: no se ejecutó ni se inventó un score. `impeccable` no se cargó porque no hizo falta otra corrección visual. No se usó Antigravity.
- Agentes: `gentle-ai-explore`, `gentle-ai-worker`, `gentle-ai-verify`. CodeGraph se usó para conexiones Dashboard/TablaOfertas/DetalleOferta y el verificador volvió a consultar el grafo.
- MCP: Playwright y Chrome DevTools para navegador; Engram para continuidad. GitHub se operó por `gh`, no por un MCP de GitHub. Guidelines por `fetch_content`.

No inspeccioné producción autenticada, dispositivos físicos, Safari/Firefox ni lector de pantalla real. La historia es el componente nativo aislado con dependencias instaladas actuales y fuentes externas bloqueadas, no una ejecución de toda la aplicación histórica. La primera tarjeta320 puede ser más alta al conservar selección/publicación; no se ocultó información para reducir ese número. Sin merge, cierre manual de issue ni deploy.
