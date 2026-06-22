# Tasks: C1 — Cron semanal UI/docs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~15 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Alinear textos UI/docs/comentarios al cron semanal | PR 1 | main; tests/docs incluidos |

## Phase 1: Textos UI y comentarios backend

- [x] 1.1 En `frontend/src/app/componentes/panel-control/panel-control.html`, reemplazar tooltip del toggle: `cada 48 horas` → `semanal los martes a las 20:00 (ART)`.
- [x] 1.2 En el mismo archivo, reemplazar `aria-label` del toggle: `Activar automatización cada 48 horas` → `Activar automatización semanal los martes a las 20:00`.
- [x] 1.3 En el mismo archivo, reemplazar texto activo del toggle: `Cada 48 hs` → `Martes 20:00`.
- [x] 1.4 En `frontend/src/app/componentes/panel-control/panel-control.ts`, reemplazar toast de activación: `Scraping automático cada 48 horas.` → `Scraping automático semanal: martes 20:00.`.
- [x] 1.5 En `backend/src/servicios/servicio-automatizacion.js`, corregir comentario introductorio: `"Cada 48 horas, soná y hacé esto"` → `"Cada martes a las 20:00, soná y hacé esto"`.
- [x] 1.6 En `docs/frontend.md`, revisar sección PanelControl: si describe el texto del estado del toggle, actualizarlo a `Martes 20:00`.

## Phase 2: Verificación estática y tests

- [x] 2.1 Ejecutar `grep -R "48 hs\|48 horas\|cada 48\|Cada 48" frontend/src backend/src docs README.md AGENTS.md` y confirmar 0 referencias activas (salvo docs históricos/planes).
- [x] 2.2 Correr backend tests: `cd backend && npm test -- --runInBand tests/servicios/servicio-automatizacion.test.js` → esperar 0 fallas.
- [x] 2.3 Correr frontend build: `cd frontend && npm run build` → esperar compilación exitosa.
- [x] 2.4 Correr frontend unit tests del PanelControl: `cd frontend && npm test -- --include panel-control.spec.ts` → 54 SUCCESS, 0 fallas.

## Phase 3: Revisión de documentación activa

- [x] 3.1 Revisar `docs/automatizacion.md`: confirmar que ya describe martes 20:00 y no requiere cambios; si hay inconsistencia, corregir.