# 07 — Frontend: Arquitectura Angular

## Stack

| Tecnología | Versión |
|-----------|---------|
| Angular | 20.3.0 |
| TypeScript | 5.9.2 |
| PrimeNG | 20.4.0 |
| PrimeIcons | 7.0.0 |
| Angular Fire | 20.0.1 |
| Firebase SDK | 11.10.0 |
| RxJS | 7.8.0 |
| Zone.js | 0.15.0 |

## Estructura de archivos

```
frontend/src/app/
├── app.config.ts              ← Providers globales (router, http, PrimeNG, Firebase)
├── app.routes.ts              ← Rutas lazy-loaded
├── app.ts                     ← Componente raíz (shell con sidebar + topbar)
├── app.html                   ← Template del shell
├── app.css                    ← Estilos del shell
├── app.spec.ts                ← Tests del shell
├── componentes/               ← Componentes reutilizables
│   ├── detalle-oferta/        ← Modal de detalle de oferta
│   ├── panel-control/         ← Panel de scraping y evaluación
│   └── tabla-ofertas/         ← Tabla de ofertas (desktop + cards mobile)
├── datos/
│   └── ofertas-demo.ts        ← 25 ofertas mock para modo demo
├── guards/
│   └── auth.guard.ts          ← CanActivateFn (Firebase + Demo)
├── interceptores/
│   └── auth.interceptor.ts    ← Adjunta Bearer token
├── modelos/
│   ├── oferta.model.ts        ← Interface Oferta (21 campos)
│   ├── preferencia.model.ts   ← Interface Preferencias (33+ campos)
│   └── respuesta-api.model.ts ← Wrappers genéricos de respuesta
├── paginas/
│   ├── dashboard/             ← Página principal (tabs de ofertas)
│   ├── login/                 ← Login con Google / modo demo
│   └── preferencias/          ← Configuración de perfil
└── servicios/
    ├── auth.service.ts        ← Firebase Auth (login/logout/token)
    ├── automatizacion.service.ts
    ├── demo.service.ts        ← Modo demo (sessionStorage)
    ├── evaluacion.service.ts
    ├── ofertas.service.ts
    ├── persistencia-dashboard.service.ts ← Cache en localStorage
    ├── preferencias.service.ts
    └── scraping.service.ts
```

## Configuración global (app.config.ts)

```typescript
providers: [
  provideBrowserGlobalErrorListeners(),
  provideZoneChangeDetection({ eventCoalescing: true }),
  provideRouter(routes),
  provideHttpClient(withInterceptors([authInterceptor])),
  provideAnimationsAsync(),
  providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: 'none' } } }),
  provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
  provideAuth(() => getAuth()),
]
```

**Nota**: `darkModeSelector: 'none'` — el tema oscuro se maneja manualmente con clase
CSS en `<html>` en vez del sistema built-in de PrimeNG.

## Rutas (app.routes.ts)

| Path | Guard | Componente | Carga |
|------|-------|-----------|-------|
| `''` | `authGuard` | `Dashboard` | `loadComponent` (lazy) |
| `'preferencias'` | `authGuard` | `Preferencias` | `loadComponent` (lazy) |
| `'login'` | — | `Login` | `loadComponent` (lazy) |
| `'**'` | — | redirectTo: `'login'` | — |

Todas las páginas son standalone y se cargan con lazy loading.
No hay rutas anidadas ni children.

## Auth Guard (auth.guard.ts)

`CanActivateFn` funcional:
1. Si `DemoService.esModoDemo()` → `true` (pasa sin auth)
2. Sino: `user(auth).pipe(take(1), map(...))`
   - Si hay usuario Firebase → `true`
   - Si no → `router.createUrlTree(['/login'])`

## HTTP Interceptor (auth.interceptor.ts)

`HttpInterceptorFn`:
1. Llama `authService.obtenerToken()` (Promise → Observable con `from()`)
2. Si hay token: clona request con header `Authorization: Bearer <token>`
3. Si no hay token: pasa request sin modificar

## Shell de la aplicación (App)

El componente raíz `App` actúa como shell con:
- **Sidebar** (`<nav>`): navegación (Dashboard, Preferencias), marca, versión
- **Topbar** (`<header>`): sección actual, estado del sistema, botones (tema, logout)
- **Main** (`<main>`): `<router-outlet />`
- **Footer** (`<footer>`): build, estado, metadata

### Comportamiento responsive
- **Desktop** (>1024px): sidebar fijo 256px
- **Tablet** (769-1024px): sidebar 200px
- **Mobile** (≤768px): sidebar off-canvas con overlay + focus trap + Escape

### Accesibilidad del shell
- Sidebar mobile: `role="dialog"`, `aria-expanded`, focus trap con Tab/Shift+Tab
- Guarda/restaura elemento con foco previo al abrir/cerrar sidebar
- Media query listener para detectar viewport mobile

## Modelos TypeScript

### `Oferta` (21 campos)
- `id`, `titulo`, `empresa`, `ubicacion`, `modalidad`, `descripcion`, `url`
- `plataforma`: union type de 11 strings
- `nivel_requerido`
- `salario_min`, `salario_max`, `moneda`
- `estado_evaluacion`: `'pendiente' | 'aprobada' | 'rechazada'`
- `razon_evaluacion`, `porcentaje_match`
- `estado_postulacion`: `'no_postulado' | 'cv_enviado' | 'en_proceso' | 'descartada'`
- `fecha_publicacion`, `fecha_extraccion`
- `datos_crudos`: `Record<string, unknown> | null`

### `Preferencias` (33+ campos)
Cubre perfil, tecnologías detalladas, roles, scoring, disponibilidad, salario,
inglés detallado, keywords, plataformas, IA config, backup.

### `RespuestaApi<T>`
Wrapper genérico: `{ exito: boolean, datos: T, total?, error? }` con
especializaciones para scraping, evaluación, automatización.

## Environments

| Archivo | Entorno | `urlApi` |
|---------|---------|----------|
| `environment.ts` | Desarrollo | `http://localhost:3000/api` |
| `environment.prod.ts` | Producción | `https://busca-empleos-production.up.railway.app/api` |

Ambos incluyen `firebaseConfig` con valores reales. Están en `.gitignore`.

## Styles globales (styles.css)

- **Design tokens**: ~40 variables CSS (superficies, texto, bordes, colores semánticos,
  tipografía, espaciado, layout, breakpoints)
- **Reset global**: `* { margin: 0; padding: 0; box-sizing: border-box }`
- **Accesibilidad**: `*:focus-visible { outline: 2px solid var(--primary) }`,
  `prefers-reduced-motion: reduce`
- **Fuentes**: Inter (body), JetBrains Mono (mono), Space Grotesk (display),
  Material Symbols (iconos)
- **PrimeNG overrides**: light + dark mode para DataTable, Paginator, Buttons,
  Tags, Dialog, InputText, Textarea, Select, MultiSelect, ToggleSwitch,
  ProgressBar, Toast, Tabs
- **Dark mode**: `html.dark` activa inversión de tokens + overrides específicos
- **Scrollbar**: 4px ancho, thumb gris
