# Base de datos — Busca Empleos

## Motor y conexión

- **Motor:** PostgreSQL (instalación local).
- **Driver:** `pg` (sin ORM — queries SQL directas).
- **Archivo de configuración:** `backend/src/config/base-datos.js`.
- **Pool de conexiones:** Se usa `Pool` de `pg` que mantiene varias conexiones abiertas y las reutiliza. Cada `pool.query()` toma una conexión libre, ejecuta y la devuelve.
- **Credenciales:** Se cargan desde `.env` con las variables `PG*` (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE). El driver `pg` las lee automáticamente. **Nota:** el runner de migraciones (`scripts/migrar.js`) carga `.env` con `path.resolve(__dirname, '../.env')` (un nivel arriba desde `backend/scripts/`), mientras que `base-datos.js` usa `path.resolve(__dirname, '../../.env')` (dos niveles arriba desde `backend/src/config/`). Ambos paths resuelven a `backend/.env`.
- **SSL en entornos remotos:** Si existe `DATABASE_URL`, si `PGSSLMODE=require` o si `PGHOST` apunta a un host no local, el backend fuerza SSL con `rejectUnauthorized: false` para ser compatible con Railway y otros PaaS.

### Eventos del pool

| Evento | Comportamiento |
|--------|---------------|
| `connect` | Log informativo — confirma que el pool funciona. |
| `error` | Log de error en conexión idle — evita que el proceso crashee. |

## Runner de migraciones

El runner (`backend/scripts/migrar.js`) automatiza la aplicación de migraciones SQL:

1. **Bootstrap automático:** Si la tabla `schema_migrations` no existe, el runner la crea automáticamente con el mismo DDL que `migracion-014-schema-migrations.sql`. No es necesario ejecutar la migración 014 manualmente.
2. Lee todos los archivos `.sql` de `backend/sql/`.
3. Filtra solo los que NO están en `schema_migrations`.
4. Los ejecuta en orden alfabético (que debe ser cronológico).
5. Registra cada migración aplicada en `schema_migrations`.

### Uso

```bash
# Mostrar migraciones pendientes
node scripts/migrar.js
# o
npm run db:migrate

# Aplicar migraciones pendientes
node scripts/migrar.js --apply
# o
npm run db:migrate:apply
```

### Comportamiento de bootstrap

- Si `schema_migrations` no existe → la crea con `CREATE TABLE IF NOT EXISTS` (DDL idéntico a migración 014) y continúa el flujo normal.
- Ya no es necesario ejecutar `migracion-014-schema-migrations.sql` manualmente.
- Si la tabla ya existe, el `CREATE TABLE IF NOT EXISTS` es no-op (idempotente).

## Schema de la tabla `ofertas`

Script de creación: `backend/sql/crear-tablas.sql` (idempotente con `IF NOT EXISTS`).

```sql
psql -U postgres -d busca_empleos -f backend/sql/crear-tablas.sql
```

### Columnas

| Columna | Tipo | Constraints | Descripción |
|---------|------|------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID auto-incremental. |
| `titulo` | VARCHAR(500) | NOT NULL | Título de la oferta. |
| `empresa` | VARCHAR(255) | — | Nombre de la empresa. |
| `ubicacion` | VARCHAR(255) | — | Ubicación geográfica. |
| `modalidad` | VARCHAR(50) | — | `'remoto'`, `'hibrido'`, `'presencial'` o null. |
| `descripcion` | TEXT | — | Descripción completa de la oferta. |
| `url` | VARCHAR(2048) | UNIQUE NOT NULL | URL original de la oferta. **Clave de deduplicación**. |
| `plataforma` | VARCHAR(50) | NOT NULL | Plataforma de origen (linkedin, computrabajo, indeed, etc.). |
| `nivel_requerido` | VARCHAR(50) | — | `'trainee'`, `'junior'`, `'semi-senior'`, `'senior'` o null. |
| `salario_min` | NUMERIC | — | Salario mínimo (null si no se publica). |
| `salario_max` | NUMERIC | — | Salario máximo (null si no se publica). |
| `moneda` | VARCHAR(10) | — | `'ARS'`, `'USD'`, `'EUR'` o null. |
| `estado_evaluacion` | VARCHAR(20) | DEFAULT `'pendiente'` | `'pendiente'`, `'aprobada'` o `'rechazada'`. |
| `razon_evaluacion` | TEXT | — | Razón que dio DeepSeek para aprobar o rechazar. |
| `porcentaje_match` | INTEGER | — | Porcentaje de match (0-100) asignado por DeepSeek. |
| `estado_postulacion` | VARCHAR(30) | DEFAULT `'no_postulado'` | `'no_postulado'`, `'cv_enviado'`, `'en_proceso'`, `'descartada'`. |
| `fecha_publicacion` | TIMESTAMP | — | Fecha de publicación de la oferta (puede ser null). |
| `fecha_extraccion` | TIMESTAMP | DEFAULT `NOW()` | Fecha en que el sistema extrajo la oferta. |
| `datos_crudos` | JSONB | — | JSON original de Apify sin procesar. JSONB permite queries internas y ocupa menos espacio. |
| `fecha_evaluacion` | TIMESTAMP | DEFAULT NULL | Momento en que la IA evaluó la oferta. Backfill: se copia `fecha_extraccion` para ofertas ya evaluadas. Migración 005. |
| `evaluacion_error_mensaje` | TEXT | — | Mensaje de error si la API de DeepSeek falló al evaluar. Separa errores técnicos de `razon_evaluacion`. Migración 008b. |

### Constraints activas

| Constraint | Columna(s) | Condición | Migración |
|------------|-----------|----------|-----------|
| `chk_ofertas_estado_evaluacion` | `estado_evaluacion` | NULL o IN ('pendiente', 'aprobada', 'rechazada') | 013 |
| `chk_ofertas_estado_postulacion` | `estado_postulacion` | NULL o IN ('no_postulado', 'cv_enviado', 'en_proceso', 'descartada') | 013 |
| `chk_ofertas_porcentaje_match` | `porcentaje_match` | NULL o entre 0 y 100 | 013 |
| `chk_ofertas_salario_rango` | `salario_min`, `salario_max` | NULL o salario_min <= salario_max | 017 |

> **Nota:** La constraint `chk_ofertas_score_previo` fue eliminada en la migración 016 (scoring legacy).

### Índices

| Índice | Columna | Propósito | Migración |
|--------|---------|----------|-----------|
| `idx_ofertas_estado_evaluacion` | `estado_evaluacion` | Filtrado por estado | crear-tablas |
| `idx_ofertas_plataforma` | `plataforma` | Filtrado por plataforma | crear-tablas |
| `idx_ofertas_porcentaje_match` | `porcentaje_match DESC NULLS LAST` | Ranking por match | crear-tablas |
| `idx_ofertas_estado_postulacion` | `estado_postulacion` | Filtrado por postulación | crear-tablas |
| `idx_ofertas_fecha_extraccion_desc` | `fecha_extraccion DESC` | Listado por fecha | 015 |
| `idx_ofertas_estado_fecha_extraccion` | `(estado_evaluacion, fecha_extraccion DESC)` | Filtrado por estado + fecha | 015 |
| `idx_ofertas_fecha_evaluacion` | `fecha_evaluacion DESC NULLS LAST` | Reseteo de evaluaciones por fecha | 005 |

> **Nota:** El índice legacy `idx_ofertas_score_previo` fue eliminado en la migración 016.

### Deduplicación

- La columna `url` tiene constraint `UNIQUE`.
- Los INSERT usan `ON CONFLICT (url) DO NOTHING`: si la URL ya existe, se ignora silenciosamente sin error.
- `crearOferta()` retorna `null` si fue duplicada, o el objeto insertado si es nueva.

## Tabla `preferencias`

Script de creación: `backend/sql/migracion-003-preferencias.sql` (idempotente con `IF NOT EXISTS`).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | SERIAL | PRIMARY KEY | Siempre 1 (single-row). |
| `nombre` | VARCHAR(255) | — | Nombre del candidato. |
| `nivel_experiencia` | VARCHAR(50) | `'junior'` | Nivel de experiencia. |
| `perfil_profesional` | TEXT | — | Descripción libre del perfil. |
| `stack_tecnologico` | TEXT[] | `'{}'` | Tecnologías que maneja (array nativo de PostgreSQL). |
| `modalidad_aceptada` | VARCHAR(50) | `'cualquiera'` | Modalidad de trabajo aceptada. |
| `zonas_preferidas` | TEXT[] | `'{}'` | Zonas donde acepta trabajar presencial. |
| `terminos_busqueda` | TEXT[] | `'{}'` | Palabras clave para búsqueda en Apify. |
| `reglas_exclusion` | TEXT[] | `'{}'` | Términos que excluyen automáticamente. |
| `prompt_personalizado` | TEXT | — | Prompt personalizado para la IA. |
| `usar_prompt_personalizado` | BOOLEAN | FALSE | Si TRUE, usa prompt_personalizado en vez del auto-generado. |
| `modelo_ia` | VARCHAR(100) | `'deepseek-v4-flash'` | Modelo de DeepSeek para evaluación. |
| `idioma_candidato` | TEXT | `'Español nativo, Inglés básico oral / intermedio escrito'` | Declaración de nivel de idioma en texto libre. Migración 004. |
| `tecnologias_detalle` | JSONB | `'[]'` | Lista de tecnologías con nivel, categoría, aliases e importancia. Migración 008. |
| `roles_objetivo_detalle` | JSONB | `'[]'` | Lista de roles buscados con prioridad (alta/media/baja). Migración 008. |
| `preguntas_perfil_pendientes` | JSONB | `'[]'` | Preguntas sugeridas por la IA al importar CV. Migración 008. |
| `fecha_importacion_cv` | TIMESTAMP | NULL | Fecha de importación del CV. Migración 008. |
| `modelo_ia_evaluacion` | VARCHAR(100) | `'deepseek-v4-flash'` | Modelo de IA para evaluación (separado del de importación). Migración 010b. |
| `modelo_ia_importacion` | VARCHAR(100) | `'deepseek-v4-pro'` | Modelo de IA para importación de CV. Migración 010b. |
| `disponibilidad` | VARCHAR(50) | `'full_time'` | Disponibilidad horaria. Migración 010b. |
| `expectativa_salarial_min` | NUMERIC | NULL | Expectativa salarial mínima. Migración 010b. |
| `expectativa_salarial_max` | NUMERIC | NULL | Expectativa salarial máxima. Migración 010b. |
| `moneda_salarial` | VARCHAR(10) | `'NO_FILTRAR'` | Moneda para el filtro salarial. Migración 010b. |
| `nivel_ingles_detalle` | JSONB | Ver migración 010b | Detalle de nivel de inglés por habilidad (reading, writing, speaking, listening). Migración 010b. |
| `keywords_positivas` | TEXT[] | `'{}'` | Keywords que bonifican la oferta. Migración 010b. |
| `keywords_negativas` | TEXT[] | `'{}'` | Keywords que penalizan la oferta. Migración 010b. |
| `plataformas_preferidas` | TEXT[] | `'{}'` | Plataformas de búsqueda preferidas. Migración 010b. |
| `plataformas_excluidas` | TEXT[] | `'{}'` | Plataformas excluidas de búsqueda. Migración 010b. |
| `max_caracteres_descripcion_ia` | INTEGER | 2500 | Límite de caracteres para la descripción enviada a la IA. Migración 010b. |
| `temperatura_evaluacion` | NUMERIC | 0 | Temperatura del modelo para evaluación. Migración 010b. |
| `temperatura_importacion` | NUMERIC | 0 | Temperatura del modelo para importación. Migración 010b. |
| `backup_preferencias` | JSONB | NULL | Backup de preferencias antes de cada actualización. Migración 010b. |
| `nivel_real_seniority` | VARCHAR(100) | Ver migración 011 | Nivel de seniority honesto del candidato. Migración 011. |
| `conocimientos_ausentes` | TEXT[] | `'{}'` | Tecnologías/conceptos que NO maneja el candidato. Migración 011. |
| `limitaciones_explicitas` | TEXT | `''` | Descripción libre de lo que el candidato no puede hacer. Migración 011. |
| `anios_experiencia_reales` | INTEGER | 1 | Años reales de experiencia del candidato. Migración 012. |
| `fecha_creacion` | TIMESTAMP | `NOW()` | Fecha de creación. |
| `fecha_actualizacion` | TIMESTAMP | `NOW()` | Fecha de última actualización. |

> La columna `scoring_config` (migración 008, migración 010b con backfill) fue eliminada en la migración 016 (scoring legacy).

## Tabla `evaluaciones_cache`

Script de creación: `backend/sql/migracion-009-cache-evaluaciones.sql` (idempotente).

| Columna | Tipo | Constraints | Descripción |
|---------|------|------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID auto-incremental. |
| `hash_oferta` | TEXT | NOT NULL | Hash SHA-256 del contenido normalizado de la oferta. |
| `hash_preferencias` | TEXT | NOT NULL | Hash SHA-256 de las preferencias del usuario. |
| `modelo_ia` | VARCHAR(100) | NOT NULL | Modelo de IA usado para la evaluación. |
| `resultado` | JSONB | NOT NULL | Resultado completo de la evaluación. |
| `creado_en` | TIMESTAMP | DEFAULT NOW() | Fecha de creación del cache. |

**Constraint única:** `UNIQUE (hash_oferta, hash_preferencias, modelo_ia)` — evita duplicados de evaluación para la misma oferta + preferencias + modelo.

## Tabla `evaluacion_lotes`

Script de creación: `backend/sql/migracion-010-lotes-evaluacion.sql` (idempotente).

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID del lote. |
| `estado` | VARCHAR(30) | `'activo'` | Estado del lote (`activo`, `completado`, `error`). |
| `total` | INTEGER | 0 | Total de ofertas en el lote. |
| `evaluadas` | INTEGER | 0 | Ofertas ya evaluadas. |
| `aprobadas` | INTEGER | 0 | Ofertas aprobadas. |
| `rechazadas` | INTEGER | 0 | Ofertas rechazadas. |
| `errores` | INTEGER | 0 | Errores durante la evaluación. |
| `porcentaje` | INTEGER | 0 | Progreso del lote (0-100). |
| `modelo_ia` | VARCHAR(100) | — | Modelo de IA usado. |
| `creado_en` | TIMESTAMP | NOW() | Fecha de creación. |
| `actualizado_en` | TIMESTAMP | NOW() | Fecha de última actualización. |
| `finalizado_en` | TIMESTAMP | — | Fecha de finalización (null si activo). |

## Tabla `schema_migrations`

Script de creación: migración 014 + bootstrap automático del runner.

| Columna | Tipo | Constraints | Descripción |
|---------|------|------------|-------------|
| `id` | VARCHAR(255) | PRIMARY KEY | Nombre del archivo SQL (ej: `migracion-014-schema-migrations.sql`). |
| `aplicado_en` | TIMESTAMP | DEFAULT NOW() | Momento en que se aplicó la migración. |
| `exitoso` | BOOLEAN | DEFAULT true | Si la migración se aplicó correctamente. |

> **Bootstrap:** El runner crea esta tabla automáticamente con `CREATE TABLE IF NOT EXISTS` si no existe. No es necesario ejecutar la migración 014 manualmente.

## Modelo de datos (oferta.js)

Archivo: `backend/src/modelos/oferta.js`. Funciones CRUD con queries SQL parametrizadas.

### Funciones

| Función | Query | Descripción |
|---------|-------|-------------|
| `crearOferta(datos)` | INSERT con ON CONFLICT | Inserta una oferta. Retorna el objeto insertado o `null` si era duplicada. |
| `obtenerOfertas(filtros)` | SELECT con WHERE dinámico | Lista ofertas. Filtros opcionales: `estado` y `plataforma`. Orden: `fecha_extraccion DESC`. |
| `obtenerOfertaPorId(id)` | SELECT WHERE id=$1 | Retorna una oferta por ID, o `null` si no existe. |
| `obtenerOfertasPendientes()` | SELECT WHERE estado='pendiente' | Lista ofertas no evaluadas. Usado por el servicio de evaluación. |
| `actualizarEvaluacion(id, estado, razon, porcentaje)` | UPDATE SET estado, razon, porcentaje_match | Actualiza el resultado de la evaluación IA (incluye porcentaje 0-100). Retorna la oferta actualizada o `null`. |
| `actualizarPostulacion(id, estadoPostulacion)` | UPDATE SET estado_postulacion | Cambia el estado de postulación de una oferta. Retorna la oferta actualizada o `null`. |
| `obtenerEstadisticas()` | SELECT COUNT GROUP BY estado WHERE fecha ≥ 30 días | Retorna `{ total, pendientes, aprobadas, rechazadas }` por `estado_evaluacion`, **solo de los últimos 30 días** (filtro por `fecha_extraccion`). Consistente con `obtenerOfertas()`. |

### Firma de `crearOferta`

Recibe un objeto con los campos de la tabla (sin `id`, `estado_evaluacion`, `fecha_extraccion`). Los valores null se manejan con `|| null` para campos opcionales.

```javascript
crearOferta({
    titulo, empresa, ubicacion, modalidad, descripcion,
    url, plataforma, nivel_requerido,
    salario_min, salario_max, moneda,
    fecha_publicacion, datos_crudos
})
```

### Filtros dinámicos en `obtenerOfertas`

La query se construye dinámicamente. Si vienen filtros, se agregan condiciones con `AND`:

```javascript
// Sin filtros → SELECT * FROM ofertas ORDER BY ...
// Con estado → SELECT * FROM ofertas WHERE estado_evaluacion = $1 ORDER BY ...
// Con ambos → SELECT * FROM ofertas WHERE estado_evaluacion = $1 AND plataforma = $2 ORDER BY ...
```

## Seguridad

- **Queries parametrizadas** ($1, $2, etc.) en todas las funciones. Los valores se pasan como array separado de la query. PostgreSQL los trata como datos, no como SQL ejecutable. Esto previene SQL Injection.
- **Nunca se concatenan valores** en las queries (ni template literals ni string concatenation).
- **Ordenamiento seguro:** `obtenerOfertas()` usa una whitelist de columnas permitidas para el ORDER BY. Si se recibe un nombre de columna no válido, se ignora y se usa el orden por defecto (`fecha_extraccion DESC`). Esto previene SQL injection en la cláusula ORDER BY.

### Tests destructivos — Triple guarda

Los tests que hacen `TRUNCATE` sobre tablas (modelos de oferta y preferencia) tienen **tres capas de protección** para evitar destruir datos de producción:

| Guarda | Qué verifica | Dónde |
|--------|--------------|-------|
| `ALLOW_DB_TESTS=true` | Flag explícito para habilitar tests destructivos | Variable de entorno |
| `NODE_ENV=test` o `PGDATABASE` contenga `test` | El entorno o el nombre de BD sugieren que es test | Variable de entorno |
| `asegurarBaseDeDatosDeTest(pool)` | La BD **real** conectada termina en `_test` | Query `SELECT current_database()` en runtime |

La tercera guarda es la más importante: si `DATABASE_URL` apunta a producción, las variables de entorno mienten. La verificación runtime consulta la BD real y lanza un error descriptivo antes de ejecutar cualquier `TRUNCATE`.

**Cómo correr los tests destructivos:**

```bash
# Con npm script (recomendado):
npm run test:db

# Manual en Linux/Mac:
ALLOW_DB_TESTS=true NODE_ENV=test npx jest tests/modelos --verbose --runInBand

# Manual en PowerShell:
$env:ALLOW_DB_TESTS="true"; $env:NODE_ENV="test"; npx jest tests/modelos --verbose --runInBand
```

**Archivo de ejemplo:** `backend/.env.test.example` tiene las variables necesarias sin secretos reales.

**Helper:** `backend/tests/helpers/test-db-guard.js` exporta `asegurarBaseDeDatosDeTest(pool)`.

## Migraciones

### Lista completa

| # | Script | Descripción | Tipo |
|---|--------|-------------|------|
| — | `crear-tablas.sql` | Creación inicial de la tabla `ofertas` con índices. Idempotente con `IF NOT EXISTS`. | Base |
| 002 | `migracion-002-postulacion-y-porcentaje.sql` | Agrega columnas `porcentaje_match` y `estado_postulacion` con índices. Idempotente. | Aditiva |
| 003 | `migracion-003-preferencias.sql` | Crea la tabla `preferencias` con valores iniciales. Idempotente. | Aditiva |
| 004 | `migracion-004-idioma.sql` | Agrega la columna `idioma_candidato`. | Aditiva |
| 005 | `migracion-005-fecha-evaluacion.sql` | Agrega `fecha_evaluacion` e índice para reseteos. | Aditiva |
| 006 | `migracion-006-actualizar-perfil.sql` | Actualiza perfil, idioma y stack del candidato. | Datos |
| 007 | `migracion-007-modelo-deepseek-v4-flash.sql` | Cambia el modelo por defecto y migra preferencias existentes a `deepseek-v4-flash`. | Datos |
| 008 | `migracion-008-preferencias-detalladas.sql` | Agrega columnas de preferencias detalladas a la tabla `preferencias`. | Aditiva |
| 008b | `migracion-008-error-evaluacion.sql` | Agrega columna `evaluacion_error_mensaje` a `ofertas`. | Aditiva |
| 009 | `migracion-009-cache-evaluaciones.sql` | Crea la tabla `evaluaciones_cache`. | Aditiva |
| 009b | `migracion-009-scoring-previo.sql` | Agrega columnas `score_previo`, `analisis_previo`, `scoring_version` a `ofertas`. | Aditiva |
| 010 | `migracion-010-lotes-evaluacion.sql` | Crea la tabla `evaluacion_lotes`. | Aditiva |
| 010b | `migracion-010-preferencias-ui-completa.sql` | Agrega columnas de preferencias UI y `scoring_config`. | Aditiva |
| 011 | `migracion-011-perfil-ampliado.sql` | Agrega columnas `nivel_real_seniority`, `conocimientos_ausentes` y `limitaciones_explicitas` a `preferencias`. | Aditiva |
| 012 | `migracion-012-anios-experiencia-reales.sql` | Agrega columna `anios_experiencia_reales` a `preferencias` (default: 1). | Aditiva |
| 013 | `migracion-013-constraints-integridad.sql` | Constraints `chk_ofertas_estado_evaluacion`, `chk_ofertas_estado_postulacion`, `chk_ofertas_porcentaje_match`, `chk_ofertas_score_previo`. | Aditiva |
| 014 | `migracion-014-schema-migrations.sql` | Crea la tabla `schema_migrations`. También creada automáticamente por el runner. | Aditiva |
| 015 | `migracion-015-indices-ofertas-ultimos-30-dias.sql` | Índices `idx_ofertas_fecha_extraccion_desc` y `idx_ofertas_estado_fecha_extraccion`. | Aditiva |
| 016 | `migracion-016-eliminar-scoring-legacy.sql` | ⚠️ **Destructiva** — Elimina objetos legacy de scoring: índice, constraint y columnas (`score_previo`, `analisis_previo`, `scoring_version`, `scoring_config`). Usa `IF EXISTS` en todos los drops. | Destructiva |
| 017 | `migracion-017-salario-rango.sql` | Agrega constraint `chk_ofertas_salario_rango` (salario_min <= salario_max cuando ambos no son NULL). Preflight de filas inválidas; si hay, la migración falla antes de crear la constraint. | Aditiva |

### Gotchas

- **Números duplicados:** Hay dos migraciones 008 (`migracion-008-preferencias-detalladas.sql` y `migracion-008-error-evaluacion.sql`) y dos migraciones 009 (`migracion-009-cache-evaluaciones.sql` y `migracion-009-scoring-previo.sql`). El runner las procesa en orden alfabético, que coincide con el orden cronológico porque los sufijos desambiguan. **No renombrar migraciones ya aplicadas** — rompería el tracking en `schema_migrations`.
- **Migración 016 — Destructiva:** Elimina columnas e índices legacy de scoring. Los datos contenidos en `score_previo`, `analisis_previo`, `scoring_version` y `scoring_config` se pierden de forma irreversible. No hay rollback automático para `DROP COLUMN`.
- **Migración 017 — Preflight:** Antes de crear la constraint de rango salarial, la migración cuenta filas donde `salario_min > salario_max` (ambos no NULL). Si hay filas inválidas, la migración falla con un mensaje descriptivo indicando cuántas filas hay que corregir. No modifica datos.
- **Migración 018 — Prioridad IA:** Es aditiva e idempotente. Agrega campos de señal y evidencia a `ofertas`, y la preferencia desactivada por defecto en `preferencias`; no reescribe match, porcentajes ni exclusiones.

### Rollback

| Migración | Comando de rollback |
|-----------|---------------------|
| 017 | `ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_salario_rango;` |
| 016 | No hay rollback automático. Restaurar desde backup o recrear columnas manualmente. |
| 014-015 | Los índices y tablas se pueden eliminar con `DROP INDEX IF EXISTS` / `DROP TABLE IF EXISTS`. |
| Runner | Revertir `migrar.js` al commit anterior. La tabla `schema_migrations` creada por bootstrap es compatible y esperada. |
| 018 | Desactivar `priorizar_ofertas_ia`; las columnas y evidencias se conservan. |

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del sistema.
- [API REST](api-rest.md) — Endpoints que consumen el modelo.
- [Scraping](scraping.md) — Cómo llegan los datos a la BD.
- [Evaluación IA](evaluacion-ia.md) — Cómo se actualiza `estado_evaluacion`.
