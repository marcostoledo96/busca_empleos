# Evidencia existente para G1 y G2 de PR #73

Publico los registros solicitados por [PR-AUDIT-V1](https://github.com/marcostoledo96/busca_empleos/pull/73#issuecomment-6510793102).
No corrijo un bug de producto ni ejecuto nuevas pruebas: el comentario señala
corroboraciones faltantes, no defectos comprobados. La entrega agrega únicamente
evidencia/documentación. No declaro APTO FINAL por cuenta del auditor.

## Identidad del candidato y alcance del delta

| Referencia | SHA exacto |
| --- | --- |
| BASE de PR y HEAD de Git durante las pruebas sin commits | `b3f243baa360c385a4f61a8ebe4399a7450a75d3` |
| Commit que incorpora preview y prueba PG | `e973d8c37cca0c65aa85384ade74f6917170a587` |
| Candidato publicado que revisó el auditor | `af52277be070aa8909d46299c683e128c3cf4bf5` |
| BASE de esta entrega exclusivamente documental | `af52277be070aa8909d46299c683e128c3cf4bf5` |

Las pruebas locales se ejecutaron sobre cambios **sin commits**, no sobre el árbol
limpio de BASE. El verificador copió ese candidato a un scratch sin `.git` ni `.env`.
Luego se publicaron sus fuentes/tests sin cambios de bytes. Entre `e973d8c` y
`af52277` solo cambió `odd/tasks/issue-70-deepseek.md`.

[identidad-candidato.json](identidad-candidato.json) enumera los 18 archivos
fuente/tests cambiados frente a BASE, con SHA-256 y blob Git del candidato. Los
comparé byte a byte con el worktree antes de esta entrega. El reporte primario de
Verify declara además su comprobación SHA-256 antes/después de ejecutar sus probes.

**Límite temporal explícito:** el comando PostgreSQL original no imprimió un SHA
ni un manifiesto de fuentes. El manifiesto adjunto se calculó ahora de los blobs
publicados, no durante aquella ejecución; tres hashes del padre sí quedaron
registrados durante la entrega original y coinciden. Esta asociación retrospectiva
se apoya en esos registros, la ejecución original, el reporte independiente y el
historial sin modificaciones posteriores de fuentes/tests. No la presento como
una atestación criptográfica contemporánea del proceso PG. El auditor decide si
esta corroboración es suficiente; no simulo una ejecución nueva ni su dictamen.

## G1: PostgreSQL real con fixtures aisladas

- [stdout/stderr combinado original](postgresql-original.log), conservado desde el
  job de ejecución, sin reconstruir la salida ni reemplazarla por un resumen.
- [Comando, entorno y evento de salida](postgresql-ejecucion.json): exit code **0**,
  **1 suite PASS, 2 tests PASS, 0 FAIL**, 0.722 s.
- [Registro original de apagado](postgresql-apagado.log): `server stopped`.
- [Prueba exacta del candidato](https://github.com/marcostoledo96/busca_empleos/blob/af52277be070aa8909d46299c683e128c3cf4bf5/backend/tests/integracion/issue-70-recuperacion.test.js).

El comando real, desde `backend` del worktree exclusivo, fue:

```bash
env -i PATH="$PATH" HOME="$HOME" \
NODE_ENV=test DB_TEST_SINTETICA=true ALLOW_DB_TESTS=true \
PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=issue70_test \
PGPASSWORD=sintetica_issue70 PGDATABASE=busca_empleos_issue70_test \
PGSSLMODE=disable DEEPSEEK_API_KEY=clave-sintetica \
npm test -- --runInBand --no-cache \
tests/integracion/issue-70-recuperacion.test.js --verbose=false
```

`PORT` fue 44703, asignado al cluster PostgreSQL 18 nuevo de esa ejecución.
Los valores de autenticación mostrados son ficticios de la fixture, sin acceso a
servicios externos. `env -i` excluyó DATABASE_URL y credenciales heredadas. No es
una receta lista para producción ni autorización para conectar a otra base.

El cluster solo escuchó en loopback. La prueba comprobó base `_test`, usuario,
host y puerto antes de crear un esquema aleatorio transaccional propio. No ejecutó
migraciones, modificó tablas públicas ni usó datos reales; revirtió la transacción
y el proceso apagó únicamente su cluster. Fetch estuvo bloqueado; IA y preferencias
fueron simuladas, persistencia de ofertas/caché/lotes fue PostgreSQL real.

| Caso real ejecutado | Qué verificó |
| --- | --- |
| Selección y preview | 18 fixtures, frontera inclusiva 30 días, desempate estable, reaparición reciente, exclusión de éxitos, firma, porcentaje cero y seguimiento manual; GET una SELECT, snapshots intactos, sin proveedor/lock |
| Fallo y recuperación | Oferta sintética 100 falla y después se recupera; 101 conserva aprobación, porcentaje, fecha, firma, postulación, nota y caché anteriores; no se cachea el fallo ni selecciona el éxito previo |

Los dos tests siguen **SKIPPED** en el gate normal por doble opt-in y no pertenecen
al script `test:db` observado. No cambié su selección ni CI para ocultarlo. La
corroboración de G1 es esta ejecución local existente, no los otros jobs verdes.

## G2: reporte primario del verificador independiente

[verify-original.md](verify-original.md) es una copia íntegra sanitizada de la
respuesta final existente de `gentle-ai-verify`, tarea `mvu4sb9b-6-n4o0`.
Conservo su veredicto, límites, comandos, cantidades y el código exacto de sus
probes sintéticos, que entonces existían solo en el scratch, no como tests nuevos
del repositorio. Sustituyo rutas absolutas locales por marcadores o nombres
relativos y normalizo dos finales Markdown de doble espacio, sin alterar contenido.
No es un nuevo resumen escrito como si lo hubiera emitido el verificador.

| Observación propia del verificador | Resultado original |
| --- | --- |
| Cinco suites focales en scratch aislado | 146 PASS, 37 SKIPPED, 0 FAIL; exit 0, 1.739 s |
| Probes independientes | 14/14 PASS; exit 0, 0.574 s |
| Diferencial completo del parser BASE/candidato | 20/20; exit 0, stdout exacto y sin stderr en el reporte |
| Inspección por especificación S1-S7 | Cumplidas; sin blockers causados por el candidato |
| PostgreSQL/full | Leyó evidencia original del padre, no afirmó ejecutarla personalmente |

En el reporte, `HEAD = BASE` describe el HEAD Git antes de los commits, no el
contenido probado. La sección de identidad anterior vincula ese candidato con
el commit publicado y distingue hashes contemporáneos de los calculados ahora.

## Integridad y privacidad de los artefactos

Desde la raíz del worktree del candidato o de esta entrega documental:

```bash
sha256sum -c docs/evidencias/issue-70/SHA256SUMS
```

Comprueba fuentes/tests y los tres registros primarios publicados. También se
puede calcular cada hash desde el blob exacto, sin confiar en el checkout:

```bash
git show af52277be070aa8909d46299c683e128c3cf4bf5:backend/tests/integracion/issue-70-recuperacion.test.js | sha256sum
```

Revisé la publicación para excluir rutas personales, credenciales reales, datos
productivos, CV, prompts privados y respuestas reales. Los textos `SECRETO_*`,
`PRIVADO` y correos `.invalid` del reporte son centinelas sintéticos de sus probes,
no datos extraídos del sistema. El log PostgreSQL contiene solo IDs/textos de sus
fixtures. Sus `console.error` HTTP_503 son el escenario simulado esperado, no un
FAIL del test ni una llamada real a DeepSeek.

## Estado de las pruebas y lo no ejecutado en este lote

- **PASS previo:** suite normal 2874 tests, 85 suites; PostgreSQL issue70 2/2 aparte;
  Verify y probes indicados arriba. [CI del candidato](https://github.com/marcostoledo96/busca_empleos/actions/runs/40969750010) confirmó 4/4 jobs.
- **SKIPPED previo:** 161 tests de la suite normal, incluidos esos dos PG; los otros
  159 no se convierten en PASS por esta publicación ni por inferencia desde CI.
- **PASS de este lote:** integridad de hashes, cotejo con blobs, readback,
  revisión de privacidad y estructura/enlaces documentales.
- **NOT RUN de este lote:** Jest, PostgreSQL, Verify, Actions, frontend y builds.
  Reutilizo pruebas válidas como pidió la auditoría; no afirmo haberlas repetido.
- **N/A para el delta pasivo:** RED/GREEN nuevo y revisión semántica de código.
- **PENDING externo:** el auditor debe contrastar G1/G2 y emitir su nuevo dictamen.
  No autoasigno APTO FINAL ni doy por aprobada su revisión.

No cambié código, contratos, scoring, prompts, configuración, selección SQL,
migraciones, dependencias ni CI. La optimización opcional SELECT de IDs no es un
defecto confirmado y no se implementa por rutina. No ejecuté recuperación,
producción, DeepSeek real, merge, cierre de issue ni deploy manual. El GET sigue
siendo un snapshot no vinculante; una recuperación futura exige autorización de
IDs exactos/costo y revalidación inmediata.
