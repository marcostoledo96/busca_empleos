# Preferencias — evidencia visual de #49

## Entornos y límites
- Base actual: `96bb84f6ca0cff92536b2e57617a503bed869dde`.
- Referencia histórica: `73284da5463c916772274456a48ecedd19c9a608`.
- Capturas reales de Chrome mediante Playwright MCP: componentes Angular reales con datos sintéticos, sin Firebase ni APIs productivas. No son capturas de una cuenta autenticada.
- Histórico ejecutado localmente en una copia temporal ignorada de `git archive`. Los blobs originales de preferencias.ts/.html/.css y styles.css coinciden por hash; solo bootstrap, configuración E2E e índice de pruebas son sintéticos.
- Wrapper sintético sin sidebar productivo; no atribuir su espaciado a producción. Histórico sin fuentes remotas; puede resolver fuentes fallback y ligaduras de iconos textuales. Coordenadas no son comparaciones pixel-perfect.
- `audit-website` leído; CLI `squirrel` no disponible. Auditoría UX focal mediante MCP y Playwright, no auditoría SEO/crawler ni puntuación inventada.

## ANTES e histórico
| Ancho × alto | Actual claro / oscuro | Histórico claro / oscuro |
|---|---|---|
| 1440 × 900 | [Claro](antes-1440-claro.png) · [Oscuro](antes-1440-oscuro.png) | [Claro](historico-1440-claro.png) · [Oscuro](historico-1440-oscuro.png) |
| 1024 × 768 | [Claro](antes-1024-claro.png) · [Oscuro](antes-1024-oscuro.png) | [Claro](historico-1024-claro.png) · [Oscuro](historico-1024-oscuro.png) |
| 390 × 844 | [Claro](antes-390-claro.png) · [Oscuro](antes-390-oscuro.png) | [Claro](historico-390-claro.png) · [Oscuro](historico-390-oscuro.png) |

Hallazgos medidos con fuentes listas y scroll al inicio:
- Actual: pestañas a Y≈3072 (1440), 3218 (1024), 5367 (390). Editor de CV ≈509px de alto antes de las pestañas; perfil confirmado completo consume el resto.
- Histórico: pestañas a Y≈189 (1440 y 1024), 227 (390), sin editor ni perfil técnico previos.
- Ambos conservan siete pestañas. No hay cambio de tokens de pantalla: el diff global contra el histórico agrega únicamente impresión del CV.
- Tipografía declarada Inter/system-ui y JetBrains Mono/monospace; bordes de 1px, paleta monocroma, cabeceras de superficie baja. Recuperar jerarquía, no sustituir identidad.
- Overflow actual de aproximadamente 7px en escritorio dentro del wrapper sintético: verificar y corregir localmente el ancho de Preferencias.

## Pruebas de preparación
- Smoke inicial: **5 PASS / 1 FAIL** por heading ambiguo en el test (también coincidía con “Preferencias de búsqueda guardadas”).
- Tras precisar coincidencia exacta: **6 PASS / 0 FAIL**, Chrome real, 7.5s.
- Histórico: build E2E **PASS**, cuatro archivos históricos intactos.
- Instalación bloqueada con npm ci: **52 vulnerabilidades heredadas** (2 low, 14 moderate, 31 high, 5 critical). Sin actualizar dependencias fuera del alcance.

## DESPUÉS y comparación

| Ancho × alto | Resumen claro / oscuro | Perfil expandido claro / oscuro | CV abierto claro / oscuro |
|---|---|---|---|
| 1440 × 900 | [Claro](despues-1440-claro-resumen.png) · [Oscuro](despues-1440-oscuro-resumen.png) | [Claro](despues-1440-claro-perfil-detalle.png) · [Oscuro](despues-1440-oscuro-perfil-detalle.png) | [Claro](despues-1440-claro-cv-editor.png) · [Oscuro](despues-1440-oscuro-cv-editor.png) |
| 1366 × 768 | [Claro](despues-1366-claro-resumen.png) · [Oscuro](despues-1366-oscuro-resumen.png) | Cubierto por E2E | Cubierto por E2E |
| 1024 × 768 | [Claro](despues-1024-claro-resumen.png) · [Oscuro](despues-1024-oscuro-resumen.png) | [Claro](despues-1024-claro-perfil-detalle.png) · [Oscuro](despues-1024-oscuro-perfil-detalle.png) | [Claro](despues-1024-claro-cv-editor.png) · [Oscuro](despues-1024-oscuro-cv-editor.png) |
| 768 × 1024 | [Claro](despues-768-claro-resumen.png) · [Oscuro](despues-768-oscuro-resumen.png) | Cubierto por E2E | Cubierto por E2E |
| 390 × 844 | [Claro](despues-390-claro-resumen.png) · [Oscuro](despues-390-oscuro-resumen.png) | [Claro](despues-390-claro-perfil-detalle.png) · [Oscuro](despues-390-oscuro-perfil-detalle.png) | [Claro](despues-390-claro-cv-editor.png) · [Oscuro](despues-390-oscuro-cv-editor.png) |
| 320 × 844 | [Claro](despues-320-claro-resumen.png) · [Oscuro](despues-320-oscuro-resumen.png) | Cubierto por E2E | Cubierto por E2E |

Pestañas después: Y≈240 (1440,1366,1024), 232 (768), 329 (390), 374 (320), iguales en ambos temas. Ya no hay CV ni lista técnica antes de navegar. El resumen confirmado permanece dentro de Perfil; el editor se consulta en Importar CV. El contenido completo sigue disponible a demanda. Ningún ancho de la matriz desborda globalmente; las tablas tienen scroll propio.

Disclosures nativos: apertura/cierre por Enter y Space observados. DevTools confirmó estado aria-selected y tabindex de las siete pestañas y alturas ≈51px; resumen de perfil ≈50px en escritorio /75px móvil. Contraste medido del texto del resumen contra su fondo: **17.06:1 claro /13.30:1 oscuro**. No es una certificación WCAG exhaustiva ni una medición de todos los textos heredados.

## Ejecuciones y resultados

| Prueba | Resultado observado |
|---|---|
| RED E2E antes del cambio productivo | 6 PASS /19 FAIL; fallos funcionales: editor visible inicialmente, disclosure ausente, overflow y controles pequeños. Otros fallos eran selectores y no se cuentan como RED funcional. |
| Unitarios focales Preferencias | **67 PASS**, exit0 |
| E2E focales Preferencias + harness | **30 PASS**, exit0 |
| `npm test -- --watch=false --browsers=ChromeHeadless` | **542 PASS /4 SKIPPED preexistentes**, exit0 |
| `npm run test:e2e` | **44 PASS /0 FAIL /0 SKIPPED**, exit0; 14 Dashboard/controles +30 Preferencias |
| `npm run build` | **PASS**, exit0; warning CSS Preferencias 15.61kB supera presupuesto15kB en610bytes |
| `git diff --check` | **PASS**, exit0 |
| Tests de servicios modificados | No aplica: no modifiqué servicios. Suite completa incluye servicios/guards/importación. |

Recorridos automatizados, con componentes/servicios reales y API simulada en memoria:
- A: siete pestañas, teclado, tabpanel seleccionado y navegación inicial antes de contenido secundario.
- B: CV editable, cambios globales, cancelación de salida con router guard, diálogo real beforeunload, guardado/error sin perder borrador.
- C: resumen confirmado separado del formulario, detalle completo, confirmación solo tras guardar, sin IA automática.
- D: PDF y Markdown sintéticos, extracción simulada, corrección de texto exacto analizado, decisiones de revisión, aplicación explícita, guardado/reingreso y cancelación.
- E: seis anchos ×dos temas, todas las pestañas por teclado, detalles, controles táctiles, textos largos y ausencia de overflow global.
- F: 14 E2E anteriores preservados; interceptor terminal y bloqueo de red en specs de Preferencias comprueban que no salen llamadas de producto.

Las cargas/guardados demorados y errores de CV siguen visibles al cambiar de pestaña. Los PDF de prueba no prueban extracción binaria real: esa extracción está simulada expresamente para no invocar backend ni IA. Las pruebas Angular existentes cubren los contratos de importación.

## Herramientas y skills aplicadas

MCP utilizados: **Playwright** (navegación, capturas y teclado), **Chrome DevTools** (DOM, estilos computados y consola), **CodeGraph** (relaciones y mapa del componente). Engram recuperó contexto y conserva seguimiento. GitHub se operó con CLI `gh`, no con GitHub MCP.

Skills realmente leídas y aplicadas por orquestador/workers: `gentle-ai`, `gentle-ai-branch-pr`, `gentle-ai-work-unit-commits`, `ponytail`, `angular-developer`, `angular-component`, `angular-forms`, `angular-signals`, `redesign-existing-projects`, `frontend-design`, `design-taste-frontend-v1`, `ui-ux-pro-max`, `web-design-guidelines`, `audit`, `impeccable`, `polish`, `playwright-best-practices`. `audit-website` evaluada pero no ejecutada por falta de squirrel. Las skills Angular deprecadas no motivaron migraciones: conservé FormsModule/estado existente en Angular20. Las recomendaciones estéticas genéricas no reemplazaron los tokens históricos.

`web-design-guidelines`: reglas originales recuperadas desde su fuente oficial. Apliqué revisión focal a disclosures semánticos, foco visible, estados accesibles, texto largo y controles táctiles; no amplié el cambio a formularios, metadatos o arquitectura heredados.

## Verificación independiente y entrega
**Dictamen de gentle-ai-verify: sin bloqueantes funcionales causados por el candidato `2a9da70` respecto de `96bb84f`.** S1–S9 y S11 satisfechos dentro del alcance sintético; S10 depende de publicar la PR. Observó **28 probes propios PASS**, development build PASS y diff-check PASS. Sus probes comprobaron payloads reales, rechazos sin mutación del CV confirmado, guardado vacío, advertencias nativas, revisión explícita, teclado y la matriz responsive en ambos temas.

Una expectativa inicial de su probe de teclado falló: ArrowRight mueve el foco y Enter activa con selectOnFocus=false. Corrigió su supuesto y el recheck pasó; no modificó producción. Su build de producción con red bloqueada dio **offlineBLOCK exit127** por Google Fonts; no lo contó como PASS ni defecto del candidato. El production build del parent sí pasó (exit0), acreditado separadamente por su log.

Observaciones no bloqueantes: la pregunta sintética de salario omite `motivo`, requerido por el validador backend; el fixture no acredita integración completa con ese contrato. El destino `/cv` es un placeholder: cubrí entrada/guarda, no render imprimible real. No modifiqué backend ni amplié esta issue para resolver esas limitaciones.

RDD permanece desactivado; no hay aprobación nativa inventada. ASSESS no pudo clasificar el diff por el spec inicialmente no trackeado: se trató como alto y se ejecutó la verificación independiente. URL/estado de entrega: consultar la PR de `fix/issue-49-preferencias-ui` hacia `master`.

No se probó una cuenta Firebase ni producción; no fue necesario autenticar para este harness aislado. No afirmo equivalencia con una sesión productiva autenticada ni pruebas en dispositivos físicos. No hubo scraping, DeepSeek real ni escrituras de preferencias productivas.
