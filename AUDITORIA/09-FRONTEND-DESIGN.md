# 09 — Frontend: Design System y Accesibilidad

## Design Tokens (~40 variables CSS)

### Superficies (light mode)
```css
--surface: #ffffff
--surface-container-lowest: #f8f9fa
--surface-container-low: #f1f3f5
--surface-container: #e9ecef
--surface-container-high: #dee2e6
--surface-container-highest: #ced4da
--surface-dim: #e9ecef
```

### Texto
```css
--on-surface: #1a1a1a
--on-surface-variant: #495057
```

### Bordes
```css
--outline: #6c757d
--outline-variant: #adb5bd
--border-structure: #212529
```

### Primarios
```css
--primary: #000000
--on-primary: #ffffff
--primary-container: #e0e0e0
```

### Colores semánticos
```css
--color-exito: #2b8a3e
--color-peligro: #e03131
--color-error: #c92a2a
--color-advertencia: #f08c00
--color-info: #1971c2
```

### Tipografía
```css
--font-headline: 'Inter', sans-serif
--font-body: 'Inter', sans-serif
--font-mono: 'JetBrains Mono', monospace
```

### Layout
```css
--sidebar-ancho: 256px
--topbar-alto: 64px
--espaciado-seccion: 1.5rem
--radius-sm: 2px
--radius-md: 4px
--radius-lg: 8px
```

### Breakpoints
```css
--bp-mobile: 768px
--bp-tablet: 1024px
```

---

## Dark Mode

Activado con clase `html.dark`. Invierte todos los tokens:

```css
html.dark {
  --surface: #121212;
  --surface-container: #1e1e1e;
  --on-surface: #e0e0e0;
  --primary: #ffffff;
  --on-primary: #000000;
  /* ... */
}
```

**Mecanismo**: Toggle manual en el shell (`App.toggleTema()`), persistido en
localStorage (`busca-empleos.tema`). No usa `darkModeSelector` de PrimeNG (`'none'`).

Todos los componentes PrimeNG tienen overrides CSS específicos en dark mode
(DataTable, Dialog, Inputs, Selects, Tabs, etc.).

---

## Responsive Design

### Desktop (>1024px)
- Sidebar fijo izquierdo (256px)
- Topbar fixed (64px)
- Tabla de ofertas con 9 columnas
- Grid de botones de scraping horizontal
- Panel de preferencias centrado (`min(1380px, calc(100vw - 96px))`)

### Tablet (769px - 1024px)
- Sidebar 200px
- Stats en grid de 2 columnas
- Preferencias a ancho casi completo

### Mobile (≤768px)
- Sidebar off-canvas (translateX(-100%)) con overlay
- Hamburger button visible
- Topbar y footer a ancho completo
- Vista de cards en vez de tabla
- Selector de plataformas en vez de grid de botones
- Preferencias: todos los grids a 1 columna
- Header/footer de login con padding reducido

---

## Accesibilidad (WCAG 2.1 AA)

### Navegación
- **Skip links**: No implementados
- **Focus visible**: `*:focus-visible { outline: 2px solid var(--primary) }` global
- **Focus trap**: Sidebar mobile (Tab/Shift+Tab ciclan dentro del sidebar)
- **Restauración de foco**: Al cerrar sidebar, modal o detalle

### ARIA
- Sidebar mobile: `role="dialog"`, `aria-expanded`, `aria-label`
- Cards: `role="button"`, `tabindex="0"`, `aria-label` descriptivo
- Estados dinámicos: `aria-live="polite"` para mensajes de toast y progreso
- Tablas: `role="grid"`, `aria-sort` en columnas ordenables
- Diálogos: `role="dialog"`, `aria-labelledby`, `aria-describedby`
- Botones sin texto: `aria-label` en iconos

### Teclado
- Navegación completa sin mouse
- Escape: cierra sidebar, modal, diálogos
- Enter/Espacio: activa cards, botones, checkboxes
- Tab: navegación lineal lógica
- Detalle de oferta: focus trap manual con manejo de Tab/Shift+Tab

### Touch
- Targets ≥ 44px (cumple WCAG 2.5.5)
- Checkboxes con tamaño aumentado
- Área de click en cards completa

### Animaciones
- `prefers-reduced-motion: reduce` respetado (anula todas las animaciones)
- Animación `aparecer` en dashboard solo si no hay preferencia de reducción

### Contraste y color
- Colores semánticos con buen contraste sobre fondos
- Dark mode con contraste adecuado
- No se depende solo del color para comunicar información
  (tags con texto + color, match con número + barra)

---

## Estados de UI

### Estados de carga

| Componente | Indicador |
|-----------|-----------|
| Dashboard | `p-table [loading]` spinner |
| Login | Spinner en botón Google, texto "INITIALIZING_SESSION..." |
| Preferencias | Esqueleto de pulso (3 bloques animados) |
| Preferencias (guardar) | Icono spin en botón "GUARDAR" |
| Scraping individual | Botón deshabilitado + overlay con spinner |
| Evaluación | Progress bar + overlay |
| Ciclo completo | Overlay con pasos y porcentaje |
| Reset evaluaciones | Icono spin en botón |
| Analizar CV | Icono spin + texto "ANALIZANDO CV..." |

### Estados vacíos

| Componente | Mensaje |
|-----------|---------|
| Tab Aprobadas | "No hay ofertas aprobadas todavía" |
| Tab Postuladas | "No te postulaste a ninguna oferta" |
| Tab Rechazadas | "No hay ofertas rechazadas" |
| Tab Pendientes | "No hay ofertas pendientes de evaluación" |

### Estados de error

| Escenario | Manejo |
|-----------|--------|
| Backend no responde (dashboard) | Mensaje "Verificá que el backend esté corriendo" o fallback a cache |
| Error 401 | Auth guard redirige a login |
| Error 429 (polling) | Detiene polling tras 5 errores consecutivos |
| Error 409 (evaluación concurrente) | Rehidrata estado en vez de mostrar error |
| Error login Google | Muestra "AUTHENTICATION_FAILED" |
| Error guardar preferencias | Toast con detalle del backend |
| Error scrapear plataforma | Toast con mensaje del backend |
| localStorage lleno | Limpia cache automáticamente |

### Banner de modo demo
- Fondo amarillo, texto negro
- "MODO DEMO — Datos de ejemplo. Algunas funciones no están disponibles."
- Visible en dashboard y preferencias
