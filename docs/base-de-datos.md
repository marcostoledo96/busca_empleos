# Base de datos — Busca Empleos

## Motor y conexión

- **Motor:** PostgreSQL (instalación local).
- **Driver:** `pg` (sin ORM — queries SQL directas).
- **Archivo de configuración:** `backend/src/config/base-datos.js`.
- **Pool de conexiones:** Se usa `Pool` de `pg` que mantiene varias conexiones abiertas y las reutiliza. Cada `pool.query()` toma una conexión libre, ejecuta y la devuelve.
- **Credenciales:** Se cargan desde `.env` con las variables `PG*` (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE). El driver `pg` las lee automáticamente.
- **SSL en entornos remotos:** Si existe `DATABASE_URL`, si `PGSSLMODE=require` o si `PGHOST` apunta a un host no local, el backend fuerza SSL con `rejectUnauthorized: false` para ser compatible con Railway y otros PaaS.

### Eventos del pool

| Evento | Comportamiento |
|--------|---------------|
| `connect` | Log informativo — confirma que el pool funciona. |
| `error` | Log de error en conexión idle — evita que el proceso crashee. |

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
| `plataforma` | VARCHAR(50) | NOT NULL | `'linkedin'` o `'computrabajo'`. |
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

### Índices

| Índice | Columna | Propósito |
|--------|---------|----------|
| `idx_ofertas_estado_evaluacion` | `estado_evaluacion` | Acelerar filtrado por estado (pendiente/aprobada/rechazada). |
| `idx_ofertas_plataforma` | `plataforma` | Acelerar filtrado por plataforma (linkedin/computrabajo). |
| `idx_ofertas_porcentaje_match` | `porcentaje_match` | Acelerar ordenamiento por porcentaje de match. |
| `idx_ofertas_estado_postulacion` | `estado_postulacion` | Acelerar filtrado por estado de postulación. |

### Deduplicación

- La columna `url` tiene constraint `UNIQUE`.
- Los INSERT usan `ON CONFLICT (url) DO NOTHING`: si la URL ya existe, se ignora silenciosamente sin error.
- `crearOferta()` retorna `null` si fue duplicada, o el objeto insertado si es nueva.

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
| `obtenerEstadisticas()` | SELECT COUNT GROUP BY estado | Retorna `{ total, pendientes, aprobadas, rechazadas }` por `estado_evaluacion`. Disponible para diagnósticos o consumidores que necesiten ese agregado bruto. |

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

## Migraciones

| Script | Descripción |
|--------|-------------|
| `backend/sql/crear-tablas.sql` | Creación inicial de la tabla (idempotente). |
| `backend/sql/migracion-002-postulacion-y-porcentaje.sql` | Agrega columnas `porcentaje_match` y `estado_postulacion` con índices. Idempotente. |
| `backend/sql/migracion-003-preferencias.sql` | Crea la tabla `preferencias` con valores iniciales. |
| `backend/sql/migracion-004-idioma.sql` | Agrega la columna `idioma_candidato`. |
| `backend/sql/migracion-005-fecha-evaluacion.sql` | Agrega `fecha_evaluacion` e índice para reseteos. |
| `backend/sql/migracion-006-actualizar-perfil.sql` | Actualiza perfil, idioma y stack del candidato. |
| `backend/sql/migracion-007-modelo-deepseek-v4-flash.sql` | Cambia el modelo por defecto y migra preferencias existentes a `deepseek-v4-flash`. |

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del sistema.
- [API REST](api-rest.md) — Endpoints que consumen el modelo.
- [Scraping](scraping.md) — Cómo llegan los datos a la BD.
- [Evaluación IA](evaluacion-ia.md) — Cómo se actualiza `estado_evaluacion`.
