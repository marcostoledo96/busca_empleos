# Issue #60 — Evidencia funcional móvil

## Alcance y estado

BASE: `71b81be75da247905ac4d613c49f98feb9ba6c7a` (`origin/master`).
Rama: `test/issue-60-e2e-funcional-mobile`. Estado: implementación en curso; este inventario no declara PASS de ejecución.
Reutilizo los dos harnesses existentes. No uso datos personales, proveedores reales, cron activo ni escrituras productivas.

## Inventario previo a nuevos tests

| Funcionalidad | Test existente | Nivel | Positivo existente | Negativo existente | Persistencia demostrada | Riesgo pendiente |
|---|---|---|---|---|---|---|
| Acceso/rutas | `frontend/src/app/app.routes.spec.ts`, `guards/auth.guard.ts` | Unitario/configuración | Declaración de rutas y guarda de borrador | Redirección prevista sin sesión | No aplica | Falta navegación de navegador por las guardas reales; integración monta Dashboard directamente |
| Dashboard y búsqueda | `frontend/e2e/dashboard.spec.ts`, `controles.spec.ts` | Navegador sintético | Acciones, carga, temas, ciclo manual | Estados de error/recuperación | No | No acredita SQL |
| Avisos operativos | `frontend/e2e/avisos-operativos.spec.ts` | Navegador sintético | Estado parcial, cancelación, recuperación | Fallos de búsqueda/ciclo, 202 no terminal | No | Reutilizar, no duplicar |
| Búsqueda/historial/ciclo | `frontend/e2e/integracion/busqueda-real.integracion.ts` | Angular → Express → PostgreSQL aislado | Buscar, historial, ciclo terminal parcial/sin resultados | Fallo SQL, ciclo parcial | Sí, ofertas/historial y evidencia SQL | Extender mutaciones de usuario y auth |
| Listado | `frontend/e2e/tabla-ui.spec.ts` | Navegador sintético | Filtros, pestañas, selección, paginación, responsive, teclado | Vacío/error, selección/bulk | No | Falta recorrido integrado con seguimiento SQL |
| Detalle | `frontend/e2e/detalle-ui.spec.ts` | Navegador sintético | Matching, foco, fecha/nota, borrador | Guardado HTTP fallido, límites Unicode | No | Falta escritura, recarga y lectura SQL reales |
| Evaluación IA | `frontend/e2e/controles.spec.ts`, integración #57 y helpers de proveedores | UI sintética / Express real con proveedor ficticio | Evaluar, reintentar, ciclo | Error/cancelación | Según recorrido, no toda la matriz IA | No confundir resultado anterior, técnico y rechazo |
| Preferencias | `frontend/e2e/preferencias.spec.ts`, `preferencias-harness.spec.ts` | Navegador con HTTP simulado | Pestañas, edición, guardado, importación | Guardado fallido, aislamiento | No | Falta persistencia real y navegación entre pantallas |
| CV imprimible | `frontend/src/app/paginas/cv/cv.spec.ts` | Unitario/componente | Fuentes confirmadas, vista y llamada a impresión | Datos ausentes/privados | No | Falta recorrido navegador; `window.print` no demuestra PDF |
| Automatización | `controles.spec.ts`, `avisos-operativos.spec.ts`, `busqueda-real.integracion.ts` | Sintético + integración SQL | Cron inactivo, progreso y terminal | Parcial/error/recuperación | Sí para historial de integración | Cron debe continuar inactivo; no hace falta iniciarlo para verificar consulta |

Inventario: agente `gentle-ai-explore`, tarea `mvpn5j1w-1-l6oc`; revisión read-only, no ejecución. CodeGraph inicializado en worktree. Las referencias describen cobertura existente, no resultados observados de esta issue.

## Entorno y aislamiento

- Worktree independiente; cambios ajenos del workspace original preservados.
- PostgreSQL 15 descartable en contenedor `busca-empleos-issue60-pg`, puerto `127.0.0.1:55457`; sin volúmenes ni datos copiados.
- Se reutilizan las identidades sintéticas exactas y validación de base/usuario/versión/esquema de #57.
- Dependencias instaladas con `npm ci` en backend y frontend, exit 0. Sin actualización de lockfiles. npm informó scripts de instalación pendientes y deprecaciones existentes; no se aprobaron scripts globalmente.
- Antes de pruebas integradas: `npm --prefix backend run test:issue61` bajo entorno limpio con variables sintéticas; exit 0; 32/32 pruebas, dos suites, 7.842 s. Log: `frontend/e2e/integracion/salida/issue60-preflight-inicial.log` (artefacto local ignorado).
- RDD: desactivado por `clone_local`; no se inicia revisión nativa ni se modifica ese modo.

## Matriz de ejecución

| Recorrido | UI | Express real | PostgreSQL real de test | Estado |
|---|---|---|---|---|
| A — Login y navegación | Pendiente | Pendiente | No aplica | PENDING |
| B — Buscar empleo | Pendiente | Pendiente | Pendiente | PENDING |
| C — Consultar ofertas | Pendiente | Pendiente | Pendiente | PENDING |
| D — Registrar postulación | Pendiente | Pendiente | Pendiente | PENDING |
| E — Evaluación IA | Pendiente | Pendiente | Pendiente | PENDING |
| F — Preferencias, importación y CV | Pendiente | Pendiente | Pendiente | PENDING |
| G — Automatización inactiva e historial | Pendiente | Pendiente | Pendiente | PENDING |

## Limitaciones que deben conservarse

La emulación Chromium no demuestra Android físico ni teclado virtual real. Un proveedor de identidad sintético no demuestra login Google real. No se verificó producción ni se solicitó una sesión Firebase. La inspección MCP debe distinguirse de Playwright Test. Solo se atribuirán resultados al árbol/commit realmente probado; el HEAD definitivo dependerá de CI. No se declara extracción PDF real cuando se simula ni creación de PDF por interceptar `window.print()`.
