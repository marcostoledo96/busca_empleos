# Contratos de proveedores — issue #59

## Respuesta vigente a PR66 / comentario 6417122854 — T6

Atiendo el único pendiente material del [comentario de auditoría](https://github.com/marcostoledo96/busca_empleos/pull/66#issuecomment-6417122854): el CI anterior no ejecutaba SQL59. La auditoría no afirmó defectos funcionales nuevos. **Esta sección es el estado vigente; las rondas siguientes son evidencia histórica, no una ejecución del nuevo HEAD.**

Agrego `npm --prefix backend run test:issue59` al job `integracion-issue57`, después del focal #57 y antes del E2E existente. Reutilizo PostgreSQL15, puerto 55457, base/usuario sintéticos, aislamiento por esquema y upload existente `issue57-integracion-${{ github.run_id }}`. No agrego servicios, jobs, dependencias ni suites completas. Las exclusiones SQL ordinarias y los guards dedicados permanecen intactos.

El nuevo archivo del artifact, `issue59-sql.log`, registra comando, PR head desde `github.event.pull_request.head.sha` (no aplica fuera de PR), commit y árbol reales de `git rev-parse` del checkout. No confundo el merge ref predeterminado de Actions con el head de la PR. Bash explícito y `pipefail` conservan el fallo a través de `tee`; el subshell imprime el exit del runner y lo devuelve. El upload conserva `if: always()` y el directorio existente, incluso ante fallos. Tras `prepararBase()` —que verifica entorno, base, usuario, PostgreSQL15 y esquema— el test SQL informa únicamente identidad sintética, puerto, esquema y guardas activas; también informa el cierre del pool. No imprime contraseñas, tokens, volcados de entorno ni ofertas.

### Verificación local de este lote (sin PostgreSQL ni proveedores)

Partí de HEAD `bfb263c0faef9e5bfc4162e268898fd958c45c09`, árbol committed `ef96b7f04b4b36939a8c7c071ec020d599fd4183`, con delta de trabajo sin commit. Esas identidades no certifican el futuro HEAD publicado. Los logs locales ignorados están en `runtime/pr66-review/`; el padre deberá asociar el commit final y su CI en la entrega de la misma PR.

Desde la raíz, preparé HOME/TMPDIR/cache en ese runtime. Para RED y GREEN usé este prefijo exacto antes de los argumentos npm indicados (sin PG, credenciales ni NODE_OPTIONS heredados):

```sh
runtime="$PWD/docs/evidencias/issue-59/runtime/pr66-review"; cd backend && env -i PATH="$PATH" HOME="$runtime/home" TMPDIR="$runtime/tmp" npm_config_cache="$runtime/cache" npm_config_update_notifier=false NODE_ENV=test npm test -- --runInBand --runTestsByPath
```

| Argumentos/comando | Resultado observado |
| --- | --- |
| `tests/servicios/issue-59-runner.test.js --testNamePattern='CI ejecuta SQL59'` | RED exit1: 1 fallo por paso ausente (`undefined`), 4 fuera de filtro; `red.{stdout,stderr,exit}` |
| `tests/servicios/issue-59-runner.test.js tests/servicios/issue-59-seguridad.test.js` | GREEN exit0: 2 suites, 6 PASS, 1.703 s; `green.{stdout,stderr,exit}` |
| `env -i PATH="$PATH" HOME="$runtime/home" TMPDIR="$runtime/tmp" npm_config_cache="$runtime/cache" node backend/node_modules/js-yaml/bin/js-yaml.js .github/workflows/ci.yml` (desde raíz) | exit0; YAML parseado mediante CLI local instalado; `yaml.{stdout,stderr,exit}` |
| `git diff --check` | exit0; sin salida |

La regresión nueva extrae el `run` real del workflow y lo ejecuta en Bash aislado con npm ficticio: exit42 y exit0. Comprueba stdout completo igual al log de `tee`, stderr simulado redirigido al log (stderr del shell vacío), ambos exits exactos, comando, head sintético y commit/árbol del checkout. Comprueba estructuralmente el único servicio PostgreSQL del job y upload `always()`. Los cinco tests previos de runner/seguridad siguen pasando: enumeración ordinaria sin SQL, seguridad independiente y rechazo exacto antes de conectar. No agrego SKIP; las cuatro omisiones de RED son solo el filtro puntual. `actionlint` no está instalado; no lo instalé. Parsear YAML no sustituye su análisis de Actions.

### Checklist S17 y límites de entrega

- [x] S10: reutilizo infraestructura #57 sin otra DB; mantengo identidad verificada antes de SQL y transportes simulados.
- [x] S11: RED/GREEN focal, shell real con npm ficticio, parseo YAML y diffcheck; preservo evidencia previa sin repetir suites costosas sin cambios de producto.
- [x] S13: separo checks locales actuales, PASS SQL históricos y prueba CI pendiente; consumo real de proveedores en este lote: cero.
- [x] S17: cableado y logs disponibles en el job/artifact existente; sin políticas, secretos ni servicios externos nuevos. Autorrevisión del diff, guards y propagación de exit realizada.
- [ ] S10/S17: **PENDING** observar SQL59 **2/2 PASS** en el CI del nuevo commit, identidad/esquema/puerto/guardas y cierre. No ejecuté SQL local ni inicié/observé CI.
- [x] S14: verificación independiente del delta local por `gentle-ai-verify` y spot check propio del padre: 6/6 focales PASS en cada ejecución; YAML y diffcheck PASS. Sin nueva auditoría funcional ni SQL local.
- [ ] S17: comentario de entrega por lote y evidencia CI del nuevo commit en la misma PR, con BASE/HEAD, delta, resultados y enlaces: pendientes de publicación/ejecución; no se inventa el resultado SQL.

El CI anterior 40260109169 SUCCESS y los dos PASS SQL locales históricos no prueban el nuevo árbol. Los dos fallos locales históricos de migración025 siguen reportados, no corregidos ni reejecutados; el CI anterior tuvo DB211 PASS según la auditoría. No repetí backend/frontend/DB ni build; no cambié producto. Esta entrega es parcial respecto de la prueba final de aceptación, no un dictamen APTO.

### Verificación independiente y spot check del padre

El usuario autorizó específicamente `/tmp/busca-empleos-pr66-verificacion` para una copia aislada sin `.env`, credenciales ni conexiones externas, después de un intento de verificación que se declaró no disponible antes de acceder o ejecutar nada. `gentle-ai-verify` verificó el delta en una copia independiente bajo ese directorio: **2 suites/6 PASS, exit0**, YAML candidato/BASE parseado y `git diff --check` exit0. El manifiesto de fuentes comparadas entre original y copia conservó SHA256 `06ee44eb57881601d8fc793bb03b42f11d9ff95cef4281b66021079ee464504f`, sin mutación del original. El commit sintético del scratch solo sirve para los probes de Git y no se atribuye al HEAD de la PR.

El verificador confirmó que quitar únicamente el nuevo paso SQL59 del YAML parseado deja el workflow idéntico a BASE `bfb263c0faef9e5bfc4162e268898fd958c45c09`: mismos cuatro jobs, servicio/entorno y artifact. Las dos assertions SQL, helper #57, runner y guardas existentes no cambian. El registro seguro de esquema ocurre después de validarlo, y el mensaje de cierre después de `pool.end()`. **PASS del delta local, no APTO externo ni PASS SQL aún**. La propuesta opcional de otra regresión del verificador no se implementó: no había un defecto adicional demostrado y la prueba existente ya verifica el pipeline real con salidas 42 y 0.

Spot check del padre: `env -i` con PATH y HOME/TMPDIR/cache locales, NODE_ENV=test, sin PG/preload/secretos, `npm --prefix backend test -- --runInBand --runTestsByPath tests/servicios/issue-59-runner.test.js tests/servicios/issue-59-seguridad.test.js`: **2 suites/6 PASS, exit0, 1.58s**. Los logs locales ignorados quedan bajo `runtime/pr66-review/parent/`. No repito suites completas ni SQL local; el CI del commit publicado deberá producir el log contrastable 2/2 solicitado.

## Alcance y método

Registro esta matriz y el inventario **antes de agregar tests**. Base: `1f2a59fa4f15a7ece9cdba1e65019559306a35af`. Contrasté los doce identificadores con `backend/src/config/plataformas.js`; no agrego una configuración paralela. El índice CodeGraph ya existe; la herramienta MCP no está expuesta al worker, por lo que consulto directamente los archivos señalados por la exploración.

## Matriz vigente

El slug HTTP coincide con el identificador salvo `google_jobs` → `google-jobs`. Nueve fuentes están activas; GetOnBrd es condicional; Google Jobs e InfoJobs están inactivas. Los estados comunes son completada, sin_resultados, parcial, error, timeout y sin_credenciales. Los errores no equivalen a una búsqueda vacía.

| Fuente / id | Estado y credenciales | Consulta, ubicación y filtros efectivos | Límites, paginación y ventana | Transporte, respuesta y limitaciones |
| --- | --- | --- | --- | --- |
| LinkedIn / linkedin | Activa; APIFY_TOKEN | Términos literales, sin equivalencias aplicadas; URLs por término y zona; zonas guardadas o Argentina; f_E opcional | count y máximo local; 14 días; paginación interna del actor no medible | Actor Apify, dataset dual-schema; errores HTTP/actor/dataset; deduplicación por identidad |
| Computrabajo / computrabajo | Activa; sin credenciales | Slug castellano sin signos, Argentina; detalle HTML | Presupuesto global, páginas y detalles por término; 30 días, fechas relativas | HTTP directo y Cheerio; sin costo Apify atribuible; HTML incompleto puede no producir ofertas |
| Indeed / indeed | Activa; APIFY_TOKEN | Frases preservadas con OR; title; country Argentina | limit enviado al actor y máximo local; 30 días | Actor Apify, dataset; duplicados consolidados; peticiones internas desconocidas |
| Bumeran / bumeran | Activa; APIFY_TOKEN | Equivalencias a slug, URLs Argentina; Puppeteer con pageFunction y linkSelector vacío | Actor NO recibe maxResultados; truncado local después de deduplicar; 30 días declarados, fechas no disponibles | apify/puppeteer-scraper; dataset puede contener arrays; no garantiza costo por truncar salida |
| Glassdoor / glassdoor | Activa; APIFY_TOKEN | keywords; Buenos Aires, Argentina; saveOnlyUniqueItems, includeNoSalaryJob | maxItems y máximo local; datePosted=14 | Actor Apify; normalización de modalidad/fecha; deduplicación local demostrada RED→GREEN |
| Jooble / jooble | Activa; JOOBLE_API_KEY | POST, frases completas; Remote | Cupo round-robin, 2 páginas por término por defecto, 15 peticiones por defecto, ventana nominal 30 días | JSON jobs; updated no es publicación: fecha desconocida y sin descarte por antigüedad; límite sobre elegibles |
| Remotive / remotive | Activa; sin credenciales | Categorías admitidas software-dev, qa, customer-service según traductor; sin zona elegible | Consultas por categoría, máximo local; 30 días | JSON jobs; modalidad remota, idioma filtrado; incompatibilidad informada, no categoría inventada |
| RemoteOK / remoteok | Activa; sin credenciales | Etiquetas admitidas por traductor; sin zona configurable | Cupo repartido por tags y máximo estricto; 30 días | JSON array con cabecera; evita falsos positivos .NET en internet/network |
| Adzuna / adzuna | Activa; ADZUNA_APP_ID y ADZUNA_APP_KEY | Prefijo remote; región es (España), no Argentina; normalización solo indicadores remotos | Máximo 50; búsqueda /search/1 por consulta, sin paginación adicional; 30 días | JSON results; salario y ubicación; errores HTTP/red/JSON |
| GetOnBrd / getonbrd | Condicional; flag explícito y evidencia/destino autorizados, sin credencial | API pública search/jobs, término completo | Máximo 10 peticiones; checkpoint por página/item; 30 días | JSON data; 429, timeout, cancelación, parcial; fixtures inyectadas sin alterar autorización real |
| Google Jobs / google_jobs | Inactiva | No ejecutable en registry/UI | Cero cuota | Motivo: Desactivado por costo y baja utilidad; stub sin actor |
| InfoJobs / infojobs | Inactiva | No ejecutable en registry/UI | Cero cuota por ciclo | Motivo: Portal developers suspendido; adaptador legacy existe pero registry impide ejecución |

Los máximos del resolver son 500 resultados, salvo Adzuna (50). Los predeterminados son LinkedIn/Indeed 100, GetOnBrd 40 y las otras fuentes 50. Computrabajo admite hasta dos páginas por término; presupuesto predeterminado `max(60, maxResultados + 20)` y detalles por término `min(maxPeticiones, max(maxResultados, 30))`. Jooble permite configurar páginas y peticiones; Remotive consulta una vez por categoría, RemoteOK una vez por etiqueta y Adzuna una página por término (pausa 2500 ms). Esas tres fuentes no implementan un presupuesto global de peticiones configurable; no lo atribuyo como filtro aplicado. Los actores no reciben `maxPeticiones`, y sus páginas/peticiones internas no son medibles. GetOnBrd usa 2 páginas de 20 por defecto, techo 10 páginas y 120 por página, timeout por petición de 5000 ms; el resolver limita las ofertas a 500 aunque el piloto interno admita 1200.

LinkedIn envía ventana de 14 días por URL y Glassdoor `datePosted=14`; no reinterpreto ese filtro del actor como una garantía externa verificada. Indeed declara ventana de 30 días pero el adaptador no envía un filtro temporal al actor; Bumeran no recibe fechas. Los tests verifican sanitización y telemetría sin inventar descartes locales de esos actores. Términos libres literales admiten `###` en LinkedIn/Glassdoor; los traductores de URLs/categorías incompatibles lo rechazan u omiten, sin defaults. Las ubicaciones/preferencias ignoradas se informan en preview.

En los adaptadores comunes el timeout global máximo es 180 s y por petición 15 s; AbortSignal corta lecturas y conserva snapshots. Apify reserva margen para abortar el run; no expone conteo real de sus peticiones internas (`null`, no cero). GetOnBrd usa límites propios. Las métricas de persistencia e historial pertenecen al pipeline; DeepSeek evalúa globalmente, no por fuente.

## Inventario previo y brechas

| Archivo existente | Ya comprobado | Assertions a completar sin duplicar |
| --- | --- | --- |
| servicio-configuracion-busqueda.test.js | Guardados/override, validación, preview, ubicaciones, fuentes incompatibles | Tabla completa de términos representativos y negativos, coherencia con ejecución |
| servicio-traductor-consultas.test.js | Equivalencias, frases, categorías, tags, slugs | Acrónimos, acentos, símbolos, internet/network y términos sin categoría, si faltan |
| servicio-scraping.test.js — LinkedIn | Actor/input, ambos schemas, normalización, identidad duplicada y distinta | Vacío, límite elegible y dataset incompleto/estado parcial |
| mismo — Computrabajo | HTML, detalle, dedup temprana, páginas, antigüedad/idioma, presupuestos de peticiones y detalles, HTTP500 | HTML incompleto, cancelación/timeout sin escrituras tardías y fechas límite |
| mismo — Indeed | Actor/input OR, normalización, dedup y errores | Vacío, límite y dataset inválido |
| mismo — Bumeran | Puppeteer/input, aplanado, vacío, URL inválida, dedup y errores | Actor sin límite versus límite local garantizado |
| mismo — Glassdoor | Actor/input/location, normalización y error | Duplicados, vacío y límite; posible defecto reproducible |
| mismo — Jooble | POST, vacío, errores, hard cap 60/50, reparto de cupo, idioma y presupuestos | 429/JSON inválido y cancelación conservando parcial |
| mismo — Remotive/RemoteOK/Adzuna | Adaptadores HTTP y normalización, credenciales Adzuna | Completar contrato de error/límite/duplicados donde falte |
| getonbrd-*.test.js y config/getonbrd*.test.js | Guardia, autorización sintética, URL, ingreso, piloto, auditoría y ciclo independiente | Verificar cobertura exacta de timeout/cancel/checkpoint sin cambiar autorización |
| servicio-scraping-resultados-fuente.test.js | Pipeline por fuente | Mockea normalizarLote: no reemplaza contratos reales nuevos |
| servicio-resultados-fuente.test.js | DTO, estados y métricas compartidas | Persistencia real nueva/actualizada/reaparecida vía infraestructura #57 |
| tests/integracion/issue-57-* y helpers/issue-57-* | Express, guardas sintéticas, PostgreSQL15 aislado e historial | Al menos un recorrido con adaptador real y transporte simulado |

## Evidencia de ejecución

### Corrección acotada posterior al verificador — resultado vigente

El verificador independiente confirmó las seis correcciones iniciales, pero devolvió **NO LISTO** por runners incompatibles con CI, preview de Jooble y falta de checks Angular. Reproduje sus hallazgos en este worktree; no accedí ni copié su scratch externo. Esta sección reemplaza la interpretación de entrega de la primera ronda, cuyos resultados históricos conservo más abajo.

**RED antes de corregir runners:** con `env -i`, NODE_ENV=test, sin PG ni NODE_OPTIONS, `cd backend && npm test -- --runInBand --runTestsByPath tests/integracion/issue-59-proveedores.test.js tests/servicios/issue-59-seguridad.test.js` dio exit 1, **2 suites fallidas/3 tests fallidos**. SQL rechazó `Entorno issue57 no permitido.` y seguridad recibió ENOENT porque no tenía el preload del shell. El workflow `.github/workflows/ci.yml` efectivamente usa solo NODE_ENV=test en su job unitario.

**RED preview:** `cd backend && npm test -- --runInBand --runTestsByPath tests/servicios/servicio-configuracion-busqueda.test.js --testNamePattern="Jooble informa el mismo"` dio exit 1, 1 fallo/65 fuera de filtro: esperaba 1 página y recibía 2, aunque opciones ya contenía 1.

Correcciones mínimas del lote:

- `npm test` y `npm run test:integracion` excluyen expresamente `issue-57-backend.test.js` e `issue-59-proveedores.test.js`. No agregué SKIP ni modifiqué asserts ajenas. La regresión enumera las suites desde npm sin PG/preload y exige que las pruebas ordinarias de seguridad sigan incluidas.
- `npm run test:issue59` es el runner SQL dedicado: valida entorno #57, carga guard propio y ejecuta los dos contratos reales. La identidad de base/usuario y PostgreSQL15 se valida antes de crear esquema/migrar, igual que antes. Sin entorno falla antes de conectar; `--help` funciona sin DB. No modifiqué infraestructura #57 ni dependencias/lockfiles.
- El test de seguridad carga el guard explícitamente en un subprocess con entorno mínimo; verifica stdout/stderr, exit 0 y sockets no conectados, sin alterar Jest. La regresión lo ejecuta a través de npm sin NODE_OPTIONS ni PG. Los subprocess npm usan HOME/cache dentro del worktree y deshabilitan update-notifier; la enumeración no carga adaptadores ni abre transportes.
- Jooble informa el override validado de páginas y conserva default 2. Además de preview, el adaptador real comprueba una sola petición página1 pese a totalCount=100. La primera corrida de la nueva regresión del runner detectó un error de su parseo de JSON compacto de Jest; lo corregí y luego pasó, sin tocar producto.

Agregué **6 tests** en este lote (4 runner, 1 preview y 1 adaptador Jooble): total nuevo de la issue **73 tests**. La primera ronda tenía 67. Las seis correcciones previas se preservan.

#### Comandos finales de esta corrección

Las suites ordinarias se ejecutaron con `env -i`, PATH, HOME/cache/TMPDIR bajo `docs/evidencias/issue-59/runtime`, NODE_ENV=test y update-notifier deshabilitado, **sin PG ni NODE_OPTIONS**. SQL usa las variables sintéticas exactas de #57 indicadas en la sección histórica; solo #57 conserva el preload explícito del comando, mientras #59 lo carga por sí mismo.

| Comando | Resultado observado |
| --- | --- |
| `cd backend && npm test -- --runInBand --runTestsByPath tests/servicios/issue-59-runner.test.js tests/servicios/issue-59-seguridad.test.js tests/servicios/servicio-configuracion-busqueda.test.js tests/servicios/servicio-scraping.test.js` | exit 0; 4 suites, **252 PASS** |
| `cd backend && npm test -- --runInBand` | exit 0; 81 suites PASS/10 omitidas; **2670 PASS, 159 omisiones existentes**, 2829 total; 22.805 s |
| `cd backend && npm run test:integracion` | exit 0; 6 suites PASS/4 omitidas; **62 PASS, 7 omisiones existentes**, 69 total; 2.093 s |
| `cd backend && npm run test:issue59` | exit 0; 1 suite, **2 PASS**; 1.944 s |
| `cd backend && npm run test:issue57` | exit 0; 2 suites, **40 PASS**; 15.167 s |
| `cd backend && npm run test:issue59 -- --help` | exit 0; imprime uso, PostgreSQL15, entorno sintético y guard propio |
| `cmp frontend/package-lock.json ../busca_empleos-issue-58/frontend/package-lock.json` | exit 0; lockfiles idénticos antes de copiar node_modules de forma independiente |
| `cd frontend && npm ls --depth=0` | exit 0; Angular20 y dependencias locales satisfechas, sin instalar ni descargar |
| `cd frontend && npm run prebuild` | exit 0; genero únicamente los dos environment autorizados desde sus ejemplos de placeholders |
| `cd frontend && npm test -- --watch=false --browsers=ChromeHeadlessIssue59 --karma-config ../docs/evidencias/issue-59/karma.cjs` | exit 0; Chrome Headless155: **571 SUCCESS, 4 omitidos existentes**, 575 total |
| `cd frontend && npm run build` | **exit 127; NO VERIFICADO**: font inlining necesita HTTPS externo, bloqueado antes de conectar |
| `git diff --check` | exit 0; sin whitespace inválido en archivos seguidos |

El cambio de conteos frente a la primera ronda refleja la separación de los dos contratos SQL explícitos, seis tests nuevos y las guardas preexistentes bajo entorno ordinario sin PG (no son nuevos SKIP). No sumo suites superpuestas. Las suites ordinarias se repitieron únicamente tras cambiar el entorno mínimo de la regresión del runner y las comillas portables de sus scripts. SQL y Angular no se repitieron después de sus PASS sin cambios relevantes.

**Angular sin credenciales/red:** el usuario autorizó exactamente `frontend/src/environments/environment.ts` y `environment.prod.ts`; se generaron desde `.example`, quedaron ignorados y no contienen valores reales. Deshabilité analytics. El archivo de Karma de evidencia conserva Jasmine, usa ChromeHeadless con proxy a loopback cerrado y resolución externa bloqueada. El primer intento compiló pero Chrome no arrancó: `Socket path too long` por el límite Unix de 108 bytes. Corregí solo su TMPDIR a `.angular` relativo y deshabilité reintentos de launcher; el segundo intento pasó. No cambié código de frontend ni asserts para acomodar resultados.

**Límite del build:** `frontend/src/index.html` contiene dos links Google Fonts. `npm run build` compila con optimización productiva e intenta descargarlos desde `@angular/build/src/utils/index-file/inline-fonts.js:166`. El guard de sockets abortó con `Bloqueé un destino de red no autorizado en issue59.`; el stack local identifica ese módulo. No descargué fuentes, no usé credenciales, no deshabilité optimización ni declaré PASS del build. El bundle de tests sí compiló y ejecutó todo el frontend indicado arriba. Completar el build productivo offline requeriría otra decisión sobre esas fuentes, fuera de este lote.

**SQL025 conocido de BASE:** el padre informó que el verificador reprodujo exactamente los dos fallos históricos también sobre BASE (2 fallos/31 filtrados), además de candidato. Conservo el resultado previo de test:db (**209 PASS/2 fallos**), sin volver a ejecutar ni alterar public. Ya no atribuyo esos fallos a las correcciones de #59; son una limitación ambiental del fixture histórico confirmada independientemente.

### Recuperación final acotada — evidencia nueva y estado parcial

Conservo la implementación y todos los resultados previos. En esta recuperación revisé el diff actual de producto, tests y documentación, el registry de doce fuentes, el runner SQL #59, sus guardas y el recorrido Express/PostgreSQL. HEAD sigue en la base `1f2a59fa4f15a7ece9cdba1e65019559306a35af`; no hice commits. El MCP CodeGraph no está expuesto a este worker; utilicé los archivos exactos del encargo y del inventario, sin exploración amplia ni inicialización adicional.

**Evidencia recién observada:** ejecuté únicamente `git diff --check` y el focal runner/seguridad autorizado. No cambié código ni tests: no reapareció el bloqueo del runner. No corresponde un nuevo RED/GREEN porque esta unidad solo reconcilia evidencia y documentación; el PASS actual es de preservación, no una nueva implementación.

Desde la raíz ejecuté los siguientes comandos en primer plano (las redirecciones conservan stdout y stderr separados y el archivo `.exit` conserva el código del comando, no el de `printf`):

```sh
mkdir -p docs/evidencias/issue-59/runtime/recovery-final/home docs/evidencias/issue-59/runtime/recovery-final/cache docs/evidencias/issue-59/runtime/recovery-final/tmp; git diff --check > docs/evidencias/issue-59/runtime/recovery-final/diff-check.stdout 2> docs/evidencias/issue-59/runtime/recovery-final/diff-check.stderr; resultado=$?; printf '%s\n' "$resultado" > docs/evidencias/issue-59/runtime/recovery-final/diff-check.exit; printf 'git diff --check: exit %s\n' "$resultado"
```

Resultado: **exit 0**, stdout/stderr vacíos para `git diff --check`. Después de actualizar el informe y el log volví a ejecutar `git diff --check`: exit 0, sin salida; conservé esa segunda captura como `runtime/recovery-final/diff-check-final.{stdout,stderr,exit}`. El control de Git solo cubre archivos seguidos; no atribuyo a ese comando validación del contenido untracked de este informe.

```sh
runtime="$PWD/docs/evidencias/issue-59/runtime/recovery-final"; cd backend && env -i PATH="$PATH" HOME="$runtime/home" XDG_CACHE_HOME="$runtime/cache" TMPDIR="$runtime/tmp" npm_config_cache="$runtime/cache" npm_config_update_notifier=false NODE_ENV=test npm test -- --runInBand --runTestsByPath tests/servicios/issue-59-runner.test.js tests/servicios/issue-59-seguridad.test.js > "$runtime/focal.stdout" 2> "$runtime/focal.stderr"; resultado=$?; printf '%s\n' "$resultado" > "$runtime/focal.exit"; printf 'runner/security focal: exit %s\n' "$resultado"
```

Resultado: **exit 0; 2 suites PASS, 5 tests PASS, 1.754 s**. Verifiqué ambos archivos de salida. El focal enumera las suites sin ejecutarlas, mantiene seguridad #57 incluida y separa los recorridos SQL; ejecuta seguridad #59 sin PG ni preload heredado; comprueba ayuda y rechazo exacto del runner SQL antes de conectar. El test del guard intenta una ruta `.env` ficticia y un destino TEST-NET: ambos quedan rechazados antes de leer/conectar. Inspeccioné esas guardas antes de ejecutar. El entorno exterior usa `env -i`, sin PG, NODE_OPTIONS ni credenciales; los subprocess existentes tienen entornos mínimos propios y caches dentro del runtime autorizado. No ejecuté SQL ni transportes externos reales.

**Reconciliación S1–S13:** S1/S2 quedan respaldadas por revisión estática del diff y registry y la matriz previa; S3–S6/S8/S9/S12 por las assertions actuales y la evidencia histórica RED/GREEN conservada, sin reejecución de esos contratos en esta unidad. S7 conserva la evidencia previa de GetOnBrd/inactivas y Angular; no agrego prueba visual nueva. S10 conserva exclusivamente el PASS SQL previo, no una ejecución actual. S11 sigue **PARCIAL**: backend2670, integración62, SQL#59 dos, SQL#57 cuarenta y Angular571 son PASS **reportados previamente**, no resultados recién observados. El build sigue pendiente por Google Fonts bloqueadas, no es PASS ni una excepción satisfecha. Los dos fallos históricos de migración025 permanecen como fallos ambientales reproducidos en BASE por el verificador anterior; no ejecuté test:db otra vez. S13 queda actualizado mediante esta separación explícita de evidencias. No detecté contradicciones adicionales en el diff inspeccionado; esto no equivale al dictamen independiente del padre.

**Entrega parcial:** falta el build requerido y el nuevo dictamen independiente. No repetí suites completas sin cambios, no amplié alcance para resolver fuentes/infrastructura, no alteré `frontend/.angular`, el workspace principal ni archivos ajenos. T4 y las decisiones de entrega siguen a cargo del padre.

### Primera ronda — entorno cerrado y evidencia histórica

La primera ejecución no arrancó: cuatro comandos devolvieron exit 127, `jest: not found`, cero tests. El padre resolvió las dependencias copiando paquetes locales, sin descarga. Después ejecuté la base focal: **14 suites, 358 tests PASS**, exit 0.

Uso `env -i` con PATH/HOME, NODE_ENV=test y las variables sintéticas que exige `tests/helpers/issue-57-entorno.js`: DB_TEST_SINTETICA=true, PGHOST=127.0.0.1, PGPORT=55457, PGDATABASE=busca_empleos_issue57_test, PGUSER=busca_empleos_test, PGPASSWORD=sintetica_issue57 y PGSSLMODE=disable. No heredo DATABASE_URL ni credenciales productivas. Precargo `NODE_OPTIONS="--require=$PWD/backend/tests/helpers/issue-59-seguridad.js"` antes de entrar a backend. El guard impide lecturas síncronas de `.env` y sockets externos; su prueba con un path ficticio y dirección TEST-NET demuestra rechazo antes del transporte. Los mocks HTTP comprueban host y los SDK sintéticos rechazan actores/datasets inesperados. Las lecturas de dotenv informan cero variables inyectadas: el guard devuelve ENOENT sin leer esos archivos.

Reutilizo `prepararBase()` de #57: valida variables, identidad de base/usuario y PostgreSQL15 antes de crear esquema y migrar. No creé otra base ni modifiqué infraestructura. El helper `issue-59-base.js` solamente prepara ese esquema y ejecuta el comando existente `npm run test:db`. No alteré tablas públicas para acomodar pruebas históricas. Los caches y logs crudos quedan locales e ignorados bajo esta carpeta; las evidencias compactas siguen abajo.

### Defectos demostrados y correcciones mínimas

| Contrato RED | Observación antes de corregir | Corrección y GREEN observado |
| --- | --- | --- |
| Glassdoor: duplicado antes de oferta distinta, cupo 2 | Devolvía dos títulos repetidos y perdía QA Junior | Reutilizo deduplicarYConsolidarLote antes de slice; 1 PASS focal y regresión completa |
| Adzuna: [válida, duplicada, distinta], cupo 2 | Devolvía 1 oferta | No trunco crudos; el cupo restante depende de elegibles; 18 PASS focales HTTP/Glassdoor |
| Adzuna: antigua seguida de vigente con misma identidad | Devolvía 0 ofertas | Filtro antigüedad antes de deduplicar, tanto en snapshot como al finalizar; 3 PASS focales incluyendo identidad distinta |
| Resolver: espacios y términos repetidos | Preview/query contenían QA dos veces | Deduplico textos idénticos tras trim, mantengo orden y preferencias originales; 231 PASS en scraping/configuración |
| Preview Bumeran: maxResultados=2 | Informaba null aunque el adaptador limita localmente | Informo 2 y advertencia explícita sobre actor/costo; 3 PASS Bumeran |
| LinkedIn/Indeed/Glassdoor: inválida, futura, ausente y válida | Normalizaban tres fechas a null pero informaban sinFechaConocida=0 | Cuento las fechas desconocidas devueltas; RED 3 fallos/1 PASS, GREEN 4 PASS (Bumeran preservado) |

Para reproducir las corridas RED/GREEN usé el mismo entorno cerrado, entrando a `backend`. Los comandos exactos (sin las redirecciones locales de salida) y sus resultados fueron:

| Comando | RED → GREEN |
| --- | --- |
| `npm test -- --runInBand --runTestsByPath tests/servicios/servicio-scraping.test.js --testNamePattern=issue59` | exit 1: 1 fallo/129 fuera de filtro → exit 0: 1 PASS/129 fuera de filtro (Glassdoor) |
| `npm test -- --runInBand --runTestsByPath tests/servicios/servicio-scraping.test.js --testNamePattern=Issue59 --silent` | exit 1: 2 fallos/15 PASS/129 fuera de filtro (Adzuna + supuesto Jooble) → exit 0: 18 PASS/129 fuera de filtro, con caso adicional de antigüedad |
| `npm test -- --runInBand --runTestsByPath tests/servicios/servicio-scraping.test.js tests/servicios/servicio-configuracion-busqueda.test.js --silent` | exit 1: 2 fallos/229 PASS (duplicados de términos + supuesto updated de Jooble) → exit 0: 231 PASS |
| `npm test -- --runInBand --runTestsByPath tests/servicios/servicio-configuracion-busqueda.test.js --testNamePattern=Bumeran --silent` | exit 1: 1 fallo/2 PASS/62 fuera de filtro → exit 0: 3 PASS/62 fuera de filtro |
| `npm test -- --runInBand --runTestsByPath tests/servicios/servicio-scraping.test.js --testNamePattern="misma identidad" --silent` | exit 1: 1 fallo/2 PASS/169 fuera de filtro → exit 0: 3 PASS/169 fuera de filtro |
| `npm test -- --runInBand --runTestsByPath tests/servicios/servicio-scraping.test.js --testNamePattern="se informan como desconocidas" --silent` | exit 1: 3 fallos/1 PASS/176 fuera de filtro → exit 0: 4 PASS/176 fuera de filtro |
| `npm test -- --runInBand --runTestsByPath tests/integracion/issue-59-proveedores.test.js --silent` | exit 0: 2 PASS, sin RED artificial para la extensión de integración |

No considero defectos dos supuestos iniciales corregidos al leer los contratos: Jooble no deduce modalidad solamente por location=Remote, y updated no es fecha original de publicación. Sus assertions ahora verifican explícitamente null y los datos crudos conservados, sin cambiar producción ni inventar fechas.

### Cobertura añadida y preservada

Agregué **67 tests**: 51 al archivo real de scraping, 13 a configuración, 1 al guard y 2 de integración SQL. No agregué SKIP ni relajé assertions para ocultar fallas. Las ejecuciones con testNamePattern muestran pruebas fuera del filtro como skipped; no son nuevas omisiones permanentes.

- **Consultas:** los diez términos de S3 atraviesan resolver, URLs LinkedIn reales y consultas completas de Indeed/Jooble/Adzuna; verifico Bumeran/Computrabajo, acentos, duplicados, espacios y falta de categoría. Preservo las pruebas existentes de vacío, ###, override, categorías qa/software-dev/customer-service, tags C#/.NET/fullstack e internet/network.
- **Actores reales:** vacío, dataset incompleto, FAILED con dataset útil, máximo local, ausencia de token, cancelación previa y fechas. Bumeran verifica pageFunction/linkSelector y que no se envíe maxItems/maxResultados al actor. Glassdoor verifica consolidación, identidad y cupo; preservo normalización de modalidad y filtros efectivos.
- **HTTP real:** Remotive/RemoteOK/Jooble/Adzuna comprueban vacío, duplicados antes del máximo, 429/503/JSON inválido, cancelación previa/activa con parcial, timeout de cuerpo y ausencia de mutación tardía. Fechas inválidas/futuras/sin fecha no consumen incorrectamente el cupo; Jooble conserva su semántica de fecha desconocida. Adzuna verifica España y salarios EUR como strings, igual que su normalizador vigente.
- **Computrabajo:** agrego HTML vacío/incompleto/layout distinto sin detalles ni actor, y fecha relativa de tres días con descripción de detalle real. Preservo paginación, repetición de tarjetas, presupuesto global, límite por término, idioma y error HTTP500 de los contratos existentes; los tests del control compartido cubren timeout de cuerpo y fallo de detalle.
- **GetOnBrd/inactivas:** preservo las nueve suites existentes: flags, evidencia ausente/inválida, destino no autorizado, configuración sintética, 429, timeout, cancelación, checkpoint, normalización y ciclo bloqueado. Registry/resultados-fuente prueban omisión sin consumo de Google Jobs/InfoJobs. No habilité fuentes ni modifiqué evidencias públicas.
- **Express/PostgreSQL real:** Glassdoor atraviesa middleware, controlador, resolver, SDK simulado, normalización, persistencia real, listado e historial. Compruebo nueva/actualizada/reaparecida, seguimiento manual conservado, preferencias intactas y HTTP503 sin falsa respuesta vacía ni pérdida de datos. #57 preserva además triggers de error de persistencia, historial, ciclo parcial y control de cron.

### Comandos y resultados de la primera ronda

Los comandos siguientes se ejecutaron en primer plano, dentro del entorno sintético anterior. El comando focal exacto es:

```sh
cd backend && npm test -- --runInBand --runTestsByPath tests/servicios/servicio-configuracion-busqueda.test.js tests/servicios/servicio-traductor-consultas.test.js tests/servicios/servicio-scraping.test.js tests/servicios/servicio-scraping-resultados-fuente.test.js tests/servicios/servicio-resultados-fuente.test.js tests/config/getonbrd-integracion.test.js tests/config/getonbrd.test.js tests/servicios/getonbrd-audit-targeted.test.js tests/servicios/getonbrd-ciclo-independiente.test.js tests/servicios/getonbrd-contrato.test.js tests/servicios/getonbrd-ingreso.test.js tests/servicios/getonbrd-piloto.test.js tests/servicios/getonbrd-urls.test.js tests/servicios/getonbrd-verificacion-independiente.test.js tests/servicios/issue-59-seguridad.test.js
```

| Comando | Exit y salida observada |
| --- | --- |
| Focal anterior | 0; Test Suites: 15 passed, 15 total; Tests: 423 passed, 423 total; 4.148 s |
| `cd backend && npm run test:integracion` | 0; Test Suites: 4 skipped, 8 passed, 8 of 12 total; Tests: 7 skipped, 87 passed, 94 total; 14.342 s |
| `cd backend && npm test -- --runInBand` | 0; Test Suites: 10 skipped, 81 passed, 81 of 91 total; Tests: 156 skipped, 2669 passed, 2825 total; 12.97 s |
| `cd backend && node tests/helpers/issue-59-base.js` → `npm run test:db` | 1; Test Suites: 1 failed, 15 passed, 16 total; Tests: 2 failed, 209 passed, 211 total; 6.342 s |
| `git diff --check` | 0; sin salida (solo archivos seguidos por Git) |

La integración ejecutó tanto `issue-57-backend.test.js` como `issue-57-seguridad.test.js`, además del contrato #59. No repetí su runner por separado después de ese PASS. Las omisiones son guards preexistentes de pruebas DB/verticales; los contratos nuevos no se omiten. Las suites con PASS se repitieron únicamente al cambiar después el código de métricas de fechas; los conteos de la tabla son posteriores a esa corrección.

**Fallo restante de test:db:** las dos variantes `upgrade histórico aislado 023/024 → sólo 025, notas preexistentes: false/true › 025 actualizo funciones originales ya aplicadas sin volver a ejecutar su backfill` fallan al preparar el fixture: `column "identidad_canonica" of relation "ofertas" does not exist`. La prueba copia `LIKE public.ofertas`, no la tabla del esquema aislado preparado por #57. No cambié ese fixture, su test ni el esquema público. `git diff --exit-code 1f2a59fa4f15a7ece9cdba1e65019559306a35af -- backend/tests/sql/migracion-025-identidad-conservadora.test.js backend/tests/fixtures/identidad-legacy-023-024.sql backend/sql backend/src/config/base-datos.js backend/src/modelos/oferta.js backend/src/servicios/servicio-normalizacion.js backend/src/servicios/servicio-ingreso-ofertas.js backend/tests/helpers/issue-57-entorno.js backend/tests/helpers/test-db-guard.js` dio exit 0: los archivos del fallo son idénticos a BASE. Esto es comparación estática, no una ejecución separada del commit base. No atribuyo un PASS a test:db ni amplío alcance para reparar infraestructura histórica. La última corrección posterior solo cambió telemetría de fechas en actores, no estos archivos SQL.

### Autoevaluación por spec

| Spec | Evidencia / límite |
| --- | --- |
| S1 | Adaptadores existentes auditados sin reescribir motor, sin servicios externos ni producción |
| S2 | Matriz de doce fuentes, estado/slug/credenciales, consultas/filtros, límites, fechas, transporte, errores y métricas |
| S3 | Diez términos, negativos, siglas/frases, preferencias/overrides y compatibilidad; corrección adicional Jooble preview1=opciones1=petición página1 |
| S4 | Inventario previo preservado arriba; contratos reales ampliados, fixtures crudas y normalizador real |
| S5 | LinkedIn/Computrabajo/Indeed/Bumeran/Glassdoor cubiertos; actor y límite local/costo separados; dedup Glassdoor corregida |
| S6 | HTTP de Jooble/Remotive/RemoteOK/Adzuna cubierto; fechas y región reales, sin categorías inventadas |
| S7 | Nueve suites GetOnBrd + registry/pipeline, sin alterar autorización; no afirmo renderizado visual de UI |
| S8 | Métricas de adaptador/consulta, sin inventar costo ni IA; nuevas/actualizadas/reaparecidas y errores de persistencia en PostgreSQL #57/#59 |
| S9 | Límites y fechas, presupuestos, paginación y detalle, timeout/cancel/parciales y tardíos; sin red externa |
| S10 | PASS del recorrido real Express→adaptador→PostgreSQL15 e historial, con infraestructura #57 |
| S11 | Parcial: focales, suites ordinarias sin PG/preload, SQL dedicado #57/#59 y Angular571 PASS; build productivo no verificable offline por font inlining; dos fallos test:db conocidos y confirmados sobre BASE |
| S12 | RED→GREEN observado en cada corrección, sin refactor general, scoring, cron ni despliegue |
| S13 | Informe separa adaptadores simulados, SQL real aislado y proveedores externos no verificados |
| S14 | Padre/T4: primer dictamen independiente NO LISTO y hallazgos corregidos en este lote; nuevo dictamen pendiente, no lo invento |
| S15 | Padre/T4: sin commit/push/PR/merge/deploy desde worker; una PR sigue siendo la estrategia autorizada |
| S16 | Padre/T4: URL PR, HEAD de entrega y CI pendientes; base exacta arriba, conteos y riesgos documentados |

Skills leídas: gentle-ai, ponytail, nodejs-backend-patterns, systematic-debugging, work-unit-commits y angular-developer con su referencia CLI (rutas exactas del encargo). Herramientas usadas: read, find, grep, bash para inspección/validación, write/edit y mem_save. Sin subagentes. Guardé descubrimientos/correcciones en Engram `busca-empleos`.

## Separación de evidencias

- **Verificado con adaptador real y transporte simulado:** nueve fuentes activas y GetOnBrd sintético; nuevas assertions no mockean normalizarLote.
- **Verificado con Express y PostgreSQL real aislado:** #57 y #59, identidad de DB/usuario y versión verificadas antes de SQL, esquemas por ejecución conservados para auditoría.
- **No verificado contra proveedor externo real:** todos; consumo externo real **cero**. Fixtures no prueban disponibilidad, volumen, costo ni resultados productivos.
- **Riesgos pendientes:** build Angular productivo bloqueado por descarga de fuentes no autorizada; test:db conserva dos fallos ambientales históricos confirmados sobre BASE. SQL #59 se ejecuta por su runner dedicado, no dentro de suites ordinarias; nunca se omite internamente con SKIP.
- **Dictamen independiente, commits, PR y CI:** responsabilidad del padre (T4, S14–S16).

## Reverificación independiente limitada y decisión pendiente

La sesión de recuperación volvió a consultar issue #59 (sin comentarios), `origin/master` y el worktree existente. BASE/HEAD aún son `1f2a59fa4f15a7ece9cdba1e65019559306a35af`; cambios sin commit. No modificó otros worktrees.

`gentle-ai-verify` (`mvom59xr-3-ghea`) confirmó corregidos los tres bloqueos anteriores: exclusión SQL #59/#57 de runners ordinarios, seguridad independiente de NODE_OPTIONS y preview Jooble alineada con páginas efectivas. Reportó 7 focales PASS en cuatro suites, 245 fuera de filtro, más sondas default/override1/override3 y entradas inválidas sin mutación. Es una reverificación limitada, no una nueva certificación de todas las fuentes. Los resultados históricos de las tablas anteriores no fueron reejecutados.

El verificador informó haber creado scratch en `/tmp` contra la restricción del encargo; el padre no accedió ni reutilizó esos archivos. Se conserva esta desviación explícita. No informó SQL, proveedores reales ni producción. El padre ejecutó `git diff --check` con exit0.

Dictamen: bloqueos correctivos resueltos; aceptación final **condicionada** porque S11 todavía carece de build productivo satisfactorio. Google Fonts/configuración del build son idénticos a BASE: no se demostró defecto nuevo de #59, pero Angular571 no sustituye un build PASS. Los dos fallos históricos de migration025 siguen separados, sin relajación de assertions. No se amplió alcance ni se descargaron fuentes.

**Necesita decisión del usuario:** aceptar explícitamente esta limitación offline documentada y publicar la PR con prueba de build pendiente, o conservar el trabajo sin publicar hasta definir una alternativa de build offline autorizada. Commits, PR, HEAD de entrega y CI permanecen pendientes; no hay URL ni CI aprobado que reportar. Consumo real de proveedores: cero.

## Resultado final del build — reemplaza el bloqueo offline anterior

Después de los registros históricos anteriores, el usuario autorizó expresamente descargar **únicamente los dos CSS públicos de `fonts.googleapis.com`**. No autorizó APIs de empleo, Apify, DeepSeek ni producción. No cambié `frontend/src/index.html`, `angular.json`, dependencias ni optimizaciones para obtener un PASS.

- El primer lanzamiento aislado terminó **exit1 antes de Angular**: npm no admite usar `/dev/null` como configuración global y de usuario a la vez. Corregí solo el runner local ignorado con dos archivos vacíos diferentes; npm `--version` y `run prebuild`, guardas de URL/transporte y syntax checks pasaron. No hubo descarga en ese intento.
- El segundo lanzamiento ejecutó **`npm run build -- --output-path frontend/dist/issue-59-fonts --delete-output-path=false`**, desde `frontend` (ruta de salida absoluta equivalente en ejecución), con configuración productiva predeterminada, `env -i`, analytics desactivado, entornos idénticos a `.example`, cachés dentro del worktree y preload acotado a dos GET exactos. **Exit0**, generación del bundle **7.092 segundos**.
- Auditoría de transporte: **dos GET permitidos**, ambos a `fonts.googleapis.com:443`. Sin redirecciones ni otros destinos externos. No se descargaron binarios de fuentes desde `fonts.gstatic.com`; solo permanecen referencias en el CSS real devuelto.
- Readback propio del padre con `node:assert`: `index.html` contiene `@font-face` y las familias Inter, JetBrains Mono, Space Grotesk y Material Symbols Outlined; ya no tiene links CSS externos de Google Fonts y existe `main-*.js`. Ambos entornos siguen idénticos a sus ejemplos. **Exit0**.
- Advertencia no bloqueante: `preferencias.css` pesa **15.61 kB**, supera presupuesto de **15 kB** por **610 bytes**. No cambié ese CSS para silenciarla.

Comando de lanzamiento local, desde la raíz del worktree: `env -i PATH=/home/marcos/.nvm/versions/node/v24.18.0/bin:/usr/bin:/bin /bin/bash --noprofile --norc docs/evidencias/issue-59/runtime/build-fonts/launch.sh`. El runner/preload y logs son instrumentación local ignorada, no parte del producto ni requisito nuevo para compilar. El comando funcional versionado continúa siendo `cd frontend && npm run build`, con acceso a esos CSS públicos necesario por el código preexistente.

**S11 ya no está bloqueada por el build.** Se conservan los resultados anteriores sin repetir suites sin cambios: backend2670 PASS, integración62 PASS, SQL#59 dos PASS, SQL#57 cuarenta PASS, Angular571 PASS. `test:db` sigue **209 PASS/2 fallos históricos** reproducidos en BASE según verificador anterior; no se afirma aprobación de esa suite ni se ocultan omisiones preexistentes. La reverificación limitada independiente confirmó los tres hallazgos corregidos; no se reabrió una auditoría ni se atribuye el build del padre al verificador.

**Consumo externo actualizado:** proveedores de empleo/Apify/DeepSeek **cero**; **dos descargas públicas de CSS autorizadas adicionalmente**. Ya no corresponde afirmar cero tráfico externo total. Producción, cron, flags reales y datos privados no se modificaron. PR/HEAD/CI se completarán en el registro de entrega, sin merge ni deploy manual.
