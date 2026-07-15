# Propuesta: Estado operativo de cancelación de sincronización

## Intención

Cerrar el bloqueo `session-cancelled-observability-missing-fecha_corte-maxId-counts` del [verify predecesor](../cerrar-alcance-ofertas-prioridad-ia/verify-report.md). Una sincronización cancelada debe conservar un estado verificable sin convertir el cursor firmado ni PostgreSQL en una sesión persistente.

## Alcance

### Incluido
- Exponer por bloque `fecha_corte`, `max_id` y `total_inicial`, nunca firma, `ultimo_id` ni datos internos del cursor.
- Acumular `recibidos` como IDs únicos y `duplicados` como filas previamente acumuladas.
- Al cancelar, congelar metadatos, conteos y cursor confirmado con `estado='cancelada'`, sin falso éxito.
- Mostrar y consultar ese estado en el dashboard mediante texto accesible.
- Probar contrato backend, conteos, cancelación y reanudación.

### Excluido
- Nuevas tablas, migraciones, sesiones persistentes o endpoints.
- Persistencia del estado cancelado tras recargar.
- Piloto, cron, scrapers, migración 019 o esquema PostgreSQL.

## Capacidades

### Capacidades nuevas
Ninguna.

### Capacidades modificadas
- `sincronizacion-ofertas`: metadatos públicos estables por bloque y estado local cancelado con conteos coherentes.
- `interfaz-usuario`: cancelación, snapshot y progreso visibles sin aparentar finalización exitosa.

## Enfoque

Ampliar `obtenerBloqueSincronizacion()` y el JSON del endpoint existente. El dashboard mantendrá un único estado operativo local y contará durante la deduplicación. Solo marcará `completada` cuando los IDs únicos alcancen `total_inicial`; cancelar detendrá nuevos requests y preservará el cursor confirmado para reanudar.

## Áreas afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `backend/src/modelos/oferta.js` | Modificado | Metadatos seguros del snapshot |
| `backend/src/controladores/controlador-ofertas.js` | Modificado | Contrato HTTP vigente |
| `frontend/src/app/modelos/respuesta-api.model.ts` | Modificado | Tipos de bloque y estado |
| `frontend/src/app/paginas/dashboard/` | Modificado | Conteos, cancelación y vista |
| `backend/tests/`, `frontend/src/app/**/*.spec.ts` | Modificado | Contrato y flujo runtime |
| `docs/api-rest.md`, `docs/frontend.md` | Modificado | Semántica pública y local |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Conteos inconsistentes | Media | Contar antes de mutar el mapa y probar definiciones |
| Filtración del cursor | Baja | Lista permitida y test de contrato |
| Cancelación como éxito | Media | Estados excluyentes y assertions de UI |

## Plan de rollback

Revertir los campos, el estado local y su bloque visual. El endpoint, cursor, listado e IndexedDB vigentes permanecen compatibles y no requieren rollback de datos.

## Dependencias

- Sincronización por bloques y cursor firmado del cambio predecesor.

## Criterios de éxito

- [ ] Cada bloque devuelve metadatos estables sin secretos del cursor.
- [ ] Cancelar conserva estado, cursor, únicos y duplicados sin informar éxito.
- [ ] Reanudar completa sin IDs duplicados.
- [ ] Tests backend/frontend y build Angular pasan dentro de 400 líneas modificadas.
