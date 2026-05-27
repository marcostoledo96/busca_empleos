# 10 — Flujos de Datos End-to-End

## Flujo 1: Scraping + Evaluación + Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│ USUARIO (dashboard Angular)                                          │
│                                                                      │
│  Hace click en "Ejecutar ciclo completo"                             │
│  o espera al cron del miércoles 8 AM                                 │
└──────────────┬───────────────────────────────────────────────────────┘
               │ POST /api/automatizacion/ejecutar
               │ (con Bearer token JWT)
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND: servicio-automatizacion.js                                  │
│                                                                      │
│  ejecutarCicloCompleto():                                            │
│                                                                      │
│  1. linkedin     ─► servicio-scraping  ─► Apify actor                │
│  2. computrabajo ─► servicio-scraping  ─► fetch + cheerio (HTML)     │
│  3. indeed       ─► servicio-scraping  ─► Apify actor                │
│  4. bumeran      ─► servicio-scraping  ─► Apify puppeteer            │
│  5. glassdoor    ─► servicio-scraping  ─► Apify actor                │
│  6. getonbrd     ─► servicio-scraping  ─► fetch (API REST pública)   │
│  7. jooble       ─► servicio-scraping  ─► POST (API REST oficial)    │
│  8. remotive     ─► servicio-scraping  ─► fetch (API REST pública)   │
│  9. remoteok     ─► servicio-scraping  ─► fetch (API REST pública)   │
│  10. adzuna      ─► servicio-scraping  ─► fetch (API REST oficial)   │
│                                                                      │
│  Cada plataforma:                                                    │
│    └─► datos crudos (JSON/HTML)                                      │
│         │                                                            │
│         ▼                                                            │
│    servicio-normalizacion.normalizarLote()                           │
│         │                                                            │
│         ▼                                                            │
│    modeloOferta.crearOferta() ──► INSERT ON CONFLICT DO NOTHING      │
│         │                                                            │
│         ▼                                                            │
│    detectarIdioma() ──► descartar ofertas en inglés                  │
│                                                                      │
│  11. Evaluación IA:                                                  │
│      modeloOferta.obtenerOfertasPendientes()                         │
│         │                                                            │
│         ▼                                                            │
│      Para cada oferta:                                               │
│        scoringPrevio.calcularScorePrevio()                           │
│           │                                                          │
│           ├─ score < 30  ─► RECHAZO AUTOMÁTICO (sin IA)             │
│           ├─ score ≥ 85  ─► APROBACIÓN AUTOMÁTICA (sin IA)          │
│           └─ 30 ≤ score < 85                                         │
│                │                                                     │
│                ▼                                                     │
│             evaluacionCache.buscarCache()                            │
│                │                                                     │
│                ├─ cache hit ─► reutilizar resultado                  │
│                └─ cache miss                                         │
│                     │                                                │
│                     ▼                                                │
│                  consultarDeepSeek(prompt con análisis previo)       │
│                     │                                                │
│                     ▼                                                │
│                  modeloOferta.guardarAnalisisPrevio()                │
│                  modeloOferta.actualizarEvaluacion()                 │
│                  evaluacionCache.guardarCache()                      │
│                                                                      │
│  Emite progreso cada 5 ofertas (actualiza evaluacion_lotes)          │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND (polling cada 2s)                                           │
│                                                                      │
│  GET /api/automatizacion/progreso ─► actualiza barra de progreso     │
│                                                                      │
│  Al completar:                                                       │
│    Dashboard.cargarDatos()                                           │
│    GET /api/ofertas ─► actualiza tabs y stats                       │
│    Guarda en localStorage (PersistenciaDashboardService)             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Flujo 2: Evaluación manual

```
FRONTEND                          BACKEND
─────────                         ───────
Dashboard
  │
  ├─ Click "Ejecutar Evaluación"
  │  POST /api/evaluacion/ejecutar
  │                               controlador-evaluacion
  │                                 ├─ ¿progreso.activo? → 409
  │                                 └─ Sino: fire-and-forget
  │                                      evaluarOfertasPendientes()
  │                                      Responde 200 inmediatamente
  │
  ├─ Polling cada 2s
  │  GET /api/evaluacion/progreso
  │                               Devuelve progresoEvaluacion
  │                                 { activo, total, evaluadas,
  │                                   aprobadas, rechazadas,
  │                                   errores, porcentaje }
  │
  │  Actualiza progress bar
  │
  │  ⚠️ Si 5 errores 429 seguidos → detiene polling
  │
  ├─ [Usuario puede cancelar]
  │  POST /api/evaluacion/cancelar
  │                               Setea _cancelarEvaluacion = true
  │                               Loop chequea entre ofertas
  │
  └─ Al completar (porcentaje === 100):
       Dashboard.onProgresoEvaluacion()
         ├─ GET /api/ofertas (fresh)
         ├─ Merge con estado local (no pisar optimistic updates)
         └─ Toast "Evaluación completada"
```

---

## Flujo 3: Cambio de postulación (optimistic update)

```
FRONTEND                          BACKEND
─────────                         ───────
TablaOfertas / DetalleOferta
  │
  ├─ Usuario cambia dropdown
  │
  ├─ 1. Muta objeto local INMEDIATAMENTE
  │     oferta.estado_postulacion = nuevoValor
  │
  ├─ 2. Emite postulacionActualizada.emit()
  │     → Dashboard.onAccionCompletada()
  │       → Invalida computed signals
  │       → Guarda en localStorage
  │
  ├─ 3. PATCH /api/ofertas/:id/postulacion
  │                               Actualiza en BD
  │                               ┌─ Éxito → responde 200
  │                               └─ Error → responde 4xx/5xx
  │
  └─ 4. Si error:
       ├─ Revierte oferta.estado_postulacion = valorAnterior
       ├─ Toast con mensaje de error
       └─ Dashboard.onAccionCompletada() para refrescar
```

---

## Flujo 4: Importar CV con IA

```
FRONTEND                          BACKEND
─────────                         ───────
Preferencias (tab 6)
  │
  ├─ Usuario selecciona archivo .md
  ├─ Click "Analizar CV"
  │
  │  POST /api/preferencias/importar-cv/analizar
  │  Content-Type: multipart/form-data
  │  Body: archivo .md (máx 1MB)
  │
  │                               controlador-preferencias
  │                                 ├─ multer: memoryStorage
  │                                 ├─ Validar: solo .md, ≤ 1MB
  │                                 ├─ Leer contenido
  │                                 ├─ Recortar a 15000 caracteres
  │                                 │
  │                                 ├─ consultarDeepSeek(
  │                                 │     modelo: 'deepseek-v4-pro',
  │                                 │     systemPrompt: extractor de perfiles,
  │                                 │     userPrompt: contenido CV
  │                                 │   )
  │                                 │
  │                                 ├─ Limpiar code blocks (```json)
  │                                 ├─ Parsear JSON
  │                                 ├─ Validar estructura
  │                                 │
  │                                 └─ Responder con:
  │                                      nombre, nivel, perfil, idioma,
  │                                      modalidad, zonas, salario,
  │                                      inglés detallado, tecnologías[],
  │                                      roles[], términos[], reglas[],
  │                                      keywords, scoring, preguntas[],
  │                                      advertencias[]
  │
  ├─ Muestra vista previa del resultado
  ├─ El usuario revisa y ajusta
  ├─ Acepta/ignora sugerencias por campo
  ├─ Responde preguntas pendientes
  │
  └─ Click "Aplicar" → carga en el formulario
       │
       └─ Luego "Guardar" → PUT /api/preferencias
```

---

## Flujo 5: Modo Demo

```
FRONTEND                          BACKEND
─────────                         ───────
Login
  │
  ├─ Click "Entrar como invitado"
  │
  ├─ DemoService.activarDemo()
  │   └─ sessionStorage.setItem('busca-empleos.demo', 'true')
  │
  ├─ Navega a /
  │
  ├─ AuthGuard: DemoService.esModoDemo() → true
  │
  ├─ Dashboard.ngOnInit():
  │   └─ DemoService.obtenerOfertasDemo()
  │       └─ OFERTAS_DEMO (25 ofertas mock)
  │
  ├─ PanelControl: botones deshabilitados
  │   └─ Tooltip: "No disponible en modo demo"
  │
  ├─ Preferencias: carga perfil mock
  │   └─ Botón "Guardar" muestra toast "No disponible en modo demo"
  │
  └─ Banner amarillo en todas las páginas:
      "MODO DEMO — Datos de ejemplo"
```

---

## Flujo 6: Autenticación completa

```
┌────────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Angular   │     │ Firebase │     │ Express  │     │ Firebase │
│  Frontend  │     │  Auth    │     │ Backend  │     │  Admin   │
└─────┬──────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
      │                  │               │                 │
      │ 1. signInWithPopup(Google)       │                 │
      │─────────────────►│               │                 │
      │                  │               │                 │
      │ 2. Firebase ID Token (JWT)       │                 │
      │◄─────────────────│               │                 │
      │                  │               │                 │
      │ 3. GET /api/ofertas              │                 │
      │ Authorization: Bearer <jwt>      │                 │
      │──────────────────────────────────►                 │
      │                  │               │                 │
      │                  │     4. admin.auth().verifyIdToken(jwt)
      │                  │               │────────────────►│
      │                  │               │                 │
      │                  │     5. token decodificado       │
      │                  │               │◄────────────────│
      │                  │               │                 │
      │                  │  6. Verificar email ===         │
      │                  │     EMAIL_AUTORIZADO             │
      │                  │               │                 │
      │ 7. 200 OK con datos              │                 │
      │◄─────────────────────────────────│                 │
      │                  │               │                 │
```

---

## Mecanismos clave de resiliencia

| Mecanismo | Capa | Descripción |
|-----------|------|-------------|
| **Cache de evaluaciones** | Backend | SHA-256 de oferta + preferencias + modelo. Evita re-evaluar igual. |
| **Cache de dashboard** | Frontend | localStorage. Permite mostrar datos sin backend. Excluye `datos_crudos`. |
| **Optimistic updates** | Frontend | Postulación cambia en UI antes de respuesta HTTP. Revert en error. |
| **Deduplicación** | Backend | `UNIQUE(url)` + `ON CONFLICT DO NOTHING`. |
| **Resiliencia de scraping** | Backend | Si una plataforma falla, continúa con la siguiente. |
| **Rate limiting** | Backend | 5 req/min en endpoints costosos. Desactivado en tests. |
| **Fire-and-forget** | Backend | Evaluación se lanza sin await. Progreso por polling. |
| **Rehidratación** | Frontend | Si se detecta evaluación activa al cargar, reanuda polling. |
| **Cancelación** | Backend | Bandera booleana chequeada entre ofertas. Limpia intervalo. |
| **Modo demo** | Frontend | Funciona sin backend. Usa sessionStorage. |
