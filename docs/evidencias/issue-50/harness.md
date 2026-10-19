# Issue #50 — Preparación reproducible del detalle

## Estado de esta entrega

Preparé datos y pruebas, **no modifiqué el modal ni ejecuté capturas desde el worker**. El padre informó el resultado real de job7: **88 passed, 11 failed** (10 capturas de postulada y su smoke). Los fallos fueron timeouts de `locator.click`: el helper buscaba la oferta 501 en APROBADAS, pero ese escenario requiere la pestaña POSTULADAS. Corregí únicamente esa navegación sintética; no es un defecto de UI ni de fixture. El padre reejecutará sólo los casos postulada faltantes, preservando las 80 capturas ANTES existentes. Todavía no afirmo GREEN de la corrección.

Base inspeccionada: `a178393ffffc722796b65c6c6b2c452221d577f4` (#52/#53 presentes). El único archivo ajeno inicialmente sin seguimiento era `odd/tasks/issue-50-detalle-oferta-ui.md`; lo preservé.

## Ejecutar desde `frontend/`

Con las dependencias instaladas por el padre:

```sh
# Servidor local para Playwright MCP; reutilizo la configuración e2e existente.
npx --no-install ng serve --configuration e2e --host 127.0.0.1 --port 4350

# Smoke aislado. El runner existente también puede iniciar el servidor.
npm run test:e2e -- e2e/detalle-harness.spec.ts

# Captura explícita ANTES: ejecutar ANTES de modificar el modal.
EVIDENCIA50=antes npm run test:e2e -- e2e/detalle-capturas.spec.ts

# Después de T2, misma matriz y mismos datos.
EVIDENCIA50=despues npm run test:e2e -- e2e/detalle-capturas.spec.ts
```

La suite ordinaria utiliza `despues` para no sobrescribir el ANTES por accidente. Capturar `antes` nuevamente sí sobrescribe esos archivos: conservar la primera ejecución antes de avanzar a T2.

El runner existente usa `.angular/` y `frontend/test-results/`. No ejecuté tests ni capturas desde el worker por indicación del padre. El padre informó que el primer intento expiró por un environment ignorado faltante: no cuenta como RED. También detectó con navegador real que el orden descendente coloca 502 antes de 501: corregí ambos specs para identificar el título único de 501, sin depender del orden. No afirmo RED/GREEN de navegador.

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

Las capturas usan reloj fijo `2026-01-15T18:00:00.000Z`, fuentes locales del harness y animaciones desactivadas. Matriz: los nueve escenarios × claro/oscuro × 1440×900, 1024×768, 768×900, 390×844, 320×844 (90 casos). Todos los PNG quedan en `frontend/.angular/evidencia-50/<fase>/`, ignorado. Sólo copio cuatro imágenes representativas por fase a `docs/evidencias/issue-50/<fase>/`: aprobada desktop 1440 claro/oscuro, aprobada móvil 390 claro y rechazada móvil 320 claro. Un único `matriz.json` por fase registra todos los casos capturados, HEAD, fixture, ofertaId 501, URL, tema, viewport y medidas; incluye cantidades esperada/capturada para evidenciar ejecuciones incompletas. No genero JSON por imagen. Son capturas del viewport inicial, no pruebas de que todo el contenido interno sea visible o navegable. T3 debe recorrer el scroll y los expandibles.

## Mutaciones simuladas

No inicializo Firebase ni delego HTTP a la red. El interceptor existente registra métodos/rutas; las pruebas bloquean también recursos fuera de `127.0.0.1:4350`. Los enlaces originales son `example.invalid`; no hacer navegación externa al comprobarlos.

`PATCH /ofertas/:id/postulacion`, `/seguimiento`, `/descripcion` y `POST /evaluacion/ejecutar` tienen respuestas independientes del objeto optimista del Dashboard. GET/lista/sincronización devuelven copias del estado confirmado. Reabrir/refrescar permite revisar la persistencia sin inspeccionar almacenamiento interno.

- `errorDetalle=seguimiento` devuelve HTTP 503 sin modificar datos. También admite `postulacion`, `descripcion`, `reevaluacion`, separados por comas.
- `errorDetalle=validacion-seguimiento` fuerza HTTP 400; el mismo prefijo sirve para las otras operaciones.
- Validación ordinaria: estados manuales permitidos; fecha calendario real YYYY-MM-DD; nota hasta 4000 puntos Unicode; descripción entre 20 y 50000 caracteres al recortar extremos. Un rechazo no cambia datos confirmados.
- `demoraDetalle=900,50` demora la primera escritura 900 ms y las siguientes 50 ms, para comprobar revisiones concurrentes, cambio de oferta y borradores. Son demoras del servidor simulado, no sleeps del test.
- Guardar descripción conserva la original, marca procedencia manual y evaluación pendiente. No evalúa automáticamente. La reevaluación explícita responde como inicio asíncrono, no inventa un resultado DeepSeek completado.

## Histórico: compatibilidad y límite pendiente

Inspeccioné con `git show` el TS y HTML del modal de `73284da5463c916772274456a48ecedd19c9a608`. El modelo histórico consume un subconjunto de `Oferta`: puede recibir exactamente las mismas fixtures. Pero **no es un reemplazo directo del TS dentro del Dashboard actual**: le faltan los inputs `accionMasivaEnCurso` e `idsPostulacionPendiente` que hoy enlaza `dashboard.html` (líneas 271–272). No ejecuté un build histórico; esa incompatibilidad se deduce de los contratos, no es un error de compilador observado.

El fallback mínimo viable es conservar el TS actual y renderizar el HTML/CSS históricos con los estilos globales originales mediante reemplazos locales de build. Eso compara diseño histórico, no funcionalidad histórica completa. Preparar esos reemplazos exige una carpeta local ignorada y configuración alternativa fuera de las superficies delegadas: no la creé, ni toqué otro worktree. Tampoco agregué una etiqueta `historico` que pudiera hacer pasar el render actual por evidencia histórica.

Para el padre: autorizar y preparar ese sandbox aislado antes de capturar la comparación histórica, o documentar explícitamente esta limitación si decide no ejecutarlo. No presento capturas históricas inventadas ni afirmo que el histórico sea imposible de ejecutar.

## Cobertura y siguientes fases

Esta preparación contribuye a S1 (base/preservación), S2 (fixtures y captura ANTES preparada), S9 (harness real reutilizado), S11 (sin cambios productivos), S12 (matriz y metadatos preparados). No completa por sí sola S2/S12: faltan las ejecuciones reales y la verificación independiente del padre.

Los smoke cubren apertura/cierre sin escrituras, nueve escenarios, ocultamiento del score pendiente, error técnico, evaluación anterior conservada y exclusión Java. T3 debe expandir a los 22 recorridos: rollback visible, guardado y errores, revisiones/borradores, edición/cancelación, límites, reevaluación, evidencias plegadas, foco/teclado/overlays y desplazamiento interno. No agregué skips ni afirmaciones de accesibilidad o métricas no observadas.
