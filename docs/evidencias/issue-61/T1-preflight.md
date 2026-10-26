# T1 — Preflight de esquema (autoverificación del writer)

Base: `7cdc6bc62898b3b5f9d1b8b090e3ee571249c439`. Sin commit/push, RDD ni SDD.
Leí AGENTS y el documento ODD, incluidos Specs y Log; no modifiqué el ODD.
Consulté el índice CodeGraph existente antes de explorar modelos/configuración.

## Alcance comprobado

| Spec | Evidencia T1 |
|---|---|
| S1 | CLI pequeño de diagnóstico; no intenta reparar ni declarar saludable toda la aplicación. |
| S2 | Política PostgreSQL pura compartida; sin dotenv, app/index, logger ni runner; una conexión; BEGIN READ ONLY; sólo SELECT y ROLLBACK; límites y cierre. |
| S3 | Basenames exactos descubiertos en ambos directorios; duplicados ambiguos rechazados; columnas del ledger y éxito booleano estricto. |
| S4 | Contratos de los siete modelos persistentes más ledger. Ofertas incluye la proyección explícita de sincronización y seguimiento; preferencias incluye perfil/modelos/exclusiones y búsqueda, no columnas obsoletas por costumbre; historial, CV, cron, lotes y caché tienen sus columnas operativas. |
| S5 | Exit 1, diagnóstico concreto de ausencias/ledger desde allowlists y mensaje genérico ante incertidumbre de conexión/permisos; sin errores PostgreSQL ni valores de filas. |
| S6 | Once escenarios SQL01–SQL11 y variantes de NULL, duplicados y columnas críticas ausentes, sin SKIP. |
| S7 | Esquemas/roles exclusivamente sintéticos; archivos históricos intactos; comparación de catálogo/ACL/defaults/restricciones/índices/triggers/roles, ledger, datos y estados de secuencias antes/después; cero conexiones restantes. |
| S14 | Sin producción, servicios externos, scraping, IA, correo, reinicios o deploys. |
| S15 | Focales primero, SQL sintético después y regresiones de configuración compartida. Suites amplias y job CI diferidos a T3 por contrato del padre. |
| S16 | Implementación delegada en este writer, CodeGraph consultado y decisiones guardadas en Engram (14651, 14653). Verificación independiente a cargo del padre en T3. |

**T1 no completa S1 en su alcance global ni S15/S16 globales:** smoke/CI son T2;
verificación independiente y suites completas son T3. Producción: **NO VERIFICADO**.
No consulté Railway MCP ni asumí permisos SQL por su disponibilidad declarada.

## Entorno

Instalé dependencias sólo en este backend mediante `cd backend && npm ci --ignore-scripts`:
exit 0, 630 paquetes, 7s. npm informó 34 vulnerabilidades preexistentes en el árbol
(2 bajas, 13 moderadas, 16 altas, 3 críticas). No cambié dependencias ni lockfile,
ni ejecuté correcciones automáticas. Node observado: 24.18.0.

[Identidad Docker y disposición del runtime](runtime/provisionamiento.md).
PostgreSQL 15, loopback 55457. Guardas #57 reutilizadas antes de cualquier fixture:
URL productiva, host remoto, puerto/base/rol/clave incorrectos, archivos de servicio,
pgpass, PGOPTIONS ajeno y claves reales de proveedores se rechazan sin cargar pg/Jest.

La preparación aplica los SQL existentes a un esquema origen propio, acotando los guards
legacy al esquema, como #57. Cada caso construye desde ese catálogo tablas sintéticas con
los tipos efectivos y omite el objeto elegido al crearlas: no usa DROP ni ALTER sobre el
esquema histórico. Las tablas de caso no copian valores personales de los SQL iniciales;
tienen una fila nula sintética, ledger propio y centinela con secuencia. No pretendo con esto
auditar restricciones o índices de producción. El rol lector de SQL10 es no superusuario,
sin creación de roles/bases; falla sin SELECT de ofertas y pasa al concederlo **desde el fixture**,
nunca desde el preflight. La conexión rechazada se reproduce con clave ficticia incorrecta.

## RED observado

1. Focal nuevo, antes del CLI/configuración: exit 1; **6/6 fallaron**, 0.372s.
   Ayuda esperaba exit 0 y salidas exactas; CLI/configuración aún no existían.
2. SQL antes del CLI: exit 1; **18/18 fallaron**, 1.578s. Los fixtures sí se prepararon
   en PG15 aislado; no había módulo preflight. Las aserciones de salidas/exit y de
   inmutabilidad estaban presentes antes de implementar.
3. Refuerzo de límites URL: RED ante `options` que podría reemplazar los timeouts.
   Esa ejecución también detectó dos matchers Jest incorrectos en el test nuevo;
   los reemplacé por comparación exacta de llamadas, sin debilitar assertions.
4. PGOPTIONS de cambio de rol: **1 falló / 27 pasaron**, 0.925s; luego rechacé la opción.
5. Error de cliente adquirido: **1 falló / 28 pasaron**, 0.905s; pg-pool retira el listener
   idle al prestar un cliente. Añadí listener propio que no imprime detalles.

## GREEN inicial (anterior a la corrección diagnóstica): comandos exactos

Ejecutados en foreground, en este orden desde la raíz del worktree:

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/scripts/verificar-esquema.test.js tests/scripts/test-issue61.test.js
```

Exit **0**, **2 suites / 29 tests PASS**, **0.877s**. Incluye ayuda y opciones,
salidas exactas, basenames/ambigüedad, configuración pura, límites, cierre incluso con
conexión interrumpida, deadline global y guardas antes de fixtures.

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable node scripts/test-issue61.js
```

Exit **0**, **1 suite / 27 tests PASS**, **3.616s**. Incluye SQL01–SQL11, false/NULL,
ledger ambiguo y ausencia individual de columnas críticas de ofertas, ledger, CV,
preferencias, historial, lotes y caché. SQL11 primero falla al agregar un basename futuro
requerido y después pasa al registrarlo: no depende de un número histórico.
Cada invocación compara snapshots completos en memoria y comprueba stdout/stderr/exit exactos;
conserva sus SHA-256 iguales y duración en `runtime/sql11.json` (generado, ignorado).
Después de cada invocación `pg_stat_activity` demuestra **0 conexiones issue61-preflight**.

```bash
cd backend && env -i PATH="$PATH" NODE_ENV=test DB_TEST_SINTETICA=true PGHOST=127.0.0.1 PGPORT=55457 PGDATABASE=busca_empleos_issue57_test PGUSER=busca_empleos_test PGPASSWORD=sintetica_issue57 PGSSLMODE=disable node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath tests/config/base-datos.test.js
```

Exit **0**, **1 suite / 26 tests PASS**, **0.326s**. Sin omisiones: nueve tests existentes
de carga/guardas, tres conexiones SQL reales al runtime sintético y catorce regresiones
adicionales de SSL/URL/fallback. En los tests de dotenv, dotenv está simulado: no leo `.env`.
Preservo incluso la semántica previa de host sólo con espacios.

`git diff --check`: exit **0**, sin salida (también repetido al cerrar T1).

## Límites y siguiente paso

- El preflight verifica lectura de contratos críticos y ledger, no índices, unicidad,
  tipos exhaustivos, permisos de escritura, calidad del contenido ni salud funcional HTTP.
- Mantengo la política SSL existente; no cambio la confianza de certificados de la app.
- Aíslo `issue-61-esquema.test.js` del Jest general como #57/#59: debe ejecutarse mediante
  `test:issue61`. T2 debe agregar esa ejecución al job PostgreSQL existente; aún no hay cambio CI.
- La fixture futura se inyecta sólo por la API de pruebas; no agregué una opción CLI de directorios.
- No ejecuté suites amplias, build, tests #57/#59 completos ni smoke; están diferidos al padre/T2/T3.
- El contenedor queda activo, sin tocar otros contenedores. No ejecuté acciones git terminales.

## Corrección del readback: diagnósticos útiles y seguros

El padre detectó que el stderr inicial ocultaba también identificadores de esquema confiables.
Corrijo esa carencia sin modificar configuración compartida, runner, permisos ni migraciones.
Ahora genero una lista estructurada interna de faltantes y migraciones pendientes/fallidas;
la salida usa un máximo de 20 entradas, encabezado `PREFLIGHT: ERROR` y cierre
`No recomiendo continuar con el despliegue.`. El éxito empieza con `PREFLIGHT: OK`.

Ejemplos exactos observados y afirmados por los tests (stderr, exit 1 y stdout vacío):

```text
PREFLIGHT: ERROR
Falta: ofertas.fecha_ultima_extraccion
No recomiendo continuar con el despliegue.
```

```text
PREFLIGHT: ERROR
Falta: ejecuciones_busqueda
No recomiendo continuar con el despliegue.
```

```text
PREFLIGHT: ERROR
Migraciones pendientes: 024-resultados-fuentes.sql
No recomiendo continuar con el despliegue.
```

```text
PREFLIGHT: ERROR
Migraciones fallidas o sin éxito confirmado: migracion-024-reparar-identidades-canonicas.sql
No recomiendo continuar con el despliegue.
```

Para conexión/permisos desconocidos, el detalle es exclusivamente
`No pude verificar configuración, conexión o permisos de forma segura.`.
La consulta `pg_attribute` permite distinguir columnas ausentes de columnas que
`information_schema` oculta por permisos; los `SELECT ... LIMIT 0` siguen comprobando acceso.
No clasifico una denegación de permisos como un objeto faltante.
Los únicos identificadores emitidos provienen de los contratos del código o de los basenames
requeridos descubiertos en el repo. No emito IDs adicionales devueltos por PostgreSQL;
los basenames se limitan a caracteres ASCII seguros y 255 caracteres, sin controles.

### RED de esta corrección

- Comando focal exacto de arriba: exit **1**, **3 fallaron / 26 pasaron**, **0.916s**;
  el stderr anterior no tenía encabezado/cierre nuevos.
- Comando SQL exacto de arriba, antes de implementar: exit **1**, **27/27 fallaron**,
  **3.403s**. Incluye RED explícito de columna, tabla, migración ausente y estado false;
  las diferencias muestran el mensaje genérico anterior frente al identificador esperado.
- El primer GREEN focal detectó una aserción que asumía falta de ROLLBACK al detectar
  incompatibilidad. La corregí exigiendo explícitamente BEGIN, sólo SELECT intermedios y
  ROLLBACK final: no permito SQL adicional ni debilito la restricción read-only.

### GREEN vigente y autoverificación S3/S4/S5/S6/S7

Se repitieron en foreground los **mismos tres comandos exactos** documentados arriba:

1. Focales: exit **0**, **30/30 tests**, **0.882s**.
2. SQL guardado en el mismo contenedor: exit **0**, **28/28 tests**, **7.278s**.
3. Configuración compartida: exit **0**, **26/26 tests**, **0.319s**.
4. `git diff --check`: exit **0**, sin salida.

- **S3:** pendientes y fallidas/NULL se distinguen usando el basename exacto requerido;
  ambos 024 siguen separados. Un ledger ausente se informa sin crearlo.
- **S4:** el diagnóstico identifica tabla o columna concreta y reúne faltantes, en lugar
  de abandonar el chequeo en el primer objeto ausente.
- **S5:** cabecera/cierre claros; IDs desconocidos y errores SQL crudos nunca salen;
  conexión/permisos conservan el detalle genérico fijo. Máximo 20 entradas más aviso de truncado.
- **S6:** los once escenarios siguen pasando y agregué el caso de todas las migraciones
  ausentes, que verifica salida exacta truncada sin mostrar los IDs privados desconocidos.
  El focal adicional rechaza nombres de archivo con controles.
- **S7:** cada invocación, incluso errores concretos y truncado, conserva snapshots iguales
  de catálogo/ledger/datos/secuencias y cero conexiones remanentes.

`runtime/sql11.json` fue regenerado con mensajes nuevos, tiempos y hashes antes/después.
Conservo el contenedor original y no hice commit, push ni intervenciones productivas.
