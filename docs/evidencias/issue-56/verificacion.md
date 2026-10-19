# Issue #56 — Evidencia de verificación

## Identidad y alcance

- BASE: `e9687646f741e789cd2d57631a2a885340cf5429`.
- Candidato funcional comprobado: `188a7c572b250b2d72ce8411d7f835e1251d6719`.
- Los commits documentales posteriores no cambian runner, tests, configuración de aplicación ni SQL. No atribuyo las pruebas a bytes funcionales diferentes.
- Entorno local: Node.js 24.18.0, PostgreSQL 18.6 UTF-8 en `127.0.0.1:55456`, base sintética `busca_empleos_issue56_test`. Dependencias instaladas con `npm ci --ignore-scripts --no-audit --no-fund`.
- Producción: únicamente inspección SELECT/catálogos y lectura de logs/configuración. **No reparada**. No ejecuté migraciones, scraping, DeepSeek, cron, despliegues ni cambios de permisos productivos.

## Resultados realmente observados

| Ejecución | Exit | Resultado |
|---|---:|---|
| RED antes de corregir runner | 1 | 35 PASS / 2 FAIL esperados: DATABASE_URL ignorada, conexión a puerto sintético inválido |
| Focal final del implementador | 0 | 37 PASS, 2 suites, sin omitidos |
| BD inicial | 1 | 209 PASS / 2 FAIL de preparación: faltaba public.ofertas para LIKE de tests 025 |
| Focal 025 tras corregir preparación sintética | 0 | 33 PASS, sin omitidos |
| Suite BD con public preparado | 0 | 211 PASS, 16 suites, sin omitidos |
| Integración | 0 | 46 PASS / 6 omitidos; 6 suites PASS / 3 omitidas |
| Full final del implementador | 0 | 2735 PASS / 6 omitidos; 85 suites PASS / 3 omitidas |
| Focal independiente Gentle AI Verify | 0 | 37 PASS, 2 suites, sin omitidos |
| Full del orquestador sobre SHA funcional exacto | 0 | 2735 PASS / 6 omitidos; 85 suites PASS / 3 omitidas; 15.433 s |
| git diff --check | 0 | Sin errores |

No reemplacé los fallos históricos por resultados posteriores ni relajé sus assertions. La corrección de preparación creó el esquema public completo **en la misma base sintética autorizada**, sin modificar tests025 ni SQL históricos. Las omisiones corresponden a suites opt-in no activadas; no las cuento como PASS.

Salida final observada por el orquestador:

```text
Test Suites: 3 skipped, 85 passed, 85 of 88 total
Tests:       6 skipped, 2735 passed, 2741 total
Snapshots:   0 total
Time:        15.433 s
Ran all test suites.
PARENT_FULL_EXIT=0
```

## Comandos reproducibles

La URL siguiente es exclusivamente local/sintética, sin contraseña. El test issue56 valida protocolo, host, puerto, usuario, nombre de base, ausencia de parámetros/contraseña y versión PostgreSQL antes de escribir. No usar una conexión productiva en ninguno de estos comandos.

```bash
# Focal issue56; crea un esquema nuevo y reconstruye 018→actual automáticamente.
env -u PGOPTIONS -u PGSERVICE -u PGSERVICEFILE -u DATABASE_URL \
    NODE_ENV=test PGHOST=127.0.0.1 PGPORT=55456 PGUSER=marcos \
    PGDATABASE=busca_empleos_issue56_test PGSSLMODE=disable \
    ISSUE56_TEST_DSN=postgresql://marcos@127.0.0.1:55456/busca_empleos_issue56_test \
    npm --prefix backend test -- --runInBand \
    tests/scripts/migrar.test.js tests/integracion/issue-56-reconciliacion-postgres.test.js

# Para BD/full, preparar primero public con las migraciones del repositorio,
# exclusivamente sobre esa base vacía/sintética; varias suites existentes usan public.ofertas.
# No aplicar el runner sobre producción para reproducir este informe.
env -u PGOPTIONS -u PGSERVICE -u PGSERVICEFILE -u DATABASE_URL \
    NODE_ENV=test PGHOST=127.0.0.1 PGPORT=55456 PGUSER=marcos \
    PGDATABASE=busca_empleos_issue56_test PGSSLMODE=disable ALLOW_DB_TESTS=true \
    ISSUE56_TEST_DSN=postgresql://marcos@127.0.0.1:55456/busca_empleos_issue56_test \
    npm --prefix backend test -- --runInBand
```

Para repetir únicamente suites específicas con ese mismo entorno local preparado: `npm --prefix backend run test:db -- --runInBand` y `npm --prefix backend run test:integracion -- --runInBand`. El fixture `backend/tests/fixtures/issue-56-entorno.js` evita leer archivos de entorno en los procesos CLI sintéticos. No ejecuté build/frontend local: no hay cambios frontend ni build de backend declarado.

## Conservación y contratos

La prueba versionada reconstruye 21 migraciones históricas y aplica las nueve pendientes originales mediante el CLI real, con PG* deliberadamente inválidas para demostrar prioridad de DATABASE_URL. Comprueba:

- HTTP500/503 y SQLSTATE42P01 anteriores; GET listado/sincronización/historial200 posteriores.
- Fallo inicial de historial impide invocar el scraper mock.
- Ledger21→30, tablas CV/historial/cron, índices de identidad y actividad reciente.
- Seis ofertas, IDs, estados, primeras fechas, descripciones, evaluaciones, datos crudos y preferencias conservados. Colisiones permanecen separadas.
- Backfill Bumeran previsto, última extracción inicial igual a primera fecha y nuevas fecha/nota de postulación NULL, sin inventar historia.
- Inserción/finalización de historial sintético.
- Segunda ejecución sin pendientes ni cambios en datos, xmin, ledger o secuencias; incluye CV y nota agregados después.
- Fallback PG* sigue funcionando. Ayuda, orden y cierre del pool conservados.

## Revisión independiente

Gentle AI Verify `mvfox3vd-4-s34x`: **PASS técnico; sin bloqueantes nuevos del candidato**. El estado de entrega era PARTIAL porque todavía faltaban PR/URL y corroboración de antecedentes por el padre, no por una falla de la corrección.

Ejecuciones independientes adicionales:

- Ocho casos de configuración/ciclo de vida: prioridad URL, SSL, fallback, descarte URL en test, URL inválida saneada, guards y cierre del pool: PASS.
- Payload real: 8 filas persistidas / 5 visibles, IDs coincidentes entre listado/sync/estadísticas, filtro Bumeran, fecha bisiesta, nota de 4000 caracteres, CV/perfil preservados y rechazo HTTP400 sin cambios: PASS.
- pg_dump18.6 -Fc, checksum SHA256, listado y restauración transaccional en otra base sintética: PASS. Preflight origen/restore con ledger30, conteos y huellas legacy/preferencias iguales.
- Baseline: reproduce URL ignorada y demuestra aplicación por fallback; contraste con comportamiento corregido.

Límites y fallos propios del verificador, conservados explícitamente:

1. Un probe adicional terminó exit1 por una expectativa equivocada del harness sobre Bumeran: `scraper→tarjeta` es un cambio esperado de 022, no una pérdida candidata. Otro probe separado comprobó el payload teniendo en cuenta ese backfill; no se borró ni reintentó el fallo inicial.
2. Un comparador exhaustivo adicional terminó exit1 por MODULE_NOT_FOUND antes de comparar. **No se acredita esa comparación exhaustiva adicional**. El dump/restore transaccional y las huellas de preflight sí fueron ejecutados y coinciden; no los confundo con el comparador fallido.
3. Los antecedentes CodeGraph/Engram/MCP productivos los verificó el orquestador, no ese verificador aislado. No repitió consultas productivas.
4. Esto no es una certificación de auditoría externa ni prueba de volumen/locks productivos. Los procedimientos de respaldo/restauración con datos reales y migración siguen requiriendo aprobación.

## Integridad de logs locales

Los stdout/stderr/exit completos se conservan localmente en `.codegraph/issue56-runtime/`; no publico dumps, variables, secretos ni datos reales. Los logs ignorados no son artifacts descargables de GitHub. Este informe versionado permite revisar resultados y reproducirlos; CI aporta evidencia independiente solo de los jobs que efectivamente ejecuta.

SHA256 de logs locales observados por el orquestador:

```text
891f8b6b23c8d2c46277da0cfe26d2544b9fc6488db5f16ca3a70653258a35d4  parent-full.stdout
bc82023825a8e93e9828f93de782350254c8328f8002e45ed3a4bef8710420d2  parent-full.stderr
7e54c45d20b98fd9c08dce274ce4410853abc29e01a923747e91c4c4b9f8b088  red-confirmado.stderr
8040a8c4f7d36a335f3cb624a6d2a77c2a377b9f9ee2b3d5f50d5585d2eb5d28  correction-db.stderr
```

CI habitual usa PostgreSQL15 y no activa `ISSUE56_TEST_DSN`: el opt-in PostgreSQL18 se acredita con la ejecución local/independiente descrita, **no con CI verde**. No cambié el workflow para ampliar alcance ni lanzar trabajo adicional.
