# Integración continua Specification

## Purpose

Garantizar que CI valide backend, base de datos y frontend con entornos seguros y reproducibles.

## Requirements

### Requirement: Pipeline CI completo y seguro

CI MUST ejecutar tests unitarios backend, tests DB contra PostgreSQL de test seguro, build frontend y tests frontend headless cuando el proyecto los soporte.

#### Scenario: backend unit tests en CI

- GIVEN se dispara CI
- WHEN corre el job backend
- THEN MUST ejecutar la suite unitaria del backend.

#### Scenario: tests DB con Postgres seguro

- GIVEN se dispara CI
- WHEN corren tests DB
- THEN MUST usar un servicio PostgreSQL/base de test explícita
- AND MUST NOT usar bases reales ni secretos productivos.

#### Scenario: build frontend en CI

- GIVEN existe frontend Angular
- WHEN corre el job frontend
- THEN MUST ejecutar el build frontend.

#### Scenario: tests frontend headless soportados

- GIVEN el frontend soporta ejecución headless
- WHEN corre el job frontend
- THEN MUST ejecutar tests headless, por ejemplo con ChromeHeadless.

#### Scenario: headless no soportado

- GIVEN el frontend no soporta tests headless todavía
- WHEN se configura CI
- THEN la limitación MUST quedar documentada o marcada como no soportada
- AND el build frontend MUST seguir ejecutándose.
