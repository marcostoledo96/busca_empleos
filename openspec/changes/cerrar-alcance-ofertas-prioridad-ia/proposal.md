# Propuesta: Cerrar alcance de ofertas con prioridad IA

## Intención

Este cambio **AMENDS** `ofertas-30-dias-prioridad-ia` para alinear su contrato con las slices 1–2 implementadas. Cierra tres bloqueos: obligaciones diferidas aún normativas, reset incompleto de IndexedDB y evidencia runtime faltante. El binding `review-0ef0b036643c8eec-scope2` queda como antecedente, no como aprobación del sucesor.

## Alcance

### Incluido
- Retirar del predecesor piloto GetOnBrd, cobertura, checkpoints, métricas y migración 019, trasladándolos a un cambio futuro.
- Hacer que un snapshot nuevo espere la limpieza de memoria e IndexedDB antes de rehidratar o descargar bloques.
- Agregar solo evidencia runtime faltante para las capacidades entregadas: evaluación/persistencia, texto no confiable, fallbacks, render accesible, cancelación/reanudación y observabilidad.
- Actualizar `apply-progress.md` con evidencia PostgreSQL `_test`: migración 018 repetible, constraints, backfill de 30 días, cursor real y 5 suites/65 tests.

### Fuera de alcance
- Implementar el piloto, migración 019, checkpoints, métricas externas o cambios de cron/scrapers.
- Ampliar producto, duplicar tests ya suficientes o reabrir el receipt anterior.

## Capacidades

### Nuevas
Ninguna.

### Modificadas
- `automatizacion`: remover las obligaciones normativas del piloto diferido.
- `cobertura-scraping`: retirar esta capacidad provisional del predecesor y migrarla a un cambio futuro.
- `sincronizacion-ofertas`: exigir reset persistente esperado antes de iniciar un snapshot nuevo.

## Enfoque

Aplicar deltas de alcance, limpieza asíncrona en persistencia, pruebas de escenarios completos sin E2E redundantes y sincronización desde `verify-report.md`. Entrega `single-pr-default`; objetivo ≤400 líneas authored, bajo el presupuesto de 2.000.

## Áreas afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `openspec/changes/ofertas-30-dias-prioridad-ia/specs/` | Modificado | Alcance normativo y migración futura |
| `frontend/src/app/servicios/persistencia-dashboard.service.ts` | Modificado | Reset real de IndexedDB |
| `backend/tests/`, `frontend/src/app/**/*.spec.ts` | Modificado | Evidencia runtime faltante únicamente |
| `openspec/changes/ofertas-30-dias-prioridad-ia/apply-progress.md` | Modificado | Evidencia DB vigente |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Carrera entre limpieza y primer bloque | Media | Esperar la transacción y probar rehidratación sin IDs antiguos |
| Pérdida del piloto diferido | Baja | Referenciar explícitamente el cambio futuro en los deltas |

## Plan de rollback

Revertir deltas, tests, progreso y corrección de persistencia como una unidad. No hay migraciones ni cambios de datos; el endpoint/listado vigente permanece disponible.

## Dependencias

- `exploration.md`, `verify-report.md` y evidencia aprobada de PostgreSQL `_test`.

## Criterios de éxito

- [ ] Piloto/cobertura/checkpoints/migración 019 quedan fuera del contrato actual y asignados a un cambio futuro.
- [ ] Un snapshot nuevo rehidrata solo sus filas, sin IDs persistidos del snapshot anterior.
- [ ] Los ocho escenarios entregados faltantes y el reset tienen evidencia runtime; no se agregan pruebas del piloto.
- [ ] `apply-progress.md` refleja 3.1 completa y 5 suites/65 tests sin Railway.
