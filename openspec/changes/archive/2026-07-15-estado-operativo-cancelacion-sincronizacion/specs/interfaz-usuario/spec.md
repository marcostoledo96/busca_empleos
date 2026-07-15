# Delta para Interfaz usuario

## ADDED Requirements

### Requirement: Estado operativo de sincronización accesible

El dashboard MUST presentar mediante texto accesible el estado operativo local de una sincronización activa, cancelada o completada. Para una cancelación, MUST mostrar `fecha_corte`, `maxId`, total inicial, recibidos únicos y duplicados, y MUST NOT comunicar éxito, finalización ni progreso completo. El estado SHALL pasar a `completada` solo si los IDs únicos recibidos igualan el total inicial; al reanudar, MUST usar el cursor confirmado y conservar la deduplicación.

#### Scenario: cancelación visible sin éxito falso
- GIVEN una sincronización activa con metadatos y conteos acumulados
- WHEN el usuario la cancela y consulta el dashboard visualmente o con tecnología asistiva
- THEN MUST anunciar `cancelada` y todos los valores del snapshot mediante texto accesible
- AND MUST NOT anunciar éxito, completitud ni 100 %.

#### Scenario: reanudación alcanza completitud coherente
- GIVEN un estado cancelado con cursor confirmado y un ID ya recibido
- WHEN el usuario reanuda y recibe bloques con ese ID repetido
- THEN MUST conservar un único registro y aumentar duplicados
- AND SHALL anunciar completada solo al igualar recibidos únicos y total inicial.

#### Scenario: cancelación solicitada después de completar
- GIVEN que recibidos únicos ya igualan el total inicial
- WHEN el usuario intenta cancelar la sincronización
- THEN MUST conservar el estado completada y MUST NOT reemplazarlo por cancelada.
