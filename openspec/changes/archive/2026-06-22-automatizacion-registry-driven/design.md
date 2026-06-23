# Design: automatizacion-registry-driven

## Technical Approach

Refactorizar `backend/src/servicios/servicio-automatizacion.js` con un approach moderado: reutilizar el registry existente `backend/src/config/plataformas.js` creado por C3 y NO crear otro registry ni mover executors a config. El servicio tendrá un mapa local `SCRAPERS` que vincula `id` de plataforma con la función de `servicio-scraping`. `ejecutarCicloCompleto()` iterará `PLATAFORMAS_ACTIVAS`, ejecutará cada scraper con aislamiento por plataforma, acumulará ofertas en un único array y mantendrá `guardado` y `evaluacion` como pasos fijos.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Registry | Usar `PLATAFORMAS` / `PLATAFORMAS_ACTIVAS` existente | Crear un nuevo registry con executors | C3 ya centralizó ids, labels y estado. Duplicarlo reintroduce dos fuentes de verdad. |
| Executors | Mapa local `SCRAPERS` en `servicio-automatizacion.js` | Agregar funciones al registry de config | Evita acoplar config con servicios y reduce riesgo de dependencias circulares. |
| Progreso | Pesos dinámicos para scraping + pasos fijos `guardado` y `evaluacion` | Mantener objeto `pesos` hardcodeado | Al activar/desactivar plataformas, el porcentaje se recalcula sin tocar el servicio. |
| Resultado | `resultado.scraping` derivado de `PLATAFORMAS` | Objeto literal con cada plataforma | Mantiene compatibilidad de claves y elimina updates manuales por plataforma. |
| Errores | `try/catch` por plataforma dentro del loop | Un `try/catch` global del scraping | Una falla de LinkedIn, Adzuna, etc. no debe cortar el ciclo completo. |

## Data Flow

```text
PLATAFORMAS_ACTIVAS ──→ armar pasos/progreso ──→ loop por plataforma
       │                                      │
       └── PLATAFORMAS ──→ resultado.scraping│
                                              ▼
SCRAPERS[id](opciones) ──→ ofertasPorPlataforma ──→ todasLasOfertas
                                              ▼
filtro idioma ──→ guardado BD ──→ evaluación IA ──→ email resumen
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/servicios/servicio-automatizacion.js` | Modify | Agregar `SCRAPERS`, derivar pasos/resultado/pesos desde `PLATAFORMAS`, reemplazar bloques hardcodeados por loop resiliente. |
| `backend/tests/servicios/servicio-automatizacion.test.js` | Modify | Ajustar expectativas a registry-driven y agregar casos de inactivas, Adzuna deshabilitada, progreso y error per-platform. |
| `backend/src/config/plataformas.js` | Read-only | No modificar ni recrear; es la fuente de verdad ya existente. |

## Interfaces / Contracts

```js
const SCRAPERS = {
    linkedin: servicioScraping.ejecutarScrapingLinkedin,
    computrabajo: servicioScraping.ejecutarScrapingComputrabajo,
    // ...mismo id que PLATAFORMAS[id]
    adzuna: servicioScraping.ejecutarScrapingAdzuna,
};
```

Contrato de scraper: retorna `Array<Oferta>` o, para integraciones opcionales como Adzuna, `{ deshabilitado: true, advertencia, ofertas: [] }`. Si falta un scraper para una plataforma activa, registrar error de configuración, marcar paso `error` y continuar.

`resultado.scraping` debe inicializarse desde `Object.values(PLATAFORMAS)` con cada `id` en `0`, más `totalExtraidas`, `guardadas` y luego `descartadasPorIdioma`.

Pesos sugeridos: `evaluacion = 15`, `guardado = 3`, `scrapingTotal = 82`; `pesoScraping = scrapingTotal / PLATAFORMAS_ACTIVAS.length`. Los pasos con estado `completada` o `error` suman su peso; al final se fuerza `100`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Solo plataformas activas se invocan | Mockear `servicio-scraping`; verificar Google Jobs/InfoJobs no llamados si están inactivas. |
| Unit | Error por plataforma no corta ciclo | Forzar rechazo en una plataforma y verificar que las siguientes se ejecutan y `errores` acumula mensaje. |
| Unit | Adzuna `{ deshabilitado: true }` | Mockear respuesta objeto; verificar 0 extraídas, paso completado y sin guardar objeto como oferta. |
| Unit | Progreso dinámico | Verificar pasos derivados de `PLATAFORMAS_ACTIVAS` + `guardado`/`evaluacion` y porcentaje final 100. |
| Regression | Resultado compatible | `resultado.scraping` conserva claves históricas derivadas de `PLATAFORMAS`. |

## Migration / Rollout

No migration required. No cambia esquema de BD, endpoints, cron ni contratos HTTP públicos.

## Open Questions

- [ ] None.

## Risks

- Si una plataforma activa no tiene entrada en `SCRAPERS`, el ciclo no debe crashear: debe reportar error y continuar.
- Tests actuales con conteos fijos pueden requerir actualización porque Adzuna está activa pero puede devolver `{ deshabilitado: true }`.
- Mantener compatibilidad de nombres: `remoteok` usa función `ejecutarScrapingRemoteOK`, no derivación automática por capitalización.
