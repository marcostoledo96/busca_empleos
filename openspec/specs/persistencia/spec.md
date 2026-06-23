# Persistencia Specification

## Purpose

Proteger datos y esquema durante la deprecación funcional de scoring previo, y garantizar consistencia temporal y performance en consultas de ofertas activas.

## Requirements

### Requirement: Sin objetos legacy de scoring previo desde B2

El subciclo B2 MUST incluir una migración idempotente que elimine únicamente objetos legacy de scoring previo: `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, el índice legacy asociado y el constraint legacy asociado. La migración MUST usar operaciones tolerantes a ausencia del objeto cuando PostgreSQL lo permita y MUST NOT usar `DROP TABLE`, `DELETE` ni `TRUNCATE`.
(Previously: B1 prohibía `DROP COLUMN` y permitía conservar columnas legadas sin uso activo.)

#### Scenario: migración elimina objetos legacy permitidos

- GIVEN una base conserva `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, índice legacy y constraint legacy
- WHEN se aplica la migración B2
- THEN esos objetos MUST quedar eliminados del esquema
- AND la tabla `ofertas` y sus filas MUST permanecer.

#### Scenario: migración repetible ante objetos ausentes

- GIVEN la migración B2 ya fue aplicada o algunos objetos legacy no existen
- WHEN se ejecuta nuevamente
- THEN MUST finalizar sin error por objetos ausentes.

#### Scenario: comandos destructivos prohibidos

- GIVEN se revisa el SQL de la migración B2
- WHEN se buscan comandos destructivos generales
- THEN MUST NOT existir `DROP TABLE`, `DELETE` ni `TRUNCATE`.

### Requirement: Ventana fija de últimos 30 días para ofertas visibles

Los listados de ofertas MUST limitar resultados activos a una ventana fija de últimos 30 días basada en `fecha_extraccion >= NOW() - INTERVAL '30 days'`. El sistema MUST NOT usar `INTERVAL '1 month'` ni equivalentes de mes calendario para esta ventana.

#### Scenario: oferta de 29 días incluida

- GIVEN existe una oferta con `fecha_extraccion` de hace 29 días
- WHEN se consulta el listado de ofertas
- THEN la oferta MUST aparecer en los resultados.

#### Scenario: oferta de 31 días excluida

- GIVEN existe una oferta con `fecha_extraccion` de hace 31 días
- WHEN se consulta el listado de ofertas
- THEN la oferta MUST NOT aparecer en los resultados.

### Requirement: SELECT y COUNT consistentes

El conteo retornado junto al listado MUST aplicar exactamente la misma ventana fija de 30 días y los mismos filtros funcionales que el SELECT de datos. `total` MUST representar la cantidad de filas que podría devolver el listado filtrado, no el total histórico.

#### Scenario: total coincide con filas visibles

- GIVEN hay ofertas dentro y fuera de los últimos 30 días
- WHEN se consulta el listado sin filtros adicionales
- THEN `total` MUST contar solo ofertas dentro de la ventana
- AND MUST ser consistente con los resultados visibles.

#### Scenario: total respeta filtros y ventana

- GIVEN hay ofertas aprobadas recientes y aprobadas antiguas
- WHEN se consulta el listado filtrado por `estado=aprobada`
- THEN `total` MUST contar solo aprobadas de los últimos 30 días.

### Requirement: Estadísticas alineadas con listados

Las estadísticas de ofertas MUST usar la misma ventana fija de últimos 30 días que los listados. Los contadores `total`, `pendientes`, `aprobadas` y `rechazadas` MUST excluir ofertas con `fecha_extraccion` anterior a `NOW() - INTERVAL '30 days'`.

#### Scenario: estadísticas excluyen ofertas antiguas

- GIVEN existe una oferta rechazada de hace 31 días
- WHEN se consultan estadísticas
- THEN esa oferta MUST NOT incrementar `total` ni `rechazadas`.

#### Scenario: estadísticas incluyen ofertas recientes

- GIVEN existe una oferta pendiente de hace 29 días
- WHEN se consultan estadísticas
- THEN esa oferta MUST incrementar `total` y `pendientes`.

### Requirement: Índices idempotentes y no destructivos para consultas recientes

El cambio SHOULD agregar índices no destructivos e idempotentes para acelerar consultas por `fecha_extraccion` y combinaciones usadas por listados/estadísticas. Las migraciones MUST usar `CREATE INDEX IF NOT EXISTS` y MUST NOT borrar ni modificar datos existentes.

#### Scenario: migración repetible

- GIVEN la migración de índices ya fue aplicada
- WHEN se ejecuta nuevamente
- THEN MUST finalizar sin error por índices existentes.

#### Scenario: sin pruebas destructivas contra DB real

- GIVEN no hay una base de datos de test explícitamente configurada
- WHEN se verifican migraciones o queries de índices
- THEN MUST NOT ejecutarse tests DB destructivos ni comandos que alteren datos reales.

### Requirement: Tests estáticos de seguridad para migración legacy

El cambio MUST incluir tests estáticos que inspeccionen el archivo SQL de B2 sin conectarse a una base real. Esos tests MUST verificar presencia de los objetos legacy esperados, ausencia de `DROP TABLE`/`DELETE`/`TRUNCATE`, e idempotencia básica para objetos opcionales.

#### Scenario: test estático cubre lista de objetos

- GIVEN existe el test estático de la migración B2
- WHEN analiza el SQL
- THEN MUST verificar referencias a `score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`, índice y constraint legacy.

#### Scenario: test estático bloquea destrucción de datos

- GIVEN el SQL contiene `DROP TABLE`, `DELETE` o `TRUNCATE`
- WHEN corre el test estático
- THEN MUST fallar antes de cualquier ejecución contra DB.

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

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| migración elimina objetos legacy permitidos | revisión SQL de `backend/sql/migracion-016-eliminar-scoring-legacy.sql` |
| migración repetible ante objetos ausentes | test estático sobre `IF EXISTS` / bloque seguro equivalente |
| comandos destructivos prohibidos | test estático con regex anti `DROP TABLE\|DELETE\|TRUNCATE` |
| test estático cubre lista de objetos | `backend/tests/sql/migracion-016-eliminar-scoring-legacy.test.js` |
| test estático bloquea destrucción de datos | `backend/tests/sql/migracion-016-eliminar-scoring-legacy.test.js` |
| oferta de 29 días incluida | `backend/tests/modelos/oferta.test.js` — caso de listado reciente |
| oferta de 31 días excluida | `backend/tests/modelos/oferta.test.js` — caso de listado antiguo |
| total coincide con filas visibles | `backend/tests/modelos/oferta.test.js` — mock/fixture de SELECT + COUNT |
| total respeta filtros y ventana | `backend/tests/modelos/oferta.test.js` — estado + ventana 30 días |
| estadísticas excluyen ofertas antiguas | `backend/tests/modelos/oferta.test.js` — estadísticas filtradas |
| estadísticas incluyen ofertas recientes | `backend/tests/modelos/oferta.test.js` — estadísticas filtradas |
| migración repetible | revisión SQL o test sobre migración en DB de test segura |
| sin pruebas destructivas contra DB real | validar `NODE_ENV=test` / `PGDATABASE` antes de ejecutar migraciones |
| bootstrap de tabla ausente | `backend/tests/scripts/migrar.test.js` — test de creación automática de `schema_migrations` |
| ayuda usa comando vigente | `backend/tests/scripts/migrar.test.js` — assert ayuda muestra `db:migrate:apply` |
| rango salarial válido | `backend/sql/migracion-017-salario-rango.sql` + test estático SQL sin `DROP TABLE/DELETE/TRUNCATE` |
| migraciones existentes preservadas | revisión del nombre `migracion-017-*` — no renombra nombres existentes |
| CI usa base de test | `.github/workflows/ci.yml` — job `test:db` con Postgres service y `DATABASE_URL: ''` |
