# Exploration: ofertas-30-dias-prioridad-ia

## Current State

El plan de implementación está alineado con el commit actual `a4637b90bf58082d382c58fef2492383fa1c985b` y describe dos problemas distintos: cobertura completa de ofertas en una ventana de 30 días y prioridad explicable por señales explícitas de uso de IA.

La ventana de 30 días ya está implementada para el listado y las estadísticas: `backend/src/modelos/oferta.js` usa `fecha_extraccion >= NOW() - INTERVAL '30 days'`, mantiene `COUNT(*)` consistente y no aplica `LIMIT/OFFSET` cuando no se solicita paginación. La migración 015 y sus índices también existen. Esto no garantiza cobertura de extracción: los scrapers mantienen topes de 50/100, algunos recorren pocas páginas y varias fuentes filtran a 14 días.

La prioridad IA todavía no existe como dato de dominio. El prompt actual menciona IA y Next.js como bonus de compatibilidad, pero no hay detector determinístico, evidencias, columnas, parser extendido, ranking separado, preferencia configurable ni indicador en Angular. El cache, la actualización de evaluación y la UI siguen manejando únicamente match/porcentaje/razón.

La sincronización actual devuelve el listado completo en una única respuesta HTTP y el frontend lo guarda en `localStorage`; no existe endpoint por cursor, descarga automática por bloques ni IndexedDB. La automatización ya es registry-driven y resiliente por plataforma, pero guarda fila por fila, no registra cobertura/checkpoints y conserva un cron semanal.

No existe `DOCUMENTACION/INDEX.md` ni `openspec/config.yaml`; la documentación vigente está en `docs/` y las especificaciones fuente en `openspec/specs/`. El índice CodeGraph no estaba disponible; no se inicializó para respetar la restricción read-only.

## Affected Areas

- `PLAN_IMPLEMENTACION_OFERTAS_30_DIAS_PRIORIDAD_IA.md` — plan objetivo contrastado; sus números de migración 017/018 deben corregirse porque 017 ya es salario.
- `backend/src/modelos/oferta.js` — ventana ya resuelta; faltan proyección liviana, cursor, ranking IA y persistencia estructurada.
- `backend/src/controladores/controlador-ofertas.js`, `backend/src/rutas/ofertas.js` — falta el contrato HTTP de sincronización por bloques.
- `backend/src/servicios/servicio-scraping.js` — topes funcionales, paginación parcial, filtros de 14 días y ausencia de timeout/coverage contract.
- `backend/src/servicios/servicio-automatizacion.js` — registry y cron semanal ya existen; faltan ejecución incremental/backfill, métricas y guardado en lote.
- `backend/src/servicios/servicio-evaluacion.js` — prompt IA/Next.js mezclado con match; falta separar prioridad, evidencia y contenido no confiable.
- `backend/src/servicios/evaluacion/parser-respuesta-ia.js` — parser actual solo valida match, porcentaje y razón.
- `backend/src/modelos/evaluacion-cache.js` — no versiona política ni almacena/considera prioridad IA.
- `backend/src/modelos/preferencia.js`, `backend/src/controladores/controlador-preferencias.js` — no existen `priorizar_empresas_ia` ni `bonus_maximo_prioridad_ia`.
- `backend/sql/` — migración 015 y 017 ya existen; faltan columnas IA y tablas de ejecuciones/checkpoints. El siguiente número disponible para prioridad IA es 018.
- `backend/tests/` — hay cobertura del flujo actual, pero no de detector, prioridad estructurada, cursor, cobertura de scrapers ni volumen alto.
- `frontend/src/app/servicios/ofertas.service.ts` — solo consume el endpoint monolítico.
- `frontend/src/app/servicios/persistencia-dashboard.service.ts` — usa `localStorage` como almacenamiento principal del conjunto.
- `frontend/src/app/paginas/dashboard/dashboard.ts`, `frontend/src/app/componentes/tabla-ofertas/`, `frontend/src/app/componentes/detalle-oferta/` — ordenan por match y no muestran prioridad/evidencias.
- `frontend/src/app/modelos/oferta.model.ts`, `preferencia.model.ts`, `respuesta-api.model.ts` — faltan contratos IA y cursor.
- `docs/arquitectura.md`, `docs/base-de-datos.md`, `docs/evaluacion-ia.md`, `docs/scraping.md`, `docs/api-rest.md`, `docs/frontend.md`, `docs/automatizacion.md` — deben actualizarse durante archive; varios describen correctamente lo existente pero no el cambio.

## Implemented vs Missing

### Already implemented

- Ventana fija de 30 días en listado y estadísticas.
- Conteo consistente y ausencia de cap por defecto en `obtenerOfertas()`.
- Índices idempotentes de fecha y estado (`migracion-015`).
- Migración 017 ya ocupada por constraint salarial.
- Deduplicación por URL y filtros de orden con whitelist.
- Registry de plataformas, aislamiento de errores y progreso básico de automatización.
- Prevalidación/postvalidación de exclusiones y parser estricto del contrato legacy de match.
- Cache por hash de oferta, preferencias y modelo.
- Paginación visual de 20 filas; esto no equivale a sincronización completa.

### Missing or incomplete

- Cobertura real de todos los resultados accesibles por fuente durante 30 días.
- Contrato común de scraper, fecha de corte, cursor/checkpoint, motivo verificable de finalización y métricas.
- Endpoint de sincronización por cursor y validación de cursor.
- Descarga automática por lotes, progreso, cancelación y almacenamiento IndexedDB.
- Detector determinístico IA con taxonomía, negaciones y evidencias limitadas.
- Campos/constraints de prioridad IA en ofertas y preferencias.
- Respuesta DeepSeek estructurada, parser con fallback y separación IA vs Next.js.
- Persistencia del resultado IA y backfill determinístico seguro.
- Invalidación/versionado de cache por política IA.
- Servicio de ranking con bonus configurable que nunca altera `match`.
- Orden, filtros, badges, detalle explicable y toggle en Angular.
- Tests de contrato, volumen, cobertura de fuentes, UI y E2E.

## Approaches

1. **Cambio completo según el plan** — Implementar extracción completa, prioridad IA, sincronización por cursor, IndexedDB, operación diaria/backfill y agregación por empresa.
   - Pros: cubre todos los criterios de aceptación del documento.
   - Cons: mezcla muchas capas y fuentes; alto riesgo operativo y difícil de revisar en un solo PR.
   - Effort: High

2. **MVP por slices verificables** — Primera etapa: prioridad IA por oferta (migración 018, detector, parser, persistencia, ranking y UI mínima); segunda: sincronización por cursor + IndexedDB; tercera: scraper piloto con métricas y luego réplica por plataforma. Dejar agregación por empresa y cron diario como etapas posteriores.
   - Pros: reduce riesgo, permite verificar cada contrato y evita reescribir scrapers sin una fuente piloto.
   - Cons: durante las primeras etapas la cobertura de extracción seguirá incompleta y la sincronización seguirá limitada.
   - Effort: Medium/High por etapas

## Recommendation

Reducir el alcance real a un cambio compuesto pero secuenciado en slices: (1) prioridad IA por oferta, (2) sincronización completa de lo ya almacenado, y (3) cobertura de extracción con una plataforma piloto antes de replicar. No incluir todavía la tabla/agregación por empresa, overrides manuales ni la promesa de “todas las publicadas” de cada portal: las APIs/actores no permiten demostrarlo sin contratos específicos. Mantener la ventana de 30 días existente y no reemplazarla por `LIMIT` fijo.

La primera migración nueva debe ser `migracion-018-prioridad-ia-ofertas.sql`; la cobertura de scraping debe usar otro número posterior. Para el primer slice se estima un mínimo de 12–18 archivos y aproximadamente 500–900 líneas netas incluyendo tests; el plan completo excede claramente 3 archivos y 200 líneas, por lo que no es apto para un único prompt de ejecución.

## Risks

- El working tree contiene cambios del usuario/previos; no se modificaron ni deben revertirse `.atl/*`, el borrado de `PLANIFICACION.md`, `EXPLORACION_CV_UPDATE.md` ni el plan objetivo.
- Agregar IA como migración 017 chocaría con la migración salarial existente y el tracking de `schema_migrations`.
- `obtenerOfertasPendientes()` no limita a 30 días; ampliar el universo de extracción podría evaluar histórico si no se define el alcance de evaluación.
- Devolver `SELECT *` y guardar descripciones en `localStorage` puede agotar memoria/cuota antes de llegar a 10.000 ofertas.
- Quitar caps sin paginación/cancelación puede disparar costos, rate limits, timeouts y bloqueos de portales.
- Una señal IA por oferta no prueba una tendencia empresarial; la segunda etapa de empresa debe permanecer fuera del MVP.
- El cambio de firma de `actualizarEvaluacion()` afecta servicio, mocks y tests; debe hacerse con contrato explícito o compatibilidad transitoria.
- Las fuentes externas tienen límites y fechas inconsistentes; el sistema debe registrar cobertura condicionada, no afirmar completitud sin evidencia.

## Ready for Proposal

Yes. El orquestador debería proponer un cambio dividido en slices, con prioridad IA por oferta y sincronización de registros almacenados como alcance inicial; la cobertura completa de scrapers debe comenzar con una plataforma piloto. Debe aclarar que la ventana de 30 días ya está implementada y que “todas” significa todas las filas almacenadas en la API, mientras que la completitud de portales externos queda condicionada por sus límites.
