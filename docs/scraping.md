# Scraping — Busca Empleos

## Resultado efectivo y presupuestos por fuente (issue #20, T1)

Conservo el array de ofertas y su propiedad **no enumerable** `metricas` en las
nueve fuentes activas. Un fallo del proveedor devuelve un array (posiblemente
vacío) con estado explícito, no un éxito vacío. Los errores de validación local
siguen rechazando antes del primer request. El consumidor debe leer `metricas`,
no inferir éxito a partir de `Array.isArray()` ni de que la promesa se resuelva.
Adzuna conserva además su objeto legacy cuando faltan ambas credenciales:
`{ deshabilitado, codigo_resultado, advertencia, ofertas, metricas }`; su estado
real es `sin_credenciales`, no una desactivación del registry.

### Contrato para ingestión y orquestación

- `plataforma`: id del registry.
- `estado`: `completada`, `sin_resultados`, `parcial`, `error`, `timeout` o
  `sin_credenciales`. Hay `parcial` cuando conservo ofertas útiles y hubo errores
  o un límite de peticiones/páginas que impidió completar la búsqueda.
- `errores`: array de `{ tipo, mensaje, codigoHttp?, consulta? }`. Los tipos son
  `http`, `limite_solicitudes`, `red`, `respuesta_invalida`, `timeout`, `cancelacion`,
  `actor` y `cancelacion_no_confirmada`. No guardo mensajes crudos, cuerpos de error
  ni URLs autenticadas. HTTP 429 nunca significa «sin resultados».
- `duracionMs`: tiempo de la operación de scraping, incluidas pausas; no incluye BD
  ni evaluación IA. `motivoFinalizacion` conserva los motivos de #16 cuando termina
  por cupos y agrega el tipo de fallo o `sin_credenciales` cuando corresponde.
- `consultasEjecutadas`: número de consultas distintas realmente enviadas, no las
  planificadas. `resultadosConsultas`: array de `{ consulta, estado,
  peticionesRealizadas, totalCrudos, totalElegibles, errores }`. Incluyo URLs públicas de búsqueda
  en LinkedIn/Bumeran/Computrabajo; query OR en Indeed; keywords y ubicación del
  lote en Glassdoor; término en Jooble; categoría en Remotive; tag efectivo en
  RemoteOK; `remote <término>` en Adzuna. Las páginas y detalles se agrupan bajo
  su búsqueda; los fallos de detalle quedan asociados a esa búsqueda.
- `peticionesRealizadas`: HTTP directo realmente intentado (incluidos fallos y
  detalles). Para Apify es `null`: el SDK y el Actor hacen peticiones internas que
  no puedo medir exactamente. Tampoco invento crudos por consulta del dataset
  agregado: `totalCrudos: null` por consulta Apify, contador agregado en la fuente.
  Decido `sin_resultados` por ofertas elegibles, no por crudos recibidos. En
  Computrabajo, Jooble, Remotive y RemoteOK atribuyo cada URL elegible a su primera
  consulta y cuento sólo las ofertas del array final, después de idioma, antigüedad,
  deduplicación y cupo. Si esa consulta conserva ofertas y tiene fallos, informo
  `parcial`, no `error`. En datasets agregados Apify y Adzuna no invento atribución:
  `totalElegibles: null` y `estado: null` cuando no puedo determinar el resultado
  elegible de esa consulta; los errores/timeout y vacíos verificables siguen explícitos.
  El resultado compartido por fuente recalcula elegibles y éxito vacío después del
  filtro de idioma de ingreso, sin borrar estados `error`, `timeout` o `parcial`.
  Si ese filtro invalida una atribución previa, la marco como no disponible (`null`).
- Conservo `maxResultados`, `ventanaDias`, `consultasOmitidas` y los contadores de
  #16/#19 cuando están disponibles: `totalCrudos`, `totalElegibles`,
  `duplicadasDescartadas`, `antiguasDescartadas`, `sinFechaConocida`.
  `idiomaDescartadas` cuenta el filtro que ya ejecutan las fuentes directas con
  elegibilidad; es `null` cuando el filtrado depende de la ingestión posterior.
  No invento insertadas, actualizadas, reapariciones, costos ni aprobadas de IA:
  ingestión debe agregar sus propios contadores verificables a nivel fuente.

T2 debe construir `deshabilitada` con el motivo del registry **antes** de invocar
adaptadores inactivos, compartir este resultado entre individual/ciclo/cron y
continuar las fuentes siguientes. GetOnBrd requiere habilitación explícita y evidencia
pública conservada válida; Google Jobs sigue desactivado por costo y baja utilidad;
InfoJobs sigue deshabilitado. Activa sólo significa que se puede intentar
consultar, no que la integración esté operativa ni que haya respondido bien.

### Límites y cancelación

Uso 180 s por fuente y 15 s por HTTP directo, incluyendo `json()`/`text()`.
Los controles internos opcionales `timeoutMs`, `timeoutPeticionMs` y `signal`
permiten reducir (nunca ampliar) esos máximos y probar con reloj simulado; no son
preferencias persistidas ni nuevos campos HTTP. Aborto el fetch real, descarto
respuestas tardías y verifico el plazo antes de nuevas peticiones. Incluyo pausas
(300 ms por lote de Computrabajo y 2500 ms en Adzuna), sin cambiar cupos ni actores.
Una promesa simulada que ignora AbortSignal puede seguir pendiente, pero su lectura
no incorpora ofertas ni modifica telemetría después de terminar la fuente.

Verifiqué tipos y código instalado de **apify-client 2.22.3**:
`ActorClient.call(input, { timeout, waitSecs })` aplica `timeout` al run remoto y
`waitSecs` sólo a la espera local; no rechaza por `FAILED`/`ABORTED`/`TIMED-OUT`.
Mantengo los mismos actores e inputs; agrego únicamente opciones de tiempo:
run remoto hasta 120 s (menor si falta margen), espera inicial 1 s y polling de
`run(id).get()` con pausas de 1 s. Reservo 45 s para operaciones HTTP finales y
abort. En el cliente compartido autorizado fijo `timeoutSecs: 15, maxRetries: 0`:
acoto el HTTP del SDK y evito repetir un POST de arranque con resultado incierto.
No uso carreras de promesas alrededor del SDK ni tareas desacopladas de persistencia.

`RunClient.abort()` está soportado; uso su modo inmediato, no `gracefully`, para
no agregar el período de gracia de un Actor que podría seguir trabajando.
Sólo un estado terminal confirma finalización; `ABORTING` o un fallo del abort
produce `cancelacion_no_confirmada`. Si el arranque falla sin devolver run id,
no puedo confirmar abort remoto: no reintento y el timeout remoto solicitado es
la protección restante (no una cancelación confirmada). El SDK no expone
AbortSignal para estas operaciones: una cancelación local espera a que termine
la operación HTTP en curso, acotada por el SDK, y luego detiene/consulta el run.
El resultado no acredita escrituras externas o cancelación que no pude verificar.

Pruebo exclusivamente proveedores simulados y reloj controlado. La persistencia,
el historial, el cron y la presentación Angular se verifican en las unidades de
integración posteriores, no desde este adaptador.

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
GetOnBrd usa términos guardados y habilitación efectiva; Google Jobs e InfoJobs permanecen inactivos.

Comparto la limpieza de Computrabajo entre URL y validación: si algún término
queda vacío después de quitar signos, devuelvo 400 antes del primer request.
No genero `/trabajo-de-` ni sustituyo ese término por defaults. Conservo la
transformación actual y las guardas de palabras utilizables de las demás fuentes.

En Jooble/RemoteOK `maxResultados` es un cupo de ofertas elegibles con recorte
estricto del array final desde #16. Los crudos recibidos pueden superar ese cupo;
no los confundo con la cantidad de ofertas retornadas.

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
| Computrabajo | HTTP directo + Cheerio (no ejecuto el Actor legado) | — | Sin costo Apify | — |
| Indeed | valig/indeed-jobs-scraper | `TrtlecxAsNRbKl1na` | ~$0.08/1000 resultados | 5.0 (3.1K usuarios) |
| Bumeran | apify/puppeteer-scraper | `apify/puppeteer-scraper` | Compute del Actor; sin consumo exacto medido | — |
| Glassdoor | cheap_scraper/glassdoor-jobs-scraper-remove-duplicate-jobs | `bYSAbQqxwImLaf2nb` | ~$0.001/resultado + $0.05 fijo | 5.0 (187 usuarios) |

## GetOnBrd — API pública con habilitación controlada

Mantengo la fuente apagada por defecto. Para habilitarla configuro `GETONBRD_ENABLED=true`
y reinicio el backend. La evidencia queda en `backend/src/config/evidencias/getonbrd/`,
dentro del root de despliegue `backend`, sin copiar recursos externos. La guarda
comprueba los SHA-256 de los **bytes de cada extracto conservado**, host y alcance exactos,
fecha de consulta no futura y vencimiento solo si existe. Un archivo ausente, alterado o una
configuración inválida bloquea la fuente antes de consultar. No invento permisos privados ni
vencimientos: el fundamento es la documentación pública, con el alcance explicado en
[evidencia conservada](../backend/src/config/evidencias/getonbrd/README.md).

Solo consulto `GET https://www.getonbrd.com/api/v0/search/jobs` con `query`, `page` y `per_page`.
Rechazo otros destinos, puertos, credenciales en URL y redirecciones (`redirect: 'error'`).
No uso HTML, navegadores ni Apify. El dominio reservado `sandbox.getonbrd.test` es exclusivo
para fixtures con cliente inyectado; **no** es el sandbox oficial `sandbox.getonbrd.dev`.

### Límites y contrato compartido

- Defaults: 2 peticiones/páginas globales, 20 ofertas por página, máximo 40 ofertas y 5 segundos
  por solicitud, incluida la lectura del JSON. Conservo techos de 10 páginas, 120 por página y 1.200 ofertas.
- Uso términos/preferencias del resolver y `maxResultados`/`maxPeticiones`. Informo ubicación,
  zonas y opciones incompatibles en la preview; no envío filtros inventados al proveedor.
- Aplico ventana de 30 días, idioma antes del cupo, normalización e identidad canónica comunes.
- Devuelvo un array con `.metricas`: `completada`, `sin_resultados`, `parcial`, `timeout`,
  `error`, `cancelada` o `deshabilitada`. Conservo los alias internos del piloto para sus fixtures.
- HTTP 429 detiene inmediatamente, sin reintentos ni avanzar el checkpoint: informo
  `limite_solicitudes`, código HTTP y resultados ya válidos. Otros HTTP fallidos, red o JSON
  inválido son `error` sin ofertas o `parcial` con ofertas; nunca éxito vacío.
- Mantengo `run_id` en las métricas, más contadores y checkpoint (`termino_indice`, `termino`,
  `pagina_confirmada`, `pagina_siguiente`, `item_offset`) también en el historial saneado. Reanudo pasando
  `checkpointInicial` internamente; no agrego una opción HTTP para reanudar.
- Individual y ciclo pasan por `ejecutarFuente` y el ingreso #19/#20: nuevas, actualizadas,
  reapariciones, duplicadas, descartes por idioma y errores aislados de guardado. No agrego SQL:
  el modelo existente conserva postulación, fecha y notas manuales de #22.

### Rollout y rollback

Verifico primero fixtures offline y habilitación efectiva en `GET /api/scraping/previsualizacion`.
Esta implementación no ejecutó consultas reales de ofertas ni DeepSeek. Una prueba real de una
consulta/una página queda reservada al coordinador, después de verificar la guarda.
Para rollback configuro `GETONBRD_ENABLED=false` y reinicio; conservo ofertas e historial.
Habilitar la fuente **no crea ni activa cron**: una programación existente sigue gobernada por
su configuración persistida y activación explícita.

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
| `backend/src/controladores/controlador-scraping.js` | Comparte configuración, ingreso e historial; conserva alias bloqueado solo si GetOnBrd está deshabilitado. |

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

Documento la precedencia exacta de IDs contradictorios, parámetros codificados,
preservación histórica y migración incremental 025 en
[Identidad de ofertas](identidad-ofertas.md). Normalización y persistencia comparten
la URL nativa elegida; no fusiono IDs diferentes aunque coincidan título y empresa.

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
| GetOnBrd | `getonbrd` | `getonbrd` | Inactivo por defecto; requiere GETONBRD_ENABLED=true y evidencia pública conservada válida |

**Comportamiento cuando se invoca una plataforma inactiva:**

- El endpoint responde inmediatamente sin invocar Apify ni servicios externos.
- La respuesta incluye `codigo_resultado: "PLATAFORMA_INACTIVA"` y un `motivo` explicativo.
- El ciclo de automatización no incluye plataformas inactivas.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Schema de la tabla `ofertas`, deduplicación.
- [API REST](api-rest.md) — Endpoints POST de scraping.
- [Automatización](automatizacion.md) — Cómo el cron dispara scraping automáticamente.
