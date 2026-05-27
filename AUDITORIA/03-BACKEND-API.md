# 03 — Backend: API REST Completa

## Resumen

- **29 endpoints** en total
- **1 endpoint público** (health check)
- **28 endpoints autenticados** (Firebase JWT)
- **14 endpoints con rate limiting** (5 req/min por IP)
- **Formato de respuesta estándar**: `{ exito: boolean, datos: T, error?: string }`

---

## Endpoint de salud (público)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/salud` | Health check. Responde `{ exito: true, mensaje: "El servidor está funcionando correctamente." }` |

---

## Ofertas

| Método | Ruta | Rate Limit | Descripción |
|--------|------|-----------|-------------|
| GET | `/api/ofertas` | No | Listar ofertas con filtros y ordenamiento |
| GET | `/api/ofertas/estadisticas` | No | Conteo por estado de evaluación |
| GET | `/api/ofertas/diagnostico/persistencia` | No | Diagnóstico de BD (bloqueado en prod) |
| GET | `/api/ofertas/:id` | No | Obtener una oferta por ID |
| PATCH | `/api/ofertas/:id/postulacion` | No | Actualizar estado de postulación |
| PATCH | `/api/ofertas/bulk/postulacion` | No | Actualización masiva de postulación |

### GET `/api/ofertas`

**Query params soportados:**

| Parámetro | Valores | Default |
|-----------|---------|---------|
| `estado` | `pendiente`, `aprobada`, `rechazada` | (todos) |
| `plataforma` | `linkedin`, `computrabajo`, `indeed`, `bumeran`, `glassdoor`, `getonbrd`, `jooble`, `google-jobs`, `remotive`, `remoteok`, `adzuna` | (todas) |
| `estado_postulacion` | `no_postulado`, `cv_enviado`, `en_proceso`, `descartada` | (todos) |
| `ordenar_por` | `fecha_extraccion`, `fecha_publicacion`, `porcentaje_match`, `titulo`, `empresa`, `estado_evaluacion` | — |
| `direccion` | `ASC`, `DESC` | `DESC` |

**Validaciones**: Todos los filtros son opcionales. El ordenamiento usa `NULLS LAST`.

### PATCH `/api/ofertas/:id/postulacion`

**Body**: `{ estado_postulacion: 'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada' }`

**Validación**: `id` debe ser entero positivo. `estado_postulacion` validado contra whitelist.

### PATCH `/api/ofertas/bulk/postulacion`

**Body**: `{ ids: number[], estado_postulacion: string }`

**Validación**: `ids` debe ser array no vacío de enteros positivos.

---

## Scraping

Todos los endpoints de scraping requieren rate limit (5 req/min).

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/scraping/linkedin` | Ejecutar scraping de LinkedIn |
| POST | `/api/scraping/computrabajo` | Ejecutar scraping de Computrabajo |
| POST | `/api/scraping/indeed` | Ejecutar scraping de Indeed |
| POST | `/api/scraping/bumeran` | Ejecutar scraping de Bumeran |
| POST | `/api/scraping/glassdoor` | Ejecutar scraping de Glassdoor |
| POST | `/api/scraping/getonbrd` | Ejecutar scraping de GetOnBrd |
| POST | `/api/scraping/jooble` | Ejecutar scraping de Jooble |
| POST | `/api/scraping/google-jobs` | Ejecutar scraping de Google Jobs |
| POST | `/api/scraping/remotive` | Ejecutar scraping de Remotive |
| POST | `/api/scraping/remoteok` | Ejecutar scraping de RemoteOK |
| POST | `/api/scraping/infojobs` | Ejecutar scraping de InfoJobs |
| POST | `/api/scraping/adzuna` | Ejecutar scraping de Adzuna |

### Flujo común de cada endpoint de scraping

1. Lee preferencias del usuario para obtener términos de búsqueda personalizados
2. Llama al servicio de scraping correspondiente
3. Normaliza ofertas con `servicioNormalizacion`
4. Inserta cada oferta con `modeloOferta.crearOferta()` (deduplicación por URL)
5. Responde con `{ exito: true, extraidas: N, guardadas: M }`

### Plataformas desactivadas

- **Google Jobs**: Retorna `{ exito: true, extraidas: 0, guardadas: 0, advertencia: "Google Jobs está desactivado por costo ineficiente" }`
- **InfoJobs**: Retorna `{ exito: false, error: "InfoJobs está temporalmente desactivado" }` si no hay credenciales

---

## Evaluación

| Método | Ruta | Rate Limit | Descripción |
|--------|------|-----------|-------------|
| POST | `/api/evaluacion/ejecutar` | Sí | Iniciar evaluación IA de ofertas pendientes |
| GET | `/api/evaluacion/progreso` | No | Obtener progreso de evaluación en curso |
| POST | `/api/evaluacion/cancelar` | No | Cancelar evaluación en curso |
| POST | `/api/evaluacion/resetear` | Sí | Resetear evaluaciones de los últimos N días |

### POST `/api/evaluacion/ejecutar`
- **Fire-and-forget**: lanza `evaluarOfertasPendientes()` sin `await`
- Responde inmediatamente con `{ exito: true, mensaje: "..." }`
- Si ya hay una evaluación activa → 409 Conflict
- El progreso se consulta vía polling en `GET /progreso`

### POST `/api/evaluacion/resetear`
- **Body**: `{ dias: number }` (1-365)
- Cambia ofertas evaluadas en ese rango a estado `pendiente`
- Útil para re-evaluar con preferencias actualizadas

---

## Automatización

| Método | Ruta | Rate Limit | Descripción |
|--------|------|-----------|-------------|
| GET | `/api/automatizacion/estado` | No | Estado del cron (activo/inactivo, última ejecución) |
| GET | `/api/automatizacion/progreso` | No | Progreso del ciclo en curso (pasos, %) |
| POST | `/api/automatizacion/iniciar` | Sí | Activar cron semanal |
| POST | `/api/automatizacion/detener` | Sí | Detener cron |
| POST | `/api/automatizacion/ejecutar` | Sí | Ejecutar ciclo completo ahora |

### POST `/api/automatizacion/iniciar`
- **Body opcional**: `{ expresionCron: string }`
- Default: `"0 8 * * 3"` (miércoles 8 AM ART)
- Timezone: `America/Argentina/Buenos_Aires`

### Ciclo completo (ejecutarCicloCompleto)
1. Scrapea 10 plataformas (saltea InfoJobs y Google Jobs)
2. Filtra ofertas en inglés
3. Guarda en BD (deduplicación por URL)
4. Evalúa ofertas pendientes con IA
5. Registra duración, errores y resultado

---

## Preferencias

| Método | Ruta | Rate Limit | Descripción |
|--------|------|-----------|-------------|
| GET | `/api/preferencias` | No | Obtener preferencias del usuario |
| PUT | `/api/preferencias` | No | Actualizar preferencias |
| POST | `/api/preferencias/importar-cv/analizar` | No | Analizar CV en formato Markdown |

### GET `/api/preferencias`
Devuelve la fila única (`id = 1`) de la tabla `preferencias` con ~40 campos.

### PUT `/api/preferencias`
**Body**: `Partial<Preferencias>` — solo los campos a actualizar.
- Validación exhaustiva de todos los campos (ver `controlador-preferencias.js`)
- Backup automático: guarda estado anterior en `backup_preferencias` (JSONB)
- Derivación automática de `stack_tecnologico` desde `tecnologias_detalle`

### POST `/api/preferencias/importar-cv/analizar`
- **Content-Type**: `multipart/form-data`
- **Archivo**: solo `.md`, máximo 1MB
- Usa DeepSeek v4-pro para extraer perfil profesional del CV
- Devuelve JSON estructurado con tecnologías, roles, idioma, scoring, preguntas pendientes

---

## Autenticación

Todos los endpoints bajo `/api/` (excepto `/api/salud`) requieren autenticación.

**Header requerido**: `Authorization: Bearer <firebase_id_token>`

**Flujo**:
1. Frontend obtiene token vía Firebase Auth (Google sign-in)
2. `authInterceptor` adjunta token a cada request
3. Backend verifica token con Firebase Admin SDK
4. Backend verifica que el email del token coincida con `EMAIL_AUTORIZADO`
5. Si todo ok → permite acceso. Si no → 401 Unauthorized.

---

## Manejo de errores HTTP

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 400 | Error de validación (body inválido, parámetros incorrectos) |
| 401 | No autenticado (token faltante, inválido o expirado) |
| 403 | Email no autorizado |
| 404 | Recurso no encontrado |
| 409 | Conflicto (evaluación ya en curso) |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor (mensaje oculto en producción) |
