# 06 — Base de Datos: Esquema, Migraciones e Índices

## Motor y driver

- **Motor**: PostgreSQL
- **Driver**: `pg` 8.20.0 (sin ORM — queries SQL directas)
- **Conexión**: Pool con reutilización de conexiones
- **SSL**: Auto-activa en Railway/producción (`rejectUnauthorized: false` para PaaS)

---

## Tabla: `ofertas` (tabla principal)

| Columna | Tipo | Constraints | Default |
|---------|------|------------|---------|
| `id` | `SERIAL` | `PRIMARY KEY` | auto |
| `titulo` | `VARCHAR(500)` | `NOT NULL` | — |
| `empresa` | `VARCHAR(255)` | — | — |
| `ubicacion` | `VARCHAR(255)` | — | — |
| `modalidad` | `VARCHAR(50)` | — | — |
| `descripcion` | `TEXT` | — | — |
| `url` | `VARCHAR(2048)` | `UNIQUE NOT NULL` | — |
| `plataforma` | `VARCHAR(50)` | `NOT NULL` | — |
| `nivel_requerido` | `VARCHAR(50)` | — | — |
| `salario_min` | `NUMERIC` | — | — |
| `salario_max` | `NUMERIC` | — | — |
| `moneda` | `VARCHAR(10)` | — | — |
| `estado_evaluacion` | `VARCHAR(20)` | — | `'pendiente'` |
| `razon_evaluacion` | `TEXT` | — | — |
| `porcentaje_match` | `INTEGER` | — | — |
| `estado_postulacion` | `VARCHAR(30)` | — | `'no_postulado'` |
| `fecha_publicacion` | `TIMESTAMP` | — | — |
| `fecha_extraccion` | `TIMESTAMP` | — | `NOW()` |
| `fecha_evaluacion` | `TIMESTAMP` | — | — |
| `evaluacion_error_mensaje` | `TEXT` | — | — |
| `score_previo` | `INTEGER` | — | — |
| `analisis_previo` | `JSONB` | — | — |
| `scoring_version` | `VARCHAR(50)` | — | `'p3_p5_v1'` |
| `datos_crudos` | `JSONB` | — | — |

### Índices en `ofertas`

| Índice | Columna(s) |
|--------|-----------|
| `idx_ofertas_estado_evaluacion` | `estado_evaluacion` |
| `idx_ofertas_plataforma` | `plataforma` |
| `idx_ofertas_estado_postulacion` | `estado_postulacion` |
| `idx_ofertas_porcentaje_match` | `porcentaje_match DESC NULLS LAST` |
| `idx_ofertas_fecha_evaluacion` | `fecha_evaluacion DESC NULLS LAST` |
| `idx_ofertas_score_previo` | `score_previo DESC NULLS LAST` |

### Mecanismo de deduplicación
`UNIQUE(url)` + `ON CONFLICT (url) DO NOTHING` en el INSERT.
LinkedIn además canoniza URLs (remueve query params y fragments).

---

## Tabla: `preferencias` (single-row, id=1)

| Columna | Tipo | Default |
|---------|------|---------|
| `id` | `SERIAL` `PRIMARY KEY` | 1 |
| `nombre` | `VARCHAR(255)` | — |
| `nivel_experiencia` | `VARCHAR(50)` | `'junior'` |
| `perfil_profesional` | `TEXT` | — |
| `idioma_candidato` | `TEXT` | español nativo, inglés básico |
| `stack_tecnologico` | `TEXT[]` | `'{}'` |
| `modalidad_aceptada` | `VARCHAR(50)` | `'cualquiera'` |
| `zonas_preferidas` | `TEXT[]` | `'{}'` |
| `terminos_busqueda` | `TEXT[]` | `'{}'` |
| `reglas_exclusion` | `TEXT[]` | `'{}'` |
| `prompt_personalizado` | `TEXT` | — |
| `usar_prompt_personalizado` | `BOOLEAN` | `FALSE` |
| `modelo_ia` | `VARCHAR(100)` | `'deepseek-v4-flash'` |
| `modelo_ia_evaluacion` | `VARCHAR(100)` | `'deepseek-v4-flash'` |
| `modelo_ia_importacion` | `VARCHAR(100)` | `'deepseek-v4-pro'` |
| `tecnologias_detalle` | `JSONB` | `'[]'` |
| `roles_objetivo_detalle` | `JSONB` | `'[]'` |
| `scoring_config` | `JSONB` | objeto con umbrales |
| `preguntas_perfil_pendientes` | `JSONB` | `'[]'` |
| `disponibilidad` | `VARCHAR(50)` | `'full_time'` |
| `expectativa_salarial_min` | `NUMERIC` | — |
| `expectativa_salarial_max` | `NUMERIC` | — |
| `moneda_salarial` | `VARCHAR(10)` | `'NO_FILTRAR'` |
| `nivel_ingles_detalle` | `JSONB` | 5 skills + regla |
| `keywords_positivas` | `TEXT[]` | `'{}'` |
| `keywords_negativas` | `TEXT[]` | `'{}'` |
| `plataformas_preferidas` | `TEXT[]` | `'{}'` |
| `plataformas_excluidas` | `TEXT[]` | `'{}'` |
| `max_caracteres_descripcion_ia` | `INTEGER` | `2500` |
| `temperatura_evaluacion` | `NUMERIC` | `0` |
| `temperatura_importacion` | `NUMERIC` | `0` |
| `backup_preferencias` | `JSONB` | — |
| `nivel_real_seniority` | `VARCHAR(100)` | — |
| `conocimientos_ausentes` | `TEXT[]` | `'{}'` |
| `limitaciones_explicitas` | `TEXT` | — |
| `anios_experiencia_reales` | `INTEGER` | `1` |
| `fecha_creacion` | `TIMESTAMP` | `NOW()` |
| `fecha_actualizacion` | `TIMESTAMP` | `NOW()` |
| `fecha_importacion_cv` | `TIMESTAMP` | — |

---

## Tablas auxiliares

### `evaluaciones_cache`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PRIMARY KEY` | — |
| `hash_oferta` | `TEXT NOT NULL` | SHA-256 del contenido normalizado |
| `hash_preferencias` | `TEXT NOT NULL` | SHA-256 de preferencias relevantes |
| `modelo_ia` | `VARCHAR(100) NOT NULL` | Modelo usado |
| `resultado` | `JSONB NOT NULL` | Resultado completo de evaluación |
| `creado_en` | `TIMESTAMP DEFAULT NOW()` | — |

**UNIQUE**: `(hash_oferta, hash_preferencias, modelo_ia)`

### `evaluacion_lotes`
| Columna | Tipo | Default |
|---------|------|---------|
| `id` | `SERIAL PRIMARY KEY` | — |
| `estado` | `VARCHAR(30)` | `'activo'` |
| `total` | `INTEGER` | `0` |
| `evaluadas` | `INTEGER` | `0` |
| `aprobadas` | `INTEGER` | `0` |
| `rechazadas` | `INTEGER` | `0` |
| `errores` | `INTEGER` | `0` |
| `porcentaje` | `INTEGER` | `0` |
| `modelo_ia` | `VARCHAR(100)` | — |
| `creado_en` | `TIMESTAMP` | `NOW()` |
| `actualizado_en` | `TIMESTAMP` | `NOW()` |
| `finalizado_en` | `TIMESTAMP` | — |

---

## Migraciones SQL (15 archivos en `backend/sql/`)

| # | Archivo | Qué hace |
|---|---------|----------|
| 001 | `crear-tablas.sql` | Crea tabla `ofertas` con todas las columnas base + 4 índices |
| 002 | `migracion-002-postulacion-y-porcentaje.sql` | Agrega `porcentaje_match` y `estado_postulacion` |
| 003 | `migracion-003-preferencias.sql` | Crea tabla `preferencias` + inserta fila default |
| 004 | `migracion-004-idioma.sql` | Agrega `idioma_candidato` |
| 005 | `migracion-005-fecha-evaluacion.sql` | Agrega `fecha_evaluacion` + backfill + índice |
| 006 | `migracion-006-actualizar-perfil.sql` | UPDATE de perfil profesional (abril 2026) |
| 007 | `migracion-007-modelo-deepseek-v4-flash.sql` | Migra modelo IA a v4-flash |
| 008a | `migracion-008-error-evaluacion.sql` | Agrega `evaluacion_error_mensaje` |
| 008b | `migracion-008-preferencias-detalladas.sql` | Agrega 4 columnas JSONB a preferencias + backfill |
| 009a | `migracion-009-cache-evaluaciones.sql` | Crea tabla `evaluaciones_cache` |
| 009b | `migracion-009-scoring-previo.sql` | Agrega `score_previo`, `analisis_previo`, `scoring_version` |
| 010a | `migracion-010-lotes-evaluacion.sql` | Crea tabla `evaluacion_lotes` |
| 010b | `migracion-010-preferencias-ui-completa.sql` | Agrega 14 columnas a preferencias + backfill |
| 011 | `migracion-011-perfil-ampliado.sql` | Agrega `nivel_real_seniority`, `conocimientos_ausentes`, `limitaciones_explicitas` |
| 012 | `migracion-012-anios-experiencia-reales.sql` | Agrega `anios_experiencia_reales` |

### Características de las migraciones
- **Idempotentes**: Todas usan `DO $$ ... IF NOT EXISTS` para columnas/tablas
- **Sin sistema de migraciones automatizado**: No hay knex, node-pg-migrate, ni similar
- **Ejecución manual**: Se corren con `psql` directamente
- **Sin rollback**: No hay archivos de reversión
