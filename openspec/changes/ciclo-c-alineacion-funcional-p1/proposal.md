# Proposal: Ciclo C — Alineación funcional P1 (cron, 30 días, plataformas)

## Intent

Alinear UI, docs y código con las decisiones de producto confirmadas: cron semanal los martes, listados de últimos 30 días fijos, y estado claro de plataformas desactivadas sin referencias ambiguas.

## Scope

### In Scope
- **C1 — Cron semanal**: textos UI/docs que dicen "48 hs" → "martes 20:00"; comentarios backend; descripción humana opcional del cron en `obtenerEstado()`.
- **C2 — Últimos 30 días + índices**: cambiar `INTERVAL '1 month'` por `INTERVAL '30 days'` en queries de ofertas y estadísticas; actualizar comentarios y tests; crear índices de performance en `fecha_extraccion`.
- **C3 — Plataformas desactivadas y enum consistente**: crear registry de plataformas con flag `activa`; alinear enums backend/frontend/docs; eliminar referencias ambiguas (`google-jobs` vs `google_jobs`); asegurar que filtros usen valor interno correcto.

### Out of Scope
- Reactivar Google Jobs o InfoJobs.
- Cambiar la expresión cron por defecto (ya es `0 20 * * 2`).
- Lógica de evaluación IA (Ciclo A/B1).
- Paginación server-side (P2 futuro).
- DB de test segura (Ciclo D).

## Capabilities

### New Capabilities
- `plataformas-registry`: fuente de verdad de plataformas con estado activo/inactivo y metadata.

### Modified Capabilities
- `automatizacion`: corregir comentarios/code que mencionan 48 horas; exponer descripción humana del cron.
- `persistencia`: filtro de fecha fijo de 30 días; `obtenerEstadisticas` filtra por fecha; índices de performance.

## Approach

1. **C1**: Actualizar `frontend/panel-control` (tooltip, aria-label, texto, toast). Actualizar comentario en `backend/servicio-automatizacion.js`. Opcional: agregar `descripcionCron` a `obtenerEstado()`.
2. **C2**: Modificar `backend/modelos/oferta.js` (`obtenerOfertas` y `obtenerEstadisticas`). Actualizar `backend/tests/modelos/oferta.test.js`. Crear migración SQL con índices.
3. **C3**: Crear `backend/config/plataformas.js`. Reemplazar arrays hardcodeados de plataformas en controladores y frontend por el registry. Corregir `dashboard.ts` para que el filtro use `google_jobs` en vez de `google-jobs`.

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `frontend/panel-control` | Modified | Textos cron: 48hs → martes 20:00. |
| `backend/servicio-automatizacion` | Modified | Comentarios y descripción cron opcional. |
| `backend/modelos/oferta` | Modified | `INTERVAL '1 month'` → `INTERVAL '30 days'`; `obtenerEstadisticas` filtra por fecha. |
| `backend/tests/modelos/oferta` | Modified | Ajustar descripciones y asserts de ventana 30 días. |
| `backend/sql/migracion-0XX` | New | Índices: `fecha_extraccion DESC`, `estado_evaluacion+fecha_extraccion`, `plataforma+fecha_extraccion`. |
| `backend/config/plataformas` | New | Registry centralizado de plataformas. |
| `frontend/dashboard` | Modified | Filtro plataforma usa valor interno consistente (`google_jobs`). |
| `frontend/modelos/oferta` | Modified | Enum `plataforma` alineado con registry. |
| `docs/*` | Modified | Alinear referencias a cron, 30 días, plataformas desactivadas. |

## Risks

| Riesgo | Prob | Mitigación |
|--------|------|------------|
| Índices nuevos bloquean escrituras brevemente en tablas grandes | Low | Usar `CREATE INDEX IF NOT EXISTS` en migración; si la tabla crece mucho, ejecutar en ventana de mantenimiento. |
| Cambio de 1 month a 30 days reduce dataset visible | Med | Expected; es la decisión de producto confirmada. Documentar en changelog. |
| Inconsistencia `google_jobs` vs `google-jobs` persiste en algún filtro oculto | Med | `grep` antes y después del cambio en todo `frontend/src` y `backend/src`. |

## Rollback Plan

- Revertir commits del subciclo afectado.
- Crear migración reversa con `DROP INDEX IF EXISTS`.
- Restaurar textos UI manualmente si es necesario.

## Dependencies

- Ninguna externa nueva.

## Success Criteria

- [ ] No quedan textos "48 hs" / "48 horas" / "cada 48" en frontend ni docs activos.
- [ ] No queda `INTERVAL '1 month'` en queries de listados ni estadísticas.
- [ ] Tests de oferta pasan con ventana de 30 días (oferta 29 días aparece, 31 no).
- [ ] Índices creados y usados en explain de queries.
- [ ] Registry de plataformas existe y es consumido por backend y frontend.
- [ ] Filtros frontend/backend usan valor interno `google_jobs` consistentemente.
- [ ] `npm test` (backend) y `npm run build` (frontend) pasan.

## Subciclos propuestos

| Subciclo | Entregable | Archivos principales | Tests clave |
|----------|------------|---------------------|-------------|
| **C1 — Cron semanal** | Textos UI/docs + descripción backend | `panel-control.html`, `panel-control.ts`, `servicio-automatizacion.js`, `docs/automatizacion.md` | `servicio-automatizacion.test.js` (descripción cron), build frontend |
| **C2 — Últimos 30 días + índices** | Queries 30 días + índices DB | `modelos/oferta.js`, `tests/modelos/oferta.test.js`, `sql/migracion-0XX-indices.sql` | `oferta.test.js` (ventana 30 días, estadísticas) |
| **C3 — Plataformas y enums** | Registry + consistencia enum | `config/plataformas.js`, `controlador-preferencias.js`, `dashboard.ts`, `ofertas.service.ts`, `docs/scraping.md` | Tests de filtrado, tests de scraping (no invocar desactivadas) |
