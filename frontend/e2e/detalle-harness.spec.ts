import { test, expect } from '@playwright/test';
import { abrirDetallePrincipal } from './detalle-pagina';

// Ejercito el Dashboard real; no monto el modal con un componente alternativo.
test.beforeEach(async ({ context }) => {
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
        ? ruta.continue() : ruta.abort());
});

for (const escenario of ['aprobada', 'rechazada', 'pendiente', 'error', 'reevaluacion-fallida', 'desactualizada', 'historica', 'postulada', 'textos-largos']) {
    test(`detalle ${escenario}: lista, apertura y navegación sin escrituras @detalle-smoke`, async ({ page }) => {
        await page.goto(`/?detalle=${escenario}`);
        const dialogo = await abrirDetallePrincipal(page, escenario);
        await page.keyboard.press('Escape');
        await expect(dialogo).toBeHidden();
        await page.getByText('Registro del fixture', { exact: true }).click();
        await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('POST');
        await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('PATCH');
    });
}
