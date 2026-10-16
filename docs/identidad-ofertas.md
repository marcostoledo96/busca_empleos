# Identidad de ofertas y reconciliación conservadora (#19)

## Política de IDs contradictorios

Uso la misma selección en normalización, persistencia y funciones SQL 023/024/025:

| Fuente | Prioridad de candidatos válidos |
| --- | --- |
| Indeed | Query `jk`, query `vjk`, ID de 16 caracteres en `/job/...-ID`, crudos `jk`, `vjk`, `key`, `jobKey`, `id` |
| LinkedIn | ID en `/jobs/view/ID` o `/jobs/view/slug-ID`, query `currentJobId`, query `jobId`, crudos `jobId`, `currentJobId`, `id` |

Valido **cada candidato antes de elegirlo**. Indeed admite caracteres ASCII
alfanuméricos y convierto el ID a minúsculas. LinkedIn admite exclusivamente
8–16 dígitos; no rescato un prefijo de un ID de 17 dígitos ni de un valor inválido.
Decodifico valores y nombres de parámetros como `URLSearchParams`: los nombres
son sensibles a mayúsculas y uso la primera ocurrencia de cada nombre. Si esa
ocurrencia es inválida, pruebo la siguiente clave permitida, no otra ocurrencia
del mismo nombre. Un NUL no puede convertirse en un ID válido al decodificar SQL.

Ejemplos:

- `?jk=BAD%20&vjk=ABC123` → `indeed:abc123`, URL `/viewjob?jk=abc123`.
- `?jk=%41BC123` o `?%6Ak=ABC123` → la misma identidad anterior.
- `?currentJobId=BAD&jobId=1234567890` → `linkedin:1234567890`.
- `/job/dev-1111111111111111` con crudos `jk=2222222222222222` →
  `indeed:1111111111111111`, URL `/viewjob?jk=1111111111111111`.

Para una **oferta nueva**, la URL navegable prevalece sobre crudos contradictorios.
Los crudos completan únicamente una URL sin ID válido. No afirmo que los IDs A y B
representen el mismo aviso. Conservo la URL recibida en `datos_crudos.url_original`
cuando la normalización la modifica; no borro el resto del payload.

Para una **identidad nativa ya asignada** de Indeed/LinkedIn, no la sustituyo por
el ID distinto de la URL ni de los crudos: esa contradicción no demuestra equivalencia.
La identidad preservada gobierna la URL reparada. Si una versión antigua ya cambió
la identidad antes de esta reparación, no intento adivinar cuál era la correcta.
No fusiono filas por título/empresa ni elimino filas históricas.

Sin ID mantengo fallback por URL conservadora y no borro parámetros desconocidos.
LinkedIn normalizado usa ahora la URL nativa `https://www.linkedin.com/jobs/view/ID`,
no el slug/dominio regional. El helper legacy de LinkedIn mantiene su compatibilidad,
pero el normalizador usa el servicio compartido de identidad.

## Migración incremental 025

El runner `backend/scripts/migrar.js` consulta nombres exitosos en `schema_migrations`
y **no vuelve a ejecutar archivos ya registrados**, aunque su contenido haya cambiado.
Por eso agrego `migracion-025-identidad-conservadora.sql`; no alcanza con editar 023/024.
La 025 instala selectores nuevos aun si 023/024 ya estaban aplicadas. Conservo las
funciones legacy de otros portales para no ampliar la reparación a sus contratos.

La reconciliación de la 025 se limita a filas cuya plataforma es `indeed` o `linkedin`:
no recalculo identidades ni URLs de otros portales, aunque su identidad previa sea
contradictoria. Bloqueo escrituras de ofertas mientras calculo el plan y actualizo
claves en dos fases, tanto para `identidad_canonica` como para `url`. Esto admite ciclos
de claves bajo ambos índices UNIQUE. Una colisión histórica conserva ambas filas;
reservo una clave con sufijo `:colision-historica-ID`, sin declarar equivalencia.
Si una URL destino está ocupada por una fila que no participa del plan, agrego un
fragmento `#identidad-historica-ID-N` para preservar ambas, sin alterar el ID navegable.
Antes de construir la URL de Indeed valido una base HTTP(S) absoluta con autoridad
no vacía. Una URL histórica `broken` aborta con `No puedo reconciliar una URL nativa
inválida o extensa`; no persisto `/viewjob?jk=ID`. Una URL nativa no reconciliable
o mayor de 2000 caracteres aborta la reparación
con error explícito, en lugar de truncar o dejar una clave temporal persistida.

Ejecuto el archivo completo en una transacción, como hace el runner. Repetirlo
mantiene datos y claves; una fila ya correcta no vuelve a escribirse. No cambio
`fecha_extraccion`, `fecha_publicacion`, `fecha_ultima_extraccion`, postulación,
descripción manual ni otros campos/notas que una instalación pudiera tener.
La migración no renueva artificialmente la última detección; la reaparición sí lo hace.

## Contadores y matching

Comparto la identidad con la deduplicación intraejecución de #16/A10. Mantengo
`guardadas` para nuevas, `actualizadas` para enriquecidas, `reapariciones` para
preexistentes sin cambios y `duplicadas` como total de preexistentes. Agregar crudos
contradictorios no crea una nueva oferta si la URL identifica el mismo aviso.
La descripción manual prevalece; un enriquecimiento relevante sigue solicitando
reevaluación por el mecanismo existente. La ventana visible usa última detección,
no altera primera extracción ni publicación.

## Verificación aislada reproducible

No uso `.env`, `.env.test` ni el runner original para preparar la prueba: ese runner
carga archivos de entorno. El fixture de preparación aplica transacciones y registra
los nombres como el runner, pero omite DML de perfiles personales.

Contenedor creado para esta verificación (credenciales exclusivamente sintéticas):

```sh
docker run --pull=never --name issue19-remediacion-pg --label tarea=issue19-sintetica --network bridge -p 127.0.0.1:55439:5432 -e POSTGRES_USER=sintetico -e POSTGRES_PASSWORD=sintetica -e POSTGRES_DB=issue19_test -d postgres:15-alpine -c cluster_name=issue19_remediacion_sintetica
```

Antes de mutar verifico por conexión `current_database() = issue19_test`,
`current_user = sintetico`, `current_setting('cluster_name') = issue19_remediacion_sintetica`
y el mapeo Docker exclusivo `127.0.0.1:55439 → 5432`. No basta el sufijo `_test`.
El opt-in `DB_TEST_SINTETICA=true` admite exclusivamente `NODE_ENV=test` o el
sentinel exacto `production_test` de las regresiones de rate limit. No habilito
`production` ni cambio la detección normal de entorno o los limitadores.
Omito dotenv sólo con configuración local explícita,
puerto no privilegiado, BD `_test`, usuario/contraseña y SSL desactivado. Rechazo
`DATABASE_URL`, `PGSERVICE` y `PGSERVICEFILE`; sin opt-in conservo la configuración normal.

Desde `backend`, antepongo este entorno limpio a cada comando:

```sh
env -i PATH="$PATH" HOME=/nonexistent NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55439 PGUSER=sintetico PGPASSWORD=sintetica PGDATABASE=issue19_test PGSSLMODE=disable node tests/fixtures/preparar-identidad-db.js
```

Uso las dependencias locales de `backend/node_modules`, sin `NODE_PATH` del workspace
padre. No instalo ni modifico dependencias durante la verificación.
Para pruebas de BD agrego `ALLOW_DB_TESTS=true` y ejecuto:

```sh
npm test -- --runInBand tests/config/base-datos.test.js tests/servicios/servicio-identidad-ofertas.test.js tests/servicios/servicio-normalizacion.test.js tests/modelos/oferta.test.js tests/servicios/issue-19-persistencia-reapariciones.test.js tests/servicios/flujo-integrado-issue-19.test.js tests/sql/migracion-023-backfill.test.js tests/sql/migracion-024-reparacion.test.js tests/sql/migracion-025-identidad-conservadora.test.js
npm run test:db
```

Para la suite completa retiro `ALLOW_DB_TESTS` y mantengo el mismo destino sintético.
Agrego `NODE_OPTIONS="--require=$PWD/tests/fixtures/aislar-identidad-entorno.cjs"`
a las suites amplias para que módulos ajenos a BD y procesos hijos tampoco lean
archivos `.env*`: el preload devuelve contenido vacío sin abrir esos archivos.
No simulo PostgreSQL ni sus constraints. Los proveedores de los tests integrados
son mocks; no ejecuto scraping real, APIs, builds ni operaciones de producción.
