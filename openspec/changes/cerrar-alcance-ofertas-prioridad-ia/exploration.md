# Exploration: cerrar-alcance-ofertas-prioridad-ia

## Current State

El cambio sucesor debe cerrar únicamente los bloqueos de alcance, evidencia y un bug de persistencia del cambio `ofertas-30-dias-prioridad-ia`. La implementación efectiva ya cubre prioridad IA, migración 018, backfill, ranking, cursor de sincronización, IndexedDB/fallback y UI; el piloto GetOnBrd, la migración 019, checkpoints, métricas de cobertura y cambios de cron fueron diferidos por `tasks.md`, pero siguen siendo obligaciones normativas en las delta specs de `automatizacion` y `cobertura-scraping`. Esa contradicción es el bloqueo principal.

El review binding aprobado `review-0ef0b036643c8eec-scope2` (generation 2) quedó transportado en `verify-report.md`. Su verificación confirmó tres bloqueos: alcance piloto no formalmente removido, ocho escenarios de las slices entregadas sin evidencia runtime completa y reset defectuoso de IndexedDB. El sucesor debe formalizar el piloto como fuera de alcance, sin reabrirlo ni implementarlo.

El bug está confirmado en runtime: `Dashboard.sincronizarOfertas()` llama `limpiarSincronizacion()` al iniciar un snapshot sin cursor, pero `PersistenciaDashboardService.limpiarSincronizacion()` solo vacía el `Map` y restablece el fallback. No elimina las filas del object store `ofertas` de IndexedDB. Por eso un snapshot nuevo puede rehidratar IDs antiguos antes de fusionar los bloques nuevos.

La evidencia DB actual ya no coincide con `apply-progress.md`. El reporte de verify enlaza un runtime seguro local `busca_empleos_test` como `marcos`, sin Railway: migración 018 aplicada dos veces, constraints verificadas, backfill `dry-run`/`--apply` limitado a 30 días, cursor real y suite DB de 5 suites/65 tests. `tasks.md` también marca 3.1 completa; `apply-progress.md` todavía conserva el bloqueo histórico de ownership y debe sincronizarse en el trabajo principal del sucesor.

No existe `openspec/config.yaml` en el workspace; se usaron las convenciones efectivas de `openspec/changes/` y la evidencia existente. El working tree contiene cambios ajenos y archivos sensibles no leídos; esta exploración no modifica ninguno.

## Affected Areas

- `openspec/changes/ofertas-30-dias-prioridad-ia/specs/automatizacion/spec.md` — contiene los dos escenarios normativos del piloto que deben quedar explícitamente fuera de este cambio.
- `openspec/changes/ofertas-30-dias-prioridad-ia/specs/cobertura-scraping/spec.md` — contiene los tres requisitos y cinco escenarios de cobertura/checkpoints que deben trasladarse a otro cambio.
- `openspec/changes/ofertas-30-dias-prioridad-ia/specs/evaluacion-ia/spec.md` — requiere evidencia runtime del flujo evaluación → persistencia y aislamiento de prompt injection.
- `openspec/changes/ofertas-30-dias-prioridad-ia/specs/interfaz-usuario/spec.md` y `preferencias-usuario/spec.md` — requieren pruebas runtime de fallback y de evidencia accesible renderizada.
- `openspec/changes/ofertas-30-dias-prioridad-ia/specs/sincronizacion-ofertas/spec.md` — requiere cancelación/reanudación, fallback persistente y observabilidad; también fija el contrato que hace necesario probar el reset del snapshot.
- `frontend/src/app/servicios/persistencia-dashboard.service.ts` — `limpiarSincronizacion()` debe limpiar el object store IndexedDB antes de rehidratar un snapshot nuevo; el cambio debe conservar el fallback `Map`.
- `frontend/src/app/paginas/dashboard/dashboard.ts` — único caller del reset y orquestador de cancelación, reanudación, progreso, conteo y mensajes de fallback.
- `frontend/src/app/servicios/persistencia-dashboard.service.spec.ts` — lugar mínimo para una prueba runtime que demuestre que un snapshot nuevo no rehidrata filas antiguas.
- `frontend/src/app/paginas/dashboard/dashboard.spec.ts` — lugar mínimo para cancelación/reanudación, progreso, fallback visible y estado de finalización.
- `backend/src/servicios/servicio-evaluacion.js`, `backend/src/modelos/oferta.js` y `backend/tests/servicios/servicio-evaluacion.test.js` — flujo evaluación, detector y persistencia de prioridad sin mutar `match` ni `porcentaje_match`.
- `frontend/src/app/componentes/tabla-ofertas/`, `frontend/src/app/componentes/detalle-oferta/` y sus specs — renderizado seguro y accesible de prioridad/evidencias.
- `openspec/changes/ofertas-30-dias-prioridad-ia/apply-progress.md` — evidencia stale: debe reflejar la prueba DB actual y retirar el bloqueo histórico de permisos.
- `openspec/changes/ofertas-30-dias-prioridad-ia/verify-report.md` — fuente de evidencia del bug, del binding aprobado y del inventario de escenarios faltantes; no debe reabrirse ni reescribirse desde esta fase.

## Approaches

1. **Sucesor correctivo mínimo** — Modificar las delta specs del cambio principal para remover formalmente piloto/cobertura/checkpoints/migración 019 de su alcance, corregir el reset IndexedDB, agregar solo pruebas runtime de las slices entregadas y actualizar `apply-progress` con la evidencia DB ya existente.
   - Pros: resuelve exactamente los tres blockers confirmados; mantiene el piloto fuera del PR; aprovecha evidencia ya producida; menor riesgo y revisión acotada.
   - Cons: el comportamiento de observabilidad de sincronización todavía debe tener una prueba y, si falta estado operativo real, puede requerir una pequeña aclaración de contrato antes de probarlo.
   - Effort: Medium

2. **Reabrir el cambio original para implementar el piloto** — Mantener las specs normativas y agregar GetOnBrd, migración 019, checkpoints y métricas ahora.
   - Pros: conserva todos los requisitos originales en un único cambio.
   - Cons: contradice la autorización explícita de diferir el piloto; aumenta superficie, riesgo y revisión; vuelve a mezclar cobertura externa no probada con slices ya implementadas.
   - Effort: High

## Recommendation

Elegir el sucesor correctivo mínimo. En la fase de propuesta/spec debe declarar como `REMOVED` o `MODIFIED` las obligaciones de piloto, cobertura, checkpoints, métricas y migración 019, con migración explícita a otro cambio futuro. No debe tocar el cron ni agregar código de scraping.

Para cerrar el alcance entregado, el mínimo runtime necesario es:

1. Evaluación → persistencia: fixture compatible con señal IA; mock de DeepSeek; afirmar `prioridad_ia`/evidencias persistidas y `match`/`porcentaje_match` sin cambios.
2. Prompt injection: descripción que intenta instruir al evaluador; afirmar que no altera exclusiones, match ni porcentaje y que solo puede producir evidencia segura.
3. Fallbacks: preferencia legacy/inaccesible y almacenamiento persistente fallido; afirmar orden vigente, exclusiones conservadas, progreso y mensaje de fallback.
4. Render accesible: renderizar tabla y detalle; afirmar texto de evidencia, ausencia de interpretación como aprobación/match y bindings ARIA relevantes.
5. Cancelación/reanudación: confirmar bloques, cancelar, reanudar y afirmar no duplicados, conteo y progreso consistentes.
6. Observabilidad: cancelar una sesión y afirmar estado/motivo, `fecha_corte`/`maxId`, total inicial, recibidos, duplicados y ausencia de éxito falso. Este escenario es necesario porque sigue siendo normativo en sincronización; si no existe estado operativo suficiente, la propuesta debe incluir el mínimo contrato/estado requerido, no marcarlo cubierto por inspección estática.
7. Reset IndexedDB: persistir una fila vieja, iniciar snapshot nuevo, limpiar, guardar una fila nueva y afirmar que `getAll()` solo rehidrata la fila nueva. Esta prueba debe acompañar la corrección y no sustituirse por un test exclusivo del `Map`.

Los tests unitarios existentes de detector/parser/ranking y los harnesses DB ya cubren sus contratos específicos; no hace falta duplicarlos como E2E. Tampoco hace falta ningún test de piloto en este sucesor: esas pruebas pertenecen al cambio futuro que implemente cobertura externa.

`apply-progress.md` debe quedar con 3.1 completa y registrar, como mínimo, el comando de suite DB, el runtime `busca_empleos_test`, migración repetible, constraints, backfill acotado y cursor real. Debe eliminar las líneas que dicen que ownership bloquea la prueba y conservar la guarda `_test` y la prohibición de Railway.

## Risks

- Remover obligaciones de specs sin dejar una referencia explícita al cambio futuro puede hacer que el piloto se pierda del roadmap o vuelva a aparecer como requisito implícito.
- Limpiar IndexedDB es asíncrono; si el caller no espera la operación antes de solicitar el primer bloque, todavía puede existir una carrera de rehidratación.
- El frontend actualmente usa un `Map` como acumulador y IndexedDB como fuente adicional; la prueba debe validar el conjunto fusionado, no solamente el almacenamiento aislado.
- La observabilidad exigida por la spec puede no existir como estado operativo estructurado; un test no puede demostrar un contrato que la implementación no expone.
- `apply-progress.md` contiene evidencia histórica contradictoria; actualizarlo con hashes/comandos equivocados sería peor que dejarlo pendiente, por lo que solo debe copiarse evidencia ya presente en `verify-report.md` y Engram.
- El review binding aprobado es de la implementación anterior; el sucesor cambia formalmente el alcance y debe conservar su lineage como antecedente, sin fingir que la aprobación cubre un árbol futuro.

## Ready for Proposal

Yes. El orquestador debe crear una propuesta pequeña con relación explícita al cambio predecesor y al binding `review-0ef0b036643c8eec-scope2`, limitar el sucesor a formalización de alcance, corrección IndexedDB, tests runtime mínimos y sincronización de evidencia DB, y dejar fuera de forma normativa el piloto diferido. Después corresponden `sdd-spec` y `sdd-design`; no debe lanzarse apply hasta que el contrato asíncrono del reset y el escenario de observabilidad estén definidos.
