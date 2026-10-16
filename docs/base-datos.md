# Persistencia de resultados y cron — issue #20

Documento el agregado de `backend/migrations/024-resultados-fuentes.sql`.
El runner `backend/scripts/migrar.js` conserva las migraciones de `sql/` y luego
procesa `migrations/`, registrándolas en `schema_migrations`.

## Ejecuciones recientes

`ejecuciones_busqueda` guarda `id BIGSERIAL`, `tipo` (`individual`, `ciclo_manual`,
`cron`), `inicio` y `fin TIMESTAMPTZ`, `estado` y `resumen JSONB` sanitizado.
Inicio antes de consultar proveedores y finalizo sólo filas aún `ejecutando`.
Al arrancar marco pendientes como `interrumpida`; una respuesta tardía no las convierte
en éxito. Retengo las últimas 20 finalizadas más las actualmente en curso y vuelvo a
acotar al reiniciar. No dependo del filesystem efímero de Railway.

En el resumen permito estados, consultas acotadas, contadores numéricos y tipos/códigos
HTTP de errores. Excluyo ofertas, descripciones, preferencias, credenciales y textos
de error de proveedores o PostgreSQL. La duración se calcula desde inicio/fin; las
fuentes conservan además sus duraciones medidas. No guardo atribución de evaluación IA
por fuente ni relaciones nuevas entre lotes.

## Decisión explícita del cron

`configuracion_cron` admite una única fila (`id = 1`): `activo BOOLEAN`,
`expresion_cron TEXT`, `zona_horaria TEXT` y `actualizado_en TIMESTAMPTZ`.
No inserto activación predeterminada. La zona permitida es
`America/Argentina/Buenos_Aires`. Las escrituras usan parámetros; la rehidratación
valida la decisión antes de programar. Una decisión ausente, inactiva, inválida o
ilegible no activa tareas ni ejecuta búsquedas atrasadas.

## Verificación aislada

`tests/integracion/issue-20-historial-postgres.test.js` exige `ISSUE20_TEST_DSN`
explícito al servidor local `127.0.0.1:55420`, usuario sintético `marcos` y base
`busca_empleos_issue20_test`. Verifico identidad del servidor y base antes del DDL;
uso `DB_TEST_SINTETICA` y el pool existente sin cargar archivos de entorno.
Compruebo migración idempotente, retención, sanitización, lectura después de recrear
el pool y protección frente a finalizaciones tardías. No ejecuto suites de integración
ajenas ni proveedores/cron reales.
