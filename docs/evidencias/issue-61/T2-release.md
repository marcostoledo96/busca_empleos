# T2 — Smoke read-only, CI y procedimiento de release

Autoverificación del writer; revisión independiente y publicación pertenecen al padre.
T1 preservado: `cf71b143166bc8957e3a6bac4a1f710598edda29`.
No edité el ODD (ya tenía cambios del padre), no hice stage/commit/push, merge ni deploy.
Cargué las cuatro skills exactas del handoff y consulté CodeGraph antes de explorar callers.

## Cobertura S8–S15

| Spec | Evidencia de esta unidad |
|---|---|
| S8 | Un paso en `integracion-issue57`, mismo PG15 loopback 55457, sin jobs/servicios/matrices/dependencias nuevos. Runner con guardas antes de fixtures, entorno CI `env -i`, rechazo de RELEASE_URL/TOKEN heredados, `pipefail`, artifact existente y medición de tiempo. |
| S9 | Guía distingue esquema efímero de esquema efectivo, diagnóstico de autorización, CI verde de producción saludable. Sin automatizar deploys. |
| S10 | CLI HTTP ejecutable sólo GET sobre las seis rutas exactas, 200 estricto, contratos reales y coherencia básica, 5s absolutos/1 MiB por respuesta; salida fija sanitizada. Logs externos requieren revisión operativa separada, explicitada en guía y ayuda. |
| S11 | Firebase y middleware real conservados; sólo frontera Firebase ficticia en pruebas. 401/403/sin sesión => NO VERIFICADO y exit 1. Sin redirects; sin auth al health; nonce/no-cache/no-store, sin condicionales; rechazo 304 y caché reconocida (incluso Age 0). No imprimo cuerpo/token/URL/error remoto. |
| S12 | Health no acredita PG; 500/503/202 no son PASS. Matriz de decisión y distinción 202 de inicio/fin explícitas en guía. |
| S13 | Apéndice breve de release: SHA candidato/publicado, tests/build, nuevas migraciones, esquema efectivo/preflight, aprobación separada de backup/recuperación, estado Railway/Vercel, smoke, errores, pendientes y evidencia. Corrijo sólo el snippet health erróneo relevante. |
| S14 | Sin producción, credenciales Firebase reales, proveedores, Railway/Vercel MCP, migraciones productivas, backups/restores, correos, cron ni deploys. No supongo credenciales/permisos por disponibilidad de MCP. |
| S15 | Primero RED/GREEN focal; luego callers compartidos y runner PG15 guardado, snapshots y diffcheck. Suites amplias y #57/#59 completas están diferidas a T3 por el padre, no se declaran verificadas aquí. |

S15 global y S16/S17 no se cierran en esta unidad. **Producción: NO VERIFICADO.**

## Cadenas auditadas y cambio mínimo

- `GET ofertas` y `GET ofertas/sincronizacion` → modelo oferta (SELECT) → `agregarVigencia`
  → `obtenerPreferencias({soloLectura:true})`. Antes la ausencia producía INSERT; ahora 503
  con texto fijo `No pude leer las preferencias requeridas. No modifiqué datos.`.
- `GET preferencias` usa esa misma opción. No cambio el default del accessor ni inicialización,
  actualizaciones, evaluación ni los demás callers de `agregarVigencia`.
- `GET scraping/previsualizacion` → `resolverConfiguraciones` → `leerPreferenciasBusqueda`:
  **ya usaba SELECT directo**, sin fallback creador; agrego sólo `requeridas` para que preview
  no convierta fila ausente en configuración por defecto. Lecturas normales conservan `{}`.
- `GET automatizacion/historial` → servicio → modelo `listar`: sólo SELECT, no lee preferencias,
  no requiere modificación. Error SQL ya responde 503 sanitizado.
- No agrego middleware contextual genérico ni plataforma de diagnóstico; no importo `index.js`
  ni su reparación de ejecuciones pendientes.

Contratos tomados del código real: `/api/ofertas` sin paginar tiene `limite_pagina:null` y
`total===datos.length`; empresa admite NULL. Historial usa BIGSERIAL serializado como string
con tipos `individual`, `ciclo_manual`, `cron`. Preview devuelve `datos.plataformas` con
`plataforma/nombre/habilitada/ejecutable/terminos/consultasEfectivas/ventanaDias/maxResultados/advertencias`.
Preferencias incluye `perfil_efectivo` y firma en el nivel superior. No valido columnas por costumbre.

## RED observado (antes de implementar los comportamientos respectivos)

Todos los comandos se ejecutaron desde la raíz del worktree, foreground, sin `.env` explícito.

### HTTP real / safeguard

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/integracion/issue-61-http.test.js
```

Exit 1, **3/3 fallaron**, 1.535s. CLI inexistente; GET ofertas sin preferencias intentó INSERT,
PG read-only lo rechazó y devolvió 500 en vez del 503 esperado. Después de implementación,
el positivo señaló dos diferencias del contrato real: listado sin paginación y BIGSERIAL.
Las corregí según modelo/migraciones; observé GREEN **3/3**, 1.579s. No relajé las aserciones
read-only ni los snapshots. El cuarto caso real de esquema ilegible se agregó posteriormente.

### CLI seguro

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/smoke-release.test.js
```

RED exit 1, **31/31 fallaron**, 1.071s: módulo aún inexistente. GREEN inicial 31/31, 6.649s.
Incluye cada contrato vacío, 401/403/500/503/304/202/302, redirect no seguido, JSON malformado,
exito false, cache Age/X-Cache/CF-Cache-Status, tipo incorrecto, total incoherente, body excesivo,
respuesta que gotea bytes (agotada en ~5.05s), opciones/URL/token inseguros, ausencia de sesión,
ayuda sin red y ausencia de contenidos/tokens en salida.
Se agregaron después Age cero y preservación de empresa NULL.

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/smoke-release.test.js --testNamePattern='acepto empresa NULL'
```

RED exit 1, **1 falló**, 0.341s; los otros 32 no seleccionados por el filtro, sin agregar `.skip`.
Contrato SQL permite NULL; lo acepto sin aceptar campo ausente. GREEN final en suite completa abajo.

### Guardas del runner

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/test-issue61.test.js
```

RED exit 1, **3 fallaron /16 pasaron**, 10.747s: RELEASE_URL/TOKEN no eran rechazados y ayuda
no anunciaba HTTP. Los dos guard tests expiraron a 5s; reforcé también el test para bloquear
`spawnSync` antes de permitir lanzar Jest si faltara la guarda. No quedan procesos Jest activos.
GREEN incluido en focales finales, con ayuda exacta, guardas y topología YAML real parseada.

## GREEN y preservación vigentes

### Focales, callers y YAML

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test node node_modules/jest/bin/jest.js --runInBand --no-cache --setupFiles ./tests/helpers/issue-61-sin-dotenv.js --runTestsByPath tests/scripts/smoke-release.test.js tests/scripts/test-issue61.test.js tests/controladores/controlador-ofertas.test.js tests/controladores/controlador-preferencias.test.js tests/controladores/controlador-scraping.test.js tests/servicios/servicio-configuracion-busqueda.test.js
```

Exit **0**, **6 suites /276 tests PASS**, **9.484s**, sin SKIP. Incluye 33 casos del CLI,
20 del runner/guardas/topología y regresiones de callers. YAML conserva exactamente los
cuatro jobs previos, PG15 único del job #57, puerto/servicio/matriz y `pipefail`.
Pruebo exclusión de SQL y HTTP del Jest general y `test:integracion` por regex efectiva.
Lecturas normales de búsqueda sin fila conservan `{}`, preview falta fila da 503 sin writes.
La primera ejecución de callers legacy, antes del setup, mostró dotenv intentando cargar
archivos con 0 valores inyectados; no imprimió secretos. Añadí setup explícito que simula
**únicamente dotenv** antes de ejecutar esas suites y repetí todos los focales. Los warnings
por cursor efímero y errores sintéticos esperados de las suites previas no son fallos.

### Runner sintético con el contenedor T1 original

```bash
cd backend && time env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable npm run test:issue61
```

Exit **0**, **2 suites /32 tests PASS** (28 SQL T1 +4 HTTP), Jest **7.432s**,
wall **8.216s**, user **4.136s**, sys **1.207s**.
El positivo imprime `PREFLIGHT: OK / Migraciones y contratos críticos verificados.`:
CLI standalone ejecutado como proceso separado sobre esquema preparado con **todos los SQL
históricos reales**, no con catálogo mock ni contrato duplicado. Luego CLI HTTP separado contra
Express real, queries/modelos reales y sesiones con `default_transaction_read_only=on`.
Sólo Firebase ficticio, dotenv y proveedores prohibidos se reemplazan; la red externa se bloquea.

Los cuatro casos HTTP comparan catálogo/ACL/defaults/restricciones/índices/triggers/roles,
ledger, filas de todas las tablas y secuencias. Registro sólo hashes/salida sanitizada en
`runtime/http.json` ignorado y disponible como artifact; `runtime/sql11.json` conserva evidencia T1.

1. Seis 200 efectivos, oferta e historial sintéticos **no vacíos**, contrato y snapshots iguales;
   lectura normal/read-only de preferencias existentes iguales, sin errores del servidor.
2. Sin sesión: seis GET, health 200 y cinco 401, exit 1, NO VERIFICADO, snapshots iguales.
3. Esquema ilegible: health 200, tres 500 y dos 503 reales, exit 1/FALLO, sin SQL/body/token en
   salida y snapshots iguales. No disfrazo la app con mocks de modelos.
4. Preferencias ausentes: muevo la fila sintética de id1 a id2 **antes** del snapshot;
   cuatro rutas 503 sanitizados (incluido preview), historial/health 200; snapshot intacto.
   Después de la comparación, sólo el fixture habilita escritura de sesión para comprobar
   que la llamada normal sigue creando id1 y la lectura read-only funciona con fila existente.

El primer ensayo del caso 3 produjo un único 500 en lugar de tres: **pg-pool descarta clientes
al fallar una query** y la siguiente conexión restauraba el search_path inicial. Corregí la
fixture manteniendo también PGOPTIONS read-only del esquema vacío durante las reconexiones,
restaurándolo en finally. No modifiqué aplicación ni debilité expectativas para taparlo.
El mismo comando pasó luego 32/32; no quedan checks requeridos fallando.

## CI: costo y alcance de medición

- Reutilizo `integracion-issue57` y su servicio PG15; no agrego instalación ni llamadas externas.
- `test:issue61` realiza migraciones sintéticas y preflight positivo dentro del mismo runner.
  No reutilizo `migrar.js` en modo supuestamente read-only.
- Paso nuevo: estimación **10–15s** adicionales en ese job; medida local completa **8.216s**.
  El workflow mide `$SECONDS` y registra exit/tiempo aun si falla, con `pipefail` y `tee`.
  Reutilizo artifact #57 (agrego hashes JSON de #61 a sus paths).
- Los nuevos tests CLI/guardas también corren en el job unit existente: alrededor de **7s**
  locales adicionales, dominados por el timeout deliberado de 5s. No sumo este tiempo como
  si fuera medición del critical path remoto. **Costo real remoto pendiente** de ejecutar CI.

`git diff --check`: exit **0**, sin salida; repetido al cerrar la unidad.

## Límites y entrega

- No ejecuté producción, Railway/Vercel, proveedores, Firebase real ni acciones de negocio.
  Sin revisión de logs productivos ni prueba de commit desplegado: NO VERIFICADO.
- No ejecuté build ni suites backend amplias/#57/#59; quedan a T3 según el contrato del padre.
- Cuerpo >1 MiB falla cerrado; no cambio las rutas para paginar y fingir evidencia parcial.
- El smoke reconoce señales comunes de caché, no puede probar que un proxy opaco sin headers
  no cachee. Revisión operativa de logs/SHA y permisos/conexión ya autorizados sigue necesaria.
- Read-only HTTP garantizado por cadenas auditadas + sesiones SQL read-only sintéticas y
  snapshots; no impongo un nuevo rol ni configuración productiva.
- Docs/CI/setup pasivos: no hay RED funcional significativo; verificación estructural YAML,
  help, regex y lectura de diff, además de runner real.
- Contenedor T1 queda activo. ODD, commit, revisión independiente y PR única a master: padre.
