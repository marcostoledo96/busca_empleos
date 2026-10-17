# Arquitectura del sistema — Busca Empleos

## Descripción general

Sistema automatizado de uso personal que extrae ofertas de empleo de múltiples plataformas (LinkedIn, Computrabajo, Indeed, Bumeran, Glassdoor, GetOnBrd, Jooble, Remotive, RemoteOK, Adzuna, y más), las evalúa con IA (DeepSeek) para determinar si hacen match con mi perfil, y muestra los resultados en un dashboard web. Al finalizar cada ciclo, envía un resumen por email si las variables SMTP están configuradas.

## Diagrama de flujo general

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 12 Platafor-│────▶│  Scraping    │────▶│ Normalización│────▶│ PostgreSQL  │
│ mas (Apify +│     │  Service     │     │  Service     │     │   (ofertas) │
│  APIs libres│     └─────────────┘     └─────────────┘     └──────┬──────┘
└─────────────┘                                                     │
                                                                     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard   │◀────│   API REST   │◀────│  Evaluación  │◀────│  DeepSeek   │
│  (Angular)   │     │  (Express)   │     │   Service    │     │    (IA)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                    ┌─────────────────┐
                                    │ Notificación     │
                                    │ Email (nodemailer│
                                    │  soft-disable)   │
                                    └─────────────────┘
```

**Ciclo completo:** Scraping → Normalización → Guardado en BD (con deduplicación y filtro de idioma) → Evaluación IA → Notificación email → Dashboard.

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend / API | Node.js + Express | Express 5.2.1 |
| Scraping externo | API de Apify (`apify-client`) | 2.22.3 |
| Evaluación IA | API de DeepSeek (fetch nativo) | — |
| Extracción de CV PDF seleccionable | `pdf-parse` (PDF.js, sin OCR) | 2.4.5 |
| Scoring previo | Reglas determinísticas + bonus IA/Next.js | — |
| Base de datos | PostgreSQL (`pg` driver directo) | pg 8.20.0 |
| Automatización | `node-cron` | 4.2.1 |
| Notificación email | `nodemailer` | 7.x |
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
│   │   ├── servicios/       ← Lógica de negocio (scraping, IA, automatización, notificación email)
│   └── evaluacion/  ← Módulos internos de evaluación IA (parser-respuesta-ia, reglas-exclusion)
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
| **Servicios** | Lógica de negocio: scraping, normalización, evaluación, automatización, notificación email. | `servicio-scraping.js` |
| **Modelos** | Queries SQL parametrizadas. CRUD contra PostgreSQL. | `oferta.js` |
| **Config** | Conexiones y clientes externos (pool de PG, cliente Apify, función DeepSeek). | `base-datos.js` |

### Extracción temporal de documentos CV (issue #23)

En `POST /api/preferencias/importar-cv/extraer-texto` uso este recorrido sin modelo de datos:

```text
Firebase → limitador existente (5/min, compartido) → Multer en memoria
→ controlador-preferencias → servicio-extraccion-documento-cv → texto revisable
```

Valido extensión/MIME y hasta 5 MiB de archivo; en `validacion-documento-cv.js`
reutilizo el máximo vigente `MAX_BYTES_CV_BASE` de 1048576 bytes UTF-8 para el texto.
Decodifico Markdown con UTF-8 fatal, conservo sus bytes textuales y rechazo caracteres
inválidos. Para PDF compruebo encabezado/cierre y uso `new PDFParse({ data: buffer })`,
`getText()` de todas las páginas y `destroy()` en `finally`. Exijo que la cantidad y
numeración de páginas coincidan; ante error de parseo o páginas faltantes no devuelvo
texto exitoso. PDF.js puede recuperar un documento omitiendo comandos desconocidos o
contenido de página inaccesible aun con `stopAtErrors`; esos casos pueden conservar
la numeración y devolver texto vacío para la página afectada. Por eso rechazo también
la mezcla de páginas con texto y páginas vacías/solo espacios mediante HTTP422
`EXTRACCION_INCOMPLETA`, sin resultado parcial. Esta política conservadora rechaza
incluso páginas legítimamente en blanco o escaneadas mezcladas con texto: ofrezco pegar
el contenido manualmente. No certifico detección de corrupción arbitraria ni pérdida
parcial dentro de una página que aún tenga texto. No intercepto la consola global ni
agrego un validador PDF general. Uno el texto de las páginas, no los marcadores
decorativos; si todas quedan vacías conservo `SIN_TEXTO_EXTRAIBLE`. No hago OCR ni
extracción en navegador.

Mantengo bytes y resultado solo en memoria durante la solicitud, sin almacenar
originales ni cambiar CV base, perfil confirmado, ofertas, postulaciones o notas.
No llamo a DeepSeek ni registro el contenido o los errores privados del lector;
respondo errores sanitizados con la alternativa de pegar texto manualmente. El
análisis Markdown existente es una operación posterior separada, conserva modelo
y presupuesto propio más pequeño y no recibe binarios. El límite de extracción
no garantiza que un texto entre en el presupuesto del análisis IA.

La biblioteca `pdf-parse` 2.4.5 declara Node `>=20.16.0 <21` o `>=22.3.0`, compatible
por declaración con Node22.20 del proyecto. Verifiqué el lector real en Node24.18.0;
**no ejecuté Node22**. En Jest cargo el mismo worker real mediante el `createRequire`
nativo de Node y `globalThis.pdfjsWorker`, para evitar el `import()` dentro de la VM
de Jest sin agregar flags experimentales ni simular PDFs válidos, vacíos o corruptos.
Las pruebas sintéticas posicionan texto dentro de páginas reales, incluida la prueba
que excede el límite textual; no incorporo un generador PDF como dependencia de producción.

### Patrón container-presentational (frontend)

- **Container** (`Dashboard`): Orquesta, inyecta servicios, maneja estado con signals.
- **Presentational** (`PanelControl`, `TablaOfertas`, `DetalleOferta`): Reciben datos por `input()`, emiten eventos por `output()`. Sin lógica de negocio.

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
| `CURSOR_SINCRONIZACION_SECRETO` | Secreto HMAC de los cursores de sincronización; obligatorio en producción. Si falta en desarrollo/test se usa uno efímero con warning, por lo que los cursores se invalidan al reiniciar. Al rotarlo, descarto el cursor pendiente y reinicio la sincronización. |
| `SMTP_HOST` | Servidor SMTP para notificaciones por email (ej: `smtp.gmail.com`) |
| `SMTP_PORT` | Puerto SMTP (465 SSL, 587 STARTTLS). Default: 587 |
| `SMTP_USER` | Usuario SMTP para autenticación |
| `SMTP_PASS` | Contraseña de aplicación SMTP |
| `SMTP_FROM` | Email remitente (default: `SMTP_USER`) |
| `EMAIL_NOTIFICACION_DESTINO` | Email destino para resúmenes de ciclo |

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
