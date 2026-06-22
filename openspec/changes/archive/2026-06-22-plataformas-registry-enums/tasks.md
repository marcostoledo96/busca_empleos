# Tasks: Plataformas Registry y Enums

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend + tests backend) → PR 2 (frontend + tests frontend + docs) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Registry backend, normalización scraping, tests backend | PR 1 | Base: `main` o `feature/plataformas-registry-enums` |
| 2 | Registry frontend, UI/filtros, tests frontend, docs | PR 2 | Base: rama de PR 1; depende de contrato de ids establecido |

## Phase 1: Registry Backend (Foundation)

- [x] 1.1 Crear `backend/src/config/plataformas.js` exportando `PLATAFORMAS`, `PLATAFORMAS_ACTIVAS`, `IDS_PLATAFORMAS`, `obtenerPlataformasActivas()` y `esPlataformaActiva()`.
- [x] 1.2 Modificar `backend/src/controladores/controlador-preferencias.js` reemplazando `PLATAFORMAS_VALIDAS` hardcodeado por el registry; validar ids internos (`google_jobs`) y aceptar `google-jobs` (normaliza a id interno).
- [x] 1.3 Modificar `backend/src/controladores/controlador-scraping.js` para que plataformas inactivas (`google_jobs`, `infojobs`) devuelvan respuesta controlada sin invocar Apify.
- [x] 1.4 Modificar `backend/src/servicios/servicio-automatizacion.js` para derivar pasos/pesos solo desde `PLATAFORMAS_ACTIVAS`; excluir inactivas del ciclo activo.

## Phase 2: Registry Frontend / Contrato

- [x] 2.1 Crear `frontend/src/app/config/plataformas.ts` con enum/interface equivalente al backend, manteniendo `id`, `slugHttp`, `label` y `activa`.
- [x] 2.2 Modificar `frontend/src/app/modelos/oferta.model.ts` extrayendo `PlataformaId` e incluyendo `infojobs` y `google_jobs`.
- [x] 2.3 Crear test de contrato (fixture o snapshot JSON) que compare ids, slugs y flags `activa` entre `backend/src/config/plataformas.js` y `frontend/src/app/config/plataformas.ts`.

## Phase 3: Normalización google-jobs / google_jobs

- [x] 3.1 Modificar `frontend/src/app/servicios/ofertas.service.ts` para usar `google_jobs` como valor interno en filtros y nunca `google-jobs`.
- [x] 3.2 Modificar `frontend/src/app/paginas/dashboard/dashboard.ts` para que el dropdown de plataforma use el `id` interno (`google_jobs`) y elimine referencias a `google-jobs` como valor.
- [x] 3.3 Modificar `frontend/src/app/paginas/preferencias/preferencias.ts` para que opciones y validaciones usen ids internos del registry.
- [x] 3.4 Modificar `frontend/src/app/componentes/tabla-ofertas/tabla-ofertas.ts` para que filtros y labels usen el registry y no hardcodeen `google-jobs`.
- [x] 3.5 Modificar `frontend/src/app/componentes/panel-control/panel-control.ts` para que selector y labels usen solo plataformas activas del registry.

## Phase 4: UI / Filtros

- [x] 4.1 Asegurar que los filtros de ofertas usen `PlataformaId` del registry en lugar de arrays hardcodeados.
- [x] 4.2 Asegurar que los controles de scraping (panel-control) no ofrezcan plataformas inactivas como opciones activas.
- [x] 4.3 Definir comportamiento de filtros históricos para plataformas inactivas: mostrar deshabilitadas o solo cuando existan ofertas históricas de esa plataforma.

## Phase 5: Tests

- [x] 5.1 Crear `backend/tests/config/plataformas.test.js` validando registry completo, ids únicos, slugs únicos, y que Google Jobs/InfoJobs tengan `activa=false`.
- [x] 5.2 Crear/actualizar tests de `controlador-preferencias` verificando que acepta `google-jobs` (lo normaliza) y acepta `google_jobs`.
- [x] 5.3 Crear/actualizar tests de `controlador-scraping` verificando que endpoints inactivos no invocan Apify.
- [ ] 5.4 Crear/actualizar tests de `servicio-automatizacion` verificando que el ciclo no incluye plataformas inactivas.
- [x] 5.5 Actualizar specs Angular de dashboard, tabla-ofertas, preferencias y panel-control: usan `google_jobs`; panel no ofrece inactivas.

## Phase 6: Documentación

- [x] 6.1 Actualizar `docs/api-rest.md` documentando ids internos (`google_jobs`), slugs HTTP (`google-jobs`) y estado `activa`/`inactiva`.
- [x] 6.2 Actualizar `docs/scraping.md` reflejando plataformas activas vs inactivas y la respuesta controlada para inactivas.
- [x] 6.3 Actualizar `docs/frontend.md` con el enum de plataformas, reglas de filtro y separación `id`/`slugHttp`.

## Phase 7: Verify

- [x] 7.1 Ejecutar `npm test` en backend y confirmar que todos los tests pasan.
- [x] 7.2 Ejecutar tests de frontend (`ng test` o equivalente) y confirmar que pasan.
- [ ] 7.3 Verificar manualmente que el filtro de Google Jobs en dashboard envía `google_jobs` y no `google-jobs`.
- [ ] 7.4 Verificar que scraping de Google Jobs/InfoJobs devuelve respuesta controlada sin llamar a Apify.
- [x] 7.5 Revisar que no se eliminaron plataformas desactivadas del registry ni de los enums.

## Decisiones Pendientes

- [x] **D1**: ¿Los filtros de ofertas deben mostrar plataformas inactivas siempre o solo cuando existan ofertas históricas de esa plataforma? **Decisión (D1)**: Los filtros de ofertas (`obtenerOpcionesFiltroPlataforma`) incluyen TODAS las plataformas (activas e inactivas) para permitir filtrar datos históricos. Los selectores de scraping y preferencias (`obtenerOpcionesScrapingPlataforma`, `obtenerOpcionesPreferenciaPlataforma`) solo incluyen plataformas activas. Criterio conservador elegido.
