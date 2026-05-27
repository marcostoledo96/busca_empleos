# 02 — Backend: Estructura y Configuración

## Árbol de archivos del backend

```
backend/
├── .env                          ← Variables de entorno (no versionado)
├── .env.example                  ← Plantilla con 21 variables documentadas
├── .gitignore
├── package.json
├── coverage/                     ← Reportes de cobertura Jest
├── firebase-service-account.json ← Credenciales Firebase Admin (no versionado)
├── node_modules/
├── sql/                          ← Scripts SQL y migraciones (15 archivos)
│   ├── crear-tablas.sql
│   ├── migracion-002-postulacion-y-porcentaje.sql
│   ├── migracion-003-preferencias.sql
│   ├── migracion-004-idioma.sql
│   ├── migracion-005-fecha-evaluacion.sql
│   ├── migracion-006-actualizar-perfil.sql
│   ├── migracion-007-modelo-deepseek-v4-flash.sql
│   ├── migracion-008-error-evaluacion.sql
│   ├── migracion-008-preferencias-detalladas.sql
│   ├── migracion-009-cache-evaluaciones.sql
│   ├── migracion-009-scoring-previo.sql
│   ├── migracion-010-lotes-evaluacion.sql
│   ├── migracion-010-preferencias-ui-completa.sql
│   ├── migracion-011-perfil-ampliado.sql
│   └── migracion-012-anios-experiencia-reales.sql
└── src/
    ├── app.js                    ← Configuración Express
    ├── index.js                  ← Punto de entrada (levanta servidor + BD)
    ├── config/
    │   ├── apify.js              ← Cliente Apify + URLs de búsqueda
    │   ├── base-datos.js         ← Pool de conexiones PostgreSQL
    │   ├── deepseek.js           ← Cliente HTTP para DeepSeek/OpenCode Go
    │   └── firebase-admin.js     ← Inicialización Firebase Admin SDK
    ├── controladores/
    │   ├── controlador-automatizacion.js
    │   ├── controlador-evaluacion.js
    │   ├── controlador-ofertas.js
    │   ├── controlador-preferencias.js
    │   └── controlador-scraping.js
    ├── modelos/
    │   ├── evaluacion-cache.js
    │   ├── evaluacion-lote.js
    │   ├── oferta.js
    │   └── preferencia.js
    ├── rutas/
    │   ├── automatizacion.js
    │   ├── evaluacion.js
    │   ├── ofertas.js
    │   ├── preferencias.js
    │   └── scraping.js
    ├── servicios/
    │   ├── servicio-automatizacion.js
    │   ├── servicio-evaluacion.js
    │   ├── servicio-normalizacion.js
    │   ├── servicio-scoring-previo.js
    │   └── servicio-scraping.js
    └── utils/
        ├── middleware-auth.js
        └── middleware-errores.js
```

## Arquitectura de capas

```
index.js (levanta servidor)
    │
    ▼
app.js (configura Express)
    │
    ├── Helmet (headers de seguridad)
    ├── CORS (orígenes permitidos)
    ├── express.json() (parseo de body)
    ├── Rate limiter (5 req/min en endpoints costosos)
    ├── Firebase Auth middleware
    │
    ├── Rutas ──► Controladores ──► Servicios ──► Modelos ──► PostgreSQL
    │                (handlers)      (lógica)     (queries)
    │
    └── Manejo de errores (404, 500)
```

**¿Por qué `app.js` y `index.js` separados?**
Para que los tests puedan importar `app.js` sin levantar el servidor.
Es el patrón estándar de cualquier proyecto Express testeado.

## Configuración de Express (app.js)

### Middlewares globales (en orden)

1. **`app.set('trust proxy', 1)`** — Necesario para Railway/PaaS que ponen proxy
   delante. Sin esto, el rate limiter no ve la IP real del usuario.
2. **`helmet()`** — Headers de seguridad HTTP: X-Content-Type-Options,
   X-Frame-Options, Strict-Transport-Security, etc.
3. **`cors()`** — Orígenes permitidos desde `CORS_ORIGEN` (variable de entorno).
   Lista blanca: `localhost:4200` y `busca-empleos.vercel.app`.
4. **`express.json({ limit: '1mb' })`** — Body parser con límite de 1MB.
5. **Rate limiter** — Solo en endpoints que consumen APIs pagas (scraping,
   evaluación, automatización). 5 requests/minuto por IP. Desactivado en tests.

### Montaje de rutas

| Prefijo | Router | Rate limit | Auth |
|---------|--------|-----------|------|
| `/api/salud` | Handler inline | No | No (público) |
| `/api/ofertas` | `rutasOfertas` | No | Sí |
| `/api/evaluacion/progreso` | Handler directo | No | Sí |
| `/api/automatizacion/progreso` | Handler directo | No | Sí |
| `/api/automatizacion/estado` | Handler directo | No | Sí |
| `/api/evaluacion/cancelar` | Handler directo | No | Sí |
| `/api/scraping` | `rutasScraping` | Sí (5/min) | Sí |
| `/api/evaluacion` | `rutasEvaluacion` | Sí (5/min) | Sí |
| `/api/automatizacion` | `rutasAutomatizacion` | Sí (5/min) | Sí |
| `/api/preferencias` | `rutasPreferencias` | No | Sí |

**Nota importante**: Los endpoints GET de polling (progreso, estado) se montan
directamente con el handler del controlador, NO con el Router, porque Express
no hace path-stripping en montajes de método y el Router busca la ruta completa
sin éxito. Estos endpoints NO tienen rate limit porque el frontend los pollea
cada 2 segundos y 5 requests agotarían la cuota en 10 segundos.

## Archivos de configuración

### `config/apify.js`
- Cliente `ApifyClient` con token de `APIFY_TOKEN`
- IDs de actores para LinkedIn, Computrabajo, Indeed, Bumeran, Glassdoor, Google Jobs
- URLs de API REST para GetOnBrd, Remotive, RemoteOK, Jooble
- Funciones para construir URLs de búsqueda (LinkedIn, Computrabajo, Bumeran, GetOnBrd)
- Términos de búsqueda por defecto

### `config/base-datos.js`
- Pool de `pg.Pool` con auto-detección de Railway (`DATABASE_URL`) vs local (`PG*`)
- SSL: auto-activa si `NODE_ENV=production` o host remoto
- `rejectUnauthorized: false` para certificados de PaaS
- Eventos `connect` y `error` para logging
- `obtenerDiagnosticoPersistencia()` para health checks
- Reintentos configurables (`POSTGRES_MAX_INTENTOS_CONEXION`, `POSTGRES_ESPERA_REINTENTO_MS`)

### `config/deepseek.js`
- URL: `https://api.deepseek.com/v1/chat/completions`
- Modelo por defecto: `deepseek-v4-flash`
- Usa `fetch()` nativo de Node 22 (sin SDK adicional)
- Timeout de 30 segundos con `AbortController`
- Retry automático: hasta 3 reintentos con backoff exponencial + jitter
- Solo reintenta errores transitorios: 429, 500, 502, 503, 504
- Respeta header `Retry-After`
- Formato de request compatible con OpenAI (`messages`, `temperature: 0`)

### `config/firebase-admin.js`
- Inicializa Firebase Admin SDK
- Dos estrategias:
  - **Producción**: `FIREBASE_SERVICE_ACCOUNT_JSON` como string JSON completo
  - **Desarrollo**: `FIREBASE_SERVICE_ACCOUNT_PATH` apuntando a archivo local
- Protección contra doble inicialización (`!admin.apps.length`)
- Validación del JSON y del archivo

## Middlewares

### `utils/middleware-auth.js`
- `verificarAuth(req, res, next)`
- Pasa OPTIONS (preflight CORS) sin verificar
- Extrae `Authorization: Bearer <token>`
- `firebaseAuth.verifyIdToken(token)` → verifica firma, expiración, proyecto
- Verifica `tokenDecodificado.email === process.env.EMAIL_AUTORIZADO`
- Adjunta `req.usuario = tokenDecodificado`
- Manejo de errores: token expirado vs token inválido (mensajes distintos)

### `utils/middleware-errores.js`
- `rutaNoEncontrada`: 404 con método y URL original
- `manejarErrores`: 4 parámetros (Express error handler)
- Si `res.headersSent` → delega al handler por defecto
- Si 500 → oculta mensaje real (evita leaks de info sensible)
- Si 4xx → muestra mensaje real

## Seguridad implementada

| Capa | Medida |
|------|--------|
| Transporte | Helmet (X-Content-Type-Options, X-Frame-Options, HSTS) |
| CORS | Lista blanca de orígenes configurable |
| Autenticación | Firebase JWT verification server-side |
| Autorización | Email único autorizado (`EMAIL_AUTORIZADO`) |
| Rate limiting | 5 req/min en endpoints que consumen APIs pagas |
| Body size | Límite 1MB en `express.json()` |
| SQL injection | 100% queries parametrizadas (`$1`, `$2`, nunca concatenación) |
| File upload | Solo `.md`, límite 1MB, `memoryStorage` |
| Errores | 500 oculta mensaje real |
