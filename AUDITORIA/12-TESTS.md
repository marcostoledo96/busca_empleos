# 12 — Tests: Cobertura y Gaps

## Backend — 16 archivos de test

### Framework
- **Jest** 30.3.0
- **Supertest** 7.2.2 (para tests HTTP)
- **Comandos**: `npm test`, `npm run test:modelos`, `npm run test:integracion`

### Tests existentes

| Archivo | Tipo | Qué prueba | BD real |
|---------|------|-----------|---------|
| `tests/config/base-datos.test.js` | Unitario | Conexión al pool, SELECT 1, NOW() | ✅ Sí |
| `tests/config/cors.test.js` | Unitario | Preflight OPTIONS desde Vercel | ❌ No |
| `tests/modelos/oferta.test.js` | Integración | CRUD completo: crear, obtener, listar, deduplicar, ordenar, estadísticas, actualizar | ✅ Sí (con `ALLOW_DB_TESTS=true`) |
| `tests/modelos/preferencia.test.js` | Integración | Lectura, actualización parcial, arrays, prompt, autocreación | ✅ Sí (con `ALLOW_DB_TESTS=true`) |
| `tests/servicios/servicio-scraping.test.js` | Unitario (mocks) | LinkedIn, Computrabajo, Indeed, Bumeran, Glassdoor, GetOnBrd, Jooble, InfoJobs, Google Jobs, Adzuna | ❌ No |
| `tests/servicios/servicio-evaluacion.test.js` | Unitario (mocks) | Evaluación con DeepSeek, errores, rate limit, cancelación | ❌ No |
| `tests/servicios/servicio-normalizacion.test.js` | Unitario | Normalización de todas las plataformas | ❌ No |
| `tests/servicios/servicio-automatizacion.test.js` | Unitario (mocks) | Ciclo completo, cron, resiliencia | ❌ No |
| `tests/controladores/controlador-scraping.test.js` | Unitario (mocks) | 10 plataformas (endpoints, respuestas, errores) | ❌ No |
| `tests/controladores/controlador-ofertas.test.js` | Unitario (mocks) | Todos los endpoints de ofertas, filtros, validaciones | ❌ No |
| `tests/controladores/controlador-preferencias.test.js` | Unitario (mocks) | GET/PUT preferencias, validaciones de enums, arrays, errores | ❌ No |
| `tests/controladores/controlador-evaluacion.test.js` | Unitario + Regresión | Fire-and-forget, progreso, cancelación, 409, 429, rate limiter activo | ❌ No |
| `tests/controladores/controlador-automatizacion.test.js` | Unitario + Regresión | Estado, iniciar/detener, progreso, ejecutar, 429 | ❌ No |
| `tests/integracion/infojobs-endpoint.test.js` | Integración | Endpoint de InfoJobs con credenciales reales o mocks | ⚠️ Parcial |
| *(otros 2 tests)* | — | — | — |

---

## Frontend — 7 archivos de test

### Framework
- **Jasmine** + **Karma**
- **Browser**: Chrome Headless
- **Coverage**: karma-coverage

### Tests existentes

| Archivo | Qué prueba |
|---------|-----------|
| `src/app/app.spec.ts` | Shell: sidebar toggle, Escape en mobile/desktop, tema toggle |
| `src/app/componentes/panel-control/panel-control.spec.ts` | Selector mobile, dispatcher, scraping InfoJobs deshabilitado, polling defensivo (requests solapadas, 429, rehidratación, 409), accesibilidad aria-live |
| `src/app/componentes/tabla-ofertas/tabla-ofertas.spec.ts` | Activación por teclado (Enter/Espacio), nivelMatch, paginador cards acotado |
| `src/app/componentes/detalle-oferta/detalle-oferta.spec.ts` | Signal visible, severidad de estado/porcentaje, abrirEnPagina con window.open |
| `src/app/paginas/preferencias/preferencias.spec.ts` | aria-live dinámico, mensajes de éxito/error |
| `src/app/servicios/persistencia-dashboard.service.spec.ts` | Guardar/leer cache, JSON corrupto, formato inválido |
| *(1 test más)* | — |

---

## Gaps de cobertura — Lo que NO se prueba

### Backend

| Área | Gap | Severidad |
|------|-----|-----------|
| **Auth real** | Los tests mockean `verificarAuth` con passthrough. No se prueba verificación real de JWT de Firebase. | 🟠 Alta |
| **Rate limiter real** | Solo tests de regresión con `NODE_ENV=production_test`. No hay test que verifique el middleware real. | 🟡 Media |
| **Firebase Admin** | No hay tests de `config/firebase-admin.js` | 🟡 Media |
| **Evaluación IA real** | Todo mock. No hay test de integración contra DeepSeek/OpenCode Go real (correcto, es pago). | 🟢 Baja |
| **Scraping real** | Todo mock. No hay test E2E que corra actores de Apify reales (correcto, es pago). | 🟢 Baja |
| **Modelo `evaluacion-cache.js`** | No hay tests | 🟡 Media |
| **Modelo `evaluacion-lote.js`** | No hay tests | 🟡 Media |
| **`servicio-scoring-previo.js`** | No hay tests dedicados | 🟠 Alta |
| **`config/deepseek.js`** | No hay tests del cliente HTTP con retry | 🟡 Media |

### Frontend

| Área | Gap | Severidad |
|------|-----|-----------|
| **Página Dashboard** | No hay `dashboard.spec.ts` | 🟠 Alta |
| **Página Login** | No hay `login.spec.ts` | 🟡 Media |
| **AuthService** | No hay `auth.service.spec.ts` | 🟡 Media |
| **OfertasService** | No hay tests | 🟡 Media |
| **ScrapingService** | No hay tests | 🟡 Media |
| **EvaluacionService** | No hay tests | 🟡 Media |
| **AutomatizacionService** | No hay tests | 🟡 Media |
| **PreferenciasService** | No hay tests | 🟡 Media |
| **Auth Guard** | No hay tests de `auth.guard.ts` | 🟡 Media |
| **Auth Interceptor** | No hay tests de `auth.interceptor.ts` | 🟡 Media |
| **E2E / Playwright** | No hay tests E2E (Playwright está configurado como MCP pero sin tests escritos) | 🟢 Baja |

### Observaciones

- **`skipTests: true`** en `angular.json`: al generar nuevos componentes con CLI,
  no se crean archivos `.spec.ts` automáticamente. Esto desincentiva escribir tests.
- **Tests de integración con BD** requieren `ALLOW_DB_TESTS=true` para correr
  (protege contra correr tests de BD accidentalmente y romper datos).
- **No hay tests de regresión visual** ni snapshot testing.
- **No hay tests de performance** (lighthouse, web vitals, bundle size).
