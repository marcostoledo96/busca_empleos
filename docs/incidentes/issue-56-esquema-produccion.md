# Issue #56 — Esquema productivo atrasado

## Estado operativo posterior: recuperación de #63 verificada

El 25/10/2026 confirmé la recuperación operativa de #63. No la atribuyo al merge
de #62: Marcos ejecutó posteriormente el runner original y verifiqué el resultado.

- El operador aplicó los nueve archivos pendientes sin editar runner, SQL o ledger.
  El control posterior registró **30 migraciones exitosas y 0 fallidas**, esquema
  esperado, ningún objeto inválido y ninguna configuración de cron activa.
- Correlacioné tres conexiones del proceso real del backend con PostgreSQL:
  todas usaron **TLS 1.3**. Las 522 correlaciones son muestras repetidas, no
  conexiones distintas. Esto no acredita validación estricta del certificado:
  `rejectUnauthorized:false` sigue siendo una limitación preexistente.
- Los GET autenticados de sincronización, historial y preferencias respondieron
  200/304. El **GET literal `/api/ofertas` respondió 200 el 25/10/2026 a las
  12:39:41 UTC**, corroborado en Chrome y en los registros HTTP del backend.
  Conservé la autenticación real de Firebase, sin publicar credenciales ni datos.
- No inicié scraping, DeepSeek, correos ni cron para demostrar la recuperación.

**Decisión humana alternativa de preservación:** Marcos eligió expresamente
“Migración manual directa”: aplicar sin un respaldo cifrado nuevo, restauración
final de ensayo ni pausa controlada, aceptando cambios parciales y posible pérdida
de datos. Por eso **no certifico preservación integral ni cero pérdidas**. Esta
excepción se limita a esa intervención; no convierte los pasos de seguridad
que siguen en recomendaciones opcionales para futuras operaciones.

Conservo la evidencia detallada en almacenamiento privado. La entrega de avisos
plegables incluye regresiones locales: 562 tests aprobados y 4 omitidos. La
publicación y el cierre de #63 fueron autorizados posteriormente por Marcos.

## Diagnóstico inicial de #56 (histórico, 19/10/2026)

**Producción NO reparada en aquella inspección.** Preparé una corrección del runner y una reproducción
local; no ejecuté migraciones, escrituras, scraping, DeepSeek, cron ni despliegues
productivos. La reparación requiere una aprobación adicional de Marcos.

La evidencia productiva corresponde a la inspección SELECT del orquestador del
19/10/2026, registrada en `odd/tasks/issue-56-esquema-produccion.md`, L2–L4:

- Deployment `4ca799ae-d6fe-4b4a-ae2a-2b08e2a7600b`, SUCCESS, `master`,
  BASE `e9687646f741e789cd2d57631a2a885340cf5429`.
- PostgreSQL 18.6, base `railway`, esquema `public`, search_path `"$user",public`.
  Ledger: 21 filas exitosas hasta 018. Tablas: `ofertas`, `preferencias`,
  `evaluacion_lotes`, `evaluaciones_cache`, `schema_migrations`.
- Los GET de ofertas y sincronización fallan con HTTP 500 porque sus consultas
  usan `fecha_ultima_extraccion`, agregada por 023 y ausente en ese esquema.
- El GET de historial y el POST individual de LinkedIn devuelven 503 porque
  falta `ejecuciones_busqueda`: lectura e inserción fallan con SQLSTATE `42P01`.
  La ruta individual intenta crear historial **antes** de invocar el scraper.
- El ciclo manual acepta el trabajo con 202 antes de ejecutarlo en segundo plano;
  posteriormente falla al iniciar historial. **202 no certifica una ejecución
  exitosa.** La cobertura existente de automatización distingue esas etapas.
- La migración `migrations/024-resultados-fuentes.sql` crea historial y
  `configuracion_cron`; no es `sql/migracion-024-reparar-identidades-canonicas.sql`.

El backend prioriza `DATABASE_URL`. La comparación productiva en memoria confirmó
que coincide con el servicio PostgreSQL, mientras PGHOST/PGPASSWORD divergen
(PGDATABASE/PGUSER/PGPORT coinciden). El runner anterior creaba `new Pool()` sin
opciones y sólo usaba PG*. Ahora reutilizo `src/config/base-datos.js`, incluidos
prioridad de URL, fallback PG*, carga de entorno y política SSL existentes.
No imprimo cadenas de conexión ni contraseñas.

No observé un `preDeployCommand` configurado y el inicio es `node src/index.js`:
no hay una automigración configurada en la evidencia recibida. Esto explica cómo
puede desplegarse código nuevo sin actualizar esquema; **no prueba quién omitió
migraciones ni cuándo**. Tampoco atribuyo retrospectivamente el ledger incompleto
a la divergencia de conexiones: confirmé el defecto actual del runner, no la
historia operativa. No agregué automigración ni modifiqué SQL existente.

## Nueve archivos pendientes, en orden exacto del runner

1. `backend/sql/migracion-019-firma-evaluacion.sql`
2. `backend/sql/migracion-020-cv-base.sql`
3. `backend/sql/migracion-021-filtrar-nivel-linkedin.sql`
4. `backend/sql/migracion-022-matching-explicable-y-descripcion.sql`
5. `backend/sql/migracion-023-identidad-y-reapariciones.sql`
6. `backend/sql/migracion-024-reparar-identidades-canonicas.sql`
7. `backend/sql/migracion-025-identidad-conservadora.sql`
8. `backend/sql/migracion-026-seguimiento-postulacion.sql`
9. `backend/migrations/024-resultados-fuentes.sql`

El runner ordena `sql/` primero y luego `migrations/`, no mezcla ambos órdenes.
022 incorpora explicación y edición de descripción y marca Bumeran como
`tarjeta/parcial`. 023 incorpora identidades, fecha de última extracción e índices,
con backfill de la fecha inicial. 024 recalcula identidades; 025 reconcilia URL e
identidad conservadoramente, serializando con `SHARE ROW EXCLUSIVE` y conservando
colisiones como filas separadas. No comparar URL/identidad como si fueran campos
inmutables: esos cambios son esperados. 026 deja fecha/nota de postulación en NULL;
no inventa fechas o notas históricas. 020 crea la tabla separada `cv_base`.

## Preflight productivo: exclusivamente lectura

**No usar el runner para inspeccionar producción:** incluso sin `--apply` ejecuta
`CREATE TABLE IF NOT EXISTS schema_migrations`. Uso una sesión de lectura con
credenciales protegidas y sin eco de comandos/variables. Este bloque es el catálogo
exacto a comparar con L2; si cambia, detengo el procedimiento y reviso el plan.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SELECT current_database(), current_user, version(), current_schema(),
       current_setting('search_path');
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
SELECT id, exitoso, aplicado_en FROM public.schema_migrations ORDER BY id;
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN
    ('ofertas','preferencias','cv_base','ejecuciones_busqueda','configuracion_cron')
ORDER BY table_name, ordinal_position;
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;
SELECT count(*) AS total, min(id), max(id) FROM public.ofertas;
SELECT estado_postulacion, count(*) FROM public.ofertas
GROUP BY estado_postulacion ORDER BY estado_postulacion;
SELECT md5(COALESCE(string_agg(jsonb_build_array(id, fecha_extraccion,
    fecha_publicacion, fecha_evaluacion, estado_postulacion, descripcion,
    estado_evaluacion, razon_evaluacion, porcentaje_match, datos_crudos)::text,
    E'\n' ORDER BY id), '')) AS huella_legacy FROM public.ofertas;
SELECT md5(COALESCE(string_agg(to_jsonb(p)::text, E'\n' ORDER BY id), ''))
    AS huella_preferencias FROM public.preferencias p;
COMMIT;
```

Mantengo resultados y huellas en almacenamiento privado protegido. No vuelco
perfiles, CV, notas, descripciones ni filas crudas a logs públicos. MD5 aquí es
un detector de cambios, no un mecanismo de seguridad. Si hay columnas manuales
adicionales, incluyo sus huellas y fechas originales en el inventario aprobado.
Tras agregar campos a preferencias comparo la proyección de **columnas previas**,
no un `to_jsonb` con claves nuevas. Conservo por separado los cambios esperados
de identidad/URL/Bumeran y comparo todas las filas por ID: un total igual solo no
prueba preservación.

## Respaldo y ensayo de restauración: antes de autorizar la aplicación

Los siguientes son comandos para un operador autorizado, **no ejecutados contra
producción en esta tarea**. Los DSN, contraseñas y certificados llegan por un gestor
seguro al entorno; los nombres `${...:?}` son placeholders, no secretos a pegar en
la terminal. No usar `set -x`, `echo` del entorno ni URLs en argumentos visibles.
Uso libpq con PGSERVICE/PGPASSFILE protegidos (modo 0600), y un directorio privado
fuera del repositorio (0700). No compartir el dump: contiene información personal.

```bash
umask 077
pg_dump --version
pg_restore --version
# Ambos clientes deben ser >=18 para el servidor 18; preferentemente misma versión.
PGSERVICE="${SERVICIO_ORIGEN_PROTEGIDO:?}" PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=2000' \
    pg_dump -Fc --file="${RESPALDO_PRIVADO:?}/issue56.dump"
sha256sum "${RESPALDO_PRIVADO:?}/issue56.dump" > "${RESPALDO_PRIVADO:?}/issue56.dump.sha256"
sha256sum -c "${RESPALDO_PRIVADO:?}/issue56.dump.sha256"
pg_restore --list "${RESPALDO_PRIVADO:?}/issue56.dump" > "${RESPALDO_PRIVADO:?}/issue56.list"
# Destino nuevo, vacío, aislado y sin proveedores ni conectividad a la aplicación real.
PGSERVICE="${SERVICIO_RESTAURACION_AISLADA:?}" \
    pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
    --dbname="${BASE_RESTAURACION_AISLADA:?}" "${RESPALDO_PRIVADO:?}/issue56.dump"
```

Compruebo catálogo, 21 registros del ledger, conteos y las mismas huellas en el
restore. Ensayo las nueve migraciones revisadas allí y compruebo preservación y
ledger30. El checksum verifica el archivo; **no reemplaza restaurarlo**. Si el dump
o el restore fallan, no continúo. El backup completo puede necesitar más tiempo que
120 segundos: acuerdo ese límite según tamaño, no desactivo límites a ciegas.

## Ventana y aplicación: requieren aprobación explícita adicional

Solicito aprobar: bytes/SHA revisados, respaldo y restore verificados, duración y
horario, pausa de todas las fuentes de escritura (usuario, backend, scraping,
evaluación, cron y otros workers), límites de bloqueo/tiempo, operador y destino,
y plan de recuperación. Pausar o reanudar servicios productivos también es una
acción operativa que **no está autorizada por este documento**.

En la ventana aprobada repito preflight con escritores pausados y tomo el respaldo
final consistente. 022–025 hacen UPDATE y construyen índices no concurrentes;
ALTER TABLE y 025 pueden bloquear escrituras. Acuerdo `lock_timeout=2s` y
`statement_timeout=120s` como punto de partida, ajustados tras el ensayo de volumen.
No sostengo que seis ofertas sintéticas representen tiempos productivos.

Registro el SHA del commit aprobado y un manifiesto SHA-256 del runner,
`src/config/base-datos.js`, cada uno de los nueve SQL y dependencias bloqueadas.
Verifico `sha256sum -c` antes de aplicar: ejecuto **esos mismos bytes**, no una
copia editada, un checkout posterior ni SQL pegado parcialmente. No correr el
runner si aparecen más pendientes o el ledger no coincide exactamente.

```bash
# Sólo DESPUÉS de aprobación. DATABASE_URL se inyecta protegida; no la imprimo.
# La URL debe ser alcanzable desde el entorno del operador (red privada/túnel autorizado).
cd backend
NODE_ENV=production PGOPTIONS='-c lock_timeout=2000 -c statement_timeout=120000' \
    node scripts/migrar.js --apply
```

El runner usa el pool de la app: URL PostgreSQL válida prima sobre PG*. Con URL
activa el módulo configura SSL `rejectUnauthorized:false`; parámetros SSL de la
URL pueden modificar la configuración efectiva de `pg`. Mantengo la política de
la app y reviso TLS efectivo en el ensayo, incluyendo certificados/red del
operador. No copiar `sslmode=disable` sintético a producción ni asumir que
PGSSLMODE=disable desactiva SSL cuando hay URL. Para clientes libpq del backup
uso el servicio protegido con TLS/certificados adecuados (preferentemente
`verify-full`). No configurar dos destinos contradictorios ni pegar credenciales.
En `NODE_ENV=test` el módulo descarta DATABASE_URL por aislamiento; la prueba de
prioridad usa un proceso `production_test` con dotenv simulado y SSL desactivado
**sólo en su URL local**. No cambio esa protección del entorno de tests.

## Verificación y recuperación

Después de aplicar, repito el catálogo SELECT: 30 filas exitosas, tablas de
historial/cron/CV, columnas nuevas y los índices de identidad/actividad reciente.
Comparo IDs, cantidades y huellas de campos previos, preferencias/perfil/CV y
cualquier fecha/nota ya existente; NULL nuevos de 026 no significan datos perdidos.
Compruebo backfills esperados y colisiones sin fusionar ofertas. La segunda
invocación del runner es una comprobación operativa con DDL, no read-only; requiere
la misma autorización y no debe aplicar nada ni alterar filas/secuencias.

Como smoke read-only uso una sesión autenticada autorizada: GET `/api/ofertas`,
`/api/ofertas/sincronizacion` y `/api/automatizacion/historial` deben devolver 200.
Reviso logs saneados. **No uso POST scraping/ciclo, DeepSeek o cron para verificar
producción.** Reanudar escrituras sólo con aprobación y resultado conforme.

Si falla una migración, detengo el proceso y mantengo las pausas acordadas. El
runner hace una transacción por archivo: migraciones previas pueden haber quedado
confirmadas; inspecciono catálogo/ledger antes de cualquier nueva acción. No edito
el ledger, no borro columnas, no fusiono ni elimino ofertas, no repito a ciegas. Existe
un defecto previo del registro de fallos (INSERT de ID ya existente en un reintento)
fuera de este cambio: requiere un plan revisado, no un UPDATE manual del ledger.
Si necesito recuperar, restauro el dump validado en **otra base aislada** y cotejo
huellas antes de proponer un cambio de conexión; ese corte y cualquier restauración
productiva requieren aprobación adicional. No hago rollback destructivo sobre la
base activa ni pierdo escrituras posteriores al respaldo.

## Evidencia local y límites

La prueba opt-in `tests/integracion/issue-56-reconciliacion-postgres.test.js` rechaza
DSN fuera de `127.0.0.1:55456/busca_empleos_issue56_test`, crea un esquema por corrida
y reproduce ledger21/esquema018 en PostgreSQL18. Los guards `information_schema`
legacy del bootstrap del fixture se acotan al esquema actual para evitar que otras
corridas interfieran; **los nueve archivos pendientes se ejecutan sin modificar
mediante el runner real**. No elimino esquemas sintéticos al terminar.

Compruebo HTTP500/503 y SQL42P01 antes, HTTP200 después, inserción/finalización de
historial sin scraper, seis ofertas con estados recientes/históricos, Bumeran,
colisiones, preferencias distintivas y conservación de todos los campos legacy
comparados. 026 no inventa fechas/notas. Después agrego CV y nota manual sintéticos
para comprobar que una repetición conserva filas, `xmin`, ledger y secuencias.
El CLI también prueba URL con PGPORT/PGUSER/PGDATABASE inválidos y fallback PG*.

RED confirmado: 2 fallos esperados (URL ignorada y conexión a puerto1); GREEN
focused inicial: 37/37. Logs completos stdout/stderr/exit en
`.codegraph/issue56-runtime/` (ignorados, evidencia local, no artefactos públicos).
La primera verificación registró integración 46 PASS / 6 omitidos, regresión
completa 2586 PASS / 155 omitidos y BD 209 PASS / 2 FAIL. Conservo esos logs en
`test-integracion.*`, `test-full.*` y `test-db.*`. Los dos fallos de preparación de
`migracion-025-identidad-conservadora.test.js` exigían `LIKE public.ofertas`, pero
el fixture sólo había preparado su esquema aislado. No debilité esas aserciones.

En una corrección de preparación autorizada por separado verifiqué en la conexión
activa host `127.0.0.1`, puerto `55456`, nombre `busca_empleos_issue56_test`, versión
18 y esquema `public`. Preparé public vacío usando las tablas sintéticas actuales
`ofertas`/`preferencias` como plantillas sin datos y con secuencias propias: así
los guards legacy que consultan columnas de otros esquemas no omiten columnas
necesarias. Ejecuté luego el runner con los 30 SQL originales, sin modificaciones,
hasta ledger30. No copié datos ni ledger del fixture y no alteré tests025.
El runner usó dotenv simulado y URL local con SSL desactivado; no leí secretos.
El opt-in issue56 sigue creando un esquema nuevo por corrida.

Resultados posteriores, en este orden y sin reintentos:

| Comprobación | Suites | Tests | Logs locales |
| --- | --- | --- | --- |
| Preparación public con runner original corregido | — | exit0, ledger30 | `correction-preparacion.*` |
| Focal 025, public preparado y sin PGOPTIONS | 1 PASS | 33 PASS, 0 omitidos, 0 FAIL | `correction-025.*` |
| Suite de BD, ALLOW_DB_TESTS=true y sin PGOPTIONS | 16 PASS | 211 PASS, 0 omitidos, 0 FAIL | `correction-db.*` |
| Suite completa con assertions finales, ALLOW_DB_TESTS=true e ISSUE56_TEST_DSN local | 85 PASS / 3 omitidas | 2735 PASS / 6 omitidos / 0 FAIL | `final-full.*` |

La preparación faltante quedó resuelta y la autoverificación local está en verde;
la revisión independiente y PR siguen a cargo del orquestador (S6/S7).

Un PASS local no certifica ni repara producción, y no prueba el volumen, las
colisiones o las personalizaciones de una copia productiva. La próxima decisión
es revisar evidencia y aprobar (o rechazar) el procedimiento, no ejecutar cambios.
