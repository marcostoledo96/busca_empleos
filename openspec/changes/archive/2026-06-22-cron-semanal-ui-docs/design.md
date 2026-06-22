# Design: C1 — Cron semanal UI/docs

## Technical Approach

Aplicar un cambio mínimo de alineación textual: el backend ya usa `EXPRESION_CRON_DEFECTO = '0 20 * * 2'`, por lo que no se cambia lógica cron. El trabajo se limita a reemplazar mensajes de UI que todavía dicen “cada 48 horas/hs”, corregir el comentario introductorio del servicio de automatización y actualizar documentación activa solo si queda desalineada.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Cambiar solo textos en `PanelControl` | Bajo riesgo; no altera contratos ni estado | Elegido: HTML/TS deben decir “martes 20:00” o “semanal: martes 20:00”. |
| Exponer `descripcionCron` desde `obtenerEstado()` | Mejora contrato, pero agrega cambio backend/test innecesario para C1 mínimo | Rechazado: no modificar contrato API en este subciclo. |
| Tocar `EXPRESION_CRON_DEFECTO` | Sería riesgoso y fuera de alcance | Rechazado: ya es correcto (`0 20 * * 2`). |

## Data Flow

No cambia el flujo de datos. Solo cambia copy visible/comentarios:

```
PanelControl toggle ──POST /automatizacion/iniciar──> servicio-automatizacion
       │                                               │
       └── muestra “Martes 20:00”                      └── mantiene cron 0 20 * * 2
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/componentes/panel-control/panel-control.html` | Modify | Reemplazar tooltip, `aria-label` y texto activo `Cada 48 hs` por copy semanal martes 20:00. |
| `frontend/src/app/componentes/panel-control/panel-control.ts` | Modify | Reemplazar toast `Scraping automático cada 48 horas.` por `Scraping automático semanal: martes 20:00.` |
| `backend/src/servicios/servicio-automatizacion.js` | Modify | Corregir comentario inicial “Cada 48 horas...” a “Cada martes a las 20:00...”. No tocar constante ni programación. |
| `docs/automatizacion.md` | No-op esperado | Ya documenta martes 20:00; revisar que no requiera cambio. |
| `docs/frontend.md` | Modify if needed | Si describe estado del toggle, aclarar que el panel muestra “Martes 20:00” cuando está activo. |

## Interfaces / Contracts

No hay nuevos contratos. `EstadoAutomatizacion` conserva `{ activo, expresionCron, ultimaEjecucion, ultimoResultado }`. No agregar `descripcionCron`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Static grep | No quedan textos activos “48 hs”, “48 horas”, “cada 48” en `frontend/src`, `backend/src`, `docs` salvo históricos/planes | `rg "48 hs|48 horas|Cada 48|cada 48" frontend/src backend/src docs` |
| Backend unit | Cron sigue programando martes 20:00 | `cd backend && npm test -- --runInBand tests/servicios/servicio-automatizacion.test.js` |
| Frontend build | Template Angular y TS compilan tras cambios de copy | `cd frontend && npm run build` |

## Migration / Rollout

No migration required. Es un cambio de texto/comentario/documentación sin persistencia ni deploy especial.

## Open Questions

None.
