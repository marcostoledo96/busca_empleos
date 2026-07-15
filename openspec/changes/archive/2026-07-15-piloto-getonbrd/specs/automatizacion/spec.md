# Automatización

## MODIFIED Requirements

### Requirement: Ciclo de scraping derivado del registry de plataformas

Automatización MUST derivar ejecutables, progreso, pesos y `resultado.scraping` desde `PLATAFORMAS_ACTIVAS` y registry. MUST NOT crear otra fuente. La asociación MAY ser local. GetOnBrd MUST quedar fuera de activas, cron y ciclos reales.
(Previously: No excluía explícitamente GetOnBrd.)

#### Scenario: ejecución usa plataformas activas registradas

- GIVEN el registry contiene activas con scraper local
- WHEN se ejecuta el ciclo
- THEN MUST invocar solo scrapers de `PLATAFORMAS_ACTIVAS`
- AND MUST acumular ofertas para evaluación y guardado.

#### Scenario: plataforma inactiva no se invoca

- GIVEN GetOnBrd está inactiva
- WHEN se ejecuta el ciclo
- THEN el servicio MUST NOT invocar su scraper
- AND MUST responder sin scraping externo.

#### Scenario: resultado refleja el registry

- GIVEN el registry define activas e inactivas
- WHEN finaliza el ciclo
- THEN `resultado.scraping` MUST incluir cada plataforma
- AND GetOnBrd MUST contener `0` si no ejecutó.
