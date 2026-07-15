# Delta para Sincronización de ofertas

## ADDED Requirements

### Requirement: Secreto de firma según ambiente

El backend MUST exigir `CURSOR_SINCRONIZACION_SECRETO` en producción. Desarrollo y pruebas MAY usar un secreto efímero con advertencia. Un cursor firmado con el mismo secreto MUST seguir vigente tras reiniciar el proceso.

#### Scenario: producción sin secreto
- GIVEN un entorno de producción sin `CURSOR_SINCRONIZACION_SECRETO`
- WHEN inicia el módulo de ofertas
- THEN MUST rechazar el inicio con un error de configuración.

#### Scenario: fallback no productivo
- GIVEN un entorno de desarrollo o prueba sin secreto configurado
- WHEN inicia el módulo de ofertas
- THEN MUST usar un secreto efímero y emitir una advertencia.

#### Scenario: reinicio con secreto estable
- GIVEN un cursor emitido con un secreto configurado
- WHEN se reinicia el proceso con el mismo secreto
- THEN MUST aceptar el cursor mientras siga vigente.

### Requirement: Clasificación pública de errores de sincronización

El endpoint MUST responder `400` para límite o cursor inválido y `409` para snapshot invalidado. Errores operativos inesperados MUST llegar al manejador global como `500` genérico, sin detalles internos.

#### Scenario: parámetro inválido
- GIVEN un límite o cursor inválido
- WHEN se solicita un bloque
- THEN MUST responder `400` con el error de contrato.

#### Scenario: snapshot invalidado
- GIVEN un cursor válido cuyo snapshot ya no coincide
- WHEN se solicita el siguiente bloque
- THEN MUST responder `409`.

#### Scenario: error operativo inesperado
- GIVEN un fallo inesperado de PostgreSQL
- WHEN se solicita un bloque
- THEN MUST responder `500` genérico sin clasificarlo como error del cliente.

### Requirement: Cobertura de regresión de sincronización

El sistema MUST contar con pruebas backend y frontend para cancelación, secreto y errores públicos.

#### Scenario: ejecución de regresión
- GIVEN la suite de pruebas del proyecto
- WHEN se ejecutan las pruebas de sincronización
- THEN MUST verificar aborto HTTP, secreto por ambiente y respuestas `400`, `409` y `500`.

## MODIFIED Requirements

### Requirement: Transferencia cancelable con almacenamiento resiliente

El cliente MUST informar progreso, permitir cancelación y reanudar solo desde un estado consistente. Debe usar almacenamiento persistente disponible y MUST usar memoria como fallback si este falla, sin detener el dashboard ni duplicar filas. Al iniciar un snapshot nuevo sin cursor, MUST esperar que se limpien memoria e IndexedDB antes de rehidratar o descargar bloques. Al cancelar una transferencia activa, MUST abortar la petición HTTP pendiente, conservar el último cursor confirmado, metadatos y conteos del snapshot con `estado='cancelada'` y `completada=false`, y MUST NOT ejecutar el listado legacy ni marcar la sesión como fallida. Solo SHALL establecer `completada` cuando los IDs únicos recibidos igualen `total_inicial`.

(Previously: la cancelación se registraba entre bloques, sin exigir el aborto HTTP ni prohibir el fallback legacy.)

#### Scenario: cancelación y reanudación
- GIVEN bloques confirmados y una transferencia aún activa
- WHEN el usuario cancela y luego reanuda desde el cursor confirmado
- THEN MUST conservar solo los bloques confirmados con estado `cancelada`
- AND MUST finalizar sin IDs duplicados cuando los únicos alcancen el total inicial.

#### Scenario: cancelación durante una petición pendiente
- GIVEN una petición HTTP de bloque aún pendiente y un cursor confirmado previo
- WHEN el usuario cancela la sincronización
- THEN MUST abortar esa petición, conservar el cursor previo y mostrar `cancelada`
- AND MUST NOT solicitar el listado legacy.

#### Scenario: falla de almacenamiento persistente
- GIVEN el almacenamiento local no está disponible o agota cuota
- WHEN llegan nuevos bloques válidos
- THEN MUST continuar en memoria, informar el fallback y mantener progreso verificable.

#### Scenario: snapshot nuevo no rehidrata IDs previos
- GIVEN una fila previa persistida y un snapshot nuevo sin cursor
- WHEN termina el reset antes del primer bloque y se persiste una fila nueva
- THEN la rehidratación MUST contener solo la fila nueva.
