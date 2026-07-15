# Diseño: Estado operativo de cancelación de sincronización

## Enfoque técnico

Ampliar el resultado de `obtenerBloqueSincronizacion()` con metadatos ya presentes en el snapshot (`fecha_corte`, `max_id`, `total_inicial`) y reutilizar el `...resultado` del controlador y la ruta actuales. En Angular, un `Set<number>` contará IDs únicos antes de persistir cada bloque y un único estado operativo local conservará metadatos, recibidos y duplicados al cancelar. No se agregan consultas, dependencias, persistencia, endpoint ni CSS. Estimación: 220–320 líneas modificadas, dentro del límite de 400.

## Decisiones de arquitectura

| Opción | Trade-off | Decisión y razón |
|---|---|---|
| Sesión persistida o endpoint de cancelación | Estado durable, pero agrega identidad, limpieza y concurrencia | Descartada; cancelar es una decisión local entre requests y el cursor ya permite reanudar. |
| Metadatos dentro de `datos` | Evita campos superiores, pero mezcla ofertas con control de transferencia | Descartada; se agregan campos superiores al endpoint existente. |
| Reutilizar `total` o reemplazarlo | Reemplazarlo rompe consumidores; omitir `total_inicial` no cierra el contrato | Se conserva `total` como compatibilidad y se agrega `total_inicial` con el mismo valor. |
| Contar desde IndexedDB después de guardar | Refleja almacenamiento, pero pierde qué filas eran duplicadas | Se cuenta antes de mutar: `Set` para únicos y contador acumulado para IDs ya vistos. |
| Estado local estructurado | Se pierde al recargar, pero evita duplicar backend | Elegido; `null` representa inactividad y los estados son excluyentes: `en_progreso`, `cancelada`, `completada`, `fallida`. |

## Flujo de datos

    GET /api/ofertas/sincronizacion
      → modelo devuelve bloque + metadata pública
      → controlador existente propaga el resultado
      → Dashboard cuenta IDs antes de guardar
      → IndexedDB/Map confirma bloque
      → conserva cursor + actualiza estado operativo
      ├─ cancelación: congela estado y no hace otro request
      └─ completitud: solo si recibidos === total_inicial

Un snapshot nuevo limpia almacenamiento, `Set` y contadores. Reanudar con el cursor confirmado conserva esos acumuladores en la misma instancia del dashboard.

## Cambios de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `backend/src/modelos/oferta.js` | Modificar | Devolver metadata segura sin nueva query ni exponer `firma`, `ultimo_id` o expiración. |
| `backend/tests/modelos/sincronizacion-ofertas.test.js` | Modificar | Probar metadata estable entre bloques y ausencia de internos del cursor. |
| `backend/tests/controladores/controlador-ofertas.test.js` | Modificar | Probar el JSON del endpoint existente y los errores sin falso éxito. |
| `frontend/src/app/modelos/respuesta-api.model.ts` | Modificar | Tipar metadata y estado operativo local. |
| `frontend/src/app/paginas/dashboard/dashboard.ts` | Modificar | Mantener `Set`, conteos, cursor confirmado y transiciones de estado. |
| `frontend/src/app/paginas/dashboard/dashboard.html` | Modificar | Mostrar estado, corte, máximo y conteos como texto accesible. |
| `frontend/src/app/paginas/dashboard/dashboard.spec.ts` | Modificar | Cubrir conteo, cancelación observable y reanudación. |
| `frontend/src/app/servicios/ofertas.service.spec.ts` | Modificar | Verificar que el contrato tipado transporta metadata sin cambiar URL. |
| `docs/api-rest.md` | Modificar | Documentar campos públicos y campos internos prohibidos. |
| `docs/frontend.md` | Modificar | Documentar estado local y semántica de conteos/cancelación. |

`backend/src/controladores/controlador-ofertas.js`, `frontend/src/app/servicios/ofertas.service.ts`, rutas y estilos quedan sin cambios: sus contratos genéricos y propagación actuales ya alcanzan.

## Interfaces / Contratos

```typescript
export interface RespuestaSincronizacionOfertas<T> extends RespuestaApi<T[]> {
    fecha_corte: string;
    max_id: number;
    total_inicial: number;
    cursor_siguiente: string | null;
    completada: boolean;
}

export interface EstadoOperativoSincronizacion {
    estado: 'en_progreso' | 'cancelada' | 'completada' | 'fallida';
    fecha_corte: string;
    max_id: number;
    total_inicial: number;
    recibidos: number;
    duplicados: number;
}
```

`recibidos` es `idsRecibidos.size`. `duplicados` aumenta por cada fila cuyo ID ya estaba en el `Set`. El cursor solo avanza después de guardar el bloque. `completada` exige respuesta final y `recibidos === total_inicial`; cancelar nunca ejecuta esa transición.

## Estrategia de pruebas

| Capa | Qué probar | Enfoque |
|---|---|---|
| Jest modelo | Metadata estable y sanitizada | Dos bloques del mismo cursor; igualdad de metadata y ausencia de internos. |
| Supertest controlador | Contrato HTTP vigente | Afirmar metadata en 200 y `exito: false` en cursor inválido/409. |
| Jasmine servicio | Transporte tipado | Mantener ruta y query params; inspeccionar metadata recibida. |
| Jasmine componente | Runtime completo | Dos bloques controlados, un ID repetido, cancelación tras bloque confirmado, texto accesible y reanudación hasta completar. |
| E2E | N/A | El flujo vive en el componente y queda cubierto sin infraestructura nueva. |

Verificación: tests focalizados; luego `npm --prefix backend test -- --runInBand`, `npm --prefix frontend test -- --watch=false` y `npm --prefix frontend run build`.

## Threat Matrix

N/A — no hay cambios de routing, shell, subprocess, automatización VCS/PR, clasificación de ejecutables ni integración de procesos; se conserva la ruta HTTP existente.

## Migración / Rollout

Sin migración ni feature flag. Rollback: revertir metadata, estado, tests y documentación como unidad; PostgreSQL, IndexedDB y endpoints permanecen compatibles.

## Preguntas abiertas

Ninguna.
