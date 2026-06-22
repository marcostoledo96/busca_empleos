# Design: B1 — Deprecar scoring previo en código

## Technical Approach

Eliminar el scoring previo como comportamiento activo de backend/frontend sin tocar destructivamente la base. B1 deja a DeepSeek + parser estricto + `reglas-exclusion` del Ciclo A como único flujo de evaluación: las exclusiones determinísticas siguen corriendo pre-IA, post-IA y al aceptar cache. Las columnas legacy (`score_previo`, `analisis_previo`, `scoring_version`) y `preferencias.scoring_config` quedan intactas para B2.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Deprecación por código | Quitar imports/exports/UI/payloads/hash que mantengan vivo `scoring_config` o `servicio-scoring-previo`. | Mantener servicio muerto documentado. | Si queda configurable o testeado como feature, sigue pareciendo fuente de verdad. |
| Sin migración destructiva | No dropear columnas ni borrar datos legacy en B1. | `DROP COLUMN` inmediato. | Reduce riesgo operativo; permite rollback simple y revisión de datos antes de B2. |
| Reglas Ciclo A como defensa | Mantener `backend/src/servicios/evaluacion/reglas-exclusion.js` sin relajar porcentajes ni orden. | Reemplazarlas por scoring previo o prompt. | Java, Senior/SR/Lead, 3+ años, inglés excluyente y presencial fuera de zona deben ser rechazos duros. |
| Cache desacoplado de scoring | Sacar `scoring_config` de `crearHashPreferencias()`. | Mantenerlo hasta B2. | Un campo deprecado no debe invalidar cache ni afectar resultados nuevos. |

## Data Flow

```text
Preferencias + oferta
    ├─→ hash preferencias SIN scoring_config
    ├─→ cache hit ─→ reglas-exclusion defensiva ─→ resultado final
    └─→ reglas-exclusion pre-IA ─→ DeepSeek ─→ parser estricto ─→ reglas-exclusion post-IA
                                      └─→ modeloOferta.actualizarEvaluacion(porcentaje_match)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/servicios/servicio-scoring-previo.js` | Delete | Retirar scoring previo activo; las reglas duras viven en `evaluacion/reglas-exclusion.js`. |
| `backend/src/modelos/preferencia.js` | Modify | Quitar `scoring_config` de campos actualizables/JSONB; conservar lectura de columna si existe. |
| `backend/src/controladores/controlador-preferencias.js` | Modify | Quitar validaciones de `scoring_config` y rangos derivados; no persistir nuevos cambios de scoring. |
| `backend/src/modelos/evaluacion-cache.js` | Modify | Excluir `scoring_config` del hash de preferencias. |
| `backend/src/modelos/oferta.js` | Modify | Eliminar `guardarAnalisisPrevio` del contrato público; no tocar columnas DB. |
| `frontend/src/app/modelos/preferencia.model.ts` | Modify | Sacar `scoring_config` del modelo actualizable. |
| `frontend/src/app/servicios/preferencias.service.ts` | Modify | Sacar `scoring_config` de `ResultadoImportacionCv`. |
| `frontend/src/app/paginas/preferencias/preferencias.ts/html` | Modify | Quitar estado, normalización, payload y UI de scoring/bonus. |
| `backend/tests/**`, `frontend/src/app/**/*.spec.ts` | Modify/Delete | Quitar tests de scoring previo; agregar regresiones de no persistencia/no hash/no UI. |
| `docs/evaluacion-ia.md`, `docs/frontend.md`, `docs/base-de-datos.md`, `docs/api-rest.md` | Modify | Documentar scoring previo como legacy y B2 pendiente. |

## Interfaces / Contracts

- `PUT /api/preferencias` debe ignorar o rechazar limpiamente `scoring_config` sin error 500; preferido: ignorarlo por compatibilidad de clientes viejos.
- `GET /api/preferencias` puede seguir devolviendo `scoring_config` si la columna existe, pero el frontend ya no lo consume.
- `porcentaje_match` sigue existiendo: representa porcentaje final IA/reglas, no score previo.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Backend unit | `crearHashPreferencias` no cambia por `scoring_config`. | Jest en `evaluacion-cache.test.js`. |
| Backend controller/model | `PUT /preferencias` con `scoring_config` no persiste cambios ni rompe. | Tests existentes de preferencias. |
| Backend regression | Exclusiones Ciclo A siguen sin llamar/ceder ante IA/cache. | `servicio-evaluacion.test.js` y `reglas-exclusion.test.js`. |
| Frontend unit | Preferencias ya no renderiza tab/campos scoring ni envía `scoring_config`. | Specs de preferencias/service. |
| Docs/build | Contratos documentados y compilación. | `npm test` backend; `npm test`/`npm run build` frontend si están disponibles. |

## Migration / Rollout

B1 no requiere migración DB. Rollback: restaurar archivos de código/UI/tests y volver a incluir `scoring_config` en hash/payload. B2 queda para migración no destructiva primero (auditar datos legacy, backup, marcar columnas como obsoletas) y recién después evaluar `DROP COLUMN score_previo`, `analisis_previo`, `scoring_version` y `preferencias.scoring_config` con script reversible.

## Risks

- Cliente viejo podría seguir mandando `scoring_config`; por eso B1 debe ignorarlo sin 500.
- Tests/docs pueden seguir hablando de “score” cuando ahora es `porcentaje_match` final.
- Si algún script externo usa `guardarAnalisisPrevio`, fallará; verificar grep antes de aplicar.

## Open Questions

- [ ] Definir en B2 si se conserva histórico legacy exportado antes de dropear columnas.
