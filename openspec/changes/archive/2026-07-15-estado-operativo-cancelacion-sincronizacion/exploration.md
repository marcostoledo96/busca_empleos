# Exploration: estado-operativo-cancelacion-sincronizacion

## Current State

Este cambio sucesor resuelve el único bloqueo restante de `cerrar-alcance-ofertas-prioridad-ia`: el escenario de sesión cancelada no expone ni prueba `fecha_corte`, `maxId`, total inicial, recibidos y duplicados.

El predecesor implementa una sincronización por bloques con cursor firmado y snapshot lógico. `obtenerBloqueSincronizacion()` fija `fecha_corte`, `max_id` y `total` dentro del cursor, pero actualmente devuelve únicamente `datos`, `total`, `cursor_siguiente` y `completada`. El backend no mantiene una sesión operativa cancelable: la cancelación ocurre exclusivamente en `Dashboard`, antes del siguiente request, y se informa mediante `mensajeEstado`. Por eso el bloqueo no se resuelve agregando solo assertions; falta un contrato de metadatos y estado.

La opción mínima compatible es transportar metadatos del snapshot en cada respuesta de bloque y mantener en el dashboard un estado operativo local. Al cancelar, el dashboard debe congelar el último snapshot recibido, marcarlo `cancelada`, conservar `fecha_corte`, `maxId`, `totalInicial`, `recibidos` y `duplicados`, y no marcar éxito ni limpiar el cursor confirmado. Los recibidos deben representar IDs únicos acumulados; los duplicados, filas del bloque que ya estaban acumuladas. El backend puede derivar `fecha_corte`, `maxId` y total desde el cursor/snapshot; el frontend debe calcular conteos porque la deduplicación ocurre en IndexedDB/Map.

No hace falta introducir una tabla, una migración, una sesión persistente en PostgreSQL ni un endpoint de polling separado: la cancelación no llega al backend y el estado operativo que observa el usuario pertenece a la transferencia del cliente. Esta decisión mantiene el alcance sucesor quirúrgico y conserva el endpoint histórico.

## Affected Areas

- `backend/src/modelos/oferta.js` — ampliar el resultado de `obtenerBloqueSincronizacion()` con metadatos de snapshot (`fecha_corte`, `maxId`, `totalInicial`) sin exponer el cursor firmado.
- `backend/src/controladores/controlador-ofertas.js` — conservar el contrato HTTP de éxito y trasladar los metadatos del modelo; revisar que errores de cursor/invalidación no parezcan éxito.
- `backend/tests/modelos/sincronizacion-ofertas.test.js` — probar metadatos estables entre bloques, `maxId`/`fecha_corte` y total inicial.
- `backend/tests/controladores/controlador-ofertas.test.js` o suite equivalente — probar el JSON de sincronización y la ausencia de éxito en invalidación.
- `frontend/src/app/modelos/respuesta-api.model.ts` — tipar metadatos y el estado operativo (`en_progreso`, `cancelada`, `completada`, `invalidada` si el flujo ya lo usa).
- `frontend/src/app/servicios/ofertas.service.ts` — consumir el contrato extendido sin cambiar la ruta ni el cursor opaco.
- `frontend/src/app/paginas/dashboard/dashboard.ts` — mantener estado operativo, acumular IDs únicos/duplicados, congelar metadatos al cancelar y evitar falso éxito.
- `frontend/src/app/paginas/dashboard/dashboard.html` — mostrar estado cancelado y sus metadatos/conteos mediante texto accesible, sin presentar cancelación como finalización exitosa.
- `frontend/src/app/paginas/dashboard/dashboard.spec.ts` — cubrir cancelación observable, conteos consistentes, metadata, reanudación y ausencia de éxito falso.
- `frontend/src/app/servicios/ofertas.service.spec.ts` — ajustar/añadir contrato tipado del bloque, si la suite existente cubre HTTP.
- `docs/api-rest.md` — documentar los campos agregados de la respuesta de sincronización y su semántica.
- `docs/frontend.md` — documentar el estado operativo local del dashboard y la diferencia entre cancelación y completitud.

## Approaches

1. **Metadatos por bloque + estado operativo local** — El backend devuelve metadata del snapshot en cada bloque; el dashboard calcula recibidos/duplicados durante la deduplicación y conserva un objeto operativo al cancelar.
   - Pros: mínimo cambio; no agrega persistencia ni endpoint; refleja correctamente que la cancelación sucede en el cliente; compatible con el cursor existente y el fallback IndexedDB/Map.
   - Cons: el estado cancelado no sobrevive a un reload; conteos son client-side y requieren definir claramente IDs únicos frente a filas recibidas.
   - Effort: Medium

2. **Sesión operativa persistida en backend + endpoint de estado/cancelación** — Crear una identidad de sincronización y almacenar/consultar estado, conteos y cancelación desde API.
   - Pros: estado consultable y durable desde cualquier cliente; backend sería autoridad de conteos.
   - Cons: cambia el modelo stateless del cursor, requiere almacenamiento/limpieza/concurrencia, agrega endpoints y superficie de seguridad; sobredimensiona un bloqueo de UI local.
   - Effort: High

3. **Solo ampliar el mensaje de cancelación** — Formatear metadata ya disponible en el dashboard sin cambiar la respuesta API.
   - Pros: menor diff.
   - Cons: no cumple el contrato API/frontend de metadata; `fecha_corte` y `maxId` siguen ocultos dentro del cursor; no demuestra conteos recibidos/duplicados ni ofrece estado estructurado.
   - Effort: Low

## Recommendation

Elegir **metadatos por bloque + estado operativo local**. Es la única alternativa que cierra el bloqueo sin convertir una transferencia cancelable del navegador en un subsistema persistente. El contrato debería usar nombres explícitos y consistentes: `fecha_corte`, `max_id` en JSON backend y `maxId` solo como adaptación TypeScript si la convención actual lo exige; preferentemente conservar `max_id` end-to-end para evitar una traducción innecesaria. El estado operativo debe separar `estado: 'cancelada'` de `completada: false`.

El escenario runtime mínimo debe: consumir un primer bloque con metadata, persistir/confirmar sus IDs, provocar duplicación en un bloque posterior, cancelar antes del siguiente request, afirmar `estado='cancelada'`, `fecha_corte`, `max_id`, `total_inicial`, `recibidos` únicos y `duplicados`, y verificar que no se muestra ni se registra completitud. Luego debe reanudar desde el cursor confirmado y finalizar sin IDs duplicados. Agregar un test de contrato HTTP para metadata evita que el frontend pase solo por datos inventados.

La implementación debe limitarse a API, modelo frontend, dashboard, tests y documentación contractual. No debe tocar el piloto diferido, migración 019, cron, scrapers, esquema PostgreSQL ni el reset IndexedDB ya verificado.

## Risks

- Confundir `recibidos` con filas brutas del bloque en vez de IDs únicos produciría porcentajes y progreso inconsistentes; la spec debe fijar ambas definiciones.
- Si se calcula duplicado después de reemplazar el `Map`, el conteo se pierde; debe medirse antes de insertar y conservarse por snapshot.
- Un reload del navegador pierde el estado cancelado local; si se vuelve requisito, eso sería un cambio de alcance que justificaría la alternativa persistida.
- Cambiar `max_id` a `maxId` solo en una capa puede romper contratos existentes o generar dos nombres; conviene elegir una convención y probarla en backend/frontend.
- El cursor sigue siendo opaco: metadata pública no debe incluir firma, `ultimo_id` ni otros campos internos.
- La respuesta de un bloque completado puede conservar metadata, pero `estado='completada'` solo debe establecerse después de validar `recibidos === totalInicial`; cancelación nunca puede reutilizar ese camino.

## Ready for Proposal

Yes. La propuesta debe enlazar explícitamente el `verify-report.md` del predecesor, declarar que este cambio solo remedia `session-cancelled-observability-missing-fecha_corte-maxId-counts`, elegir el contrato por bloque con estado local y fijar las definiciones de conteo. Después corresponden `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply` y `sdd-verify`.
