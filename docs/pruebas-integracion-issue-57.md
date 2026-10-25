# Integración sintética de la issue #57 — T1

## Estado observado

Implementé un arnés focal con Express, controladores, configuración efectiva, scrapers,
normalización, ingreso, modelos, mutex y PostgreSQL reales. **T1 queda verde en su
verificación focal:** la última suite obtuvo **31 pruebas aprobadas de 31**, en dos
suites, sin fallos ni pruebas omitidas. La aceptación completa de la issue sigue
pendiente de T2 y de la verificación independiente del padre. No afirmo cobertura
productiva real. No modifiqué código productivo.

El servidor separado pasó su comprobación funcional: bind en loopback, rechazo de acceso
sin token, búsqueda LinkedIn, normalización de tres filas crudas a dos identidades y
consulta SQL de las dos ofertas persistidas. Repetí una vez ese smoke y una vez la
suite focal en el lote acotado de corrección; ambos finalizaron con exit 0. La regresión
acotada de #20 aprobó sus tres pruebas en el lote anterior; no la repetí en este lote.

## Aislamiento obligatorio

No leo archivos `.env`, `.env.test` ni credenciales personales. Sustituyo `dotenv` antes
de importar la aplicación. Antes de crear un esquema exijo esta conexión exacta:

```sh
NODE_ENV=test DB_TEST_SINTETICA=true \
PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test \
PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable \
npm --prefix backend run test:issue57
```

Rechazo `DATABASE_URL`, servicios PG, archivos de contraseña, opciones PG heredadas,
SMTP y credenciales externas no sintéticas. **No elimino silenciosamente variables
peligrosas:** si están presentes, detengo el proceso antes de escribir. Exijo además
PostgreSQL 15 y verifico `current_database()` y `current_user` por SQL.

Creo un esquema `issue57_<pid>_<timestamp>`, fijo `search_path` exclusivamente a ese
esquema y aplico los SQL existentes de `backend/sql` más
`backend/migrations/024-resultados-fuentes.sql`. Reutilizo el ajuste de guards legacy
por `current_schema()` de #56; no ejecuto recuperación operativa ni migraciones en
otras bases. Reemplazo nombre, perfil, prompt y términos del fixture por valores
ficticios. Los defaults versionados restantes conservan el contrato del esquema.

El reset hace `TRUNCATE` únicamente sobre ofertas, historial, caché y lotes del esquema
propio, con comprobación de entorno previa. Conservo los esquemas de cada ejecución
para inspección; no limpio otros esquemas ni bases. Esta suite exige las variables
anteriores incluso cuando se incluye mediante una suite más amplia: no usa `SKIP`.

## Fronteras reales y simuladas

| Parte | Comprobación |
| --- | --- |
| Express y middleware Firebase | Reales; verifico ausencia de token (401), token inválido (401), identidad ajena (403) y acceso válido |
| Verificador Firebase | Sustituyo solamente `config/firebase-admin.verifyIdToken`; no verifico firma criptográfica ni contacto con Firebase |
| Identidad | `persona-issue57@example.invalid`, UID ficticio, token `issue57-token-ficticio` |
| Apify | Sustituyo el SDK; conservo configuración, construcción de URLs, ejecución de fuente, normalización y persistencia reales |
| HTTP remoto y DeepSeek | Sustituyo `fetch` con destinos explícitos y respuestas sintéticas; la configuración, parser y evaluación siguen reales |
| Email | Servicio real deshabilitado por ausencia de SMTP; intercepto `nodemailer.createTransport` para fallar si se intenta enviar |
| Cron | No importo `index.js` ni rehidrato/programo cron; cualquier creación de tarea falla |
| PostgreSQL | `pg`, consultas, transacciones, advisory locks y triggers reales contra la base autorizada |
| Postulaciones | Pruebo seguimiento local de una oferta; no envío postulaciones a portales |

El transporte de sockets rechaza destinos no locales. Los fixtures nunca delegan al
SDK ni a `fetch` originales. Registro cualquier operación inesperada y exijo un registro
vacío. En el lote anterior esa aserción detectó y bloqueó un destino de fixture
faltante (`www.computrabajo.com.ar`); no hubo petición remota real. Agregué solamente
`GET https://www.computrabajo.com.ar/trabajo-de-desarrollo-junior`, sin query ni puerto
alternativo. No amplié el permiso a otros hosts o rutas. En la última ejecución todas
las aserciones de ausencia de operaciones inesperadas aprobaron.

## Evidencia SQL y errores controlados

`issue-57-runtime.js` consulta directamente:

```sql
SELECT current_schema() AS nombre, current_database() AS base;
SELECT id, titulo, identidad_canonica, fecha_extraccion, fecha_ultima_extraccion,
       estado_postulacion, fecha_postulacion, nota_postulacion FROM ofertas ORDER BY id;
SELECT id, tipo, estado, fin, resumen FROM ejecuciones_busqueda ORDER BY id;
SELECT * FROM configuracion_cron;
```

Inyecto fallos de escritura e historial mediante triggers PostgreSQL y una tabla
`issue57_fallo`, no mediante mocks de modelos. Verifico rechazo total, preservación de
una oferta ante fallo parcial, recuperación, fallo al iniciar historial sin invocar
proveedor y fallo al finalizar historial sin descartar ofertas. Este último contrato
conserva la fila en `ejecutando` y devuelve `historial.guardado=false`: no lo presento
como historial finalizado correctamente.

Para reproducir el esquema previo renombro temporalmente la columna de última
extracción y la tabla de historial dentro del esquema propio. Verifico SQLSTATE
`42703` y `42P01`, HTTP 500 con `exito=false` en listado/sincronización y HTTP 503 en
historial/búsqueda. Restauro ambos nombres en `finally` y verifico búsqueda,
sincronización y persistencia correctas. No es una migración productiva nueva.

Compruebo 105 ofertas por cursores públicos de 100 elementos, sin duplicados, la
preservación de fecha inicial y el seguimiento manual (estado, fecha y nota). La
cancelación usa `/api/evaluacion/cancelar` durante una evaluación real con respuesta
DeepSeek retenida; no invento una cancelación de scraping ni uso detener cron.

### Estados HTTP comprobados en la matriz

Distingo el HTTP simulado del proveedor del HTTP público de Express. No espero que
un 429 del proveedor sea un 429 del rate limiter local ni que un 202 sea un éxito terminal.

| Escenario | HTTP público | Resultado comprobado |
| --- | --- | --- |
| Fuente vacía | 200 | `sin_resultados`, sin nuevas escrituras de ofertas |
| Proveedor 429 | 502 | `error`, error de fuente `limite_solicitudes` |
| Proveedor 500 o 503 | 502 | `error`, error de fuente `http` |
| Actor `TIMED-OUT` | 504 | `timeout`, sin ofertas de ese intento |
| Dataset inválido | 502 | `error`; conservo la clasificación actual del adaptador (`red`) |
| Fuente deshabilitada | 200 | `deshabilitada`, `PLATAFORMA_INACTIVA`, sin llamadas externas |
| Persistencia totalmente fallida | 500 | `error`, ninguna oferta guardada |
| Persistencia parcialmente fallida | 200 | `parcial`, una oferta útil conservada y advertencia explícita |
| Historial: fallo al iniciar | 503 | Mensaje explícito, sin invocar proveedor ni guardar ofertas |
| Historial: fallo al finalizar | 200 | Ofertas conservadas, `historial.guardado=false`, fila aún `ejecutando` |
| Inicio de ciclo | 202 | Aceptado; sigo `/progreso` con HTTP 200 hasta `activo=false` |
| Segundo ciclo concurrente | 409 | Rechazo explícito; una sola ejecución SQL |
| Cancelación de evaluación activa | 200 | Lote SQL `cancelado`, ciclo terminal `parcial`, ofertas conservadas |
| Reintento después de error | 200 individual / 202 ciclo | Espero terminal y verifico historial, recuperación y ausencia de duplicados |

En los errores individuales de proveedor verifico `exito=false` y el mensaje exacto
`No pude completar la consulta al proveedor.`. Verifico historial y conservación de
las filas anteriores; en resultados parciales no convierto el HTTP 200 en éxito total.
Después de cada caso exijo identidades únicas, esquema propio, ausencia de cron activo
y registro vacío de operaciones inesperadas. Los únicos accesos remotos aparentes son
fixtures en memoria: no consulto Apify ni DeepSeek reales y no envío correo ni
postulaciones reales. Estas comprobaciones aprobaron en la corrida de 31/31.

## Contrato reutilizable para T2

Con las mismas variables controladas, ejecuto aparte:

```sh
npm --prefix backend run test:issue57:api
```

Escucho exclusivamente en `http://127.0.0.1:3057`. No agrego rutas al `src/app.js`
productivo. El runner monta antes de la aplicación estos controles, protegidos por
el mismo middleware real y el token ficticio:

- `GET /__issue57/evidencia`: devuelve las filas SQL, esquema/base, llamadas simuladas
  y operaciones inesperadas.
- `POST /__issue57/control`: recibe `{ "escenario": "correcto", "fallo": "ninguno", "reset": true }`.
  Rechazo controles durante un ciclo activo con 409; espero terminal antes de resetear.
- Escenarios: `correcto`, `vacio`, `429`, `500`, `503`, `timeout`, `invalido`, `parcial`, `retenido`.
  `retenido` es para el helper de concurrencia de Jest; no tiene liberación HTTP.
- Fallos SQL: `ninguno`, `persistencia`, `persistencia_parcial`, `historial_inicio`, `historial_fin`.
- Con `reset=true` limpio datos del esquema y llamadas; el reset vuelve el fallo SQL
  a `ninguno`. Para inyectar fallo después de reset, envío otro control sin reset.
- Las rutas reales `/api/*` usan `Authorization: Bearer issue57-token-ficticio`.
  CORS permite `http://127.0.0.1:4200` y `http://localhost:4200`.
- `SIGINT`/`SIGTERM` cierran servidor y pool; cierro después del estado terminal.

La comprobación autocontenida del runner usa `--comprobar-api`, puerto efímero y el
mismo recorrido real. T2 todavía debe integrar Angular sin el interceptor de API
sintético, resolver login ficticio solo en su build de prueba y ejecutar Playwright.
El ciclo completo ya aprobó el recorrido backend, incluida recuperación y cancelación,
con el destino Computrabajo acotado en el fixture. Mantengo intacta la política cerrada
para destinos desconocidos.

## Test-first y límites de corrección

Observé RED al importar el helper todavía inexistente. Después observé GREEN de los
15 guards. Las pruebas del comportamiento productivo ya existente no requieren un
RED artificial: verifican contratos reales. La reproducción de esquema incompleto
observó errores reales y luego recuperación con el esquema restaurado.

La primera corrida backend falló por `evaluacion_cache` (nombre correcto:
`evaluaciones_cache`). La siguiente expuso un trigger del arnés que leía `NEW.titulo`
en filas del historial. Corregí ambas causas dentro del arnés. El nuevo runner también
mostró un error de paréntesis, corregido antes de su ejecución funcional.

Al alcanzar el límite inicial de correcciones detuve iteraciones con 28 pruebas
aprobadas y estos tres fallos. En el siguiente lote autorizado corregí sus dos causas,
**sin relajar aserciones ni ocultar resultados**. Conservo el detalle histórico:

1. `resuelvo preferencias y límites, normalizo, deduplico y consulto ofertas e historial en SQL`:
   la aserción usaba `decodeURIComponent`, que no transforma `+` en espacio. Ahora leo
   `new URL(url).searchParams.get('keywords')` y comparo por igualdad con el término
   efectivo guardado en `preferencias`, consultado directamente por SQL.
2. `acepto 202, rechazo ciclo concurrente, espero terminal parcial y puedo ejecutar otro ciclo`:
   faltaba fixture para `https://www.computrabajo.com.ar/trabajo-de-desarrollo-junior`;
   el fallback cerrado bloqueaba la salida y el ciclo no alcanzaba `sin_resultados`.
   Con el fixture exacto, verifico el rechazo concurrente, terminal parcial con ofertas
   útiles y una nueva ejecución terminal `sin_resultados` con las ofertas conservadas.
3. `cancelo evaluación activa por su contrato real sin detener cron ni perder scraping`:
   el mismo destino Computrabajo hacía fallar el registro de operaciones inesperadas.
   Con el fixture exacto, aprueba la cancelación activa, el lote SQL `cancelado`, el
   ciclo `parcial`, la conservación de ofertas y el registro vacío. No borro ese
   registro ni omito sus aserciones.

No encontré evidencia que justifique editar rutas productivas. Las correcciones se
limitaron a `backend/tests/integracion/issue-57-backend.test.js` y
`backend/tests/helpers/issue-57-proveedores.js`, además de esta documentación.

## Comandos y resultados observados

Todos los comandos Jest y runner se ejecutaron con el prefijo de entorno sintético
mostrado al principio, sin `DATABASE_URL`. Conservo los logs históricos del lote
anterior en `.codegraph/issue57-focal.log` (28/31) y `.codegraph/issue57-regresion.log`
(3/3); no representan la nueva corrida focal. La salida vigente quedó en las llamadas
foreground de la sesión, sin redirección ni un nuevo archivo de log.

| Comando (desde la raíz, después del prefijo de entorno) | Resultado |
| --- | --- |
| `git diff --check` (antes de editar) | salida vacía, exit 0 |
| guard shell de URL/servicios heredados + `pg_isready` con conexión controlada | `127.0.0.1:55457 - accepting connections`, exit 0; Jest presente |
| `node backend/node_modules/jest/bin/jest.js --rootDir backend --runInBand --runTestsByPath backend/tests/integracion/issue-57-seguridad.test.js` | RED exit 1: helper ausente; GREEN exit 0: 15/15 |
| `node backend/node_modules/jest/bin/jest.js --rootDir backend --runInBand --runTestsByPath backend/tests/integracion/issue-57-backend.test.js` | exit 1: 16/16 fallidas por tabla reset; siguiente exit 1: 1 aprobada, 15 fallidas por trigger |
| `npm --prefix backend run test:issue57` | histórico: exit 1 por sintaxis del runner y después 28 aprobadas/3 fallidas; lote de corrección vigente: una ejecución, exit 0, 2 suites aprobadas, 31/31 pruebas, 10.407 s |
| `node backend/scripts/test-issue-57.js --comprobar-api` | lote vigente: una ejecución, exit 0; `API sintética: loopback, auth, búsqueda real y SQL verificados.` |
| `node backend/node_modules/jest/bin/jest.js --rootDir backend --runInBand --runTestsByPath backend/tests/integracion/issue-20-recorridos-backend.test.js` | exit 0; 3/3 aprobadas |

## Cobertura de Specs de T1

| Spec | Evidencia y faltantes |
| --- | --- |
| S1 | Recorridos backend con Express y PG reales aprobados; aceptación global pendiente de navegador/verificador |
| S2 | Sin cambios en ramas/worktrees ajenos ni recuperación operativa |
| S3 | Nivel B focal aprobado; nivel C corresponde a T2 y sigue pendiente |
| S4 | Reutilizo app.js, migraciones, guards y patrón de esquema de #20/#56; sin framework nuevo |
| S5 | Guards, PG15 y esquema propio antes de escrituras; 15 pruebas de seguridad aprobadas |
| S6 | Middleware real y verificador ficticio; 401/403/acceso válido comprobados; falta navegador T2 |
| S7 | HTTP→SDK→normalización→SQL→historial y keywords de preferencias aprobados; Angular pendiente |
| S8 | 202, polling terminal, parcial, rechazo concurrente y recuperación aprobados; Angular pendiente |
| S9 | Listado, detalle, cursor 105 filas y preservación manual aprobados; presentación y recuperación visual pendientes |
| S10 | Matriz individual, SQL, historial, ciclo, concurrencia, reintento y cancelación aprobados |
| S13 | Sin red externa, cron, correo, PG productivo, credenciales personales, postulaciones reales ni despliegues; aserciones de operaciones inesperadas aprobadas |
| S15 | Solo tests/helpers/runner/package/docs, sin dependencias nuevas ni cambios globales |
| S19 | Errores SQL/HTTP ante esquema incompleto y recuperación posterior comprobados |

No ejecuté suites completas, builds, navegador ni verificación productiva: pertenecen
a T2/T3 o al padre. No hice commits, push, PR, revisión ni despliegue.
