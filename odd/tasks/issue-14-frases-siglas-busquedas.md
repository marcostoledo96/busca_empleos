# Issue #14 — Preservar frases, siglas y objetivos laborales

## Autorización y diseño
Implementación, pruebas unitarias/integradas, build, worktree aislado, commits convencionales, push y una única PR hacia `master` con `Closes #14` autorizados.
Sin merge ni cierre manual de la issue, sin consumo de APIs pagas ni scraping real con costo, sin modificar la base de datos productiva, sin activar el cron ni realizar despliegues manuales.
Workspace original con cambios no confirmados preservado intacto en `/home/marcos/Escritorio/Busca_empleos/busca_empleos`.
Worktree aislado en `/home/marcos/Escritorio/Busca_empleos/busca_empleos-issue-14` sobre rama `fix/issue-14-frases-siglas-busquedas`, partiendo de BASE `4febe470fc9b447eb3d736f12263b127fdb6027d` (origin/master tras PR #33 de issue #13).

Metodología Gentle AI en Antigravity:
1. Fase A (Contexto): AGENTS.md, issue #14, Engram, estado git, base 4febe47 verificados.
2. Fase B (Exploración delegada): subagente `research` mapeó `palabrasBusqueda`, adaptadores (LinkedIn, Indeed, Bumeran, Jooble, Adzuna, Remotive, RemoteOK), frontend (`panel-control`, `preferencias`, modelos) y contratos vigentes de issue #13.
3. Fase C (Planificación SDD): diseño proporcional documentado en esta especificación de tareas.
4. Fase D (Ejecución): unidades de trabajo desacopladas (adaptación de consultas/equivalencias, persistencia/migración, frontend, suite de pruebas).
5. Fase E (Revisión y cierre): verificación focal, suites completas, build, registro en Engram y PR final.

Contratos esenciales de Issue #13 a preservar:
- Precedencia: opciones explícitas por ejecución > preferencias guardadas > defaults solo ante ausencia total.
- Arrays vacíos explícitos o guardados rechazan con error 400; nunca se sustituyen silenciosamente por defaults.
- Previsualización (`GET /api/scraping/previsualizacion`) de solo lectura y autenticada.
- Resiliencia en lote: fuentes incompatibles se omiten con `motivoOmision` sin interrumpir el ciclo batch ni fuentes compatibles. En ejecuciones individuales responden 400 con `codigo: 'consulta_incompatible_fuente'`.
- DTO compartido entre backend y frontend (`ResumenBusqueda`).

## Tareas y estado de ejecución
- [ ] T1 Backend - Adaptador de consultas, preservación de frases y equivalencias:
  - Crear módulo auxiliar `servicio-traductor-consultas.js` para traducir consultas según capacidades de cada fuente sin fragmentar frases ni eliminar siglas esenciales (`QA`, `IT`, `C#`, `.NET`, `Angular`).
  - Lista pequeña y verificable de equivalencias (`qa manual` ↔ `tester manual`, `soporte it` ↔ `mesa de ayuda` ↔ `help desk`, `frontend angular` ↔ `desarrollador angular`, `c#` ↔ `c sharp` ↔ `.net`).
  - Bumeran: URLs seguras (`soporte-it`, `qa`, `c-sharp`) sin descartar palabras de menos de 3 letras ni truncar por `#`.
  - Indeed: usar términos preservados en lugar de OR de palabras individuales fragmentadas.
  - Jooble y Adzuna: enviar frases/términos íntegros en lugar de palabras sueltas.
  - Remotive y RemoteOK: mapear objetivos configurados a categorías (`software-dev`, `qa`, `customer-service`) y tags soportados (`qa`, `support`, `csharp`, `net`, `angular`, `node`), o reportar limitación explícita si no cubren el objetivo.
  - Exponer `consultasEfectivas` y `equivalenciasAplicadas` en `ResumenBusqueda`.
- [ ] T2 Persistencia y LinkedIn - Opción de filtro de nivel:
  - Migración `backend/sql/migracion-021-filtrar-nivel-linkedin.sql` agregando `filtrar_nivel_linkedin BOOLEAN NOT NULL DEFAULT TRUE`.
  - Modelo `backend/src/modelos/preferencia.js` agregando `filtrar_nivel_linkedin` a campos permitidos.
  - Adaptador de pruebas en memoria `backend/tests/helpers/bd-busquedas-memoria.js` actualizado.
  - LinkedIn en `servicio-configuracion-busqueda.js` y `apify.js`: omitir `f_E` si `filtrarNivelLinkedin === false`, reflejarlo en `filtros.nivelesExperiencia` y emitir advertencia.
- [ ] T3 Frontend - UI de preferencias y visualización en resumen:
  - Extender modelos TypeScript (`preferencia.model.ts` y `respuesta-api.model.ts`).
  - Agregar toggle en `preferencias.html` y lógica en `preferencias.ts` para activar/desactivar filtro de nivel de LinkedIn.
  - Mostrar consultas efectivas y estado de filtros en `panel-control.html` y `panel-control.ts`.
- [ ] T4 Pruebas y verificación integral:
  - Pruebas unitarias de traducción de consultas (19 requisitos de issue #14).
  - Pruebas de integración backend (preferencias, individual, ciclo batch, omisiones legítimas para términos inválidos como `###`).
  - Pruebas de frontend (preferencias, panel de control).
  - Recorrido integrado: Preferencias guardadas → resolución de configuración → traducción de términos → cliente simulado → resumen en Angular.
  - Full backend test suite (`npm test`), full frontend test suite (`ng test`), y build (`npm run build`).
- [ ] T5 Cierre, documentación, Engram y Pull Request:
  - Actualizar documentación relevante (`docs/scraping.md`, `docs/api-rest.md`, `docs/frontend.md`).
  - Guardar memoria de arquitectura y decisiones en Engram.
  - Commits convencionales en español.
  - Push de rama `fix/issue-14-frases-siglas-busquedas` y apertura de PR hacia `master` con `Closes #14`.
