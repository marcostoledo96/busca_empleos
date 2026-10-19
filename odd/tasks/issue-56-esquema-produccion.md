# Issue #56 — Reconciliación segura del esquema productivo
Objetivo: diagnosticar drift y preparar corrección verificable sin escribir en producción. Rama: `fix/issue-56-esquema-produccion`; BASE: `e9687646f741e789cd2d57631a2a885340cf5429`; entrega: una PR a `master`, sin merge ni cierre.
Verificación: Jest, PostgreSQL 18 sintético aislado, integración HTTP sin proveedores y Verify independiente. RDD desactivado por clone_local. Estimación inicial: 300–400 líneas funcionales/tests/docs, excluyendo este registro.

## Specs
S1. «Leé "AGENTS.md", la issue #56 completa y el contexto de Engram.» «Sincronizá "origin/master" antes de trabajar.» «Utilizá un worktree independiente.» «Aplicá Gentle AI, CodeGraph, Explore y Verify, con las skills pertinentes.»
S2. «Investigá los logs del backend Railway, el esquema PostgreSQL y las migraciones SQL.» «Contrastá qué migraciones existen en Git y cuáles fueron aplicadas realmente a la base productiva.» «Revisá especialmente las migraciones 023–026 y "024-resultados-fuentes.sql".» «Verificá qué ocurre con la tabla "ejecuciones_busqueda" y por qué falla su consulta/inserción.»
S3. «Reproducí los problemas utilizando una base PostgreSQL sintética.» «Prepará y verificá la corrección necesaria, conservando la información existente.» «Ejecutá tests de base de datos, integración y regresión relevantes.»
S4. «No ejecutes migraciones ni escrituras sobre la BD productiva sin mi aprobación explícita adicional.» «Primero necesito un diagnóstico con evidencia, el plan de corrección, los riesgos, el respaldo necesario y el procedimiento exacto.» «No borres ofertas, postulaciones, fechas, notas, perfiles ni preferencias.»
S5. «No ejecutes scraping, DeepSeek, cron o despliegues productivos durante las pruebas.» «No expongas contraseñas ni variables secretas.»
S6. «Pedí una verificación técnica independiente con Gentle AI.» «Si hace falta cambiar código o scripts, prepará una PR para auditoría externa sin hacer merge ni cerrar la issue.»
S7. «Causa raíz confirmada de cada error.» «Estado del esquema y migraciones faltantes.» «Pruebas realizadas y resultados.» «Plan seguro para reparar Railway.» «Riesgos sobre datos existentes.» «URL de PR, si hubo cambios de código.» «Qué necesita mi aprobación para completar la reparación productiva.» «No des por solucionado un error de producción solo porque los tests locales pasan.» «Priorizá recuperar la aplicación funcional sin pérdida de datos y sin sobreingeniería.»
S8. «arregla los mcp para poder continuar». Autorizaciones UI explícitas: modificar solo PostgreSQL/Railway en `/home/marcos/.gentle-shell/agent/mcp.json`; no ampliar permisos ni escribir en producción. «listo» confirma recarga de Pi.

## Tasks
T0 | S1,S5,S8 | inline configuración MCP + Verify | done | MCP real SELECT PASS; RED2FAIL→GREEN3PASS sanitización; Verify mvfnjbil-3-u58o PASS; configuración global fuera de PR.
T1 | S1-S2,S4-S5 | delegated Explore + inline Railway/catálogo | done | SELECT real y comparación segura de conexiones; ledger21 éxitos hasta018, nueve pendientes; sin escrituras. Evidencia inicial se incorpora al commit T2.
T2 | S3-S5,S7 | delegated worker | done | Commit188a7c572b250b2d72ce8411d7f835e1251d6719. Corrección mvfopm6a-3-qum6 completada: public sintético preparado;focal02533PASS;BD211PASS;fullfinal2735PASS6skip(85suitesPASS3skip). RED35PASS2FAIL→GREEN37PASS;integración46PASS6skip. Fallos históricos preservados;sin assertions/SQL cambiados.
T3 | S1-S7 | delegated Verify + inline entrega GitHub | in_progress | Verifymvfox3vd-4-s34xPASStécnico;37focalPASS+payload/config/backuprestoresintéticoPASS. Padrespotfull188a7c5:2735PASS6skip15.433sexit0. Evidenciaversionada docs/evidencias/issue-56/verificacion.md; faltaPR/CI/URL. DosprobesadicionalesVerifyfallidosharnessconstancomolímites,noPASS. Producciónpendienteaprobación.

## Log
L1. Pedido original del usuario, literal:
Actuá como desarrollador de Busco Trabajo utilizando Gentle Shell de Pi y Gentle AI.

REPOSITORIO: "marcostoledo96/busca_empleos"
ISSUE: https://github.com/marcostoledo96/busca_empleos/issues/56
PRIORIDAD: P0 — BLOQUEANTE
TARGET: "master"
BASE DE REFERENCIA: "e9687646f741e789cd2d57631a2a885340cf5429"

Objetivo

La aplicación en producción está fallando en búsqueda, sincronización e historial.

Se comprobó en los logs reales de Railway:

- "GET /api/ofertas": HTTP 500.
- "GET /api/ofertas/sincronizacion": HTTP 500.
- Error PostgreSQL: "column "fecha_ultima_extraccion" does not exist".
- "GET /api/automatizacion/historial": HTTP 503.
- "POST /api/scraping/linkedin": HTTP 503.
- Un ciclo manual devuelve inicialmente 202, pero luego falla al iniciar el historial.

No quiero parches visuales que oculten estos errores. Quiero identificar y solucionar las causas reales.

Instrucciones

1. Leé "AGENTS.md", la issue #56 completa y el contexto de Engram.
2. Sincronizá "origin/master" antes de trabajar.
3. Utilizá un worktree independiente.
4. Aplicá Gentle AI, CodeGraph, Explore y Verify, con las skills pertinentes.
5. Investigá los logs del backend Railway, el esquema PostgreSQL y las migraciones SQL.
6. Contrastá qué migraciones existen en Git y cuáles fueron aplicadas realmente a la base productiva.
7. Revisá especialmente las migraciones 023–026 y "024-resultados-fuentes.sql".
8. Verificá qué ocurre con la tabla "ejecuciones_busqueda" y por qué falla su consulta/inserción.
9. Reproducí los problemas utilizando una base PostgreSQL sintética.
10. Prepará y verificá la corrección necesaria, conservando la información existente.
11. Pedí una verificación técnica independiente con Gentle AI.
12. Ejecutá tests de base de datos, integración y regresión relevantes.

Restricciones

No ejecutes migraciones ni escrituras sobre la BD productiva sin mi aprobación explícita adicional.

Primero necesito un diagnóstico con evidencia, el plan de corrección, los riesgos, el respaldo necesario y el procedimiento exacto.

No borres ofertas, postulaciones, fechas, notas, perfiles ni preferencias.

No ejecutes scraping, DeepSeek, cron o despliegues productivos durante las pruebas.

No expongas contraseñas ni variables secretas.

Si hace falta cambiar código o scripts, prepará una PR para auditoría externa sin hacer merge ni cerrar la issue.

Informe final

Entregame:

- Causa raíz confirmada de cada error.
- Estado del esquema y migraciones faltantes.
- Pruebas realizadas y resultados.
- Plan seguro para reparar Railway.
- Riesgos sobre datos existentes.
- URL de PR, si hubo cambios de código.
- Qué necesita mi aprobación para completar la reparación productiva.

No des por solucionado un error de producción solo porque los tests locales pasan.

Priorizá recuperar la aplicación funcional sin pérdida de datos y sin sobreingeniería.

L2. Evidencia productiva real 2026-10-19: deployment Railway 4ca799ae-d6fe-4b4a-ae2a-2b08e2a7600b SUCCESS/master SHA BASE; logs repiten columna ausente y fallo inicial de historial. Catálogo PostgreSQL18.6 railway/public, search_path "$user",public; ledger21 filas todas exitosas hasta018, sin019–026 ni024-resultados-fuentes. Solo tablas ofertas/preferencias/evaluacion_lotes/evaluaciones_cache/schema_migrations. Faltan historial/cron y columnas modernas de ofertas. Consultas exclusivamente SELECT, no datos personales.
L3. Configuración Railway real: rootDirectory /backend, build npm install, start node src/index.js, sin preDeployCommand mostrado ni cambios staged. DATABASE_URL backend coincide exactamente con servicioPostgres; PGHOST/PGPASSWORDbackend divergen de URL, PGDATABASE/PGUSER/PGPORT coinciden. Comparación en memoria imprimió solo booleanos; nunca credenciales. App prioriza URL; runner new Pool() usa PG*. No se atribuye a esta divergencia una causa histórica no observada.
L4. Secuencia pendiente según runner: migracion-019-firma-evaluacion.sql, migracion-020-cv-base.sql, migracion-021-filtrar-nivel-linkedin.sql, migracion-022-matching-explicable-y-descripcion.sql, migracion-023-identidad-y-reapariciones.sql, migracion-024-reparar-identidades-canonicas.sql, migracion-025-identidad-conservadora.sql, migracion-026-seguimiento-postulacion.sql, migrations/024-resultados-fuentes.sql. 022 actualiza metadatosBumeran;023backfill e índice;024recalculaidentidades;025lock e identidad/URL;026fecha/notaNULL. Preservar todo dato personal y fechas originales. Runner listado actual crea ledger: NO utilizar como diagnóstico read-only productivo.
L5. MCP inicial tenía DSN de ejemplo; autorizado y corregido con resolver dinámico RailwayCLI, read-onlydefault/timeout10s/lock2s y solo herramientaSELECT expuesta. Error-sanitización RED2FAIL→GREEN3PASS; Verify independiente recheckPASS. /reload confirmado por usuario; MCP recargadoSELECTPASS. Read-onlydefault no es rolSQL de mínimos privilegios. Configuración global no forma parte de PR.
L6. Worker mvfoaxu3-2-2b2d parcial: cambio runner mínimo reutiliza pool de app, SQL original intacto; nueve archivos aplicados sintético ledger21→30, 6ofertas/preferencias preservadas, idempotencia sin cambios xmin/ledger/secuencias, historial y HTTP500/503→200 sin proveedores. REDconfirmado35PASS2FAILexit1, focused-final37PASSexit0; integración46PASS6skip;full2586PASS155skip;BD209PASS2FAIL por preparación que carecía public.ofertas para LIKE de dos tests025. Fallo conservado sin retries; una corrección de entorno sintético preparará public completo y ejecutará focal025+suiteBD, sin modificar assertions ni SQLhistórico. Nativeassess unassessable por untracked; RDDoff, requiere Verifyindependiente (también pedido usuario).
L7. Corrección de preparación mvfopm6a-3-qum6: public completo en mismaBD sintética, guard destino real127.0.0.1:55456/busca_empleos_issue56_test/PG18, plantillasvacías/secuenciaspropias. correction02533PASS;correctionDB211PASS16suites;finalfull2735PASS6skip85suitesPASS3skip, todos exit0. DiffcheckPASS. Sin nuevos cambios de código ni assertions/SQL. Logs anteriores conservados. Manifiesto6entregables correction-candidato.sha256 SHA25653e85089fecf730edc80598d4595db946a50a530dffc07ea2e6f59296f743b9e. Un soloPR por usuario; ~470líneas de cambio excluyendoODD, mayormente tests/documentación para evidencia y reparación; producciónrunner cambia a reutilizarpool (2líneas vs carga duplicada).
L8. Unidad188a7c572b250b2d72ce8411d7f835e1251d6719 creadaexit0 (7archivos558+22-). Candidatecommittednativeassesshigh/process_boundary:writerSelfVerification+independentVerifier;RDDoff no START ni revisión nativa activada. PróximoVerifyindependienteperS1-S7 y spotcheckpadre sobreSHAexacto. Trackingposterior es documental y no altera fuente candidata.
L9. Verifymvfox3vd-4-s34x: PASStécnicosinbloqueantesnuevos;37focalPASS/2suites;8probesconfigPASS;payload5visiblesde8persistidos,fecha2024-02-29/nota4000/CV/perfil/400/repeticiónPASS;pg_dump18.6/checksum/list/restoreotrasintéticaPASSpreflightconteos/ledger30/huellascoincidentes. DosprobesadicionalesFAILharness(Bumeranexpectativaincorrecta,comparadorexhaustivoMODULE_NOT_FOUND)preservados,noreintentados,nocontadosPASS. S1/S8antecedentescorroboradosporpadre(noVerify);S6/S7entregaPRpendientes. SpotcheckpadresobreSHA188a7c5:2735PASS6skip/85suitesPASS3skip/15.433s/exit0. Docs/evidencias/issue-56/verificacion.md registraSHAexacto/comandos/resultados/límites/digestslogs;logsrawlocalesignoradosnoartifactsGitHub. Solo delta documental posterior, no nuevas pruebas atribuidas a fuente diferente.
