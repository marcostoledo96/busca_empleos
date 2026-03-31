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

## Componentes

### Patrón container-presentational

El frontend sigue el patrón container-presentational:
- **Container** (`Dashboard`): Inyecta servicios, maneja estado reactivo con signals, pasa datos a los hijos.
- **Presentational** (`TarjetasEstadisticas`, `PanelControl`, `TablaOfertas`, `DetalleOferta`): Reciben datos por `input()`, emiten eventos por `output()`. Sin lógica de negocio ni inyección de servicios HTTP.

Excepción: `PanelControl` inyecta servicios directamente porque tiene interacción compleja (scraping, evaluación, toggle cron).

### Dashboard (container)

Archivo: `frontend/src/app/paginas/dashboard/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-dashboard` |
| Tipo | Container (orquestador) |
| Servicios | `OfertasService` |
| Estado reactivo | `ofertas`, `estadisticas`, `cargando`, `ofertaSeleccionada`, `dialogoVisible` (todos signals) |

**Comportamiento:**
- `ngOnInit()` → `cargarDatos()`: carga ofertas y estadísticas en paralelo.
- `mostrarDetalle(oferta)`: setea la oferta seleccionada y abre el diálogo.
- `onAccionCompletada()`: recarga datos cuando el panel de control ejecuta una acción.

### TarjetasEstadisticas (presentational)

Archivo: `frontend/src/app/componentes/tarjetas-estadisticas/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-tarjetas-estadisticas` |
| Inputs | `estadisticas: Estadisticas | null`, `cargando: boolean` |
| Outputs | Ninguno |

Muestra los contadores (total, pendientes, aprobadas, rechazadas) en tarjetas visuales.

### PanelControl (presentational con lógica)

Archivo: `frontend/src/app/componentes/panel-control/`

| Característica | Detalle |
|---------------|---------|
| Selector | `app-panel-control` |
| Imports PrimeNG | ButtonModule, ToastModule, ToggleSwitchModule |
| Servicios | ScrapingService, EvaluacionService, AutomatizacionService, MessageService |
| Outputs | `accionCompletada: void` |

**Estado interno (signals):**
- `scrapeandoLinkedin`, `scrapeandoComputrabajo`, `evaluando` — control de spinners.
- `cronActivo`, `ultimaEjecucion` — estado del cron.

**Comportamiento:**
- `ngOnInit()` → `consultarEstadoCron()`: consulta el estado del cron al montar.
- `toggleCron(activar)`: inicia o detiene el cron según el switch.
- `scrapearLinkedin()` / `scrapearComputrabajo()`: ejecutan scraping con feedback toast.
- `ejecutarEvaluacion()`: ejecuta evaluación con feedback toast.
- Al completar cualquier acción, emite `accionCompletada` para que el Dashboard recargue datos.

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

## Flujo de datos

```
Dashboard (container)
├── cargarDatos() → OfertasService → API → signals
│
├── TarjetasEstadisticas ← [estadisticas], [cargando]
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
