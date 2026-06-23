# Delta for Automatización

## ADDED Requirements

### Requirement: Ciclo de scraping derivado del registry de plataformas

El servicio de automatización MUST derivar plataformas ejecutables, pasos de progreso, pesos de scraping y claves de `resultado.scraping` desde `PLATAFORMAS_ACTIVAS` y el registry existente en `backend/src/config/plataformas.js`. El sistema MUST NOT crear una segunda fuente de verdad de plataformas. La asociación entre plataforma activa y scraper MAY vivir como mapa local en `servicio-automatizacion.js`.

#### Scenario: ejecución usa plataformas activas registradas

- GIVEN el registry contiene plataformas activas con scraper disponible en el mapa local
- WHEN se ejecuta el ciclo de automatización
- THEN el servicio MUST invocar únicamente los scrapers correspondientes a `PLATAFORMAS_ACTIVAS`
- AND MUST acumular sus ofertas para evaluación y guardado.

#### Scenario: plataforma inactiva no se invoca

- GIVEN una plataforma registrada tiene `activa=false`
- WHEN se ejecuta el ciclo de automatización
- THEN el servicio MUST NOT invocar su scraper aunque exista en el mapa local
- AND MUST conservar una respuesta controlada sin intentar scraping externo.

#### Scenario: resultado refleja el registry

- GIVEN el registry define plataformas activas e inactivas
- WHEN finaliza el ciclo de automatización
- THEN `resultado.scraping` MUST incluir una clave por plataforma registrada
- AND cada clave MUST contener la cantidad extraída o `0` si no ejecutó o falló.

### Requirement: Progreso compatible y ponderado por plataformas activas

El progreso expuesto por automatización MUST conservar la forma actual de cada paso: identificador, etiqueta, estado y cantidad extraída cuando corresponda. Los pesos de scraping MUST distribuirse entre las plataformas activas ejecutables, preservando los pasos fijos de evaluación y guardado para completar 100%.

#### Scenario: forma de progreso preservada

- GIVEN la UI consume el progreso de automatización existente
- WHEN el backend informa pasos durante el ciclo
- THEN cada paso MUST mantener identificador, label, estado y extraídas si aplica
- AND la UI SHOULD poder consumirlo sin cambiar contrato.

#### Scenario: progreso completa 100%

- GIVEN existen N plataformas activas
- WHEN todas las etapas de scraping, evaluación y guardado terminan
- THEN la suma de avances ponderados MUST llegar a 100%
- AND las plataformas inactivas MUST aportar peso `0`.

### Requirement: Resiliencia por plataforma

El ciclo de automatización MUST aislar fallas por plataforma. Si un scraper falla o devuelve un resultado no utilizable, el sistema MUST registrar `0` para esa plataforma, marcar su paso como finalizado o fallido de forma controlada y continuar con las demás etapas posibles.

#### Scenario: falla de scraper no corta el ciclo

- GIVEN una plataforma activa arroja error durante scraping
- WHEN el ciclo procesa esa plataforma
- THEN el error MUST manejarse sin abortar todo el ciclo
- AND las plataformas siguientes MUST poder ejecutarse.

#### Scenario: Adzuna deshabilitado se maneja como cero ofertas

- GIVEN el scraper de Adzuna devuelve un resultado de deshabilitación controlada
- WHEN el ciclo procesa Adzuna como plataforma activa
- THEN el sistema MUST registrar `resultado.scraping.adzuna` como `0`
- AND MUST continuar evaluación y guardado con las ofertas restantes.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| ejecución usa plataformas activas registradas | `backend/tests/servicios/servicio-automatizacion.test.js` mockeando `PLATAFORMAS_ACTIVAS` y scrapers |
| plataforma inactiva no se invoca | Test que desactiva una plataforma y espera que su scraper no sea llamado |
| resultado refleja el registry | Test de keys de `resultado.scraping` contra registry |
| forma de progreso preservada | Test de shape de `progreso.pasos` |
| progreso completa 100% | Test de ponderación con N activas |
| falla de scraper no corta el ciclo | Test con un scraper rechazado y otro exitoso |
| Adzuna deshabilitado se maneja como cero ofertas | Test con retorno `{ deshabilitado: true }` |
