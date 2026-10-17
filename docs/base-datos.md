# Persistencia de resultados y seguimiento

## Seguimiento de postulaciones — issue #22

Agrego `backend/sql/migracion-026-seguimiento-postulacion.sql`, sin colisión con
`backend/migrations/`. Es aditiva e idempotente: `fecha_postulacion DATE NULL`,
`nota_postulacion TEXT NULL` y restricción de hasta 4000 caracteres. No ejecuto
backfill ni valores predeterminados: fechas históricas desconocidas quedan `NULL`.
El runner actual la aplica dentro de su transacción habitual.

Proyecto la fecha manual como `to_char(fecha_postulacion, 'YYYY-MM-DD')` en las
lecturas del dashboard y respuestas de edición; no cambio parsers globales de `pg`.
Conservo extracción, evaluación y cachés al modificar seguimiento personal.

### Recorrido PostgreSQL sintético #22

`backend/tests/integracion/issue-22-seguimiento.test.js` queda opt-in mediante
`ISSUE22_TEST_DSN`, con `NODE_ENV=test`. Exijo host loopback, base exacta
`busca_empleos_issue22_test`, sin parámetros ni fragmentos en el DSN, SSL desactivado
y verificación de servidor/base antes de escribir. El padre debe proporcionar
la configuración de esa base **descartable**, con `public.ofertas` migrada hasta 025
(o posterior) y un usuario con permiso de crear esquemas/tablas. No uso `.env`.

Creo un esquema sintético independiente, clono la estructura de ofertas, aplico 026
dos veces y verifico persistencia, fechas, visibilidad, conteo, cursor, rechazo HTTP
sin cambios, estado masivo y reaparición. Conservo ese esquema para diagnóstico;
no limpio ni destruyo datos ajenos. No llamo proveedores. Sin DSN, omito el recorrido.
La prueba no reemplaza el recorrido Angular ni demuestra ejecución si fue omitida.
Exijo `server_encoding=UTF8`; además de comparar los datos leídos, verifico hash
completo de fila y `xmin` idénticos después de cada rechazo HTTP. El límite Unicode
acepta exactamente 4000 letras `ñ` (8000 bytes UTF8) y rechaza 4001 sin escribir.

### Recorrido continuo PostgreSQL → Angular #22

```bash
NODE_ENV=test ISSUE22_TEST_DSN=postgresql://issue22@127.0.0.1:55423/busca_empleos_issue22_test ISSUE22_VERTICAL=1 CHROME_BIN=/usr/bin/google-chrome npm --prefix backend test -- --runInBand tests/integracion/issue-22-vertical.test.js
```

Exijo ese usuario, host, puerto y base local descartable, UTF8 y estructura pública
migrada hasta 026. Creo un esquema único con ofertas, preferencias y secuencia propia;
no uso datos públicos ni destruyo esquemas. Jest inicia Express en `127.0.0.1:43194`
y Karma/Chrome en 9876, con nonce de identidad y cierre esperado al terminar.
Sin `ISSUE22_VERTICAL=1`, el recorrido queda explícitamente omitido.

Sólo sustituyo la verificación del token Firebase; el pool, SQL, modelos, controladores,
rutas de ofertas, HttpClient, componentes Angular e IndexedDB son reales. La misma
oferta sintética de 45 días con CV enviado y rechazo IA atraviesa guardado de fecha/nota,
sincronización, lectura desde otro servicio IndexedDB, destrucción/recreación de
componente e inyector, cambio rápido a `en_proceso` por DOM y reaparición por el upsert
real. El control de reaparición existe sólo en el harness loopback; no agrego endpoints
productivos ni llamo APIs externas. El panel ajeno al recorrido no tiene rutas de
proveedores/cron montadas en este servidor de pruebas.

## Persistencia de resultados y cron — issue #20

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
