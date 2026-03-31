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
| Indeed | bebity/indeed-scraper | `TrtlecxAsNRbKl1na` | ~$0.001/resultado | — |
| Bumeran | apify/cheerio-scraper (genérico) | `YrQuEkowkqqFoyaIT` | GRATIS (actor genérico) | — |

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
    'frontend developer junior',
    'react developer',
    'angular developer',
    'desarrollador web junior',
    'fullstack junior',
    'tester qa',
    'soporte it',
];
```

## Construcción de URLs

### LinkedIn

Cada término se convierte en una URL de búsqueda pública de LinkedIn con filtros de nivel de experiencia:

```
https://www.linkedin.com/jobs/search/?keywords={termino}&location={ubicacion}&f_E=1%2C2
```

- `f_E=1%2C2` → Filtro de nivel: **Internship (1) + Entry level (2)**.
- Ubicación default: "Argentina".
- Se generan 7 URLs (una por término).

### Computrabajo

Cada término se convierte al formato de URL de Computrabajo:

```
https://www.computrabajo.com.ar/trabajo-de-{termino-con-guiones}
```

- Espacios se reemplazan por guiones.
- Se generan 7 URLs (una por término).

### Bumeran

Cada término se convierte al formato de URL de búsqueda de Bumeran:

```
https://www.bumeran.com.ar/empleos-busqueda-{termino-con-guiones}.html
```

- Espacios se reemplazan por guiones.
- Se generan 7 URLs (una por término).
- **Indeed** no necesita construcción de URLs: el actor recibe los términos directamente como `queries`.

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
1. Preparar queries con los términos de búsqueda
2. Llamar al actor de Apify con .call()
   - Parámetros: queries (array de strings), location: "Argentina", maxItems
3. Obtener items del dataset
4. Normalizar al formato de nuestra tabla
5. Retornar ofertas normalizadas
```

Opciones configurables: `maxResultados` (default: 100), `terminos`.

### Bumeran (`ejecutarScrapingBumeran`)

```
1. Construir URLs de búsqueda (7 URLs de bumeran.com.ar)
2. Llamar al actor cheerio-scraper genérico con .call()
   - Parámetros: startUrls, pageFunction (scraping de tarjetas de búsqueda)
   - La pageFunction usa selectores semánticos de Bumeran (h2 a[href*="/empleos/"])
3. Obtener items del dataset
4. Normalizar al formato de nuestra tabla
5. Retornar ofertas normalizadas
```

Opciones configurables: `terminos`.

**Nota sobre Bumeran:** Se usa `apify/cheerio-scraper` (actor genérico) porque no existe un actor dedicado. El scraping se hace en un solo paso desde las tarjetas de la página de resultados, sin visitar cada oferta individual. Las tarjetas tienen toda la info necesaria (título, empresa, ubicación, modalidad, fecha).

## Normalización de datos

Archivo: `backend/src/servicios/servicio-normalizacion.js`

Cada plataforma devuelve datos en un formato distinto. El servicio de normalización es el "traductor" que convierte todo al formato unificado de la tabla `ofertas`.

### Mapeo de campos

| Campo destino | LinkedIn | Computrabajo | Indeed | Bumeran |
|--------------|----------|-------------|--------|--------|
| `titulo` | `item.title` | `item.title` | `item.positionName` | `item.titulo` |
| `empresa` | `item.companyName` | `item.company` | `item.company` | `item.empresa` |
| `ubicacion` | `item.location` | `item.location` | `item.location` | `item.ubicacion` |
| `modalidad` | Detectada por `detectarModalidad()` | `null` | `null` | `mapearModalidadBumeran(item.modalidad)` |
| `descripcion` | `item.descriptionText` | `item.descriptionText` | `item.description` | `item.detalle` |
| `url` | `item.link` | `item.url` | `item.url` | `item.url` |
| `plataforma` | `'linkedin'` | `'computrabajo'` | `'indeed'` | `'bumeran'` |
| `nivel_requerido` | `mapearNivelLinkedin(item.seniorityLevel)` | `null` | `null` | `null` |
| `salario_min/max` | `parsearSalario(item.salary)` | `null` | `parsearSalario(item.salary)` | `null` |
| `moneda` | Detectada en `parsearSalario()` | `null` | Detectada en `parsearSalario()` | `null` |
| `fecha_publicacion` | `item.postedAt` | `item.postedDate` | `null` | `item.fechaPublicacion` |
| `datos_crudos` | `item` completo | `item` completo | `item` completo | `item` completo |

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
- Soporta 4 plataformas: `linkedin`, `computrabajo`, `indeed`, `bumeran`.

## Guardado en BD (en el controlador)

El controlador de scraping orquesta el flujo completo:
1. Llama al servicio de scraping → obtiene ofertas normalizadas.
2. Llama a `crearOferta()` por cada oferta → guarda en BD.
3. Cuenta nuevas vs. duplicadas (deduplicación por URL).
4. Responde con resumen JSON.

El guardado está en el controlador (no en el servicio) para mantener la separación de responsabilidades: el servicio solo extrae y normaliza, el controlador orquesta.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Schema de la tabla `ofertas`, deduplicación.
- [API REST](api-rest.md) — Endpoints POST de scraping.
- [Automatización](automatizacion.md) — Cómo el cron dispara scraping automáticamente.
