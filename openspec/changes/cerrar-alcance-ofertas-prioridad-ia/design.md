# Diseño: Cerrar alcance de ofertas con prioridad IA

## Enfoque técnico

Aplicar una corrección mínima sobre `ofertas-30-dias-prioridad-ia`: quitar del contrato vigente el piloto diferido, convertir el reset de sincronización en una operación asíncrona esperada y completar únicamente la evidencia runtime faltante. Se conservan IndexedDB nativo, el `Map` de fallback, el cursor opaco y los tests Jest/Jasmine existentes; no se agregan dependencias, piloto, migraciones ni feature flags. Estimación: 300–380 líneas authored.

## Decisiones de arquitectura

| Opción | Trade-off | Decisión y razón |
|---|---|---|
| Borrar la base IndexedDB completa | Reinicia esquema y conexiones | Descartada; `objectStore.clear()` elimina solo el snapshot y conserva el esquema. |
| Reset síncrono y limpieza diferida | Menor cambio, mantiene la carrera | Descartada; el primer bloque podría mezclarse con filas antiguas. |
| `Promise<void>` + fallback nativo | Contrato asíncrono pequeño | Elegida; el caller espera la transacción y, si IndexedDB falla, continúa en memoria sin rehidratar datos persistidos viejos. |
| Nuevos E2E o librería IndexedDB | Mayor costo y duplicación | Descartada; Karma ejecuta IndexedDB real y los specs de componente cubren el runtime requerido. |

## Flujo de datos

    Snapshot nuevo (cursor=null)
        → limpiar Map
        → abrir IndexedDB
        → clear('ofertas')
        → esperar transaction.oncomplete
        → solicitar primer bloque
        → guardar/deduplicar → renderizar

Si IndexedDB no existe o falla, el reset activa fallback en memoria y resuelve en estado seguro. Una reanudación con cursor conserva los bloques confirmados y no ejecuta el reset.

## Cambios de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `frontend/src/app/servicios/persistencia-dashboard.service.ts` | Modificar | Hacer asíncrono el reset, limpiar el object store y cerrar la conexión. |
| `frontend/src/app/paginas/dashboard/dashboard.ts` | Modificar | Esperar el reset antes del primer request de un snapshot nuevo. |
| `frontend/src/app/servicios/persistencia-dashboard.service.spec.ts` | Modificar | Probar con IndexedDB real que una fila vieja no se rehidrata. |
| `frontend/src/app/paginas/dashboard/dashboard.spec.ts` | Modificar | Cubrir espera, fallback, preferencia inaccesible, cancelación/reanudación y observabilidad. |
| `backend/tests/servicios/servicio-evaluacion.test.js` | Modificar | Cubrir evaluación→persistencia y texto no confiable sin alterar match/porcentaje. |
| `frontend/src/app/componentes/{tabla-ofertas,detalle-oferta}/*.spec.ts` | Modificar | Verificar evidencia textual y atributos accesibles renderizados. |
| `openspec/changes/ofertas-30-dias-prioridad-ia/specs/{automatizacion,cobertura-scraping,sincronizacion-ofertas}/spec.md` | Modificar | Retirar obligaciones diferidas, referenciar un cambio futuro y fijar el reset esperado. |
| `openspec/changes/ofertas-30-dias-prioridad-ia/apply-progress.md` | Modificar | Reemplazar el bloqueo histórico por la evidencia `_test` ya verificada: migración 018 repetible, constraints, backfill, cursor y 5 suites/65 tests. |

## Interfaces y contratos

`limpiarSincronizacion(): Promise<void>` limpia primero el `Map`. Con IndexedDB disponible, resuelve solo al completar la transacción `readwrite` que ejecuta `clear()`; siempre cierra la base. Ante ausencia, error o aborto, activa `usandoFallbackMemoria` y resuelve sin permitir lecturas persistentes durante ese snapshot. `Dashboard` debe esperarlo únicamente cuando `cursorSincronizacion` sea nulo.

## Estrategia de pruebas

| Capa | Qué probar | Enfoque mínimo |
|---|---|---|
| Jest | Prioridad persistida y prompt injection aislada | Un fixture con señal IA y texto hostil; afirmar argumentos de `actualizarEvaluacion`, match y porcentaje. |
| Jasmine/Karma servicio | Reset persistente | Guardar ID viejo, resetear, guardar ID nuevo, recrear servicio y obtener solo el nuevo. |
| Jasmine/Karma dashboard | Flujo completo | Promesas controladas para probar orden reset→request, cancelación→reanudación sin duplicados, conteo/progreso, mensaje sin éxito falso y fallback. |
| Jasmine/Karma componentes | Accesibilidad | Renderizar tabla y detalle; afirmar evidencia visible y `aria-label`, sin presentarla como aprobación. |

## Threat Matrix

N/A — no hay routing nuevo, shell, subprocess, automatización VCS/PR, clasificación de ejecutables ni integración de procesos.

## Rollout, rollback y verificación

Entrega única, sin piloto ni migración. Rollback: revertir reset, tests y artifacts como unidad; el endpoint legacy y el esquema IndexedDB permanecen compatibles. Un store ya vaciado se repuebla en la siguiente sincronización.

Verificación focalizada: Jest de evaluación y Karma con los cuatro specs afectados. Verificación final: `npm --prefix backend test -- --runInBand`, `npm --prefix backend run test:db`, `npm --prefix frontend test -- --watch=false` y `npm --prefix frontend run build`. Confirmar además que `apply-progress.md` conserva la guarda `_test`, excluye Railway y no atribuye el receipt anterior al sucesor.

## Preguntas abiertas

Ninguna.
