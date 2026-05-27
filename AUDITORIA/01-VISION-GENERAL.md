# 01 — Visión General del Proyecto

## Propósito

**Busca Empleos** es un sistema automatizado de uso personal que extrae ofertas de
empleo de múltiples plataformas, las evalúa con inteligencia artificial para
determinar si hacen "match" con el perfil del usuario, y muestra los resultados
en un dashboard web.

El proyecto fue construido por Marcos Ezequiel Toledo, desarrollador junior de
Buenos Aires, Argentina, como proyecto de aprendizaje y herramienta personal de
búsqueda laboral.

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Runtime** | Node.js | 22.20.0 |
| **Backend framework** | Express | 5.2.1 |
| **Lenguaje frontend** | TypeScript | 5.9.2 |
| **Frontend framework** | Angular | 20.3.0 |
| **UI library** | PrimeNG | 20.4.0 |
| **Tema PrimeNG** | Aura (customizado) | — |
| **Base de datos** | PostgreSQL | (driver `pg` 8.20.0) |
| **ORM** | Ninguno — SQL directo con `pg` | — |
| **Autenticación** | Firebase Auth (Google) | firebase-admin 13.7.0 |
| **Scraping externo** | Apify | apify-client 2.22.3 |
| **Scraping directo** | fetch nativo + Cheerio | cheerio 1.2.0 |
| **Evaluación IA** | DeepSeek v4 flash (vía OpenCode Go) | API REST compatible con OpenAI |
| **Automatización** | node-cron | 4.2.1 |
| **Testing backend** | Jest | 30.3.0 |
| **Testing frontend** | Jasmine + Karma | — |
| **Deploy backend** | Railway | PaaS |
| **Deploy frontend** | Vercel | PaaS |
| **Gestor de paquetes** | npm | — |

## Plataformas de scraping

| # | Plataforma | Tecnología | Estado |
|---|-----------|-----------|--------|
| 1 | LinkedIn | Apify actor | ✅ Activo |
| 2 | Computrabajo | Scraping directo (fetch + cheerio) | ✅ Activo |
| 3 | Indeed | Apify actor | ✅ Activo |
| 4 | Bumeran | Apify actor (puppeteer-scraper) | ✅ Activo |
| 5 | Glassdoor | Apify actor | ✅ Activo |
| 6 | GetOnBrd | API REST pública | ✅ Activo |
| 7 | Jooble | API REST oficial | ✅ Activo |
| 8 | Remotive | API REST pública | ✅ Activo |
| 9 | RemoteOK | API REST pública | ✅ Activo |
| 10 | Adzuna | API REST oficial | ✅ Activo |
| 11 | Google Jobs | Apify actor | ❌ Desactivado (costo ineficiente, ~USD 1.50 sin resultados útiles) |
| 12 | InfoJobs España | API REST oficial | ⚠️ Desactivado (portal developers cerró registro) |

## Flujo principal

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CICLO DE SCRAPING                            │
│                                                                     │
│  1. node-cron dispara (miércoles 8 AM ART) o usuario ejecuta manual │
│  2. Lee preferencias del usuario (términos de búsqueda)              │
│  3. Scrapea 10-11 plataformas en secuencia                           │
│  4. Normaliza cada oferta a formato canónico                        │
│  5. Deduplica por URL (INSERT ON CONFLICT DO NOTHING)               │
│  6. Filtra ofertas en inglés (descartar)                            │
│  7. Guarda en tabla `ofertas` con estado `pendiente`                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CICLO DE EVALUACIÓN                            │
│                                                                     │
│  1. Lee ofertas pendientes de la BD                                 │
│  2. Para cada oferta:                                               │
│     a. Calcula score previo determinístico (P0-P5)                  │
│     b. Si score < 30 → rechazo automático (sin IA)                  │
│     c. Si score ≥ 85 → aprobación automática (sin IA)               │
│     d. Si 30 ≤ score < 85 → llama a DeepSeek para refinar           │
│  3. Guarda resultado (estado, razón, porcentaje, score)             │
│  4. Cachea evaluación para no repetir con mismas prefs + oferta      │
│  5. Si se cancela, el loop se detiene en la siguiente iteración      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD                                   │
│                                                                     │
│  1. Frontend Angular consulta GET /api/ofertas con filtros          │
│  2. Muestra ofertas en tabs: Aprobadas, Postuladas, Rechazadas,     │
│     Pendientes                                                      │
│  3. Panel de control permite:                                       │
│     - Ejecutar scraping por plataforma                              │
│     - Ejecutar ciclo completo                                       │
│     - Ejecutar/cancelar evaluación IA                               │
│     - Activar/desactivar automatización semanal                     │
│  4. Vista detalle de cada oferta con opción de postularse            │
│  5. Página de preferencias para editar perfil, tecnologías, reglas  │
└─────────────────────────────────────────────────────────────────────┘
```

## Estructura del proyecto

```
Busca_empleos/
├── AUDITORIA/                     ← Documentación de auditoría (esta carpeta)
├── backend/
│   ├── .env.example               ← 21 variables de entorno
│   ├── package.json
│   ├── sql/                       ← 15 scripts SQL (migraciones)
│   ├── src/
│   │   ├── index.js               ← Punto de entrada
│   │   ├── app.js                 ← Configuración Express
│   │   ├── config/                ← Conexiones y clientes externos
│   │   ├── controladores/         ← Handlers de endpoints
│   │   ├── modelos/               ← Queries SQL
│   │   ├── rutas/                 ← Definición de rutas
│   │   ├── servicios/             ← Lógica de negocio
│   │   └── utils/                 ← Middlewares
│   └── tests/                     ← 16 archivos de test
├── frontend/
│   ├── angular.json
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── componentes/       ← 3 componentes reutilizables
│   │   │   ├── paginas/           ← 3 páginas lazy-loaded
│   │   │   ├── servicios/         ← 8 servicios Angular
│   │   │   ├── modelos/           ← Interfaces TypeScript
│   │   │   ├── guards/            ← Auth guard (CanActivateFn)
│   │   │   ├── interceptores/     ← HTTP interceptor (Bearer token)
│   │   │   └── datos/             ← Datos mock para modo demo
│   │   ├── environments/          ← Config por entorno
│   │   ├── index.html
│   │   └── styles.css             ← Design system global
│   └── ...
├── docs/                          ← Documentación del proyecto
│   ├── api-rest.md
│   ├── arquitectura.md
│   ├── automatizacion.md
│   ├── base-de-datos.md
│   ├── deploy.md
│   ├── evaluacion-ia.md
│   ├── frontend.md
│   └── scraping.md
├── AGENTS.md                      ← Reglas de trabajo del workspace
├── AGENTS_init.md                 ← Guía de referencia (solo lectura)
├── PLANIFICACION.md               ← Hoja de ruta (⚠️ desactualizada)
└── README.md
```

## Estado actual (mayo 2026)

El proyecto está **completo y en producción**. Backend deployado en Railway,
frontend en Vercel. La automatización semanal corre con node-cron.

La planificación (`PLANIFICACION.md`) está desactualizada — dice "Fase 0" pero
el proyecto ya pasó por 7 fases de desarrollo.

## Convenciones del proyecto

- **Lenguaje del código**: español argentino formal, primera persona
- **Interacción con el usuario**: español rioplatense informal
- **Conventional commits** en español
- **Rama principal**: `master`
- **Indentación**: 4 espacios (backend), 2 espacios (frontend)
- **Sin ORM**: queries SQL directas con parámetros `$1`, `$2`
- **Sin IA para commits**: nunca agregar `Co-Authored-By` ni atribución a IA
