# Design: Plataformas Registry y Enums

## Technical Approach

Crear un registry explícito de plataformas como fuente de verdad del backend y una copia controlada en frontend para evitar dependencias cross-build entre Node CommonJS y Angular. El identificador interno se usa en BD, filtros y DTOs (`google_jobs`); el slug HTTP se usa solo en rutas (`google-jobs`). Google Jobs e InfoJobs permanecen registradas, pero inactivas.

## Architecture Decisions

| Decisión | Opción elegida | Alternativas | Rationale |
|---|---|---|---|
| Fuente de verdad | `backend/src/config/plataformas.js` + `frontend/src/app/config/plataformas.ts` duplicado controlado | Paquete compartido monorepo; endpoint dinámico | Evita reestructurar build y mantiene el cambio chico. La duplicación se controla con tests de contrato/snapshot. |
| Valores | `id` interno snake_case y `slugHttp` separado | Usar slug como valor único | `ofertas.plataforma` ya usa `google_jobs`; cambiarlo rompería filtros/datos históricos. |
| Inactivas | Mantener Google Jobs/InfoJobs con `activa: false` | Eliminarlas del enum | Permite datos históricos y reactivación futura sin perder semántica. |
| UI | Acciones de scraping solo activas; filtros de ofertas pueden incluir conocidas | Ocultar inactivas en todos lados | No se deben ejecutar inactivas, pero los filtros pueden necesitar ver histórico si existe. |

## Data Flow

```text
Registry backend ──→ validadores preferencias / controladores scraping / automatización
        │
        └── tests contrato ── compara ids/slugs/activa ── Registry frontend

Registry frontend ──→ preferencias / dashboard / tabla ofertas / panel control
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/config/plataformas.js` | Create | Exporta `PLATAFORMAS`, `PLATAFORMAS_ACTIVAS`, `IDS_PLATAFORMAS`, `obtenerPlataformasActivas()`, `esPlataformaActiva()`. |
| `backend/src/controladores/controlador-preferencias.js` | Modify | Reemplaza `PLATAFORMAS_VALIDAS`; acepta ids internos, no slugs HTTP. |
| `backend/src/controladores/controlador-scraping.js` | Modify | Usa helper para respuestas de plataforma inactiva en Google Jobs/InfoJobs sin invocar servicios externos. |
| `backend/src/servicios/servicio-automatizacion.js` | Modify | Deriva pasos/pesos desde plataformas activas; no incluye Google Jobs/InfoJobs en ciclo activo. Mantiene campos de resultado en 0 por compatibilidad si hace falta. |
| `frontend/src/app/config/plataformas.ts` | Create | Registry tipado equivalente para opciones UI. |
| `frontend/src/app/modelos/oferta.model.ts` | Modify | Extrae `PlataformaId` e incluye `infojobs` y `google_jobs`. |
| `frontend/src/app/servicios/ofertas.service.ts` | Modify | Usa `PlataformaId` en filtros. |
| `frontend/src/app/paginas/dashboard/dashboard.ts` | Modify | Dropdown usa `id` interno; corrige Google Jobs a `google_jobs`. |
| `frontend/src/app/paginas/preferencias/preferencias.ts` | Modify | Opciones salen del registry; valores internos. |
| `frontend/src/app/componentes/panel-control/panel-control.ts` | Modify | Selector mobile y labels salen de plataformas activas. No ofrece inactivas. |
| `frontend/src/app/componentes/tabla-ofertas/tabla-ofertas.ts` | Modify | Filtro y labels salen del registry; no usar `google-jobs` como valor. |
| `docs/api-rest.md`, `docs/scraping.md`, `docs/frontend.md` | Modify | Documentar ids internos, slugs HTTP y estado activo/inactivo. |

## Interfaces / Contracts

```js
// backend/src/config/plataformas.js
const PLATAFORMAS = {
    linkedin: { id: 'linkedin', slugHttp: 'linkedin', label: 'LinkedIn', activa: true },
    google_jobs: { id: 'google_jobs', slugHttp: 'google-jobs', label: 'Google Jobs', activa: false, motivo: 'Desactivado por costo y baja utilidad' },
    infojobs: { id: 'infojobs', slugHttp: 'infojobs', label: 'InfoJobs', activa: false, motivo: 'Portal developers suspendido' },
};
```

Regla contractual: `id` viaja en `ofertas.plataforma`, preferencias y filtros; `slugHttp` solo en `/api/scraping/:slug`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit backend | Registry completo, ids únicos, slugs únicos, Google Jobs/InfoJobs inactivas | `backend/tests/config/plataformas.test.js` |
| Controller backend | Preferencias rechaza `google-jobs` y acepta `google_jobs`; endpoints inactivos no llaman Apify | Tests de controlador con mocks de servicios |
| Frontend unit | Dashboard/tabla/preferencias usan `google_jobs`; panel no ofrece inactivas | Specs de componentes/servicios |
| Contract | Backend y frontend tienen mismos ids/slugs/activa | Snapshot JSON manual o test que compara fixtures exportados |

## Migration / Rollout

No requiere migración de datos: se preserva `google_jobs`. Rollout en una PR: primero registry backend/frontend, luego reemplazos de arrays hardcodeados, luego tests/docs.

## Risks

- Duplicación backend/frontend puede divergir: mitigar con test de contrato y docs.
- Cambiar validación de preferencias puede invalidar datos guardados con `google-jobs`: normalizar o migrar al cargar/guardar si aparece.
- Automatización tiene pesos/pasos hardcodeados; derivarlos mal puede romper progreso. Cubrir con test de ciclo sin invocar inactivas.
- Mantener endpoints inactivos puede confundirse con disponibilidad real; respuesta debe declarar `codigo_resultado` y motivo.

## Open Questions

- [ ] ¿Los filtros de ofertas deben mostrar inactivas siempre o solo cuando existan ofertas históricas de esa plataforma?
