# Frontend — Busca Empleos

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
    fecha_publicacion: string | null;
    fecha_extraccion: string;
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
- Plataformas con `activa: false` (Google Jobs, InfoJobs) NO aparecen en selectores de scraping ni en preferencias como opción seleccionable.
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
| GetOnBrd | `getonbrd` | `getonbrd` | ✅ | — |
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
| `obtenerEstadisticas()` | GET | `/ofertas/estadisticas` | `Observable<RespuestaApi<Estadisticas>>` |
| `obtenerOfertaPorId(id)` | GET | `/ofertas/:id` | `Observable<RespuestaApi<Oferta>>` |

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
- `scrapeandoLinkedin`, `scrapeandoComputrabajo`, `evaluando` — control de spinners.
- `cronActivo`, `ultimaEjecucion` — estado del cron.
- `automatizacionActiva`, `progresoAutomatizacion` — estado del ciclo de automatización.

**Comportamiento:**
- `ngOnInit()` → `consultarEstadoCron()`: consulta el estado del cron al montar. También consulta `GET /api/automatizacion/progreso` para rehidratar el estado si hay un ciclo activo.
- `toggleCron(activar)`: inicia o detiene el cron según el switch.
- `scrapearLinkedin()` / `scrapearComputrabajo()`: ejecutan scraping con feedback toast.
- `ejecutarEvaluacion()`: ejecuta evaluación con feedback toast.
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
sin preferencias entrantes ni scraping. Limpio selección al filtrar, paginar, ordenar,
cambiar tamaño de ventana o refrescar datos, para no confirmar ofertas ocultas.

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
