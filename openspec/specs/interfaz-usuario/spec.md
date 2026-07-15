# Interfaz usuario Specification

## Purpose

Evitar que scoring previo siga apareciendo como feature activa en la UI, y asegurar que la automatización semanal se comunique correctamente al usuario.

## Requirements

### Requirement: Scoring previo no visible ni configurable

La UI MUST NOT mostrar scoring previo, pesos, umbrales ni controles de `scoring_config` como funcionalidad activa. Las pantallas SHALL conservar las acciones de evaluación y preferencias vigentes sin ofrecer configuración de scoring previo.

#### Scenario: preferencias no muestra scoring previo

- GIVEN el usuario abre la pantalla de preferencias
- WHEN la UI renderiza opciones configurables
- THEN MUST NOT mostrar controles, textos ni estados de scoring previo.

#### Scenario: dashboard no muestra score previo como señal activa

- GIVEN el usuario abre el dashboard de ofertas
- WHEN la UI muestra tarjetas, tablas o detalle de oferta
- THEN MUST NOT presentar scoring previo como métrica activa o criterio visible.

### Requirement: Cron semanal visible y accesible

La UI MUST comunicar la automatización semanal como `Martes 20:00` y MUST NOT mostrar textos activos como `cada 48 hs`, `cada 48 horas` o equivalentes en pantallas, tooltips, aria-labels ni toasts. Los textos SHOULD ser consistentes entre estado, acciones y feedback de ejecución.

#### Scenario: panel muestra martes 20:00

- GIVEN el usuario abre el panel de control
- WHEN la UI renderiza el estado de automatización
- THEN MUST mostrar `Martes 20:00`
- AND MUST NOT mostrar textos activos de frecuencia cada 48 horas.

#### Scenario: ayudas accesibles coherentes

- GIVEN el usuario navega el panel con lector de pantalla o hover
- WHEN consulta tooltips, aria-labels o toasts de automatización
- THEN MUST comunicar la frecuencia semanal de martes 20:00
- AND MUST NOT mencionar frecuencia cada 48 horas.

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

## Traceability to Tests

| Scenario | Suggested test/build |
|---|---|
| preferencias no muestra scoring previo | `frontend/src/app/paginas/preferencias/*.spec.ts` |
| dashboard no muestra score previo como señal activa | `frontend/src/app/paginas/dashboard/*.spec.ts` |
| panel muestra martes 20:00 | `frontend/src/app/paginas/panel-control/*.spec.ts` + `npm run build` en `frontend/` |
| ayudas accesibles coherentes | Test de componente sobre tooltip/aria/toast + `grep -R "48 hs\|48 horas\|cada 48" frontend/src` |
