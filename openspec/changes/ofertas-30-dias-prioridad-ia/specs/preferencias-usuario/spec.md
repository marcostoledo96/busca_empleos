# Delta para Preferencias usuario

## ADDED Requirements

### Requirement: Preferencia compatible de prioridad IA

El sistema MUST exponer una preferencia para habilitar prioridad IA y su límite configurado. Clientes o registros legacy sin esos campos MUST conservar el orden vigente; si la preferencia no está disponible, el ranking MUST aplicar fallback al orden existente. Deshabilitarla MUST restaurar ese orden sin borrar datos.

#### Scenario: usuario habilita prioridad

- GIVEN una preferencia válida y ofertas con prioridad IA
- WHEN el usuario la habilita
- THEN el ranking MUST aplicar solo la señal configurada.

#### Scenario: cliente legacy o preferencia inaccesible

- GIVEN una respuesta sin campos nuevos o fallo de lectura
- WHEN el dashboard ordena ofertas
- THEN MUST mantener el orden vigente sin error.
