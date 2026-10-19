# Issue #50 — Detalle compacto con evidencia consultable

Recuperé la jerarquía y las superficies de The Silent Processor sin reemplazar el componente histórico sobre la lógica actual. Mantengo Busco Trabajo, el matching explicable, el seguimiento y la edición; separo el resumen inicial del desglose completo.

**Estado:** E2E completo **172/172**, matriz visual final **90/90**, Angular **550 aprobados / 4 omitidos preexistentes** y build aprobados. La verificación independiente terminó **sin bloqueantes técnicos**. La entrega se completa únicamente con push, PR y estado de CI observados; no equivale a autorización de merge.

## Recorrido de revisión

1. Comparar las imágenes siguientes con la misma oferta sintética 501.
2. Revisar `detalle-oferta.html/.css/.ts`: barra compacta, identidad dentro del scroll común y evidencia plegable.
3. Revisar `frontend/e2e/detalle-ui.spec.ts`: persistencia, errores, teclado y textos extremos.
4. Consultar las matrices completas y los resultados finales antes de aprobar.

## Identidad de la comparación

| Referencia | Commit |
|---|---|
| Histórico original | `73284da5463c916772274456a48ecedd19c9a608` |
| Base de la rama, con #52 y #53 | `a178393ffffc722796b65c6c6b2c452221d577f4` |
| Candidato funcional comprobado | `7ea26bd0c7cddbd08da35071551528c0d05abec2` |

Uso la fixture `detalle-fixture-v1`, oferta 501 y reloj fijo `2026-01-15T18:00:00.000Z` en las capturas automatizadas. El modificador `extremosDetalle=1` agrega URL y nota extensas únicamente a las pruebas de límites; no reemplaza los datos de la comparación antes/después.

Rendericé el histórico en un worktree nuevo y exclusivo. Sus archivos originales TS/HTML/CSS del modal y estilos globales permanecieron sin cambios contra el commit histórico. Adapté sólo el bootstrap sintético y los tipos locales para recibir la misma oferta. El fondo de esa página no es el Dashboard actual: comparo el modal, **no afirmo una comparación pixel-perfect de toda la página**. Los campos recientes que el histórico no conocía siguen en la fixture, pero no aparecen en su interfaz.

## Capturas seleccionadas

| Escenario | Histórico | Actual ANTES | DESPUÉS |
|---|---|---|---|
| Aprobada, 1440×900, claro | [Imagen](historico/aprobada-1440x900-claro.png) | [Imagen](antes/aprobada-1440x900-claro.png) | [Imagen](despues/aprobada-1440x900-claro.png) |
| Aprobada, 1440×900, oscuro | [Imagen](historico/aprobada-1440x900-oscuro.png) | [Imagen](antes/aprobada-1440x900-oscuro.png) | [Imagen](despues/aprobada-1440x900-oscuro.png) |
| Aprobada, 390×844, claro | [Imagen](historico/aprobada-390x844-claro.png) | [Imagen](antes/aprobada-390x844-claro.png) | [Imagen](despues/aprobada-390x844-claro.png) |
| Rechazada, 320×844, claro | [Imagen](historico/rechazada-320x844-claro.png) | [Imagen](antes/rechazada-320x844-claro.png) | [Imagen](despues/rechazada-320x844-claro.png) |

Las matrices [histórica](historico/matriz.json), [ANTES](antes/matriz.json) y [DESPUÉS](despues/matriz.json) registran nueve escenarios por cinco viewports y dos temas. Conservo los otros PNG automatizados en `frontend/.angular/evidencia-50/`, sin versionar decenas de imágenes adicionales. Las imágenes MCP adicionales están en `mcp/` y no comparten el reloj fijo de las capturas automatizadas: son evidencia interactiva, no una comparación pixel-perfect.

## Matriz responsive final

Cada fila reúne los nueve escenarios: aprobada, rechazada, pendiente, error, reevaluación fallida, desactualizada, histórica, postulada y textos largos. Todos corresponden al candidato funcional `7ea26bd`; las ejecuciones anteriores quedan separadas en JSON y no se cuentan como resultados finales.

| Viewport | Claro | Oscuro |
|---|---|---|
| 1440×900 | 9/9 | 9/9 |
| 1024×768 | 9/9 | 9/9 |
| 768×900 | 9/9 | 9/9 |
| 390×844 | 9/9 | 9/9 |
| 320×844 | 9/9 | 9/9 |

Compruebo ausencia de overflow horizontal de página/diálogo/contenido, marco y footer dentro del viewport, contenido operativo, scroll hasta el final y acceso al guardado de seguimiento. Los plegables se abren con teclado antes de medir el final. La captura inicial se toma antes de expandirlos.

En la oferta aprobada a 1440 claro, la matriz automatizada registra **1831 px ANTES frente a 1121 px DESPUÉS** de contenido inicial: aproximadamente **39 % menos recorrido**, no una puntuación UX ni una comparación de cantidad de CSS. El histórico registraba 747 px, pero no incluía seguimiento extendido, editor ni evidencias recientes. Recupero su ancho de 680 px y lenguaje visual sin intentar igualar artificialmente esa altura perdiendo funciones.

## Qué cambió y qué conservé

- Dejé una sola compatibilidad válida y separé prioridad IA, dictamen y estado manual de postulación.
- Mostré motivo y conteos antes del desglose. Las exclusiones críticas, los errores técnicos y las advertencias permanecen fuera de los plegables.
- Conservé todos los requisitos, explicaciones y evidencias de oferta/perfil de #17 dentro del desglose.
- Mantuve seguimiento accesible sin expandir matching: estado, fecha, nota, validación, guardado explícito, mensajes, borradores por oferta, revisiones asíncronas y rollback.
- Agregué resumen de descripción, texto completo desplegable y metadatos finales. Conservé procedencia, edición/cancelación, validación, errores y reevaluación explícita.
- Conservé el overlay externo del selector y las opciones nativas de foco; envolví Tab/Shift+Tab sólo en los extremos. Escape puede cerrar primero el selector y después el diálogo.
- Moví el título y los metadatos extensos al scroll común: no los trunco ni permito que una cabecera fija empuje el footer fuera del viewport.

No cambié backend, contratos, scoring, base de datos, estilos globales, Dashboard/PanelControl, Preferencias, TablaOfertas ni dependencias. El diff de esas superficies contra la base permanece vacío.

## Resultados observados

| Comprobación | Resultado |
|---|---|
| Histórico renderizado | 90 capturas; job8, exit 0 |
| ANTES actual | 90 capturas entre job7/job9; matriz consolidada job11 |
| RED inicial Angular | 8 fallos / 24 éxitos; job10, exit 1 |
| GREEN focal Angular | 32/32; job13, exit 0 |
| RED límites de foco/footer | 4 fallos / 3 éxitos; job18, exit 1 |
| GREEN foco/footer y selectores | 9/9; job19, exit 0 |
| Angular completo, candidato corregido | 547 aprobados / 4 omitidos antes de incorporar los probes (job21); **550 aprobados / 4 omitidos** con los tres probes incorporados (job23), exit 0 |
| Build, candidato corregido | job22, exit 0; advertencia preexistente de presupuesto `preferencias.css` (15,61 kB frente a 15 kB) |
| E2E completo y matriz DESPUÉS final | 172/172, incluidas 90 combinaciones visuales validadas; job20, exit 0 |
| Verificación independiente Gentle AI | Apto para publicar, sin bloqueantes técnicos; focales propios 32/32 y probes adicionales 3/3, ambos exit 0. [Informe](verificacion-independiente.md) |
| `git diff --check` | Exit 0 en las comprobaciones realizadas; repetir antes de publicación |

No agregué skips para ocultar fallos. Las cuatro omisiones de la suite Angular y la advertencia de Preferencias se informan; no se modifican pruebas ni estilos ajenos a #50 para ocultarlas.

La primera ejecución ambiental falló por `environment.ts` ausente. Una corrida posterior tuvo once fallos por una pestaña mal elegida en el harness; se corrigió y los once casos pasaron. La primera batería amplia tuvo 110 éxitos y dos fallos de selectores. Además, MCP encontró dos defectos que la geometría inicial no comprobaba: fuga de Shift+Tab y footer fuera del viewport con título largo. Agregué RED específicos y los corregí; no uso los resultados anteriores como aprobación del candidato final.

## Evidencia interactiva y límites

Con Playwright MCP comprobé apertura real desde la lista, expansión y foco. Con Chrome DevTools MCP inspeccioné DOM, estilos computados, geometría y consola. En la comprobación final de escritorio observé Inter, superficies existentes, expandibles de 44 px, foco en el enlace inicial y `scrollTop=0`; no aparecieron mensajes de consola de nivel error/warn en esa inspección. A 320×844 con título extremo, el área útil pasó de 48 a 574 px y el footer quedó dentro del diálogo; Shift+Tab permaneció dentro.

Todas las acciones fueron locales y sintéticas, con Angular real y HTTP simulado. No inicié Firebase, scraping, DeepSeek, postulaciones, correos, cron ni escrituras productivas. No verifiqué una sesión productiva autenticada ni paridad con proveedores reales. No afirmo conformidad WCAG completa ni una puntuación de accesibilidad.

RDD estaba desactivado por configuración del clon y no lo activé. ASSESS no pudo clasificar el diff por artefactos sin seguimiento; mantengo la verificación independiente conservadora. `audit-website` fue leída, pero `squirrel` no estaba disponible: no ejecuté ni inventé esa auditoría.

## Herramientas y skills utilizadas

- Skills cargadas: `gentle-ai`, `gentle-ai-branch-pr`, `angular-developer`, `angular-component`, `angular-signals`, `angular-forms`, `redesign-existing-projects`, `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `playwright-best-practices`, `ponytail`, `cognitive-doc-design`; `audit-website` sólo para comprobar aplicabilidad/disponibilidad. Las tres skills Angular antiguas están marcadas como deprecadas: conservé los formularios y signals existentes, sin migrarlos.
- Agentes: `gentle-ai-explore`, `gentle-ai-worker` y `gentle-ai-verify`, ejecutados.
- MCP utilizados: Playwright, Chrome DevTools y Context7 (documentación oficial PrimeNG v20). Engram para continuidad; CodeGraph inicializado y utilizado en la exploración; GitHub consultado mediante `gh`, no mediante un MCP inventado.
- No utilicé Antigravity, Tailwind, otro kit visual ni nuevas bibliotecas.

Para reproducir comandos y escenarios: [harness.md](harness.md).
