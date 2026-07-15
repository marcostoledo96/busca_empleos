# Diseño: Ofertas de 30 días con prioridad IA

## Enfoque técnico

Se mantienen la ventana SQL de 30 días, `GET /api/ofertas` y el cron semanal. La PR usa tres commits: prioridad IA; cursor + IndexedDB; piloto GetOnBrd. Se reutilizan `fetch`, `AbortController`, `crypto`, IndexedDB y PostgreSQL, sin dependencias nuevas. La implementación debe quedar en ≤2.000 líneas authored.

## Decisiones de arquitectura

| Opción | Trade-off | Decisión y razón |
|---|---|---|
| IA determina prioridad | Puede alucinar evidencias | Descartada. Un detector puro valida términos, negaciones y hasta 3 fragmentos de 120 caracteres. |
| Detector + ranking separado | Más campos, pero explicable | Elegida. `match` y `porcentaje_match` nunca cambian; el bonus solo ordena y queda desactivable. |
| `OFFSET` / respuesta única | Omisiones concurrentes / memoria alta | Descartada. Keyset por `id DESC`, universo fijo y firma de filas para invalidar mutaciones. |
| Librería IndexedDB | API más cómoda, dependencia nueva | Descartada. IndexedDB nativo; `Map` en memoria si no existe, falla cuota o transacción. |
| Piloto multiportal | Evidencia heterogénea | Descartada. GetOnBrd expone `meta.total_pages` y pagina realmente; será el único piloto. |

## Flujo de datos

`Oferta → detector/parser → persistencia/cache v1 → ranking → API por cursor → IndexedDB → Dashboard`

`GetOnBrd pages → normalización → checkpoint/métricas → deduplicación PostgreSQL`

## Interfaces y contratos

- `detectarPrioridadIa(oferta) → { detectada, puntaje: 0..6, categorias[], evidencias[], version: 'prioridad-ia-v1' }`. Reconoce términos concretos, nunca `ai` aislado y descarta negaciones. El parser acepta el bloque opcional; respuestas legacy usan el detector.
- `calcularPuntajeOrden(oferta, preferencias)`: `porcentaje_match + min(puntaje, bonus_maximo)`, solo si `priorizar_ofertas_ia`; desempata por porcentaje, `fecha_extraccion`, `id`. No cambia aprobación ni exclusiones.
- Cache: incluir `POLITICA_EVALUACION='prioridad-ia-v1'` en `hash_preferencias`; resultados JSONB incluyen prioridad. Una versión distinta nunca reutiliza entradas previas.
- `GET /api/ofertas/sincronizacion?limite=500&cursor=...` retorna `{exito, datos: OfertaResumen[], total, cursor_siguiente, completada}`. La primera página fija `fecha_corte`, `maxId`, `COUNT(*)` y una firma determinística de `(id,xmin)` ordenados para `fecha_extraccion >= fecha_corte AND id <= maxId`. Cada bloque calcula firma y datos dentro de una transacción `REPEATABLE READ`; inserciones con ID posterior quedan fuera. Si un borrado o actualización cambia firma/conteo, responde `409 SINCRONIZACION_INVALIDADA`, no marca completada ni afirma `recibidas === total`; el cliente descarta ese snapshot y reinicia una vez, o informa error controlado si vuelve a invalidarse. Cursor autenticado v1, máximo 30 minutos; inválido/expirado: 400. `OfertaResumen` omite campos pesados; IndexedDB confirma cada bloque y deduplica por ID.
- Piloto: `{signal, timeoutMs, checkpoint}`; resultado `{estado, paginas_reportadas, paginas_leidas, items, motivo_fin, checkpoint}`. Una ejecución válida termina como `finalizada_condicionada` por `fecha_corte` o `paginas_agotadas`, motivos distintos y observables según la evidencia contractual. Ninguno afirma cobertura absoluta. `timeout|cancelada|error_http|respuesta_invalida` son estados no exitosos, abortan trabajo pendiente y conservan checkpoint.

## Migración y archivos

- Crear `backend/sql/migracion-018-prioridad-ia-ofertas.sql`: columnas de oferta `prioridad_ia`, `puntaje_prioridad_ia`, `evidencias_prioridad_ia JSONB`, `version_prioridad_ia`; preferencias `priorizar_ofertas_ia DEFAULT false`, `bonus_maximo_prioridad_ia DEFAULT 6`; constraints 0..6 y evidencias array.
- Crear `backend/sql/migracion-019-cobertura-scraping.sql`: `ejecuciones_cobertura` con plataforma, estado, conteos, motivo, checkpoint JSONB y timestamps.
- Crear detector, ranking y backfill en `backend/src/servicios/evaluacion/detector-prioridad-ia.js`, `backend/src/servicios/servicio-ranking-ofertas.js`, `backend/scripts/backfill-prioridad-ia.js`; modificar parser/evaluación/cache, modelos/controladores/rutas de ofertas-preferencias y scraping-automatización.
- Modificar `frontend/src/app/modelos/{oferta,preferencia,respuesta-api}.model.ts`, `servicios/{ofertas,persistencia-dashboard}.service.ts`, dashboard, preferencias, tabla y detalle. Tests espejo en `backend/tests/` y `frontend/src/app/**/*.spec.ts`; documentación en `docs/` durante archive.

El backfill es determinístico, por lotes e idempotente; sin flags solo informa candidatos/cambios (`dry-run`), y `--apply` persiste únicamente filas de 30 días cuya versión difiera.

## Seguridad y observabilidad

Se conserva Firebase auth; límite 100..500, SQL parametrizado y cursor sin campos SQL. No se loguean datos sensibles. Logs incluyen ejecución, página, conteos, duración y motivo; checkpoints se actualizan por página. Timeout/cancelación abortan `fetch` y dejan estado reanudable.

## Estrategia de pruebas

Unitarias: detector, parser legacy, ranking, cursor inválido/expirado. Integración: constraints 018/019; backfill `dry-run`/apply idempotente limitado a 30 días; 10.000 filas; inserciones excluidas por `maxId`; borrado y actualización invalidan con 409 sin éxito falso; IndexedDB/fallback; piloto finaliza separadamente por corte o páginas agotadas y falla en timeout/cancelación. Component/E2E: prioridad no cambia `match`; progreso, cancelación, reinicio controlado y total solo para snapshot válido. Ningún test llama servicios externos.

## Threat Matrix

| Boundary | Aplicabilidad | Respuesta / RED tests |
|---|---|---|
| Documentation-like paths | N/A: no clasificación/ejecución | Ninguna |
| Git repository selection | N/A: no comandos Git | Ninguna |
| Commit state | N/A: no automatización de commits | Ninguna |
| Push state | N/A: no push | Ninguna |
| PR commands | N/A: no comandos de PR | Ninguna |

## Rollout y rollback

Commit 1 aplica 018, detector/cache/backfill/UI; verificar backend, DB, frontend y E2E. Commit 2 agrega cursor/IndexedDB; mantener endpoint y cache legacy como fallback de lectura durante la PR. Commit 3 aplica 019 y habilita GetOnBrd solo con `PILOTO_COBERTURA_GETONBRD=true`; no cambia el cron. Rollback: desactivar preferencia/piloto y volver al endpoint actual; conservar columnas/tablas aditivas. Si falla sincronización, usar cache previa/memoria; si el conteo diverge, reiniciar snapshot.

## Preguntas abiertas

Ninguna bloqueante.
