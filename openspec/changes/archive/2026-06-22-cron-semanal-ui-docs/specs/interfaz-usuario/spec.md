# Delta for Interfaz usuario

## ADDED Requirements

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

## Traceability to Tests

| Scenario | Suggested test/build |
|---|---|
| panel muestra martes 20:00 | `frontend/src/app/paginas/panel-control/*.spec.ts` + `npm run build` en `frontend/` |
| ayudas accesibles coherentes | Test de componente sobre tooltip/aria/toast + `grep -R "48 hs\|48 horas\|cada 48" frontend/src` |
