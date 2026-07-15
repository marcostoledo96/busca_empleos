# Sincronización ofertas Specification

## Purpose

Transferir al dashboard todas las ofertas almacenadas dentro de la ventana fija de 30 días.

## Requirements

### Requirement: Recorrido completo, estable y seguro por cursor

El sistema MUST devolver una proyección permitida mediante cursor opaco, validado y con orden total estable. La primera página MUST fijar un snapshot lógico delimitado por `fecha_corte` de 30 días y `maxId`; `total` MUST ser el conteo inicial de ese universo. La garantía de IDs únicos y total coincidente aplica mientras esas filas permanezcan elegibles; el sistema MUST NOT prometer un snapshot persistente de base de datos ni resultados completos bajo borrados o actualizaciones concurrentes. Si esas mutaciones invalidan el recorrido, MUST marcarlo como inválido y reiniciarlo o devolver un error controlado, nunca éxito.

#### Scenario: recorrido completo del snapshot lógico

- GIVEN 10.000 filas almacenadas en los últimos 30 días
- WHEN el cliente consume todos los bloques de una misma sincronización
- THEN MUST recibir exactamente 10.000 IDs únicos y el total declarado.

#### Scenario: inserción concurrente queda fuera del snapshot

- GIVEN una sincronización ya fijó `fecha_corte` y `maxId`
- WHEN se inserta una oferta con ID posterior durante el recorrido
- THEN MUST no incluirla ni modificar el total inicial.

#### Scenario: borrado o actualización invalida el snapshot

- GIVEN una fila del snapshot se borra o deja de cumplir la ventana durante el recorrido
- WHEN el sistema detecta que los recibidos no coinciden con el total inicial
- THEN MUST marcar la sincronización inválida y reiniciarla o responder error controlado sin completarla.

#### Scenario: cursor inválido o manipulado

- GIVEN un cursor malformado, vencido o ajeno a la sincronización
- WHEN el cliente solicita el siguiente bloque
- THEN MUST rechazarlo sin revelar filas fuera del contrato.

### Requirement: Transferencia cancelable con almacenamiento resiliente

El cliente MUST informar progreso, permitir cancelación y reanudar solo desde un estado consistente. Debe usar almacenamiento persistente disponible y MUST usar memoria como fallback si este falla, sin detener el dashboard ni duplicar filas. Al iniciar un snapshot nuevo sin cursor, MUST esperar la limpieza de memoria e IndexedDB antes de rehidratar o descargar bloques.

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
- THEN MUST rehidratar solo la fila nueva.

### Requirement: Observabilidad y rollback de sincronización

El sistema MUST registrar inicio, progreso, cancelación, finalización, invalidación, `fecha_corte`, `maxId`, total inicial, recibidos y duplicados. Deshabilitar la sincronización nueva MUST conservar el endpoint y comportamiento de listado existentes.

#### Scenario: sesión cancelada es observable

- GIVEN una sincronización cancelada
- WHEN se consulta su estado operativo
- THEN MUST mostrar cancelación, conteos consistentes y ningún éxito falso.
