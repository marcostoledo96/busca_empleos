# Corrección B-01 — etiquetas de postulación desktop

## Resultado y alcance

Atiendo S3/S6/S16 de la issue #51 y el [comentario de auditoría PR55](https://github.com/marcostoledo96/busca_empleos/pull/55#issuecomment-6272867962). El truncamiento está corregido y las 16 mediciones focales pasan. **Revalidación autorizada completa: 202/202 E2E PASS**, tras un caso focal 1/1 PASS. La ejecución anterior de 201 PASS y un timeout se conserva abajo; no invento su causa ni la oculto con retries. Revisión independiente focal y MCP final: PASS. La publicación y el CI del nuevo commit se informan en la PR.

Cambio productivo único: `.columna-postulacion` pasa de `width:150px` a `180px`. Conservo PrimeNG, la fuente de 14px y todas las columnas. No modifico HTML, TS, matching, filtros, selección ni guardado. Tras la autorización «a», redirijo únicamente las salidas de `detalle-capturas.spec.ts` a `B01/detalle/` y las de la matriz de tabla a `test-results`; conservo sus assertions.

## Identidad realmente probada — 2026-10-19

- BASE PR: `bd12660c263ef55bd61486b179fc19ce787d0e66`.
- HEAD existente: `1e33df8784baf6e0b089b334e2611b44a6e1458b`; árbol de ese HEAD: `63daecf0204a73efef9839c5355b2e4d3a8d3e2a`.
- Pruebo **el árbol local sin commit**, no el HEAD limpio ni un SHA futuro. E2E/build incluyen CSS y los dos specs modificados; Angular se ejecutó antes de la redirección de artefactos, con el mismo CSS productivo.
- SHA256 de `git diff HEAD -- frontend/src frontend/e2e`: `626a197b5268ffa3e00056ea4ba7fce6e4b88f4339e87905bbf3123d4e10443a`.
- [Identidad estructurada](identidad.json) y [manifiesto de diez fuentes](../fuentes-verificadas.sha256): actualizo sólo CSS, tabla-ui y detalle-capturas; otros siete hashes idénticos. El manifiesto anterior sigue disponible en el HEAD existente. No reatribuyo los resultados de los informes anteriores al nuevo árbol.

## Reproducción y RED/GREEN

Angular real en el harness existente `http://127.0.0.1:4350/?tabla=1&tema=claro` (o `oscuro`), HTTP sintético, reloj `2026-10-19T12:00:00.000Z`, Chrome headless, fuentes externas bloqueadas. No Firebase, DeepSeek ni scraping real.

Uso las mismas ofertas existentes, sin mutarlas: Aprobadas → `Angular junior 01`; Postuladas → `Caso postulada` / `Caso en proceso`; Descartadas manualmente → `Caso descartada`. Busco por título y llevo la etiqueta al viewport. Mido `.columna-postulacion .p-select-label`, no sólo `textContent`: su texto seguía completo aun cuando se veía recortado.

- RED antes del CSS: cuatro tests fallidos, exit1, 16 mediciones. «No postulado» falla en las cuatro combinaciones; «Descartada» también a1024 en ambos temas.
- GREEN focal: cuatro tests aprobados, exit0 (18.4s). La suite completa vuelve a aprobar los cuatro casos B-01 con las salidas redirigidas.
- Cada caso comprueba el texto esperado, etiqueta visible en viewport, `scrollWidth <= clientWidth`, ancho de documento y body sin overflow global, `overflow-x:auto` y desplazamiento interno efectivo a1024. No genera escrituras HTTP (`[]`).

Anchos de etiqueta en px (`clientWidth / scrollWidth`); fuente siempre14px:

| Ancho | Tema | Estado | Antes | Después |
|---|---|---|---|---|
|1440|claro|no_postulado|95/109|122/122|
|1440|claro|cv_enviado|95/95|122/122|
|1440|claro|en_proceso|95/95|122/122|
|1440|claro|descartada|95/95|122/122|
|1440|oscuro|no_postulado|95/109|122/122|
|1440|oscuro|cv_enviado|95/95|122/122|
|1440|oscuro|en_proceso|95/95|122/122|
|1440|oscuro|descartada|95/95|122/122|
|1024|claro|no_postulado|93/109|122/122|
|1024|claro|cv_enviado|93/93|122/122|
|1024|claro|en_proceso|93/93|122/122|
|1024|claro|descartada|93/95|122/122|
|1024|oscuro|no_postulado|93/109|122/122|
|1024|oscuro|cv_enviado|93/93|122/122|
|1024|oscuro|en_proceso|93/93|122/122|
|1024|oscuro|descartada|93/95|122/122|

[JSON compacto](mediciones.json): antes transcripto de la salida RED observada; después extraído de la salida E2E completa. A1024, la tabla pasa de934/1180 a934/1200; a1440, de1190/1190 a1190/1200. Ambos temas dan lo mismo. El desplazamiento de10px a1440 queda interno: documento y body siguen midiendo exactamente el viewport. No oculto esa diferencia.

## Capturas y preservación

Par equivalente nuevo, misma oferta/fixture/reloj/tema/ancho y búsqueda:

- [ANTES1440 claro](../B01-antes-1440-claro.png), capturado durante RED con las fuentes productivas de HEAD.
- [DESPUÉS1440 claro](despues-1440-claro.png), capturado sobre el árbol local corregido durante E2E completo.
- Otros representantes: [1440 oscuro](despues-1440-oscuro.png), [1024 claro](despues-1024-claro.png), [1024 oscuro](despues-1024-oscuro.png).

Las 16 capturas por estado/ancho/tema están en `frontend/test-results/tabla-ui-B-01-seguimiento-íntegro-*/`, con copias adjuntas mediante `testInfo.attach` en `attachments/`; verifico16 PNG válidos allí. El upload CI existente cubre esa ruta, pero no afirmo haber ejecutado CI en este lote. Las nuevas capturas de detalle y su matriz quedan separadas en `B01/detalle/despues/` (90/90 capturas validadas en la ejecución revalidada; 89/90 en el intento anterior).

Registro [hashes previos](preservacion-previa.json) de56 archivos:55 archivos históricos, incluidos los untracked, siguen idénticos; sólo el manifiesto de fuentes cambia deliberadamente en tres entradas. No sobrescribo pares equivalentes anteriores ni sus informes. Regenero únicamente las salidas técnicas ignoradas autorizadas.

## Comandos y resultado observado

Todos ejecutados desde `frontend`, salvo las verificaciones Git/hash desde la raíz; en primer plano, timeout de herramienta1200s. E2E completo y build se ejecutaron una vez, sin reintentar el timeout. Los logs enlazados combinan stdout/stderr mediante `tee`, con `pipefail` para conservar el exit real. Para `git diff --check`, las copias versionadas de `build.log`, `e2e.log` y `fallo-previo/error-context.md` sólo normalizan espacios finales y el salto EOF; sus originales crudos se conservan localmente bajo el harness ignorado `frontend/.angular/issue51-historico/B01-raw/`. No se alteran mensajes, resultados ni códigos de salida.

| Comando | Resultado |
|---|---|
|`npm run test:e2e -- tabla-ui.spec.ts --grep 'B-01'`|RED exit1:4FAILED; GREEN exit0:4PASSED/16mediciones. Observados antes de la redirección de artefactos.|
|`npm test -- --watch=false --browsers=ChromeHeadless`|exit0:561SUCCESS,4SKIPPED existentes,565descubiertos. Log local `B01-angular.log` (no versionado; el CI del lote publica su propia salida). No repetido tras cambios sólo en salidas E2E.|
|`npm run test:e2e`|exit1:201PASSED,1FAILED,202total,5.8min; cero omisiones/retries. [Log completo](e2e.log). B-01:4/4PASS.|
|`npm run build`|exit0. Bundle inicial664.53kB. [Log](build.log).|
|`git diff --check`|exit0, sin salida.|
|`sha256sum -c docs/evidencias/issue-51/fuentes-verificadas.sha256`|exit0,10/10OK.|

Falla exacta E2E: `e2e/detalle-capturas.spec.ts:56:17 › captura despues textos-largos oscuro 768 @detalle-captura`; timeout15000ms en `abrirDetallePrincipal`, esperando `getByRole('listitem', { name: /^Oferta: Frontend sintética/ })`. La captura de fallo está en blanco. Evidencia: `frontend/test-results/detalle-capturas-captura-d-0f8fd--oscuro-768-detalle-captura/{test-failed-1.png,error-context.md}`. No hay evidencia suficiente para atribuir la causa a carga, entorno o producto; no lo declaro fallo conocido del baseline ni lo oculto con retry/aumento de timeout.

Warning build heredado: `preferencias.css exceeded maximum budget`,15.61kB contra15kB (610bytes). Fuente intacta; ya documentado en la entrega anterior. Angular emite404 de primeicons y mensajes de HTTP500/429 simulados; sus tests pasan. No introduzco skips ni relajo assertions.

## Revalidación autorizada y revisión focal

Marcos autorizó explícitamente reproducir únicamente el caso que había agotado el tiempo y ejecutar una suite completa una vez sólo si pasaba. Conservé el [contexto del fallo](fallo-previo/error-context.md) y su [captura blanca](fallo-previo/test-failed-1.png) antes de que el runner limpiara test-results. No cambié el timeout de15000ms, retries0 ni assertions.

- `npm run test:e2e -- e2e/detalle-capturas.spec.ts --grep 'textos-largos oscuro 768'`: **exit0,1PASS,7.1s**, [log](reproduccion-autorizada.log).
- `npm run test:e2e`: **exit0,202PASS,5.4min**, [log](e2e-revalidado.log). B-01 cuatro tests/16mediciones PASS y detalle90/90. El timeout anterior no se reprodujo; su causa sigue sin establecerse. Son dos ejecuciones autorizadas explícitamente, no retries automáticos ocultos.
- `gentle-ai-verify` `mvfk176g-b-ghrv`: **PASS focal B-01/S3/S6/S16**, sin bloqueantes. Inspeccionó ANTES y16PNG DESPUÉS,16mediciones, preservación55históricos y7hashes no cambiados, assertions/recorridos anteriores intactos y configuración de tiempo/retries sin cambios. No ejecutó runners ni declaró APTO externo de toda la PR; leyó los logs citados y realizó checks propios de lectura/hash/PNG.
- Playwright MCP del padre: **16/16 combinaciones PASS**, cuatro estados ×1440/1024×claro/oscuro. Texto completo, etiqueta122/122px, fuente14px, `overflow-x:auto` dentro de tabla y sin overflow global, HTTPescrituras `[]`. [Mediciones](mcp-mediciones.json), [1440claro](mcp-1440-claro.png), [1024oscuro](mcp-1024-oscuro.png). En esta sesión MCP el documento mide4px menos que el viewport por su scrollbar; no se confunde con los PNG exactos E2E. Los9–10px de desplazamiento nuevo a1440 quedan internos y están declarados.

No verifico producción autenticada, dispositivos físicos ni otros navegadores. Evidencia anterior intacta; sin fuentes ajenas modificadas. El comentario de entrega identifica BASE/HEAD y CI del lote; sin merge, cierre manual ni deploy manual.
