# Guía de pruebas manuales — Estabilización y QA visual (#102)

Esta guía acompaña la PR #103 (rama `feature/estabilidad-qa-web`, base `master`) para validar de forma reproducible el comportamiento de sesión, seguimiento de progreso y diseño de la web sin consumir saldo ni escribir datos en producción.

## Reglas de seguridad antes de empezar

- **En entorno local:** usá el modo demo (`VER_SISTEMA`) o el harness sintético local (`ng serve --configuration e2e` / `integracion` con API simulada). No cargues credenciales reales ni claves de Apify/DeepSeek.
- **En producción (solo el titular):** realizá únicamente comprobaciones de lectura. **No** dispares scraping, **no** ejecutes ni reinicies evaluaciones con IA y **no** guardes cambios en Preferencias durante esta verificación.
- **Condición de corte (cuándo detenerse):** frená la prueba si observás un bucle de redirecciones a `/login`, un botón bloqueado por un aviso/toast, texto cortado en controles principales, desborde horizontal global de página o errores no controlados en la consola del navegador. Capturá el viewport exacto y el mensaje de consola/red sin exponer tokens ni datos personales.

---

## Recorrido paso a paso

### 1. Login y acceso en modo demo (1440×900 y 390×844)

- **Pasos:**
  1. Abrí `/login` en escritorio (`1440×900`) y móvil (`390×844`).
  2. Revisá contraste del encabezado, botón de Google, botón `VER_SISTEMA`, nota de modo demo y alternancia de tema claro/oscuro.
  3. Hacé clic en `VER_SISTEMA` para ingresar en `MODO_DEMO`.
- **Resultado esperado:** todos los íconos se ven correctamente (sin textos literales como `info`, `visibility` o `error`), la lectura es nítida en claro y oscuro, y al entrar aparece el banner `MODO_DEMO` con acciones de escritura deshabilitadas.
- **Qué capturar:** `/login` (claro) y Dashboard en `MODO_DEMO` (`1440×900` y `390×844`).

### 2. Dashboard, panel de control y tabla de ofertas (1440×900 y 1024×768)

- **Pasos:**
  1. En el dashboard (`1440×900`), revisá el bloque `PANEL DE CONTROL` y la tabla `OFERTAS_EMPLEO`.
  2. Verificá que `▸ ESTADO OPERATIVO` arranca plegado; hacé clic para desplegarlo y volvelo a cerrar.
  3. Redimensioná a `1024×768` (tema claro y oscuro) y verificá la columna `POSTULACIÓN` y el scroll horizontal.
  4. Aplicá el filtro de plataforma y el buscador de texto; abrí una oferta con el botón `Ver detalle` y cerrá el diálogo con `Escape`.
- **Resultado esperado:**
  - `SCRAPING` y `EVALUACIÓN IA + AUTOMATIZACIÓN` quedan nivelados a la misma altura sin hueco vacío debajo de los botones de scraping.
  - En `1440×900`, la tabla entra sin scroll horizontal y se ven completos `"No postulado"` y el botón `Ver detalle`.
  - En `1024×768`, la página **no** tiene scroll horizontal global (`scrollWidth <= innerWidth`), la tabla se desplaza internamente y `"No postulado"` no se trunca (`No postul…`).
  - El estado vacío muestra un ícono de bandeja real (nunca la palabra literal `"inbox"`).
- **Qué capturar:** Dashboard primer pliegue (`1440×900`), tabla a `1024×768` claro y oscuro, y detalle de oferta abierto.

### 3. Avisos/toast y acciones en móvil (390×844 y 320×844)

- **Pasos (solo en entorno local sintético):**
  1. Configurá viewport `320×844` y luego `390×844` (claro y oscuro).
  2. Dispará una acción sintética que muestre un toast extenso (por ejemplo, escenario parcial o error en el harness E2E).
  3. Con el toast abierto en pantalla, hacé clic en `Ejecutar todo` y luego probá cerrar el toast desde su botón `×`.
- **Resultado esperado:** el toast se lee íntegro sobre el margen inferior, **no** cubre la barra superior ni intercepta el clic sobre `Ejecutar todo`, y su botón `×` responde al clic/teclado.
- **Qué capturar:** pantalla móvil con toast visible y sin solapar controles de acción.

### 4. Sesión vencida (401) vs acceso denegado (403) y corte temporal en progreso

- **Pasos (solo en entorno local sintético):**
  1. Simulá una respuesta HTTP `401` durante la carga o el sondeo de evaluación.
  2. Simulá una respuesta HTTP `403` en el dashboard.
  3. Simulá un corte temporal (`status 0` o `503`) en el primer `GET /api/evaluacion/progreso` con un lote activo y luego restablecé la conexión.
- **Resultado esperado:**
  - Ante `401`: corta el sondeo y redirige una sola vez a `/login?motivo=sesion-expirada` mostrando el aviso de sesión vencida.
  - Ante `403`: permanece en el dashboard, informa el error original y deja habilitado `REINTENTAR`.
  - Ante `0`/`503` inicial: reintenta solo con `GET` de forma acotada (hasta 3 reintentos) y retoma el seguimiento al reconectar sin lanzar ningún `POST` nuevo ni perder el resultado previo.
- **Qué capturar:** redirección a `/login?motivo=sesion-expirada` con la alerta visible y pestaña Network mostrando solo `GET` (sin `POST` duplicados).

### 5. Preferencias — las 7 pestañas (1440×900 y 390×844)

- **Pasos:**
  1. Abrí `/preferencias` y recorré con mouse y teclado (`Tab` / `Enter`) las 7 pestañas: `PERFIL`, `TECNOLOGÍAS`, `ROLES`, `BÚSQUEDA`, `IA`, `IMPORTAR CV` y `EVALUACIONES`.
  2. Comprobá el enlace `Preparar CV imprimible con los datos guardados`, la grilla de 4 campos salariales en `PERFIL`, los selectores de `TECNOLOGÍAS` y `ROLES`, los chips de `BÚSQUEDA` y el desplegable de `IMPORTAR CV`.
- **Resultado esperado:** tipografía y controles uniformes en las 7 pestañas, botón de CV estilizado en cabecera, selects sin cortes (`Medio`, `Frontend`, `Principal` íntegros), íconos locales visibles (`+`, `×`, reset) y cero desborde horizontal en móvil.
- **Qué capturar:** `PERFIL`, `TECNOLOGÍAS` y `ROLES` en `1440×900` y `390×844`.

---

## Alcance y límites de la verificación automatizada

- **Verificado en entorno local/CI sintético:** pruebas unitarias Angular/Karma, suite Playwright E2E de frontend (`1440`, `1366`, `1024`, `768`, `390`, `320` en claro y oscuro) e integración Angular → Express → PostgreSQL efímero en CI (`Issue 57`).
- **No acreditado por esta guía ni por mocks locales:** validez actual de credenciales reales de Firebase, conectividad a PostgreSQL en Railway, cuotas/respuestas reales de Apify y consumo/respuestas reales de DeepSeek.
