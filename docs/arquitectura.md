# Arquitectura del sistema — Busca Empleos

## Descripción general

Sistema automatizado de uso personal que extrae ofertas de empleo de LinkedIn y Computrabajo (vía API de Apify), las evalúa con IA (DeepSeek) para determinar si hacen match con mi perfil, y muestra los resultados en un dashboard web.

## Diagrama de flujo general

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Apify      │────▶│  Scraping    │────▶│ Normalización│────▶│ PostgreSQL  │
│ (LinkedIn +  │     │  Service     │     │  Service     │     │   (ofertas) │
│ Computrabajo)│     └─────────────┘     └─────────────┘     └──────┬──────┘
└─────────────┘                                                     │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard   │◀────│   API REST   │◀────│  Evaluación  │◀────│  DeepSeek   │
│  (Angular)   │     │  (Express)   │     │   Service    │     │    (IA)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Ciclo completo:** Scraping → Normalización → Guardado en BD (con deduplicación) → Evaluación IA → Dashboard.

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend / API | Node.js + Express | Express 5.2.1 |
| Scraping externo | API de Apify (`apify-client`) | 2.22.3 |
| Evaluación IA | API de DeepSeek (fetch nativo) | — |
| Base de datos | PostgreSQL (`pg` driver directo) | pg 8.20.0 |
| Automatización | `node-cron` | 4.2.1 |
| Seguridad HTTP | `helmet` | 8.1.0 |
| Rate limiting | `express-rate-limit` | 8.3.2 |
| Frontend | Angular + PrimeNG (tema Aura) | Angular 20.3, PrimeNG 20.4 |
| Testing backend | Jest + Supertest | Jest 30.3, Supertest 7.2 |
| Testing frontend | Jasmine + Karma | — |

## Estructura de carpetas

```
Busca_empleos/
├── backend/
│   ├── src/
│   │   ├── config/          ← Configuración (BD, Apify, DeepSeek)
│   │   ├── controladores/   ← Controladores de rutas Express (capa HTTP)
│   │   ├── servicios/       ← Lógica de negocio (scraping, IA, automatización)
│   │   ├── modelos/         ← Queries SQL parametrizadas contra PostgreSQL
│   │   ├── rutas/           ← Definición de rutas Express (Router)
│   │   ├── utils/           ← Middlewares de errores
│   │   ├── app.js           ← Configuración de Express (exporta la app)
│   │   └── index.js         ← Punto de entrada (levanta el servidor)
│   ├── sql/                 ← Scripts SQL (crear-tablas.sql)
│   ├── tests/               ← Tests con Jest
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── componentes/ ← Componentes presentacionales
│   │   │   ├── modelos/     ← Interfaces TypeScript
│   │   │   ├── paginas/     ← Componentes contenedores (Dashboard)
│   │   │   └── servicios/   ← Servicios HTTP (HttpClient)
│   │   └── environments/    ← Configuración de entorno
│   └── package.json
├── docs/                    ← Documentación técnica por módulo
├── AGENTS.md                ← Reglas de trabajo para agentes de IA
└── PLANIFICACION.md         ← Hoja de ruta del proyecto
```

## Patrones arquitectónicos

### Separación app.js / index.js

- **`app.js`**: Configura Express (middlewares, rutas, manejo de errores) y **exporta** la app.
- **`index.js`**: Importa la app y llama a `app.listen()`.
- **¿Por qué?** Los tests importan `app.js` sin levantar el servidor. Si todo estuviera en `index.js`, el servidor arrancaría automáticamente al correr los tests.

### Capas del backend

```
Request HTTP → Rutas → Controlador → Servicio → Modelo → PostgreSQL
```

| Capa | Responsabilidad | Ejemplo |
|------|----------------|---------|
| **Rutas** | Mapean URLs a controladores | `router.get('/', controlador.listarOfertas)` |
| **Controladores** | Traducen HTTP → llamada a servicio/modelo → respuesta JSON. Sin lógica de negocio. | `controlador-ofertas.js` |
| **Servicios** | Lógica de negocio: scraping, normalización, evaluación, automatización. | `servicio-scraping.js` |
| **Modelos** | Queries SQL parametrizadas. CRUD contra PostgreSQL. | `oferta.js` |
| **Config** | Conexiones y clientes externos (pool de PG, cliente Apify, función DeepSeek). | `base-datos.js` |

### Patrón container-presentational (frontend)

- **Container** (`Dashboard`): Orquesta, inyecta servicios, maneja estado con signals.
- **Presentational** (`TarjetasEstadisticas`, `PanelControl`, `TablaOfertas`, `DetalleOferta`): Reciben datos por `input()`, emiten eventos por `output()`. Sin lógica de negocio.

## Middlewares globales (app.js)

| Middleware | Propósito |
|-----------|----------|
| `helmet()` | Agrega headers de seguridad HTTP (X-Content-Type-Options, X-Frame-Options, HSTS, etc.) |
| `cors()` | Permite requests desde `http://localhost:4200` (el frontend Angular). Restringido por origin. |
| `express.json({ limit: '1mb' })` | Parsea body JSON. Límite de 1MB para prevenir payloads gigantes. |
| `rateLimit` (5 req/min) | Aplicado a `/api/scraping` y `/api/evaluacion`. Evita vaciar créditos de APIs pagas. Desactivado en tests (`NODE_ENV=test`). |

## Formato estándar de respuesta

Todas las respuestas de la API siguen este formato:

```json
{ "exito": true, "datos": { ... } }
{ "exito": false, "error": "Mensaje descriptivo" }
```

Algunos endpoints agregan campos extra como `total` o `mensaje`.

## Variables de entorno

Todas las credenciales se cargan desde `backend/.env` con `dotenv`. Nunca se hardcodean.

| Variable | Descripción |
|----------|------------|
| `PGHOST` | Host de PostgreSQL |
| `PGPORT` | Puerto de PostgreSQL |
| `PGUSER` | Usuario de PostgreSQL |
| `PGPASSWORD` | Contraseña de PostgreSQL |
| `PGDATABASE` | Nombre de la base de datos |
| `APIFY_TOKEN` | Token de autenticación de Apify |
| `DEEPSEEK_API_KEY` | API key de DeepSeek |
| `PUERTO` | Puerto del servidor Express (default: 3000) |
| `CORS_ORIGEN` | Orígenes permitidos para CORS (default: `http://localhost:4200`) |
| `NODE_ENV` | Entorno de ejecución (`development`, `test`, `production`) |

## Comandos principales

```bash
# Backend
cd backend && npm install     # Instalar dependencias
npm run dev                   # Iniciar con nodemon (reinicio automático)
npm start                     # Iniciar sin reinicio automático
npm test                      # Correr tests con Jest

# Frontend
cd frontend && npm install    # Instalar dependencias
ng serve                      # Iniciar servidor de desarrollo (localhost:4200)
ng build                      # Build para producción
ng test                       # Correr tests con Karma
```

## Documentos relacionados

- [Base de datos](base-de-datos.md) — Schema, modelo de datos, índices.
- [API REST](api-rest.md) — Endpoints, request/response, rate limiting.
- [Scraping](scraping.md) — Apify, actores, normalización de datos.
- [Evaluación IA](evaluacion-ia.md) — DeepSeek, prompts, criterios de evaluación.
- [Automatización](automatizacion.md) — Cron, ciclo completo.
- [Frontend](frontend.md) — Angular, componentes, servicios, routing.
