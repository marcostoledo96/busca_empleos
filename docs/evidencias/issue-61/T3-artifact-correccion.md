# T3 — Corrección focal del assertion de artifact SQL59

## Resultado histórico de esta tanda: PARTIAL

La corrección autorizada del test SQL59 está terminada y su focal pasa. El full de esta tanda
terminó exit1 por **otro** test de smoke, con solicitudes loopback adicionales observadas.
No reintenté sin un cambio real ni modifiqué el smoke fuera de alcance en esta tanda.
La continuación autorizada diagnosticó la contabilidad del fixture y observó full verde:
ver [T3-aislamiento-smoke.md](T3-aislamiento-smoke.md). Este informe conserva el fallo previo
sin confundirlo con una regresión de producto demostrada.

## RED y causa comprobada

Reutilicé el RED ya observado y autorizado del full anterior: **2917 PASS /1 FAIL**, donde
`CI ejecuta SQL59 en el job aislado y conserva identidad, salida y exit incluso ante fallos`
rechazaba `path: |` porque una regex exigía `path: frontend/e2e/integracion/salida/`.
El mismo focal en BASE `7cdc6bc` había pasado **5/5**. Esa evidencia permanece en los logs
`T3-full.log` y `T3-baseline-issue59-runner.log`; no la presento como una ejecución nueva.

La semántica del workflow era correcta: upload-artifact recibe una cadena con rutas separadas
por saltos de línea. No requería cambiar CI. Cambié sólo
`backend/tests/servicios/issue-59-runner.test.js`:

- Uso `js-yaml`, ya instalado y usado por el test de #61.
- Comparo la lista efectiva **exacta** con `frontend/e2e/integracion/salida/` y
  `docs/evidencias/issue-61/runtime/*.json`; no basta que exista un artifact.
- Exijo explícitamente el `tee` de `frontend/e2e/integracion/salida/issue59-sql.log`.
- Mantengo `if: always()`, el job `integracion-issue57`, servicio único `postgres`,
  imagen `postgres:15-alpine` y puerto `55457:5432`.
- Mantengo los ensayos del pipeline con exit42/exit0, stdout/stderr, identidad PR/checkout/tree,
  log igual a salida, guardas de entorno y exclusión de SQL explícito del runner general.
- Agrego una regresión parametrizada de dos formatos: escalar previo y bloque actual.
  El formato previo conserva la ruta SQL59; el actual incluye además la evidencia #61.

No edité workflow, test-issue61 ni código de aplicación. Los cambios previos del smoke y del
ODD quedaron preservados. No hay assertion relajada ni SKIP agregado.

## Verificación nueva, únicamente focal y full

Misma copia aislada `runtime/candidato` y configuración documentada previamente: dotenv
neutralizado y lectura `.env*` bloqueada, bloqueo existente de proveedores externos,
`env -i`, PG15 sintético validado previamente y temporales/cachés dentro del worktree.
Copié únicamente el test actualizado a esa copia; no preparé fixtures otra vez ni repetí
los runners PostgreSQL sin cambios. Los tests de BD que forman parte del full sí se ejecutan
por `ALLOW_DB_TESTS=true`, conservando sus guardas.

### Focal GREEN

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true ALLOW_DB_TESTS=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm test -- --runInBand --runTestsByPath tests/servicios/issue-59-runner.test.js > ../../T3-artifact-focal.log 2>&1
```

Exit **0**, **1 suite /7 PASS**, sin omisiones. Jest **1.517s**, wall **1.856s**.
Incluye el caso CI real y los dos formatos YAML. Log ignorado `T3-artifact-focal.log`.

### Full posterior

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true ALLOW_DB_TESTS=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm test -- --runInBand > ../../T3-artifact-full.log 2>&1
```

Exit **1**, **89 suites PASS /1 FAIL /4 omitidas**; **2919 PASS /1 FAIL /7 omitidos**.
Jest **25.363s**, wall **25.877s**. Las omisiones opt-in son preexistentes; no las cuento como PASS.
El test de artifact SQL59 pasa dentro del full.

Fallo observado: `HTTP 500 nunca es PASS ni sigue redirect`, en
`backend/tests/scripts/smoke-release.test.js:136`, esperaba 6 llamadas y registró 8.
El array de la assertion incluye dos solicitudes `GET /`, hosts loopback (`127.0.0.1` y
`localhost`), ambas con `user-agent: Go-http-client/1.1`, además de las seis GET del CLI.
El CLI Node no genera esas dos solicitudes de raíz. No atribuyo la procedencia concreta
a un proceso sin evidencia; no lo oculté filtrando llamadas ni debilitando el test.
No es una repetición del fallo YAML corregido. Requiere diagnóstico separado del entorno
que consulta puertos efímeros o del aislamiento de ese servidor, no un cambio en este assertion.
El log ignorado `T3-artifact-full.log` conserva el fallo, con token ficticio redactado.

### Diffcheck

```bash
git diff --check
```

Exit **0**, sin salida.

## Autorrevisión y límites

- S8 enlazada: prueba semántica del artifact en el mismo job/servicio, con log SQL59 y
  JSON #61 explícitos. Sin nuevos servicios, jobs o matrices.
- S15: focal y full ejecutados en orden, resultados completos informados; full sigue rojo
  por la interferencia HTTP observada, no por el assertion SQL59.
- S16: corrección mínima del hallazgo reproducido y registro de decisión/fix en Engram.
  Review independiente, disposición del candidato y commits quedan al padre.
- No repito aquí estados de runners PG que no ejecuté en esta continuación.
- Sin frontend, CI remoto, proveedores, producción, commit/push ni operaciones sobre el contenedor.
  El contenedor PG15 original queda activo; no borré scratch ni evidencia histórica.
