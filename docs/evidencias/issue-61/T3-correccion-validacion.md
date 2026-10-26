# T3 — Corrección del smoke y validación amplia

## Dictamen histórico de esta tanda: PARTIAL

Corregí el hallazgo independiente reproducible de `interrumpida`. Este informe conserva
la primera tanda de validación y su fallo YAML. La continuación autorizada corrigió ese
assertion: ver [T3-artifact-correccion.md](T3-artifact-correccion.md) para el focal nuevo y el
full posterior. Ese full encontró otra interferencia HTTP; la continuación autorizada la
reprodujo como defecto del harness y obtuvo full verde: ver [T3-aislamiento-smoke.md](T3-aislamiento-smoke.md).
La disposición final del candidato sigue siendo del padre.
El contraste histórico del test YAML con BASE `7cdc6bc62898b3b5f9d1b8b090e3ee571249c439`
se conserva abajo, sin presentarlo como estado vigente del assertion.

No modifiqué el ODD (cambios del padre preservados), CI ni comportamiento histórico de la aplicación.
No hice commit/push, build frontend, llamadas productivas, Railway/Vercel ni proveedores externos.
El contenedor `busca-empleos-issue61-7cdc6bc-20261026`, ID
`3ed45dd1f59aca0c368786e9154c7aada64b1b6afb28be07c430f35f7039e6b2`, queda activo.

## Corrección mínima y RED/GREEN

En BASE, `backend/src/modelos/ejecucion-busqueda.js:interrumpirPendientes` ya escribe
`estado = 'interrumpida'` al reiniciar. El smoke omitía ese estado válido. Agregué únicamente
ese valor a su lista; no cambié auth, transporte, caché, límites, timeout ni mensajes.

Agregué 14 casos por CLI real con servidor HTTP loopback y seis respuestas válidas:
11 estados válidos (los diez anteriores más `interrumpida`) y rechazo de `desconocida`, `null`,
y cadena vacía. Verifico exit exacto, stderr vacío, stdout completo (normalizando únicamente
los milisegundos variables), seis GET y ausencia de token/cuerpo privado en salida.
La fixture no persiste datos; sólo registra solicitudes GET. No hay counters de negocio que modificar.

Desde la raíz, tanto RED como GREEN usaron este comando (logs `T3-red.log` y `T3-green.log`):

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/smoke-release.test.js
```

- RED: exit **1**, **46 PASS / 1 FAIL**, **7.382s**. Sólo `interrumpida`: esperaba exit0, recibió exit1.
- GREEN tras el agregado de un estado: exit **0**, **47 PASS**, **7.329s**.
- Preservación final: **67 PASS** (47 smoke +20 runner/guardas/YAML), exit0, **7.867s** Jest / **8.242s** wall.
- Help y docs de opciones no requieren cambios: no agregué comandos, opciones ni mensajes.

**Limitación de aislamiento de los dos primeros focales:** usaron `--no-cache` pero no fijaron
`TMPDIR`; Jest puede usar su directorio temporal predeterminado. No inspeccioné, limpié ni
borré `/tmp`. Las verificaciones posteriores fijaron sus salidas dentro de la superficie permitida.

## Aislamiento de la validación amplia

Inspeccioné scripts, guardas y harnesses antes de ejecutar. #57 escribe caché en `.codegraph`,
#59 escribe runtime propio y Jest genera temporales. Para no escribir esas rutas en el árbol
principal, preparé dos copias de fuentes dentro del runtime ignorado de #61:

```bash
node docs/evidencias/issue-61/runtime/preparar-copia.cjs
node docs/evidencias/issue-61/runtime/preparar-copia.cjs 7cdc6bc
```

Ambos comandos exit0. Copias `candidato/` y `baseline/` sólo contienen archivos versionados de
`backend`, `.github` y `docs/api-rest.md`; excluyen `.env*`, `.git` y dependencias copiadas.
`node_modules` enlaza las dependencias ya instaladas del mismo worktree. No instalé paquetes.
El único ajuste de configuración en las copias es setup Jest sin dotenv y caché local;
no modifiqué tests ni assertions en esas copias.

`setup-jest.cjs` simula únicamente dotenv como el setup existente de #61. `preload.cjs` neutraliza
dotenv para hijos Node, bloquea lectura de `.env*` e instala el bloqueo de sockets externos
existente `issue-57-proveedores.cerrarRed`; fetch externo falla cerrado. Las suites explícitas
#57/#59/#61 conservan además sus propios proveedores y guardas. No heredé claves, HOME, URLs,
NODE_OPTIONS ni configuración productiva: todos los comandos arrancan con `env -i PATH`.
Los comandos siguientes sólo introducen un preload conocido de esta verificación.

Preparé `public.ofertas` **antes** de `test:db`, tal como exige la evidencia #56 para los
fixtures `LIKE public.ofertas`. `preparar-public.cjs` invoca `validarEntorno`, consulta identidad
real (base/usuario/PG15), rechaza un template existente y sólo después aplica los SQL históricos
sobre `public` sintético. Acota guards legacy a `current_schema`, igual que el helper de #57.
No modifiqué migraciones ni usé el runner sobre producción.

```bash
env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable node docs/evidencias/issue-61/runtime/preparar-public.cjs
```

Exit0: identidad PG15 validada y public preparado. El contenedor es el original T1/T2,
`postgres:15`, publicado sólo en `127.0.0.1:55457`. Ninguna ejecución fue concurrente.
Las credenciales que aparecen en los comandos son exclusivamente las sintéticas del repositorio.

## Comandos exactos y resultados observados

Todos en foreground. Los stdout/stderr se redirigieron a `../../T3-<nombre>.log` desde
`runtime/candidato/backend` (baseline usa `runtime/baseline/backend`). `time` imprimió wall
al terminal; no atribuyo esos tiempos a CI remoto.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm run test:issue61 > ../../T3-issue61.log 2>&1
```

Exit **0**, **2 suites /32 PASS**, Jest **6.717s**, wall **7.378s**. Primero el runner focal
SQL/HTTP real, antes de suites amplias. Snapshots, permisos/read-only y contratos preservados.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm run test:integracion > ../../T3-integracion.log 2>&1
```

Exit **0**, **6 suites /62 PASS**, **4 suites /7 tests omitidos por opt-in preexistente**,
Jest **2.153s**, wall **2.620s**. No agregué SKIP; no cuento esas omisiones como evidencia aprobada.
Son #20/#22 PostgreSQL con DSN opt-in, #22 vertical, búsquedas vertical (suite parcialmente ejecutada)
y #56 reconciliación opt-in. No inventé DSN
de #56 (sus guardas usan otra base/puerto) ni lancé frontend para las verticales.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm run test:db > ../../T3-db.log 2>&1
```

Exit **0**, **16 suites /211 PASS**, sin omisiones, Jest **5.023s**, wall **5.403s**.
El script activa `ALLOW_DB_TESTS=true`; guardas de fixture vigentes.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true ALLOW_DB_TESTS=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm test -- --runInBand > ../../T3-full.log 2>&1
```

Exit **1**, **89 suites PASS /1 FAIL /4 omitidas**; **2917 PASS /1 FAIL /7 omitidos**,
Jest **27.491s**, wall **27.964s**. Falla nueva de coherencia del test de artifact #59:
regex exige `path: frontend/e2e/integracion/salida/`, mientras T2 ahora tiene `path: |`.
No es un fallo de PostgreSQL ni del smoke corregido. No lo oculté ni debilité la assertion.

```bash
cd docs/evidencias/issue-61/runtime/baseline/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true ALLOW_DB_TESTS=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm test -- --runInBand --runTestsByPath tests/servicios/issue-59-runner.test.js > ../../T3-baseline-issue59-runner.log 2>&1
```

Exit **0**, **1 suite /5 PASS**, Jest **1.601s**, wall **1.965s**.
**No heredado**: mismo test en BASE pasa. No fue necesario reproducir los dos problemas
históricos de fixtures mencionados en #66: no aparecieron en `test:db`.
No hice un segundo ensayo del full sin un cambio real: la causa está fuera del alcance.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm run test:issue57 > ../../T3-issue57.log 2>&1
```

Exit **0**, **2 suites /40 PASS**, Jest **12.796s**, wall **13.303s**.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" npm run test:issue59 > ../../T3-issue59.log 2>&1
```

Exit **0**, **1 suite /2 PASS**, Jest **1.359s**, wall **1.895s**.

```bash
cd docs/evidencias/issue-61/runtime/candidato/backend && time env -i PATH="$PATH" NODE_ENV=test TMPDIR="$PWD/../../" npm_config_cache="$PWD/../../npm-cache" NODE_OPTIONS="--require=$PWD/../../preload.cjs" node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/smoke-release.test.js tests/scripts/test-issue61.test.js > ../../T3-focal-final.log 2>&1
```

Exit **0**, **2 suites /67 PASS**, Jest **7.867s**, wall **8.242s**.

## CI secuencial y autorrevisión de specs

El workflow conserva un único servicio PG15 en `integracion-issue57`; orden declarado:
#57 → #61 → #59 → E2E. Los tres runners SQL pasaron en el mismo contenedor y cada uno
prepara su esquema propio con validación previa de identidad. Localmente prioricé #61 antes
de suites amplias como exige S15; #57 y #59 también terminaron sin conflicto de fixtures.
No hay servidor nuevo, matriz nueva ni job nuevo. **CI remoto no ejecutado en esta unidad**.
La forma del artifact sí requiere reconciliar el test #59 antes de considerar el full verde.

| Spec | Autorrevisión |
|---|---|
| S1 | Hallazgo smoke corregido; objetivo global no cerrado por el fallo nuevo de full. |
| S10 | Seis GET reales, contratos no vacíos de historial con todos sus estados; desconocidos fallan cerrado; sin acciones de negocio. |
| S11 enlazada | Auth/caché/no-cache/nonce/no salida privada/timeout conservados por 47 tests de smoke; Firebase productivo intacto. |
| S12 | Estado histórico válido ya no genera falso FALLO; estado desconocido sigue FALLO exit1. Health solo no acredita rutas. Producción NO VERIFICADO. |
| S15 | Orden focal→amplias cumplido; todos los comandos requeridos ejecutados y fallos informados; baseline distingue nueva regresión. Full sigue rojo. |
| S16 | Hallazgo concreto del verificador reproducido/corregido; sin buscar herramientas de review. Exploración/CodeGraph previos pertenecen al padre; no los reclamo como nuevos. Decisión/fix guardados en Engram `busca-empleos`. Nueva verificación independiente queda al padre. |

Propuesta histórica de esta primera tanda (**implementada después con autorización**, ver
`T3-artifact-correccion.md`):
reconciliar `backend/tests/servicios/issue-59-runner.test.js` con el bloque YAML del artifact,
idealmente comprobando sus paths efectivos sin depender de formato escalar; luego repetir
ese focal y el full. La revisión/decisión de ampliar superficies y el commit siguen siendo del padre.

No borré scratch, fixtures ni documentación. Runtime ignorado conserva comandos auxiliares,
logs y copias para diagnóstico; no son artifacts publicados ni contienen credenciales reales.
La copia del workflow que Jest imprime al fallar incluye configuración **sintética**
versionada del servicio, no un dump de entorno ni secretos reales. En el log full reemplacé
únicamente el valor sintético de PGPASSWORD por una marca de redacción; mantuve el fallo y su contexto.

`git diff --check`: exit **0**, sin salida. El ODD dirty es preexistente y queda al padre.
