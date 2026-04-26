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
interface Oferta {
    id: number;
    titulo: string;
    empresa: string | null;
    ubicacion: string | null;
    modalidad: string | null;
    descripcion: string | null;
    url: string;
    plataforma: 'linkedin' | 'computrabajo';
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
| `ejecutarEvaluacion()` | POST | `/evaluacion/ejecutar` | `Observable<RespuestaApi<RespuestaEvaluacion>>` |

### AutomatizacionService

Archivo: `frontend/src/app/servicios/automatizacion.service.ts`

| Método | HTTP | Ruta | Retorna |
|--------|------|------|---------|
| `obtenerEstado()` | GET | `/automatizacion/estado` | `Observable<RespuestaApi<EstadoAutomatizacion>>` |
| `iniciarCron(expresionCron?)` | POST | `/automatizacion/iniciar` | `Observable<RespuestaApi<EstadoAutomatizacion>>` |
| `detenerCron()` | POST | `/automatizacion/detener` | `Observable<RespuestaApi<EstadoAutomatizacion>>` |
| `ejecutarCiclo()` | POST | `/automatizacion/ejecutar` | `Observable<RespuestaApi<Record<string, unknown>>>` |

### PersistenciaDashboardService

Archivo: `frontend/src/app/servicios/persistencia-dashboard.service.ts`

Responsabilidad: guardar y recuperar la última carga exitosa del dashboard para
mostrar búsquedas previas aunque el backend no pueda responder en ese momento.

| Método | Uso |
|--------|-----|
| `guardarCache(cache)` | Persiste ofertas + fecha de guardado en `localStorage` (las estadísticas se recalculan desde las ofertas) |
| `leerCache()` | Rehidrata el dashboard con la última carga válida |

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

**Comportamiento:**
- `ngOnInit()` → `consultarEstadoCron()`: consulta el estado del cron al montar.
- `toggleCron(activar)`: inicia o detiene el cron según el switch.
- `scrapearLinkedin()` / `scrapearComputrabajo()`: ejecutan scraping con feedback toast.
- `ejecutarEvaluacion()`: ejecuta evaluación con feedback toast.
- Durante el polling de evaluación, emite `evaluacionEnProgreso` en cada tick para que el `Dashboard` refresque contadores sin esperar al final.
- Al completar cualquier acción, emite `accionCompletada` para que el Dashboard recargue datos.

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
