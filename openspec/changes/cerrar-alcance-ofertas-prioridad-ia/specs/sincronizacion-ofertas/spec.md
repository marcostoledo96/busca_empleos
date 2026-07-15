# Delta para Sincronización ofertas

## ADDED Requirements

### Requirement: Evidencia runtime y progreso coherentes de slices entregadas

La entrega MUST aportar evidencia runtime mínima de capacidades ya implementadas y actualizar el `apply-progress.md` del predecesor con evidencia PostgreSQL `_test` vigente. MUST NOT agregar evidencia ni comportamiento del piloto diferido.

#### Scenario: evaluación, texto no confiable y UI
- GIVEN una oferta compatible y texto que intenta alterar la evaluación
- WHEN se evalúa, persiste y renderiza prioridad IA
- THEN MUST conservar `match` y porcentaje, mostrar evidencia accesible y no presentarla como aprobación.

#### Scenario: fallback de preferencia o almacenamiento
- GIVEN una preferencia legacy o inaccesible, o almacenamiento persistente fallido
- WHEN el dashboard procesa ofertas
- THEN MUST mantener orden vigente, informar fallback y conservar progreso sin duplicados.

#### Scenario: progreso PostgreSQL documentado
- GIVEN evidencia verificada en `busca_empleos_test`
- WHEN se sincroniza `apply-progress.md`
- THEN MUST marcar 3.1 completa con migración 018 repetible, constraints, backfill de 30 días, cursor real y 5 suites/65 tests, sin Railway.

## MODIFIED Requirements

### Requirement: Transferencia cancelable con almacenamiento resiliente

El cliente MUST informar progreso, permitir cancelación y reanudar solo desde un estado consistente. Debe usar almacenamiento persistente disponible y MUST usar memoria como fallback si este falla, sin detener el dashboard ni duplicar filas. Al iniciar un snapshot nuevo sin cursor, MUST esperar que se limpien memoria e IndexedDB antes de rehidratar o descargar bloques.
(Previously: el reset de un snapshot nuevo no exigía esperar la limpieza persistente.)

#### Scenario: cancelación y reanudación
- GIVEN una descarga parcial de 10.000 filas
- WHEN el usuario cancela y luego reanuda
- THEN MUST conservar solo bloques confirmados y completar sin duplicados.

#### Scenario: falla de almacenamiento persistente
- GIVEN el almacenamiento local no está disponible o agota cuota
- WHEN llegan nuevos bloques válidos
- THEN MUST continuar en memoria, informar el fallback y mantener progreso verificable.

#### Scenario: snapshot nuevo no rehidrata IDs previos
- GIVEN una fila previa persistida y un snapshot nuevo sin cursor
- WHEN termina el reset antes del primer bloque y se persiste una fila nueva
- THEN la rehidratación MUST contener solo la fila nueva.

### Requirement: Observabilidad y rollback de sincronización

El sistema MUST registrar inicio, progreso, cancelación, finalización, invalidación, `fecha_corte`, `maxId`, total inicial, recibidos y duplicados. Deshabilitar la sincronización nueva MUST conservar el endpoint y comportamiento de listado existentes.
(Previously: la observabilidad carecía de evidencia runtime mínima explícita.)

#### Scenario: sesión cancelada es observable
- GIVEN una sincronización cancelada
- WHEN se consulta su estado operativo
- THEN MUST mostrar cancelación, `fecha_corte`, `maxId`, conteos consistentes y ningún éxito falso.
