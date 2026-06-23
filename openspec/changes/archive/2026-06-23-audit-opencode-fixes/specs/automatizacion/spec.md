# Delta for Automatización

## ADDED Requirements

### Requirement: Errores de guardado visibles en ciclo

El resultado del ciclo de automatización MUST incluir `erroresGuardado` y MUST incrementarlo cada vez que falle el guardado de una oferta. Los resúmenes operativos y notificaciones MUST exponer ese valor.

#### Scenario: ciclo sin errores de guardado

- GIVEN todas las ofertas evaluadas se guardan correctamente
- WHEN finaliza el ciclo de automatización
- THEN `resultado.erroresGuardado` MUST ser `0`
- AND el resumen/notificación MUST mostrar ese valor o indicar ausencia de errores.

#### Scenario: falla crearOferta incrementa contador

- GIVEN `crearOferta` falla para una oferta durante guardado
- WHEN el ciclo continúa o finaliza controladamente
- THEN `resultado.erroresGuardado` MUST incrementarse en `1`
- AND el error MUST reflejarse en el resumen/notificación.

#### Scenario: múltiples fallas de guardado

- GIVEN `crearOferta` falla para varias ofertas
- WHEN finaliza el ciclo
- THEN `erroresGuardado` MUST representar la cantidad total de fallas de guardado.
