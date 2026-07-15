# Tasks: Cerrar alcance de ofertas con prioridad IA

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 300–380 authored |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
Project review ceiling: 2,000 lines

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Enmendar contrato predecessor y corregir reset | PR 1 | `npm --prefix frontend test -- --watch=false` | Karma: snapshot nuevo tras reset | `persistencia-dashboard.service.ts`, `dashboard.ts` y sus specs |
| 2 | Completar evidencia runtime y progreso | PR 1 | `npm --prefix backend test -- --runInBand` | Jest + Karma: escenarios de spec | Tests, specs predecessor y `apply-progress.md` |

## Phase 1: Predecessor Contract Amendment

- [x] 1.1 Actualizar `ofertas-30-dias-prioridad-ia/specs/{automatizacion,cobertura-scraping,sincronizacion-ofertas}/spec.md`: retirar piloto GetOnBrd, cobertura, checkpoints, métricas y migración 019; referenciar cambio futuro; exigir reset esperado. No agregar piloto ni pruebas piloto.
- [x] 1.2 Actualizar `ofertas-30-dias-prioridad-ia/apply-progress.md` con evidencia `_test`: migración 018 repetible, constraints, backfill 30 días, cursor real y 5 suites/65 tests; excluir Railway y no atribuir receipt anterior.

## Phase 2: Async Persistence Reset

- [x] 2.1 RED: en `frontend/src/app/servicios/persistencia-dashboard.service.spec.ts`, guardar ID viejo, ejecutar reset, guardar ID nuevo, recrear servicio y afirmar que solo se rehidrata el nuevo.
- [x] 2.2 GREEN: en `persistencia-dashboard.service.ts`, hacer `limpiarSincronizacion(): Promise<void>`; limpiar `Map`, ejecutar `clear()` en `readwrite`, esperar `oncomplete`, cerrar DB y activar fallback seguro ante ausencia/error/aborto.
- [x] 2.3 RED/GREEN: en `frontend/src/app/paginas/dashboard/dashboard.spec.ts` y `dashboard.ts`, afirmar orden reset→primer request solo con cursor nulo; conservar bloques al reanudar con cursor y evitar duplicados.

## Phase 3: Minimal Runtime Evidence

- [x] 3.1 RED/GREEN: `backend/tests/servicios/servicio-evaluacion.test.js`; evaluar/persistir texto hostil sin cambiar `match`, porcentaje ni argumentos de `actualizarEvaluacion`.
- [x] 3.2 RED/GREEN: `dashboard.spec.ts`; cubrir preferencia/storage inaccesible, fallback en memoria, progreso, cancelación/reanudación y sesión cancelada observable sin éxito falso.
- [x] 3.3 RED/GREEN: `frontend/src/app/componentes/{tabla-ofertas,detalle-oferta}/*.spec.ts`; afirmar evidencia visible, `aria-label` y que no se presenta como aprobación.

## Phase 4: Full Verification

- [x] 4.1 Ejecutar suites focalizadas y luego `npm --prefix backend test -- --runInBand`, `npm --prefix backend run test:db`, `npm --prefix frontend test -- --watch=false` y `npm --prefix frontend run build`; registrar resultados y trazabilidad escenario→test.
- [x] 4.2 Actualizar `openspec/changes/cerrar-alcance-ofertas-prioridad-ia/apply-progress.md` con evidencia de apply; confirmar cero piloto, cero migración 019 y cambios dentro de 2.000 líneas.

## Result Contract

**Status**: success | partial | blocked  
**Summary**: tareas persistidas para implementación single-PR, sin piloto.  
**Artifacts**: `openspec/changes/cerrar-alcance-ofertas-prioridad-ia/tasks.md` | Engram `sdd/cerrar-alcance-ofertas-prioridad-ia/tasks`  
**Next**: sdd-apply  
**Risks**: carrera reset→primer bloque; verificar con Karma IndexedDB real.  
**Skill Resolution**: paths-injected — `sdd-tasks`, `work-unit-commits`, `karpathy-guidelines`.
