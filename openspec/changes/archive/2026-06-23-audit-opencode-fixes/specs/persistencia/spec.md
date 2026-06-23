# Delta for Persistencia

## ADDED Requirements

### Requirement: Runner de migraciones auto-bootstrap

El runner de migraciones MUST crear `schema_migrations` automáticamente si está ausente, usando el esquema vigente esperado, y luego MUST continuar el flujo normal. La ayuda del comando de aplicar migraciones MUST mostrar `db:migrate:apply`.

#### Scenario: bootstrap de tabla ausente

- GIVEN una base válida no tiene tabla `schema_migrations`
- WHEN se ejecuta el runner de migraciones
- THEN la tabla MUST crearse automáticamente
- AND las migraciones pendientes MUST evaluarse sin finalizar el proceso por esa ausencia.

#### Scenario: ayuda usa comando vigente

- GIVEN una persona consulta o recibe ayuda del runner
- WHEN se muestra el comando para aplicar migraciones
- THEN el texto MUST indicar `db:migrate:apply`.

### Requirement: Migración aditiva de rango salarial

La persistencia MUST incluir una migración nueva, aditiva y sin renombrar migraciones existentes, que garantice que `salario_min <= salario_max` cuando ambos valores existen.

#### Scenario: rango salarial válido

- GIVEN una oferta tiene `salario_min` y `salario_max`
- WHEN ambos valores se persisten o validan por esquema
- THEN el esquema MUST aceptar solo rangos donde `salario_min <= salario_max`.

#### Scenario: migraciones existentes preservadas

- GIVEN existen migraciones ya versionadas o aplicadas
- WHEN se agrega la migración salarial
- THEN sus nombres y números existentes MUST NOT cambiar.

### Requirement: Tests DB seguros en CI

Los tests de base de datos MUST ejecutarse únicamente contra una base PostgreSQL de test explícita y segura, no contra una base real de desarrollo o producción.

#### Scenario: CI usa base de test

- GIVEN corre CI para backend
- WHEN se ejecutan tests DB
- THEN MUST usar una base PostgreSQL de test provista para CI
- AND MUST NOT depender de credenciales reales.
