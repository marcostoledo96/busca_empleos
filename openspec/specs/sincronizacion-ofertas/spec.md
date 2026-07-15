# Sincronización ofertas Specification

## Purpose

Mantener transferencias por bloques cancelables, reanudables y observables sin exponer datos internos del cursor.

## Requirements

### Requirement: Transferencia cancelable con almacenamiento resiliente

El cliente MUST informar progreso, permitir cancelación y reanudar solo desde un estado consistente. Debe usar almacenamiento persistente disponible y MUST usar memoria como fallback si este falla, sin detener el dashboard ni duplicar filas. Al iniciar un snapshot nuevo sin cursor, MUST esperar que se limpien memoria e IndexedDB antes de rehidratar o descargar bloques. Al cancelar una transferencia activa, MUST conservar el último cursor confirmado, metadatos y conteos del snapshot con `estado='cancelada'` y `completada=false`; solo SHALL establecer `completada` cuando los IDs únicos recibidos igualen `total_inicial`.

#### Scenario: cancelación y reanudación
- GIVEN bloques confirmados y una transferencia aún activa
- WHEN el usuario cancela y luego reanuda desde el cursor confirmado
- THEN MUST conservar solo los bloques confirmados con estado `cancelada`
- AND MUST finalizar sin IDs duplicados cuando los únicos alcancen el total inicial.

#### Scenario: falla de almacenamiento persistente
- GIVEN el almacenamiento local no está disponible o agota cuota
- WHEN llegan nuevos bloques válidos
- THEN MUST continuar en memoria, informar el fallback y mantener progreso verificable.

#### Scenario: snapshot nuevo no rehidrata IDs previos
- GIVEN una fila previa persistida y un snapshot nuevo sin cursor
- WHEN termina el reset antes del primer bloque y se persiste una fila nueva
- THEN la rehidratación MUST contener solo la fila nueva.

### Requirement: Observabilidad y rollback de sincronización

El sistema MUST devolver por cada bloque `fecha_corte`, `max_id` y `total_inicial` estables del snapshot, además del cursor opaco vigente. MUST NOT exponer firma, `ultimo_id` ni otro dato interno del cursor. El dashboard MUST acumular `recibidos` como IDs únicos y `duplicados` como filas entrantes cuyo ID ya estaba acumulado antes de procesarlas. Debe conservar esos valores al cancelar. Deshabilitar la sincronización nueva MUST conservar el endpoint y comportamiento de listado existentes; MUST NOT agregar endpoints, tablas, migraciones ni sesiones persistentes.

#### Scenario: metadatos públicos seguros y estables
- GIVEN dos bloques del mismo snapshot
- WHEN se consulta cada respuesta del endpoint vigente
- THEN MUST devolver el mismo `fecha_corte`, `max_id` y `total_inicial`
- AND MUST NOT devolver firma, `ultimo_id` ni datos internos del cursor.

#### Scenario: sesión cancelada es observable
- GIVEN IDs únicos acumulados y filas duplicadas detectadas antes de cancelar
- WHEN se consulta el estado operativo local
- THEN MUST mostrar `cancelada`, `fecha_corte`, `max_id`, total inicial, recibidos y duplicados consistentes
- AND MUST conservar `completada=false` sin informar éxito.
