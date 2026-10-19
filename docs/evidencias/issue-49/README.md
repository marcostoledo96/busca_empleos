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

## DESPUÉS
Pendiente: capturas, matriz responsive, suite completa y dictamen independiente.
