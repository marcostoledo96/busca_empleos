# Delta for Persistencia

## ADDED Requirements

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

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| oferta de 29 días incluida | `backend/tests/modelos/oferta.test.js` — caso de listado reciente |
| oferta de 31 días excluida | `backend/tests/modelos/oferta.test.js` — caso de listado antiguo |
| total coincide con filas visibles | `backend/tests/modelos/oferta.test.js` — mock/fixture de SELECT + COUNT |
| total respeta filtros y ventana | `backend/tests/modelos/oferta.test.js` — estado + ventana 30 días |
| estadísticas excluyen ofertas antiguas | `backend/tests/modelos/oferta.test.js` — estadísticas filtradas |
| estadísticas incluyen ofertas recientes | `backend/tests/modelos/oferta.test.js` — estadísticas filtradas |
| migración repetible | revisión SQL o test sobre migración en DB de test segura |
| sin pruebas destructivas contra DB real | checklist de verify: validar `NODE_ENV=test`/DB test antes de ejecutar migraciones |
