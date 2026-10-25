# Integración sintética de la issue #57 — T1, T2, T3 y corrección acotada T6

## Resultado final local

Verifiqué búsqueda, listado, sincronización e historial con **Angular → Express →
PostgreSQL reales de prueba**, incluidos errores visibles, resultados parciales y
recuperación. La revisión independiente confirmó los recorridos y cerró los tres
bloqueos iniciales con un recheck de **40/40 pruebas**, sin omisiones. En T6 agregué
una única corrección CSS productiva compartida: el ancho máximo responsive de los
toasts, con regresión integrada RED→GREEN. No afirmo que Buscar funcione en producción;
las regresiones frontend afectadas y la revisión independiente de T6 ya aprobaron.
El resultado y los artefactos del CI del nuevo HEAD se registran en la PR una vez observados.

BASE: `1e00fb24ac35df078ba2a233e233452240d9e680`. La verificación inicial de backend
corresponde a `f773170c4fe4f20a74829a41512d4edd8e947da2`; la entrega anterior se consolidó
en `2ffda0c3a2155b5e7b67fcc66c7d30ab42b804fa`. T6 añade la corrección CSS y su prueba;
consulto el HEAD entregado y su CI en la PR, sin inventar un SHA autorreferente.

La siguiente tabla conserva las verificaciones anteriores a T6 (HEAD entregado
`2ffda0c3a2155b5e7b67fcc66c7d30ab42b804fa`); no acredita los nuevos bytes CSS.

| Comprobación | Resultado histórico anterior a T6 |
| --- | --- |
| `npm --prefix backend run test:issue57` | **40/40**, 2 suites, sin omisiones; repetida por verificador independiente |
| `npm --prefix backend run test:issue57:contratos` | **3 comprobaciones**: descubrimiento exacto y dos pipelines que conservan exit 23 |
| `npm --prefix backend run test:integracion` | **76 aprobadas, 7 omisiones preexistentes** de suites opt-in; no cuento esas omisiones como SQL verificado |
| `npm --prefix backend run test:db` | **211/211**, 16 suites, sin omisiones, base sintética fresca |
| `npm --prefix backend test -- --runInBand` | **2599 aprobadas, 159 omisiones preexistentes**; sin PostgreSQL requerido |
| `npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` | **562 aprobadas, 4 omisiones preexistentes** |
| `npm --prefix frontend run test:e2e:integracion` | **3/3**: 1440×900 claro, 390×844 oscuro y 320×844 claro; confirmado independientemente |
| `npm --prefix frontend run test:e2e` | **202/202**, suite sintética histórica intacta |
| `npm --prefix frontend run build` | **Exit 0**; aviso preexistente: preferencias.css 15,61 kB frente al presupuesto de 15 kB |
| `git diff --check` y TypeScript de integración | **Exit 0** |

Para `test:integracion` y la focal uso las ocho variables sintéticas documentadas más
abajo. Para las suites DB antiguas creé otra base **vacía**,
`busca_empleos_regresion_test`, en el mismo contenedor autorizado (`127.0.0.1:55457`,
mismo usuario/clave sintéticos), y apliqué allí `db:migrate:apply` antes de `test:db`.
Mantengo `NODE_ENV=test`, `DB_TEST_SINTETICA=true`, `PGSSLMODE=disable` y ausencia de
`DATABASE_URL`. Esto evita la colisión preexistente de guards legacy al reutilizar los
esquemas de la focal; **no ejecuté migraciones productivas ni cambié la migración 005**.
Los demás procesos se lanzaron con `env -i` y sólo PATH/HOME y variables de prueba.

La inspección interactiva **MCP inicialmente no estuvo disponible**: Playwright MCP
no inició por longitud del socket temporal y Chrome DevTools MCP agotó su timeout.
Tras la recarga, la continuación MCP verificó los recorridos funcionales, pero encontró
un toast de 400 px recortado a la izquierda en móviles de 390 y 320 px. `scrollWidth`
y `isVisible` no detectaban ese defecto. No considero aprobada aquella visibilidad
móvil ni confundo la inspección interactiva con los E2E automáticos. T6 reproduce y
corrige el recorte con geometría real del aviso; no medí geometría en producción,
cuyo shell difiere del integrado. Los servidores temporales fueron detenidos.

**Límites:** Firebase/identidad, Apify y HTTP remoto/DeepSeek son simulados; el envío de
correo y cron están prohibidos. No pruebo Firebase criptográfico, CORS entre orígenes,
proveedores pagos, producción ni nuevas postulaciones externas. Sin Google Fonts los
iconos Material aparecen como texto. Las omisiones indicadas son anteriores, no añadí
SKIP. Los resultados históricos siguientes se conservan para auditar RED/correcciones;
esta sección los sustituye como estado vigente. El CI remoto y sus artefactos se
registran por URL en la PR una vez publicados.

## T6 — Toast responsive, regresión acotada S12/S15/S20

Sobre HEAD `2ffda0c3a2155b5e7b67fcc66c7d30ab42b804fa` reproduje el recorte antes
de corregirlo. Agregué únicamente `.p-toast { max-width: calc(100vw - 40px); }` a
`frontend/src/styles.css`: conservo los márgenes existentes de 20 px, los 400 px de
escritorio, posiciones, tema y agrupación de avisos de #58. El estilo es compartido
por integración y producción; alcanza los outlets de PanelControl, Dashboard y
Preferencias. No cambié componentes, proveedores, autenticación, SQL ni migraciones.

En el mismo recorrido real existente, después del 503 inyectado, exijo que el mismo
`role="alert"` de historial contenga `Error en LinkedIn` y el texto completo
`No pude iniciar el historial de la ejecución.`. Mido su `getBoundingClientRect()`:
`left >= 0` y `right <= innerWidth`, sin tolerancia. En escritorio también exijo ancho
exacto de 400 px. Conservo todas las aserciones anteriores, incluida la consola con
el 503 esperado y rechazo de cualquier error adicional, los efectos SQL, recuperación,
202 parcial y segundo ciclo. No agregué casos ni amplié la matriz.

Ejecuté dos veces este comando exacto, primero sin corregir CSS y luego una vez con
la corrección; cada ejecución inició y cerró sus propios servidores de loopback:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable npm --prefix frontend run test:e2e:integracion
```

| Etapa | Resultado observado |
| --- | --- |
| RED | Exit 1, **1 aprobada / 2 fallidas**, 31,0 s; escritorio pasa, 390 falla con `left=-30`, 320 con `left=-100`; sin fallos de preparación |
| GREEN | Exit 0, **3/3 aprobadas**, 55,6 s; 1440 claro, 390 oscuro, 320 claro; cero retries, omisiones o flaky |
| Geometría GREEN (left/right/width) | 1440: **1020/1420/400**, igual al RED; 390: **20/370/350**; 320: **20/300/280** |
| `frontend/node_modules/.bin/tsc --project frontend/tsconfig.integracion.json --noEmit` | Exit 0 |
| `frontend/node_modules/.bin/tsc --noEmit --skipLibCheck --target ES2022 --module commonjs --esModuleInterop --strict --typeRoots frontend/node_modules/@types --types node frontend/playwright.integracion.config.ts frontend/e2e/integracion/busqueda-real.integracion.ts` | Exit 0; compruebo también el spec, fuera del tsconfig de bootstrap |

Conservo stdout, stderr y exit de cada comando en `.codegraph/issue57-toast/`, junto
con copias separadas de resultados RED y GREEN. Los errores HTTP 503/500 de stderr
son los fallos inyectados ya exigidos por el recorrido, no errores silenciados.
Cada viewport adjunta ahora `error503.png` y `geometria-error503` además de las capturas
y SQL existentes: **12 capturas originales** en GREEN. Inspeccioné la captura de
320 px y el mensaje completo permanece dentro de pantalla.

**Veredicto acotado:** S12 visibilidad horizontal del error comprobada en los tres
viewports; S15 corrección mínima de fallo reproducido, sin rediseño ni revertir #58;
S20 implementación y regresión cumplidas, pero entrega en la misma PR #64 aún pendiente.
El CI exitoso `40215458021` pertenece a los bytes anteriores y no verifica este cambio.
La continuación del padre completó las verificaciones afectadas, sin repetir backend:

| Verificación posterior de T6 | Resultado observado |
| --- | --- |
| Revisión independiente de fuente y E2E integrado en copia aislada autorizada | **PASS, 3/3**, 62,365 s; cero inesperadas, omisiones o flaky; inspeccionó las tres capturas 503 y confirmó las geometrías anteriores |
| `npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless` | **562 aprobadas y 4 omisiones preexistentes**, exit 0 |
| `npm --prefix frontend run test:e2e` | **202/202**, exit 0 |
| `npm --prefix frontend run build` | Exit 0; aviso CSS de preferencias preexistente, sin cambio de presupuesto |
| MCP Playwright activo, aviso 503 sintético en 320/390 oscuro y 1440 claro | Texto completo dentro del viewport; anchos **280/350/400 px**; sin ofertas/historiales nuevos, operaciones externas ni cron |
| TypeScript y `git diff --check` | Exit 0 |

El MCP headed midió left/right **16/296**, **16/366** y **1016/1416**; la diferencia
con headless por la barra de scroll no cambia la prueba: todas las cajas están dentro
del viewport y escritorio conserva 400 px. Guardé capturas locales `mcp-*-error503.png`
en `.codegraph/issue57-toast/`; cerré el navegador y los servidores al terminar.
La copia independiente preservó los hashes de 617 archivos y no modificó el original.
Una tentativa anterior de revisión exclusivamente de fuente quedó no disponible por la
política de aislamiento del rol; sólo cuento como PASS la revisión runtime posterior
a la autorización humana específica. Sus resultados no sustituyen el nuevo CI.

No medí geometría productiva, ejecuté suites backend locales adicionales ni hice merge,
cierre de la issue o deploy manual. Commit/push y CI del nuevo HEAD se documentan en
la PR; el CI anterior se conserva únicamente como evidencia histórica.

## Registro histórico T1

Implementé un arnés focal con Express, controladores, configuración efectiva, scrapers,
normalización, ingreso, modelos, mutex y PostgreSQL reales. Al cerrar T1 obtuve
**31/31 pruebas**, antes de agregar las regresiones del recheck T3 (40/40 final).

El servidor separado pasó su comprobación funcional: bind en loopback, rechazo de acceso
sin token, búsqueda LinkedIn, normalización de tres filas crudas a dos identidades y
consulta SQL de las dos ofertas persistidas. Repetí una vez ese smoke y una vez la
suite focal en el lote acotado de corrección; ambos finalizaron con exit 0. La regresión
acotada de #20 aprobó sus tres pruebas en el lote anterior; no la repetí en este lote.

## T3 — Corrección acotada de tres bloqueos reproducidos

BASE de la tarea: `1e00fb24`; candidato recibido: `d195cdb5`. Corrijo sólo pruebas,
runner y CI, sin cambiar producción, dependencias, migraciones ni otras suites.
La verificación independiente anterior fue parcial; estos resultados locales no
sustituyen los pendientes globales ni demuestran un CI remoto aprobado.

- **B1:** `npm test` excluye únicamente `tests/integracion/issue-57-backend.test.js`.
  No agrego `SKIP`: la focal explícita `test:issue57` sigue ejecutándolo y
  `test:integracion` conserva su selección completa, incluida esta suite SQL. Esta
  última requiere intencionalmente los guards de todas las integraciones que seleccione.
  `npm --prefix backend run test:issue57:contratos` compara `--listTests` ordinario
  contra Jest sin filtro y exige que falte exactamente ese archivo, conservando los guards.
- **B2:** rechazo también `FIREBASE_SERVICE_ACCOUNT_JSON` y
  `FIREBASE_SERVICE_ACCOUNT_PATH`, nombres reales de configuración. Los dos casos
  usan JSON/ruta ficticios, comprueban el error exacto y el objeto de entrada intacto,
  sin invocar SQL ni abrir archivos de credenciales.
- **B3:** ambos pasos `npm | tee` de `integracion-issue57` declaran `shell: bash`.
  La comprobación ejecutable lee los comandos y shell reales de esos dos pasos,
  reproduce el template de Actions (`bash --noprofile --norc -e -o pipefail`),
  sustituye npm por una función que imprime una línea y retorna 23 y exige tanto
  exit **23** como el contenido exacto creado por tee. Los demás jobs no cambian.

Agrego seis casos HTTP reales para `maxResultados` igual a
`0`, `-1`, `1.5`, `501`, `'2'` y `null`: HTTP 400, mensaje exacto, cero llamadas
al proveedor y contenido completo de todas las tablas y secuencias del esquema,
ordenado y con SHA256, sin cambios. También compruebo un ciclo aceptado con 202
que falla por el trigger real de inicio de historial: terminal `error`, ninguna
oferta ni historial ni llamada a proveedor. Al desactivar el fallo, otro 202 alcanza
`sin_resultados` y persiste una fila de historial con `fin` no nulo. No comparo todos
los campos después de una evaluación legítima.

### Evidencia local de la corrección

Antes de ejecutar verifiqué que no había variables PG/DB/Firebase heredadas;
no imprimí valores ni leí `.env`. Todos los logs completos stdout/stderr y exits
están en `.codegraph/issue57-correccion/`. La caché Jest también queda allí.

Prefijo exacto SQL utilizado (abreviado como `SQL` sólo en la tabla):

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable
```

| Comando desde raíz | Resultado observado / log |
| --- | --- |
| `node backend/scripts/test-issue-57-contratos.js` antes de corregir | RED exit 1, descubrimiento incluye SQL y ambos pipelines devuelven 0 en lugar de 23; `red-contratos.log` |
| `env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test node backend/node_modules/jest/bin/jest.js --rootDir backend --runInBand --cacheDirectory "$PWD/.codegraph/issue57-correccion/jest-cache" --runTestsByPath backend/tests/integracion/issue-57-seguridad.test.js` | RED exit 1: dos variables Firebase aceptadas, 15 guards previos aprobados; `red-guards.log` |
| `node backend/scripts/test-issue-57-contratos.js` después de corregir | GREEN exit 0, tres comprobaciones aprobadas; `green-contratos.log`, `shell-backend.log`, `shell-e2e.log` |
| `SQL node backend/node_modules/jest/bin/jest.js --rootDir backend --runInBand --cacheDirectory "$PWD/.codegraph/issue57-correccion/jest-cache" --runTestsByPath backend/tests/integracion/issue-57-seguridad.test.js backend/tests/integracion/issue-57-backend.test.js --testNamePattern='cierro el acceso\|maxResultados=\|acepto 202 pero'` | Primera exit 1: 6 fallos del snapshot de secuencias (`relation ... does not have a composite type`); corrección única a `SELECT *` y serialización ordenada, luego exit 0: 24 aprobadas, 16 fuera del filtro; `green-afectadas.log`, `green-afectadas-correccion.log` |
| `SQL npm --prefix backend run test:issue57` | Una corrida final exit 0: **40/40**, dos suites, ninguna omitida; `final-focal.log` |
| `env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test npm --prefix backend test -- --runInBand --cacheDirectory "$PWD/.codegraph/issue57-correccion/jest-cache"` | Una corrida final exit 0: **2599 aprobadas, 159 omitidas preexistentes**, 79 suites aprobadas; `final-ordinaria.log` |

Uso `--runInBand` para acotar procesos y `--cacheDirectory` para no generar scratch
fuera del directorio autorizado. Los casos suplementarios son regresiones de
contratos existentes, no defectos productivos nuevos: no fabrico RED funcional.
El RED de su primera ejecución fue exclusivamente un error del snapshot del test.

Cobertura de esta corrección: **S5/S13** guards y entorno, **S8/S10** fallo terminal
y recuperación, **S14/S16** RED/GREEN y regresiones afectadas, **S17** evidencia y
límites documentados. No cierro la aceptación global de S1–S19 ni la entrega de S17.
No repetí navegador, Angular ni build porque no cambiaron. `test:integracion` y
`test:db` completos siguen pendientes: la regresión DB anterior chocó con la
migración 005 en esquemas sintéticos acumulados; el padre provisionará una base
sintética separada fresca. No modifiqué esa migración ni presento el bloqueo como
un resultado aprobado. No ejecuté revisiones nuevas, CI remoto, commits o deploy.

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
mismo recorrido real. Al cerrar T1 quedaba pendiente integrar Angular sin el interceptor
de API sintético, resolver la identidad ficticia sólo en su entrada de prueba y ejecutar
Playwright; registro la implementación y los resultados de T2 más abajo.
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

Durante T1 no ejecuté suites completas, builds, navegador ni verificación productiva.
No hice commits, push, PR, revisión ni despliegue.

## T2 — Navegador real, ejecución focal aprobada

Ejecuté **3/3 recorridos aprobados, sin omisiones ni retries**, en 57,2 segundos:
1440×900 claro, 390×844 oscuro y 320×844 claro. En los tres participaron Angular 20,
`/usr/bin/google-chrome`, Express de T1 y PostgreSQL 15 reales. No afirmo que Buscar
funcione en producción ni doy por terminada la aceptación global antes de T3.

### Entrada separada y fronteras

- Reutilizo Dashboard, PanelControl, tabla/tarjetas, detalle, servicios, caché,
  IndexedDB y `authInterceptor` productivos. **No genero respuestas API mediante
  interceptores ni `route.fulfill`.** Sustituyo solamente `AuthService` por la identidad
  y token ficticios en `e2e/main-integracion.ts`; no inicializo Firebase externo.
- El target independiente `frontend:integracion` no es una configuración de
  `frontend:build`. El build por defecto sigue siendo `production`, con `src/main.ts`
  y su reemplazo productivo habitual. La entrada de integración además rechaza cualquier
  origen distinto de `http://127.0.0.1:4357`. Su salida explícita se llama
  `e2e/integracion/salida/build-no-publicar`; no debe publicarse.
- `serve:integracion` usa un índice local sin Google Fonts y un proxy hacia
  `127.0.0.1:3057`. El proxy presenta `Origin: http://127.0.0.1:4200`, ya autorizado
  por T1. Este recorrido comprueba HTTP y autenticación, **no CORS entre orígenes**.
  Las capturas usan fuentes de sistema; los iconos Material externos aparecen como texto.
- Conservo `e2e/main.ts`, `playwright.config.ts` y las suites anteriores sin cambios.
  El archivo nuevo termina en `.integracion.ts`, fuera del patrón `.spec/.test` de la
  suite histórica. Sólo lo selecciona `playwright.integracion.config.ts`.
- Playwright inicia ambos servidores en loopback, rechaza reutilizar servidores previos
  y los cierra con SIGTERM. Los procesos hijos reciben un entorno mínimo; el runner API
  recibe únicamente las ocho variables sintéticas validadas. No leo `.env` personal.
  Cada recorrido tiene contexto navegador nuevo y reset SQL; no ejecuto casos en paralelo.
  El servicio de automatización vive durante la suite: su último resultado en memoria
  puede seguir visible al iniciar el siguiente caso, pero ningún caso lo toma como
  evidencia de su ciclo nuevo: exige su propio POST, polling y fila SQL terminal.
- El navegador bloquea y registra destinos fuera del servidor local. Las tres
  aserciones finales obtuvieron **cero destinos externos**, cero `pageerror` y cero
  solicitudes fallidas de transporte. El backend también mantuvo `inesperadas=[]`
  y ninguna fila de cron activa. Proveedores, DeepSeek y verificador Firebase siguen
  siendo los fixtures externos de T1; no hago scraping pago, correos ni postulaciones.

### Recorrido y evidencia SQL

En cada viewport creo una oferta inicial por el endpoint real. Consulto configuración
mediante el botón del panel y verifico `terminos=['desarrollo junior']` con origen
`preferencias`. Selecciono LinkedIn en móvil o su botón en escritorio; la búsqueda
real deja **dos ofertas únicas** y **dos historiales individuales finalizados**.
Conservo ID y primera fecha de la oferta previa; verifico también las keywords que
recibió el adaptador. El endpoint `/api/ofertas` devuelve esos mismos IDs.

Retengo brevemente el **envío** del POST, sin sustituir su respuesta, para observar
el overlay y ambos controles deshabilitados. Compruebo exactamente un POST por acción.
Filtro LinkedIn, abro el detalle desde botón o tarjeta según el viewport, cierro con
Escape y consulto historial. No duplico componentes ni agrego botones al código
productivo: la entrada de prueba sólo añade un botón que llama a `Dashboard.cargarDatos()`.

Inyecto dos fallos reales:

1. El control T1 activa el trigger `historial_inicio`: la búsqueda devuelve **503**,
   `exito=false` y un aviso visible de historial. Ofertas, historial y llamadas al
   proveedor quedan exactamente iguales. Desactivo el fallo y repito: **200**, sin
   duplicados y con listado actualizado.
2. Verifico por SQL base, usuario, versión 15 y esquema propio antes de renombrar
   temporalmente `fecha_ultima_extraccion`. El GET de sincronización devuelve **500**;
   Dashboard intenta su fallback `/api/ofertas`, que también devuelve **500**. Espero
   ambos y el texto exacto que informa conservación de datos no actualizados. Las dos
   ofertas siguen visibles. Restauro la columna en `finally`, vuelvo a actualizar y
   exijo **200**, sincronización completada y las mismas dos ofertas.

Después ejecuto el ciclo manual por UI: observo **202**, overlay y botón deshabilitado,
pero no lo considero terminado. Espero el polling **200** con `activo=false` y
`porcentaje=100`; verifico estado global **parcial**, LinkedIn completada, Indeed en
error y Google Jobs deshabilitada/omitida. La UI muestra Parcial y avisos visibles,
no éxito total. La consulta SQL de T1 devuelve la ejecución `ciclo_manual`, `fin`
no nulo y las dos ofertas útiles. Otro ciclo vacío vuelve a terminar, ahora
`sin_resultados`, conservando ofertas. Cada caso termina con **dos ofertas y cinco
historiales**, último ciclo finalizado. Exijo exactamente tres POST individuales y
dos POST de ciclo desde el navegador.

No agregué un segundo caso navegador de notas/estado manual: T1 ya verifica ese contrato
por HTTP y SQL. Tampoco repito en navegador toda su matriz 429/timeout/cancelación/cursor;
T2 agrega el cruce real de capas y la recuperación renderizada. No son omisiones de T1.

### Consola y capturas

No suprimo errores genéricos. Exijo exactamente estos tres HTTP fallidos, en orden:
`POST /api/scraping/linkedin → 503`, `GET /api/ofertas/sincronizacion → 500`,
`GET /api/ofertas → 500`. También exijo los tres mensajes de recurso HTTP de Chrome
con su URL/estado exactos y los dos diagnósticos Angular:
`Error al sincronizar dashboard: HttpErrorResponse` y
`Error al cargar dashboard: HttpErrorResponse`, ambos desde `main.js`.
Cualquier error adicional hace fallar el test. Compruebo ausencia de desborde horizontal
con configuración abierta, detalle abierto, resultado parcial y recuperación.

Las **nueve capturas originales** son `detalle.png`, `ciclo-parcial.png` y
`dashboard-recuperado.png` en cada directorio de
`frontend/e2e/integracion/salida/resultados/busqueda-real.integracion.*`.
Son datos ficticios, sin información personal. Playwright las adjunta a su reporte,
junto con JSON de evidencia SQL después de Buscar, después del ciclo terminal y al
final. El directorio dedicado también contiene `api.log`, `angular.log` y
`resultados.json`; las trazas y capturas de fallo se conservan cuando un caso falla.
`salida/` está ignorado por Git.

El job nuevo `integracion-issue57` ejecuta una vez la suite backend focal y esta suite
navegador, con PostgreSQL 15 y **puerto, base, usuario, contraseña y flags exactamente
iguales al guard**. Conserva logs, capturas, SQL y trazas con `if: always()`. No cambia
los jobs anteriores ni instala dependencias nuevas. Su CI remoto todavía no se ejecutó
ni se verificó en esta tarea.

### Comandos T2 y resultados observados

Ejecuté desde la raíz, sin variables personales heredadas:

```sh
env -i PATH="$PATH" npm --prefix frontend run prebuild
frontend/node_modules/.bin/tsc --project frontend/tsconfig.integracion.json --noEmit

env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true \
PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test \
PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable \
npm --prefix frontend run test:e2e:integracion
```

| Comprobación | Evidencia observada |
| --- | --- |
| RED antes de crear la entrada Angular | `env -i` con las mismas ocho variables y `npm --prefix frontend exec -- playwright test --config frontend/playwright.integracion.config.ts`: exit 1; `Configuration 'integracion' for target 'serve' ... is not set` |
| `npm --prefix frontend run prebuild` con `env -i PATH` | exit 0; placeholders ignorados generados desde ejemplos, sin copiar `.env` |
| `tsc --project frontend/tsconfig.integracion.json --noEmit` | exit 0 antes y después de la corrida focal |
| Primera corrida del script focal | exit 1; 0/3. Escritorio llegó al cierre y reveló el fallback 500 no contabilizado; móvil esperaba el nombre accesible equivocado |
| Primera corrección y segunda corrida | exit 1; 0/3. Escritorio capturó un 200 de sincronización anterior todavía en vuelo; móvil usa tarjetas y no botones de detalle |
| Segunda corrección y corrida final | **exit 0; 3/3 aprobadas, 57,2 s**, sin retries ni omisiones |
| Chequeo TypeScript explícito de config/spec desde raíz | primera invocación sin `typeRoots`: exit 2, no resolvía `node:module`/`process`; corregí sólo el comando a `frontend/node_modules/.bin/tsc --noEmit --skipLibCheck --target ES2022 --module commonjs --esModuleInterop --strict --typeRoots frontend/node_modules/@types --types node frontend/playwright.integracion.config.ts frontend/e2e/integracion/busqueda-real.integracion.ts`: exit 0, sin instalar nada |
| `ss -ltn '( sport = :3057 or sport = :4357 )'` | exit 0, sin sockets escuchando después de Playwright |
| Inspección estructural con `node` + `assert/strict` sobre `angular.json` y sufijo del spec | exit 0; build productivo, entrada sintética y entrada integrada separados |
| `git diff --check` | exit 0, sin salida |

La salida stdout/stderr de las corridas está registrada en las llamadas foreground de
esta sesión. Los logs de los servidores y el JSON local reflejan la última corrida;
la tabla conserva los fallos anteriores y sus causas, sin presentarlos como aprobados.
No ejecuté suites amplias ni build productivo: corresponden a T3. No hice commits,
push, PR, revisión independiente ni despliegue.

### Cobertura de Specs de T2

| Spec | Veredicto focal |
| --- | --- |
| S3 | Nivel C aprobado con Angular → Express → PostgreSQL reales; nivel B heredado de T1 |
| S6 | AuthService ficticio sólo en bootstrap aislado; interceptor y middleware reales; rechazos 401/403 ya comprobados por T1 |
| S7 | Configuración/preferencias, POST, persistencia SQL, refresco, listado, detalle e historial aprobados en los tres viewports |
| S8 | 202, polling terminal, estados de fuentes, parcial útil, historial durable y segundo ciclo sin resultados aprobados |
| S9 | Carga previa, nuevas ofertas, IDs únicos, primera fecha conservada, sincronización fallida con datos retenidos y recuperación renderizada aprobados; cursor y seguimiento manual quedan en T1 |
| S10 | 503 SQL, conservación exacta, reintento y parcial aprobados en UI; resto de la matriz se mantiene en T1 |
| S11 | Entrada/config separadas y tres viewports con claro/oscuro representativos; suite sintética anterior intacta |
| S12 | Acciones, carga/disabled, filtro, detalle/regreso, historial, ciclos, errores exactos, cero solicitudes duplicadas y cero overflow aprobados |
| S13 | Guards intactos, loopback, entornos mínimos, sin destinos externos ni cron; APIs pagas/Firebase/email siguen simulados |
| S15 | Sólo superficies autorizadas de pruebas, configuración, CI y documentación; sin cambios productivos ni dependencias nuevas |
