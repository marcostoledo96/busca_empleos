# Interfaz usuario Specification

## Purpose

Evitar que scoring previo siga apareciendo como feature activa en la UI.

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

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| preferencias no muestra scoring previo | `frontend/src/app/paginas/preferencias/*.spec.ts` |
| dashboard no muestra score previo como señal activa | `frontend/src/app/paginas/dashboard/*.spec.ts` |
