# 05 — Backend: Modelos y Controladores

## Modelos (Queries SQL)

### oferta.js — CRUD de ofertas

Todas las queries usan parámetros (`$1`, `$2`, etc.). **Nunca concatenación de strings.**

| Función | Query | Descripción |
|---------|-------|-------------|
| `crearOferta(datos)` | `INSERT INTO ofertas (...) VALUES ($1..$13) ON CONFLICT (url) DO NOTHING RETURNING *` | Inserta o ignora si URL duplicada |
| `obtenerOfertas(filtros)` | `SELECT * FROM ofertas WHERE ... ORDER BY ... NULLS LAST` | Lista con filtros dinámicos |
| `obtenerOfertaPorId(id)` | `SELECT * FROM ofertas WHERE id = $1` | Oferta individual |
| `obtenerOfertasPendientes()` | `SELECT * FROM ofertas WHERE estado_evaluacion = 'pendiente'` | Para evaluación IA |
| `actualizarEvaluacion(id, estado, razon, porcentaje, errorMensaje)` | `UPDATE ofertas SET estado_evaluacion=$1, razon_evaluacion=$2, porcentaje_match=$3, fecha_evaluacion=NOW(), evaluacion_error_mensaje=$5 WHERE id=$4` | Resultado de IA |
| `actualizarPostulacion(id, estado)` | `UPDATE ofertas SET estado_postulacion=$1 WHERE id=$2` | Cambio de postulación |
| `actualizarPostulacionMasiva(ids, estado)` | `UPDATE ofertas SET estado_postulacion=$1 WHERE id = ANY($2::int[])` | Bulk update |
| `obtenerEstadisticas()` | `SELECT estado_evaluacion, COUNT(*)::integer FROM ofertas GROUP BY estado_evaluacion` | Conteo por estado |
| `resetearEvaluacionesPorDias(dias)` | `UPDATE ofertas SET estado_evaluacion='pendiente', ... WHERE fecha_evaluacion > NOW() - make_interval(days => $1)` | Reset de evaluaciones |
| `guardarAnalisisPrevio(id, analisis)` | `UPDATE ofertas SET score_previo=$1, analisis_previo=$2, scoring_version=$3 WHERE id=$4` | Scoring previo |

### preferencia.js — Perfil del usuario (single-row)

| Función | Query | Descripción |
|---------|-------|-------------|
| `obtenerPreferencias()` | `SELECT * FROM preferencias WHERE id = 1` | Siempre fila única |
| `crearPreferenciasPorDefecto()` | `INSERT INTO preferencias (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id` | Auto-creación si no existe |
| `actualizarPreferencias(datos)` | `UPDATE preferencias SET {campos dinámicos}, fecha_actualizacion = NOW() WHERE id = 1` | Solo actualiza campos enviados |

**Características importantes**:
- Whitelist de campos permitidos (evita modificación de campos internos)
- Serialización explícita de JSONB con `JSON.stringify()`
- Backup automático: antes de actualizar, guarda fila actual en `backup_preferencias`
- Derivación automática: si `tecnologias_detalle` viene pero `stack_tecnologico` no,
  lo deriva filtrando tecnologías con nivel ≠ 'ninguno'

### evaluacion-cache.js — Cache de evaluaciones

| Función | Descripción |
|---------|-------------|
| `crearHashOferta(oferta)` | SHA-256 de `titulo|empresa|ubicacion|modalidad|descripcion` (normalizado) |
| `crearHashPreferencias(prefs)` | SHA-256 de JSON con campos relevantes del perfil |
| `buscarCache(hashOferta, hashPreferencias, modeloIa)` | `SELECT resultado FROM evaluaciones_cache WHERE ...` |
| `guardarCache(...)` | `INSERT INTO evaluaciones_cache (...) ON CONFLICT DO NOTHING` |

### evaluacion-lote.js — Progreso persistente de evaluación

| Función | Query |
|---------|-------|
| `crearLote(total, modeloIa)` | `INSERT INTO evaluacion_lotes (estado, total, modelo_ia) VALUES ('activo', $1, $2) RETURNING *` |
| `actualizarProgreso(loteId, progreso)` | `UPDATE evaluacion_lotes SET evaluadas=$1, aprobadas=$2, ... WHERE id=$6` |
| `finalizarLote(loteId, estado)` | `UPDATE evaluacion_lotes SET estado=$1, finalizado_en=NOW() WHERE id=$2` |

---

## Controladores

### controlador-scraping.js
12 handlers, uno por plataforma. Todos siguen el mismo patrón:
1. Lee preferencias para obtener términos de búsqueda
2. Llama al servicio de scraping
3. Normaliza con `servicioNormalizacion`
4. Inserta con `modeloOferta.crearOferta()`
5. Responde con `{ exito: true, extraidas: N, guardadas: M }`

### controlador-evaluacion.js
- `ejecutarEvaluacion`: fire-and-forget (lanza sin await). Chequea que no haya
  evaluación activa (409 si ya hay). Responde inmediatamente.
- `obtenerProgresoEvaluacion`: devuelve estado actual de `progresoEvaluacion`
- `cancelarEvaluacion`: setea bandera `_cancelarEvaluacion = true`
- `resetearEvaluaciones`: valida `dias` (1-365), llama a `modeloOferta.resetearEvaluacionesPorDias()`

### controlador-ofertas.js
Validaciones en cada endpoint:
- `id`: debe ser entero positivo (`parseInt` + `isNaN` + `> 0`)
- `estado_postulacion`: whitelist de 4 valores
- `ids` en bulk: array no vacío de enteros positivos
- `diagnostico/persistencia`: bloqueado en producción (404)

### controlador-preferencias.js
Validación exhaustiva de ~40 campos:
- Enums: `nivel_experiencia`, `modalidad_aceptada`, `modelo_ia`, `disponibilidad`, `moneda_salarial`
- Arrays: `stack_tecnologico`, `terminos_busqueda`, `zonas_preferidas`, `reglas_exclusion`
- JSONB: `tecnologias_detalle`, `roles_objetivo_detalle`, `scoring_config`, `nivel_ingles_detalle`
- Rangos: `max_caracteres_descripcion_ia` (500-10000), `temperatura_*` (0-1), `anios_experiencia_reales` (0-50)
- Salarios: `expectativa_salarial_min` ≤ `expectativa_salarial_max`
- Plataformas: subset de 12 valores permitidos

### controlador-automatizacion.js
- Delega 100% al `servicioAutomatizacion`
- `obtenerProgreso` no requiere cron activo — devuelve último estado conocido
