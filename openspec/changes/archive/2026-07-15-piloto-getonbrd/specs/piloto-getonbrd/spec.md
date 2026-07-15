# Piloto GetOnBrd

## Purpose

Piloto seguro.

## Requirements

### Requirement: Autorización bloqueante

El sistema MUST usar API oficial con sandbox/fixtures. MUST NOT usar scraping HTML ni producción ni habilitarla con booleano. Producción SHALL requerir configuración explícita y evidencia escrita identificable, fechada, verificable que valide alcance API.

#### Scenario: fixture aislado

- GIVEN fixture sandbox
- WHEN inicia
- THEN MUST procesarse sin host, cron ni BD de producción.

#### Scenario: sin evidencia

- GIVEN producción sin evidencia válida
- WHEN se ejecuta el adaptador
- THEN MUST rechazarse antes de solicitar datos.

### Requirement: Corrida observable

El piloto MUST asignar `run_id`, normalizar URL, aceptar 30 días y deduplicar. MUST limitar páginas, checkpoint, métricas y terminación. Timeout, cancelación, vacío, agotamiento, límite o error MUST finalizar.

#### Scenario: duplicadas

- GIVEN fixtures paginados con URL repetida y vencidas
- WHEN finaliza dentro del límite
- THEN MUST conservar únicas de 30 días, checkpoint, métricas y terminación.

#### Scenario: cancelación

- GIVEN páginas pendientes
- WHEN se cancela o vence timeout
- THEN MUST detenerse con último checkpoint y motivo.
