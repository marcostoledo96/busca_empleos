# Design: Ofertas últimos 30 días + índices

## Technical Approach

Implementar el subciclo C2 como ajuste acotado de persistencia: `backend/src/modelos/oferta.js` debe usar una ventana fija de `INTERVAL '30 days'` en listados y estadísticas, manteniendo queries parametrizadas para filtros de usuario. La migración agregará índices idempotentes para acelerar el patrón real de consulta: fecha reciente, estado de evaluación y orden por fecha. Los tests de BD seguirán gated y deberán reforzar que no corran contra producción.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Ventana temporal | Reemplazar `NOW() - INTERVAL '1 month'` por `NOW() - INTERVAL '30 days'` en `obtenerOfertas()` y aplicar la misma ventana en `obtenerEstadisticas()` | Calcular fecha en JS; seguir con `1 month` | PostgreSQL mantiene consistencia de zona horaria y `30 days` expresa la decisión de producto sin ambigüedad de meses de 28/31 días. |
| Índices principales | Crear `idx_ofertas_fecha_extraccion_desc ON ofertas (fecha_extraccion DESC)` y `idx_ofertas_estado_fecha_extraccion ON ofertas (estado_evaluacion, fecha_extraccion DESC)` | Solo índice por estado existente; índice parcial con `NOW()` | El índice simple cubre listados recientes sin filtros; el compuesto sirve cuando se filtra por estado y se ordena por fecha. Un índice parcial con `NOW()` no es estable para este caso. |
| Índice por plataforma | Agregar `idx_ofertas_plataforma_fecha_extraccion` solo si el plan de apply mantiene/optimiza filtros por plataforma | No crearlo | `obtenerOfertas()` ya filtra por plataforma; conviene si ese filtro se usa en dashboard. Mantenerlo explícito evita índices de más si se decide recortar scope. |
| Migración | `backend/sql/migracion-015-indices-ofertas-ultimos-30-dias.sql` con `CREATE INDEX IF NOT EXISTS` | `CREATE INDEX CONCURRENTLY`; modificar `crear-tablas.sql` solamente | El runner envuelve migraciones en transacción; `CONCURRENTLY` fallaría dentro de `BEGIN`. La migración incremental actualiza bases existentes; `crear-tablas.sql` puede documentar baseline si se decide. |

## Data Flow

```text
GET /api/ofertas ─→ controlador-ofertas ─→ obtenerOfertas(filtros)
                                      └─ WHERE fecha_extraccion >= NOW() - INTERVAL '30 days'

GET /api/ofertas/estadisticas ─→ obtenerEstadisticas()
                              └─ mismos 30 días para contadores del dashboard
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/modelos/oferta.js` | Modify | Cambiar comentarios y SQL de `1 month` a `30 days`; agregar filtro temporal a `obtenerEstadisticas()`. |
| `backend/tests/modelos/oferta.test.js` | Modify | Casos 29 días incluido / 31 días excluido para listado y estadísticas; reforzar skip seguro de tests destructivos. |
| `backend/sql/migracion-015-indices-ofertas-ultimos-30-dias.sql` | Create | Índices idempotentes con `CREATE INDEX IF NOT EXISTS`. Sin `DROP`, sin datos. |
| `backend/tests/scripts/migrar.test.js` | Modify | Verificar que la migración nueva existe, usa `IF NOT EXISTS`, no usa `DROP`, y no usa `CONCURRENTLY` bajo el runner transaccional. |
| `docs/base-de-datos.md`, `docs/api-rest.md` | Modify | Documentar ventana fija de 30 días, estadísticas filtradas e índices nuevos. |

## Interfaces / Contracts

No cambia contrato HTTP. `GET /api/ofertas` y `GET /api/ofertas/estadisticas` siguen respondiendo igual, pero el universo visible pasa a “ofertas extraídas en los últimos 30 días”.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Modelo DB-gated | Ventana 30 días en `obtenerOfertas()` y `obtenerEstadisticas()` | `ALLOW_DB_TESTS=true`; insertar fixtures, actualizar `fecha_extraccion` a 29 y 31 días. |
| Safety | No tests destructivos contra prod | Además de `ALLOW_DB_TESTS`, exigir `NODE_ENV === 'test'` y/o `PGDATABASE` con sufijo/patrón de test antes de cualquier `TRUNCATE`; si no, `describe.skip` o throw temprano sin tocar tablas. |
| Migración estática | SQL seguro/idempotente | Test de archivo: contiene índices esperados, `CREATE INDEX IF NOT EXISTS`, no contiene `DROP`, `DELETE`, `TRUNCATE`, ni `CONCURRENTLY`. |
| Verify manual | Performance | En BD segura: `EXPLAIN` de listados con/sin estado y revisar uso potencial de índices. |

## Migration / Rollout

1. Ejecutar `npm run db:migrate` para listar pendientes.
2. En entorno seguro, ejecutar `npm run db:migrate:apply`.
3. No hay migración de datos ni rollback obligatorio; si hiciera falta, crear migración reversa con `DROP INDEX IF EXISTS` (no incluirla en C2 salvo pedido explícito).

## Risks

- Crear índices puede bloquear brevemente escrituras; mitigación: tabla chica hoy, ejecutar fuera de scraping/evaluación.
- Tests existentes usan `TRUNCATE`; el apply debe reforzar guardas antes de agregar más casos.
- `obtenerEstadisticas()` cambiará números visibles: antes contaba histórico, ahora últimos 30 días.

## Open Questions

- [ ] ¿Crear también `idx_ofertas_plataforma_fecha_extraccion` en C2 o dejarlo para un subciclo de filtros/plataformas?
