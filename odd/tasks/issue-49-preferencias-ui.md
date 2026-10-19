# Issue 49 — Preferences visual hierarchy
Branch: `fix/issue-49-preferencias-ui`; base: `96bb84f6ca0cff92536b2e57617a503bed869dde`; delivery: single-pr to master, explicitly requested.
Runner: existing Angular suite + Playwright harness; no production writes or API consumption.

## Specs
S1. "Prepará un worktree nuevo desde `origin/master` actualizado." "No sobrescribas trabajo previo." "No reviertas sus modificaciones de dashboard ni su infraestructura E2E."
S2. "Primero inspeccioná el diseño actual, antes de editarlo." "Tomá capturas reales **ANTES** y **DESPUÉS** de la implementación." Historical reference: `73284da5463c916772274456a48ecedd19c9a608`. "No inventes capturas."
S3. "Jerarquía esperada:" "1. Título y explicación breve." "2. Estado importante, si existe." "3. Navegación principal de pestañas." "4. Contenido de la pestaña seleccionada." "5. Opciones secundarias y detalles técnicos solamente cuando se soliciten."
S4. "Debe seguir siendo posible:" "Consultar el CV base guardado." "Editarlo." "Guardarlo." "Analizarlo manualmente con IA." "Conocer si hay cambios pendientes." "Recibir errores claros." "Evitar perder cambios al navegar."
S5. "Mostrá inicialmente un resumen breve del perfil confirmado, con posibilidad de ampliar los detalles." "No elimines información." "No confundas datos confirmados del perfil con datos todavía no guardados del formulario."
S6. "No dispares DeepSeek automáticamente al abrir, editar o navegar entre pestañas." "No realices cambios de backend o base de datos por motivos cosméticos." "No modifiques Dashboard, PanelControl ni DetalleOferta." "Protección `CanDeactivate` y `beforeunload`."
S7. "Comprobá al menos:" "1440 × 900." "1366 × 768." "1024 × 768." "768 px de ancho." "390 × 844." "320 px de ancho." "Probá **tema claro y oscuro**." "Que el contenido no produzca scroll horizontal de toda la página." "Que los bloques expandibles funcionen con teclado."
S8. "Reutilizá esta infraestructura en lugar de crear otro proyecto Playwright." "No inicialices Firebase real ni utilices credenciales productivas en el harness." "Los recorridos deben ser automatizados y reproducibles. Las screenshots por sí solas no reemplazan los E2E."
S9. "Tests focales de Preferencias." "Tests de servicios modificados." "Suite Angular completa." "E2E de Preferencias." "E2E previos de #48." "Build Angular." "`git diff --check`." "Ejecutá `gentle-ai-verify` o el verificador disponible".
S10. "La PR debe incluir `Closes #49`." "No hagas merge ni cierres la issue." "La PR debe quedar lista para auditoría externa independiente."
S11. "No continúes navegando por la pantalla autenticada hasta que responda: «Ya me autentiqué»." "No solicites contraseñas, cookies, tokens ni códigos 2FA."

## Tasks
T1 | S1,S2,S8,S11 | delegated exploration + worker | done | e59182996c334f10350fefa8cbe2d8798d795393; 6/6 smoke PASS; 6 BEFORE + 6 historical captures; historical build PASS.
T2 | S3-S8 | delegated worker | done | 2a9da70e1a96e4e049ce6d1cf92430a7d5952102; RED 6PASS/19FAIL, GREEN 30/30 E2E + 67/67 unit; docs updated.
T3 | S2,S7-S9 | inline browser checks + independent verify | done | 107627bb0d801483bbd71e2501b11bbb40c5b5bb; Angular542PASS/4existingSKIP; E2E44PASS; buildPASS warningCSS;36captures;independent28PASS/no blockers.
T4 | S10 | inline | done | delivery work unit d27d2f1fdda3806378526f7086a79ec064cb5df7 + final tracking commit; PR53 OPEN/non-draft to master, Closes#49/type:bug; issueOPEN/no merge. CI initial state observed in_progress, terminal watch remains external evidence, not a PASS claim.

## Log
L1. User request: "Actuá como desarrollador frontend especializado en **Angular, UI/UX, diseño visual y responsive**, utilizando **Gentle Shell de Pi y la metodología Gentle AI**." "Tu objetivo es implementar completamente la siguiente issue, realizar pruebas E2E con navegador real y abrir una PR para auditoría externa." Full issue and acceptance criteria: https://github.com/marcostoledo96/busca_empleos/issues/49 (read complete including no comments); user supplemental constraints are quoted in Specs above. User authorized branch/worktree, frontend implementation, synthetic tests, commits, push and one PR; no merge.
L2. Initial worktree base verified exact; original workspace dirty and untouched. Explorer mapped CV guards, confirmed-profile/form separation and existing dashboard harness. RDD off; ordinary verification applies. Initial Git-blob comparison subsequently corroborated with rendered historical/current screenshots. Stale Engram delivery preferences were not relied upon; current explicit user grant is authoritative.
L3. Completed real MCP comparison: 6 historical +6 BEFORE +24 AFTER images. Parent observed44E2E PASS,542AngularPASS/4existingSKIP,production buildPASS(CSSwarning610B). Source frozen at2a9da70. Independent verifier28probesPASS/no candidate blockers, developmentbuildPASS; own productionbuild offlineBLOCK fonts, not counted asPASS. Advisory fixture salary lacks motivo, /cv placeholder only entry/guard. No production auth/API/DeepSeek used.
L4. Published https://github.com/marcostoledo96/busca_empleos/pull/53 to master, OPEN/non-draft, Closes#49, exactly type:bug. Issue49 remains OPEN; no merge. Initial remote CI Backend/Frontend/Vercel in progress; Vercel Preview Comments SUCCESS. Final tracking commit does not change tested production bytes; terminal CI state is reported in PR and Engram, not preclaimed.
