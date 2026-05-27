# 08 — Frontend: Componentes, Páginas y Servicios

## Páginas

### Dashboard (`paginas/dashboard/`)

Página principal. Muestra ofertas en tabs con filtros y estadísticas.

**Estado (Signals)**:
- `ofertas`: array cargado del backend
- `cargando`: spinner global
- `ofertaSeleccionada`: para modal detalle
- `filtroPlataforma`: dropdown de filtro global
- `datosDesdeCache`: indica si se muestran datos de localStorage

**Computed Signals** (filtrado automático):
- `ofertasAprobadas`: aprobadas no postuladas, ordenadas por % match DESC
- `ofertasPostuladas`: cv_enviado o en_proceso, ordenadas por % match DESC
- `ofertasRechazadas`: rechazadas o descartadas, ordenadas por % match DESC
- `ofertasPendientes`: pendientes sin postular, ordenadas por fecha DESC
- Stats: total, pendientes, aprobadas, postuladas, rechazadas

**Flujo de carga**:
1. Si modo demo → carga datos mock
2. Sino → restaura cache de localStorage + carga datos frescos del backend
3. Si backend falla → muestra datos de cache con aviso
4. Si no hay cache ni backend → mensaje de error

**Polling de evaluación**:
- `onProgresoEvaluacion()`: refresh liviano durante polling
- Hace **merge** entre API y estado local para no pisar optimistic updates
- Se llama desde `PanelControl` vía evento `(evaluacionEnProgreso)`

**Template**:
1. Mensaje de estado condicional (cache/fresco)
2. Encabezado con 5 stat cards
3. `<app-panel-control>` con eventos
4. Filtro plataforma (`p-select`)
5. 4 tabs (`p-tabs`): Aprobadas, Postuladas, Rechazadas, Pendientes
6. Cada tab contiene `<app-tabla-ofertas>`
7. `<app-detalle-oferta>` con two-way binding

---

### Login (`paginas/login/`)

Página de autenticación. Sin shell (sidebar/topbar ocultos).

**Opciones**:
1. **Google Sign-in**: popup Firebase Auth → token JWT → backend
2. **Modo Demo**: activa `DemoService`, usa datos mock, no requiere backend

**Estética**: "The Silent Processor" — dark techno minimalista, JetBrains Mono,
espacio negativo extremo, botones con `letter-spacing: 0.2em`.

**Template**:
- Header fijo: marca + toggle tema + versión
- Card central: "VERIFICATION_REQUIRED", "Authentication"
- Botón Google con SVG inline + spinner en carga
- Separador "o" + botón invitado con badge "DEMO"
- Footer fijo con metadata

---

### Preferencias (`paginas/preferencias/`)

Página de configuración del perfil con 8 tabs.

**Tabs**:
| # | Tab | Contenido |
|---|-----|-----------|
| 0 | PERFIL | nombre, nivel, modalidad, disponibilidad, años exp, salario, moneda, perfil, idioma, inglés detallado, zonas, seniority real, conocimientos ausentes, limitaciones |
| 1 | TECNOLOGÍAS | tabla editable con nombre, nivel, categoría, importancia, aliases, evidencia. Botones agregar/quitar/cargar sugeridas |
| 2 | ROLES | tabla editable con rol, prioridad, aliases |
| 3 | SCORING | umbral, ajustes, penalizaciones, bonificaciones |
| 4 | BÚSQUEDA | términos, keywords, plataformas preferidas/excluidas, reglas |
| 5 | IA | modelo evaluación, modelo importación, prompt personalizado |
| 6 | IMPORTAR CV | input file .md, botón analizar, vista previa, preguntas accionables |
| 7 | EVALUACIONES | días a resetear, última importación, versión scoring, botón resetear |

**Nota importante**: Los campos `temperaturaEvaluacion`, `temperaturaImportacion`
y `maxCaracteresDescripcionIa` están **comentados** en el template porque el
backend los hardcodea. No están conectados a la API.

**Guardado**:
- Deriva `stack_tecnologico` desde `tecnologias_detalle` automáticamente
- PUT `/api/preferencias` con solo los campos modificados
- Toast de éxito/error

**Importar CV**:
- Acepta solo `.md`, máximo 1MB
- POST `/api/preferencias/importar-cv/analizar`
- Muestra vista previa del resultado con tecnologías, roles, preguntas
- Preguntas accionables (aceptar sugerencia) e informativas

---

## Componentes

### PanelControl (`componentes/panel-control/`)

Panel de acciones: scraping individual, ciclo completo, evaluación, automatización.

**Secciones**:
1. **Scraping**: grid de 12 botones (desktop) + selector `p-select` (mobile)
2. **Ciclo completo**: botón "Ejecutar ciclo completo" + overlay con progreso
3. **Evaluación**: botón ejecutar/cancelar + progress bar + detalle numérico
4. **Automatización**: toggle switch cron + última ejecución

**Polling**:
- **Evaluación**: intervalo 2000ms. Guard contra requests solapadas.
  Límite de 5 errores 429 consecutivos. Al completarse: toast + evento.
- **Automatización**: intervalo 2000ms. Mismas protecciones.

**Limpieza**: `ngOnDestroy()` limpia ambos intervalos.

**Rehidratación**: Si al iniciar detecta evaluación activa en backend,
reanuda el polling automáticamente.

---

### TablaOfertas (`componentes/tabla-ofertas/`)

Tabla de ofertas con dos vistas: desktop y mobile.

**Vista desktop**: `p-table` con 9 columnas (checkbox, título, empresa, plataforma,
estado, match%, postulación, fecha, acción). Paginador PrimeNG. Filtro global.
Barra de acciones masivas condicional.

**Vista mobile**: Cards individuales con título, empresa, match, ubicación,
plataforma, estado, postulación. Paginador custom con botones anterior/siguiente.
Buscador propio.

**Selección masiva**: Checkbox en cada fila + "seleccionar todas".
Dropdown para elegir estado de postulación. Botones aplicar/cancelar.

**Optimistic update**: Al cambiar postulación, muta el objeto inmediatamente
y emite evento. Si el backend falla, revierte el cambio.

**Accesibilidad**: Cards activables con Enter/Espacio. Touch targets ≥44px.

---

### DetalleOferta (`componentes/detalle-oferta/`)

Modal con `p-dialog` que muestra información completa de una oferta.

**Secciones**: título, empresa, ubicación, modalidad, tags (plataforma, estado,
match%, nivel), salario, evaluación IA, postulación (dropdown editable),
descripción, fechas.

**Optimistic update**: Misma estrategia que TablaOfertas.

**Focus management**: Guarda elemento con foco antes de abrir, lo restaura al cerrar.
Focus trap manual (no usa el de PrimeNG).

**Accesibilidad**: `aria-label` en botones, `role="dialog"`, etiquetas en dropdowns.

---

## Servicios Angular

| Servicio | Endpoints | Responsabilidad |
|----------|-----------|-----------------|
| `AuthService` | Firebase Auth | Login/logout Google, token JWT |
| `DemoService` | — | Modo invitado con datos mock (sessionStorage) |
| `OfertasService` | `/api/ofertas/*` | CRUD de ofertas, estadísticas, postulación |
| `ScrapingService` | `/api/scraping/*` | 12 endpoints, uno por plataforma |
| `EvaluacionService` | `/api/evaluacion/*` | Ejecutar, progreso, cancelar, resetear |
| `AutomatizacionService` | `/api/automatizacion/*` | Estado, iniciar/detener cron, ejecutar ciclo |
| `PreferenciasService` | `/api/preferencias/*` | CRUD preferencias, importar CV |
| `PersistenciaDashboardService` | — | Cache de ofertas en localStorage |

### PersistenciaDashboardService
- **Clave**: `busca-empleos.dashboard.cache`
- Guarda ofertas + estadísticas + fecha
- **Excluye `datos_crudos`** del cache para no superar cuota de 5MB de localStorage
- Catch de `QuotaExceededError` → limpia cache
- Validación de formato al leer (descarta JSON corrupto o forma inválida)

### DemoService
- **Almacenamiento**: `sessionStorage` (no `localStorage` → se resetea al cerrar pestaña)
- Flag `esModoDemo` como `Signal<boolean>`
- Datos mock: 25 ofertas con distribución realista (aprobadas, rechazadas, pendientes)
- Estadísticas calculadas dinámicamente
