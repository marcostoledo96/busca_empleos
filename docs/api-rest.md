# API REST — Busca Empleos

## Base URL

```
http://localhost:3000/api
```

## Autenticación

Todos los endpoints bajo `/api/` (excepto `/api/salud`) requieren un token JWT de Firebase en el header `Authorization`.

```
Authorization: Bearer <firebase_id_token>
```

El token se obtiene desde el cliente Angular (Firebase Auth). El middleware del backend verifica:
1. Que el token sea válido (firmado por Firebase).
2. Que el email del usuario autenticado coincida con `EMAIL_AUTORIZADO` en las variables de entorno.

Si falta el token o no es válido, la API retorna `401 Unauthorized`:
```json
{ "exito": false, "error": "No autorizado." }
```

> **Nota para desarrollo local:** Los tests de Jest mockean el middleware de auth (`verificarAuth`) para poder testear los controladores sin token real.



Todas las respuestas siguen este formato:

```json
// Éxito
{ "exito": true, "datos": { ... } }

// Error
{ "exito": false, "error": "Mensaje descriptivo" }
```

## Resumen de endpoints

| Método | Ruta | Descripción | Auth | Rate Limited |
|--------|------|-------------|:----:|:----------:|
| GET | `/api/salud` | Health check del servidor | No | No |
| GET | `/api/ofertas` | Lista ofertas con filtros opcionales | **Sí** | No |
| GET | `/api/ofertas/estadisticas` | Contadores por estado de evaluación | **Sí** | No |
| GET | `/api/ofertas/diagnostico/persistencia` | Verifica qué base está leyendo la API y cuántas ofertas ve | **Sí** | No |
| GET | `/api/ofertas/:id` | Detalle de una oferta | **Sí** | No |
| PATCH | `/api/ofertas/:id/postulacion` | Actualizar estado de postulación | **Sí** | No |
| POST | `/api/scraping/linkedin` | Ejecutar scraping de LinkedIn | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/computrabajo` | Ejecutar scraping de Computrabajo | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/indeed` | Ejecutar scraping de Indeed | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/bumeran` | Ejecutar scraping de Bumeran | **Sí** | **Sí** (5/min) |
| POST | `/api/evaluacion/ejecutar` | Evaluar ofertas pendientes con IA | **Sí** | **Sí** (5/min) |
| GET | `/api/automatizacion/estado` | Estado actual del cron | **Sí** | No |
| POST | `/api/automatizacion/iniciar` | Programar el cron | **Sí** | No |
| POST | `/api/automatizacion/detener` | Detener el cron | **Sí** | No |
| POST | `/api/automatizacion/ejecutar` | Ejecutar ciclo completo manual | **Sí** | No |

---

## Endpoints de ofertas

Archivo de rutas: `backend/src/rutas/ofertas.js`
Controlador: `backend/src/controladores/controlador-ofertas.js`

> **Gotcha:** La ruta `/estadisticas` se registra ANTES de `/:id` para que Express no confunda "estadisticas" con un ID.

### GET /api/ofertas

Lista todas las ofertas, con filtros opcionales por query params.

**Query params:**

| Param | Tipo | Valores posibles |
|-------|------|-----------------|
| `estado` | string | `pendiente`, `aprobada`, `rechazada` |
| `plataforma` | string | `linkedin`, `computrabajo`, `indeed`, `bumeran` |
| `estado_postulacion` | string | `no_postulado`, `cv_enviado`, `en_proceso`, `descartada` |
| `ordenar_por` | string | `fecha_extraccion`, `fecha_publicacion`, `porcentaje_match` |
| `direccion` | string | `ASC`, `DESC` (default: `DESC`) |

**Ejemplo request:**
```
GET /api/ofertas?estado=aprobada&plataforma=linkedin
GET /api/ofertas?ordenar_por=porcentaje_match&direccion=DESC
GET /api/ofertas?estado_postulacion=cv_enviado
```

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": [
        {
            "id": 1,
            "titulo": "Desarrollador Frontend Junior",
            "empresa": "TechCorp",
            "ubicacion": "Buenos Aires, Argentina",
            "modalidad": "remoto",
            "descripcion": "Buscamos desarrollador...",
            "url": "https://linkedin.com/jobs/...",
            "plataforma": "linkedin",
            "nivel_requerido": "junior",
            "salario_min": null,
            "salario_max": null,
            "moneda": null,
            "estado_evaluacion": "aprobada",
            "razon_evaluacion": "Matchea con Angular y React del perfil.",
            "porcentaje_match": 85,
            "estado_postulacion": "no_postulado",
            "fecha_publicacion": "2026-03-28T00:00:00.000Z",
            "fecha_extraccion": "2026-03-29T14:30:00.000Z",
            "datos_crudos": { ... }
        }
    ],
    "total": 1
}
```

### GET /api/ofertas/estadisticas

Retorna contadores agrupados por estado de evaluación.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "total": 150,
        "pendientes": 30,
        "aprobadas": 45,
        "rechazadas": 75
    }
}
```

### GET /api/ofertas/diagnostico/persistencia

Retorna un diagnóstico mínimo de la conexión PostgreSQL visible desde la API.
Sirve para confirmar si el backend está leyendo la base esperada y cuántas ofertas
persistidas detecta al momento de la consulta.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "configuracion": {
            "host": "localhost",
            "puerto": 5432,
            "baseDatos": "busca_empleos",
            "usuario": "postgres"
        },
        "conexion": {
            "base_datos_actual": "busca_empleos",
            "usuario_actual": "postgres",
            "puerto_postgresql": 5432,
            "host_postgresql": "127.0.0.1",
            "tabla_ofertas_existe": true,
            "total_ofertas": 24
        },
        "fecha_consulta": "2026-04-01T18:30:00.000Z"
    }
}
```

**Uso recomendado para debugging:**
1. Scrapear o evaluar una búsqueda.
2. Consultar este endpoint y anotar `total_ofertas`.
3. Reiniciar el backend.
4. Consultar de nuevo el endpoint.
5. Si `total_ofertas` cambia inesperadamente, el problema está en la persistencia real o en la base apuntada por el `.env`.

### GET /api/ofertas/:id

Retorna una oferta específica.

**Validación:** El ID debe ser un número entero positivo (se valida en el boundary).

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "id": 42,
        "titulo": "QA Tester Junior",
        ...
    }
}
```

**Error — ID inválido (400):**
```json
{ "exito": false, "error": "El ID debe ser un número entero positivo." }
```

**Error — no encontrada (404):**
```json
{ "exito": false, "error": "Oferta no encontrada." }
```

### PATCH /api/ofertas/:id/postulacion

Actualiza el estado de postulación de una oferta.

**Body:**
```json
{
    "estado_postulacion": "cv_enviado"
}
```

| Campo | Tipo | Valores válidos |
|-------|------|----------------|
| `estado_postulacion` | string | `no_postulado`, `cv_enviado`, `en_proceso`, `descartada` |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "id": 42,
        "titulo": "QA Tester Junior",
        "estado_postulacion": "cv_enviado",
        ...
    }
}
```

**Error — estado inválido (400):**
```json
{ "exito": false, "error": "El estado de postulación 'invalido' no es válido. Estados permitidos: no_postulado, cv_enviado, en_proceso, descartada." }
```

**Error — body vacío (400):**
```json
{ "exito": false, "error": "Se requiere el campo estado_postulacion." }
```

**Error — ID inválido (400):**
```json
{ "exito": false, "error": "El ID debe ser un número entero positivo." }
```

**Error — no encontrada (404):**
```json
{ "exito": false, "error": "Oferta no encontrada." }
```

---

## Endpoints de scraping

Archivo de rutas: `backend/src/rutas/scraping.js`
Controlador: `backend/src/controladores/controlador-scraping.js`

> Rate limited: máximo 5 requests por minuto (protege créditos de Apify).

### POST /api/scraping/linkedin

Ejecuta el scraping de LinkedIn, normaliza resultados y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 100,
    "terminos": ["react developer", "angular developer"],
    "ubicacion": "Argentina"
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 100 | Máximo de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |
| `ubicacion` | string | "Argentina" | Ubicación para filtrar. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de LinkedIn completado: 15 ofertas nuevas.",
        "plataforma": "linkedin",
        "ofertas_nuevas": 15,
        "ofertas_duplicadas": 5,
        "total_extraidas": 20
    }
}
```

### POST /api/scraping/computrabajo

Ejecuta el scraping de Computrabajo, normaliza y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 50,
    "terminos": ["frontend developer junior"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 50 | Máximo de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Computrabajo completado: 10 ofertas nuevas.",
        "plataforma": "computrabajo",
        "ofertas_nuevas": 10,
        "ofertas_duplicadas": 3,
        "total_extraidas": 13
    }
}
```

### POST /api/scraping/indeed

Ejecuta el scraping de Indeed Argentina, normaliza resultados y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 100,
    "terminos": ["react developer", "angular developer"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 100 | Máximo de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Indeed completado: 12 ofertas nuevas.",
        "plataforma": "indeed",
        "ofertas_nuevas": 12,
        "ofertas_duplicadas": 8,
        "total_extraidas": 20
    }
}
```

### POST /api/scraping/bumeran

Ejecuta el scraping de Bumeran usando cheerio-scraper, normaliza y guarda en BD.

**Body (opcional):**
```json
{
    "terminos": ["frontend developer junior"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

> **Nota:** Bumeran no acepta `maxResultados` porque extrae desde las tarjetas de la página de resultados.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Bumeran completado: 8 ofertas nuevas.",
        "plataforma": "bumeran",
        "ofertas_nuevas": 8,
        "ofertas_duplicadas": 2,
        "total_extraidas": 10
    }
}
```

---

### POST /api/scraping/glassdoor

Ejecuta el scraping de Glassdoor Argentina usando el actor de Apify, normaliza y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 50,
    "terminos": ["React developer junior"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 50 | Cantidad máxima de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Glassdoor completado: 11 ofertas nuevas.",
        "plataforma": "glassdoor",
        "ofertas_nuevas": 11,
        "ofertas_duplicadas": 3,
        "total_extraidas": 14
    }
}
```

---

### POST /api/scraping/getonbrd

Ejecuta el scraping de GetOnBrd usando su API pública gratuita (sin Apify), normaliza y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 50,
    "terminos": ["angular developer"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 50 | Cantidad máxima de ofertas a extraer por término. |
| `terminos` | string[] | 9 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de GetOnBrd completado: 9 ofertas nuevas.",
        "plataforma": "getonbrd",
        "ofertas_nuevas": 9,
        "ofertas_duplicadas": 2,
        "total_extraidas": 11
    }
}
```

**Nota:** El campo `empresa` siempre es `null` en GetOnBrd porque el endpoint de búsqueda no devuelve el nombre de la empresa. El salario viene en USD cuando está disponible.

---

Archivo de rutas: `backend/src/rutas/evaluacion.js`
Controlador: `backend/src/controladores/controlador-evaluacion.js`

> Rate limited: máximo 5 requests por minuto (protege créditos de DeepSeek).

### POST /api/evaluacion/ejecutar

Evalúa todas las ofertas con `estado_evaluacion = 'pendiente'` usando DeepSeek.

**Body:** Ninguno.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "total": 30,
        "aprobadas": 12,
        "rechazadas": 18,
        "errores": 0,
        "mensaje": "Evaluación completada: 12 aprobadas, 18 rechazadas.",
        "detalle": [
            {
                "id": 5,
                "titulo": "React Developer Junior",
                "estado": "aprobada",
                "razon": "Matchea con React y JavaScript del perfil."
            }
        ]
    }
}
```

---

## Endpoints de automatización

Archivo de rutas: `backend/src/rutas/automatizacion.js`
Controlador: `backend/src/controladores/controlador-automatizacion.js`

### GET /api/automatizacion/estado

Retorna el estado actual del cron.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "activo": true,
        "expresionCron": "0 0 */2 * *",
        "ultimaEjecucion": "2026-03-31T12:00:00.000Z",
        "ultimoResultado": { ... }
    }
}
```

### POST /api/automatizacion/iniciar

Programa el cron. Si ya hay uno activo, lo reemplaza.

**Body (opcional):**
```json
{ "expresionCron": "0 8 * * *" }
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `expresionCron` | string | `"0 0 */2 * *"` | Expresión cron (cada 48 horas por default). |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "mensaje": "Cron programado: \"0 0 */2 * *\"",
    "datos": { "activo": true, "expresionCron": "0 0 */2 * *", ... }
}
```

**Error — expresión inválida (400):**
```json
{ "exito": false, "error": "Expresión cron inválida: \"invalida\"" }
```

### POST /api/automatizacion/detener

Detiene el cron activo.

**Body:** Ninguno.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "mensaje": "Cron detenido exitosamente.",
    "datos": { "activo": false, "expresionCron": null, ... }
}
```

**Error — no hay cron activo (400):**
```json
{ "exito": false, "error": "No hay ningún cron activo para detener." }
```

### POST /api/automatizacion/ejecutar

Ejecuta un ciclo completo manual (scraping + guardado + evaluación). No requiere cron activo.

**Body:** Ninguno.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "mensaje": "Ciclo completo ejecutado.",
    "datos": {
        "exito": true,
        "scraping": {
            "linkedin": 20,
            "computrabajo": 15,
            "indeed": 12,
            "bumeran": 8,
            "totalExtraidas": 55,
            "guardadas": 40
        },
        "evaluacion": {
            "total": 25,
            "aprobadas": 10,
            "rechazadas": 15,
            "errores": 0
        },
        "errores": []
    }
}
```

---

## Endpoint de salud

### GET /api/salud

Health check simple para verificar que el servidor está activo.

**Ejemplo response (200):**
```json
{ "exito": true, "mensaje": "El servidor está funcionando correctamente." }
```

---

## Manejo de errores

Archivo: `backend/src/utils/middleware-errores.js`

| Middleware | Status | Cuándo |
|-----------|--------|--------|
| `rutaNoEncontrada` | 404 | Ruta inexistente. Responde con `{ exito: false, error: "Ruta no encontrada: METHOD /path" }`. |
| `manejarErrores` | 500 (o error.statusCode) | Error no manejado en controladores. En producción oculta detalles internos. |

Express 5 atrapa automáticamente los errores en controladores async (Promises rechazadas). No hace falta try/catch ni wrappers.

## Rate limiting

- **Scope:** `/api/scraping` y `/api/evaluacion`.
- **Límite:** 5 requests por minuto por IP.
- **En tests:** Desactivado (`NODE_ENV=test` usa un middleware vacío).
- **Respuesta cuando se excede (429):**

```json
{ "exito": false, "error": "Demasiadas solicitudes. Esperá un minuto antes de intentar de nuevo." }
```

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general, middlewares, formato de respuesta.
- [Base de datos](base-de-datos.md) — Schema, modelo, queries.
- [Scraping](scraping.md) — Qué hace cada endpoint de scraping internamente.
- [Evaluación IA](evaluacion-ia.md) — Cómo funciona la evaluación que dispara `/evaluacion/ejecutar`.
- [Automatización](automatizacion.md) — Ciclo completo que ejecutan los endpoints de automatización.
