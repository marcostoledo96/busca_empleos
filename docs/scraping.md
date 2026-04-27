# Scraping — Busca Empleos

## Qué es y por qué se usa Apify

Apify es una plataforma en la nube que ejecuta "Actores" (scripts de scraping) en sus servidores. En vez de hacer scraping directo desde nuestra PC (arriesgándonos a bloqueos de IP), le mandamos la orden a Apify, sus servidores ejecutan el scraping, y nosotros recibimos los resultados en JSON.

**Librería:** `apify-client` (npm).
**API key:** Variable de entorno `APIFY_TOKEN`.

## Actores de Apify

| Plataforma | Actor | ID | Costo | Rating |
|-----------|-------|-----|-------|--------|
| LinkedIn | curious_coder/linkedin-jobs-scraper | `hKByXkMQaC5Qt9UMN` | ~$0.001/resultado | 4.9 (38K usuarios) |
| Computrabajo | shahidirfan/Computrabajo-Jobs-Scraper | `270QqNecZlrnDMveb` | GRATIS | — |
| Indeed | valig/indeed-jobs-scraper | `TrtlecxAsNRbKl1na` | ~$0.08/1000 resultados | 5.0 (3.1K usuarios) |
| Bumeran | apify/web-scraper (genérico + Puppeteer) | `apify/web-scraper` | GRATIS (actor genérico) | — |
| Glassdoor | cheap_scraper/glassdoor-jobs-scraper-remove-duplicate-jobs | `bYSAbQqxwImLaf2nb` | ~$0.001/resultado + $0.05 fijo | 5.0 (187 usuarios) |

## GetOnBrd — API pública gratuita (sin Apify)

GetOnBrd es un portal de empleos tech de América Latina que expone una API REST pública y sin autenticación.

**URL base:** `https://www.getonbrd.com/api/v0`
**Endpoint:** `GET /search/jobs?query={termino}&page={n}`
**Costo:** Gratuito, sin API key, sin Apify.
**Paginación:** `meta.total_pages` indica el total de páginas; 120 items por página.

### Estructura de la respuesta

Cada item de búsqueda devuelve objetos con esta estructura:

```json
{
  "id": "node-developer-40900",
  "type": "job",
  "attributes": {
    "title": "Node.js Developer",
    "description": "...",
    "remote_modality": "fully_remote",
    "salary_min": 2000,
    "salary_max": 3000,
    "published_at": 1700000000
  },
  "relationships": {
    "seniority": {
      "data": { "id": "2" }
    }
  },
  "links": {
    "public_url": "https://www.getonbrd.com/jobs/programming/node-developer-40900"
  }
}
```

**Nota:** El endpoint de búsqueda NO devuelve el nombre de la empresa. El campo `empresa` siempre queda en `null` para GetOnBrd.

### Mapeo de modalidades GetOnBrd

| `remote_modality` | Nuestro valor |
|-------------------|---------------|
| `fully_remote` / `remote_local` | `'remoto'` |
| `hybrid` | `'hibrido'` |
| `no_remote` | `'presencial'` |
| Otro / null | `null` |

### Mapeo de seniority GetOnBrd

| ID | Nuestro valor |
|----|---------------|
| `"1"` | `'trainee'` |
| `"2"` | `'junior'` |
| `"3"` | `'semi-senior'` |
| `"4"` / `"5"` | `'senior'` |
| Otro | `null` |

### Flujo del scraping (`ejecutarScrapingGetonbrd`)

```
1. Por cada término de búsqueda:
   a. Página 1: GET /search/jobs?query={termino}&page=1
   b. Leer meta.total_pages para saber cuántas páginas hay
   c. Paginar mientras haya más páginas Y no se llegue a maxResultados
2. Acumular todos los items crudos
3. Normalizar con normalizarLote(items, 'getonbrd')
4. Retornar ofertas normalizadas
```

**Diferencia clave con los otros scrapers:** No usa Apify ni `apify-client`. Usa `fetch()` nativo de Node.js 22.

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/src/config/apify.js` | Cliente Apify, IDs de actores, términos de búsqueda, construcción de URLs. |
| `backend/src/servicios/servicio-scraping.js` | Orquesta scraping: llama al actor, espera resultados, pasa a normalización. |
| `backend/src/servicios/servicio-normalizacion.js` | Transforma datos crudos de cada plataforma al formato de la tabla `ofertas`. |
| `backend/src/controladores/controlador-scraping.js` | Recibe request HTTP, llama al servicio, guarda en BD, responde con resumen. |

## Términos de búsqueda

Configurados en `config/apify.js`:

```javascript
const TERMINOS_BUSQUEDA = [
    'tester',
    'qa',
    'it',
    'soporte it',
    'helpdesk',
    'desarrollador',
    'developer',
    'frontend',
    'soporte tecnico',
];
```

Estos términos están en español (con excepción de `qa`, `it`, `developer` y `frontend` que se usan igual en ambos idiomas) porque las plataformas locales (Computrabajo, Bumeran) funcionan mejor con búsquedas en castellano.

## Construcción de URLs

### LinkedIn

Cada término se convierte en una URL de búsqueda pública de LinkedIn con filtros de nivel de experiencia:

```
https://www.linkedin.com/jobs/search/?keywords={termino}&location={ubicacion}&f_E=1%2C2
```

- `f_E=1%2C2` → Filtro de nivel: **Internship (1) + Entry level (2)**.
- Ubicación default: "Argentina".
- Se generan 9 URLs (una por término).

### Computrabajo

Cada término se convierte al formato de URL de Computrabajo:

```
https://www.computrabajo.com.ar/trabajo-de-{termino-con-guiones}
```

- Espacios se reemplazan por guiones.
- Se generan 9 URLs (una por término).

### Bumeran

Cada término se convierte al formato de URL de búsqueda de Bumeran:

```
https://www.bumeran.com.ar/empleos-busqueda-{termino-con-guiones}.html
```

- Espacios se reemplazan por guiones.
- Se generan 9 URLs (una por término).
- **Indeed** no necesita construcción de URLs: el actor recibe los términos directamente como parámetro `title`.

## Flujo del scraping

### LinkedIn (`ejecutarScrapingLinkedin`)

```
1. Construir URLs de búsqueda (7 URLs)
2. Llamar al actor de Apify con .call()
   - Parámetros: urls, count (max resultados), scrapeCompany: false
   - .call() ESPERA a que el actor termine (puede tardar 1-2 minutos)
3. Obtener items del dataset del actor
4. Normalizar al formato de nuestra tabla
5. Retornar ofertas normalizadas
```

Opciones configurables: `maxResultados` (default: 100), `terminos`, `ubicacion`.

### Computrabajo (`ejecutarScrapingComputrabajo`)

```
1. Construir URLs de búsqueda (7 URLs)
2. Llamar al actor de Apify con .call()
   - Parámetros: startUrls (array de { url }), maxItems
3. Obtener items del dataset
4. Normalizar al formato de nuestra tabla
5. Retornar ofertas normalizadas
```

Opciones configurables: `maxResultados` (default: 50), `terminos`.

### Indeed (`ejecutarScrapingIndeed`)

```
1. Iterar sobre los términos de búsqueda
2. Por cada término, llamar al actor de Apify con .call()
   - Parámetros: title (keyword), country: 'ar' (ISO 2-letter), limit
3. Obtener items del dataset de cada ejecución
4. Concatenar todos los items crudos
5. Normalizar al formato de nuestra tabla
6. Retornar ofertas normalizadas
```

Opciones configurables: `maxResultados` (default: 100), `terminos`.

### Bumeran (`ejecutarScrapingBumeran`)

```
1. Construir URLs de búsqueda (7 URLs de bumeran.com.ar)
2. Llamar al actor web-scraper genérico con .call()
   - Parámetros: startUrls, pageFunction (scraping con jQuery), proxyConfiguration
   - web-scraper usa Puppeteer (Chrome headless) — NECESARIO porque Bumeran
     es una SPA React que requiere JavaScript para renderizar las tarjetas.
   - jQuery se inyecta automáticamente (injectJQuery: true por default).
   - Espera a networkidle2 antes de ejecutar la pageFunction.
3. La pageFunction extrae datos de las tarjetas usando selectores semánticos
   (aria-label, IDs con patrón, tags h2/h3) porque las clases CSS de Bumeran
   son hashes de styled-components que cambian en cada deploy.
4. Obtener items del dataset
5. Aplanar resultados (la pageFunction retorna arrays por página)
6. Normalizar al formato de nuestra tabla
7. Retornar ofertas normalizadas
```

Opciones configurables: `terminos`.

**Nota sobre Bumeran:** Se usa `apify/web-scraper` (actor genérico con Puppeteer) porque:
1. No existe un actor dedicado para Bumeran.
2. Bumeran es una SPA React — el HTML del servidor es un `<div id="root">` vacío que necesita JavaScript para renderizar las ofertas.
3. `cheerio-scraper` (HTTP puro sin JS) NO funciona porque recibe el HTML sin renderizar.
4. `web-scraper` abre un Chrome headless, ejecuta JavaScript, espera a que React renderice, y recién ahí corre la pageFunction con jQuery.

El scraping se hace en un solo paso desde las tarjetas de la página de resultados, sin visitar cada oferta individual. Las tarjetas tienen toda la info necesaria (título, empresa, ubicación, modalidad, descripción).

### Glassdoor (`ejecutarScrapingGlassdoor`)

```
1. Llamar al actor de Apify con .call()
   - Parámetros: keywords (array), location: 'Buenos Aires', country: 'Argentina',
     maxItems, saveOnlyUniqueItems: true, includeNoSalaryJob: true, datePosted: '14'
   - El actor maneja la deduplicación nativa (saveOnlyUniqueItems)
   - datePosted: '14' = últimos 14 días
2. Obtener items del dataset de la ejecución
3. Normalizar al formato de nuestra tabla
4. Retornar ofertas normalizadas
```

Opciones configurables: `maxResultados` (default: 50), `terminos`.

**Nota sobre Glassdoor:** Los resultados son muy ricos en datos: salarios percentilados
(baseSalary_min/max, baseSalary_pctSalary10/50/90), reviews de empleados, ratings
de CEO y empresa, descripción de beneficios. Todo eso queda en `datos_crudos` para
uso futuro. Solo se mapean los campos del schema de `ofertas`.

El campo `remoteWorkTypes` trae un array como `["Remote"]`, `["Hybrid"]` o `null`
(cuando la oferta es presencial pero no lo declara).

## Normalización de datos

Archivo: `backend/src/servicios/servicio-normalizacion.js`

Cada plataforma devuelve datos en un formato distinto. El servicio de normalización es el "traductor" que convierte todo al formato unificado de la tabla `ofertas`.

### Mapeo de campos

| Campo destino | LinkedIn | Computrabajo | Indeed | Bumeran | Glassdoor | GetOnBrd |
|--------------|----------|-------------|--------|--------|----------|----------|
| `titulo` | `item.title` | `item.title` | `item.title` | `item.titulo` | `item.title` | `item.attributes.title` |
| `empresa` | `item.companyName` | `item.company` | `item.employer?.name` | `item.empresa` | `item.company?.companyName` | `null` (no disponible) |
| `ubicacion` | `item.location` | `item.location` | `item.location` (city + countryName) | `item.ubicacion` | `item.location_city + item.location_state` | `item.attributes.country + item.attributes.city` |
| `modalidad` | Detectada por `detectarModalidad()` | `null` | `detectarModalidadIndeed(item)` | `mapearModalidadBumeran(item.modalidad)` | `detectarModalidadGlassdoor(item.remoteWorkTypes)` | `detectarModalidadGetonbrd(item.attributes.remote_modality)` |
| `descripcion` | `item.descriptionText` | `item.descriptionText` | `item.description?.text` | `item.detalle` | `item.description_text` | `item.attributes.description` |
| `url` | `item.link` | `item.url` | `item.url` | `item.url` | `item.jobUrl` | `item.links.public_url` |
| `plataforma` | `'linkedin'` | `'computrabajo'` | `'indeed'` | `'bumeran'` | `'glassdoor'` | `'getonbrd'` |
| `nivel_requerido` | `mapearNivelLinkedin(item.seniorityLevel)` | `null` | `detectarNivelIndeed(item)` | `null` | `null` | `mapearNivelGetonbrd(item.relationships.seniority.data.id)` |
| `salario_min/max` | `parsearSalario(item.salary)` | `null` | `item.baseSalary?.min/max` | `null` | `item.baseSalary_min/max` | `item.attributes.salary_min/max` |
| `moneda` | Detectada en `parsearSalario()` | `null` | `item.baseSalary?.currencyCode` | `null` | `item.salary_currency` | `'USD'` si hay salario, `null` si no |
| `fecha_publicacion` | `item.postedAt` | `item.postedDate` | `item.datePublished` | `item.fechaPublicacion` | `item.datePublished` | `new Date(item.attributes.published_at * 1000)` |
| `datos_crudos` | `item` completo | `item` completo | `item` completo | `item` completo | `item` completo | `item` completo |

#### `mapearModalidadBumeran(modalidad)`

Mapea las modalidades de Bumeran a nuestros valores:

| Bumeran | Nuestro valor |
|---------|---------------|
| Contiene "remoto" / "home office" / "distancia" | `'remoto'` |
| Contiene "híbrido" / "hibrido" | `'hibrido'` |
| Contiene "presencial" / "oficina" / "site" | `'presencial'` |
| Otro / null | `null` |

### Funciones auxiliares

#### `detectarModalidad(item)`

Detecta la modalidad de trabajo desde datos de LinkedIn:
1. Si `item.workRemoteAllowed === true` → `'remoto'`.
2. Si `item.workplaceTypes` contiene "remote" → `'remoto'`.
3. Si contiene "hybrid" → `'hibrido'`.
4. Si contiene "on-site" → `'presencial'`.
5. Si no hay dato → `null`.

#### `mapearNivelLinkedin(nivel)`

Mapea niveles de LinkedIn a nuestros valores:

| LinkedIn | Nuestro valor |
|----------|--------------|
| Internship / Intern | `trainee` |
| Entry level | `junior` |
| Associate | `semi-senior` |
| Mid-Senior level | `senior` |
| Otro / null | `null` |

#### `parsearSalario(salarioStr)`

Parsea strings de salario como `"$50,000.00/yr - $70,000.00/yr"`:
- Detecta moneda: `AR$` → ARS, `$` → USD, `€` → EUR.
- Extrae números, quita comas de miles.
- Retorna `{ min, max, moneda }` o todo null si no hay dato.

### Procesamiento por lotes (`normalizarLote`)

- Itera sobre el array de items crudos.
- Cada item se normaliza individualmente.
- Si un item falla (ej: sin URL), se loguea un warning y se salta.
- **Diseño resiliente:** es mejor tener 99 ofertas que 0 por un item roto.
- Soporta 9 plataformas: `linkedin`, `computrabajo`, `indeed`, `bumeran`, `glassdoor`, `getonbrd`, `jooble`, `google-jobs`, `infojobs`.

## Guardado en BD (en el controlador)

El controlador de scraping orquesta el flujo completo:
1. Llama al servicio de scraping → obtiene ofertas normalizadas.
2. Llama a `crearOferta()` por cada oferta → guarda en BD.
3. Cuenta nuevas vs. duplicadas (deduplicación por URL).
4. Responde con resumen JSON.

El guardado está en el controlador (no en el servicio) para mantener la separación de responsabilidades: el servicio solo extrae y normaliza, el controlador orquesta.

## InfoJobs España — API Oficial

InfoJobs es el portal de empleo más grande de España. A diferencia del resto de las plataformas (que usan Apify o APIs públicas sin auth), InfoJobs requiere registro de aplicación y usa autenticación HTTP Basic.

**Endpoint del controlador:** `POST /api/scraping/infojobs`
**Servicio:** `ejecutarScrapingInfojobs()` en `servicio-scraping.js`
**Costo:** API gratuita para proyectos personales (sujeta a rate limits).
**Tipo de fuente:** API REST oficial — no scraping HTML.

### Credenciales requeridas

Registrar una aplicación en el [Portal de desarrolladores de InfoJobs](https://developer.infojobs.net/) y agregar al `.env`:

```
INFOJOBS_CLIENT_ID=tu_client_id_aqui
INFOJOBS_CLIENT_SECRET=tu_client_secret_aqui
```

> Si ambas variables están ausentes, el endpoint retorna `[]` con una advertencia en el log (feature deshabilitada silenciosamente). Si solo una está presente, el servicio lanza error de configuración.

### Filtro estricto de modalidad remota

InfoJobs aplica el filtro en **dos capas** para garantizar remoto puro:

| Capa | Dónde | Cómo |
|------|-------|------|
| Capa 1 — en origen | Parámetro de la API | `teleworking=solo-teletrabajo` en la query |
| Capa 2 — en normalización | `servicio-normalizacion.js` | Descarta toda oferta cuyo `teleworking` no resuelva al texto `"Solo teletrabajo"` o `"solo-teletrabajo"`. Soporta string plano y objeto `{ id, value }` (prioriza `.value`). |

**Ofertas excluidas:** híbridas, presenciales y aquellas sin campo `teleworking` definido. Solo pasan las que sean remoto puro confirmado por ambas capas.

### Límite de resultados

El endpoint limita `maxResultados` a **50** (hardcodeado en el controlador y en el servicio), porque la API gratuita de InfoJobs tiene rate limits estrictos por aplicación.

### Estructura de la respuesta de la API

La API devuelve un JSON con la colección de ofertas. En la documentación oficial suele figurar como `offers`, aunque vimos variantes históricas o ejemplos con otras formas. La integración actual tolera `offers` como contrato principal y `items` como compatibilidad defensiva:

```json
{
  "currentPage": 1,
  "totalResults": 12,
  "offers": [
    {
      "id": "a1b2c3d4e5f6",
      "title": "Frontend Developer Junior",
      "author": { "name": "Empresa Ejemplo" },
      "locations": [{ "province": { "value": "Madrid" }, "city": "Madrid" }],
      "teleworking": { "id": 2, "value": "Solo teletrabajo" },
      "link": "https://www.infojobs.net/offerjob/a1b2c3d4e5f6"
    }
  ]
}
```

### Normalización de ubicación

La normalización tolera dos shapes de ubicación: `locations[0]` (contrato principal) o `city`/`province` al tope del item. Si hay ciudad y provincia, las combina como `${city}, ${province}`. Si solo hay uno de los dos valores, usa ese. Si no hay dato de ubicación, queda como `null`.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Schema de la tabla `ofertas`, deduplicación.
- [API REST](api-rest.md) — Endpoints POST de scraping.
- [Automatización](automatizacion.md) — Cómo el cron dispara scraping automáticamente.
