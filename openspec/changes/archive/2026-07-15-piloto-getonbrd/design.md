# Diseño: Piloto seguro de GetOnBrd

## Enfoque técnico

Se reutilizarán `ejecutarScrapingGetonbrd`, `normalizarLote`, `fetch`, `AbortController` y la ruta manual existente. GetOnBrd quedará inactivo en ambos registries, fuera de UI y automatización. El endpoint manual ejecutará solamente sandbox/fixtures y devolverá resultados, métricas y checkpoint; no llamará a `crearOferta`. La producción se bloqueará antes de invocar al cliente salvo evidencia versionada válida. No se agregarán dependencias, cron, tablas ni migraciones.

## Decisiones de arquitectura

| Opción | Tradeoff | Decisión y razón |
|---|---|---|
| Servicio nuevo vs. función existente | Un módulo nuevo aislaría código, pero duplicaría el flujo | Extender `ejecutarScrapingGetonbrd`; ya concentra cliente, paginación y normalización. |
| Clase/DI container vs. función inyectada | Un container agrega infraestructura sin otro consumidor | Recibir `cliente`, `signal`, `ahora`, `checkpointInicial` y `alConfirmarCheckpoint` en opciones; defaults nativos en producción. |
| Flag de entorno vs. evidencia auditada | Un booleano puede habilitar producción accidentalmente | Config versionada no secreta con `evidence_id`, `received_at`, `allowed_host`, `scope`, `valid_until` y `document_sha256`; producción exige todos los campos válidos y host exacto. |
| Checkpoint PostgreSQL vs. contrato retornable | Persistencia durable agrega migración y alcanza BD durante el piloto | Checkpoint serializable por página, retornado y emitido por callback. Persistencia queda fuera hasta autorizar rollout. |

## Flujo de datos

```text
POST /api/scraping/getonbrd
  → guard de destino/evidencia
  → ejecutarScrapingGetonbrd(cliente inyectado)
  → página válida → normalizar/deduplicar/filtrar 30 días
  → confirmar checkpoint → siguiente página
  → Result Contract (sin crearOferta)
```

El guard acepta sandbox exacto por defecto. Cualquier otro host se deniega. El host productivo solo se acepta cuando coincide simultáneamente con la configuración y una evidencia vigente cuyo scope incluya `GET /api/v0/search/jobs`; `GETONBRD_ENABLED=true` aislado no tiene efecto.

La paginación usa `page >= 1`, `per_page=120`, límite de páginas e ítems, timeout por request y señal externa. `total_pages` es un techo, no una garantía. Página vacía termina sin pedir una página extra. El corte de 30 días clasifica ofertas, pero nunca corta la paginación porque el orden por fecha no está garantizado. URL pública canónica deduplica dentro del run. El checkpoint avanza solo después de validar y procesar la página; timeout, cancelación o error conservan la última página confirmada.

## Cambios de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `backend/src/config/getonbrd.js` | Crear | Hosts, límites y evidencia versionada; guard deny-by-default. |
| `backend/src/config/plataformas.js` | Modificar | Marcar GetOnBrd inactivo. |
| `frontend/src/app/config/plataformas.ts` | Modificar | Mantener contrato del registry y ocultarlo de UI. |
| `backend/src/servicios/servicio-scraping.js` | Modificar | Cliente inyectable, paginación, ventana, deduplicación, checkpoint y resultado. |
| `backend/src/controladores/controlador-scraping.js` | Modificar | Devolver el piloto sin persistir ofertas. |
| `backend/tests/fixtures/getonbrd/paginas.js` | Crear | Respuestas sandbox determinísticas. |
| `backend/tests/servicios/servicio-scraping.test.js` | Modificar | Casos del cliente y paginación. |
| `backend/tests/controladores/controlador-scraping.test.js` | Modificar | Contrato HTTP y ausencia de escritura. |
| `backend/tests/servicios/servicio-automatizacion.test.js` | Modificar | Probar exclusión del ciclo. |
| `frontend/src/app/config/plataformas.spec.ts` | Modificar | Probar registry inactivo. |
| `docs/scraping.md`, `docs/automatizacion.md`, `docs/api-rest.md` | Modificar | Límites, autorización, endpoint shadow y rollback. |

## Interfaces / contratos

```javascript
{
    run_id, estado, motivo_terminacion, destino,
    ofertas: [],
    checkpoint: { termino_indice, termino, pagina_confirmada, pagina_siguiente },
    metricas: { requests, paginas, recibidas, normalizadas, dentro_ventana,
        fuera_ventana, duplicadas_intra_run, invalidas, latencia_ms }
}
```

`estado`: `completado | parcial | cancelado | bloqueado`. Motivos: `paginas_agotadas`, `pagina_vacia`, `limite_items`, `limite_paginas`, `timeout`, `cancelacion`, `error_http`, `respuesta_invalida`, `politica_destino`.

## Estrategia de testing

| Capa | Qué probar | Enfoque |
|---|---|---|
| Unit | Guard, límites, vacío, total_pages, deduplicación, 30 días, reanudación, timeout/cancelación | Jest con cliente/tiempo/callback inyectados; RED sin red ni BD. |
| Integración | Endpoint y registry/cron | Supertest/mocks: nunca `fetch` productivo ni `crearOferta`; automatización no invoca GetOnBrd. |
| E2E | N/A | No se habilita UI ni ejecución real en este piloto. |

## Matriz de amenazas

| Boundary | Aplicabilidad | Respuesta / RED tests |
|---|---|---|
| Documentation-like paths | N/A: no clasifica ni ejecuta archivos | Sin tarea. |
| Git repository selection | N/A: no ejecuta Git | Sin tarea. |
| Commit state | N/A: no crea commits | Sin tarea. |
| Push state | N/A: no hace push | Sin tarea. |
| PR commands | N/A: no automatiza PRs | Sin tarea. |

Boundary adicional aplicable: destino HTTP externo. Conducta segura: sandbox exacto o producción con evidencia válida; falla antes del cliente. RED: host alternativo, evidencia ausente/vencida/scope incorrecto y booleano aislado deben quedar bloqueados.

## Migración / rollout

Sin migración. Rollback: mantener ambos registries inactivos y dejar evidencia en `null`; no hay datos productivos para borrar.

## Preguntas abiertas

Ninguna.
