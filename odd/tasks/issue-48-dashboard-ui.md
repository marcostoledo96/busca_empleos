# Issue 48 — restore The Silent Processor dashboard
Branch: `fix/issue-48-dashboard-ui`; base: `31248bbab47e5990ce8feb38d24947e8a43f2e31`; historical: `73284da5463c916772274456a48ecedd19c9a608`.
Delivery: single-pr explicitly requested; Spanish Conventional Commits; Angular/Karma + browser E2E. RDD off clone-local. Forecast: 400–800 authored lines including reproducible browser tests; no unrelated areas.

## Specs
S1. “NO quiero un rediseño completamente nuevo. Quiero restaurar la identidad visual original y adaptarle las funcionalidades actuales de forma profesional.” “No modificar la marca Busco Trabajo.” “No modifiques archivos de las issues #49, #50 ni #51.” Read issue #48 and AGENTS; isolate worktree; preserve principal checkout.
S2. “Este paso es obligatorio antes de escribir código.” Compare historical styles/dashboard/panel at `73284da5463c916772274456a48ecedd19c9a608`; capture current BEFORE and historical where viable. “No confundas una diferencia de tamaño de código con un defecto visual demostrado.”
S3. “Primero: resumen de ofertas, acciones principales y estado actual.” “Después: acceso al listado de ofertas.” “Como contenido secundario: diagnósticos, configuración efectiva, resultados por fuente e historial.” “Usá divulgación progresiva mediante secciones desplegables o controles compactos que respeten el estilo original.” “No escondas errores importantes ni información crítica.” Preserve searches, automation, history, source data, AI, filters; no backend changes or new visual kits.
S4. “Respeta The Silent Processor.” “Reutiliza los tokens existentes.” Compact editorial style, integrated PrimeNG, consistent spacing, keyboard-accessible disclosures, visible focus, no horizontal page overflow or overlapping controls. Desktop 1440×900; notebook 1366×768; tablet 1024×768; 768px per issue; mobile 390×844 and 320px; light/dark. Before/after same matrix.
S5. “Pruebas E2E reales” mandatory reproducible browser journeys: counters/tabs/platform filters/offers; panel results/history/disclosures/messages; desktop/tablet/mobile; Tab/Shift+Tab/Enter/Escape where applicable; loading/empty/error/partial/completed via fixtures/mocks; regression. “No ejecutes scraping productivo, consultas pagas a DeepSeek, modificación de postulaciones reales ni activación del cron durante E2E.” Reuse runner or add minimum; distinguish mocks from production proof.
S6. “Tests focales Angular.” “Tests relacionados con PanelControl y Dashboard.” “Pruebas E2E reproducibles.” “Suite frontend.” “Build Angular.” “git diff --check.” Independent gentle-ai-verify, resolve real findings, no invented PASS. If Firebase blocks protected navigation: notify exact URL/MCP session and wait for “Ya me autentiqué”; never obtain credentials or change auth.
S7. “Crear una única PR hacia master.” “Incluí Closes #48 en la PR.” Link accessible visual evidence and E2E results without large repository artifacts. “NO hagas merge y NO cierres la issue.” Final report: PR, exact BASE/HEAD, skills/MCP used, visual findings/comparison/viewports, Angular/E2E/build/CI, independent review, limitations. Leave ready for external independent audit.
S8. Discover/read pertinent mandatory design, Angular, audit/E2E and workflow skills; use installed explore/worker/verify; “No uses Antigravity.” Apply by phase, no indiscriminate execution.
S9. Scope correction (verbatim): “quiero que intentes de arreglar playwright a nivel global para todos mis proyectos”. Exact UI selection authorizes reading/modifying only /home/marcos/.local/bin/playwright-mcp and the Playwright entry in /home/marcos/.gentle-shell/agent/mcp.json, if justified. No personal browser profile, credentials or other MCP changes.

## Tasks
T1 | S1,S2,S4,S6,S8 | delegated explore + parent MCP | done | Historical/current demo and authenticated read-only BEFORE inspection completed; 6 widths × 2 themes, private production images masked. Baseline aesthetic visually read back. Commit66761f7316b83c9c76c94278fab1f9f2c355feb7.
T2 | S1,S3,S4,S5,S8 | delegated worker (user expressly requests worker; bounded UI+tests unit) | done | Actions first, native collapsed diagnostics, critical summaries, Dashboard sync disclosure, isolated real-component fixture+13E2E. Observed RED/GREEN; focal114PASS; full541PASS4SKIP; buildPASS; parent fullE2E13PASS. Work-unit implementation commit recorded next.
T3 | S2,S4,S5,S6,S7,S8 | parent MCP + independent verify | in_progress | MCP AFTER matrix6widths×2themes completed with no page overflow; computed fonts/44px targets/focus inspected. Independent whole-candidate review and publication pending; add compact synthetic montages and CI artifact evidence, no private screenshots.
T4 | S6,S9 | inline global config + independent verify (environment risk item5) | done | Only Playwright env PLAYWRIGHT_MCP_HEADLESS=false, WAYLAND_DISPLAY=wayland-0, XDG_SESSION_TYPE=wayland added. Headed smoke job7 exit0 PASS; initial harness job8 MODULE_NOT_FOUND before launch, corrected public stdio harness job9 exit0 PASS from two worktrees; independent verify mvel3mfc-2-o74t PASS. No package/profile/other MCP modifications. External configuration only; no repository commit.
T5 | S6,S9 | user reload + parent MCP | done | Live MCP headless:false; user explicitly confirmed “listo, ya ingrese”. Same production session shows dashboard. No credentials/profile copying or mutating production actions.

## Log
L1 — Original user request (verbatim):

Actuá como desarrollador frontend especializado en **Angular, UI/UX y diseño responsive**, trabajando con **Gentle Shell de Pi y Gentle AI**.

Tu misión es implementar por completo la siguiente issue:

**REPOSITORIO:** `marcostoledo96/busca_empleos`  
**ISSUE:** https://github.com/marcostoledo96/busca_empleos/issues/48  
**TÍTULO:** fix(ui/dashboard): recuperar diseño original y reducir saturación del panel  
**TARGET:** `master`  
**MASTER DE REFERENCIA:** `31248bbab47e5990ce8feb38d24947e8a43f2e31`  
**RAMA:** `fix/issue-48-dashboard-ui`

## 1. Objetivo principal

Quiero recuperar la experiencia visual que tenía **Busca Empleos antes de las últimas ampliaciones**.

Actualmente la aplicación se llama **Busco Trabajo**, pero las nuevas funcionalidades introdujeron demasiada información visible, bloques extensos y controles que no están bien integrados visualmente.

**NO quiero un rediseño completamente nuevo. Quiero restaurar la identidad visual original y adaptarle las funcionalidades actuales de forma profesional.**

Prioridades:

1. Menos saturación visual.
2. Jerarquía clara entre acciones principales y datos secundarios.
3. Diseño compacto, limpio y consistente.
4. Excelente experiencia desktop, tablet y mobile.
5. Conservar todas las funcionalidades implementadas.

## 2. Gentle AI y skills obligatorias

Primero leé `AGENTS.md`, la issue #48 completa y recuperá el contexto de Engram con `project: "busca-empleos"`.

Descubrí, leé y utilizá las skills instaladas pertinentes.

**Skills de diseño:**

- `redesign-existing-projects`
- `frontend-design`
- `design-taste-frontend-v1`
- `ui-ux-pro-max`
- `web-design-guidelines`
- `impeccable`
- `polish`

**Skills de Angular:**

- `angular-developer`
- `angular-component`
- `angular-signals`

**Skills de auditoría y E2E:**

- `audit-website`
- `audit`
- `playwright-best-practices`

**Skills de flujo de trabajo:**

- `gentle-ai`
- `gentle-ai-branch-pr`
- `gentle-ai-work-unit-commits`

Utilizá `find-skills` si necesitás descubrir alguna skill adicional para automatización E2E o verificación visual.

No ejecutes todas las skills de manera indiscriminada: aplicá cada una cuando aporte valor a la tarea.

Utilizá los agentes `gentle-ai-explore`, `gentle-ai-worker` y `gentle-ai-verify`, o sus equivalentes reales.

**No uses Antigravity.**

## 3. Preparar worktree independiente

El directorio principal puede tener otra rama activa.

No modifiques ese trabajo.

Ejecutá, tras comprobar que la rama y el directorio no existan:

```bash
cd ~/Escritorio/Busca_empleos/busca_empleos
git fetch --prune origin
git worktree add -b fix/issue-48-dashboard-ui ../busca_empleos-issue-48 origin/master
cd ../busca_empleos-issue-48
```

Verificá el SHA real de `origin/master` y que el workspace esté limpio.

No modifiques archivos de las issues #49, #50 ni #51.

## 4. Encontrar y estudiar el diseño ORIGINAL

Este paso es obligatorio antes de escribir código.

**Commit de referencia:**

`73284da5463c916772274456a48ecedd19c9a608`

https://github.com/marcostoledo96/busca_empleos/tree/73284da5463c916772274456a48ecedd19c9a608

Compará especialmente:

- `frontend/src/styles.css`
- `frontend/src/app/paginas/dashboard/dashboard.html`
- `frontend/src/app/paginas/dashboard/dashboard.css`
- `frontend/src/app/componentes/panel-control/panel-control.html`
- `frontend/src/app/componentes/panel-control/panel-control.css`

El sistema visual original se llama **The Silent Processor**.

Estudiá sus tokens, tipografía, espaciados, bordes, botones, distribución y comportamiento responsive.

No alcanza con mirar las clases CSS. Necesito que compruebes cómo se ve realmente.

Si es viable, ejecutá la versión histórica mediante un worktree de referencia aislado con datos sintéticos, sin modificar su contenido ni conectarla a producción.

Si no puede ejecutarse, utilizá los archivos históricos como referencia verificable y explicá esa limitación.

**Prohibido reemplazar el diseño original por un dashboard genérico de PrimeNG, Tailwind, Bootstrap o cualquier otro kit.**

## 5. Usar Playwright MCP y/o Chrome DevTools MCP

Descubrí las herramientas MCP conectadas a Gentle Shell.

Utilizá:

- **Playwright MCP:** navegar, hacer capturas, interactuar con la aplicación y realizar pruebas de recorridos.
- **Chrome DevTools MCP:** inspeccionar DOM, estilos computados, layout, consola, comportamiento responsive y errores.

Si solo una está disponible, utilizá esa.

Antes de modificar código:

1. Abrí la aplicación actual.
2. Capturá su estado visual inicial.
3. Inspeccioná la disposición del dashboard.
4. Identificá los bloques que causan saturación.
5. Contrastá con la versión histórica.
6. Registrá hallazgos concretos.

### Autenticación manual — MUY IMPORTANTE

Es posible que no puedas entrar a la aplicación porque Firebase solicita autenticación.

**Si llegás a la pantalla de login y necesitás mi intervención:**

1. Avisame que necesitás que me autentique.
2. Decime qué navegador o sesión MCP debo utilizar.
3. Indicame la URL que tengo que abrir.
4. **DETENÉ la navegación autenticada y esperá mi confirmación expresa: «Ya me autentiqué».**
5. Después continuá utilizando la misma sesión autenticada.

No intentes obtener contraseñas, tokens, cookies ni códigos de autenticación.

No inventes un login exitoso.

No cambies la autenticación del proyecto para evitar este paso.

Mientras esperás la autenticación podés continuar con tareas independientes que no requieran esa sesión, pero no declares finalizada la inspección autenticada.

## 6. Auditoría visual inicial

Revisá la pantalla en los siguientes tamaños:

- Desktop: 1440 × 900.
- Notebook: 1366 × 768.
- Tablet: 1024 × 768.
- Mobile: 390 × 844.
- Mobile pequeño: 320 px de ancho.

Comprobá tema claro y oscuro.

Evaluá:

- Cantidad de información visible inicialmente.
- Jerarquía de títulos y acciones.
- Tamaño y separación de botones.
- Densidad de paneles.
- Consistencia visual con los elementos antiguos.
- Overflow horizontal.
- Elementos solapados.
- Contraste y legibilidad.
- Scroll innecesario.
- Controles accesibles mediante teclado.
- Estados de carga y error.

Generá capturas del **ANTES**.

No confundas una diferencia de tamaño de código con un defecto visual demostrado.

## 7. Corregir Dashboard y PanelControl

La versión actual agregó:

- Configuración efectiva de búsqueda.
- Resultados individuales por fuente.
- Último ciclo completo.
- Historial de hasta 20 ejecuciones.
- Datos técnicos adicionales.
- Más estados y mensajes.

Estas funcionalidades deben mantenerse, pero no tienen que ocupar tanto espacio visual.

### Diseño esperado

Quiero que al abrir el Dashboard se identifiquen rápidamente:

**Primero:** resumen de ofertas, acciones principales y estado actual.

**Después:** acceso al listado de ofertas.

**Como contenido secundario:** diagnósticos, configuración efectiva, resultados por fuente e historial.

Usá divulgación progresiva mediante secciones desplegables o controles compactos que respeten el estilo original.

No escondas errores importantes ni información crítica.

Quiero reducir ruido visual, no perder información.

### Restricciones

- No eliminar búsquedas individuales.
- No eliminar automatización.
- No eliminar historial.
- No eliminar información de fuentes.
- No eliminar evaluación IA.
- No eliminar filtros.
- No cambiar el comportamiento del backend.
- No agregar bibliotecas visuales nuevas sin justificación.
- No modificar la marca Busco Trabajo.

## 8. Implementación visual

Utilizá las skills de diseño para comprobar que el resultado:

- Respeta **The Silent Processor**.
- Conserva una estética editorial y compacta.
- Reutiliza los tokens existentes.
- Presenta una jerarquía clara.
- Evita botones, alertas y títulos redundantes.
- Mantiene un espaciado consistente.
- Funciona correctamente con PrimeNG.
- Es cómodo para utilizar diariamente.

No uses estilos aislados que contradigan el diseño global.

No reemplaces funcionalidad por elementos decorativos.

La aplicación debe parecer una evolución natural de Busca Empleos, no dos interfaces distintas unidas.

## 9. Pruebas E2E reales

**Esta etapa es obligatoria. No alcanza con tests unitarios ni con generar screenshots.**

Utilizá `playwright-best-practices` y la herramienta de automatización de navegador disponible.

Investigá primero si existe un runner E2E reutilizable. Si no existe, incorporá el mínimo necesario para pruebas reproducibles, sin crear infraestructura excesiva.

Probá recorridos reales en un navegador:

**Dashboard:** abrir, consultar contadores, navegar entre pestañas, filtrar por plataforma y acceder a ofertas.

**Panel:** consultar resultados e historial, desplegar y cerrar información secundaria, revisar estados y mensajes.

**Responsive:** navegar e interactuar con los controles en desktop, tablet y mobile.

**Accesibilidad:** navegación mediante Tab/Shift+Tab, Enter, Escape cuando corresponda, foco visible y controles desplegables accesibles.

**Estados:** loading, vacío, error, parcial y completado mediante fixtures o mocks.

**Regresión:** comprobar que los controles que antes funcionaban siguen funcionando.

Para acciones con efectos reales, utilizá entorno local aislado y respuestas simuladas.

No ejecutes scraping productivo, consultas pagas a DeepSeek, modificación de postulaciones reales ni activación del cron durante E2E.

No confundas pruebas con mocks con comprobaciones productivas.

## 10. Comparación visual final

Después de implementar, volvé a abrir la aplicación mediante MCP.

Tomá las capturas del **DESPUÉS** en los mismos tamaños y temas.

Compará:

1. Diseño histórico original.
2. Diseño actual antes de corregir.
3. Nuevo diseño corregido.

Comprobá visualmente que efectivamente disminuyó la saturación y que no aparecieron problemas responsive.

Inspeccioná consola y estilos computados cuando haga falta.

No afirmes que el resultado coincide con el original si no existe evidencia visual suficiente.

## 11. Pruebas técnicas y verificación independiente

Ejecutá:

- Tests focales Angular.
- Tests relacionados con PanelControl y Dashboard.
- Pruebas E2E reproducibles.
- Suite frontend.
- Build Angular.
- `git diff --check`.

Si los tests E2E requieren un navegador no disponible, identificá el bloqueo y utilizá `find-skills` para buscar una alternativa. No los marques como PASS sin ejecutarlos.

Solicitá una revisión independiente mediante `gentle-ai-verify`.

Corregí hallazgos reales y repetí las pruebas necesarias.

No agregues complejidad innecesaria ni documentación extensa.

## 12. Publicación

Tenés autorización para:

- Crear el worktree.
- Implementar la issue #48.
- Ejecutar pruebas y auditorías.
- Crear y ajustar tests.
- Hacer commits convencionales en español.
- Hacer push a la misma rama.
- Crear una única PR hacia `master`.

Incluí `Closes #48` en la PR.

Adjuntá o enlazá evidencia visual antes/después, capturas y resultados E2E.

Si los archivos de evidencia son grandes, no infles el repositorio innecesariamente; utilizá artefactos o enlaces accesibles y verificables.

**NO hagas merge y NO cierres la issue.**

## 13. Informe final

Entregame:

- PR creada y URL.
- BASE y HEAD exactos.
- Skills realmente utilizadas.
- MCP utilizados.
- Hallazgos visuales iniciales.
- Cambios realizados.
- Comparación antes/después.
- Viewports comprobados.
- Tests E2E con resultados PASS/FAIL/SKIPPED.
- Tests Angular y build.
- Estado del CI.
- Resultado de la verificación independiente.
- Limitaciones o pendientes reales.

**Prioridad absoluta:** recuperar el diseño original de Busca Empleos, reducir saturación visual y mejorar responsive sin perder funcionalidades.

Si necesitás que me autentique, avisame y esperá mi confirmación antes de continuar navegando por la sesión protegida.

Terminá dejando la PR lista para auditoría externa independiente.

L11 — Worker mvelk4fa-1-zhoy completed bounded UI+E2E; initial launch envelope rejected before execution for explanatory prose inside allowed-surfaces block, reissued same task with canonical heading. No duplicate worker execution. Real RED from hidden critical quota and uncollapsed diagnostics; Angular2newfails80oldpass; touch-summary22.39pxRED then44pxGREEN. Parent npm test:e2e added; @playwright/test devdep installed3packages, no visual lib. Parent checks: full Angular541SUCCESS4SKIPPED exit0/job4; productionbuild exit0/job5; complete Playwright13PASS exit0/job6 including operations desktop/tablet/mobile, states, keyboard, disclosures and12AFTERcaptures. Focal114PASS logs retained. Native assess unavailable due intended-untracked declaration, RDDoff respected; verify as high risk, no START. MCP final synthetic after4351 matrix6widths×2themes no overflow; panel446desktop/789.2mobile390; keyboard focus2.4px visible on refresh control. ChromeDevTools computed retained JetBrainsMono10px actionlabels and44px targets, Inter13px statuses; no globaltokenchange. Impeccable scoped-context ran (no PRODUCT.md, allowed scopedfix); detector exit2 only warnings requiring classification (existing progress-width transitions and historical left-border identity); no false claim clean score. No squirrelCLI installed; audit-website read, crawler not executed. New whole UI not deployed, authenticated AFTER production not claimed. Public evidence uses isolated fixture, original/after comparison not account data.

L10 — User authentication confirmation (verbatim): “listo, ya ingrese”. Same Playwright session showed dashboard and panel, no auth bypass. Read-only production BEFORE matrix at1440×900,1366×768,1024×768,768×900,390×844,320×844 light/dark with animations disabled and offer table masked; images private under frontend/.angular/evidencia-48/privada-antes-*.png, never publish. Measured panel height758.6px desktop,1102.8px390,1291.8px320; offers top1320px desktop,1813px390,2052.4px320. No page overflow. Two visible alerts plus load/synchronization error state; no backend fix attempted. Screenshot readback shows unstyled native config/history buttons and explanatory paragraphs before action controls; historical rendered reference has actions first, compact mono labels, subtle borders and primary black actions. Historical screenshot reread at1440 after reload verifies true styles; earlier screenshots captured mid-theme transition are not authoritative for contrast. Actual-source/version attribution: local historical exactSHA, local before exactBASE; production is corroborating visual evidence, not verified deployedSHA. Public evidence must use synthetic local fixture data. Servers stopped on /reload, so relaunched same local ports4348/4349 after confirming unavailable (no timeout retry). T1 complete; T2 must capture deterministic synthetic BEFORE using harness before UI changes, add regression RED then GREEN. Forecast one PR may exceed400lines due isolated fixture/runner; explicit single-PR instruction honored, no unrelated changes.

L9 — User confirmed reload with “listo”. Fresh MCP browser_tabs showed only about:blank. Runtime check returned headless:false. Opened tab1 https://busco-trabajo.vercel.app/login and brought it forward; second check also headless:false. Live activation now technically PASS, unlike prior reconnect attempt. No login click or authenticated navigation; human window visibility and explicit “Ya me autentiqué” remain pending.

L8 — User reported “Reconnected to MCP server "playwright" (connected · 23 tools).” Opened login in new MCP tab1 and checked runtime UA: headless:true, so live activation FAILED despite successful independent subprocess checks. Saved config readback retains intended3env. Parent instruction /mcp reconnect was insufficient; corrected to documented /reload after editing external MCP config. No new configuration edits, no further protected navigation, no invented visibility/authentication. Await user /reload before next live check.

L7 — Global fix verification: job9 direct stdio MCP initialize/browser_navigate about:blank/browser_evaluate passed from issue48 and historical worktrees, exit0 in3s; both headless=false. Isolated smoke contexts avoided existing profiles. Independent gentle-ai-verify task mvel3mfc-2-o74t PASS: exact3env config keys, command/exposure retained, symlink metadata intact, single headed Chrome155 smoke non-headless with zero page requests; config SHA256199d2b53e5a92a073c7279dc19adf259e3dc153b5e18bb2b62ff4ea721b061de unchanged during verification; repo status unchanged. Verification applies to S9/global fix only, not dashboard/auth/Angular/E2E. Current desktop wayland-0 supported; other clients/project overrides or other display/headless hosts not guaranteed. Global config change requires /mcp reconnect playwright in live Pi; no supported reconnect tool exposed to parent. Await that exact human action, then verify visible browser. No protected navigation until explicit “Ya me autentiqué”.

L6 — User scope correction (verbatim): “quiero que intentes de arreglar playwright a nivel global para todos mis proyectos”. User selected authorize_global_playwright_targets, explicitly authorizing launcher and active config Playwright entry. Launcher symlink is original npm CLI0.0.77, not a custom script; leave intact. Official Context7 microsoft/playwright-mcp docs confirm default headless on Linux without DISPLAY. Live MCP UA returned HeadlessChrome155 (RED). loginctl/user-manager metadata confirms active Wayland desktop with wayland-0, but TTY host has no DISPLAY/WAYLAND_DISPLAY. Smoke job7 headless:false/XDG_SESSION_TYPE=wayland/WAYLAND_DISPLAY=wayland-0 exited0 with non-headless Chrome155. Applied three env keys only to active global Playwright entry; semantic comparison proves all other MCP entries unchanged. Original executable/exposure retained, launcher/package/auth untouched. First stdio harness job8 failed MODULE_NOT_FOUND before server launch; corrected no-dependency stdio harness job9 tests two isolated worktree contexts, no external requests. Technical non-headless proof does not equal human confirmation of seeing a window. Current MCP process retains old env until reconnect.

L5 — User authorization (verbatim): “autorizo”. Authorized reading active /home/marcos/.gentle-shell/agent/{mcp.json,settings.json}. Chrome DevTools configured explicitly --headless; other args --isolated, --no-usage-statistics, --no-performance-crux. Playwright command is a separate launcher not inspected. Config files unchanged. Proposed smallest route: remove only Chrome --headless after explicit write approval; reconnect MCP from a graphical session because agent DISPLAY/WAYLAND_DISPLAY absent. Human authentication still required before protected navigation; no login success inferred.

L4 — User authorization (verbatim): “autorizo”. Reviewed only /home/marcos/.pi/agent/mcp.json and settings.json, filtering output to avoid credentials. That MCP file has only context7, not Playwright/Chrome; settings contains ponytail. Runtime PI_CODING_AGENT_DIR identifies /home/marcos/.gentle-shell/agent as active agent configuration root. Need explicit permission for that different absolute target before inspecting its MCP/settings files. No configuration changed, no browser restarted, no protected navigation resumed.

L3 — User correction (verbatim): “no me aparece la sesion de playwright para ingresar”. Playwright production tab 1 stopped at https://busco-trabajo.vercel.app/login; no Google action, credentials, tokens, cookies or authenticated navigation. MCP Chrome DevTools reports only about:blank. Host DISPLAY/WAYLAND_DISPLAY absent and headless browser processes observed; cannot promise a visible window. Demo comparison completed separately: historical and current screenshots in frontend/.angular/evidencia-48/ for 1440,1366,1024,768,390,320 widths × light/dark. No page-level horizontal overflow measured. At 390px panel height historical382.59/current495.97px; offers top historical1010.70/current1180.08px; at1440 historical panel267.59/current326.98px; offers748.56/current863.95px. These are DEMO-only measurements, not the complete diagnostic panel. Screenshot readback also showed suspicious dark PrimeNG surfaces in light theme; needs style investigation, not a confirmed new regression. Fonts allowed only Google fonts; all other external requests blocked for local demo. No source changes, E2E, Angular tests/build, commits, push or PR yet. Both local npm ci/env-generation commands succeeded; servers job5 (4348) and job6 (4349) remain running. Evidence folder untracked, not for bulk commit. Auth/browser visibility is the actionable blocker.

L2 — Setup evidence: origin/master SHA matches requested BASE; branch/path absence checked before creation. Principal dirty checkout preserved. Historical detached worktree registered. CodeGraph initialized in new worktree; explorer confirmed sampled global tokens match and diagnostic blocks precede actions. No rendered defect claimed yet. RDD off (clone_local), no START. Explicit current authorization supersedes stale memory preferences (not marked reviewed). Frontend npm ci and ignored example environment generation running for both versions; no backend or production connection authorized.
