# Frontend — Busca Empleos

## Seguimiento de postulaciones — issue #22

En `DetalleOferta` edito «Seguimiento de postulación» por separado de la evaluación IA:
veo el estado manual actual, la fecha de envío opcional y una nota de hasta 4000 caracteres.
Uso un input nativo `date` con el día `YYYY-MM-DD` sin convertirlo a `Date` ni aplicar zona
horaria. No deduzco fechas históricas; vacío envía `null` para borrar fecha o nota.

Guardo con `PATCH /api/ofertas/:id/seguimiento`, sin cambiar el estado, la descripción
ni la evaluación. Muestro procesamiento y bloqueo otro envío para el mismo ID; confirmo
éxito sólo después del backend. Ante error conservo borrador y diálogo, anuncio el fallo
y permito reintentar. Si edito mientras espero, la respuesta guarda el valor confirmado
pero no pisa el borrador posterior ni anuncia que ese nuevo texto ya está guardado.
Cambiar de oferta separa los mensajes y borradores. Las acciones rápidas de estado
conservan el comportamiento optimista de #21 y no quedan bloqueadas por editar la nota.

Agrupo sin duplicaciones: `cv_enviado`/`en_proceso` en **Postuladas**, `descartada` en
**Descartadas manualmente**; sólo `no_postulado` se clasifica según evaluación en
**Rechazadas por IA**, **Pendientes** o **Aprobadas**. Los cinco contadores particionan
el total filtrado. Los fallos técnicos conservan sus avisos y la evaluación IA sigue
visible en el detalle aunque haya postulación personal.

Reutilizo la sincronización y persistencia actuales: el backend incluye recientes y
postulaciones históricas válidas. IndexedDB, fallback de memoria y caché local conservan
los campos manuales completos, sin filtrar por antigüedad en Angular. Las versiones
protegen estado, fecha y nota frente a GET/bloques anteriores o iniciados durante un
guardado, tanto al combinar la vista como al persistir el bloque. Una respuesta de
edición de descripción tampoco reemplaza esos campos. No reinicio pestaña, plataforma,
búsqueda ni página al guardar seguimiento.

Las pruebas focales usan HTTP sintético y componentes reales; verifico interacción DOM,
errores, carreras, categorías, fallback y rehidratación de una histórica desde una nueva
instancia de IndexedDB. No equivalen a un recorrido contra Express/PostgreSQL ni prueban
el scraper: esa evidencia se verifica por separado en backend.

Agrego el recorrido continuo opt-in `issue-22-vertical.spec.ts`, lanzado por Jest con
PostgreSQL real UTF8 y Express local: [comando y guardas](base-datos.md#recorrido-continuo-postgresql--angular-22).
En él no simulo HTTP ni servicios/componentes Angular: edito y guardo por DOM una misma
oferta histórica, verifico día exacto y nota, sincronizo a IndexedDB y vuelvo a leer con
servicio, componente e inyector nuevos. Mantengo rechazo IA independiente de Postuladas,
cambio a `en_proceso` desde el selector real y verifico el upsert real del scraper por
un control exclusivo del harness. La suite habitual lo informa como **SKIPPED**; para
probar el puente hace falta ejecutar el comando opt-in, no sólo la suite de componentes.
No equivale a una navegación de login ni a un scraper externo: únicamente la verificación
del token Firebase es sintética, y la reaparición ingresa directamente al modelo real.

## Filtros, selección y postulación — issue #21

Selecciono únicamente los IDs de la página visible, después de filtrar en PrimeNG;
la cabecera anuncia «Seleccionar ofertas de esta página» y refleja selección completa,
parcial o vacía. En cards uso la página filtrada equivalente. Limpio selección al
cambiar búsqueda, página, orden manual, plataforma o pestaña. En un refresco con el
mismo filtro conservo sólo los IDs que siguen visibles. Ajusto la página mobile si
queda fuera de rango, sin reiniciar una página todavía válida.

Comparto `MessageService` entre dashboard, tabla y detalle. Mantengo el `p-toast`
fuera del diálogo para anunciar el resultado aunque cierre al cambiar postulación.
Conservo el cambio optimista individual y su reversión: confirmo, por ejemplo,
«Postulación actualizada: CV enviado» únicamente después de `exito: true`; ante
`exito: false`, HTTP 500 o error de red informo que el cambio no se guardó.
Los IDs pendientes compartidos impiden editar la misma oferta simultáneamente desde
tabla y detalle; mantengo las versiones que protegen cambios frente a GET tardíos.

Antes del bulk valido IDs positivos enteros, estado destino y pertenencia a la
categoría/plataforma actual. Bloqueo duplicados y operaciones cruzadas mientras hay
postulaciones pendientes; muestro cantidad seleccionada y procesamiento. Uso el
contrato existente `PATCH /ofertas/bulk/postulacion` con `{ ids, estado_postulacion }`:

- **Confirmación completa:** actualizo esos IDs, anuncio `datos.actualizadas`, limpio
  selección y refresco sin perder filtros ni cambios manuales protegidos.
- **Confirmación parcial (incluido cero):** anuncio la cantidad real sin atribuir éxitos
  por ID. Mantengo procesamiento, bloqueo de duplicados y guardas compartidas hasta
  completar un `GET /ofertas` fresco, separado del caché y la sincronización previa.
  Conservo para reintentar únicamente IDs originalmente enviados que sigan seleccionados
  y visibles, con estado confirmado distinto del destino original del PATCH. No restauro
  selección al cambiar búsqueda, plataforma, pestaña, página u orden mientras espero.
  El destino de esa conciliación no cambia aunque se modifique el selector local.
  Si falla el GET (`exito: false`, HTTP o red), faltan IDs o la respuesta es inválida,
  advierto que no pude confirmar los estados y limpio la selección insegura: necesito
  una nueva selección explícita, sin reintentos automáticos. Las versiones impiden que
  lecturas iniciadas antes o durante la conciliación pisen estados recién confirmados.
- **Fallo:** no anuncio éxito ni altero estados guardados; conservo selección válida
  y muestro un error accesible para volver a intentar.

Distingo «No hay ofertas guardadas», «Esta categoría no tiene ofertas disponibles» y
«No hay ofertas que coincidan con los filtros actuales». «Limpiar filtros» restablece
el texto real del hijo y la plataforma del padre mediante un output. Los avisos de
caché/sincronización se mantienen separados; no presento un fallo de red como búsqueda
vacía. Preservo confirmación explícita, máximo de 200 y bloqueo de reevaluación ocupada.

Las pruebas de `paginas/dashboard/issue-21.spec.ts` integran tabla PrimeNG, diálogo,
toast y servicio HTTP reales con ofertas/respuestas sintéticas; aíslan únicamente el
panel de scraping y la persistencia. Cubren filtro/página → selección → bulk fallido
→ aviso visible → reintento confirmado, concurrencia cruzada, respuesta parcial y
refresco HTTP. No equivalen a pruebas contra PostgreSQL ni proveedores reales.

## Resultados por fuente e historial — issue #20

Mantengo el panel existente y agrego detalles HTML desplegables para la última búsqueda
individual (`datos.fuente`), el último ciclo (`datos.ultimoResultado.fuentes`) y hasta
20 ejecuciones recientes (`GET /api/automatizacion/historial`). Conservo resultados
individuales incluso cuando HTTP devuelve 502/504. Muestro el estado efectivo, errores
HTTP, consultas ejecutadas, motivo y duración del backend; una fuente parcial no se
anuncia como completada. El registry habilitado permite intentar, no garantiza que
el proveedor esté disponible. GetOnBrd sigue deshabilitado por falta de autorización
escrita verificable; Google Jobs por costo/baja utilidad e InfoJobs mientras siga vigente
su deshabilitación. No agrego botones ni reactivo esas integraciones.

Distingo nuevas, actualizadas, reapariciones y duplicadas intra-ejecución
(`duplicadasDescartadas`). `duplicadas` es el contador legacy de existentes, no sumable:
puede incluir actualizadas/reapariciones. Un valor ausente o `null` aparece como
«No medido», nunca cero. Por consulta muestro exclusivamente consulta efectiva,
estado, peticiones, brutas y errores; la persistencia se informa solamente por fuente.
No calculo costos ni atribuyo aprobadas globales de IA a una búsqueda/fuente nueva.
El historial sanitizado puede omitir nombres y mensajes; resuelvo nombres desde el
registry existente y conservo los tipos/códigos de error informados.

Cargo historial al abrir y después de terminar individual/ciclo, nunca por tick del
polling (la ruta hereda 5 consultas/minuto). El botón «Actualizar historial» sirve para
refrescar o reintentar; durante la carga no duplico solicitudes. Un fallo conserva la
lista previa y muestra un error propio, separado del resultado del scraping y de un
fallo de actualización del dashboard. El cron muestra expresión y zona retornadas;
ante HTTP503 aplico `datos.activo`/`errorCron` en lugar de invertir el switch por suposición.
Si no recibo estado, lo vuelvo a consultar sin afirmar éxito.

Las pruebas A/B/C con `HttpTestingController` integran panel, servicios y dashboard:
A conserva una oferta con fuente parcial y segunda consulta HTTP503; B presenta timeout
de la primera fuente y éxito de la siguiente, historial y oferta válida; C remonta la
vista, recupera historial e inactividad y comprueba ausencia de POST. Estas pruebas
consumen respuestas sintéticas con forma backend: **no ejecutan Express, cancelación
de proveedores, PostgreSQL ni un reinicio del proceso backend**. Esa evidencia corresponde
a la verificación backend separada, no a estas pruebas Angular. No uso cron real ni
credenciales reales, y no presento capturas como evidencia.

## Búsquedas efectivas y actualización — issue #13

Consulto `GET /api/scraping/previsualizacion` al montar el panel, al pedir actualizar
la configuración y nuevamente antes de una extracción individual o ciclo. Muestro
el DTO del backend: términos (hasta cinco y cantidad restante), origen, ubicación,
ventana, `maxResultados`, filtros, `consultasEfectivas`, `equivalenciasAplicadas` y
advertencias. En la pestaña Búsqueda de `/preferencias`, incorporo el control toggle
para `filtrar_nivel_linkedin` (por defecto `true`), permitiendo omitir el filtro de
nivel `f_E=1,2` en LinkedIn sin alterar el seniority real del candidato. No deduzco
capacidades por fuente ni envío overrides. Una advertencia de umbral no estricto se
muestra literalmente; `null` indica ausencia del parámetro configurable. Conservo
fuentes deshabilitadas como informativas, sin habilitar GetOnBrd. Si falla el preview,
comunico el problema sin iniciar extracción ni simular filtros aplicados. En demo no consulto HTTP.

Distingo configuración guardada actual, última búsqueda individual
(`datos.configuracion`) y snapshot del ciclo aceptado/progreso/último resultado.
Actualizar el preview no reemplaza el snapshot ejecutado. La disponibilidad sólo
representa lo informado por el backend, no certifica conectividad del proveedor.
Para un individual bloqueo una fuente no disponible; en el ciclo no bloqueo las
compatibles por otra fuente incompatible. El snapshot indica `Omitida` cuando
incluye `motivoOmision`; el overlay muestra el paso `omitida` y su motivo sin
ícono de éxito. Al finalizar, las omisiones producen aviso `Ciclo con omisiones`
(warn), no `Ciclo completo`; los errores conservan prioridad y también informo
omisiones si existen. El cierre parcial emite igualmente `accionCompletada` para
refrescar las ofertas de las fuentes ejecutadas, sin defaults ni overrides.

La finalización del panel reutiliza `accionCompletada → cargarDatos`. Si ya estoy
sincronizando o refrescando por polling, agrupo los eventos en una única recarga
posterior desde un snapshot fresco. Mantengo un solo escritor, incluido el fallback
legacy, y cancelo requests/recargas pendientes al destruir el dashboard. Preservo
filtro visual, referencias locales y postulaciones optimistas mediante versiones:
un cambio confirmado durante GET tampoco puede ser sobrescrito por su respuesta
vieja. Los checkboxes conservan IDs presentes en la vista; descarto IDs removidos y
renuevo la confirmación. Filtrar o paginar conserva las limpiezas explícitas previas.
Si fallan sincronización y fallback, retengo los datos anteriores y aviso que no
están confirmados como actualizados, sin certificar éxito por finalizar una acción.

Las pruebas Angular usan componentes y servicios reales con HTTP sintético:
guardado de preferencias, botones individuales/ciclo, eventos y ofertas/conteos
visibles. Esas pruebas aisladas no constituyen un E2E con Express/PostgreSQL ni ejecutan proveedores reales.

### Puente vertical opt-in

Ejecuto `cd backend && npm run test:vertical` para unir ChromeHeadless y
`HttpClient` real con Express (`app.js`, sin `index.js`) en `127.0.0.1:43193`.
El harness espera el evento de escucha, verifica un nonce antes de usar la API y
lanza únicamente `busquedas-vertical.spec.ts` mediante Karma. Un puerto ocupado
falla sin terminar procesos ajenos; el `finally` espera al hijo/ciclo y cierra el servidor.
La suite habitual informa tres pruebas Angular **SKIPPED** y una Jest **SKIPPED**;
no interpreta ausencia del puente como éxito. El comando opt-in exige los flujos
individual, ciclo y ciclo parcial QA completados.

Compruebo PUT de preferencias, botones reales individuales/ciclo, snapshot ejecutado
distinto del preview tras otro PUT, fuente simulada, persistencia, evento de finalización,
DOM/conteos y conservación de filtro/postulación anterior. Uso el servicio IndexedDB
real y leo sus ofertas desde una instancia nueva; el fallback de memoria no alcanza.
El ciclo cruza aceptación 202, polling y evaluación real con respuesta externa de
DeepSeek sintética. El flujo adicional guarda `['QA']`, exige 202 y omisiones
explícitas sin llamadas a Indeed/Bumeran/Jooble/Adzuna, y comprueba oferta evaluada,
evento final y conteos visibles. Restauro `environment.urlApi` después de cada prueba.
Los límites del adaptador SQL y proveedores simulados están en [Scraping](scraping.md#evidencia-vertical-sin-proveedores-reales).

## CV base editable — issue #12

En `/preferencias` mantengo un editor de texto Markdown cómodo, independiente del
perfil confirmado y del borrador de revisión. No leo ningún `cv.md` del repositorio.

- **Guardar CV base**: envío la cadena exacta a `PUT /api/preferencias/cv-base`
  como `text/markdown; charset=utf-8`, sin JSON. Consulto la fuente con `GET` al abrir.
  Distingo fuente ausente (`null`) de fuente guardada vacía (`''`). Muestro
  `Sin cambios`, `Cambios pendientes`, `Guardando`, `Guardado correctamente` o
  `Error al guardar`; la fecha proviene únicamente de una respuesta exitosa de la BD.
  Ante fallas conservo el texto local y permito reintentar. No modifico preferencias,
  borradores, evaluaciones ni cachés al guardar la fuente.
- **Usar este archivo como mi CV base**: cargo explícitamente el archivo seleccionado
  en el editor, sin guardar. Confirmo antes de reemplazar cambios pendientes.
  Valido UTF-8 estricto, hasta 1 MiB inclusive (1048576 bytes) y ausencia de NUL;
  preservo BOM, espacios y saltos de línea. Descarto lecturas tardías de otro archivo
  o de un editor que cambió mientras esperaba.
- **Analizar texto del editor con IA**: envío una copia exacta como `File('cv-base.md')`
  de tipo `text/markdown` por el servicio existente `analizarCvMarkdown`. Uso el
  endpoint y la configuración de importación existentes, sin llamadas automáticas.
  El texto puede estar sin guardar. El análisis tiene costo y solo genera una
  propuesta revisable; no guarda la fuente ni confirma preferencias.
- **Aplicar al formulario** y **Guardar preferencias** siguen siendo pasos separados.
  Conservo correcciones, preguntas y notas al guardar/importar la fuente; pido
  confirmación antes de descartar una revisión para seleccionar o analizar otra.
  La reevaluación continúa siendo explícita después de un cambio de criterios
  confirmado por el guardado de preferencias.

Deshabilito el editor hasta cargar la fuente y mientras guardo o leo un archivo.
Durante el guardado también pauso acciones de archivo/análisis; una respuesta
 tardía no sobrescribe ediciones programáticas locales. `CanDeactivate` y
`beforeunload` advierten al salir con cambios pendientes o guardado en curso.
El navegador decide la redacción del aviso al cerrar/recargar la pestaña.
No agrego dependencias, editor enriquecido ni persistencia del CV en el navegador;
conservo el interceptor de autenticación existente.

## Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Angular | 20.3 | Framework principal |
| PrimeNG | 20.4 | Librería de componentes UI |
| Tema Aura | @primeng/themes | Tema visual de PrimeNG |
| PrimeIcons | 7.0 | Iconos |
| RxJS | 7.8 | Observables para HTTP |
| TypeScript | 5.9.2 | Tipado estático |

## Configuración del entorno

Archivo: `frontend/src/environments/environment.ts`

```typescript
export const environment = {
    produccion: false,
    urlApi: 'http://localhost:3000/api'
};
```

Todos los servicios usan `environment.urlApi` como base para las peticiones HTTP.

Además, el dashboard guarda la última carga exitosa en `localStorage` bajo la clave
`busca-empleos.dashboard.cache`. Esto permite rehidratar la vista cuando el usuario
reabre localhost pero el backend todavía no respondió o está caído.

## Configuración de la app

Archivo: `frontend/src/app/app.config.ts`

Providers configurados:
- `provideRouter(routes)` — Routing con lazy loading.
- `provideHttpClient()` — HttpClient para peticiones al backend.
- `provideAnimationsAsync()` — Animaciones asíncronas (requeridas por PrimeNG).
- `providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: 'none' } } })` — PrimeNG con tema Aura, sin dark mode.

## Routing

Archivo: `frontend/src/app/app.routes.ts`

| Path | Componente | Carga |
|------|-----------|-------|
| `''` | `Dashboard` | Lazy load (`loadComponent`) |
| `'**'` | — | Redirect a `''` |

Solo hay una ruta. El Dashboard es la página principal y única.

## Modelos (interfaces TypeScript)

Archivo: `frontend/src/app/modelos/oferta.model.ts`

### `Oferta`

Mapea 1:1 con las columnas de la tabla `ofertas` de PostgreSQL:

```typescript
type PlataformaId =
    | 'linkedin' | 'computrabajo' | 'indeed' | 'bumeran' | 'glassdoor'
    | 'getonbrd' | 'jooble' | 'google_jobs' | 'remotive' | 'remoteok'
    | 'infojobs' | 'adzuna';

interface Oferta {
    id: number;
    titulo: string;
    empresa: string | null;
    ubicacion: string | null;
    modalidad: string | null;
    descripcion: string | null;
    url: string;
    plataforma: PlataformaId;
    nivel_requerido: string | null;
    salario_min: string | null;
    salario_max: string | null;
    moneda: string | null;
    estado_evaluacion: 'pendiente' | 'aprobada' | 'rechazada';
    razon_evaluacion: string | null;
    fecha_postulacion?: string | null; // Día YYYY-MM-DD; ausente en cachés anteriores.
    nota_postulacion?: string | null;
    fecha_publicacion: string | null;
    fecha_extraccion: string;
    fecha_ultima_extraccion?: string | null;
    identidad_canonica?: string | null;
    datos_crudos: Record<string, unknown> | null;
}
```

### `Estadisticas`

```typescript
interface Estadisticas {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
}
```

### Registry de plataformas

Archivo: `frontend/src/app/config/plataformas.ts`

Fuente de verdad del frontend para ids, slugs, labels y estado de plataformas. Duplicación controlada del backend (`backend/src/config/plataformas.js`), sincronizada mediante tests de contrato.

**Reglas:**

- El `id` (snake_case) se usa como valor interno en filtros, preferencias, DTOs y BD. Ejemplo: `google_jobs`.
- El `slugHttp` (kebab-case) se usa solo en URLs de la API (`/api/scraping/:slug`). Ejemplo: `google-jobs`.
- Para la mayoría de las plataformas, `id` y `slugHttp` coinciden. Google Jobs es la excepción.
- Plataformas con `activa: false` (GetOnBrd, Google Jobs, InfoJobs) NO aparecen en selectores de scraping ni en preferencias como opción seleccionable.
- Los filtros de ofertas incluyen todas las plataformas (activas e inactivas) para permitir filtrar datos históricos.

**Funciones principales:**

| Función | Uso |
|---------|-----|
| `obtenerPlataformasActivas()` | Lista de plataformas activas con `{id, slugHttp, label}` |
| `esPlataformaActiva(idOSlug)` | Verifica si una plataforma está activa (acepta id o slug) |
| `normalizarIdPlataforma(idOSlug)` | Convierte slug HTTP a id interno (`google-jobs` → `google_jobs`) |
| `obtenerOpcionesFiltroPlataforma()` | Opciones para dropdown de filtro de ofertas (con "Todas") |
| `obtenerOpcionesScrapingPlataforma()` | Opciones para selector de scraping (solo activas, sin "Todas") |
| `obtenerOpcionesPreferenciaPlataforma()` | Opciones para preferencias (solo activas) |

**Estado de plataformas:**

| Plataforma | id | slugHttp | activa | motivo |
|------------|-----|----------|--------|--------|
| LinkedIn | `linkedin` | `linkedin` | ✅ | — |
| Computrabajo | `computrabajo` | `computrabajo` | ✅ | — |
| Indeed | `indeed` | `indeed` | ✅ | — |
| Bumeran | `bumeran` | `bumeran` | ✅ | — |
| Glassdoor | `glassdoor` | `glassdoor` | ✅ | — |
| GetOnBrd | `getonbrd` | `getonbrd` | ❌ | Piloto API-only deshabilitado hasta contar con autorización escrita verificable |
| Jooble | `jooble` | `jooble` | ✅ | — |
| Google Jobs | `google_jobs` | `google-jobs` | ❌ | Desactivado por costo y baja utilidad |
| Remotive | `remotive` | `remotive` | ✅ | — |
| RemoteOK | `remoteok` | `remoteok` | ✅ | — |
| InfoJobs | `infojobs` | `infojobs` | ❌ | Portal developers suspendido |
| Adzuna | `adzuna` | `adzuna` | ✅ | — |

Archivo: `frontend/src/app/modelos/respuesta-api.model.ts`

### `RespuestaApi<T>`

Wrapper genérico que refleja el formato estándar del backend:

```typescript
interface RespuestaApi<T> {
    exito: boolean;
    datos: T;
    total?: number;
    error?: string;
}
```

### Interfaces de respuesta específicas

| Interface | Campos principales | Usado en |
|-----------|-------------------|----------|
| `RespuestaScraping` | `mensaje, plataforma, ofertas_nuevas, ofertas_duplicadas, total_extraidas` | ScrapingService |
| `RespuestaEvaluacion` | `mensaje, total_evaluadas, aprobadas, rechazadas, errores` | EvaluacionService |
| `EstadoAutomatizacion` | `activo, expresionCron, ultimaEjecucion, ultimoResultado` | AutomatizacionService |
| `RespuestaAutomatizacion` | `mensaje, datos?: EstadoAutomatizacion` | AutomatizacionService |

## Servicios Angular

Todos usan `inject(HttpClient)` y `providedIn: 'root'` (singleton). Cada servicio tiene una URL base derivada de `environment.urlApi`.

### OfertasService

Archivo: `frontend/src/app/servicios/ofertas.service.ts`

| Método | HTTP | Ruta | Retorna |
|--------|------|------|---------|
| `obtenerOfertas(filtros?)` | GET | `/ofertas` | `Observable<RespuestaApi<Oferta[]>>` |
| `actualizarSeguimiento(id, cambios)` | PATCH | `/ofertas/:id/seguimiento` | `Observable<RespuestaApi<Oferta>>` |
| `obtenerEstadisticas()` | GET | `/ofertas/estadisticas` | `Observable<RespuestaApi<Estadisticas>>` |
| `obtenerOfertaPorId(id)` | GET | `/ofertas/:id` | `Observable<RespuestaApi<Oferta>>` |

`cambios` admite sólo `fecha_postulacion?: string | null` y `nota_postulacion?: string | null`.
Omitir conserva el campo; `null` lo limpia. El editor envía ambos campos explícitamente.

Filtros opcionales vía `HttpParams`: `estado` y `plataforma`.

> Nota: el `Dashboard` ya no usa `obtenerEstadisticas()`. Las cards superiores se derivan
> del mismo array de ofertas que alimenta las tabs para evitar desfasajes entre resumen y detalle.

### ScrapingService

Archivo: `frontend/src/app/servicios/scraping.service.ts`

| Método | HTTP | Ruta | Retorna |
|--------|------|------|---------|
| `scrapearLinkedin()` | POST | `/scraping/linkedin` | `Observable<RespuestaApi<RespuestaScraping>>` |
| `scrapearComputrabajo()` | POST | `/scraping/computrabajo` | `Observable<RespuestaApi<RespuestaScraping>>` |

### EvaluacionService

Archivo: `frontend/src/app/servicios/evaluacion.service.ts`

| Método | HTTP | Ruta | Retorna |
|--------|------|------|---------|
| `ejecutarEvaluacion(ids?)` | POST | `/evaluacion/ejecutar` | `Observable<InicioEvaluacion>` (inicio asincrónico, sin wrapper `datos`) |

### AutomatizacionService

Archivo: `frontend/src/app/servicios/automatizacion.service.ts`

| Método | HTTP | Ruta | Retorna |
|--------|------|------|---------|
| `obtenerEstado()` | GET | `/automatizacion/estado` | `Observable<RespuestaApi<EstadoAutomatizacion>>` |
| `iniciarCron(expresionCron?)` | POST | `/automatizacion/iniciar` | `Observable<RespuestaApi<EstadoAutomatizacion>>` |
| `detenerCron()` | POST | `/automatizacion/detener` | `Observable<RespuestaApi<EstadoAutomatizacion>>` |
| `ejecutarCiclo()` | POST | `/automatizacion/ejecutar` | `Observable<RespuestaApi<Record<string, unknown>>>` (responde 202 si acepta, 409 si ya hay ciclo activo) |
| `obtenerProgreso()` | GET | `/automatizacion/progreso` | `Observable<RespuestaApi<{ enProgreso: boolean, pasoActual: number, pasosTotales: number, ... }>>` |

### PersistenciaDashboardService

Archivo: `frontend/src/app/servicios/persistencia-dashboard.service.ts`

Responsabilidad: guardar y recuperar la última carga exitosa del dashboard para
mostrar búsquedas previas aunque el backend no pueda responder en ese momento.

| Método | Uso |
|--------|-----|
| `guardarCache(cache)` | Persiste ofertas + fecha de guardado en `localStorage` (las estadísticas se recalculan desde las ofertas) |
| `leerCache()` | Rehidrata el dashboard con la última carga válida |

Para la sincronización por cursor, el servicio conserva bloques confirmados por ID usando
IndexedDB nativo. Si IndexedDB no existe, falla la transacción o se agota la cuota, usa un
`Map` en memoria y muestra el fallback. El dashboard informa progreso, permite cancelar y
reanuda desde los bloques confirmados sin duplicarlos. Para cada snapshot mantiene en memoria
un estado operativo con `en_progreso`, `cancelada`, `completada` o `fallida`, más `fecha_corte`,
`max_id`, `total_inicial`, IDs únicos recibidos y duplicados. La cancelación desuscribe la petición
HTTP del bloque activo, lo aborta y conserva el cursor confirmado y esos conteos; no ejecuta el
listado histórico `GET /api/ofertas` como fallback. Solo pasa a `completada` cuando los únicos
igualan el total inicial. El bloque accesible del dashboard anuncia esos valores y nunca comunica
éxito para `cancelada`.

El badge `PRIORIDAD_IA` y sus evidencias se muestran como texto seguro en tabla y detalle. Solo
se aplica su bonus de orden cuando la API devuelve `priorizar_ofertas_ia: true`; ante fallo de
esa lectura conserva el orden habitual.

## Componentes

### Patrón container-presentational

El frontend sigue el patrón container-presentational:
- **Container** (`Dashboard`): Inyecta servicios, maneja estado reactivo con signals, pasa datos a los hijos.
- **Presentational** (`PanelControl`, `TablaOfertas`, `DetalleOferta`): Reciben datos por `input()`, emiten eventos por `output()`. Sin lógica de negocio ni inyección de servicios HTTP.

Excepción: `PanelControl` inyecta servicios directamente porque tiene interacción compleja (scraping, evaluación, toggle cron).

### Dashboard (container)

Archivo: `frontend/src/app/paginas/dashboard/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-dashboard` |
| Tipo | Container (orquestador) |
| Servicios | `OfertasService` |
| Servicios | `OfertasService`, `PersistenciaDashboardService` |
| Estado reactivo | `ofertas`, `cargando`, `ofertaSeleccionada`, `dialogoVisible`, `mensajeEstado`, `datosDesdeCache` (todos signals) |

**Comportamiento:**
- `ngOnInit()` → rehidrata cache local y luego intenta sincronizar con la API.
- `cargarDatos()`: carga solo ofertas; las estadísticas se recalculan con `computed()`.
- Las cards superiores (`Total`, `Pendientes`, `Aprobadas`, `Postuladas`, `Rechazadas`) usan la misma lógica que las tabs.
- Si la API responde bien, actualiza los signals y refresca el cache local.
- Si la API falla, conserva o restaura la última carga exitosa y muestra un mensaje visible para evitar el falso "no hay registros".
- `onProgresoEvaluacion()`: refresca ofertas en segundo plano durante el polling de evaluación, sin prender el spinner principal.
- `mostrarDetalle(oferta)`: setea la oferta seleccionada y abre el diálogo.
- `onAccionCompletada()`: recarga datos cuando el panel de control ejecuta una acción.

**Accesibilidad y responsive:**
- `<section>` con `role="main"` y `aria-label` para landmark detectable por lectores de pantalla.
- Mensaje de estado con `role="status"` y `aria-live="polite"` para anunciar cambios de carga al lector.
- Stats con `role="list"` / `role="listitem"` y `aria-labelledby` que vincula cada valor a su etiqueta.
- Filtro de plataforma con `role="search"`, `aria-label`, y `ariaLabelledBy` en el `p-select`.
- Tabs con `aria-label` descriptivo.
- Focus-visible con `outline: 2px solid var(--primary)` en tabs y controles interactivos.
- Touch targets ≥ 44px de alto en tabs (`min-height: 44px`).
- Mobile (≤768px): stats en grid 2 columnas, título más chico, filtro apilado verticalmente, tabs con scroll horizontal.
- Tablet (769–1024px): stats con `flex-wrap`, título reducido, tabs con padding compacto.

### PanelControl (presentational con lógica)

Archivo: `frontend/src/app/componentes/panel-control/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-panel-control` |
| Imports PrimeNG | ButtonModule, ToastModule, ToggleSwitchModule |
| Servicios | ScrapingService, EvaluacionService, AutomatizacionService, MessageService |
| Outputs | `accionCompletada: void`, `evaluacionEnProgreso: void` |

**Estado interno (signals):**
- `scrapeandoLinkedin`, `scrapeandoComputrabajo`, `evaluando`, `reintentandoErrores` — control de spinners.
- `cronActivo`, `ultimaEjecucion` — estado del cron.
- `automatizacionActiva`, `progresoAutomatizacion` — estado del ciclo de automatización.

**Comportamiento:**
- `ngOnInit()` → `consultarEstadoCron()`: consulta el estado del cron al montar. También consulta `GET /api/automatizacion/progreso` para rehidratar el estado si hay un ciclo activo y `rehidratarEvaluacion()` para detectar lotes en curso o interrumpidos por reinicio (mostrando el aviso correspondiente sin bloquear la interfaz).
- `toggleCron(activar)`: inicia o detiene el cron según el switch.
- `scrapearLinkedin()` / `scrapearComputrabajo()`: ejecutan scraping con feedback toast.
- `ejecutarEvaluacion()`: ejecuta evaluación con feedback toast.
- `reintentarErrores()`: ejecuta `POST /api/evaluacion/reintentar-errores` para reintentar exclusivamente ofertas que sufrieron un fallo técnico. Si no hay ofertas fallidas, muestra un toast informativo; si hay, activa el seguimiento por polling.
- `ejecutarAutomatizacion()`: envía `POST /api/automatizacion/ejecutar`. Si recibe `202`, inicia polling a `GET /api/automatizacion/progreso` y NO cierra el overlay de progreso hasta que el ciclo termine realmente. Si recibe `409`, rehidrata el progreso del ciclo existente en lugar de mostrar error fatal.
- Durante el polling de evaluación, emite `evaluacionEnProgreso` en cada tick para que el `Dashboard` refresque contadores sin esperar al final.
- Durante el polling de automatización, emite `accionCompletada` cuando el ciclo finaliza para que el Dashboard recargue datos.
- Al recibir el ciclo inactivo con 100%, reviso `pasos[].estado`: si algún paso está en `error`, muestro «Ciclo con errores» y aviso que conservo resultados parciales, sin toast de éxito. Cierro el overlay y recargo los datos también en ese caso; el porcentaje indica finalización, no éxito.
- Al completar cualquier otra acción, emite `accionCompletada` para que el Dashboard recargue datos.

**Accesibilidad y responsive:**
- Overlays de carga con `role="dialog"`, `aria-modal="true"`, `aria-live="assertive"` / `aria-live="polite"` para anuncios al lector de pantalla.
- Botones con `aria-label` descriptivo y `aria-hidden="true"` en iconos decorativos.
- Barra de progreso de evaluación con `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Toggle de automatización con `aria-label` y `aria-live="polite"` en el texto de estado.
- Touch targets ≥ 44×44px en todos los botones (`min-height`, `min-width`).
- Focus-visible con outline de 2px y `--focus-ring-color` en botones y controles.
- Tablet (769–1024px): fila secundaria (Evaluación + Automatización) apilada verticalmente, separador horizontal; botones con padding reducido.
- Mobile (≤640px): labels de grupo a ancho completo arriba del grupo de acciones; fila secundaria vertical; overlay responsivo con `width: calc(100% - 32px)`.

### TablaOfertas (presentational)

Archivo: `frontend/src/app/componentes/tabla-ofertas/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-tabla-ofertas` |
| Imports PrimeNG | TableModule, TagModule, ButtonModule, SelectModule, InputTextModule |
| Inputs | `ofertas: Oferta[]`, `cargando: boolean` |
| Outputs | `ofertaSeleccionada: Oferta` |

**Funcionalidades:**
- Tabla PrimeNG con filtros por estado y plataforma (dropdowns).
- Tags de colores: aprobada (success/verde), rechazada (danger/rojo), pendiente (warn/amarillo).
- Iconos por plataforma: LinkedIn (`pi-linkedin`), Computrabajo (`pi-globe`).
- Botón "ver detalle" por fila que emite `ofertaSeleccionada`.
- Vista cards en mobile (≤768px) con paginación propia y filtro por texto.
- **Paginación de 20 elementos por página**: desktop muestra `[rows]="20"` en la p-table; mobile usa `filasPorPaginaCards = 20` para las cards. Anteriormente era 10.
- **Primera detección vs. Última detección (Issue #19):**
  * Si la oferta tiene reaparición (`tieneReaparicion(oferta)`: `fecha_ultima_extraccion` existe y difiere de `fecha_extraccion`), la columna extraída muestra `Det: dd/MM/yy (Reaparición: dd/MM/yy)` y en cards mobile `dd/MM/yy (Reap: dd/MM/yy)`.
  * Tooltip accesible completo: `Primera detección: dd/MM/yyyy HH:mm | Última detección: dd/MM/yyyy HH:mm`.
  * Si no hay reaparición, muestra el formato de detección simple `Det: dd/MM/yy`.

**Accesibilidad y responsive:**
- Contenedores con `role="region"` y `aria-label` para la tabla y las cards.
- Input de búsqueda con `<label>` oculto (`.sr-only`) y `aria-labelledby` para lectores de pantalla.
- Checkboxes de selección con `aria-label` descriptivo por fila (ej: "Seleccionar Frontend Developer").
- Barra bulk con `role="toolbar"` y `aria-label`; botones con `aria-label`.
- Botones de paginación cards con `aria-label` y `aria-current="page"` en la página activa.
- Cards con `role="list"` / `role="listitem"`, `tabindex="0"` para foco, y `aria-label` con el título de la oferta.
- Iconos decorativos con `aria-hidden="true"` (Material Symbols en badges, botones, etc.).
- Info de resultados con `aria-live="polite"` para anunciar cambios de paginación.
- Focus-visible con `outline: 2px solid var(--primary)` en inputs, botones, checkboxes y tabs.
- Touch targets ≥ 44×44px en: `.btn-ver` (44×44px), `.checkbox-tabla` (18×18px visual + 13px margin = 44px hit area), botones bulk (min-height 44px), botones paginador cards (44×44px).
- Input de búsqueda con min-height 44px para touch.
- Overflow horizontal con scroll controlado en tablet (`overflow-x: auto`) sin romper layout.
- Vista cards (mobile): encabezado compacto, cards con padding reducido, footer con flex-wrap, paginador compacto.

### DetalleOferta (presentational)

Archivo: `frontend/src/app/componentes/detalle-oferta/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-detalle-oferta` |
| Imports PrimeNG | DialogModule, TagModule, ButtonModule |
| Inputs | `oferta: Oferta | null` |
| Model | `visible: boolean` (bidireccional con `model()`) |

**Comportamiento:**
- Muestra un diálogo PrimeNG con todos los datos de la oferta.
- `model()` permite que el padre controle la visibilidad del diálogo con binding bidireccional.
- `abrirEnPagina()`: abre la URL de la oferta en una nueva pestaña con `noopener,noreferrer` (seguridad).
- **Trazabilidad temporal de detección (Issue #19):**
  * Presenta de forma diferenciada la **Primera detección** (`fecha_extraccion`) y la **Última detección** (`fecha_ultima_extraccion`) cuando la oferta ha reaparecido en extracciones posteriores (`tieneReaparicion(oferta)`).
  * Preserva además la fecha original de publicación (`fecha_publicacion`) distinguiendo fechas aproximadas de fechas exactas.
- **Matching explicable (#17):**
  * Presenta el score como **Compatibilidad estimada** (nunca como probabilidad de contratación).
  * Si hay desglose (`explicacion_evaluacion`), organiza las evidencias en:
    - **A favor del match:** requisitos cumplidos con evidencias del aviso y del perfil.
    - **En contra del match:** requisitos no cumplidos y exclusiones obligatorias activadas.
    - **Por confirmar:** requisitos inciertos o no verificables en extractos.
  * Si es una evaluación histórica sin desglose, muestra la razón anterior con leyenda explicativa.
  * Si la evaluación está desactualizada (`evaluacion_error_mensaje === 'REEVALUACION_SOLICITADA'` o estado pendiente), muestra alerta y botón de **Reevaluar oferta**.
- **Edición manual de descripción (#17):**
  * Informa procedencia y completitud (`Extracto parcial de tarjeta`, `Descripción manual`, `Descripción completa`).
  * Botón **Completar descripción** para pegar el texto completo.
  * Valida longitud (20 a 50.000 caracteres), previene pérdidas conservando el borrador ante error de red y permite cancelar sin mutar los datos guardados.

**Accesibilidad y responsive:**
- `p-dialog` con `aria-labelledby="detalle-titulo"` apuntando al título visible de la oferta (`id="detalle-titulo"`).
- Ancho responsivo: `min(680px, calc(100vw - 32px))` en desktop, `100vw` fullscreen en mobile (≤768px) via `[breakpoints]`.
- Botones de footer con `aria-label` descriptivo, `aria-hidden="true"` en iconos decorativos.
- Touch targets ≥ 44×44px en botones (`min-height`).
- Focus-visible con outline de 2px y `--focus-ring-color`.
- Mobile (≤768px): tipografía reducida, botones full-width, padding compacto, `max-height` reducido en descripción.
- Tablet (769–1024px): ajustes menores de tipografía en salario.

### Preferencias: perfil confirmado para IA (issue #8)

En `paginas/preferencias/` muestro **Qué perfil usa la IA**, una vista de solo lectura
recibida como `datos.perfil_efectivo` por GET/PUT `/api/preferencias`. Presento candidato,
tecnologías/evidencia, idiomas, preferencias de búsqueda y políticas obligatorias
por separado, con etiquetas legibles, sin reconstruir el prompt ni interpretar otros
hechos. Los roles objetivo son preferencias, no experiencia acreditada. Conservo
íntegras las políticas del backend: editar exclusiones adicionales o texto personalizado
no las desactiva. Si falta la representación, informo su ausencia sin inventarla.

Comparo el formulario con su última carga confirmada para anunciar **Cambios sin guardar**;
la vista continúa mostrando el perfil persistido. Después de guardar reemplazo tanto
los valores del formulario como la vista con la respuesta del servidor. Consultar o
guardar esta vista no llama a DeepSeek. El contrato tipado está en
`modelos/preferencia.model.ts`; excluyo `perfil_efectivo` del tipo actualizable.

Conservo listas vacías, cero años y nivel tecnológico `ninguno`. No repueblo tecnologías
ni roles al cargar o guardar: las sugerencias requieren un botón explícito. El stack
se deriva del detalle editado incluso si queda vacío. Comparo los controles con su
última carga para enviar solamente campos modificados: un detalle ausente/null no se
convierte en `[]`/`{}` al editar otro campo, ni borro los datos legacy compatibles.
Registro las acciones explícitas de tecnologías/roles aunque terminen nuevamente en
`[]`; «Vaciar tecnologías y stack» confirma esa eliminación incluso sin detalle inicial.
Borrar el resumen de idiomas envía `idioma_candidato: null`; los niveles detallados
editados se envían aunque queden vacíos. No completo inglés, seniority o años
ausentes con datos personales de ejemplo. Conservo el texto personalizado exactamente,
incluidos espacios y saltos de línea, como criterio adicional que no reemplaza hechos.
Al analizar otro CV descarto la extracción y preguntas anteriores antes de validar la
carga o consultar el backend. Si falla, muestro su mensaje `error` (o un mensaje breve
si no existe), sin permitir aplicar una sugerencia obsoleta. La vista previa tolera
listas ausentes en una extracción parcial sin materializarlas en el resultado.
Al cambiar archivo limpio la vista previa, preguntas de importación y avisos; invalido
respuestas de solicitudes anteriores, tanto éxito como error, sin detener el indicador
de un análisis posterior. Al aplicar una extracción sin ambos campos `preguntas` y
`preguntas_perfil_pendientes`, conservo las preguntas pendientes existentes. Un `[]`
explícito permite limpiarlas; si vienen ambos campos, priorizo `preguntas_perfil_pendientes`.
La revisión de borrador, notas e identidad de preguntas se amplía en #11, según el apartado siguiente.

Al aplicar un CV conservo roles objetivo, modalidad, zonas, disponibilidad, salario, términos,
exclusiones, palabras clave y plataformas existentes; continúo con el mapeo acotado de hechos, sin
agregar otro importador ni editor.

Las pruebas de componente cubren edición, aviso, respuesta persistida de guardado y
recarga, eliminaciones, cero/ninguno, información ausente, texto exacto y conservación
de criterios laborales al importar. Las pruebas HTTP verifican el transporte intacto
de la representación autoritativa en GET/PUT.

### Revisión aislada de importación CV (issue #11)

Edito lectura, escritura, conversación, comprensión oral y regla de idiomas por separado;
no infiero niveles del resumen libre. Parto de los valores confirmados y puedo rechazar
el detalle propuesto para conservar el actual. Rechazo tecnologías por fila únicamente
en el borrador: una propuesta rechazada no borra hechos confirmados, y los nombres
vacíos no se aplican. Para borrar un hecho confirmado uso la edición manual del formulario.
La acción de soporte agrega su palabra clave al reemplazo ya aceptado, sin recuperar
palabras descartadas ni modificar experiencia.

Copio la extracción validada a un único borrador revisable; no edito la respuesta de
DeepSeek ni el formulario mientras respondo preguntas. Edito textos, niveles,
importancia, aliases y evidencia desde esa revisión. Conservo los niveles tecnológicos
ya confirmados como punto de partida; la propuesta no los sobrescribe por sí sola.
Aplico los valores revisados, incluso textos vaciados, sin reiniciar preguntas desde
la extracción. **Aplicar al formulario no guarda**: sigo usando Guardar preferencias.

Asigno un UUID local nuevo por pregunta y revisión. El template y los eventos usan esa
identidad, no `campo` ni índices de listas filtradas. Distingo `pendiente`, `respondida`
(respuesta sin aplicar hechos), `aplicada` (acción explícita sobre el borrador),
`ignorada` (sin respuesta ni nota) y `nota` (nota conservada e ignorada como acción).
Guardo respuesta, nota, identidad y estado en `preguntas_perfil_pendientes`, incluyendo
preguntas resueltas; después de guardar y recargar muestro sus textos. No hay migración.

Las acciones muestran su alcance antes de ejecutarse: Docker cambia solo su nivel a
básico; salario quita solo el filtro salarial; soporte agrega solo una palabra clave
positiva. React Native y las respuestas libres no inventan experiencia: requieren
edición explícita de los hechos del borrador. Salario y palabras clave positivas también
admiten confirmación explícita de reemplazo desde controles etiquetados. El salario
normalizado a null por ausencia conserva el manual, salvo esa decisión explícita.
Roles, búsqueda, modalidad, zonas, disponibilidad, exclusiones, plataformas y años reales
siguen protegidos; el resumen **Se agregará / Se modificará / Se conservará** lo comunica.

Cancelar descarta todo el estado temporal e invalida respuestas HTTP tardías, sin
restaurar ni pisar ediciones manuales previas. Preservo el contrato #10: preguntas
omitidas conservan las existentes, `[]` explícito las limpia y
`preguntas_perfil_pendientes` tiene precedencia. Rechazo null en cualquiera de los arrays.
La vista del perfil IA continúa siendo exclusivamente la respuesta persistida del
backend; un guardado fallido no confirma el borrador. Las pruebas focalizadas recorren
clics DOM con preguntas mezcladas/duplicadas, edición de Docker, notas, cancelación,
salario/experiencia, omisión/null/vacío y solicitudes obsoletas. El roundtrip HTTP con
servicio real y las suites completas corresponden a T2.

### Reevaluación seleccionada (issue #9)

Muestro el aviso de perfil cambiado únicamente cuando PUT `/api/preferencias` confirma
`cambio_criterios: true`. Los cambios sin guardar y los guardados irrelevantes no crean
invalidaciones ni ejecutan IA. Conservo el aviso de cambios sin guardar y la vista del
perfil persistido de #8. El enlace abre `/?reevaluar=1`, la ruta del dashboard, sin iniciar
ninguna evaluación ni seleccionar ofertas automáticamente.

En esa vista incluyo todos los estados extraídos en los últimos **30 días**, también
rechazadas y ofertas legacy. Sincronizo desde el servidor antes de habilitar selección;
no calculo vigencia desde el formulario ni confío en un caché local anterior. Tabla y
cards muestran texto: **Evaluación actual**, **Evaluación anterior** o **Vigencia desconocida**;
las pendientes indican **Sin evaluación**. El filtro de plataforma continúa disponible.

Reutilizo los checkboxes y las acciones de la tabla; agrego selección en cards y una
confirmación explícita con cantidad, ventana fija de extracción, perfil guardado y
posibles llamadas pagas. Envío solamente `{ ids: [...] }`, entre 1 y 200 IDs válidos,
sin preferencias entrantes ni scraping. Limpio selección al filtrar, paginar, ordenar
manualmente o cambiar tamaño de ventana. Al refrescar datos conservo solamente los
IDs que siguen visibles y cierro la confirmación previa, para no confirmar ofertas ocultas.

Reutilizo progreso y cancelación de `PanelControl`. Inicio polling solamente después
de una aceptación real; para una selección rechazada con 400/409 muestro el error,
sin polling ni éxito ficticio. Bloqueo inicio en demo y ante evaluación, ciclo o scraping
local en curso. Al finalizar vuelvo a sincronizar resultados y firmas, también ante
error o cancelación; no anuncio esos cierres como éxito. El panel muestra un aviso
accesible y cantidades de resultados actualizados/pendientes. Consumo `estado`,
`mensaje_error`, `procesadas` y `pendientes` como campos opcionales del progreso,
con fallback para backends anteriores; detengo polling y libero el estado ocupado.
Tabla y cards muestran el error técnico separado del último resultado válido conservado,
no presentan el marcador interno de reset como error. Las acciones manuales de
postulación conservan su flujo habitual.

El test `paginas/dashboard/reevaluacion-flujo.spec.ts` recorre componentes y router reales
con servicios HTTP reales y respuestas sintéticas (`HttpTestingController`): guardar,
aviso, navegación, selección reciente, confirmación, POST de IDs, cancelación y resultados
actuales, preservando postulación. También cubro cards, legado, límites, demo y errores.

## Flujo de datos

```
Dashboard (container)
├── cargarDatos() → OfertasService → API → signals
│
├── PanelControl → (accionCompletada) → Dashboard.cargarDatos()
│   ├── ScrapingService → API scraping
│   ├── EvaluacionService → API evaluación
│   └── AutomatizacionService → API cron
│
├── TablaOfertas ← [ofertas], [cargando]
│   └── (ofertaSeleccionada) → Dashboard.mostrarDetalle()
│
└── DetalleOferta ← [oferta], [(visible)]
```

## Convenciones Angular

- **Signals** en vez de decoradores `@Input()`/`@Output()`: usa `input()`, `output()`, `model()`, `signal()`.
- **`inject()` en vez de constructor injection**: patrón moderno de Angular.
- **Standalone components**: todos los componentes importan sus dependencias directamente (sin NgModules).
- **Lazy loading**: el Dashboard se carga bajo demanda con `loadComponent()`.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Patrón container-presentational, estructura de carpetas.
- [API REST](api-rest.md) — Endpoints que consumen los servicios Angular.
- [Evaluación IA](evaluacion-ia.md) — Contexto de lo que muestra el tag de estado.
- [Automatización](automatizacion.md) — Cómo el Panel de Control controla el cron.

## Accesibilidad y Responsive

### Patrones globales de accesibilidad

- **`:focus-visible`**: Todos los elementos interactivos (botones, links, inputs, selects, toggle switches, componentes PrimeNG) muestran un outline visible de 2px al recibir foco por teclado. Implementado en `styles.css` con tokens `--focus-ring-color`, `--focus-ring-width`, `--focus-ring-offset`.
- **`prefers-reduced-motion`**: Cuando el usuario tiene preferencia de movimiento reducido en su sistema operativo, se desactivan todas las animaciones y transiciones. Spinner y botones de carga también se desactivan.
- **Touch targets**: Los botones del topbar y formularios principales cumplen con un mínimo de 44×44px (`--touch-target` token en `:root`). Los botones Google e invitado del login tienen `min-height: 48px`.

### ARIA landmarks implementados

| Elemento | Rol ARIA | Ubicación |
|----------|----------|-----------|
| Sidebar (nav) | `role="navigation"` + `aria-label="Navegación principal"` | `app.html` |
| Topbar (header) | `role="banner"` | `app.html` |
| Contenido principal (main) | `role="main"` | `app.html` |
| Footer | `role="contentinfo"` | `app.html` |
| Banner modo demo | `role="status"` + `aria-live="polite"` | `app.html` |
| Login header | `role="banner"` | `login.html` |
| Login main | `role="main"` | `login.html` |
| Login footer | `role="contentinfo"` | `login.html` |
| Secciones preferencias | `aria-labelledby` apuntando al label de sección | `preferencias.html` |
| Toast (p-toast) | `aria-live="polite"` | `preferencias.html` |

### Iconos decorativos

Todos los iconos `material-symbols-outlined` puramente decorativos tienen `aria-hidden="true"` para que los lectores de pantalla no los anuncien. Los iconos funcionales (como los del sidebar) ya tienen texto visible junto a ellos.

### Responsive breakpoints

| Breakpoint | Rango | Sidebar | Contenido principal | Topbar | Footer |
|------------|-------|---------|-------------------|--------|--------|
| Desktop | ≥1025px | 256px fija | margin-left: 256px | left: 256px, padding: 2rem | left: 256px |
| Tablet | 769–1024px | 200px fija | margin-left: 200px, padding: 1.5rem | left: 200px, padding: 1.5rem | left: 200px |
| Mobile | ≤768px | Oculta (overlay con hamburger) | margin-left: 0, padding: 1rem | left: 0, hamburger visible | left: 0, derecha oculta |

### Tokens CSS utilizados en este dominio

```css
:root {
    --bp-mobile: 768px;
    --bp-tablet: 1024px;
    --touch-target: 44px;
    --focus-ring-color: var(--primary);
    --focus-ring-width: 2px;
    --focus-ring-offset: 2px;
}
```

### Bug fix: variable CSS rota

Se eliminaron todas las referencias a `--color-primario` y `--color-texto-secundario` (tokens inexistentes en el design system) y se reemplazaron por `--primary` y `--on-surface-variant` respectivamente. Esto afectó:
- `login.css`: Botón de invitado y su `:hover`.
- `preferencias.css`: Aviso de modo demo (fondo, borde, texto).
