# Propuesta: Ofertas de 30 días con prioridad IA

## Problema

La consulta SQL ya incluye las filas almacenadas de los últimos 30 días, pero el dashboard no las sincroniza de forma escalable y los scrapers no demuestran cobertura externa. El bonus IA tampoco es estructurado, explicable ni configurable.

## Objetivos

- Priorizar ofertas con evidencia explícita de uso de IA sin alterar `match`, exclusiones ni `porcentaje_match`.
- Sincronizar todas las filas almacenadas de 30 días, sin cap funcional.
- Validar cobertura condicionada con un piloto y motivos observables.

## No objetivos

- Prometer todas las publicaciones de cada portal sin evidencia contractual.
- Tendencia por empresa, aliases u overrides manuales.
- Replicar el piloto a todos los portales o cambiar todavía el cron semanal.

## Alcance y slices internos

1. **Prioridad IA:** migración 018, detector, parser con fallback, persistencia, caché versionada, preferencia, ranking, backfill `dry-run` y UI explicable.
2. **Sincronización almacenada:** proyección liviana, cursor validado, progreso/cancelación, IndexedDB con fallback a memoria y pruebas de 10.000 filas.
3. **Cobertura piloto:** contrato, métricas, timeout, cancelación y checkpoint para un scraper con paginación comprobada. Los demás no cambian.

## Capacidades

### Nuevas
- `sincronizacion-ofertas`: transferencia por bloques de ofertas almacenadas en 30 días.
- `cobertura-scraping`: cobertura verificable y condicionada para una fuente piloto.

### Modificadas
- `evaluacion-ia`, `parser-respuesta-ia`: prioridad separada y compatible con respuestas legacy.
- `preferencias-usuario`, `persistencia`, `interfaz-usuario`: configuración, datos, ranking y explicación.
- `automatizacion`: métricas del piloto sin cambiar el cron default.

## Enfoque y áreas

| Área | Impacto |
|---|---|
| `backend/src`, `backend/sql`, `backend/tests` | Migración, ranking, sincronización y piloto |
| `frontend/src/app` | Cliente por cursor, IndexedDB, ranking y UI |
| `docs/` | Contratos, límites y rollback |

## Rollout y rollback

Una PR con tres commits verificables. Desactivar la preferencia IA, conservar el endpoint actual y apagar el piloto restaura comportamiento; las columnas aditivas permanecen sin borrar datos.

## Dependencias

- `exploration.md` y Engram `sdd/ofertas-30-dias-prioridad-ia/explore`.
- Evidencia real del contrato externo antes de elegir el piloto.

## Riesgos

- Límites externos impiden afirmar completitud; se informa cobertura condicionada.
- Cursores concurrentes pueden omitir/duplicar filas; se verifican IDs y conteo.
- Falsos positivos IA; evidencias acotadas y detector testeado.

## Criterios de éxito

- Total sincronizado igual al `COUNT(*)` de 30 días, sin duplicados y usable con 10.000 filas.
- Prioridad IA visible/desactivable; nunca aprueba exclusiones ni modifica match.
- El piloto registra finalización y nunca declara cobertura sin evidencia.
- Pasan tests backend, DB segura, frontend y E2E críticos.

## Estimación de revisión

Forecast: **1.800–3.000 líneas authored**. Se mantiene una sola PR, pero superar 2.000 vuelve insegura la revisión; `sdd-tasks` debe reducir alcance a ≤2.000 o registrar una excepción explícita antes de aplicar.
