# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: detalle-capturas.spec.ts >> captura despues textos-largos oscuro 768 @detalle-captura
- Location: e2e/detalle-capturas.spec.ts:56:17

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('listitem', { name: /^Oferta: Frontend sintética/ })

```

# Test source

```ts
  1  | import { expect, Page, Locator } from '@playwright/test';
  2  |
  3  | export async function abrirDetallePrincipal(page: Page, escenario: string) {
  4  |     if (['rechazada', 'pendiente', 'error', 'desactualizada'].includes(escenario)) {
  5  |         await page.getByRole('tab', { name: escenario === 'rechazada' ? /RECHAZADAS/ : /PENDIENTES/ }).click();
  6  |     } else if (escenario === 'postulada') {
  7  |         await page.getByRole('tab', { name: /POSTULADAS/ }).click();
  8  |     }
  9  |     // Identifico la oferta 501 por su título único, nunca por la posición ordenada de la lista.
  10 |     const titulo = escenario === 'textos-largos' ? 'Frontend sintética' : 'Frontend Angular junior · oferta sintética';
  11 |     if (page.viewportSize()!.width <= 768) {
> 12 |         await page.getByRole('listitem', { name: new RegExp(`^Oferta: ${titulo}`) }).click();
     |                                                                                      ^ Error: locator.click: Test timeout of 15000ms exceeded.
  13 |     } else {
  14 |         await page.getByRole('button', { name: new RegExp(`^Ver detalle de ${titulo}`) }).click();
  15 |     }
  16 |     const dialogo = page.getByRole('dialog');
  17 |     await expect(dialogo).toBeVisible();
  18 |     await expect(dialogo).toContainText(titulo);
  19 |     await expect(dialogo).not.toContainText('Segunda oferta sintética para comprobar borradores independientes');
  20 |     if (escenario === 'pendiente') await expect(dialogo).not.toContainText('97%');
  21 |     if (escenario === 'error') await expect(dialogo).toContainText('fallo técnico');
  22 |     if (escenario === 'reevaluacion-fallida') await expect(dialogo).toContainText('Se conserva la evaluación anterior válida');
  23 |     if (escenario === 'rechazada') await expect(dialogo).toContainText('Java obligatorio');
  24 |     if (escenario === 'aprobada') await expect(dialogo).toContainText('Compatibilidad estimada: 84%');
  25 |     if (escenario === 'desactualizada') await expect(dialogo).toContainText('Evaluación desactualizada');
  26 |     if (escenario === 'historica') await expect(dialogo).toContainText('Esta evaluación histórica no cuenta con desglose');
  27 |     if (escenario === 'postulada') {
  28 |         await expect(dialogo.getByRole('combobox', { name: 'Estado manual actual' })).toContainText('CV enviado');
  29 |         await expect(dialogo.getByLabel('Nota de seguimiento', { exact: true })).toHaveValue('Envié un CV sintético. Pendiente de respuesta; no realicé una postulación real.');
  30 |     }
  31 |     if (escenario === 'textos-largos') await expect(dialogo).toContainText('IdentificadorSinEspacios'.repeat(40));
  32 |     return dialogo;
  33 | }
  34 |
  35 | export async function comprobarGeometriaDetalle(dialogo: Locator, page: Page, comprobarInicio = false) {
  36 |     const contenido = dialogo.locator('.p-dialog-content');
  37 |     if (comprobarInicio) await expect(contenido).toHaveJSProperty('scrollTop', 0);
  38 |     const medir = () => dialogo.evaluate(elemento => {
  39 |         const contenido = elemento.querySelector('.p-dialog-content')!;
  40 |         const footer = elemento.querySelector('.p-dialog-footer')!;
  41 |         return {
  42 |             dialogo: elemento.getBoundingClientRect().toJSON(),
  43 |             overflowPagina: document.documentElement.scrollWidth > innerWidth,
  44 |             overflowDialogo: elemento.scrollWidth > elemento.clientWidth,
  45 |             overflowContenido: contenido.scrollWidth > contenido.clientWidth,
  46 |             contenido: { rect: contenido.getBoundingClientRect().toJSON(), scrollTop: contenido.scrollTop,
  47 |                 altoVisible: contenido.clientHeight, altoTotal: contenido.scrollHeight },
  48 |             footer: footer.getBoundingClientRect().toJSON(),
  49 |         };
  50 |     });
  51 |     const inicial = await medir();
  52 |     const viewport = page.viewportSize()!;
  53 |     const comprobarLimites = (medidas: typeof inicial) => {
  54 |         expect(medidas.overflowPagina).toBe(false);
  55 |         expect(medidas.overflowDialogo).toBe(false);
  56 |         expect(medidas.overflowContenido).toBe(false);
  57 |         expect(medidas.dialogo.left).toBeGreaterThanOrEqual(-1);
  58 |         expect(medidas.dialogo.top).toBeGreaterThanOrEqual(-1);
  59 |         expect(medidas.dialogo.right).toBeLessThanOrEqual(viewport.width + 1);
  60 |         expect(medidas.dialogo.bottom).toBeLessThanOrEqual(viewport.height + 1);
  61 |         expect(medidas.footer.left).toBeGreaterThanOrEqual(Math.max(0, medidas.dialogo.left) - 1);
  62 |         expect(medidas.footer.top).toBeGreaterThanOrEqual(Math.max(0, medidas.dialogo.top) - 1);
  63 |         expect(medidas.footer.right).toBeLessThanOrEqual(Math.min(viewport.width, medidas.dialogo.right) + 1);
  64 |         expect(medidas.footer.bottom).toBeLessThanOrEqual(Math.min(viewport.height, medidas.dialogo.bottom) + 1);
  65 |         // Exijo espacio para operar, no sólo un scroll técnicamente existente de pocos píxeles.
  66 |         expect(medidas.contenido.altoVisible).toBeGreaterThanOrEqual(160);
  67 |         expect(medidas.contenido.rect.top).toBeGreaterThanOrEqual(medidas.dialogo.top - 1);
  68 |         expect(medidas.contenido.rect.bottom).toBeLessThanOrEqual(medidas.footer.top + 1);
  69 |     };
  70 |     comprobarLimites(inicial);
  71 |     // Expando contenido real con teclado; no cambio clases, alturas ni estilos para hacer pasar la prueba.
  72 |     for (const resumen of await dialogo.locator('summary').all()) {
  73 |         if (await resumen.locator('..').getAttribute('open') === null) {
  74 |             await resumen.focus();
  75 |             await resumen.press('Enter');
  76 |         }
  77 |         await expect(resumen.locator('..')).toHaveAttribute('open', '');
  78 |     }
  79 |     await contenido.evaluate(elemento => { elemento.scrollTop = elemento.scrollHeight; });
  80 |     await expect.poll(async () => contenido.evaluate(elemento =>
  81 |         Math.abs(elemento.scrollHeight - elemento.clientHeight - elemento.scrollTop))).toBeLessThanOrEqual(1);
  82 |     const final = await medir();
  83 |     comprobarLimites(final);
  84 |     const ultimo = dialogo.locator('.metadatos-oferta');
  85 |     const rectUltimo = await ultimo.boundingBox();
  86 |     expect(rectUltimo).not.toBeNull();
  87 |     expect(rectUltimo!.y + rectUltimo!.height).toBeLessThanOrEqual(final.contenido.rect.bottom + 1);
  88 |     const guardar = dialogo.getByRole('button', { name: 'Guardar seguimiento', exact: true });
  89 |     await guardar.scrollIntoViewIfNeeded();
  90 |     const rectGuardar = await guardar.boundingBox();
  91 |     expect(rectGuardar).not.toBeNull();
  92 |     expect(rectGuardar!.y).toBeGreaterThanOrEqual(final.contenido.rect.top - 1);
  93 |     expect(rectGuardar!.y + rectGuardar!.height).toBeLessThanOrEqual(final.footer.top + 1);
  94 |     await expect(guardar).toBeInViewport();
  95 |     return { inicial, final, controlSeguimiento: rectGuardar, ultimoContenido: rectUltimo };
  96 | }
  97 |
```
