# Scraping — Busca Empleos

## Preferencias comunes por ejecución (issue #13)

Resuelvo opciones explícitas válidas > términos guardados > defaults solo ante
campo/fila ausente, con `servicio-configuracion-busqueda.js`. Leo mediante SELECT
para no crear preferencias al previsualizar. Si la lectura falla, detengo la
preparación; no ejecuto una búsqueda distinta silenciosamente. Vacío persistido
conserva su significado aunque PUT preferencias normalmente lo rechace.

LinkedIn, Computrabajo, Indeed, Bumeran, Glassdoor, Jooble y Adzuna usan términos
guardados tanto individualmente como en el ciclo. Mantengo la transformación de
palabras de Indeed/Bumeran/Jooble/Adzuna y la limpieza de Computrabajo; el resumen
informa esas transformaciones. LinkedIn construye URLs por término y zona guardada,
conservando nivel internship/entry-level y ventana de 14 días; ubicación explícita
prevalece en esa ejecución. Las otras integraciones mantienen ubicaciones fijas e
informan que no aplican zonas preferidas: Argentina, Buenos Aires/Argentina,
Remote (Jooble) o España (Adzuna), según la fuente.

Remotive mantiene categoría `software-dev`; RemoteOK mantiene tags
`frontend`, `react`, `angular`, `node`, `fullstack`, `javascript`, `qa`.
No afirmo que apliquen términos personalizados. Mantengo caps, credenciales,
ventanas, paginación y reglas de normalización existentes. Bumeran informa que
su actor no consume maxResultados. La preview autenticada muestra esos límites
sin hacer requests; no comprueba conectividad ni validez remota de credenciales.
GetOnBrd sigue bloqueado; Google Jobs e InfoJobs permanecen inactivos.

Comparto la limpieza de Computrabajo entre URL y validación: si algún término
queda vacío después de quitar signos, devuelvo 400 antes del primer request.
No genero `/trabajo-de-` ni sustituyo ese término por defaults. Conservo la
transformación actual y las guardas de palabras utilizables de las demás fuentes.

En Jooble/RemoteOK maxResultados es un umbral para dejar de pedir páginas/tags,
no un recorte estricto de lo ya recibido: incorporar una página/lote completo
puede superarlo. Conservo ese comportamiento y lo informo explícitamente en
`advertencias` de preview y ejecución. Las pruebas comparan la configuración
con el payload real simulado y conservan un overflow de 51 frente al umbral 50.

Antes de persistir comparto `filtrarOfertasPorIdioma` en individuales y ciclo,
que reutiliza sin modificaciones `detectarIdioma`: descarto solo lo detectado
como inglés. No cambio matching contextual #7, exclusiones ni deduplicación por
URL. El total extraído conserva descartadas; las cuento aparte de duplicadas.

## Preservación de frases, siglas y objetivos laborales (issue #14)

Con `servicio-traductor-consultas.js`, preservo frases laborales como unidades íntegras
(`soporte IT`, `mesa de ayuda`, `full stack node`, `frontend Angular`, `secretario médico`)
y siglas técnicas esenciales (`QA`, `IT`, `C#`, `.NET`), evitando fragmentarlas en palabras
sueltas o descartar términos cortos.

- **Equivalencias explícitas y acotadas:** Tabla controlada para términos frecuentes
  (`qa manual` ↔ `tester manual`, `soporte it` ↔ `mesa de ayuda` ↔ `help desk`,
  `frontend angular` ↔ `desarrollador angular`, `c#` ↔ `c sharp` ↔ `.net`).
- **Indeed:** Las frases compuestas se preservan entre comillas (`"react developer"`)
  unidas mediante `OR` en un único run del actor, evitando fragmentación genérica.
- **Bumeran:** Traduce `C#` a `c-sharp` y `.NET` a `net` para prevenir truncamiento por
  fragmento hash (`#`) en URLs; siglas como `QA` e `IT` generan URLs válidas.
- **Jooble y Adzuna:** Reciben las frases preservadas como unidades de búsqueda completas.
- **Remotive y RemoteOK:** Mapean dinámicamente los objetivos laborales del usuario a
  categorías (`software-dev`, `qa`, `customer-service`) y tags soportados (`qa`, `support`,
  `csharp`, `net`, `angular`, `node`), advirtiendo de forma visible si un objetivo no tiene
  representación compatible (ej. administrativo o salud).
- **LinkedIn:** Se agrega la opción persistente `filtrar_nivel_linkedin` en preferencias
  para activar o desactivar el filtro de nivel `f_E=1,2`, permitiendo mayor cobertura sin
  alterar el seniority real del candidato.
- **Resumen común (`ResumenBusqueda`):** Expone `consultasEfectivas` y `equivalenciasAplicadas`
  para brindar visibilidad de las transformaciones sin consultar APIs de pago.

## Reparto de cupos, límites estrictos y unificación de fechas (issue #16)

Resuelvo el desbordamiento de cupos brutos y la pérdida de términos posteriores mediante un reparto justo y conteo exclusivo de ofertas útiles y elegibles:

- **Definición de oferta elegible:** Oferta que normaliza válidamente, supera filtros de idioma, no es duplicada dentro de la ejecución (por URL canónica) y tiene fecha de publicación dentro de la ventana configurada (o no informada).
- **Reparto equitativo:**
  - **Jooble:** Round-robin por término, consultando página 1 de cada término compatible antes de profundizar a páginas siguientes. Evita que un término con repetidas o antiguas silencie las búsquedas posteriores (ej. `angular`).
  - **RemoteOK:** Distribución equitativa de cupo entre tags configurados (`cupoObjetivoPorTag = Math.ceil(maxResultados / terminos.length)`), evitando que el primer tag consuma todo el cupo.
  - **Computrabajo:** Deduplicación temprana de URLs de tarjetas en memoria con `Set` antes de solicitar detalles, con paginación acotada (`p=2`).
- **Límites estrictos (Hard Cap):** Ninguna fuente devuelve más ofertas que `maxResultados`. Toda fuente trunca determinísticamente su resultado final con `.slice(0, maxResultados)`.
- **Ventana de publicación unificada:** 30 días como valor por omisión (`DIAS_VENTANA_PUBLICACION = 30`), alineado con la base de datos y dashboard. Fuentes con limitación de API (LinkedIn, Glassdoor) informan `ventanaDias: 14`.
- **Sanitización de fechas:** Fechas inválidas (`Invalid Date`) y futuras (>24h) se sanitizan a `null` (publicación desconocida), evitando fallos de sintaxis en PostgreSQL.
- **Fechas relativas de Computrabajo:** Interpretación conservadora de expresiones temporales ("Hoy", "Ayer", "Hace X horas/días/semanas") preservando `fechaTexto` en `datos_crudos`.
- **Aislamiento en persistencia:** `guardarLoteOfertasAislado` protege cada inserción con `try/catch` para que un registro conflictivo no descarte el lote completo.
- **Métricas extendidas y UI:** El backend expone métricas completas (`consultasEjecutadas`, `consultasOmitidas`, `totalCrudos`, `totalElegibles`, `duplicadasDescartadas`, `antiguasDescartadas`, `sinFechaConocida`, `motivoFinalizacion`). La UI distingue visualmente la fecha de primera detección (`Det:`) de la fecha de publicación original (`Pub:`).

### Evidencia vertical sin proveedores reales

Con `cd backend && npm run test:vertical` pruebo los recorridos individual y ciclo
hasta el DOM Angular, usando controllers, resolver, scrapers, normalización,
filtro de idioma y modelos reales. Simulo sólo Firebase, `pg`, actores/datasets,
HTTP externo y SMTP; cron rechaza cualquier intento de programar tareas.
LinkedIn devuelve una oferta sintética en español y otra en inglés; las demás
fuentes activas devuelven lotes vacíos. GetOnBrd/Google Jobs/InfoJobs no hacen
llamadas externas. DeepSeek se reemplaza en `fetch`, no en el servicio de evaluación:
el ciclo ejercita reglas/parser, UPDATE, caché y lote terminal sin consumir APIs.
Conservo incluso las pausas existentes de Adzuna; no acelero el código productivo.

`backend/tests/helpers/bd-busquedas-memoria.js` reconoce únicamente SQL del recorrido.
Su modo vertical agrega sincronización, evaluación/caché/lotes y advisory locks
simulados; registra y rechaza consultas desconocidas. No es PostgreSQL: no verifica
sintaxis SQL general, `xmin`/MVCC, aislamiento/rollback, locks concurrentes,
constraints reales ni durabilidad tras reinicios. El filtro de fecha no se reproduce
porque todas las fixtures son recientes; la firma del snapshot es una serialización
en memoria, no `md5(string_agg(...))`. **PostgreSQL real y proveedores reales: NOT RUN.**

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

## GetOnBrd — piloto API-only bloqueado

El adaptador está **deshabilitado**: no hace scraping HTML, no usa Apify, no descarga
producción, no guarda en PostgreSQL y no figura como fuente activa de UI ni cron. El único
contrato implementado procesa sandbox/fixtures inyectables para validar el flujo.

La guarda acepta únicamente `https://sandbox.getonbrd.test/api/v0`. Cualquier otro host se
deniega antes de invocar al cliente. La producción requerirá en el futuro `GETONBRD_ENABLED=true`
**y** evidencia auditable con `evidence_id`, `received_at`, `allowed_host`, `scope` que incluya
`GET /api/v0/search/jobs`, `valid_until` vigente y `document_sha256` válido. El booleano aislado
no habilita nada.

### Límites y resultado del piloto

- `per_page=120`, hasta 10 páginas, 1.200 ítems y 5 segundos por solicitud.
- Ventana de 30 días; la URL pública canónica deduplica dentro de la corrida.
- El resultado incluye `run_id`, estado, motivo, checkpoint serializable y métricas de requests,
  páginas, ítems, normalización, ventana, duplicados, inválidos y latencia.
- Motivos: `paginas_agotadas`, `pagina_vacia`, `limite_items`, `limite_paginas`, `timeout`,
  `cancelacion`, `error_http`, `respuesta_invalida` o `politica_destino`.
- El checkpoint incluye `item_offset` para reanudar exactamente dentro de una página cuando se
  alcanza el límite de ítems. Timeout, cancelación y error conservan el último avance procesado.

### Rollout y rollback

No habilitar producción sin autorización escrita verificable revisada fuera del código. El rollout
debe empezar con sandbox y conservar la evidencia junto al cambio de configuración. Para rollback,
mantener `activa: false`, retirar cualquier configuración de evidencia y deshabilitar el endpoint;
no hay datos productivos que borrar.

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

### Flujo del piloto (`ejecutarScrapingGetonbrd`)

El servicio valida el destino antes de invocar el cliente inyectado. Cada página válida se
normaliza, se filtra por 30 días, se deduplica por URL canónica y confirma el checkpoint. Nunca
llama a `crearOferta`; el endpoint actual permanece bloqueado y responde el contrato vacío.

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/src/config/getonbrd.js` | Guarda deny-by-default, límites y evidencia de autorización. |
| `backend/src/servicios/servicio-scraping.js` | Procesa cliente inyectable, normalización, checkpoints y métricas sin persistencia. |
| `backend/src/servicios/servicio-normalizacion.js` | Transforma datos crudos de cada plataforma al formato de la tabla `ofertas`. |
| `backend/src/controladores/controlador-scraping.js` | Responde el contrato bloqueado de GetOnBrd sin invocar cliente ni BD. |

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
- Soporta todas las plataformas del registry (ver `backend/src/config/plataformas.js`), con normalización automática de slugs HTTP a ids internos (ej: `google-jobs` → `google_jobs`).

## Deduplicación por identidad canónica y gestión de reapariciones (issue #19)

### Deduplicación intra-ejecución en memoria
- Antes de entregar el array de ofertas normalizadas o aplicar el límite estricto `slice(0, maxResultados)`, cada scraper deduplica en memoria utilizando la identidad canónica calculada por `obtenerIdentidadCanonica()` (`servicio-identidad-ofertas.js`).
- Plataformas con identificadores específicos (Indeed `jk`, LinkedIn `jobId`, Computrabajo hash, Bumeran ID, etc.) son unificadas sin importar variaciones en dominios (`ar.indeed.com` vs `indeed.com`), rutas (`/viewjob` vs `/rc/clk`) o parámetros volátiles de tracking (`utm_source`, `refId`, etc.).
- Las ofertas repetidas dentro de la misma ejecución son descartadas tempranamente y registradas en la métrica `duplicadasDescartadas` (disponible en `resultado.metricas.duplicadasDescartadas` y como propiedad no enumerable).

### Reglas de calidad y persistencia de reapariciones
- La persistencia unificada se realiza a través de `guardarLoteOfertasAislado` (en `servicio-ingreso-ofertas.js`), consumido tanto por los controladores de scraping individual como por el ciclo de automatización (`servicio-automatizacion.js`).
- **Nuevas ofertas:** Persistidas con `es_nueva = true`, `resultado_persistencia = 'insertada'`, asignando `fecha_extraccion = NOW()` y `fecha_ultima_extraccion = NOW()`.
- **Reapariciones:**
  - `fecha_extraccion` histórica se preserva inalterada.
  - `fecha_ultima_extraccion` se actualiza al timestamp actual (`NOW()`).
  - El estado manual de postulación (`cv_enviado`, `en_proceso`, `descartada`) nunca se sobrescribe.
  - Si `origen_descripcion = 'manual'`, la descripción manual confirmada por el usuario nunca se sobrescribe.
  - Si la nueva extracción aporta una descripción más larga o completa modalidad o ubicación ausentes, se enriquecen dichos campos, la oferta pasa a `estado_evaluacion = 'pendiente'` y se marca `evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA'` sin disparar reevaluaciones automáticas de pago.
- **Nuevos contadores:**
  - `ofertas_nuevas` (`guardadas`): Ofertas insertadas por primera vez en la base de datos.
  - `ofertas_actualizadas` (`actualizadas`): Ofertas existentes cuyos datos fueron enriquecidos (descripción más larga, modalidad o ubicación completada).
  - `ofertas_reapariciones` (`reapariciones`): Ofertas existentes detectadas nuevamente sin cambios estructurales en sus datos esenciales.
  - `ofertas_duplicadas` (`duplicadas`): Suma de actualizadas y reapariciones, manteniendo compatibilidad hacia atrás con clientes y tests que esperan el total de ofertas preexistentes.

## Guardado en BD (en el controlador y automatización)

El controlador de scraping y el servicio de automatización orquestan el flujo completo:
1. Llaman al servicio de scraping → obtienen ofertas normalizadas y deduplicadas intra-ejecución.
2. Aplican `filtrarOfertasPorIdioma` para descartar ofertas en inglés.
3. Llaman a `guardarLoteOfertasAislado(ofertas, modeloOferta)` → persistencia atómica con upsert seguro por identidad canónica.
4. Discriminan contadores: `guardadas` (nuevas), `actualizadas` (enriquecidas), `reapariciones` (vistas nuevamente) y `duplicadas` (total preexistentes).
5. Responden con resumen JSON detallado.

## InfoJobs España — estado actual

InfoJobs queda preservado en el registry de plataformas con id interno `infojobs`, pero actualmente está marcado como `activa: false` porque el portal de developers está suspendido.

**Endpoint del controlador:** `POST /api/scraping/infojobs`
**Estado:** inactivo controlado.

Mientras permanezca inactivo, el controlador responde inmediatamente con `codigo_resultado: "PLATAFORMA_INACTIVA"` y no invoca `ejecutarScrapingInfojobs()` ni servicios externos.

La lógica histórica de API oficial, credenciales, filtro remoto y límite de resultados queda como referencia de implementación previa, pero no representa el comportamiento activo del sistema.

## Plataformas inactivas

El registry de plataformas (`backend/src/config/plataformas.js`) define qué plataformas están activas para scraping. Las inactivas son:

| Plataforma | id | slug HTTP | Razón |
|------------|-----|-----------|--------|
| Google Jobs | `google_jobs` | `google-jobs` | Desactivado por costo y baja utilidad |
| InfoJobs | `infojobs` | `infojobs` | Portal developers suspendido |
| GetOnBrd | `getonbrd` | `getonbrd` | Piloto API-only sin autorización verificable |

**Comportamiento cuando se invoca una plataforma inactiva:**

- El endpoint responde inmediatamente sin invocar Apify ni servicios externos.
- La respuesta incluye `codigo_resultado: "PLATAFORMA_INACTIVA"` y un `motivo` explicativo.
- El ciclo de automatización no incluye plataformas inactivas.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Schema de la tabla `ofertas`, deduplicación.
- [API REST](api-rest.md) — Endpoints POST de scraping.
- [Automatización](automatizacion.md) — Cómo el cron dispara scraping automáticamente.
