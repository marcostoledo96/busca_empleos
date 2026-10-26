# T3 — Aislamiento del tráfico del fixture HTTP

## Autoverificación de esta corrección: COMPLETED

El incidente previo fue de **contabilidad del listener de tests**, no una regresión de producto
demostrada: el fixture sumaba cualquier solicitud entrante al contador del CLI, incluido `GET /`.
Preservo `T3-artifact-full.log`: dos solicitudes espontáneas de raíz con `Go-http-client/1.1`
y seis solicitudes del CLI produjeron el esperado6/recibido8. Su procedencia concreta sigue
**desconocida**; el User-Agent no identifica de forma confiable un proceso ni se usa para filtrar.
Esto es autoverificación del writer de los nuevos tests, no otro ciclo de revisión independiente.

## Cambio mínimo del harness, no del producto

Único archivo de código modificado en esta continuación:
`backend/tests/scripts/smoke-release.test.js`.

- El listener responde **404** a tráfico sin `_smoke` ni autorización y lo registra por separado
  en `llamadasAjenas`, incluyendo método, URL, headers y estado. No lo descarta silenciosamente
  ni lo entrega al callback que construye respuestas válidas del smoke.
- Las solicitudes con **cualquier** `_smoke` o autorización permanecen en `llamadas`:
  nonce inválido, rutas inesperadas o auth indebida no pueden esconderse en el registro separado.
  Rutas fuera del contrato reciben 404 incluso si tienen nonce, y siguen contadas para fallar.
- Después de **cada** invocación efectiva del CLI verifico exactamente seis solicitudes,
  todas GET, las seis rutas y query exactas en orden, un solo nonce común hexadecimal de
  24 caracteres y una sola ocurrencia de `_smoke` por solicitud. Verifico ausencia de auth
  en health y token esperado en las otras cinco (o ausencia si el caso no tiene sesión).
- Invocaciones de ayuda/configuración rechazada siguen exigiendo cero llamadas del CLI.
- Conservo assertions previas de no-cache, token privado fuera de salida, HTTP/redirect,
  seis llamadas y todas las salidas/estados; el contador ahora mide tráfico del protocolo CLI,
  no tráfico agregado del servidor. Los endpoints inesperados etiquetados no se filtran.

La regresión agrega deliberadamente un `GET /` local sin nonce/auth, identificado para su
comprobación por `X-Prueba-Ajena: inyeccion-local`. Comprueba 404, registro separado, seis GET
CLI, exit0, stderr vacío y stdout completo sanitizado (normaliza sólo milisegundos variables).
Ese header no interviene en la clasificación del listener; sólo permite localizar la solicitud
inyectada aunque también llegue otro tráfico ajeno espontáneo.

No modifiqué CLI, app, workflow, dependencias, fixtures PostgreSQL ni guardas SQL. Los cambios
previos del padre y los de las tandas anteriores permanecen intactos.

## RED determinista antes del fix

Agregué primero la regresión conservando la contabilidad original del listener. Ejecuté:

```bash
cp backend/tests/scripts/smoke-release.test.js docs/evidencias/issue-61/runtime/candidato/backend/tests/scripts/smoke-release.test.js && cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/smoke-release.test.js > ../../T3-aislamiento-red.log 2>&1
```

Exit **1**, **47 PASS /1 FAIL**, Jest **7.434s**, wall **7.837s**.
Sólo falló la inyección: esperado6/recibido7, con el GET raíz inyectado y los seis GET del CLI.
Log ignorado `T3-aislamiento-red.log`; token ficticio redactado tras capturar el fallo.
No dependí de que reaparecieran solicitudes espontáneas ni las provoqué desde otra red.

## GREEN focal, una sola corrección

Después del cambio de listener y assertions por invocación:

```bash
cp backend/tests/scripts/smoke-release.test.js docs/evidencias/issue-61/runtime/candidato/backend/tests/scripts/smoke-release.test.js && cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/smoke-release.test.js > ../../T3-aislamiento-green.log 2>&1
```

Exit **0**, **1 suite /48 PASS**, sin omisiones. Jest **7.496s**, wall **7.977s**.
Incluye el GET raíz deliberado, todos los estados de historial y preservación de HTTP500/redirect,
auth, caché, cuerpo privado y timeout. Log ignorado `T3-aislamiento-green.log`.

## Full guardado posterior, una sola ejecución

Mismo aislamiento previamente documentado: copia de fuentes sin `.env`, dependencias enlazadas
del worktree, preload que neutraliza dotenv/bloquea lecturas de `.env*` y red externa, setup
Jest sin dotenv, `env -i`, TMPDIR/cachés dentro del runtime autorizado. Mismo PG15 sintético,
sin concurrentes ni nueva preparación de fixtures. No repetí runners PG sin cambios;
los tests de BD que pertenecen al full se ejecutan por `ALLOW_DB_TESTS=true` con sus guardas.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true ALLOW_DB_TESTS=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm test -- --runInBand > ../../T3-aislamiento-full.log 2>&1
```

Exit **0**, **90 suites PASS /4 omitidas**, **2921 PASS /7 omitidos**, Jest **26.945s**,
wall **27.541s**. Sin fallos; omisiones opt-in preexistentes, no agregadas ni contadas como PASS.
Log ignorado `T3-aislamiento-full.log`. No oculto ni reemplazo el full rojo anterior.

```bash
git diff --check
```

Exit **0**, sin salida.

## Autorrevisión S# y límites

- S10/S11 enlazadas: el harness sigue verificando seis GET efectivos, contratos/auth/salidas
  privadas/redirect/caché/timeout. Tráfico ajeno no se confunde con evidencia funcional.
- S15: RED determinista antes del fix, GREEN focal y full guardado en orden; sin assertion
  debilitada ni SKIP agregado. Los comandos de esta continuación están completos arriba.
- S16: diagnóstico basado en tráfico observado, una corrección del harness y memoria guardada;
  no atribuyo fuente desconocida ni llamo regresión productiva al incidente de infraestructura.
- S1 global, disposición de T3 y revisión independiente final permanecen bajo el padre.
  El full local verde no acredita producción ni CI remoto.
- Sin providers externos, frontend, producción, Railway/Vercel, commit/push o cambios al contenedor.
  PG15 original permanece activo. No borré scratch, logs ni evidencia histórica.
