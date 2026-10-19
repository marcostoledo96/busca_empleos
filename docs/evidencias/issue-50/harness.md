# Issue #50 — Preparación reproducible del detalle

## Estado de esta entrega

El padre informó ejecuciones reales: histórico **90/90** (job8); ANTES job7 **88 passed, 11 failed**, por el helper que buscaba la oferta postulada en APROBADAS. Tras corregir sólo esa navegación, job9 **11/11** completó las capturas y smoke faltantes. Job11 consolidó ANTES **90/90** sin reemplazar los PNG originales. Job4 expiró por un environment local ignorado ausente: fue un fallo ambiental, no RED funcional. No oculto esos fallos.

El modal actual quedó implementado en `79e566c79719ee3d92e2c054d1a4fe446d8d30e5`; el padre informó RED focal **8 fallos/24 éxitos** y GREEN **32/32**. En T3 agregué pruebas funcionales y assertions geométricas para DESPUÉS, **sin ejecutar Playwright, suite Angular ni build desde este worker**. La primera ejecución del padre (job15, exit 1) dio **110 éxitos / 2 fallos**: metadatos con texto de icono incluido y un filtro `has` mal acotado para el desglose. Leí ambos fallos en el log; corregí los selectores manteniendo las comprobaciones exactas y todas las evidencias. Ese resultado no demuestra que la geometría ni el foco sean correctos: el MCP del padre reprodujo defectos adicionales descritos abajo.

Base inspeccionada: `a178393ffffc722796b65c6c6b2c452221d577f4` (#52/#53 presentes). El único archivo ajeno inicialmente sin seguimiento era `odd/tasks/issue-50-detalle-oferta-ui.md`; lo preservé.

## Ejecutar desde `frontend/`

Con las dependencias instaladas por el padre:

```sh
# Servidor local para Playwright MCP; reutilizo la configuración e2e existente.
npx --no-install ng serve --configuration e2e --host 127.0.0.1 --port 4350

# Smoke aislado. El runner existente también puede iniciar el servidor.
npm run test:e2e -- e2e/detalle-harness.spec.ts

# Recorridos funcionales focales (sin capturas de la matriz).
npm run test:e2e -- e2e/detalle-ui.spec.ts

# RED focal de límites de teclado y geometría (antes de corregir producción).
npm run test:e2e -- e2e/detalle-ui.spec.ts --grep '@detalle-red'

# Revalidar los dos selectores corregidos.
npm run test:e2e -- e2e/detalle-ui.spec.ts --grep 'cabecera inicial|exclusión crítica'

# DESPUÉS, misma matriz y mismos datos.
EVIDENCIA50=despues npm run test:e2e -- e2e/detalle-capturas.spec.ts
```

La suite utiliza `despues` y ahora rechaza cualquier otra fase: **no vuelve a escribir ANTES ni histórico**. Ambos están preservados como evidencia ya capturada.

El runner existente usa `.angular/` y `frontend/test-results/`. No ejecuté tests ni capturas desde el worker por indicación del padre. El padre informó que el primer intento expiró por un environment ignorado faltante: no cuenta como RED. También detectó con navegador real que el orden descendente coloca 502 antes de 501: corregí ambos specs para identificar el título único de 501, sin depender del orden. Los resultados posteriores de navegador están registrados en el cierre de este documento.

## Defectos reproducidos, RED y corrección verificada

El padre reprodujo con MCP, a 320×844 y título largo, cabecera de aproximadamente **699,95 px**, contenido de **48 px** y footer inferior en **867,75 px**, fuera del viewport (844 px) y del diálogo (borde inferior ≈801,8 px). La matriz anterior comprobaba el diálogo, pero no los límites completos del footer: sus 90 éxitos no cubrían ese defecto. También reprodujo `Shift+Tab` desde el enlace original hacia el fondo (Jobs by Adzuna).

Agregué **siete casos focales `@detalle-red`**, sin editar producción: dos sentidos de cruce entre primer/último control; selector operado con teclado y Escape del overlay separado del Escape del diálogo; footer completo dentro de diálogo/viewport y área útil de contenido a 320 px en ambos temas; lectura del comienzo/final del título largo mediante scroll interno en ambos temas, verificando clipping de sus ancestros y sin desplazar el fondo. El helper común ahora exige footer completamente contenido y al menos **160 px de contenido útil**, en vez de aceptar cualquier altura positiva. Es un umbral funcional explícito de esta prueba, no una métrica WCAG.

Conservé los 22 casos anteriores y sus evidencias. El padre observó RED de los siete casos: **4 fallos / 3 éxitos** (job18), corrigió producción sin activar el focus trap nativo y comprobó GREEN **9/9** (job19, también dos selectores corregidos). La identidad extensa ahora participa del scroll común; el manejador local envuelve Tab sólo en los extremos y respeta el selector expandido. Las ejecuciones finales posteriores a la corrección fueron job20 E2E **172/172**, matriz **90/90**, job21 Angular **547 éxitos / 4 omisiones preexistentes** y job22 build **exit 0** con advertencia preexistente de Preferencias **15,61 kB**. No se usa el GREEN anterior como sustituto de estas pruebas finales.

## Datos y selectores

URL inicial: `http://127.0.0.1:4350/?detalle=aprobada&tema=claro`.

`detalle` admite `aprobada`, `rechazada`, `pendiente`, `error`, `reevaluacion-fallida`, `desactualizada`, `historica`, `postulada`, `textos-largos`. `tema=oscuro` activa la clase y el preset oscuro; `tema=claro` usa el claro.

Siempre renderizo Dashboard → lista real → modal real. Agrego una segunda oferta aprobada (502) para los borradores por oferta, sin mutar la fixture principal (501).

Selectores Playwright MCP:

```js
// Rechazada: seleccionar RECHAZADAS. Pendiente/error/desactualizada: PENDIENTES.
// Postulada: seleccionar explícitamente getByRole('tab', { name: /POSTULADAS/ }).
await page.getByRole('tab', { name: /RECHAZADAS/ }).click();
// Desktop (>768px), oferta 501 exclusivamente:
await page.getByRole('button', { name: 'Ver detalle de Frontend Angular junior · oferta sintética', exact: true }).click();
// En móvil (<=768px), usar en cambio la tarjeta accesible:
// await page.getByRole('listitem', { name: 'Oferta: Frontend Angular junior · oferta sintética', exact: true }).click();
// Para textos-largos, usar /^Ver detalle de Frontend sintética/ o /^Oferta: Frontend sintética/.
const modal = page.getByRole('dialog');
await modal.getByRole('combobox', { name: 'Estado manual actual' }).click();
await page.getByRole('option', { name: 'CV enviado', exact: true }).click();
// Reabrir si el cambio de estado cierra el modal.
await modal.getByLabel('Fecha de envío, si se conoce').fill('2026-01-14');
await modal.getByLabel('Nota de seguimiento', { exact: true }).fill('Borrador sintético');
await modal.getByRole('button', { name: 'Guardar seguimiento', exact: true }).click();
await modal.getByRole('button', { name: 'Completar o editar descripción' }).click();
await modal.getByRole('textbox', { name: 'Editor de descripción de la oferta' }).fill('Descripción sintética válida con más de veinte caracteres.');
await page.keyboard.press('Escape');
await page.getByText('Registro del fixture', { exact: true }).click();
const llamadas = page.getByLabel('Llamadas simuladas');
```

Las capturas usan reloj fijo `2026-01-15T18:00:00.000Z`, fuentes locales del harness y animaciones desactivadas. Matriz: los nueve escenarios × claro/oscuro × 1440×900, 1024×768, 768×900, 390×844, 320×844 (90 casos). Todos los PNG quedan en `frontend/.angular/evidencia-50/<fase>/`, ignorado. Sólo copio cuatro imágenes representativas por fase a `docs/evidencias/issue-50/<fase>/`: aprobada desktop 1440 claro/oscuro, aprobada móvil 390 claro y rechazada móvil 320 claro. Un único `matriz.json` por fase registra todos los casos capturados, HEAD, fixture, ofertaId 501, URL, tema, viewport y medidas; incluye cantidades esperada/capturada para evidenciar ejecuciones incompletas. No genero JSON por imagen. Los PNG conservan el viewport inicial. Cada caso DESPUÉS exige scrollTop inicial cero, un solo score válido (ninguno en pendiente/error/desactualizada), modal dentro del viewport y ausencia de overflow horizontal. Luego abre todos los `details` por teclado, alcanza el final del scroll interno y comprueba geometría de contenido/footer y del botón de seguimiento. El JSON guarda medidas iniciales/finales y controles. La fusión por escenario/tema/viewport conserva filas de ejecuciones filtradas del mismo candidato; un fallo reemplaza la fila por `validado:false`. `casosCapturados` cuenta sólo filas validadas. Un candidato distinto (HEAD + huella del diff y spec funcional) se conserva en `ejecucionesAnteriores`, nunca se suma como éxito del actual.

## Mutaciones simuladas

No inicializo Firebase ni delego HTTP a la red. El interceptor existente registra métodos/rutas; las pruebas bloquean también recursos fuera de `127.0.0.1:4350`. Los enlaces originales son `example.invalid`; no hacer navegación externa al comprobarlos.

`PATCH /ofertas/:id/postulacion`, `/seguimiento`, `/descripcion` y `POST /evaluacion/ejecutar` tienen respuestas independientes del objeto optimista del Dashboard. GET/lista/sincronización devuelven copias del estado confirmado. Reabrir/refrescar permite revisar la persistencia sin inspeccionar almacenamiento interno.

- `errorDetalle=seguimiento` devuelve HTTP 503 sin modificar datos. También admite `postulacion`, `descripcion`, `reevaluacion`, separados por comas.
- `errorDetalle=validacion-seguimiento` fuerza HTTP 400; el mismo prefijo sirve para las otras operaciones.
- Validación ordinaria: estados manuales permitidos; fecha calendario real YYYY-MM-DD; nota hasta 4000 puntos Unicode; descripción entre 20 y 50000 caracteres al recortar extremos. Un rechazo no cambia datos confirmados.
- `demoraDetalle=900,50` demora la primera escritura 900 ms y las siguientes 50 ms, para comprobar revisiones concurrentes, cambio de oferta y borradores. Son demoras del servidor simulado, no sleeps del test.
- Guardar descripción conserva la original, marca procedencia manual y evaluación pendiente. No evalúa automáticamente. La reevaluación explícita responde como inicio asíncrono, no inventa un resultado DeepSeek completado.

## Histórico: render completado

El padre renderizó el modal original de `73284da5463c916772274456a48ecedd19c9a608` en un worktree histórico aislado, puerto **4351**, y completó **90/90** capturas. Conservó **TS, HTML, CSS del modal y estilos globales originales sin cambios**; copió los tipos actuales de modelo y usó un bootstrap diferente detrás del diálogo con los mismos valores de fixture v1. No se utilizó el fallback antes propuesto de TS actual con HTML antiguo.

La comparación es de renders reales del modal con datos sintéticos idénticos; el fondo/bootstrap histórico no es el Dashboard actual de 4350. No implica equivalencia funcional completa entre aplicaciones. La matriz histórica registra el HEAD histórico y las medidas; en este paso la preservé sin reescritura.

## Cobertura y siguientes fases

T3 contribuye a S2 y S7–S12. Los smoke existentes conservan sus assertions. `detalle-ui.spec.ts` agrega los recorridos solicitados: cabecera/enlace sin navegar, evaluación y avisos únicos, evidencia completa por teclado, selector/overlay y rollback, fecha/nota con guardado explícito/carga/éxito, errores HTTP y validación, límites Unicode, borradores por oferta y revisiones durante guardado demorado, descripción completa/cancelar/validar/guardar y errores, metadatos, reevaluación explícita simulada y fallo, Escape/Cerrar/foco/Tab y textos extremos móviles claro/oscuro. El registro HTTP público verifica ausencia de escrituras al navegar y métodos/rutas exactos en acciones explícitas. No se inspecciona almacenamiento interno.

`extremosDetalle=1` es una variante optativa con URL y nota sin espacios largas; no cambia la fixture v1 comparativa. Se combina con `textos-largos` sólo en los casos funcionales de 320/390 px. La matriz normal sigue siendo nueve escenarios × cinco tamaños × dos temas.

No agregué skips ni debilitamiento de assertions previas. No afirmo conformidad WCAG ni métricas de accesibilidad. La verificación independiente completó sus focales **32/32** y tres probes propios **3/3**, contrastó capturas/matrices y no encontró bloqueantes técnicos. Tras incorporar esos probes sin modificar sus bytes, la suite Angular completa pasó **550 pruebas**, con las **4 omisiones preexistentes** (job23, exit 0). Esos probes se incorporan como `verificacion-independiente.spec.ts`, sin cambios respecto del archivo ejecutado. La publicación y CI se documentan por separado; ver [informe de evidencia](README.md) y [verificación independiente](verificacion-independiente.md).
