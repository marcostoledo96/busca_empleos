# Diseño: Endurecer sincronización de ofertas

## Enfoque técnico

Endurecer el flujo existente sin nuevas dependencias ni capas. El `Dashboard` cancelará la suscripción activa con RxJS `takeUntil`; al desuscribirse, Angular `HttpClient` aborta la petición en curso. El modelo resolverá el secreto HMAC al cargarse, fallará temprano en producción si falta y conservará el fallback aleatorio con `logger.warn` solo en desarrollo/test. El controlador responderá únicamente los errores de contrato conocidos y relanzará fallos operativos al middleware global `500`.

Esto implementa la propuesta y amplía el contrato vigente de `openspec/specs/sincronizacion-ofertas/spec.md` sin cambiar endpoint, DTO ni persistencia.

## Decisiones de arquitectura

### Decisión: cancelación por desuscripción

| Opción | Tradeoff | Decisión |
|---|---|---|
| `Subject<void>` + `takeUntil` | Reutiliza RxJS y exige distinguir la finalización sin valor en el `catch` | **Elegida**: `HttpClient` aborta la request al desuscribirse; no cambia `OfertasService` |
| `AbortController` | API familiar, pero `HttpClient` Angular 20 no documenta `signal` en sus opciones | Descartada |
| Guardar `Subscription` | Incompatible con el `firstValueFrom` actual sin reestructurar el loop | Descartada |

### Decisión: configuración del secreto en el modelo

| Opción | Tradeoff | Decisión |
|---|---|---|
| Resolver al cargar `oferta.js` | Cambio mínimo; el modelo se carga durante el arranque de Express | **Elegida**: throw en producción; random + warning fuera de producción |
| Nuevo módulo de configuración | Aísla la política, pero agrega una abstracción de un solo uso | Descartada |

### Decisión: whitelist de errores HTTP

| Opción | Tradeoff | Decisión |
|---|---|---|
| Mapear solo códigos conocidos | Los códigos nuevos deben declararse explícitamente | **Elegida**: `CURSOR_SINCRONIZACION_INVALIDO` → 400; `SINCRONIZACION_INVALIDADA` → 409; resto → throw |
| Convertir todo rechazo a 4xx | Oculta fallos internos como errores del cliente | Descartada |

## Flujo de datos

```text
Cancelar UI → Subject.next() → takeUntil completa la suscripción
                              → HttpClient aborta la request
                              → catch reconoce cancelación
                              → conserva cursor confirmado + estado cancelada
                              → NO ejecuta listado legacy

GET sincronización → controlador → modelo/PG
    error conocido → 400/409 JSON
    error inesperado ─────────→ middleware global → 500 genérico
```

## Cambios de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `frontend/src/app/paginas/dashboard/dashboard.ts` | Modificar | Notificador `takeUntil`, aborto y rama de cancelación sin fallback legacy. |
| `frontend/src/app/paginas/dashboard/dashboard.spec.ts` | Modificar | Probar request pendiente, cursor confirmado, estado y ausencia de fallback. |
| `frontend/src/app/servicios/ofertas.service.spec.ts` | Modificar | Verificar que unsubscribe marca cancelada la request de `HttpTestingController`. |
| `backend/src/modelos/oferta.js` | Modificar | Política fail-fast/fallback del secreto y warning existente. |
| `backend/src/controladores/controlador-ofertas.js` | Modificar | Whitelist 400/409 y propagación de errores inesperados. |
| `backend/tests/modelos/sincronizacion-ofertas.test.js` | Modificar | Recarga aislada del módulo, estabilidad del secreto, warning y rollback/release. |
| `backend/tests/controladores/controlador-ofertas.test.js` | Modificar | Regresión Supertest para 400, 409 y 500 genérico. |
| `backend/.env.example` | Modificar | Documentar `CURSOR_SINCRONIZACION_SECRETO`. |
| `docs/arquitectura.md`, `docs/api-rest.md`, `docs/frontend.md` | Modificar | Política operativa, taxonomía y cancelación efectiva. |

## Interfaces / contratos

- `OfertasService.obtenerBloqueSincronizacion(limite, cursor)` no cambia.
- Producción MUST definir un `CURSOR_SINCRONIZACION_SECRETO` no vacío antes de arrancar.
- Desarrollo/test MAY usar secreto efímero, siempre con warning; esos cursores no sobreviven reinicios.
- Cancelar MUST preservar el último bloque confirmado y MUST NOT iniciar `GET /api/ofertas` legacy.
- Un `500` MUST usar el mensaje genérico del middleware y no filtrar PostgreSQL.

## Estrategia de testing

| Capa | Qué probar | Enfoque |
|---|---|---|
| Unit frontend | Teardown HTTP, cancelación y reanudación | Observable pendiente + spy de teardown; `HttpTestingController.cancelled`. |
| Unit backend | Secreto estable/diferente/ausente y limpieza PG | Cargas aisladas con env controlado; mocks de cliente. |
| Integración HTTP | Taxonomía 400/409/500 | Supertest sobre Express y middleware real. |
| E2E | Sin flujo nuevo | No agregar; component e integración cubren las fronteras modificadas. |

## Matriz de amenazas

N/A — no se modifican rutas, shell, subprocesos, automatización VCS/PR, clasificación de ejecutables ni límites de integración de procesos; solo el comportamiento de un endpoint existente y la cancelación cliente.

## Migración / rollout

No requiere migración de datos. Configurar el secreto en producción antes del deploy; cambiarlo invalida cursores pendientes, que deberán reiniciarse.

## Preguntas abiertas

Ninguna.
