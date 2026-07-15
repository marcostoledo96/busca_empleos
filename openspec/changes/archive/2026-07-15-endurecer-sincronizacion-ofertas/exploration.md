## Exploration: endurecer-sincronizacion-ofertas

### Current State
La rama `fix/endurecer-sincronizacion-ofertas` está alineada con `master` en `0547c1f` y no tiene una implementación parcial del cambio. El issue aprobado #1 confirma tres fallos operativos: la cancelación no aborta una petición HTTP pendiente, el secreto de firma del cursor cae a un valor aleatorio por proceso y los errores inesperados de PostgreSQL se clasifican como `400`.

El flujo vigente es:

```text
Dashboard.cargarDatos()
  -> Dashboard.sincronizarOfertas()
  -> OfertasService.obtenerBloqueSincronizacion()
  -> GET /api/ofertas/sincronizacion
  -> controlador-ofertas.sincronizarOfertas()
  -> modelo-oferta.obtenerBloqueSincronizacion()
  -> pool.connect() + transacción REPEATABLE READ + consultas PostgreSQL
```

En el frontend, `cancelarSincronizacion()` solo activa `cancelarSincronizacionSolicitada`; el flag se verifica antes de iniciar cada bloque, no mientras `firstValueFrom(...)` espera la respuesta. Por lo tanto, la solicitud activa sigue viva. El cursor se actualiza después de recibir y persistir el bloque, lo que ofrece un punto correcto de confirmación, pero el camino de cancelación durante la espera cae en el `catch`, marca la sesión como `fallida` y ejecuta el fallback legacy.

En el backend, `oferta.js` define `CURSOR_SINCRONIZACION_SECRETO || crypto.randomBytes(...)` al cargar el módulo. El HMAC funciona dentro de un proceso, pero un reinicio sin la variable de entorno cambia la clave y vuelve inválidos los cursores emitidos previamente. `backend/.env.example` y `docs/arquitectura.md` no documentan esta variable.

El controlador ya responde `400` para `limite` inválido, `400` para `CURSOR_SINCRONIZACION_INVALIDO` y `409` para `SINCRONIZACION_INVALIDADA`, pero actualmente convierte cualquier otro rechazo del modelo —incluidos fallos de conexión o query de PostgreSQL— en `400`. El middleware global ya tiene el comportamiento correcto para errores no clasificados: `500` con mensaje genérico.

### Affected Areas
- `frontend/src/app/paginas/dashboard/dashboard.ts` — dueño del loop de bloques, flag de cancelación, cursor confirmado, estados operativos y fallback; debe abortar la petición activa y distinguir cancelación de fallo.
- `frontend/src/app/servicios/ofertas.service.ts` — único wrapper de `HttpClient` para el endpoint; debe aceptar y propagar una señal de cancelación sin duplicar lógica HTTP.
- `frontend/src/app/modelos/respuesta-api.model.ts` — contrato público de la respuesta de sincronización; revisar solo si el tratamiento explícito de errores/cancelación requiere un tipo adicional.
- `frontend/src/app/paginas/dashboard/dashboard.spec.ts` — ya cubre cancelación lógica, reanudación, reset y deduplicación, pero no verifica que una petición pendiente sea abortada ni que la cancelación no active fallback legacy.
- `frontend/src/app/servicios/ofertas.service.spec.ts` — punto natural para probar que la señal llega a la request Angular o que la suscripción se cancela correctamente.
- `backend/src/modelos/oferta.js` — firma/lectura del cursor y transacción; el secreto debe ser estable entre procesos y los tests deben aislar cargas de módulo/reinicios.
- `backend/src/controladores/controlador-ofertas.js` — frontera HTTP donde deben quedar explícitos `400` (input/cursor), `409` (snapshot invalidado) y propagación de errores internos para el middleware `500`.
- `backend/tests/modelos/sincronizacion-ofertas.test.js` — cobertura actual de recorrido, metadatos e invalidación; falta estabilidad de firma entre reinicios y rollback ante error de PostgreSQL.
- `backend/tests/controladores/controlador-ofertas.test.js` — ya cubre límites, cursor inválido e invalidación; falta verificar que un rechazo de PostgreSQL produzca `500` y no `400`.
- `backend/.env.example` — debe incluir un placeholder/documentación operativa para `CURSOR_SINCRONIZACION_SECRETO`; no leer ni modificar `.env` real.
- `docs/api-rest.md` — documenta el endpoint y sus `400/409`, pero no la clasificación `500` para PostgreSQL ni la regla de estabilidad del secreto.
- `docs/arquitectura.md` — tabla de variables de entorno; falta el secreto estable de cursor.
- `docs/frontend.md` — describe cancelación/reanudación por bloques, pero no que cancelar debe interrumpir la petición HTTP activa ni el estado esperado durante esa interrupción.
- `docs/base-de-datos.md` — documenta el modelo y PostgreSQL; puede registrar que errores operativos del endpoint no son input inválido si se considera parte del contrato de persistencia.
- `openspec/specs/sincronizacion-ofertas/spec.md` — fuente normativa actual: exige transferencia cancelable, conservación del cursor confirmado y no comunicar éxito falso; no explicita todavía el aborto de la request ni la clasificación de errores internos.
- `openspec/changes/endurecer-sincronizacion-ofertas/exploration.md` — artefacto de esta fase; único archivo nuevo permitido por esta exploración.

Documentación leída: `AGENTS.md`, `docs/arquitectura.md`, `docs/api-rest.md`, `docs/base-de-datos.md`, `docs/frontend.md`, `docs/automatizacion.md`, `openspec/specs/sincronizacion-ofertas/spec.md` y la exploración previa `openspec/changes/ofertas-30-dias-prioridad-ia/exploration.md`. No existe `DOCUMENTACION/INDEX.md` ni `openspec/config.yaml` en este checkout.

### Approaches
1. **AbortController explícito en el flujo existente** — Crear un `AbortController` por sincronización, pasar su `signal` al wrapper de `HttpClient` y llamar `abort()` desde `cancelarSincronizacion()`. Tratar `AbortError`/cancelación como estado `cancelada`, conservar el cursor y salir sin fallback legacy; mantener la comprobación del flag antes de cada bloque como defensa adicional.
   - Pros: corrige la causa raíz con pocos archivos, reutiliza `HttpClient`/RxJS/AbortSignal nativos y preserva el punto de confirmación ya existente.
   - Cons: requiere definir el ciclo de vida del controller para reanudación y evitar que una request vieja afecte una sesión nueva.
   - Effort: Medium

2. **Cancelar solo la suscripción de RxJS** — Conservar el wrapper actual y guardar una `Subscription`/usar una composición RxJS que se complete al cancelar.
   - Pros: menor cambio aparente en la firma del servicio.
   - Cons: puede detener la entrega al componente sin demostrar que la petición HTTP subyacente fue abortada; no satisface de forma verificable el criterio del issue sobre HTTP pendiente.
   - Effort: Medium

3. **Clasificación centralizada de errores de sincronización** — Mantener la validación de `limite` en el controlador, clasificar solo códigos de dominio conocidos (`CURSOR_SINCRONIZACION_INVALIDO` → 400, `SINCRONIZACION_INVALIDADA` → 409) y delegar cualquier otro error al middleware global mediante `throw`/`next`.
   - Pros: mínimo cambio, evita exponer mensajes de PostgreSQL y usa el contrato de errores ya existente.
   - Cons: requiere tests que protejan la whitelist de errores 4xx; un código de dominio nuevo debe declararse explícitamente.
   - Effort: Low

4. **Secreto obligatorio en todos los entornos** — Eliminar el fallback aleatorio y exigir `CURSOR_SINCRONIZACION_SECRETO` al arrancar.
   - Pros: evita emitir cursores incompatibles por configuración accidental.
   - Cons: puede romper desarrollo/tests existentes si no se provee la variable; demanda actualizar `.env.example`, configuración de test y documentación.
   - Effort: Low/Medium

### Recommendation
Aplicar el enfoque combinado mínimo: `AbortController` explícito para cancelar la request activa; clasificación por whitelist de errores de dominio y propagación de PostgreSQL al middleware `500`; secreto estable configurable mediante `CURSOR_SINCRONIZACION_SECRETO`, con una política clara para tests y desarrollo. Mantener el snapshot/cursor confirmado actual: asignar el cursor solo después de persistir el bloque, y al cancelar durante una request conservar el último cursor ya confirmado sin marcar `completada` ni ejecutar el fallback legacy.

La cobertura mínima debe demostrar: (1) una request HTTP pendiente recibe abort y la sesión queda `cancelada`; (2) una sesión que emite un cursor en un proceso puede leerlo en otro proceso con el mismo secreto y lo rechaza con otro secreto; (3) cursor inválido sigue siendo `400`; (4) error PostgreSQL inesperado llega como `500`; y (5) suites backend/frontend y build pasan. No agregar endpoints, tablas, migraciones ni una abstracción nueva de almacenamiento.

### Risks
- Abortar una request antes de que el bloque se confirme puede dejar una transacción PostgreSQL abierta hasta que el servidor detecte la desconexión; el cambio debe validar también el comportamiento de rollback/release del modelo.
- El controller de `AbortController` debe invalidarse al completar o fallar la sesión para que una cancelación tardía no afecte una reanudación o un snapshot nuevo.
- Hacer obligatorio el secreto puede fallar temprano en entornos no configurados; debe decidirse explícitamente si desarrollo/test usa un valor documentado de test o si solo producción exige obligatoriedad.
- Un cursor persistido puede sobrevivir más que la duración actual de 30 minutos; la estabilidad entre reinicios no elimina la expiración ni la invalidación por mutaciones.
- El índice CodeGraph estaba congelado por un lock del proceso escritor; las conclusiones se confirmaron con lecturas directas de los archivos actuales. Conviene reindexar/sincronizar antes de diseño o implementación.
- El working tree ya contiene cambios locales/preexistentes: `.atl/*`, `PLANIFICACION.md` eliminado, `EXPLORACION_CV_UPDATE.md`, `PLAN_IMPLEMENTACION_OFERTAS_30_DIAS_PRIORIDAD_IA.md` y `.codegraph/`; no se incluyeron ni deben revertirse.

### Ready for Proposal
Yes — el alcance está suficientemente delimitado para `sdd-propose`. El proposal debería fijar la política de configuración del secreto (obligatorio solo en producción o obligatorio siempre), el contrato exacto de cancelación HTTP y la whitelist de errores 4xx antes de pasar a spec/design.
